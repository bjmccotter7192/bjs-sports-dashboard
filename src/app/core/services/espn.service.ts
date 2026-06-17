import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  EspnScoreboardResponse,
  EspnEvent,
  EspnCompetitor,
  EspnLeaderCategory,
  Game,
  GameTeam,
  Race,
  RaceFinisher,
  Tournament,
  TournamentEntry,
  StatCategory,
  PlayerStat,
  NewsArticle,
} from '../models/game.model';
import { SportLeague, MotorsportLeague, GolfLeague } from '../models/team-config.model';

interface EspnRawNewsArticle {
  id: number;
  headline: string;
  description?: string;
  images?: Array<{ url: string }>;
  links?: { web?: { href: string } };
  published: string;
}

@Injectable({ providedIn: 'root' })
export class EspnService {
  private http = inject(HttpClient);
  private readonly baseUrl =
    'https://site.api.espn.com/apis/site/v2/sports';

  getScoreboard(
    sport: SportLeague | MotorsportLeague | GolfLeague,
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
      leaders: this.parseLeaders(competition.leaders),
    };
  }

  /** Fetch per-game stat leaders from the summary endpoint (NBA/NFL/NHL use this) */
  async fetchGameLeaders(sport: SportLeague, eventId: string): Promise<StatCategory[]> {
    const data = await firstValueFrom(
      this.http.get<any>(`${this.baseUrl}/${sport}/summary`, { params: { event: eventId } })
    );
    return this.parseSummaryLeaders(data.leaders ?? []);
  }

  /** Fetch MLB boxscore — returns top batters per team + starting pitchers */
  async fetchMlbBoxscore(eventId: string): Promise<StatCategory[]> {
    const data = await firstValueFrom(
      this.http.get<any>(`${this.baseUrl}/baseball/mlb/summary`, { params: { event: eventId } })
    );
    return this.parseMlbBoxscore(data.boxscore?.players ?? []);
  }

  private parseMlbBoxscore(teamGroups: any[]): StatCategory[] {
    const batters: PlayerStat[] = [];
    const pitchers: PlayerStat[] = [];

    for (const group of teamGroups) {
      for (const statGroup of (group.statistics ?? [])) {
        const type: string = statGroup.type ?? '';
        const keys: string[] = statGroup.keys ?? [];
        const athletes: any[] = statGroup.athletes ?? [];

        if (type === 'batting') {
          const rbIndex = keys.indexOf('RBIs');
          const hIndex = keys.indexOf('hits');
          const haIndex = keys.indexOf('hits-atBats');
          const hrIndex = keys.indexOf('homeRuns');
          const sorted = [...athletes].sort((a, b) => {
            const rbA = parseInt(a.stats?.[rbIndex] ?? '0', 10);
            const rbB = parseInt(b.stats?.[rbIndex] ?? '0', 10);
            if (rbB !== rbA) return rbB - rbA;
            return parseInt(b.stats?.[hIndex] ?? '0', 10) - parseInt(a.stats?.[hIndex] ?? '0', 10);
          });
          for (const a of sorted.slice(0, 2)) {
            const ath = a.athlete;
            const stats: string[] = a.stats ?? [];
            const ha = haIndex >= 0 ? stats[haIndex] : '';
            const rbi = rbIndex >= 0 ? stats[rbIndex] : '0';
            const hr = hrIndex >= 0 ? stats[hrIndex] : '0';
            const parts = [ha];
            if (rbi && rbi !== '0') parts.push(`${rbi} RBI`);
            if (hr && hr !== '0') parts.push(`${hr} HR`);
            batters.push({
              playerName: ath?.displayName ?? 'Unknown',
              shortName: ath?.shortName ?? '',
              headshot: (ath?.headshot as { href: string } | undefined)?.href,
              position: ath?.position?.abbreviation,
              statLine: parts.join(', '),
            });
          }
        } else if (type === 'pitching') {
          const first = athletes[0];
          if (first) {
            const ath = first.athlete;
            const stats: string[] = first.stats ?? [];
            const ipIndex = keys.indexOf('fullInnings.partInnings');
            const kIndex = keys.indexOf('strikeouts');
            const eraIndex = keys.indexOf('ERA');
            const parts = [
              ipIndex >= 0 && stats[ipIndex] ? `${stats[ipIndex]} IP` : '',
              kIndex >= 0 && stats[kIndex] ? `${stats[kIndex]} K` : '',
              eraIndex >= 0 && stats[eraIndex] ? `ERA ${stats[eraIndex]}` : '',
            ].filter(Boolean);
            pitchers.push({
              playerName: ath?.displayName ?? 'Unknown',
              shortName: ath?.shortName ?? '',
              headshot: (ath?.headshot as { href: string } | undefined)?.href,
              position: 'SP',
              statLine: parts.join(', '),
            });
          }
        }
      }
    }

    const result: StatCategory[] = [];
    if (batters.length) result.push({ label: 'Batting Leaders', players: batters });
    if (pitchers.length) result.push({ label: 'Starting Pitchers', players: pitchers });
    return result;
  }

  private parseSummaryLeaders(teamGroups: any[]): StatCategory[] {
    // Summary structure: [{ team, leaders: [{ name, displayName, leaders: [entry] }] }]
    // Merge per-team leaders into one entry per stat category.
    const cats = new Map<string, StatCategory>();
    for (const group of teamGroups) {
      for (const cat of (group.leaders ?? [])) {
        if (!cats.has(cat.name)) {
          cats.set(cat.name, { label: cat.displayName, players: [] });
        }
        const category = cats.get(cat.name)!;
        for (const entry of (cat.leaders ?? []).slice(0, 1)) {
          category.players.push(this.parseSummaryEntry(entry));
        }
      }
    }
    return Array.from(cats.values()).filter((c) => c.players.length > 0);
  }

  private parseSummaryEntry(entry: any): PlayerStat {
    const a = entry.athlete;
    const headshot =
      typeof a?.headshot === 'string'
        ? a.headshot
        : (a?.headshot as { href: string } | undefined)?.href;
    const statLine = entry.mainStat
      ? `${entry.mainStat.value} ${entry.mainStat.label}`
      : entry.displayValue;
    return {
      playerName: a?.displayName ?? 'Unknown',
      shortName: a?.shortName ?? '',
      headshot,
      position: a?.position?.abbreviation,
      statLine,
    };
  }

  private parseLeaders(raw: EspnLeaderCategory[] | undefined): StatCategory[] {
    if (!raw?.length) return [];
    return raw.map((cat) => {
      // Take top 1 per team so both teams are always represented (important for MLB)
      const seenTeams = new Set<string>();
      const players: PlayerStat[] = [];
      for (const entry of (cat.leaders ?? [])) {
        const teamId = entry.team?.id ?? `unknown-${players.length}`;
        if (!seenTeams.has(teamId)) {
          seenTeams.add(teamId);
          const a = entry.athlete;
          const headshot =
            typeof a?.headshot === 'string'
              ? a.headshot
              : (a?.headshot as { href: string } | undefined)?.href;
          players.push({
            playerName: a?.displayName ?? 'Unknown',
            shortName: a?.shortName ?? '',
            headshot,
            position: a?.position?.abbreviation,
            statLine: entry.displayValue,
          });
        }
      }
      return { label: cat.displayName, players };
    });
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

    const competitors = (raceComp?.competitors ?? []) as any[];
    const sorted = [...competitors].sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
    const winnerRaw = sorted.find((c) => c.order === 1);

    const topFinishers: RaceFinisher[] = event.status.type.state === 'post'
      ? sorted.slice(0, 5).map((c): RaceFinisher => ({
          position: c.order ?? 0,
          driverName: c.athlete?.displayName ?? c.team?.displayName ?? 'Unknown',
          shortName: c.athlete?.shortName ?? c.team?.shortDisplayName ?? '',
          flag: c.athlete?.flag?.href,
          winner: c.winner ?? c.order === 1,
        }))
      : [];

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
      topFinishers: topFinishers.length ? topFinishers : undefined,
    };
  }

  // ── Golf / PGA Tour ───────────────────────────────────────────────────
  parseTournament(event: EspnEvent): Tournament {
    const comp = event.competitions[0];
    const competitors = (comp?.competitors ?? []) as any[];
    const sorted = [...competitors].sort((a, b) => (a.order ?? 99) - (b.order ?? 99));

    const leaderboard: TournamentEntry[] = sorted.slice(0, 10).map(c => ({
      position: c.order ?? 0,
      name: c.athlete?.displayName ?? 'Unknown',
      shortName: c.athlete?.shortName ?? '',
      score: c.score ?? 'E',
    }));

    return {
      id: event.id,
      name: event.name,
      shortName: event.shortName,
      startDate: new Date(event.date.slice(0, 10) + 'T12:00:00'),
      endDate: event.endDate ? new Date(event.endDate.slice(0, 10) + 'T12:00:00') : undefined,
      status: {
        state: event.status.type.state,
        detail: event.status.type.shortDetail ?? event.status.type.description ?? '',
      },
      venue: comp?.venue?.fullName,
      leaderboard: leaderboard.length ? leaderboard : undefined,
    };
  }

  findCurrentTournament(scoreboard?: EspnScoreboardResponse): Tournament | null {
    if (!scoreboard?.events?.length) return null;
    const live = scoreboard.events.find(e => e.status.type.state === 'in');
    if (live) return this.parseTournament(live);
    const upcoming = [...scoreboard.events]
      .filter(e => e.status.type.state === 'pre')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return upcoming.length ? this.parseTournament(upcoming[0]) : null;
  }

  findLastTournament(scoreboard?: EspnScoreboardResponse): Tournament | null {
    if (!scoreboard?.events?.length) return null;
    const completed = [...scoreboard.events]
      .filter(e => e.status.type.state === 'post')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return completed.length ? this.parseTournament(completed[0]) : null;
  }

  getAllUpcomingTournaments(scoreboard?: EspnScoreboardResponse): Tournament[] {
    if (!scoreboard?.events?.length) return [];
    return [...scoreboard.events]
      .filter(e => e.status.type.state === 'pre')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(e => this.parseTournament(e));
  }

  // ── News ──────────────────────────────────────────────────────────────
  async getNews(
    sport: string,
    sourceName: string,
    sourceColor: string,
    teamId?: string,
    limit = 10
  ): Promise<NewsArticle[]> {
    const url = teamId
      ? `${this.baseUrl}/${sport}/teams/${teamId}/news`
      : `${this.baseUrl}/${sport}/news`;
    const data = await firstValueFrom(
      this.http.get<{ articles?: EspnRawNewsArticle[]; feed?: EspnRawNewsArticle[] }>(
        url, { params: { limit: limit.toString() } }
      )
    );
    return (data.articles ?? data.feed ?? []).map(a =>
      this.parseNewsArticle(a, sourceName, sourceColor)
    );
  }

  private parseNewsArticle(
    raw: EspnRawNewsArticle,
    sourceName: string,
    sourceColor: string
  ): NewsArticle {
    return {
      id: raw.id.toString(),
      headline: raw.headline,
      description: raw.description ?? '',
      image: raw.images?.[0]?.url,
      url: raw.links?.web?.href ?? '',
      published: new Date(raw.published),
      sourceName,
      sourceColor,
    };
  }
}

export function formatDateYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}
