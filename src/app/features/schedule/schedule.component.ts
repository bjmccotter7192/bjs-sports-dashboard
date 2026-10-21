import { Component, computed, inject, resource } from '@angular/core';
import { DatePipe } from '@angular/common';
import { EmptyConfigComponent } from '../../shared/components/empty-config/empty-config.component';
import { isEmptyConfig } from '../../core/config/config-validation';
import { EspnService, formatDateYMD } from '../../core/services/espn.service';
import { DashboardConfigService } from '../../core/services/dashboard-config.service';
import { fetchAll } from '../../core/utils/fetch-all';
import { Game, Race, Tournament, EspnScoreboardResponse } from '../../core/models/game.model';
import { TeamConfig, SeriesConfig, GolfSeriesConfig } from '../../core/models/team-config.model';

export type ScheduleItem =
  | { kind: 'game';       game: Game;             team: TeamConfig }
  | { kind: 'race';       race: Race;             series: SeriesConfig }
  | { kind: 'tournament'; tournament: Tournament; series: GolfSeriesConfig };

export interface ScheduleDay {
  dateLabel: string;
  dateKey: string;
  items: ScheduleItem[];
}

const EMPTY: EspnScoreboardResponse = { events: [] };

@Component({
  selector: 'app-schedule',
  imports: [DatePipe, EmptyConfigComponent],
  templateUrl: './schedule.component.html',
  styleUrl: './schedule.component.scss',
})
export class ScheduleComponent {
  private espn = inject(EspnService);
  private config = inject(DashboardConfigService).config;
  readonly isEmpty = computed(() => isEmptyConfig(this.config()));

  private rangeStart = new Date();
  private rangeEnd   = (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d; })();
  private motorsportDateRange = `${formatDateYMD(this.rangeStart)}-${formatDateYMD(this.rangeEnd)}`;

  // ── Per-team schedule resources (full season, no 100-event ESPN cap) ──
  private teamSchedules = resource({
    params: () => this.config().teams,
    loader: ({ params }) => fetchAll(params, team => this.espn.getTeamSchedule(team.sport, team.espnId), EMPTY),
  });

  // ── Motorsport + golf resources ────────────────────────────────────
  private seriesBoards = resource({
    params: () => this.config().series.map(s => s.sport),
    loader: ({ params }) => fetchAll(params, sport => this.espn.getScoreboard(sport, this.motorsportDateRange), EMPTY),
  });

  private golfBoards = resource({
    params: () => this.config().golf.map(g => g.sport),
    loader: ({ params }) => fetchAll(params, sport => this.espn.getScoreboard(sport, this.motorsportDateRange), EMPTY),
  });

  isLoading = computed(() =>
    this.teamSchedules.isLoading() || this.seriesBoards.isLoading() || this.golfBoards.isLoading()
  );

  scheduleDays = computed((): ScheduleDay[] => {
    const items: ScheduleItem[] = [];

    const { teams, series, golf } = this.config();

    // ── Team games (date-filtered client-side) ──
    const schedules = this.teamSchedules.value();
    for (const team of teams) {
      const games = this.espn.getGamesInDateRange(schedules?.get(team), this.rangeStart, this.rangeEnd);
      for (const game of games) {
        items.push({ kind: 'game', game, team });
      }
    }

    // ── Races ──
    const seriesBoards = this.seriesBoards.value();
    for (const s of series) {
      for (const race of this.espn.getAllUpcomingRaces(seriesBoards?.get(s.sport))) {
        items.push({ kind: 'race', race, series: s });
      }
    }

    // ── Golf tournaments ──
    const golfBoards = this.golfBoards.value();
    for (const g of golf) {
      for (const tournament of this.espn.getAllUpcomingTournaments(golfBoards?.get(g.sport))) {
        items.push({ kind: 'tournament', tournament, series: g });
      }
    }

    // ── Group by date ──
    const grouped = new Map<string, ScheduleItem[]>();
    for (const item of items) {
      const date = item.kind === 'game' ? item.game.date
        : item.kind === 'race' ? item.race.date
        : item.tournament.startDate;
      const key = formatDateYMD(date);
      grouped.set(key, [...(grouped.get(key) ?? []), item]);
    }

    return Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, dayItems]) => {
        const d = new Date(
          parseInt(key.slice(0, 4)),
          parseInt(key.slice(4, 6)) - 1,
          parseInt(key.slice(6, 8))
        );
        return {
          dateKey: key,
          dateLabel: d.toLocaleDateString('en-US', {
            weekday: 'long', month: 'long', day: 'numeric',
          }),
          items: dayItems,
        };
      });
  });
}
