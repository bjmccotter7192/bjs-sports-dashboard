import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

import { SettingsComponent } from './settings.component';
import { EspnService } from '../../core/services/espn.service';
import { CONFIG_STORAGE_KEY, DashboardConfigService } from '../../core/services/dashboard-config.service';
import { decodeShareCode, serializeConfig } from '../../core/config/config-validation';
import { MAX_TEAMS } from '../../core/config/leagues.config';
import { createMockEspnService } from '../../testing/mock-espn.service';
import { makeConfig, makeTeamConfig } from '../../testing/dashboard-config';
import { TeamOption } from '../../core/models/team-config.model';

function option(overrides: Parameters<typeof makeTeamConfig>[0] = {}): TeamOption {
  return { config: makeTeamConfig(overrides), logo: '' };
}

describe('SettingsComponent', () => {
  let fixture: ComponentFixture<SettingsComponent>;
  let component: SettingsComponent;
  let mockEspn: ReturnType<typeof createMockEspnService>;
  let store: DashboardConfigService;
  const el = () => fixture.nativeElement as HTMLElement;

  async function settle() {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function create(stored = makeConfig()) {
    localStorage.setItem(CONFIG_STORAGE_KEY, serializeConfig(stored));
    await TestBed.configureTestingModule({
      imports: [SettingsComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: EspnService, useValue: mockEspn },
      ],
    }).compileComponents();
    store = TestBed.inject(DashboardConfigService);
    fixture = TestBed.createComponent(SettingsComponent);
    component = fixture.componentInstance;
    await settle();
  }

  beforeEach(() => {
    localStorage.clear();
    mockEspn = createMockEspnService();
  });

  afterEach(() => vi.restoreAllMocks());

  // ── Dashboard name ──────────────────────────────────────────────────────────

  it('saves the dashboard name as you type and previews the title', async () => {
    await create();
    const input = el().querySelector<HTMLInputElement>('.name-input')!;
    input.value = 'Alex';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(store.name()).toBe('Alex');
    expect(el().textContent).toContain('Shown as "Alex Sports Dashboard"');
  });

  // ── Team picker ─────────────────────────────────────────────────────────────

  it('loads teams for the first league (NBA) on open', async () => {
    await create();
    expect(mockEspn.getTeams).toHaveBeenCalledWith('basketball/nba');
  });

  it('loads teams for a league when its tab is clicked', async () => {
    await create();
    const nhlTab = [...el().querySelectorAll<HTMLButtonElement>('.tab-btn')].find(b => b.textContent?.trim() === 'NHL')!;
    nhlTab.click();
    await settle();
    expect(mockEspn.getTeams).toHaveBeenLastCalledWith('hockey/nhl');
  });

  it('adds a team with colors fetched from ESPN when its option is clicked', async () => {
    mockEspn.getTeams.mockResolvedValue([option({ espnId: '18', name: 'New York Knicks', sport: 'basketball/nba' })]);
    mockEspn.getTeamColors.mockResolvedValue({ primaryColor: '#1d428a', secondaryColor: '#f58426' });
    await create();
    el().querySelector<HTMLButtonElement>('.option')!.click();
    // add() awaits the color lookup, which whenStable() doesn't track
    await vi.waitFor(() => expect(store.config().teams).toHaveLength(1));
    fixture.detectChanges();
    expect(mockEspn.getTeamColors).toHaveBeenCalledWith('basketball/nba', '18');
    expect(store.config().teams.map(t => t.espnId)).toEqual(['18']);
    expect(store.config().teams[0].primaryColor).toBe('#1d428a');
    expect(el().querySelector('.team-row .team-name')?.textContent).toContain('New York Knicks');
    expect(el().querySelector<HTMLButtonElement>('.option')!.disabled).toBe(true);
  });

  it('still adds the team with placeholder colors when the color lookup fails', async () => {
    mockEspn.getTeams.mockResolvedValue([option({ espnId: '18', primaryColor: '#666666', secondaryColor: '#999999' })]);
    mockEspn.getTeamColors.mockRejectedValue(new Error('network'));
    await create();
    await component.add(component.filteredOptions()[0].config);
    expect(store.config().teams[0].primaryColor).toBe('#666666');
    expect(component.adding()).toBeNull();
  });

  it('ignores clicks while another team is being added', async () => {
    let resolveColors!: (c: unknown) => void;
    mockEspn.getTeamColors.mockReturnValue(new Promise(r => (resolveColors = r)));
    await create();
    const first = component.add(makeTeamConfig({ espnId: '1' }));
    await component.add(makeTeamConfig({ espnId: '2' }));
    resolveColors({ primaryColor: '#111111', secondaryColor: '#222222' });
    await first;
    expect(store.config().teams.map(t => t.espnId)).toEqual(['1']);
  });

  it('filters options by name or abbreviation', async () => {
    mockEspn.getTeams.mockResolvedValue([
      option({ espnId: '1', name: 'Boston Celtics', abbreviation: 'BOS' }),
      option({ espnId: '18', name: 'New York Knicks', abbreviation: 'NY' }),
    ]);
    await create();
    component.query.set('knick');
    expect(component.filteredOptions().map(o => o.config.espnId)).toEqual(['18']);
    component.query.set('bos');
    expect(component.filteredOptions().map(o => o.config.espnId)).toEqual(['1']);
  });

  it('shows an error when ESPN teams fail to load', async () => {
    mockEspn.getTeams.mockRejectedValue(new Error('400'));
    await create();
    expect(el().querySelector('.hint.error')).not.toBeNull();
  });

  it('disables adding once the team cap is reached', async () => {
    const teams = Array.from({ length: MAX_TEAMS }, (_, i) => makeTeamConfig({ espnId: String(i + 100) }));
    mockEspn.getTeams.mockResolvedValue([option({ espnId: '1', sport: 'basketball/nba' })]);
    await create(makeConfig({ teams }));
    expect(el().querySelector('.count')?.textContent).toContain(`${MAX_TEAMS} / ${MAX_TEAMS}`);
    expect(el().querySelector<HTMLButtonElement>('.option')!.disabled).toBe(true);
  });

  // ── Selected teams ──────────────────────────────────────────────────────────

  it('reorders and removes selected teams', async () => {
    const a = makeTeamConfig({ espnId: '1', name: 'Team A', shortName: 'A' });
    const b = makeTeamConfig({ espnId: '2', name: 'Team B', shortName: 'B' });
    await create(makeConfig({ teams: [a, b] }));

    el().querySelector<HTMLButtonElement>('[aria-label="Move B up"]')!.click();
    await settle();
    expect(store.config().teams.map(t => t.shortName)).toEqual(['B', 'A']);

    el().querySelector<HTMLButtonElement>('[aria-label="Remove B"]')!.click();
    await settle();
    expect(store.config().teams.map(t => t.shortName)).toEqual(['A']);
  });

  it('disables moving the first team up and the last team down', async () => {
    await create(makeConfig({ teams: [makeTeamConfig({ espnId: '1', shortName: 'A' }), makeTeamConfig({ espnId: '2', shortName: 'B' })] }));
    expect(el().querySelector<HTMLButtonElement>('[aria-label="Move A up"]')!.disabled).toBe(true);
    expect(el().querySelector<HTMLButtonElement>('[aria-label="Move B down"]')!.disabled).toBe(true);
  });

  // ── Series + golf ───────────────────────────────────────────────────────────

  it('toggles a series and the golf tour', async () => {
    await create();
    const boxes = el().querySelectorAll<HTMLInputElement>('.toggle input');
    expect(boxes.length).toBe(4);
    boxes[0].click();   // F1
    boxes[3].click();   // PGA
    await settle();
    expect(store.config().series.map(s => s.sport)).toEqual(['racing/f1']);
    expect(store.config().golf.map(g => g.sport)).toEqual(['golf/pga']);
  });

  // ── Share + reset ───────────────────────────────────────────────────────────

  it('builds a share link that decodes back to the config and copies it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await create(makeConfig({ teams: [makeTeamConfig()] }));

    await component.share();
    const url = component.shareUrl()!;
    expect(url).toContain('#/import?c=');
    expect(writeText).toHaveBeenCalledWith(url);
    expect(component.copied()).toBe(true);
    expect(decodeShareCode(url.split('c=')[1])!.teams).toEqual([
      { sport: 'baseball/mlb', espnId: '10', primaryColor: '#003087', secondaryColor: '#E4E4E4' },
    ]);
  });

  it('still shows the share link when the clipboard is unavailable', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) }, configurable: true });
    await create(makeConfig({ teams: [makeTeamConfig()] }));
    await component.share();
    await settle();
    expect(component.copied()).toBe(false);
    expect(el().querySelector<HTMLInputElement>('.share-url')?.value).toContain('#/import?c=');
  });

  it('clears everything only after confirmation', async () => {
    await create(makeConfig({ teams: [makeTeamConfig()] }));
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    component.clearAll();
    expect(store.isEmpty()).toBe(false);
    confirmSpy.mockReturnValue(true);
    component.clearAll();
    expect(store.isEmpty()).toBe(true);
  });
});
