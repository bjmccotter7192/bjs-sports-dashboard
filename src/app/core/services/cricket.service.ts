import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Game, GameTeam } from '../models/game.model';

interface TheSportsDbEvent {
  idEvent: string;
  strEvent: string;
  strHomeTeam: string;
  strAwayTeam: string;
  intHomeScore: number | null;
  intAwayScore: number | null;
  strStatus: string;
  dateEvent: string;
  strTime: string | null;
  strLeague: string;
  strVenue: string | null;
  strCity: string | null;
  strCountry: string | null;
  strHomeTeamBadge: string;
  strAwayTeamBadge: string;
}

const WI_TEAM_ID = '137151';
const BASE_URL = 'https://www.thesportsdb.com/api/v1/json/3';

// Status codes TheSportsDB uses for completed cricket matches
const FINAL_STATUSES = new Set(['FT', 'AOT', 'AET', 'AP', 'PPD']);

@Injectable({ providedIn: 'root' })
export class CricketService {
  private http = inject(HttpClient);

  /** Most recently completed WI match. */
  async getLastMatch(): Promise<Game | null> {
    const data = await firstValueFrom(
      this.http.get<{ results: TheSportsDbEvent[] | null }>(
        `${BASE_URL}/eventslast.php`, { params: { id: WI_TEAM_ID } }
      )
    );
    const events = data.results ?? [];
    return events.length ? this.normalizeEvent(events[0]) : null;
  }

  /** Next scheduled WI match (null when off-season / not yet in DB). */
  async getNextMatch(): Promise<Game | null> {
    const data = await firstValueFrom(
      this.http.get<{ events: TheSportsDbEvent[] | null }>(
        `${BASE_URL}/eventsnext.php`, { params: { id: WI_TEAM_ID } }
      )
    );
    const events = data.events ?? [];
    return events.length ? this.normalizeEvent(events[0]) : null;
  }

  normalizeEvent(e: TheSportsDbEvent): Game {
    const isPost = FINAL_STATUSES.has(e.strStatus);
    const isLive = !isPost && e.strStatus !== 'NS' && !!e.strStatus && e.intHomeScore !== null;
    const state: 'pre' | 'in' | 'post' = isLive ? 'in' : isPost ? 'post' : 'pre';

    const homeRuns = e.intHomeScore ?? 0;
    const awayRuns = e.intAwayScore ?? 0;

    const timeStr = e.strTime ?? '00:00:00';
    const date = new Date(`${e.dateEvent}T${timeStr}Z`);

    const venue = e.strVenue
      ?? (e.strCity
        ? `${e.strCity}${e.strCountry ? ', ' + e.strCountry : ''}`
        : undefined);

    return {
      id: e.idEvent,
      date,
      homeTeam: this.makeTeam(e.strHomeTeam, e.intHomeScore, e.strHomeTeamBadge, isPost && homeRuns > awayRuns),
      awayTeam: this.makeTeam(e.strAwayTeam, e.intAwayScore, e.strAwayTeamBadge, isPost && awayRuns > homeRuns),
      status: {
        state,
        description: e.strLeague || 'Cricket',
        detail: isPost ? 'Final' : isLive ? 'In Progress' : (e.strLeague || 'Scheduled'),
      },
      venue,
    };
  }

  private makeTeam(name: string, score: number | null, badge: string, isWinner: boolean): GameTeam {
    return {
      abbreviation: abbreviate(name),
      displayName: name,
      logo: badge || '',
      score: score?.toString() ?? '',
      isWinner,
      primaryColor: /west indies/i.test(name) ? '#7B0041' : '#444444',
    };
  }
}

function abbreviate(teamName: string): string {
  const stripped = teamName
    .replace(/ Cricket$/i, '')
    .replace(/ Men$/i, '')
    .replace(/ Women$/i, '')
    .trim();
  const words = stripped.split(/\s+/);
  if (words.length === 1) return stripped.slice(0, 3).toUpperCase();
  if (words.length === 2) return (words[0][0] + words[1][0]).toUpperCase();
  return words.slice(0, 3).map(w => w[0]).join('').toUpperCase();
}
