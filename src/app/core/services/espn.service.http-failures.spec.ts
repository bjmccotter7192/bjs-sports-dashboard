/**
 * EspnService HTTP failure points.
 *
 * The service itself never swallows HTTP errors: every fetch method rejects with the
 * HttpErrorResponse, and callers (`fetchAll()` per key, Settings' "Couldn't load teams")
 * decide on the fallback. A 200 with an empty body (`{}` or `null`) is not an error:
 * each method resolves to its empty value.
 */
import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { EspnService } from './espn.service';

const BASE = 'https://site.api.espn.com/apis/site/v2/sports';
const STANDINGS = 'https://site.api.espn.com/apis/v2/sports';

/** The three ways an ESPN request can fail, and the status the rejection carries. */
const FAILURES: Array<[label: string, fail: (req: TestRequest) => void, status: number]> = [
  ['HTTP 404', req => req.flush('Not Found', { status: 404, statusText: 'Not Found' }), 404],
  ['HTTP 500', req => req.flush('Server Error', { status: 500, statusText: 'Internal Server Error' }), 500],
  ['a network error', req => req.error(new ProgressEvent('error')), 0],
];

/** Settles a promise into its rejection reason; fails the test if it resolves. */
async function rejection(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    value => { throw new Error(`expected rejection, resolved with ${JSON.stringify(value)}`); },
    error => error,
  );
}

describe('EspnService HTTP failures', () => {
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

  /** Each fetch method, how to call it, and which URL it requests. */
  const METHODS: Array<[name: string, call: (s: EspnService) => Promise<unknown>, url: string]> = [
    ['getScoreboard', s => s.getScoreboard('baseball/mlb'), `${BASE}/baseball/mlb/scoreboard`],
    ['getTeamSchedule', s => s.getTeamSchedule('basketball/nba', '18'), `${BASE}/basketball/nba/teams/18/schedule`],
    ['getTeams', s => s.getTeams('basketball/nba'), `${STANDINGS}/basketball/nba/standings`],
    ['getTeamColors', s => s.getTeamColors('basketball/nba', '18'), `${BASE}/basketball/nba/teams/18/schedule`],
    ['getStandings', s => s.getStandings('basketball/nba'), `${STANDINGS}/basketball/nba/standings`],
    ['getTeamRecords', s => s.getTeamRecords('basketball/nba'), `${STANDINGS}/basketball/nba/standings`],
    ['getNews (league)', s => s.getNews('basketball/nba', 'NBA', '#1d428a'), `${BASE}/basketball/nba/news`],
    ['getNews (team)', s => s.getNews('basketball/nba', 'Knicks', '#006bb6', '18'), `${BASE}/basketball/nba/teams/18/news`],
    ['fetchGameLeaders', s => s.fetchGameLeaders('basketball/nba', '401'), `${BASE}/basketball/nba/summary`],
    ['fetchMlbBoxscore', s => s.fetchMlbBoxscore('401'), `${BASE}/baseball/mlb/summary`],
  ];

  for (const [name, call, url] of METHODS) {
    describe(name, () => {
      for (const [label, fail, status] of FAILURES) {
        it(`rejects with an HttpErrorResponse (status ${status}) on ${label}`, async () => {
          const outcome = rejection(call(service));
          fail(http.expectOne(r => r.url === url));
          const error = await outcome;
          expect(error).toBeInstanceOf(HttpErrorResponse);
          expect((error as HttpErrorResponse).status).toBe(status);
          expect((error as HttpErrorResponse).url).toContain(url);
        });
      }
    });
  }

  // ── Empty bodies resolve to each method's empty value ─────────────────

  describe('empty response bodies', () => {
    it('getScoreboard passes an empty {} body through unchanged', async () => {
      const promise = service.getScoreboard('baseball/mlb');
      http.expectOne(`${BASE}/baseball/mlb/scoreboard`).flush({});
      expect(await promise).toEqual({});
    });

    for (const body of [{}, null]) {
      const label = JSON.stringify(body);

      it(`getTeamSchedule resolves to no events for a ${label} body`, async () => {
        const promise = service.getTeamSchedule('basketball/nba', '18');
        http.expectOne(`${BASE}/basketball/nba/teams/18/schedule`).flush(body);
        expect(await promise).toEqual({ events: [] });
      });

      it(`getTeams resolves to [] for a ${label} body`, async () => {
        const promise = service.getTeams('basketball/nba');
        http.expectOne(r => r.url === `${STANDINGS}/basketball/nba/standings`).flush(body);
        expect(await promise).toEqual([]);
      });

      it(`getTeamColors falls back to placeholder colors for a ${label} body`, async () => {
        const promise = service.getTeamColors('basketball/nba', '18');
        http.expectOne(`${BASE}/basketball/nba/teams/18/schedule`).flush(body);
        expect(await promise).toEqual({ primaryColor: '#666666', secondaryColor: '#999999' });
      });

      it(`getStandings resolves to [] for a ${label} body`, async () => {
        const promise = service.getStandings('basketball/nba');
        http.expectOne(r => r.url === `${STANDINGS}/basketball/nba/standings`).flush(body);
        expect(await promise).toEqual([]);
      });

      it(`getTeamRecords resolves to an empty map for a ${label} body`, async () => {
        const promise = service.getTeamRecords('basketball/nba');
        http.expectOne(r => r.url === `${STANDINGS}/basketball/nba/standings`).flush(body);
        const records = await promise;
        expect(records).toBeInstanceOf(Map);
        expect(records.size).toBe(0);
      });

      it(`getNews resolves to [] for a ${label} body`, async () => {
        const promise = service.getNews('basketball/nba', 'NBA', '#1d428a');
        http.expectOne(r => r.url === `${BASE}/basketball/nba/news`).flush(body);
        expect(await promise).toEqual([]);
      });

      it(`fetchGameLeaders resolves to [] for a ${label} body`, async () => {
        const promise = service.fetchGameLeaders('basketball/nba', '401');
        http.expectOne(r => r.url === `${BASE}/basketball/nba/summary`).flush(body);
        expect(await promise).toEqual([]);
      });

      it(`fetchMlbBoxscore resolves to [] for a ${label} body`, async () => {
        const promise = service.fetchMlbBoxscore('401');
        http.expectOne(r => r.url === `${BASE}/baseball/mlb/summary`).flush(body);
        expect(await promise).toEqual([]);
      });
    }
  });

  // ── Soccer split schedule: results + fixtures requests ────────────────

  describe('getTeamSchedule with a split (soccer) schedule', () => {
    const URL = `${BASE}/soccer/usa.1/teams/9726/schedule`;
    const resultsReq = () => http.expectOne(r => r.url === URL && !r.params.has('fixture'));
    const fixturesReq = () => http.expectOne(r => r.url === URL && r.params.get('fixture') === 'true');
    const event = (id: string) => ({
      id,
      date: '2026-11-01T20:00Z',
      name: `Match ${id}`,
      shortName: id,
      competitions: [{ competitors: [] }],
    });

    for (const [label, fail, status] of FAILURES) {
      it(`rejects with status ${status} when only the fixtures request fails with ${label}`, async () => {
        const outcome = rejection(service.getTeamSchedule('soccer/usa.1', '9726'));
        resultsReq().flush({ events: [event('played-1')] });
        fail(fixturesReq());
        const error = await outcome;
        expect(error).toBeInstanceOf(HttpErrorResponse);
        expect((error as HttpErrorResponse).status).toBe(status);
      });
    }

    it('rejects with status 500 when only the results request fails', async () => {
      const outcome = rejection(service.getTeamSchedule('soccer/usa.1', '9726'));
      fixturesReq().flush({ events: [event('upcoming-1')] });
      resultsReq().flush('Server Error', { status: 500, statusText: 'Internal Server Error' });
      const error = await outcome;
      expect(error).toBeInstanceOf(HttpErrorResponse);
      expect((error as HttpErrorResponse).status).toBe(500);
    });

    it('keeps the results when the fixtures request returns an empty body', async () => {
      const promise = service.getTeamSchedule('soccer/usa.1', '9726');
      resultsReq().flush({ events: [event('played-1')] });
      fixturesReq().flush({});
      const { events } = await promise;
      expect(events.map(e => e.id)).toEqual(['played-1']);
    });

    it('keeps the fixtures when the results request returns a null body', async () => {
      const promise = service.getTeamSchedule('soccer/usa.1', '9726');
      resultsReq().flush(null);
      fixturesReq().flush({ events: [event('upcoming-1')] });
      const { events } = await promise;
      expect(events.map(e => e.id)).toEqual(['upcoming-1']);
    });
  });
});
