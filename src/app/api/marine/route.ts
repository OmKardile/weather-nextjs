import { NextRequest, NextResponse } from 'next/server';
import { fetchMarine } from '@/lib/openmeteo';

export const runtime = 'nodejs';

/**
 * GET /api/marine?lat=&lon=
 * 7-day wave forecast (coastal grid cells only), 1-hour cache. Inland
 * coordinates and upstream failures both answer 200 with available:false —
 * the client treats marine as strictly optional.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const lat = Number(searchParams.get('lat'));
  const lon = Number(searchParams.get('lon'));

  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 });
  }

  try {
    const data = await fetchMarine(lat, lon);
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, max-age=0, stale-while-revalidate=3600' },
    });
  } catch (error) {
    console.error('[api/marine]', error);
    return NextResponse.json(
      { available: false, daily: [] },
      { headers: { 'Cache-Control': 'public, max-age=0, stale-while-revalidate=60' } },
    );
  }
}
