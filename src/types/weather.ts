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
}

export interface WeatherBundle {
  current: CurrentWeather;
  /** Next 24 hours starting at the current hour. */
  hourly: HourlyPoint[];
  /** 7 days starting today. */
  daily: DailyPoint[];
  airQuality: AirQuality | null;
  utcOffsetSeconds: number;
  timezone: string;
  timezoneAbbreviation: string;
  fetchedAt: string;
}
