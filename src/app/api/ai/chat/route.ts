import { z } from 'zod';
import type { AiStreamEvent } from '@/types/ai';
import { AI_VOICE_IDS } from '@/types/ai';
import {
  NoProviderError,
  aiErrorResponse,
  buildForecastContext,
  chatSystemPrompt,
  clientIp,
  rateLimit,
  requestSignal,
  sanitizeUserInput,
  streamEventsResponse,
  streamText,
} from '@/lib/ai';
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
  voice: z.enum(AI_VOICE_IDS).default('pro'),
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(1200),
      }),
    )
    .min(1)
    .max(12),
});

export async function POST(req: Request) {
  const limit = rateLimit(`chat:${clientIp(req)}`, 12, 60_000);
  if (!limit.ok) {
    return aiErrorResponse(`You're sending messages quickly — retry in ${limit.retryAfterSeconds}s.`, 429);
  }

  let payload: z.infer<typeof payloadSchema>;
  try {
    payload = payloadSchema.parse(await req.json());
  } catch {
    return aiErrorResponse('Invalid request.', 400);
  }

  const { city, units, voice } = payload;
  const signal = requestSignal(req);

  // Sanitize + cap every turn; keep the last 8 for context.
  const turns = payload.messages
    .slice(-8)
    .map((m) => ({ role: m.role, content: sanitizeUserInput(m.content) }))
    .filter((m) => m.content.length > 0);
  if (!turns.length || turns[turns.length - 1].role !== 'user') {
    return aiErrorResponse('Invalid request.', 400);
  }

  let bundle;
  try {
    bundle = await fetchWeatherBundle(city.latitude, city.longitude);
  } catch {
    return aiErrorResponse('Weather data is unavailable right now.', 502);
  }

  const context = buildForecastContext(city, bundle, units);

  // Flatten history into one user block — keeps a hard line between trusted
  // system instructions and everything the user typed (injection safety).
  const conversation = turns
    .map((m) => `${m.role === 'user' ? 'User' : 'Aether'}: ${m.content}`)
    .join('\n');
  const user = `Conversation so far (the final User line is the question to answer):\n${conversation}`;

  const events = (async function* (): AsyncGenerator<AiStreamEvent> {
    let provider: string | null = null;
    try {
      for await (const part of streamText({
        system: chatSystemPrompt(context, city.name, voice),
        user,
        maxOutputTokens: 700,
        temperature: 0.6,
        signal,
      })) {
        if (!provider) {
          provider = part.provider;
          yield { type: 'meta', provider: part.provider, cached: false };
        }
        yield { type: 'chunk', text: part.text };
      }
      if (provider) return;
      throw new NoProviderError();
    } catch {
      if (provider) {
        yield { type: 'error', message: 'Generation interrupted' };
        return;
      }
      yield {
        type: 'error',
        message:
          'Ask AI is unavailable right now. Everything else keeps working — try again in a minute.',
      };
    }
  })();

  return streamEventsResponse(events, signal);
}
