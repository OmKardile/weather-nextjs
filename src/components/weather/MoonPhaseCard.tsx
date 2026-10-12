'use client';

import type { JSX } from 'react';
import { Glass } from '@/components/glass/Glass';
import { getMoonPhase } from '@/lib/moon';
import { locationNow } from '@/lib/time';
import type { WeatherBundle } from '@/types/weather';
import { cn } from '@/lib/utils';

/* ================================================================== */
/* MoonPhaseCard — tonight's moon with a phase-rendered disc.          */
/* ================================================================== */

interface MoonPhaseCardProps {
  bundle: WeatherBundle;
  className?: string;
}

/** Renders the illuminated fraction of the moon disc for a given phase 0–1. */
function MoonDisc({ phase, size = 56 }: { phase: number; size?: number }): JSX.Element {
  const r = 24;
  const c = 28;
  const angle = 2 * Math.PI * phase;
  const cos = Math.cos(angle);
  // Terminator ellipse half-width: r at quarter moons, 0 at new/full.
  const rx = Math.abs(cos) * r;
  const waxing = phase < 0.5;
  const gibbous = (phase > 0.25 && phase < 0.5) || phase > 0.75;

  // Lit semicircle (right when waxing, left when waning), then the terminator
  // ellipse painted lit (gibbous) or dark (crescent) to sculpt the phase.
  const litSide = waxing
    ? `M ${c} ${c - r} A ${r} ${r} 0 0 1 ${c} ${c + r} Z`
    : `M ${c} ${c - r} A ${r} ${r} 0 0 0 ${c} ${c + r} Z`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 56 56"
      aria-hidden="true"
      className="shrink-0 drop-shadow-[0_2px_10px_rgb(69_209_179/0.18)]"
    >
      <defs>
        <radialGradient id="moon-lit" cx="0.38" cy="0.32" r="0.85">
          <stop offset="0" stopColor="#FDFEFE" />
          <stop offset="0.7" stopColor="#E9F4F0" />
          <stop offset="1" stopColor="#C9E4DC" />
        </radialGradient>
      </defs>
      {/* Dark disc */}
      <circle cx={c} cy={c} r={r} fill="#20393B" />
      {/* Lit half */}
      <path d={litSide} fill="url(#moon-lit)" />
      {/* Terminator ellipse */}
      <ellipse
        cx={c}
        cy={c}
        rx={rx}
        ry={r}
        fill={gibbous ? 'url(#moon-lit)' : '#20393B'}
      />
      {/* Craters */}
      <circle cx={waxing ? c + 8 : c - 9} cy={c - 5} r={2.6} fill="#B9D4CC" opacity={0.5} />
      <circle cx={waxing ? c + 4 : c - 3} cy={c + 8} r={1.8} fill="#B9D4CC" opacity={0.35} />
      {/* Rim light */}
      <circle cx={c} cy={c} r={r - 0.75} fill="none" stroke="#F4FAF8" strokeOpacity={0.25} strokeWidth={0.75} />
    </svg>
  );
}

export function MoonPhaseCard({ bundle, className }: MoonPhaseCardProps) {
  const moon = getMoonPhase(locationNow(bundle.utcOffsetSeconds));
  const illum = Math.round(moon.illumination * 100);
  const daysToFull = Math.round(Math.abs(moon.daysFromFull));
  const fullNote =
    daysToFull <= 1
      ? 'Full moon is close'
      : moon.daysFromFull > 0
        ? `Full moon in ${daysToFull} days`
        : `Full moon ${daysToFull} days ago`;

  return (
    <Glass level="base" className={cn('rounded-2xl p-4 sm:p-5', className)}>
      <p className="card-label">
        Moon
      </p>
      <div className="mt-3 flex items-center gap-4">
        <MoonDisc phase={moon.phase} />
        <div className="min-w-0">
          <p className="truncate text-[15px] font-medium text-surface">{moon.name}</p>
          <p className="tnum mt-0.5 text-sm text-surface-muted">{illum}% illuminated</p>
          <p className="mt-0.5 text-xs text-surface-faint">{fullNote}</p>
        </div>
      </div>
    </Glass>
  );
}
