/**
 * A realistic multi-league config for component tests (BJ's original dashboard).
 * App code starts from an empty config; this exists only for specs.
 */
import { DashboardConfig } from '../core/models/team-config.model';
import { GOLF_OPTIONS, SERIES_OPTIONS } from '../core/config/leagues.config';

export const SAMPLE_CONFIG: DashboardConfig = {
  teams: [
    {
      kind: 'team',
      espnId: '10',
      abbreviation: 'NYY',
      name: 'New York Yankees',
      shortName: 'Yankees',
      sport: 'baseball/mlb',
      primaryColor: '#003087',
      secondaryColor: '#E4E4E4',
    },
    {
      kind: 'team',
      espnId: '20',
      abbreviation: 'WSH',
      name: 'Washington Nationals',
      shortName: 'Nationals',
      sport: 'baseball/mlb',
      primaryColor: '#AB0003',
      secondaryColor: '#14225A',
    },
    {
      kind: 'team',
      espnId: '18',
      abbreviation: 'NY',
      name: 'New York Knicks',
      shortName: 'Knicks',
      sport: 'basketball/nba',
      primaryColor: '#006BB6',
      secondaryColor: '#F58426',
    },
    {
      kind: 'team',
      espnId: '19',
      abbreviation: 'NYG',
      name: 'New York Giants',
      shortName: 'Giants',
      sport: 'football/nfl',
      primaryColor: '#0B2265',
      secondaryColor: '#A71930',
    },
    {
      kind: 'team',
      espnId: '13',
      abbreviation: 'NYR',
      name: 'New York Rangers',
      shortName: 'Rangers',
      sport: 'hockey/nhl',
      primaryColor: '#0038A8',
      secondaryColor: '#CE1126',
    },
  ],
  series: [...SERIES_OPTIONS],
  golf: [...GOLF_OPTIONS],
};
