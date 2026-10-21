import { Injectable, computed, signal } from '@angular/core';
import { DashboardConfig, GolfLeague, MotorsportLeague, TeamConfig } from '../models/team-config.model';
import { MAX_TEAMS, TEAM_LEAGUES } from '../config/leagues.config';
import {
  EMPTY_CONFIG, dashboardTitle, isEmptyConfig, parseStoredConfig, sanitizeConfig, sanitizeName,
  serializeConfig, teamKey,
} from '../config/config-validation';

export const CONFIG_STORAGE_KEY = 'sports-dashboard:config';
// Kept separate from the config so share links and imports never carry or overwrite it
export const NAME_STORAGE_KEY = 'sports-dashboard:name';

/** Source of truth for which teams/series the dashboard shows. Persisted to localStorage. */
@Injectable({ providedIn: 'root' })
export class DashboardConfigService {
  private state = signal<DashboardConfig>(this.load());

  readonly config = this.state.asReadonly();
  readonly isEmpty = computed(() => isEmptyConfig(this.state()));
  readonly isFull = computed(() => this.state().teams.length >= MAX_TEAMS);

  /** Team leagues with at least one configured team, in registry order. */
  readonly followedTeamLeagues = computed(() =>
    TEAM_LEAGUES.filter(l => this.state().teams.some(t => t.sport === l.slug))
  );

  private nameState = signal(this.loadName());
  readonly name = this.nameState.asReadonly();
  readonly title = computed(() => dashboardTitle(this.nameState()));

  setName(value: string) {
    const name = sanitizeName(value);
    this.nameState.set(name);
    try {
      if (name.trim()) localStorage.setItem(NAME_STORAGE_KEY, name);
      else localStorage.removeItem(NAME_STORAGE_KEY);
    } catch {
      // Storage blocked — keep the in-memory name for this session
    }
  }

  /** Replace the whole config (import, reset). Input is sanitized. */
  replace(config: DashboardConfig) {
    this.commit(sanitizeConfig(config));
  }

  hasTeam(team: Pick<TeamConfig, 'sport' | 'espnId'>): boolean {
    return this.state().teams.some(t => teamKey(t) === teamKey(team));
  }

  addTeam(team: TeamConfig) {
    if (this.hasTeam(team) || this.isFull()) return;
    this.update(c => ({ ...c, teams: [...c.teams, team] }));
  }

  removeTeam(team: Pick<TeamConfig, 'sport' | 'espnId'>) {
    this.update(c => ({ ...c, teams: c.teams.filter(t => teamKey(t) !== teamKey(team)) }));
  }

  /** Move the team at `index` by `delta` positions (-1 = up). No-op at the ends. */
  moveTeam(index: number, delta: number) {
    const target = index + delta;
    const teams = [...this.state().teams];
    if (index < 0 || index >= teams.length || target < 0 || target >= teams.length) return;
    [teams[index], teams[target]] = [teams[target], teams[index]];
    this.update(c => ({ ...c, teams }));
  }

  setSeriesEnabled(sport: MotorsportLeague, enabled: boolean) {
    const slugs = this.state().series.map(s => s.sport).filter(s => s !== sport);
    this.update(c => ({ ...c, series: enabled ? [...slugs, sport] : slugs }));
  }

  setGolfEnabled(sport: GolfLeague, enabled: boolean) {
    const slugs = this.state().golf.map(g => g.sport).filter(s => s !== sport);
    this.update(c => ({ ...c, golf: enabled ? [...slugs, sport] : slugs }));
  }

  clear() {
    this.commit(EMPTY_CONFIG);
  }

  // Series/golf are passed as slugs here; sanitizeConfig resolves them against the catalog.
  private update(fn: (c: DashboardConfig) => unknown) {
    this.commit(sanitizeConfig(fn(this.state())));
  }

  private commit(config: DashboardConfig) {
    this.state.set(config);
    try {
      localStorage.setItem(CONFIG_STORAGE_KEY, serializeConfig(config));
    } catch {
      // Storage full or blocked (private mode) — keep the in-memory config for this session
    }
  }

  private loadName(): string {
    try {
      return sanitizeName(localStorage.getItem(NAME_STORAGE_KEY));
    } catch {
      return '';
    }
  }

  private load(): DashboardConfig {
    try {
      return parseStoredConfig(localStorage.getItem(CONFIG_STORAGE_KEY));
    } catch {
      return EMPTY_CONFIG;
    }
  }
}
