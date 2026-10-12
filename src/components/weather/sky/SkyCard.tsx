'use client';

import { useEffect, useMemo, useState } from 'react';
import type { JSX } from 'react';
import { addDays, addHours, differenceInMinutes, format, parseISO } from 'date-fns';
import { MoonGlyph } from '@/components/weather/sky/MoonGlyph';
import {
  STRIP_PHASE_COLORS,
  STRIP_PHASE_LABELS,
  daySkyTimes,
  phaseAt,
  stargazingTonight,
  stripSegments,
} from '@/components/weather/sky/sky-time';
import type { StripPhase } from '@/components/weather/sky/sky-time';
import { Icon } from '@/components/icons/Icon';
import { getMoonPhase } from '@/lib/moon';
import { formatHour, formatVisibility } from '@/lib/units';
import { cn } from '@/lib/utils';
import type { Units, WeatherBundle } from '@/types/weather';
import './sky.css';

/* ================================================================== */
/* SkyCard — golden & blue hours, the day-phase strip (hero visual),    */
/* tonight's stargazing score and a 14-night moon calendar.             */
/* Sits in the "Sky & photography" section next to the aurora card.     */
/* ================================================================== */

interface SkyCardProps {
  bundle: WeatherBundle;
  units: Units;
}

type SkyKind = 'golden' | 'blue';

interface SkyEvent {
  kind: SkyKind;
  when: 'today' | 'tomorrow';
  start: string;
  end: string;
}

const MOON_NIGHTS = 14;

/** Countdown copy: "2h 14m" / "46m". */
function formatCountdown(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

function meterColor(score: number): string {
  if (score >= 70) return '#45D1B3';
  if (score >= 40) return '#E8C54D';
  return '#F0954A';
}

const VERDICT_TONES: Record<'Excellent' | 'Good' | 'Fair' | 'Poor', string> = {
  Excellent: 'sky-tone-excellent',
  Good: 'sky-tone-good',
  Fair: 'sky-tone-fair',
  Poor: 'sky-tone-poor',
};

const LEGEND_ORDER: StripPhase[] = ['night', 'astro', 'nautical', 'civil', 'golden', 'day'];

function FactorMeter({
  label,
  value,
  score,
}: {
  label: string;
  value: string;
  score: number;
}): JSX.Element {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] text-surface-muted">{label}</span>
        <span className="tnum text-[11px] font-semibold text-surface">{value}</span>
      </div>
      <div
        className="mt-1 h-1.5 overflow-hidden rounded-full"
        style={{ background: 'color-mix(in srgb, var(--surface-border) 70%, transparent)' }}
        role="presentation"
      >
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${score}%`, background: meterColor(score) }}
        />
      </div>
    </div>
  );
}

export function SkyCard({ bundle, units }: SkyCardProps): JSX.Element | null {
  // The bundle contract guarantees 16 daily entries; guard defensively by
  // bailing before the inner component (its hooks must be unconditional).
  if (!bundle.daily[0] || !bundle.daily[1]) return null;
  return <SkyCardInner bundle={bundle} units={units} />;
}

function SkyCardInner({ bundle, units }: SkyCardProps): JSX.Element {
  const today = bundle.daily[0];
  const tomorrow = bundle.daily[1];

  // Rendered only after the client-side bundle arrives, so a lazy initial
  // clock is hydration-safe (FreshnessPill pattern); the interval keeps the
  // countdown ticking every 30 seconds.
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const todaySky = useMemo(() => daySkyTimes(today), [today]);
  const tomorrowSky = useMemo(() => daySkyTimes(tomorrow), [tomorrow]);
  const strip = useMemo(
    () => stripSegments(todaySky, tomorrowSky),
    [todaySky, tomorrowSky],
  );

  // Location wall-clock "now" (browser frame — same frame as parseISO of the
  // bundle's local ISOs; same shift locationNow applies), kept live by the
  // 30s tick.
  const now = useMemo(() => {
    const tzShift =
      (bundle.utcOffsetSeconds + new Date().getTimezoneOffset() * 60) * 1000;
    return new Date(nowMs + tzShift);
  }, [nowMs, bundle.utcOffsetSeconds]);

  const events = useMemo<SkyEvent[]>(
    () => [
      { kind: 'blue', when: 'today', ...todaySky.blueMorning },
      { kind: 'golden', when: 'today', ...todaySky.goldenMorning },
      { kind: 'golden', when: 'today', ...todaySky.goldenEvening },
      { kind: 'blue', when: 'today', ...todaySky.blueEvening },
      { kind: 'blue', when: 'tomorrow', ...tomorrowSky.blueMorning },
      { kind: 'golden', when: 'tomorrow', ...tomorrowSky.goldenMorning },
    ],
    [todaySky, tomorrowSky],
  );

  /* --- the next golden/blue window (or the one in progress) --- */
  const nextEvent = useMemo(() => {
    let upcoming: { event: SkyEvent; start: Date; end: Date } | null = null;
    let active: { event: SkyEvent; end: Date } | null = null;
    for (const event of events) {
      const start = parseISO(event.start);
      const end = parseISO(event.end);
      if (now >= start && now < end) {
        active = { event, end };
        break;
      }
      if (now < start && (!upcoming || start < upcoming.start)) {
        upcoming = { event, start, end };
      }
    }
    return { active, upcoming };
  }, [events, now]);

  /* --- stargazing tonight (moon evaluated mid-night) --- */
  const stargazing = useMemo(
    () =>
      stargazingTonight(
        bundle.hourly,
        getMoonPhase(now < todaySky.sunrise ? now : addHours(todaySky.sunset, 3)).illumination,
        now,
        todaySky,
        tomorrowSky,
      ),
    [bundle.hourly, now, todaySky, tomorrowSky],
  );

  /* --- 14-night moon calendar --- */
  const moonNights = useMemo(() => {
    const nights: Array<{ dateLabel: string; phase: number; illum: number }> = [];
    const base = parseISO(`${today.date}T12:00`);
    for (let i = 0; i < MOON_NIGHTS; i += 1) {
      const night = addDays(base, i);
      const moon = getMoonPhase(addHours(night, 9)); // ~21:00 local
      nights.push({
        dateLabel: format(night, 'EEE d'),
        phase: moon.phase,
        illum: Math.round(moon.illumination * 100),
      });
    }
    return nights;
  }, [today.date]);

  /* --- day-strip positioning --- */
  const nowMinutes = differenceInMinutes(now, strip.windowStart);
  const nowPct = Math.max(0, Math.min(100, (nowMinutes / strip.durationMin) * 100));
  const currentPhase = phaseAt(strip.segments, nowMinutes);

  const tickLabels = useMemo(() => {
    return [0, 1, 2, 3, 4].map((i) => ({
      pct: (i / 4) * 100,
      label: formatHour(
        format(addHours(strip.windowStart, i * 6), "yyyy-MM-dd'T'HH:mm"),
        units,
      ),
    }));
  }, [strip.windowStart, units]);

  const eventLabel = (event: SkyEvent) =>
    `${event.when === 'today' ? 'Today' : 'Tomorrow'} ${event.kind === 'golden' ? 'golden hour' : 'blue hour'} ` +
    `${formatHour(event.start, units)} to ${formatHour(event.end, units)}`;

  const stripAria =
    `Sky phase bar from ${formatHour(format(strip.windowStart, "yyyy-MM-dd'T'HH:mm"), units)} today ` +
    `to ${formatHour(format(addHours(strip.windowStart, 24), "yyyy-MM-dd'T'HH:mm"), units)} tomorrow. ` +
    `Now: ${
      currentPhase === 'night'
        ? 'night'
        : currentPhase === 'day'
          ? 'daylight'
          : `${STRIP_PHASE_LABELS[currentPhase].toLowerCase()} twilight`
    }. ` +
    events.map((event) => eventLabel(event)).join('. ') +
    '.';

  return (
    <div className="glass animate-fade-up flex h-full flex-col rounded-[var(--radius-card)] p-4 shadow-[var(--shadow-glass)] sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <p className="flex items-center gap-1.5 card-label">
          <Icon name="sunrise" size={14} strokeWidth={2} aria-hidden="true" />
          Golden &amp; blue hour
        </p>
        {/* countdown chip — no aria-live: it re-renders every 30s and polite
            announcements of each tick would be screen-reader noise */}
        <span
          className={cn(
            'glass-subtle sky-chip tnum rounded-full px-2.5 py-1 text-[11px] font-medium',
            nextEvent.active || nextEvent.upcoming?.event.kind === 'golden'
              ? 'sky-tone-golden'
              : 'sky-tone-bluehour',
          )}
        >
          {nextEvent.active ? (
            <>
              {nextEvent.active.event.kind === 'golden' ? 'Golden hour' : 'Blue hour'} now · ends in{' '}
              {formatCountdown(differenceInMinutes(nextEvent.active.end, now))}
            </>
          ) : nextEvent.upcoming ? (
            <>
              {nextEvent.upcoming.event.kind === 'golden' ? 'Golden hour' : 'Blue hour'} in{' '}
              {formatCountdown(differenceInMinutes(nextEvent.upcoming.start, now))}
            </>
          ) : (
            'Tonight’s light has passed'
          )}
        </span>
      </div>

      {/* --- day-phase strip (hero visual) --- */}
      <div className="mt-3.5" role="img" aria-label={stripAria}>
        <div className="relative">
          <div className="relative h-3.5 w-full overflow-hidden rounded-full ring-1 ring-inset ring-white/10">
            {strip.segments.map((seg, i) => (
              <div
                key={i}
                className="absolute inset-y-0"
                style={{
                  left: `${(seg.startMin / strip.durationMin) * 100}%`,
                  width: `${((seg.endMin - seg.startMin) / strip.durationMin) * 100}%`,
                  background: STRIP_PHASE_COLORS[seg.phase],
                }}
              />
            ))}
          </div>
          {/* now marker */}
          <div
            className="pointer-events-none absolute -top-1 h-[calc(100%+8px)] w-[3px] -translate-x-1/2 rounded-full bg-white shadow-[0_0_6px_rgb(255_255_255/0.7)]"
            style={{ left: `${nowPct}%` }}
            aria-hidden="true"
          />
        </div>
        <div className="tnum mt-1.5 flex justify-between text-[10px] text-surface-faint" aria-hidden="true">
          {tickLabels.map((tick, i) => (
            <span key={i}>{tick.label}</span>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1" aria-hidden="true">
          {LEGEND_ORDER.map((phase) => (
            <span key={phase} className="flex items-center gap-1 text-[10px] text-surface-faint">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: STRIP_PHASE_COLORS[phase] }}
              />
              {STRIP_PHASE_LABELS[phase]}
            </span>
          ))}
        </div>
      </div>

      {/* --- the listed windows --- */}
      <div className="mt-3.5 grid grid-cols-2 gap-x-5 gap-y-2 sm:grid-cols-3">
        {events.map((event, i) => {
          const past = now.getTime() >= parseISO(event.end).getTime();
          return (
            <div key={i} className={past ? 'opacity-45' : undefined}>
              <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-surface-faint">
                {event.when === 'today' ? 'Today' : 'Tomorrow'} ·{' '}
                {event.kind === 'golden' ? 'Golden' : 'Blue'}
              </p>
              <p className="tnum mt-0.5 text-xs text-surface">
                {formatHour(event.start, units)}–{formatHour(event.end, units)}
              </p>
            </div>
          );
        })}
      </div>

      {/* --- stargazing tonight --- */}
      <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--surface-border)' }}>
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-1.5 card-label">
            <Icon name="moon-phase" size={14} strokeWidth={2} aria-hidden="true" />
            Stargazing tonight
          </p>
          {stargazing ? (
            <span
              className={cn(
                'sky-chip tnum rounded-full px-2.5 py-1 text-[11px] font-semibold',
                VERDICT_TONES[stargazing.verdict],
              )}
            >
              {stargazing.score} · {stargazing.verdict}
            </span>
          ) : null}
        </div>

        {stargazing ? (
          <>
            <p className="mt-2 text-xs leading-relaxed text-surface-muted">
              {stargazing.verdict === 'Excellent'
                ? 'Near-ideal skies — dark, clear and steady.'
                : stargazing.verdict === 'Good'
                  ? 'Good viewing — some haze or moonlight to contend with.'
                  : stargazing.verdict === 'Fair'
                    ? 'Acceptable glimpses between clouds or moonlight.'
                    : 'Poor conditions — clouds, haze or a bright moon.'}
            </p>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
              <FactorMeter
                label="Cloud cover"
                value={`${stargazing.cloudPercent}% avg`}
                score={stargazing.cloudScore}
              />
              <FactorMeter
                label="Moonlight"
                value={`${Math.round(stargazing.moonIllumination * 100)}% lit`}
                score={stargazing.moonScore}
              />
              <FactorMeter
                label="Visibility"
                value={formatVisibility(stargazing.visibilityKm * 1000, units)}
                score={stargazing.visibilityScore}
              />
            </div>
          </>
        ) : (
          <p className="mt-2 text-xs text-surface-muted">
            Not enough dark hours left to score tonight.
          </p>
        )}
      </div>

      {/* --- moon calendar --- */}
      <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--surface-border)' }}>
        <p className="card-label">
          Moon · next {MOON_NIGHTS} nights
        </p>
        <div
          className="scroll-slim -mx-1 mt-2.5 flex gap-1 overflow-x-auto px-1 pb-2"
          role="list"
          aria-label={`Moon phases for the next ${MOON_NIGHTS} nights, starting tonight at ${moonNights[0]?.illum ?? 0}% illuminated`}
        >
          {moonNights.map((night, i) => (
            <div
              key={i}
              role="listitem"
              aria-label={`${i === 0 ? 'Tonight' : night.dateLabel}: ${night.illum}% illuminated`}
              className={cn(
                'flex w-[54px] shrink-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-center',
                i === 0 && 'bg-aurora-500/10 ring-1 ring-inset ring-aurora-400/30',
              )}
            >
              <MoonGlyph phase={night.phase} size={30} />
              <span className="tnum text-[10px] font-medium text-surface">{night.illum}%</span>
              <span className="text-[9px] text-surface-faint">
                {i === 0 ? 'Tonight' : night.dateLabel}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
