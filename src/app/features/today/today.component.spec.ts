/**
 * TodayComponent spec
 *
 * Key patterns used throughout:
 *
 * 1. provideZonelessChangeDetection() — required for Angular v21 zoneless mode.
 *    Without it TestBed throws because the component uses signals/resource().
 *
 * 2. createMockEspnService() — returns vi.fn() stubs for every EspnService method
 *    so HTTP never fires and resource() loaders resolve immediately.
 *
 * 3. "double detectChanges" pattern — after fixture.detectChanges() the resource()
 *    promises are in-flight.  await fixture.whenStable() lets the microtask queue
 *    drain so the loaders resolve, then a second detectChanges() flushes the signal
 *    graph into the DOM.
 */
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

import { TodayComponent } from './today.component';
import { EspnService } from '../../core/services/espn.service';
import { createMockEspnService } from '../../testing/mock-espn.service';
import { makeGame } from '../../testing/test-fixtures';
import { MY_TEAMS, MY_SERIES } from '../../core/config/teams.config';

describe('TodayComponent', () => {
  let fixture: ComponentFixture<TodayComponent>;
  let component: TodayComponent;
  let mockEspn: ReturnType<typeof createMockEspnService>;

  // Helper that fully settles all resource() loaders and re-renders
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
        // provideRouter([]) is required because child panel components may use
        // routerLink or inject the Router indirectly through shared utilities.
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

  it('renders one app-team-panel per tracked team after resources settle', async () => {
    fixture.detectChanges();
    await settle();

    const panels = fixture.nativeElement.querySelectorAll('app-team-panel');
    // MY_TEAMS has 5 entries — one panel per team
    expect(panels.length).toBe(MY_TEAMS.length);
  });

  it('renders one app-motorsport-panel per tracked series after resources settle', async () => {
    fixture.detectChanges();
    await settle();

    const panels = fixture.nativeElement.querySelectorAll('app-motorsport-panel');
    // MY_SERIES has 3 entries — one panel per series
    expect(panels.length).toBe(MY_SERIES.length);
  });

  it('renders the combined panel grid (.teams-grid) with all panels', async () => {
    fixture.detectChanges();
    await settle();

    const grid = fixture.nativeElement.querySelector('.teams-grid');
    expect(grid).not.toBeNull();

    const allPanels = grid.querySelectorAll('app-team-panel, app-motorsport-panel');
    expect(allPanels.length).toBe(MY_TEAMS.length + MY_SERIES.length);
  });

  // ── teamData computed — default (no game) state ────────────────────────────

  it('teamData() has one entry per team after resources settle', async () => {
    fixture.detectChanges();
    await settle();

    const data = component.teamData();
    expect(data.length).toBe(MY_TEAMS.length);
  });

  it('teamData() entries have null game when mock returns no data', async () => {
    // Default mock: findTeamGame returns null
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

  // ── teamData computed — with a game ────────────────────────────────────────

  it('teamData() carries the game object when findTeamGame returns one', async () => {
    // Override findTeamGame to return a Yankees game for every call.
    // In the real app this would only match the NYY team; here we just verify
    // that the computed properly threads the mock return value through.
    const game = makeGame({ id: 'test-game-nyy' });
    mockEspn.findTeamGame.mockReturnValue(game);

    fixture.detectChanges();
    await settle();

    const data = component.teamData();
    // Every entry should now carry the mocked game
    for (const entry of data) {
      expect(entry.game).toBe(game);
    }
  });

  // ── seriesData computed ─────────────────────────────────────────────────────

  it('seriesData() has one entry per series after resources settle', async () => {
    fixture.detectChanges();
    await settle();

    const data = component.seriesData();
    expect(data.length).toBe(MY_SERIES.length);
  });

  it('seriesData() entries have null race when mock returns no data', async () => {
    // Default mock: findNextRace returns null
    fixture.detectChanges();
    await settle();

    for (const entry of component.seriesData()) {
      expect(entry.race).toBeNull();
    }
  });

  // ── Date label ─────────────────────────────────────────────────────────────

  it('renders a non-empty date label in the view header', () => {
    fixture.detectChanges();
    const dateSpan: HTMLElement = fixture.nativeElement.querySelector('.view-date');
    // The label is today's date formatted as a long string; just confirm it's present
    expect(dateSpan?.textContent?.trim().length).toBeGreaterThan(0);
  });
});
