'use client';

import { Glass } from '@/components/glass/Glass';
import { Icon } from '@/components/icons/Icon';
import { cn } from '@/lib/utils';

/* ================================================================== */
/* TimeScrubber — bottom glass bar.                                    */
/* Radar mode: past-frame stepper + play/pause (~500 ms).              */
/* Precip/temp mode: hour slider 0–47 + play/pause (~800 ms) +         */
/* Now/+3h/+24h quick chips. Keyboard arrows step via native input.    */
/* ================================================================== */

export interface TimeScrubberProps {
  showRadar: boolean;
  radarIndex: number;
  radarTotal: number;
  radarTimeLabel: string | null;
  radarHiddenByZoom: boolean;
  radarPlaying: boolean;
  onRadarIndex: (index: number) => void;
  onRadarPlaying: (playing: boolean) => void;
  showHour: boolean;
  hour: number;
  hourPlaying: boolean;
  onHour: (hour: number) => void;
  onHourPlaying: (playing: boolean) => void;
}

function PlayPauseButton({
  playing,
  onToggle,
  label,
}: {
  playing: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={playing ? `Pause ${label}` : `Play ${label}`}
      aria-pressed={playing}
      className={cn(
        'glass-subtle focus-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-200',
        playing
          ? 'border-aurora-500/50 bg-aurora-500/15 text-aurora-400'
          : 'text-surface-muted hover:text-surface',
      )}
    >
      <Icon name={playing ? 'pause' : 'play'} size={16} />
    </button>
  );
}

export function TimeScrubber(props: TimeScrubberProps) {
  const {
    showRadar,
    radarIndex,
    radarTotal,
    radarTimeLabel,
    radarHiddenByZoom,
    radarPlaying,
    onRadarIndex,
    onRadarPlaying,
    showHour,
    hour,
    hourPlaying,
    onHour,
    onHourPlaying,
  } = props;

  if (!showRadar && !showHour) return null;

  return (
    <Glass
      level="raised"
      role="group"
      aria-label="Map time controls"
      className="absolute inset-x-3 bottom-3 z-20 rounded-3xl p-3 lg:inset-x-auto lg:left-1/2 lg:w-[min(560px,calc(100vw-14rem))] lg:-translate-x-1/2"
    >
      <div className="flex flex-col gap-3">
        {showRadar && (
          <div className="flex items-center gap-2">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-surface-faint">
                Radar · Past 2h
              </span>
              <span className="tnum truncate text-[13px] font-semibold text-surface">
                {radarHiddenByZoom
                  ? 'Zoom out past z7 to see radar'
                  : (radarTimeLabel ?? 'Loading frames…')}
              </span>
            </span>
            <button
              type="button"
              disabled={radarIndex <= 0}
              onClick={() => onRadarIndex(Math.max(0, radarIndex - 1))}
              aria-label="Previous radar frame"
              className="glass-subtle focus-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-surface-muted transition-colors duration-200 hover:text-surface disabled:opacity-40"
            >
              <Icon name="chevron-left" size={16} />
            </button>
            <span className="tnum w-12 shrink-0 text-center text-xs font-semibold text-surface-muted">
              {radarTotal > 0 ? `${radarIndex + 1}/${radarTotal}` : '–'}
            </span>
            <button
              type="button"
              disabled={radarIndex >= radarTotal - 1}
              onClick={() => onRadarIndex(Math.min(radarTotal - 1, radarIndex + 1))}
              aria-label="Next radar frame"
              className="glass-subtle focus-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-surface-muted transition-colors duration-200 hover:text-surface disabled:opacity-40"
            >
              <Icon name="chevron-right" size={16} />
            </button>
            <PlayPauseButton
              playing={radarPlaying}
              onToggle={() => onRadarPlaying(!radarPlaying)}
              label="radar frames"
            />
          </div>
        )}

        {showHour && (
          <div className="flex items-center gap-2">
            <span className="flex w-20 shrink-0 flex-col">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-surface-faint">
                Forecast
              </span>
              <span className="tnum text-[13px] font-semibold text-surface">
                {hour === 0 ? 'Now' : `+${hour}h`}
              </span>
            </span>
            <input
              type="range"
              min={0}
              max={47}
              step={1}
              value={hour}
              onChange={(event) => onHour(Number(event.target.value))}
              aria-label="Forecast hour, 0 now to 47 hours ahead"
              className="h-9 min-w-0 flex-1 cursor-pointer accent-aurora-400"
            />
            <div className="flex shrink-0 items-center gap-1">
              {[
                { label: 'Now', value: 0 },
                { label: '+3h', value: 3 },
                { label: '+24h', value: 24 },
              ].map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  aria-pressed={hour === chip.value}
                  onClick={() => onHour(chip.value)}
                  className={cn(
                    'focus-ring tnum hidden h-8 rounded-full px-2.5 text-[11px] font-semibold transition-all duration-200 sm:block',
                    hour === chip.value
                      ? 'bg-aurora-500/20 text-aurora-300 ring-1 ring-inset ring-aurora-500/40'
                      : 'glass-subtle text-surface-muted hover:text-surface',
                  )}
                >
                  {chip.label}
                </button>
              ))}
              <PlayPauseButton
                playing={hourPlaying}
                onToggle={() => onHourPlaying(!hourPlaying)}
                label="forecast hours"
              />
            </div>
          </div>
        )}
      </div>
    </Glass>
  );
}
