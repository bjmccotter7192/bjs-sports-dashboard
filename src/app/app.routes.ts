import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'today', pathMatch: 'full' },
  // legacy redirect so old bookmarks still work
  { path: 'yesterday', redirectTo: 'last-played', pathMatch: 'full' },
  {
    path: 'last-played',
    loadComponent: () =>
      import('./features/yesterday/yesterday.component').then(
        (m) => m.YesterdayComponent
      ),
  },
  {
    path: 'today',
    loadComponent: () =>
      import('./features/today/today.component').then((m) => m.TodayComponent),
  },
  {
    path: 'schedule',
    loadComponent: () =>
      import('./features/schedule/schedule.component').then(
        (m) => m.ScheduleComponent
      ),
  },
  {
    path: 'league/:league',
    loadComponent: () =>
      import('./features/league/league.component').then((m) => m.LeagueComponent),
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./features/settings/settings.component').then((m) => m.SettingsComponent),
  },
  {
    path: 'import',
    loadComponent: () =>
      import('./features/import/import.component').then((m) => m.ImportComponent),
  },
  {
    path: 'news',
    loadComponent: () =>
      import('./features/news/news.component').then((m) => m.NewsComponent),
  },
];
