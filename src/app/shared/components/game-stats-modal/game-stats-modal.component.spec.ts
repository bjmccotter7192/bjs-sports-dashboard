import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { GameStatsModalComponent } from './game-stats-modal.component';
import { EspnService } from '../../../core/services/espn.service';
import { createMockEspnService } from '../../../testing/mock-espn.service';
import { makeGame } from '../../../testing/test-fixtures';
import { StatCategory } from '../../../core/models/game.model';

const nbaLeaders: StatCategory[] = [
  {
    label: 'Points',
    players: [
      { playerName: 'Jalen Brunson', shortName: 'J. Brunson', statLine: '32 PTS', position: 'PG' },
      { playerName: 'Tyrese Haliburton', shortName: 'T. Haliburton', statLine: '28 PTS', position: 'PG' },
    ],
  },
];

describe('GameStatsModalComponent', () => {
  let fixture: ComponentFixture<GameStatsModalComponent>;
  let mockEspn: ReturnType<typeof createMockEspnService>;

  beforeEach(() => {
    mockEspn = createMockEspnService();
    TestBed.configureTestingModule({
      imports: [GameStatsModalComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: EspnService, useValue: mockEspn },
      ],
    });
    fixture = TestBed.createComponent(GameStatsModalComponent);
  });

  // Demonstrates: modal creates with required inputs and an async resource.
  it('creates when required inputs are provided', async () => {
    fixture.componentRef.setInput('game', makeGame());
    fixture.componentRef.setInput('sport', 'basketball/nba');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance).toBeTruthy();
  });

  // Demonstrates: header renders matchup and game status from the game input.
  it('shows matchup abbreviations in the header', async () => {
    const game = makeGame({
      homeTeam: { ...makeGame().homeTeam, abbreviation: 'NYY' },
      awayTeam: { ...makeGame().awayTeam, abbreviation: 'CHW' },
      status: { state: 'post', description: 'Final', detail: 'Final' },
    });
    fixture.componentRef.setInput('game', game);
    fixture.componentRef.setInput('sport', 'baseball/mlb');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.matchup')?.textContent).toContain('CHW @ NYY');
    expect(el.querySelector('.game-detail')?.textContent?.trim()).toBe('Final');
  });

  // Demonstrates: empty leaders list shows the "no stats" placeholder.
  it('shows "no stats" message when leaders resolves empty', async () => {
    mockEspn.fetchGameLeaders.mockResolvedValue([]);
    fixture.componentRef.setInput('game', makeGame());
    fixture.componentRef.setInput('sport', 'basketball/nba');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.no-stats')?.textContent).toContain('No player stats available');
  });

  // Demonstrates: category label and player rows render when leaders resolves with data.
  it('renders stat category label and player rows', async () => {
    mockEspn.fetchGameLeaders.mockResolvedValue(nbaLeaders);
    fixture.componentRef.setInput('game', makeGame());
    fixture.componentRef.setInput('sport', 'basketball/nba');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.cat-label')?.textContent?.trim()).toBe('Points');
    const rows = el.querySelectorAll('.player-row');
    expect(rows).toHaveLength(2);
  });

  // Demonstrates: player name, position, and stat line all render.
  it('renders player name, position, and stat line', async () => {
    mockEspn.fetchGameLeaders.mockResolvedValue(nbaLeaders);
    fixture.componentRef.setInput('game', makeGame());
    fixture.componentRef.setInput('sport', 'basketball/nba');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.player-name')?.textContent?.trim()).toBe('Jalen Brunson');
    expect(el.querySelector('.player-pos')?.textContent?.trim()).toBe('PG');
    expect(el.querySelector('.stat-line')?.textContent?.trim()).toBe('32 PTS');
  });

  // Demonstrates: placeholder rendered when player has no headshot URL.
  it('renders headshot placeholder when player has no headshot', async () => {
    mockEspn.fetchGameLeaders.mockResolvedValue(nbaLeaders);
    fixture.componentRef.setInput('game', makeGame());
    fixture.componentRef.setInput('sport', 'basketball/nba');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.player-headshot.placeholder')).toBeTruthy();
    expect(el.querySelector('img.player-headshot')).toBeNull();
  });

  // Demonstrates: headshot img renders when player has a headshot URL.
  it('renders headshot img when player has a headshot URL', async () => {
    const leaders: StatCategory[] = [{
      label: 'Points',
      players: [{ playerName: 'Aaron Judge', shortName: 'A. Judge', statLine: '1 HR', headshot: 'https://example.com/aj.png' }],
    }];
    mockEspn.fetchMlbBoxscore.mockResolvedValue(leaders);
    fixture.componentRef.setInput('game', makeGame());
    fixture.componentRef.setInput('sport', 'baseball/mlb');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const img = el.querySelector('img.player-headshot') as HTMLImageElement | null;
    expect(img).toBeTruthy();
    expect(img?.src).toContain('example.com/aj.png');
  });

  // Demonstrates: backdrop click emits close.
  it('emits close when backdrop is clicked', async () => {
    mockEspn.fetchGameLeaders.mockResolvedValue([]);
    fixture.componentRef.setInput('game', makeGame());
    fixture.componentRef.setInput('sport', 'basketball/nba');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const emitted: unknown[] = [];
    fixture.componentInstance.close.subscribe(() => emitted.push(null));
    (fixture.nativeElement.querySelector('.modal-backdrop') as HTMLElement).click();
    expect(emitted).toHaveLength(1);
  });

  // Demonstrates: close button click emits close.
  it('emits close when close button is clicked', async () => {
    mockEspn.fetchGameLeaders.mockResolvedValue([]);
    fixture.componentRef.setInput('game', makeGame());
    fixture.componentRef.setInput('sport', 'basketball/nba');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const emitted: unknown[] = [];
    fixture.componentInstance.close.subscribe(() => emitted.push(null));
    (fixture.nativeElement.querySelector('.close-btn') as HTMLElement).click();
    expect(emitted).toHaveLength(1);
  });

  // Demonstrates: MLB routes to fetchMlbBoxscore, not fetchGameLeaders.
  it('calls fetchMlbBoxscore for MLB sport', async () => {
    fixture.componentRef.setInput('game', makeGame());
    fixture.componentRef.setInput('sport', 'baseball/mlb');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(mockEspn.fetchMlbBoxscore).toHaveBeenCalledWith(makeGame().id);
    expect(mockEspn.fetchGameLeaders).not.toHaveBeenCalled();
  });

  // Demonstrates: non-MLB sports route to fetchGameLeaders.
  it('calls fetchGameLeaders for NBA sport', async () => {
    fixture.componentRef.setInput('game', makeGame());
    fixture.componentRef.setInput('sport', 'basketball/nba');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(mockEspn.fetchGameLeaders).toHaveBeenCalledWith('basketball/nba', makeGame().id);
    expect(mockEspn.fetchMlbBoxscore).not.toHaveBeenCalled();
  });
});
