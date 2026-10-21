import { Component, computed, input, output } from '@angular/core';
import { Game, GameTeam } from '../../../core/models/game.model';
import { SportLeague } from '../../../core/models/team-config.model';
import { leagueInfo } from '../../../core/config/leagues.config';
import { ZonedTimePipe } from '../../pipes/zoned-time.pipe';

/** Compact two-row scoreboard card for any league game (league pages). */
@Component({
  selector: 'app-game-card',
  imports: [ZonedTimePipe],
  templateUrl: './game-card.component.html',
  styleUrl: './game-card.component.scss',
})
export class GameCardComponent {
  game = input.required<Game>();
  sport = input.required<SportLeague>();
  zone = input.required<string>();
  /** True when one of the user's teams is playing */
  starred = input(false);

  cardClick = output<Game>();

  isPre = computed(() => this.game().status.state === 'pre');
  isLive = computed(() => this.game().status.state === 'in');
  isPost = computed(() => this.game().status.state === 'post');
  isClickable = computed(() => !this.isPre());

  /** Away team first, matching how scoreboards list matchups */
  rows = computed((): GameTeam[] => [this.game().awayTeam, this.game().homeTeam]);

  liveStatus = computed(() => {
    const { period, clock, detail } = this.game().status;
    const label = leagueInfo(this.sport())?.periodLabel;
    return label && period && clock ? `${period}${label} ${clock}` : detail;
  });

  /** Dim the losing side of a finished game; draws (no winner) dim neither. */
  isLoser(team: GameTeam) {
    const { homeTeam, awayTeam } = this.game();
    return this.isPost() && !team.isWinner && (homeTeam.isWinner || awayTeam.isWinner);
  }

  onClick() {
    if (this.isClickable()) this.cardClick.emit(this.game());
  }
}
