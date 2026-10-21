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
  selector: 'app-today',
  imports: [TeamPanelComponent, MotorsportPanelComponent, GolfPanelComponent, GameStatsModalComponent, RaceStatsModalComponent, TournamentStatsModalComponent, EmptyConfigComponent],
  templateUrl: './today.component.html',
  styleUrl: './today.component.scss',
})
export class TodayComponent {
  private espn = inject(EspnService);
  private config = inject(DashboardConfigService).config;
  readonly isEmpty = computed(() => isEmptyConfig(this.config()));

  selectedGame       = signal<SelectedGame | null>(null);
  selectedRace       = signal<SelectedRace | null>(null);
  selectedTournament = signal<Tournament | null>(null);

  readonly date = formatDateYMD(new Date());
  readonly dateLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  // ── Team sport resources (one scoreboard per league in config) ──────
  private teamBoards = resource({
    params: () => this.config().teams.map(t => t.sport),
    loader: ({ params }) => fetchAll(params, sport => this.espn.getScoreboard(sport, this.date), EMPTY),
  });

  teamData = computed(() => {
    const boards = this.teamBoards.value();
    const isLoading = this.teamBoards.isLoading();
    return this.config().teams.map(team => ({
      team,
      game: this.espn.findTeamGame(boards?.get(team.sport), team.espnId),
      isLoading,
    }));
  });

  // ── Motorsport + golf resources (60-day future window) ──────────────
  private futureRange = (() => {
    const end = new Date();
    end.setDate(end.getDate() + 60);
    return `${formatDateYMD(new Date())}-${formatDateYMD(end)}`;
  })();

  private seriesBoards = resource({
    params: () => this.config().series.map(s => s.sport),
    loader: ({ params }) => fetchAll(params, sport => this.espn.getScoreboard(sport, this.futureRange), EMPTY),
  });

  seriesData = computed(() => {
    const boards = this.seriesBoards.value();
    const isLoading = this.seriesBoards.isLoading();
    return this.config().series.map(series => ({
      series,
      race: this.espn.findNextRace(boards?.get(series.sport)),
      isLoading,
    }));
  });

  private golfBoards = resource({
    params: () => this.config().golf.map(g => g.sport),
    loader: ({ params }) => fetchAll(params, sport => this.espn.getScoreboard(sport, this.futureRange), EMPTY),
  });

  golfData = computed(() => {
    const boards = this.golfBoards.value();
    const isLoading = this.golfBoards.isLoading();
    return this.config().golf.map(series => ({
      series,
      tournament: this.espn.findCurrentTournament(boards?.get(series.sport)),
      isLoading,
    }));
  });

  // Config order is the base order. After load: teams with a game float above
  // golf+motorsports; no-game teams render below.
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
