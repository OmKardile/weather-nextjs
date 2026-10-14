'use client';

import { useState } from 'react';
import type { EnsembleHourly, HourlyPoint, Units } from '@/types/weather';
import { SegmentedControl } from '@/components/glass/SegmentedControl';
import { HourlyStrip } from '@/components/weather/HourlyStrip';
import type { HourWindow } from '@/components/weather/HourlyStrip';
import { TemperatureChart } from '@/components/weather/TemperatureChart';

/* ================================================================== */
/* HourlyForecastCard — the ONE hourly card.                            */
/*                                                                     */
/* Dedup (v4.2): the hourly section used to stack the temperature      */
/* graph AND the hour-by-hour strip — the same 48 temperatures and    */
/* precipitation chances rendered twice, back to back. They are now   */
/* two views of a single card behind an inset segmented control        */
/* (flat well — no glass-on-glass):                                   */
/*   · Hours — Apple-style strip: icons, temps, precip %, UV badges,  */
/*     golden-hour underglow.                                         */
/*   · Graph — the smooth temperature curve with precip bars and the  */
/*     ensemble uncertainty band (model spread).                      */
/* The NextHourCard (minutely rain) stays its own card below — that   */
/* data exists nowhere else.                                          */
/* ================================================================== */

type HourlyView = 'hours' | 'graph';

interface HourlyForecastCardProps {
  hours: HourlyPoint[];
  units: Units;
  /** Ensemble series matched by time — feeds the graph's uncertainty band. */
  ensemble: EnsembleHourly[] | null;
  /** Golden-hour windows (today + tomorrow) to highlight the strip. */
  goldenWindows: HourWindow[];
}

export function HourlyForecastCard({
  hours,
  units,
  ensemble,
  goldenWindows,
}: HourlyForecastCardProps) {
  const [view, setView] = useState<HourlyView>('hours');

  return (
    <div className="glass fs-card rounded-[var(--radius-card)] p-4 shadow-[var(--shadow-glass)] sm:p-5">
      <div className="mb-3 flex items-center justify-end">
        <SegmentedControl
          options={[
            { id: 'hours', label: 'Hours' },
            { id: 'graph', label: 'Graph' },
          ]}
          value={view}
          onChange={setView}
          aria-label="Hourly forecast view"
          layoutKey="hourly-view"
        />
      </div>
      <div key={view} className="animate-fade-in">
        {view === 'hours' ? (
          <HourlyStrip hours={hours} units={units} goldenWindows={goldenWindows} />
        ) : (
          <TemperatureChart hours={hours} units={units} ensemble={ensemble} />
        )}
      </div>
    </div>
  );
}
