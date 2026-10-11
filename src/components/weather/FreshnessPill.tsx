'use client';

import { useEffect, useState } from 'react';
import { Icon } from '@/components/icons/Icon';

/* ================================================================== */
/* FreshnessPill — "Updated Xm ago" on the hourly section header.      */
/* Live-updates every 30s from bundle.fetchedAt (ISO with Z).           */
/* ================================================================== */

function describeAge(ageMs: number): string {
  if (ageMs < 45_000) return 'Updated just now';
  const minutes = Math.floor(ageMs / 60_000);
  if (minutes < 60) return `Updated ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Updated ${hours}h ago`;
  return 'Updated earlier';
}

export function FreshnessPill({ fetchedAt }: { fetchedAt: string }) {
  // Rendered only after the client-side bundle arrives, so a lazy initial
  // clock is hydration-safe; the interval keeps it live every 30 seconds.
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const fetchedMs = Date.parse(fetchedAt);
  const label = Number.isNaN(fetchedMs) ? '' : describeAge(Math.max(now - fetchedMs, 0));

  if (!label) return null;

  return (
    <span
      className="glass-subtle tnum inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium text-surface-muted"
      aria-label={`Weather data ${label.toLowerCase()}`}
    >
      <Icon name="refresh" size={11} strokeWidth={2} className="shrink-0 text-aurora-300" />
      {label}
    </span>
  );
}
