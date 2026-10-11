'use client';

import type { Condition } from '@/types/weather';
import { cn } from '@/lib/utils';
import './weather-icons.css';

interface WeatherIconProps {
  condition: Condition;
  isDay: boolean;
  /** Pixel size (square). */
  size?: number;
  className?: string;
}

const SUN_FILL = '#FFD9A0';
const MOON_FILL = '#E9F2EF';
const CLOUD_PATH = 'M18 44a10 10 0 0 1 2-19.8A14 14 0 0 1 46 26a9 9 0 0 1-1.5 18Z';

function Sun({ cx = 32, cy = 32, r = 10.5, rays = true }: { cx?: number; cy?: number; r?: number; rays?: boolean }) {
  const inner = r * 1.55;
  const outer = r * 2.05;
  const d = (r * 1.55) / Math.SQRT2;
  const d2 = (r * 2.05) / Math.SQRT2;
  return (
    <g>
      {rays && (
        <g className="wi-rays" stroke={SUN_FILL} strokeWidth={3} strokeLinecap="round">
          <line x1={cx} y1={cy - outer} x2={cx} y2={cy - inner} />
          <line x1={cx} y1={cy + inner} x2={cx} y2={cy + outer} />
          <line x1={cx - outer} y1={cy} x2={cx - inner} y2={cy} />
          <line x1={cx + inner} y1={cy} x2={cx + outer} y2={cy} />
          <line x1={cx - d2} y1={cy - d2} x2={cx - d} y2={cy - d} />
          <line x1={cx + d} y1={cy + d} x2={cx + d2} y2={cy + d2} />
          <line x1={cx - d2} y1={cy + d2} x2={cx - d} y2={cy + d} />
          <line x1={cx + d} y1={cy - d} x2={cx + d2} y2={cy - d2} />
        </g>
      )}
      <circle cx={cx} cy={cy} r={r} fill={SUN_FILL} className="wi-pulse" />
    </g>
  );
}

function Moon({ cx = 32, cy = 32, r = 12 }: { cx?: number; cy?: number; r?: number }) {
  const maskId = `moon-cut-${cx}-${cy}-${r}`;
  return (
    <g>
      <mask id={maskId}>
        <rect x={cx - r - 4} y={cy - r - 4} width={r * 2 + 8} height={r * 2 + 8} fill="white" />
        <circle cx={cx + r * 0.62} cy={cy - r * 0.55} r={r * 0.92} fill="black" />
      </mask>
      <circle cx={cx} cy={cy} r={r} fill={MOON_FILL} mask={`url(#${maskId})`} />
      <circle cx={cx - 3} cy={cy + 4} r={1.4} fill="#C4DBD3" opacity={0.7} />
      <circle cx={cx + 1} cy={cy + 8} r={0.9} fill="#C4DBD3" opacity={0.5} />
    </g>
  );
}

function Cloud({
  transform,
  className,
  opacity = 1,
}: {
  transform?: string;
  className?: string;
  opacity?: number;
}) {
  return (
    <path
      d={CLOUD_PATH}
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      transform={transform}
      className={className}
      opacity={opacity}
    />
  );
}

function Drops({ count = 3, snow = false }: { count?: number; snow?: boolean }) {
  const xs = [26, 33.5, 41];
  if (snow) {
    return (
      <g fill="currentColor">
        {xs.slice(0, count).map((x, i) => (
          <circle
            key={x}
            cx={x}
            cy={49}
            r={1.9}
            className={cn('wi-snow', i === 1 && 'wi-snow-2', i === 2 && 'wi-snow-3')}
          />
        ))}
      </g>
    );
  }
  return (
    <g stroke="currentColor" strokeWidth={2.6} strokeLinecap="round">
      {xs.slice(0, count).map((x, i) => (
        <line
          key={x}
          x1={x}
          y1={48}
          x2={x - 2}
          y2={54}
          className={cn('wi-drop', i === 1 && 'wi-drop-2', i === 2 && 'wi-drop-3')}
        />
      ))}
    </g>
  );
}

/**
 * Bespoke animated condition icon set — stroke-based, lucide-consistent,
 * with subtle looping animation per condition.
 */
export function WeatherIcon({ condition, isDay, size = 64, className }: WeatherIconProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role="img"
      aria-hidden="true"
      focusable="false"
      className={cn('shrink-0 text-surface', className)}
    >
      {condition === 'clear' && (isDay ? <Sun /> : <Moon />)}

      {condition === 'partly-cloudy' && (
        <>
          {isDay ? (
            <Sun cx={24} cy={22} r={7.5} />
          ) : (
            <Moon cx={24} cy={22} r={8.5} />
          )}
          <Cloud transform="translate(7 9) scale(0.92)" />
        </>
      )}

      {condition === 'cloudy' && (
        <>
          <Cloud transform="translate(15 2) scale(0.62)" opacity={0.5} />
          <Cloud />
        </>
      )}

      {condition === 'fog' && (
        <>
          <Cloud transform="translate(0 -6)" />
          <g stroke="currentColor" strokeWidth={3} strokeLinecap="round">
            <line x1={19} y1={48} x2={45} y2={48} className="wi-drift" />
            <line x1={24} y1={55} x2={40} y2={55} className="wi-drift wi-drift-2" />
          </g>
        </>
      )}

      {condition === 'drizzle' && (
        <>
          <Cloud transform="translate(0 -4)" />
          <Drops count={2} />
        </>
      )}

      {condition === 'rain' && (
        <>
          <Cloud transform="translate(0 -4)" />
          <Drops count={3} />
        </>
      )}

      {condition === 'snow' && (
        <>
          <Cloud transform="translate(0 -4)" />
          <Drops count={3} snow />
        </>
      )}

      {condition === 'thunder' && (
        <>
          <Cloud transform="translate(0 -6)" />
          <path
            d="M33.5 40 L38.5 40 L34.5 47.5 L38.5 47.5 L28.5 58 L32.5 49 L28.5 49 Z"
            fill={SUN_FILL}
            className="wi-flash"
          />
          <g stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" opacity={0.75}>
            <line x1={23} y1={46} x2={21.5} y2={51} className="wi-drop wi-drop-2" />
            <line x1={43} y1={46} x2={41.5} y2={51} className="wi-drop wi-drop-3" />
          </g>
        </>
      )}
    </svg>
  );
}
