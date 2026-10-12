/* ==================================================================
   Liquid Glass engine (iOS 27 / WWDC26 recipe)

   Generates, at runtime, an SVG filter that lenses the backdrop of a
   control capsule:

   · A displacement map is rasterized on an offscreen canvas from the
     signed-distance field of the element's rounded rect (squircle-ish
     falloff ≈ Snell's law with IOR ≈ 1.5, center displacement 0 so the
     interior stays crisp).
   · The map feeds THREE feDisplacementMap passes isolated per RGB
     channel (feColorMatrix), at slightly different scales (1.00 / 1.05
     / 1.10), recombined with feBlend screen — the faint chromatic
     fringe at the rim.
   · The filter region extends -20%/+140% so displacement never samples
     outside it.
   · Filters are cached by (w, h, radius) and regenerated on resize.

   Chromium only: Safari claims backdrop-filter: url() support and
   renders NOTHING — detection must be UA-based, never
   CSS.supports(). Non-Chromium browsers get the blur fallback.
   ================================================================== */

interface NavigatorUAData {
  brands?: ReadonlyArray<{ brand: string; version: string }>;
}

let chromiumSnapshot: boolean | null = null;

/** True in Chromium-based browsers (Chrome, Edge, Brave…). */
export function isChromium(): boolean {
  if (typeof navigator === 'undefined') return false;
  if (chromiumSnapshot != null) return chromiumSnapshot;
  const brands = (navigator as Navigator & { userAgentData?: NavigatorUAData })
    .userAgentData?.brands;
  chromiumSnapshot =
    brands?.some((brand) => brand.brand === 'Chromium') ??
    /Chrom(e|ium)|Edg\//.test(navigator.userAgent);
  return chromiumSnapshot;
}

/** Squircle-ish bezel width for a given element size (12–20px). */
function bezelWidth(w: number, h: number): number {
  return Math.max(12, Math.min(20, Math.min(w, h) * 0.28));
}

/* ------------------------------------------------------------------ */
/* Displacement map — rounded-rect SDF rasterized to a canvas          */
/* ------------------------------------------------------------------ */

/*
 * For each pixel: d = signed distance to the rounded-rect border
 * (negative inside the bezel band near the edge, 0 at the border,
 * positive toward the interior). The displacement magnitude follows a
 * convex profile (max at the very edge, 0 one bezel-width inward), and
 * the DIRECTION points inward (lensing pulls the outside world toward
 * the rim, like a thick glass edge).
 *
 * The map is encoded as RG (red = x displacement, green = y), with
 * 0.5/0.5 meaning "no displacement". Blue is unused (kept at 0.5) —
 * per-channel isolation happens in the SVG filter via feColorMatrix.
 */

const MAP_SCALE = 2; // render the map at 2x for smooth bezels

function renderDisplacementMap(w: number, h: number, radius: number): string {
  const mw = Math.max(8, Math.round(w * MAP_SCALE));
  const mh = Math.max(8, Math.round(h * MAP_SCALE));
  const canvas = document.createElement('canvas');
  canvas.width = mw;
  canvas.height = mh;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const img = ctx.createImageData(mw, mh);
  const bezel = bezelWidth(w, h) * MAP_SCALE;
  const r = Math.min(radius, Math.min(w, h) / 2) * MAP_SCALE;

  // Squircle SDF (approximation of the superellipse Apple uses).
  const sdSquircle = (px: number, py: number): number => {
    const cx = mw / 2;
    const cy = mh / 2;
    const hw = mw / 2 - r;
    const hh = mh / 2 - r;
    const qx = Math.max(Math.abs(px - cx) - hw, 0);
    const qy = Math.max(Math.abs(py - cy) - hh, 0);
    const len = Math.hypot(qx, qy);
    // distance to the straight-edge rectangle + corner rounding
    const outer = len + Math.min(Math.max(Math.abs(px - cx) - hw, Math.abs(py - cy) - hh), 0) - r;
    return outer;
  };

  for (let y = 0; y < mh; y += 1) {
    for (let x = 0; x < mw; x += 1) {
      const i = (y * mw + x) * 4;
      const d = sdSquircle(x + 0.5, y + 0.5); // <0 inside, 0 at edge
      // Bezel band: 0 at edge → 1 one bezel inward.
      const t = Math.min(1, Math.max(0, 1 + d / bezel));
      // Convex profile (Snell-ish): strongest at the rim, easing to 0.
      // pow keeps the interior of the band calm near the flat middle.
      const mag = Math.pow(1 - t, 1.6);
      // Direction: inward normal. Approximate via gradient of the SDF.
      const eps = 1;
      const dx = sdSquircle(x + 0.5 + eps, y + 0.5) - d;
      const dy = sdSquircle(x + 0.5, y + 0.5 + eps) - d;
      const gl = Math.hypot(dx, dy) || 1;
      const nx = dx / gl;
      const ny = dy / gl;
      // Encode: 0.5 + normal * magnitude (feDisplacementMap reads
      // channel/255*2-1 as the offset in filter units, scaled).
      img.data[i] = Math.round((0.5 + nx * mag * 0.5) * 255);
      img.data[i + 1] = Math.round((0.5 + ny * mag * 0.5) * 255);
      img.data[i + 2] = 128;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL();
}

/* ------------------------------------------------------------------ */
/* Filter cache + registry                                             */
/* ------------------------------------------------------------------ */

interface CacheEntry {
  id: string;
  refcount: number;
}

const filterCache = new Map<string, CacheEntry>();
let filterSeq = 0;

/** Shared <defs> host element (mounted once by <LiquidGlassProvider>). */
let defsHost: SVGDefsElement | null = null;

function ensureDefsHost(): SVGDefsElement {
  if (defsHost?.isConnected) return defsHost;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.style.position = 'absolute';
  svg.style.width = '0';
  svg.style.height = '0';
  svg.style.overflow = 'hidden';
  svg.style.pointerEvents = 'none';
  defsHost = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  svg.appendChild(defsHost);
  document.body.appendChild(svg);
  return defsHost;
}

export interface RefractionFilterHandle {
  /** Unique filter id (use as `backdrop-filter: url(#id)`). */
  id: string;
  release: () => void;
}

/**
 * Acquire (or reuse) a refraction filter for a (w, h, radius) shape.
 * The displacement scales are multiplied by `strength` (0–1) so the
 * transparency slider can dial refraction down.
 */
export function acquireRefractionFilter(
  w: number,
  h: number,
  radius: number,
  strength: number,
): RefractionFilterHandle | null {
  if (typeof document === 'undefined') return null;
  const key = `${Math.round(w)}x${Math.round(h)}r${Math.round(radius)}`;
  const cached = filterCache.get(key);
  if (cached) {
    cached.refcount += 1;
    return { id: cached.id, release: () => releaseFilter(key) };
  }

  const mapUrl = renderDisplacementMap(w, h, radius);
  if (!mapUrl) return null;

  const id = `lg-refract-${++filterSeq}`;
  const defs = ensureDefsHost();

  const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
  filter.setAttribute('id', id);
  filter.setAttribute('x', '-20%');
  filter.setAttribute('y', '-20%');
  filter.setAttribute('width', '140%');
  filter.setAttribute('height', '140%');
  filter.setAttribute('color-interpolation-filters', 'sRGB');

  const scale = (base: number) => (base * Math.max(0, Math.min(1.4, strength))).toFixed(2);

  // The SVG source for the 3-pass chromatic refraction.
  filter.innerHTML = `
    <feImage href="${mapUrl}" result="map" x="0" y="0" width="${Math.round(w)}" height="${Math.round(h)}" preserveAspectRatio="none" />
    <!-- Channel isolation: one map clone per RGB channel -->
    <feColorMatrix in="map" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="mapR" />
    <feColorMatrix in="map" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="mapG" />
    <feColorMatrix in="map" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="mapB" />
    <!-- Three displacement passes at slightly different scales (1.00 / 1.05 / 1.10) -->
    <feDisplacementMap in="SourceGraphic" in2="mapR" scale="${scale(10)}" xChannelSelector="R" yChannelSelector="G" result="passR" />
    <feDisplacementMap in="SourceGraphic" in2="mapG" scale="${scale(10.5)}" xChannelSelector="R" yChannelSelector="G" result="passG" />
    <feDisplacementMap in="SourceGraphic" in2="mapB" scale="${scale(11)}" xChannelSelector="R" yChannelSelector="G" result="passB" />
    <!-- Recombine: screen-blend the passes → faint chromatic fringe at the rim -->
    <feBlend in="passR" in2="passG" mode="screen" result="combinedRG" />
    <feBlend in="combinedRG" in2="passB" mode="screen" result="combined" />
    <!-- Soften the fringe just a touch -->
    <feGaussianBlur in="combined" stdDeviation="0.3" />
  `;
  defs.appendChild(filter);

  filterCache.set(key, { id, refcount: 1 });
  return { id, release: () => releaseFilter(key) };
}

function releaseFilter(key: string): void {
  const entry = filterCache.get(key);
  if (!entry) return;
  entry.refcount -= 1;
  if (entry.refcount <= 0) {
    document.getElementById(entry.id)?.remove();
    filterCache.delete(key);
  }
}

/* ------------------------------------------------------------------ */
/* Refraction budget — ≤ 3 live filters (dock, top cluster, one more)   */
/* ------------------------------------------------------------------ */

let refractionBudget = 3;
const refractionTokens = new Set<string>();

/**
 * Try to reserve one of the ≤3 refraction slots. Returns a release
 * token, or null when the budget is spent (element falls back to blur).
 */
export function acquireRefractionSlot(): string | null {
  if (refractionTokens.size >= refractionBudget) return null;
  const token = `slot-${Math.random().toString(36).slice(2)}`;
  refractionTokens.add(token);
  return token;
}

export function releaseRefractionSlot(token: string | null): void {
  if (token) refractionTokens.delete(token);
}
