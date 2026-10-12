export type Condition =
  | 'clear'
  | 'partly-cloudy'
  | 'cloudy'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'snow'
  | 'thunder';

export type DayPhase = 'night' | 'dawn' | 'day' | 'dusk';

export type Units = 'metric' | 'imperial';

export interface City {
  /** Stable id (Open-Meteo geocoding id, or negative hash for located places). */
  id: number;
  name: string;
  /** Region / state / province. */
  admin1?: string;
  country: string;
  /** ISO 3166-1 alpha-2 code, used for flag emoji. */
  countryCode?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
  source?: 'search' | 'location';
}

export interface CurrentWeather {
  /** Local ISO time at the location, e.g. 2025-06-01T14:15 */
  time: string;
  /** °C (always metric from the API; convert client-side). */
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  isDay: boolean;
  /** mm */
  precipitation: number;
  weatherCode: number;
  cloudCover: number;
  /** hPa (mean sea level) */
  pressure: number;
  /** km/h */
  windSpeed: number;
  /** km/h */
  windGust: number;
  /** Meteorological degrees (0 = from north). */
  windDirection: number;
  condition: Condition;
}

export interface HourlyPoint {
  time: string;
  /** °C */
  temperature: number;
  /** % */
  precipitationProbability: number;
  /** mm */
  precipitation: number;
  weatherCode: number;
  isDay: boolean;
  /** meters */
  visibility: number;
  uvIndex: number;
  /** km/h */
  windSpeed: number;
  condition: Condition;
}

export interface DailyPoint {
  /** YYYY-MM-DD */
  date: string;
  weatherCode: number;
  /** °C */
  tempMax: number;
  tempMin: number;
  /** Local ISO. */
  sunrise: string;
  sunset: string;
  /** Local ISO — civil twilight begin (sun at −6°, dawn side). */
  civilTwilightBegin?: string;
  /** Local ISO — civil twilight end (sun at −6°, dusk side). */
  civilTwilightEnd?: string;
  precipitationProbabilityMax: number;
  uvIndexMax: number;
  /** km/h */
  windSpeedMax: number;
  condition: Condition;
}

export interface AirQuality {
  europeanAqi: number | null;
  usAqi: number | null;
  /** µg/m³ */
  pm2_5: number | null;
  pm10: number | null;
  ozone: number | null;
  no2: number | null;
  so2: number | null;
  co: number | null;
  time: string;
  /** Next-24h European AQI points for the trend sparkline; null when uncovered. */
  trend?: Array<{ time: string; value: number }> | null;
}

export interface WeatherBundle {
  current: CurrentWeather;
  /** Next 24 hours starting at the current hour. */
  hourly: HourlyPoint[];
  /** 16 days starting today. */
  daily: DailyPoint[];
  /** Yesterday's measured high/low (past_days=1 upstream); null when unavailable. */
  yesterday?: { date: string; tempMax: number; tempMin: number } | null;
  airQuality: AirQuality | null;
  /** 15-minute precipitation nowcast for the next 2 hours (8 points); null when the nowcast call fails. */
  minutely?: MinutelyPoint[] | null;
  /** Pollen summary for the next 24 hours (European coverage only); null when unavailable. */
  pollen?: Pollen | null;
  utcOffsetSeconds: number;
  timezone: string;
  timezoneAbbreviation: string;
  fetchedAt: string;
}

/* ------------------------------------------------------------------ */
/* Nowcast + pollen (bundle extensions)                                */
/* ------------------------------------------------------------------ */

export interface MinutelyPoint {
  /** Local ISO time at the location, e.g. 2025-06-01T14:15 */
  time: string;
  /** mm of precipitation within the 15-minute step. */
  precip: number;
  /** % */
  precipProbability: number;
}

export interface Pollen {
  /** True when the upstream actually provides pollen data here (Europe only). */
  available: boolean;
  /** Local ISO time the 24h window starts at. */
  time: string;
  /** Max grains/m³ over the next 24 hours; null when that type has no data. */
  alder: number | null;
  birch: number | null;
  grass: number | null;
  ragweed: number | null;
  olive: number | null;
  mugwort: number | null;
}

/* ------------------------------------------------------------------ */
/* Multi-model comparison / ensemble                                   */
/* ------------------------------------------------------------------ */

export interface ModelHourlyPoint {
  /** Local ISO hour, e.g. 2025-06-01T14:00 */
  time: string;
  /** °C */
  temp: number;
  /** mm */
  precip: number;
}

export interface ModelSeries {
  /** 'ecmwf' | 'gfs' | 'icon' */
  id: string;
  label: string;
  hourly: ModelHourlyPoint[];
}

export interface ModelsResponse {
  models: ModelSeries[];
}

export interface EnsembleHourly {
  /** Local ISO hour, e.g. 2025-06-01T14:00 */
  time: string;
  /** °C — ensemble mean. */
  temp: number;
  /** °C — ensemble spread (uncertainty band ±σ); null when member data is missing. */
  tempSpread: number | null;
  /** mm */
  precip: number;
}

export interface EnsembleResponse {
  hourly: EnsembleHourly[];
}

/* ------------------------------------------------------------------ */
/* Historical climate normals / marine / flood                         */
/* ------------------------------------------------------------------ */

export interface HistoricalYear {
  year: number;
  /** °C — daily max on that date; null when the date doesn't exist (e.g. Feb 29 in a non-leap year). */
  tmax: number | null;
  tmin: number | null;
}

export interface HistoricalResponse {
  /** 1–12 */
  month: number;
  /** 1–31 */
  day: number;
  /** One entry per year of the 1995 → last-complete-year archive range. */
  years: HistoricalYear[];
  /** Mean across the years that have data (°C, 1 decimal); null when nothing matched. */
  normal: { tmax: number | null; tmin: number | null };
}

export interface MarineDay {
  /** YYYY-MM-DD */
  date: string;
  /** m */
  waveHeightMax: number | null;
  /** Meteorological degrees (0 = from north). */
  waveDirectionDominant: number | null;
  /** s */
  wavePeriodMax: number | null;
}

export interface MarineResponse {
  /** False for inland locations and upstream failures — check before using daily. */
  available: boolean;
  daily: MarineDay[];
}

export interface FloodDay {
  /** YYYY-MM-DD */
  date: string;
  /** m³/s river discharge of the nearest grid cell. */
  discharge: number | null;
}

export interface FloodResponse {
  available: boolean;
  daily: FloodDay[];
}

/* ------------------------------------------------------------------ */
/* Geo & space events (map layers / sky mode)                          */
/* ------------------------------------------------------------------ */

export interface GeoQuake {
  id: string;
  magnitude: number;
  place: string;
  /** ISO */
  time: string;
  latitude: number;
  longitude: number;
  depthKm: number;
  url: string;
  tsunami: boolean;
}

export interface KpPoint {
  /** ISO */
  time: string;
  /** Planetary K-index, 0–9. */
  kp: number;
}

export interface SpaceWeather {
  latestKp: number;
  /** Last ~3 days, 3-hour steps. */
  series: KpPoint[];
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/* Unified weather alerts (official feeds + Aether-computed)            */
/* ------------------------------------------------------------------ */

export type AlertSource = 'nws' | 'meteoalarm' | 'sachet' | 'computed';

export type AlertSeverity = 'extreme' | 'severe' | 'moderate' | 'minor' | 'info';

export interface Alert {
  /** Feed-stable identifier (feed id/URN, or a deterministic key for computed). */
  id: string;
  /** Originating feed — 'computed' marks alerts derived by Aether itself. */
  source: AlertSource;
  title: string;
  description: string;
  severity: AlertSeverity;
  /** CAP urgency, e.g. 'Immediate' | 'Expected' | 'Future' | 'Past' | 'Unknown'. */
  urgency?: string;
  /** Human-readable areas covered (NWS areaDesc, CAP areaDesc). */
  areas?: string;
  /** Local/ISO start of the alert window. */
  onset?: string;
  /** Local/ISO end of the alert window. */
  expires?: string;
  /** External page for the official product. */
  link?: string;
}
