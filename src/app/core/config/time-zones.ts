/**
 * Time zone handling for game/race times.
 *
 * Angular's DatePipe does not understand IANA zone names — `date: ... : 'America/Chicago'`
 * silently falls back to the browser zone. All zone-aware formatting goes through Intl here.
 */

export interface TimeZoneOption {
  zone: string;
  name: string;
  /** Fixed label shown after times. Overrides Intl's short name (e.g. London's "GMT+1"). */
  label: string;
}

/** Zones offered as a manual override in Settings. */
export const TIME_ZONE_OPTIONS: readonly TimeZoneOption[] = [
  { zone: 'America/New_York',    name: 'Eastern',          label: 'ET' },
  { zone: 'America/Chicago',     name: 'Central',          label: 'CT' },
  { zone: 'America/Denver',      name: 'Mountain',         label: 'MT' },
  { zone: 'America/Phoenix',     name: 'Arizona (no DST)', label: 'MST' },
  { zone: 'America/Los_Angeles', name: 'Pacific',          label: 'PT' },
  { zone: 'America/Anchorage',   name: 'Alaska',           label: 'AKT' },
  { zone: 'Pacific/Honolulu',    name: 'Hawaii',           label: 'HT' },
  { zone: 'Europe/London',       name: 'UK',               label: 'UK' },
  { zone: 'UTC',                 name: 'UTC',              label: 'UTC' },
];

/** Intl short names for US zones → stable labels that don't flip with DST. */
const US_LABELS: Record<string, string> = {
  EST: 'ET', EDT: 'ET',
  CST: 'CT', CDT: 'CT',
  MST: 'MT', MDT: 'MT',
  PST: 'PT', PDT: 'PT',
  AKST: 'AKT', AKDT: 'AKT',
  HST: 'HT', HDT: 'HT',
};

const FALLBACK_ZONE = 'America/New_York';

export function isValidTimeZone(zone: unknown): zone is string {
  if (typeof zone !== 'string' || !zone) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

export function isOverrideOption(zone: unknown): zone is string {
  return TIME_ZONE_OPTIONS.some(o => o.zone === zone);
}

/** The browser's IANA zone (e.g. "America/Detroit"), or Eastern if unavailable. */
export function browserTimeZone(): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return isValidTimeZone(zone) ? zone : FALLBACK_ZONE;
  } catch {
    return FALLBACK_ZONE;
  }
}

/** Short label for a zone at a given moment: "ET" for America/Detroit, "GMT-5" for Bogota. */
export function zoneLabel(zone: string, date: Date = new Date()): string {
  const option = TIME_ZONE_OPTIONS.find(o => o.zone === zone);
  if (option) return option.label;
  const short = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'short' })
    .formatToParts(date)
    .find(p => p.type === 'timeZoneName')?.value ?? zone;
  return US_LABELS[short] ?? short;
}

export type ZonedStyle = 'dateTime' | 'time';

/** "Jun 22 · 1:05 PM ET" (dateTime) or "1:05 PM ET" (time) in the given zone. */
export function formatInZone(date: Date, zone: string, style: ZonedStyle): string {
  const time = new Intl.DateTimeFormat('en-US', {
    timeZone: zone, hour: 'numeric', minute: '2-digit',
  }).format(date);
  const label = zoneLabel(zone, date);
  if (style === 'time') return `${time} ${label}`;
  const day = new Intl.DateTimeFormat('en-US', { timeZone: zone, month: 'short', day: 'numeric' }).format(date);
  return `${day} · ${time} ${label}`;
}

/** YYYYMMDD of the calendar day `date` falls on in `zone` — for grouping by day. */
export function dateKeyInZone(date: Date, zone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  return `${get('year')}${get('month')}${get('day')}`;
}
