import dns from 'node:dns';
import net from 'node:net';
import type {
  AirQuality,
  City,
  DailyPoint,
  HourlyPoint,
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
const REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';
const NOMINATIM_UA = 'AetherWeather/1.0 (weather app demo)';

/** Weather changes slowly — 10 minutes of shared cache is plenty. */
const WEATHER_REVALIDATE = 600;
const GEOCODE_REVALIDATE = 86_400;

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

async function fetchJson<T>(url: string, revalidate: number, init?: RequestInit): Promise<T> {
  // Transient network hiccups get one quick retry.
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
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
      if (attempt === 0) await sleep(200);
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
}

const num = (value: number | null | undefined, fallback: number): number =>
  value == null || !Number.isFinite(value) ? fallback : value;

/** Slice the next 24 hours starting at (or just after) the current time. */
function sliceCurrentHour(forecast: OmForecast): HourlyPoint[] {
  const { hourly, current } = forecast;
  const currentHourPrefix = current.time.slice(0, 13); // "YYYY-MM-DDTHH"
  let start = hourly.time.findIndex((t) => t.slice(0, 13) === currentHourPrefix);
  if (start < 0) start = Math.max(0, hourly.time.length - 24);

  const points: HourlyPoint[] = [];
  for (let i = start; i < hourly.time.length && points.length < 24; i += 1) {
    points.push({
      time: hourly.time[i],
      temperature: num(hourly.temperature_2m[i], 0),
      precipitationProbability: num(hourly.precipitation_probability[i], 0),
      precipitation: num(hourly.precipitation[i], 0),
      weatherCode: num(hourly.weather_code[i], 0),
      isDay: num(hourly.is_day[i], 1) === 1,
      visibility: num(hourly.visibility[i], 24_000),
      uvIndex: num(hourly.uv_index[i], 0),
      condition: conditionOf(num(hourly.weather_code[i], 0)),
    });
  }
  return points;
}

export async function fetchWeatherBundle(lat: number, lon: number): Promise<WeatherBundle> {
  const forecastUrl =
    `${FORECAST_URL}?latitude=${lat}&longitude=${lon}` +
    `&current=${CURRENT_FIELDS}&hourly=${HOURLY_FIELDS}&daily=${DAILY_FIELDS}` +
    `&timezone=auto&forecast_days=8&past_hours=1&forecast_hours=30`;

  const airUrl =
    `${AIR_QUALITY_URL}?latitude=${lat}&longitude=${lon}` +
    `&current=european_aqi,us_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone` +
    `&timezone=auto`;

  // Air quality is a nice-to-have: a failure must not break the forecast.
  const [forecast, air] = await Promise.all([
    fetchJson<OmForecast>(forecastUrl, WEATHER_REVALIDATE),
    fetchJson<OmAirQuality>(airUrl, WEATHER_REVALIDATE).catch(() => null),
  ]);

  const current = forecast.current;
  const daily: DailyPoint[] = forecast.daily.time.slice(0, 7).map((date, i) => ({
    date,
    weatherCode: num(forecast.daily.weather_code[i], 0),
    tempMax: num(forecast.daily.temperature_2m_max[i], 0),
    tempMin: num(forecast.daily.temperature_2m_min[i], 0),
    sunrise: forecast.daily.sunrise[i] ?? `${date}T06:00`,
    sunset: forecast.daily.sunset[i] ?? `${date}T18:00`,
    precipitationProbabilityMax: num(forecast.daily.precipitation_probability_max[i], 0),
    uvIndexMax: num(forecast.daily.uv_index_max[i], 0),
    windSpeedMax: num(forecast.daily.wind_speed_10m_max[i], 0),
    condition: conditionOf(num(forecast.daily.weather_code[i], 0)),
  }));

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
    airQuality,
    utcOffsetSeconds: forecast.utc_offset_seconds ?? 0,
    timezone: forecast.timezone ?? 'UTC',
    timezoneAbbreviation: forecast.timezone_abbreviation ?? '',
    fetchedAt: new Date().toISOString(),
  };
}
