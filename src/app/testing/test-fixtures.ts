/**
 * Shared test fixture factories.
 *
 * Each factory returns a fully-typed object with sensible defaults so tests
 * only have to override the fields that matter for the specific scenario.
 */
import { EspnEvent, EspnScoreboardResponse, Game, GameTeam, Race } from '../core/models/game.model';

// ── Low-level ESPN API shape fixtures ──────────────────────────────────────

/** Build a minimal EspnEvent for a team-sport game. */
export function makeEspnTeamEvent(opts: {
  id?: string;
  date?: string;
  state?: 'pre' | 'in' | 'post';
  homeAbbr?: string;
  awayAbbr?: string;
  homeScore?: string;
  awayScore?: string;
  homeWinner?: boolean;
  venue?: string;
  broadcast?: string;
} = {}): EspnEvent {
  const state = opts.state ?? 'pre';
  return {
    id: opts.id ?? 'event-1',
    date: opts.date ?? '2026-06-20T23:05Z',
    name: `${opts.awayAbbr ?? 'AWY'} at ${opts.homeAbbr ?? 'HME'}`,
    shortName: `${opts.awayAbbr ?? 'AWY'} @ ${opts.homeAbbr ?? 'HME'}`,
    status: {
      type: {
        state,
        completed: state === 'post',
        description: state === 'post' ? 'Final' : 'Scheduled',
        shortDetail: state === 'post' ? 'Final' : '6/20 - 7:05 PM EDT',
      },
      displayClock: '0:00',
      period: 0,
    },
    competitions: [
      {
        competitors: [
          {
            homeAway: 'home',
            team: {
              id: '10',
              abbreviation: opts.homeAbbr ?? 'HME',
              displayName: `${opts.homeAbbr ?? 'HME'} Team`,
              shortDisplayName: opts.homeAbbr ?? 'HME',
              color: '003087',
              alternateColor: 'E4E4E4',
              logo: `https://a.espncdn.com/i/teamlogos/mlb/500/${(opts.homeAbbr ?? 'hme').toLowerCase()}.png`,
            },
            score: opts.homeScore ?? '',
            winner: opts.homeWinner,
          },
          {
            homeAway: 'away',
            team: {
              id: '4',
              abbreviation: opts.awayAbbr ?? 'AWY',
              displayName: `${opts.awayAbbr ?? 'AWY'} Team`,
              shortDisplayName: opts.awayAbbr ?? 'AWY',
              color: '27251F',
              alternateColor: 'C4CED4',
              logo: `https://a.espncdn.com/i/teamlogos/mlb/500/${(opts.awayAbbr ?? 'awy').toLowerCase()}.png`,
            },
            score: opts.awayScore ?? '',
            winner: opts.homeWinner === undefined ? undefined : !opts.homeWinner,
          },
        ],
        venue: opts.venue ? { fullName: opts.venue } : undefined,
        broadcasts: opts.broadcast ? [{ names: [opts.broadcast] }] : undefined,
      },
    ],
  };
}

/** Build a minimal EspnEvent for a motorsport race with multiple competitions. */
export function makeEspnRaceEvent(opts: {
  id?: string;
  weekendStartDate?: string;
  raceDate?: string;
  state?: 'pre' | 'in' | 'post';
  name?: string;
  winnerName?: string;
  venue?: string;
} = {}): EspnEvent {
  const state = opts.state ?? 'pre';
  return {
    id: opts.id ?? 'race-1',
    date: opts.weekendStartDate ?? '2026-06-26T11:30Z',
    name: opts.name ?? 'Lenovo Austrian Grand Prix',
    shortName: opts.name ? opts.name.split(' ').slice(-2).join(' ') : 'Austrian GP',
    status: {
      type: {
        state,
        completed: state === 'post',
        description: state === 'post' ? 'Final' : 'Scheduled',
        shortDetail: state === 'post' ? 'Final' : 'Scheduled',
      },
    },
    competitions: [
      // FP1 (Friday) — should NOT be used for winner/date
      {
        date: opts.weekendStartDate ?? '2026-06-26T11:30Z',
        type: { abbreviation: 'FP1' },
        competitors: [{ order: 1, athlete: { displayName: 'Wrong Driver FP1', shortName: 'W. Driver' } }],
      },
      // Qualifying (Saturday) — should NOT be used for winner/date
      {
        date: '2026-06-27T14:00Z',
        type: { abbreviation: 'Qual' },
        competitors: [{ order: 1, athlete: { displayName: 'Wrong Driver Qual', shortName: 'W. Qual' } }],
      },
      // Race (Sunday) — the correct competition
      {
        date: opts.raceDate ?? '2026-06-28T13:00Z',
        type: { abbreviation: 'Race' },
        competitors: state === 'post'
          ? [{ order: 1, athlete: { displayName: opts.winnerName ?? 'Lewis Hamilton', shortName: 'L. Hamilton' } }]
          : [],
        venue: opts.venue ? { fullName: opts.venue } : undefined,
      },
    ],
  };
}

// ── Normalized model fixtures ───────────────────────────────────────────────

const defaultHomeTeam: GameTeam = {
  abbreviation: 'NYY',
  displayName: 'New York Yankees',
  logo: 'https://a.espncdn.com/i/teamlogos/mlb/500/nyy.png',
  score: '5',
  isWinner: true,
  primaryColor: '#003087',
};

const defaultAwayTeam: GameTeam = {
  abbreviation: 'CHW',
  displayName: 'Chicago White Sox',
  logo: 'https://a.espncdn.com/i/teamlogos/mlb/500/chw.png',
  score: '2',
  isWinner: false,
  primaryColor: '#27251F',
};

/** Build a normalized Game. */
export function makeGame(overrides: Partial<Game> = {}): Game {
  return {
    id: 'game-1',
    date: new Date('2026-06-16T23:05Z'),
    homeTeam: defaultHomeTeam,
    awayTeam: defaultAwayTeam,
    status: { state: 'post', description: 'Final', detail: 'Final' },
    venue: 'Yankee Stadium',
    broadcast: 'ESPN',
    ...overrides,
  };
}

/** Build a normalized Race. */
export function makeRace(overrides: Partial<Race> = {}): Race {
  return {
    id: 'race-1',
    name: 'Lenovo Austrian Grand Prix',
    shortName: 'Austrian GP',
    date: new Date('2026-06-28T13:00Z'),
    status: { state: 'pre', description: 'Scheduled', detail: 'Scheduled' },
    venue: 'Red Bull Ring',
    broadcast: 'Apple TV',
    ...overrides,
  };
}

/** Minimal empty scoreboard. */
export const emptyScoreboard: EspnScoreboardResponse = { events: [] };
