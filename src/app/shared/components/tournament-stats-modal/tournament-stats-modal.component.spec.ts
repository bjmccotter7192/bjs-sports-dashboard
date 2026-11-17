import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TournamentStatsModalComponent } from './tournament-stats-modal.component';
import { Tournament } from '../../../core/models/game.model';

function makeTournament(overrides: Partial<Tournament> = {}): Tournament {
  return {
    id: 't-1',
    name: 'U.S. Open',
    shortName: 'US Open',
    startDate: new Date('2026-06-18T12:00:00'),
    status: { state: 'post', detail: 'Final' },
    leaderboard: [
      { position: 1, name: 'Scottie Scheffler', shortName: 'S. Scheffler', score: '-17' },
      { position: 2, name: 'Rory McIlroy', shortName: 'R. McIlroy', score: 'E' },
      { position: 3, name: 'Xander Schauffele', shortName: 'X. Schauffele', score: '+3' },
    ],
    ...overrides,
  };
}

describe('TournamentStatsModalComponent', () => {
  let fixture: ComponentFixture<TournamentStatsModalComponent>;
  const el = () => fixture.nativeElement as HTMLElement;

  function render(tournament: Tournament) {
    fixture.componentRef.setInput('tournament', tournament);
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TournamentStatsModalComponent],
      providers: [provideZonelessChangeDetection()],
    });
    fixture = TestBed.createComponent(TournamentStatsModalComponent);
  });

  it('shows the tournament name and status detail in the header', () => {
    render(makeTournament());
    expect(el().querySelector('.tournament-name')?.textContent).toBe('U.S. Open');
    expect(el().querySelector('.tournament-detail')?.textContent).toBe('Final');
  });

  it('renders one row per leaderboard entry with position, full name and score', () => {
    render(makeTournament());
    const rows = el().querySelectorAll('.leaderboard-row');
    expect(rows).toHaveLength(3);
    expect(el().querySelector('.leaderboard-header')).not.toBeNull();
    expect(rows[0].querySelector('.position')?.textContent?.trim()).toBe('1');
    expect(rows[0].querySelector('.player-name')?.textContent).toBe('Scottie Scheffler');
    expect(rows[2].querySelector('.score')?.textContent?.trim()).toBe('+3');
    expect(el().querySelector('.no-stats')).toBeNull();
  });

  it('highlights the leader in gold and marks under-par and even scores', () => {
    render(makeTournament());
    const rows = el().querySelectorAll('.leaderboard-row');
    expect(rows[0].classList.contains('leader')).toBe(true);
    expect(rows[0].querySelector('.position')?.classList.contains('gold')).toBe(true);
    expect(rows[1].classList.contains('leader')).toBe(false);
    expect(rows[0].querySelector('.score')?.classList.contains('under')).toBe(true);
    expect(rows[1].querySelector('.score')?.classList.contains('even')).toBe(true);
    expect(rows[2].querySelector('.score')?.classList.contains('under')).toBe(false);
    expect(rows[2].querySelector('.score')?.classList.contains('even')).toBe(false);
  });

  it.each([
    ['missing', undefined],
    ['empty', []],
  ])('shows "No leaderboard available." when the leaderboard is %s', (_label, board) => {
    render(makeTournament({ leaderboard: board }));
    expect(el().querySelector('.no-stats')?.textContent).toContain('No leaderboard available.');
    expect(el().querySelector('.leaderboard-row')).toBeNull();
  });

  it('emits close from the backdrop and the close button, but not from inside the card', () => {
    render(makeTournament());
    let closes = 0;
    fixture.componentInstance.close.subscribe(() => closes++);

    (el().querySelector('.modal-card') as HTMLElement).click();
    expect(closes).toBe(0);

    (el().querySelector('.close-btn') as HTMLElement).click();
    expect(closes).toBe(1);

    (el().querySelector('.modal-backdrop') as HTMLElement).click();
    expect(closes).toBe(2);
  });
});
