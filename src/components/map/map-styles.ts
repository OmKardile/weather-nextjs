/* ================================================================== */
/* Map module — shared constants, ramps, basemap styles, tile URLs.    */
/* Pure module: no React, no maplibre (safe to import anywhere).       */
/* ================================================================== */

import type { StyleSpecification } from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';

export const BASEMAP_ATTRIBUTION = 'Basemap © Esri, HERE, Garmin, FAO, NOAA, USGS';
export const GIBS_ATTRIBUTION = 'NASA GIBS';
export const RAINVIEWER_ATTRIBUTION = 'RainViewer';

/* Basemap note: CARTO's basemaps.cartocdn.com now serves "API KEY REQUIRED"
 * placeholder tiles from this environment (keyless anonymous access was
 * retired) — the keyless Esri Gray Canvas pair (dark/light, base + label
 * overlay) is used instead, with the same dark/light toggle semantics. */

/** RainViewer free tier: past frames only, tiles capped at zoom 7. */
export const RAINVIEWER_MAX_ZOOM = 7;
/** NASA GIBS MODIS true color is served through zoom level 9. */
export const GIBS_MAX_ZOOM = 9;

export type BasemapKind = 'dark' | 'light';

export const BASEMAP_BG: Record<BasemapKind, string> = {
  dark: '#1d1d22',
  light: '#f0efe9',
};

/** Esri Gray Canvas raster tiles ({z}/{y}/{x} order, 256 px, keyless). */
function esriSource(layer: string) {
  return {
    type: 'raster' as const,
    tiles: [
      `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/${layer}/MapServer/tile/{z}/{y}/{x}`,
    ],
    tileSize: 256,
    attribution: BASEMAP_ATTRIBUTION,
    maxzoom: 16,
  };
}

/** Both basemaps are declared up-front; the theme just flips visibility. */
export function buildBasemapStyle(): StyleSpecification {
  return {
    version: 8,
    sources: {
      'basemap-dark-base': esriSource('World_Dark_Gray_Base'),
      'basemap-dark-labels': esriSource('World_Dark_Gray_Reference'),
      'basemap-light-base': esriSource('World_Light_Gray_Base'),
      'basemap-light-labels': esriSource('World_Light_Gray_Reference'),
      'empty-anchor': { type: 'geojson', data: EMPTY_GEOJSON },
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': BASEMAP_BG.dark } },
      { id: 'basemap-dark', type: 'raster', source: 'basemap-dark-base' },
      { id: 'basemap-dark-labels', type: 'raster', source: 'basemap-dark-labels' },
      { id: 'basemap-light', type: 'raster', source: 'basemap-light-base', layout: { visibility: 'none' } },
      {
        id: 'basemap-light-labels',
        type: 'raster',
        source: 'basemap-light-labels',
        layout: { visibility: 'none' },
      },
      // Invisible anchor — every dynamic layer inserts immediately before it,
      // which keeps the stacking order basemap < satellite < radar < quakes.
      {
        id: 'overlay-anchor',
        type: 'circle',
        source: 'empty-anchor',
        layout: { visibility: 'none' },
      },
    ],
  };
}

/** NASA GIBS MODIS true color for YESTERDAY (UTC) — imagery certainly exists. */
export function gibsTileUrl(now = Date.now()): string {
  const date = new Date(now - 24 * 60 * 60 * 1000);
  return (
    'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/' +
    `MODIS_Terra_CorrectedReflectance_TrueColor/default/${date.toISOString().slice(0, 10)}/` +
    'GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg'
  );
}

/** RainViewer past-frame raster tiles (256 px, color scheme 2, smooth 1_1). */
export function rainViewerTileUrl(host: string, path: string): string {
  return `${host}${path}/256/{z}/{x}/{y}/2/1_1.png`;
}

/* ------------------------------------------------------------------ */
/* Color ramps                                                         */
/* ------------------------------------------------------------------ */

export type RampStop = { t: number; rgb: readonly [number, number, number]; a: number };

/** Bilinear-free ramp sampler: interpolates rgb + alpha between stops. */
export function sampleRamp(stops: RampStop[], t: number): string {
  const x = Math.min(1, Math.max(0, t));
  let lo = stops[0];
  let hi = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i += 1) {
    if (x >= stops[i].t && x <= stops[i + 1].t) {
      lo = stops[i];
      hi = stops[i + 1];
      break;
    }
  }
  const span = hi.t - lo.t;
  const k = span > 0 ? (x - lo.t) / span : 0;
  const mix = (a: number, b: number) => Math.round(a + (b - a) * k);
  return `rgba(${mix(lo.rgb[0], hi.rgb[0])}, ${mix(lo.rgb[1], hi.rgb[1])}, ${mix(
    lo.rgb[2],
    hi.rgb[2],
  )}, ${(lo.a + (hi.a - lo.a) * k).toFixed(3)})`;
}

/** Wind speed ramp — aurora teal → white (0–60 km/h). */
export const WIND_RAMP: RampStop[] = [
  { t: 0, rgb: [38, 128, 114], a: 0.5 },
  { t: 0.3, rgb: [69, 209, 179], a: 0.65 },
  { t: 0.65, rgb: [168, 235, 217], a: 0.8 },
  { t: 1, rgb: [255, 255, 255], a: 0.95 },
];

/** Precipitation ramp — translucent blue (0–8 mm/h). */
export const PRECIP_RAMP: RampStop[] = [
  { t: 0, rgb: [96, 156, 235], a: 0.16 },
  { t: 0.2, rgb: [88, 148, 235], a: 0.34 },
  { t: 0.5, rgb: [58, 116, 224], a: 0.5 },
  { t: 0.8, rgb: [40, 82, 214], a: 0.62 },
  { t: 1, rgb: [28, 52, 168], a: 0.72 },
];

/** Temperature ramp — deep blue → aurora teal → amber → red. */
export const TEMP_RAMP: RampStop[] = [
  { t: 0, rgb: [39, 75, 219], a: 0.5 },
  { t: 0.33, rgb: [34, 188, 160], a: 0.48 },
  { t: 0.66, rgb: [232, 197, 77], a: 0.52 },
  { t: 1, rgb: [225, 85, 47], a: 0.58 },
];

/** dBZ-ish radar legend ramp (blue → teal → yellow → orange → red). */
export const RADAR_RAMP: RampStop[] = [
  { t: 0, rgb: [74, 123, 208], a: 0.85 },
  { t: 0.3, rgb: [69, 209, 179], a: 0.85 },
  { t: 0.55, rgb: [255, 224, 138], a: 0.85 },
  { t: 0.8, rgb: [240, 149, 74], a: 0.85 },
  { t: 1, rgb: [225, 85, 47], a: 0.85 },
];

/** CSS gradient (legends) from a ramp's stops. */
export function rampGradient(stops: RampStop[]): string {
  return `linear-gradient(to right, ${stops
    .map((s) => `rgba(${s.rgb[0]}, ${s.rgb[1]}, ${s.rgb[2]}, ${Math.max(s.a, 0.85)})`)
    .join(', ')})`;
}

export const EMPTY_GEOJSON: FeatureCollection = { type: 'FeatureCollection', features: [] };

/** Quake circle color buckets: <4 teal · 4–5 amber · ≥5 red. */
export function quakeColor(magnitude: number): string {
  if (magnitude >= 5) return '#E1552F';
  if (magnitude >= 4) return '#E8C54D';
  return '#45d1b3';
}
