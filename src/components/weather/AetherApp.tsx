'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { UIEvent } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useGeolocation } from '@/hooks/use-geolocation';
import { usePreferences } from '@/hooks/use-preferences';
import { useWeather } from '@/hooks/use-weather';
import { getScene } from '@/lib/scenes';
import { getDayPhase } from '@/lib/time';
import type { City, Condition, DayPhase } from '@/types/weather';
import { Glass } from '@/components/glass/Glass';
import { Icon } from '@/components/icons/Icon';
import { AlertDigest } from '@/components/ai/AlertDigest';
import { AskAIPanel } from '@/components/ai/AskAIPanel';
import { BriefingCard } from '@/components/ai/BriefingCard';
import { CitiesSidebar } from '@/components/layout/CitiesSidebar';
import { CommandPalette } from '@/components/layout/CommandPalette';
import { DRAWER_SNAPS, ForecastDrawer } from '@/components/layout/ForecastDrawer';
import { MenuBar } from '@/components/layout/MenuBar';
import { MobileDock } from '@/components/layout/MobileDock';
import type { DockTab } from '@/components/layout/MobileDock';
import { SettingsContent, SettingsSheet } from '@/components/layout/SettingsSheet';
import { WeatherScene } from '@/components/weather/WeatherScene';
import { CurrentWeather } from '@/components/weather/CurrentWeather';
import { ForecastSections } from '@/components/weather/ForecastSections';
import { SavedCities } from '@/components/weather/SavedCities';
import { EmptyState, ErrorState, LoadingSkeletons, OfflineBanner } from '@/components/weather/StateViews';
import { SiteFooter } from '@/components/weather/SiteFooter';

const CONDITIONS: Condition[] = [
  'clear', 'partly-cloudy', 'cloudy', 'fog', 'drizzle', 'rain', 'snow', 'thunder',
];
const PHASES: DayPhase[] = ['night', 'dawn', 'day', 'dusk'];

export function AetherApp() {
  const [mounted, setMounted] = useState(false);
  const [activeCity, setActiveCity] = useState<City | null>(null);
  const [online, setOnline] = useState(true);
  const [sceneOverride, setSceneOverride] = useState<{
    condition: Condition;
    phase: DayPhase;
  } | null>(null);

  // v2 shell state
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [dockTab, setDockTab] = useState<DockTab>('today');
  const [scrolled, setScrolled] = useState(false);
  const [drawerSnap, setDrawerSnap] = useState<number>(DRAWER_SNAPS[0]);

  const restoredRef = useRef(false);
  const mainScrollRef = useRef<HTMLElement | null>(null);

  const { toast } = useToast();
  const geolocation = useGeolocation();
  const units = usePreferences((state) => state.units);
  const theme = usePreferences((state) => state.theme);
  const savedCities = usePreferences((state) => state.savedCities);
  const lastCity = usePreferences((state) => state.lastCity);
  const { setUnits, toggleUnits, setTheme, saveCity, removeCity, setLastCity } =
    usePreferences.getState();

  const weather = useWeather(activeCity);
  const bundle = weather.data ?? null;

  // Hydration-safe mount + restore the last visited city once.
  useEffect(() => {
    setMounted(true);
  }, []);
  useEffect(() => {
    if (mounted && !restoredRef.current) {
      restoredRef.current = true;
      if (lastCity) setActiveCity(lastCity);
    }
  }, [mounted, lastCity]);

  // Debug/QA scene override: ?scene=rain&phase=night
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sceneParam = params.get('scene');
    const phaseParam = params.get('phase');
    if (sceneParam && CONDITIONS.includes(sceneParam as Condition)) {
      const phase =
        phaseParam && PHASES.includes(phaseParam as DayPhase) ? (phaseParam as DayPhase) : 'day';
      setSceneOverride({ condition: sceneParam as Condition, phase });
    }
  }, []);

  // Online/offline awareness.
  useEffect(() => {
    setOnline(navigator.onLine);
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // ⌘K / Ctrl+K — Spotlight.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Reset transient shell state on navigation-ish changes.
  useEffect(() => {
    setDrawerSnap(DRAWER_SNAPS[0]);
    setScrolled(false);
  }, [dockTab, activeCity?.id]);

  // Mobile: the page scrolls on the window — drive the compact menu bar from it.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 140);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const dayPhase = useMemo(() => {
    if (!bundle) return 'day' as DayPhase;
    const today = bundle.daily[0];
    return getDayPhase({
      isDay: bundle.current.isDay,
      sunrise: today?.sunrise ?? '',
      sunset: today?.sunset ?? '',
      utcOffsetSeconds: bundle.utcOffsetSeconds,
    });
  }, [bundle]);

  const scene = useMemo(
    () =>
      sceneOverride
        ? getScene(sceneOverride.condition, sceneOverride.phase)
        : getScene(bundle?.current.condition ?? 'clear', dayPhase),
    [bundle, dayPhase, sceneOverride],
  );

  // Auto follows the scene; manual picks force the surface tokens.
  const surfaceMode = theme === 'auto' ? scene.surface : theme;
  const tint = sceneOverride?.condition ?? bundle?.current.condition ?? 'clear';

  // Keep the page background in sync with the scene (overscroll areas).
  useEffect(() => {
    document.body.style.backgroundColor = scene.gradient[1];
    return () => {
      document.body.style.backgroundColor = '';
    };
  }, [scene]);

  const selectCity = useCallback(
    (city: City) => {
      setActiveCity(city);
      setLastCity(city);
      setPaletteOpen(false);
      setDockTab('today');
      mainScrollRef.current?.scrollTo({ top: 0 });
      window.scrollTo({ top: 0 });
    },
    [setLastCity],
  );

  const handleLocate = useCallback(async () => {
    const result = await geolocation.locate();
    if (result.city) {
      selectCity(result.city);
      toast({
        title: 'Located',
        description: `Showing the weather for ${result.city.name}${result.city.country ? `, ${result.city.country}` : ''}.`,
      });
    } else if (result.error) {
      toast({
        variant: 'destructive',
        title: 'Location unavailable',
        description: result.error,
      });
    }
  }, [geolocation, selectCity, toast]);

  const isSaved = activeCity != null && savedCities.some((c) => c.id === activeCity.id);

  const handleToggleSave = useCallback(() => {
    if (!activeCity) return;
    if (isSaved) {
      removeCity(activeCity.id);
      toast({ title: 'Removed', description: `${activeCity.name} was removed from saved cities.` });
    } else {
      saveCity(activeCity);
      toast({ title: 'Saved', description: `${activeCity.name} pinned for quick access.` });
    }
  }, [activeCity, isSaved, removeCity, saveCity, toast]);

  const handleMainScroll = useCallback((event: UIEvent<HTMLElement>) => {
    setScrolled(event.currentTarget.scrollTop > 120);
  }, []);
  const scrollToSection = useCallback((sectionId: string) => {
    const isDesktop = window.matchMedia('(min-width: 1024px)').matches;
    if (isDesktop) {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    setDockTab('today');
    setDrawerSnap(DRAWER_SNAPS[2]);
    window.setTimeout(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 380);
  }, []);

  const handleAskAi = useCallback(() => {
    if (window.matchMedia('(min-width: 1024px)').matches) {
      setAiOpen((open) => !open);
    } else {
      setDockTab('ai');
    }
  }, []);

  const statusText = !mounted
    ? ''
    : !activeCity
      ? 'Search for a city to see the forecast.'
      : weather.isError && !bundle
        ? `Could not load weather for ${activeCity.name}.`
        : weather.isPending
          ? `Loading weather for ${activeCity.name}.`
          : bundle
            ? `Weather for ${activeCity.name} loaded.`
            : '';

  const locating = geolocation.status === 'locating';

  // Shared loading / empty / error views (both breakpoints).
  const stateViews =
    !mounted || (activeCity && weather.isPending && !bundle) ? (
      <LoadingSkeletons />
    ) : !activeCity ? (
      <EmptyState onSelect={selectCity} onLocate={handleLocate} locating={locating} />
    ) : weather.isError && !bundle ? (
      <ErrorState message={weather.error?.message} onRetry={() => weather.refetch()} />
    ) : null;

  return (
    <div
      data-surface={surfaceMode}
      data-tint={tint}
      className="relative flex min-h-screen flex-col lg:h-screen lg:min-h-0 lg:overflow-hidden"
    >
      <WeatherScene scene={scene} />

      {!online && <OfflineBanner />}

      <MenuBar
        city={activeCity}
        bundle={bundle}
        units={units}
        scrolled={scrolled}
        aiOpen={aiOpen}
        locating={locating}
        onToggleUnits={toggleUnits}
        onOpenPalette={() => setPaletteOpen(true)}
        onToggleAi={handleAskAi}
        onOpenSettings={() => setSettingsOpen(true)}
        onLocate={handleLocate}
      />

      <div className="relative flex min-h-0 flex-1 lg:overflow-hidden">
        <CitiesSidebar
          cities={savedCities}
          activeCity={activeCity}
          units={units}
          onSelect={selectCity}
          onRemove={removeCity}
          onLocate={handleLocate}
          locating={locating}
          onAddCity={() => setPaletteOpen(true)}
        />

        <main
          ref={mainScrollRef}
          onScroll={handleMainScroll}
          id="main-scroll"
          className="scroll-slim min-w-0 flex-1 lg:overflow-y-auto"
        >
          {/* ---------------- Mobile (< lg) ---------------- */}
          <div className="flex flex-col px-4 pb-44 pt-4 lg:hidden">
            {dockTab === 'today' &&
              (stateViews ?? (
                <>
                  {activeCity && bundle ? (
                    <>
                      <CurrentWeather
                        city={activeCity}
                        data={bundle}
                        units={units}
                        isSaved={isSaved}
                        onToggleSave={handleToggleSave}
                        onRefresh={() => weather.refetch()}
                        refreshing={weather.isFetching}
                      />
                      <div className="mt-4">
                        <BriefingCard city={activeCity} units={units} />
                      </div>
                      <div className="mt-4">
                        <AlertDigest city={activeCity} units={units} />
                      </div>
                    </>
                  ) : null}
                </>
              ))}

            {dockTab === 'cities' && (
              <div className="flex flex-col gap-4">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-surface-muted">
                  Saved cities
                </h2>
                <SavedCities
                  cities={savedCities}
                  activeCity={activeCity}
                  units={units}
                  onSelect={selectCity}
                  onRemove={removeCity}
                  onSaveCurrent={handleToggleSave}
                  canSaveCurrent={activeCity != null && !isSaved && activeCity.source !== 'location'}
                />
                {savedCities.length === 0 && (
                  <p className="text-sm leading-relaxed text-surface-faint">
                    Nothing saved yet — tap the search button up top to find your cities.
                  </p>
                )}
                <SiteFooter />
              </div>
            )}

            {dockTab === 'ai' && (
              <div className="flex h-[calc(100dvh-12rem)] min-h-0 flex-col">
                <AskAIPanel city={activeCity} units={units} bundle={bundle} className="flex-1" />
              </div>
            )}

            {dockTab === 'settings' && (
              <Glass level="base" className="mt-1 rounded-3xl p-5">
                <h2 className="mb-1 font-display text-lg font-bold tracking-tight text-surface">
                  Settings
                </h2>
                <SettingsContent
                  units={units}
                  onSetUnits={setUnits}
                  theme={theme}
                  onSetTheme={setTheme}
                />
              </Glass>
            )}
          </div>

          {/* ---------------- Desktop (lg+) ---------------- */}
          <div className="mx-auto hidden min-h-full w-full max-w-3xl flex-col gap-5 px-6 pb-10 pt-6 lg:flex">
            {stateViews ?? (
              <>
                {activeCity && bundle ? (
                  <>
                    <CurrentWeather
                      city={activeCity}
                      data={bundle}
                      units={units}
                      isSaved={isSaved}
                      onToggleSave={handleToggleSave}
                      onRefresh={() => weather.refetch()}
                      refreshing={weather.isFetching}
                    />
                    <BriefingCard city={activeCity} units={units} />
                    <AlertDigest city={activeCity} units={units} />
                    <ForecastSections city={activeCity} bundle={bundle} units={units} />
                  </>
                ) : null}
              </>
            )}
            <SiteFooter />
          </div>
        </main>

        {/* AI inspector — floating overlay below xl, third column at xl+ */}
        {aiOpen && (
          <aside
            aria-label="Ask AI"
            className="fixed inset-y-0 right-0 z-40 w-[92vw] max-w-[400px] p-2 pt-[60px] xl:static xl:z-auto xl:flex xl:w-[400px] xl:max-w-none xl:shrink-0 xl:border-l xl:border-[var(--surface-border)] xl:p-0 xl:pt-0"
          >
            <div className="glass-strong flex h-full flex-col overflow-hidden rounded-3xl xl:rounded-none xl:border-0">
              <AskAIPanel
                city={activeCity}
                units={units}
                bundle={bundle}
                onClose={() => setAiOpen(false)}
              />
            </div>
          </aside>
        )}
      </div>

      {/* Mobile dock */}
      <MobileDock active={dockTab} onChange={setDockTab} />

      {/* Mobile forecast drawer — Today tab with data */}
      {dockTab === 'today' && activeCity && bundle && (
        <div className="lg:hidden">
          <ForecastDrawer snapPoint={drawerSnap} onSnapPointChange={setDrawerSnap}>
            <ForecastSections city={activeCity} bundle={bundle} units={units} />
            <SiteFooter />
          </ForecastDrawer>
        </div>
      )}

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        savedCities={savedCities}
        activeCity={activeCity}
        activeCitySaved={isSaved}
        units={units}
        theme={theme}
        onSelectCity={selectCity}
        onToggleUnits={toggleUnits}
        onSetTheme={setTheme}
        onAskAi={handleAskAi}
        onLocate={handleLocate}
        locating={locating}
        onSaveCurrentCity={handleToggleSave}
        onRefresh={() => weather.refetch()}
        onJumpTo={scrollToSection}
      />

      <SettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        units={units}
        onSetUnits={setUnits}
        theme={theme}
        onSetTheme={setTheme}
      />

      <p role="status" aria-live="polite" className="sr-only">
        {statusText}
      </p>

      {sceneOverride && (
        <p
          className="fixed bottom-3 left-3 z-40 rounded-full bg-[rgb(10_27_30/0.8)] px-3 py-1 text-[10px] font-medium text-aurora-300 backdrop-blur-md"
          aria-hidden="true"
        >
          debug scene · {sceneOverride.condition}-{sceneOverride.phase}
        </p>
      )}
    </div>
  );
}
