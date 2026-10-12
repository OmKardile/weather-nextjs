import { useId, type ReactElement } from 'react';
import { cn } from '@/lib/utils';

interface LogoMarkProps {
  className?: string;
}

/* ================================================================== */
/* Aether brand mark — "Altitude A".                                    */
/* A geometric A whose crossbar is a flowing wave; a golden sun sits   */
/* in the counter, rising behind the strokes like a peak at dawn.      */
/* Aurora-teal gradient field, mint-white strokes, gold sun — the      */
/* whole app's palette in one squircle.                                */
/* ================================================================== */

/** The mark as a plain SVG string (shared by the favicon + OG image). */
export const LOGO_MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Aether logo">
  <defs>
    <linearGradient id="aBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#53E6C4"/>
      <stop offset="0.52" stop-color="#1FA98C"/>
      <stop offset="1" stop-color="#0A4A40"/>
    </linearGradient>
    <radialGradient id="aGlow" cx="0.3" cy="0.22" r="0.75">
      <stop offset="0" stop-color="#EAFFF8" stop-opacity="0.34"/>
      <stop offset="0.55" stop-color="#EAFFF8" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="aSun" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFE9A3"/>
      <stop offset="1" stop-color="#F6A93B"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="16" fill="url(#aBg)"/>
  <rect width="64" height="64" rx="16" fill="url(#aGlow)"/>
  <circle cx="32" cy="30.5" r="9.4" fill="#FFD66B" opacity="0.22"/>
  <circle cx="32" cy="30.5" r="5.6" fill="url(#aSun)"/>
  <path d="M17.5 51 L32 13.5 L46.5 51" fill="none" stroke="#F4FFFB" stroke-width="5.4" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M20.5 40.5 q3.2 -3.4 6.4 0 t6.4 0 t6.4 0 t6.4 0" fill="none" stroke="#F4FFFB" stroke-width="4" stroke-linecap="round" opacity="0.92"/>
</svg>`;

export function LogoMark({ className }: LogoMarkProps): ReactElement {
  // Namespaced gradient ids — the mark can appear twice on a page (menu bar +
  // footer) without duplicate DOM ids.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label="Aether logo"
      className={cn('h-9 w-9', className)}
    >
      <defs>
        <linearGradient id={`aether-bg-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#53E6C4" />
          <stop offset="0.52" stopColor="#1FA98C" />
          <stop offset="1" stopColor="#0A4A40" />
        </linearGradient>
        <radialGradient id={`aether-glow-${uid}`} cx="0.3" cy="0.22" r="0.75">
          <stop offset="0" stopColor="#EAFFF8" stopOpacity="0.34" />
          <stop offset="0.55" stopColor="#EAFFF8" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`aether-sun-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFE9A3" />
          <stop offset="1" stopColor="#F6A93B" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#aether-bg-${uid})`} />
      <rect width="64" height="64" rx="16" fill={`url(#aether-glow-${uid})`} />
      {/* Sun rising in the counter of the A — halo first, then the disc,
          both behind the strokes so the peak "eclipses" them. */}
      <circle cx="32" cy="30.5" r="9.4" fill="#FFD66B" opacity="0.22" />
      <circle cx="32" cy="30.5" r="5.6" fill={`url(#aether-sun-${uid})`} />
      {/* The A: two round-capped diagonals meeting at the apex… */}
      <path
        d="M17.5 51 L32 13.5 L46.5 51"
        fill="none"
        stroke="#F4FFFB"
        strokeWidth="5.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* …and a wave for the crossbar. */}
      <path
        d="M20.5 40.5 q3.2 -3.4 6.4 0 t6.4 0 t6.4 0 t6.4 0"
        fill="none"
        stroke="#F4FFFB"
        strokeWidth="4"
        strokeLinecap="round"
        opacity="0.92"
      />
    </svg>
  );
}

interface LogoProps {
  className?: string;
  /** Show the wordmark next to the mark. */
  withWordmark?: boolean;
}

export function Logo({ className, withWordmark = true }: LogoProps): ReactElement {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark />
      {withWordmark && (
        <span className="font-display text-lg font-bold tracking-[0.22em] text-surface">
          AETHER
        </span>
      )}
    </span>
  );
}
