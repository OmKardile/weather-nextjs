import 'server-only';

import type { Units, WeatherBundle } from '@/types/weather';
import type { ActivityScore, AlertItem, OutfitSuggestion } from '@/types/ai';
import { conditionLabel } from '@/lib/wmo';
import { formatHour, formatTemp, formatWind } from '@/lib/units';
import { getMoonPhase } from '@/lib/moon';

/* ------------------------------------------------------------------ */
/* Deterministic AI fallback — rule-based text grounded in the same    */
/* forecast bundle. Used when both Gemini and the z-ai provider are    */
/* unavailable or return invalid output. Same types, same contracts.   */
/* ------------------------------------------------------------------ */

const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(n)));

/** Temperature *delta* display (°F deltas scale by 9/5 without the +32 offset). */
const delta = (celsiusDiff: number, units: Units) =>
  units === 'metric' ? `${Math.round(celsiusDiff)}°` : `${Math.round((celsiusDiff * 9) / 5)}°`;

/** Score helper: 100 at `ideal`, falling off over `spread` units. */
function bandScore(value: number, ideal: number, spread: number): number {
  return clamp(100 - (Math.abs(value - ideal) / spread) * 100);
}

export function fallbackBriefing(bundle: WeatherBundle, units: Units): string {
  const { current, hourly, daily } = bundle;
  const today = daily[0];
  const next12 = hourly.slice(0, 12);

  const rainHour = next12.find((h) => h.precipitationProbability >= 50);
  const dryHours = next12.filter((h) => h.precipitationProbability < 30).length;
  const nowLabel = conditionLabel(current.weatherCode).toLowerCase();

  const temps = next12.map((h) => h.temperature);
  const trend = temps.length >= 2 ? temps[temps.length - 1] - temps[0] : 0;
  const sentences: string[] = [
    `${formatTemp(current.temperature, units)} and ${nowLabel} right now, feeling like ${formatTemp(current.apparentTemperature, units)}.`,
  ];

  if (rainHour) {
    sentences.push(
      `Precipitation builds to ${Math.round(rainHour.precipitationProbability)}% around ${formatHour(rainHour.time, units)}${today ? ` — today tops out at ${formatTemp(today.tempMax, units)}` : ''}.`,
    );
    sentences.push('Keep a light shell handy if you\u2019re out past then.');
  } else if (dryHours >= 10) {
    sentences.push(
      `Staying mostly dry for the next 12 hours${trend <= -3 ? `, cooling about ${delta(Math.abs(trend), units)}` : trend >= 3 ? `, warming about ${delta(trend, units)}` : ''}.`,
    );
    sentences.push('A good stretch for anything outdoors.');
  } else {
    sentences.push(
      `Mixed skies ahead — precipitation chance peaks at ${Math.round(Math.max(...next12.map((h) => h.precipitationProbability), 0))}% over the next 12 hours.`,
    );
  }

  if (current.windSpeed >= 30) {
    sentences.push(`Wind is noticeable at ${formatWind(current.windSpeed, units)}.`);
  }

  return sentences.slice(0, 3).join(' ');
}

export function fallbackOutfit(bundle: WeatherBundle): OutfitSuggestion {
  const { current, hourly } = bundle;
  const next12 = hourly.slice(0, 12);
  const minTemp = Math.min(current.temperature, ...next12.map((h) => h.temperature));
  const maxTemp = Math.max(current.temperature, ...next12.map((h) => h.temperature));
  const maxPrecip = Math.max(...next12.map((h) => h.precipitationProbability), current.precipitation > 0 ? 60 : 0);
  const maxUv = Math.max(...next12.map((h) => h.uvIndex), 0);
  const maxWind = Math.max(current.windSpeed, current.windGust, ...next12.map((h) => h.windSpeed));

  const items: string[] = [];
  if (minTemp < 0) items.push('Winter coat', 'Gloves and a hat');
  else if (minTemp < 10) items.push('Warm jacket');
  else if (minTemp < 18) items.push(maxTemp - minTemp > 8 ? 'Layers + light jacket' : 'Light jacket');
  else if (minTemp < 26) items.push('T-shirt or light layers');
  else items.push('Breathable, light clothing');

  if (maxPrecip >= 40) items.push('Umbrella or rain shell');
  if (maxUv >= 6) items.push('Sunglasses, SPF');
  if (maxWind >= 35) items.push('Windproof outer layer');

  const summary =
    maxPrecip >= 50
      ? 'Wet spells likely — waterproof where it counts.'
      : minTemp < 10
        ? 'Cold out — wrap up warm.'
        : minTemp > 26
          ? 'Warm one — dress light and drink water.'
          : 'Comfortable range — standard layers will do.';

  return { summary, items: items.slice(0, 4) };
}

export function fallbackActivities(bundle: WeatherBundle): ActivityScore[] {
  const { current, hourly, daily, utcOffsetSeconds } = bundle;
  const next12 = hourly.slice(0, 12);
  const avgTemp = next12.reduce((a, h) => a + h.temperature, 0) / Math.max(next12.length, 1);
  const maxPrecip = Math.max(...next12.map((h) => h.precipitationProbability));
  const avgWind = next12.reduce((a, h) => a + h.windSpeed, 0) / Math.max(next12.length, 1);
  const avgCloud = current.cloudCover;
  const maxUv = Math.max(...next12.map((h) => h.uvIndex), 0);
  const aqi = bundle.airQuality?.europeanAqi ?? null;

  const dryBonus = (100 - maxPrecip) * 0.45;
  const aqiPenalty = aqi == null ? 0 : aqi > 60 ? (aqi - 60) * 0.5 : 0;

  const running = clamp(bandScore(avgTemp, 12, 18) * 0.55 + dryBonus + bandScore(avgWind, 8, 25) * 0.15 - aqiPenalty);
  const cycling = clamp(bandScore(avgTemp, 16, 20) * 0.4 + dryBonus + bandScore(avgWind, 6, 30) * 0.3 - aqiPenalty);
  const golden = avgCloud >= 20 && avgCloud <= 70; // varied sky photographs best
  const photography = clamp(
    (golden ? 82 : avgCloud < 20 ? 68 : 45) * 0.6 + dryBonus * 0.6 + bandScore(maxUv, 4, 8) * 0.1,
  );
  const dining = clamp(bandScore(avgTemp, 21, 14) * 0.6 + dryBonus + bandScore(avgWind, 5, 18) * 0.2);

  // Stargazing: tonight's cloud + precip + moonlight.
  const nightHours = hourly.filter((h) => !h.isDay).slice(0, 10);
  const nightCloud = nightHours.length
    ? current.cloudCover * 0.4 + avgCloud * 0.6
    : avgCloud;
  const nightPrecip = nightHours.length ? Math.max(...nightHours.map((h) => h.precipitationProbability)) : maxPrecip;
  const moon = getMoonPhase();
  const moonPenalty = moon.illumination > 0.8 ? 18 : 0;
  const stargazing = nightHours.length
    ? clamp((100 - nightCloud) * 0.55 + (100 - nightPrecip) * 0.4 - moonPenalty)
    : 0;

  const t = (c: number) => Math.round(c);
  return [
    {
      activity: 'running',
      score: running,
      reason: `${Math.round(maxPrecip)}% peak precip, ${t(avgTemp)}°C average, ${Math.round(avgWind)} km/h wind.`,
    },
    {
      activity: 'cycling',
      score: cycling,
      reason: avgWind > 22 ? `Headwind risk — gusts around ${Math.round(current.windGust)} km/h.` : `Light winds near ${Math.round(avgWind)} km/h and ${Math.round(maxPrecip)}% precip peak.`,
    },
    {
      activity: 'photography',
      score: photography,
      reason: golden ? 'Varied cloud cover makes for dramatic light.' : avgCloud < 20 ? 'Clear skies — clean light, fewer textures.' : 'Flat overcast light.',
    },
    {
      activity: 'outdoor-dining',
      score: dining,
      reason: `Feels-like ${Math.round(current.apparentTemperature)}°C with ${Math.round(maxPrecip)}% precip peak.`,
    },
    {
      activity: 'stargazing',
      score: stargazing,
      reason: nightHours.length
        ? `${Math.round(nightCloud)}% cloud tonight, ${moon.name.toLowerCase()} (${Math.round(moon.illumination * 100)}% lit).`
        : 'Daylight hours only in the current forecast window.',
    },
  ];
}

/** Structured facts used by the alerts route (AI rephrases them; fallback renders them directly). */
export function detectAlertFacts(bundle: WeatherBundle, units: Units): Array<{ severity: AlertItem['severity']; fact: string }> {
  const { current, hourly, daily, airQuality } = bundle;
  const next24 = hourly.slice(0, 24);
  const facts: Array<{ severity: AlertItem['severity']; fact: string }> = [];
  const today = daily[0];

  // Sharp temperature swing within 24h.
  if (next24.length >= 6) {
    const maxT = Math.max(...next24.map((h) => h.temperature));
    const minT = Math.min(...next24.map((h) => h.temperature));
    const swing = maxT - minT;
    if (swing >= 10) {
      const drop = next24[0].temperature - minT;
      facts.push({
        severity: 'notice',
        fact: `Temperature swings ${formatTemp(maxT, units)} to ${formatTemp(minT, units)} within 24 hours${drop > swing / 2 ? ' — falling notably later' : ''}.`,
      });
    }
  }

  // Storm / sustained rain window.
  const stormHour = next24.find((h) => h.condition === 'thunder');
  const wetHours = next24.filter((h) => h.precipitationProbability >= 60);
  if (stormHour) {
    facts.push({
      severity: 'warning',
      fact: `Thunderstorm likely around ${formatHour(stormHour.time, units)} (${Math.round(stormHour.precipitationProbability)}% chance).`,
    });
  } else if (wetHours.length >= 2) {
    facts.push({
      severity: 'notice',
      fact: `Sustained precipitation ${formatHour(wetHours[0].time, units)}–${formatHour(wetHours[wetHours.length - 1].time, units)}, chance up to ${Math.round(Math.max(...wetHours.map((h) => h.precipitationProbability)))}%.`,
    });
  }

  // UV spike.
  const uvMax = today?.uvIndexMax ?? Math.max(...next24.map((h) => h.uvIndex), 0);
  if (uvMax >= 8) {
    facts.push({
      severity: uvMax >= 11 ? 'warning' : 'notice',
      fact: `UV index peaks at ${uvMax.toFixed(1)} today — protection recommended midday.`,
    });
  }

  // Air quality.
  const eaqi = airQuality?.europeanAqi;
  if (eaqi != null && eaqi >= 80) {
    facts.push({
      severity: eaqi >= 120 ? 'warning' : 'notice',
      fact: `Air quality is ${eaqi >= 120 ? 'very poor' : 'poor'} (European AQI ${Math.round(eaqi)}) — sensitive groups should limit outdoor exertion.`,
    });
  }

  // Strong wind.
  if (current.windGust >= 60 || (today?.windSpeedMax ?? 0) >= 60) {
    facts.push({
      severity: 'notice',
      fact: `Strong winds with gusts near ${formatWind(Math.max(current.windGust, today?.windSpeedMax ?? 0), units)}.`,
    });
  }

  // Heat.
  if ((today?.tempMax ?? 0) >= 32) {
    facts.push({
      severity: 'warning',
      fact: `High of ${formatTemp(today.tempMax, units)} — heat precautions advised.`,
    });
  }

  return facts.slice(0, 4);
}

export function fallbackAlerts(bundle: WeatherBundle, units: Units): AlertItem[] {
  const facts = detectAlertFacts(bundle, units);
  if (!facts.length) {
    return [
      {
        severity: 'info',
        title: 'Quiet day ahead',
        detail:
          'No notable swings in the next 24 hours — temperatures, precipitation and air quality all stay steady.',
      },
    ];
  }
  return facts.map((f) => ({
    severity: f.severity,
    title: titleFor(f.fact),
    detail: f.fact,
  }));
}

function titleFor(fact: string): string {
  if (/thunder/i.test(fact)) return 'Storm window';
  if (/UV/i.test(fact)) return 'UV spike';
  if (/Air quality/i.test(fact)) return 'Air quality';
  if (/wind/i.test(fact)) return 'Strong wind';
  if (/High of/i.test(fact)) return 'Heat';
  if (/Temperature swings/i.test(fact)) return 'Big temp swing';
  if (/precipitation/i.test(fact)) return 'Wet window';
  return 'Heads up';
}
