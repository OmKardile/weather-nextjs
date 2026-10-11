import { NextRequest, NextResponse } from 'next/server';
import {
  GRID_HOURS_MAX,
  fetchMapGrid,
  type MapGridMetric,
} from '@/lib/map-grid';

export const runtime = 'nodejs';

const METRICS: ReadonlySet<string> = new Set(['wind', 'precip', 'temp']);

/**
 * GET /api/map/grid?minLat=&minLon=&maxLat=&maxLon=&metric=wind|precip|temp&hour=0..47
 *
 * 7×5 grid over the bbox in ONE Open-Meteo multi-point request. The bbox is
 * rounded to 1 decimal (and spans capped) so identical viewports share the
 * 30-minute upstream cache. Hour 0 = current hour.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const minLat = Number(searchParams.get('minLat'));
  const minLon = Number(searchParams.get('minLon'));
  const maxLat = Number(searchParams.get('maxLat'));
  const maxLon = Number(searchParams.get('maxLon'));
  const metric = searchParams.get('metric') ?? '';
  const hour = Number(searchParams.get('hour') ?? '0');

  if (
    !Number.isFinite(minLat) ||
    !Number.isFinite(minLon) ||
    !Number.isFinite(maxLat) ||
    !Number.isFinite(maxLon) ||
    Math.abs(minLat) > 90 ||
    Math.abs(maxLat) > 90 ||
    Math.abs(minLon) > 180 ||
    Math.abs(maxLon) > 180
  ) {
    return NextResponse.json({ error: 'Invalid bounding box' }, { status: 400 });
  }
  if (!METRICS.has(metric)) {
    return NextResponse.json(
      { error: 'metric must be wind, precip or temp' },
      { status: 400 },
    );
  }
  if (!Number.isInteger(hour) || hour < 0 || hour > GRID_HOURS_MAX) {
    return NextResponse.json({ error: 'hour must be an integer 0–47' }, { status: 400 });
  }

  try {
    const grid = await fetchMapGrid(
      minLat,
      minLon,
      maxLat,
      maxLon,
      metric as MapGridMetric,
      hour,
    );
    return NextResponse.json(grid, {
      headers: { 'Cache-Control': 'public, max-age=0, stale-while-revalidate=1800' },
    });
  } catch (error) {
    console.error('[api/map/grid]', error);
    return NextResponse.json(
      { error: 'Grid sampling is unavailable right now.' },
      { status: 502 },
    );
  }
}
