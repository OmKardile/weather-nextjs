# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [4.0.0] — 2026-10-12

Liquid Glass material overhaul — a full pass over the glass system driven
by a browser-audited QA round (pixel sampling + vision review at 390/1440,
dark/light scenes, slider 0/50/100). The headline fix: **dark-scene cards
no longer read as milky grey slabs**. iOS dark materials *darken* the
scene behind them; tinting them white produced exactly the frosted
glassmorphism look this project set out to replace.

### Changed
- **Dark-scene Surface tint is now dark-teal translucent** (`.16 → .74`
  with the slider, `--surface-dark-a`) plus a 5 % white whisper, instead
  of a white `.08–.14` fill. Pixel-verified: card interiors now match the
  scene beside them (clear glass), while light scenes keep the correct
  milky-white material.
- **Refraction is visible again** — displacement base scale 10 → 12.5 px
  (relative 1.00/1.05/1.10) so the rim lensing and chromatic fringe
  survive blur(2px); the opposing-corner rim brightened (.6 → .7 TL/BR,
  complete faint .1 ring elsewhere).
- **Selected capsules read as lit glass, not grey pills** — `.lg-selected`
  drops to a .13 white fill with a stronger top hairline and inner glow.
- **Segmented controls inside cards are flat inset wells** (`.segment-well`)
  with the morphing selected capsule on top — a nested `<LiquidGlass>`
  there was glass-on-glass and burned a live backdrop-filter per control.
- **Cards inside sheets/modals never re-blur** (`.surface-overlay …`
  context rule) — the sheet already frosted the scene; this also removes
  per-card blur cost while the forecast drawer drags.
- **Hero actions (share / save / refresh) are ghost controls**
  (`.hero-ghost`) — quiet white icons on the scene, hairline + fill only
  on hover/press. Zero chrome in the hero, like Apple Weather.
- **Mobile drawer peek detent 0.22 → 0.34** — the first card's title now
  always clears the floating dock (the old peek hid "Next 48 hours"
  behind the capsule; verified by rect measurement + vision audit).
- **Light-scene hero scrim deepened** (.44 → .52 top) for AA margin on
  secondary white text over pale skies.
- **`prefers-reduced-transparency` now has solid fallbacks for every
  material tier** (controls, cards, overlays — dark teal / off-white),
  not just the control layer; previously cards lost their blur but kept
  a .08 white tint and went see-through.

### Fixed
- **Refraction filter cache ignored strength** — the cache key was
  `(w, h, radius)`, so moving the transparency slider silently kept the
  old baked feDisplacementMap scales. Strength is now part of the key;
  the slider visibly bends the light again.
- **Live backdrop-filter budget** — 8 elements were live on the mobile
  viewport (budget ≤ 6). Now 6 mobile / 4 desktop (browser-audited):
  hero stat chips are flat `.surface-chip` fills, the segment well is
  flat, and overlay inner cards don't re-blur.
- **Glass-on-glass in the AI panels** — the Ask AI / Planner header,
  composer and footer strips were `.glass` (backdrop blur) *inside* the
  `.glass-strong` panel; they are now flat `.surface-inset` strips.
- **SiteFooter was a full-width glass slab** — the "solid white footer
  panel" at the bottom of the page. It is now flat text on the scene
  with a whisper hairline.
- Removed the dead legacy `TopBar.tsx` (solid-bar implementation that
  predated the floating-capsule MenuBar).

## [3.6.0] — 2026-10-12

Climate lens round: the Time machine grows a **30-year climate trend**
(regression band + per-decade verdict + warmest/coldest markers), the badge
shelf welcomes its **eleventh badge** (Fresh air — clean-air days), the
outing verdict can be **shared** with one tap, and high-UV hours now carry
**burn-risk chips** in the hourly strip. Two real bugs fixed on the way:
a conditional-hook crash in the Time machine chart and dock-label legibility
at Ultra-clear glass.

### Added
- **30-year climate trend** (Time machine) — an OLS regression over the
  year-by-year highs renders as a solid trend line with a soft ±1σ band
  behind the dots, plus a verdict chip ("+0.6°/decade · this date is
  warming over 31 years · typical spread ±2.6°"). **Warmest and coldest
  years** now carry dashed ring highlights with tiny year tags — visual
  parity with the screen-reader summary that always announced them.
  Null-guarded below 8 archive years (a shorter window would make
  "per decade" wording misleading).
- **Fresh air badge** (achievements) — unlocks when the displayed city's
  European AQI is 20 or better on a day you check it. New `leaf` icon
  glyph with a gentle breeze sway (reduced-motion safe). The shelf now
  reads "N of 11 earned".
- **Share outing verdict** (Sun safety card) — a send button in the outing
  planner header shares a compact text verdict (time, UV with band,
  protection verdict, unprotected/SPF-30 burn estimates) via the share
  sheet with a clipboard fallback; a blocked clipboard gets honest
  feedback instead of silence.
- **Burn-risk chips** (hourly strip) — hours with UV ≥ 6 (the "high" band
  floor) show a band-colored sun pill with the rounded UV index; severity
  reads at a glance in the same palette as the Sun safety curve. Aria
  labels include the UV reading.

### Fixed
- **Conditional hook crash** in the Time machine chart — the in-flight
  climate-trend work from an interrupted session placed `trendGeom`'s
  useMemo after an early return (React rules-of-hooks violation, lint
  error + a live hooks-order warning on reload). Moved above the guard;
  its own `!trend || !geom` null path keeps semantics identical.
- **Dock-label legibility at Ultra-clear glass** — scrolled drawer/map
  content fighting the floating dock's tab labels at the default
  transparency setting. New `.dock-content-scrim` between the content
  (z-30) and the capsule (z-40) — an iOS-tab-bar-style gradient that
  tones with light/dark scenes and only softens (never removes) under
  Reduce bright effects.

### Changed
- Hourly strip aria labels now append golden-hour and UV context in one
  pass; burn chips equalize chip heights via the existing flex stretch.

## [3.5.0] — 2026-10-12

Rituals & rewards round: the Sun safety card gains an **outing planner**
(pick a time, get your burn-time verdict), daily visits now build a
**true streak** with a flame chip in the hero and two new badges, and
the giant temperature readout **counts to its value** on every change.

### Added
- **Sun outing planner** (Sun safety card) — a half-hour-resolution
  slider across the next 12 hours (UV linearly interpolated between the
  hourly samples — the curve is the truth, interpolation never invents
  peaks). The readout shows the chosen clock time with a relative hint
  ("in 7.5 h"), the interpolated UV with its band color, unprotected and
  SPF-30 burn estimates for the selected Fitzpatrick type, and a
  plain-language protection verdict ("High — SPF 30, reapply after 2 h").
  The UV curve itself gets an amber marker (line + dot + time label) that
  follows the slider — and **tapping the curve picks the nearest slot**
  (pointer convenience; the slider stays the accessible control, with a
  descriptive `aria-label` and the verdict wired into the chart's screen
  -reader summary).
- **Visit streaks** — `streakFromDays`/`bestStreakFromDays` (pure,
  DST-safe day-key arithmetic) derive the true consecutive-day streak
  from the achievements store. The hero quick-stats row gains a **flame
  chip** ("N day streak", amber ember that gains a glow at 7+ days,
  hidden below 2 days), and the Settings badge-shelf hint now reads
  "X of 10 earned · N-day streak (best M)".
- **Two new achievements** — *Kindling* (three consecutive visit days,
  new `flame` icon with a gentle CSS flicker) and *Globe-trotter* (ten
  distinct cities viewed; the store now tracks a validated, capped
  `cities` list, recorded by the achievements observer on every city
  change).
- `useCountUp` hook — eased (easeOutCubic) integer count-up used by the
  hero temperature on city switches and unit toggles; tabular-nums keep
  digit widths stable, interrupted animations resume from the last
  painted frame, and `prefers-reduced-motion` snaps instantly (the snap
  itself routes through a zero-duration rAF tick to respect the React
  Compiler's no-setState-in-effect rule).

### Changed
- The Sun safety chart exposes its per-hour pixel stride so pointer
  clicks invert cleanly to planner slots; the cursor is a crosshair over
  the curve.
- New `.outing-slider` token (globals.css): the ambient-slider recipe
  in amber, full card width, with an 18px glowing thumb.
- `days`-count "seven-day streak: X/7" shelf hint replaced by the real
  streak numbers (consecutive ≠ distinct — the old line overcounted
  gappy weeks).

## [3.4.0] — 2026-10-12

Sun & honesty round: a **Sun safety** card personalizes burn-time
estimates to your Fitzpatrick skin type over a band-colored UV curve,
the **Forecast log learns to backfill** (missed visits no longer leave
days ungraded), and golden hours now glow warmly in the hourly strip.

### Added
- **Sun safety card** (Details section) — the 48-hour UV curve as a
  band-colored gradient area (the same low→extreme palette as the UV
  metric tile: aurora / amber / orange / red / violet), with guide lines
  at UV 3/6/8/11, a live now-marker and a labeled peak dot. A
  Fitzpatrick I–VI selector (persisted `skinType` preference, default
  II) personalizes **burn-time estimates** using ISO erythemal-dose
  arithmetic (minutes ≈ MED × 2 ÷ (3 × UV); MED 200–1000 J/m² by
  phototype) — shown for now and for today's peak, with an "SPF 30
  multiplies it ~30×" line and a low-UV window callout ("UV stays ≤3
  before 09:00 and after 16:00"). Night shows an honest "No UV — the
  sun is down" instead of a meaningless dash. Full screen-reader
  summary; estimates framed as estimates.
- **Ledger backfill** — the Forecast log now grades itself even when you
  skip days. New `/api/ledger-backfill` route + `fetchMeasuredDaily`
  (forecast API with `past_days=7` — analysis data, no ERA5 lag, 1 h
  shared cache). The ledger hook opportunistically fetches measured
  actuals for pending records strictly older than yesterday (once per
  city per session, best-effort; today's fresh call is never graded
  early) and bulk-scores them through `scoreBackfill`. The badge signal
  fires on backfilled days too.

### Changed
- **Golden hours glow in the hourly strip** — hour chips inside today's
  or tomorrow's golden-hour windows (from the sky engine) get a subtle
  warm amber underglow rising from the bottom edge + an amber time
  label, with `title="Golden hour"` and an aria-label note. The "Now"
  aurora treatment is untouched.
- Night-time Sun safety readouts no longer show a bare "—" (see above).

## [3.3.0] — 2026-10-12

Trust & delight round: Aether starts keeping score of itself. The new
**Forecast log** records each day's forecast high/low on first view and
grades it against the measured sky the next day — plus a Daylight
solstice tracker, a living tab (favicon + title), and an honest chart
for dry nowcasts.

### Added
- **Forecast log (self-scoring ledger)** — a new "Forecast log" card
  section. On the first successful fetch of a local calendar day, the
  forecast high/low shown is recorded (the "morning call", own
  `aether-ledger` localStorage store, observable + `useSyncExternalStore`
  pattern like the badge store: validated on read, capped at 30 records
  per city / 8 cities, all-°C internally). When the measured yesterday
  arrives upstream (`past_days=1`), the matching record is scored. The
  card shows a rolling verdict ("Sharp calls — 86% within 2°"), a
  last-7-scored-days error-bar strip (teal ≤1°, amber ≤2.5°, orange
  beyond; per-bar tooltips + full screen-reader summary), stat tiles
  (avg miss / days scored / clean days) and a warm empty state with
  today's pending call. Records °C, displays in the active units.
  The section is reorder/hide-aware like every other card, has a ⌘K
  "Jump to" entry, and its persisted order is auto-appended for
  existing users.
- **Truth seeker badge** — ninth achievement, unlocked when the ledger
  scores its fifth day (impulsive `ledger-scored` signal, toast + the
  Settings badge shelf).
- **Daylight tracker card** — new card in "Sky & photography": a
  semicircle solstice gauge (gradient arc with a marker dot + sun glyph)
  showing today's daylight between the year's shortest and longest day
  at this latitude (Cooper declination approximation), a signed
  **+1m 24s/day** delta chip computed from tomorrow's bundle row,
  sunrise / sunset / night stat pills, and a "minutes of daylight still
  to gain/lose before the solstice" caption.
- **Living tab** (`use-dynamic-favicon.ts`) — the browser tab becomes a
  thermometer: a 64 px canvas favicon (rounded square, vertical gradient
  sampled from the live scene engine, bold white temperature with
  auto-sized glyphs) plus the document title ("20° Clear · Tokyo —
  Aether"). Redrawn only on real changes (temperature / condition /
  phase / city / units). A MutationObserver keeps the live title
  authoritative — React can re-commit the static metadata `<title>`
  when late streamed Suspense boundaries resolve.

### Changed
- **Dry nowcasts show their evidence** — "Dry for the next 2 hours" no
  longer renders a bare header: a compact chance-of-precipitation
  sparkline (gradient area + line, peak marker with "peak 2%" caption,
  Now→+2h labels) now backs the claim. The wet chart is unchanged.

## [3.2.0] — 2026-10-12

QA-driven round: a persisted-city robustness crash fixed, two data
features (yesterday comparison + air-quality trend), and the final
Liquid Glass spec item — device-tilt highlights.

### Added
- **"vs yesterday" hero chip** — the forecast request now asks for
  `past_days=1`, so the daily arrays gain yesterday's measured high/low
  while the hourly anchor (`past_hours=1`) is untouched (verified
  upstream). The hero quick-stat row gains a fourth Surface chip:
  today's forecast high vs yesterday's measured high, signed
  (`+2° / −3° / ±0°`), with a trending icon (amber when warmer, aurora
  teal when cooler, minus when flat, ±0.5° tolerance). Degrades to
  nothing when upstream omits yesterday.
- **24-hour air-quality trend** — `european_aqi` rides along on the
  existing air-quality call (no extra request). The Air-quality card
  gains a sparkline: band-colored line + gradient area, a peak marker
  with a "peaks 19:00 · 42" caption, a dashed "now" reference line, and
  a screen-reader summary ("now 34 (Fair), peaking 42 around 19:00").
  The expanded card shows the taller variant with hour ticks. Omitted
  where CAMS hourly data is missing.
- **Device-tilt highlights** (`use-tilt-glow.ts`) — the last item of the
  Liquid Glass brief: on devices with a motion sensor the ambient
  specular on glass controls drifts with the physical tilt of the device
  (like a light source fixed in the room). The hook writes
  `--tilt-x/y/--tilt-on` on `<html>` (rAF-throttled CSS repaints, no
  layout); `.lg::after` uses them as position fallbacks whenever a
  pointer hasn't lit the control — pointer always wins. iOS 13+
  `requestPermission()` is honored via the new **Tilt highlights** switch
  in Settings (persists `tiltGlowEnabled`; shows a recovery hint when
  motion access is denied). Never active under reduced motion or
  Reduce bright effects.

### Fixed
- **Malformed persisted cities crashed the app** — `localStorage` is
  untrusted: a hand-edited or legacy `aether-preferences` payload with
  `lat`/`lon` instead of `latitude`/`longitude` (or non-finite
  coordinates) made MapLibre throw `new LngLat(NaN, NaN)` on map open —
  white-screen crash of the whole app — and silently anchored the
  weather query at (0, 0). The zustand `merge` now normalizes every
  persisted city (aliases coerced, numeric-string ids coerced,
  unrecoverable rows dropped, invalid `lastCity` nulled), and MapOverlay
  guards its constructor/flyTo/marker coordinates as defense-in-depth
  (falls back to the neutral world view). Reproduced the crash before
  the fix, verified the recovery after.

### Changed
- **Card hover lift** — forecast cards (ExpandableCard + MarineCard)
  rise 2px on hover with a deeper shadow and a top-edge highlight
  (`.card-lift`): fine pointers only, never under reduced motion, and
  never on chips/pills (those keep the existing fill-brighten hover).
- **Dock active icon** — the selected tab's icon now scales to 110 %
  with a soft white glow, echoing the `lg-selected` capsule language.
- **Hero chips** — quick-stat pills get a springy press feedback
  (`active:scale-95`), matching the control layer's gel press.

## [3.1.0] — 2026-10-12

The frosted-glassmorphism overhaul: the entire material system is replaced
with a faithful implementation of Apple's iOS 27 Liquid Glass (WWDC26
refinement of iOS 26) — real lensing, sharp rim light, clear glass over
dark scenes.

### Added
- **`<LiquidGlass>` control layer** (`components/glass/LiquidGlass.tsx` +
  `lib/liquid.ts`): Chromium-only true refraction via a runtime-generated
  displacement map (rounded-rect SDF on a canvas, squircle profile ≈ Snell's
  law, IOR ~1.5, zero center displacement) fed through **three per-RGB-channel
  `feDisplacementMap` passes** (scales 1.00/1.05/1.10) recombined with
  `feBlend screen` — a faint chromatic fringe at the rim. Filter region
  −20 %/+140 %, cached by (w, h, radius), regenerated on resize, and
  **budgeted to ≤ 3 live filters** with graceful blur fallback. Detection is
  UA-based (`navigator.userAgentData.brands`) — never `CSS.supports()`,
  which Safari lies about.
- **Rim light + specular + gel press**: 1px opposing-corner rim (bright
  top-left *and* bottom-right), inset top highlight, inner hairline, inner
  glow, pointer-following specular (rAF, hover-capable pointers only), and a
  press interaction (scale .96 + brighten) that springs back with overshoot.
  Shadows intensify while content scrolls beneath (`.lg-boosted`).
- **`<SegmentedControl>`**: LiquidGlass capsule whose selected segment is an
  inner lighter glass capsule morphing between positions (framer-motion
  `layoutId` + brief mid-travel `scaleX` stretch). Now used for the unit
  toggle, AI card view, Ask-AI mode, and the model-compare metric.
- **Liquid Glass transparency slider** (Settings): Ultra Clear → Fully
  Tinted, driving tint alpha (.04 → .55), blur (2px → 28px), refraction
  strength (1.0 → 0.25), rim brightness (1.0 → 0.35) and the Surface card
  tint. Honors `prefers-reduced-transparency` (forces fully tinted),
  `prefers-contrast: more`, `prefers-reduced-motion`; persisted in
  `aether-preferences` v3.
- **Reduce bright effects** toggle: disables the pointer specular and the
  chromatic rim fringe.
- **Scene scenery**: every scene now paints large soft light blobs, a
  diagonal gradient band and small high-contrast orbs near the top/bottom
  edges (calm middle for text) — the lensing finally has living light to
  bend. Seeded-random, SSR-stable, reduced-motion aware.
- **Compare cities dialog**: side-by-side live conditions for saved cities
  (≥2) with a deterministic comfort score (feels-like distance, 12 h rain,
  wind, humidity), Warmest/A–Z sorts, a "Best now" badge, and instant loads
  via the shared per-city query cache (`useWeatherMany`). Opens from the
  sidebar and ⌘K.
- `reorderCities` store action (permutation-validated) and a `compare` UI
  glyph.

### Changed
- **The hero has no panel**: city, giant thin temperature
  (`clamp(104px, 24vw, 176px)` weight 200, −0.045em tracking, white +
  text-shadow), condition, H/L, a ~200px glowing weather glyph and a row of
  Surface stat chips compose directly on the animated scene (Apple Weather
  layout). A scene-aware scrim (stronger over light skies) keeps the white
  text at AA.
- **Top bar is no longer a solid bar**: logo left, city + time as plain
  white scene text center, and ONE grouped LiquidGlass capsule right
  (44px/20px targets, full-opacity white icons) that strengthens while
  content scrolls under it.
- **Mobile dock** is a floating LiquidGlass capsule — `bottom:
  max(12px, env(safe-area-inset-bottom))`, 64px tall, 11px sentence-case
  labels, morphing selection capsule; the old fixed gradient bar and the
  dock-overlap clipping bug are gone (drawer content padding-bottom ≥ dock
  + 24, verified 58px clear at full scroll).
- **Bottom sheet** is a flat Surface with 28px concentric top radii and a
  small LiquidGlass grabber pill.
- **All cards are flat Surface material** (`<Glass>` → `blur(22px)
  saturate(1.4)`, light tint, hairline, soft shadow — no specular, no
  refraction); `.glass*` utility aliases remapped to the same recipes;
  `.glass-subtle` chips are now plain fills (no backdrop-filter on
  scrolling rows). `--radius-card` 20px → 28px.
- **Map chrome** (top bar, layers panel, time scrubber) uses the `clear`
  LiquidGlass variant with a dimming scrim — the one place Clear is allowed.
- **Typography**: card/section labels are sentence-case 13px
  (`.card-label` / `.card-label-muted`) — the tracked-out 10px micro-caps
  are gone everywhere (swept 29 instances); vibrancy tiers for text on
  scene/glass (white 1.0/.72/.5) via `.text-on-scene*`.
- Contrast floor raised: `--surface-muted` .66 → .74 (dark) / .64 → .72
  (light), `--surface-faint` .42 → .56/.54; Marine card restructured (no
  cramped wrapping); Advisor reasons show 3 lines; Aurora axis labels
  bumped to the muted tier.

### Fixed
- `Logo.tsx` failed `tsc` under React 19 (`JSX.Element` namespace removed)
  — switched to `ReactElement`.
- Hydration attribute mismatch introduced by an extra wrapper `div`
  (shifted `useId` paths for every LogoMark gradient) — the Liquid Glass
  CSS variables now live directly on the app root element instead.
- Dev-server fragility under browser + Turbopack memory pressure
  (OOM-killed twice this round) — documented the double-fork daemon
  relaunch pattern that survives the sandbox process reaper.

### Performance
- Audited to exactly **6 live backdrop-filter controls** on screen (top
  capsule, 3 hero buttons, 2 segmented controls — hidden drawer duplicates
  don't paint), ≤ 3 refraction filters, content-visibility on card
  sections, rAF-throttled pointer tracking.

## [3.1.1] — 2026-10-12

QA-driven round: two real hydration bugs fixed, saved-city drag
reordering shipped, selected-state polish.

### Added
- **Saved-city drag reordering** — the completion of v3.1.0's
  `reorderCities` store action. A shared `<CityReorderList>`
  (dnd-kit, same sensor recipe as the forecast cards: 5px pointer
  activation + keyboard sorting on the focusable grip) is used by both
  the desktop sidebar and the mobile Cities tab: a grip toggle in the
  header enters reorder mode (rows swap to drag handles with live
  weather, a "Current" badge, drag elevation with shadow), **Done** or
  Escape exits, and the new order persists instantly. Verified with
  real mouse-drag reordering on both surfaces + localStorage checks.

### Fixed
- **Hydration attribute mismatch (LogoMark)** — React 19's useId paths
  are unstable across streamed-Suspense SSR (server `R2j…` vs client
  `Rkq…` ids), producing console errors whenever a city was persisted.
  LogoMark now uses fixed shared gradient ids — every instance renders
  byte-identical defs, so sharing is safe (and canvas serialization
  stays self-contained). Warning initially moved to the sun glyph…
- **…and the same fix for `<Icon>`** — icon gradient/clip ids are now
  derived from the glyph name (`aic-sun-…`) instead of useId. Same
  reasoning: identical defs per glyph, and day/night variants are
  distinct glyph names. Three consecutive reloads now hydrate with a
  completely clean console (previously ~2 errors per load, flaky).

### Changed
- **Hourly "Now" chip**: aurora-tinted selected treatment (border +
  soft glow + inset highlight) and a bolder temperature, so the current
  hour reads as the anchor of the strip.
- **Daily "Today" row**: subtle aurora background highlight — the focal
  row of the 7-day list.
- **Sidebar active city row**: inner aurora ring (echoes the
  `lg-selected` capsule language).

## [Unreleased]

### Planned
- Weather radar / precipitation nowcast layer on the map
- Additional languages / localization
- Pluggable AI providers (bring your own key / endpoint)
- WebKit refraction recipe if Apple ever ships `backdrop-filter: url()`

## [3.0.0] — 2026-10-12

Following user feedback: the manual appearance control produced inconsistent
colors/contrast, and the accent picker added options without adding value.
Both are gone — the sky now owns the theme, full stop.

### Removed
- **Appearance setting (Auto / Light / Dark)** — the interface now *always*
  follows the live sky at the selected city: dawn, day, dusk and night
  re-skin every glass surface via the scene's natural surface mode. This
  removes the entire class of forced-dark/forced-light contrast bugs (forced
  dark over a bright day scene, forced light over a night scene, stale
  overrides when switching cities across time zones). Settings shows a
  read-only "Appearance — Follows the sky" row explaining the behavior; the
  ⌘K palette's Appearance group is gone.
- **Accent picker (Aurora / Sky / Sunset / Meadow)** — the aurora teal is the
  brand; the four preset hue-shifts (≈85 lines of CSS variable overrides) are
  deleted. `data-accent` no longer renders on the app root.
- Persisted-preference migration: store version bumped to 3; retired `theme`
  and `accent` keys are stripped from older localStorage state on rehydrate.

### Fixed
- **"Customize cards" now actually goes somewhere.** Entering edit mode from
  Settings (desktop dialog or mobile tab) or ⌘K routes you to the cards:
  desktop closes the dialog and smooth-scrolls the main column to the
  forecast sections; mobile switches to the Today tab and expands the
  forecast drawer to full (a snap-reset race on tab switch is now timed
  after the reset). Previously the dialog closed (desktop) or nothing
  visibly happened (mobile) — the edit UI lived in a place you were never
  taken to.
- **Card drag-and-drop inside the mobile forecast drawer** — the drag handles
  and hide buttons now carry `data-vaul-no-drag` and stop pointerdown
  propagation, so dnd-kit owns the gesture instead of the vaul sheet. Card
  reordering, hiding and restoring verified working in both the desktop
  column and the drawer.
- Edit-mode toolbar gains a **Reset order** button (restores the default
  section order) alongside Done.

### Changed
- **New brand mark — the "Altitude A".** A geometric A with a flowing wave
  crossbar and a golden sun rising in its counter, on the aurora-teal
  gradient squircle (replaces the sun-over-waves mark). Applied across the
  inline `<LogoMark>`, favicon (`icon.svg`), Apple touch icon, PWA icons
  (192 / 512 / maskable-512, re-rasterized), `public/logo.svg`, share-card
  canvas art and the Open Graph image (now renders the exact SVG mark via a
  data URI instead of a hand-drawn approximation).
- Version bumped to 3.0.0 (settings sheet credits + package manifest).

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
