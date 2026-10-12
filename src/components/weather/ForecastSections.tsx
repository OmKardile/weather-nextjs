'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { JSX, ReactNode } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion, useReducedMotion } from 'framer-motion';
import { AirQualityCard } from '@/components/weather/AirQualityCard';
import { AdvisorCards } from '@/components/ai/AdvisorCards';
import { DailyForecast } from '@/components/weather/DailyForecast';
import { ForecastConfidence } from '@/components/weather/ForecastConfidence';
import { ForecastLedgerCard } from '@/components/weather/ForecastLedgerCard';
import { FreshnessPill } from '@/components/weather/FreshnessPill';
import { HourlyStrip } from '@/components/weather/HourlyStrip';
import { Icon } from '@/components/icons/Icon';
import { MetricGrid } from '@/components/weather/MetricGrid';
import { ModelCompare } from '@/components/weather/ModelCompare';
import { MoonPhaseCard } from '@/components/weather/MoonPhaseCard';
import { NextHourCard } from '@/components/weather/NextHourCard';
import { daySkyTimes } from '@/components/weather/sky/sky-time';
import { AuroraCard } from '@/components/weather/sky/AuroraCard';
import { DaylightCard } from '@/components/weather/sky/DaylightCard';
import { SkyCard } from '@/components/weather/sky/SkyCard';
import { SunSafetyCard } from '@/components/weather/SunSafetyCard';
import { TimeMachineCard } from '@/components/weather/sky/TimeMachineCard';
import { TemperatureChart } from '@/components/weather/TemperatureChart';
import { useEditMode } from '@/hooks/use-edit-mode';
import { useEnsemble } from '@/hooks/use-ensemble';
import { useModels } from '@/hooks/use-models';
import { usePreferences } from '@/hooks/use-preferences';
import { DEFAULT_SECTION_ORDER, SECTION_TITLES } from '@/lib/sections';
import type { SectionId } from '@/lib/sections';
import { getDayPhase } from '@/lib/time';
import type { City, Units, WeatherBundle } from '@/types/weather';

/* ================================================================== */
/* ForecastSections — the shared forecast content: rendered in the     */
/* desktop main column AND inside the mobile snap-point drawer.        */
/* Section ids (hourly / daily / air / models / sky / details /        */
/* timemachine / advisor) are the ⌘K "Jump to" targets.                */
/*                                                                    */
/* Personalization (Task 20-b): the wrapper carries data-density and   */
/* applies the persisted sectionOrder + hiddenSections. In edit mode  */
/* (CARROT-style) sections jiggle, grow drag handles (@dnd-kit,       */
/* handle-only) and per-section hide (×) buttons. The daily + air     */
/* pair keeps its 2-column row whenever the two end up adjacent in    */
/* the effective order; everything else stacks full-width.            */
/* ================================================================== */

interface ForecastSectionsProps {
  city: City;
  bundle: WeatherBundle;
  units: Units;
}

/** Header + body of one section (the <section> element is provided by the shell). */
function SectionBody({
  htmlFor,
  title,
  headerExtra,
  headerLeading,
  children,
}: {
  htmlFor: string;
  title: string;
  headerExtra?: ReactNode;
  headerLeading?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1.5">
          {headerLeading}
          <h2
            id={`${htmlFor}-heading`}
            className="truncate card-label"
          >
            {title}
          </h2>
        </div>
        {headerExtra}
      </div>
      {children}
    </>
  );
}

/** Plain (view-mode) shell — identical markup to the pre-personalization layout. */
function SectionShell({
  id,
  title,
  className,
  headerExtra,
  children,
}: {
  id: SectionId;
  title: string;
  className?: string;
  headerExtra?: ReactNode;
  children: ReactNode;
}): JSX.Element {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className={className} data-section-id={id}>
      <SectionBody htmlFor={id} title={title} headerExtra={headerExtra}>
        {children}
      </SectionBody>
    </section>
  );
}

/** Edit-mode shell — dnd transform on the outside, jiggle on the inside. */
function SortableSectionShell({
  id,
  title,
  className,
  headerExtra,
  children,
  onHide,
}: {
  id: SectionId;
  title: string;
  className?: string;
  headerExtra?: ReactNode;
  children: ReactNode;
  onHide: () => void;
}): JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const reducedMotion = useReducedMotion();

  const handle = (
    <button
      type="button"
      {...attributes}
      {...listeners}
      aria-label={`Reorder ${title} card`}
      title="Drag to reorder"
      // Inside the mobile forecast drawer (vaul) the whole sheet is a drag
      // surface — stop the pointerdown from bubbling so dnd-kit owns the
      // gesture instead of the sheet (data-vaul-no-drag is the belt to the
      // suspenders). dnd-kit's own listener still runs: we call it manually
      // because this override replaces the spread {...listeners} prop.
      data-vaul-no-drag=""
      onPointerDown={(event) => {
        event.stopPropagation();
        (listeners?.onPointerDown as undefined | ((e: React.PointerEvent) => void))?.(event);
      }}
      className="glass-subtle focus-ring flex h-7 w-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-full text-surface-muted active:cursor-grabbing"
    >
      <Icon name="grip" size={14} />
    </button>
  );

  const hideButton = (
    <button
      type="button"
      onClick={onHide}
      aria-label={`Hide ${title} card`}
      title="Hide card"
      data-vaul-no-drag=""
      onPointerDown={(event) => event.stopPropagation()}
      className="glass-subtle focus-ring flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-surface-muted transition-colors duration-200 hover:text-surface"
    >
      <Icon name="x" size={13} />
    </button>
  );

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 20 : undefined,
      }}
      className={className}
      data-section-id={id}
    >
      <motion.div
        animate={
          reducedMotion || isDragging ? { rotate: 0 } : { rotate: [-0.45, 0.45, -0.45] }
        }
        transition={{ duration: 0.6, repeat: Infinity, ease: 'easeInOut' }}
      >
        <section id={id} aria-labelledby={`${id}-heading`}>
          <SectionBody
            htmlFor={id}
            title={title}
            headerLeading={handle}
            headerExtra={
              <>
                {headerExtra}
                {hideButton}
              </>
            }
          >
            {children}
          </SectionBody>
        </section>
      </motion.div>
    </div>
  );
}

type RenderRow =
  | { kind: 'single'; id: SectionId }
  | { kind: 'pair'; first: SectionId; second: SectionId };

export function ForecastSections({ city, bundle, units }: ForecastSectionsProps) {
  // Shared per-coordinates queries: feed the confidence card, the model
  // comparison and the uncertainty band on the temperature chart
  // (single fetch each, shared TanStack cache).
  const ensemble = useEnsemble(city);
  const models = useModels(city);
  const forecastDays = usePreferences((state) => state.forecastDays);
  const sectionOrder = usePreferences((state) => state.sectionOrder);
  const hiddenSections = usePreferences((state) => state.hiddenSections);
  const density = usePreferences((state) => state.density);
  const setSectionOrder = usePreferences((state) => state.setSectionOrder);
  const toggleSectionHidden = usePreferences((state) => state.toggleSectionHidden);
  const restoreAllSections = usePreferences((state) => state.restoreAllSections);
  const editMode = useEditMode((state) => state.editMode);
  const setEditMode = useEditMode((state) => state.setEditMode);

  const dailyCount = Math.min(forecastDays, bundle.daily.length);

  // Golden-hour windows for today + tomorrow (the hourly strip highlights
  // the photogenic hours with a warm underglow).
  const goldenWindows = useMemo(() => {
    const windows: Array<{ start: string; end: string; label: 'Golden hour' }> = [];
    for (const day of [bundle.daily[0], bundle.daily[1]]) {
      if (!day?.sunrise || !day?.sunset) continue;
      const sky = daySkyTimes(day);
      windows.push({ ...sky.goldenMorning, label: 'Golden hour' });
      windows.push({ ...sky.goldenEvening, label: 'Golden hour' });
    }
    return windows;
  }, [bundle.daily]);

  // Both optional cards fail silently — hide the whole section when
  // neither can render anything (still shown while pending).
  const showModelsSection =
    (ensemble.isPending || (ensemble.data?.hourly.length ?? 0) > 0) ||
    (models.isPending || (models.data?.models.length ?? 0) > 0);

  // Stargazer signal: this instance's sky section entering the viewport
  // at night dispatches one custom event (the achievements observer in
  // AetherApp listens). Refs keep the observer stable across renders.
  const containerRef = useRef<HTMLDivElement>(null);
  const dayPhase = getDayPhase({
    isDay: bundle.current.isDay,
    sunrise: bundle.daily[0]?.sunrise ?? '',
    sunset: bundle.daily[0]?.sunset ?? '',
    utcOffsetSeconds: bundle.utcOffsetSeconds,
  });
  const phaseRef = useRef(dayPhase);
  useEffect(() => {
    phaseRef.current = dayPhase;
  }, [dayPhase]);

  // Effective render list: persisted order minus hidden minus unavailable.
  const hiddenSet = useMemo(() => new Set(hiddenSections), [hiddenSections]);
  const visibleIds = useMemo(
    () =>
      sectionOrder.filter(
        (id) => !hiddenSet.has(id) && (id !== 'models' || showModelsSection),
      ),
    [sectionOrder, hiddenSet, showModelsSection],
  );

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const container = containerRef.current;
    if (!container) return;
    const skyEl = container.querySelector('[data-section-id="sky"]');
    if (!(skyEl instanceof Element)) return;
    let notified = false;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !notified && phaseRef.current === 'night') {
            notified = true;
            window.dispatchEvent(
              new CustomEvent('aether:achievement', { detail: { kind: 'sky-night' } }),
            );
            observer.disconnect();
          }
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(skyEl);
    return () => observer.disconnect();
  }, [visibleIds]);

  // Group the ordered list into rows; daily + air keep their 2-column row
  // whenever they land adjacent (either order), everything else is full-width.
  const rows = useMemo<RenderRow[]>(() => {
    const result: RenderRow[] = [];
    for (let i = 0; i < visibleIds.length; i += 1) {
      const id = visibleIds[i];
      const next = visibleIds[i + 1];
      const pair =
        (id === 'daily' && next === 'air') || (id === 'air' && next === 'daily');
      if (pair && next) {
        result.push({ kind: 'pair', first: id, second: next });
        i += 1;
      } else {
        result.push({ kind: 'single', id });
      }
    }
    return result;
  }, [visibleIds]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sectionOrder.indexOf(active.id as SectionId);
    const newIndex = sectionOrder.indexOf(over.id as SectionId);
    if (oldIndex < 0 || newIndex < 0) return;
    setSectionOrder(arrayMove(sectionOrder, oldIndex, newIndex));
  };

  const renderSection = (id: SectionId, className?: string): JSX.Element => {
    const title =
      id === 'daily' ? `${dailyCount}-day forecast` : SECTION_TITLES[id];
    const headerExtra =
      id === 'hourly' ? <FreshnessPill fetchedAt={bundle.fetchedAt} /> : undefined;

    const body = (() => {
      switch (id) {
        case 'hourly':
          return (
            <>
              <div className="glass fs-card rounded-[var(--radius-card)] p-4 shadow-[var(--shadow-glass)] sm:p-5">
                <TemperatureChart
                  hours={bundle.hourly}
                  units={units}
                  ensemble={ensemble.data?.hourly ?? null}
                />
              </div>
              <div className="fs-stack mt-3">
                <HourlyStrip hours={bundle.hourly} units={units} goldenWindows={goldenWindows} />
              </div>
              <div className="fs-stack mt-3">
                <NextHourCard minutely={bundle.minutely} units={units} />
              </div>
            </>
          );
        case 'daily':
          return (
            <div className="glass fs-card rounded-[var(--radius-card)] p-2 shadow-[var(--shadow-glass)] sm:p-4">
              <DailyForecast
                days={bundle.daily}
                units={units}
                currentTempC={bundle.current.temperature}
              />
            </div>
          );
        case 'air':
          return <AirQualityCard bundle={bundle} units={units} />;
        case 'models':
          return (
            <div className="fs-grid grid gap-5 sm:gap-6 lg:grid-cols-5">
              <div className="lg:col-span-2">
                <ForecastConfidence bundle={bundle} units={units} query={ensemble} />
              </div>
              <div className="lg:col-span-3">
                <ModelCompare units={units} query={models} />
              </div>
            </div>
          );
        case 'ledger':
          return <ForecastLedgerCard city={city} bundle={bundle} units={units} />;
        case 'sky':
          return (
            <>
              {/* grid-cols-1 base (not just lg:grid-cols-5): below lg an implicit
                  auto track would size to the moon strip's max-content and blow
                  past the viewport; an fr track lets the strip scroll inside. */}
              <div className="fs-grid grid grid-cols-1 gap-5 sm:gap-6 lg:grid-cols-5">
                <div className="min-w-0 lg:col-span-3">
                  <SkyCard bundle={bundle} units={units} />
                </div>
                <div className="min-w-0 lg:col-span-2">
                  <AuroraCard city={city} bundle={bundle} units={units} />
                </div>
              </div>
              <div className="fs-stack mt-5">
                <DaylightCard city={city} bundle={bundle} units={units} />
              </div>
            </>
          );
        case 'details':
          return (
            <>
              <MetricGrid data={bundle} units={units} city={city} />
              <div className="fs-stack mt-4">
                <SunSafetyCard bundle={bundle} units={units} />
              </div>
              <div className="fs-stack mt-4 sm:max-w-sm">
                <MoonPhaseCard bundle={bundle} />
              </div>
            </>
          );
        case 'timemachine':
          return <TimeMachineCard city={city} bundle={bundle} units={units} />;
        case 'advisor':
          return <AdvisorCards city={city} units={units} />;
        default:
          return null;
      }
    })();

    if (editMode) {
      return (
        <SortableSectionShell
          key={id}
          id={id}
          title={title}
          className={className}
          headerExtra={headerExtra}
          onHide={() => toggleSectionHidden(id)}
        >
          {body}
        </SortableSectionShell>
      );
    }

    return (
      <SectionShell key={id} id={id} title={title} className={className} headerExtra={headerExtra}>
        {body}
      </SectionShell>
    );
  };

  return (
    <div ref={containerRef} data-density={density} className="fs-sections flex flex-col gap-5">
      {/* Edit-mode header: enter button, or the toolbar + Done while editing. */}
      {editMode ? (
        <div
          className="glass-subtle flex flex-wrap items-center justify-between gap-3 rounded-full px-4 py-2"
          data-vaul-no-drag=""
        >
          <p className="text-xs font-medium text-surface-muted">
            Drag the handles to reorder · × hides a card
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSectionOrder([...DEFAULT_SECTION_ORDER])}
              className="glass-subtle focus-ring rounded-full px-4 py-1.5 text-xs font-semibold text-surface-muted transition-colors duration-200 hover:text-surface"
            >
              Reset order
            </button>
            <button
              type="button"
              onClick={() => setEditMode(false)}
              className="focus-ring rounded-full bg-aurora-500 px-4 py-1.5 text-xs font-semibold text-[#04211C] shadow-[0_0_14px_-4px_rgb(34_188_160/0.8)] transition-transform duration-200 hover:active:scale-95"
            >
              Done
            </button>
          </div>
        </div>
      ) : (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setEditMode(true)}
            aria-label="Customize cards"
            title="Customize cards"
            className="glass-subtle focus-ring flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-surface-muted transition-colors duration-200 hover:text-surface"
          >
            <Icon name="grip" size={13} />
            Customize
          </button>
        </div>
      )}

      {visibleIds.length === 0 ? (
        <div className="glass rounded-[var(--radius-card)] p-8 text-center">
          <p className="text-sm font-semibold text-surface">All cards are hidden</p>
          <p className="mt-1 text-xs leading-relaxed text-surface-muted">
            Restore cards from Settings → Hidden cards, or right here.
          </p>
          <button
            type="button"
            onClick={restoreAllSections}
            className="focus-ring mt-4 rounded-full bg-aurora-500 px-4 py-1.5 text-xs font-semibold text-[#04211C] transition-transform duration-200 hover:active:scale-95"
          >
            Restore all cards
          </button>
        </div>
      ) : editMode ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={visibleIds} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-5">
              {rows.map((row) =>
                row.kind === 'pair' ? (
                  <div
                    key={`${row.first}-${row.second}`}
                    className="fs-grid grid gap-5 sm:gap-6 lg:grid-cols-5"
                  >
                    {renderSection(row.first, 'lg:col-span-3')}
                    {renderSection(row.second, 'lg:col-span-2')}
                  </div>
                ) : (
                  <div key={row.id} className="flex flex-col">
                    {renderSection(row.id)}
                  </div>
                ),
              )}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        rows.map((row) =>
          row.kind === 'pair' ? (
            <div
              key={`${row.first}-${row.second}`}
              className="fs-grid grid gap-5 sm:gap-6 lg:grid-cols-5"
            >
              {renderSection(row.first, 'lg:col-span-3')}
              {renderSection(row.second, 'lg:col-span-2')}
            </div>
          ) : (
            renderSection(row.id)
          ),
        )
      )}
    </div>
  );
}
