import { Component, ElementRef, HostListener, computed, effect, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { DashboardConfigService } from './core/services/dashboard-config.service';
import { leagueRouteKey } from './core/config/leagues.config';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private host = inject(ElementRef<HTMLElement>);
  private store = inject(DashboardConfigService);

  menuOpen = signal(false);
  leaguesOpen = signal(false);
  readonly title = this.store.title;

  /** Leagues ▾ menu: only leagues the user follows a team in. */
  /** Highlights the Leagues ▾ toggle on any /league/* page. */
  readonly onLeaguePage = toSignal(
    inject(Router).events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(e => e.urlAfterRedirects.startsWith('/league/'))
    ),
    { initialValue: false }
  );

  readonly leagueLinks = computed(() =>
    this.store.followedTeamLeagues().map(l => ({ label: l.label, path: `/league/${leagueRouteKey(l.slug)}` }))
  );

  constructor() {
    const pageTitle = inject(Title);
    effect(() => pageTitle.setTitle(this.title()));
  }

  toggleMenu() {
    this.menuOpen.update(v => !v);
  }

  closeMenu() {
    this.menuOpen.set(false);
  }

  toggleLeagues() {
    this.leaguesOpen.update(v => !v);
  }

  closeLeagues() {
    this.leaguesOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const dropdown = (this.host.nativeElement as HTMLElement).querySelector('.leagues-dropdown');
    if (this.leaguesOpen() && dropdown && !dropdown.contains(event.target as Node)) {
      this.closeLeagues();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.closeLeagues();
  }

  @HostListener('window:resize')
  onResize() {
    if (window.innerWidth > 768) {
      this.menuOpen.set(false);
    }
  }
}
