import { LEAGUES, TEAM_LEAGUES, leagueRouteKey, teamLeagueByRouteKey } from './leagues.config';

describe('leagues.config', () => {
  it('gives every league a unique URL code', () => {
    const keys = LEAGUES.map(l => leagueRouteKey(l.slug));
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.every(k => /^[a-z0-9]+$/.test(k))).toBe(true);
  });

  it('resolves team leagues from their URL code', () => {
    expect(teamLeagueByRouteKey('nba')?.slug).toBe('basketball/nba');
    expect(teamLeagueByRouteKey('epl')?.slug).toBe('soccer/eng.1');
    expect(teamLeagueByRouteKey('ncaam')?.slug).toBe('basketball/mens-college-basketball');
  });

  it('has no league page for racing/golf or unknown codes', () => {
    expect(teamLeagueByRouteKey('f1')).toBeUndefined();
    expect(teamLeagueByRouteKey('pga')).toBeUndefined();
    expect(teamLeagueByRouteKey('NBA')).toBeUndefined();
    expect(teamLeagueByRouteKey(null)).toBeUndefined();
  });

  it('round-trips every team league', () => {
    for (const l of TEAM_LEAGUES) {
      expect(teamLeagueByRouteKey(leagueRouteKey(l.slug))).toBe(l);
    }
  });
});
