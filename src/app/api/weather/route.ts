import { NextRequest, NextResponse } from 'next/server';
import { fetchWeatherBundle } from '@/lib/openmeteo';

export const runtime = 'nodejs';

/**
 * GET /api/weather?lat=&lon=
 * Server-side Open-Meteo proxy (forecast + air quality, 10-min cache).
 * Always returns metric values; the client converts units instantly.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const lat = Number(searchParams.get('lat'));
  const lon = Number(searchParams.get('lon'));

  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 });
  }

  try {
    const bundle = await fetchWeatherBundle(lat, lon);
    return NextResponse.json(bundle, {
      headers: { 'Cache-Control': 'public, max-age=0, stale-while-revalidate=600' },
    });
  } catch (error) {
    console.error('[api/weather]', error);
    return NextResponse.json(
      { error: 'Weather service is unreachable right now.' },
      { status: 502 },
    );
  }
}
