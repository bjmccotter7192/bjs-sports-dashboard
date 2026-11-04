import { Component, computed, inject, input, resource } from '@angular/core';
import { EspnService } from '../../../core/services/espn.service';
import { DashboardConfigService } from '../../../core/services/dashboard-config.service';
import { STANDINGS_FORMATS } from '../../../core/config/standings.config';
import { SportLeague } from '../../../core/models/team-config.model';

/**
 * Standings tables for one team league. Groups holding the user's teams come first,
 * and those teams' rows are starred.
 */
@Component({
  selector: 'app-league-standings',
  templateUrl: './league-standings.component.html',
  styleUrl: './league-standings.component.scss',
})
export class LeagueStandingsComponent {
  private espn = inject(EspnService);
  private config = inject(DashboardConfigService).config;

  readonly sport = input.required<SportLeague>();
  readonly label = input.required<string>();

  readonly columns = computed(() => STANDINGS_FORMATS[this.sport()].columns);

  readonly standings = resource({
    params: () => ({ sport: this.sport() }),
    loader: ({ params }) => this.espn.getStandings(params.sport),
  });

  private starredIds = computed(() => {
    const sport = this.sport();
    return new Set(this.config().teams.filter(t => t.sport === sport).map(t => t.espnId));
  });

  readonly groups = computed(() => {
    if (!this.standings.hasValue()) return [];
    const starred = this.starredIds();
    return this.standings.value()
      .map(group => ({
        name: group.name,
        rows: group.rows.map(row => ({ row, starred: starred.has(row.teamId) })),
      }))
      .map(group => ({ ...group, hasStarred: group.rows.some(r => r.starred) }))
      // Stable sort: the user's groups first, otherwise ESPN's order
      .sort((a, b) => Number(b.hasStarred) - Number(a.hasStarred));
  });
}
