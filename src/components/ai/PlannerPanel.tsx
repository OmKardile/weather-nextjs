'use client';

import { useEffect, useRef, useState } from 'react';
import type { JSX, KeyboardEvent } from 'react';
import { Glass } from '@/components/glass/Glass';
import { Icon } from '@/components/icons/Icon';
import { AiBadge } from '@/components/ai/ai-shared';
import { formatHour } from '@/lib/units';
import { cn } from '@/lib/utils';
import type { AiVoiceId, PlannerResult, PlannerWindow } from '@/types/ai';
import type { City, Units } from '@/types/weather';

/* ================================================================== */
/* PlannerPanel — free-text day planner (body of the Ask AI panel's    */
/* "Planner" mode). POST /api/ai/planner → up to 4 scored windows.     */
/* ================================================================== */

interface PlannerPanelProps {
  city: City | null;
  units: Units;
  /** Tone persona for the reason text (numbers never change). */
  voice: AiVoiceId;
  className?: string;
}

const INPUT_BUDGET = 400;
const GENERIC_ERROR = "Couldn't plan the day — try again in a moment.";

const EXAMPLE_CHIPS = [
  'Walk + coffee outside',
  'Drive to the hills at 4',
  'Laundry and a run',
] as const;

type PlannerStatus = 'idle' | 'loading' | 'done' | 'error';

/** Map a free-form activity label onto an existing UI glyph. */
function activityIcon(activity: string): 'locate' | 'gauge' | 'pin' | 'droplet' | 'eye' | 'sunrise' {
  const a = activity.toLowerCase();
  if (/\b(walk|stroll|hike)/.test(a)) return 'locate';
  if (/\b(run|jog)/.test(a)) return 'gauge';
  if (/\b(drive|trip|commute|travel|road)/.test(a)) return 'pin';
  if (/\b(laundry|wash|dry|clothes)/.test(a)) return 'droplet';
  if (/\b(photo|picture|golden|sunset|sunrise)/.test(a)) return 'eye';
  return 'sunrise';
}

/** "14:00" → "14:00" (metric) or "2 PM" (imperial), matching the app clock. */
function formatWindowTime(hhmm: string, units: Units): string {
  return formatHour(`2000-01-01T${hhmm}`, units);
}

function scoreTone(score: number): { text: string; bar: string } {
  if (score >= 70) return { text: 'text-aurora-400', bar: 'from-aurora-500 to-aurora-300' };
  if (score >= 40) return { text: 'text-[#E8C54D]', bar: 'from-[#E8C54D] to-[#F0954A]' };
  return { text: 'text-[#E1552F]', bar: 'from-[#E1552F] to-[#F0954A]' };
}

function WindowCard({ window, units }: { window: PlannerWindow; units: Units }): JSX.Element {
  const tone = scoreTone(window.score);
  const timeRange = `${formatWindowTime(window.from, units)} – ${formatWindowTime(window.to, units)}`;
  return (
    <Glass level="base" className="animate-fade-in rounded-2xl p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-subtle)] text-surface-muted"
          >
            <Icon name={activityIcon(window.activity)} size={15} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-surface">{window.activity}</p>
            <p className="tnum text-xs text-surface-muted">{timeRange}</p>
          </div>
        </div>
        <p className={cn('tnum shrink-0 text-xl font-light leading-none', tone.text)}>{window.score}</p>
      </div>
      <div
        role="img"
        aria-label={`${window.activity} ${timeRange}: ${window.score} out of 100`}
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--surface-subtle)]"
      >
        <div
          className={cn('h-full rounded-full bg-gradient-to-r transition-[width] duration-700', tone.bar)}
          style={{ width: `${Math.max(window.score, 3)}%` }}
        />
      </div>
      <p className="mt-2.5 text-xs leading-relaxed text-surface-muted">{window.reason}</p>
    </Glass>
  );
}

function PlannerSkeleton(): JSX.Element {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="skeleton h-28 rounded-2xl" />
      ))}
    </div>
  );
}

export function PlannerPanel({ city, units, voice, className }: PlannerPanelProps): JSX.Element {
  const [value, setValue] = useState('');
  const [status, setStatus] = useState<PlannerStatus>('idle');
  const [result, setResult] = useState<PlannerResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastText, setLastText] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const run = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !city || status === 'loading') return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus('loading');
    setError(null);
    setLastText(trimmed);

    void (async () => {
      try {
        const response = await fetch('/api/ai/planner', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            text: trimmed,
            lat: city.latitude,
            lon: city.longitude,
            city: city.name,
            units,
            voice,
          }),
          signal: controller.signal,
        });
        if (!response.ok) {
          let message = GENERIC_ERROR;
          try {
            const data = (await response.json()) as { error?: unknown };
            if (typeof data?.error === 'string' && data.error) message = data.error;
          } catch {
            // Non-JSON error body — keep the calm default.
          }
          throw new Error(message);
        }
        const data = (await response.json()) as PlannerResult;
        if (
          !data ||
          !data.meta ||
          !Array.isArray(data.windows) ||
          data.windows.length === 0 ||
          data.windows.length > 4 ||
          !data.windows.every(
            (w) =>
              typeof w?.activity === 'string' &&
              typeof w?.from === 'string' &&
              typeof w?.to === 'string' &&
              typeof w?.score === 'number' &&
              typeof w?.reason === 'string',
          )
        ) {
          throw new Error(GENERIC_ERROR);
        }
        setResult(data);
        setStatus('done');
      } catch (caught) {
        if (controller.signal.aborted) return;
        setStatus('error');
        setError(caught instanceof Error && caught.message ? caught.message : GENERIC_ERROR);
      }
    })();
  };

  // Abort the in-flight plan request on unmount / city change.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  const submit = () => {
    run(value);
  };

  const handleChip = (text: string) => {
    setValue(text);
    run(text);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  const canSubmit = Boolean(city) && value.trim().length > 0 && status !== 'loading';
  const provider = status === 'done' && result ? result.meta.provider : null;

  return (
    <div className={cn('flex h-full min-h-0 flex-col', className)}>
      {/* Plan composer */}
      <div className="glass border-x-0 border-b border-t-0 border-surface px-4 pb-3 pt-4">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
          className="flex items-end gap-2"
        >
          <textarea
            rows={1}
            value={value}
            maxLength={INPUT_BUDGET}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!city || status === 'loading'}
            placeholder={city ? "What's your day look like?" : 'Pick a city to plan your day'}
            aria-label="Describe your day"
            className={cn(
              'scroll-slim focus-ring min-h-10 max-h-[104px] flex-1 resize-none',
              'rounded-2xl border border-surface bg-[var(--surface-subtle)] px-3.5 py-2.5',
              'text-sm leading-5 text-surface outline-none transition-colors',
              'placeholder:text-surface-faint focus:border-[var(--surface-ring)]',
              'disabled:opacity-60',
            )}
          />
          <button
            type="submit"
            disabled={!canSubmit}
            aria-label="Plan my day"
            className={cn(
              'focus-ring flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors',
              canSubmit
                ? 'bg-aurora-500 text-ink hover:bg-aurora-400'
                : 'cursor-not-allowed border border-surface bg-[var(--surface-subtle)] text-surface-faint',
            )}
          >
            <Icon name="send" size={16} />
          </button>
        </form>
        {city && status !== 'loading' && !result ? (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {EXAMPLE_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => handleChip(chip)}
                className="glass-subtle glass-hover focus-ring rounded-full px-3 py-1 text-xs text-surface-muted transition-transform hover:-translate-y-0.5 hover:text-surface"
              >
                {chip}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* Windows */}
      <div
        aria-live="polite"
        aria-busy={status === 'loading' || undefined}
        aria-label="Suggested time windows"
        className="scroll-slim min-h-0 flex-1 overflow-y-auto px-4 py-4"
      >
        {status === 'loading' ? (
          <PlannerSkeleton />
        ) : status === 'error' ? (
          <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-surface-muted">
            <span>{error ?? GENERIC_ERROR}</span>
            <button
              type="button"
              onClick={() => run(lastText || value)}
              className="focus-ring rounded-full text-xs font-medium text-aurora-500 underline underline-offset-2 transition-colors hover:text-aurora-400"
            >
              Try again
            </button>
          </div>
        ) : status === 'done' && result ? (
          <div className="flex flex-col gap-3">
            {result.windows.map((window, index) => (
              <WindowCard key={`${window.activity}-${window.from}-${index}`} window={window} units={units} />
            ))}
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1 px-2 text-center">
            <p className="text-sm text-surface-muted">
              {city
                ? 'Tell Aether your plan — it finds the best weather windows for each part of your day.'
                : 'Search for a city to plan around its forecast.'}
            </p>
          </div>
        )}
      </div>

      {/* Footer — provider badge + disclaimer */}
      <div className="glass flex items-center justify-between gap-2 border-x-0 border-b-0 border-t border-surface px-4 py-2.5">
        <p className="text-[10px] leading-relaxed text-surface-faint">
          Windows are AI suggestions — double-check before you commit.
        </p>
        <AiBadge provider={provider} />
      </div>
    </div>
  );
}
