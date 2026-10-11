import { NextRequest, NextResponse } from 'next/server';
import { fetchEnsemble } from '@/lib/openmeteo';

export const runtime = 'nodejs';

/**
 * GET /api/ensemble?lat=&lon=
 * ICON ensemble mean ± spread for the next 7 days, 10-min cache.
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
    const data = await fetchEnsemble(lat, lon);
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, max-age=0, stale-while-revalidate=600' },
    });
  } catch (error) {
    console.error('[api/ensemble]', error);
    return NextResponse.json(
      { error: 'Ensemble forecast is unreachable right now.' },
      { status: 502 },
    );
  }
}
