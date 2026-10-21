import { GolfSeriesConfig, League, SeriesConfig } from '../models/team-config.model';

export interface LeagueInfo {
  slug: League;
  kind: 'team' | 'series' | 'golf';
  label: string;
  /** ESPN's CORS-accessible news endpoint returns articles for this league */
  hasNews: boolean;
}

/** Every league the app can display. Order here is the News filter order. */
export const LEAGUES: readonly LeagueInfo[] = [
  { slug: 'basketball/nba',        kind: 'team',   label: 'NBA',     hasNews: true },
  { slug: 'football/nfl',          kind: 'team',   label: 'NFL',     hasNews: true },
  { slug: 'baseball/mlb',          kind: 'team',   label: 'MLB',     hasNews: true },
  { slug: 'hockey/nhl',            kind: 'team',   label: 'NHL',     hasNews: true },
  { slug: 'racing/f1',             kind: 'series', label: 'F1',      hasNews: true },
  // news endpoint responds 200 with articles: [] — see CLAUDE.md
  { slug: 'racing/nascar-premier', kind: 'series', label: 'NASCAR',  hasNews: false },
  { slug: 'racing/irl',            kind: 'series', label: 'IndyCar', hasNews: true },
  { slug: 'golf/pga',              kind: 'golf',   label: 'PGA',     hasNews: true },
];

export function leagueLabel(slug: League): string {
  return LEAGUES.find(l => l.slug === slug)?.label ?? slug;
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
