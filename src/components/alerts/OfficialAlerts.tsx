'use client';

import { useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/icons/Icon';
import { useMergedAlerts } from '@/hooks/use-merged-alerts';
import type { Alert, AlertSeverity, City, WeatherBundle } from '@/types/weather';
import './alerts.css';

/* ================================================================== */
/* OfficialAlerts — government feeds + Aether-computed alerts           */
/*                                                                     */
/* One stack of severity-tinted glass banners under the hero. Official  */
/* alerts come from /api/alerts (NWS · MeteoAlarm · NDMA SACHET, chosen */
/* by country) and merge with locally computed alerts (storm window,   */
/* heat/cold spike, UV, air quality, heavy rain, river flow, aurora).  */
/* Silence renders nothing — the AI AlertDigest already covers quiet   */
/* days.                                                               */
/* ================================================================== */

const SOURCE_LABELS: Record<Alert['source'], string> = {
  nws: 'NWS',
  meteoalarm: 'MeteoAlarm',
  sachet: 'SACHET',
  computed: 'Aether',
};

const SEVERITY_LABELS: Record<AlertSeverity, string> = {
  extreme: 'Extreme',
  severe: 'Severe',
  moderate: 'Moderate',
  minor: 'Minor',
  info: 'Info',
};

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

/** True for severities that warrant an assertive live region. */
function isUrgent(severity: AlertSeverity): boolean {
  return severity === 'extreme' || severity === 'severe';
}

function severityIcon(severity: AlertSeverity): 'alert' | 'info' | 'sparkle' {
  if (severity === 'info') return 'sparkle'; // aurora
  if (severity === 'minor') return 'info';
  return 'alert';
}

/** "2026-10-12T12:00:00-04:00" → "Oct 12, 12:00" (feed-local wall time). */
function formatAlertTime(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})/.exec(iso);
  if (!match) return iso;
  const [, , month, day, time] = match;
  const utc = /(?:Z|[+-]00:?00)$/.test(iso);
  return `${MONTHS_SHORT[Number(month) - 1]} ${Number(day)}, ${time}${utc ? ' UTC' : ''}`;
}

/* ------------------------------------------------------------------ */
/* Banner shell — glass + severity wash + left accent bar               */
/* ------------------------------------------------------------------ */

function AlertShell({
  severity,
  children,
}: {
  severity: AlertSeverity;
  children: ReactNode;
}): JSX.Element {
  const urgent = isUrgent(severity);
  return (
    <div
      role={urgent ? 'alert' : 'status'}
      className={cn('glass relative overflow-hidden rounded-2xl', `alert-tone-${severity}`)}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: 'var(--alert-wash)' }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 w-[3px]"
        style={{
          background: 'var(--alert-accent)',
          boxShadow: urgent ? 'var(--alert-glow)' : undefined,
        }}
      />
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Single alert banner — expand-on-click when the description is long   */
/* ------------------------------------------------------------------ */

function AlertBanner({ alert }: { alert: Alert }): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const isLong = alert.description.length > 150;

  const titleRow = (
    <span className="flex items-start gap-2.5">
      <span aria-hidden="true" className="mt-px shrink-0" style={{ color: 'var(--alert-ink)' }}>
        <Icon name={severityIcon(alert.severity)} size={17} strokeWidth={2.1} animated={false} />
      </span>
      <span className="min-w-0 flex-1 text-[13px] font-semibold leading-snug text-surface">
        {alert.title}
      </span>
      <span
        className="shrink-0 rounded-full px-2 py-[3px] text-[10px] font-semibold uppercase tracking-[0.08em]"
        style={{
          color: 'var(--alert-ink)',
          backgroundColor: 'color-mix(in srgb, var(--alert-accent) 15%, transparent)',
        }}
      >
        {SEVERITY_LABELS[alert.severity]}
      </span>
      {isLong && (
        <span
          aria-hidden="true"
          className={cn(
            'shrink-0 text-surface-faint transition-transform duration-200',
            expanded && 'rotate-180',
          )}
        >
          <Icon name="chevron-down" size={14} />
        </span>
      )}
    </span>
  );

  const body = (
    <p
      className={cn(
        'text-xs leading-relaxed text-surface-muted',
        !expanded && 'line-clamp-3',
        alert.source === 'nws' && 'whitespace-pre-line',
      )}
    >
      {alert.description}
    </p>
  );

  return (
    <AlertShell severity={alert.severity}>
      <div className="relative flex flex-col gap-2 p-3.5 pl-[18px]">
        {isLong ? (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            className="focus-ring -m-1 flex w-[calc(100%+0.5rem)] flex-col gap-1.5 rounded-xl p-1 text-left"
          >
            {titleRow}
            {body}
          </button>
        ) : (
          <div className="flex flex-col gap-1.5">
            {titleRow}
            {body}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] leading-snug text-surface-faint">
          <span>Source: {SOURCE_LABELS[alert.source]}</span>
          {alert.expires ? (
            <>
              <span aria-hidden="true">·</span>
              <span>until {formatAlertTime(alert.expires)}</span>
            </>
          ) : null}
          {alert.link ? (
            <>
              <span aria-hidden="true">·</span>
              <a
                href={alert.link}
                target="_blank"
                rel="noopener noreferrer"
                className="focus-ring rounded font-medium underline decoration-transparent underline-offset-2 transition-colors hover:decoration-current"
                style={{ color: 'var(--alert-ink)' }}
              >
                View alert
              </a>
            </>
          ) : null}
        </div>
      </div>
    </AlertShell>
  );
}

/* ------------------------------------------------------------------ */
/* Collapsed summary — shown while > 3 alerts are active                */
/* ------------------------------------------------------------------ */

function SummaryBanner({
  count,
  top,
  onExpand,
}: {
  count: number;
  top: Alert;
  onExpand: () => void;
}): JSX.Element {
  return (
    <AlertShell severity={top.severity}>
      <button
        type="button"
        onClick={onExpand}
        aria-expanded={false}
        className="focus-ring relative flex w-full items-center gap-2.5 rounded-2xl p-3.5 pl-[18px] text-left"
      >
        <span aria-hidden="true" className="shrink-0" style={{ color: 'var(--alert-ink)' }}>
          <Icon name="alert" size={17} strokeWidth={2.1} animated={false} />
        </span>
        <span className="min-w-0 flex-1 text-[13px] leading-snug text-surface-muted">
          <strong className="font-semibold text-surface">{count} active alerts</strong> — tap to view
        </span>
        <span aria-hidden="true" className="shrink-0 text-surface-faint">
          <Icon name="chevron-down" size={14} />
        </span>
      </button>
    </AlertShell>
  );
}

function SkeletonStack(): JSX.Element {
  return (
    <div className="flex flex-col gap-2.5" aria-hidden="true">
      <div className="skeleton h-[88px] rounded-2xl" />
      <div className="skeleton h-[88px] rounded-2xl" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* OfficialAlerts                                                      */
/* ------------------------------------------------------------------ */

export function OfficialAlerts({
  city,
  bundle,
}: {
  city: City | null;
  bundle: WeatherBundle | null;
}): JSX.Element | null {
  // Shared hook (also feeds the dock's Today badge) — TanStack dedupes
  // the underlying queries by key, so two consumers cost one fetch.
  const { alerts: merged, isLoading } = useMergedAlerts(city, bundle);

  // Collapsed-summary state, reset render-time when the city changes
  // (no set-state-in-effect).
  const cityKey = city?.id ?? 0;
  const [summaryState, setSummaryState] = useState<{ key: number; expanded: boolean }>({
    key: cityKey,
    expanded: false,
  });
  const summaryExpanded = summaryState.key === cityKey ? summaryState.expanded : false;

  if (!city || !bundle) return null;

  // First official fetch with nothing computed to show yet → shimmer.
  if (isLoading) return <SkeletonStack />;

  // Silence renders nothing — no "all clear" card.
  if (merged.length === 0) return null;

  if (merged.length > 3 && !summaryExpanded) {
    return (
      <SummaryBanner
        count={merged.length}
        top={merged[0]}
        onExpand={() => setSummaryState({ key: cityKey, expanded: true })}
      />
    );
  }

  return (
    <div role="list" aria-label="Active weather alerts" className="flex flex-col gap-2.5">
      {merged.map((alert) => (
        <div role="listitem" key={`${alert.source}-${alert.id}`}>
          <AlertBanner alert={alert} />
        </div>
      ))}
      {merged.length > 3 && (
        <button
          type="button"
          onClick={() => setSummaryState({ key: cityKey, expanded: false })}
          className="focus-ring self-start rounded-md px-1 text-[11px] font-medium text-surface-faint underline-offset-2 hover:text-surface-muted hover:underline"
        >
          Show fewer
        </button>
      )}
    </div>
  );
}
