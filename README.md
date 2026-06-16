# BJ's Sports Dashboard

A personal sports dashboard built with Angular v21. Tracks your teams and motorsport series in one dark-themed view — no login, no subscriptions. Data is pulled live from ESPN's public API.

---

## Teams & Series

| Type | Entry |
|------|-------|
| NBA | New York Knicks |
| NFL | New York Giants |
| MLB | New York Yankees |
| MLB | Washington Nationals |
| NHL | New York Rangers |
| Motorsport | Formula 1 |
| Motorsport | NASCAR Cup Series |
| Motorsport | IndyCar Series |

---

## Views

| Route | Description |
|-------|-------------|
| `/today` | Today's games and next upcoming race per series |
| `/last-played` | Most recent completed game per team (14-day window); last race per series |
| `/schedule` | All upcoming events for your teams and series over the next 30 days |

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Angular 21.2.17 |
| Change detection | Zoneless (`provideZonelessChangeDetection()`) |
| Components | Standalone (no NgModules) |
| Async data | `resource()` API with signal-based state |
| Reactivity | `signal()`, `computed()`, `input.required<T>()` |
| HTTP | `HttpClient` via `provideHttpClient()` |
| Styling | SCSS + CSS custom properties |
| Testing | Vitest 4.x + Angular TestBed |
| Coverage | `@vitest/coverage-v8` |
| Node | 24.x |
| CLI | Angular CLI 21.2.15 |

---

## Prerequisites

- **Node.js** v20 or later (v24 recommended)
- **npm** v10 or later

Check your versions:

```bash
node --version
npm --version
```

Install the Angular CLI globally if you don't have it:

```bash
npm install -g @angular/cli
```

---

## Getting Started

```bash
# Clone the repo
git clone <repo-url>
cd bjs-sports-dashboard

# Install dependencies
npm install
```

---

## Running Locally

```bash
npm start
# or
ng serve
```

Open `http://localhost:4200` in your browser. The dev server hot-reloads on every file save.

> **Coder / remote pod users:** the dev server binds to `localhost` inside the pod. Expose port `4200` via your IDE's Ports panel (VS Code → Ports tab → Add Port → `4200`) to reach it from your browser.

---

## Building

```bash
# Production build (output → dist/)
ng build

# Development build with watch (rebuilds on save, no dev server)
npm run watch
```

The production build enables tree-shaking, minification, and chunk splitting. Build output lands in `dist/bjs-sports-dashboard/`.

---

## Running Tests

```bash
# Run once and exit
ng test --watch=false

# Watch mode (re-runs on file save)
ng test

# With coverage report
ng test --configuration=coverage --watch=false
```

Coverage reports are written to `coverage/`. Open `coverage/index.html` in a browser for the full interactive view.

---

## Project Structure

```
src/
├── app/
│   ├── app.ts                     # Root component (nav bar + router outlet)
│   ├── app.routes.ts              # Lazy-loaded route definitions
│   ├── app.config.ts              # Application providers (zoneless, router, HTTP)
│   │
│   ├── core/
│   │   ├── config/
│   │   │   └── teams.config.ts    # MY_TEAMS and MY_SERIES definitions
│   │   ├── models/
│   │   │   ├── game.model.ts      # EspnEvent, Game, Race interfaces
│   │   │   └── team-config.model.ts  # TeamConfig, SeriesConfig types
│   │   └── services/
│   │       └── espn.service.ts    # All ESPN API calls + data parsing
│   │
│   ├── features/
│   │   ├── today/                 # Today's Games view
│   │   ├── yesterday/             # Last Played view
│   │   └── schedule/              # Upcoming Schedule view
│   │
│   ├── shared/
│   │   └── components/
│   │       ├── team-panel/        # Card for a single team sport game
│   │       └── motorsport-panel/  # Card for a single race series
│   │
│   └── testing/
│       ├── mock-espn.service.ts   # Vitest mock factory for EspnService
│       └── test-fixtures.ts       # Shared fixture builders (makeGame, makeRace, etc.)
│
└── styles.scss                    # Global dark theme + CSS custom properties
```

---

## Data Source

All data comes from ESPN's unofficial public scoreboard API — no API key required.

```
https://site.api.espn.com/apis/site/v2/sports/{sport}/scoreboard?dates=YYYYMMDD
https://site.api.espn.com/apis/site/v2/sports/{sport}/teams/{id}/schedule
```

Sport slugs in use:

| Sport | Slug |
|-------|------|
| NBA | `basketball/nba` |
| NFL | `football/nfl` |
| MLB | `baseball/mlb` |
| NHL | `hockey/nhl` |
| Formula 1 | `racing/f1` |
| NASCAR Cup | `racing/nascar-premier` |
| IndyCar | `racing/irl` |

> **MLB note:** The schedule view uses the per-team schedule endpoint instead of the league scoreboard to avoid ESPN's 100-event cap (which only covers ~7 days of MLB games).

> **F1 note:** Each race weekend event contains multiple competitions (FP1, FP2, FP3, Qualifying, Race). The service always picks the `Race` competition for winner and date — not the first competition, which is Friday practice.

---

## Testing Architecture

Tests are written with **Vitest** + **Angular TestBed**. No real HTTP calls are made in any test.

### Mocking Strategy

| What is tested | How HTTP is mocked |
|---|---|
| `EspnService` | `HttpTestingController` — intercepts requests, returns fixture data |
| Feature components | `createMockEspnService()` provided via `{ provide: EspnService, useValue: mock }` |
| Panel components | No service injection — tested with direct signal inputs only |

### Key Patterns

**Setting signal inputs in tests** (Angular v21 `input.required<T>()`):
```typescript
fixture.componentRef.setInput('team', knicks);
fixture.componentRef.setInput('game', makeGame());
fixture.detectChanges();
```

**Waiting for `resource()` to settle** (async data in feature components):
```typescript
fixture.detectChanges();          // trigger resource loaders
await fixture.whenStable();       // wait for Promises to resolve
fixture.detectChanges();          // apply signal changes to DOM
```

**Intercepting HTTP in service tests**:
```typescript
const promise = service.getScoreboard('baseball/mlb', '20260616');
const req = http.expectOne(r => r.url.includes('/baseball/mlb/scoreboard'));
expect(req.request.params.get('dates')).toBe('20260616');
req.flush({ events: [] });        // resolve the request with fixture data
const result = await promise;
```

**Zoneless testing requirement** — every `TestBed.configureTestingModule` must include:
```typescript
providers: [provideZonelessChangeDetection(), ...]
```

---

## Adding a New Team or Series

1. Open [src/app/core/config/teams.config.ts](src/app/core/config/teams.config.ts)
2. Add an entry to `MY_TEAMS` (team sport) or `MY_SERIES` (motorsport)
3. Find the ESPN `abbreviation` by curling the league scoreboard and inspecting a game that includes your team:
   ```bash
   curl "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard" | python3 -m json.tool | grep abbreviation
   ```
4. Find the `espnId` from the team schedule endpoint:
   ```bash
   curl "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/teams" | python3 -m json.tool | grep -A2 '"shortDisplayName": "Yankees"'
   ```

---

## Angular Concepts Demonstrated

This project was built as a learning exercise for modern Angular (v17+) patterns:

| Concept | Where to see it |
|---------|----------------|
| Zoneless change detection | [app.config.ts](src/app/app.config.ts) |
| Standalone components | Every component (`standalone` is now the default) |
| `resource()` for async data | [today.component.ts](src/app/features/today/today.component.ts) |
| `signal()` + `computed()` | [team-panel.component.ts](src/app/shared/components/team-panel/team-panel.component.ts) |
| `input.required<T>()` | Panel components |
| `@for` / `@if` control flow | All component templates |
| Lazy-loaded routes | [app.routes.ts](src/app/app.routes.ts) |
| `HttpClient` with Promises | [espn.service.ts](src/app/core/services/espn.service.ts) |
| Mocking HTTP in tests | [espn.service.spec.ts](src/app/core/services/espn.service.spec.ts) |
| Mocking services in component tests | [today.component.spec.ts](src/app/features/today/today.component.spec.ts) |
