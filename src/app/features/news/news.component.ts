import { Component, computed, inject, resource, signal } from '@angular/core';
import { EspnService } from '../../core/services/espn.service';
import { DashboardConfigService } from '../../core/services/dashboard-config.service';
import { LEAGUES } from '../../core/config/leagues.config';
import { fetchAll } from '../../core/utils/fetch-all';
import { League } from '../../core/models/team-config.model';
import { NewsArticle } from '../../core/models/game.model';

interface NewsSource {
  key: string;
  label: string;
  sport: League;
  color: string;
}

@Component({
  selector: 'app-news',
  imports: [],
  templateUrl: './news.component.html',
  styleUrl: './news.component.scss',
})
export class NewsComponent {
  private espn = inject(EspnService);
  private config = inject(DashboardConfigService).config;

  selectedFilter = signal<string>('all');

  // League-level endpoints — ESPN's public API does not support team-level news filtering.
  // One source per configured league with news, colored by its first configured team/series.
  private sources = computed((): NewsSource[] => {
    const { teams, series, golf } = this.config();
    const entries = [...teams, ...series, ...golf];
    return LEAGUES.filter(l => l.hasNews).flatMap(l => {
      const first = entries.find(e => e.sport === l.slug);
      return first ? [{ key: l.label, label: l.label, sport: l.slug, color: first.primaryColor }] : [];
    });
  });

  readonly filterSources = computed(() => [
    { key: 'all', label: 'All', color: 'var(--text-secondary)' },
    ...this.sources().map(s => ({ key: s.key, label: s.label, color: s.color })),
  ]);

  private articles = resource({
    params: () => this.sources(),
    loader: ({ params }) => fetchAll(params, s => this.espn.getNews(s.sport, s.label, s.color), [] as NewsArticle[]),
  });

  isLoading = computed(() => this.articles.isLoading());

  allArticles = computed((): NewsArticle[] => {
    const seen = new Set<string>();
    const merged: NewsArticle[] = [];
    for (const list of this.articles.value()?.values() ?? []) {
      for (const article of list) {
        if (!seen.has(article.id)) {
          seen.add(article.id);
          merged.push(article);
        }
      }
    }
    return merged.sort((a, b) => b.published.getTime() - a.published.getTime());
  });

  filteredArticles = computed(() => {
    const filter = this.selectedFilter();
    if (filter === 'all') return this.allArticles();
    return this.allArticles().filter(a => a.sourceName === filter);
  });

  timeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'yesterday';
    return `${days}d ago`;
  }
}
