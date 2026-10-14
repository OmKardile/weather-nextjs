import type { Alert, AlertSeverity, FloodResponse, SpaceWeather, WeatherBundle } from '@/types/weather';

/**
 * Aether-computed alerts — pure derivations from the weather bundle (and the
 * optional flood / space-weather payloads). These complement official feed
 * alerts: they cover conditions official feeds miss (heat/cold spikes, UV,
 * air quality, storm windows, heavy rain, river discharge, aurora) and are
 * always grounded in the numbers cited in the description.
 *
 * Pure function — safe on server or client, no network, no deps.
 */

/** Shared ordering: extreme > severe > moderate > minor > info. */
export const ALERT_SEVERITY_RANK: Record<AlertSeverity, number> = {
  extreme: 0,
  severe: 1,
  moderate: 2,
  minor: 3,
  info: 4,
};

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

/** Bundle values are always metric — cite °F alongside for imperial users. */
function fmtTemp(celsius: number): string {
  const fahrenheit = Math.round((celsius * 9) / 5 + 32);
  return `${Math.round(celsius)}°C (${fahrenheit}°F)`;
}

function fmtPrecip(mm: number): string {
  return `${mm < 10 ? mm.toFixed(1) : Math.round(mm)} mm (${(mm / 25.4).toFixed(2)} in)`;
}

/** "2026-10-11T14:00" (location-local) → "14:00". */
function hourLabel(iso: string): string {
  return iso.length >= 16 ? iso.slice(11, 16) : iso;
}

/** "today" / "tomorrow" / "Oct 14" relative to the bundle's daily array. */
function dayLabel(bundle: WeatherBundle, iso: string): string {
  const date = iso.slice(0, 10);
  if (bundle.daily[0]?.date === date) return 'today';
  if (bundle.daily[1]?.date === date) return 'tomorrow';
  const month = MONTHS[Number(date.slice(5, 7)) - 1] ?? '';
  return `${month} ${Number(date.slice(8, 10))}`.trim();
}

/* ------------------------------------------------------------------ */
/* Merge — dedupe computed alerts that restate an official product      */
/* (moved here so the banner component and the dock-badge hook share    */
/* one implementation without a circular import)                        */
/* ------------------------------------------------------------------ */

const TITLE_STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'this', 'that',
  'warning', 'watch', 'advisory', 'statement', 'alert', 'notice',
  'expected', 'ahead', 'today', 'tonight', 'possible', 'issued',
]);

function titleTokens(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length >= 3 && !TITLE_STOPWORDS.has(word))
      // crude plural stem — "thunderstorms" ≈ "thunderstorm"
      .map((word) => (word.length > 3 && word.endsWith('s') ? word.slice(0, -1) : word)),
  );
}

function isSimilarTitle(a: string, b: string): boolean {
  const tokensA = titleTokens(a);
  const tokensB = titleTokens(b);
  if (tokensA.size === 0 || tokensB.size === 0) return false;
  let overlap = 0;
  for (const token of tokensA) if (tokensB.has(token)) overlap += 1;
  return overlap / Math.min(tokensA.size, tokensB.size) >= 0.6;
}

/**
 * Merge official-feed alerts with Aether-computed alerts: computed entries
 * whose title ≈ an official product are dropped (the official one wins),
 * then the union is severity-ranked and capped at 5.
 */
export function mergeAlerts(official: Alert[], computed: Alert[]): Alert[] {
  const kept = computed.filter(
    (candidate) => !official.some((existing) => isSimilarTitle(existing.title, candidate.title)),
  );
  return [...official, ...kept]
    .sort(
      (a, b) =>
        ALERT_SEVERITY_RANK[a.severity] - ALERT_SEVERITY_RANK[b.severity] ||
        (a.expires ?? '9999').localeCompare(b.expires ?? '9999'),
    )
    .slice(0, 5);
}

/**
 * Derive computed alerts from forecast data.
 *
 * @param bundle Weather bundle (current + 48h hourly + 16-day daily + AQI)
 * @param flood Optional GloFAS river discharge response (river rule needs it)
 * @param space Optional NOAA SWPC space weather response (aurora rule needs it)
 */
export function computedAlerts(
  bundle: WeatherBundle,
  flood?: FloodResponse | null,
  space?: SpaceWeather | null,
): Alert[] {
  const alerts: Alert[] = [];
  const next48 = bundle.hourly.slice(0, 48);
  const next12 = bundle.hourly.slice(0, 12);
  const today = bundle.daily[0];

  /* (a) Storm window — thunder codes 95–99 within the next 12 hours. */
  const stormHours = next12.filter((h) => h.weatherCode >= 95 && h.weatherCode <= 99);
  if (stormHours.length > 0) {
    const first = stormHours[0];
    const last = stormHours[stormHours.length - 1];
    const window =
      stormHours.length > 1 ? `${hourLabel(first.time)}–${hourLabel(last.time)}` : `around ${hourLabel(first.time)}`;
    alerts.push({
      id: 'computed-storm-window',
      source: 'computed',
      title: stormHours.length > 1 ? 'Thunderstorms expected' : 'Thunderstorm expected',
      description: `Thunderstorm conditions are forecast ${window} — ${stormHours.length} hour${stormHours.length > 1 ? 's' : ''} with storms in the next 12. Expect lightning, sudden gusts and brief downpours; shelter indoors when storms arrive.`,
      severity: 'severe',
      onset: first.time,
      expires: last.time,
    });
  }

  /* (b) Heat spike — ≥35°C, or +8°C vs today's high, within 48h (≥40°C extreme). */
  if (next48.length > 0) {
    let peak = next48[0];
    for (const h of next48) if (h.temperature > peak.temperature) peak = h;
    const delta = today != null ? peak.temperature - today.tempMax : 0;
    if (peak.temperature >= 35 || delta >= 8) {
      const extreme = peak.temperature >= 40;
      const reason =
        delta >= 8
          ? `${Math.round(delta)}°C above today's high`
          : 'past the heat-stress threshold';
      alerts.push({
        id: 'computed-heat-spike',
        source: 'computed',
        title: extreme ? 'Extreme heat ahead' : 'Heat spike ahead',
        description: `Temperatures reach ${fmtTemp(peak.temperature)} ${dayLabel(bundle, peak.time)} — ${reason}. Hydrate through the day, limit midday exertion and check on vulnerable people.`,
        severity: extreme ? 'extreme' : 'severe',
        onset: peak.time,
      });
    }
  }

  /* (c) Cold spike — ≤−5°C, or −8°C vs today's low, within 48h (≤−15°C extreme). */
  if (next48.length > 0) {
    let low = next48[0];
    for (const h of next48) if (h.temperature < low.temperature) low = h;
    const delta = today != null ? today.tempMin - low.temperature : 0;
    if (low.temperature <= -5 || delta >= 8) {
      const extreme = low.temperature <= -15;
      const reason =
        delta >= 8 ? `${Math.round(delta)}°C below today's low` : 'past the frost-risk threshold';
      alerts.push({
        id: 'computed-cold-spike',
        source: 'computed',
        title: extreme ? 'Extreme cold ahead' : 'Cold snap ahead',
        description: `A cold push brings ${fmtTemp(low.temperature)} ${dayLabel(bundle, low.time)} — ${reason}. Layer up, protect exposed skin, and watch pipes and pets.`,
        severity: extreme ? 'extreme' : 'severe',
        onset: low.time,
      });
    }
  }

  /* (d) UV — today's UV index peaks at 8 or higher. */
  const uvToday = today?.uvIndexMax ?? Math.max(0, ...next48.slice(0, 24).map((h) => h.uvIndex));
  if (uvToday >= 8) {
    alerts.push({
      id: 'computed-uv-high',
      source: 'computed',
      title: 'Very high UV today',
      description: `The UV index peaks at ${Math.round(uvToday * 10) / 10} today — unprotected skin can burn in about 15–20 minutes around midday. Use SPF 30+, sunglasses and shade between 10:00 and 16:00.`,
      severity: 'moderate',
    });
  }

  /* (e) Air quality — European AQI at 100 or above. */
  const eaqi = bundle.airQuality?.europeanAqi;
  if (eaqi != null && eaqi >= 100) {
    alerts.push({
      id: 'computed-air-quality',
      source: 'computed',
      title: 'Poor air quality',
      description: `The European air quality index is ${Math.round(eaqi)} — pollution levels are high enough to affect sensitive groups. Consider limiting intense outdoor activity and keep windows closed during peak traffic hours.`,
      severity: 'moderate',
    });
  }

  /* (f) Heavy rain — ≥5 mm in a single hour, or ≥80% probability for 3+ consecutive hours (≥10 mm extreme). */
  if (next48.length > 0) {
    let peak = next48[0];
    for (const h of next48) if (h.precipitation > peak.precipitation) peak = h;

    let bestRun = 0;
    let bestRunStart = '';
    let run = 0;
    let runStart = '';
    for (const h of next48) {
      if (h.precipitationProbability >= 80) {
        if (run === 0) runStart = h.time;
        run += 1;
        if (run > bestRun) {
          bestRun = run;
          bestRunStart = runStart;
        }
      } else {
        run = 0;
      }
    }

    const heavyHour = peak.precipitation >= 5;
    const wetSpell = bestRun >= 3;
    if (heavyHour || wetSpell) {
      const extreme = peak.precipitation >= 10;
      const parts: string[] = [];
      if (heavyHour) {
        parts.push(`up to ${fmtPrecip(peak.precipitation)} of rain in a single hour around ${hourLabel(peak.time)} ${dayLabel(bundle, peak.time)}`);
      }
      if (wetSpell) {
        parts.push(`a ${bestRun}-hour stretch of ≥80% rain chance starting ${hourLabel(bestRunStart)} ${dayLabel(bundle, bestRunStart)}`);
      }
      alerts.push({
        id: 'computed-heavy-rain',
        source: 'computed',
        title: extreme ? 'Extreme rainfall expected' : 'Heavy rain expected',
        description: `The forecast shows ${parts.join(' and ')}. Expect ponding on roads and reduced visibility — never drive through flooded underpasses.`,
        severity: extreme ? 'extreme' : 'severe',
        onset: heavyHour ? peak.time : bestRunStart,
      });
    }
  }

  /* (g) River discharge — >5× the first-day value, or >500 m³/s absolute (GloFAS). */
  if (flood?.available) {
    const values = flood.daily
      .map((d) => d.discharge)
      .filter((v): v is number => v != null);
    if (values.length >= 2) {
      const first = values[0];
      const max = Math.max(...values);
      const ratio = first > 0 ? max / first : 0;
      if (max > 500 || ratio > 5) {
        alerts.push({
          id: 'computed-river-discharge',
          source: 'computed',
          title: 'River discharge rising',
          description: `Forecast river discharge at the nearest grid cell reaches ${Math.round(max)} m³/s — ${ratio > 5 ? `${ratio.toFixed(1)}× today's flow` : 'a high absolute flow for this river'}. Water may approach banks; stay clear of floodplains and fords.`,
          severity: 'moderate',
        });
      }
    }
  }

  /* (h) Aurora — planetary K-index at 5 or above (geomagnetic storm levels). */
  if (space != null && space.latestKp >= 5) {
    const kp = Math.round(space.latestKp * 10) / 10;
    alerts.push({
      id: 'computed-aurora',
      source: 'computed',
      title: 'Aurora possible tonight',
      description: `Geomagnetic activity is elevated — the planetary K-index is at ${kp}, storm enough to push aurora to high latitudes. On a clear night, look north away from city lights.`,
      severity: 'info',
    });
  }

  return alerts;
}
