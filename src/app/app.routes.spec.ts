import { Component, Type, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Route, Router, provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { YesterdayComponent } from './features/yesterday/yesterday.component';
import { TodayComponent } from './features/today/today.component';
import { ScheduleComponent } from './features/schedule/schedule.component';
import { LeagueComponent } from './features/league/league.component';
import { SettingsComponent } from './features/settings/settings.component';
import { ImportComponent } from './features/import/import.component';
import { NewsComponent } from './features/news/news.component';

@Component({ template: '' })
class StubPage {}

function route(path: string): Route {
  const r = routes.find(x => x.path === path);
  if (!r) throw new Error(`no route for "${path}"`);
  return r;
}

describe('app routes', () => {
  const lazy: [string, Type<unknown>][] = [
    ['last-played', YesterdayComponent],
    ['today', TodayComponent],
    ['schedule', ScheduleComponent],
    ['league/:league', LeagueComponent],
    ['settings', SettingsComponent],
    ['import', ImportComponent],
    ['news', NewsComponent],
  ];

  it.each(lazy)('lazy-loads "%s" to its component', async (path, component) => {
    const loader = route(path).loadComponent;
    expect(loader).toBeTypeOf('function');
    expect(await loader!()).toBe(component);
  });

  it('redirects the empty path to today', () => {
    expect(route('')).toMatchObject({ redirectTo: 'today', pathMatch: 'full' });
  });

  it('redirects the legacy yesterday path to last-played', () => {
    expect(route('yesterday')).toMatchObject({ redirectTo: 'last-played', pathMatch: 'full' });
  });

  // Navigation checks: swap each loadComponent for a stub so no feature needs its services,
  // but keep paths and redirects exactly as configured.
  describe('navigation', () => {
    let router: Router;

    beforeEach(() => {
      const stubbed = routes.map(r => (r.loadComponent ? { ...r, loadComponent: undefined, component: StubPage } : r));
      TestBed.configureTestingModule({
        providers: [provideZonelessChangeDetection(), provideRouter(stubbed)],
      });
      router = TestBed.inject(Router);
    });

    it('sends the root URL to /today', async () => {
      await router.navigateByUrl('/');
      expect(router.url).toBe('/today');
    });

    it('sends old /yesterday bookmarks to /last-played', async () => {
      await router.navigateByUrl('/yesterday');
      expect(router.url).toBe('/last-played');
    });

    it('sends an unknown path to /today instead of failing navigation', async () => {
      const ok = await router.navigateByUrl('/no-such-page').catch(() => false);
      expect(ok).toBe(true);
      expect(router.url).toBe('/today');
    });
  });
});
