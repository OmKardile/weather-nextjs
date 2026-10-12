'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { UIEvent } from 'react';
import dynamic from 'next/dynamic';
import { useToast } from '@/hooks/use-toast';
import { useGeolocation } from '@/hooks/use-geolocation';
import { usePreferences } from '@/hooks/use-preferences';
import { useWeather } from '@/hooks/use-weather';
import { useAmbientSound } from '@/hooks/use-ambient-sound';
import { useAchievementObserver } from '@/hooks/use-achievements';
import { useDynamicFavicon } from '@/hooks/use-dynamic-favicon';
import { useEditMode } from '@/hooks/use-edit-mode';
import { loadCachedBundle } from '@/lib/sections';
import { getScene } from '@/lib/scenes';
import { getDayPhase } from '@/lib/time';
import type { City, Condition, DayPhase, WeatherBundle } from '@/types/weather';
import { Glass } from '@/components/glass/Glass';
import { useLiquidGlassVars } from '@/components/glass/LiquidGlass';
import { useTiltGlow } from '@/hooks/use-tilt-glow';
import { Icon } from '@/components/icons/Icon';
import { AlertDigest } from '@/components/ai/AlertDigest';
import { OfficialAlerts } from '@/components/alerts/OfficialAlerts';
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
import { CompareDialog } from '@/components/weather/CompareDialog';
import { ForecastSections } from '@/components/weather/ForecastSections';
import { SavedCities } from '@/components/weather/SavedCities';
import { EmptyState, ErrorState, LoadingSkeletons, OfflineBanner, StaleDataBanner } from '@/components/weather/StateViews';
import { SiteFooter } from '@/components/weather/SiteFooter';

const CONDITIONS: Condition[] = [
  'clear', 'partly-cloudy', 'cloudy', 'fog', 'drizzle', 'rain', 'snow', 'thunder',
];
const PHASES: DayPhase[] = ['night', 'dawn', 'day', 'dusk'];

// Map mode is heavy (maplibre-gl + tiles) — load it only when first opened.
const MapOverlay = dynamic(() => import('@/components/map/MapOverlay'), {
  ssr: false,
  loading: () => null,
});

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
  const [compareOpen, setCompareOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [dockTab, setDockTab] = useState<DockTab>('today');
  const [scrolled, setScrolled] = useState(false);
  const [drawerSnap, setDrawerSnap] = useState<number>(DRAWER_SNAPS[0]);

  // Offline weather cache (Task 20-b): shown when the fetch fails.
  const [cachedWeather, setCachedWeather] = useState<{
    bundle: WeatherBundle;
    savedAt: number;
  } | null>(null);
  const [staleBannerDismissed, setStaleBannerDismissed] = useState(false);
  const staleToastRef = useRef(false);

  const restoredRef = useRef(false);
  const mainScrollRef = useRef<HTMLElement | null>(null);

  const { toast } = useToast();
  const geolocation = useGeolocation();
  const units = usePreferences((state) => state.units);
  const savedCities = usePreferences((state) => state.savedCities);
  const lastCity = usePreferences((state) => state.lastCity);
  const { setUnits, toggleUnits, saveCity, removeCity, setLastCity } =
    usePreferences.getState();

  const weather = useWeather(activeCity);
  const liveBundle = weather.data ?? null;
  // Offline fallback: when the fetch fails and a cached bundle exists, the
  // cache becomes the displayed bundle (existing stale-data preservation —
  // TanStack placeholderData + the toast below — is untouched).
  const bundle = liveBundle ?? (weather.isError ? cachedWeather?.bundle ?? null : null);
  const usingCachedBundle = liveBundle == null && bundle != null;

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

  // Offline cache lifecycle: reset per city, read from localStorage only
  // after a fetch error (hydration-safe — never during render).
  useEffect(() => {
    setCachedWeather(null);
    setStaleBannerDismissed(false);
  }, [activeCity?.id]);

  useEffect(() => {
    if (!activeCity || !weather.isError || liveBundle != null || cachedWeather) return;
    const cached = loadCachedBundle<WeatherBundle>(activeCity);
    if (cached) setCachedWeather({ bundle: cached.bundle, savedAt: cached.savedAt });
  }, [activeCity, weather.isError, liveBundle, cachedWeather]);

  // Refetch failed while live data is on screen → keep it, toast once.
  useEffect(() => {
    if (weather.isError && liveBundle != null) {
      if (!staleToastRef.current) {
        staleToastRef.current = true;
        toast({
          title: 'Showing last seen data',
          description: 'The weather service is unreachable — the forecast below is the latest successful update.',
        });
      }
    } else if (!weather.isError) {
      staleToastRef.current = false;
    }
  }, [weather.isError, liveBundle, toast]);

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

  // The interface surface follows the live sky at the selected city —
  // dawn/day/dusk/night re-theme everything. No manual dark mode: the
  // scene always wins, so contrast stays AA in every condition.
  const surfaceMode = scene.surface;
  const tint = sceneOverride?.condition ?? bundle?.current.condition ?? 'clear';
  const ambientPhase = sceneOverride?.phase ?? dayPhase;

  // Task 20-b: synthesized ambience (needs condition + day phase) and the
  // achievement observer (scene condition, saved count, map open — plus
  // the impulsive custom events from ForecastSections / ShareCardButton).
  useAmbientSound(tint, ambientPhase);
  useAchievementObserver({
    condition: tint,
    savedCount: savedCities.length,
    mapOpen,
  });

  // The tab is a thermometer: canvas favicon (scene-gradient backdrop +
  // temperature) and a live document title.
  useDynamicFavicon({ bundle, city: activeCity, units });

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

  // --------------------------- Customize cards --------------------------- //
  // Edit mode is entered from three places (Settings dialog, mobile Settings
  // tab, ⌘K). After turning it on we always route the user to where the
  // cards actually live: desktop scrolls the main column to the cards,
  // mobile switches to the Today tab and expands the forecast drawer.
  const handleCustomizeCards = useCallback(() => {
    useEditMode.getState().setEditMode(true);
    if (window.matchMedia('(min-width: 1024px)').matches) {
      // Scroll the main column itself (deterministic, and immune to the
      // section remount that edit mode triggers). Retried once because the
      // closing settings dialog can eat an immediate smooth scroll.
      window.setTimeout(() => {
        const main = mainScrollRef.current;
        const hourly = main?.querySelector<HTMLElement>('[data-section-id="hourly"]');
        if (!main || !hourly) return;
        const top =
          hourly.getBoundingClientRect().top - main.getBoundingClientRect().top + main.scrollTop - 12;
        main.scrollTo({ top, behavior: 'smooth' });
      }, 120);
    } else {
      setDockTab('today');
      // The dock-tab switch above resets the drawer to peek (see the snap
      // reset effect) — expand to full *after* that settles so the cards
      // (and their edit handles) are actually in view.
      window.setTimeout(() => setDrawerSnap(DRAWER_SNAPS[2]), 120);
    }
  }, []);

  // ------------------------------- Map mode ------------------------------ //
  const handleToggleMap = useCallback(() => {
    if (mapOpen) {
      setMapOpen(false);
      setDockTab('today');
    } else {
      setMapOpen(true);
      setDockTab('map');
    }
  }, [mapOpen]);

  const handleCloseMap = useCallback(() => {
    setMapOpen(false);
    setDockTab('today');
  }, []);

  const handleDockTab = useCallback((tab: DockTab) => {
    setDockTab(tab);
    setMapOpen(tab === 'map');
  }, []);

  // Liquid Glass material pipeline — CSS vars on the ROOT element (no
  // extra wrapper div: it would shift useId paths and break hydration).
  const liquidGlassVars = useLiquidGlassVars();

  // Device-tilt ambient glass highlight (motion sensor; permission-gated
  // on iOS via the Settings switch). Off with Reduce bright effects.
  const tiltGlowEnabled = usePreferences((state) => state.tiltGlowEnabled);
  const reduceBrightEffects = usePreferences((state) => state.reduceBrightEffects);
  useTiltGlow(tiltGlowEnabled && !reduceBrightEffects);

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
      style={liquidGlassVars}
      className="relative flex min-h-screen flex-col lg:h-screen lg:min-h-0 lg:overflow-hidden"
    >
      <WeatherScene scene={scene} />

      {usingCachedBundle && !staleBannerDismissed && cachedWeather ? (
        <StaleDataBanner
          savedAt={cachedWeather.savedAt}
          onDismiss={() => setStaleBannerDismissed(true)}
        />
      ) : (
        !online && <OfflineBanner />
      )}

      <MenuBar
        city={activeCity}
        bundle={bundle}
        units={units}
        scrolled={scrolled}
        aiOpen={aiOpen}
        mapOpen={mapOpen}
        locating={locating}
        onToggleUnits={toggleUnits}
        onOpenPalette={() => setPaletteOpen(true)}
        onToggleAi={handleAskAi}
        onToggleMap={handleToggleMap}
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
          onCompare={() => setCompareOpen(true)}
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
                        <OfficialAlerts city={activeCity} bundle={bundle} />
                      </div>
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
                <h2 className="card-label">
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
                  onCustomize={handleCustomizeCards}
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
                    <div className="mt-4">
                      <OfficialAlerts city={activeCity} bundle={bundle} />
                    </div>
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
      <MobileDock active={dockTab} onChange={handleDockTab} />

      {/* Mobile forecast drawer — Today tab with data */}
      {dockTab === 'today' && activeCity && bundle && (
        <div className="lg:hidden">
          <ForecastDrawer snapPoint={drawerSnap} onSnapPointChange={setDrawerSnap}>
            <OfficialAlerts city={activeCity} bundle={bundle} />
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
        mapOpen={mapOpen}
        onSelectCity={selectCity}
        onToggleUnits={toggleUnits}
        onCustomizeCards={handleCustomizeCards}
        onAskAi={handleAskAi}
        onToggleMap={handleToggleMap}
        onLocate={handleLocate}
        locating={locating}
        onSaveCurrentCity={handleToggleSave}
        onRefresh={() => weather.refetch()}
        onJumpTo={scrollToSection}
        onCompareCities={() => setCompareOpen(true)}
      />

      <SettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        units={units}
        onSetUnits={setUnits}
        onCustomizeCards={handleCustomizeCards}
      />

      {/* Compare saved cities — side-by-side live conditions */}
      <CompareDialog
        open={compareOpen}
        onOpenChange={setCompareOpen}
        cities={savedCities}
        activeCity={activeCity}
        units={units}
        onSelect={selectCity}
      />

      {/* Full-screen Map mode overlay (client-only, lazy) */}
      {mapOpen && (
        <MapOverlay
          onClose={handleCloseMap}
          city={activeCity}
          units={units}
          surface={surfaceMode}
        />
      )}

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
