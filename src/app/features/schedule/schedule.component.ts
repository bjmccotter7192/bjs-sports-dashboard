import { Component, computed, inject, resource } from '@angular/core';
import { DatePipe } from '@angular/common';
import { EspnService, formatDateYMD } from '../../core/services/espn.service';
import { CricketService } from '../../core/services/cricket.service';
import { MY_TEAMS, MY_SERIES, MY_CRICKET_TEAMS } from '../../core/config/teams.config';
import { Game, Race, EspnScoreboardResponse } from '../../core/models/game.model';
import { TeamConfig, SeriesConfig, MotorsportLeague } from '../../core/models/team-config.model';

export type ScheduleItem =
  | { kind: 'game'; game: Game; team: TeamConfig }
  | { kind: 'race'; race: Race; series: SeriesConfig };

export interface ScheduleDay {
  dateLabel: string;
  dateKey: string;
  items: ScheduleItem[];
}

const EMPTY: EspnScoreboardResponse = { events: [] };

@Component({
  selector: 'app-schedule',
  imports: [DatePipe],
  templateUrl: './schedule.component.html',
  styleUrl: './schedule.component.scss',
})
export class ScheduleComponent {
  private espn = inject(EspnService);
  private cricketService = inject(CricketService);

  private rangeStart = new Date();
  private rangeEnd = (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d; })();
  private motorsportDateRange = `${formatDateYMD(this.rangeStart)}-${formatDateYMD(this.rangeEnd)}`;

  // ── Per-team schedule resources (full season, no 100-event ESPN cap) ──
  private knicks   = resource({ loader: () => this.espn.getTeamSchedule('basketball/nba', MY_TEAMS[0].espnId).catch(() => EMPTY) });
  private giants   = resource({ loader: () => this.espn.getTeamSchedule('football/nfl',   MY_TEAMS[1].espnId).catch(() => EMPTY) });
  private yankees  = resource({ loader: () => this.espn.getTeamSchedule('baseball/mlb',   MY_TEAMS[2].espnId).catch(() => EMPTY) });
  private nats     = resource({ loader: () => this.espn.getTeamSchedule('baseball/mlb',   MY_TEAMS[3].espnId).catch(() => EMPTY) });
  private rangers  = resource({ loader: () => this.espn.getTeamSchedule('hockey/nhl',     MY_TEAMS[4].espnId).catch(() => EMPTY) });

  private teamResources = [
    { team: MY_TEAMS[0], res: this.knicks  },
    { team: MY_TEAMS[1], res: this.giants  },
    { team: MY_TEAMS[2], res: this.yankees },
    { team: MY_TEAMS[3], res: this.nats    },
    { team: MY_TEAMS[4], res: this.rangers },
  ];

  // ── Motorsport resources ────────────────────────────────────────────
  private f1      = resource({ loader: () => this.espn.getScoreboard('racing/f1',             this.motorsportDateRange).catch(() => EMPTY) });
  private nascar  = resource({ loader: () => this.espn.getScoreboard('racing/nascar-premier', this.motorsportDateRange).catch(() => EMPTY) });
  private indycar = resource({ loader: () => this.espn.getScoreboard('racing/irl',            this.motorsportDateRange).catch(() => EMPTY) });

  // ── Cricket resource (TheSportsDB — next scheduled match) ───────────
  private wiCricket = resource({
    loader: () => this.cricketService.getNextMatch().catch(() => null),
  });

  isLoading = computed(() =>
    this.teamResources.some(r => r.res.isLoading()) ||
    this.f1.isLoading() || this.nascar.isLoading() || this.indycar.isLoading() ||
    this.wiCricket.isLoading()
  );

  scheduleDays = computed((): ScheduleDay[] => {
    const items: ScheduleItem[] = [];

    // ── Team games (date-filtered client-side) ──
    for (const { team, res } of this.teamResources) {
      const games = this.espn.getGamesInDateRange(res.value(), this.rangeStart, this.rangeEnd);
      for (const game of games) {
        items.push({ kind: 'game', game, team });
      }
    }

    // ── Cricket ──
    const cricketGame = this.wiCricket.value();
    if (cricketGame && cricketGame.status.state === 'pre') {
      items.push({ kind: 'game', game: cricketGame, team: MY_CRICKET_TEAMS[0] });
    }

    // ── Races ──
    const motorsportBoards: Record<MotorsportLeague, EspnScoreboardResponse | undefined> = {
      'racing/f1':             this.f1.value(),
      'racing/nascar-premier': this.nascar.value(),
      'racing/irl':            this.indycar.value(),
    };

    for (const series of MY_SERIES) {
      const races = this.espn.getAllUpcomingRaces(motorsportBoards[series.sport]);
      for (const race of races) {
        items.push({ kind: 'race', race, series });
      }
    }

    // ── Group by date ──
    const grouped = new Map<string, ScheduleItem[]>();
    for (const item of items) {
      const date = item.kind === 'game' ? item.game.date : item.race.date;
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
