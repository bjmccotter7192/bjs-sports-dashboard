import { Component, computed, inject, input, output, resource } from '@angular/core';
import { Game } from '../../../core/models/game.model';
import { SportLeague } from '../../../core/models/team-config.model';
import { EspnService } from '../../../core/services/espn.service';

@Component({
  selector: 'app-game-stats-modal',
  templateUrl: './game-stats-modal.component.html',
  styleUrl: './game-stats-modal.component.scss',
})
export class GameStatsModalComponent {
  private espn = inject(EspnService);

  game = input.required<Game>();
  sport = input.required<SportLeague>();
  close = output<void>();

  // MLB: boxscore has per-team batting/pitching; summary endpoint has no `leaders` key.
  // NBA/NFL/NHL: use summary `leaders` endpoint.
  private summaryLeaders = resource({
    loader: () => {
      if (this.sport() === 'baseball/mlb') {
        return this.espn.fetchMlbBoxscore(this.game().id).catch(() => null);
      }
      return this.espn.fetchGameLeaders(this.sport(), this.game().id).catch(() => null);
    },
  });

  leaders = computed(() => this.summaryLeaders.value() ?? []);

  isLoading = computed(() => this.summaryLeaders.isLoading());
}
