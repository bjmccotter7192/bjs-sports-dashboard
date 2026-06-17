/**
 * YesterdayComponent spec
 *
 * Mirrors the TodayComponent tests but exercises the "Last Played" variant:
 *  - Uses findLastPlayedGame (not findTeamGame) to populate teamData()
 *  - Uses findLastRace (not findNextRace) to populate seriesData()
 *  - Fetches a 14-day rolling window instead of a single date
 *
 * The same "double detectChanges" settle pattern is used — see today.component.spec.ts
 * for a full explanation.
 */
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

import { YesterdayComponent } from './yesterday.component';
import { EspnService } from '../../core/services/espn.service';
import { CricketService } from '../../core/services/cricket.service';
import { createMockEspnService } from '../../testing/mock-espn.service';
import { createMockCricketService } from '../../testing/mock-cricket.service';
import { makeGame, makeRace } from '../../testing/test-fixtures';
import { MY_TEAMS, MY_SERIES, MY_CRICKET_TEAMS } from '../../core/config/teams.config';

describe('YesterdayComponent', () => {
  let fixture: ComponentFixture<YesterdayComponent>;
  let component: YesterdayComponent;
  let mockEspn: ReturnType<typeof createMockEspnService>;
  let mockCricket: ReturnType<typeof createMockCricketService>;

  // Drain microtasks and re-render so resource() loaders resolve
  async function settle() {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    mockEspn = createMockEspnService();
    mockCricket = createMockCricketService();

    await TestBed.configureTestingModule({
      imports: [YesterdayComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: EspnService, useValue: mockEspn },
        { provide: CricketService, useValue: mockCricket },
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

  it('renders one app-team-panel per tracked team after resources settle', async () => {
    fixture.detectChanges();
    await settle();

    const panels = fixture.nativeElement.querySelectorAll('app-team-panel');
    // MY_TEAMS (5) + MY_CRICKET_TEAMS (1) — cricket uses app-team-panel too
    expect(panels.length).toBe(MY_TEAMS.length + MY_CRICKET_TEAMS.length);
  });

  it('renders one app-motorsport-panel per tracked series after resources settle', async () => {
    fixture.detectChanges();
    await settle();

    const panels = fixture.nativeElement.querySelectorAll('app-motorsport-panel');
    expect(panels.length).toBe(MY_SERIES.length);
  });

  it('renders the .teams-grid container', async () => {
    fixture.detectChanges();
    await settle();

    const grid = fixture.nativeElement.querySelector('.teams-grid');
    expect(grid).not.toBeNull();
  });

  // ── teamData computed — default (no game) state ────────────────────────────

  it('teamData() returns one entry per team', async () => {
    fixture.detectChanges();
    await settle();

    expect(component.teamData().length).toBe(MY_TEAMS.length);
  });

  it('teamData() entries have null game when findLastPlayedGame returns null', async () => {
    // Default mock behaviour — findLastPlayedGame returns null
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
    // This ensures the Yesterday view's "most recent completed" semantics are wired
    // correctly, not accidentally sharing logic with Today.
    fixture.detectChanges();
    await settle();

    expect(mockEspn.findLastPlayedGame).toHaveBeenCalled();
    expect(mockEspn.findTeamGame).not.toHaveBeenCalled();
  });

  // ── teamData computed — with a game ────────────────────────────────────────

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

  // ── seriesData computed — default (no race) state ─────────────────────────

  it('seriesData() returns one entry per series', async () => {
    fixture.detectChanges();
    await settle();

    expect(component.seriesData().length).toBe(MY_SERIES.length);
  });

  it('seriesData() entries have null race when findLastRace returns null', async () => {
    // Default mock behaviour
    fixture.detectChanges();
    await settle();

    for (const entry of component.seriesData()) {
      expect(entry.race).toBeNull();
    }
  });

  it('uses findLastRace (not findNextRace) to resolve race data', async () => {
    // Yesterday shows the most recently completed race, not the upcoming one.
    fixture.detectChanges();
    await settle();

    expect(mockEspn.findLastRace).toHaveBeenCalled();
    expect(mockEspn.findNextRace).not.toHaveBeenCalled();
  });

  // ── seriesData computed — with a race ─────────────────────────────────────

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
});
