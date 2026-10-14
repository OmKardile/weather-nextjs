'use client';

import { memo, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { CloudDensity, SceneConfig } from '@/lib/scenes';
import type { DayPhase } from '@/types/weather';
import './scene.css';

/* ------------------------------------------------------------------ */
/* Deterministic randomness                                            */
/*                                                                     */
/* Every decorative layer is generated from a seed derived from the    */
/* scene key, so the server-rendered markup and the first client       */
/* render are identical (no hydration mismatches) while still feeling  */
/* organically random — and staying stable per scene across re-renders */
/* (and across the two layers of a crossfade).                         */
/* ------------------------------------------------------------------ */

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ */
/* Stars — twinkling field + one recurring shooting star               */
/* ------------------------------------------------------------------ */

const STAR_COUNT = 110;

interface StarSpec {
  left: number;
  top: number;
  size: number;
  opacity: number;
  duration: number;
  delay: number;
}

function Stars({ seed }: { seed: string }) {
  const stars = useMemo<StarSpec[]>(() => {
    const rand = mulberry32(hashString(`${seed}:stars`));
    return Array.from({ length: STAR_COUNT }, () => ({
      left: rand() * 100,
      // Bias density toward the top of the sky.
      top: Math.pow(rand(), 1.35) * 100,
      size: 1 + rand() * 1.5,
      opacity: 0.3 + rand() * 0.7,
      duration: 2.5 + rand() * 3.5,
      delay: rand() * 6,
    }));
  }, [seed]);

  const comet = useMemo(() => {
    const rand = mulberry32(hashString(`${seed}:comet`));
    return { left: 6 + rand() * 26, top: 5 + rand() * 14, delay: 3 + rand() * 7 };
  }, [seed]);

  return (
    <div className="scene-layer" aria-hidden="true">
      {stars.map((star, i) => (
        <span
          key={i}
          className="scene-star"
          style={{
            left: `${star.left}%`,
            top: `${star.top}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            opacity: star.opacity,
            animationDuration: `${star.duration}s`,
            animationDelay: `${star.delay}s`,
          }}
        />
      ))}
      <span
        className="scene-shooting-star"
        style={{
          left: `${comet.left}%`,
          top: `${comet.top}%`,
          animationDelay: `${comet.delay}s`,
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Moon — glowing disc with craters, slow float                        */
/* ------------------------------------------------------------------ */

function Moon({ seed }: { seed: string }) {
  const { right, top, craters } = useMemo(() => {
    const rand = mulberry32(hashString(`${seed}:moon`));
    return {
      right: 12 + rand() * 6,
      top: 10 + rand() * 6,
      craters: [
        { left: 16 + rand() * 12, top: 22 + rand() * 8, size: 13 + rand() * 6 },
        { left: 50 + rand() * 12, top: 48 + rand() * 12, size: 9 + rand() * 5 },
        { left: 28 + rand() * 10, top: 60 + rand() * 8, size: 7 + rand() * 4 },
      ],
    };
  }, [seed]);

  return (
    <div className="scene-anchor" aria-hidden="true" style={{ right: `${right}%`, top: `${top}%` }}>
      <div className="scene-moon">
        {craters.map((crater, i) => (
          <span
            key={i}
            className="scene-moon-crater"
            style={{
              left: `${crater.left}%`,
              top: `${crater.top}%`,
              width: `${crater.size}px`,
              height: `${crater.size}px`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sun — high soft disc by day, low amber glow for dawn/dusk           */
/* ------------------------------------------------------------------ */

function Sun({ phase, seed }: { phase: DayPhase; seed: string }) {
  const horizon = phase === 'dawn' || phase === 'dusk';

  const pos = useMemo(() => {
    const rand = mulberry32(hashString(`${seed}:sun`));
    if (horizon) return { horizon: true, offset: 22 + rand() * 8, left: 20 + rand() * 30 };
    // Day sun parks in the content column (34–58%) — the old 10–28% band
    // sat exactly under the desktop CitiesSidebar, and its 45vmin halo
    // read as a rendering artifact bleeding through the sidebar glass.
    return { horizon: false, offset: 8 + rand() * 6, left: 34 + rand() * 24 };
  }, [seed, horizon]);

  const style: CSSProperties = pos.horizon
    ? { left: `${pos.left}%`, bottom: `${pos.offset}%` }
    : { left: `${pos.left}%`, top: `${pos.offset}%` };

  return (
    <div
      className={`scene-anchor scene-sun ${horizon ? 'scene-sun--horizon' : 'scene-sun--day'}`}
      style={style}
      aria-hidden="true"
    >
      <div className="scene-sun-rays" />
      <div className="scene-sun-halo" />
      <div className="scene-sun-core" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Aurora — blurred teal-mint curtains in the upper third              */
/* ------------------------------------------------------------------ */

const AURORA_COLORS = ['#45D1B3', '#74DCC2', '#A8EBD9'] as const;

function Aurora({ seed }: { seed: string }) {
  const bands = useMemo(() => {
    const rand = mulberry32(hashString(`${seed}:aurora`));
    const count = 2 + Math.floor(rand() * 2);
    return Array.from({ length: count }, (_, i) => ({
      top: 2 + rand() * 20,
      height: 25 + rand() * 13,
      opacity: 0.14 + rand() * 0.06,
      duration: 26 + rand() * 14,
      delay: -rand() * 24,
      from: AURORA_COLORS[i % AURORA_COLORS.length],
      to: AURORA_COLORS[(i + 1) % AURORA_COLORS.length],
    }));
  }, [seed]);

  return (
    <div className="scene-layer" aria-hidden="true">
      {bands.map((band, i) => (
        <div
          key={i}
          className="scene-aurora-track"
          style={{
            top: `${band.top}%`,
            height: `${band.height}vh`,
            animationDuration: `${band.duration}s`,
            animationDelay: `${band.delay}s`,
          }}
        >
          <div
            className="scene-aurora-band"
            style={{
              opacity: band.opacity,
              background: `linear-gradient(90deg, transparent 0%, ${band.from} 32%, ${band.to} 55%, ${band.from} 78%, transparent 100%)`,
            }}
          />
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Clouds — parallax puff groups drifting across the sky               */
/* ------------------------------------------------------------------ */

type CloudVariant = 'day' | 'golden' | 'night';

const CLOUD_COUNTS: Record<CloudDensity, number> = { 0: 0, 1: 2, 2: 4, 3: 6 };

interface CloudPuff {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface CloudSpec {
  top: number;
  scale: number;
  width: number;
  duration: number;
  delay: number;
  blur: number;
  depth: number;
  puffs: CloudPuff[];
}

function cloudColor(variant: CloudVariant, depth: number): string {
  if (variant === 'night') return `rgb(202 226 220 / ${(0.16 + depth * 0.14).toFixed(3)})`;
  if (variant === 'golden') return `rgb(255 243 224 / ${(0.3 + depth * 0.2).toFixed(3)})`;
  return `rgb(255 255 255 / ${(0.5 + depth * 0.25).toFixed(3)})`;
}

function Clouds({ seed, density, variant }: { seed: string; density: CloudDensity; variant: CloudVariant }) {
  const clouds = useMemo<CloudSpec[]>(() => {
    const rand = mulberry32(hashString(`${seed}:clouds:${density}:${variant}`));
    const count = CLOUD_COUNTS[density];
    if (count <= 0) return [];
    return Array.from({ length: count }, () => {
      const width = 260 + rand() * 260;
      const scale = 0.72 + rand() * 0.4;
      // Depth 0 = far away (small, faint, blurry) · 1 = near (big, bold, sharp).
      const depth = Math.min(1, Math.max(0, (scale - 0.72) / 0.4));
      const puffCount = 3 + Math.floor(rand() * 3);
      const puffs = Array.from({ length: puffCount }, (_, p) => {
        const w = 32 + rand() * 22;
        return {
          left: (p / Math.max(1, puffCount - 1)) * (100 - w) * (0.9 + rand() * 0.1),
          top: rand() * 26,
          width: w,
          height: 55 + rand() * 45,
        };
      });
      return {
        top: 5 + rand() * 40,
        scale,
        width,
        duration: 70 + rand() * 80,
        delay: rand() * 90,
        blur: 28 - depth * 14,
        depth,
        puffs,
      };
    }).sort((a, b) => a.top - b.top);
  }, [seed, density, variant]);

  return (
    <div className="scene-layer" aria-hidden="true">
      {clouds.map((cloud, i) => (
        <div
          key={i}
          className="scene-cloud-track"
          style={
            {
              top: `${cloud.top}%`,
              animationDuration: `${cloud.duration}s`,
              animationDelay: `-${cloud.delay}s`,
              '--cloud-w': `${cloud.width}px`,
            } as CSSProperties
          }
        >
          <div
            className="scene-cloud-body"
            style={{
              transform: `scale(${cloud.scale})`,
              filter: `blur(${cloud.blur}px)`,
              color: cloudColor(variant, cloud.depth),
            }}
          >
            {cloud.puffs.map((puff, j) => (
              <span
                key={j}
                className="scene-cloud-puff"
                style={{
                  left: `${puff.left}%`,
                  top: `${puff.top}%`,
                  width: `${puff.width}%`,
                  height: `${puff.height}%`,
                }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Fog — three drifting bands + a full-viewport haze                   */
/* ------------------------------------------------------------------ */

function Fog({ seed }: { seed: string }) {
  const bands = useMemo(() => {
    const rand = mulberry32(hashString(`${seed}:fog`));
    return [
      { top: 22 + rand() * 8, height: 18 + rand() * 5, duration: 46 + rand() * 14, delay: -rand() * 20 },
      { top: 44 + rand() * 8, height: 20 + rand() * 6, duration: 38 + rand() * 12, delay: -rand() * 20 },
      { top: 66 + rand() * 8, height: 22 + rand() * 8, duration: 30 + rand() * 10, delay: -rand() * 20 },
    ];
  }, [seed]);

  return (
    <div className="scene-layer" aria-hidden="true">
      {bands.map((band, i) => (
        <div
          key={i}
          className="scene-fog-track"
          style={{
            top: `${band.top}%`,
            height: `${band.height}%`,
            animationDuration: `${band.duration}s`,
            animationDelay: `${band.delay}s`,
          }}
        >
          <div className="scene-fog-band" />
        </div>
      ))}
      <div className="scene-fog-haze" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Lightning — JS-driven double flash + stylized SVG bolt              */
/* ------------------------------------------------------------------ */

interface BoltSpec {
  left: number;
  top: number;
  flip: boolean;
  variant: number;
}

const BOLT_PATHS = ['50,4 33,76 56,86 29,206', '38,4 60,68 37,80 63,206', '56,4 30,60 53,72 27,182'];

function Lightning() {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [bolt, setBolt] = useState<BoltSpec | null>(null);

  useEffect(() => {
    // Skip the whole effect under reduced motion — no timers, no flashes.
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motionQuery.matches) return;

    const pending = new Set<number>();
    let disposed = false;

    const later = (fn: () => void, ms: number): void => {
      const id = window.setTimeout(() => {
        pending.delete(id);
        if (!disposed) fn();
      }, ms);
      pending.add(id);
    };

    const strike = (): void => {
      const overlay = overlayRef.current;
      if (!overlay) return;
      // First pulse (~110ms, peak 0.38 — dramatic but not blinding).
      overlay.style.opacity = '0.38';
      later(() => {
        overlay.style.opacity = '0';
      }, 110);
      // Second pulse + bolt after a short dark gap.
      later(() => {
        overlay.style.opacity = '0.3';
        setBolt({
          left: 12 + Math.random() * 68,
          top: 4 + Math.random() * 14,
          flip: Math.random() > 0.5,
          variant: Math.floor(Math.random() * BOLT_PATHS.length),
        });
        later(() => {
          overlay.style.opacity = '0';
        }, 110);
      }, 190);
      later(() => setBolt(null), 300);
    };

    const schedule = (): void => {
      later(() => {
        strike();
        schedule();
      }, 6000 + Math.random() * 8000);
    };
    schedule();

    const onMotionChange = (): void => {
      if (!motionQuery.matches) return;
      disposed = true;
      pending.forEach((id) => window.clearTimeout(id));
      pending.clear();
      setBolt(null);
      if (overlayRef.current) overlayRef.current.style.opacity = '0';
    };
    motionQuery.addEventListener('change', onMotionChange);

    return () => {
      disposed = true;
      pending.forEach((id) => window.clearTimeout(id));
      pending.clear();
      motionQuery.removeEventListener('change', onMotionChange);
    };
  }, []);

  return (
    <div className="scene-layer" aria-hidden="true">
      <div ref={overlayRef} className="scene-lightning" />
      {bolt ? (
        <svg
          className="scene-bolt"
          viewBox="0 0 90 210"
          style={{ left: `${bolt.left}%`, top: `${bolt.top}%`, transform: bolt.flip ? 'scaleX(-1)' : undefined }}
        >
          <polyline points={BOLT_PATHS[bolt.variant]} />
        </svg>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Light blobs — refractable scenery for the Liquid Glass controls.    */
/*                                                                     */
/* Large soft radial glows + a diagonal gradient band + a few small    */
/* high-contrast orbs, all pinned near the TOP and BOTTOM edges so     */
/* the middle stays calm for text. Without these, a flat teal sky      */
/* gives the lensing nothing to bend.                                  */
/* ------------------------------------------------------------------ */

type BlobPalette = { a: string; b: string; c: string; orb: string };

const BLOB_PALETTES: Record<'dark-night' | 'dark-golden' | 'light', BlobPalette> = {
  'dark-night': { a: '#45D1B3', b: '#7C6FA8', c: '#1FA98C', orb: '#BFF7E8' },
  'dark-golden': { a: '#F0954A', b: '#B4768B', c: '#8A6FA0', orb: '#FFD9A0' },
  light: { a: '#FFE9A3', b: '#FFFFFF', c: '#9FDFD3', orb: '#FFF7E0' },
};

interface BlobSpec {
  className: string;
  style: CSSProperties;
}

function SceneBlobs({
  seed,
  phase,
  surface,
}: {
  seed: string;
  phase: DayPhase;
  surface: 'dark' | 'light';
}) {
  const palette =
    surface === 'light'
      ? BLOB_PALETTES.light
      : phase === 'night'
        ? BLOB_PALETTES['dark-night']
        : BLOB_PALETTES['dark-golden'];

  const blobs = useMemo<BlobSpec[]>(() => {
    const rand = mulberry32(hashString(`${seed}:blobs`));
    const jitter = (v: number, spread: number) => v + (rand() - 0.5) * spread;
    return [
      // Big soft glows — top edge
      {
        className: 'scene-blob scene-blob-a',
        style: {
          background: `radial-gradient(circle, ${palette.a} 0%, transparent 70%)`,
          left: `${jitter(-18, 14)}%`,
          top: `${jitter(-16, 10)}%`,
          animationDelay: `${rand() * -60}s`,
          animationDuration: `${52 + rand() * 26}s`,
        },
      },
      {
        className: 'scene-blob scene-blob-b',
        style: {
          background: `radial-gradient(circle, ${palette.b} 0%, transparent 70%)`,
          right: `${jitter(-14, 12)}%`,
          top: `${jitter(-10, 12)}%`,
          animationDelay: `${rand() * -60}s`,
          animationDuration: `${58 + rand() * 30}s`,
        },
      },
      // Bottom edge
      {
        className: 'scene-blob scene-blob-c',
        style: {
          background: `radial-gradient(circle, ${palette.c} 0%, transparent 70%)`,
          left: `${jitter(4, 18)}%`,
          bottom: `${jitter(-18, 12)}%`,
          animationDelay: `${rand() * -60}s`,
          animationDuration: `${60 + rand() * 28}s`,
        },
      },
      {
        className: 'scene-blob scene-blob-d',
        style: {
          background: `radial-gradient(circle, ${palette.a} 0%, transparent 72%)`,
          right: `${jitter(-16, 14)}%`,
          bottom: `${jitter(-14, 10)}%`,
          animationDelay: `${rand() * -60}s`,
          animationDuration: `${48 + rand() * 24}s`,
        },
      },
      // Small high-contrast orbs near the edges — the sparkle the rim
      // light catches as it slides under the dock / top capsule.
      {
        className: 'scene-orb',
        style: {
          background: palette.orb,
          left: `${jitter(12, 10)}%`,
          top: `${jitter(6, 6)}%`,
        },
      },
      {
        className: 'scene-orb scene-orb-late',
        style: {
          background: palette.orb,
          right: `${jitter(16, 10)}%`,
          bottom: `${jitter(8, 8)}%`,
        },
      },
    ];
  }, [seed, palette]);

  return (
    <div className="scene-layer" aria-hidden="true">
      <div
        className="scene-band"
        style={{
          background: `linear-gradient(105deg, transparent 20%, ${palette.b}55 46%, ${palette.a}40 58%, transparent 82%)`,
        }}
      />
      {blobs.map((blob, i) => (
        <span key={i} className={blob.className} style={blob.style} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* SceneLayers — renders only the layers enabled by the scene config   */
/* ------------------------------------------------------------------ */

export const SceneLayers = memo(function SceneLayers({ scene }: { scene: SceneConfig }) {
  const { layers, phase, surface, key } = scene;

  let cloudVariant: CloudVariant = 'day';
  if (surface === 'dark') cloudVariant = layers.sun ? 'golden' : 'night';

  return (
    <>
      {/* Blobs first — closest to the base gradient, under every other layer. */}
      <SceneBlobs seed={key} phase={phase} surface={surface} />
      {layers.stars ? <Stars seed={key} /> : null}
      {layers.aurora ? <Aurora seed={key} /> : null}
      {layers.moon ? <Moon seed={key} /> : null}
      {layers.sun ? <Sun phase={phase} seed={key} /> : null}
      {layers.clouds > 0 ? <Clouds seed={key} density={layers.clouds} variant={cloudVariant} /> : null}
      {layers.fog ? <Fog seed={key} /> : null}
      {layers.lightning ? <Lightning /> : null}
    </>
  );
});
