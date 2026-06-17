import { CricketService } from '../core/services/cricket.service';

export type MockCricketService = {
  [K in keyof CricketService]: CricketService[K] extends (...args: any[]) => any
    ? ReturnType<typeof vi.fn>
    : CricketService[K];
};

export function createMockCricketService(): MockCricketService {
  return {
    getLastMatch:  vi.fn().mockResolvedValue(null),
    getNextMatch:  vi.fn().mockResolvedValue(null),
    normalizeEvent: vi.fn(),
  } as unknown as MockCricketService;
}
