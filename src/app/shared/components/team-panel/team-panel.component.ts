import { Component, computed, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TeamConfig, SportLeague } from '../../../core/models/team-config.model';
import { Game } from '../../../core/models/game.model';
import { leagueInfo, leagueLabel } from '../../../core/config/leagues.config';

@Component({
  selector: 'app-team-panel',
  imports: [DatePipe],
  templateUrl: './team-panel.component.html',
  styleUrl: './team-panel.component.scss',
})
export class TeamPanelComponent {
  team = input.required<TeamConfig>();
  game = input<Game | null>(null);
  isLoading = input<boolean>(false);

  panelClick = output<{ game: Game; sport: SportLeague }>();

  onPanelClick() {
    const g = this.game();
    if (g && (this.isLive() || this.isPost())) {
      this.panelClick.emit({ game: g, sport: this.team().sport });
    }
  }

  isClickable = computed(() => !!this.game() && (this.isLive() || this.isPost()));

  sportLabel = computed(() => leagueLabel(this.team().sport));

  periodLabel = computed(() => leagueInfo(this.team().sport)?.periodLabel ?? '');

  // Leagues without a period label (MLB innings, soccer minutes) show ESPN's status text instead
  hasClock = computed(() => !!this.periodLabel());

  myTeamSide = computed(() => {
    const g = this.game();
    if (!g) return null;
    return g.homeTeam.id === this.team().espnId ? 'home' : 'away';
  });

  myTeam = computed(() => {
    const g = this.game();
    const side = this.myTeamSide();
    if (!g || !side) return null;
    return side === 'home' ? g.homeTeam : g.awayTeam;
  });

  opponent = computed(() => {
    const g = this.game();
    const side = this.myTeamSide();
    if (!g || !side) return null;
    return side === 'home' ? g.awayTeam : g.homeTeam;
  });

  // Soccer draws: ESPN marks neither side the winner
  isDraw = computed(() => {
    const g = this.game();
    return g?.status.state === 'post' && !g.homeTeam.isWinner && !g.awayTeam.isWinner
      && g.homeTeam.score !== '' && g.homeTeam.score === g.awayTeam.score;
  });
  isWin = computed(
    () => this.game()?.status.state === 'post' && (this.myTeam()?.isWinner ?? false)
  );
  isLoss = computed(
    () => this.game()?.status.state === 'post' && !this.isDraw() && !(this.myTeam()?.isWinner ?? true)
  );
  isLive = computed(() => this.game()?.status.state === 'in');
  isPre = computed(() => this.game()?.status.state === 'pre');
  isPost = computed(() => this.game()?.status.state === 'post');
  showScore = computed(() => !this.isPre());
}
