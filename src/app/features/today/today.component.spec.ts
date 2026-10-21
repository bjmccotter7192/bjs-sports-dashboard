import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

import { TodayComponent } from './today.component';
import { EspnService } from '../../core/services/espn.service';
import { createMockEspnService } from '../../testing/mock-espn.service';
import { makeGame } from '../../testing/test-fixtures';
import { SAMPLE_CONFIG } from '../../testing/sample-config';
import { provideDashboardConfig, makeConfig, makeTeamConfig } from '../../testing/dashboard-config';

describe('TodayComponent', () => {
  let fixture: ComponentFixture<TodayComponent>;
  let component: TodayComponent;
  let mockEspn: ReturnType<typeof createMockEspnService>;

  async function settle() {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    mockEspn = createMockEspnService();

    await TestBed.configureTestingModule({
      imports: [TodayComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: EspnService, useValue: mockEspn },
        provideDashboardConfig(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TodayComponent);
    component = fixture.componentInstance;
  });

  // ── Basic creation ──────────────────────────────────────────────────────────

  it('creates the component', () => {
    expect(component).toBeTruthy();
  });

  it('renders the view title', () => {
    fixture.detectChanges();
    const h1: HTMLElement = fixture.nativeElement.querySelector('h1.view-title');
    expect(h1?.textContent).toContain("Today's Games");
  });

  // ── Panel grid rendering ────────────────────────────────────────────────────

  it('renders one app-team-panel per team after resources settle', async () => {
    fixture.detectChanges();
    await settle();

    const panels = fixture.nativeElement.querySelectorAll('app-team-panel');
    expect(panels.length).toBe(SAMPLE_CONFIG.teams.length);
  });

  it('renders one app-golf-panel for PGA Tour after resources settle', async () => {
    fixture.detectChanges();
    await settle();

    const panels = fixture.nativeElement.querySelectorAll('app-golf-panel');
    expect(panels.length).toBe(SAMPLE_CONFIG.golf.length);
  });

  it('renders one app-motorsport-panel per motorsport series after resources settle', async () => {
    fixture.detectChanges();
    await settle();

    const panels = fixture.nativeElement.querySelectorAll('app-motorsport-panel');
    expect(panels.length).toBe(SAMPLE_CONFIG.series.length);
  });

  it('renders all panels in the grid', async () => {
    fixture.detectChanges();
    await settle();

    const grid = fixture.nativeElement.querySelector('.teams-grid');
    expect(grid).not.toBeNull();

    const allPanels = grid.querySelectorAll('app-team-panel, app-motorsport-panel, app-golf-panel');
    expect(allPanels.length).toBe(SAMPLE_CONFIG.teams.length + SAMPLE_CONFIG.series.length + SAMPLE_CONFIG.golf.length);
  });

  // ── teamData computed ───────────────────────────────────────────────────────

  it('teamData() has one entry per team after resources settle', async () => {
    fixture.detectChanges();
    await settle();

    expect(component.teamData().length).toBe(SAMPLE_CONFIG.teams.length);
  });

  it('teamData() entries have null game when mock returns no data', async () => {
    fixture.detectChanges();
    await settle();

    for (const entry of component.teamData()) {
      expect(entry.game).toBeNull();
    }
  });

  it('teamData() isLoading is false once resources settle', async () => {
    fixture.detectChanges();
    await settle();

    for (const entry of component.teamData()) {
      expect(entry.isLoading).toBe(false);
    }
  });

  it('teamData() carries the game when findTeamGame returns one', async () => {
    const game = makeGame({ id: 'test-game-nyy' });
    mockEspn.findTeamGame.mockReturnValue(game);

    fixture.detectChanges();
    await settle();

    for (const entry of component.teamData()) {
      expect(entry.game).toBe(game);
    }
  });

  // ── seriesData computed ─────────────────────────────────────────────────────

  it('seriesData() has one entry per series after resources settle', async () => {
    fixture.detectChanges();
    await settle();

    expect(component.seriesData().length).toBe(SAMPLE_CONFIG.series.length);
  });

  it('seriesData() entries have null race when mock returns no data', async () => {
    fixture.detectChanges();
    await settle();

    for (const entry of component.seriesData()) {
      expect(entry.race).toBeNull();
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

  // ── Date label ─────────────────────────────────────────────────────────────

  it('renders a non-empty date label in the view header', () => {
    fixture.detectChanges();
    const dateSpan: HTMLElement = fixture.nativeElement.querySelector('.view-date');
    expect(dateSpan?.textContent?.trim().length).toBeGreaterThan(0);
  });

  it('does not show the setup prompt when teams are configured', async () => {
    fixture.detectChanges();
    await settle();
    expect(fixture.nativeElement.querySelector('app-empty-config')).toBeNull();
  });

  // ── Custom config ───────────────────────────────────────────────────────────

  describe('with a custom config', () => {
    async function createWith(config: ReturnType<typeof makeConfig>) {
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [TodayComponent],
        providers: [
          provideZonelessChangeDetection(),
          provideRouter([]),
          { provide: EspnService, useValue: mockEspn },
          provideDashboardConfig(config),
        ],
      }).compileComponents();
      fixture = TestBed.createComponent(TodayComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
      await settle();
    }

    it('renders only the configured panels', async () => {
      await createWith(makeConfig({ teams: [makeTeamConfig()] }));
      expect(fixture.nativeElement.querySelectorAll('app-team-panel').length).toBe(1);
      expect(fixture.nativeElement.querySelectorAll('app-motorsport-panel').length).toBe(0);
      expect(fixture.nativeElement.querySelectorAll('app-golf-panel').length).toBe(0);
    });

    it('renders the setup prompt, no panels, and fetches nothing for an empty config', async () => {
      await createWith(makeConfig());
      expect(fixture.nativeElement.querySelectorAll('app-team-panel, app-motorsport-panel, app-golf-panel').length).toBe(0);
      expect(fixture.nativeElement.querySelector('app-empty-config')).not.toBeNull();
      expect(mockEspn.getScoreboard).not.toHaveBeenCalled();
    });

    it('fetches one scoreboard per league, shared by teams in the same league', async () => {
      const yankees = makeTeamConfig();
      const nats = makeTeamConfig({ espnId: '20', abbreviation: 'WSH', shortName: 'Nationals' });
      await createWith(makeConfig({ teams: [yankees, nats] }));
      expect(mockEspn.getScoreboard).toHaveBeenCalledTimes(1);
      expect(mockEspn.getScoreboard).toHaveBeenCalledWith('baseball/mlb', component.date);
    });

    it('looks up games by ESPN team id', async () => {
      await createWith(makeConfig({ teams: [makeTeamConfig({ espnId: '18', abbreviation: 'NY', sport: 'basketball/nba' })] }));
      expect(mockEspn.findTeamGame).toHaveBeenLastCalledWith({ events: [] }, '18');
    });

    it('floats teams with a game above teams without one, keeping config order', async () => {
      const a = makeTeamConfig({ espnId: '1', shortName: 'A' });
      const b = makeTeamConfig({ espnId: '2', shortName: 'B' });
      const c = makeTeamConfig({ espnId: '3', shortName: 'C' });
      mockEspn.findTeamGame.mockImplementation((_board: unknown, id: string) => id === '2' ? makeGame() : null);
      await createWith(makeConfig({ teams: [a, b, c] }));
      expect(component.activeTeamPanels().map(e => e.team.shortName)).toEqual(['B']);
      expect(component.inactiveTeamPanels().map(e => e.team.shortName)).toEqual(['A', 'C']);
    });
  });
});
