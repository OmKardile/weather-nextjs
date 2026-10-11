import { z } from 'zod';
import type { AdvisorResult } from '@/types/ai';
import {
  ADVISOR_SCHEMA,
  CACHE_TTL,
  aiErrorResponse,
  advisorSystemPrompt,
  buildForecastContext,
  cacheGet,
  cacheSet,
  clientIp,
  completeText,
  extractJson,
  rateLimit,
  requestSignal,
} from '@/lib/ai';
import { fallbackActivities, fallbackOutfit } from '@/lib/ai-fallback';
import { fetchWeatherBundle } from '@/lib/openmeteo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const payloadSchema = z.object({
  city: z.object({
    name: z.string().min(1).max(100),
    country: z.string().max(100).optional().default(''),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
  units: z.enum(['metric', 'imperial']).default('metric'),
});

const advisorResponseSchema = z.object({
  outfit: z.object({
    summary: z.string().min(1).max(220),
    items: z.array(z.string().min(1).max(80)).min(1).max(6),
  }),
  activities: z
    .array(
      z.object({
        activity: z.enum(['running', 'cycling', 'photography', 'outdoor-dining', 'stargazing']),
        score: z.number().int().min(0).max(100),
        reason: z.string().min(1).max(220),
      }),
    )
    .length(5),
});

export async function POST(req: Request) {
  const limit = rateLimit(`advisor:${clientIp(req)}`, 12, 60_000);
  if (!limit.ok) {
    return aiErrorResponse(`Too many requests — retry in ${limit.retryAfterSeconds}s.`, 429);
  }

  let payload: z.infer<typeof payloadSchema>;
  try {
    payload = payloadSchema.parse(await req.json());
  } catch {
    return aiErrorResponse('Invalid request.', 400);
  }

  const { city, units } = payload;
  const cacheKey = `advisor:${city.latitude.toFixed(2)},${city.longitude.toFixed(2)}:${units}`;
  const cached = cacheGet(cacheKey, CACHE_TTL.advisor);
  if (cached) {
    return Response.json(JSON.parse(cached.payload), { headers: { 'cache-control': 'no-store' } });
  }

  let bundle;
  try {
    bundle = await fetchWeatherBundle(city.latitude, city.longitude);
  } catch {
    return aiErrorResponse('Weather data is unavailable right now.', 502);
  }

  const buildFallback = (): AdvisorResult => ({
    provider: 'fallback',
    outfit: fallbackOutfit(bundle),
    activities: fallbackActivities(bundle),
  });

  const signal = requestSignal(req);
  try {
    const { provider, text } = await completeText({
      system: advisorSystemPrompt(buildForecastContext(city, bundle, units)),
      user: `Recommend today's outfit and score the five activities for ${city.name}.`,
      maxOutputTokens: 800,
      temperature: 0.5,
      signal,
      jsonSchema: ADVISOR_SCHEMA,
    });
    const parsed = advisorResponseSchema.safeParse(extractJson(text));
    if (!parsed.success) throw new Error('invalid advisor payload');
    const result: AdvisorResult = { provider, ...parsed.data };
    cacheSet(cacheKey, provider, result);
    return Response.json(result, { headers: { 'cache-control': 'no-store' } });
  } catch {
    const result = buildFallback();
    cacheSet(cacheKey, 'fallback', result);
    return Response.json(result, { headers: { 'cache-control': 'no-store' } });
  }
}
