import { NextRequest, NextResponse } from 'next/server';
import { reverseGeocode, searchCities } from '@/lib/openmeteo';

export const runtime = 'nodejs';

/**
 * GET /api/geocode?q=<query>  → city search (Open-Meteo geocoding)
 * GET /api/geocode?lat=&lon=  → reverse geocode (Nominatim, graceful fallback)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const query = searchParams.get('q')?.trim();
  const lat = Number(searchParams.get('lat'));
  const lon = Number(searchParams.get('lon'));

  try {
    if (query) {
      if (query.length < 2) {
        return NextResponse.json([]);
      }
      const cities = await searchCities(query);
      return NextResponse.json(cities);
    }

    if (Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
      const city = await reverseGeocode(lat, lon);
      return NextResponse.json(city);
    }

    return NextResponse.json({ error: 'Provide ?q= or ?lat=&lon=' }, { status: 400 });
  } catch (error) {
    console.error('[api/geocode]', error);
    return NextResponse.json({ error: 'Geocoding service unavailable' }, { status: 502 });
  }
}
