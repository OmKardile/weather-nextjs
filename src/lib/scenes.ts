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
 */
const SCENES: Record<Condition, Record<DayPhase, SceneConfig>> = {
  clear: {
    day:   { key: 'clear-day',   condition: 'clear', phase: 'day',   gradient: ['#9FDFD3', '#CDEFE2', '#F6ECD4'], surface: 'light', layers: L({ sun: true }) },
    dawn:  { key: 'clear-dawn',  condition: 'clear', phase: 'dawn',  gradient: ['#8D7FA8', '#DCA793', '#F7D9A6'], surface: 'dark',  layers: L({ sun: true, clouds: 1 }) },
    dusk:  { key: 'clear-dusk',  condition: 'clear', phase: 'dusk',  gradient: ['#5D5177', '#B4768B', '#EFB27E'], surface: 'dark',  layers: L({ sun: true, clouds: 1 }) },
    night: { key: 'clear-night', condition: 'clear', phase: 'night', gradient: ['#04100F', '#0A2B2A', '#11403B'], surface: 'dark',  layers: L({ stars: true, moon: true, aurora: true }) },
  },
  'partly-cloudy': {
    day:   { key: 'partly-day',   condition: 'partly-cloudy', phase: 'day',   gradient: ['#8FCFC8', '#BADFD6', '#E9E4C8'], surface: 'light', layers: L({ sun: true, clouds: 2 }) },
    dawn:  { key: 'partly-dawn',  condition: 'partly-cloudy', phase: 'dawn',  gradient: ['#86789E', '#C99A90', '#EFCFA0'], surface: 'dark',  layers: L({ sun: true, clouds: 2 }) },
    dusk:  { key: 'partly-dusk',  condition: 'partly-cloudy', phase: 'dusk',  gradient: ['#544A6E', '#A26E85', '#E0A479'], surface: 'dark',  layers: L({ sun: true, clouds: 2 }) },
    night: { key: 'partly-night', condition: 'partly-cloudy', phase: 'night', gradient: ['#050F12', '#0C262B', '#133838'], surface: 'dark',  layers: L({ stars: true, moon: true, clouds: 1, aurora: true }) },
  },
  cloudy: {
    day:   { key: 'cloudy-day',   condition: 'cloudy', phase: 'day',   gradient: ['#87A09B', '#A4B8AE', '#C6CCC0'], surface: 'light', layers: L({ clouds: 3 }) },
    dawn:  { key: 'cloudy-dawn',  condition: 'cloudy', phase: 'dawn',  gradient: ['#6E6780', '#93838A', '#C0A28E'], surface: 'dark',  layers: L({ clouds: 3 }) },
    dusk:  { key: 'cloudy-dusk',  condition: 'cloudy', phase: 'dusk',  gradient: ['#4A4460', '#7A6678', '#B08A78'], surface: 'dark',  layers: L({ clouds: 3 }) },
    night: { key: 'cloudy-night', condition: 'cloudy', phase: 'night', gradient: ['#080F11', '#112024', '#1B2E31'], surface: 'dark',  layers: L({ clouds: 2 }) },
  },
  fog: {
    day:   { key: 'fog-day',   condition: 'fog', phase: 'day',   gradient: ['#B9C4BF', '#CBD2CB', '#DEE0D6'], surface: 'light', layers: L({ fog: true, clouds: 1 }) },
    dawn:  { key: 'fog-dawn',  condition: 'fog', phase: 'dawn',  gradient: ['#8E8795', '#AFA094', '#D2C3A8'], surface: 'dark',  layers: L({ fog: true, clouds: 1 }) },
    dusk:  { key: 'fog-dusk',  condition: 'fog', phase: 'dusk',  gradient: ['#5E5A6B', '#8A7C7C', '#BCA288'], surface: 'dark',  layers: L({ fog: true, clouds: 1 }) },
    night: { key: 'fog-night', condition: 'fog', phase: 'night', gradient: ['#0B1315', '#152023', '#202D2F'], surface: 'dark',  layers: L({ fog: true, clouds: 1 }) },
  },
  drizzle: {
    day:   { key: 'drizzle-day',   condition: 'drizzle', phase: 'day',   gradient: ['#759390', '#93ADA6', '#B4C2B4'], surface: 'light', layers: L({ rain: 'light', clouds: 2 }) },
    dawn:  { key: 'drizzle-dawn',  condition: 'drizzle', phase: 'dawn',  gradient: ['#5F6379', '#8B8188', '#BCA48E'], surface: 'dark',  layers: L({ rain: 'light', clouds: 2 }) },
    dusk:  { key: 'drizzle-dusk',  condition: 'drizzle', phase: 'dusk',  gradient: ['#454A5F', '#6F6472', '#A98D79'], surface: 'dark',  layers: L({ rain: 'light', clouds: 2 }) },
    night: { key: 'drizzle-night', condition: 'drizzle', phase: 'night', gradient: ['#071013', '#0E2226', '#153034'], surface: 'dark',  layers: L({ rain: 'light', clouds: 1 }) },
  },
  rain: {
    day:   { key: 'rain-day',   condition: 'rain', phase: 'day',   gradient: ['#5D7B78', '#7E978F', '#A0AFA2'], surface: 'light', layers: L({ rain: 'heavy', clouds: 3 }) },
    dawn:  { key: 'rain-dawn',  condition: 'rain', phase: 'dawn',  gradient: ['#4B4F63', '#786E74', '#A8917F'], surface: 'dark',  layers: L({ rain: 'heavy', clouds: 3 }) },
    dusk:  { key: 'rain-dusk',  condition: 'rain', phase: 'dusk',  gradient: ['#3A3E50', '#5F5664', '#96816F'], surface: 'dark',  layers: L({ rain: 'heavy', clouds: 3 }) },
    night: { key: 'rain-night', condition: 'rain', phase: 'night', gradient: ['#050D10', '#0B1D22', '#112A31'], surface: 'dark',  layers: L({ rain: 'heavy', clouds: 2 }) },
  },
  snow: {
    day:   { key: 'snow-day',   condition: 'snow', phase: 'day',   gradient: ['#AEC5CF', '#C9DAE0', '#E6ECE7'], surface: 'light', layers: L({ snow: true, clouds: 2 }) },
    dawn:  { key: 'snow-dawn',  condition: 'snow', phase: 'dawn',  gradient: ['#7F93A8', '#ABB9C4', '#DFD8C6'], surface: 'dark',  layers: L({ snow: true, clouds: 2 }) },
    dusk:  { key: 'snow-dusk',  condition: 'snow', phase: 'dusk',  gradient: ['#5A6478', '#8A93A4', '#C2B4A4'], surface: 'dark',  layers: L({ snow: true, clouds: 2 }) },
    night: { key: 'snow-night', condition: 'snow', phase: 'night', gradient: ['#0C171D', '#15262E', '#203641'], surface: 'dark',  layers: L({ snow: true, clouds: 1, stars: true }) },
  },
  thunder: {
    day:   { key: 'thunder-day',   condition: 'thunder', phase: 'day',   gradient: ['#3F4A52', '#5A656D', '#78827F'], surface: 'dark', layers: L({ rain: 'heavy', clouds: 3, lightning: true }) },
    dawn:  { key: 'thunder-dawn',  condition: 'thunder', phase: 'dawn',  gradient: ['#332F45', '#4E4560', '#7A6470'], surface: 'dark', layers: L({ rain: 'heavy', clouds: 3, lightning: true }) },
    dusk:  { key: 'thunder-dusk',  condition: 'thunder', phase: 'dusk',  gradient: ['#241F35', '#3B3450', '#6B5867'], surface: 'dark', layers: L({ rain: 'heavy', clouds: 3, lightning: true }) },
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
