import { SportLeague } from '../models/team-config.model';

export interface StandingsColumn {
  /** ESPN stat `type` (lowercase, e.g. 'wins', 'vsconf'). */
  type: string;
  label: string;
  /** Tooltip for abbreviated headers. */
  title?: string;
}

export type SortKey = [type: string, direction: 'asc' | 'desc'];

export interface StandingsFormat {
  /**
   * `?level=` for the standings endpoint. Omitted → ESPN's default grouping
   * (conferences, or one table). '3' → divisions.
   */
  level?: string;
  /** Row order within a group. Later keys break ties; rows missing a stat sort last. */
  sort: SortKey[];
  columns: StandingsColumn[];
}

const W: StandingsColumn = { type: 'wins', label: 'W', title: 'Wins' };
const L: StandingsColumn = { type: 'losses', label: 'L', title: 'Losses' };
const PCT: StandingsColumn = { type: 'winpercent', label: 'PCT', title: 'Win percentage' };
const GB: StandingsColumn = { type: 'gamesbehind', label: 'GB', title: 'Games behind' };
const HOME: StandingsColumn = { type: 'home', label: 'Home' };
const AWAY: StandingsColumn = { type: 'road', label: 'Away' };
const L10: StandingsColumn = { type: 'lasttengames', label: 'L10', title: 'Last 10 games' };
const STRK: StandingsColumn = { type: 'streak', label: 'Strk', title: 'Streak' };
const GP: StandingsColumn = { type: 'gamesplayed', label: 'GP', title: 'Games played' };

const BY_SEED: SortKey[] = [['playoffseed', 'asc']];

const BASKETBALL: StandingsFormat = { sort: BY_SEED, columns: [W, L, PCT, GB, HOME, AWAY, L10, STRK] };

const SOCCER: StandingsFormat = {
  sort: [['rank', 'asc']],
  columns: [
    GP, W,
    { type: 'ties', label: 'D', title: 'Draws' },
    L,
    { type: 'pointsfor', label: 'GF', title: 'Goals for' },
    { type: 'pointsagainst', label: 'GA', title: 'Goals against' },
    { type: 'pointdifferential', label: 'GD', title: 'Goal difference' },
    { type: 'points', label: 'Pts', title: 'Points' },
  ],
};

const COLLEGE_BASKETBALL: StandingsFormat = {
  sort: BY_SEED,
  columns: [
    { type: 'vsconf', label: 'Conf', title: 'Conference record' },
    { type: 'total', label: 'Overall', title: 'Overall record' },
    HOME, AWAY, STRK,
  ],
};

/**
 * How each team league's standings are grouped, ordered and shown. Stat types differ by
 * league (CFB uses 'homerecord', the NBA 'home'), so columns are per league.
 *
 * MLB divisions sort by games behind: ESPN's MLB `playoffseed` is league-wide and doesn't
 * follow division order.
 */
export const STANDINGS_FORMATS: Record<SportLeague, StandingsFormat> = {
  'basketball/nba': BASKETBALL,
  'basketball/wnba': BASKETBALL,
  'football/nfl': {
    level: '3',
    sort: BY_SEED,
    columns: [
      W, L, { type: 'ties', label: 'T', title: 'Ties' }, PCT,
      { type: 'divisionrecord', label: 'Div', title: 'Division record' },
      { type: 'pointsfor', label: 'PF', title: 'Points for' },
      { type: 'pointsagainst', label: 'PA', title: 'Points against' },
      { type: 'pointdifferential', label: 'Diff', title: 'Point differential' },
      STRK,
    ],
  },
  'baseball/mlb': {
    level: '3',
    sort: [['gamesbehind', 'asc'], ['winpercent', 'desc']],
    columns: [W, L, PCT, GB, HOME, AWAY, L10, STRK],
  },
  'hockey/nhl': {
    level: '3',
    sort: BY_SEED,
    columns: [
      GP, W, L,
      { type: 'otlosses', label: 'OTL', title: 'Overtime losses' },
      { type: 'points', label: 'Pts', title: 'Points' },
      { type: 'pointsfor', label: 'GF', title: 'Goals for' },
      { type: 'pointsagainst', label: 'GA', title: 'Goals against' },
      { type: 'pointdifferential', label: 'Diff', title: 'Goal differential' },
      HOME, AWAY, STRK,
    ],
  },
  'soccer/usa.1': SOCCER,
  'soccer/eng.1': SOCCER,
  'soccer/usa.nwsl': SOCCER,
  'football/college-football': {
    sort: BY_SEED,
    columns: [
      { type: 'vsconf', label: 'Conf', title: 'Conference record' },
      { type: 'total', label: 'Overall', title: 'Overall record' },
      { type: 'homerecord', label: 'Home' },
      { type: 'awayrecord', label: 'Away' },
      { type: 'vsaprankedteams', label: 'vs AP', title: 'Record vs AP Top 25' },
      STRK,
    ],
  },
  'basketball/mens-college-basketball': COLLEGE_BASKETBALL,
  'basketball/womens-college-basketball': COLLEGE_BASKETBALL,
};
