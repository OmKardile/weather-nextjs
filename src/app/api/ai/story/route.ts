import { z } from 'zod';
import type { AiProvider, AiStreamEvent } from '@/types/ai';
import { AI_VOICE_IDS } from '@/types/ai';
import {
  CACHE_TTL,
  NoProviderError,
  aiErrorResponse,
  buildForecastContext,
  cacheGet,
  cacheSet,
  storySystemPrompt,
  clientIp,
  rateLimit,
  requestSignal,
  streamEventsResponse,
  streamText,
} from '@/lib/ai';
import { fallbackStory } from '@/lib/ai-fallback';
import { fetchWeatherBundle } from '@/lib/openmeteo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Weather story — a 4–6 sentence narrative of how the next 24 hours feel
 * (atmosphere and rhythm, not stats), grounded in the same forecast bundle
 * as the briefing. Accepts the briefing-style { city, units, voice } payload
 * or a flat { city: "Name", lat, lon, units, voice } form. Streamed NDJSON,
 * cached ~30 min per city+voice, rate-limited like the briefing route.
 */
const cityObjectSchema = z.object({
  name: z.string().min(1).max(100),
  country: z.string().max(100).optional().default(''),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

const payloadSchema = z
  .object({
    city: z.union([cityObjectSchema, z.string().min(1).max(100)]),
    lat: z.number().min(-90).max(90).optional(),
    lon: z.number().min(-180).max(180).optional(),
    units: z.enum(['metric', 'imperial']).default('metric'),
    voice: z.enum(AI_VOICE_IDS).default('pro'),
  })
  .superRefine((data, ctx) => {
    if (typeof data.city === 'string' && (data.lat == null || data.lon == null)) {
      ctx.addIssue({ code: 'custom', message: 'lat and lon are required with a city name' });
    }
  });

export async function POST(req: Request) {
  const limit = rateLimit(`story:${clientIp(req)}`, 20, 60_000);
  if (!limit.ok) {
    return aiErrorResponse(`Too many story requests — retry in ${limit.retryAfterSeconds}s.`, 429);
  }

  let payload: z.infer<typeof payloadSchema>;
  try {
    payload = payloadSchema.parse(await req.json());
  } catch {
    return aiErrorResponse('Invalid request.', 400);
  }

  const units = payload.units;
  const voice = payload.voice;
  const city =
    typeof payload.city === 'string'
      ? { name: payload.city, country: '', latitude: payload.lat as number, longitude: payload.lon as number }
      : payload.city;

  const cacheKey = `story:${city.latitude.toFixed(2)},${city.longitude.toFixed(2)}:${units}:${voice}`;
  const cached = cacheGet(cacheKey, CACHE_TTL.story);
  const signal = requestSignal(req);

  if (cached) {
    const text = (JSON.parse(cached.payload) as { text: string }).text;
    const events = (async function* (): AsyncGenerator<AiStreamEvent> {
      yield { type: 'meta', provider: cached.provider, cached: true };
      yield { type: 'chunk', text };
    })();
    return streamEventsResponse(events, signal);
  }

  let bundle;
  try {
    bundle = await fetchWeatherBundle(city.latitude, city.longitude);
  } catch {
    return aiErrorResponse('Weather data is unavailable right now.', 502);
  }

  const context = buildForecastContext(city, bundle, units);
  const events = (async function* (): AsyncGenerator<AiStreamEvent> {
    let provider: AiProvider | null = null;
    let text = '';
    try {
      for await (const part of streamText({
        system: storySystemPrompt(context, voice),
        user: `Write the story of the next 24 hours in ${city.name}.`,
        maxOutputTokens: 320,
        temperature: 0.8,
        signal,
      })) {
        if (!provider) {
          provider = part.provider;
          yield { type: 'meta', provider: part.provider, cached: false };
        }
        text += part.text;
        yield { type: 'chunk', text: part.text };
      }
      if (provider) {
        cacheSet(cacheKey, provider, { text: text.trim() });
        return;
      }
      throw new NoProviderError();
    } catch {
      if (provider) {
        yield { type: 'error', message: 'Generation interrupted' };
        return;
      }
      const fallback = fallbackStory(bundle, units);
      yield { type: 'meta', provider: 'fallback', cached: false };
      yield { type: 'chunk', text: fallback };
      cacheSet(cacheKey, 'fallback', { text: fallback });
    }
  })();

  return streamEventsResponse(events, signal);
}
