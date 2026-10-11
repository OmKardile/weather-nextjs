import type { GeoQuake, KpPoint, SpaceWeather } from '@/types/weather';

/**
 * Server-side clients for global geo & space event feeds (map layers, sky
 * mode). Independent from openmeteo.ts so parallel feature work on the
 * weather client never conflicts with these.
 */

const USGS_URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson';
const SWPC_KP_URL = 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json';

/** Events move slowly enough for 15 minutes of shared cache. */
const REVALIDATE = 900;

class FeedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FeedError';
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const res = await fetch(url, { next: { revalidate: REVALIDATE } });
      if (!res.ok) throw new FeedError(`Feed failed (${res.status}) for ${new URL(url).hostname}`);
      return (await res.json()) as T;
    } catch (error) {
      lastError = error;
      if (error instanceof FeedError) throw error;
      if (attempt < 2) await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new FeedError('Feed failed');
}

// ---------------------------------------------------------------------------
// USGS earthquakes (M2.5+ past 24 h)
// ---------------------------------------------------------------------------

interface UsgsFeature {
  id: string;
  properties: {
    mag: number | null;
    place: string | null;
    time: number | null;
    url: string | null;
    tsunami: number | null;
  };
  geometry: { coordinates: [number, number, number] | null };
}

interface UsgsFeed {
  features: UsgsFeature[];
}

export async function fetchQuakes(): Promise<GeoQuake[]> {
  const feed = await fetchJson<UsgsFeed>(USGS_URL);
  return feed.features
    .filter((f) => f.properties.mag != null && f.geometry?.coordinates)
    .map((f) => {
      const [lon, lat, depthKm] = f.geometry.coordinates!;
      return {
        id: f.id,
        magnitude: f.properties.mag!,
        place: f.properties.place ?? '',
        time: new Date(f.properties.time ?? Date.now()).toISOString(),
        latitude: lat,
        longitude: lon,
        depthKm: Math.round(depthKm),
        url: f.properties.url ?? '',
        tsunami: f.properties.tsunami === 1,
      };
    })
    .sort((a, b) => b.time.localeCompare(a.time));
}

// ---------------------------------------------------------------------------
// NOAA SWPC planetary K-index (aurora)
// ---------------------------------------------------------------------------

interface SwpcKp {
  time_tag: string;
  Kp: number;
}

export async function fetchSpaceWeather(): Promise<SpaceWeather> {
  const raw = await fetchJson<SwpcKp[]>(SWPC_KP_URL);
  // Product rows are oldest→newest 3-hour steps over the last 30 days.
  const series: KpPoint[] = raw
    .filter((r) => Number.isFinite(r.Kp))
    .map((r) => ({ time: new Date(r.time_tag + 'Z').toISOString(), kp: r.Kp }))
    .slice(-24); // last 3 days
  const latest = series.at(-1)?.kp ?? 0;
  return { latestKp: latest, series, updatedAt: new Date().toISOString() };
}

/**
 * Rough geomagnetic-latitude visibility threshold for a given Kp
 * (NOAA SWPC guidance, interpolated). Aurora may be visible at or above
 * this latitude; useful for a "visible from your city?" hint.
 */
export function auroraVisibilityMinLatitude(kp: number): number {
  if (kp >= 9) return 48;
  if (kp >= 8) return 53;
  if (kp >= 7) return 58;
  if (kp >= 6) return 62;
  if (kp >= 5) return 66;
  return 70;
}
