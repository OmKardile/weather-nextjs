import type { City } from '@/types/weather';

/** Which engine produced a response. 'fallback' = deterministic rule-based text. */
export type AiProvider = 'gemini' | 'zai' | 'fallback';

/* ------------------------------------------------------------------ */
/* AI voices — persona ids shared by client UI and server prompts      */
/* ------------------------------------------------------------------ */

/** Persona applied to AI text (tone only — numbers never change). */
export type AiVoiceId = 'pro' | 'chill' | 'sarcastic' | 'poet' | 'coach';

/** All valid voice ids, in picker order. Shared with the zod route schemas. */
export const AI_VOICE_IDS = ['pro', 'chill', 'sarcastic', 'poet', 'coach'] as const satisfies readonly AiVoiceId[];

/**
 * Voice picker metadata for client UI (labels + one-line descriptions).
 * The server-side persona prompts live in src/lib/ai.ts (VOICES map).
 */
export const AI_VOICE_OPTIONS: ReadonlyArray<{ id: AiVoiceId; label: string; description: string }> = [
  { id: 'pro', label: 'Pro', description: 'Crisp and factual — zero fluff.' },
  { id: 'chill', label: 'Chill', description: 'Laid-back and warm, keeps it brief.' },
  { id: 'sarcastic', label: 'Sarcastic', description: 'Playful eye-rolls at the sky — never at people.' },
  { id: 'poet', label: 'Poet', description: 'A little lyrical — the numbers stay exact.' },
  { id: 'coach', label: 'Coach', description: 'Energetic nudges to get out there.' },
];

/** NDJSON streaming protocol used by /api/ai/briefing and /api/ai/chat. */
export type AiStreamEvent =
  | { type: 'meta'; provider: AiProvider; cached: boolean }
  | { type: 'chunk'; text: string }
  | { type: 'done' }
  | { type: 'error'; message: string };

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

/** Client → server payloads. The server re-fetches weather itself (never trusts client JSON). */
export interface AiCityPayload {
  city: Pick<City, 'name' | 'country' | 'latitude' | 'longitude'>;
}

export interface AiChatPayload extends AiCityPayload {
  /** Last N turns, oldest first. Server caps length/count again. */
  messages: ChatTurn[];
}

export interface OutfitSuggestion {
  /** One line, e.g. "Light jacket weather — dry until evening." */
  summary: string;
  /** 2–4 short items, e.g. "Light jacket", "Sunglasses". */
  items: string[];
}

export interface ActivityScore {
  activity: 'running' | 'cycling' | 'photography' | 'outdoor-dining' | 'stargazing' | 'laundry';
  score: number;
  reason: string;
}

export interface AdvisorResult {
  provider: AiProvider;
  outfit: OutfitSuggestion;
  activities: ActivityScore[];
}

export type AlertSeverity = 'info' | 'notice' | 'warning';

export interface AlertItem {
  severity: AlertSeverity;
  title: string;
  detail: string;
}

export interface AlertDigestResult {
  provider: AiProvider;
  alerts: AlertItem[];
}

export const ACTIVITY_LABELS: Record<ActivityScore['activity'], string> = {
  running: 'Running',
  cycling: 'Cycling',
  photography: 'Photography',
  'outdoor-dining': 'Outdoor dining',
  stargazing: 'Stargazing',
  laundry: 'Laundry',
};

/* ------------------------------------------------------------------ */
/* Day planner (/api/ai/planner)                                       */
/* ------------------------------------------------------------------ */

/** One suggested time window for an activity from the user's plan. */
export interface PlannerWindow {
  /** Short activity name, e.g. "Walk", "Drive to the hills". */
  activity: string;
  /** Local start time at the location, "HH:mm". */
  from: string;
  /** Local end time at the location, "HH:mm". */
  to: string;
  /** 0–100 — how good conditions are in this window. */
  score: number;
  /** One line citing the forecast data. */
  reason: string;
}

export interface PlannerResult {
  meta: { provider: AiProvider };
  windows: PlannerWindow[];
}
