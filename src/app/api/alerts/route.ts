import { NextRequest, NextResponse } from 'next/server';
import type { Alert, AlertSeverity } from '@/types/weather';

export const runtime = 'nodejs';

/**
 * GET /api/alerts?lat=&lon=&country=&region=
 *
 * Unified official weather alerts. Exactly one national feed is queried,
 * chosen by the ISO 3166-1 alpha-2 `country` code:
 *
 *   US  → NWS api.weather.gov active alerts (point query, User-Agent required)
 *   AT BE BA BG HR CY CZ DK EE FI FR DE GR HU IS IE IL IT LV LT LU MT ME NL
 *   NO PL PT RO RS SK SI ES SE CH UA GB/UK
 *       → MeteoAlarm legacy Atom feed (country-wide; client shows relevant)
 *   IN  → NDMA SACHET CAP feed (short 6s timeout — host unreachable from
 *         some networks; degrades to no alerts without blocking the route)
 *
 * Every feed degrades independently: a failed/slow feed logs
 * `[api/alerts:<feed>]` and answers with fewer alerts — this route never
 * 5xxes because one feed is down. Unknown/missing country → 200 {alerts:[]}.
 * `region` (state/province, optional) soft-filters NWS results by area.
 */

const REVALIDATE = 600; // 10 min shared cache, matches the weather bundle
const NWS_USER_AGENT = 'AetherWeather/3.0 (weather app)';
const NWS_URL = 'https://api.weather.gov/alerts/active';
const METEOALARM_URL = 'https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-';
const SACHET_URL = 'https://sachet.ndma.gov.in/cap_public_website/CAP_Public/all.xml';

const FEED_TIMEOUT_MS = 8_000;
const FEED_ATTEMPTS = 2;
/** SACHET is unreachable from many hosting regions — cap the damage at 6s, 1 try. */
const SACHET_TIMEOUT_MS = 6_000;
const SACHET_ATTEMPTS = 1;
/** Country-wide feeds can carry hundreds of entries (Germany ~400) — cap after sorting. */
const FEED_CAP = 6;

/** ISO alpha-2 → MeteoAlarm legacy feed slug. */
const METEOALARM_SLUGS: Record<string, string> = {
  AT: 'austria',
  BE: 'belgium',
  BA: 'bosnia-herzegovina',
  BG: 'bulgaria',
  HR: 'croatia',
  CY: 'cyprus',
  CZ: 'czechia',
  DK: 'denmark',
  EE: 'estonia',
  FI: 'finland',
  FR: 'france',
  DE: 'germany',
  GR: 'greece',
  HU: 'hungary',
  IS: 'iceland',
  IE: 'ireland',
  IL: 'israel',
  IT: 'italy',
  LV: 'latvia',
  LT: 'lithuania',
  LU: 'luxembourg',
  MT: 'malta',
  ME: 'montenegro',
  NL: 'netherlands',
  NO: 'norway',
  PL: 'poland',
  PT: 'portugal',
  RO: 'romania',
  RS: 'serbia',
  SK: 'slovakia',
  SI: 'slovenia',
  ES: 'spain',
  SE: 'sweden',
  CH: 'switzerland',
  UA: 'ukraine',
  GB: 'united-kingdom',
  UK: 'united-kingdom',
};

const SEVERITY_RANK: Record<AlertSeverity, number> = {
  extreme: 0,
  severe: 1,
  moderate: 2,
  minor: 3,
  info: 4,
};

function normalizeSeverity(raw: string | undefined): AlertSeverity {
  switch ((raw ?? '').trim().toLowerCase()) {
    case 'extreme':
      return 'extreme';
    case 'severe':
      return 'severe';
    case 'moderate':
      return 'moderate';
    case 'minor':
      return 'minor';
    default:
      // CAP "Unknown" and anything unparseable still represents an official
      // product — keep it visible at the lowest alerting level.
      return 'minor';
  }
}

function sortAndCap(alerts: Alert[]): Alert[] {
  return alerts
    .slice()
    .sort(
      (a, b) =>
        SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
        (a.onset ?? '').localeCompare(b.onset ?? ''),
    )
    .slice(0, FEED_CAP);
}

/** "2026-10-11T17:00:00+00:00" → "11 Oct, 17:00 UTC" (feed-local wall time). */
function formatFeedTime(iso: string | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const day = date.getUTCDate();
  const month = date.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' });
  const time = `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
  const utc = /(?:Z|[+-]00:?00)$/.test(iso);
  return `${day} ${month}, ${time}${utc ? ' UTC' : ''}`;
}

/* ------------------------------------------------------------------ */
/* Tiny XML helpers (no new deps — feeds are simple, machine-generated) */
/* ------------------------------------------------------------------ */

function decodeXmlEntities(value: string): string {
  // &amp; must run last so pre-escaped entities survive a second decode.
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, '&');
}

/** First <tag>…</tag> content in a block, entity-decoded; undefined when absent/empty. */
function xmlTag(block: string, tag: string): string | undefined {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`));
  if (!match) return undefined;
  const value = decodeXmlEntities(match[1]).trim();
  return value.length > 0 ? value : undefined;
}

/**
 * Fetch a feed as text with short per-attempt timeouts and light retry.
 * `accept` is optional: MeteoAlarm's CDN answers 406 to application/atom+xml,
 * so only NWS gets a content-negotiation header.
 *
 * The abort timer is cleared once the body is read — an expired
 * AbortSignal.timeout would also race (and kill) Next's fetch-cache write,
 * which happens on the same signal after the response is consumed.
 */
async function fetchFeedText(
  url: string,
  timeoutMs: number,
  attempts: number,
  accept?: string,
): Promise<string> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: accept
          ? { 'User-Agent': NWS_USER_AGENT, Accept: accept }
          : { 'User-Agent': NWS_USER_AGENT },
        next: { revalidate: REVALIDATE },
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('feed request failed');
}

/* ------------------------------------------------------------------ */
/* NWS (United States) — api.weather.gov GeoJSON                       */
/* ------------------------------------------------------------------ */

interface NwsFeature {
  id?: string;
  properties?: {
    id?: string;
    event?: string;
    headline?: string;
    description?: string;
    severity?: string;
    urgency?: string;
    areaDesc?: string;
    onset?: string;
    effective?: string;
    expires?: string;
    ends?: string;
  };
}

interface NwsFeed {
  features?: NwsFeature[];
}

function nwsFeatureToAlert(feature: NwsFeature, index: number): Alert | null {
  const p = feature.properties ?? {};
  const event = (p.event ?? '').trim();
  const headline = (p.headline ?? '').trim();
  if (!event && !headline) return null;
  const id = p.id ?? feature.id ?? `nws-${index}`;
  return {
    id,
    source: 'nws',
    // The event name is the scannable banner title; the structured
    // WHAT/WHERE/WHEN description carries the detail.
    title: event || headline,
    description:
      (p.description ?? '').replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim() || headline,
    severity: normalizeSeverity(p.severity),
    urgency: p.urgency,
    areas: p.areaDesc,
    onset: p.onset ?? p.effective,
    // `ends` is the true event end; `expires` is the message expiry — prefer the former.
    expires: p.ends ?? p.expires,
    link: p.id
      ? `https://alerts.weather.gov/search?id=${encodeURIComponent(p.id)}`
      : feature.id,
  };
}

async function fetchNwsAlerts(lat: number, lon: number, region?: string): Promise<Alert[]> {
  const url = `${NWS_URL}?point=${lat.toFixed(4)},${lon.toFixed(4)}`;
  const text = await fetchFeedText(url, FEED_TIMEOUT_MS, FEED_ATTEMPTS, 'application/geo+json');
  const feed = JSON.parse(text) as NwsFeed;
  let alerts = (feed.features ?? [])
    .map((feature, index) => nwsFeatureToAlert(feature, index))
    .filter((alert): alert is Alert => alert != null);

  // Optional soft area filter: point queries are already precise, so only
  // narrow when the region actually matches at least one alert.
  if (region) {
    const needle = region.trim().toLowerCase();
    const matching = alerts.filter((alert) => (alert.areas ?? '').toLowerCase().includes(needle));
    if (matching.length > 0) alerts = matching;
  }
  return sortAndCap(alerts);
}

/* ------------------------------------------------------------------ */
/* MeteoAlarm (Europe) — legacy Atom feed per country                   */
/* ------------------------------------------------------------------ */

function parseMeteoAlarmXml(xml: string): Alert[] {
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];
  const alerts: Alert[] = [];

  entries.forEach((entry, index) => {
    const event = xmlTag(entry, 'cap:event');
    const title = xmlTag(entry, 'title') ?? event;
    if (!title) return;

    const severity = normalizeSeverity(xmlTag(entry, 'cap:severity'));
    const areaDesc = xmlTag(entry, 'cap:areaDesc');
    const onset = xmlTag(entry, 'cap:onset') ?? xmlTag(entry, 'cap:effective');
    const expires = xmlTag(entry, 'cap:expires');
    const urgency = xmlTag(entry, 'cap:urgency');
    const summary = xmlTag(entry, 'summary');

    // The live feed omits <summary> — build a description from CAP fields.
    const context =
      onset || expires
        ? `in effect${onset ? ` from ${formatFeedTime(onset)}` : ''}${expires ? ` until ${formatFeedTime(expires)}` : ''}`
        : '';
    const description =
      summary ?? `${event ?? 'Weather warning'} covering ${areaDesc ?? 'this region'}${context ? `, ${context}` : ''}.`;

    // First human-facing link (the region page; the cap+xml link is machine-only).
    const link = (entry.match(/<link\b[^>]*>/g) ?? [])
      .map((tagRaw) => /href="([^"]+)"/.exec(tagRaw)?.[1])
      .find((href) => href != null && href.startsWith('https://meteoalarm.org'));

    alerts.push({
      id: xmlTag(entry, 'cap:identifier') ?? xmlTag(entry, 'id') ?? `meteoalarm-${index}`,
      source: 'meteoalarm',
      title,
      description,
      severity,
      urgency,
      areas: areaDesc,
      onset,
      expires,
      link,
    });
  });

  return sortAndCap(alerts);
}

async function fetchMeteoAlarmAlerts(slug: string): Promise<Alert[]> {
  const xml = await fetchFeedText(`${METEOALARM_URL}${slug}`, FEED_TIMEOUT_MS, FEED_ATTEMPTS);
  return parseMeteoAlarmXml(xml);
}

/* ------------------------------------------------------------------ */
/* NDMA SACHET (India) — CAP XML, country-wide                          */
/* ------------------------------------------------------------------ */

function parseSachetXml(xml: string): Alert[] {
  const blocks = xml.match(/<alert>[\s\S]*?<\/alert>/g) ?? [];
  const alerts: Alert[] = [];

  blocks.forEach((block, index) => {
    // Prefer an English <info> block when several languages are present.
    const infoBlocks = block.match(/<info>[\s\S]*?<\/info>/g) ?? [];
    const info = infoBlocks.find((b) => /<language>\s*en[-_]/i.test(b)) ?? infoBlocks[0];
    if (!info) return;

    const event = xmlTag(info, 'event');
    if (!event) return;
    const severity = normalizeSeverity(xmlTag(info, 'severity'));
    const areaDesc = xmlTag(info, 'areaDesc');
    const onset = xmlTag(info, 'onset') ?? xmlTag(info, 'effective');
    const expires = xmlTag(info, 'expires');
    const rawDescription = xmlTag(info, 'description');

    const description =
      rawDescription ??
      `${event} for ${areaDesc ?? 'affected areas'}${expires ? `, valid until ${formatFeedTime(expires)}` : ''}.`;

    alerts.push({
      id: xmlTag(block, 'identifier') ?? `sachet-${index}`,
      source: 'sachet',
      title: event,
      description,
      severity,
      urgency: xmlTag(info, 'urgency'),
      areas: areaDesc,
      onset,
      expires,
      link: 'https://sachet.ndma.gov.in/',
    });
  });

  return sortAndCap(alerts);
}

async function fetchSachetAlerts(): Promise<Alert[]> {
  const xml = await fetchFeedText(SACHET_URL, SACHET_TIMEOUT_MS, SACHET_ATTEMPTS);
  return parseSachetXml(xml);
}

/* ------------------------------------------------------------------ */
/* Route                                                               */
/* ------------------------------------------------------------------ */

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const lat = Number(searchParams.get('lat'));
  const lon = Number(searchParams.get('lon'));
  const country = (searchParams.get('country') ?? '').trim().toUpperCase();
  const region = (searchParams.get('region') ?? '').trim().slice(0, 80) || undefined;

  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 });
  }

  const meteoalarmSlug = METEOALARM_SLUGS[country];
  const tasks: { label: string; run: Promise<Alert[]> }[] = [];
  if (country === 'US') {
    tasks.push({ label: 'nws', run: fetchNwsAlerts(lat, lon, region) });
  } else if (meteoalarmSlug) {
    tasks.push({ label: 'meteoalarm', run: fetchMeteoAlarmAlerts(meteoalarmSlug) });
  } else if (country === 'IN') {
    tasks.push({ label: 'sachet', run: fetchSachetAlerts() });
  }

  // allSettled: one hung/broken feed (SACHET is the known case) can never
  // reject the whole route — its failure degrades to an empty contribution.
  const settled = await Promise.allSettled(tasks.map((task) => task.run));

  const alerts: Alert[] = [];
  settled.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      alerts.push(...result.value);
    } else {
      console.error(`[api/alerts:${tasks[i].label}]`, result.reason);
    }
  });

  return NextResponse.json(
    { alerts },
    { headers: { 'Cache-Control': 'public, max-age=0, stale-while-revalidate=600' } },
  );
}
