import 'server-only';

import type { Condition, Units, WeatherBundle } from '@/types/weather';
import type { ActivityScore, AlertItem, OutfitSuggestion, PlannerWindow } from '@/types/ai';
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

  // Laundry: outdoor drying — dry hours, daytime warmth, helpful breeze,
  // humidity (current relative humidity as the proxy — no hourly series).
  const dryHours12 = next12.filter((h) => h.precipitationProbability <= 10).length;
  const dayHours12 = next12.filter((h) => h.isDay).length;
  const humidity = current.humidity;
  const humidityPenalty = humidity > 70 ? (humidity - 70) * 1.2 : 0;
  const laundry = clamp(
    (dryHours12 / Math.max(next12.length, 1)) * 46 +
      Math.min(24, Math.max(0, avgTemp - 5) * 1.4) +
      Math.min(16, Math.max(0, avgWind - 4) * 0.9) +
      (dayHours12 >= 6 ? 12 : dayHours12 * 2) -
      humidityPenalty,
  );

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
    {
      activity: 'laundry',
      score: laundry,
      reason:
        dryHours12 >= 10 && humidity < 70
          ? `Dry stretch — ${dryHours12} of 12 hours under 10% precip, ${Math.round(avgWind)} km/h breeze.`
          : dryHours12 >= 8
            ? `Mostly dry (${dryHours12}/12 hours), ${Math.round(humidity)}% humidity — decent drying.`
            : `Only ${dryHours12} of 12 hours look dry — indoor drying is safer today.`,
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

/* ------------------------------------------------------------------ */
/* Weather story — deterministic 4–6 sentence narrative of the next 24h */
/* ------------------------------------------------------------------ */

const STORY_OPENINGS: Record<Condition, (isDay: boolean) => string> = {
  clear: (isDay) =>
    isDay
      ? 'The day opens bright and unhurried, sunlight leaning warm through the morning.'
      : 'A clear, quiet kind of night — the sky wide open overhead.',
  'partly-cloudy': () => 'Clouds and sun trade places through the day, neither one winning for long.',
  cloudy: () => 'A soft grey ceiling settles in, the light diffused and easy on the eyes.',
  fog: () => 'The morning arrives wrapped in fog, the world narrowed to a few soft steps.',
  drizzle: () => 'A fine drizzle stitches the hours together, more atmosphere than weather.',
  rain: () => 'Rain sets the pace early, steady and businesslike about it.',
  snow: () => 'Snow gentles everything down, hushing the streets one flake at a time.',
  thunder: () => 'The sky has a temper today — a storm grumbling somewhere in the forecast.',
};

export function fallbackStory(bundle: WeatherBundle, units: Units): string {
  const { current, hourly, daily } = bundle;
  const next12 = hourly.slice(0, 12);
  const sentences: string[] = [];

  // 1. Opening line by current condition.
  sentences.push(STORY_OPENINGS[current.condition](current.isDay));

  // 2. Temperature rhythm over the next 12 hours.
  if (next12.length >= 2) {
    const first = next12[0].temperature;
    const last = next12[next12.length - 1].temperature;
    const peak = Math.max(...next12.map((h) => h.temperature));
    if (Math.abs(last - first) < 2) {
      sentences.push(`Temperatures hold near ${formatTemp(first, units)} through the afternoon.`);
    } else if (last > first) {
      sentences.push(`Warmth builds slowly, ${formatTemp(first, units)} easing toward ${formatTemp(peak, units)}.`);
    } else {
      sentences.push(`The warmth slips away as the hours pass, from ${formatTemp(first, units)} down toward ${formatTemp(last, units)}.`);
    }
  }

  // 3. Precipitation timing — the day's turning point.
  const rainHour = next12.find((h) => h.precipitationProbability >= 50);
  const dampEarly = next12.slice(0, 4).some((h) => h.precipitationProbability >= 40);
  const driesOut = dampEarly && !next12.slice(4).some((h) => h.precipitationProbability >= 40);
  if (driesOut) {
    const dryFrom = next12.slice(4).find((h) => h.precipitationProbability < 40) ?? next12[4];
    sentences.push(`The last of the damp burns off by ${formatHour(dryFrom.time, units)}, leaving the afternoon to itself.`);
  } else if (rainHour) {
    sentences.push(`Showers gather around ${formatHour(rainHour.time, units)} — worth being under a roof by then.`);
  } else {
    sentences.push('The air stays dry, nothing more than a passing cloud all day.');
  }

  // 4. Wind, when it has a say.
  if (current.windSpeed >= 30) {
    sentences.push(`Wind keeps things moving at ${formatWind(current.windSpeed, units)}.`);
  }

  // 5. Closing line — the day letting go.
  const sunset = daily[0]?.sunset;
  if (sunset) {
    sentences.push(`The light lets go around ${formatHour(sunset, units)}, and the evening settles in softly.`);
  }

  return sentences.slice(0, 6).join(' ');
}

/* ------------------------------------------------------------------ */
/* Day planner — deterministic keyword-driven window search             */
/* ------------------------------------------------------------------ */

interface PlannerActivity {
  key: 'walk' | 'run' | 'drive' | 'laundry' | 'photos' | 'outdoor';
  label: string;
}

function detectPlannerActivities(text: string): PlannerActivity[] {
  const t = text.toLowerCase();
  const found: PlannerActivity[] = [];
  const wants = (re: RegExp) => re.test(t);
  if (wants(/\b(walk|walks|walking|stroll|strolls|strolling|hike|hiking)\b/)) {
    found.push({ key: 'walk', label: 'Walk' });
  }
  if (wants(/\b(run|runs|running|jog|jogging)\b/)) {
    found.push({ key: 'run', label: 'Run' });
  }
  if (wants(/\b(drive|drives|driving|road\s?trip|commute|commuting|trip|travel|traveling|travelling)\b/)) {
    found.push({ key: 'drive', label: 'Drive' });
  }
  if (wants(/\b(laundry|laundries|washing|wash|dry|drying|clothes|clothesline)\b/)) {
    found.push({ key: 'laundry', label: 'Laundry' });
  }
  if (wants(/\b(photo|photos|photograph|photographs|photography|pictures?|golden\s?hour|sunset|sunrise)\b/)) {
    found.push({ key: 'photos', label: 'Photos' });
  }
  if (!found.length) found.push({ key: 'outdoor', label: 'Outdoor time' });
  return found.slice(0, 4);
}

const hhmmToMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** Score one 2-hour window (hour i, i+1) for an activity key. -1 = not viable. */
function scorePlannerWindow(
  key: PlannerActivity['key'],
  hours: WeatherBundle['hourly'],
  i: number,
  sunriseMin: number | null,
  sunsetMin: number | null,
): number {
  const a = hours[i];
  const b = hours[i + 1];
  const prob = (a.precipitationProbability + b.precipitationProbability) / 2;
  const tempC = (a.temperature + b.temperature) / 2;
  const wind = (a.windSpeed + b.windSpeed) / 2;
  const uv = Math.max(a.uvIndex, b.uvIndex);
  const bothDay = a.isDay && b.isDay;

  switch (key) {
    case 'walk':
      return clamp(100 - prob * 0.7 - Math.abs(tempC - 18) * 3 - Math.max(0, wind - 25) * 1.5);
    case 'run':
      return clamp(100 - prob * 0.8 - Math.abs(tempC - 12) * 3 - Math.max(0, wind - 22) * 1.5 - Math.max(0, uv - 7) * 5);
    case 'drive': {
      const visKm = ((a.visibility || 0) + (b.visibility || 0)) / 2000;
      return clamp(100 - prob * 0.5 - Math.max(0, 10 - visKm) * 1.5 - Math.max(0, wind - 35) * 1.2);
    }
    case 'laundry': {
      // Viable only when the window is dry AND the next 6 hours stay rain-free.
      const windowDry = a.precipitationProbability === 0 && b.precipitationProbability === 0;
      const followRain = hours
        .slice(i + 2, i + 8)
        .some((h) => h.precipitationProbability >= 40);
      if (!windowDry || followRain) return -1;
      return clamp(
        42 + Math.min(30, Math.max(0, tempC - 8) * 1.6) + Math.min(18, wind * 0.9) + (bothDay ? 10 : 0),
      );
    }
    case 'photos': {
      const start = hhmmToMinutes(a.time.slice(11, 16));
      const golden =
        sunriseMin != null && sunsetMin != null
          ? Math.abs(start - sunriseMin) <= 60 || Math.abs(start - sunsetMin) <= 60
          : false;
      const clear = a.condition === 'clear' || b.condition === 'clear';
      return clamp((golden ? 84 : clear ? 70 : 52) - prob * 0.5 - Math.max(0, wind - 30));
    }
    case 'outdoor':
    default:
      return clamp(100 - prob * 0.8 - Math.abs(tempC - 20) * 2.5 - Math.max(0, wind - 30) * 1.4);
  }
}

function plannerReason(
  key: PlannerActivity['key'],
  hours: WeatherBundle['hourly'],
  i: number,
  units: Units,
): string {
  const a = hours[i];
  const b = hours[i + 1];
  const prob = Math.round((a.precipitationProbability + b.precipitationProbability) / 2);
  const tempAvg = (a.temperature + b.temperature) / 2;
  const wind = Math.round((a.windSpeed + b.windSpeed) / 2);
  const timeLabel = formatHour(a.time, units);
  switch (key) {
    case 'walk':
      return `${prob}% precip around ${timeLabel}, ${formatTemp(tempAvg, units)} and ${formatWind(wind, units)} wind.`;
    case 'run':
      return prob >= 40
        ? `Cool ${formatTemp(tempAvg, units)} with ${prob}% precip — mind the showers.`
        : `Cool ${formatTemp(tempAvg, units)} with ${prob}% precip — easy running conditions.`;
    case 'drive': {
      const visKm = Math.round(((a.visibility || 0) + (b.visibility || 0)) / 2000);
      return `${prob}% precip and ${visKm >= 10 ? '10+ km' : `${visKm} km`} visibility — easy roads.`;
    }
    case 'laundry': {
      const dryAhead = hours
        .slice(i, i + 8)
        .every((h) => h.precipitationProbability < 40);
      return dryAhead
        ? `0% precip in this window and rain-free for the following hours — good drying at ${formatTemp(tempAvg, units)}.`
        : `Dry window at ${timeLabel}, ${formatTemp(tempAvg, units)} — hang it early.`;
    }
    case 'photos':
      return `Best light near ${timeLabel} — ${prob}% precip, ${a.condition === 'clear' || b.condition === 'clear' ? 'clear skies' : 'workable skies'}.`;
    case 'outdoor':
    default:
      return `Driest stretch — ${prob}% precip around ${timeLabel}, ${formatTemp(tempAvg, units)}.`;
  }
}

export function fallbackPlanner(text: string, bundle: WeatherBundle, units: Units): PlannerWindow[] {
  const hours = bundle.hourly.slice(0, 24);
  if (hours.length < 2) return [];

  const today = bundle.daily[0];
  const sunriseMin = today?.sunrise ? hhmmToMinutes(today.sunrise.slice(11, 16)) : null;
  const sunsetMin = today?.sunset ? hhmmToMinutes(today.sunset.slice(11, 16)) : null;

  const used: Array<[number, number]> = []; // [startIdx, endIdx] already suggested
  const overlapsUsed = (i: number) => used.some(([s, e]) => i >= s && i <= e);

  const windows: PlannerWindow[] = [];
  for (const activity of detectPlannerActivities(text)) {
    let bestIdx = -1;
    let bestScore = -1;
    let bestFreeIdx = -1; // best non-overlapping candidate, even if worse
    let bestFreeScore = -1;

    for (let i = 0; i + 1 < hours.length; i++) {
      const score = scorePlannerWindow(activity.key, hours, i, sunriseMin, sunsetMin);
      if (score < 0) continue;
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
      if (!overlapsUsed(i) && score > bestFreeScore) {
        bestFreeScore = score;
        bestFreeIdx = i;
      }
    }

    if (bestIdx < 0) continue; // no viable window at all (e.g. laundry never dry)
    // Prefer a non-overlapping window when it's within 25 points of the best.
    const idx = bestFreeIdx >= 0 && (overlapsUsed(bestIdx) || bestScore - bestFreeScore <= 25) ? bestFreeIdx : bestIdx;
    used.push([idx - 1, idx + 2]);

    const from = hours[idx].time.slice(11, 16);
    const to = (hours[Math.min(idx + 2, hours.length - 1)] ?? hours[idx + 1]).time.slice(11, 16);
    windows.push({
      activity: activity.label,
      from,
      to,
      score: Math.max(bestScore, 1),
      reason: plannerReason(activity.key, hours, idx, units),
    });
  }

  return windows.slice(0, 4);
}
