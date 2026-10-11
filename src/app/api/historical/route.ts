import { NextRequest, NextResponse } from 'next/server';
import { fetchHistorical } from '@/lib/openmeteo';

export const runtime = 'nodejs';

/**
 * GET /api/historical?lat=&lon=&month=&day=
 * ERA5 history (1995 → last complete year) for one calendar date plus the
 * 30-year normal. The heavy archive call is shared for 30 days per rounded
 * coordinate; this response varies by month/day, so it revalidates hourly.
 * A slow (>15s) or failed archive fetch degrades to 200 with { error }.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const lat = Number(searchParams.get('lat'));
  const lon = Number(searchParams.get('lon'));
  const month = Number(searchParams.get('month'));
  const day = Number(searchParams.get('day'));

  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 });
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: 'Invalid month (expected 1-12)' }, { status: 400 });
  }
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    return NextResponse.json({ error: 'Invalid day (expected 1-31)' }, { status: 400 });
  }

  try {
    const data = await fetchHistorical(lat, lon, month, day);
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, max-age=0, stale-while-revalidate=3600' },
    });
  } catch (error) {
    console.error('[api/historical]', error);
    // Degrade, don't 5xx: the archive is slow only on cold cache.
    return NextResponse.json(
      { error: 'Historical climate data is temporarily unavailable. Try again shortly.' },
      { headers: { 'Cache-Control': 'public, max-age=0, stale-while-revalidate=60' } },
    );
  }
}
