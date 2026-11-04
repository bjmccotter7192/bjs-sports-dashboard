/** One stat cell from ESPN standings, keyed by the stat's `type` (e.g. 'wins', 'gamesbehind'). */
export interface StandingsStat {
  value: number | null;
  display: string;
}

export interface StandingsRow {
  teamId: string;
  abbreviation: string;
  name: string;
  logo: string;
  stats: Record<string, StandingsStat>;
}

/** One table: a conference, division, or a single-table league. Rows are in standings order. */
export interface StandingsGroup {
  name: string;
  rows: StandingsRow[];
}
