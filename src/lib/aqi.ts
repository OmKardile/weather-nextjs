export type AqiStandard = 'european' | 'us';

export interface AqiBand {
  label: string;
  /** Semantic scale color (hex). */
  color: string;
  /** Upper bound of the band (last band = Infinity). */
  max: number;
}

/** European Air Quality Index bands (0–100+, six bands). */
const EU_BANDS: AqiBand[] = [
  { label: 'Good', color: '#3FBFAC', max: 20 },
  { label: 'Fair', color: '#59BE7E', max: 40 },
  { label: 'Moderate', color: '#E8C54D', max: 60 },
  { label: 'Poor', color: '#F0954A', max: 80 },
  { label: 'Very poor', color: '#E1552F', max: 100 },
  { label: 'Extremely poor', color: '#9B4A9E', max: Infinity },
];

/** US EPA AQI bands (0–500, six bands). */
const US_BANDS: AqiBand[] = [
  { label: 'Good', color: '#3FBFAC', max: 50 },
  { label: 'Moderate', color: '#E8C54D', max: 100 },
  { label: 'Unhealthy for sensitive groups', color: '#F0954A', max: 150 },
  { label: 'Unhealthy', color: '#E1552F', max: 200 },
  { label: 'Very unhealthy', color: '#9B4A9E', max: 300 },
  { label: 'Hazardous', color: '#8E3A52', max: Infinity },
];

export const AQI_SCALE_MAX: Record<AqiStandard, number> = {
  european: 100,
  us: 300,
};

export function aqiBands(standard: AqiStandard): AqiBand[] {
  return standard === 'european' ? EU_BANDS : US_BANDS;
}

export function aqiBand(value: number, standard: AqiStandard): AqiBand {
  const bands = aqiBands(standard);
  return bands.find((band) => value <= band.max) ?? bands[bands.length - 1];
}

/** Position (0–1) of a value on the visual scale (values above max clamp to the end). */
export function aqiPosition(value: number, standard: AqiStandard): number {
  const max = AQI_SCALE_MAX[standard];
  return Math.min(1, Math.max(0, value / max));
}

export function aqiDominantPollutant(aq: {
  pm2_5: number | null;
  pm10: number | null;
  ozone: number | null;
  no2: number | null;
  so2: number | null;
}): string | null {
  const entries: Array<[string, number | null]> = [
    ['PM2.5', aq.pm2_5],
    ['PM10', aq.pm10],
    ['O₃', aq.ozone],
    ['NO₂', aq.no2],
    ['SO₂', aq.so2],
  ];
  let best: [string, number] | null = null;
  for (const [name, value] of entries) {
    if (value == null || !Number.isFinite(value)) continue;
    if (!best || value > best[1]) best = [name, value];
  }
  return best ? best[0] : null;
}
