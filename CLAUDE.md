# CLAUDE.md — BJ's Sports Dashboard

Project context for AI assistants picking up this codebase.

---

## What This Is

Personal sports dashboard. Fetches live data from ESPN's unofficial public API (no key required). Dark-themed Angular SPA with four views: Today's games, Last Played, Schedule, and News. Nine panels: NY Knicks, NY Giants, NY Yankees, Washington Nationals, NY Rangers, F1, NASCAR Cup, IndyCar, PGA Tour.

---

## Commands

```bash
npm start                                         # dev server → localhost:4200
ng test --watch=false                             # run all tests once
ng test --configuration=coverage --watch=false    # tests + coverage report
ng build                                          # production build → dist/
```

> **Coder pod (k8s):** dev server is `localhost` inside the pod. User must expose port 4200 via VS Code Ports panel to reach it in a browser.

---

## Architecture

- **Angular 21.2** — standalone components, no NgModules
- **Zoneless** — `provideZonelessChangeDetection()` in `app.config.ts`. No zone.js. Every test `providers` array must include `provideZonelessChangeDetection()` or tests will fail.
- **`resource()` API** — async data fetching. Used in all four feature components. Returns `ResourceRef` with `.value()`, `.isLoading()`, `.error()` signals.
- **Signal inputs** — `input.required<T>()` on panel components. Set in tests via `fixture.componentRef.setInput('name', value)`.
- **Lazy routes** — all four views are lazy-loaded via `loadComponent` in `app.routes.ts`.

---

## Key Files

| File | Purpose |
|------|---------|
| `src/app/core/config/teams.config.ts` | `DEFAULT_CONFIG` — BJ's teams/series/golf. Array order is display order. |
| `src/app/core/config/leagues.config.ts` | `LEAGUES` registry — every supported league slug, its kind, label, and `hasNews`. Order is News filter order. |
| `src/app/core/services/dashboard-config.service.ts` | `DashboardConfigService.config` signal — what every view reads. Components never import `DEFAULT_CONFIG` directly. |
| `src/app/core/utils/fetch-all.ts` | `fetchAll(keys, fetch, fallback)` — parallel fetch per unique key into a `Map`; per-key failures fall back. |
| `src/app/core/services/espn.service.ts` | All ESPN API calls + parsing. The only file that touches HTTP. |
| `src/app/core/models/game.model.ts` | Raw ESPN shapes (`EspnEvent`) and normalized app models (`Game`, `Race`, `Tournament`, `TournamentEntry`) |
| `src/app/core/models/team-config.model.ts` | `DashboardConfig` / `TeamConfig` / `SeriesConfig` / `GolfSeriesConfig` / `League` (= `SportLeague` \| `MotorsportLeague` \| `GolfLeague`) types |
| `src/app/shared/components/team-panel/` | Card for a single team-sport game. Inputs: `team`, `game`, `isLoading`. |
| `src/app/shared/components/motorsport-panel/` | Card for a single race series. Inputs: `series`, `race`, `isLoading`. |
| `src/app/shared/components/golf-panel/` | Card for PGA Tour. Inputs: `series`, `tournament`, `isLoading`. Shows top-3 leaderboard inline. |
| `src/app/shared/components/tournament-stats-modal/` | Modal showing full top-10 leaderboard; under-par scores highlighted green. |
| `src/app/features/today/` | Today's games + next race/tournament. Active panels float above golf+motorsports; no-game panels sink below. |
| `src/app/features/yesterday/` | Last Played — most recent completed game per team in last 14 days. Same dynamic ordering. |
| `src/app/features/schedule/` | Next 30 days, grouped by date |
| `src/app/features/news/` | News feed, one source per configured league with `hasNews` (NASCAR has none). Filterable by league. |
| `src/app/testing/test-fixtures.ts` | Fixture factories: `makeGame()`, `makeRace()`, `makeEspnTeamEvent()`, `makeEspnRaceEvent()` |
| `src/app/testing/mock-espn.service.ts` | `createMockEspnService()` — Vitest mock for component tests |
| `src/app/testing/dashboard-config.ts` | `provideDashboardConfig()`, `makeConfig()`, `makeTeamConfig()` — override the config in component tests |

---

## ESPN API Quirks — Read Before Touching the Service

### Sport slugs (verified working)
```
basketball/nba     football/nfl     baseball/mlb     hockey/nhl
racing/f1          racing/nascar-premier             racing/irl
golf/pga
```
`nascar-sprint-cup`, `nascar-cup`, `indycar` are all **wrong** and return 400.

### NASCAR news endpoint returns empty
`racing/nascar-premier/news` responds HTTP 200 but with `articles: []`. ESPN's CORS-accessible news endpoint simply doesn't populate NASCAR articles. The `now.core.api.espn.com` domain has NASCAR content but lacks `Access-Control-Allow-Origin`, so it can't be used in a client-side app without a proxy. NASCAR is excluded from the News view entirely.

### MLB 100-event cap
The league scoreboard caps at 100 events. MLB plays ~15 games/day, so 100 events ≈ 7 days. The **Schedule** and **Last Played** views use `getTeamSchedule(sport, espnId)` (full-season per-team endpoint) and filter client-side. The **Today view** still uses the scoreboard because it only needs a single day.

### Team-sport scoreboards reject date ranges
As of Oct 2026, `basketball/nba`, `football/nfl`, `baseball/mlb` and `hockey/nhl` scoreboards return **HTTP 400** (`"Failed to get events endpoint."`) for `?dates=YYYYMMDD-YYYYMMDD`. Single dates still work. Motorsport and golf ranges still work. Because loaders `.catch(() => EMPTY)`, this failure shows up as silently empty panels, not an error. Use `getTeamSchedule()` for any multi-day team lookup.

### Team schedule score shape
The team schedule endpoint returns `competitor.score` as `{ value, displayValue }`, not a string. `normalizeTeamScheduleEvent()` flattens it to `displayValue`.

### F1 multi-competition structure
Each F1 event has multiple `competitions` inside one event object: FP1, FP2, FP3, Qualifying, **Race**. ESPN stores the **race weekend start date (Friday)** as the event date, not the actual race day (Sunday). `parseRace()` finds the competition where `type.abbreviation === 'Race'` and uses its `date` and `winner`. Never use `competitions[0]` for F1 — that's Friday practice.

### F1 Today vs Last Played date ranges
- **Today panel** uses a 60-day future range + `findNextRace()` — ensures it shows the next upcoming race, not the most recently completed one.
- **Last Played** uses a 14-day window + `findLastRace()`.

### PGA Tour tournament dates
ESPN stores tournament dates as UTC timestamps (e.g. `"2026-06-18T04:00Z"`). Parsing with `new Date(dateString)` and displaying in US Central time (UTC-5) rolls the date back by one day — June 18 4:00 AM UTC = June 17 11:00 PM CDT. `parseTournament()` strips the time component and anchors to local noon: `new Date(event.date.slice(0, 10) + 'T12:00:00')`. This applies to both `startDate` and `endDate`. Unlike F1, `competitions[0]` is the correct competition for golf — there's no multi-session structure.

### Time display — always Central
All pre-game times use Angular's `DatePipe` with `'America/Chicago'` as the explicit timezone and a static `CT` label (e.g. `"Jun 22 · 1:05 PM CT"`). Do not rely on the browser locale or the `z` format token — `z` falls back to `GMT-5` in Linux/k8s environments that lack IANA abbreviation data. ESPN's raw `status.detail` string (which says "EDT") is suppressed for pre-game panels; the DatePipe output is the canonical time display.

### Match teams by id, not abbreviation
Games are matched to configured teams by ESPN team id (`TeamConfig.espnId` ↔ `competitor.team.id`). Abbreviations are display-only — ESPN's are inconsistent (the Knicks are `'NY'`, not `'NYK'`).

### Team schedule vs scoreboard shape
`getTeamSchedule()` returns a different JSON shape than `getScoreboard()`:
- `team.logo` doesn't exist — logos are in `team.logos[]` array
- `event.status` is `null` — status lives under `competition.status`

`normalizeTeamScheduleEvent()` in the service handles both of these before returning the data.

---

## CSS / Theming

Global CSS vars defined in `src/styles.scss`:

```
--bg-primary: #0f1117        (page background)
--bg-card: #191f2e           (panel card background)
--bg-card-hover: #1f2741     (card hover state — still blue-tinted)
--bg-panel-body: #3e3e47     (panel body section — neutral grey, no blue cast)
--text-primary: #f0f4ff
--text-secondary: #8892b0
--text-muted: #495670
--border: #242d45
```

Each panel sets `--primary` and `--secondary` inline from the team/series config colors. The left accent bar and header gradient both read from `--primary`.

Navbar and main content are both constrained to `max-width: 1400px; margin: 0 auto` so they stay aligned at wide viewports.

---

## Testing Patterns

### Service tests — mock HTTP, not the service
```typescript
providers: [provideHttpClient(), provideHttpClientTesting()]
// then:
const req = http.expectOne('https://site.api.espn.com/...');
req.flush(fixtureData);
const result = await promise;
```

### Component tests — mock the service, not HTTP
```typescript
const mockEspn = createMockEspnService();
providers: [{ provide: EspnService, useValue: mockEspn }, provideZonelessChangeDetection()]
// override per-test:
mockEspn.findTeamGame.mockReturnValue(makeGame());
```

Views read `DashboardConfigService`, which defaults to `DEFAULT_CONFIG`. To test with other teams:
```typescript
providers: [..., provideDashboardConfig(makeConfig({ teams: [makeTeamConfig({ espnId: '18', sport: 'basketball/nba' })] }))]
```

### Waiting for resource() to resolve
```typescript
fixture.detectChanges();       // starts resource loaders
await fixture.whenStable();    // waits for Promises to resolve
fixture.detectChanges();       // applies signal updates to DOM
```

### Signal inputs
```typescript
fixture.componentRef.setInput('team', knicks);
fixture.componentRef.setInput('game', makeGame({ status: { state: 'post', ... } }));
fixture.detectChanges();
```

---

## Adding a New Team

1. Add a `TeamConfig` to `DEFAULT_CONFIG.teams` in `src/app/core/config/teams.config.ts`, at the position you want it displayed.
2. Find its `espnId`, `abbreviation`, and colors:
   ```bash
   curl -s --compressed "https://site.api.espn.com/apis/site/v2/sports/{sport}/teams" | python3 -m json.tool | grep -B3 -A6 '"shortDisplayName": "TeamName"'
   ```
3. That's it for an existing league — every view picks it up from the config.

## Adding a New Series (motorsport or golf)

1. Add it to `DEFAULT_CONFIG.series` (motorsport, `kind: 'series'`) or `DEFAULT_CONFIG.golf` (`kind: 'golf'`).
2. That's it for an existing league. `GolfPanelComponent` and `TournamentStatsModalComponent` work for any golf series.

## Adding a New League

1. Verify the ESPN slug returns 200 (and check its response shape against the existing parsers).
2. Add the slug to the matching union in `team-config.model.ts` (`SportLeague` / `MotorsportLeague` / `GolfLeague`).
3. Add an entry to `LEAGUES` in `leagues.config.ts`. Set `hasNews: false` if `/news` returns empty `articles`.
4. Sport-specific display logic (e.g. `periodLabel`/`hasClock` in `TeamPanelComponent`, the MLB boxscore path in `GameStatsModalComponent`) may need a case for the new sport.

---

## Known Constraints

- ESPN's API has no official docs or SLA. Endpoints can change or return 400 without notice. All `resource()` loaders have `.catch(() => EMPTY)` so a broken endpoint shows an empty panel rather than breaking the whole view.
- No authentication, no backend. This is a pure client-side app reading public ESPN data.
- No e2e tests configured. Vitest unit tests only.
