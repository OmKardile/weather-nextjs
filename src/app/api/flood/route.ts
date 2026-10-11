import { NextRequest, NextResponse } from 'next/server';
import { fetchFlood } from '@/lib/openmeteo';

export const runtime = 'nodejs';

/**
 * GET /api/flood?lat=&lon=
 * River discharge of the nearest grid cell for the next 7 days (GloFAS via
 * the v1 flood API), 1-hour cache. Upstream failures answer 200 with
 * available:false — the client treats flood as strictly optional.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const lat = Number(searchParams.get('lat'));
  const lon = Number(searchParams.get('lon'));

  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 });
  }

  try {
    const data = await fetchFlood(lat, lon);
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, max-age=0, stale-while-revalidate=3600' },
    });
  } catch (error) {
    console.error('[api/flood]', error);
    return NextResponse.json(
      { available: false, daily: [] },
      { headers: { 'Cache-Control': 'public, max-age=0, stale-while-revalidate=60' } },
    );
  }
}
