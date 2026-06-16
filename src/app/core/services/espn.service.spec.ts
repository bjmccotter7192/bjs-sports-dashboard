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
import { EspnService, formatDateYMD } from './espn.service';
import { EspnEvent, EspnScoreboardResponse } from '../models/game.model';
import { makeEspnTeamEvent, makeEspnRaceEvent } from '../../testing/test-fixtures';

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

  // ── getTeamSchedule ──────────────────────────────────────────────────────

  describe('getTeamSchedule', () => {
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
  });

  // ── findTeamGame ─────────────────────────────────────────────────────────

  describe('findTeamGame', () => {
    it('returns null for undefined scoreboard', () => {
      expect(service.findTeamGame(undefined, 'NYY')).toBeNull();
    });

    it('returns null for empty events', () => {
      expect(service.findTeamGame({ events: [] }, 'NYY')).toBeNull();
    });

    it('returns the game when the team is in the home slot', () => {
      const scoreboard = { events: [makeEspnTeamEvent({ homeAbbr: 'NYY', awayAbbr: 'CHW' })] };
      expect(service.findTeamGame(scoreboard, 'NYY')).not.toBeNull();
    });

    it('returns the game when the team is in the away slot', () => {
      const scoreboard = { events: [makeEspnTeamEvent({ homeAbbr: 'CHW', awayAbbr: 'NYY' })] };
      expect(service.findTeamGame(scoreboard, 'NYY')).not.toBeNull();
    });

    it('returns null when team is not in any game', () => {
      const scoreboard = { events: [makeEspnTeamEvent({ homeAbbr: 'CHW', awayAbbr: 'BOS' })] };
      expect(service.findTeamGame(scoreboard, 'NYY')).toBeNull();
    });
  });

  // ── findLastPlayedGame ───────────────────────────────────────────────────

  describe('findLastPlayedGame', () => {
    it('returns null when no completed games exist', () => {
      const scoreboard = { events: [makeEspnTeamEvent({ homeAbbr: 'NYY', state: 'pre' })] };
      expect(service.findLastPlayedGame(scoreboard, 'NYY')).toBeNull();
    });

    it('returns the most recent completed game (not an earlier one)', () => {
      // Two completed NYY games — the later one should win.
      const older = makeEspnTeamEvent({ id: 'g1', homeAbbr: 'NYY', state: 'post', date: '2026-06-10T23:00Z' });
      const newer = makeEspnTeamEvent({ id: 'g2', homeAbbr: 'NYY', state: 'post', date: '2026-06-15T23:00Z' });
      const scoreboard = { events: [older, newer] };
      const game = service.findLastPlayedGame(scoreboard, 'NYY');
      expect(game?.id).toBe('g2');
    });

    it('ignores games for other teams', () => {
      const scoreboard = { events: [makeEspnTeamEvent({ homeAbbr: 'CHW', state: 'post' })] };
      expect(service.findLastPlayedGame(scoreboard, 'NYY')).toBeNull();
    });
  });

  // ── getAllTeamGames ───────────────────────────────────────────────────────

  describe('getAllTeamGames', () => {
    it('returns all games matching any of the supplied abbreviations', () => {
      const events = [
        makeEspnTeamEvent({ id: 'g1', homeAbbr: 'NYY', state: 'pre' }),
        makeEspnTeamEvent({ id: 'g2', homeAbbr: 'WSH', state: 'pre' }),
        makeEspnTeamEvent({ id: 'g3', homeAbbr: 'BOS', state: 'pre' }),
      ];
      const result = service.getAllTeamGames({ events }, ['NYY', 'WSH']);
      expect(result).toHaveLength(2);
      expect(result.map(g => g.id)).toEqual(expect.arrayContaining(['g1', 'g2']));
    });

    it('returns empty array for undefined scoreboard', () => {
      expect(service.getAllTeamGames(undefined, ['NYY'])).toEqual([]);
    });
  });

  // ── parseGame ────────────────────────────────────────────────────────────

  describe('parseGame', () => {
    it('correctly separates home and away teams', () => {
      const game = service.parseGame(makeEspnTeamEvent({ homeAbbr: 'NYY', awayAbbr: 'CHW' }));
      expect(game.homeTeam.abbreviation).toBe('NYY');
      expect(game.awayTeam.abbreviation).toBe('CHW');
    });

    it('maps the score and winner flag', () => {
      const event = makeEspnTeamEvent({ homeAbbr: 'NYY', awayAbbr: 'CHW', homeScore: '5', awayScore: '2', homeWinner: true, state: 'post' });
      const game = service.parseGame(event);
      expect(game.homeTeam.score).toBe('5');
      expect(game.homeTeam.isWinner).toBe(true);
      expect(game.awayTeam.isWinner).toBe(false);
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
