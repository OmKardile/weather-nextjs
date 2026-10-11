import { z } from 'zod';
import type { AlertDigestResult } from '@/types/ai';
import {
  CACHE_TTL,
  aiErrorResponse,
  alertsSystemPrompt,
  buildForecastContext,
  cacheGet,
  cacheSet,
  clientIp,
  completeText,
  extractJson,
  rateLimit,
  requestSignal,
} from '@/lib/ai';
import { detectAlertFacts, fallbackAlerts } from '@/lib/ai-fallback';
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

const alertsResponseSchema = z
  .array(
    z.object({
      severity: z.enum(['info', 'notice', 'warning']),
      title: z.string().min(1).max(60),
      detail: z.string().min(1).max(320),
    }),
  )
  .min(1)
  .max(4);

export async function POST(req: Request) {
  const limit = rateLimit(`alerts:${clientIp(req)}`, 20, 60_000);
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
  const cacheKey = `alerts:${city.latitude.toFixed(2)},${city.longitude.toFixed(2)}:${units}`;
  const cached = cacheGet(cacheKey, CACHE_TTL.alerts);
  if (cached) {
    return Response.json(JSON.parse(cached.payload), { headers: { 'cache-control': 'no-store' } });
  }

  let bundle;
  try {
    bundle = await fetchWeatherBundle(city.latitude, city.longitude);
  } catch {
    return aiErrorResponse('Weather data is unavailable right now.', 502);
  }

  // Facts are detected deterministically first — AI only phrases them, so the
  // digest is grounded by construction and always has a safe fallback.
  const facts = detectAlertFacts(bundle, units);
  const fallback = (): AlertDigestResult => ({ provider: 'fallback', alerts: fallbackAlerts(bundle, units) });

  if (!facts.length) {
    const result: AlertDigestResult = {
      provider: 'fallback',
      alerts: [
        {
          severity: 'info',
          title: 'Quiet day ahead',
          detail:
            'No notable swings in the next 24 hours — temperatures, precipitation and air quality all stay steady.',
        },
      ],
    };
    cacheSet(cacheKey, 'fallback', result);
    return Response.json(result, { headers: { 'cache-control': 'no-store' } });
  }

  const signal = requestSignal(req);
  try {
    const { provider, text } = await completeText({
      system: alertsSystemPrompt(
        buildForecastContext(city, bundle, units),
        facts.map((f) => `- [${f.severity}] ${f.fact}`).join('\n'),
      ),
      user: `Phrase the alerts for ${city.name}.`,
      maxOutputTokens: 450,
      temperature: 0.4,
      signal,
    });
    const parsed = alertsResponseSchema.safeParse(extractJson(text));
    if (!parsed.success) throw new Error('invalid alerts payload');
    const result: AlertDigestResult = { provider, alerts: parsed.data };
    cacheSet(cacheKey, provider, result);
    return Response.json(result, { headers: { 'cache-control': 'no-store' } });
  } catch {
    const result = fallback();
    cacheSet(cacheKey, 'fallback', result);
    return Response.json(result, { headers: { 'cache-control': 'no-store' } });
  }
}
