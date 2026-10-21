import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ActivatedRoute, ParamMap, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import { LIVE_REFRESH_MS, LeagueComponent } from './league.component';
import { EspnService } from '../../core/services/espn.service';
import { ESPN_DAY_ZONE, dateKeyInZone, shiftDateKey } from '../../core/config/time-zones';
import { createMockEspnService } from '../../testing/mock-espn.service';
import { makeGame } from '../../testing/test-fixtures';
import { makeConfig, makeTeamConfig, provideDashboardConfig } from '../../testing/dashboard-config';
import { Game } from '../../core/models/game.model';

describe('LeagueComponent', () => {
  let fixture: ComponentFixture<LeagueComponent>;
  let component: LeagueComponent;
  let mockEspn: ReturnType<typeof createMockEspnService>;
  let params: BehaviorSubject<ParamMap>;
  let query: BehaviorSubject<ParamMap>;
  let navigate: ReturnType<typeof vi.fn>;
  const el = () => fixture.nativeElement as HTMLElement;
  const today = dateKeyInZone(new Date(), ESPN_DAY_ZONE);

  const hoursFromNow = (h: number) => new Date(Date.now() + h * 3_600_000);
  const pre = (id: string, start: Date, overrides: Partial<Game> = {}) =>
    makeGame({ id, date: start, status: { state: 'pre', description: 'Scheduled', detail: '' }, ...overrides });
  const live = (id: string) =>
    makeGame({ id, status: { state: 'in', description: 'In Progress', detail: 'Q2', period: 2, clock: '5:00' } });

  /** Scoreboard returns these games; parseGame maps each stub event back to its Game. */
  function serve(games: Game[]) {
    mockEspn.getScoreboard.mockResolvedValue({ events: games.map(g => ({ id: g.id })) });
    mockEspn.parseGame.mockImplementation((e: { id: string }) => games.find(g => g.id === e.id));
  }

  async function settle() {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function create(league: string, date?: string, config = makeConfig()) {
    params = new BehaviorSubject(convertToParamMap({ league }));
    query = new BehaviorSubject(convertToParamMap(date ? { date } : {}));
    await TestBed.configureTestingModule({
      imports: [LeagueComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: EspnService, useValue: mockEspn },
        { provide: ActivatedRoute, useValue: { paramMap: params, queryParamMap: query } },
        provideDashboardConfig(config),
      ],
    }).compileComponents();
    // Reflect navigations back into the query params, like the real router would
    navigate = vi.fn((_cmds: unknown, extras: { queryParams: Record<string, string> }) => {
      query.next(convertToParamMap(extras.queryParams));
      return Promise.resolve(true);
    });
    vi.spyOn(TestBed.inject(Router), 'navigate').mockImplementation(navigate as never);
    fixture = TestBed.createComponent(LeagueComponent);
    component = fixture.componentInstance;
    await settle();
  }

  beforeEach(() => {
    mockEspn = createMockEspnService();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ── Routing ─────────────────────────────────────────────────────────────────

  it('shows "League not found" for unknown or racing codes, without fetching', async () => {
    await create('f1');
    expect(el().querySelector('.view-title')?.textContent).toContain('League not found');
    expect(mockEspn.getScoreboard).not.toHaveBeenCalled();
  });

  it('fetches the requested league and date', async () => {
    serve([live('g1')]);
    await create('epl', '20261020');
    expect(mockEspn.getScoreboard).toHaveBeenCalledWith('soccer/eng.1', '20261020');
    expect(el().querySelector('.view-title')?.textContent).toContain('EPL');
    expect(el().querySelector('.day-label')?.textContent).toContain('Tuesday, October 20');
  });

  it('ignores a malformed date param', async () => {
    serve([live('g1')]);
    await create('nba', 'bogus');
    expect(mockEspn.getScoreboard).toHaveBeenCalledWith('basketball/nba', today);
  });

  // ── Smart default day ───────────────────────────────────────────────────────

  it('stays on today when a game has started', async () => {
    serve([live('g1'), pre('g2', hoursFromNow(6))]);
    await create('nba');
    expect(navigate).not.toHaveBeenCalled();
    expect(component.dateKey()).toBe(today);
  });

  it('stays on today when the first game starts within 2 hours', async () => {
    serve([pre('g1', hoursFromNow(1))]);
    await create('nba');
    expect(navigate).not.toHaveBeenCalled();
  });

  it("switches to yesterday (replacing the URL) when today's games are hours away", async () => {
    serve([pre('g1', hoursFromNow(5))]);
    await create('nba');
    expect(navigate).toHaveBeenCalledWith([], expect.objectContaining({
      queryParams: { date: shiftDateKey(today, -1) }, replaceUrl: true,
    }));
    expect(mockEspn.getScoreboard).toHaveBeenLastCalledWith('basketball/nba', shiftDateKey(today, -1));
  });

  it('switches to yesterday when there are no games today', async () => {
    serve([]);
    await create('nba');
    expect(component.dateKey()).toBe(shiftDateKey(today, -1));
  });

  it('never overrides an explicit date', async () => {
    serve([]);
    await create('nba', today);
    expect(navigate).not.toHaveBeenCalled();
    expect(el().querySelector('.empty-state')?.textContent).toContain('No NBA games');
  });

  // ── Day navigation ──────────────────────────────────────────────────────────

  it('pages days with ‹ › and returns with Today', async () => {
    serve([live('g1')]);
    await create('nba', '20261020');
    el().querySelector<HTMLButtonElement>('[aria-label="Previous day"]')!.click();
    expect(component.dateKey()).toBe('20261019');
    el().querySelector<HTMLButtonElement>('[aria-label="Next day"]')!.click();
    el().querySelector<HTMLButtonElement>('[aria-label="Next day"]')!.click();
    expect(component.dateKey()).toBe('20261021');
    component.today();
    expect(component.dateKey()).toBe(today);
  });

  // ── Cards ───────────────────────────────────────────────────────────────────

  it("lists the user's teams first, then by start time", async () => {
    const early = pre('early', hoursFromNow(1));
    const late = pre('late', hoursFromNow(1.5));
    const mine = pre('mine', hoursFromNow(1.8), { homeTeam: { ...makeGame().homeTeam, id: '18' } });
    serve([late, mine, early]);
    await create('nba', today, makeConfig({ teams: [makeTeamConfig({ espnId: '18', sport: 'basketball/nba' })] }));
    expect(component.games().map(g => g.game.id)).toEqual(['mine', 'early', 'late']);
    expect(component.games()[0].starred).toBe(true);
    expect(el().querySelectorAll('app-game-card').length).toBe(3);
  });

  it("doesn't star a same-id team from another league", async () => {
    serve([pre('g', hoursFromNow(1), { homeTeam: { ...makeGame().homeTeam, id: '18' } })]);
    await create('nba', today, makeConfig({ teams: [makeTeamConfig({ espnId: '18', sport: 'hockey/nhl' })] }));
    expect(component.games()[0].starred).toBe(false);
  });

  it('opens the box score for a clicked game', async () => {
    serve([makeGame({ id: 'final' })]);
    await create('nba', '20261020');
    el().querySelector<HTMLButtonElement>('.game-card')!.click();
    fixture.detectChanges();
    expect(el().querySelector('app-game-stats-modal')).not.toBeNull();
  });

  it('shows an error when ESPN fails', async () => {
    mockEspn.getScoreboard.mockRejectedValue(new Error('500'));
    await create('nba', '20261020');
    expect(el().textContent).toContain("Couldn't load NBA scores");
  });

  // ── Live refresh ────────────────────────────────────────────────────────────

  it('polls every 30s while a game is live', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    serve([live('g1')]);
    await create('nba', '20261020');
    expect(el().querySelector('.live-pill')).not.toBeNull();
    const calls = mockEspn.getScoreboard.mock.calls.length;
    vi.advanceTimersByTime(LIVE_REFRESH_MS);
    await settle();
    expect(mockEspn.getScoreboard.mock.calls.length).toBe(calls + 1);
  });

  it('stops polling when nothing is live', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    serve([makeGame({ id: 'final' })]);
    await create('nba', '20261020');
    const calls = mockEspn.getScoreboard.mock.calls.length;
    vi.advanceTimersByTime(LIVE_REFRESH_MS * 3);
    await settle();
    expect(mockEspn.getScoreboard.mock.calls.length).toBe(calls);
    expect(el().querySelector('.live-pill')).toBeNull();
  });

  it('pauses while the tab is hidden and catches up when it returns', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    serve([live('g1')]);
    await create('nba', '20261020');
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    await settle();
    const calls = mockEspn.getScoreboard.mock.calls.length;
    vi.advanceTimersByTime(LIVE_REFRESH_MS * 2);
    await settle();
    expect(mockEspn.getScoreboard.mock.calls.length).toBe(calls);

    hidden.mockReturnValue(false);
    document.dispatchEvent(new Event('visibilitychange'));
    await settle();
    expect(mockEspn.getScoreboard.mock.calls.length).toBe(calls + 1);
  });
});
