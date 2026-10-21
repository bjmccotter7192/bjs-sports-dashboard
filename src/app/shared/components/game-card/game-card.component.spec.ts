import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { GameCardComponent } from './game-card.component';
import { makeGame } from '../../../testing/test-fixtures';
import { Game } from '../../../core/models/game.model';

describe('GameCardComponent', () => {
  let fixture: ComponentFixture<GameCardComponent>;
  const el = () => fixture.nativeElement as HTMLElement;

  function render(game: Game, opts: { sport?: string; starred?: boolean } = {}) {
    fixture.componentRef.setInput('game', game);
    fixture.componentRef.setInput('sport', opts.sport ?? 'basketball/nba');
    fixture.componentRef.setInput('zone', 'America/New_York');
    fixture.componentRef.setInput('starred', opts.starred ?? false);
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [GameCardComponent],
      providers: [provideZonelessChangeDetection()],
    });
    fixture = TestBed.createComponent(GameCardComponent);
  });

  it('lists the away team first, then home, with scores', () => {
    render(makeGame());   // home NYY 5, away CHW 2, final
    const rows = el().querySelectorAll('.team-row');
    expect(rows[0].querySelector('.abbr')?.textContent).toBe('CHW');
    expect(rows[1].querySelector('.abbr')?.textContent).toBe('NYY');
    expect(rows[1].querySelector('.score')?.textContent).toBe('5');
    expect(el().querySelector('.status')?.textContent).toContain('Final');
  });

  it('dims the loser of a finished game but neither side of a draw', () => {
    render(makeGame());
    expect(el().querySelectorAll('.team-row')[0].classList.contains('loser')).toBe(true);
    expect(el().querySelectorAll('.team-row')[1].classList.contains('winner')).toBe(true);

    render(makeGame({
      homeTeam: { ...makeGame().homeTeam, score: '1', isWinner: false },
      awayTeam: { ...makeGame().awayTeam, score: '1', isWinner: false },
    }));
    expect(el().querySelectorAll('.team-row.loser').length).toBe(0);
  });

  it('shows the start time in the zone (no scores) before the game', () => {
    render(makeGame({
      date: new Date('2026-10-21T23:30:00Z'),
      status: { state: 'pre', description: 'Scheduled', detail: '10/21 - 7:30 PM EDT' },
    }));
    expect(el().querySelector('.score')).toBeNull();
    expect(el().querySelector('.status')?.textContent).toContain('7:30 PM ET');
  });

  it('shows period + clock for a live game in a clock league', () => {
    render(makeGame({ status: { state: 'in', description: 'In Progress', detail: 'Q3', period: 3, clock: '4:22' } }));
    expect(el().querySelector('.live-text')?.textContent).toBe('3Q 4:22');
    expect(el().querySelector('.game-card')?.classList.contains('live')).toBe(true);
  });

  it("shows ESPN's status text for a live soccer or baseball game", () => {
    render(makeGame({ status: { state: 'in', description: 'In Progress', detail: "67'", period: 2, clock: "67'" } }), { sport: 'soccer/eng.1' });
    expect(el().querySelector('.live-text')?.textContent).toBe("67'");
  });

  it("marks games with the user's team", () => {
    render(makeGame(), { starred: true });
    expect(el().querySelector('.game-card')?.classList.contains('starred')).toBe(true);
    expect(el().querySelector('.star')).not.toBeNull();
  });

  it('emits on click for live/final games only', () => {
    const clicks: Game[] = [];
    fixture.componentInstance.cardClick.subscribe(g => clicks.push(g));

    render(makeGame({ status: { state: 'pre', description: 'Scheduled', detail: '' } }));
    el().querySelector<HTMLButtonElement>('.game-card')!.click();
    expect(clicks).toHaveLength(0);

    render(makeGame());
    el().querySelector<HTMLButtonElement>('.game-card')!.click();
    expect(clicks).toHaveLength(1);
  });
});
