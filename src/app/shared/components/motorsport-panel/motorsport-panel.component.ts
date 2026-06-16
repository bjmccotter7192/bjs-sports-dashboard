import { Component, computed, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { SeriesConfig } from '../../../core/models/team-config.model';
import { Race } from '../../../core/models/game.model';

@Component({
  selector: 'app-motorsport-panel',
  imports: [DatePipe],
  templateUrl: './motorsport-panel.component.html',
  styleUrl: './motorsport-panel.component.scss',
})
export class MotorsportPanelComponent {
  series = input.required<SeriesConfig>();
  race = input<Race | null>(null);
  isLoading = input<boolean>(false);

  isLive = computed(() => this.race()?.status.state === 'in');
  isPre = computed(() => this.race()?.status.state === 'pre');
  isPost = computed(() => this.race()?.status.state === 'post');

  seriesLabel = computed(() => {
    const sport = this.series().sport;
    if (sport === 'racing/f1') return 'F1';
    if (sport === 'racing/nascar-premier') return 'NASCAR';
    if (sport === 'racing/irl') return 'IndyCar';
    return 'Racing';
  });

  stateLabel = computed(() => {
    if (this.isLive()) return '🔴 LIVE';
    if (this.isPre()) return 'NEXT RACE';
    if (this.isPost()) return 'LAST RACE';
    return '';
  });
}
