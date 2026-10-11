import { z } from 'zod';
import type { AiProvider, AiStreamEvent } from '@/types/ai';
import {
  CACHE_TTL,
  NoProviderError,
  aiErrorResponse,
  buildForecastContext,
  cacheGet,
  cacheSet,
  briefingSystemPrompt,
  clientIp,
  rateLimit,
  requestSignal,
  streamEventsResponse,
  streamText,
} from '@/lib/ai';
import { fallbackBriefing } from '@/lib/ai-fallback';
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

export async function POST(req: Request) {
  const limit = rateLimit(`brief:${clientIp(req)}`, 20, 60_000);
  if (!limit.ok) {
    return aiErrorResponse(`Too many briefing requests — retry in ${limit.retryAfterSeconds}s.`, 429);
  }

  let payload: z.infer<typeof payloadSchema>;
  try {
    payload = payloadSchema.parse(await req.json());
  } catch {
    return aiErrorResponse('Invalid request.', 400);
  }

  const { city, units } = payload;
  const cacheKey = `brief:${city.latitude.toFixed(2)},${city.longitude.toFixed(2)}:${units}`;
  const cached = cacheGet(cacheKey, CACHE_TTL.briefing);
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
        system: briefingSystemPrompt(context),
        user: `Write today's briefing for ${city.name}.`,
        maxOutputTokens: 220,
        temperature: 0.6,
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
      const fallback = fallbackBriefing(bundle, units);
      yield { type: 'meta', provider: 'fallback', cached: false };
      yield { type: 'chunk', text: fallback };
      cacheSet(cacheKey, 'fallback', { text: fallback });
    }
  })();

  return streamEventsResponse(events, signal);
}
