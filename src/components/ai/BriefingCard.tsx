'use client';

import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { Glass } from '@/components/glass/Glass';
import { Icon } from '@/components/icons/Icon';
import { MarkdownLite, StreamingCursor, readNdjsonStream } from '@/components/ai/ai-shared';
import { cn } from '@/lib/utils';
import type { AiProvider, AiStreamEvent } from '@/types/ai';
import type { City, Units } from '@/types/weather';

/* ================================================================== */
/* BriefingCard — flagship AI surface at the top of the content column */
/* ================================================================== */

interface BriefingCardProps {
  city: City;
  units: Units;
  className?: string;
}

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

export function BriefingCard({ city, units, className }: BriefingCardProps): JSX.Element {
  const [state, setState] = useState<BriefingState>(INITIAL_STATE);
  const [retryCount, setRetryCount] = useState(0);

  const { id: cityId, name, country, latitude, longitude } = city;
  const fetchKey = `${cityId}|${units}|${retryCount}`;

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

    void (async () => {
      try {
        const response = await fetch('/api/ai/briefing', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            city: { name, country, latitude, longitude },
            units,
          }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          let message = DEFAULT_ERROR;
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
              streamError = event.message || DEFAULT_ERROR;
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
            error: sawDone ? null : 'The briefing was interrupted — try again.',
          }));
        }
      } catch {
        if (active) setState((prev) => ({ ...prev, status: 'error', error: DEFAULT_ERROR }));
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [cityId, name, country, latitude, longitude, units, retryCount, fetchKey]);

  const isFallback = state.provider === 'fallback';
  const isBusy = state.status === 'loading' || state.status === 'streaming';
  const showSparkle = !isFallback; // optimistic until meta says fallback

  return (
    <Glass
      level="raised"
      refract
      as="section"
      aria-label={isFallback ? 'Weather summary' : 'AI briefing'}
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
        <p
          title={isFallback ? 'Rule-based summary (AI offline)' : undefined}
          className="text-[11px] font-semibold uppercase tracking-[0.14em] text-surface-muted"
        >
          {isFallback ? 'Summary' : 'AI briefing'}
        </p>
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
              <p className="text-sm text-surface-muted">{state.error ?? DEFAULT_ERROR}</p>
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
