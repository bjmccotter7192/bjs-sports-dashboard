import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

import { TodayComponent } from './today.component';
import { EspnService } from '../../core/services/espn.service';
import { createMockEspnService } from '../../testing/mock-espn.service';
import { makeGame } from '../../testing/test-fixtures';
import { MY_TEAMS, MY_SERIES, MY_GOLF } from '../../core/config/teams.config';

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
    expect(panels.length).toBe(MY_TEAMS.length);
  });

  it('renders one app-golf-panel for PGA Tour after resources settle', async () => {
    fixture.detectChanges();
    await settle();

    const panels = fixture.nativeElement.querySelectorAll('app-golf-panel');
    expect(panels.length).toBe(MY_GOLF.length);
  });

  it('renders one app-motorsport-panel per motorsport series after resources settle', async () => {
    fixture.detectChanges();
    await settle();

    const panels = fixture.nativeElement.querySelectorAll('app-motorsport-panel');
    expect(panels.length).toBe(MY_SERIES.length);
  });

  it('renders all panels in the grid', async () => {
    fixture.detectChanges();
    await settle();

    const grid = fixture.nativeElement.querySelector('.teams-grid');
    expect(grid).not.toBeNull();

    const allPanels = grid.querySelectorAll('app-team-panel, app-motorsport-panel, app-golf-panel');
    expect(allPanels.length).toBe(MY_TEAMS.length + MY_SERIES.length + MY_GOLF.length);
  });

  // ── teamData computed ───────────────────────────────────────────────────────

  it('teamData() has one entry per team after resources settle', async () => {
    fixture.detectChanges();
    await settle();

    expect(component.teamData().length).toBe(MY_TEAMS.length);
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

    expect(component.seriesData().length).toBe(MY_SERIES.length);
  });

  it('seriesData() entries have null race when mock returns no data', async () => {
    fixture.detectChanges();
    await settle();

    for (const entry of component.seriesData()) {
      expect(entry.race).toBeNull();
    }
  });

  // ── pgaData computed ────────────────────────────────────────────────────────

  it('pgaData() tournament is null when mock returns no data', async () => {
    fixture.detectChanges();
    await settle();

    expect(component.pgaData().tournament).toBeNull();
  });

  it('pgaData() isLoading is false after resources settle', async () => {
    fixture.detectChanges();
    await settle();

    expect(component.pgaData().isLoading).toBe(false);
  });

  // ── Date label ─────────────────────────────────────────────────────────────

  it('renders a non-empty date label in the view header', () => {
    fixture.detectChanges();
    const dateSpan: HTMLElement = fixture.nativeElement.querySelector('.view-date');
    expect(dateSpan?.textContent?.trim().length).toBeGreaterThan(0);
  });
});
