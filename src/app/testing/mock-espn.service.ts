/**
 * Factory that creates a Vitest-mocked EspnService.
 *
 * Usage in a component test:
 *
 *   const mockEspn = createMockEspnService();
 *   TestBed.configureTestingModule({
 *     providers: [{ provide: EspnService, useValue: mockEspn }],
 *   });
 *
 * Then override individual methods per test:
 *   mockEspn.findTeamGame.mockReturnValue(makeGame());
 */
import { EspnScoreboardResponse, Game, Race } from '../core/models/game.model';
import { EspnService } from '../core/services/espn.service';

export type MockEspnService = {
  [K in keyof EspnService]: EspnService[K] extends (...args: any[]) => any
    ? ReturnType<typeof vi.fn>
    : EspnService[K];
};

export function createMockEspnService(): MockEspnService {
  return {
    // ── Async fetchers — return resolved Promises so resource() settles immediately ──
    getScoreboard: vi.fn().mockResolvedValue({ events: [] } satisfies EspnScoreboardResponse),
    getTeamSchedule: vi.fn().mockResolvedValue({ events: [] } satisfies EspnScoreboardResponse),

    // ── Synchronous helpers — return null / empty by default ──
    findTeamGame:       vi.fn().mockReturnValue(null satisfies Game | null),
    findLastPlayedGame: vi.fn().mockReturnValue(null satisfies Game | null),
    getAllTeamGames:     vi.fn().mockReturnValue([] satisfies Game[]),
    getGamesInDateRange: vi.fn().mockReturnValue([] satisfies Game[]),

    findNextRace:       vi.fn().mockReturnValue(null satisfies Race | null),
    findLastRace:       vi.fn().mockReturnValue(null satisfies Race | null),
    findCurrentRace:    vi.fn().mockReturnValue(null satisfies Race | null),
    getAllUpcomingRaces: vi.fn().mockReturnValue([] satisfies Race[]),

    // ── Parsers (public for testing; mocked to keep component tests isolated) ──
    parseGame: vi.fn(),
    parseRace: vi.fn(),
  } as unknown as MockEspnService;
}
