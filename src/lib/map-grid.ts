/**
 * Server-side grid sampler for the map layers.
 *
 * One Open-Meteo multi-point request (comma-separated coordinates returns an
 * ARRAY of per-point results) fills a 7×5 lat/lon grid over the map viewport.
 * The wind metric converts speed+direction to u/v components; precip returns
 * mm amounts (+ probability as `values2`); temp returns °C.
 */

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

/** Grid dimensions — 7 lons × 5 lats = 35 points in ONE request. */
export const GRID_COLS = 7;
export const GRID_ROWS = 5;

/** Cap the covered span so a whole-globe view still gets a sane grid. */
const MAX_SPAN_DEG = 12;
/** Floor so tight city views still have interpolation headroom. */
const MIN_SPAN_DEG = 0.2;

export type MapGridMetric = 'wind' | 'precip' | 'temp';

export interface MapGridResponse {
  metric: MapGridMetric;
  hour: number;
  /** Ascending grid latitudes (5). */
  lats: number[];
  /** Ascending grid longitudes (7). */
  lons: number[];
  /** values[latIndex][lonIndex] — u (wind, km/h), precipitation (mm) or temperature (°C). */
  values: number[][];
  /** values2[latIndex][lonIndex] — v (wind) or precipitation probability (%) for precip. */
  values2?: number[][];
  units: string;
}

export const GRID_HOURS_MAX = 47;

interface OmPointHourly {
  hourly?: {
    windspeed_10m?: Array<number | null>;
    winddirection_10m?: Array<number | null>;
    precipitation?: Array<number | null>;
    precipitation_probability?: Array<number | null>;
    temperature_2m?: Array<number | null>;
  };
}

class GridError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GridError';
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchJson<T>(url: string): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const res = await fetch(url, { next: { revalidate: 1800 } });
      if (!res.ok) {
        throw new GridError(`Upstream request failed (${res.status}) for api.open-meteo.com`);
      }
      return (await res.json()) as T;
    } catch (error) {
      lastError = error;
      if (error instanceof GridError) throw error;
      if (attempt < 2) await sleep(250 * (attempt + 1));
    }
  }
  throw lastError instanceof Error ? lastError : new GridError('Upstream request failed');
}

/**
 * Round a bbox to 1 decimal, order it, clamp to web-mercator limits and cap
 * each span (centered) so the grid spacing stays meaningful at every zoom.
 */
export function normalizeGridBbox(
  minLat: number,
  minLon: number,
  maxLat: number,
  maxLon: number,
): { minLat: number; minLon: number; maxLat: number; maxLon: number } {
  const round1 = (v: number) => Math.round(v * 10) / 10;
  let loLat = round1(Math.min(minLat, maxLat));
  let hiLat = round1(Math.max(minLat, maxLat));
  let loLon = round1(Math.min(minLon, maxLon));
  let hiLon = round1(Math.max(minLon, maxLon));

  // Web-mercator latitude limits + sanity clamps.
  loLat = Math.max(-85, Math.min(85, loLat));
  hiLat = Math.max(-85, Math.min(85, hiLat));
  loLon = Math.max(-180, Math.min(180, loLon));
  hiLon = Math.max(-180, Math.min(180, hiLon));

  // Rounding can collapse a tiny bbox — keep a deterministic floor.
  if (hiLat - loLat < 0.1) hiLat = loLat + 0.1;
  if (hiLon - loLon < 0.1) hiLon = loLon + 0.1;

  const clampSpan = (lo: number, hi: number, maxSpan: number, minSpan: number) => {
    const center = (lo + hi) / 2;
    let span = hi - lo;
    if (span > maxSpan) span = maxSpan;
    if (span < minSpan) span = minSpan;
    return [center - span / 2, center + span / 2] as const;
  };

  [loLat, hiLat] = clampSpan(loLat, hiLat, MAX_SPAN_DEG, MIN_SPAN_DEG);
  [loLon, hiLon] = clampSpan(loLon, hiLon, MAX_SPAN_DEG, MIN_SPAN_DEG);
  return { minLat: loLat, minLon: loLon, maxLat: hiLat, maxLon: hiLon };
}

function linspace(lo: number, hi: number, count: number): number[] {
  const out: number[] = [];
  const step = count > 1 ? (hi - lo) / (count - 1) : 0;
  for (let i = 0; i < count; i += 1) {
    out.push(Math.round((lo + step * i) * 1000) / 1000);
  }
  return out;
}

/** Sample the 7×5 grid for a metric + forecast hour (0 = current hour). */
export async function fetchMapGrid(
  minLat: number,
  minLon: number,
  maxLat: number,
  maxLon: number,
  metric: MapGridMetric,
  hour: number,
): Promise<MapGridResponse> {
  const box = normalizeGridBbox(minLat, minLon, maxLat, maxLon);
  const lats = linspace(box.minLat, box.maxLat, GRID_ROWS);
  const lons = linspace(box.minLon, box.maxLon, GRID_COLS);

  // Row-major coordinate lists (lat outer loop) — the API preserves order.
  const latList: string[] = [];
  const lonList: string[] = [];
  for (const lat of lats) {
    for (const lon of lons) {
      latList.push(String(lat));
      lonList.push(String(lon));
    }
  }

  const hourly =
    metric === 'wind'
      ? 'windspeed_10m,winddirection_10m'
      : metric === 'precip'
        ? 'precipitation,precipitation_probability'
        : 'temperature_2m';

  const url =
    `${FORECAST_URL}?latitude=${latList.join(',')}&longitude=${lonList.join(',')}` +
    `&hourly=${hourly}&forecast_hours=${hour + 1}`;

  const raw = await fetchJson<OmPointHourly[] | OmPointHourly>(url);
  const points = Array.isArray(raw) ? raw : [raw];
  // Missing points (upstream hiccup) fall back to zero-filled rows below.
  while (points.length < GRID_ROWS * GRID_COLS) points.push({});

  const values: number[][] = [];
  const values2: number[][] = [];
  const at = (arr: Array<number | null> | undefined, idx: number) => {
    const v = arr?.[idx];
    return Number.isFinite(v) ? (v as number) : 0;
  };

  for (let i = 0; i < GRID_ROWS; i += 1) {
    const row: number[] = [];
    const row2: number[] = [];
    for (let j = 0; j < GRID_COLS; j += 1) {
      const point = points[i * GRID_COLS + j] ?? {};
      const hourlyPoint = point.hourly ?? {};
      if (metric === 'wind') {
        const speed = at(hourlyPoint.windspeed_10m, hour);
        const dir = at(hourlyPoint.winddirection_10m, hour);
        // Meteorological direction = where wind comes FROM; advect TOWARD dir+180.
        const toRad = ((dir + 180) * Math.PI) / 180;
        row.push(Math.round(speed * Math.sin(toRad) * 100) / 100);
        row2.push(Math.round(speed * Math.cos(toRad) * 100) / 100);
      } else if (metric === 'precip') {
        row.push(Math.round(at(hourlyPoint.precipitation, hour) * 100) / 100);
        row2.push(Math.round(at(hourlyPoint.precipitation_probability, hour)));
      } else {
        row.push(Math.round(at(hourlyPoint.temperature_2m, hour) * 10) / 10);
        row2.push(0);
      }
    }
    values.push(row);
    values2.push(row2);
  }

  return {
    metric,
    hour,
    lats,
    lons,
    values,
    // v components (wind) / precipitation probability (%) — wind & precip only.
    values2: metric === 'temp' ? undefined : values2,
    units: metric === 'wind' ? 'km/h' : metric === 'precip' ? 'mm' : '°C',
  };
}
