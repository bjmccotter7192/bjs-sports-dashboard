import { League } from '../models/team-config.model';

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
