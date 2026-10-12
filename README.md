# Aether — Weather, elevated.

> A premium, weather-reactive PWA weather app with a macOS "Liquid Glass" design system and a grounded AI layer. Live conditions, a 48-hour outlook, 7-day forecast and air quality — rendered inside a macOS-style window shell over a full-viewport sky that changes with the weather and the time of day.

![Next.js](https://img.shields.io/badge/Next.js-16-black) ![React](https://img.shields.io/badge/React-19-149ECA) ![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6) ![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38BDF8) ![PWA](https://img.shields.io/badge/PWA-offline--shell-5A0FC8) ![Weather data](https://img.shields.io/badge/Weather_data-keyless-22BCA0) ![AI](https://img.shields.io/badge/AI-Gemini%20%2B%20fallbacks-8B5CF6) ![License](https://img.shields.io/badge/License-MIT-45D1B3)

Aether is a ground-up rebuild of [OmKardile/weather-nextjs](https://github.com/OmKardile/weather-nextjs): rebranded, rewritten in strict TypeScript on Next.js 16 + React 19, and freed from hardcoded API keys by moving all weather data to the keyless [Open-Meteo](https://open-meteo.com/) API behind server-side route handlers. v2 adds the macOS Tahoe **Liquid Glass** design language, a macOS window layout with a ⌘K Spotlight palette, a unified animated icon system, and four server-side **AI features** (briefing, chat, advisor, alert digest) that degrade gracefully all the way down to deterministic rule-based text.

## Features

**Liquid Glass design system (macOS Tahoe)** — a two-layer iOS 27 material system — `<LiquidGlass>` controls (runtime 3-pass RGB refraction, opposing-corner rim light, press gel, ≤3 lens filters) over flat `<Glass>`/Surface content cards, with a hero composed directly on the sky. Every surface adapts to the live weather via `[data-tint]`/`[data-surface]`, and a Settings transparency slider (Ultra Clear → Fully Tinted) drives tint, blur, refraction and rim brightness. On devices with a motion sensor, an opt-in **Tilt highlights** setting makes the specular light drift with the physical tilt of the device (permission-gated on iOS).

**macOS window layout**
- Slim menu bar whose center morphs from city + live clock into a compact icon + temp + condition chip as the hero scrolls away (iOS Weather behavior)
- Translucent cities sidebar (desktop) with live temperatures, weather icons and 12-hour temperature sparklines
- **⌘K / Ctrl+K Spotlight command palette** — live city search, saved cities, actions, card customization and jump-to-section navigation, fully keyboard-driven
- AI inspector column (xl) / floating overlay (lg) / mobile tab — the same grounded chat panel in every breakpoint
- Mobile: a floating Liquid Glass capsule dock (Today / Map / Ask AI / Cities / Settings) with a morphing selection capsule, plus a snap-point forecast drawer (peek / half / full) whose content always clears the dock
- Saved cities: live-temp sidebar rows with sparklines, a side-by-side Compare dialog (comfort score, "Best now" badge), and drag-to-reorder on both desktop and mobile
- Scene-driven theming: the interface follows the live sky at the selected city — dawn, day, dusk and night re-skin every glass surface (no manual dark mode to get wrong)

**AI, grounded in your forecast** (server-side only, [details below](#ai-features))
- **Briefing** — a streamed 2–3 sentence daily summary with the one practical takeaway
- **Ask Aether** — a chat that answers questions strictly from the live forecast data (weather-aware suggested questions, stop / regenerate, markdown-lite rendering)
- **Smart Advisor** — an outfit recommendation plus 0–100 suitability scores for running, cycling, photography, outdoor dining and stargazing
- **Alert digest** — notable changes (temperature swings, thunder windows, UV peaks, poor air quality) phrased as severity-tagged alerts; deterministic fact detection keeps it grounded by construction

**Weather-reactive scene engine** — 32 hand-tuned scenes (8 conditions × 4 day phases: day / dawn / dusk / night). Canvas-rendered rain and snow particles, twinkling stars with a shooting star, moon and sun with golden-hour halos, drifting aurora curtains, parallax clouds, fog banks and lightning — all crossfading over 600 ms whenever the sky changes.

**Weather data (Open-Meteo)**
- City search with debounced autocomplete (300 ms, country flags, full keyboard navigation, `/` shortcut)
- Current conditions with a live location-local clock, feels-like, today's hi/lo, a **“+2° vs yesterday” chip** (today's forecast high vs yesterday's measured high — trend icon, color-coded direction), and a **visit-streak flame chip** (consecutive daily visits, amber ember that glows at 7+ days)
- 48-hour hourly strip (hourly wind speed included) with **golden-hour highlighting** (photogenic hours glow warm) plus a hand-rolled interactive SVG temperature chart (hover/touch scrub, keyboard-navigable, precipitation-probability bars) — the giant hero readout **counts to its new value** on city switch and unit toggle (eased, tabular-nums, reduced-motion-safe)
- 7-day forecast with week-normalized temperature range bars
- **Forecast log — Aether scores itself**: each day's forecast high/low is recorded on first view and graded against the measured sky the next day (a backfill pass grades missed days via measured actuals); the card shows a rolling accuracy verdict, a last-7-days error-bar strip, and avg-miss / days-scored / clean-days tiles (own localStorage ledger, validated + capped)
- Full metric grid: wind speed + 16-point compass direction, humidity + dew point, UV index with scale marker, visibility, pressure, cloud cover, precipitation chance, and a sun-arc with live daylight progress
- **Sun safety** — the 48-hour UV curve as a band-colored chart with a now-marker and peak dot, personalized unprotected burn-time estimates by Fitzpatrick skin type I–VI (ISO erythemal-dose arithmetic, persisted preference), an SPF-30 line and the day's low-UV window; the **outing planner** answers “what about my 14:00 walk?” — a slider (or a tap on the curve) picks any half-hour in the next 12 h and gets the interpolated UV, an unprotected/SPF-30 burn estimate for your skin type, and a plain-language protection verdict
- Moon phase card — phase name, illumination % and a full-moon countdown (zero-dependency calculation)
- **Daylight tracker** — a semicircle solstice gauge placing today's daylight between the year's shortest and longest day at this latitude, a signed +Xm/day daylight-delta chip, sunrise / sunset / night pills, and the time to the next solstice
- European Air Quality Index (EAQI) with pollutant breakdown (PM2.5 / PM10 / O₃ / NO₂), dominant pollutant, and a **24-hour AQI trend sparkline** (band-colored line, peak marker with time, screen-reader summary)

**UX niceties**
- Geolocation with graceful fallback (permission denied → friendly toast, not a dead end)
- Saved cities (up to 8) with live temperatures, persisted to `localStorage`, plus last-visited-city restore
- **Living tab** — the browser tab is a thermometer: a canvas favicon (scene-gradient backdrop + live temperature) and a live document title ("20° Clear · Tokyo — Aether"), redrawn only on real changes
- Unit toggles: °C/°F + km/h/mph (and 24 h/12 h time) — instant, no refetch
- **Achievements** — ten unlockable badges (storm chaser, night owl, cartographer, stargazer, sharer, truth seeker, kindling, globe-trotter …) with toasts and a Settings shelf that tracks your **true consecutive visit streak** (current + best); everything is local-only

**PWA** — installable, with an offline shell service worker (precached shell, network-first navigations, cache-first statics; API calls always live).

**Accessibility** — full keyboard support (search combobox, chart scrubbing, command palette, everything reachable), ARIA live announcements for weather and status changes, screen-reader labels on all controls, and `prefers-reduced-motion` support across every animation (including icons and the specular light).

## Tech stack & architecture

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack, route handlers) |
| UI | React 19, Tailwind CSS 4 (CSS-first `@theme` tokens), shadcn/ui-style primitives, lucide-react |
| Glass / motion | `<Glass>` primitive + `use-specular` hook; framer-motion springs (`lib/motion.ts`) |
| Icons | Bespoke `<Icon name size animated strokeWidth />` system — no icon-font, no emoji |
| Palette / drawer | cmdk (⌘K command palette), vaul (snap-point drawer) |
| AI | `@google/genai` (Gemini) → z-ai-web-dev-sdk → deterministic fallback; zod-validated payloads & structured outputs; react-markdown (markdown-lite rendering) |
| Data fetching | TanStack Query (60 s stale time, 1 retry, keeps last good data on refetch failure) |
| State | zustand with `persist` middleware (units, theme, saved cities, last city) |
| Charts | Hand-rolled SVG — a few kB instead of a chart library |
| Language | TypeScript, strict mode, zero `any` in app code |
| Fonts | Sora (display) + Inter (text) via `next/font` |

Architecture highlights:

- **Server-side data proxy** — `/api/weather` and `/api/geocode` route handlers call Open-Meteo server-side with a 10-minute shared cache. No API keys, no client-visible upstream URLs, and Nominatim's User-Agent requirement is handled where it belongs (the server).
- **AI never trusts the client** — the AI routes receive only a city name + coordinates, re-fetch the forecast server-side, and answer from that. `src/lib/ai.ts` is `server-only`.
- **Metric always, convert client-side** — the API returns metric values only; the client converts units instantly without a refetch.
- **Scene = f(condition, phase)** — `src/lib/scenes.ts` maps WMO weather codes × day phase to a `SceneConfig`; the scene engine is a pure consumer of that config, and the same config drives `data-surface` (light/dark tokens) and `data-tint` (glass hue).
- **One icon component** — `WeatherIcon` (v1 API) is now a thin compatibility wrapper over the unified `<Icon />` system, so the hero, hourly strip and daily rows all share one implementation.
- **Zero required environment variables** — clone and run; the AI layer degrades gracefully (see below).

## Quick start

```bash
npm install        # or: bun install / pnpm install

npm run dev        # start the dev server on http://localhost:3000

npm run build      # production build
npm start          # serve the production build

npm run lint       # eslint
npm run icons      # regenerate PWA PNGs (public/icons, src/app/apple-icon.png) from the brand SVG via sharp
```

Optional — enable Gemini AI (the app works fine without it):

```bash
cp .env.example .env    # then set GEMINI_API_KEY=... (https://aistudio.google.com/apikey)
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
│   │   │   ├── ai/             # POST briefing / chat / advisor / alerts (streamed NDJSON)
│   │   │   ├── geocode/route.ts    # GET ?q=<query> (search) | ?lat=&lon= (reverse)
│   │   │   └── weather/route.ts    # GET ?lat=&lon= — Open-Meteo proxy (forecast + air quality)
│   │   ├── globals.css         # Tailwind 4 @theme tokens, [data-tint] glass tints,
│   │   │                       #   scene-aware shadcn vars, motion keyframes
│   │   ├── layout.tsx          # Sora + Inter fonts, metadata, providers, toaster
│   │   ├── manifest.ts         # PWA web app manifest
│   │   ├── icon.svg            # favicon (source for PNG icons)
│   │   ├── apple-icon.png      # iOS touch icon
│   │   ├── opengraph-image.tsx # dynamic OG image (next/og)
│   │   ├── instrumentation.ts  # IPv4-first DNS / Happy-Eyeballs at server boot
│   │   └── page.tsx            # renders <AetherApp />
│   ├── components/
│   │   ├── ai/                 # BriefingCard, AskAIPanel, AdvisorCards, AlertDigest,
│   │   │                       #   ai-shared (NDJSON reader, badge, markdown-lite)
│   │   ├── brand/Logo.tsx      # logo mark + AETHER wordmark
│   │   ├── glass/              # <Glass> primitive + glass.css (Liquid Glass levels)
│   │   ├── icons/              # <Icon /> system + icons.css (weather + UI glyph sets)
│   │   ├── layout/             # MenuBar, CitiesSidebar, CommandPalette, MobileDock,
│   │   │                       #   ForecastDrawer, SettingsSheet (macOS window shell)
│   │   ├── providers.tsx       # TanStack Query provider + SW registration (production only)
│   │   ├── ui/                 # shadcn-style primitives actually used
│   │   │                       #   (command, dialog, toast, toaster)
│   │   └── weather/            # the app: AetherApp orchestrator, hero, ForecastSections,
│   │       │                   #   hourly, chart, daily, metrics, air quality, moon phase,
│   │       │                   #   saved cities, state views, footer, WeatherIcon wrapper
│   │       └── scene/          # canvas rain/snow + CSS layer scene engine
│   ├── hooks/                  # use-weather, use-city-search, use-geolocation, use-ai-chat,
│   │                           #   use-specular, use-preferences (zustand persist),
│   │                           #   use-toast
│   ├── lib/                    # ai (provider chain + guardrails), ai-fallback (deterministic),
│   │                           #   openmeteo (server client), wmo (code→condition),
│   │                           #   units (converters/formatters), aqi, time (location-local),
│   │                           #   moon (phase math), motion (framer-motion presets),
│   │                           #   scenes (32 configs), cities, utils
│   └── types/                  # weather.ts + ai.ts shared data contracts
├── components.json
├── eslint.config.mjs
├── next.config.ts
├── package.json
├── postcss.config.mjs
└── tsconfig.json
```

## Configuration

**No environment variables are required.** All weather data is keyless, and every AI feature falls back to deterministic rule-based text when no key is configured.

Optional — see `.env.example`:

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Google Gemini API key ([get one free](https://aistudio.google.com/apikey)). Server-side only — never bundled, never logged. Without it the AI layer uses its fallback chain and the app still works. |
| `GEMINI_MODEL` | Gemini model id. Defaults to `gemini-3.8-flash` (the current fast flash model). Override to pin or preview another model. |
| `NEXT_PUBLIC_SITE_URL` | Absolute base URL for Open Graph / canonical metadata (e.g. `https://aether.example.com`). Falls back to `http://localhost:3000`. |

## Design system

### Liquid Glass (iOS 27 / WWDC26)

The material system is a faithful two-layer implementation of Apple's Liquid Glass:

**Layer 1 — CONTROL (`<LiquidGlass>`)**. True lensing glass for controls only: the top-bar cluster, unit toggle, dock, segmented controls, sheet grabber, map controls and floating buttons. Four stacked layers per element:

1. **Backdrop** — Chromium: `backdrop-filter: url(#refraction-filter) blur(2px) saturate(1.7) brightness(1.05)`; everyone else: `blur(18px+) saturate(1.8)` (clean fallback, zero layout shift).
2. **Refraction filter** — generated at runtime (`src/lib/liquid.ts`): a displacement map rasterized on a canvas from a rounded-rect signed-distance field (squircle profile ≈ Snell's law, IOR ~1.5, 12–20px bezel, zero displacement at center so content stays crisp), fed through **three feDisplacementMap passes isolated per RGB channel** (scales 1.00 / 1.05 / 1.10) recombined with `feBlend screen` — the faint chromatic fringe at the rim. Filter region extends −20 %/+140 %. Cached by (w, h, radius), regenerated on resize, and **budgeted to ≤ 3 live filters** (dock, top-bar cluster, one more).
3. **Tint** — very light and scene-luminance aware: dark scenes `rgba(255,255,255,.05–.10)`, light scenes `.18–.28` + 4 % black. Never above 0.3 at default.
4. **Edge + light** — a 1px **opposing-corner rim** (bright ~.6 top-left *and* bottom-right, faint ~.08 on the other corners) via mask, `inset 0 1px 0 rgba(255,255,255,.5)` top highlight, inner hairline, soft inner glow; a pointer-following specular blob (rAF-throttled, desktop only, off under reduced motion) that on motion-sensor devices **doubles as the tilt light** — with Tilt highlights enabled the ambient specular drifts with the device's physical tilt (pointer input always wins when present); layered shadow `0 10px 30px / 0 2px 6px` that **intensifies while content scrolls beneath** (`.lg-boosted`).

**Interaction** — press = scale .96 + brighten (gel flex), release springs back with a small overshoot. Selected segments (unit toggle, dock tabs, segmented controls) are an **inner lighter glass capsule** that morphs between positions with a framer-motion `layoutId` spring and a brief `scaleX` stretch mid-travel.

**Variants** — `regular` everywhere; `clear` **only** for controls floating over the full-screen map (with a built-in dimming scrim). Never mixed in one view.

**Layer 2 — CONTENT (Surface)**. All cards are deliberately flat: `blur(22px) saturate(1.4)`, tint `.08–.14` (dark scenes), 1px hairline, soft shadow — no refraction, no specular, so controls pop above it. Chips and scrolling-list rows (`.glass-subtle` / `.surface-subtle`) are **plain fills with no backdrop-filter**. Never glass-on-glass; never more than 2 stacked translucent layers.

**The transparency slider** (Settings → *Liquid Glass*) spans **Ultra Clear → Fully Tinted** and drives everything: tint alpha `.04 → .55`, blur `2px → 28px`, refraction strength `1.0 → 0.25`, rim brightness `1.0 → 0.35`, plus the Surface card tint. It honors `prefers-reduced-transparency` (forces fully tinted, no refraction), `prefers-contrast: more` (stronger rim + tint), `prefers-reduced-motion` (no specular / gel), and a **Reduce bright effects** toggle (kills specular + chromatic fringe).

**Tilt highlights** (`use-tilt-glow.ts`, off by default) — the mobile counterpart of the pointer specular: `deviceorientation` → normalized `--tilt-x/y` custom properties on `<html>` (rAF-throttled CSS repaints), consumed by the specular layer as its position fallback. iOS 13+ permission is requested from the Settings switch (a denial shows a recovery hint); reduced-motion and Reduce bright effects both disable it. On fine-pointer devices the pointer light always takes precedence.

**Hero** — no panel at all: city, a giant thin temperature (`clamp(104px, 24vw, 176px)`, weight 200, tracking −0.045em, white with soft text-shadow), condition and H/L render **directly on the animated scene**, with the glowing weather glyph (~200px) beside them and quick stats as a row of Surface chips. A scene-aware scrim (stronger on light skies) keeps the white text AA.

**Browser support**

| Browser | Refraction | Backdrop | Notes |
| --- | --- | --- | --- |
| Chrome / Edge / Brave (Chromium) | ✅ 3-pass RGB displacement + chromatic rim | `url(#filter) + blur(2px)` | Full recipe |
| Safari (WebKit) | ❌ (renders nothing for `backdrop-filter: url()` — detection is UA-based, never `CSS.supports`) | `blur(18px+) saturate(1.8)` | Clean frosted fallback |
| Firefox | ❌ | `blur(18px+) saturate(1.8)` | Same fallback |

**Performance rules** — ≤ 6 live backdrop-filter control elements on screen (audited); ≤ 3 refraction filters (slot budget with graceful blur fallback); card sections keep `content-visibility` virtualization; no backdrop filter on scrolling list rows; pointer specular is rAF-throttled and hover-capable-pointer-only.

**Scene scenery** — every scene paints large soft light blobs, a diagonal gradient band and small high-contrast orbs near the **top and bottom edges** (calm middle for text), so the lensing has living light to bend. Blobs drift slowly; everything is seeded-random and SSR-stable.

```tsx
import { LiquidGlass } from '@/components/glass/LiquidGlass';
import { Glass } from '@/components/glass/Glass';
import { SegmentedControl } from '@/components/glass/SegmentedControl';

<LiquidGlass className="flex h-11 items-center rounded-full px-3">…</LiquidGlass>   // control
<LiquidGlass as="button" onClick={…} aria-label="Save">…</LiquidGlass>             // pressable control
<LiquidGlass variant="clear">…</LiquidGlass>                                       // over the map only
<Glass level="base" className="rounded-[var(--radius-card)] p-5">…</Glass>        // content card
<SegmentedControl aria-label="View" options={…} value={view} onChange={setView} />
```

The legacy utility classes (`.glass`, `.glass-strong`, `.glass-subtle`, `.glass-hover`, `.surface-*`) now map onto the Surface recipes — migrated components keep working.

**Text on glass** — vibrancy tiers (white at 1.0 / .72 / .5) on scene and controls via `.text-on-scene` / `-2` / `-3`; on cards via the `--surface-*` tokens. Labels are sentence-case 13px (`.card-label` / `.card-label-muted`) — no tracked-out micro caps. Dark text never sits on a dark scene; the scene scrim guarantees AA.

**Icon system** — `import { Icon } from '@/components/icons/Icon'`:

```tsx
<Icon name="partly-cloudy-day" size={64} animated />   // weather glyph (gradient-lit, animated)
<Icon name="sparkle" size={16} strokeWidth={2} />       // UI icon (currentColor strokes)
```

- **12 weather glyphs** (64×64, filled, gradient-lit): `sun`, `moon`, `partly-cloudy-day`, `partly-cloudy-night`, `cloudy`, `fog`, `drizzle`, `rain`, `thunder`, `snow`, `wind`, `hail`
- **27 UI icons** (24×24, currentColor, round caps/joins): `search`, `pin`, `gear`, `plus`, `check`, `x`, `chevron-up/down/left/right`, `sparkle`, `droplet`, `thermometer`, `eye`, `gauge`, `sunrise`, `sunset`, `bookmark`, `send`, `stop`, `refresh`, `locate`, `command`, `info`, `alert`, `moon-phase`, `compare`
- Gradient/mask/clip ids are namespaced with React `useId()`, so dozens of icons can share a page (hourly strip) without collisions; a shared IntersectionObserver pauses off-screen animations; `prefers-reduced-motion` renders everything static.

**Adding a scene** — add a config to `src/lib/scenes.ts` (`getScene(condition, phase)` maps WMO codes × day phases to `SceneConfig`: gradient stops, surface mode, layer flags). The scene engine, glass tint and light/dark surface tokens all derive from it — no component changes needed. Test with `?scene=<condition>&phase=<phase>` (see [Debug & QA](#debug--qa)).

**Adding an icon** — add a glyph factory to `WEATHER_GLYPHS` or `UI_GLYPHS` in `src/components/icons/Icon.tsx` (and the corresponding name in the union type). Namespace any gradient/mask ids with the `id` argument, gate looping animations on the root `.ic-anim` class, and add keyframes to `icons.css`.

## AI features

Four route handlers, all `POST`, server-side only, all validating their payload with zod:

| Route | What it does | Cache | Rate limit (per IP) |
| --- | --- | --- | --- |
| `/api/ai/briefing` | 2–3 sentence daily briefing, streamed | 30 min | 20 / min |
| `/api/ai/chat` | Grounded chat over the live forecast (8-turn history), streamed | never | 12 / min |
| `/api/ai/advisor` | Outfit suggestion + 5 activity scores (0–100), structured JSON | 30 min | 12 / min |
| `/api/ai/alerts` | Notable changes as severity-tagged alerts (facts detected deterministically, AI only phrases them) | 15 min | 20 / min |

Streaming routes speak a tiny NDJSON protocol: `{type:"meta",provider,cached}` → `{type:"chunk",text}`… → `{type:"done"}` (or `{type:"error",message}`).

**Provider chain** — every route runs the same chain in `src/lib/ai.ts`:

1. **Gemini** via `@google/genai` with `GEMINI_API_KEY` / `GEMINI_MODEL` (default `gemini-3.8-flash`). A circuit breaker permanently disables it for the process after fatal errors (invalid key, unsupported region).
2. **z-ai-web-dev-sdk** — secondary provider.
3. **Deterministic rule-based fallback** (`src/lib/ai-fallback.ts`) — rain windows, dry stretches, band-scored activities and threshold-detected alerts, computed directly from the forecast. The AI UI never hard-fails: with no provider at all you still get a useful (sparkle-free) summary, and the badge honestly says so.

**Guardrails**

- Per-IP sliding-window rate limits (in-memory, Upstash-ready interface), input capped at 600 characters with control characters stripped, per-route output token caps, 25 s request deadline combined with client-disconnect abort (`AbortSignal.any`)
- Prompt-injection defense: the forecast lives in the **system** prompt framed explicitly as *data, not instructions*; the user turn only ever contains the question, and the voice rules forbid inventing numbers
- The client sends only city name + coordinates — the server re-fetches weather itself and never trusts client-supplied forecast JSON
- Structured outputs (`advisor`) are requested with a Gemini `responseSchema` **and** re-validated with zod; anything invalid falls back to deterministic scoring
- The API key is read server-side only, never bundled to the client, never logged (the circuit breaker logs a static category string, not the error payload)

**Swapping the model** — set `GEMINI_MODEL` in `.env` (any current Gemini model id) and restart. That's the whole swap; the SDK, prompts and schemas stay unchanged.

## Debug & QA

Force any background scene without waiting for the weather:

```
http://localhost:3000/?scene=<condition>&phase=<phase>
```

- `scene`: `clear` · `partly-cloudy` · `cloudy` · `fog` · `drizzle` · `rain` · `snow` · `thunder`
- `phase`: `day` · `dawn` · `dusk` · `night`

A small badge in the bottom-left corner confirms the override is active. Handy for checking all 32 scene combinations (e.g. `?scene=thunder&phase=night` for lightning, `?scene=snow&phase=day` for snowfall) — and since the glass tint follows the scene, for QA-ing glass legibility across every condition.

## Data & credits

- **[Open-Meteo](https://open-meteo.com/)** — weather forecast (ECMWF/GFS blend) and city geocoding. Free for non-commercial use, no API key.
- **CAMS European Air Quality** — air-quality data (EAQI, PM2.5, PM10, O₃, NO₂), served via Open-Meteo's air-quality API.
- **[Nominatim](https://nominatim.openstreetmap.org/)** (OpenStreetMap) — reverse geocoding for the "use my location" feature. Its User-Agent policy is handled server-side in the route handler.
- **[Google Gemini](https://aistudio.google.com/)** — AI text generation (optional; deterministic fallbacks otherwise).

## PWA notes

- The service worker registers **in production only**. In dev, Turbopack serves chunks at stable URLs and a cache-first worker would keep serving stale code across hot reloads.
- The worker precaches the app shell and icons, serves navigations network-first with an offline fallback, caches static assets, and never caches `/api/*` (weather must be fresh).
- The app is fully installable once deployed over HTTPS (or `localhost`).

## Deploy

Works on **Vercel** as-is — zero configuration. Just import the repo; `next build` handles the rest. Add `GEMINI_API_KEY` (and optionally `GEMINI_MODEL`, `NEXT_PUBLIC_SITE_URL`) as project environment variables to light up the AI layer. Any Node host works too:

```bash
npm run build && npm start
```

## Browser support

Targets modern evergreen browsers (latest Chrome, Edge, Firefox, Safari). `backdrop-filter` powers the glass aesthetic and degrades gracefully where unsupported; the refraction sheen is Chromium-only by design. Animations are transform/opacity-only and pause on hidden tabs and off-screen elements.

## License

[MIT](./LICENSE) — © 2026 Aether contributors. Weather data by Open-Meteo (CC-BY 4.0).

---

<sub>Designed & developed by [Omkar Kardile](https://omkardile.is-a.dev/)</sub>
