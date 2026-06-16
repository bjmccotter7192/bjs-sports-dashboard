# CLAUDE.md — BJ's Sports Dashboard

Project context for AI assistants picking up this codebase.

---

## What This Is

Personal sports dashboard. Fetches live data from ESPN's unofficial public API (no key required). Dark-themed Angular SPA with three views: Today's games, Last Played, and an upcoming Schedule. Eight panels: NY Knicks, NY Giants, NY Yankees, Washington Nationals, NY Rangers, F1, NASCAR Cup, IndyCar.

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
- **`resource()` API** — async data fetching. Used in all three feature components. Returns `ResourceRef` with `.value()`, `.isLoading()`, `.error()` signals.
- **Signal inputs** — `input.required<T>()` on panel components. Set in tests via `fixture.componentRef.setInput('name', value)`.
- **Lazy routes** — all three views are lazy-loaded via `loadComponent` in `app.routes.ts`.

---

## Key Files

| File | Purpose |
|------|---------|
| `src/app/core/config/teams.config.ts` | `MY_TEAMS` and `MY_SERIES` — the single source of truth for which teams/series to show |
| `src/app/core/services/espn.service.ts` | All ESPN API calls + parsing. The only file that touches HTTP. |
| `src/app/core/models/game.model.ts` | Raw ESPN shapes (`EspnEvent`) and normalized app models (`Game`, `Race`) |
| `src/app/core/models/team-config.model.ts` | `TeamConfig` / `SeriesConfig` / `SportLeague` / `MotorsportLeague` types |
| `src/app/shared/components/team-panel/` | Card for a single team-sport game. Inputs: `team`, `game`, `isLoading`. |
| `src/app/shared/components/motorsport-panel/` | Card for a single race series. Inputs: `series`, `race`, `isLoading`. |
| `src/app/features/today/` | Today's games + next race per series |
| `src/app/features/yesterday/` | Last Played — most recent completed game per team in last 14 days |
| `src/app/features/schedule/` | Next 30 days, grouped by date |
| `src/app/testing/test-fixtures.ts` | Fixture factories: `makeGame()`, `makeRace()`, `makeEspnTeamEvent()`, `makeEspnRaceEvent()` |
| `src/app/testing/mock-espn.service.ts` | `createMockEspnService()` — Vitest mock for component tests |

---

## ESPN API Quirks — Read Before Touching the Service

### Sport slugs (verified working)
```
basketball/nba     football/nfl     baseball/mlb     hockey/nhl
racing/f1          racing/nascar-premier             racing/irl
```
`nascar-sprint-cup`, `nascar-cup`, `indycar` are all **wrong** and return 400.

### MLB 100-event cap
The league scoreboard caps at 100 events. MLB plays ~15 games/day, so 100 events ≈ 7 days. The **Schedule view** uses `getTeamSchedule(sport, espnId)` (full-season per-team endpoint) and filters client-side. The **Today/Last Played views** still use the scoreboard because they only need a single day or 14-day range.

### F1 multi-competition structure
Each F1 event has multiple `competitions` inside one event object: FP1, FP2, FP3, Qualifying, **Race**. ESPN stores the **race weekend start date (Friday)** as the event date, not the actual race day (Sunday). `parseRace()` finds the competition where `type.abbreviation === 'Race'` and uses its `date` and `winner`. Never use `competitions[0]` for F1 — that's Friday practice.

### F1 Today vs Last Played date ranges
- **Today panel** uses a 60-day future range + `findNextRace()` — ensures it shows the next upcoming race, not the most recently completed one.
- **Last Played** uses a 14-day window + `findLastRace()`.

### Knicks abbreviation
ESPN abbreviates the NY Knicks as `'NY'`, not `'NYK'`. Confirmed via curl on the NBA scoreboard. The config has `abbreviation: 'NY'` — do not change it.

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

1. Add to `MY_TEAMS` in `src/app/core/config/teams.config.ts`
2. Find the correct ESPN `abbreviation`:
   ```bash
   curl "https://site.api.espn.com/apis/site/v2/sports/{sport}/scoreboard" | python3 -m json.tool | grep abbreviation
   ```
3. Find the `espnId` (needed for schedule view):
   ```bash
   curl "https://site.api.espn.com/apis/site/v2/sports/{sport}/teams" | python3 -m json.tool | grep -A2 '"shortDisplayName": "TeamName"'
   ```
4. If the new team is in an existing sport (NBA/NFL/MLB/NHL), the Today and Last Played views pick it up automatically. The Schedule view requires adding a new `resource()` entry in `schedule.component.ts` (pattern: one resource per team using `getTeamSchedule()`).

## Adding a New Motorsport Series

1. Add to `MY_SERIES` in `teams.config.ts` with the verified ESPN slug
2. Add the new `MotorsportLeague` union type in `team-config.model.ts`
3. Add a new `resource()` in Today, Yesterday, and Schedule components following the existing motorsport pattern

---

## Known Constraints

- ESPN's API has no official docs or SLA. Endpoints can change or return 400 without notice. All `resource()` loaders have `.catch(() => EMPTY)` so a broken endpoint shows an empty panel rather than breaking the whole view.
- No authentication, no backend. This is a pure client-side app reading public ESPN data.
- No e2e tests configured. Vitest unit tests only.
