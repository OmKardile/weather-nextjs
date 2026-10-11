# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- Weather radar / precipitation map layer
- More saved-city management (reorder, rename)
- Additional languages / localization
- Pluggable AI providers (bring your own key / endpoint)

## [2.0.1] — 2026-10-11

### Added
- Developer credit — the site footer now signs off with "Designed & developed
  by Omkar Kardile" (name links to [omkardile.is-a.dev](https://omkardile.is-a.dev/),
  new tab, hover underline + keyboard focus ring), styled with the existing
  glass footer tokens at WCAG-AA muted ink.
- `metadata.authors` in the app layout now identifies the developer (name +
  URL); `package.json` gains a matching `author` field. README closes with a
  footer credit.

### Changed
- Version bumped to 2.0.1 (settings sheet + package manifest).

## [2.0.0] — 2026-10-11

The "Liquid Glass + AI" release. Aether grows a macOS Tahoe-inspired design system,
a macOS window layout with a ⌘K Spotlight palette, a unified animated icon system,
and four grounded AI features — while every v1.0 feature keeps working.

### Added

- **Liquid Glass design system** (macOS Tahoe): a `<Glass>` primitive with three
  elevation levels — `base` (cards, blur 16/sat 150), `raised` (hero, blur 24/sat 165)
  and `overlay` (palette/dock/modals, blur 36/sat 180) — each layering a gradient
  hairline edge, top specular highlight, fractal-noise grain and layered shadows.
  A pointer-following specular light (`use-specular` hook — rAF-throttled, hover
  devices only, disabled under reduced motion) and a Chromium-only liquid refraction
  sheen (SVG `feTurbulence` + `feDisplacementMap`, hydration-safe UA detection, one
  shared filter instance per page; plain glass fallback elsewhere). Scene tinting:
  `data-tint="<condition>"` on the app root maps all 8 weather conditions to glass
  hues via `--glass-tint`. Documented system rules: ≤ 6 backdrop-filter layers per
  screen, glass-on-glass ≤ 2 deep, no blur on long scrolling lists, scrim for AA
  legibility, concentric radii. The v1 utility classes (`.glass`, `.glass-strong`,
  `.glass-subtle`, `.glass-hover`) keep working with upgraded recipes.
- **macOS window layout**: slim menu bar whose center morphs from city + live clock
  into a compact icon + temp + condition chip as the hero scrolls away; translucent
  cities sidebar (desktop) with live temperatures, weather icons and 12-hour
  temperature sparklines; ⌘K / Ctrl+K **Spotlight command palette** (cmdk) with live
  city search, saved cities, actions, appearance switching and jump-to-section
  navigation; AI inspector as a third column at xl / floating overlay at lg /
  mobile tab; mobile floating glass dock (Today / Cities / Ask AI / Settings) with
  an aurora active pill and magnify-on-hover; mobile snap-point forecast drawer
  (vaul — 0.22 peek / 0.58 half / 0.94 full) with the hero scrolling behind it.
  Desktop is an `h-screen` app shell with independently scrolling columns; mobile
  is natural scroll + dock + drawer.
- **Unified animated icon system**: `<Icon name size animated strokeWidth />` —
  12 gradient-lit weather glyphs (sun, moon, partly-cloudy-day/night, cloudy, fog,
  drizzle, rain, thunder, snow, wind, hail) and 26 UI stroke icons, all with
  `useId`-namespaced gradient/mask ids (collision-free at hourly-strip scale), a
  shared IntersectionObserver pausing off-screen animations, and static rendering
  under `prefers-reduced-motion`. `WeatherIcon` keeps its v1 API as a compatibility
  wrapper; the bespoke v1 icon set and `weather-icons.css` are gone.
- **AI features** (server-side only, `src/lib/ai.ts` is `server-only`):
  - `/api/ai/briefing` — streamed 2–3 sentence daily briefing, 30-min response cache
  - `/api/ai/chat` — grounded chat over the live forecast (8-turn history), streamed,
    never cached, with stop / regenerate in the UI and markdown-lite rendering
    (react-markdown restricted to `p/strong/em/ul/ol/li/code/br`, links stripped)
  - `/api/ai/advisor` — outfit suggestion + 0–100 scores for running, cycling,
    photography, outdoor dining and stargazing; structured JSON via Gemini
    `responseSchema` re-validated with zod
  - `/api/ai/alerts` — notable changes as severity-tagged alerts; facts are
    detected deterministically (temperature swings, thunder/wet windows, UV ≥ 8,
    EAQI ≥ 80, gusts, heat) and the AI only phrases them, with a quiet-day
    short-circuit
  - Streaming routes speak an NDJSON protocol
    (`meta{provider,cached}` → `chunk{text}` → `done` | `error{message}`)
- **AI provider chain with graceful degradation**: Gemini (`@google/genai`,
  `GEMINI_API_KEY` / `GEMINI_MODEL`, default `gemini-3.8-flash`, circuit breaker on
  fatal errors) → z-ai-web-dev-sdk → deterministic rule-based fallback
  (`lib/ai-fallback.ts`). The AI UI never hard-fails and honestly badges the
  provider (sparkle "AI" vs a plain "Summary" label).
- **AI guardrails**: per-IP sliding-window rate limits (20 / 12 / 12 / 20 per minute
  for briefing / chat / advisor / alerts; in-memory with an Upstash-ready shape),
  input capped at 600 characters with control characters stripped, per-route output
  token caps, 25 s deadline combined with client-disconnect abort, response caching
  keyed by rounded coordinates + units, prompt-injection defense (forecast framed
  as data-not-instructions inside the system prompt; the user turn only ever
  contains the question), and the key is never bundled to the client or logged.
- **AI UI components**: streaming BriefingCard, AskAIPanel chat (weather-aware
  suggested chips, stick-to-bottom streaming, Enter/Shift+Enter composer),
  AdvisorCards (outfit + 5 activity score meters) and AlertDigest (info/notice/
  warning severity pills, quiet-day state), plus `use-ai-chat` (NDJSON streaming
  client with abort/regenerate/reset).
- **48-hour hourly data** (was 24): `forecast_hours=54` sliced to the next 48 from
  the current hour, with hourly **wind speed** added to the data contract; the
  hourly strip shows all 48 hours while the SVG chart keeps its curated 24-hour
  view.
- **Moon phase card**: zero-dependency phase math (`lib/moon.ts`) with a rendered
  moon disc, illumination %, phase name and full-moon countdown.
- **Theme override**: Auto / Light / Dark appearance (persisted via zustand,
  selectable in Settings and the command palette); Auto follows the scene's natural
  surface, manual picks force the light/dark token set.
- **Settings sheet**: units segmented control, appearance segmented control, an AI
  explanation + disclaimer, keyboard hints and credits — shared by the desktop
  dialog and the mobile Settings tab.
- **Environment variable support**: optional `GEMINI_API_KEY` and `GEMINI_MODEL`
  (documented in a new `.env.example`); the app degrades gracefully without them.
- **Dependency**: added `@google/genai` `^2.28.0` — the official Google Gen AI SDK,
  required by the v2 spec — the only dependency added to the project manifest in
  this release. (`cmdk`, `framer-motion`, `react-markdown`, `vaul`, `zod` and
  `z-ai-web-dev-sdk` were already present in the workspace and are now first-class
  app dependencies: palette, motion presets + dock, markdown-lite, snap-point
  drawer, AI payload/schema validation, and the secondary AI provider.)

### Changed

- Hourly data contract extended (`HourlyPoint.windSpeed`); additive — all v1
  components unaffected.
- `src/app/globals.css`: shadcn/ui variables (background, card, popover, border,
  input, sidebar, …) are now scene-aware under `[data-surface="light"]`, so
  dialogs, the command palette, dropdowns and toasts match light scenes with ink
  text on frosted surfaces.
- Open-Meteo client fetch hardening: 3 attempts with escalating backoff on
  transient upstream failures (previously 1 retry).
- Hourly strip renders the full 48 hours; section retitled "Next 48 hours".
- README rewritten for v2 (design system, AI, layout, env vars, structure).

### Fixed

- Duplicate SVG gradient id in the v1 `Logo` component (namespaced with `useId` —
  was colliding with the new icon system's gradients).
- Mobile forecast drawer peek snap raised 0.14 → 0.22 so the grabber clears the
  floating dock.
- Jump-to-section targets now carry stable `id` attributes (hourly / daily / air /
  details / advisor) — ⌘K "Jump to" scrolls correctly on desktop and opens the
  drawer at the right section on mobile.

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

[Unreleased]: https://github.com/aether/aether-weather/compare/v2.0.1...HEAD
[2.0.1]: https://github.com/aether/aether-weather/releases/tag/v2.0.1
[2.0.0]: https://github.com/aether/aether-weather/releases/tag/v2.0.0
[1.0.0]: https://github.com/aether/aether-weather/releases/tag/v1.0.0
