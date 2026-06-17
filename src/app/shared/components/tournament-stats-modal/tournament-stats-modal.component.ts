import { Component, input, output } from '@angular/core';
import { Tournament } from '../../../core/models/game.model';

@Component({
  selector: 'app-tournament-stats-modal',
  templateUrl: './tournament-stats-modal.component.html',
  styleUrl: './tournament-stats-modal.component.scss',
})
export class TournamentStatsModalComponent {
  tournament = input.required<Tournament>();
  close = output<void>();
}
