/**
 * ScheduleComponent spec
 *
 * - 3 resource() instances (teams, series, golf), each fetching per configured entry.
 * - isLoading() is true until all three settle.
 * - scheduleDays() groups games, races, and tournaments by date key (YYYYMMDD).
 */
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

import { ScheduleComponent } from './schedule.component';
import { EspnService } from '../../core/services/espn.service';
import { createMockEspnService } from '../../testing/mock-espn.service';
import { TimeZoneService } from '../../core/services/time-zone.service';
import { makeGame, makeRace } from '../../testing/test-fixtures';
import { SAMPLE_CONFIG } from '../../testing/sample-config';
import { provideDashboardConfig, makeConfig, makeTeamConfig } from '../../testing/dashboard-config';

describe('ScheduleComponent', () => {
  let fixture: ComponentFixture<ScheduleComponent>;
  let component: ScheduleComponent;
  let mockEspn: ReturnType<typeof createMockEspnService>;

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
        provideDashboardConfig(),
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

  // ── isLoading() ─────────────────────────────────────────────────────────────

  it('isLoading() returns true immediately after first detectChanges', () => {
    fixture.detectChanges();
    expect(component.isLoading()).toBe(true);
  });

  it('shows the loading skeleton DOM while resources are pending', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.loading-state')).not.toBeNull();
  });

  it('hides the loading skeleton after all resources settle', async () => {
    fixture.detectChanges();
    await settle();
    expect(fixture.nativeElement.querySelector('.loading-state')).toBeNull();
  });

  it('isLoading() returns false after all resources settle', async () => {
    fixture.detectChanges();
    await settle();
    expect(component.isLoading()).toBe(false);
  });

  // ── Empty state ─────────────────────────────────────────────────────────────

  it('shows the empty-state message when no events are returned', async () => {
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
    const day1 = new Date('2026-06-20T18:05:00Z');
    const day2 = new Date('2026-06-21T18:05:00Z');

    mockEspn.getGamesInDateRange
      .mockReturnValueOnce([makeGame({ id: 'g1', date: day1 }), makeGame({ id: 'g2', date: day1 })])
      .mockReturnValueOnce([makeGame({ id: 'g3', date: day2 })])
      .mockReturnValue([]);

    fixture.detectChanges();
    await settle();

    const days = component.scheduleDays();
    expect(days.length).toBe(2);
    expect(days[0].dateKey).toBe('20260620');
    expect(days[0].items.length).toBe(2);
    expect(days[1].dateKey).toBe('20260621');
  });

  it('scheduleDays() items include the correct team config', async () => {
    const game = makeGame({ id: 'knicks-game', date: new Date('2026-06-20T18:05:00Z') });
    mockEspn.getGamesInDateRange.mockReturnValueOnce([game]).mockReturnValue([]);

    fixture.detectChanges();
    await settle();

    const days = component.scheduleDays();
    const item = days[0].items[0];
    expect(item.kind).toBe('game');
    if (item.kind === 'game') {
      expect(item.team).toBe(SAMPLE_CONFIG.teams[0]);
      expect(item.game).toBe(game);
    }
  });

  // ── scheduleDays() with motorsport races ───────────────────────────────────

  it('scheduleDays() includes races returned by getAllUpcomingRaces', async () => {
    const race = makeRace({ id: 'f1-austria', date: new Date('2026-06-28T13:00:00Z') });
    mockEspn.getAllUpcomingRaces.mockReturnValueOnce([race]).mockReturnValue([]);

    fixture.detectChanges();
    await settle();

    const days = component.scheduleDays();
    expect(days.length).toBe(1);

    const item = days[0].items[0];
    expect(item.kind).toBe('race');
    if (item.kind === 'race') {
      expect(item.race).toBe(race);
      expect(item.series).toBe(SAMPLE_CONFIG.series[0]);
    }
  });

  it('scheduleDays() merges games and races on the same day', async () => {
    const sharedDate = new Date('2026-06-28T13:00:00Z');
    mockEspn.getGamesInDateRange.mockReturnValueOnce([makeGame({ id: 'g1', date: sharedDate })]).mockReturnValue([]);
    mockEspn.getAllUpcomingRaces.mockReturnValueOnce([makeRace({ id: 'r1', date: sharedDate })]).mockReturnValue([]);

    fixture.detectChanges();
    await settle();

    const days = component.scheduleDays();
    expect(days.length).toBe(1);
    expect(days[0].items.length).toBe(2);
    expect(days[0].items.map(i => i.kind)).toContain('game');
    expect(days[0].items.map(i => i.kind)).toContain('race');
  });

  // ── scheduleDays() date label formatting ───────────────────────────────────

  it('scheduleDays() produces a human-readable dateLabel', async () => {
    mockEspn.getGamesInDateRange.mockReturnValueOnce([makeGame({ date: new Date('2026-06-20T18:05:00Z') })]).mockReturnValue([]);

    fixture.detectChanges();
    await settle();

    const days = component.scheduleDays();
    expect(days[0].dateLabel.length).toBeGreaterThan(0);
    expect(/\d/.test(days[0].dateLabel)).toBe(true);
  });

  // ── DOM content verification ────────────────────────────────────────────────

  it('renders schedule-day rows in the DOM when data is present', async () => {
    mockEspn.getGamesInDateRange.mockReturnValueOnce([makeGame({ date: new Date('2026-06-20T18:05:00Z') })]).mockReturnValue([]);

    fixture.detectChanges();
    await settle();

    expect(fixture.nativeElement.querySelectorAll('.schedule-day').length).toBeGreaterThan(0);
  });

  it('renders event count badge on each day header', async () => {
    const day = new Date('2026-06-20T18:05:00Z');
    mockEspn.getGamesInDateRange
      .mockReturnValueOnce([makeGame({ id: 'g1', date: day }), makeGame({ id: 'g2', date: day })])
      .mockReturnValue([]);

    fixture.detectChanges();
    await settle();

    const badge: HTMLElement = fixture.nativeElement.querySelector('.game-count');
    expect(badge?.textContent).toContain('2 events');
  });

  it('uses singular "event" when day has one item', async () => {
    mockEspn.getGamesInDateRange.mockReturnValueOnce([makeGame({ date: new Date('2026-06-20T18:05:00Z') })]).mockReturnValue([]);

    fixture.detectChanges();
    await settle();

    const badge: HTMLElement = fixture.nativeElement.querySelector('.game-count');
    expect(badge?.textContent).toContain('1 event');
    expect(badge?.textContent).not.toContain('1 events');
  });

  // ── Service call verification ───────────────────────────────────────────────

  it('calls getTeamSchedule once per team', async () => {
    fixture.detectChanges();
    await settle();
    expect(mockEspn.getTeamSchedule).toHaveBeenCalledTimes(SAMPLE_CONFIG.teams.length);
  });

  it('calls getScoreboard for each motorsport series plus PGA Tour', async () => {
    fixture.detectChanges();
    await settle();
    expect(mockEspn.getScoreboard).toHaveBeenCalledTimes(SAMPLE_CONFIG.series.length + SAMPLE_CONFIG.golf.length);
  });

  // ── Custom config ───────────────────────────────────────────────────────────

  describe('with a custom config', () => {
    async function createWith(config: ReturnType<typeof makeConfig>) {
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [ScheduleComponent],
        providers: [
          provideZonelessChangeDetection(),
          provideRouter([]),
          { provide: EspnService, useValue: mockEspn },
          provideDashboardConfig(config),
        ],
      }).compileComponents();
      fixture = TestBed.createComponent(ScheduleComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
      await settle();
    }

    it('groups and times games in the display zone', async () => {
      // 04:30 UTC June 23 = 9:30 PM PT June 22 = 12:30 AM ET June 23
      const late = makeGame({ date: new Date('2026-06-23T04:30:00Z') });
      mockEspn.getGamesInDateRange.mockReturnValue([late]);
      localStorage.setItem('sports-dashboard:timezone', 'America/Los_Angeles');
      await createWith(makeConfig({ teams: [makeTeamConfig()] }));
      expect(component.scheduleDays()[0].dateKey).toBe('20260622');
      expect(fixture.nativeElement.querySelector('.game-time')?.textContent?.trim()).toBe('9:30 PM PT');

      TestBed.inject(TimeZoneService).setOverride('America/New_York');
      fixture.detectChanges();
      expect(component.scheduleDays()[0].dateKey).toBe('20260623');
      expect(fixture.nativeElement.querySelector('.game-time')?.textContent?.trim()).toBe('12:30 AM ET');
      localStorage.clear();
    });

    it('labels games with the league name, not the raw ESPN slug', async () => {
      mockEspn.getGamesInDateRange.mockReturnValue([makeGame({ date: new Date('2026-06-20T18:05:00Z') })]);
      await createWith(makeConfig({ teams: [makeTeamConfig({ sport: 'soccer/usa.1' })] }));
      expect(fixture.nativeElement.querySelector('.sport-tag')?.textContent?.trim()).toBe('MLS');
    });

    it('fetches schedules only for configured teams', async () => {
      await createWith(makeConfig({ teams: [makeTeamConfig({ espnId: '13', sport: 'hockey/nhl' })] }));
      expect(mockEspn.getTeamSchedule).toHaveBeenCalledTimes(1);
      expect(mockEspn.getTeamSchedule).toHaveBeenCalledWith('hockey/nhl', '13');
      expect(mockEspn.getScoreboard).not.toHaveBeenCalled();
    });

    it('prompts to pick teams instead of the schedule for an empty config', async () => {
      await createWith(makeConfig());
      expect(fixture.nativeElement.querySelector('app-empty-config')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('.empty-state')).toBeNull();
    });

    it('shows the no-events state (not the setup prompt) when configured teams have no games', async () => {
      await createWith(makeConfig({ teams: [makeTeamConfig()] }));
      expect(fixture.nativeElement.querySelector('.empty-state')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('app-empty-config')).toBeNull();
    });
  });
});
