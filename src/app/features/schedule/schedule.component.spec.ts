/**
 * ScheduleComponent spec
 *
 * The Schedule component is more complex than Today/Yesterday:
 *
 *  - It has 8 separate resource() instances (5 team + 3 motorsport).
 *  - isLoading() is true until ALL 8 resources settle.
 *  - scheduleDays() is a computed that calls getGamesInDateRange() and
 *    getAllUpcomingRaces() on the resolved resource values, then groups
 *    items by date key (YYYYMMDD).
 *
 * Testing strategy:
 *  - For the "loading skeleton" assertion we check isLoading() on the
 *    component signal *before* awaiting whenStable(), i.e. right after the
 *    first detectChanges() while the loaders are still in-flight.
 *  - For content assertions we use the standard "double detectChanges" settle.
 *  - To test grouping logic we override getGamesInDateRange /
 *    getAllUpcomingRaces with fixtures that have known dates, then assert
 *    scheduleDays() structure directly (no DOM scraping needed).
 */
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

import { ScheduleComponent } from './schedule.component';
import { EspnService } from '../../core/services/espn.service';
import { createMockEspnService } from '../../testing/mock-espn.service';
import { makeGame, makeRace } from '../../testing/test-fixtures';
import { MY_TEAMS, MY_SERIES } from '../../core/config/teams.config';

describe('ScheduleComponent', () => {
  let fixture: ComponentFixture<ScheduleComponent>;
  let component: ScheduleComponent;
  let mockEspn: ReturnType<typeof createMockEspnService>;

  // Drain microtasks and re-render so all resource() loaders resolve
  async function settle() {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    mockEspn = createMockEspnService();

    await TestBed.configureTestingModule({
      imports: [ScheduleComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: EspnService, useValue: mockEspn },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ScheduleComponent);
    component = fixture.componentInstance;
  });

  // ── Basic creation ──────────────────────────────────────────────────────────

  it('creates the component', () => {
    expect(component).toBeTruthy();
  });

  it('renders the "Upcoming Schedule" view title', () => {
    fixture.detectChanges();
    const h1: HTMLElement = fixture.nativeElement.querySelector('h1.view-title');
    expect(h1?.textContent).toContain('Upcoming Schedule');
  });

  // ── isLoading() — loading state before resources settle ────────────────────

  it('isLoading() returns true immediately after first detectChanges', () => {
    // The 8 resource() loaders are async — they are still pending after the
    // first synchronous change detection cycle, so isLoading must be true.
    fixture.detectChanges();
    expect(component.isLoading()).toBe(true);
  });

  it('shows the loading skeleton DOM while resources are pending', () => {
    fixture.detectChanges();
    const skeleton = fixture.nativeElement.querySelector('.loading-state');
    expect(skeleton).not.toBeNull();
  });

  it('hides the loading skeleton after all resources settle', async () => {
    fixture.detectChanges();
    await settle();

    const skeleton = fixture.nativeElement.querySelector('.loading-state');
    expect(skeleton).toBeNull();
  });

  it('isLoading() returns false after all resources settle', async () => {
    fixture.detectChanges();
    await settle();

    expect(component.isLoading()).toBe(false);
  });

  // ── Empty state ─────────────────────────────────────────────────────────────

  it('shows the empty-state message when no games or races are returned', async () => {
    // Default mock: getGamesInDateRange returns [] and getAllUpcomingRaces returns []
    fixture.detectChanges();
    await settle();

    const emptyState = fixture.nativeElement.querySelector('.empty-state');
    expect(emptyState).not.toBeNull();
    expect(emptyState.textContent).toContain('No upcoming events');
  });

  it('scheduleDays() returns an empty array when mocks return no data', async () => {
    fixture.detectChanges();
    await settle();

    expect(component.scheduleDays()).toEqual([]);
  });

  // ── scheduleDays() with team games ─────────────────────────────────────────

  it('scheduleDays() groups games by date key', async () => {
    // Return two games on the same day and one on a different day so we can
    // verify the grouping produces two ScheduleDay buckets.
    const day1 = new Date('2026-06-20T18:05:00Z');
    const day2 = new Date('2026-06-21T18:05:00Z');

    const game1 = makeGame({ id: 'g1', date: day1 });
    const game2 = makeGame({ id: 'g2', date: day1 }); // same day as game1
    const game3 = makeGame({ id: 'g3', date: day2 });

    // getGamesInDateRange is called once per team resource (5 calls total).
    // Return games only on the first call to keep the assertion simple.
    mockEspn.getGamesInDateRange
      .mockReturnValueOnce([game1, game2])
      .mockReturnValueOnce([game3])
      .mockReturnValue([]);

    fixture.detectChanges();
    await settle();

    const days = component.scheduleDays();

    // Expect exactly two day buckets
    expect(days.length).toBe(2);

    // The earlier date should be first (sorted ascending)
    expect(days[0].dateKey).toBe('20260620');
    expect(days[0].items.length).toBe(2);
    expect(days[0].items[0].kind).toBe('game');

    expect(days[1].dateKey).toBe('20260621');
    expect(days[1].items.length).toBe(1);
  });

  it('scheduleDays() items include the correct team config', async () => {
    const game = makeGame({ id: 'knicks-game', date: new Date('2026-06-20T18:05:00Z') });
    mockEspn.getGamesInDateRange.mockReturnValueOnce([game]).mockReturnValue([]);

    fixture.detectChanges();
    await settle();

    const days = component.scheduleDays();
    expect(days.length).toBe(1);

    const item = days[0].items[0];
    expect(item.kind).toBe('game');
    if (item.kind === 'game') {
      // The first call to getGamesInDateRange corresponds to MY_TEAMS[0] (Knicks)
      expect(item.team).toBe(MY_TEAMS[0]);
      expect(item.game).toBe(game);
    }
  });

  // ── scheduleDays() with motorsport races ───────────────────────────────────

  it('scheduleDays() includes races returned by getAllUpcomingRaces', async () => {
    const race = makeRace({
      id: 'f1-austria',
      date: new Date('2026-06-28T13:00:00Z'),
    });

    // getAllUpcomingRaces is called once per motorsport series (3 calls total).
    // Return a race on the first call (F1), nothing for the rest.
    mockEspn.getAllUpcomingRaces
      .mockReturnValueOnce([race])
      .mockReturnValue([]);

    fixture.detectChanges();
    await settle();

    const days = component.scheduleDays();
    expect(days.length).toBe(1);

    const item = days[0].items[0];
    expect(item.kind).toBe('race');
    if (item.kind === 'race') {
      expect(item.race).toBe(race);
      // First motorsport series is F1
      expect(item.series).toBe(MY_SERIES[0]);
    }
  });

  it('scheduleDays() merges games and races on the same day into one bucket', async () => {
    const sharedDate = new Date('2026-06-28T13:00:00Z');

    const game = makeGame({ id: 'yankees-game', date: sharedDate });
    const race = makeRace({ id: 'f1-race', date: sharedDate });

    mockEspn.getGamesInDateRange.mockReturnValueOnce([game]).mockReturnValue([]);
    mockEspn.getAllUpcomingRaces.mockReturnValueOnce([race]).mockReturnValue([]);

    fixture.detectChanges();
    await settle();

    const days = component.scheduleDays();
    expect(days.length).toBe(1);
    expect(days[0].items.length).toBe(2);

    const kinds = days[0].items.map(i => i.kind);
    expect(kinds).toContain('game');
    expect(kinds).toContain('race');
  });

  // ── scheduleDays() date label formatting ───────────────────────────────────

  it('scheduleDays() produces a human-readable dateLabel for each day', async () => {
    const game = makeGame({ date: new Date('2026-06-20T18:05:00Z') });
    mockEspn.getGamesInDateRange.mockReturnValueOnce([game]).mockReturnValue([]);

    fixture.detectChanges();
    await settle();

    const days = component.scheduleDays();
    expect(days.length).toBe(1);
    // The label is formatted as "Weekday, Month Day" — just assert it's non-empty
    // and contains a digit (the day number)
    expect(days[0].dateLabel.length).toBeGreaterThan(0);
    expect(/\d/.test(days[0].dateLabel)).toBe(true);
  });

  // ── DOM content verification ────────────────────────────────────────────────

  it('renders schedule-day rows in the DOM when data is present', async () => {
    const game = makeGame({ date: new Date('2026-06-20T18:05:00Z') });
    mockEspn.getGamesInDateRange.mockReturnValueOnce([game]).mockReturnValue([]);

    fixture.detectChanges();
    await settle();

    const dayRows = fixture.nativeElement.querySelectorAll('.schedule-day');
    expect(dayRows.length).toBeGreaterThan(0);
  });

  it('renders event count badge on each day header', async () => {
    const day = new Date('2026-06-20T18:05:00Z');
    const game1 = makeGame({ id: 'g1', date: day });
    const game2 = makeGame({ id: 'g2', date: day });
    mockEspn.getGamesInDateRange.mockReturnValueOnce([game1, game2]).mockReturnValue([]);

    fixture.detectChanges();
    await settle();

    const countBadge: HTMLElement = fixture.nativeElement.querySelector('.game-count');
    expect(countBadge?.textContent).toContain('2 events');
  });

  it('uses singular "event" label when day has exactly one item', async () => {
    const game = makeGame({ date: new Date('2026-06-20T18:05:00Z') });
    mockEspn.getGamesInDateRange.mockReturnValueOnce([game]).mockReturnValue([]);

    fixture.detectChanges();
    await settle();

    const countBadge: HTMLElement = fixture.nativeElement.querySelector('.game-count');
    expect(countBadge?.textContent).toContain('1 event');
    expect(countBadge?.textContent).not.toContain('1 events');
  });

  // ── Service call verification ───────────────────────────────────────────────

  it('calls getTeamSchedule once per team', async () => {
    fixture.detectChanges();
    await settle();

    // 5 teams → 5 calls to getTeamSchedule
    expect(mockEspn.getTeamSchedule).toHaveBeenCalledTimes(MY_TEAMS.length);
  });

  it('calls getScoreboard once per motorsport series', async () => {
    fixture.detectChanges();
    await settle();

    // The schedule component only calls getScoreboard for the 3 motorsport
    // series (not for team sports — those use getTeamSchedule).
    expect(mockEspn.getScoreboard).toHaveBeenCalledTimes(MY_SERIES.length);
  });
});
