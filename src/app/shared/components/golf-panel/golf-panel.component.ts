import { Component, computed, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { GolfSeriesConfig } from '../../../core/models/team-config.model';
import { Tournament } from '../../../core/models/game.model';

@Component({
  selector: 'app-golf-panel',
  imports: [DatePipe],
  templateUrl: './golf-panel.component.html',
  styleUrl: './golf-panel.component.scss',
})
export class GolfPanelComponent {
  series = input.required<GolfSeriesConfig>();
  tournament = input<Tournament | null>(null);
  isLoading = input<boolean>(false);

  panelClick = output<Tournament>();

  isLive = computed(() => this.tournament()?.status.state === 'in');
  isPre  = computed(() => this.tournament()?.status.state === 'pre');
  isPost = computed(() => this.tournament()?.status.state === 'post');
  isClickable = computed(() => !!this.tournament() && (this.isLive() || this.isPost()));

  onPanelClick() {
    const t = this.tournament();
    if (t && this.isClickable()) this.panelClick.emit(t);
  }

  stateLabel = computed(() => {
    if (this.isLive()) return 'IN PROGRESS';
    if (this.isPre())  return 'UPCOMING TOURNAMENT';
    if (this.isPost()) return 'LAST TOURNAMENT';
    return '';
  });

  top3 = computed(() => this.tournament()?.leaderboard?.slice(0, 3) ?? []);
}
