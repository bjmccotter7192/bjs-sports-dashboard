import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { CONFIG_STORAGE_KEY, DashboardConfigService, NAME_STORAGE_KEY } from './dashboard-config.service';
import { serializeConfig } from '../config/config-validation';
import { MAX_TEAMS } from '../config/leagues.config';
import { SAMPLE_CONFIG } from '../../testing/sample-config';
import { makeConfig, makeTeamConfig } from '../../testing/dashboard-config';

describe('DashboardConfigService', () => {
  function create(): DashboardConfigService {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    return TestBed.inject(DashboardConfigService);
  }

  function stored() {
    return JSON.parse(localStorage.getItem(CONFIG_STORAGE_KEY)!);
  }

  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('starts empty when nothing is stored', () => {
    const service = create();
    expect(service.isEmpty()).toBe(true);
  });

  it('loads a stored config', () => {
    localStorage.setItem(CONFIG_STORAGE_KEY, serializeConfig(SAMPLE_CONFIG));
    expect(create().config()).toEqual(SAMPLE_CONFIG);
  });

  it('starts empty when stored data is corrupt', () => {
    localStorage.setItem(CONFIG_STORAGE_KEY, '{"v":1,"teams":[{"espnId":"x"}]');
    expect(create().isEmpty()).toBe(true);
  });

  it('starts empty when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(create().isEmpty()).toBe(true);
  });

  it('addTeam appends and persists', () => {
    const service = create();
    service.addTeam(makeTeamConfig());
    expect(service.config().teams.map(t => t.espnId)).toEqual(['10']);
    expect(stored().teams[0].espnId).toBe('10');
  });

  it('addTeam ignores duplicates', () => {
    const service = create();
    service.addTeam(makeTeamConfig());
    service.addTeam(makeTeamConfig());
    expect(service.config().teams).toHaveLength(1);
  });

  it(`addTeam stops at ${MAX_TEAMS} teams`, () => {
    const service = create();
    for (let i = 1; i <= MAX_TEAMS + 2; i++) service.addTeam(makeTeamConfig({ espnId: String(i) }));
    expect(service.config().teams).toHaveLength(MAX_TEAMS);
    expect(service.isFull()).toBe(true);
  });

  it('treats the same id in different leagues as different teams', () => {
    const service = create();
    service.addTeam(makeTeamConfig({ espnId: '19', sport: 'football/nfl' }));
    service.addTeam(makeTeamConfig({ espnId: '19', sport: 'baseball/mlb' }));
    expect(service.config().teams).toHaveLength(2);
  });

  it('removeTeam removes by league + id', () => {
    const service = create();
    service.addTeam(makeTeamConfig());
    service.removeTeam({ sport: 'baseball/mlb', espnId: '10' });
    expect(service.isEmpty()).toBe(true);
    expect(stored().teams).toEqual([]);
  });

  it('moveTeam swaps neighbours and ignores moves past either end', () => {
    const service = create();
    ['1', '2', '3'].forEach(id => service.addTeam(makeTeamConfig({ espnId: id })));
    service.moveTeam(2, -1);
    expect(service.config().teams.map(t => t.espnId)).toEqual(['1', '3', '2']);
    service.moveTeam(0, -1);
    service.moveTeam(2, 1);
    expect(service.config().teams.map(t => t.espnId)).toEqual(['1', '3', '2']);
  });

  it('setSeriesEnabled / setGolfEnabled toggle catalog entries', () => {
    const service = create();
    service.setSeriesEnabled('racing/irl', true);
    service.setSeriesEnabled('racing/f1', true);
    service.setGolfEnabled('golf/pga', true);
    expect(service.config().series.map(s => s.sport)).toEqual(['racing/f1', 'racing/irl']);
    service.setSeriesEnabled('racing/f1', false);
    expect(service.config().series.map(s => s.sport)).toEqual(['racing/irl']);
    expect(stored().golf).toEqual(['golf/pga']);
  });

  it('replace sanitizes its input', () => {
    const service = create();
    service.replace(makeConfig({ teams: [makeTeamConfig({ primaryColor: 'javascript:alert(1)' })] }));
    expect(service.isEmpty()).toBe(true);
  });

  it('clear empties the config and storage', () => {
    localStorage.setItem(CONFIG_STORAGE_KEY, serializeConfig(SAMPLE_CONFIG));
    const service = create();
    service.clear();
    expect(service.isEmpty()).toBe(true);
    expect(stored().teams).toEqual([]);
  });

  it('keeps working in memory when saving fails', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    const service = create();
    service.addTeam(makeTeamConfig());
    expect(service.config().teams).toHaveLength(1);
  });

  // ── Dashboard name ──────────────────────────────────────────────────────

  it('defaults to a neutral title with no saved name', () => {
    const service = create();
    expect(service.name()).toBe('');
    expect(service.title()).toBe('Sports Dashboard');
  });

  it('setName updates the title and persists under its own key', () => {
    const service = create();
    service.setName("BJ's");
    expect(service.title()).toBe("BJ's Sports Dashboard");
    expect(localStorage.getItem(NAME_STORAGE_KEY)).toBe("BJ's");
    expect(localStorage.getItem(CONFIG_STORAGE_KEY)).toBeNull();
  });

  it('loads a saved name', () => {
    localStorage.setItem(NAME_STORAGE_KEY, 'Alex');
    expect(create().title()).toBe('Alex Sports Dashboard');
  });

  it('removes the saved name when cleared to blank', () => {
    const service = create();
    service.setName('Alex');
    service.setName('  ');
    expect(localStorage.getItem(NAME_STORAGE_KEY)).toBeNull();
    expect(service.title()).toBe('Sports Dashboard');
  });

  it('keeps the name when the dashboard is replaced or cleared', () => {
    const service = create();
    service.setName('Alex');
    service.replace(SAMPLE_CONFIG);
    service.clear();
    expect(service.name()).toBe('Alex');
  });
});
