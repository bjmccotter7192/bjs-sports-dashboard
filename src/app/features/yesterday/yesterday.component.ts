import { Component, computed, inject, resource, signal } from '@angular/core';
import { EspnService, formatDateYMD } from '../../core/services/espn.service';
import { MY_TEAMS, MY_SERIES } from '../../core/config/teams.config';
import { TeamPanelComponent } from '../../shared/components/team-panel/team-panel.component';
import { MotorsportPanelComponent } from '../../shared/components/motorsport-panel/motorsport-panel.component';
import { GameStatsModalComponent } from '../../shared/components/game-stats-modal/game-stats-modal.component';
import { RaceStatsModalComponent } from '../../shared/components/race-stats-modal/race-stats-modal.component';
import { EspnScoreboardResponse, Game, Race } from '../../core/models/game.model';
import { SportLeague, MotorsportLeague } from '../../core/models/team-config.model';

interface SelectedGame { game: Game; sport: SportLeague; }
interface SelectedRace { race: Race; sport: MotorsportLeague; }

const EMPTY: EspnScoreboardResponse = { events: [] };

@Component({
  selector: 'app-yesterday',
  imports: [TeamPanelComponent, MotorsportPanelComponent, GameStatsModalComponent, RaceStatsModalComponent],
  templateUrl: './yesterday.component.html',
  styleUrl: './yesterday.component.scss',
})
export class YesterdayComponent {
  private espn = inject(EspnService);

  selectedGame = signal<SelectedGame | null>(null);
  selectedRace = signal<SelectedRace | null>(null);

  private windowEnd = new Date();
  private windowStart = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 14);
    return d;
  })();
  // MLB scoreboard caps at 100 events (~15 games/day = ~6 days max).
  // Use a 6-day window so yesterday's games are always included.
  private mlbWindowStart = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d;
  })();

  readonly dateRange = `${formatDateYMD(this.windowStart)}-${formatDateYMD(this.windowEnd)}`;
  readonly mlbDateRange = `${formatDateYMD(this.mlbWindowStart)}-${formatDateYMD(this.windowEnd)}`;

  // ── Team sport resources (14-day window) ───────────────────────────
  private nba = resource({
    loader: () => this.espn.getScoreboard('basketball/nba', this.dateRange).catch(() => EMPTY),
  });
  private nfl = resource({
    loader: () => this.espn.getScoreboard('football/nfl', this.dateRange).catch(() => EMPTY),
  });
  private mlb = resource({
    loader: () => this.espn.getScoreboard('baseball/mlb', this.mlbDateRange).catch(() => EMPTY),
  });
  private nhl = resource({
    loader: () => this.espn.getScoreboard('hockey/nhl', this.dateRange).catch(() => EMPTY),
  });

  private sportResource(sport: SportLeague) {
    switch (sport) {
      case 'basketball/nba': return this.nba;
      case 'football/nfl':   return this.nfl;
      case 'baseball/mlb':   return this.mlb;
      case 'hockey/nhl':     return this.nhl;
    }
  }

  teamData = computed(() =>
    MY_TEAMS.map((team) => {
      const res = this.sportResource(team.sport);
      return {
        team,
        game: this.espn.findLastPlayedGame(res.value(), team.abbreviation),
        isLoading: res.isLoading(),
      };
    })
  );

  // ── Motorsport resources (14-day window) ───────────────────────────
  private f1 = resource({
    loader: () => this.espn.getScoreboard('racing/f1', this.dateRange).catch(() => EMPTY),
  });
  private nascar = resource({
    loader: () => this.espn.getScoreboard('racing/nascar-premier', this.dateRange).catch(() => EMPTY),
  });
  private indycar = resource({
    loader: () => this.espn.getScoreboard('racing/irl', this.dateRange).catch(() => EMPTY),
  });

  private motorsportResource(sport: MotorsportLeague) {
    switch (sport) {
      case 'racing/f1':             return this.f1;
      case 'racing/nascar-premier': return this.nascar;
      case 'racing/irl':            return this.indycar;
    }
  }

  seriesData = computed(() =>
    MY_SERIES.map((s) => {
      const res = this.motorsportResource(s.sport);
      return {
        series: s,
        race: this.espn.findLastRace(res.value()),
        isLoading: res.isLoading(),
      };
    })
  );
}
