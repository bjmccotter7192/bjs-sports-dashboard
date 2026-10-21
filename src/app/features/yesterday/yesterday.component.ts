import { Component, computed, inject, resource, signal } from '@angular/core';
import { EspnService, formatDateYMD } from '../../core/services/espn.service';
import { DashboardConfigService } from '../../core/services/dashboard-config.service';
import { fetchAll } from '../../core/utils/fetch-all';
import { TeamPanelComponent } from '../../shared/components/team-panel/team-panel.component';
import { MotorsportPanelComponent } from '../../shared/components/motorsport-panel/motorsport-panel.component';
import { GolfPanelComponent } from '../../shared/components/golf-panel/golf-panel.component';
import { GameStatsModalComponent } from '../../shared/components/game-stats-modal/game-stats-modal.component';
import { RaceStatsModalComponent } from '../../shared/components/race-stats-modal/race-stats-modal.component';
import { TournamentStatsModalComponent } from '../../shared/components/tournament-stats-modal/tournament-stats-modal.component';
import { EmptyConfigComponent } from '../../shared/components/empty-config/empty-config.component';
import { isEmptyConfig } from '../../core/config/config-validation';
import { EspnScoreboardResponse, Game, Race, Tournament } from '../../core/models/game.model';
import { SportLeague, MotorsportLeague } from '../../core/models/team-config.model';

interface SelectedGame { game: Game; sport: SportLeague; }
interface SelectedRace { race: Race; sport: MotorsportLeague; }

const EMPTY: EspnScoreboardResponse = { events: [] };

@Component({
  selector: 'app-yesterday',
  imports: [TeamPanelComponent, MotorsportPanelComponent, GolfPanelComponent, GameStatsModalComponent, RaceStatsModalComponent, TournamentStatsModalComponent, EmptyConfigComponent],
  templateUrl: './yesterday.component.html',
  styleUrl: './yesterday.component.scss',
})
export class YesterdayComponent {
  private espn = inject(EspnService);
  private config = inject(DashboardConfigService).config;
  readonly isEmpty = computed(() => isEmptyConfig(this.config()));

  selectedGame       = signal<SelectedGame | null>(null);
  selectedRace       = signal<SelectedRace | null>(null);
  selectedTournament = signal<Tournament | null>(null);

  private windowEnd = new Date();
  private windowStart = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 14);
    return d;
  })();

  readonly dateRange = `${formatDateYMD(this.windowStart)}-${formatDateYMD(this.windowEnd)}`;

  // ── Team sport resources (per-team season schedule, 14-day cutoff) ──
  // League scoreboards (NBA/NFL/MLB/NHL) return HTTP 400 for date ranges, so use the
  // per-team schedule endpoint instead — it also avoids the 100-event scoreboard cap.
  private teamSchedules = resource({
    params: () => this.config().teams,
    loader: ({ params }) => fetchAll(params, team => this.espn.getTeamSchedule(team.sport, team.espnId), EMPTY),
  });

  teamData = computed(() => {
    const schedules = this.teamSchedules.value();
    const isLoading = this.teamSchedules.isLoading();
    return this.config().teams.map(team => ({
      team,
      game: this.espn.findLastPlayedGame(schedules?.get(team), team.espnId, this.windowStart),
      isLoading,
    }));
  });

  // ── Motorsport resources (14-day window) ───────────────────────────
  private seriesBoards = resource({
    params: () => this.config().series.map(s => s.sport),
    loader: ({ params }) => fetchAll(params, sport => this.espn.getScoreboard(sport, this.dateRange), EMPTY),
  });

  seriesData = computed(() => {
    const boards = this.seriesBoards.value();
    const isLoading = this.seriesBoards.isLoading();
    return this.config().series.map(series => ({
      series,
      race: this.espn.findLastRace(boards?.get(series.sport)),
      isLoading,
    }));
  });

  // ── Golf resources (30-day past window) ─────────────────────────────
  private golfRange = (() => {
    const start = new Date();
    start.setDate(start.getDate() - 30);
    return `${formatDateYMD(start)}-${formatDateYMD(new Date())}`;
  })();

  private golfBoards = resource({
    params: () => this.config().golf.map(g => g.sport),
    loader: ({ params }) => fetchAll(params, sport => this.espn.getScoreboard(sport, this.golfRange), EMPTY),
  });

  golfData = computed(() => {
    const boards = this.golfBoards.value();
    const isLoading = this.golfBoards.isLoading();
    return this.config().golf.map(series => ({
      series,
      tournament: this.espn.findLastTournament(boards?.get(series.sport)),
      isLoading,
    }));
  });

  // Config order is the base order. After load: teams with a recent game float
  // above golf+motorsports; no-game teams render below.
  activeTeamPanels = computed(() => {
    const base = this.teamData();
    if (base.some(e => e.isLoading)) return base;
    return base.filter(e => e.game !== null);
  });

  inactiveTeamPanels = computed(() => {
    const base = this.teamData();
    if (base.some(e => e.isLoading)) return [];
    return base.filter(e => e.game === null);
  });
}
