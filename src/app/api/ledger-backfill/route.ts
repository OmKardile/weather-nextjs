import { NextRequest, NextResponse } from 'next/server';
import { fetchMeasuredDaily } from '@/lib/openmeteo';

export const runtime = 'nodejs';

/**
 * GET /api/ledger-backfill?lat=&lon=
 *
 * Measured daily high/low for the last 7 days (forecast API with
 * past_days — analysis data, no ERA5 lag). The forecast ledger uses it
 * to score "morning call" records that are older than yesterday, so a
 * missed visit never leaves a day ungraded. Measured values are
 * immutable → 1 hour of shared cache. Degrades to 200 { error }.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const lat = Number(searchParams.get('lat'));
  const lon = Number(searchParams.get('lon'));

  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 });
  }

  try {
    const data = await fetchMeasuredDaily(lat, lon);
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, max-age=0, stale-while-revalidate=3600' },
    });
  } catch (error) {
    console.error('[api/ledger-backfill]', error);
    // Degrade, don't 5xx: the card simply keeps its pending records.
    return NextResponse.json(
      { error: 'Measured daily data is temporarily unavailable. Try again shortly.' },
      { headers: { 'Cache-Control': 'public, max-age=0, stale-while-revalidate=60' } },
    );
  }
}
