'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useGeolocation } from '@/hooks/use-geolocation';
import { usePreferences } from '@/hooks/use-preferences';
import { useWeather } from '@/hooks/use-weather';
import { getScene } from '@/lib/scenes';
import { getDayPhase } from '@/lib/time';
import type { City, Condition, DayPhase } from '@/types/weather';
import { WeatherScene } from '@/components/weather/WeatherScene';
import { TopBar } from '@/components/weather/TopBar';
import { CurrentWeather } from '@/components/weather/CurrentWeather';
import { TemperatureChart } from '@/components/weather/TemperatureChart';
import { HourlyStrip } from '@/components/weather/HourlyStrip';
import { DailyForecast } from '@/components/weather/DailyForecast';
import { MetricGrid } from '@/components/weather/MetricGrid';
import { AirQualityCard } from '@/components/weather/AirQualityCard';
import { SavedCities } from '@/components/weather/SavedCities';
import { EmptyState, ErrorState, LoadingSkeletons, OfflineBanner } from '@/components/weather/StateViews';
import { SiteFooter } from '@/components/weather/SiteFooter';

const CONDITIONS: Condition[] = [
  'clear', 'partly-cloudy', 'cloudy', 'fog', 'drizzle', 'rain', 'snow', 'thunder',
];
const PHASES: DayPhase[] = ['night', 'dawn', 'day', 'dusk'];

function Section({
  id,
  title,
  children,
  className,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section aria-labelledby={`${id}-heading`} className={className}>
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

export function AetherApp() {
  const [mounted, setMounted] = useState(false);
  const [activeCity, setActiveCity] = useState<City | null>(null);
  const [online, setOnline] = useState(true);
  const [sceneOverride, setSceneOverride] = useState<{
    condition: Condition;
    phase: DayPhase;
  } | null>(null);
  const restoredRef = useRef(false);

  const { toast } = useToast();
  const geolocation = useGeolocation();
  const units = usePreferences((state) => state.units);
  const savedCities = usePreferences((state) => state.savedCities);
  const lastCity = usePreferences((state) => state.lastCity);
  const { setUnits, toggleUnits, saveCity, removeCity, setLastCity } = usePreferences.getState();

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

  return (
    <div data-surface={scene.surface} className="relative flex min-h-screen flex-col">
      <WeatherScene scene={scene} />

      {!online && <OfflineBanner />}

      <TopBar
        units={units}
        onToggleUnits={toggleUnits}
        onSelectCity={selectCity}
        onLocate={handleLocate}
        locating={geolocation.status === 'locating'}
      />

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-4 pb-10 pt-6 sm:gap-6 sm:px-6">
        {!mounted || (activeCity && weather.isPending && !bundle) ? (
          <LoadingSkeletons />
        ) : !activeCity ? (
          <EmptyState
            onSelect={selectCity}
            onLocate={handleLocate}
            locating={geolocation.status === 'locating'}
          />
        ) : weather.isError && !bundle ? (
          <ErrorState message={weather.error?.message} onRetry={() => weather.refetch()} />
        ) : bundle ? (
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

            <Section id="hourly" title="Next 24 hours">
              <div className="glass rounded-[var(--radius-card)] p-4 shadow-[var(--shadow-glass)] sm:p-5">
                <TemperatureChart hours={bundle.hourly} units={units} />
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
            </Section>

            <SavedCities
              cities={savedCities}
              activeCity={activeCity}
              units={units}
              onSelect={selectCity}
              onRemove={removeCity}
              onSaveCurrent={handleToggleSave}
              canSaveCurrent={activeCity != null && !isSaved && activeCity.source !== 'location'}
            />
          </>
        ) : (
          <LoadingSkeletons />
        )}
      </main>

      <SiteFooter />

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
