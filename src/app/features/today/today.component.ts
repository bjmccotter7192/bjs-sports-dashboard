import { Component, computed, inject, resource, signal } from '@angular/core';
import { EspnService, formatDateYMD } from '../../core/services/espn.service';
import { MY_TEAMS, MY_SERIES, MY_GOLF } from '../../core/config/teams.config';
import { TeamPanelComponent } from '../../shared/components/team-panel/team-panel.component';
import { MotorsportPanelComponent } from '../../shared/components/motorsport-panel/motorsport-panel.component';
import { GolfPanelComponent } from '../../shared/components/golf-panel/golf-panel.component';
import { GameStatsModalComponent } from '../../shared/components/game-stats-modal/game-stats-modal.component';
import { RaceStatsModalComponent } from '../../shared/components/race-stats-modal/race-stats-modal.component';
import { TournamentStatsModalComponent } from '../../shared/components/tournament-stats-modal/tournament-stats-modal.component';
import { EspnScoreboardResponse, Game, Race, Tournament } from '../../core/models/game.model';
import { SportLeague, MotorsportLeague } from '../../core/models/team-config.model';

interface SelectedGame { game: Game; sport: SportLeague; }
interface SelectedRace { race: Race; sport: MotorsportLeague; }

const EMPTY: EspnScoreboardResponse = { events: [] };

@Component({
  selector: 'app-today',
  imports: [TeamPanelComponent, MotorsportPanelComponent, GolfPanelComponent, GameStatsModalComponent, RaceStatsModalComponent, TournamentStatsModalComponent],
  templateUrl: './today.component.html',
  styleUrl: './today.component.scss',
})
export class TodayComponent {
  private espn = inject(EspnService);
  readonly teams = MY_TEAMS;
  readonly series = MY_SERIES;
  readonly golf = MY_GOLF[0];

  selectedGame       = signal<SelectedGame | null>(null);
  selectedRace       = signal<SelectedRace | null>(null);
  selectedTournament = signal<Tournament | null>(null);

  readonly date = formatDateYMD(new Date());
  readonly dateLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  // ── Team sport resources ────────────────────────────────────────────
  private nba = resource({ loader: () => this.espn.getScoreboard('basketball/nba', this.date).catch(() => EMPTY) });
  private nfl = resource({ loader: () => this.espn.getScoreboard('football/nfl',   this.date).catch(() => EMPTY) });
  private mlb = resource({ loader: () => this.espn.getScoreboard('baseball/mlb',   this.date).catch(() => EMPTY) });
  private nhl = resource({ loader: () => this.espn.getScoreboard('hockey/nhl',     this.date).catch(() => EMPTY) });

  private sportResource(sport: SportLeague) {
    switch (sport) {
      case 'basketball/nba': return this.nba;
      case 'football/nfl':   return this.nfl;
      case 'baseball/mlb':   return this.mlb;
      case 'hockey/nhl':     return this.nhl;
    }
  }

  teamData = computed(() =>
    MY_TEAMS.map(team => ({
      team,
      game: this.espn.findTeamGame(this.sportResource(team.sport).value(), team.abbreviation),
      isLoading: this.sportResource(team.sport).isLoading(),
    }))
  );

  // ── Motorsport resources (60-day future window) ─────────────────────
  private futureRange = (() => {
    const end = new Date();
    end.setDate(end.getDate() + 60);
    return `${formatDateYMD(new Date())}-${formatDateYMD(end)}`;
  })();

  private f1      = resource({ loader: () => this.espn.getScoreboard('racing/f1',             this.futureRange).catch(() => EMPTY) });
  private nascar  = resource({ loader: () => this.espn.getScoreboard('racing/nascar-premier', this.futureRange).catch(() => EMPTY) });
  private indycar = resource({ loader: () => this.espn.getScoreboard('racing/irl',            this.futureRange).catch(() => EMPTY) });

  private motorsportResource(sport: MotorsportLeague) {
    switch (sport) {
      case 'racing/f1':             return this.f1;
      case 'racing/nascar-premier': return this.nascar;
      case 'racing/irl':            return this.indycar;
    }
  }

  seriesData = computed(() =>
    MY_SERIES.map(s => ({
      series: s,
      race: this.espn.findNextRace(this.motorsportResource(s.sport).value()),
      isLoading: this.motorsportResource(s.sport).isLoading(),
    }))
  );

  // ── PGA Tour resource ───────────────────────────────────────────────
  private pga = resource({
    loader: () => this.espn.getScoreboard('golf/pga', this.futureRange).catch(() => EMPTY),
  });

  pgaData = computed(() => ({
    tournament: this.espn.findCurrentTournament(this.pga.value()),
    isLoading: this.pga.isLoading(),
  }));

  // MY_TEAMS: Knicks[0], Giants[1], Yankees[2], Nationals[3], Rangers[4]
  // Row 1: Yankees, Nationals | Row 2: Knicks, Giants, Rangers
  orderedTeamPanels = computed(() => {
    const t = this.teamData();
    return [t[2], t[3], t[0], t[1], t[4]]; // Yankees, Nationals, Knicks, Giants, Rangers
  });
}
