import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  EspnScoreboardResponse,
  EspnEvent,
  EspnCompetitor,
  Game,
  GameTeam,
  Race,
} from '../models/game.model';
import { SportLeague, MotorsportLeague } from '../models/team-config.model';

@Injectable({ providedIn: 'root' })
export class EspnService {
  private http = inject(HttpClient);
  private readonly baseUrl =
    'https://site.api.espn.com/apis/site/v2/sports';

  getScoreboard(
    sport: SportLeague | MotorsportLeague,
    date?: string
  ): Promise<EspnScoreboardResponse> {
    const params: Record<string, string> = {};
    if (date) params['dates'] = date;
    return firstValueFrom(
      this.http.get<EspnScoreboardResponse>(
        `${this.baseUrl}/${sport}/scoreboard`,
        { params }
      )
    );
  }

  /** Full team season schedule — no 100-event cap. Returns normalized EspnScoreboardResponse. */
  getTeamSchedule(sport: SportLeague, espnId: string): Promise<EspnScoreboardResponse> {
    return firstValueFrom(
      this.http.get<any>(`${this.baseUrl}/${sport}/teams/${espnId}/schedule`)
    ).then(data => ({
      events: (data.events ?? []).map((e: any) => this.normalizeTeamScheduleEvent(e)),
    }));
  }

  private normalizeTeamScheduleEvent(e: any): EspnEvent {
    const comp = e.competitions?.[0] ?? {};
    const competitors = (comp.competitors ?? []).map((c: any) => ({
      homeAway: c.homeAway as 'home' | 'away',
      score: c.score,
      winner: c.winner,
      team: c.team
        ? {
            id: c.team.id,
            abbreviation: c.team.abbreviation,
            displayName: c.team.displayName,
            shortDisplayName: c.team.shortDisplayName ?? '',
            color: c.team.color ?? '',
            alternateColor: c.team.alternateColor ?? '',
            logo: c.team.logos?.[0]?.href ?? '',
          }
        : undefined,
    }));
    const status = e.status ?? comp.status ?? {
      type: { state: 'pre', completed: false, description: 'Scheduled', shortDetail: 'Scheduled' },
    };
    return {
      id: e.id,
      date: comp.date ?? e.date,
      name: e.name,
      shortName: e.shortName,
      status,
      competitions: [{ ...comp, competitors }],
    };
  }

  /** Upcoming (pre/in) games within [startDate, endDate] from a normalized team schedule */
  getGamesInDateRange(
    scoreboard: EspnScoreboardResponse | undefined,
    startDate: Date,
    endDate: Date
  ): Game[] {
    if (!scoreboard?.events?.length) return [];
    return scoreboard.events
      .filter(e => {
        const state = e.status?.type?.state;
        if (state !== 'pre' && state !== 'in') return false;
        const d = new Date(e.date);
        return d >= startDate && d <= endDate;
      })
      .map(e => this.parseGame(e));
  }

  // ── Team sport helpers ──────────────────────────────────────────────

  /** Find a specific team's game in today/date scoreboard */
  findTeamGame(
    scoreboard: EspnScoreboardResponse | undefined,
    abbr: string
  ): Game | null {
    if (!scoreboard?.events?.length) return null;
    const event = scoreboard.events.find((e) =>
      e.competitions?.[0]?.competitors?.some(
        (c) => c.team?.abbreviation === abbr
      )
    );
    return event ? this.parseGame(event) : null;
  }

  /** Find most recent *completed* game for a team in a date-range scoreboard */
  findLastPlayedGame(
    scoreboard: EspnScoreboardResponse | undefined,
    abbr: string
  ): Game | null {
    if (!scoreboard?.events?.length) return null;
    const completed = scoreboard.events
      .filter(
        (e) =>
          e.status.type.state === 'post' &&
          e.competitions?.[0]?.competitors?.some(
            (c) => c.team?.abbreviation === abbr
          )
      )
      .sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
    return completed.length ? this.parseGame(completed[0]) : null;
  }

  /** Return all games matching any of the given abbreviations */
  getAllTeamGames(
    scoreboard: EspnScoreboardResponse | undefined,
    abbrs: string[]
  ): Game[] {
    if (!scoreboard?.events?.length) return [];
    return scoreboard.events
      .filter((e) =>
        e.competitions?.[0]?.competitors?.some((c) =>
          abbrs.includes(c.team?.abbreviation ?? '')
        )
      )
      .map((e) => this.parseGame(e));
  }

  parseGame(event: EspnEvent): Game {
    const competition = event.competitions[0];
    const home = competition.competitors.find((c) => c.homeAway === 'home')!;
    const away = competition.competitors.find((c) => c.homeAway === 'away')!;

    return {
      id: event.id,
      date: new Date(event.date),
      homeTeam: this.parseTeam(home),
      awayTeam: this.parseTeam(away),
      status: {
        state: event.status.type.state,
        description: event.status.type.description,
        detail: event.status.type.shortDetail,
        period: event.status.period,
        clock: event.status.displayClock,
      },
      venue: competition.venue?.fullName,
      broadcast: competition.broadcasts?.[0]?.names?.[0],
    };
  }

  private parseTeam(competitor: EspnCompetitor): GameTeam {
    return {
      abbreviation: competitor.team?.abbreviation ?? '',
      displayName: competitor.team?.displayName ?? '',
      logo: competitor.team?.logo ?? '',
      score: competitor.score ?? '',
      isWinner: competitor.winner ?? false,
      primaryColor: competitor.team?.color ? `#${competitor.team.color}` : '#666',
    };
  }

  // ── Motorsport helpers ──────────────────────────────────────────────

  /** Get next upcoming (or live) race only — never returns a completed race */
  findNextRace(scoreboard: EspnScoreboardResponse | undefined): Race | null {
    if (!scoreboard?.events?.length) return null;

    const live = scoreboard.events.find((e) => e.status.type.state === 'in');
    if (live) return this.parseRace(live);

    const upcoming = scoreboard.events
      .filter((e) => e.status.type.state === 'pre')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return upcoming.length ? this.parseRace(upcoming[0]) : null;
  }

  /** Get all upcoming (pre/in) races from a scoreboard */
  getAllUpcomingRaces(scoreboard: EspnScoreboardResponse | undefined): Race[] {
    if (!scoreboard?.events?.length) return [];
    return scoreboard.events
      .filter((e) => e.status.type.state === 'pre' || e.status.type.state === 'in')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((e) => this.parseRace(e));
  }

  /** Get most recent or upcoming race for a series */
  findCurrentRace(
    scoreboard: EspnScoreboardResponse | undefined
  ): Race | null {
    if (!scoreboard?.events?.length) return null;

    // Prefer a live race, then the nearest upcoming, then the most recent completed
    const live = scoreboard.events.find((e) => e.status.type.state === 'in');
    if (live) return this.parseRace(live);

    const upcoming = scoreboard.events
      .filter((e) => e.status.type.state === 'pre')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    if (upcoming.length) return this.parseRace(upcoming[0]);

    const completed = scoreboard.events
      .filter((e) => e.status.type.state === 'post')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    if (completed.length) return this.parseRace(completed[0]);

    return null;
  }

  /** Find most recent *completed* race in a date-range scoreboard */
  findLastRace(scoreboard: EspnScoreboardResponse | undefined): Race | null {
    if (!scoreboard?.events?.length) return null;
    const completed = scoreboard.events
      .filter((e) => e.status.type.state === 'post')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return completed.length ? this.parseRace(completed[0]) : null;
  }

  parseRace(event: EspnEvent): Race {
    // F1/motorsport events have multiple competitions (FP1, FP2, Qual, Race, etc.).
    // Use the main Race competition for date and winner; fall back to competitions[0].
    const raceComp =
      event.competitions.find((c) => c.type?.abbreviation === 'Race') ??
      event.competitions[0];

    const winnerRaw = raceComp?.competitors?.find(
      (c) => c.order === 1
    ) as any;

    return {
      id: event.id,
      name: event.name,
      shortName: event.shortName,
      date: new Date(raceComp?.date ?? event.date),
      status: {
        state: event.status.type.state,
        description: event.status.type.description,
        detail: event.status.type.shortDetail,
      },
      venue: raceComp?.venue?.fullName,
      broadcast: raceComp?.broadcasts?.[0]?.names?.[0],
      winner:
        event.status.type.state === 'post' && winnerRaw
          ? {
              driverName:
                winnerRaw.athlete?.displayName ??
                winnerRaw.team?.displayName ??
                'Winner',
              teamName: winnerRaw.team?.displayName ?? '',
            }
          : undefined,
    };
  }
}

export function formatDateYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}
