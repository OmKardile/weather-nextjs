import { NextResponse } from 'next/server';
import { fetchQuakes } from '@/lib/geo-space';

export const runtime = 'nodejs';

/**
 * GET /api/earthquakes
 * USGS M2.5+ quakes from the past 24 h, normalized for the map layer.
 */
export async function GET() {
  try {
    const quakes = await fetchQuakes();
    return NextResponse.json(
      { quakes, updatedAt: new Date().toISOString() },
      { headers: { 'Cache-Control': 'public, max-age=0, stale-while-revalidate=900' } },
    );
  } catch (error) {
    console.error('[api/earthquakes]', error);
    return NextResponse.json({ quakes: [], error: 'Earthquake feed unavailable.' }, { status: 200 });
  }
}
