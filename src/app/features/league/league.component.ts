import { Component, DestroyRef, computed, effect, inject, resource, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { EspnService } from '../../core/services/espn.service';
import { DashboardConfigService } from '../../core/services/dashboard-config.service';
import { TimeZoneService } from '../../core/services/time-zone.service';
import { teamLeagueByRouteKey } from '../../core/config/leagues.config';
import {
  ESPN_DAY_ZONE, dateKeyInZone, formatDateKey, isDateKey, shiftDateKey,
} from '../../core/config/time-zones';
import { Game } from '../../core/models/game.model';
import { SportLeague } from '../../core/models/team-config.model';
import { GameCardComponent } from '../../shared/components/game-card/game-card.component';
import { GameStatsModalComponent } from '../../shared/components/game-stats-modal/game-stats-modal.component';

/** How often to re-fetch while any game on the page is live. */
export const LIVE_REFRESH_MS = 30_000;
/** Smart default: if today's first game is further away than this, show yesterday instead. */
const SMART_DEFAULT_LEAD_MS = 2 * 60 * 60 * 1000;

/**
 * Every game in one league for one ESPN game day: `#/league/nba?date=20261020`.
 * Without `date`, opens today — or yesterday when nothing today has started or is close.
 */
@Component({
  selector: 'app-league',
  imports: [GameCardComponent, GameStatsModalComponent],
  templateUrl: './league.component.html',
  styleUrl: './league.component.scss',
})
export class LeagueComponent {
  private espn = inject(EspnService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private config = inject(DashboardConfigService).config;
  readonly zone = inject(TimeZoneService).zone;

  private params = toSignal(this.route.paramMap, { requireSync: true });
  private query = toSignal(this.route.queryParamMap, { requireSync: true });

  readonly league = computed(() => teamLeagueByRouteKey(this.params().get('league')));
  readonly sport = computed(() => this.league()?.slug as SportLeague | undefined);

  /** Today's ESPN game day, captured once per page visit. */
  readonly todayKey = dateKeyInZone(new Date(), ESPN_DAY_ZONE);

  /** Explicit ?date=, or null to apply the smart default. */
  private requestedDate = computed(() => {
    const d = this.query().get('date');
    return isDateKey(d) ? d : null;
  });

  readonly dateKey = computed(() => this.requestedDate() ?? this.todayKey);
  readonly dateLabel = computed(() => formatDateKey(this.dateKey(), { weekday: 'long', month: 'long', day: 'numeric' }));
  readonly isToday = computed(() => this.dateKey() === this.todayKey);

  readonly board = resource({
    params: () => {
      const sport = this.sport();
      return sport ? { sport, date: this.dateKey() } : undefined;
    },
    loader: ({ params }) => this.espn.getScoreboard(params.sport, params.date),
  });

  /** First load only — background refreshes keep showing the current cards. */
  readonly isFirstLoad = computed(() => this.board.isLoading() && !this.board.hasValue());

  private starredIds = computed(() => {
    const sport = this.sport();
    return new Set(this.config().teams.filter(t => t.sport === sport).map(t => t.espnId));
  });

  /** Games with the user's teams first, then by start time. */
  readonly games = computed(() => {
    if (!this.board.hasValue()) return [];
    const starred = this.starredIds();
    return (this.board.value().events ?? [])
      .map(e => this.espn.parseGame(e))
      .map(game => ({ game, starred: starred.has(game.homeTeam.id) || starred.has(game.awayTeam.id) }))
      .sort((a, b) => Number(b.starred) - Number(a.starred) || a.game.date.getTime() - b.game.date.getTime());
  });

  readonly hasLive = computed(() => this.games().some(g => g.game.status.state === 'in'));

  private pageHidden = signal(document.hidden);

  selectedGame = signal<Game | null>(null);

  constructor() {
    const onVisibility = () => {
      this.pageHidden.set(document.hidden);
      // Catch up immediately when the tab comes back during live games
      if (!document.hidden && this.hasLive()) this.board.reload();
    };
    document.addEventListener('visibilitychange', onVisibility);
    inject(DestroyRef).onDestroy(() => document.removeEventListener('visibilitychange', onVisibility));

    // Live refresh: poll only while something is in progress and the tab is visible
    effect(onCleanup => {
      if (!this.hasLive() || this.pageHidden()) return;
      const id = setInterval(() => this.board.reload(), LIVE_REFRESH_MS);
      onCleanup(() => clearInterval(id));
    });

    // Smart default: with no ?date=, fall back to yesterday when today has nothing to show yet
    effect(() => {
      if (this.requestedDate() || !this.board.hasValue() || this.board.isLoading()) return;
      if (this.shouldShowYesterday(this.games().map(g => g.game))) {
        this.goTo(shiftDateKey(this.todayKey, -1), true);
      }
    });
  }

  private shouldShowYesterday(games: Game[]): boolean {
    if (!games.length) return true;
    if (games.some(g => g.status.state !== 'pre')) return false;
    const first = Math.min(...games.map(g => g.date.getTime()));
    return first - Date.now() > SMART_DEFAULT_LEAD_MS;
  }

  goTo(dateKey: string, replaceUrl = false) {
    this.router.navigate([], { relativeTo: this.route, queryParams: { date: dateKey }, replaceUrl });
  }

  prevDay() { this.goTo(shiftDateKey(this.dateKey(), -1)); }
  nextDay() { this.goTo(shiftDateKey(this.dateKey(), 1)); }
  today() { this.goTo(this.todayKey); }
}
