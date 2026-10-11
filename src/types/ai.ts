import type { City } from '@/types/weather';

/** Which engine produced a response. 'fallback' = deterministic rule-based text. */
export type AiProvider = 'gemini' | 'zai' | 'fallback';

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
  activity: 'running' | 'cycling' | 'photography' | 'outdoor-dining' | 'stargazing';
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
};
