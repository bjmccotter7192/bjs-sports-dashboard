export type SportLeague =
  | 'basketball/nba'
  | 'football/nfl'
  | 'baseball/mlb'
  | 'hockey/nhl'
  | 'cricket';

export type MotorsportLeague =
  | 'racing/f1'
  | 'racing/nascar-premier'
  | 'racing/irl';

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
