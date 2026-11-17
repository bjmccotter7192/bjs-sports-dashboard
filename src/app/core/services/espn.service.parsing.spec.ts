/**
 * EspnService: malformed and partial ESPN payloads.
 *
 * ESPN's API is unofficial and fields go missing without notice. These tests feed
 * realistic partial payloads through the public methods and assert the parsed
 * result: which fields fall back, which become undefined/null, and what is dropped.
 * HTTP failures (4xx/5xx, network errors) live in espn.service.http-failures.spec.ts.
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { EspnService, sortStandingsRows } from './espn.service';
import { EspnEvent, EspnScoreboardResponse } from '../models/game.model';
import { StandingsRow } from '../models/standings.model';
import { makeEspnRaceEvent, makeEspnTeamEvent } from '../../testing/test-fixtures';

const BASE = 'https://site.api.espn.com/apis/site/v2/sports';
const STANDINGS = 'https://site.api.espn.com/apis/v2/sports';

/** Partial ESPN payloads deliberately don't match the typed shape. */
const asEvent = (raw: unknown) => raw as EspnEvent;
const board = (...events: unknown[]): EspnScoreboardResponse => ({ events: events as EspnEvent[] });

/** A golf event (PGA Tour scoreboard shape). */
function golfEvent(opts: {
  id?: string;
  date?: string;
  endDate?: string;
  state?: 'pre' | 'in' | 'post';
  competitors?: unknown[];
  venue?: string;
} = {}): EspnEvent {
  const state = opts.state ?? 'pre';
  return asEvent({
    id: opts.id ?? 'golf-1',
    name: 'U.S. Open',
    shortName: 'U.S. Open',
    date: opts.date ?? '2026-06-18T04:00Z',
    endDate: opts.endDate,
    status: { type: { state, completed: state === 'post', description: state === 'post' ? 'Final' : 'Scheduled',
      shortDetail: state === 'post' ? 'Final' : 'Thu, June 18th' } },
    competitions: [{
      competitors: opts.competitors ?? [],
      venue: opts.venue ? { fullName: opts.venue } : undefined,
    }],
  });
}

describe('EspnService parsing of partial payloads', () => {
  let service: EspnService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(EspnService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  // ── getTeamSchedule → normalizeTeamScheduleEvent ─────────────────────────

  describe('getTeamSchedule with partial events', () => {
    const url = `${BASE}/baseball/mlb/teams/10/schedule`;

    it('returns no events when the body has no events array', async () => {
      const promise = service.getTeamSchedule('baseball/mlb', '10');
      http.expectOne(url).flush({ team: { id: '10' } });
      expect(await promise).toEqual({ events: [] });
    });

    it('falls back to the event date and a Scheduled status when an event has no competitions', async () => {
      const promise = service.getTeamSchedule('baseball/mlb', '10');
      http.expectOne(url).flush({
        events: [{ id: 'e1', date: '2026-07-04T17:05Z', name: 'TBD at NYY', shortName: 'TBD @ NYY', status: null }],
      });
      const [event] = (await promise).events;
      expect(event.date).toBe('2026-07-04T17:05Z');
      expect(event.status.type).toEqual({
        state: 'pre', completed: false, description: 'Scheduled', shortDetail: 'Scheduled',
      });
      expect(event.competitions[0].competitors).toEqual([]);
    });

    it('parses a competitor with no team, score or records into empty placeholders', async () => {
      const promise = service.getTeamSchedule('baseball/mlb', '10');
      http.expectOne(url).flush({
        events: [{
          id: 'e2', date: '2026-07-05T17:05Z', name: 'TBD at NYY', shortName: 'TBD @ NYY', status: null,
          competitions: [{
            date: '2026-07-05T17:05Z',
            status: { type: { state: 'pre', completed: false, description: 'Scheduled', shortDetail: '7/5' } },
            competitors: [
              { homeAway: 'home', score: { value: 0, displayValue: '0' }, record: 'not-an-array',
                team: { id: '10', abbreviation: 'NYY', displayName: 'New York Yankees' } },
              { homeAway: 'away' },
            ],
          }],
        }],
      });
      const game = service.parseGame((await promise).events[0]);
      expect(game.homeTeam).toEqual({
        id: '10', abbreviation: 'NYY', displayName: 'New York Yankees', logo: '',
        score: '0', isWinner: false, primaryColor: '#666',
      });
      expect(game.awayTeam).toEqual({
        id: '', abbreviation: '', displayName: '', logo: '', score: '', isWinner: false, primaryColor: '#666',
      });
      expect(game.leaders).toEqual([]);
    });

    it('does not throw when an upcoming event lists only one side (opponent TBD)', async () => {
      const promise = service.getTeamSchedule('baseball/mlb', '10');
      http.expectOne(url).flush({
        events: [{
          id: 'e3', date: '2026-10-20T00:08Z', name: 'World Series Game 1', shortName: 'WS G1', status: null,
          competitions: [{
            status: { type: { state: 'pre', completed: false, description: 'Scheduled', shortDetail: 'TBD' } },
            competitors: [{ homeAway: 'home', team: { id: '10', abbreviation: 'NYY', displayName: 'New York Yankees' } }],
          }],
        }],
      });
      const schedule = await promise;
      let games: ReturnType<EspnService['getGamesInDateRange']> = [];
      expect(() => {
        games = service.getGamesInDateRange(schedule, new Date('2026-10-01T00:00Z'), new Date('2026-10-31T00:00Z'));
      }).not.toThrow();
      expect(games).toHaveLength(1);
      expect(games[0].homeTeam.id).toBe('10');
      expect(games[0].awayTeam).toMatchObject({ id: '', displayName: '', score: '' });
    });
  });

  // ── team lookups on partial scoreboards ──────────────────────────────────

  describe('team lookups', () => {
    it('findLastPlayedGame returns null for a missing scoreboard', () => {
      expect(service.findLastPlayedGame(undefined, '10')).toBeNull();
    });

    it('getAllTeamGames skips events whose competitors have no team', () => {
      const teamless = asEvent({
        ...makeEspnTeamEvent({ id: 'x' }),
        competitions: [{ competitors: [{ homeAway: 'home' }, { homeAway: 'away' }] }],
      });
      const games = service.getAllTeamGames(board(teamless, makeEspnTeamEvent({ id: 'ok', homeId: '10' })), ['10']);
      expect(games.map(g => g.id)).toEqual(['ok']);
    });
  });

  // ── parseGame → parseLeaders (scoreboard competition.leaders) ────────────

  describe('scoreboard leaders', () => {
    it('keeps one leader per team and falls back for missing athlete fields', () => {
      const event = makeEspnTeamEvent();
      event.competitions[0].leaders = [
        {
          name: 'points', displayName: 'Points',
          leaders: [
            { displayValue: '31 PTS', team: { id: '10' },
              athlete: { displayName: 'Jalen Brunson', shortName: 'J. Brunson', headshot: 'https://x/jb.png',
                position: { abbreviation: 'PG' } } },
            { displayValue: '28 PTS', team: { id: '10' },
              athlete: { displayName: 'Second Knick', shortName: 'S. Knick' } },
            { displayValue: '25 PTS', team: { id: '4' },
              athlete: { displayName: 'Zach LaVine', shortName: 'Z. LaVine', headshot: { href: 'https://x/zl.png' } } },
            { displayValue: '12 PTS' },
          ],
        },
        { name: 'rebounds', displayName: 'Rebounds' } as never,
      ];
      const leaders = service.parseGame(event).leaders!;
      expect(leaders).toEqual([
        {
          label: 'Points',
          players: [
            { playerName: 'Jalen Brunson', shortName: 'J. Brunson', headshot: 'https://x/jb.png', position: 'PG', statLine: '31 PTS' },
            { playerName: 'Zach LaVine', shortName: 'Z. LaVine', headshot: 'https://x/zl.png', position: undefined, statLine: '25 PTS' },
            { playerName: 'Unknown', shortName: '', headshot: undefined, position: undefined, statLine: '12 PTS' },
          ],
        },
        { label: 'Rebounds', players: [] },
      ]);
    });
  });

  // ── fetchGameLeaders → parseSummaryLeaders / parseSummaryEntry ───────────

  describe('fetchGameLeaders with partial summaries', () => {
    const fetch = async (body: unknown) => {
      const promise = service.fetchGameLeaders('basketball/nba', '401');
      http.expectOne(r => r.url === `${BASE}/basketball/nba/summary`).flush(body as object);
      return promise;
    };

    it('returns [] for an empty summary body', async () => {
      expect(await fetch({})).toEqual([]);
    });

    it('skips teams and categories without leaders and falls back for missing athlete fields', async () => {
      const result = await fetch({
        leaders: [
          { team: { id: '18' } },
          { team: { id: '4' }, leaders: [
            { name: 'assists', displayName: 'Assists' },
            { name: 'points', displayName: 'Points', leaders: [
              { displayValue: '30 PTS', athlete: { displayName: 'Zach LaVine', shortName: 'Z. LaVine', headshot: 'https://x/zl.png' } },
            ] },
            { name: 'rebounds', displayName: 'Rebounds', leaders: [{ displayValue: '9 REB' }] },
          ] },
        ],
      });
      expect(result).toEqual([
        { label: 'Points', players: [
          { playerName: 'Zach LaVine', shortName: 'Z. LaVine', headshot: 'https://x/zl.png', position: undefined, statLine: '30 PTS' },
        ] },
        { label: 'Rebounds', players: [
          { playerName: 'Unknown', shortName: '', headshot: undefined, position: undefined, statLine: '9 REB' },
        ] },
      ]);
    });
  });

  // ── fetchMlbBoxscore → parseMlbBoxscore ───────────────────────────────────

  describe('fetchMlbBoxscore with partial boxscores', () => {
    const fetch = async (body: unknown) => {
      const promise = service.fetchMlbBoxscore('401');
      http.expectOne(r => r.url === `${BASE}/baseball/mlb/summary`).flush(body as object);
      return promise;
    };

    it('returns [] for an empty body, teams without statistics and unknown stat groups', async () => {
      expect(await fetch({})).toEqual([]);
      expect(await fetch({ boxscore: { players: [
        { team: { id: '10' } },
        { team: { id: '4' }, statistics: [{}, { type: 'fielding', keys: ['errors'], athletes: [{ stats: ['1'] }] }] },
        { team: { id: '5' }, statistics: [{ type: 'pitching', keys: ['ERA'], athletes: [] }] },
      ] } })).toEqual([]);
    });

    it('breaks RBI ties by hits', async () => {
      const result = await fetch({ boxscore: { players: [{ statistics: [{
        type: 'batting',
        keys: ['hits-atBats', 'hits', 'RBIs', 'homeRuns'],
        athletes: [
          { athlete: { displayName: 'One Hit', shortName: 'O. Hit' }, stats: ['1-4', '1', '1', '0'] },
          { athlete: { displayName: 'No Stats', shortName: 'N. Stats' } },
          { athlete: { displayName: 'Bench', shortName: 'Bench' } },
          { athlete: { displayName: 'Three Hits', shortName: 'T. Hits' }, stats: ['3-4', '3', '1', '1'] },
          { athlete: { displayName: 'Hitless', shortName: 'Hitless' }, stats: ['0-3', '0', '0', '0'] },
        ],
      }] }] } });
      expect(result).toEqual([{ label: 'Batting Leaders', players: [
        { playerName: 'Three Hits', shortName: 'T. Hits', headshot: undefined, position: undefined, statLine: '3-4, 1 RBI, 1 HR' },
        { playerName: 'One Hit', shortName: 'O. Hit', headshot: undefined, position: undefined, statLine: '1-4, 1 RBI' },
      ] }]);
    });

    it('falls back to Unknown and an empty stat line when keys, stats and athlete are missing', async () => {
      const result = await fetch({ boxscore: { players: [{ statistics: [
        { type: 'batting', athletes: [{}] },
        { type: 'pitching', keys: ['fullInnings.partInnings', 'strikeouts', 'ERA'], athletes: [{}] },
      ] }] } });
      expect(result).toEqual([
        { label: 'Batting Leaders', players: [
          { playerName: 'Unknown', shortName: '', headshot: undefined, position: undefined, statLine: '' },
        ] },
        { label: 'Starting Pitchers', players: [
          { playerName: 'Unknown', shortName: '', headshot: undefined, position: 'SP', statLine: '' },
        ] },
      ]);
    });
  });

  // ── Motorsport ───────────────────────────────────────────────────────────

  describe('findCurrentRace', () => {
    it('returns null for a missing or empty scoreboard (findLastRace too)', () => {
      expect(service.findLastRace(undefined)).toBeNull();
      expect(service.findCurrentRace(undefined)).toBeNull();
      expect(service.findCurrentRace({ events: [] })).toBeNull();
    });

    it('prefers a live race over upcoming and completed ones', () => {
      const race = service.findCurrentRace(board(
        makeEspnRaceEvent({ id: 'done', state: 'post' }),
        makeEspnRaceEvent({ id: 'next', state: 'pre' }),
        makeEspnRaceEvent({ id: 'live', state: 'in' }),
      ));
      expect(race?.id).toBe('live');
    });

    it('returns the nearest upcoming race when none is live', () => {
      const race = service.findCurrentRace(board(
        makeEspnRaceEvent({ id: 'done', state: 'post', weekendStartDate: '2026-06-01T11:30Z' }),
        makeEspnRaceEvent({ id: 'later', state: 'pre', weekendStartDate: '2026-08-01T11:30Z' }),
        makeEspnRaceEvent({ id: 'sooner', state: 'pre', weekendStartDate: '2026-07-01T11:30Z' }),
      ));
      expect(race?.id).toBe('sooner');
    });

    it('returns the most recent completed race when nothing is live or upcoming', () => {
      const race = service.findCurrentRace(board(
        makeEspnRaceEvent({ id: 'older', state: 'post', weekendStartDate: '2026-05-01T11:30Z' }),
        makeEspnRaceEvent({ id: 'newer', state: 'post', weekendStartDate: '2026-06-01T11:30Z' }),
      ));
      expect(race?.id).toBe('newer');
      expect(race?.winner?.driverName).toBe('Lewis Hamilton');
    });

    it('returns null when no event is live, upcoming or completed', () => {
      const postponed = asEvent({ ...makeEspnRaceEvent(), status: { type: { state: 'postponed' } } });
      expect(service.findCurrentRace(board(postponed))).toBeNull();
    });
  });

  describe('parseRace with partial competitors', () => {
    const postRace = (competitions: unknown[]) => asEvent({
      ...makeEspnRaceEvent({ state: 'post' }), competitions,
    });

    it('uses team names when a finisher has no athlete, and Unknown when it has neither', () => {
      const race = service.parseRace(postRace([{
        date: '2026-05-24T16:45Z',
        competitors: [
          { athlete: { displayName: 'No Order', shortName: 'N. Order' } },
          { order: 2, team: { displayName: 'Team Penske', shortDisplayName: 'Penske' } },
          { order: 1, team: { displayName: 'Andretti Global', shortDisplayName: 'Andretti' } },
          { order: 3 },
          { team: { displayName: 'Unordered Team', shortDisplayName: 'Unordered' } },
        ],
      }]));
      expect(race.date).toEqual(new Date('2026-05-24T16:45Z'));
      expect(race.winner).toEqual({ driverName: 'Andretti Global', teamName: 'Andretti Global' });
      expect(race.topFinishers).toEqual([
        { position: 1, driverName: 'Andretti Global', shortName: 'Andretti', flag: undefined, winner: true },
        { position: 2, driverName: 'Team Penske', shortName: 'Penske', flag: undefined, winner: false },
        { position: 3, driverName: 'Unknown', shortName: '', flag: undefined, winner: false },
        { position: 0, driverName: 'No Order', shortName: 'N. Order', flag: undefined, winner: false },
        { position: 0, driverName: 'Unordered Team', shortName: 'Unordered', flag: undefined, winner: false },
      ]);
    });

    it("labels a winner with no athlete or team as 'Winner'", () => {
      const race = service.parseRace(postRace([{ competitors: [{ order: 1 }] }]));
      expect(race.winner).toEqual({ driverName: 'Winner', teamName: '' });
    });

    it('has no winner, finishers or venue when the event has no competitions', () => {
      const race = service.parseRace(postRace([]));
      expect(race.date).toEqual(new Date('2026-06-26T11:30Z'));
      expect(race.winner).toBeUndefined();
      expect(race.topFinishers).toBeUndefined();
      expect(race.venue).toBeUndefined();
      expect(race.broadcast).toBeUndefined();
    });
  });

  // ── Golf ─────────────────────────────────────────────────────────────────

  describe('parseTournament', () => {
    it('builds a top-10 leaderboard sorted by order with noon-anchored dates', () => {
      const competitors = Array.from({ length: 12 }, (_, i) => ({
        order: 12 - i, score: `-${12 - i}`,
        athlete: { displayName: `Golfer ${12 - i}`, shortName: `G. ${12 - i}` },
      }));
      const t = service.parseTournament(golfEvent({
        state: 'in', endDate: '2026-06-21T04:00Z', competitors, venue: 'Shinnecock Hills',
      }));
      expect(t.startDate).toEqual(new Date('2026-06-18T12:00:00'));
      expect(t.endDate).toEqual(new Date('2026-06-21T12:00:00'));
      expect(t.status).toEqual({ state: 'in', detail: 'Thu, June 18th' });
      expect(t.venue).toBe('Shinnecock Hills');
      expect(t.leaderboard).toHaveLength(10);
      expect(t.leaderboard![0]).toEqual({ position: 1, name: 'Golfer 1', shortName: 'G. 1', score: '-1' });
      expect(t.leaderboard!.map(e => e.position)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });

    it('falls back for competitors missing order, athlete and score', () => {
      const t = service.parseTournament(golfEvent({ competitors: [
        {},
        { order: 1, score: '-4', athlete: { displayName: 'Scottie Scheffler', shortName: 'S. Scheffler' } },
        { athlete: { displayName: 'No Position', shortName: 'N. Position' } },
      ] }));
      expect(t.leaderboard).toEqual([
        { position: 1, name: 'Scottie Scheffler', shortName: 'S. Scheffler', score: '-4' },
        { position: 0, name: 'Unknown', shortName: '', score: 'E' },
        { position: 0, name: 'No Position', shortName: 'N. Position', score: 'E' },
      ]);
    });

    it('has no end date, leaderboard or venue when ESPN omits them', () => {
      const t = service.parseTournament(asEvent({
        id: 'g', name: 'Memorial', shortName: 'Memorial', date: '2026-06-04T04:00Z',
        status: { type: { state: 'pre', description: 'Scheduled' } },
      }));
      expect(t.startDate).toEqual(new Date('2026-06-04T12:00:00'));
      expect(t.endDate).toBeUndefined();
      expect(t.leaderboard).toBeUndefined();
      expect(t.venue).toBeUndefined();
      expect(t.status.detail).toBe('Scheduled');
    });

    it('uses an empty status detail when ESPN sends neither shortDetail nor description', () => {
      const t = service.parseTournament(asEvent({
        ...golfEvent(), status: { type: { state: 'pre' } },
      }));
      expect(t.status.detail).toBe('');
    });
  });

  describe('tournament finders', () => {
    const scoreboard = board(
      golfEvent({ id: 'past-old', state: 'post', date: '2026-05-14T04:00Z' }),
      golfEvent({ id: 'past-new', state: 'post', date: '2026-06-11T04:00Z' }),
      golfEvent({ id: 'later', state: 'pre', date: '2026-07-16T04:00Z' }),
      golfEvent({ id: 'next', state: 'pre', date: '2026-06-25T04:00Z' }),
    );

    it('return null / [] for a missing or empty scoreboard', () => {
      expect(service.findCurrentTournament(undefined)).toBeNull();
      expect(service.findCurrentTournament({ events: [] })).toBeNull();
      expect(service.findLastTournament(undefined)).toBeNull();
      expect(service.findLastTournament({ events: [] })).toBeNull();
      expect(service.getAllUpcomingTournaments(undefined)).toEqual([]);
      expect(service.getAllUpcomingTournaments({ events: [] })).toEqual([]);
    });

    it('findCurrentTournament prefers a live tournament, then the nearest upcoming one', () => {
      expect(service.findCurrentTournament(scoreboard)?.id).toBe('next');
      const withLive = board(...scoreboard.events, golfEvent({ id: 'live', state: 'in', date: '2026-06-18T04:00Z' }));
      expect(service.findCurrentTournament(withLive)?.id).toBe('live');
    });

    it('findCurrentTournament returns null when every tournament is finished', () => {
      expect(service.findCurrentTournament(board(golfEvent({ state: 'post' })))).toBeNull();
    });

    it('findLastTournament returns the most recent completed tournament, or null if none', () => {
      expect(service.findLastTournament(scoreboard)?.id).toBe('past-new');
      expect(service.findLastTournament(board(golfEvent({ state: 'pre' })))).toBeNull();
    });

    it('getAllUpcomingTournaments returns only upcoming tournaments, soonest first', () => {
      expect(service.getAllUpcomingTournaments(scoreboard).map(t => t.id)).toEqual(['next', 'later']);
    });
  });

  // ── Standings / teams ────────────────────────────────────────────────────

  describe('getStandings with partial entries', () => {
    it('keeps a row with no stats, logo or abbreviation, and an unnamed group gets an empty name', async () => {
      const promise = service.getStandings('basketball/nba');
      http.expectOne(`${STANDINGS}/basketball/nba/standings`).flush({
        children: [{ standings: { entries: [
          { team: { id: '18', displayName: 'New York Knicks' } },
          { team: { id: '4', shortDisplayName: 'Bulls', logos: [{ href: 42 }] },
            stats: [{ type: 'playoffseed', value: 1 }, { type: 'wins', value: Number.NaN, displayValue: '5' }, {}] },
        ] } }],
      });
      const [group] = await promise;
      expect(group.name).toBe('');
      expect(group.rows).toEqual([
        { teamId: '4', abbreviation: '', name: 'Bulls', logo: '',
          stats: { playoffseed: { value: 1, display: '' }, wins: { value: null, display: '5' } } },
        { teamId: '18', abbreviation: '', name: 'New York Knicks', logo: '', stats: {} },
      ]);
    });
  });

  describe('getTeams with partial entries', () => {
    it("uses the team's name when shortDisplayName is missing", async () => {
      const promise = service.getTeams('soccer/usa.1');
      http.expectOne(`${STANDINGS}/soccer/usa.1/standings`).flush({ standings: { entries: [
        { team: { id: '9668', abbreviation: 'NYC', displayName: 'New York City FC', name: 'NYCFC' } },
      ] } });
      const [option] = await promise;
      expect(option.config.shortName).toBe('NYCFC');
    });
  });

  describe('sortStandingsRows', () => {
    it('moves a leading row that lacks the sort stat after rows that have it', () => {
      const row = (teamId: string, seed?: number): StandingsRow => ({
        teamId, abbreviation: teamId, name: teamId, logo: '',
        stats: seed === undefined ? {} : { playoffseed: { value: seed, display: String(seed) } },
      });
      const keys: [string, 'asc'][] = [['playoffseed', 'asc']];
      expect(sortStandingsRows([row('none'), row('second', 2), row('first', 1)], keys).map(r => r.teamId))
        .toEqual(['first', 'second', 'none']);
      expect(sortStandingsRows([row('second', 2), row('none'), row('first', 1)], keys).map(r => r.teamId))
        .toEqual(['first', 'second', 'none']);
      expect(sortStandingsRows([row('first', 1), row('none')], keys).map(r => r.teamId)).toEqual(['first', 'none']);
      expect(sortStandingsRows([row('none'), row('first', 1)], keys).map(r => r.teamId)).toEqual(['first', 'none']);
    });
  });

  // ── News ─────────────────────────────────────────────────────────────────

  describe('getNews with partial articles', () => {
    it('falls back for an article with no description, images or links', async () => {
      const promise = service.getNews('basketball/nba', 'NBA', '#C9082A');
      const req = http.expectOne(r => r.url === `${BASE}/basketball/nba/news`);
      expect(req.request.params.get('limit')).toBe('10');
      req.flush({ articles: [{ id: 123, headline: 'Knicks win', published: '2026-06-16T12:00:00Z' }] });
      expect(await promise).toEqual([{
        id: '123', headline: 'Knicks win', description: '', image: undefined, url: '',
        published: new Date('2026-06-16T12:00:00Z'), sourceName: 'NBA', sourceColor: '#C9082A',
      }]);
    });

    it('maps a full article', async () => {
      const promise = service.getNews('basketball/nba', 'NBA', '#C9082A');
      http.expectOne(r => r.url === `${BASE}/basketball/nba/news`).flush({ articles: [{
        id: 7, headline: 'Trade', description: 'Big trade', images: [{ url: 'https://x/a.jpg' }],
        links: { web: { href: 'https://espn.com/a' } }, published: '2026-06-16T12:00:00Z',
      }] });
      const [article] = await promise;
      expect(article.description).toBe('Big trade');
      expect(article.image).toBe('https://x/a.jpg');
      expect(article.url).toBe('https://espn.com/a');
    });

    it('reads a team feed (feed instead of articles) from the team news URL', async () => {
      const promise = service.getNews('basketball/nba', 'Knicks', '#006BB6', '18', 3);
      const req = http.expectOne(r => r.url === `${BASE}/basketball/nba/teams/18/news`);
      expect(req.request.params.get('limit')).toBe('3');
      req.flush({ feed: [{ id: 9, headline: 'Team story', published: '2026-06-16T12:00:00Z' }] });
      expect((await promise).map(a => a.headline)).toEqual(['Team story']);
    });

    it('returns [] when the body has neither articles nor feed', async () => {
      const promise = service.getNews('racing/nascar-premier', 'NASCAR', '#FFD659');
      http.expectOne(r => r.url === `${BASE}/racing/nascar-premier/news`).flush({});
      expect(await promise).toEqual([]);
    });
  });
});
