import { Component, computed, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TeamConfig, SportLeague } from '../../../core/models/team-config.model';
import { Game } from '../../../core/models/game.model';

const SPORT_LABELS: Record<SportLeague, string> = {
  'basketball/nba': 'NBA',
  'football/nfl': 'NFL',
  'baseball/mlb': 'MLB',
  'hockey/nhl': 'NHL',
};

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

  sportLabel = computed(() => SPORT_LABELS[this.team().sport]);

  periodLabel = computed(() => {
    switch (this.team().sport) {
      case 'basketball/nba':
      case 'football/nfl':
        return 'Q';
      case 'hockey/nhl':
        return 'P';
      default:
        return '';
    }
  });

  hasClock = computed(() => this.team().sport !== 'baseball/mlb');

  myTeamSide = computed(() => {
    const g = this.game();
    if (!g) return null;
    return g.homeTeam.abbreviation === this.team().abbreviation ? 'home' : 'away';
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

  isWin = computed(
    () => this.game()?.status.state === 'post' && (this.myTeam()?.isWinner ?? false)
  );
  isLoss = computed(
    () => this.game()?.status.state === 'post' && !(this.myTeam()?.isWinner ?? true)
  );
  isLive = computed(() => this.game()?.status.state === 'in');
  isPre = computed(() => this.game()?.status.state === 'pre');
  isPost = computed(() => this.game()?.status.state === 'post');
  showScore = computed(() => !this.isPre());
}
