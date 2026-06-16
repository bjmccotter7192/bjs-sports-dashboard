// Raw ESPN API shapes — used internally by EspnService
export interface EspnTeam {
  id: string;
  abbreviation: string;
  displayName: string;
  shortDisplayName: string;
  color: string;
  alternateColor: string;
  logo: string;
}

export interface EspnCompetitor {
  homeAway?: 'home' | 'away';
  team?: EspnTeam;
  score?: string;
  winner?: boolean;
  // motorsports fields
  order?: number;
  athlete?: { displayName: string; shortName: string };
}

export interface EspnEvent {
  id: string;
  date: string;
  name: string;
  shortName: string;
  status: {
    type: {
      state: 'pre' | 'in' | 'post';
      completed: boolean;
      description: string;
      shortDetail: string;
    };
    displayClock?: string;
    period?: number;
  };
  competitions: Array<{
    date?: string;
    type?: { id?: number; abbreviation?: string };
    competitors: EspnCompetitor[];
    venue?: { fullName: string };
    broadcasts?: Array<{ names: string[] }>;
    status?: { type?: { state?: string } };
  }>;
}

export interface EspnScoreboardResponse {
  events: EspnEvent[];
}

// Normalized team-sport game model
export interface GameTeam {
  abbreviation: string;
  displayName: string;
  logo: string;
  score: string;
  isWinner: boolean;
  primaryColor: string;
}

export interface Game {
  id: string;
  date: Date;
  homeTeam: GameTeam;
  awayTeam: GameTeam;
  status: {
    state: 'pre' | 'in' | 'post';
    description: string;
    detail: string;
    period?: number;
    clock?: string;
  };
  venue?: string;
  broadcast?: string;
}

// Normalized motorsport race model
export interface Race {
  id: string;
  name: string;
  shortName: string;
  date: Date;
  status: {
    state: 'pre' | 'in' | 'post';
    description: string;
    detail: string;
  };
  venue?: string;
  broadcast?: string;
  winner?: {
    driverName: string;
    teamName: string;
  };
}
