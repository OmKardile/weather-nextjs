'use client';

import type { JSX } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Glass } from '@/components/glass/Glass';
import { Icon } from '@/components/icons/Icon';
import type { ThemeMode } from '@/hooks/use-preferences';
import type { Units } from '@/types/weather';
import { cn } from '@/lib/utils';

/* ================================================================== */
/* Settings — units, appearance (auto/light/dark), AI note + credits.  */
/* SettingsContent is shared by the desktop dialog and the mobile tab. */
/* ================================================================== */

interface SettingsContentProps {
  units: Units;
  onSetUnits: (units: Units) => void;
  theme: ThemeMode;
  onSetTheme: (theme: ThemeMode) => void;
  className?: string;
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}): JSX.Element {
  return (
    <div role="group" aria-label={ariaLabel} className="glass-subtle flex h-9 items-center rounded-full p-0.5">
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={active ? undefined : () => onChange(option.value)}
            className={cn(
              'focus-ring h-8 min-w-11 rounded-full px-3 text-xs font-semibold transition-all duration-200',
              active
                ? 'bg-aurora-500 text-[#04211C] shadow-[0_0_14px_-4px_rgb(34_188_160/0.8)]'
                : 'text-surface-muted hover:text-surface',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function SettingsRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3.5">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-surface">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-surface-faint">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

export function SettingsContent({
  units,
  onSetUnits,
  theme,
  onSetTheme,
  className,
}: SettingsContentProps) {
  return (
    <div className={cn('flex flex-col divide-y divide-[var(--surface-border)]', className)}>
      <SettingsRow label="Units" hint="Temperature, wind and precipitation together">
        <Segmented
          ariaLabel="Units"
          value={units}
          onChange={onSetUnits}
          options={[
            { value: 'metric', label: '°C' },
            { value: 'imperial', label: '°F' },
          ]}
        />
      </SettingsRow>

      <SettingsRow label="Appearance" hint="Auto follows the live sky scene">
        <Segmented
          ariaLabel="Appearance"
          value={theme}
          onChange={onSetTheme}
          options={[
            { value: 'auto', label: 'Auto' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
        />
      </SettingsRow>

      <div className="py-3.5">
        <p className="flex items-center gap-2 text-sm font-semibold text-surface">
          <Icon name="sparkle" size={15} className="text-aurora-400" />
          Ask AI
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-surface-muted">
          The briefing, chat and smart advice are generated on the server (Gemini) from your
          city&rsquo;s live forecast. If AI is unavailable, Aether quietly falls back to a
          rule-based summary. AI text can be imperfect — always double-check critical conditions.
        </p>
      </div>

      <div className="py-3.5">
        <p className="text-sm font-semibold text-surface">Keyboard</p>
        <p className="mt-1.5 text-xs text-surface-muted">
          <kbd className="rounded-md border border-[var(--surface-border)] bg-[var(--surface-subtle)] px-1.5 py-0.5 text-[10px] font-medium text-surface-muted">
            ⌘K
          </kbd>{' '}
          or{' '}
          <kbd className="rounded-md border border-[var(--surface-border)] bg-[var(--surface-subtle)] px-1.5 py-0.5 text-[10px] font-medium text-surface-muted">
            Ctrl K
          </kbd>{' '}
          — search cities, switch units, jump anywhere.
        </p>
      </div>

      <div className="py-3.5">
        <p className="text-xs leading-relaxed text-surface-faint">
          Aether 2.0.0 · forecast &amp; air quality by Open-Meteo (CAMS) · geocoding by
          Open-Meteo &amp; Nominatim · AI by Gemini
        </p>
      </div>
    </div>
  );
}

interface SettingsSheetProps extends SettingsContentProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsSheet({
  open,
  onOpenChange,
  units,
  onSetUnits,
  theme,
  onSetTheme,
}: SettingsSheetProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden rounded-3xl border-none bg-transparent p-0 shadow-none sm:max-w-md">
        <VisuallyHiddenTitle />
        <Glass level="overlay" className="max-h-[85dvh] overflow-y-auto scroll-slim rounded-3xl p-5 sm:p-6">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold tracking-tight text-surface">Settings</h2>
          </div>
          <SettingsContent units={units} onSetUnits={onSetUnits} theme={theme} onSetTheme={onSetTheme} />
        </Glass>
      </DialogContent>
    </Dialog>
  );
}

function VisuallyHiddenTitle() {
  return (
    <>
      <DialogTitle className="sr-only">Settings</DialogTitle>
      <DialogDescription className="sr-only">
        Units, appearance and AI preferences.
      </DialogDescription>
    </>
  );
}
