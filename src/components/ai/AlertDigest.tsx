'use client';

import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { cn } from '@/lib/utils';
import type { AlertDigestResult, AlertItem, AlertSeverity } from '@/types/ai';
import type { City, Units } from '@/types/weather';

/* ================================================================== */
/* AlertDigest — notable changes in the next 24h, plain language.       */
/* Fetches POST /api/ai/alerts (cached server-side, 15 min).            */
/* Severity: info (aurora) · notice (amber) · warning (coral).          */
/* Section header is provided by the parent — this is content only.     */
/* ================================================================== */

interface AlertDigestProps {
  city: City;
  units: Units;
  className?: string;
}

const SEVERITY_STYLES: Record<AlertSeverity, { dot: string; border: string; label: string }> = {
  info: { dot: 'bg-aurora-400', border: 'border-aurora-500/35', label: 'Info' },
  notice: { dot: 'bg-[#E8C54D]', border: 'border-[#E8C54D]/45', label: 'Notice' },
  warning: { dot: 'bg-[#E1552F]', border: 'border-[#E1552F]/50', label: 'Warning' },
};

function AlertPill({ alert }: { alert: AlertItem }): JSX.Element {
  const tone = SEVERITY_STYLES[alert.severity];
  return (
    <div
      className={cn(
        'glass flex min-w-[180px] flex-1 items-start gap-2.5 rounded-2xl border-l-[3px] p-3.5',
        tone.border,
      )}
    >
      <span aria-hidden="true" className={cn('mt-[7px] h-2 w-2 shrink-0 rounded-full', tone.dot)} />
      <div className="min-w-0">
        <p className="text-[13px] font-semibold leading-tight text-surface">{alert.title}</p>
        <p className="mt-1 text-xs leading-relaxed text-surface-muted">{alert.detail}</p>
      </div>
      <span className="sr-only">{tone.label}</span>
    </div>
  );
}

export function AlertDigest({ city, units, className }: AlertDigestProps): JSX.Element | null {
  const [alerts, setAlerts] = useState<AlertItem[] | null>(null);

  const { id: cityId, name, country, latitude, longitude } = city;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setAlerts(null);

    void (async () => {
      try {
        const response = await fetch('/api/ai/alerts', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ city: { name, country, latitude, longitude }, units }),
          signal: controller.signal,
        });
        if (!response.ok || !active) throw new Error('alerts unavailable');
        const data = (await response.json()) as AlertDigestResult;
        if (!active) return;
        if (!data || !Array.isArray(data.alerts) || data.alerts.length === 0) throw new Error('invalid');
        setAlerts(data.alerts.slice(0, 4));
      } catch {
        if (active) setAlerts(null); // optional enrichment — silent
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [cityId, name, country, latitude, longitude, units]);

  if (!alerts) return null;

  return (
    <div
      className={cn('flex flex-col gap-2.5 sm:flex-row sm:flex-wrap', className)}
      role="list"
      aria-label="Next 24 hours at a glance"
    >
      {alerts.map((alert) => (
        <div role="listitem" key={`${alert.severity}-${alert.title}`} className="flex-1">
          <AlertPill alert={alert} />
        </div>
      ))}
    </div>
  );
}
