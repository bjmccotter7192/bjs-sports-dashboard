export type SportLeague =
  | 'basketball/nba'
  | 'football/nfl'
  | 'baseball/mlb'
  | 'hockey/nhl';

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
