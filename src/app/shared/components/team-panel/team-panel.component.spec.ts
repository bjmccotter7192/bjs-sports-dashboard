/**
 * TeamPanelComponent unit tests.
 *
 * KEY CONCEPTS:
 *
 * - provideZonelessChangeDetection() replaces Zone.js-based CD. The harness
 *   drives change detection manually via fixture.detectChanges().
 * - Signal inputs (input.required<T>()) cannot be set via the constructor.
 *   Use fixture.componentRef.setInput('name', value) instead.
 * - No services are injected into this component, so every test is purely
 *   synchronous — no async/await or whenStable() needed.
 * - DOM assertions use nativeElement.querySelector / textContent to stay
 *   framework-agnostic and test rendered output, not internal state.
 */
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TeamPanelComponent } from './team-panel.component';
import { TeamConfig } from '../../../core/models/team-config.model';
import { makeGame } from '../../../testing/test-fixtures';

// ── Shared fixture config ────────────────────────────────────────────────────

// Minimal TeamConfig — only the fields TeamPanelComponent reads at runtime.
const knicks: TeamConfig = {
  kind: 'team',
  espnId: '18',
  abbreviation: 'NY',
  name: 'New York Knicks',
  shortName: 'Knicks',
  sport: 'basketball/nba',
  primaryColor: '#006BB6',
  secondaryColor: '#F58426',
};

// Helper to keep TestBed setup DRY across all tests.
function createFixture(): ComponentFixture<TeamPanelComponent> {
  return TestBed.createComponent(TeamPanelComponent);
}

// ── Spec suite ───────────────────────────────────────────────────────────────

// Demonstrates: basic TestBed setup for a zoneless standalone component.
describe('TeamPanelComponent', () => {
  let fixture: ComponentFixture<TeamPanelComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      // Standalone components go in imports, not declarations.
      imports: [TeamPanelComponent],
      providers: [provideZonelessChangeDetection()],
    });
    fixture = createFixture();
  });

  // Demonstrates: signal input.required() — must call setInput before detectChanges.
  it('creates when the required team input is provided', () => {
    fixture.componentRef.setInput('team', knicks);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  // Demonstrates: default value of an optional signal input (game defaults to null).
  it('shows "No game scheduled" placeholder when game input is null', () => {
    fixture.componentRef.setInput('team', knicks);
    // game input is not set — it defaults to null per input<Game | null>(null).
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.no-game-text')?.textContent).toContain('No game scheduled');
  });

  // Demonstrates: conditional rendering driven by a boolean signal input.
  it('renders the skeleton loader when isLoading is true', () => {
    fixture.componentRef.setInput('team', knicks);
    fixture.componentRef.setInput('isLoading', true);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.skeleton')).toBeTruthy();
    expect(el.querySelector('.no-game-text')).toBeNull();
  });

  // Demonstrates: computed signals that depend on two inputs working together.
  it('shows WIN badge in the header when my team is the winner', () => {
    // knicks is home team; homeTeam wins → isWin() should be true.
    const game = makeGame({
      homeTeam: {
        abbreviation: 'NY',           // matches knicks.abbreviation
        displayName: 'New York Knicks',
        logo: 'https://example.com/ny.png',
        score: '110',
        isWinner: true,
        primaryColor: '#006BB6',
      },
      awayTeam: {
        abbreviation: 'BOS',
        displayName: 'Boston Celtics',
        logo: 'https://example.com/bos.png',
        score: '98',
        isWinner: false,
        primaryColor: '#007A33',
      },
      status: { state: 'post', description: 'Final', detail: 'Final' },
    });

    fixture.componentRef.setInput('team', knicks);
    fixture.componentRef.setInput('game', game);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    const winBadge = el.querySelector('.result-badge.win');
    expect(winBadge).toBeTruthy();
    expect(winBadge?.textContent?.trim()).toBe('W');
    expect(el.querySelector('.result-badge.loss')).toBeNull();
  });

  // Demonstrates: isLoss computed path — post-game where my team did not win.
  it('shows LOSS badge when my team lost', () => {
    const game = makeGame({
      homeTeam: {
        abbreviation: 'NY',
        displayName: 'New York Knicks',
        logo: 'https://example.com/ny.png',
        score: '98',
        isWinner: false,
        primaryColor: '#006BB6',
      },
      awayTeam: {
        abbreviation: 'BOS',
        displayName: 'Boston Celtics',
        logo: 'https://example.com/bos.png',
        score: '110',
        isWinner: true,
        primaryColor: '#007A33',
      },
      status: { state: 'post', description: 'Final', detail: 'Final' },
    });

    fixture.componentRef.setInput('team', knicks);
    fixture.componentRef.setInput('game', game);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.result-badge.loss')).toBeTruthy();
    expect(el.querySelector('.result-badge.win')).toBeNull();
  });

  // Demonstrates: the 'in' game state maps to the LIVE badge branch in the template.
  it('shows LIVE badge when game state is "in"', () => {
    const game = makeGame({
      status: { state: 'in', description: 'In Progress', detail: '3Q 4:22' },
    });

    fixture.componentRef.setInput('team', knicks);
    // homeTeam.abbreviation in makeGame defaults to 'NYY', set to match knicks.
    fixture.componentRef.setInput('game', {
      ...game,
      homeTeam: { ...game.homeTeam, abbreviation: 'NY' },
    });
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.result-badge.live')).toBeTruthy();
    expect(el.querySelector('.result-badge.win')).toBeNull();
    expect(el.querySelector('.result-badge.loss')).toBeNull();
  });

  // Demonstrates: showScore computed (true for non-pre states) renders score spans.
  it('shows score values for both teams when state is post', () => {
    const game = makeGame({
      homeTeam: {
        abbreviation: 'NY',
        displayName: 'New York Knicks',
        logo: 'https://example.com/ny.png',
        score: '110',
        isWinner: true,
        primaryColor: '#006BB6',
      },
      awayTeam: {
        abbreviation: 'BOS',
        displayName: 'Boston Celtics',
        logo: 'https://example.com/bos.png',
        score: '98',
        isWinner: false,
        primaryColor: '#007A33',
      },
      status: { state: 'post', description: 'Final', detail: 'Final' },
    });

    fixture.componentRef.setInput('team', knicks);
    fixture.componentRef.setInput('game', game);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.my-score')?.textContent?.trim()).toBe('110');
    expect(el.querySelector('.opp-score')?.textContent?.trim()).toBe('98');
  });

  // Demonstrates: opponent computed returns the other side's team data.
  it('shows the opponent team abbreviation in the matchup', () => {
    const game = makeGame({
      homeTeam: {
        abbreviation: 'NY',
        displayName: 'New York Knicks',
        logo: 'https://example.com/ny.png',
        score: '110',
        isWinner: true,
        primaryColor: '#006BB6',
      },
      awayTeam: {
        abbreviation: 'BOS',
        displayName: 'Boston Celtics',
        logo: 'https://example.com/bos.png',
        score: '98',
        isWinner: false,
        primaryColor: '#007A33',
      },
      status: { state: 'post', description: 'Final', detail: 'Final' },
    });

    fixture.componentRef.setInput('team', knicks);
    fixture.componentRef.setInput('game', game);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    // The opponent side renders its abbreviation in .opp-team .team-abbr.
    const oppAbbr = el.querySelector('.opp-team .team-abbr')?.textContent?.trim();
    expect(oppAbbr).toBe('BOS');
  });

  // ── periodLabel ──────────────────────────────────────────────────────────

  // Demonstrates: periodLabel returns sport-specific suffix for in-game period display.
  it('periodLabel returns "Q" for NBA', () => {
    fixture.componentRef.setInput('team', knicks);
    fixture.detectChanges();
    expect(fixture.componentInstance.periodLabel()).toBe('Q');
  });

  it('periodLabel returns "Q" for NFL', () => {
    const giants = { ...knicks, sport: 'football/nfl' as const };
    fixture.componentRef.setInput('team', giants);
    fixture.detectChanges();
    expect(fixture.componentInstance.periodLabel()).toBe('Q');
  });

  it('periodLabel returns "P" for NHL', () => {
    const rangers = { ...knicks, sport: 'hockey/nhl' as const };
    fixture.componentRef.setInput('team', rangers);
    fixture.detectChanges();
    expect(fixture.componentInstance.periodLabel()).toBe('P');
  });

  it('periodLabel returns empty string for MLB', () => {
    const yankees = { ...knicks, sport: 'baseball/mlb' as const };
    fixture.componentRef.setInput('team', yankees);
    fixture.detectChanges();
    expect(fixture.componentInstance.periodLabel()).toBe('');
  });

  // ── hasClock ─────────────────────────────────────────────────────────────

  it('hasClock is true for NBA', () => {
    fixture.componentRef.setInput('team', knicks);
    fixture.detectChanges();
    expect(fixture.componentInstance.hasClock()).toBe(true);
  });

  it('hasClock is false for MLB', () => {
    const yankees = { ...knicks, sport: 'baseball/mlb' as const };
    fixture.componentRef.setInput('team', yankees);
    fixture.detectChanges();
    expect(fixture.componentInstance.hasClock()).toBe(false);
  });

  // ── isPost ───────────────────────────────────────────────────────────────

  it('isPost is true when game state is "post"', () => {
    fixture.componentRef.setInput('team', knicks);
    fixture.componentRef.setInput('game', makeGame({ status: { state: 'post', description: 'Final', detail: 'Final' } }));
    fixture.detectChanges();
    expect(fixture.componentInstance.isPost()).toBe(true);
  });

  it('isPost is false when game state is "pre"', () => {
    fixture.componentRef.setInput('team', knicks);
    fixture.componentRef.setInput('game', makeGame({ status: { state: 'pre', description: 'Scheduled', detail: 'Scheduled' } }));
    fixture.detectChanges();
    expect(fixture.componentInstance.isPost()).toBe(false);
  });

  // ── isClickable / .clickable CSS class ──────────────────────────────────

  it('isClickable is true for a post-game', () => {
    fixture.componentRef.setInput('team', knicks);
    fixture.componentRef.setInput('game', makeGame({ status: { state: 'post', description: 'Final', detail: 'Final' } }));
    fixture.detectChanges();
    expect(fixture.componentInstance.isClickable()).toBe(true);
  });

  it('isClickable is true for a live game', () => {
    fixture.componentRef.setInput('team', knicks);
    fixture.componentRef.setInput('game', makeGame({ status: { state: 'in', description: 'In Progress', detail: 'Q3 4:22' } }));
    fixture.detectChanges();
    expect(fixture.componentInstance.isClickable()).toBe(true);
  });

  it('isClickable is false for a pre-game', () => {
    fixture.componentRef.setInput('team', knicks);
    fixture.componentRef.setInput('game', makeGame({ status: { state: 'pre', description: 'Scheduled', detail: 'Scheduled' } }));
    fixture.detectChanges();
    expect(fixture.componentInstance.isClickable()).toBe(false);
  });

  it('isClickable is false when game is null', () => {
    fixture.componentRef.setInput('team', knicks);
    fixture.detectChanges();
    expect(fixture.componentInstance.isClickable()).toBe(false);
  });

  it('panel has .clickable class for a post-game', () => {
    fixture.componentRef.setInput('team', knicks);
    fixture.componentRef.setInput('game', makeGame({ status: { state: 'post', description: 'Final', detail: 'Final' } }));
    fixture.detectChanges();
    const panel = fixture.nativeElement.querySelector('.panel');
    expect(panel?.classList.contains('clickable')).toBe(true);
  });

  it('panel does not have .clickable class for a pre-game', () => {
    fixture.componentRef.setInput('team', knicks);
    fixture.componentRef.setInput('game', makeGame({ status: { state: 'pre', description: 'Scheduled', detail: 'Scheduled' } }));
    fixture.detectChanges();
    const panel = fixture.nativeElement.querySelector('.panel');
    expect(panel?.classList.contains('clickable')).toBe(false);
  });

  // ── panelClick output ────────────────────────────────────────────────────

  it('emits panelClick with game and sport when a post-game panel is clicked', () => {
    const game = makeGame({
      homeTeam: { ...makeGame().homeTeam, abbreviation: 'NY' },
      status: { state: 'post', description: 'Final', detail: 'Final' },
    });
    fixture.componentRef.setInput('team', knicks);
    fixture.componentRef.setInput('game', game);
    fixture.detectChanges();

    const events: { game: unknown; sport: unknown }[] = [];
    fixture.componentInstance.panelClick.subscribe(e => events.push(e));
    (fixture.nativeElement.querySelector('.panel') as HTMLElement).click();

    expect(events).toHaveLength(1);
    expect(events[0].sport).toBe('basketball/nba');
  });

  it('does not emit panelClick when a pre-game panel is clicked', () => {
    fixture.componentRef.setInput('team', knicks);
    fixture.componentRef.setInput('game', makeGame({ status: { state: 'pre', description: 'Scheduled', detail: 'Scheduled' } }));
    fixture.detectChanges();

    const events: unknown[] = [];
    fixture.componentInstance.panelClick.subscribe(e => events.push(e));
    (fixture.nativeElement.querySelector('.panel') as HTMLElement).click();

    expect(events).toHaveLength(0);
  });
});
