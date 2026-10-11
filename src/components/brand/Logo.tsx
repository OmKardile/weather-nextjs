import { cn } from '@/lib/utils';

interface LogoMarkProps {
  className?: string;
}

/**
 * Aether brand mark — a sun half-risen over calm water,
 * rendered as an inline SVG (gradient aurora teal, mist strokes).
 */
export function LogoMark({ className }: LogoMarkProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label="Aether logo"
      className={cn('h-9 w-9', className)}
    >
      <defs>
        <linearGradient id="aether-mark-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#45D1B3" />
          <stop offset="1" stopColor="#0F5F55" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#aether-mark-g)" />
      <circle cx="32" cy="29" r="10" fill="#F6FEFB" />
      <path
        d="M12 40 q5 -5 10 0 t10 0 t10 0 t10 0"
        fill="none"
        stroke="#F6FEFB"
        strokeWidth="4"
        strokeLinecap="round"
        opacity="0.95"
      />
      <path
        d="M16 49 q4 -4 8 0 t8 0 t8 0 t8 0"
        fill="none"
        stroke="#F6FEFB"
        strokeWidth="3.5"
        strokeLinecap="round"
        opacity="0.6"
      />
    </svg>
  );
}

interface LogoProps {
  className?: string;
  /** Show the wordmark next to the mark. */
  withWordmark?: boolean;
}

export function Logo({ className, withWordmark = true }: LogoProps) {
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
