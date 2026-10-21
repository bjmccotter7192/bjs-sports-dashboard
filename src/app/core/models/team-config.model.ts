export type SportLeague =
  | 'basketball/nba'
  | 'basketball/wnba'
  | 'football/nfl'
  | 'baseball/mlb'
  | 'hockey/nhl'
  | 'soccer/usa.1'
  | 'soccer/eng.1'
  | 'soccer/usa.nwsl'
  | 'football/college-football'
  | 'basketball/mens-college-basketball'
  | 'basketball/womens-college-basketball';

export type MotorsportLeague =
  | 'racing/f1'
  | 'racing/nascar-premier'
  | 'racing/irl';

export type GolfLeague = 'golf/pga';

export interface TeamConfig {
  kind: 'team';
  espnId: string;
  abbreviation: string;
  name: string;
  shortName: string;
  sport: SportLeague;
  primaryColor: string;
  secondaryColor: string;
}

export interface SeriesConfig {
  kind: 'series';
  name: string;
  shortName: string;
  sport: MotorsportLeague;
  primaryColor: string;
  secondaryColor: string;
}

export interface GolfSeriesConfig {
  kind: 'golf';
  name: string;
  shortName: string;
  sport: GolfLeague;
  primaryColor: string;
  secondaryColor: string;
}

export type League = SportLeague | MotorsportLeague | GolfLeague;

/** Everything the dashboard shows. Array order is display order. */
export interface DashboardConfig {
  teams: TeamConfig[];
  series: SeriesConfig[];
  golf: GolfSeriesConfig[];
}

export type TeamColors = Pick<TeamConfig, 'primaryColor' | 'secondaryColor'>;

/** A team a user can pick in Settings, built from ESPN's /groups endpoint. */
export interface TeamOption {
  config: TeamConfig;
  logo: string;
}
