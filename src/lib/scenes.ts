import type { Condition, DayPhase } from '@/types/weather';

export type CloudDensity = 0 | 1 | 2 | 3;
export type RainIntensity = 'none' | 'light' | 'heavy';

export interface SceneLayers {
  /** Twinkling star field + occasional shooting star. */
  stars: boolean;
  /** 0 none · 1 wisps · 2 scattered · 3 packed. */
  clouds: CloudDensity;
  /** Horizontal drifting fog bands. */
  fog: boolean;
  rain: RainIntensity;
  snow: boolean;
  /** Randomized lightning flashes. */
  lightning: boolean;
  /** Sun disc / glow (position hints golden hour when dawn/dusk). */
  sun: boolean;
  moon: boolean;
  /** Subtle aurora shimmer (clear/partly nights). */
  aurora: boolean;
}

export interface SceneConfig {
  key: string;
  condition: Condition;
  phase: DayPhase;
  /** Gradient stops: top → middle → bottom. */
  gradient: [string, string, string];
  /** Which glass surface set to use (drives text colors & card fills). */
  surface: 'dark' | 'light';
  layers: SceneLayers;
}

const L = (layers: Partial<SceneLayers>): SceneLayers => ({
  stars: false,
  clouds: 0,
  fog: false,
  rain: 'none',
  snow: false,
  lightning: false,
  sun: false,
  moon: false,
  aurora: false,
  ...layers,
});

/**
 * 32 scene palettes: 8 conditions × 4 day phases.
 * Palette direction: teal / sage / amber / violet skies — no default-blue.
 *
 * CONTRAST CONTRACT (v4.1): every scene marked `surface: 'dark'` keeps its
 * top + middle stops at WCAG relative luminance ≤ ~0.17, so pure-white
 * hero/menu text holds ≥ 4.5:1 everywhere it sits (the hero scrim and
 * glass tints add margin on top). Golden-hour identity lives in the warm
 * bottom stop + the horizon sun glow, not in bright mid-tones — bright
 * mids under white text were the root cause of the "destroyed contrast"
 * reports. Light-surface scenes stay light but richer (deeper, more
 * saturated tops) so glass panels read with definition instead of
 * washing into the sky.
 */
const SCENES: Record<Condition, Record<DayPhase, SceneConfig>> = {
  clear: {
    day:   { key: 'clear-day',   condition: 'clear', phase: 'day',   gradient: ['#7BC4B6', '#B2E0D0', '#F0E8CA'], surface: 'light', layers: L({ sun: true }) },
    dawn:  { key: 'clear-dawn',  condition: 'clear', phase: 'dawn',  gradient: ['#453B63', '#8A5A6A', '#B3794C'], surface: 'dark',  layers: L({ sun: true, clouds: 1 }) },
    dusk:  { key: 'clear-dusk',  condition: 'clear', phase: 'dusk',  gradient: ['#33294B', '#6B4A63', '#B0713F'], surface: 'dark',  layers: L({ sun: true, clouds: 1 }) },
    night: { key: 'clear-night', condition: 'clear', phase: 'night', gradient: ['#04100F', '#0A2B2A', '#11403B'], surface: 'dark',  layers: L({ stars: true, moon: true, aurora: true }) },
  },
  'partly-cloudy': {
    day:   { key: 'partly-day',   condition: 'partly-cloudy', phase: 'day',   gradient: ['#6FBAB0', '#A5D8CB', '#E9E1C2'], surface: 'light', layers: L({ sun: true, clouds: 2 }) },
    dawn:  { key: 'partly-dawn',  condition: 'partly-cloudy', phase: 'dawn',  gradient: ['#403656', '#7F5262', '#AB7448'], surface: 'dark',  layers: L({ sun: true, clouds: 2 }) },
    dusk:  { key: 'partly-dusk',  condition: 'partly-cloudy', phase: 'dusk',  gradient: ['#2F2745', '#654460', '#A86A3C'], surface: 'dark',  layers: L({ sun: true, clouds: 2 }) },
    night: { key: 'partly-night', condition: 'partly-cloudy', phase: 'night', gradient: ['#050F12', '#0C262B', '#133838'], surface: 'dark',  layers: L({ stars: true, moon: true, clouds: 1, aurora: true }) },
  },
  cloudy: {
    day:   { key: 'cloudy-day',   condition: 'cloudy', phase: 'day',   gradient: ['#7A968F', '#98ADA3', '#B9C0B2'], surface: 'light', layers: L({ clouds: 3 }) },
    dawn:  { key: 'cloudy-dawn',  condition: 'cloudy', phase: 'dawn',  gradient: ['#3B334E', '#6A5560', '#97705F'], surface: 'dark',  layers: L({ clouds: 3 }) },
    dusk:  { key: 'cloudy-dusk',  condition: 'cloudy', phase: 'dusk',  gradient: ['#2A2440', '#584453', '#8F6055'], surface: 'dark',  layers: L({ clouds: 3 }) },
    night: { key: 'cloudy-night', condition: 'cloudy', phase: 'night', gradient: ['#080F11', '#112024', '#1B2E31'], surface: 'dark',  layers: L({ clouds: 2 }) },
  },
  fog: {
    day:   { key: 'fog-day',   condition: 'fog', phase: 'day',   gradient: ['#AABAB4', '#BFC9C2', '#D6DACB'], surface: 'light', layers: L({ fog: true, clouds: 1 }) },
    dawn:  { key: 'fog-dawn',  condition: 'fog', phase: 'dawn',  gradient: ['#474156', '#726265', '#97836B'], surface: 'dark',  layers: L({ fog: true, clouds: 1 }) },
    dusk:  { key: 'fog-dusk',  condition: 'fog', phase: 'dusk',  gradient: ['#35304A', '#5C4F58', '#8A6A5C'], surface: 'dark',  layers: L({ fog: true, clouds: 1 }) },
    night: { key: 'fog-night', condition: 'fog', phase: 'night', gradient: ['#0B1315', '#152023', '#202D2F'], surface: 'dark',  layers: L({ fog: true, clouds: 1 }) },
  },
  drizzle: {
    day:   { key: 'drizzle-day',   condition: 'drizzle', phase: 'day',   gradient: ['#68918C', '#87A29A', '#A7B5A6'], surface: 'light', layers: L({ rain: 'light', clouds: 2 }) },
    dawn:  { key: 'drizzle-dawn',  condition: 'drizzle', phase: 'dawn',  gradient: ['#312D45', '#5E5158', '#8F7362'], surface: 'dark',  layers: L({ rain: 'light', clouds: 2 }) },
    dusk:  { key: 'drizzle-dusk',  condition: 'drizzle', phase: 'dusk',  gradient: ['#262239', '#4E4250', '#7A6252'], surface: 'dark',  layers: L({ rain: 'light', clouds: 2 }) },
    night: { key: 'drizzle-night', condition: 'drizzle', phase: 'night', gradient: ['#071013', '#0E2226', '#153034'], surface: 'dark',  layers: L({ rain: 'light', clouds: 1 }) },
  },
  rain: {
    day:   { key: 'rain-day',   condition: 'rain', phase: 'day',   gradient: ['#52716E', '#71897F', '#919F91'], surface: 'light', layers: L({ rain: 'heavy', clouds: 3 }) },
    dawn:  { key: 'rain-dawn',  condition: 'rain', phase: 'dawn',  gradient: ['#2A283D', '#514850', '#7D6857'], surface: 'dark',  layers: L({ rain: 'heavy', clouds: 3 }) },
    dusk:  { key: 'rain-dusk',  condition: 'rain', phase: 'dusk',  gradient: ['#201D30', '#413849', '#6E5C50'], surface: 'dark',  layers: L({ rain: 'heavy', clouds: 3 }) },
    night: { key: 'rain-night', condition: 'rain', phase: 'night', gradient: ['#050D10', '#0B1D22', '#112A31'], surface: 'dark',  layers: L({ rain: 'heavy', clouds: 2 }) },
  },
  snow: {
    day:   { key: 'snow-day',   condition: 'snow', phase: 'day',   gradient: ['#A3C1CD', '#C1D4DD', '#DFE7DA'], surface: 'light', layers: L({ snow: true, clouds: 2 }) },
    dawn:  { key: 'snow-dawn',  condition: 'snow', phase: 'dawn',  gradient: ['#3E4560', '#6A7488', '#8E8270'], surface: 'dark',  layers: L({ snow: true, clouds: 2 }) },
    dusk:  { key: 'snow-dusk',  condition: 'snow', phase: 'dusk',  gradient: ['#323A50', '#5A6478', '#8A7A6C'], surface: 'dark',  layers: L({ snow: true, clouds: 2 }) },
    night: { key: 'snow-night', condition: 'snow', phase: 'night', gradient: ['#0C171D', '#15262E', '#203641'], surface: 'dark',  layers: L({ snow: true, clouds: 1, stars: true }) },
  },
  thunder: {
    day:   { key: 'thunder-day',   condition: 'thunder', phase: 'day',   gradient: ['#3F4A52', '#5A656D', '#78827F'], surface: 'dark', layers: L({ rain: 'heavy', clouds: 3, lightning: true }) },
    dawn:  { key: 'thunder-dawn',  condition: 'thunder', phase: 'dawn',  gradient: ['#262238', '#3F3752', '#5C4855'], surface: 'dark', layers: L({ rain: 'heavy', clouds: 3, lightning: true }) },
    dusk:  { key: 'thunder-dusk',  condition: 'thunder', phase: 'dusk',  gradient: ['#191531', '#2E2748', '#4E3E4C'], surface: 'dark', layers: L({ rain: 'heavy', clouds: 3, lightning: true }) },
    night: { key: 'thunder-night', condition: 'thunder', phase: 'night', gradient: ['#0B0916', '#151126', '#231D3A'], surface: 'dark', layers: L({ rain: 'heavy', clouds: 2, lightning: true }) },
  },
};

export function getScene(condition: Condition, phase: DayPhase): SceneConfig {
  return SCENES[condition]?.[phase] ?? SCENES.clear.day;
}

/** Human-readable phase labels used in the UI. */
export const PHASE_LABELS: Record<DayPhase, string> = {
  night: 'Night',
  dawn: 'Golden hour · dawn',
  day: 'Day',
  dusk: 'Golden hour · dusk',
};
