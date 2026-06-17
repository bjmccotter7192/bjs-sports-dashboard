import { Component, computed, inject, resource, signal } from '@angular/core';
import { EspnService } from '../../core/services/espn.service';
import { MY_TEAMS, MY_SERIES, MY_GOLF } from '../../core/config/teams.config';
import { NewsArticle } from '../../core/models/game.model';

interface NewsSource {
  key: string;
  label: string;
  sport: string;
  color: string;
}

// League-level endpoints — ESPN's public API does not support team-level news filtering
const NEWS_SOURCES: NewsSource[] = [
  { key: 'NBA',     label: 'NBA',     sport: 'basketball/nba',        color: MY_TEAMS[0].primaryColor },
  { key: 'NFL',     label: 'NFL',     sport: 'football/nfl',          color: MY_TEAMS[1].primaryColor },
  { key: 'MLB',     label: 'MLB',     sport: 'baseball/mlb',          color: MY_TEAMS[2].primaryColor },
  { key: 'NHL',     label: 'NHL',     sport: 'hockey/nhl',            color: MY_TEAMS[4].primaryColor },
  { key: 'F1',      label: 'F1',      sport: 'racing/f1',             color: MY_SERIES[0].primaryColor },
  { key: 'IndyCar', label: 'IndyCar', sport: 'racing/irl',            color: MY_SERIES[2].primaryColor },
  { key: 'PGA',     label: 'PGA',     sport: 'golf/pga',              color: MY_GOLF[0].primaryColor },
];

@Component({
  selector: 'app-news',
  imports: [],
  templateUrl: './news.component.html',
  styleUrl: './news.component.scss',
})
export class NewsComponent {
  private espn = inject(EspnService);

  selectedFilter = signal<string>('all');

  readonly filterSources = [
    { key: 'all', label: 'All', color: 'var(--text-secondary)' },
    ...NEWS_SOURCES.map(s => ({ key: s.key, label: s.label, color: s.color })),
  ];

  private nba     = resource({ loader: () => this.espn.getNews('basketball/nba',        'NBA',     NEWS_SOURCES[0].color).catch(() => []) });
  private nfl     = resource({ loader: () => this.espn.getNews('football/nfl',          'NFL',     NEWS_SOURCES[1].color).catch(() => []) });
  private mlb     = resource({ loader: () => this.espn.getNews('baseball/mlb',          'MLB',     NEWS_SOURCES[2].color).catch(() => []) });
  private nhl     = resource({ loader: () => this.espn.getNews('hockey/nhl',            'NHL',     NEWS_SOURCES[3].color).catch(() => []) });
  private f1      = resource({ loader: () => this.espn.getNews('racing/f1',             'F1',      NEWS_SOURCES[4].color).catch(() => []) });
  private indycar = resource({ loader: () => this.espn.getNews('racing/irl',  'IndyCar', NEWS_SOURCES[5].color).catch(() => []) });
  private pga     = resource({ loader: () => this.espn.getNews('golf/pga',    'PGA',     NEWS_SOURCES[6].color).catch(() => []) });

  private allResources = [
    this.nba, this.nfl, this.mlb, this.nhl,
    this.f1, this.indycar, this.pga,
  ];

  isLoading = computed(() => this.allResources.some(r => r.isLoading()));

  allArticles = computed((): NewsArticle[] => {
    const seen = new Set<string>();
    const merged: NewsArticle[] = [];
    for (const res of this.allResources) {
      for (const article of res.value() ?? []) {
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
