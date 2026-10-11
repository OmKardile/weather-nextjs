'use client';

import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { Glass } from '@/components/glass/Glass';
import { Icon } from '@/components/icons/Icon';
import { cn } from '@/lib/utils';
import { ACTIVITY_LABELS } from '@/types/ai';
import type { ActivityScore, AdvisorResult } from '@/types/ai';
import type { City, Units } from '@/types/weather';

/* ================================================================== */
/* AdvisorCards — outfit suggestion + 0-100 activity scores             */
/* Fetches POST /api/ai/advisor (cached server-side, 30 min).          */
/* Section header is provided by the parent — this is content only.    */
/* ================================================================== */

interface AdvisorCardsProps {
  city: City;
  units: Units;
  className?: string;
}

type AdvisorState =
  | { status: 'loading' }
  | { status: 'done'; data: AdvisorResult }
  | { status: 'error' };

const ACTIVITY_ICONS: Record<
  ActivityScore['activity'],
  'droplet' | 'gauge' | 'eye' | 'sunrise' | 'moon-phase'
> = {
  running: 'droplet',
  cycling: 'gauge',
  photography: 'eye',
  'outdoor-dining': 'sunrise',
  stargazing: 'moon-phase',
  laundry: 'sunrise',
};

function scoreTone(score: number): { text: string; bar: string } {
  if (score >= 70) return { text: 'text-aurora-400', bar: 'from-aurora-500 to-aurora-300' };
  if (score >= 40) return { text: 'text-[#E8C54D]', bar: 'from-[#E8C54D] to-[#F0954A]' };
  return { text: 'text-[#E1552F]', bar: 'from-[#E1552F] to-[#F0954A]' };
}

function ActivityCard({ activity }: { activity: ActivityScore }): JSX.Element {
  const tone = scoreTone(activity.score);
  return (
    <Glass level="base" className="rounded-2xl p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Icon name={ACTIVITY_ICONS[activity.activity]} size={16} className="shrink-0 text-surface-muted" />
          <p className="truncate text-[13px] font-medium text-surface">
            {ACTIVITY_LABELS[activity.activity]}
          </p>
        </div>
        <p className={cn('tnum text-xl font-light leading-none', tone.text)}>{activity.score}</p>
      </div>
      <div
        role="img"
        aria-label={`${ACTIVITY_LABELS[activity.activity]}: ${activity.score} out of 100`}
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--surface-subtle)]"
      >
        <div
          className={cn('h-full rounded-full bg-gradient-to-r transition-[width] duration-700', tone.bar)}
          style={{ width: `${Math.max(activity.score, 3)}%` }}
        />
      </div>
      <p className="mt-2.5 line-clamp-2 text-xs leading-relaxed text-surface-muted">{activity.reason}</p>
    </Glass>
  );
}

function AdvisorSkeleton(): JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      <div className="skeleton h-20 rounded-2xl" aria-hidden="true" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="skeleton h-32 rounded-2xl" aria-hidden="true" />
        ))}
      </div>
    </div>
  );
}

export function AdvisorCards({ city, units, className }: AdvisorCardsProps): JSX.Element | null {
  const [state, setState] = useState<AdvisorState>({ status: 'loading' });
  const [retryCount, setRetryCount] = useState(0);

  const { id: cityId, name, country, latitude, longitude } = city;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setState({ status: 'loading' });

    void (async () => {
      try {
        const response = await fetch('/api/ai/advisor', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ city: { name, country, latitude, longitude }, units }),
          signal: controller.signal,
        });
        if (!response.ok || !active) throw new Error('advisor unavailable');
        const data = (await response.json()) as AdvisorResult;
        if (!active) return;
        if (
          !data ||
          !data.outfit ||
          !Array.isArray(data.activities) ||
          data.activities.length !== 6
        ) {
          throw new Error('invalid advisor payload');
        }
        setState({ status: 'done', data });
      } catch {
        if (active) setState({ status: 'error' });
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [cityId, name, country, latitude, longitude, units, retryCount]);

  if (state.status === 'error') return null;

  return (
    <div className={cn('flex flex-col gap-3', className)} aria-busy={state.status === 'loading' || undefined}>
      {state.status === 'loading' ? (
        <AdvisorSkeleton />
      ) : (
        <>
          <Glass level="base" className="rounded-2xl p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <Icon name="thermometer" size={16} className="text-surface-muted" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-surface-muted">
                What to wear
              </p>
            </div>
            <p className="mt-2.5 text-[15px] leading-relaxed text-surface">{state.data.outfit.summary}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {state.data.outfit.items.map((item) => (
                <span
                  key={item}
                  className="glass-subtle rounded-full px-3 py-1 text-xs font-medium text-surface-muted"
                >
                  {item}
                </span>
              ))}
            </div>
          </Glass>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {state.data.activities.map((activity) => (
              <ActivityCard key={activity.activity} activity={activity} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
