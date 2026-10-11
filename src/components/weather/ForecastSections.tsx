'use client';

import type { JSX, ReactNode } from 'react';
import { AirQualityCard } from '@/components/weather/AirQualityCard';
import { AdvisorCards } from '@/components/ai/AdvisorCards';
import { DailyForecast } from '@/components/weather/DailyForecast';
import { HourlyStrip } from '@/components/weather/HourlyStrip';
import { MetricGrid } from '@/components/weather/MetricGrid';
import { MoonPhaseCard } from '@/components/weather/MoonPhaseCard';
import { TemperatureChart } from '@/components/weather/TemperatureChart';
import type { City, Units, WeatherBundle } from '@/types/weather';

/* ================================================================== */
/* ForecastSections — the shared forecast content: rendered in the     */
/* desktop main column AND inside the mobile snap-point drawer.        */
/* Section ids (hourly / daily / air / details / advisor) are the      */
/* ⌘K "Jump to" targets.                                               */
/* ================================================================== */

interface ForecastSectionsProps {
  city: City;
  bundle: WeatherBundle;
  units: Units;
}

function Section({
  id,
  title,
  children,
  className,
}: {
  id: string;
  title: string;
  children: ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className={className}>
      <h2
        id={`${id}-heading`}
        className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-surface-muted"
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

export function ForecastSections({ city, bundle, units }: ForecastSectionsProps) {
  return (
    <>
      <Section id="hourly" title="Next 48 hours">
        <div className="glass rounded-[var(--radius-card)] p-4 shadow-[var(--shadow-glass)] sm:p-5">
          <TemperatureChart hours={bundle.hourly.slice(0, 24)} units={units} />
        </div>
        <div className="mt-3">
          <HourlyStrip hours={bundle.hourly} units={units} />
        </div>
      </Section>

      <div className="grid gap-5 sm:gap-6 lg:grid-cols-5">
        <Section id="daily" title="7-day forecast" className="lg:col-span-3">
          <div className="glass rounded-[var(--radius-card)] p-2 shadow-[var(--shadow-glass)] sm:p-4">
            <DailyForecast days={bundle.daily} units={units} />
          </div>
        </Section>
        <Section id="air" title="Air quality" className="lg:col-span-2">
          <AirQualityCard air={bundle.airQuality} />
        </Section>
      </div>

      <Section id="details" title="Details">
        <MetricGrid data={bundle} units={units} />
        <div className="mt-4 sm:max-w-sm">
          <MoonPhaseCard bundle={bundle} />
        </div>
      </Section>

      <Section id="advisor" title="Smart advisor">
        <AdvisorCards city={city} units={units} />
      </Section>
    </>
  );
}
