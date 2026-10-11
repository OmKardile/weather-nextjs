'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/icons/Icon';
import { WeatherIcon } from '@/components/weather/WeatherIcon';
import { conditionLabel } from '@/lib/wmo';
import { formatTemp, formatWind, compassPoint } from '@/lib/units';
import type { Units, WeatherBundle, GeoQuake } from '@/types/weather';
import { cn } from '@/lib/utils';

/* ================================================================== */
/* Glass popup contents (rendered into maplibre Popup via portal).     */
/* PointPopup — tap point forecast from /api/weather?lat&lon.          */
/* QuakePopup — USGS event details + "View on USGS" link.              */
/* ================================================================== */

export function PopupCloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label="Close popup"
      className="focus-ring absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full text-surface-muted transition-colors duration-200 hover:bg-[rgb(255_255_255/0.09)] hover:text-surface"
    >
      <Icon name="x" size={14} />
    </button>
  );
}

/* ------------------------- point forecast -------------------------- */

interface PointPopupProps {
  lng: number;
  lat: number;
  units: Units;
  onClose: () => void;
}

const FETCH_DEBOUNCE_MS = 300;

export function PointPopup({ lng, lat, units, onClose }: PointPopupProps) {
  const [bundle, setBundle] = useState<WeatherBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const controller = new AbortController();
      abortRef.current?.abort();
      abortRef.current = controller;
      const params = new URLSearchParams({
        lat: String(Math.round(lat * 1000) / 1000),
        lon: String(Math.round(lng * 1000) / 1000),
      });
      fetch(`/api/weather?${params.toString()}`, { signal: controller.signal })
        .then(async (res) => {
          if (!res.ok) throw new Error(`Weather request failed (${res.status})`);
          return (await res.json()) as WeatherBundle;
        })
        .then((data) => {
          if (abortRef.current !== controller) return;
          setBundle(data);
          setError(null);
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          if (abortRef.current !== controller) return;
          setBundle(null);
          setError(err instanceof Error ? err.message : 'Forecast unavailable');
        });
    }, FETCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, [lng, lat, retryKey]);

  const nextHour = bundle?.hourly[1] ?? bundle?.hourly[0] ?? null;

  return (
    <div className="relative w-[min(280px,calc(100vw-3rem))] p-4 pr-10">
      <PopupCloseButton onClose={onClose} />
      <p className="tnum text-[10px] font-semibold uppercase tracking-[0.14em] text-surface-faint">
        Point forecast
      </p>
      {error ? (
        <div className="mt-2">
          <p className="text-[13px] leading-snug text-surface-muted">
            Couldn’t load the forecast for this point.
          </p>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setBundle(null);
              setRetryKey((k) => k + 1);
            }}
            className="focus-ring mt-2 rounded-full bg-aurora-500/20 px-3 py-1.5 text-xs font-semibold text-aurora-300 ring-1 ring-inset ring-aurora-500/40 transition-colors duration-200 hover:bg-aurora-500/30"
          >
            Retry
          </button>
        </div>
      ) : !bundle ? (
        <div className="mt-2 flex items-center gap-3">
          <span className="skeleton h-10 w-10 rounded-xl" />
          <span className="flex flex-col gap-1.5">
            <span className="skeleton block h-4 w-24 rounded-full" />
            <span className="skeleton block h-3 w-32 rounded-full" />
          </span>
        </div>
      ) : (
        <div className="mt-1.5">
          <div className="flex items-center gap-3">
            <WeatherIcon
              condition={bundle.current.condition}
              isDay={bundle.current.isDay}
              size={40}
            />
            <div className="min-w-0">
              <p className="tnum text-xl font-bold leading-none text-surface">
                {formatTemp(bundle.current.temperature, units)}
              </p>
              <p className="truncate text-[12px] font-medium text-surface-muted">
                {conditionLabel(bundle.current.weatherCode)}
              </p>
            </div>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12px]">
            <div className="flex items-center gap-1.5">
              <Icon name="wind" size={14} className="shrink-0 text-surface-faint" />
              <dt className="sr-only">Wind</dt>
              <dd className="tnum text-surface-muted">
                {formatWind(bundle.current.windSpeed, units)}{' '}
                {compassPoint(bundle.current.windDirection)}
              </dd>
            </div>
            <div className="flex items-center gap-1.5">
              <Icon name="droplet" size={14} className="shrink-0 text-surface-faint" />
              <dt className="sr-only">Next-hour rain chance</dt>
              <dd className="tnum text-surface-muted">
                {nextHour ? `${nextHour.precipitationProbability}% next hour` : '—'}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}

/* --------------------------- earthquake ---------------------------- */

function sinceLabel(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 1) return `${hours}h ago`;
  const minutes = Math.max(1, Math.floor(ms / 60_000));
  return `${minutes}m ago`;
}

export function QuakePopup({ quake, onClose }: { quake: GeoQuake; onClose: () => void }) {
  const color =
    quake.magnitude >= 5 ? '#E1552F' : quake.magnitude >= 4 ? '#E8C54D' : '#45d1b3';
  return (
    <div className="relative w-[min(280px,calc(100vw-3rem))] p-4 pr-10">
      <PopupCloseButton onClose={onClose} />
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-surface-faint">
        Earthquake · USGS
      </p>
      <p className="mt-1.5 flex items-center gap-2">
        <span
          className="tnum rounded-lg px-2 py-1 text-[15px] font-bold leading-none"
          style={{ background: `${color}26`, color, boxShadow: `inset 0 0 0 1px ${color}55` }}
        >
          M {quake.magnitude.toFixed(1)}
        </span>
        {quake.tsunami && (
          <span className="rounded-full bg-[#E1552F]/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#ff9b7a]">
            Tsunami flag
          </span>
        )}
      </p>
      <p className="mt-1.5 text-[13px] font-medium leading-snug text-surface">
        {quake.place || 'Unknown region'}
      </p>
      <p className="tnum mt-1 text-[12px] text-surface-muted">
        {quake.depthKm} km deep · {sinceLabel(quake.time)}
      </p>
      {quake.url && (
        <a
          href={quake.url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'focus-ring mt-2.5 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold',
            'text-aurora-300 ring-1 ring-inset ring-aurora-500/40 transition-colors duration-200 hover:bg-aurora-500/20',
          )}
        >
          View on USGS
          <Icon name="chevron-right" size={13} />
        </a>
      )}
    </div>
  );
}
