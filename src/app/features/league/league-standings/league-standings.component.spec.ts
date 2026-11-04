import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';

import { LeagueStandingsComponent } from './league-standings.component';
import { EspnService } from '../../../core/services/espn.service';
import { StandingsGroup, StandingsRow } from '../../../core/models/standings.model';
import { SportLeague } from '../../../core/models/team-config.model';
import { createMockEspnService } from '../../../testing/mock-espn.service';
import { makeConfig, makeTeamConfig, provideDashboardConfig } from '../../../testing/dashboard-config';

describe('LeagueStandingsComponent', () => {
  let fixture: ComponentFixture<LeagueStandingsComponent>;
  let mockEspn: ReturnType<typeof createMockEspnService>;
  const el = () => fixture.nativeElement as HTMLElement;

  const row = (teamId: string, name: string, stats: Record<string, string> = {}): StandingsRow => ({
    teamId, abbreviation: name.slice(0, 3).toUpperCase(), name, logo: '',
    stats: Object.fromEntries(Object.entries(stats).map(([k, v]) => [k, { value: null, display: v }])),
  });

  const EAST: StandingsGroup = { name: 'Eastern Conference', rows: [
    row('1', 'Celtics', { wins: '6', losses: '1', clincher: 'x' }),
    row('18', 'Knicks', { wins: '4', losses: '3' }),
  ] };
  const WEST: StandingsGroup = { name: 'Western Conference', rows: [row('25', 'Thunder', { wins: '7' })] };

  async function create(groups: StandingsGroup[] | Error, config = makeConfig(), sport: SportLeague = 'basketball/nba') {
    if (groups instanceof Error) mockEspn.getStandings.mockRejectedValue(groups);
    else mockEspn.getStandings.mockResolvedValue(groups);
    await TestBed.configureTestingModule({
      imports: [LeagueStandingsComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: EspnService, useValue: mockEspn },
        provideDashboardConfig(config),
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(LeagueStandingsComponent);
    fixture.componentRef.setInput('sport', sport);
    fixture.componentRef.setInput('label', 'NBA');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    mockEspn = createMockEspnService();
  });

  it('renders a table per group with the league columns', async () => {
    await create([EAST, WEST]);
    expect(mockEspn.getStandings).toHaveBeenCalledWith('basketball/nba');
    const names = [...el().querySelectorAll('.group-name')].map(n => n.textContent?.trim());
    expect(names).toEqual(['Eastern Conference', 'Western Conference']);
    const headers = [...el().querySelectorAll('thead')[0].querySelectorAll('th')].map(h => h.textContent?.trim());
    expect(headers).toEqual(['#', 'Team', 'W', 'L', 'PCT', 'GB', 'Home', 'Away', 'L10', 'Strk']);
    const first = el().querySelector('tbody tr')!;
    expect(first.textContent).toContain('Celtics');
    expect(first.querySelector('.clinch')?.textContent).toBe('x');
  });

  it('shows a dash for stats ESPN left out', async () => {
    await create([WEST]);
    const cells = [...el().querySelectorAll('tbody tr td')].map(c => c.textContent?.trim());
    expect(cells.slice(0, 3)).toEqual(['1', '7', '–']);
  });

  it("puts the user's groups first and stars their teams", async () => {
    await create([WEST, EAST], makeConfig({ teams: [makeTeamConfig({ espnId: '18', sport: 'basketball/nba' })] }));
    expect(el().querySelector('.group-name')?.textContent).toContain('Eastern');
    const starred = el().querySelectorAll('tr.starred');
    expect(starred.length).toBe(1);
    expect(starred[0].textContent).toContain('Knicks');
  });

  it("doesn't star a same-id team from another league", async () => {
    await create([EAST], makeConfig({ teams: [makeTeamConfig({ espnId: '18', sport: 'hockey/nhl' })] }));
    expect(el().querySelectorAll('tr.starred').length).toBe(0);
  });

  it('uses per-league columns', async () => {
    await create([{ name: 'Premier League', rows: [row('359', 'Arsenal', { points: '24' })] }], makeConfig(), 'soccer/eng.1');
    const headers = [...el().querySelectorAll('thead th')].map(h => h.textContent?.trim());
    expect(headers).toEqual(['#', 'Team', 'GP', 'W', 'D', 'L', 'GF', 'GA', 'GD', 'Pts']);
  });

  it('shows an empty state when ESPN has no standings', async () => {
    await create([]);
    expect(el().textContent).toContain('No NBA standings available');
  });

  it('shows an error when ESPN fails', async () => {
    await create(new Error('500'));
    expect(el().textContent).toContain("Couldn't load NBA standings");
  });
});
