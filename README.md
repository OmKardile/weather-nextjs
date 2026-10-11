# Aether — Weather, elevated.

> A premium, weather-reactive PWA weather app. Live conditions, 24-hour trends, a 7-day outlook and air quality — rendered against a full-viewport sky that changes with the weather and the time of day.

![Next.js](https://img.shields.io/badge/Next.js-16-black) ![React](https://img.shields.io/badge/React-19-149ECA) ![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6) ![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38BDF8) ![PWA](https://img.shields.io/badge/PWA-offline--shell-5A0FC8) ![API keys](https://img.shields.io/badge/API_keys-zero-22BCA0) ![License](https://img.shields.io/badge/License-MIT-45D1B3)

Aether is a ground-up rebuild of [OmKardile/weather-nextjs](https://github.com/OmKardile/weather-nextjs): rebranded, rewritten in strict TypeScript on Next.js 16 + React 19, and freed from hardcoded API keys by moving all weather data to the keyless [Open-Meteo](https://open-meteo.com/) API behind server-side route handlers.

## Features

**Weather-reactive scene engine** — 32 hand-tuned scenes (8 conditions × 4 day phases: day / dawn / dusk / night). Canvas-rendered rain and snow particles, twinkling stars with a shooting star, moon and sun with golden-hour halos, drifting aurora curtains, parallax clouds, fog banks and lightning — all crossfading over 600 ms whenever the sky changes.

**Weather data (Open-Meteo)**
- City search with debounced autocomplete (300 ms, country flags, full keyboard navigation, `/` shortcut)
- Current conditions with a live location-local clock, feels-like, today's hi/lo
- 24-hour forecast strip plus a hand-rolled interactive SVG temperature chart (hover/touch scrub, keyboard-navigable, precipitation-probability bars)
- 7-day forecast with week-normalized temperature range bars
- Full metric grid: wind speed + 16-point compass direction, humidity + dew point, UV index with scale marker, visibility, pressure, cloud cover, precipitation chance, and a sun-arc with live daylight progress
- European Air Quality Index (EAQI) with pollutant breakdown (PM2.5 / PM10 / O₃ / NO₂) and dominant pollutant

**UX niceties**
- Geolocation with graceful fallback (permission denied → friendly toast, not a dead end)
- Saved cities (up to 8) with live temperatures, persisted to `localStorage`, plus last-visited-city restore
- Unit toggles: °C/°F + km/h/mph (and 24 h/12 h time) — instant, no refetch
- Mobile-first responsive layout, sticky glass top bar, safe-area aware

**PWA** — installable, with an offline shell service worker (precached shell, network-first navigations, cache-first statics; API calls always live).

**Accessibility** — full keyboard support (search combobox, chart scrubbing, everything reachable), ARIA live announcements for weather and status changes, screen-reader labels on all controls, and `prefers-reduced-motion` support across every animation.

## Tech stack & architecture

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack, route handlers) |
| UI | React 19, Tailwind CSS 4 (CSS-first `@theme` tokens), shadcn/ui-style primitives, lucide-react |
| Data fetching | TanStack Query (60 s stale time, 1 retry, keeps last good data on refetch failure) |
| State | zustand with `persist` middleware (units, saved cities, last city) |
| Charts | Hand-rolled SVG — a few kB instead of a chart library |
| Language | TypeScript, strict mode, zero `any` in app code |
| Fonts | Sora (display) + Inter (text) via `next/font` |

Architecture highlights:

- **Server-side data proxy** — `/api/weather` and `/api/geocode` route handlers call Open-Meteo server-side with a 10-minute shared cache. No API keys, no client-visible upstream URLs, and Nominatim's User-Agent requirement is handled where it belongs (the server).
- **Metric always, convert client-side** — the API returns metric values only; the client converts units instantly without a refetch.
- **Single data contract** — `src/types/weather.ts` defines the `WeatherBundle` that flows from the API through TanStack Query into every component.
- **Scene = f(condition, phase)** — `src/lib/scenes.ts` maps WMO weather codes × day phase to a `SceneConfig`; the scene engine is a pure consumer of that config.
- **Zero API keys, zero env vars required** — clone and run.

## Quick start

```bash
npm install        # or: bun install / pnpm install

npm run dev        # start the dev server on http://localhost:3000

npm run build      # production build
npm start          # serve the production build

npm run lint       # eslint
npm run icons      # regenerate PWA PNGs (public/icons, src/app/apple-icon.png) from the brand SVG via sharp
```

## Project structure

```
├── public/
│   ├── icons/                  # PWA PNG icons (192 / 512 / maskable-512)
│   ├── logo.svg                # brand mark
│   ├── robots.txt
│   └── sw.js                   # offline-shell service worker
├── scripts/
│   └── generate-icons.mjs      # sharp-based PWA icon generator (npm run icons)
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── geocode/route.ts    # GET ?q=<query> (search) | ?lat=&lon= (reverse)
│   │   │   └── weather/route.ts    # GET ?lat=&lon= — Open-Meteo proxy (forecast + air quality)
│   │   ├── globals.css         # Tailwind 4 @theme design tokens, glass utilities, motion keyframes
│   │   ├── layout.tsx          # Sora + Inter fonts, metadata, providers, toaster
│   │   ├── manifest.ts         # PWA web app manifest
│   │   ├── icon.svg            # favicon (source for PNG icons)
│   │   ├── apple-icon.png      # iOS touch icon
│   │   ├── opengraph-image.tsx # dynamic OG image (next/og)
│   │   ├── instrumentation.ts  # IPv4-first DNS / Happy-Eyeballs at server boot
│   │   └── page.tsx            # renders <AetherApp />
│   ├── components/
│   │   ├── brand/Logo.tsx      # logo mark + AETHER wordmark
│   │   ├── providers.tsx       # TanStack Query provider + SW registration (production only)
│   │   ├── ui/                 # shadcn-style primitives (toast, toaster)
│   │   └── weather/            # the app: AetherApp orchestrator, search, hero, hourly,
│   │       │                   #   chart, daily, metrics, air quality, saved cities,
│   │       │                   #   state views, footer, weather icons
│   │       └── scene/          # canvas rain/snow + CSS layer scene engine
│   ├── hooks/                  # use-weather, use-city-search, use-geolocation,
│   │                           #   use-preferences (zustand persist), use-toast, use-mobile
│   ├── lib/                    # openmeteo (server client), wmo (code→condition),
│   │                           #   units (converters/formatters), aqi, time (location-local),
│   │                           #   scenes (32 configs), cities, utils
│   └── types/weather.ts        # shared data contract
├── components.json
├── eslint.config.mjs
├── next.config.ts
├── package.json
├── postcss.config.mjs
└── tsconfig.json
```

## Configuration

**No environment variables are required.** All upstream data is keyless.

Optional:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Absolute base URL for Open Graph / canonical metadata (e.g. `https://aether.example.com`). Falls back to `http://localhost:3000`. |

## Debug & QA

Force any background scene without waiting for the weather:

```
http://localhost:3000/?scene=<condition>&phase=<phase>
```

- `scene`: `clear` · `partly-cloudy` · `cloudy` · `fog` · `drizzle` · `rain` · `snow` · `thunder`
- `phase`: `day` · `dawn` · `dusk` · `night`

A small badge in the bottom-left corner confirms the override is active. Handy for checking all 32 scene combinations (e.g. `?scene=thunder&phase=night` for lightning, `?scene=snow&phase=day` for snowfall).

## Data & credits

- **[Open-Meteo](https://open-meteo.com/)** — weather forecast (ECMWF/GFS blend) and city geocoding. Free for non-commercial use, no API key.
- **CAMS European Air Quality** — air-quality data (EAQI, PM2.5, PM10, O₃, NO₂), served via Open-Meteo's air-quality API.
- **[Nominatim](https://nominatim.openstreetmap.org/)** (OpenStreetMap) — reverse geocoding for the "use my location" feature. Its User-Agent policy is handled server-side in the route handler.

## PWA notes

- The service worker registers **in production only**. In dev, Turbopack serves chunks at stable URLs and a cache-first worker would keep serving stale code across hot reloads.
- The worker precaches the app shell and icons, serves navigations network-first with an offline fallback, caches static assets, and never caches `/api/*` (weather must be fresh).
- The app is fully installable once deployed over HTTPS (or `localhost`).

## Deploy

Works on **Vercel** as-is — zero configuration. Just import the repo; `next build` handles the rest. Any Node host works too:

```bash
npm run build && npm start
```

## Browser support

Targets modern evergreen browsers (latest Chrome, Edge, Firefox, Safari). `backdrop-filter` powers the glass aesthetic and degrades gracefully where unsupported. Animations are transform/opacity-only and pause on hidden tabs.

## License

[MIT](./LICENSE) — © 2026 Aether contributors. Weather data by Open-Meteo (CC-BY 4.0).
