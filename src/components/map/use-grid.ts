'use client';

import { useEffect, useState } from 'react';
import type { MapGridMetric, MapGridResponse } from '@/lib/map-grid';

/* ================================================================== */
/* useGrid — viewport grid sampling for a map metric.                  */
/*                                                                     */
/* GET /api/map/grid with the current view bbox + forecast hour.       */
/* A module-level 10-minute cache keeps scrubbing + play instant and   */
/* prevents request storms; in-flight fetches abort on unmount/change. */
/* Key changes are applied during render (React's "adjust state when   */
/* props change" pattern) so the effect only performs the fetch.       */
/* ================================================================== */

export interface ViewBbox {
  minLat: number;
  minLon: number;
  maxLat: number;
  maxLon: number;
}

interface CacheEntry {
  data: MapGridResponse;
  at: number;
}

const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

function bboxKey(bbox: ViewBbox): string {
  return `${bbox.minLat.toFixed(1)},${bbox.minLon.toFixed(1)},${bbox.maxLat.toFixed(
    1,
  )},${bbox.maxLon.toFixed(1)}`;
}

export interface UseGridResult {
  data: MapGridResponse | null;
  loading: boolean;
  error: string | null;
}

export function useGrid(
  metric: MapGridMetric,
  bbox: ViewBbox | null,
  hour: number,
  enabled: boolean,
): UseGridResult {
  const key = enabled && bbox ? `${metric}|${hour}|${bboxKey(bbox)}` : null;
  const [currentKey, setCurrentKey] = useState<string | null>(null);
  const [state, setState] = useState<UseGridResult>({
    data: null,
    loading: false,
    error: null,
  });

  // Key changed → adopt the (possibly cached) value for the new key.
  // Render-phase state adjustment; React re-renders before committing.
  if (key !== currentKey) {
    setCurrentKey(key);
    const cached = key ? cache.get(key) : undefined;
    if (key && cached && Date.now() - cached.at < CACHE_TTL_MS) {
      setState({ data: cached.data, loading: false, error: null });
    } else {
      setState({ data: null, loading: key != null, error: null });
    }
  }

  useEffect(() => {
    if (!key) return;
    const cached = cache.get(key);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) return;

    const controller = new AbortController();
    const [metricId, hourRaw, boxRaw] = key.split('|');
    const [minLat, minLon, maxLat, maxLon] = boxRaw.split(',').map(Number);
    const params = new URLSearchParams({
      minLat: String(minLat),
      minLon: String(minLon),
      maxLat: String(maxLat),
      maxLon: String(maxLon),
      metric: metricId,
      hour: hourRaw,
    });

    fetch(`/api/map/grid?${params.toString()}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Grid request failed (${res.status})`);
        return (await res.json()) as MapGridResponse;
      })
      .then((data) => {
        cache.set(key, { data, at: Date.now() });
        setState({ data, loading: false, error: null });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          data: null,
          loading: false,
          error: error instanceof Error ? error.message : 'Grid unavailable',
        });
      });

    return () => controller.abort();
  }, [key]);

  return state;
}
