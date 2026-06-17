import { Component, input, output } from '@angular/core';
import { Race } from '../../../core/models/game.model';

@Component({
  selector: 'app-race-stats-modal',
  templateUrl: './race-stats-modal.component.html',
  styleUrl: './race-stats-modal.component.scss',
})
export class RaceStatsModalComponent {
  race = input.required<Race>();
  close = output<void>();
}
