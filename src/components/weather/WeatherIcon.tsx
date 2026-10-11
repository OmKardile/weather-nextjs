'use client';

import { Icon } from '@/components/icons/Icon';
import type { WeatherIconName } from '@/components/icons/Icon';
import type { Condition } from '@/types/weather';

interface WeatherIconProps {
  condition: Condition;
  isDay: boolean;
  /** Pixel size (square). */
  size?: number;
  className?: string;
}

const MAP: Record<Condition, (isDay: boolean) => WeatherIconName> = {
  clear: (isDay) => (isDay ? 'sun' : 'moon'),
  'partly-cloudy': (isDay) => (isDay ? 'partly-cloudy-day' : 'partly-cloudy-night'),
  cloudy: () => 'cloudy',
  fog: () => 'fog',
  drizzle: () => 'drizzle',
  rain: () => 'rain',
  snow: () => 'snow',
  thunder: () => 'thunder',
};

/**
 * Compat wrapper — keeps the v1 API surface (`condition` + `isDay`) while
 * delegating to the unified animated icon system.
 */
export function WeatherIcon({ condition, isDay, size = 64, className }: WeatherIconProps) {
  return <Icon name={MAP[condition](isDay)} size={size} className={className} />;
}
