import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { GolfPanelComponent } from './golf-panel.component';
import { GolfSeriesConfig } from '../../../core/models/team-config.model';
import { Tournament } from '../../../core/models/game.model';

const pga: GolfSeriesConfig = {
  kind: 'golf',
  name: 'PGA Tour',
  shortName: 'PGA',
  sport: 'golf/pga',
  primaryColor: '#003865',
  secondaryColor: '#C8102E',
};

const leaderboard = [
  { position: 1, name: 'Scottie Scheffler', shortName: 'S. Scheffler', score: '-17' },
  { position: 2, name: 'Rory McIlroy', shortName: 'R. McIlroy', score: '-15' },
  { position: 3, name: 'Xander Schauffele', shortName: 'X. Schauffele', score: '-12' },
  { position: 4, name: 'Jon Rahm', shortName: 'J. Rahm', score: '-10' },
];

function makeTournament(overrides: Partial<Tournament> = {}): Tournament {
  return {
    id: 't-1',
    name: 'U.S. Open',
    shortName: 'US Open',
    startDate: new Date('2026-06-18T12:00:00'),
    endDate: new Date('2026-06-21T12:00:00'),
    status: { state: 'post', detail: 'Final' },
    venue: 'Shinnecock Hills',
    leaderboard,
    ...overrides,
  };
}

describe('GolfPanelComponent', () => {
  let fixture: ComponentFixture<GolfPanelComponent>;
  const el = () => fixture.nativeElement as HTMLElement;

  function render(tournament: Tournament | null, isLoading = false) {
    fixture.componentRef.setInput('series', pga);
    fixture.componentRef.setInput('tournament', tournament);
    fixture.componentRef.setInput('isLoading', isLoading);
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [GolfPanelComponent],
      providers: [provideZonelessChangeDetection()],
    });
    fixture = TestBed.createComponent(GolfPanelComponent);
  });

  it('shows the "No tournament data" placeholder when there is no tournament', () => {
    render(null);
    expect(el().querySelector('.no-data-text')?.textContent).toContain('No tournament data');
    expect(el().querySelector('.panel')?.classList.contains('clickable')).toBe(false);
  });

  it('shows the skeleton instead of the placeholder while loading', () => {
    render(null, true);
    expect(el().querySelector('.skeleton')).not.toBeNull();
    expect(el().querySelector('.no-data-text')).toBeNull();
  });

  it('shows the top three with a trophy for the winner of a finished tournament', () => {
    render(makeTournament());
    expect(el().querySelector('.state-label')?.textContent?.trim()).toBe('LAST TOURNAMENT');
    expect(el().querySelector('.tournament-name')?.textContent?.trim()).toBe('U.S. Open');
    expect(el().querySelector('.venue')?.textContent).toContain('Shinnecock Hills');
    const rows = el().querySelectorAll('.leaderboard-row');
    expect(rows).toHaveLength(3);
    expect(rows[0].classList.contains('leader')).toBe(true);
    expect(rows[0].querySelector('.pos')?.textContent?.trim()).toBe('🏆');
    expect(rows[1].querySelector('.pos')?.textContent?.trim()).toBe('2');
    expect(rows[2].querySelector('.player-name')?.textContent?.trim()).toBe('X. Schauffele');
    expect(rows[2].querySelector('.score')?.textContent?.trim()).toBe('-12');
  });

  it('shows the LIVE badge and numbered positions (no trophy) for a tournament in progress', () => {
    render(makeTournament({ status: { state: 'in', detail: 'Round 3' } }));
    expect(el().querySelector('.result-badge.live')).not.toBeNull();
    expect(el().querySelector('.state-label')?.textContent?.trim()).toBe('IN PROGRESS');
    expect(el().querySelector('.state-label')?.classList.contains('live')).toBe(true);
    expect(el().querySelector('.leaderboard-row .pos')?.textContent?.trim()).toBe('1');
  });

  it('shows dates and no leaderboard for an upcoming tournament', () => {
    render(makeTournament({ status: { state: 'pre', detail: 'Scheduled' } }));
    expect(el().querySelector('.state-label')?.textContent?.trim()).toBe('UPCOMING TOURNAMENT');
    expect(el().querySelector('.dates')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Jun 18 – Jun 21, 2026');
    expect(el().querySelector('.leaderboard')).toBeNull();
    expect(el().querySelector('.result-badge.live')).toBeNull();
  });

  it('shows only the start date when an upcoming tournament has no end date', () => {
    render(makeTournament({ status: { state: 'pre', detail: 'Scheduled' }, endDate: undefined }));
    expect(el().querySelector('.dates')?.textContent?.trim()).toBe('Jun 18');
  });

  it('omits the venue and leaderboard when a finished tournament has neither', () => {
    render(makeTournament({ venue: undefined, leaderboard: undefined }));
    expect(el().querySelector('.venue')).toBeNull();
    expect(el().querySelector('.leaderboard')).toBeNull();
    expect(el().querySelector('.tournament-name')?.textContent?.trim()).toBe('U.S. Open');
  });

  it('emits panelClick with the tournament for finished and live tournaments', () => {
    const clicks: Tournament[] = [];
    fixture.componentInstance.panelClick.subscribe(t => clicks.push(t));

    const finished = makeTournament();
    render(finished);
    expect(el().querySelector('.panel')?.classList.contains('clickable')).toBe(true);
    (el().querySelector('.panel') as HTMLElement).click();

    const live = makeTournament({ status: { state: 'in', detail: 'Round 2' } });
    render(live);
    (el().querySelector('.panel') as HTMLElement).click();

    expect(clicks).toEqual([finished, live]);
  });

  it('does not emit panelClick for an upcoming tournament or when there is none', () => {
    const clicks: Tournament[] = [];
    fixture.componentInstance.panelClick.subscribe(t => clicks.push(t));

    render(makeTournament({ status: { state: 'pre', detail: 'Scheduled' } }));
    expect(el().querySelector('.panel')?.classList.contains('clickable')).toBe(false);
    (el().querySelector('.panel') as HTMLElement).click();

    render(null);
    (el().querySelector('.panel') as HTMLElement).click();

    expect(clicks).toHaveLength(0);
  });
});
