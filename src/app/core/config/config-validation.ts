/**
 * Validation and (de)serialization for user dashboard config.
 *
 * Everything read from localStorage or a share link is untrusted: it is parsed
 * defensively and rebuilt field by field, never spread into app state as-is.
 */
import {
  DashboardConfig, GolfLeague, MotorsportLeague, SportLeague, TeamConfig,
} from '../models/team-config.model';
import { GOLF_OPTIONS, MAX_TEAMS, SERIES_OPTIONS, TEAM_LEAGUES } from './leagues.config';

export const EMPTY_CONFIG: DashboardConfig = { teams: [], series: [], golf: [] };

const STORAGE_VERSION = 1;
const SHARE_VERSION = 1;
/** Generous upper bound for a 12-team share code; anything longer is rejected before decoding. */
const MAX_SHARE_CODE_LENGTH = 2000;

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const ESPN_ID = /^\d{1,8}$/;
const MAX_TEXT = 60;

export const MAX_NAME_LENGTH = 30;

/**
 * Clean a user-entered dashboard name: strip control characters and cap the length.
 * Not trimmed here (that would eat spaces while typing) — trim at display time.
 */
export function sanitizeName(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, MAX_NAME_LENGTH);
}

/** Navbar / browser-tab title for a dashboard name. */
export function dashboardTitle(name: string): string {
  const trimmed = name.trim();
  return trimmed ? `${trimmed} Sports Dashboard` : 'Sports Dashboard';
}

export function isEmptyConfig(config: DashboardConfig): boolean {
  return !config.teams.length && !config.series.length && !config.golf.length;
}

export function teamKey(team: Pick<TeamConfig, 'sport' | 'espnId'>): string {
  return `${team.sport}:${team.espnId}`;
}

export function isTeamLeague(value: unknown): value is SportLeague {
  return TEAM_LEAGUES.some(l => l.slug === value);
}

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOR.test(value);
}

function isEspnId(value: unknown): value is string {
  return typeof value === 'string' && ESPN_ID.test(value);
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= MAX_TEXT ? trimmed : null;
}

/** Rebuild a TeamConfig from untrusted input, or null if any field is invalid. */
export function sanitizeTeam(raw: unknown): TeamConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const name = text(r['name']);
  const shortName = text(r['shortName']);
  const abbreviation = text(r['abbreviation']);
  if (!isEspnId(r['espnId']) || !isTeamLeague(r['sport']) || !name || !shortName || !abbreviation) return null;
  if (!isHexColor(r['primaryColor']) || !isHexColor(r['secondaryColor'])) return null;
  return {
    kind: 'team',
    espnId: r['espnId'],
    abbreviation,
    name,
    shortName,
    sport: r['sport'],
    primaryColor: r['primaryColor'],
    secondaryColor: r['secondaryColor'],
  };
}

function seriesFromSlugs(raw: unknown) {
  const slugs = Array.isArray(raw) ? raw : [];
  return SERIES_OPTIONS.filter(o => slugs.includes(o.sport));
}

function golfFromSlugs(raw: unknown) {
  const slugs = Array.isArray(raw) ? raw : [];
  return GOLF_OPTIONS.filter(o => slugs.includes(o.sport));
}

/** Drop invalid and duplicate teams, cap at MAX_TEAMS, keep known series/golf only. */
export function sanitizeConfig(raw: unknown): DashboardConfig {
  if (!raw || typeof raw !== 'object') return EMPTY_CONFIG;
  const r = raw as Record<string, unknown>;
  const seen = new Set<string>();
  const teams: TeamConfig[] = [];
  for (const entry of Array.isArray(r['teams']) ? r['teams'] : []) {
    const team = sanitizeTeam(entry);
    if (!team || seen.has(teamKey(team))) continue;
    seen.add(teamKey(team));
    teams.push(team);
    if (teams.length === MAX_TEAMS) break;
  }
  // Accepts stored slugs or full config objects (from the settings UI)
  const slugsOf = (v: unknown) => Array.isArray(v) ? v.map(e => (e as { sport?: unknown })?.sport ?? e) : [];
  return { teams, series: seriesFromSlugs(slugsOf(r['series'])), golf: golfFromSlugs(slugsOf(r['golf'])) };
}

// ── localStorage format ───────────────────────────────────────────────

interface StoredConfigV1 {
  v: 1;
  teams: TeamConfig[];
  series: MotorsportLeague[];
  golf: GolfLeague[];
}

export function serializeConfig(config: DashboardConfig): string {
  const stored: StoredConfigV1 = {
    v: STORAGE_VERSION,
    teams: config.teams,
    series: config.series.map(s => s.sport),
    golf: config.golf.map(g => g.sport),
  };
  return JSON.stringify(stored);
}

/** Parse a stored config. Unknown versions and malformed JSON yield an empty config. */
export function parseStoredConfig(json: string | null): DashboardConfig {
  if (!json) return EMPTY_CONFIG;
  try {
    const raw = JSON.parse(json);
    if (raw?.v !== STORAGE_VERSION) return EMPTY_CONFIG;
    return sanitizeConfig(raw);
  } catch {
    return EMPTY_CONFIG;
  }
}

// ── Share codes ───────────────────────────────────────────────────────

/** A team reference from a share link. Names come from ESPN on import, never from the link. */
export interface SharedTeam {
  sport: SportLeague;
  espnId: string;
  primaryColor?: string;
  secondaryColor?: string;
}

export interface SharedSelection {
  teams: SharedTeam[];
  series: MotorsportLeague[];
  golf: GolfLeague[];
}

type ShareTeamTuple = [SportLeague, string, string?, string?];

interface ShareCodeV1 {
  v: 1;
  t: ShareTeamTuple[];
  s: MotorsportLeague[];
  g: GolfLeague[];
}

function toBase64Url(s: string): string {
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  return atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
}

export function encodeShareCode(config: DashboardConfig): string {
  const code: ShareCodeV1 = {
    v: SHARE_VERSION,
    t: config.teams.map(t => [t.sport, t.espnId, t.primaryColor, t.secondaryColor]),
    s: config.series.map(s => s.sport),
    g: config.golf.map(g => g.sport),
  };
  return toBase64Url(JSON.stringify(code));
}

/** Decode a share code into team references, or null if it is malformed. */
export function decodeShareCode(code: string | null): SharedSelection | null {
  if (!code || code.length > MAX_SHARE_CODE_LENGTH || !/^[A-Za-z0-9_-]+$/.test(code)) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(fromBase64Url(code));
  } catch {
    return null;
  }
  const r = raw as Partial<ShareCodeV1> | null;
  if (!r || r.v !== SHARE_VERSION || !Array.isArray(r.t)) return null;

  const seen = new Set<string>();
  const teams: SharedTeam[] = [];
  for (const entry of r.t) {
    if (!Array.isArray(entry)) continue;
    const [sport, espnId, primary, secondary] = entry;
    if (!isTeamLeague(sport) || !isEspnId(espnId)) continue;
    const key = teamKey({ sport, espnId });
    if (seen.has(key)) continue;
    seen.add(key);
    const team: SharedTeam = { sport, espnId };
    if (isHexColor(primary) && isHexColor(secondary)) {
      team.primaryColor = primary;
      team.secondaryColor = secondary;
    }
    teams.push(team);
    if (teams.length === MAX_TEAMS) break;
  }
  return {
    teams,
    series: seriesFromSlugs(r.s).map(s => s.sport),
    golf: golfFromSlugs(r.g).map(g => g.sport),
  };
}
