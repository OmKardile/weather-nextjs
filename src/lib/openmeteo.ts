import dns from 'node:dns';
import net from 'node:net';
import type {
  AirQuality,
  City,
  DailyPoint,
  EnsembleHourly,
  EnsembleResponse,
  FloodDay,
  FloodResponse,
  HistoricalResponse,
  HistoricalYear,
  HourlyPoint,
  MarineDay,
  MarineResponse,
  MinutelyPoint,
  ModelHourlyPoint,
  ModelsResponse,
  Pollen,
  WeatherBundle,
} from '@/types/weather';
import { conditionOf } from '@/lib/wmo';

// Some networks advertise flaky IPv6 routes for upstream APIs; prefer IPv4
// (undici ignores dns result ordering, so enable auto-select too).
dns.setDefaultResultOrder('ipv4first');
if (typeof net.setDefaultAutoSelectFamily === 'function') {
  net.setDefaultAutoSelectFamily(true);
}

/**
 * Server-side Open-Meteo client. All values are requested in metric and
 * converted client-side so the °C/°F toggle is instant (no refetch).
 */

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const AIR_QUALITY_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const ENSEMBLE_URL = 'https://ensemble-api.open-meteo.com/v1/ensemble';
const ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/era5';
const MARINE_URL = 'https://marine-api.open-meteo.com/v1/marine';
const FLOOD_URL = 'https://flood-api.open-meteo.com/v1/flood';
const REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';
const NOMINATIM_UA = 'AetherWeather/1.0 (weather app demo)';

/** Weather changes slowly — 10 minutes of shared cache is plenty. */
const WEATHER_REVALIDATE = 600;
const GEOCODE_REVALIDATE = 86_400;
/** Models/ensemble drift on the same cadence as the main forecast. */
const MODELS_REVALIDATE = 600;
/** ERA5 archive data is frozen history — safe to share for a month. */
const HISTORICAL_REVALIDATE = 2_592_000; // 30 days
const HISTORICAL_TIMEOUT_MS = 15_000;
/** Marine + flood grids update a few times a day. */
const NEARSHORE_REVALIDATE = 3_600;

class UpstreamError extends Error {
  constructor(
    message: string,
    readonly status = 502,
  ) {
    super(message);
    this.name = 'UpstreamError';
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Upstream attempts before giving up (the sandbox egress path needs a few tries for cold hosts). */
const FETCH_ATTEMPTS = 5;

async function fetchJson<T>(url: string, revalidate: number, init?: RequestInit): Promise<T> {
  // Transient network hiccups (this host's upstream route occasionally times
  // out, and first contact with an upstream host can ETIMEDOUT a few times
  // before the egress path warms up) get up to 5 attempts with escalating
  // backoff (250ms → 1s → 2.25s → 4s).
  let lastError: unknown;
  for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt += 1) {
    try {
      const res = await fetch(url, { ...init, next: { revalidate } });
      if (!res.ok) {
        throw new UpstreamError(
          `Upstream request failed (${res.status}) for ${new URL(url).hostname}`,
        );
      }
      return (await res.json()) as T;
    } catch (error) {
      lastError = error;
      if (error instanceof UpstreamError) throw error;
      // A caller-supplied deadline (the historical 15s cap) is final.
      if (init?.signal?.aborted) throw error;
      if (attempt < FETCH_ATTEMPTS) await sleep(250 * attempt * attempt);
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new UpstreamError('Upstream request failed');
}

// ---------------------------------------------------------------------------
// Geocoding
// ---------------------------------------------------------------------------

interface OmGeocodeResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  country_code?: string;
  admin1?: string;
  timezone?: string;
  population?: number;
}

interface OmGeocodeResponse {
  results?: OmGeocodeResult[];
}

function toCity(result: OmGeocodeResult): City {
  return {
    id: result.id,
    name: result.name,
    admin1: result.admin1,
    country: result.country ?? '',
    countryCode: result.country_code,
    latitude: result.latitude,
    longitude: result.longitude,
    timezone: result.timezone,
    source: 'search',
  };
}

export async function searchCities(query: string, count = 8): Promise<City[]> {
  const url = `${GEOCODE_URL}?name=${encodeURIComponent(query)}&count=${count}&language=en&format=json`;
  const data = await fetchJson<OmGeocodeResponse>(url, GEOCODE_REVALIDATE);
  return (data.results ?? []).map(toCity);
}

interface NominatimReverse {
  name?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state?: string;
    country?: string;
    country_code?: string;
  };
}

export async function reverseGeocode(lat: number, lon: number): Promise<City> {
  const url = `${REVERSE_URL}?lat=${lat}&lon=${lon}&format=json&zoom=10&addressdetails=1`;
  const data = await fetchJson<NominatimReverse>(url, GEOCODE_REVALIDATE, {
    headers: { 'User-Agent': NOMINATIM_UA, Accept: 'application/json' },
  });
  const address = data.address ?? {};
  const name =
    data.name || address.city || address.town || address.village || address.municipality || address.county;
  return {
    // Negative id keeps located places from colliding with geocoding ids.
    id: -Math.round((Math.abs(lat * 1000) * 31 + Math.abs(lon * 1000) * 17) % 2_000_000_000),
    name: name || 'My location',
    admin1: address.state,
    country: address.country ?? '',
    countryCode: address.country_code?.toUpperCase(),
    latitude: lat,
    longitude: lon,
    source: 'location',
  };
}

// ---------------------------------------------------------------------------
// Weather + air quality
// ---------------------------------------------------------------------------

const CURRENT_FIELDS = [
  'temperature_2m',
  'relative_humidity_2m',
  'apparent_temperature',
  'is_day',
  'precipitation',
  'weather_code',
  'cloud_cover',
  'pressure_msl',
  'wind_speed_10m',
  'wind_direction_10m',
  'wind_gusts_10m',
].join(',');

const HOURLY_FIELDS = [
  'temperature_2m',
  'precipitation_probability',
  'precipitation',
  'weather_code',
  'is_day',
  'visibility',
  'uv_index',
  'wind_speed_10m',
].join(',');

const DAILY_FIELDS = [
  'weather_code',
  'temperature_2m_max',
  'temperature_2m_min',
  'sunrise',
  'sunset',
  'precipitation_probability_max',
  'uv_index_max',
  'wind_speed_10m_max',
].join(',');

/** 15-minute precipitation nowcast fields (dedicated second forecast call). */
const MINUTELY_FIELDS = 'precipitation,precipitation_probability';
/** Number of 15-minute steps returned: now → +2 hours. */
const MINUTELY_POINTS = 8;

/** Pollen fields piggybacked on the air-quality call (Europe only upstream). */
const POLLEN_FIELDS = [
  'alder_pollen',
  'birch_pollen',
  'grass_pollen',
  'ragweed_pollen',
  'olive_pollen',
  'mugwort_pollen',
].join(',');

interface OmForecast {
  utc_offset_seconds: number;
  timezone: string;
  timezone_abbreviation: string;
  current: {
    time: string;
    temperature_2m: number;
    relative_humidity_2m: number;
    apparent_temperature: number;
    is_day: number;
    precipitation: number;
    weather_code: number;
    cloud_cover: number;
    pressure_msl: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
    wind_gusts_10m: number;
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    precipitation_probability: (number | null)[];
    precipitation: number[];
    weather_code: number[];
    is_day: number[];
    visibility: (number | null)[];
    uv_index: (number | null)[];
    wind_speed_10m: number[];
  };
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    sunrise: (string | null)[];
    sunset: (string | null)[];
    precipitation_probability_max: (number | null)[];
    uv_index_max: (number | null)[];
    wind_speed_10m_max: number[];
  };
}

interface OmAirQuality {
  current?: {
    time: string;
    european_aqi: number | null;
    us_aqi: number | null;
    pm10: number | null;
    pm2_5: number | null;
    carbon_monoxide: number | null;
    nitrogen_dioxide: number | null;
    sulphur_dioxide: number | null;
    ozone: number | null;
  };
  /** Present when pollen fields are requested; arrays are all-null outside Europe. */
  hourly?: {
    time: string[];
    alder_pollen?: (number | null)[];
    birch_pollen?: (number | null)[];
    grass_pollen?: (number | null)[];
    ragweed_pollen?: (number | null)[];
    olive_pollen?: (number | null)[];
    mugwort_pollen?: (number | null)[];
    european_aqi?: (number | null)[];
  };
}

interface OmMinutelyForecast {
  minutely_15?: {
    time: string[];
    precipitation?: (number | null)[];
    precipitation_probability?: (number | null)[];
  };
}

const num = (value: number | null | undefined, fallback: number): number =>
  value == null || !Number.isFinite(value) ? fallback : value;

/**
 * Civil-twilight duration in minutes for a latitude and ISO date — the time
 * the sun needs to climb from −6° to the horizon (NOAA hour-angle solution
 * with a ±0.5° declination approximation, accurate to a few minutes).
 *
 * NOTE: the upstream forecast API does NOT expose civil_twilight_* as daily
 * variables (verified live: 400 "Cannot initialize ForecastVariableDaily"),
 * so the bundle derives both twilight timestamps from solar geometry instead
 * of a second upstream call.
 */
function approxCivilTwilightMinutes(latitude: number, dateIso: string): number {
  const [y, m, d] = dateIso.split('-').map(Number);
  const dayOfYear = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86_400_000) + 1;
  const declDeg = -23.44 * Math.cos((2 * Math.PI * (dayOfYear + 10)) / 365.2422);
  const rad = Math.PI / 180;
  const lat = latitude * rad;
  const dec = declDeg * rad;
  const cosH0 = -Math.tan(lat) * Math.tan(dec); // hour angle at sunrise (h = 0°)
  const cosHc =
    (Math.sin(-6 * rad) - Math.sin(lat) * Math.sin(dec)) / (Math.cos(lat) * Math.cos(dec)); // h = −6°
  const h0 = Math.acos(Math.min(1, Math.max(-1, cosH0))) / rad;
  const hc = Math.acos(Math.min(1, Math.max(-1, cosHc))) / rad;
  // At dawn the sun climbs from −6° (larger hour-angle magnitude Hc) to the
  // horizon (H0), so the duration is (Hc − H0) × 4 min; 1° hour angle = 4 min.
  return Math.min(90, Math.max(8, (hc - h0) * 4));
}

/** Shift a wall-clock local ISO ("YYYY-MM-DDTHH:mm") by ±minutes. */
function shiftLocalMinutes(iso: string, minutes: number): string {
  const shifted = new Date(Date.parse(`${iso}:00Z`) + minutes * 60_000);
  return Number.isNaN(shifted.getTime()) ? iso : shifted.toISOString().slice(0, 16);
}

/** Slice the next 48 hours starting at (or just after) the current time. */
function sliceCurrentHour(forecast: OmForecast): HourlyPoint[] {
  const { hourly, current } = forecast;
  const currentHourPrefix = current.time.slice(0, 13); // "YYYY-MM-DDTHH"
  let start = hourly.time.findIndex((t) => t.slice(0, 13) === currentHourPrefix);
  if (start < 0) start = Math.max(0, hourly.time.length - 48);

  const points: HourlyPoint[] = [];
  for (let i = start; i < hourly.time.length && points.length < 48; i += 1) {
    points.push({
      time: hourly.time[i],
      temperature: num(hourly.temperature_2m[i], 0),
      precipitationProbability: num(hourly.precipitation_probability[i], 0),
      precipitation: num(hourly.precipitation[i], 0),
      weatherCode: num(hourly.weather_code[i], 0),
      isDay: num(hourly.is_day[i], 1) === 1,
      visibility: num(hourly.visibility[i], 24_000),
      uvIndex: num(hourly.uv_index[i], 0),
      windSpeed: num(hourly.wind_speed_10m[i], 0),
      condition: conditionOf(num(hourly.weather_code[i], 0)),
    });
  }
  return points;
}

/**
 * Slice the 15-minute nowcast from the current time slot → +2 hours.
 * Returns null when the response is missing/empty (the call is best-effort).
 */
function sliceMinutely(data: OmMinutelyForecast | null, nowLocal: string): MinutelyPoint[] | null {
  const minutely = data?.minutely_15;
  if (!minutely || minutely.time.length === 0) return null;
  // Local ISO strings are zero-padded, so lexicographic order === chronological order.
  let start = minutely.time.findIndex((t) => t >= nowLocal);
  if (start < 0) return null;

  const points: MinutelyPoint[] = [];
  for (let i = start; i < minutely.time.length && points.length < MINUTELY_POINTS; i += 1) {
    points.push({
      time: minutely.time[i],
      precip: num(minutely.precipitation?.[i] ?? null, 0),
      precipProbability: num(minutely.precipitation_probability?.[i] ?? null, 0),
    });
  }
  return points.length > 0 ? points : null;
}

const POLLEN_KEYS = [
  'alder_pollen',
  'birch_pollen',
  'grass_pollen',
  'ragweed_pollen',
  'olive_pollen',
  'mugwort_pollen',
] as const;

/**
 * Summarize hourly pollen into a single next-24h snapshot (max per type).
 * `available` is true only when the upstream actually reports pollen here
 * (Europe); elsewhere every array is all-null and the flag stays false.
 */
function extractPollen(air: OmAirQuality | null): Pollen | null {
  const hourly = air?.hourly;
  if (!hourly || hourly.time.length === 0) return null;

  const anchor = air.current?.time ?? hourly.time[0];
  let start = hourly.time.findIndex((t) => t >= anchor);
  if (start < 0) start = 0;
  const end = Math.min(start + 24, hourly.time.length);

  const maxOf = (key: (typeof POLLEN_KEYS)[number]): number | null => {
    let max: number | null = null;
    const values = hourly?.[key];
    if (!values) return null;
    for (let i = start; i < end; i += 1) {
      const value = values[i];
      if (value != null && Number.isFinite(value) && (max == null || value > max)) {
        max = value;
      }
    }
    return max;
  };

  const [alder, birch, grass, ragweed, olive, mugwort] = POLLEN_KEYS.map(maxOf);
  return {
    available: [alder, birch, grass, ragweed, olive, mugwort].some((v) => v !== null),
    time: hourly.time[start],
    alder,
    birch,
    grass,
    ragweed,
    olive,
    mugwort,
  };
}

/**
 * Next-24h European AQI trend from the piggybacked hourly field. Returns null
 * when the hourly array is missing or entirely null (air-quality call failed
 * or the region is uncovered) so the card can omit the sparkline.
 */
function extractAqiTrend(air: OmAirQuality | null): AirQuality['trend'] {
  const hourly = air?.hourly;
  const values = hourly?.european_aqi;
  if (!hourly || !values || hourly.time.length === 0) return null;

  const anchor = air.current?.time ?? hourly.time[0];
  let start = hourly.time.findIndex((t) => t >= anchor);
  if (start < 0) start = 0;
  const end = Math.min(start + 24, hourly.time.length, values.length);

  const points: Array<{ time: string; value: number }> = [];
  for (let i = start; i < end; i += 1) {
    const value = values[i];
    if (value != null && Number.isFinite(value)) {
      points.push({ time: hourly.time[i], value });
    }
  }
  return points.length >= 4 ? points : null;
}

export async function fetchWeatherBundle(lat: number, lon: number): Promise<WeatherBundle> {
  const forecastUrl =
    `${FORECAST_URL}?latitude=${lat}&longitude=${lon}` +
    `&current=${CURRENT_FIELDS}&hourly=${HOURLY_FIELDS}&daily=${DAILY_FIELDS}` +
    // past_days=1 prepends yesterday to the daily arrays (17 rows) so the
    // hero can show a "vs yesterday" delta; past_hours=1 still governs the
    // hourly anchor, so the hourly arrays are unchanged (verified upstream).
    `&timezone=auto&forecast_days=16&past_hours=1&forecast_hours=54&past_days=1`;

  // Pollen piggybacks on the air-quality call (same upstream, one request);
  // hourly european_aqi rides along for the 24h air-quality trend.
  const airUrl =
    `${AIR_QUALITY_URL}?latitude=${lat}&longitude=${lon}` +
    `&current=european_aqi,us_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone` +
    `&hourly=${POLLEN_FIELDS},european_aqi&forecast_days=3&timezone=auto`;

  // Dedicated nowcast call. forecast_days=2 (not 1) so the 2-hour window is
  // fully covered even shortly before local midnight.
  const minutelyUrl =
    `${FORECAST_URL}?latitude=${lat}&longitude=${lon}` +
    `&minutely_15=${MINUTELY_FIELDS}&forecast_days=2&timezone=auto`;

  // Air quality, pollen and the nowcast are nice-to-haves: a failure of any
  // of them must not break the core forecast.
  const [forecast, air, minutelyForecast] = await Promise.all([
    fetchJson<OmForecast>(forecastUrl, WEATHER_REVALIDATE),
    fetchJson<OmAirQuality>(airUrl, WEATHER_REVALIDATE).catch(() => null),
    fetchJson<OmMinutelyForecast>(minutelyUrl, WEATHER_REVALIDATE).catch(() => null),
  ]);

  const current = forecast.current;
  // past_days=1 → daily[0] is yesterday; the visible 16-day horizon starts
  // at index 1. With past_days absent upstream the arrays fall back cleanly.
  const dailyStart =
    forecast.daily.time.length > 16 &&
    forecast.daily.time[0] !== current.time.slice(0, 10)
      ? 1
      : 0;
  const daily: DailyPoint[] = forecast.daily.time
    .slice(dailyStart, dailyStart + 16)
    .map((date, i) => ({
    date,
    weatherCode: num(forecast.daily.weather_code[dailyStart + i], 0),
    tempMax: num(forecast.daily.temperature_2m_max[dailyStart + i], 0),
    tempMin: num(forecast.daily.temperature_2m_min[dailyStart + i], 0),
    sunrise: forecast.daily.sunrise[dailyStart + i] ?? `${date}T06:00`,
    sunset: forecast.daily.sunset[dailyStart + i] ?? `${date}T18:00`,
    // Civil twilight (sun at −6°), derived from solar geometry per day — see
    // approxCivilTwilightMinutes for why this is not an upstream field.
    civilTwilightBegin: shiftLocalMinutes(
      forecast.daily.sunrise[dailyStart + i] ?? `${date}T06:00`,
      -approxCivilTwilightMinutes(lat, date),
    ),
    civilTwilightEnd: shiftLocalMinutes(
      forecast.daily.sunset[dailyStart + i] ?? `${date}T18:00`,
      approxCivilTwilightMinutes(lat, date),
    ),
    precipitationProbabilityMax: num(
      forecast.daily.precipitation_probability_max[dailyStart + i],
      0,
    ),
    uvIndexMax: num(forecast.daily.uv_index_max[dailyStart + i], 0),
    windSpeedMax: num(forecast.daily.wind_speed_10m_max[dailyStart + i], 0),
    condition: conditionOf(num(forecast.daily.weather_code[dailyStart + i], 0)),
  }));

  /** Yesterday's measured high/low (daily[0] with past_days=1). */
  const yesterday: WeatherBundle['yesterday'] =
    dailyStart === 1
      ? {
          date: forecast.daily.time[0],
          tempMax: num(forecast.daily.temperature_2m_max[0], 0),
          tempMin: num(forecast.daily.temperature_2m_min[0], 0),
        }
      : null;

  const airQuality: AirQuality | null = air?.current
    ? {
        europeanAqi: air.current.european_aqi ?? null,
        usAqi: air.current.us_aqi ?? null,
        pm2_5: air.current.pm2_5 ?? null,
        pm10: air.current.pm10 ?? null,
        ozone: air.current.ozone ?? null,
        no2: air.current.nitrogen_dioxide ?? null,
        so2: air.current.sulphur_dioxide ?? null,
        co: air.current.carbon_monoxide ?? null,
        time: air.current.time,
        trend: extractAqiTrend(air),
      }
    : null;

  return {
    current: {
      time: current.time,
      temperature: num(current.temperature_2m, 0),
      apparentTemperature: num(current.apparent_temperature, 0),
      humidity: num(current.relative_humidity_2m, 0),
      isDay: num(current.is_day, 1) === 1,
      precipitation: num(current.precipitation, 0),
      weatherCode: num(current.weather_code, 0),
      cloudCover: num(current.cloud_cover, 0),
      pressure: num(current.pressure_msl, 1013),
      windSpeed: num(current.wind_speed_10m, 0),
      windGust: num(current.wind_gusts_10m, 0),
      windDirection: num(current.wind_direction_10m, 0),
      condition: conditionOf(num(current.weather_code, 0)),
    },
    hourly: sliceCurrentHour(forecast),
    daily,
    yesterday,
    airQuality,
    minutely: sliceMinutely(minutelyForecast, current.time),
    pollen: extractPollen(air),
    utcOffsetSeconds: forecast.utc_offset_seconds ?? 0,
    timezone: forecast.timezone ?? 'UTC',
    timezoneAbbreviation: forecast.timezone_abbreviation ?? '',
    fetchedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Multi-model comparison / ensemble spread
// ---------------------------------------------------------------------------

/** Upstream model ids (one call → suffixed hourly keys, e.g. temperature_2m_ecmwf_ifs025). */
const MODEL_SOURCES = [
  {
    id: 'ecmwf',
    label: 'ECMWF',
    tempKey: 'temperature_2m_ecmwf_ifs025',
    precipKey: 'precipitation_ecmwf_ifs025',
  },
  {
    id: 'gfs',
    label: 'GFS (NOAA)',
    tempKey: 'temperature_2m_gfs_seamless',
    precipKey: 'precipitation_gfs_seamless',
  },
  {
    id: 'icon',
    label: 'ICON (DWD)',
    tempKey: 'temperature_2m_icon_seamless',
    precipKey: 'precipitation_icon_seamless',
  },
] as const;

const MODELS_PARAM = 'ecmwf_ifs025,gfs_seamless,icon_seamless';

interface OmModelsHourly {
  time: string[];
  temperature_2m_ecmwf_ifs025?: (number | null)[];
  precipitation_ecmwf_ifs025?: (number | null)[];
  temperature_2m_gfs_seamless?: (number | null)[];
  precipitation_gfs_seamless?: (number | null)[];
  temperature_2m_icon_seamless?: (number | null)[];
  precipitation_icon_seamless?: (number | null)[];
}

/** Side-by-side ECMWF / GFS / ICON 7-day hourly comparison. */
export async function fetchModelComparison(lat: number, lon: number): Promise<ModelsResponse> {
  const url =
    `${FORECAST_URL}?latitude=${lat}&longitude=${lon}` +
    `&models=${MODELS_PARAM}&hourly=temperature_2m,precipitation&forecast_days=7&timezone=auto`;
  const data = await fetchJson<{ hourly?: OmModelsHourly }>(url, MODELS_REVALIDATE);
  const hourly = data.hourly;

  const models = MODEL_SOURCES.map(({ id, label, tempKey, precipKey }) => ({
    id,
    label,
    hourly: (hourly?.time ?? []).map<ModelHourlyPoint>((time, i) => ({
      time,
      temp: num(hourly?.[tempKey]?.[i] ?? null, 0),
      precip: num(hourly?.[precipKey]?.[i] ?? null, 0),
    })),
  }));
  return { models };
}

/** ICON ensemble: base series + member01…member39. */
const ENSEMBLE_MEMBERS = 40;

interface OmEnsembleHourly {
  time: string[];
  [variable: string]: unknown;
}

function numSeries(hourly: OmEnsembleHourly, key: string): Array<number | null> {
  const raw = hourly[key];
  if (!Array.isArray(raw)) return [];
  const values: Array<number | null> = [];
  for (const item of raw) {
    if (item === null || typeof item === 'number') values.push(item);
  }
  return values;
}

/**
 * ICON ensemble mean ± spread for the next 7 days. The upstream `*_spread`
 * arrays currently come back all-null, so the spread is computed here as the
 * population σ across the 40 returned member series (upstream value wins if
 * it ever starts reporting).
 */
export async function fetchEnsemble(lat: number, lon: number): Promise<EnsembleResponse> {
  const url =
    `${ENSEMBLE_URL}?latitude=${lat}&longitude=${lon}` +
    `&models=icon_seamless&hourly=temperature_2m,temperature_2m_spread,precipitation` +
    `&forecast_days=7&timezone=auto`;
  const data = await fetchJson<{ hourly?: OmEnsembleHourly }>(url, MODELS_REVALIDATE);
  const hourly = data.hourly;
  if (!hourly) return { hourly: [] };

  const temps = numSeries(hourly, 'temperature_2m');
  const precip = numSeries(hourly, 'precipitation');
  const upstreamSpread = numSeries(hourly, 'temperature_2m_spread');
  const memberTemps = [
    temps,
    ...Array.from({ length: ENSEMBLE_MEMBERS - 1 }, (_, m) =>
      numSeries(hourly, `temperature_2m_member${String(m + 1).padStart(2, '0')}`),
    ),
  ].filter((series) => series.length > 0);

  // Trim trailing hours the ensemble horizon doesn't cover (ICON ~142 of 168).
  let last = hourly.time.length - 1;
  while (last >= 0 && temps[last] == null && precip[last] == null) last -= 1;

  const points: EnsembleHourly[] = [];
  for (let i = 0; i <= last; i += 1) {
    let tempSpread = upstreamSpread[i] ?? null;
    if (tempSpread == null && memberTemps.length > 1) {
      const values: number[] = [];
      for (const series of memberTemps) {
        const value = series[i];
        if (value != null) values.push(value);
      }
      if (values.length > 1) {
        const mean = values.reduce((a, v) => a + v, 0) / values.length;
        const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length;
        tempSpread = Math.round(Math.sqrt(variance) * 100) / 100;
      }
    }
    points.push({
      time: hourly.time[i],
      temp: num(temps[i], 0),
      tempSpread,
      precip: num(precip[i], 0),
    });
  }
  return { hourly: points };
}

// ---------------------------------------------------------------------------
// Historical climate normals / marine / flood
// ---------------------------------------------------------------------------

const HISTORICAL_START_YEAR = 1995;

interface OmArchiveDaily {
  time: string[];
  temperature_2m_max?: (number | null)[];
  temperature_2m_min?: (number | null)[];
}

/**
 * 1995 → last complete year ERA5 history for one calendar date, plus the
 * 30-year normal. One upstream call per rounded coordinate (the archive
 * payload is shared across every month/day of that spot via the fetch cache).
 * Feb 29 keeps its year slot with nulls in non-leap years so the year axis
 * stays continuous.
 */
export async function fetchHistorical(
  lat: number,
  lon: number,
  month: number,
  day: number,
): Promise<HistoricalResponse> {
  // Round to 1 decimal so nearby queries share a single cached request.
  const rlat = Math.round(lat * 10) / 10;
  const rlon = Math.round(lon * 10) / 10;
  const endYear = new Date().getUTCFullYear() - 1;
  const url =
    `${ARCHIVE_URL}?latitude=${rlat}&longitude=${rlon}` +
    `&start_date=${HISTORICAL_START_YEAR}-01-01&end_date=${endYear}-12-31` +
    `&daily=temperature_2m_max,temperature_2m_min&timezone=auto`;

  // Hard 15s cap: a slow archive fetch surfaces as an error at the route
  // level (which degrades to a 200 { error } response). The aborted signal
  // also short-circuits fetchJson's retries, keeping the total ≈ 15s.
  const data = await fetchJson<{ daily?: OmArchiveDaily }>(url, HISTORICAL_REVALIDATE, {
    signal: AbortSignal.timeout(HISTORICAL_TIMEOUT_MS),
  });

  const times = data.daily?.time ?? [];
  const tmaxSeries = data.daily?.temperature_2m_max ?? [];
  const tminSeries = data.daily?.temperature_2m_min ?? [];

  const suffix = `-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const byYear = new Map<number, { tmax: number | null; tmin: number | null }>();
  for (let i = 0; i < times.length; i += 1) {
    const date = times[i];
    if (!date.endsWith(suffix)) continue;
    byYear.set(Number(date.slice(0, 4)), {
      tmax: tmaxSeries[i] ?? null,
      tmin: tminSeries[i] ?? null,
    });
  }

  const firstYear = times.length > 0 ? Number(times[0].slice(0, 4)) : HISTORICAL_START_YEAR;
  const lastYear = times.length > 0 ? Number(times[times.length - 1].slice(0, 4)) : endYear;

  const years: HistoricalYear[] = [];
  for (let year = firstYear; year <= lastYear; year += 1) {
    const hit = byYear.get(year);
    years.push({ year, tmax: hit?.tmax ?? null, tmin: hit?.tmin ?? null });
  }

  const mean = (values: number[]): number | null =>
    values.length === 0
      ? null
      : Math.round((values.reduce((a, v) => a + v, 0) / values.length) * 10) / 10;

  return {
    month,
    day,
    years,
    normal: {
      tmax: mean(years.map((y) => y.tmax).filter((v): v is number => v != null)),
      tmin: mean(years.map((y) => y.tmin).filter((v): v is number => v != null)),
    },
  };
}

interface OmMarineDaily {
  time: string[];
  wave_height_max?: (number | null)[];
  wave_direction_dominant?: (number | null)[];
  wave_period_max?: (number | null)[];
}

/**
 * 7-day wave forecast. Inland coordinates answer 200 with all-null wave
 * values — both that case and upstream failures surface as available:false.
 */
export async function fetchMarine(lat: number, lon: number): Promise<MarineResponse> {
  const url =
    `${MARINE_URL}?latitude=${lat}&longitude=${lon}` +
    `&daily=wave_height_max,wave_direction_dominant,wave_period_max&forecast_days=7&timezone=auto`;
  const data = await fetchJson<{ daily?: OmMarineDaily }>(url, NEARSHORE_REVALIDATE);

  const daily: MarineDay[] = (data.daily?.time ?? []).map((date, i) => ({
    date,
    waveHeightMax: data.daily?.wave_height_max?.[i] ?? null,
    waveDirectionDominant: data.daily?.wave_direction_dominant?.[i] ?? null,
    wavePeriodMax: data.daily?.wave_period_max?.[i] ?? null,
  }));
  const available = daily.some((d) => d.waveHeightMax != null);
  return available ? { available: true, daily } : { available: false, daily: [] };
}

interface OmFloodDaily {
  time: string[];
  river_discharge?: (number | null)[];
}

/**
 * 7-day river discharge of the nearest grid cell (GloFAS). The v1 endpoint is
 * the one that works — v2 404s. Fewer days than requested may come back.
 */
export async function fetchFlood(lat: number, lon: number): Promise<FloodResponse> {
  const url =
    `${FLOOD_URL}?latitude=${lat}&longitude=${lon}&daily=river_discharge&forecast_days=7`;
  const data = await fetchJson<{ daily?: OmFloodDaily }>(url, NEARSHORE_REVALIDATE);

  const daily: FloodDay[] = (data.daily?.time ?? []).map((date, i) => ({
    date,
    discharge: data.daily?.river_discharge?.[i] ?? null,
  }));
  const available = daily.some((d) => d.discharge != null);
  return available ? { available: true, daily } : { available: false, daily: [] };
}

/* ------------------------------------------------------------------ */
/* Measured daily actuals (forecast API, past_days) — ledger backfill   */
/* ------------------------------------------------------------------ */

export interface MeasuredDaily {
  /** YYYY-MM-DD → measured high/low (°C). */
  byDate: Record<string, { max: number; min: number }>;
}

/**
 * Measured daily high/low for the last 7 days (forecast API with
 * past_days — analysis data, no ERA5 lag). Powers the forecast-ledger
 * backfill: unscored "morning call" records older than yesterday get
 * their actuals even when the user skipped a day or more.
 */
export async function fetchMeasuredDaily(lat: number, lon: number): Promise<MeasuredDaily> {
  const rlat = Math.round(lat * 10) / 10;
  const rlon = Math.round(lon * 10) / 10;
  const url =
    `${FORECAST_URL}?latitude=${rlat}&longitude=${rlon}` +
    `&past_days=7&forecast_days=1&daily=temperature_2m_max,temperature_2m_min&timezone=auto`;

  const data = await fetchJson<{ daily?: OmArchiveDaily }>(url, 3_600);
  const times = data.daily?.time ?? [];
  const tmaxSeries = data.daily?.temperature_2m_max ?? [];
  const tminSeries = data.daily?.temperature_2m_min ?? [];

  const byDate: Record<string, { max: number; min: number }> = {};
  for (let i = 0; i < times.length; i += 1) {
    const max = tmaxSeries[i];
    const min = tminSeries[i];
    if (max == null || min == null) continue;
    byDate[times[i]] = { max, min };
  }
  return { byDate };
}
