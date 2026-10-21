import { GolfSeriesConfig, League, SeriesConfig } from '../models/team-config.model';

export interface LeagueInfo {
  slug: League;
  kind: 'team' | 'series' | 'golf';
  label: string;
  /** ESPN's CORS-accessible news endpoint returns articles for this league */
  hasNews: boolean;
  /**
   * Team sports with a live game clock: suffix shown after the period number
   * (e.g. '2Q 4:22'). Omitted → show ESPN's status text instead (MLB innings, soccer minutes).
   */
  periodLabel?: string;
  /** Extra scoreboard query params. College hoops defaults to Top-25 games only without these. */
  scoreboardParams?: Record<string, string>;
  /** Team schedule returns only results by default; upcoming games need `?fixture=true` (soccer). */
  splitSchedule?: boolean;
}

/** Every league the app can display. Order here is the News filter and Settings tab order. */
export const LEAGUES: readonly LeagueInfo[] = [
  { slug: 'basketball/nba',        kind: 'team',   label: 'NBA',     hasNews: true, periodLabel: 'Q' },
  { slug: 'basketball/wnba',       kind: 'team',   label: 'WNBA',    hasNews: true, periodLabel: 'Q' },
  { slug: 'football/nfl',          kind: 'team',   label: 'NFL',     hasNews: true, periodLabel: 'Q' },
  { slug: 'baseball/mlb',          kind: 'team',   label: 'MLB',     hasNews: true },
  { slug: 'hockey/nhl',            kind: 'team',   label: 'NHL',     hasNews: true, periodLabel: 'P' },
  { slug: 'soccer/usa.1',          kind: 'team',   label: 'MLS',     hasNews: true, splitSchedule: true },
  { slug: 'soccer/eng.1',          kind: 'team',   label: 'EPL',     hasNews: true, splitSchedule: true },
  { slug: 'soccer/usa.nwsl',       kind: 'team',   label: 'NWSL',    hasNews: true, splitSchedule: true },
  { slug: 'football/college-football', kind: 'team', label: 'CFB',   hasNews: true, periodLabel: 'Q',
    scoreboardParams: { limit: '300' } },
  { slug: 'basketball/mens-college-basketball', kind: 'team', label: 'NCAAM', hasNews: true, periodLabel: 'H',
    scoreboardParams: { groups: '50', limit: '400' } },
  { slug: 'basketball/womens-college-basketball', kind: 'team', label: 'NCAAW', hasNews: true, periodLabel: 'Q',
    scoreboardParams: { groups: '50', limit: '400' } },
  { slug: 'racing/f1',             kind: 'series', label: 'F1',      hasNews: true },
  // news endpoint responds 200 with articles: [] — see CLAUDE.md
  { slug: 'racing/nascar-premier', kind: 'series', label: 'NASCAR',  hasNews: false },
  { slug: 'racing/irl',            kind: 'series', label: 'IndyCar', hasNews: true },
  { slug: 'golf/pga',              kind: 'golf',   label: 'PGA',     hasNews: true },
];

export function leagueInfo(slug: League): LeagueInfo | undefined {
  return LEAGUES.find(l => l.slug === slug);
}

export function leagueLabel(slug: League): string {
  return leagueInfo(slug)?.label ?? slug;
}

/** URL code for a league page: '/league/nba', '/league/epl'. */
export function leagueRouteKey(slug: League): string {
  return leagueLabel(slug).toLowerCase();
}

/** Team league for a URL code, or undefined. Racing/golf have no league page yet. */
export function teamLeagueByRouteKey(key: string | null | undefined): LeagueInfo | undefined {
  return LEAGUES.find(l => l.kind === 'team' && l.label.toLowerCase() === key);
}

export const TEAM_LEAGUES = LEAGUES.filter(l => l.kind === 'team');

/** Max teams a dashboard can hold — Schedule and Last Played make one request per team. */
export const MAX_TEAMS = 12;

/** Every motorsport series a user can toggle on. Order is display order. */
export const SERIES_OPTIONS: readonly SeriesConfig[] = [
  {
    kind: 'series',
    name: 'Formula 1',
    shortName: 'F1',
    sport: 'racing/f1',
    primaryColor: '#E10600',
    secondaryColor: '#1f1f1f',
  },
  {
    kind: 'series',
    name: 'NASCAR Cup Series',
    shortName: 'NASCAR',
    sport: 'racing/nascar-premier',
    primaryColor: '#FFC906',
    secondaryColor: '#002D62',
  },
  {
    kind: 'series',
    name: 'IndyCar Series',
    shortName: 'IndyCar',
    sport: 'racing/irl',
    primaryColor: '#004B8D',
    secondaryColor: '#FFCC00',
  },
];

/** Every golf tour a user can toggle on. */
export const GOLF_OPTIONS: readonly GolfSeriesConfig[] = [
  {
    kind: 'golf',
    name: 'PGA Tour',
    shortName: 'PGA',
    sport: 'golf/pga',
    primaryColor: '#004F2D',
    secondaryColor: '#C9A84C',
  },
];
