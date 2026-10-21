# CLAUDE.md — BJ's Sports Dashboard

Project context for AI assistants picking up this codebase.

---

## What This Is

Sports dashboard where each user picks their own teams. Fetches live data from ESPN's unofficial public API (no key required). Dark-themed Angular SPA with four dashboard views (Today's games, Last Played, Schedule, News) plus Settings and Import.

User picks live in `localStorage` (no backend, no accounts). A share link (`#/import?c=…`) moves a setup to another browser. A first-time visitor sees a "Pick your teams" prompt on every view.

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
| `src/app/core/config/config-validation.ts` | Untrusted-input boundary: `sanitizeConfig`/`sanitizeTeam`, localStorage (de)serialization, share-code encode/decode. |
| `src/app/core/config/leagues.config.ts` | `LEAGUES` registry (slug, kind, label, `hasNews`; order is News filter order), `SERIES_OPTIONS`/`GOLF_OPTIONS` catalog, `MAX_TEAMS`. |
| `src/app/core/services/dashboard-config.service.ts` | `DashboardConfigService` — config signal every view reads, plus mutators (`addTeam`, `moveTeam`, `setSeriesEnabled`, `replace`, …). Persists to `localStorage` key `sports-dashboard:config`. |
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
| `src/app/features/settings/` | Team picker (from ESPN `/teams`), reorder/remove, series + golf toggles, share link, reset. Changes save immediately. |
| `src/app/features/import/` | Applies a share link: decodes ids, resolves names from ESPN, previews, replaces config on confirm. |
| `src/app/shared/components/empty-config/` | "Pick your teams" prompt shown by every view when the config is empty. |
| `src/app/testing/test-fixtures.ts` | Fixture factories: `makeGame()`, `makeRace()`, `makeEspnTeamEvent()`, `makeEspnRaceEvent()` |
| `src/app/testing/mock-espn.service.ts` | `createMockEspnService()` — Vitest mock for component tests |
| `src/app/testing/dashboard-config.ts` | `provideDashboardConfig()` (defaults to `SAMPLE_CONFIG`), `makeConfig()`, `makeTeamConfig()` — override the config in component tests |
| `src/app/testing/sample-config.ts` | `SAMPLE_CONFIG` — a realistic 5-team + 3-series + PGA config for specs. Not used by app code. |

---

## ESPN API Quirks — Read Before Touching the Service

### Sport slugs (verified working)
```
basketball/nba     basketball/wnba  football/nfl     baseball/mlb     hockey/nhl
soccer/usa.1 (MLS) soccer/eng.1 (EPL) soccer/usa.nwsl (NWSL)
football/college-football  basketball/mens-college-basketball  basketball/womens-college-basketball
racing/f1          racing/nascar-premier             racing/irl
golf/pga
```
`nascar-sprint-cup`, `nascar-cup`, `indycar` are all **wrong** and return 400.

### Per-league quirks (handled by `LEAGUES` fields)
- **College basketball** scoreboard returns only Top-25 games by default (15 vs 92 on a sample date). `scoreboardParams: { groups: '50', limit: '400' }` gets all D-I games. College football's default scoreboard is FBS-level, so FCS teams can be missing from Today; Last Played and Schedule use team schedules and are unaffected.
- **Soccer** team schedules return only *results* by default; upcoming games need `?fixture=true`. `splitSchedule: true` makes `getTeamSchedule()` fetch both and merge by event id.
- **Soccer draws**: ESPN sets `winner: false` on both sides. `TeamPanelComponent.isDraw` shows a **D** badge. Without it a draw renders as a loss.
- **Live clock**: `periodLabel` (Q / P / H) drives the `2Q 4:22` display. Leagues without one (MLB innings, soccer match minute) show ESPN's `status.detail` instead.

### NASCAR news endpoint returns empty
`racing/nascar-premier/news` responds HTTP 200 but with `articles: []`. ESPN's CORS-accessible news endpoint simply doesn't populate NASCAR articles. The `now.core.api.espn.com` domain has NASCAR content but lacks `Access-Control-Allow-Origin`, so it can't be used in a client-side app without a proxy. NASCAR is excluded from the News view entirely.

### MLB 100-event cap
The league scoreboard caps at 100 events. MLB plays ~15 games/day, so 100 events ≈ 7 days. The **Schedule** and **Last Played** views use `getTeamSchedule(sport, espnId)` (full-season per-team endpoint) and filter client-side. The **Today view** still uses the scoreboard because it only needs a single day.

### Team-sport scoreboards reject date ranges
As of Oct 2026, `basketball/nba`, `football/nfl`, `baseball/mlb` and `hockey/nhl` scoreboards return **HTTP 400** (`"Failed to get events endpoint."`) for `?dates=YYYYMMDD-YYYYMMDD`. Single dates still work. Motorsport and golf ranges still work. Because loaders `.catch(() => EMPTY)`, this failure shows up as silently empty panels, not an error. Use `getTeamSchedule()` for any multi-day team lookup.

### CORS — check before using any new endpoint
This is a browser-only app, so an endpoint is usable only if it sends `Access-Control-Allow-Origin`. Unit tests mock HTTP and **cannot** catch this. Check with:
```bash
curl -s -o /dev/null -D - -H "Origin: http://localhost:4200" "<url>" | grep -i access-control-allow-origin
```
Known **no CORS**: `/{sport}/teams` and `/{sport}/teams/{id}`. So `getTeams()` reads standings (`https://site.api.espn.com/apis/v2/sports/{sport}/standings`, note `/apis/v2` and not `/apis/site/v2`). That gives the full team list with no colors. `getTeamColors()` reads `/{sport}/teams/{id}/schedule` (top-level `team.color`). `/groups` also has CORS, but it's empty for WNBA and soccer and capped at 25 per division for college, so don't use it for team lists. Known OK: scoreboard, `teams/{id}/schedule`, groups, standings, summary, news.

### Team schedule score shape
The team schedule endpoint returns `competitor.score` as `{ value, displayValue }`, not a string. `normalizeTeamScheduleEvent()` flattens it to `displayValue`.

### F1 multi-competition structure
Each F1 event has multiple `competitions` inside one event object: FP1, FP2, FP3, Qualifying, **Race**. ESPN stores the **race weekend start date (Friday)** as the event date, not the actual race day (Sunday). `parseRace()` finds the competition where `type.abbreviation === 'Race'` and uses its `date` and `winner`. Never use `competitions[0]` for F1 — that's Friday practice.

### F1 Today vs Last Played date ranges
- **Today panel** uses a 60-day future range + `findNextRace()` — ensures it shows the next upcoming race, not the most recently completed one.
- **Last Played** uses a 14-day window + `findLastRace()`.

### PGA Tour tournament dates
ESPN stores tournament dates as UTC timestamps (e.g. `"2026-06-18T04:00Z"`). Parsing with `new Date(dateString)` and displaying in US Central time (UTC-5) rolls the date back by one day — June 18 4:00 AM UTC = June 17 11:00 PM CDT. `parseTournament()` strips the time component and anchors to local noon: `new Date(event.date.slice(0, 10) + 'T12:00:00')`. This applies to both `startDate` and `endDate`. Unlike F1, `competitions[0]` is the correct competition for golf — there's no multi-session structure.

### Time display — browser zone, with an override
Game and race times use `TimeZoneService.zone`: a saved override from Settings (`sports-dashboard:timezone`, which must be one of `TIME_ZONE_OPTIONS`), otherwise the browser's IANA zone. Render them with the `zonedTime` pipe, e.g. `{{ date | zonedTime: zone() }}` → `"Jun 22 · 1:05 PM ET"`, or `: 'time'` → `"1:05 PM ET"`.

- **Don't pass zones to `DatePipe`.** It only understands offsets and abbreviations: `date: ... : 'America/Chicago'` silently falls back to the browser zone. All zone-aware formatting goes through `Intl` in `core/config/time-zones.ts`.
- Labels are stable across DST. Intl's `EDT`/`EST` both become `ET`, and so on for CT/MT/PT/AKT/HT. Curated options have fixed labels (London → `UK`, since en-US gives `GMT+1`). Zones with no US name show Intl's short name (`GMT-5`).
- Schedule groups games and races by `dateKeyInZone()`, so a 9:30 PM PT game stays on its West Coast day. Tournament dates are noon-anchored local dates (see PGA above) and still use `formatDateYMD`.
- Date-only displays (`'MMMM d, y'`) still use `DatePipe`, because the zone doesn't matter there.
- ESPN's raw `status.detail` (which says "EDT") is suppressed for pre-game panels. The `zonedTime` output is the canonical time display.

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

Views read `DashboardConfigService`, which starts empty in a fresh browser. View specs provide `provideDashboardConfig()` (= `SAMPLE_CONFIG`); to test with other teams:
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

## User Config — Storage and Share Links

- **localStorage** (`sports-dashboard:config`) holds `{ v: 1, teams: TeamConfig[], series: slug[], golf: slug[] }`. Every load runs `sanitizeConfig`: invalid teams dropped, duplicates removed, capped at `MAX_TEAMS`, series/golf resolved against the catalog. Unknown `v` or bad JSON → empty config. Bump the version and add a migration if the shape changes.
- **Dashboard name** lives under its own key, `sports-dashboard:name`, so imports and "Remove everything" never touch it and share links never carry it. `sanitizeName` strips control characters and caps at 30 chars. It doesn't trim, so spaces survive while typing; `dashboardTitle()` trims at display time. With no name the title is "Sports Dashboard". `App` mirrors the title into the browser tab via `Title`.
- **Share codes** are base64url JSON `{ v: 1, t: [[sport, espnId, primary?, secondary?]], s: [...], g: [...] }`. They deliberately carry **no display text** — Import resolves names from ESPN `/teams`, so a crafted link can't put arbitrary strings on the page. Colors are kept only if both are `#rrggbb`.
- Colors go into inline `--primary`/`--secondary` style bindings, so they must pass `isHexColor` wherever they enter the app (storage, share code, ESPN `/teams`).

## Adding a New Motorsport / Golf Series

1. Add it to `SERIES_OPTIONS` (motorsport, `kind: 'series'`) or `GOLF_OPTIONS` (`kind: 'golf'`) in `leagues.config.ts`. It shows up as a toggle in Settings.
2. If its league is new, follow "Adding a New League" below.

## Adding a New League

1. Verify the ESPN slug, and check **CORS** (see above) on scoreboard, standings, `teams/{id}/schedule`, summary and news.
2. Check that standings lists every team, that the scoreboard isn't filtered by default (needs `scoreboardParams`?), and that the team schedule includes upcoming games (needs `splitSchedule`?).
3. Add the slug to the matching union in `team-config.model.ts` (`SportLeague` / `MotorsportLeague` / `GolfLeague`).
4. Add an entry to `LEAGUES` in `leagues.config.ts` with `periodLabel` if it has a game clock. Set `hasNews: false` if `/news` returns empty `articles`. Its position in `LEAGUES` sets its Settings tab and News filter order.
5. Add any other sport-specific display logic, e.g. the MLB boxscore path in `GameStatsModalComponent`.

---

## Known Constraints

- ESPN's API has no official docs or SLA. Endpoints can change or return 400 without notice. Dashboard loaders go through `fetchAll()`, which falls back per key, so a broken endpoint shows an empty panel rather than breaking the whole view. The Settings team picker deliberately does not swallow errors — it shows "Couldn't load teams".
- No authentication, no backend. This is a pure client-side app reading public ESPN data.
- No e2e tests configured. Vitest unit tests only.
