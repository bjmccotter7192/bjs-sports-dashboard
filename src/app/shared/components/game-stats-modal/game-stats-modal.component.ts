import { Component, computed, inject, input, output, resource } from '@angular/core';
import { Game, StatCategory } from '../../../core/models/game.model';
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
      if (this.sport() === 'cricket') {
        return Promise.resolve(this.buildCricketStats());
      }
      return this.espn.fetchGameLeaders(this.sport(), this.game().id).catch(() => null);
    },
  });

  leaders = computed(() => this.summaryLeaders.value() ?? []);

  isLoading = computed(() => this.summaryLeaders.isLoading());

  private buildCricketStats(): StatCategory[] {
    const g = this.game();
    const home = g.homeTeam;
    const away = g.awayTeam;
    const categories: StatCategory[] = [];

    if (home.score || away.score) {
      categories.push({
        label: 'Scores',
        players: [
          {
            playerName: home.displayName,
            shortName: home.abbreviation,
            headshot: home.logo || undefined,
            statLine: `${home.score || '—'} runs${home.isWinner ? ' ✓' : ''}`,
          },
          {
            playerName: away.displayName,
            shortName: away.abbreviation,
            headshot: away.logo || undefined,
            statLine: `${away.score || '—'} runs${away.isWinner ? ' ✓' : ''}`,
          },
        ],
      });
    }

    const details: StatCategory['players'] = [];
    if (g.venue) {
      details.push({ playerName: 'Venue', shortName: '', statLine: g.venue });
    }
    if (g.status.description && g.status.description !== 'Cricket') {
      details.push({ playerName: 'Competition', shortName: '', statLine: g.status.description });
    }
    if (details.length) {
      categories.push({ label: 'Match Details', players: details });
    }

    return categories;
  }
}
