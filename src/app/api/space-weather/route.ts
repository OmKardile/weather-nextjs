import { NextResponse } from 'next/server';
import { fetchSpaceWeather } from '@/lib/geo-space';

export const runtime = 'nodejs';

/**
 * GET /api/space-weather
 * NOAA SWPC planetary K-index (last 3 days + latest) for aurora visibility.
 */
export async function GET() {
  try {
    const spaceWeather = await fetchSpaceWeather();
    return NextResponse.json(spaceWeather, {
      headers: { 'Cache-Control': 'public, max-age=0, stale-while-revalidate=900' },
    });
  } catch (error) {
    console.error('[api/space-weather]', error);
    return NextResponse.json(
      { error: 'Space weather feed unavailable.' },
      { status: 200 },
    );
  }
}
