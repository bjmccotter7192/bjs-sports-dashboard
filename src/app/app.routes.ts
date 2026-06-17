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
    path: 'news',
    loadComponent: () =>
      import('./features/news/news.component').then((m) => m.NewsComponent),
  },
];
