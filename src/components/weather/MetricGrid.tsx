'use client';

import {
  Cloud,
  Droplets,
  Eye,
  Gauge,
  Sun,
  Thermometer,
  Umbrella,
  Wind,
} from 'lucide-react';
import { daylightLength, sunProgress } from '@/lib/time';
import {
  compassPoint,
  displayTemp,
  formatHour,
  formatPrecip,
  formatPressure,
  formatTemp,
  formatVisibility,
  formatWind,
  uvInfo,
  visibilityLabel,
} from '@/lib/units';
import type { HourlyPoint, Units, WeatherBundle } from '@/types/weather';

interface MetricGridProps {
  data: WeatherBundle;
  units: Units;
}

function dewPoint(celsius: number, humidity: number): number {
  const a = 17.27;
  const b = 237.7;
  const alpha = Math.log(Math.max(humidity, 1) / 100) + (a * celsius) / (b + celsius);
  return (b * alpha) / (a - alpha);
}

function Card({
  icon,
  label,
  children,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`glass glass-hover rounded-[var(--radius-card)] p-4 ${className ?? ''}`}>
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-surface-muted">
        <span aria-hidden="true">{icon}</span>
        {label}
      </p>
      {children}
    </div>
  );
}

function WindCompass({ data, units }: { data: WeatherBundle; units: Units }) {
  const { windSpeed, windGust, windDirection } = data.current;
  const to = (windDirection + 180) % 360; // arrow points downwind

  return (
    <Card icon={<Wind className="h-3.5 w-3.5" />} label="Wind">
      <div className="mt-2 flex items-center gap-3">
        <svg viewBox="0 0 72 72" className="h-16 w-16 shrink-0" role="img" aria-label={`Wind from ${compassPoint(windDirection)}`}>
          <circle cx="36" cy="36" r="30" fill="none" style={{ stroke: "var(--surface-border)" }} strokeWidth="2" />
          {(['N', 'E', 'S', 'W'] as const).map((point, i) => {
            const angle = (i * 90 - 90) * (Math.PI / 180);
            const x = 36 + Math.cos(angle) * 24;
            const y = 36 + Math.sin(angle) * 24;
            return (
              <text
                key={point}
                x={x}
                y={y + 3.2}
                textAnchor="middle"
                fontSize="9"
                style={{ fill: "var(--surface-muted)" }}
                className="tnum"
              >
                {point}
              </text>
            );
          })}
          <g transform={`rotate(${to} 36 36)`} style={{ transition: 'transform 600ms var(--ease-out-expo)' }}>
            <path d="M36 14 L41 40 L36 35 L31 40 Z" fill="#45D1B3" />
          </g>
          <circle cx="36" cy="36" r="3" style={{ fill: "var(--surface-strong)" }} stroke="#45D1B3" strokeWidth="1.5" />
        </svg>
        <div>
          <p className="tnum text-xl font-semibold text-surface">{formatWind(windSpeed, units)}</p>
          <p className="tnum text-xs text-surface-muted">from {compassPoint(windDirection)}</p>
          <p className="tnum text-xs text-surface-faint">gusts {formatWind(windGust, units)}</p>
        </div>
      </div>
    </Card>
  );
}

function SunArc({ data, units }: { data: WeatherBundle; units: Units }) {
  const today = data.daily[0];
  if (!today) return null;

  const progress = sunProgress(today.sunrise, today.sunset, data.utcOffsetSeconds);
  const width = 150;
  const height = 64;
  const pad = 10;
  // Arc from (pad, height-6) to (width-pad, height-6), bulging up.
  const startX = pad;
  const endX = width - pad;
  const baseY = height - 6;
  const peakY = 10;
  const cx = (startX + endX) / 2;
  // Point on a quadratic bezier at t=progress
  const t = progress;
  const x = (1 - t) ** 2 * startX + 2 * (1 - t) * t * cx + t ** 2 * endX;
  const y = (1 - t) ** 2 * baseY + 2 * (1 - t) * t * peakY + t ** 2 * baseY;

  return (
    <Card icon={<Sun className="h-3.5 w-3.5" />} label="Sun path" className="sm:col-span-2">
      <div className="mt-1 flex items-end justify-between gap-2">
        <div className="tnum text-xs text-surface-muted">
          <span className="block text-sm font-semibold text-surface">
            {formatHour(today.sunrise, units)}
          </span>
          Sunrise
        </div>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-16 min-w-0 flex-1"
          role="img"
          aria-label={`Sun is ${Math.round(progress * 100)}% through its arc`}
        >
          <path
            d={`M ${startX} ${baseY} Q ${cx} ${peakY} ${endX} ${baseY}`}
            fill="none"
            style={{ stroke: "var(--surface-border)" }}
            strokeWidth="2"
            strokeDasharray="4 5"
            strokeLinecap="round"
          />
          <path
            d={`M ${startX} ${baseY} Q ${cx} ${peakY} ${endX} ${baseY}`}
            fill="none"
            stroke="#45D1B3"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray="200"
            strokeDashoffset={200 - progress * 200}
            opacity={0.9}
          />
          <line x1={startX - 4} y1={baseY} x2={endX + 4} y2={baseY} style={{ stroke: "var(--surface-border)" }} strokeWidth="1.5" />
          <circle cx={x} cy={y} r="7" fill="#FFD9A0" opacity={0.25} />
          <circle cx={x} cy={y} r="4" fill="#FFD9A0" stroke="#fff" strokeOpacity={0.8} strokeWidth="1" />
        </svg>
        <div className="tnum text-right text-xs text-surface-muted">
          <span className="block text-sm font-semibold text-surface">
            {formatHour(today.sunset, units)}
          </span>
          Sunset
        </div>
      </div>
      <p className="tnum mt-1 text-[11px] text-surface-faint">
        Daylight {daylightLength(today.sunrise, today.sunset)}
      </p>
    </Card>
  );
}

function UvCard({ uv }: { uv: number }) {
  const info = uvInfo(uv);
  const position = Math.min(uv / 11, 1) * 100;

  return (
    <Card icon={<Sun className="h-3.5 w-3.5" />} label="UV index">
      <div className="mt-2 flex items-baseline gap-2">
        <span className="tnum text-xl font-semibold text-surface">{uv.toFixed(1)}</span>
        <span className="text-xs font-medium" style={{ color: info.color }}>
          {info.label}
        </span>
      </div>
      <div className="relative mt-2.5 h-1.5 rounded-full" aria-hidden="true">
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background:
              'linear-gradient(90deg, #22BCA0 0%, #E8C54D 35%, #F0954A 60%, #E1552F 80%, #9B4A9E 100%)',
            opacity: 0.85,
          }}
        />
        <div
          className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-white shadow"
          style={{ left: `${position}%`, background: info.color }}
        />
      </div>
    </Card>
  );
}

export function MetricGrid({ data, units }: MetricGridProps) {
  const { current, hourly } = data;
  const next24 = hourly as HourlyPoint[];
  const maxPrecipChance = Math.max(...next24.map((hour) => hour.precipitationProbability), 0);
  const uvNow = next24[0]?.uvIndex ?? 0;
  const visibilityM = next24[0]?.visibility ?? 24_000;

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <WindCompass data={data} units={units} />

      <Card icon={<Droplets className="h-3.5 w-3.5" />} label="Humidity">
        <p className="tnum mt-2 text-xl font-semibold text-surface">{Math.round(current.humidity)}%</p>
        <p className="tnum mt-1 text-xs text-surface-muted">
          Dew point {formatTemp(dewPoint(current.temperature, current.humidity), units)}
        </p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--surface-subtle)]" aria-hidden="true">
          <div
            className="h-full rounded-full bg-gradient-to-r from-aurora-500 to-aurora-300 transition-all duration-500"
            style={{ width: `${Math.min(current.humidity, 100)}%` }}
          />
        </div>
      </Card>

      <UvCard uv={uvNow} />

      <Card icon={<Eye className="h-3.5 w-3.5" />} label="Visibility">
        <p className="tnum mt-2 text-xl font-semibold text-surface">
          {formatVisibility(visibilityM, units)}
        </p>
        <p className="mt-1 text-xs text-surface-muted">{visibilityLabel(visibilityM)}</p>
      </Card>

      <Card icon={<Gauge className="h-3.5 w-3.5" />} label="Pressure">
        <p className="tnum mt-2 text-xl font-semibold text-surface">
          {formatPressure(current.pressure, units)}
        </p>
        <p className="mt-1 text-xs text-surface-muted">
          {current.pressure < 1000 ? 'Low' : current.pressure > 1025 ? 'High' : 'Normal'} · sea level
        </p>
      </Card>

      <Card icon={<Cloud className="h-3.5 w-3.5" />} label="Cloud cover">
        <p className="tnum mt-2 text-xl font-semibold text-surface">{Math.round(current.cloudCover)}%</p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--surface-subtle)]" aria-hidden="true">
          <div
            className="h-full rounded-full bg-gradient-to-r from-aurora-300 to-aurora-500 transition-all duration-500"
            style={{ width: `${Math.min(current.cloudCover, 100)}%` }}
          />
        </div>
      </Card>

      <Card icon={<Umbrella className="h-3.5 w-3.5" />} label="Precipitation">
        <p className="tnum mt-2 text-xl font-semibold text-surface">
          {formatPrecip(current.precipitation, units)}
        </p>
        <p className="tnum mt-1 text-xs text-surface-muted">
          Up to {maxPrecipChance}% chance in 24h
        </p>
      </Card>

      <Card icon={<Thermometer className="h-3.5 w-3.5" />} label="Feels like">
        <p className="tnum mt-2 text-xl font-semibold text-surface">
          {displayTemp(current.apparentTemperature, units)}°
        </p>
        <p className="mt-1 text-xs text-surface-muted">
          {current.apparentTemperature > current.temperature + 0.5
            ? 'Humidity makes it feel warmer'
            : current.apparentTemperature < current.temperature - 0.5
              ? 'Wind makes it feel cooler'
              : 'Close to actual temperature'}
        </p>
      </Card>

      <SunArc data={data} units={units} />
    </div>
  );
}
