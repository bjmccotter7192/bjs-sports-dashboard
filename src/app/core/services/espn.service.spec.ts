/**
 * EspnService unit tests.
 *
 * KEY CONCEPTS:
 *
 * - provideHttpClientTesting() swaps Angular's real HttpClient with a test
 *   double. No real network calls are ever made.
 * - HttpTestingController lets us inspect outgoing requests, assert their URL /
 *   params, and manually flush a fake response body.
 * - Because EspnService uses firstValueFrom() (which returns a Promise), each
 *   test is an async function. We flush the HTTP request THEN await the Promise.
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { EspnService, formatDateYMD, overallRecord, parseRecord, pollRank, sortStandingsRows, withRecords } from './espn.service';
import { StandingsRow } from '../models/standings.model';
import { EspnEvent, EspnScoreboardResponse } from '../models/game.model';
import { makeEspnTeamEvent, makeEspnRaceEvent, makeGame } from '../../testing/test-fixtures';

const BASE = 'https://site.api.espn.com/apis/site/v2/sports';

describe('EspnService', () => {
  let service: EspnService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      // provideHttpClient() registers Angular's HttpClient.
      // provideHttpClientTesting() replaces the real backend with HttpTestingController.
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(EspnService);
    http = TestBed.inject(HttpTestingController);
  });

  // Verify no unexpected HTTP requests leaked between tests.
  afterEach(() => http.verify());

  // ── formatDateYMD ────────────────────────────────────────────────────────

  describe('formatDateYMD', () => {
    it('formats a date as YYYYMMDD', () => {
      expect(formatDateYMD(new Date(2026, 5, 16))).toBe('20260616');
    });

    it('zero-pads single-digit month and day', () => {
      expect(formatDateYMD(new Date(2026, 0, 5))).toBe('20260105');
    });
  });

  // ── getScoreboard ────────────────────────────────────────────────────────

  describe('getScoreboard', () => {
    it('calls the correct scoreboard URL', async () => {
      const promise = service.getScoreboard('baseball/mlb');
      http.expectOne(`${BASE}/baseball/mlb/scoreboard`).flush({ events: [] });
      await promise;
    });

    it('adds league-specific params (college hoops would otherwise return Top-25 only)', async () => {
      const promise = service.getScoreboard('basketball/mens-college-basketball', '20260307');
      const req = http.expectOne(r => r.url.includes('/mens-college-basketball/scoreboard'));
      expect(req.request.params.get('groups')).toBe('50');
      expect(req.request.params.get('limit')).toBe('400');
      expect(req.request.params.get('dates')).toBe('20260307');
      req.flush({ events: [] });
      await promise;
    });

    it('adds no extra params for leagues without them', async () => {
      const promise = service.getScoreboard('baseball/mlb');
      const req = http.expectOne(r => r.url.includes('/baseball/mlb/scoreboard'));
      expect(req.request.params.keys()).toEqual([]);
      req.flush({ events: [] });
      await promise;
    });

    it('appends a dates query param when provided', async () => {
      const promise = service.getScoreboard('baseball/mlb', '20260616');
      const req = http.expectOne(r => r.url.includes('/baseball/mlb/scoreboard'));
      expect(req.request.params.get('dates')).toBe('20260616');
      req.flush({ events: [] });
      await promise;
    });

    it('returns the response body as-is', async () => {
      const body: EspnScoreboardResponse = { events: [makeEspnTeamEvent()] };
      const promise = service.getScoreboard('basketball/nba');
      http.expectOne(`${BASE}/basketball/nba/scoreboard`).flush(body);
      const result = await promise;
      expect(result.events).toHaveLength(1);
    });
  });

  // ── getTeams ─────────────────────────────────────────────────────────────

  describe('getTeams', () => {
    const STANDINGS = 'https://site.api.espn.com/apis/v2/sports';
    const rangers = { id: '13', abbreviation: 'NYR', displayName: 'New York Rangers', shortDisplayName: 'Rangers',
      logos: [{ href: 'https://example.com/nyr.png' }] };
    const ducks = { id: '25', abbreviation: 'ANA', displayName: 'Anaheim Ducks', shortDisplayName: 'Ducks', logos: [] };
    const entries = (...teams: unknown[]) => ({ standings: { entries: teams.map(team => ({ team })) } });

    it('reads the CORS-enabled standings endpoint, not /teams', async () => {
      const promise = service.getTeams('hockey/nhl');
      http.expectOne(`${STANDINGS}/hockey/nhl/standings`).flush({});
      expect(await promise).toEqual([]);
    });

    it('flattens conference → division standings into sorted options with placeholder colors', async () => {
      const promise = service.getTeams('hockey/nhl');
      http.expectOne(`${STANDINGS}/hockey/nhl/standings`).flush({
        children: [
          { name: 'Eastern', children: [{ name: 'Metropolitan', ...entries(rangers) }] },
          { name: 'Western', ...entries(ducks) },
        ],
      });
      const result = await promise;
      expect(result.map(o => o.config.name)).toEqual(['Anaheim Ducks', 'New York Rangers']);
      expect(result[1]).toEqual({
        config: {
          kind: 'team', espnId: '13', abbreviation: 'NYR', name: 'New York Rangers', shortName: 'Rangers',
          sport: 'hockey/nhl', primaryColor: '#666666', secondaryColor: '#999999',
        },
        logo: 'https://example.com/nyr.png',
      });
      expect(result[0].logo).toBe('');
    });

    it('reads top-level standings (single-table leagues like the EPL) without duplicates', async () => {
      const promise = service.getTeams('soccer/eng.1');
      http.expectOne(`${STANDINGS}/soccer/eng.1/standings`).flush({
        ...entries(rangers), children: [entries(rangers, ducks)],
      });
      expect((await promise).map(o => o.config.espnId)).toEqual(['25', '13']);
    });

    it('drops teams with invalid fields', async () => {
      const promise = service.getTeams('basketball/nba');
      http.expectOne(`${STANDINGS}/basketball/nba/standings`).flush({
        children: [entries({ id: 'abc', abbreviation: 'X', displayName: 'Bad Id', shortDisplayName: 'Bad' })],
      });
      expect(await promise).toEqual([]);
    });
  });

  // ── getStandings ─────────────────────────────────────────────────────────

  describe('getStandings', () => {
    const STANDINGS = 'https://site.api.espn.com/apis/v2/sports';
    const team = (id: string, short: string) => ({
      id, abbreviation: short.slice(0, 3).toUpperCase(), displayName: `The ${short}`, shortDisplayName: short,
      logos: [{ href: `https://example.com/${id}.png` }],
    });
    const stat = (type: string, value: number | undefined, displayValue: string) => ({ type, value, displayValue });
    const entry = (t: unknown, ...stats: unknown[]) => ({ team: t, stats });

    it('requests ESPN default grouping for conference leagues', async () => {
      const promise = service.getStandings('basketball/nba');
      http.expectOne(`${STANDINGS}/basketball/nba/standings`).flush({});
      expect(await promise).toEqual([]);
    });

    it('requests divisions (level=3) where the format asks for them', async () => {
      const promise = service.getStandings('football/nfl');
      http.expectOne(`${STANDINGS}/football/nfl/standings?level=3`).flush({});
      expect(await promise).toEqual([]);
    });

    it('returns one group per node with entries, sorted by seed (ESPN sends NBA worst-first)', async () => {
      const promise = service.getStandings('basketball/nba');
      http.expectOne(`${STANDINGS}/basketball/nba/standings`).flush({
        children: [
          { name: 'Eastern Conference', standings: { entries: [
            entry(team('4', 'Bulls'), stat('playoffseed', 13, '13'), stat('wins', 1, '1')),
            entry(team('18', 'Knicks'), stat('playoffseed', 2, '2'), stat('wins', 5, '5')),
          ] } },
          { name: 'Western Conference', standings: { entries: [entry(team('25', 'Thunder'), stat('playoffseed', 1, '1'))] } },
        ],
      });
      const groups = await promise;
      expect(groups.map(g => g.name)).toEqual(['Eastern Conference', 'Western Conference']);
      expect(groups[0].rows.map(r => r.name)).toEqual(['Knicks', 'Bulls']);
      expect(groups[0].rows[0]).toEqual({
        teamId: '18', abbreviation: 'KNI', name: 'Knicks', logo: 'https://example.com/18.png',
        stats: { playoffseed: { value: 2, display: '2' }, wins: { value: 5, display: '5' } },
      });
    });

    it('keeps only top-level stats, first occurrence wins', async () => {
      const promise = service.getStandings('football/college-football');
      http.expectOne(`${STANDINGS}/football/college-football/standings`).flush({
        children: [{ name: 'Big Ten', standings: { entries: [entry(team('26', 'UCLA'),
          stat('wins', 8, '8'), stat('total', undefined, '8-0'),
          stat('homerecord_wins', 5, '5'), stat('wins', 99, '99'),
        )] } }],
      });
      expect((await promise)[0].rows[0].stats).toEqual({
        wins: { value: 8, display: '8' }, total: { value: null, display: '8-0' },
      });
    });

    it('sorts MLB divisions by games behind, then win percentage', async () => {
      const promise = service.getStandings('baseball/mlb');
      http.expectOne(`${STANDINGS}/baseball/mlb/standings?level=3`).flush({
        children: [{ name: 'AL Central', standings: { entries: [
          entry(team('4', 'White Sox'), stat('playoffseed', 6, '6'), stat('gamesbehind', 1, '1'), stat('winpercent', 0.519, '.519')),
          entry(team('5', 'Guardians'), stat('playoffseed', 2, '2'), stat('gamesbehind', 0, '-'), stat('winpercent', 0.525, '.525')),
        ] } }],
      });
      expect((await promise)[0].rows.map(r => r.name)).toEqual(['Guardians', 'White Sox']);
    });

    it('drops entries without a team id or name', async () => {
      const promise = service.getStandings('soccer/eng.1');
      http.expectOne(`${STANDINGS}/soccer/eng.1/standings`).flush({
        children: [{ name: 'EPL', standings: { entries: [entry({ abbreviation: 'X' }), entry(team('359', 'Arsenal'))] } }],
      });
      expect((await promise)[0].rows.map(r => r.teamId)).toEqual(['359']);
    });
  });

  describe('sortStandingsRows', () => {
    const r = (id: string, stats: Record<string, number | null>): StandingsRow => ({
      teamId: id, abbreviation: id, name: id, logo: '',
      stats: Object.fromEntries(Object.entries(stats).map(([k, v]) => [k, { value: v, display: '' }])),
    });

    it('puts rows missing the sort stat last and keeps ties stable', () => {
      const rows = [r('a', {}), r('b', { rank: 2 }), r('c', { rank: 1 }), r('d', { rank: 2 })];
      expect(sortStandingsRows(rows, [['rank', 'asc']]).map(x => x.teamId)).toEqual(['c', 'b', 'd', 'a']);
    });

    it('breaks ties with later keys', () => {
      const rows = [r('a', { gb: 0, pct: 0.4 }), r('b', { gb: 0, pct: 0.6 })];
      expect(sortStandingsRows(rows, [['gb', 'asc'], ['pct', 'desc']]).map(x => x.teamId)).toEqual(['b', 'a']);
    });
  });

  // ── getTeamColors ────────────────────────────────────────────────────────

  describe('getTeamColors', () => {
    it('reads colors from the team schedule endpoint', async () => {
      const promise = service.getTeamColors('basketball/nba', '18');
      http.expectOne(`${BASE}/basketball/nba/teams/18/schedule`)
        .flush({ team: { id: '18', color: '1d428a', alternateColor: 'f58426' }, events: [] });
      expect(await promise).toEqual({ primaryColor: '#1d428a', secondaryColor: '#f58426' });
    });

    it('falls back to grey for missing or malformed colors', async () => {
      const promise = service.getTeamColors('basketball/nba', '18');
      http.expectOne(`${BASE}/basketball/nba/teams/18/schedule`)
        .flush({ team: { color: 'zzz', alternateColor: null } });
      expect(await promise).toEqual({ primaryColor: '#666666', secondaryColor: '#999999' });
    });
  });

  // ── getTeamSchedule ──────────────────────────────────────────────────────

  describe('getTeamSchedule', () => {
    const scheduledEvent = (id: string, state: 'pre' | 'post') => ({
      id, date: '2026-10-20T19:00Z', name: 'T', shortName: 'T', status: null,
      competitions: [{ date: '2026-10-20T19:00Z', competitors: [],
        status: { type: { state, completed: state === 'post', description: '', shortDetail: '' } } }],
    });

    it('merges soccer results with fixtures (fixture=true), without duplicates', async () => {
      const promise = service.getTeamSchedule('soccer/eng.1', '382');
      const reqs = http.match(r => r.url.endsWith('/soccer/eng.1/teams/382/schedule'));
      expect(reqs).toHaveLength(2);
      const fixtures = reqs.find(r => r.request.params.get('fixture') === 'true')!;
      const results = reqs.find(r => !r.request.params.has('fixture'))!;
      results.flush({ events: [scheduledEvent('r1', 'post'), scheduledEvent('shared', 'post')] });
      fixtures.flush({ events: [scheduledEvent('f1', 'pre'), scheduledEvent('shared', 'pre')] });
      const result = await promise;
      expect(result.events.map(e => e.id)).toEqual(['r1', 'shared', 'f1']);
    });

    it("keeps each past game's records and poll ranks for parseGame", async () => {
      const promise = service.getTeamSchedule('basketball/mens-college-basketball', '130');
      http.expectOne(`${BASE}/basketball/mens-college-basketball/teams/130/schedule`).flush({ events: [{
        id: 'g', date: '2026-11-03T23:00Z', name: 'T', shortName: 'T', status: null,
        competitions: [{ date: '2026-11-03T23:00Z',
          status: { type: { state: 'post', completed: true, description: 'Final', shortDetail: 'Final' } },
          competitors: [
            { homeAway: 'home', team: { id: '130', abbreviation: 'MICH' }, score: { displayValue: '80' },
              record: [{ type: 'total', displayValue: '1-0' }, { type: 'vsconf', displayValue: '0-0' }],
              curatedRank: { current: 16 } },
            { homeAway: 'away', team: { id: '2473', abbreviation: 'OAK' }, score: { displayValue: '70' },
              curatedRank: { current: 99 } },
          ] }],
      }] });
      const game = service.parseGame((await promise).events[0]);
      expect(game.homeTeam.record).toBe('1-0');
      expect(game.homeTeam.rank).toBe(16);
      expect(game.awayTeam.record).toBeUndefined();
      expect(game.awayTeam.rank).toBeUndefined();
    });

    it('makes a single request for non-soccer leagues', async () => {
      const promise = service.getTeamSchedule('basketball/wnba', '20');
      const req = http.expectOne(`${BASE}/basketball/wnba/teams/20/schedule`);
      expect(req.request.params.has('fixture')).toBe(false);
      req.flush({ events: [] });
      await promise;
    });

    it('calls the team schedule endpoint', async () => {
      const promise = service.getTeamSchedule('baseball/mlb', '10');
      http.expectOne(`${BASE}/baseball/mlb/teams/10/schedule`).flush({ events: [] });
      await promise;
    });

    it('normalizes logos array to a logo string', async () => {
      const rawEvent = {
        id: '1',
        date: '2026-06-20T00:00Z',
        name: 'Test',
        shortName: 'T',
        status: null,
        competitions: [{
          date: '2026-06-20T00:00Z',
          status: { type: { state: 'pre', completed: false, description: 'Scheduled', shortDetail: 'Sched' } },
          competitors: [{
            homeAway: 'home',
            team: {
              id: '10', abbreviation: 'NYY', displayName: 'Yankees', shortDisplayName: 'Yankees',
              logos: [{ href: 'https://example.com/nyy.png' }],
            },
          }],
        }],
      };
      const promise = service.getTeamSchedule('baseball/mlb', '10');
      http.expectOne(r => r.url.includes('teams/10/schedule')).flush({ events: [rawEvent] });
      const result = await promise;
      expect(result.events[0].competitions[0].competitors[0].team?.logo)
        .toBe('https://example.com/nyy.png');
    });

    it('uses competition.status when event.status is null', async () => {
      const rawEvent = {
        id: '1', date: '2026-06-20T00:00Z', name: 'T', shortName: 'T',
        status: null,
        competitions: [{
          date: '2026-06-20T00:00Z',
          status: { type: { state: 'pre', completed: false, description: 'Scheduled', shortDetail: '6/20' } },
          competitors: [],
        }],
      };
      const promise = service.getTeamSchedule('baseball/mlb', '10');
      http.expectOne(r => r.url.includes('teams/10/schedule')).flush({ events: [rawEvent] });
      const result = await promise;
      expect(result.events[0].status.type.state).toBe('pre');
    });

    it('flattens score objects to their displayValue string', async () => {
      const rawEvent = {
        id: '1', date: '2026-10-20T23:00Z', name: 'T', shortName: 'T',
        status: null,
        competitions: [{
          date: '2026-10-20T23:00Z',
          status: { type: { state: 'post', completed: true, description: 'Final', shortDetail: 'Final' } },
          competitors: [
            { homeAway: 'home', score: { value: 106, displayValue: '106' }, winner: true },
            { homeAway: 'away', score: '100', winner: false },
          ],
        }],
      };
      const promise = service.getTeamSchedule('basketball/nba', '18');
      http.expectOne(r => r.url.includes('teams/18/schedule')).flush({ events: [rawEvent] });
      const result = await promise;
      const [home, away] = result.events[0].competitions[0].competitors;
      expect(home.score).toBe('106');
      expect(away.score).toBe('100');
    });
  });

  // ── findTeamGame ─────────────────────────────────────────────────────────

  describe('findTeamGame', () => {
    it('returns null for undefined scoreboard', () => {
      expect(service.findTeamGame(undefined, '10')).toBeNull();
    });

    it('returns null for empty events', () => {
      expect(service.findTeamGame({ events: [] }, '10')).toBeNull();
    });

    it('returns the game when the team is in the home slot', () => {
      const scoreboard = { events: [makeEspnTeamEvent({ homeId: '10', awayId: '4' })] };
      expect(service.findTeamGame(scoreboard, '10')).not.toBeNull();
    });

    it('returns the game when the team is in the away slot', () => {
      const scoreboard = { events: [makeEspnTeamEvent({ homeId: '4', awayId: '10' })] };
      expect(service.findTeamGame(scoreboard, '10')).not.toBeNull();
    });

    it('returns null when team is not in any game', () => {
      const scoreboard = { events: [makeEspnTeamEvent({ homeId: '4', awayId: '2' })] };
      expect(service.findTeamGame(scoreboard, '10')).toBeNull();
    });

    it('matches on team id, not abbreviation', () => {
      // ESPN abbreviates the Knicks as 'NY' — id matching makes that irrelevant
      const scoreboard = { events: [makeEspnTeamEvent({ homeId: '18', homeAbbr: 'NY' })] };
      expect(service.findTeamGame(scoreboard, '18')).not.toBeNull();
      expect(service.findTeamGame(scoreboard, 'NY')).toBeNull();
    });
  });

  // ── findLastPlayedGame ───────────────────────────────────────────────────

  describe('findLastPlayedGame', () => {
    it('returns null when no completed games exist', () => {
      const scoreboard = { events: [makeEspnTeamEvent({ homeId: '10', state: 'pre' })] };
      expect(service.findLastPlayedGame(scoreboard, '10')).toBeNull();
    });

    it('returns the most recent completed game (not an earlier one)', () => {
      // Two completed NYY games — the later one should win.
      const older = makeEspnTeamEvent({ id: 'g1', homeId: '10', state: 'post', date: '2026-06-10T23:00Z' });
      const newer = makeEspnTeamEvent({ id: 'g2', homeId: '10', state: 'post', date: '2026-06-15T23:00Z' });
      const scoreboard = { events: [older, newer] };
      const game = service.findLastPlayedGame(scoreboard, '10');
      expect(game?.id).toBe('g2');
    });

    it('ignores games for other teams', () => {
      const scoreboard = { events: [makeEspnTeamEvent({ homeId: '4', awayId: '2', state: 'post' })] };
      expect(service.findLastPlayedGame(scoreboard, '10')).toBeNull();
    });

    it('ignores completed games before the since cutoff', () => {
      const old = makeEspnTeamEvent({ id: 'g1', homeId: '10', state: 'post', date: '2026-06-01T23:00Z' });
      const scoreboard = { events: [old] };
      expect(service.findLastPlayedGame(scoreboard, '10', new Date('2026-06-10T00:00Z'))).toBeNull();
      expect(service.findLastPlayedGame(scoreboard, '10', new Date('2026-05-30T00:00Z'))?.id).toBe('g1');
    });
  });

  // ── getAllTeamGames ───────────────────────────────────────────────────────

  describe('getAllTeamGames', () => {
    it('returns all games involving any of the supplied team ids', () => {
      const events = [
        makeEspnTeamEvent({ id: 'g1', homeId: '10', awayId: '4', state: 'pre' }),
        makeEspnTeamEvent({ id: 'g2', homeId: '20', awayId: '4', state: 'pre' }),
        makeEspnTeamEvent({ id: 'g3', homeId: '2',  awayId: '4', state: 'pre' }),
      ];
      const result = service.getAllTeamGames({ events }, ['10', '20']);
      expect(result).toHaveLength(2);
      expect(result.map(g => g.id)).toEqual(expect.arrayContaining(['g1', 'g2']));
    });

    it('returns empty array for undefined scoreboard', () => {
      expect(service.getAllTeamGames(undefined, ['10'])).toEqual([]);
    });
  });

  // ── parseGame ────────────────────────────────────────────────────────────

  describe('parseRecord / pollRank', () => {
    it("drops the NHL's points suffix", () => {
      expect(parseRecord('12-2-2, 26 PTS')).toBe('12-2-2');
      expect(parseRecord('93-68')).toBe('93-68');
      expect(parseRecord('8-1-1, 0 PTS extra')).toBeUndefined();
      expect(parseRecord(42)).toBeUndefined();
    });

    it('keeps only Top-25 ranks (ESPN sends 99 for unranked)', () => {
      expect(pollRank({ current: 8 })).toBe(8);
      expect(pollRank({ current: 25 })).toBe(25);
      expect(pollRank({ current: 99 })).toBeUndefined();
      expect(pollRank({ current: 0 })).toBeUndefined();
      expect(pollRank(undefined)).toBeUndefined();
    });
  });

  describe('withRecords', () => {
    const records = new Map([['10', '93-68'], ['4', '60-102']]);

    it("fills missing records but keeps ESPN's own", () => {
      const base = makeGame();
      const game = withRecords(makeGame({ homeTeam: { ...base.homeTeam, record: '1-0' } }), records);
      expect(game.homeTeam.record).toBe('1-0');
      expect(game.awayTeam.record).toBe('60-102');
    });

    it('returns the same game when there is nothing to add', () => {
      const game = makeGame();
      expect(withRecords(game, undefined)).toBe(game);
      expect(withRecords(game, new Map([['999', '1-0']]))).toBe(game);
    });
  });

  describe('getTeamRecords', () => {
    it('maps every team to its overall record from standings', async () => {
      const promise = service.getTeamRecords('hockey/nhl');
      http.expectOne('https://site.api.espn.com/apis/v2/sports/hockey/nhl/standings?level=3').flush({
        children: [{ name: 'Metro', standings: { entries: [
          { team: { id: '7', shortDisplayName: 'Hurricanes' }, stats: [{ type: 'total', displayValue: '12-2-2, 26 PTS' }] },
          { team: { id: '13', shortDisplayName: 'Rangers' }, stats: [] },
        ] } }],
      });
      expect([...(await promise)]).toEqual([['7', '12-2-2']]);
    });
  });

  describe('overallRecord', () => {
    it("reads 'total', or the NHL's 'ytd'", () => {
      expect(overallRecord([{ type: 'total', summary: '6-1' }])).toBe('6-1');
      expect(overallRecord([{ type: 'home', summary: '4-4-1' }, { type: 'ytd', summary: '8-7-2' }])).toBe('8-7-2');
    });

    it('ignores missing, split-only, or non-record summaries', () => {
      expect(overallRecord(undefined)).toBeUndefined();
      expect(overallRecord([{ type: 'home', summary: '2-0' }])).toBeUndefined();
      expect(overallRecord([{ type: 'total', summary: '<b>6-1</b>' }])).toBeUndefined();
      expect(overallRecord([{ type: 'total', summary: '6' }])).toBeUndefined();
    });
  });

  describe('parseGame', () => {
    it('correctly separates home and away teams', () => {
      const game = service.parseGame(makeEspnTeamEvent({ homeAbbr: 'NYY', awayAbbr: 'CHW' }));
      expect(game.homeTeam.abbreviation).toBe('NYY');
      expect(game.homeTeam.id).toBe('10');
      expect(game.awayTeam.abbreviation).toBe('CHW');
    });

    it('maps the score and winner flag', () => {
      const event = makeEspnTeamEvent({ homeAbbr: 'NYY', awayAbbr: 'CHW', homeScore: '5', awayScore: '2', homeWinner: true, state: 'post' });
      const game = service.parseGame(event);
      expect(game.homeTeam.score).toBe('5');
      expect(game.homeTeam.isWinner).toBe(true);
      expect(game.awayTeam.isWinner).toBe(false);
    });

    it('maps a Top-25 poll rank from the scoreboard', () => {
      const event = makeEspnTeamEvent();
      event.competitions[0].competitors[0].curatedRank = { current: 8 };
      event.competitions[0].competitors[1].curatedRank = { current: 99 };
      const game = service.parseGame(event);
      expect(game.homeTeam.rank).toBe(8);
      expect(game.awayTeam.rank).toBeUndefined();
    });

    it("maps each team's overall record when the scoreboard has one", () => {
      const game = service.parseGame(makeEspnTeamEvent({
        homeRecords: [{ type: 'home', summary: '2-0' }, { type: 'total', summary: '6-1' }],
      }));
      expect(game.homeTeam.record).toBe('6-1');
      expect(game.awayTeam.record).toBeUndefined();
    });

    it('maps venue and broadcast', () => {
      const event = makeEspnTeamEvent({ venue: 'Yankee Stadium', broadcast: 'ESPN' });
      const game = service.parseGame(event);
      expect(game.venue).toBe('Yankee Stadium');
      expect(game.broadcast).toBe('ESPN');
    });

    it('maps status correctly for a scheduled game', () => {
      const game = service.parseGame(makeEspnTeamEvent({ state: 'pre' }));
      expect(game.status.state).toBe('pre');
    });
  });

  // ── parseRace ────────────────────────────────────────────────────────────

  describe('parseRace', () => {
    it('picks the Race competition (not FP1) for winner and date', () => {
      // Event has FP1 (George Russell), Qual (wrong), and Race (Lewis Hamilton).
      const event = makeEspnRaceEvent({ state: 'post', winnerName: 'Lewis Hamilton', raceDate: '2026-06-14T13:00Z' });
      const race = service.parseRace(event);
      expect(race.winner?.driverName).toBe('Lewis Hamilton');
      expect(race.date.toISOString()).toContain('2026-06-14');
    });

    it('falls back to competitions[0] when no Race type exists', () => {
      const event: EspnEvent = {
        id: '1', date: '2026-06-14T13:00Z', name: 'Test Race', shortName: 'Test',
        status: { type: { state: 'post', completed: true, description: 'Final', shortDetail: 'Final' } },
        competitions: [{
          competitors: [{ order: 1, athlete: { displayName: 'Some Driver', shortName: 'S. Driver' } }],
        }],
      };
      const race = service.parseRace(event);
      expect(race.winner?.driverName).toBe('Some Driver');
    });

    it('does not set a winner for a pre-race event', () => {
      const race = service.parseRace(makeEspnRaceEvent({ state: 'pre' }));
      expect(race.winner).toBeUndefined();
    });

    it('maps race name and id from the event', () => {
      const event = makeEspnRaceEvent({ id: 'r42', name: 'British Grand Prix' });
      const race = service.parseRace(event);
      expect(race.id).toBe('r42');
      expect(race.name).toBe('British Grand Prix');
    });

    it('populates topFinishers for a post-race event', () => {
      const event: EspnEvent = {
        id: 'r1', date: '2026-06-20T13:00Z', name: 'British Grand Prix', shortName: 'British GP',
        status: { type: { state: 'post', completed: true, description: 'Final', shortDetail: 'Final' } },
        competitions: [{
          type: { abbreviation: 'Race' },
          date: '2026-06-20T13:00Z',
          competitors: [
            { order: 1, winner: true,  athlete: { displayName: 'Lewis Hamilton',  shortName: 'L. Hamilton' } },
            { order: 2, winner: false, athlete: { displayName: 'Max Verstappen',  shortName: 'M. Verstappen' } },
            { order: 3, winner: false, athlete: { displayName: 'Charles Leclerc', shortName: 'C. Leclerc' } },
          ],
        }],
      };
      const race = service.parseRace(event);
      expect(race.topFinishers).toHaveLength(3);
      expect(race.topFinishers![0].position).toBe(1);
      expect(race.topFinishers![0].driverName).toBe('Lewis Hamilton');
      expect(race.topFinishers![0].winner).toBe(true);
      expect(race.topFinishers![1].driverName).toBe('Max Verstappen');
      expect(race.topFinishers![2].driverName).toBe('Charles Leclerc');
    });

    it('topFinishers is undefined for a pre-race event', () => {
      const race = service.parseRace(makeEspnRaceEvent({ state: 'pre' }));
      expect(race.topFinishers).toBeUndefined();
    });

    it('limits topFinishers to 5 even when more competitors exist', () => {
      const event: EspnEvent = {
        id: 'r1', date: '2026-06-20T13:00Z', name: 'Test Race', shortName: 'Test',
        status: { type: { state: 'post', completed: true, description: 'Final', shortDetail: 'Final' } },
        competitions: [{
          type: { abbreviation: 'Race' },
          date: '2026-06-20T13:00Z',
          competitors: [1,2,3,4,5,6,7].map(i => ({
            order: i,
            athlete: { displayName: `Driver ${i}`, shortName: `D${i}` },
          })),
        }],
      };
      const race = service.parseRace(event);
      expect(race.topFinishers).toHaveLength(5);
    });

    it('sorts topFinishers by order ascending', () => {
      const event: EspnEvent = {
        id: 'r1', date: '2026-06-20T13:00Z', name: 'Test Race', shortName: 'Test',
        status: { type: { state: 'post', completed: true, description: 'Final', shortDetail: 'Final' } },
        competitions: [{
          type: { abbreviation: 'Race' },
          date: '2026-06-20T13:00Z',
          competitors: [
            { order: 3, athlete: { displayName: 'Third', shortName: '3rd' } },
            { order: 1, athlete: { displayName: 'First', shortName: '1st' } },
            { order: 2, athlete: { displayName: 'Second', shortName: '2nd' } },
          ],
        }],
      };
      const race = service.parseRace(event);
      expect(race.topFinishers!.map(f => f.driverName)).toEqual(['First', 'Second', 'Third']);
    });
  });

  // ── findNextRace ─────────────────────────────────────────────────────────

  describe('findNextRace', () => {
    it('returns null for empty / undefined scoreboard', () => {
      expect(service.findNextRace(undefined)).toBeNull();
      expect(service.findNextRace({ events: [] })).toBeNull();
    });

    it('returns a live race over an upcoming one', () => {
      const live = makeEspnRaceEvent({ id: 'live', state: 'in' });
      const upcoming = makeEspnRaceEvent({ id: 'upcoming', state: 'pre', raceDate: '2026-07-06T13:00Z' });
      const race = service.findNextRace({ events: [live, upcoming] });
      expect(race?.id).toBe('live');
    });

    it('returns the nearest upcoming race when no live race exists', () => {
      const near = makeEspnRaceEvent({ id: 'near', state: 'pre', weekendStartDate: '2026-06-27T11:30Z', raceDate: '2026-06-29T13:00Z' });
      const far  = makeEspnRaceEvent({ id: 'far',  state: 'pre', weekendStartDate: '2026-07-04T11:30Z', raceDate: '2026-07-06T13:00Z' });
      const race = service.findNextRace({ events: [far, near] });
      expect(race?.id).toBe('near');
    });

    it('returns null when all races are completed', () => {
      const scoreboard = { events: [makeEspnRaceEvent({ state: 'post' })] };
      expect(service.findNextRace(scoreboard)).toBeNull();
    });
  });

  // ── findLastRace ─────────────────────────────────────────────────────────

  describe('findLastRace', () => {
    it('returns the most recently completed race', () => {
      const older = makeEspnRaceEvent({ id: 'r1', state: 'post', weekendStartDate: '2026-06-05T11:30Z' });
      const newer = makeEspnRaceEvent({ id: 'r2', state: 'post', weekendStartDate: '2026-06-12T11:30Z' });
      const race = service.findLastRace({ events: [older, newer] });
      expect(race?.id).toBe('r2');
    });

    it('returns null when no completed races exist', () => {
      const scoreboard = { events: [makeEspnRaceEvent({ state: 'pre' })] };
      expect(service.findLastRace(scoreboard)).toBeNull();
    });
  });

  // ── getAllUpcomingRaces ───────────────────────────────────────────────────

  describe('getAllUpcomingRaces', () => {
    it('returns only pre and in races, sorted by date ascending', () => {
      const past    = makeEspnRaceEvent({ id: 'past',    state: 'post', weekendStartDate: '2026-06-05T11:30Z' });
      const nearPre = makeEspnRaceEvent({ id: 'nearPre', state: 'pre',  weekendStartDate: '2026-06-27T11:30Z' });
      const live    = makeEspnRaceEvent({ id: 'live',    state: 'in',   weekendStartDate: '2026-06-20T11:30Z' });
      const farPre  = makeEspnRaceEvent({ id: 'farPre',  state: 'pre',  weekendStartDate: '2026-07-04T11:30Z' });
      const races = service.getAllUpcomingRaces({ events: [past, farPre, live, nearPre] });
      expect(races.map(r => r.id)).toEqual(['live', 'nearPre', 'farPre']);
    });

    it('returns empty for undefined scoreboard', () => {
      expect(service.getAllUpcomingRaces(undefined)).toEqual([]);
    });
  });

  // ── fetchGameLeaders ─────────────────────────────────────────────────────

  describe('fetchGameLeaders', () => {
    it('calls the sport summary endpoint with the event id param', async () => {
      const promise = service.fetchGameLeaders('basketball/nba', 'event-1');
      const req = http.expectOne(r => r.url.includes('/basketball/nba/summary'));
      expect(req.request.params.get('event')).toBe('event-1');
      req.flush({ leaders: [] });
      await promise;
    });

    it('returns empty array when summary has no leaders', async () => {
      const promise = service.fetchGameLeaders('basketball/nba', 'event-1');
      http.expectOne(r => r.url.includes('/basketball/nba/summary')).flush({ leaders: [] });
      const result = await promise;
      expect(result).toEqual([]);
    });

    it('parses per-team summary leaders into one category per stat', async () => {
      const body = {
        leaders: [
          {
            team: { id: '10' },
            leaders: [{
              name: 'points',
              displayName: 'Points',
              leaders: [{
                displayValue: '30 PTS',
                mainStat: { value: '30', label: 'PTS' },
                athlete: { displayName: 'Jalen Brunson', shortName: 'J. Brunson', position: { abbreviation: 'PG' } },
              }],
            }],
          },
          {
            team: { id: '20' },
            leaders: [{
              name: 'points',
              displayName: 'Points',
              leaders: [{
                displayValue: '28 PTS',
                mainStat: { value: '28', label: 'PTS' },
                athlete: { displayName: 'Donovan Mitchell', shortName: 'D. Mitchell', position: { abbreviation: 'SG' } },
              }],
            }],
          },
        ],
      };
      const promise = service.fetchGameLeaders('basketball/nba', 'event-1');
      http.expectOne(r => r.url.includes('/basketball/nba/summary')).flush(body);
      const result = await promise;
      expect(result).toHaveLength(1);
      expect(result[0].label).toBe('Points');
      expect(result[0].players).toHaveLength(2);
      expect(result[0].players[0].playerName).toBe('Jalen Brunson');
      expect(result[0].players[0].statLine).toBe('30 PTS');
      expect(result[0].players[1].playerName).toBe('Donovan Mitchell');
    });

    it('uses mainStat value+label for stat line when present', async () => {
      const body = {
        leaders: [{
          team: { id: '10' },
          leaders: [{
            name: 'points',
            displayName: 'Points',
            leaders: [{
              displayValue: 'fallback',
              mainStat: { value: '42', label: 'PTS' },
              athlete: { displayName: 'Player A', shortName: 'P. A' },
            }],
          }],
        }],
      };
      const promise = service.fetchGameLeaders('basketball/nba', 'event-1');
      http.expectOne(r => r.url.includes('/basketball/nba/summary')).flush(body);
      const result = await promise;
      expect(result[0].players[0].statLine).toBe('42 PTS');
    });
  });

  // ── fetchMlbBoxscore ─────────────────────────────────────────────────────

  describe('fetchMlbBoxscore', () => {
    it('calls the MLB summary endpoint with the event id param', async () => {
      const promise = service.fetchMlbBoxscore('event-1');
      const req = http.expectOne(r => r.url.includes('/baseball/mlb/summary'));
      expect(req.request.params.get('event')).toBe('event-1');
      req.flush({ boxscore: { players: [] } });
      await promise;
    });

    it('returns empty array when boxscore has no players', async () => {
      const promise = service.fetchMlbBoxscore('event-1');
      http.expectOne(r => r.url.includes('/baseball/mlb/summary')).flush({ boxscore: { players: [] } });
      const result = await promise;
      expect(result).toEqual([]);
    });

    it('returns top 2 batters per team sorted by RBI desc', async () => {
      const body = {
        boxscore: {
          players: [
            {
              team: { displayName: 'Yankees' },
              statistics: [{
                type: 'batting',
                keys: ['hits-atBats', 'atBats', 'runs', 'hits', 'RBIs', 'homeRuns'],
                athletes: [
                  // RBI=3 → sorts first
                  { athlete: { displayName: 'Aaron Judge', shortName: 'A. Judge', position: { abbreviation: 'RF' } }, stats: ['2-4', '4', '2', '2', '3', '1'] },
                  // RBI=1 → sorts second
                  { athlete: { displayName: 'Juan Soto', shortName: 'J. Soto', position: { abbreviation: 'LF' } }, stats: ['1-4', '4', '0', '1', '1', '0'] },
                  // RBI=0 → would be third, excluded (top 2 only)
                  { athlete: { displayName: 'Anthony Volpe', shortName: 'A. Volpe', position: { abbreviation: 'SS' } }, stats: ['0-4', '4', '0', '0', '0', '0'] },
                ],
              }],
            },
          ],
        },
      };
      const promise = service.fetchMlbBoxscore('event-1');
      http.expectOne(r => r.url.includes('/baseball/mlb/summary')).flush(body);
      const result = await promise;
      const batting = result.find(c => c.label === 'Batting Leaders');
      expect(batting).toBeTruthy();
      expect(batting!.players).toHaveLength(2);
      expect(batting!.players[0].playerName).toBe('Aaron Judge');
      expect(batting!.players[0].statLine).toContain('2-4');
      expect(batting!.players[0].statLine).toContain('3 RBI');
      expect(batting!.players[0].statLine).toContain('1 HR');
      expect(batting!.players[1].playerName).toBe('Juan Soto');
    });

    it('includes Starting Pitchers category with IP, K, and ERA', async () => {
      const body = {
        boxscore: {
          players: [
            {
              team: { displayName: 'Yankees' },
              statistics: [{
                type: 'pitching',
                keys: ['fullInnings.partInnings', 'hits', 'runs', 'earnedRuns', 'walks', 'strikeouts', 'homeRuns', 'pitches-strikes', 'ERA', 'pitches'],
                athletes: [
                  { athlete: { displayName: 'Gerrit Cole', shortName: 'G. Cole', position: { abbreviation: 'SP' } }, stats: ['6.0', '3', '2', '2', '2', '8', '1', '90-59', '2.57', '90'] },
                ],
              }],
            },
          ],
        },
      };
      const promise = service.fetchMlbBoxscore('event-1');
      http.expectOne(r => r.url.includes('/baseball/mlb/summary')).flush(body);
      const result = await promise;
      const pitching = result.find(c => c.label === 'Starting Pitchers');
      expect(pitching).toBeTruthy();
      expect(pitching!.players[0].playerName).toBe('Gerrit Cole');
      expect(pitching!.players[0].statLine).toContain('6.0 IP');
      expect(pitching!.players[0].statLine).toContain('8 K');
      expect(pitching!.players[0].statLine).toContain('ERA 2.57');
    });
  });

  // ── getGamesInDateRange ──────────────────────────────────────────────────

  describe('getGamesInDateRange', () => {
    const start = new Date('2026-06-20T00:00Z');
    const end   = new Date('2026-07-16T23:59Z');

    it('returns only pre/in games within the date window', () => {
      const inRange  = makeEspnTeamEvent({ id: 'in',    homeAbbr: 'NYY', state: 'pre', date: '2026-06-25T23:00Z' });
      const tooEarly = makeEspnTeamEvent({ id: 'early', homeAbbr: 'NYY', state: 'pre', date: '2026-06-10T23:00Z' });
      const tooLate  = makeEspnTeamEvent({ id: 'late',  homeAbbr: 'NYY', state: 'pre', date: '2026-07-20T23:00Z' });
      const finished = makeEspnTeamEvent({ id: 'done',  homeAbbr: 'NYY', state: 'post', date: '2026-06-22T23:00Z' });
      const scoreboard = { events: [inRange, tooEarly, tooLate, finished] };
      const result = service.getGamesInDateRange(scoreboard, start, end);
      expect(result.map(g => g.id)).toEqual(['in']);
    });

    it('returns empty for undefined scoreboard', () => {
      expect(service.getGamesInDateRange(undefined, start, end)).toEqual([]);
    });
  });
});
