# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- Weather radar / precipitation map layer
- More saved-city management (reorder, rename)
- Additional languages / localization

## [1.0.0] — 2026-10-11

First official release. A complete rebrand and ground-up rebuild of
[OmKardile/weather-nextjs](https://github.com/OmKardile/weather-nextjs) — nothing is
reused from the original except the product idea.

### Added

- **Identity**: rebranded to **Aether** — "Weather, elevated." — with a custom logo
  mark (sun over waves, aurora gradient), Sora + Inter type pairing, and a calm,
  premium glass design system built on Tailwind CSS 4 CSS-first `@theme` tokens.
- **Platform rewrite**: migrated from Next.js 13 / JavaScript (TypeScript installed
  but unused) to **Next.js 16 App Router + React 19 + strict TypeScript**, with
  Turbopack, route handlers, and `next/font`.
- **Keyless data layer**: replaced the hardcoded OpenWeatherMap API key (previously
  shipped in client code) with **Open-Meteo** behind server-side route handlers —
  `/api/weather` and `/api/geocode` — with a 10-minute shared cache, one-retry
  resilience, and IPv4-first/Happy-Eyeballs network hardening at server boot.
  Zero API keys, zero required environment variables.
- **Weather-reactive scene engine**: 32 hand-tuned full-viewport scenes
  (8 conditions × 4 day phases) with 600 ms crossfades — canvas rain/snow
  particles, twinkling stars with a shooting star, moon, sun with golden-hour
  halo, aurora curtains, parallax clouds, fog banks, and lightning — all
  transform/opacity-only, hidden-tab aware, and reduced-motion safe.
- **City search**: ARIA-combobox autocomplete over Open-Meteo geocoding with
  300 ms debounce, country flags, full keyboard navigation, a `/` shortcut,
  and no-results / error states.
- **Current conditions hero**: live location-local clock, feels-like, hi/lo,
  precipitation, wind chip, sun chip, bookmark-save, and refresh with stale-data
  preservation on failure.
- **24-hour forecast**: snap-scrolling hourly strip plus a hand-rolled interactive
  SVG temperature chart — Catmull-Rom → Bézier curve, min/max pills, hover/touch
  scrubbing with tooltip, keyboard navigation, aria-live announcements, and
  precipitation-probability bars.
- **7-day forecast** with week-normalized temperature range bars and bespoke
  animated weather icons (8 conditions × day/night).
- **Full metric grid**: wind + 16-point compass with rotating needle, humidity +
  dew point, UV index with scale marker, visibility, pressure, cloud cover,
  precipitation, and a live sun-arc with daylight length.
- **Air quality**: European AQI (EAQI) with a 6-segment scale marker, PM2.5 /
  PM10 / O₃ / NO₂ breakdown, dominant pollutant, US AQI note, and a graceful
  empty state where coverage is unavailable.
- **Geolocation** with graceful fallback: reverse-geocoded city name via
  Nominatim (User-Agent handled server-side) and friendly toasts on denial or
  failure — never a dead end.
- **Saved cities** (up to 8) with live per-city temperatures, quick switching and
  removal, persisted to `localStorage` via zustand `persist`, plus
  last-visited-city restore on reload.
- **Unit preferences**: °C/°F, km/h/mph and 24 h/12 h time — toggled instantly
  on the client (API always returns metric; no refetch needed).
- **PWA**: web app manifest, generated PNG icon set (192/512/maskable via a
  sharp script), apple touch icon, dynamic Open Graph image, and an offline-shell
  service worker — precached shell, network-first navigations, cache-first
  statics, never `/api/*`. Registers in production only.
- **Accessibility**: full keyboard operability (search combobox, chart scrubbing,
  focus rings everywhere), ARIA live-region status announcements, screen-reader
  labels, and `prefers-reduced-motion` support across scene engine, chart and
  micro-interactions.
- **Developer experience**: mobile-first responsive layout, loading skeletons,
  error/empty states with popular-city shortcuts and retry, offline banner,
  `?scene=&phase=` debug overrides with a QA badge, ESLint-clean strict TS.

### Fixed
- Eliminated the original app's "spinner never shows" bug class (a synchronous
  `setLoading(false)` racing the fetch promise) by rewriting data flow around
  TanStack Query with proper loading skeletons, placeholder data and error states.
- Removed the hardcoded OpenWeatherMap API key from the client bundle entirely
  (replaced by keyless Open-Meteo via server routes).

[Unreleased]: https://github.com/aether/aether-weather/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/aether/aether-weather/releases/tag/v1.0.0
