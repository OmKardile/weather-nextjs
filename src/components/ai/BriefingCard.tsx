'use client';

import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { Glass } from '@/components/glass/Glass';
import { SegmentedControl } from '@/components/glass/SegmentedControl';
import { Icon } from '@/components/icons/Icon';
import { AiBadge, MarkdownLite, StreamingCursor, readNdjsonStream } from '@/components/ai/ai-shared';
import { usePreferences } from '@/hooks/use-preferences';
import { cn } from '@/lib/utils';
import { AI_VOICE_OPTIONS } from '@/types/ai';
import type { AiProvider, AiStreamEvent } from '@/types/ai';
import type { City, Units } from '@/types/weather';

/* ================================================================== */
/* BriefingCard — flagship AI surface at the top of the content column */
/* Two streamed tabs: the factual briefing and the 24-hour story.      */
/* ================================================================== */

interface BriefingCardProps {
  city: City;
  units: Units;
  className?: string;
}

type CardView = 'briefing' | 'story';

interface BriefingState {
  status: 'loading' | 'streaming' | 'done' | 'error';
  text: string;
  provider: AiProvider | null;
  cached: boolean;
  error: string | null;
}

const INITIAL_STATE: BriefingState = {
  status: 'loading',
  text: '',
  provider: null,
  cached: false,
  error: null,
};

const DEFAULT_ERROR = "Couldn't load the briefing.";
const STORY_ERROR = "Couldn't load the story.";

const VIEW_META: Record<CardView, { label: string; fallbackLabel: string; error: string }> = {
  briefing: { label: 'Briefing', fallbackLabel: 'Weather summary', error: DEFAULT_ERROR },
  story: { label: 'Story', fallbackLabel: 'Weather story', error: STORY_ERROR },
};

export function BriefingCard({ city, units, className }: BriefingCardProps): JSX.Element {
  const [state, setState] = useState<BriefingState>(INITIAL_STATE);
  const [retryCount, setRetryCount] = useState(0);
  /** Last tab is remembered in state across city/voice changes. */
  const [view, setView] = useState<CardView>('briefing');
  const aiVoice = usePreferences((s) => s.aiVoice);

  const { id: cityId, name, country, latitude, longitude } = city;
  const fetchKey = `${cityId}|${units}|${retryCount}|${view}|${aiVoice}`;

  // Reset when the fetch key changes — render-time adjustment (React-endorsed
  // pattern) instead of a synchronous setState inside the effect.
  const [lastKey, setLastKey] = useState(fetchKey);
  if (lastKey !== fetchKey) {
    setLastKey(fetchKey);
    setState(INITIAL_STATE);
  }

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let sawDone = false;
    let streamError: string | null = null;
    const meta = VIEW_META[view];

    void (async () => {
      try {
        const response = await fetch(view === 'briefing' ? '/api/ai/briefing' : '/api/ai/story', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            city: { name, country, latitude, longitude },
            units,
            voice: aiVoice,
          }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          let message = meta.error;
          try {
            const data = (await response.json()) as { error?: unknown };
            if (typeof data?.error === 'string' && data.error) message = data.error;
          } catch {
            // Non-JSON error body — keep the calm default.
          }
          if (active) setState((prev) => ({ ...prev, status: 'error', error: message }));
          return;
        }

        await readNdjsonStream(response, (event: AiStreamEvent) => {
          if (!active) return;
          switch (event.type) {
            case 'meta':
              setState((prev) => ({ ...prev, provider: event.provider, cached: event.cached }));
              return;
            case 'chunk':
              setState((prev) => ({
                ...prev,
                status: prev.status === 'loading' ? 'streaming' : prev.status,
                text: prev.text + event.text,
              }));
              return;
            case 'done':
              sawDone = true;
              return;
            case 'error':
              sawDone = true;
              streamError = event.message || meta.error;
              return;
            default:
              return;
          }
        });

        if (!active) return;
        if (streamError) {
          setState((prev) => ({ ...prev, status: 'error', error: streamError }));
        } else {
          setState((prev) => ({
            ...prev,
            status: sawDone ? 'done' : 'error',
            error: sawDone ? null : `${meta.error} Try again in a moment.`,
          }));
        }
      } catch {
        if (active) setState((prev) => ({ ...prev, status: 'error', error: meta.error }));
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [cityId, name, country, latitude, longitude, units, retryCount, view, aiVoice]);

  const isFallback = state.provider === 'fallback';
  const isBusy = state.status === 'loading' || state.status === 'streaming';
  const showSparkle = !isFallback; // optimistic until meta says fallback
  const voiceLabel = AI_VOICE_OPTIONS.find((option) => option.id === aiVoice)?.label ?? 'Pro';

  const sectionLabel =
    view === 'briefing'
      ? isFallback
        ? VIEW_META.briefing.fallbackLabel
        : 'AI briefing'
      : VIEW_META.story.fallbackLabel;

  return (
    <Glass
      level="raised"
      as="section"
      aria-label={sectionLabel}
      className={cn('rounded-[var(--radius-card)] p-5', className)}
    >
      <div className="flex items-center gap-3">
        {showSparkle ? (
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-aurora-500/15 text-aurora-500"
          >
            <Icon name="sparkle" size={18} animated />
          </span>
        ) : (
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-subtle)] text-surface-faint"
          >
            <Icon name="info" size={16} />
          </span>
        )}
        <SegmentedControl
          aria-label="AI card view"
          options={(Object.keys(VIEW_META) as CardView[]).map((key) => ({
            id: key,
            label: VIEW_META[key].label,
          }))}
          value={view}
          onChange={setView}
        />
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <span
            title={`AI voice: ${voiceLabel} — tone only, numbers never change`}
            className="rounded-full border border-surface bg-[var(--surface-subtle)] px-1.5 py-[3px] text-[9px] font-semibold uppercase leading-none tracking-[0.08em] text-surface-muted"
          >
            {voiceLabel}
          </span>
          <AiBadge provider={state.provider} />
        </div>
      </div>

      <div className="mt-3 min-h-[72px]" aria-live="polite" aria-busy={isBusy || undefined}>
        {state.status === 'error' ? (
          <div>
            {state.text ? (
              <div className="text-[15px] leading-relaxed text-surface-muted">
                <MarkdownLite text={state.text} />
              </div>
            ) : null}
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2">
              <p className="text-sm text-surface-muted">{state.error ?? VIEW_META[view].error}</p>
              <button
                type="button"
                onClick={() => setRetryCount((count) => count + 1)}
                className="glass-subtle glass-hover focus-ring rounded-full px-3.5 py-1.5 text-xs font-medium text-surface transition-transform"
              >
                Try again
              </button>
            </div>
          </div>
        ) : state.text ? (
          state.status === 'streaming' ? (
            <p className="animate-fade-in whitespace-pre-wrap text-[15px] leading-relaxed text-surface">
              {state.text}
              <StreamingCursor />
            </p>
          ) : (
            <div className="animate-fade-in text-[15px] leading-relaxed text-surface">
              <MarkdownLite text={state.text} />
            </div>
          )
        ) : (
          <div className="flex flex-col gap-2.5" aria-hidden="true">
            <div className="skeleton h-3.5 w-full" />
            <div className="skeleton h-3.5 w-[92%]" />
            <div className="skeleton h-3.5 w-[61%]" />
          </div>
        )}
      </div>

      {state.status === 'done' ? (
        <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-surface-faint">
          {state.cached ? (
            <>
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-aurora-400" />
              cached
            </>
          ) : (
            'just now'
          )}
        </div>
      ) : null}
    </Glass>
  );
}
