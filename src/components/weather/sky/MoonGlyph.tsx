'use client';

import { useId } from 'react';
import type { JSX } from 'react';

/* ================================================================== */
/* MoonGlyph — tiny phase-rendered moon disc for strips and rows.       */
/* Same sculpting approach as MoonPhaseCard's disc (lit semicircle +    */
/* terminator ellipse), but useId-namespaced so any number of glyphs   */
/* can coexist with MoonPhaseCard's hardcoded "moon-lit" gradient.      */
/* ================================================================== */

export function MoonGlyph({
  phase,
  size = 32,
  className,
}: {
  /** 0–1 cycle position (0 = new, 0.5 = full). */
  phase: number;
  size?: number;
  className?: string;
}): JSX.Element {
  const rawId = useId();
  const gid = `mg${rawId.replace(/[^a-zA-Z0-9]/g, '')}`;

  const r = 24;
  const c = 28;
  const angle = 2 * Math.PI * phase;
  const cos = Math.cos(angle);
  // Terminator ellipse half-width: r at quarter moons, 0 at new/full.
  const rx = Math.abs(cos) * r;
  const waxing = phase < 0.5;
  const gibbous = (phase > 0.25 && phase < 0.5) || phase > 0.75;

  const litSide = waxing
    ? `M ${c} ${c - r} A ${r} ${r} 0 0 1 ${c} ${c + r} Z`
    : `M ${c} ${c - r} A ${r} ${r} 0 0 0 ${c} ${c + r} Z`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 56 56"
      aria-hidden="true"
      className={className}
    >
      <defs>
        <radialGradient id={`${gid}-lit`} cx="0.38" cy="0.32" r="0.85">
          <stop offset="0" stopColor="#FDFEFE" />
          <stop offset="0.7" stopColor="#E9F4F0" />
          <stop offset="1" stopColor="#C9E4DC" />
        </radialGradient>
      </defs>
      {/* Dark disc */}
      <circle cx={c} cy={c} r={r} fill="#20393B" />
      {/* Lit half */}
      <path d={litSide} fill={`url(#${gid}-lit)`} />
      {/* Terminator ellipse */}
      <ellipse
        cx={c}
        cy={c}
        rx={rx}
        ry={r}
        fill={gibbous ? `url(#${gid}-lit)` : '#20393B'}
      />
      {/* Rim light */}
      <circle
        cx={c}
        cy={c}
        r={r - 0.75}
        fill="none"
        stroke="#F4FAF8"
        strokeOpacity={0.25}
        strokeWidth={0.75}
      />
    </svg>
  );
}
