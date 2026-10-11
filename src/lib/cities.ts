import type { City } from '@/types/weather';

/**
 * Curated quick-pick cities for the empty state (id < 0 so they never
 * collide with Open-Meteo geocoding ids).
 */
export const POPULAR_CITIES: City[] = [
  { id: -101, name: 'Mumbai', admin1: 'Maharashtra', country: 'India', countryCode: 'IN', latitude: 19.076, longitude: 72.8777 },
  { id: -102, name: 'Delhi', admin1: 'Delhi', country: 'India', countryCode: 'IN', latitude: 28.6139, longitude: 77.209 },
  { id: -103, name: 'Bengaluru', admin1: 'Karnataka', country: 'India', countryCode: 'IN', latitude: 12.9716, longitude: 77.5946 },
  { id: -104, name: 'London', admin1: 'England', country: 'United Kingdom', countryCode: 'GB', latitude: 51.5072, longitude: -0.1276 },
  { id: -105, name: 'New York', admin1: 'New York', country: 'United States', countryCode: 'US', latitude: 40.7128, longitude: -74.006 },
  { id: -106, name: 'Tokyo', admin1: 'Tokyo', country: 'Japan', countryCode: 'JP', latitude: 35.6895, longitude: 139.6917 },
  { id: -107, name: 'Paris', admin1: 'Île-de-France', country: 'France', countryCode: 'FR', latitude: 48.8566, longitude: 2.3522 },
  { id: -108, name: 'Sydney', admin1: 'New South Wales', country: 'Australia', countryCode: 'AU', latitude: -33.8688, longitude: 151.2093 },
  { id: -109, name: 'Dubai', admin1: 'Dubai', country: 'United Arab Emirates', countryCode: 'AE', latitude: 25.2048, longitude: 55.2708 },
  { id: -110, name: 'Singapore', country: 'Singapore', countryCode: 'SG', latitude: 1.3521, longitude: 103.8198 },
];
