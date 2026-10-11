'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { JSX, KeyboardEvent } from 'react';
import { AiBadge, MarkdownLite, StreamingCursor } from '@/components/ai/ai-shared';
import { PlannerPanel } from '@/components/ai/PlannerPanel';
import { Icon } from '@/components/icons/Icon';
import { useAiChat } from '@/hooks/use-ai-chat';
import type { UiChatMessage } from '@/hooks/use-ai-chat';
import { usePreferences } from '@/hooks/use-preferences';
import { formatTemp } from '@/lib/units';
import { conditionLabel } from '@/lib/wmo';
import { cn } from '@/lib/utils';
import type { City, Units, WeatherBundle } from '@/types/weather';

/* ================================================================== */
/* AskAIPanel — chat with Aether (desktop inspector / mobile sheet).    */
/* Two modes: Chat (streaming Q&A) and Planner (day windows).           */
/* ================================================================== */

interface AskAIPanelProps {
  city: City | null;
  units: Units;
  bundle: WeatherBundle | null;
  className?: string;
  onClose?: () => void;
}

const INPUT_BUDGET = 600;
const COUNTER_FROM = 540;
const SCROLL_STICK_THRESHOLD = 40;

type PanelMode = 'chat' | 'planner';

const MODES: Array<{ id: PanelMode; label: string }> = [
  { id: 'chat', label: 'Chat' },
  { id: 'planner', label: 'Planner' },
];

/** Default pool + replacements for weather-aware suggestions. */
const DEFAULT_SUGGESTIONS = [
  'Best 2h window for a run?',
  'Will laundry dry today?',
  'Should I run tomorrow morning?',
  'Best 2-hour window for a walk?',
] as const;

export function AskAIPanel({ city, units, bundle, className, onClose }: AskAIPanelProps): JSX.Element {
  const aiVoice = usePreferences((s) => s.aiVoice);
  const [mode, setMode] = useState<PanelMode>('chat');
  const { messages, status, provider, lastError, send, stop, regenerate, reset } = useAiChat({
    city,
    units,
    voice: aiVoice,
  });

  const [value, setValue] = useState('');
  const [usedChips, setUsedChips] = useState<string[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const cityIdRef = useRef<number | null>(city?.id ?? null);
  const prevStatusRef = useRef(status);

  /* New city → new conversation. */
  useEffect(() => {
    const next = city?.id ?? null;
    if (cityIdRef.current === next) return;
    cityIdRef.current = next;
    reset();
  }, [city?.id, reset]);

  /* Stick-to-bottom: only follow the stream when the reader is already
   * at (or within 40px of) the bottom, so scrolling up is never yanked. */
  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight <= SCROLL_STICK_THRESHOLD;
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !atBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  /* Return focus to the composer once a reply finishes. */
  useEffect(() => {
    if (prevStatusRef.current === 'streaming' && status === 'idle') {
      taRef.current?.focus();
    }
    prevStatusRef.current = status;
  }, [status]);

  /* Textarea auto-grow: one line up to four. */
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 104)}px`;
  }, [value]);

  const suggestions = useMemo(() => {
    const derived: string[] = [];
    if (bundle) {
      const { current, hourly, daily } = bundle;
      const rainyNow =
        current.condition === 'rain' || current.condition === 'drizzle' || current.condition === 'thunder';
      const rainSoon = hourly.slice(0, 6).some((hour) => hour.precipitationProbability >= 50);
      if (rainyNow || rainSoon) derived.push('Do I need an umbrella tonight?');
      if ((daily[0]?.uvIndexMax ?? 0) >= 6) derived.push('When is the sun safest today?');
      if (current.condition === 'clear' && !current.isDay) derived.push('Is tonight good for stargazing?');
      if (current.windSpeed >= 30) derived.push('Is it too windy to cycle?');
    }
    return [...derived, ...DEFAULT_SUGGESTIONS]
      .filter((question) => !usedChips.includes(question))
      .slice(0, 3);
  }, [bundle, usedChips]);

  const contextLine = city
    ? bundle
      ? `${city.name} · ${formatTemp(bundle.current.temperature, units)} · ${conditionLabel(bundle.current.weatherCode)}`
      : city.name
    : 'Search for a city to ask about';

  const emptyLine = city
    ? `Ask anything about the next few days in ${city.name}.`
    : 'Search for a city to ask about the weather.';

  const isEmpty = messages.length === 0;
  const isStreaming = status === 'streaming';
  const canRegenerate = !isStreaming && messages.length > 0;
  const canSend = Boolean(city) && value.trim().length > 0;

  const submit = () => {
    const text = value.trim();
    if (!text || !city || isStreaming) return;
    send(text);
    setValue('');
  };

  const handleChip = (question: string) => {
    if (isStreaming) return;
    setUsedChips((prev) => (prev.includes(question) ? prev : [...prev, question]));
    send(question);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <div className={cn('flex h-full min-h-0 flex-col', className)}>
      {/* Header */}
      <header className="glass border-x-0 border-t-0 border-b border-surface px-4 pb-3 pt-4">
        <div className="flex items-center gap-2">
          <Icon name="sparkle" size={15} className="shrink-0 text-aurora-500" />
          <h2 className="font-display text-sm font-semibold text-surface">Ask Aether</h2>
          {mode === 'chat' ? <AiBadge provider={provider} /> : null}
          <div className="ml-auto flex items-center gap-1">
            {mode === 'chat' ? (
              <button
                type="button"
                onClick={regenerate}
                disabled={!canRegenerate}
                aria-label="Regenerate last reply"
                className={cn(
                  'focus-ring rounded-full p-1.5 text-surface-muted transition-colors hover:text-surface',
                  'disabled:pointer-events-none disabled:opacity-35',
                )}
              >
                <Icon name="refresh" size={15} />
              </button>
            ) : null}
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="focus-ring rounded-full p-1.5 text-surface-muted transition-colors hover:text-surface"
              >
                <Icon name="x" size={16} />
              </button>
            ) : null}
          </div>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-xs text-surface-muted">{contextLine}</p>
          <div
            role="group"
            aria-label="Ask AI mode"
            className="glass-subtle flex h-7 shrink-0 items-center rounded-full p-0.5"
          >
            {MODES.map((m) => {
              const active = mode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={active}
                  onClick={active ? undefined : () => setMode(m.id)}
                  className={cn(
                    'focus-ring h-6 rounded-full px-2.5 text-[11px] font-semibold transition-all duration-200',
                    active
                      ? 'bg-aurora-500 text-[#04211C] shadow-[0_0_14px_-4px_rgb(34_188_160/0.8)]'
                      : 'text-surface-muted hover:text-surface',
                  )}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Mode body — chat keeps its hook state while planner is open */}
      {mode === 'planner' ? (
        <PlannerPanel city={city} units={units} voice={aiVoice} className="min-h-0 flex-1" />
      ) : (
        <>
      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        aria-label="Conversation with Aether"
        className="scroll-slim min-h-0 flex-1 overflow-y-auto px-4 py-4"
      >
        {isEmpty ? (
          <div className="flex h-full flex-col items-center justify-center gap-1 px-2 text-center">
            <p className="text-sm text-surface-muted">{emptyLine}</p>
            {city && suggestions.length > 0 ? (
              <div className="mt-4 flex max-w-[300px] flex-wrap items-center justify-center gap-2">
                {suggestions.map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => handleChip(question)}
                    className="glass-subtle glass-hover focus-ring rounded-full px-3.5 py-1.5 text-xs text-surface-muted transition-transform hover:-translate-y-0.5 hover:text-surface"
                  >
                    {question}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col gap-3.5">
            {messages.map((message, index) => {
              if (message.role === 'user') {
                return (
                  <div key={message.id} className="flex animate-fade-in justify-end">
                    <div className="glass-subtle max-w-[85%] rounded-2xl bg-[rgb(var(--glass-tint)/0.1)] px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap text-surface">
                      {message.content}
                    </div>
                  </div>
                );
              }
              const streaming = isStreaming && index === messages.length - 1;
              return (
                <div
                  key={message.id}
                  aria-live={streaming ? 'polite' : undefined}
                  aria-busy={streaming || undefined}
                  className="max-w-[92%] animate-fade-in text-sm text-surface"
                >
                  {message.content ? (
                    <MarkdownLite text={message.content} />
                  ) : null}
                  {streaming ? <StreamingCursor /> : null}
                </div>
              );
            })}
            {status === 'error' ? (
              <div
                role="status"
                className="flex flex-wrap items-center gap-x-3 gap-y-2 pl-0.5 text-xs text-surface-muted"
              >
                <span>{lastError ?? "That reply didn't come through."}</span>
                <button
                  type="button"
                  onClick={regenerate}
                  className="focus-ring rounded-full text-xs font-medium text-aurora-500 underline underline-offset-2 transition-colors hover:text-aurora-400"
                >
                  Try again
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="glass border-x-0 border-b-0 border-t border-surface px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
          className="flex items-end gap-2"
        >
          <textarea
            ref={taRef}
            rows={1}
            value={value}
            maxLength={INPUT_BUDGET}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!city || isStreaming}
            placeholder={city ? 'Ask about the forecast…' : 'Pick a city to ask about the weather'}
            aria-label="Message Aether"
            className={cn(
              'scroll-slim focus-ring min-h-10 max-h-[104px] flex-1 resize-none',
              'rounded-2xl border border-surface bg-[var(--surface-subtle)] px-3.5 py-2.5',
              'text-sm leading-5 text-surface outline-none transition-colors',
              'placeholder:text-surface-faint focus:border-[var(--surface-ring)]',
              'disabled:opacity-60',
            )}
          />
          {isStreaming ? (
            <button
              type="button"
              onClick={stop}
              aria-label="Stop generating"
              className="glass-subtle glass-hover focus-ring flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-surface"
            >
              <Icon name="stop" size={16} />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!canSend}
              aria-label="Send message"
              className={cn(
                'focus-ring flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors',
                canSend
                  ? 'bg-aurora-500 text-ink hover:bg-aurora-400'
                  : 'cursor-not-allowed border border-surface bg-[var(--surface-subtle)] text-surface-faint',
              )}
            >
              <Icon name="send" size={16} />
            </button>
          )}
        </form>
        {value.length >= COUNTER_FROM ? (
          <p className="tnum mt-1.5 text-right text-[10px] text-surface-faint">
            {value.length} / {INPUT_BUDGET}
          </p>
        ) : null}
      </div>
        </>
      )}
    </div>
  );
}
