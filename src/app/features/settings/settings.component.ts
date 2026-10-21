import { Component, computed, inject, resource, signal } from '@angular/core';
import { EspnService } from '../../core/services/espn.service';
import { DashboardConfigService } from '../../core/services/dashboard-config.service';
import { TimeZoneService } from '../../core/services/time-zone.service';
import {
  GOLF_OPTIONS, MAX_TEAMS, SERIES_OPTIONS, TEAM_LEAGUES, leagueLabel,
} from '../../core/config/leagues.config';
import { MAX_NAME_LENGTH, encodeShareCode, teamKey } from '../../core/config/config-validation';
import { GolfSeriesConfig, League, SeriesConfig, SportLeague, TeamConfig } from '../../core/models/team-config.model';

@Component({
  selector: 'app-settings',
  imports: [],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent {
  private espn = inject(EspnService);
  private store = inject(DashboardConfigService);
  readonly tz = inject(TimeZoneService);

  readonly maxTeams = MAX_TEAMS;
  readonly maxNameLength = MAX_NAME_LENGTH;
  readonly teamLeagues = TEAM_LEAGUES;
  readonly seriesOptions = SERIES_OPTIONS;
  readonly golfOptions = GOLF_OPTIONS;

  readonly teams = computed(() => this.store.config().teams);
  readonly isFull = this.store.isFull;
  readonly isEmpty = this.store.isEmpty;
  readonly name = this.store.name;
  readonly title = this.store.title;

  setTimeZone(event: Event) {
    this.tz.setOverride((event.target as HTMLSelectElement).value);
  }

  setName(event: Event) {
    this.store.setName((event.target as HTMLInputElement).value);
  }

  // ── Team picker ─────────────────────────────────────────────────────
  league = signal<SportLeague>(TEAM_LEAGUES[0].slug as SportLeague);
  query = signal('');

  options = resource({
    params: () => this.league(),
    loader: ({ params }) => this.espn.getTeams(params),
  });

  filteredOptions = computed(() => {
    if (!this.options.hasValue()) return [];
    const q = this.query().trim().toLowerCase();
    const all = this.options.value();
    if (!q) return all;
    return all.filter(o =>
      o.config.name.toLowerCase().includes(q) || o.config.abbreviation.toLowerCase().includes(q)
    );
  });

  selectLeague(slug: League) {
    this.league.set(slug as SportLeague);
    this.query.set('');
  }

  label(slug: League) {
    return leagueLabel(slug);
  }

  isSelected(team: TeamConfig) {
    return this.store.hasTeam(team);
  }

  /** teamKey of the team whose colors are being fetched, if any */
  adding = signal<string | null>(null);

  isAdding(team: TeamConfig) {
    return this.adding() === teamKey(team);
  }

  /** Picker options have placeholder colors; fetch the real ones before saving. */
  async add(team: TeamConfig) {
    if (this.adding()) return;
    this.adding.set(teamKey(team));
    const colors = await this.espn.getTeamColors(team.sport, team.espnId).catch(() => null);
    this.store.addTeam(colors ? { ...team, ...colors } : team);
    this.adding.set(null);
  }

  remove(team: TeamConfig) {
    this.store.removeTeam(team);
  }

  move(index: number, delta: number) {
    this.store.moveTeam(index, delta);
  }

  // ── Series + golf ───────────────────────────────────────────────────
  isSeriesOn(option: SeriesConfig) {
    return this.store.config().series.some(s => s.sport === option.sport);
  }

  isGolfOn(option: GolfSeriesConfig) {
    return this.store.config().golf.some(g => g.sport === option.sport);
  }

  toggleSeries(option: SeriesConfig, event: Event) {
    this.store.setSeriesEnabled(option.sport, (event.target as HTMLInputElement).checked);
  }

  toggleGolf(option: GolfSeriesConfig, event: Event) {
    this.store.setGolfEnabled(option.sport, (event.target as HTMLInputElement).checked);
  }

  // ── Share + reset ───────────────────────────────────────────────────
  shareUrl = signal<string | null>(null);
  copied = signal(false);

  async share() {
    const { origin, pathname } = window.location;
    const url = `${origin}${pathname}#/import?c=${encodeShareCode(this.store.config())}`;
    this.shareUrl.set(url);
    try {
      await navigator.clipboard.writeText(url);
      this.copied.set(true);
    } catch {
      // Clipboard unavailable (insecure context, denied) — the link is shown for manual copy
      this.copied.set(false);
    }
  }

  clearAll() {
    if (confirm('Remove all teams, series, and tours from your dashboard?')) {
      this.store.clear();
      this.shareUrl.set(null);
    }
  }
}
