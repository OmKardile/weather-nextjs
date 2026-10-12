'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import type { CSSProperties, JSX } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Glass } from '@/components/glass/Glass';
import { Icon } from '@/components/icons/Icon';
import { useEditMode } from '@/hooks/use-edit-mode';
import { usePreferences } from '@/hooks/use-preferences';
import type { Density } from '@/hooks/use-preferences';
import { requestTiltPermission } from '@/hooks/use-tilt-glow';
import { toggleAmbientSound } from '@/hooks/use-ambient-sound';
import { useAchievements } from '@/hooks/use-achievements';
import { ACHIEVEMENTS } from '@/lib/achievements';
import { SECTION_TITLES } from '@/lib/sections';
import type { SectionId } from '@/lib/sections';
import { AI_VOICE_OPTIONS } from '@/types/ai';
import type { AiVoiceId } from '@/types/ai';
import type { Units } from '@/types/weather';
import { cn } from '@/lib/utils';

/* ================================================================== */
/* Settings — units, cards, AI voice, AI note + credits.               */
/* SettingsContent is shared by the desktop dialog and the mobile tab. */
/* The interface theme itself is not a setting: it follows the live    */
/* sky at the selected city (dawn/day/dusk/night re-skin everything).  */
/* ================================================================== */

interface SettingsContentProps {
  units: Units;
  onSetUnits: (units: Units) => void;
  /** Called when the user activates card edit mode (navigates to the cards). */
  onCustomize?: () => void;
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

const emptySubscribe = () => () => {};

/** True once hydrated on the client (server render sees false). */
function useHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

/* ------------------------------------------------------------------ */
/* Liquid Glass — transparency slider + Reduce bright effects.         */
/* Ultra Clear (0) → Fully Tinted (100): drives tint alpha, blur       */
/* radius, refraction strength and rim brightness across every glass   */
/* control and card. Honors prefers-reduced-transparency (forced to    */
/* fully tinted — the slider shows the locked state).                  */
/* ------------------------------------------------------------------ */

function GlassTransparencyControl(): JSX.Element {
  const hydrated = useHydrated();
  const transparency = usePreferences((s) => s.glassTransparency);
  const setTransparency = usePreferences((s) => s.setGlassTransparency);
  const [reducedTransparency, setReducedTransparency] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-transparency: reduce)');
    const update = () => setReducedTransparency(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  const value = reducedTransparency ? 100 : hydrated ? transparency : 0;

  return (
    <div className="w-full max-w-64">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-medium text-surface-faint">Ultra clear</span>
        <span
          className="tnum rounded-full bg-[var(--surface-subtle)] px-2 py-0.5 text-[11px] font-semibold text-surface-muted"
          aria-live="polite"
        >
          {reducedTransparency ? 'Reduced transparency on' : `${value}%`}
        </span>
        <span className="text-[11px] font-medium text-surface-faint">Fully tinted</span>
      </div>
      <Slider
        value={[value]}
        onValueChange={([next]: number[]) => setTransparency(next)}
        min={0}
        max={100}
        step={1}
        aria-label="Liquid Glass transparency"
        disabled={reducedTransparency}
        className="mt-2.5"
      />
    </div>
  );
}

function ReduceBrightEffectsControl(): JSX.Element {
  const hydrated = useHydrated();
  const reduceBright = usePreferences((s) => s.reduceBrightEffects);
  const setReduceBright = usePreferences((s) => s.setReduceBrightEffects);

  return (
    <Switch
      checked={hydrated && reduceBright}
      onCheckedChange={setReduceBright}
      aria-label="Reduce bright effects"
    />
  );
}

/**
 * Tilt highlights — device-motion glass specular (Liquid Glass spec's
 * permission-gated mobile item). iOS 13+ requires requestPermission()
 * from a user gesture: the switch handler asks first and only enables
 * on grant; elsewhere the sensor needs no permission.
 */
function TiltGlowControl(): JSX.Element {
  const hydrated = useHydrated();
  const tiltGlow = usePreferences((s) => s.tiltGlowEnabled);
  const setTiltGlow = usePreferences((s) => s.setTiltGlowEnabled);
  const [denied, setDenied] = useState(false);

  const onCheckedChange = async (next: boolean): Promise<void> => {
    if (!next) {
      setDenied(false);
      setTiltGlow(false);
      return;
    }
    const granted = await requestTiltPermission();
    setDenied(!granted);
    setTiltGlow(granted);
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Switch
        checked={hydrated && tiltGlow}
        onCheckedChange={onCheckedChange}
        aria-label="Tilt highlights"
        disabled={!hydrated}
      />
      {denied && (
        <p role="alert" className="text-right text-[10px] leading-tight text-aurora-300">
          Motion access was denied — enable it in iOS Settings › Safari.
        </p>
      )}
    </div>
  );
}

/**
 * AI voice picker — a wrap of chips (aria-pressed, like the theme control).
 * Reads the persisted preference directly; the hydration gate keeps the SSR
 * markup on the default until the client takes over, so persisted values
 * never cause a mismatch. Tone only — the numbers never change.
 */
function VoicePicker(): JSX.Element {
  const hydrated = useHydrated();
  const aiVoice = usePreferences((s) => s.aiVoice);
  const setAiVoice = usePreferences((s) => s.setAiVoice);

  const active = hydrated ? aiVoice : 'pro';
  const activeDescription =
    AI_VOICE_OPTIONS.find((option) => option.id === active)?.description ?? '';

  return (
    <div className="flex w-full flex-col items-end gap-1.5">
      <div className="flex flex-wrap justify-end gap-1.5">
        {AI_VOICE_OPTIONS.map((option) => {
          const isActive = active === option.id;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={isActive}
              title={option.description}
              onClick={isActive ? undefined : () => setAiVoice(option.id as AiVoiceId)}
              className={cn(
                'focus-ring rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200',
                isActive
                  ? 'bg-aurora-500 text-[#04211C] shadow-[0_0_14px_-4px_rgb(34_188_160/0.8)]'
                  : 'glass-subtle text-surface-muted hover:text-surface',
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <p className="text-right text-[11px] text-surface-faint">{activeDescription}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Ambient sound — on/off pill + volume slider (both persisted).       */
/* The toggle routes through toggleAmbientSound so the AudioContext    */
/* starts inside the click gesture (autoplay rules).                   */
/* ------------------------------------------------------------------ */

function AmbientSoundControl(): JSX.Element {
  const hydrated = useHydrated();
  const enabled = usePreferences((s) => s.ambientSoundEnabled);
  const volume = usePreferences((s) => s.ambientVolume);
  const setAmbientVolume = usePreferences((s) => s.setAmbientVolume);

  const active = hydrated && enabled;
  return (
    <div className="flex flex-col items-end gap-2.5">
      <Segmented
        ariaLabel="Ambient sound"
        value={active ? 'on' : 'off'}
        onChange={() => toggleAmbientSound()}
        options={[
          { value: 'off', label: 'Off' },
          { value: 'on', label: 'On' },
        ]}
      />
      <input
        type="range"
        min={0.05}
        max={1}
        step={0.05}
        value={hydrated ? volume : 0.5}
        onChange={(event) => setAmbientVolume(Number(event.target.value))}
        aria-label="Ambient sound volume"
        className="ambient-slider"
        style={{ '--fill': `${(hydrated ? volume : 0.5) * 100}%` } as CSSProperties}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Card personalization — edit mode, hidden cards, density, accent.    */
/* ------------------------------------------------------------------ */

function CustomizeCardsControl({ onCustomize }: { onCustomize?: () => void }): JSX.Element {
  const hydrated = useHydrated();
  const editMode = useEditMode((s) => s.editMode);
  const setEditMode = useEditMode((s) => s.setEditMode);
  const active = hydrated && editMode;

  return (
    <button
      type="button"
      onClick={() => {
        setEditMode(!active);
        if (!active) onCustomize?.();
      }}
      aria-pressed={active}
      className={cn(
        'focus-ring rounded-full px-4 py-1.5 text-xs font-semibold transition-all duration-200',
        active
          ? 'bg-aurora-500 text-[#04211C] shadow-[0_0_14px_-4px_rgb(34_188_160/0.8)]'
          : 'glass-subtle text-surface-muted hover:text-surface',
      )}
    >
      {active ? 'Done' : 'Customize'}
    </button>
  );
}

function HiddenCardsControl(): JSX.Element {
  const hydrated = useHydrated();
  const hidden = usePreferences((s) => s.hiddenSections);
  const toggleSectionHidden = usePreferences((s) => s.toggleSectionHidden);
  const restoreAll = usePreferences((s) => s.restoreAllSections);

  const list: SectionId[] = hydrated ? hidden : [];
  if (list.length === 0) {
    return <span className="text-xs text-surface-faint">None hidden</span>;
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {list.map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => toggleSectionHidden(id)}
          aria-label={`Restore ${SECTION_TITLES[id]} card`}
          className="glass-subtle focus-ring flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-surface-muted transition-colors duration-200 hover:text-surface"
        >
          <Icon name="plus" size={11} />
          {SECTION_TITLES[id]}
        </button>
      ))}
      <button
        type="button"
        onClick={restoreAll}
        className="focus-ring rounded-full bg-aurora-500 px-3 py-1 text-xs font-semibold text-[#04211C] transition-transform duration-200 hover:active:scale-95"
      >
        Restore all
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Badge shelf — earned badges lit, locked ones dimmed.                */
/* ------------------------------------------------------------------ */

function BadgeShelf(): JSX.Element {
  const hydrated = useHydrated();
  const { unlocked, days } = useAchievements();

  const unlockedSet = new Set(hydrated ? unlocked : []);
  const dayCount = hydrated ? days.length : 0;

  return (
    <div className="py-3.5">
      <p className="text-sm font-semibold text-surface">Badge shelf</p>
      <p className="mt-0.5 text-xs text-surface-faint">
        {unlockedSet.size} of {ACHIEVEMENTS.length} earned · seven-day streak: {Math.min(dayCount, 7)}/7
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {ACHIEVEMENTS.map((achievement) => {
          const earned = unlockedSet.has(achievement.id);
          return (
            <div
              key={achievement.id}
              className={cn(
                'glass-subtle flex items-center gap-2.5 rounded-2xl p-3 transition-opacity duration-300',
                !earned && 'opacity-50 grayscale',
              )}
              title={earned ? achievement.description : 'Locked'}
            >
              <span
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                  earned ? 'bg-aurora-500/15 text-aurora-400' : 'bg-[var(--surface-subtle)] text-surface-faint',
                )}
              >
                <Icon name={achievement.icon} size={17} />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-xs font-semibold text-surface">
                  {achievement.title}
                </span>
                <span className="truncate text-[11px] text-surface-faint">
                  {earned ? achievement.description : 'Locked'}
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SettingsContent({
  units,
  onSetUnits,
  onCustomize,
  className,
}: SettingsContentProps) {
  const density = usePreferences((s) => s.density);
  const setDensity = usePreferences((s) => s.setDensity);

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

      <SettingsRow
        label="Appearance"
        hint="Aether themes itself from the live sky at your city — dawn, day, dusk and night. No manual dark mode."
      >
        <span className="surface-subtle inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-surface-muted">
          <Icon name="sunrise" size={13} aria-hidden="true" />
          Follows the sky
        </span>
      </SettingsRow>

      <SettingsRow
        label="Liquid Glass"
        hint="How clear the glass controls are — from ultra clear with full lensing to fully tinted."
      >
        <GlassTransparencyControl />
      </SettingsRow>

      <SettingsRow
        label="Reduce bright effects"
        hint="Turns off the pointer specular highlight and chromatic rim fringe."
      >
        <ReduceBrightEffectsControl />
      </SettingsRow>

      <SettingsRow
        label="Tilt highlights"
        hint="Glass highlights drift with your device's motion — needs motion access on iOS."
      >
        <TiltGlowControl />
      </SettingsRow>

      <SettingsRow label="Card density" hint="Comfortable spacing or a tighter fit">
        <Segmented
          ariaLabel="Card density"
          value={density}
          onChange={setDensity}
          options={[
            { value: 'comfortable' as Density, label: 'Comfortable' },
            { value: 'compact' as Density, label: 'Compact' },
          ]}
        />
      </SettingsRow>

      <SettingsRow label="Ambient sound" hint="Synthesized rain, wind and night scenes">
        <AmbientSoundControl />
      </SettingsRow>

      <SettingsRow label="Customize cards" hint="Opens your forecast cards — drag to reorder, × to hide">
        <CustomizeCardsControl onCustomize={onCustomize} />
      </SettingsRow>

      <SettingsRow label="Hidden cards" hint="Bring back cards you tucked away">
        <HiddenCardsControl />
      </SettingsRow>

      <SettingsRow label="AI voice" hint="Tone for AI text — numbers never change">
        <VoicePicker />
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

      <BadgeShelf />

      <div className="py-3.5">
        <p className="text-xs leading-relaxed text-surface-faint">
          Aether 3.2.0 · forecast &amp; air quality by Open-Meteo (CAMS) · geocoding by
          Open-Meteo &amp; Nominatim · AI by Gemini
        </p>
      </div>
    </div>
  );
}

interface SettingsSheetProps extends SettingsContentProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Runs after edit mode starts from the dialog (dialog closes itself). */
  onCustomizeCards?: () => void;
}

export function SettingsSheet({
  open,
  onOpenChange,
  units,
  onSetUnits,
  onCustomizeCards,
}: SettingsSheetProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden rounded-3xl border-none bg-transparent p-0 shadow-none sm:max-w-md">
        <VisuallyHiddenTitle />
        <Glass level="overlay" className="max-h-[85dvh] overflow-y-auto scroll-slim rounded-3xl p-5 sm:p-6">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold tracking-tight text-surface">Settings</h2>
          </div>
          <SettingsContent
            units={units}
            onSetUnits={onSetUnits}
            onCustomize={() => {
              onOpenChange(false);
              onCustomizeCards?.();
            }}
          />
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
        Units, cards, sound and AI preferences.
      </DialogDescription>
    </>
  );
}
