import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';

import { ImportComponent } from './import.component';
import { EspnService } from '../../core/services/espn.service';
import { CONFIG_STORAGE_KEY, DashboardConfigService } from '../../core/services/dashboard-config.service';
import { encodeShareCode, serializeConfig } from '../../core/config/config-validation';
import { SERIES_OPTIONS } from '../../core/config/leagues.config';
import { createMockEspnService } from '../../testing/mock-espn.service';
import { makeConfig, makeTeamConfig } from '../../testing/dashboard-config';
import { SportLeague, TeamOption } from '../../core/models/team-config.model';

describe('ImportComponent', () => {
  let fixture: ComponentFixture<ImportComponent>;
  let component: ImportComponent;
  let mockEspn: ReturnType<typeof createMockEspnService>;
  let store: DashboardConfigService;
  const el = () => fixture.nativeElement as HTMLElement;

  // ESPN's view of the Yankees — note the name differs from the link's source config
  const espnYankees: TeamOption = {
    config: makeTeamConfig({ name: 'New York Yankees (ESPN)', primaryColor: '#132448', secondaryColor: '#c4ced3' }),
    logo: '',
  };

  async function create(code: string | null, existing = makeConfig()) {
    localStorage.setItem(CONFIG_STORAGE_KEY, serializeConfig(existing));
    await TestBed.configureTestingModule({
      imports: [ImportComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: EspnService, useValue: mockEspn },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(code === null ? {} : { c: code }) } } },
      ],
    }).compileComponents();
    store = TestBed.inject(DashboardConfigService);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(ImportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    localStorage.clear();
    mockEspn = createMockEspnService();
    mockEspn.getTeams.mockImplementation((sport: SportLeague) =>
      Promise.resolve(sport === 'baseball/mlb' ? [espnYankees] : []));
  });

  it('shows an error for a missing or invalid code', async () => {
    await create(null);
    expect(el().querySelector('.error')?.textContent).toContain("isn't a valid dashboard link");
    expect(mockEspn.getTeams).not.toHaveBeenCalled();
  });

  it('resolves team names from ESPN and keeps colors from the link', async () => {
    await create(encodeShareCode(makeConfig({ teams: [makeTeamConfig()] })));
    const team = component.preview()!.config.teams[0];
    expect(team.name).toBe('New York Yankees (ESPN)');
    expect(team.primaryColor).toBe('#003087');
    expect(el().querySelector('.preview-list')?.textContent).toContain('New York Yankees (ESPN)');
  });

  it('fetches ESPN colors for teams the link has no colors for', async () => {
    mockEspn.getTeamColors.mockResolvedValue({ primaryColor: '#132448', secondaryColor: '#c4ced3' });
    const code = btoa(JSON.stringify({ v: 1, t: [['baseball/mlb', '10']], s: [], g: [] })).replace(/=+$/, '');
    await create(code);
    expect(mockEspn.getTeamColors).toHaveBeenCalledWith('baseball/mlb', '10');
    expect(component.preview()!.config.teams[0].primaryColor).toBe('#132448');
  });

  it('does not fetch colors when the link includes them', async () => {
    await create(encodeShareCode(makeConfig({ teams: [makeTeamConfig()] })));
    expect(mockEspn.getTeamColors).not.toHaveBeenCalled();
  });

  it('keeps placeholder colors when the color lookup fails', async () => {
    mockEspn.getTeamColors.mockRejectedValue(new Error('network'));
    const code = btoa(JSON.stringify({ v: 1, t: [['baseball/mlb', '10']], s: [], g: [] })).replace(/=+$/, '');
    await create(code);
    expect(component.preview()!.config.teams[0].primaryColor).toBe(espnYankees.config.primaryColor);
  });

  it('skips teams ESPN does not know and says so', async () => {
    const config = makeConfig({ teams: [makeTeamConfig(), makeTeamConfig({ espnId: '999' })] });
    await create(encodeShareCode(config));
    expect(component.preview()!.config.teams).toHaveLength(1);
    expect(component.preview()!.missing).toBe(1);
    expect(el().textContent).toContain("1 team(s) in this link couldn't be found");
  });

  it('shows an error when no teams resolve and there is nothing else to import', async () => {
    await create(encodeShareCode(makeConfig({ teams: [makeTeamConfig({ espnId: '999' })] })));
    expect(el().querySelector('.error')?.textContent).toContain('could be found');
  });

  it('warns before replacing an existing dashboard', async () => {
    await create(encodeShareCode(makeConfig({ series: [SERIES_OPTIONS[0]] })), makeConfig({ teams: [makeTeamConfig()] }));
    expect(el().querySelector('.warning')).not.toBeNull();
  });

  it('applies the preview and navigates to Today', async () => {
    await create(encodeShareCode(makeConfig({ teams: [makeTeamConfig()], series: [SERIES_OPTIONS[0]] })));
    el().querySelector<HTMLButtonElement>('.action-btn.primary')!.click();
    expect(store.config().teams[0].name).toBe('New York Yankees (ESPN)');
    expect(store.config().series.map(s => s.sport)).toEqual(['racing/f1']);
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/today']);
  });

  it('does not change the dashboard until applied', async () => {
    await create(encodeShareCode(makeConfig({ teams: [makeTeamConfig()] })));
    expect(store.isEmpty()).toBe(true);
  });
});
