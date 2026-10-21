import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

import { YesterdayComponent } from './yesterday.component';
import { EspnService } from '../../core/services/espn.service';
import { createMockEspnService } from '../../testing/mock-espn.service';
import { makeGame, makeRace } from '../../testing/test-fixtures';
import { DEFAULT_CONFIG } from '../../core/config/teams.config';
import { provideDashboardConfig, makeConfig, makeTeamConfig } from '../../testing/dashboard-config';

describe('YesterdayComponent', () => {
  let fixture: ComponentFixture<YesterdayComponent>;
  let component: YesterdayComponent;
  let mockEspn: ReturnType<typeof createMockEspnService>;

  async function settle() {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    mockEspn = createMockEspnService();

    await TestBed.configureTestingModule({
      imports: [YesterdayComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: EspnService, useValue: mockEspn },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(YesterdayComponent);
    component = fixture.componentInstance;
  });

  // ── Basic creation ──────────────────────────────────────────────────────────

  it('creates the component', () => {
    expect(component).toBeTruthy();
  });

  it('renders the "Last Played" view title', () => {
    fixture.detectChanges();
    const h1: HTMLElement = fixture.nativeElement.querySelector('h1.view-title');
    expect(h1?.textContent).toContain('Last Played');
  });

  it('renders the subtitle mentioning the 14-day window', () => {
    fixture.detectChanges();
    const subtitle: HTMLElement = fixture.nativeElement.querySelector('.view-date');
    expect(subtitle?.textContent).toContain('14 days');
  });

  // ── Panel grid rendering ────────────────────────────────────────────────────

  it('renders one app-team-panel per team after resources settle', async () => {
    fixture.detectChanges();
    await settle();

    const panels = fixture.nativeElement.querySelectorAll('app-team-panel');
    expect(panels.length).toBe(DEFAULT_CONFIG.teams.length);
  });

  it('renders one app-golf-panel for PGA Tour after resources settle', async () => {
    fixture.detectChanges();
    await settle();

    const panels = fixture.nativeElement.querySelectorAll('app-golf-panel');
    expect(panels.length).toBe(DEFAULT_CONFIG.golf.length);
  });

  it('renders one app-motorsport-panel per series after resources settle', async () => {
    fixture.detectChanges();
    await settle();

    const panels = fixture.nativeElement.querySelectorAll('app-motorsport-panel');
    expect(panels.length).toBe(DEFAULT_CONFIG.series.length);
  });

  it('renders the .teams-grid container', async () => {
    fixture.detectChanges();
    await settle();

    expect(fixture.nativeElement.querySelector('.teams-grid')).not.toBeNull();
  });

  // ── teamData computed ───────────────────────────────────────────────────────

  it('teamData() returns one entry per team', async () => {
    fixture.detectChanges();
    await settle();

    expect(component.teamData().length).toBe(DEFAULT_CONFIG.teams.length);
  });

  it('teamData() entries have null game when findLastPlayedGame returns null', async () => {
    fixture.detectChanges();
    await settle();

    for (const entry of component.teamData()) {
      expect(entry.game).toBeNull();
    }
  });

  it('teamData() isLoading is false after resources settle', async () => {
    fixture.detectChanges();
    await settle();

    for (const entry of component.teamData()) {
      expect(entry.isLoading).toBe(false);
    }
  });

  it('uses findLastPlayedGame (not findTeamGame) to resolve game data', async () => {
    fixture.detectChanges();
    await settle();

    expect(mockEspn.findLastPlayedGame).toHaveBeenCalled();
    expect(mockEspn.findTeamGame).not.toHaveBeenCalled();
  });

  it('fetches each team via getTeamSchedule, not a date-range league scoreboard', async () => {
    fixture.detectChanges();
    await settle();

    for (const team of DEFAULT_CONFIG.teams) {
      expect(mockEspn.getTeamSchedule).toHaveBeenCalledWith(team.sport, team.espnId);
    }
    const scoreboardSports = mockEspn.getScoreboard.mock.calls.map(([sport]) => sport);
    for (const team of DEFAULT_CONFIG.teams) {
      expect(scoreboardSports).not.toContain(team.sport);
    }
  });

  it('passes the 14-day window start to findLastPlayedGame', async () => {
    fixture.detectChanges();
    await settle();

    const cutoff = mockEspn.findLastPlayedGame.mock.calls[0][2] as Date;
    const daysAgo = (Date.now() - cutoff.getTime()) / 86_400_000;
    expect(daysAgo).toBeCloseTo(14, 0);
  });

  it('teamData() carries a game when findLastPlayedGame returns one', async () => {
    const game = makeGame({
      id: 'last-game-1',
      status: { state: 'post', description: 'Final', detail: 'Final' },
    });
    mockEspn.findLastPlayedGame.mockReturnValue(game);

    fixture.detectChanges();
    await settle();

    for (const entry of component.teamData()) {
      expect(entry.game).toBe(game);
    }
  });

  // ── seriesData computed ─────────────────────────────────────────────────────

  it('seriesData() returns one entry per series', async () => {
    fixture.detectChanges();
    await settle();

    expect(component.seriesData().length).toBe(DEFAULT_CONFIG.series.length);
  });

  it('seriesData() entries have null race when findLastRace returns null', async () => {
    fixture.detectChanges();
    await settle();

    for (const entry of component.seriesData()) {
      expect(entry.race).toBeNull();
    }
  });

  it('uses findLastRace (not findNextRace) to resolve race data', async () => {
    fixture.detectChanges();
    await settle();

    expect(mockEspn.findLastRace).toHaveBeenCalled();
    expect(mockEspn.findNextRace).not.toHaveBeenCalled();
  });

  it('seriesData() carries a race when findLastRace returns one', async () => {
    const race = makeRace({
      id: 'last-race-1',
      status: { state: 'post', description: 'Final', detail: 'Final' },
    });
    mockEspn.findLastRace.mockReturnValue(race);

    fixture.detectChanges();
    await settle();

    for (const entry of component.seriesData()) {
      expect(entry.race).toBe(race);
    }
  });

  // ── golfData computed ────────────────────────────────────────────────────────

  it('golfData() tournament is null when mock returns no data', async () => {
    fixture.detectChanges();
    await settle();

    expect(component.golfData()[0].tournament).toBeNull();
  });

  it('golfData() isLoading is false after resources settle', async () => {
    fixture.detectChanges();
    await settle();

    expect(component.golfData()[0].isLoading).toBe(false);
  });

  // ── Custom config ───────────────────────────────────────────────────────────

  describe('with a custom config', () => {
    async function createWith(config: ReturnType<typeof makeConfig>) {
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [YesterdayComponent],
        providers: [
          provideZonelessChangeDetection(),
          provideRouter([]),
          { provide: EspnService, useValue: mockEspn },
          provideDashboardConfig(config),
        ],
      }).compileComponents();
      fixture = TestBed.createComponent(YesterdayComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
      await settle();
    }

    it('fetches one team schedule per configured team, even within one league', async () => {
      const yankees = makeTeamConfig();
      const nats = makeTeamConfig({ espnId: '20', abbreviation: 'WSH' });
      await createWith(makeConfig({ teams: [yankees, nats] }));
      expect(mockEspn.getTeamSchedule).toHaveBeenCalledTimes(2);
      expect(mockEspn.getTeamSchedule).toHaveBeenCalledWith('baseball/mlb', '10');
      expect(mockEspn.getTeamSchedule).toHaveBeenCalledWith('baseball/mlb', '20');
    });

    it('looks up the last game by ESPN team id', async () => {
      await createWith(makeConfig({ teams: [makeTeamConfig({ espnId: '19', sport: 'football/nfl' })] }));
      expect(mockEspn.findLastPlayedGame.mock.calls[0][1]).toBe('19');
    });

    it('renders no panels and fetches nothing for an empty config', async () => {
      await createWith(makeConfig());
      expect(fixture.nativeElement.querySelectorAll('app-team-panel, app-motorsport-panel, app-golf-panel').length).toBe(0);
      expect(mockEspn.getTeamSchedule).not.toHaveBeenCalled();
      expect(mockEspn.getScoreboard).not.toHaveBeenCalled();
    });
  });
});
