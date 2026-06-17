import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

import { NewsComponent } from './news.component';
import { EspnService } from '../../core/services/espn.service';
import { createMockEspnService } from '../../testing/mock-espn.service';
import { NewsArticle } from '../../core/models/game.model';

function makeArticle(overrides: Partial<NewsArticle> = {}): NewsArticle {
  return {
    id: 'article-1',
    headline: 'Test Headline',
    description: 'Test description.',
    image: 'https://example.com/img.jpg',
    url: 'https://www.espn.com/article/1',
    published: new Date('2026-06-17T12:00:00Z'),
    sourceName: 'NBA',
    sourceColor: '#006BB6',
    ...overrides,
  };
}

// 7 league sources: NBA, NFL, MLB, NHL, F1, IndyCar, PGA (NASCAR excluded — ESPN API returns empty)
const SOURCE_COUNT = 7;

describe('NewsComponent', () => {
  let fixture: ComponentFixture<NewsComponent>;
  let component: NewsComponent;
  let mockEspn: ReturnType<typeof createMockEspnService>;

  async function settle() {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    mockEspn = createMockEspnService();

    await TestBed.configureTestingModule({
      imports: [NewsComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: EspnService, useValue: mockEspn },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NewsComponent);
    component = fixture.componentInstance;
  });

  // ── Basic creation ──────────────────────────────────────────────────────────

  it('creates the component', () => {
    expect(component).toBeTruthy();
  });

  it('renders the "News" view title', () => {
    fixture.detectChanges();
    const h1: HTMLElement = fixture.nativeElement.querySelector('h1.view-title');
    expect(h1?.textContent?.trim()).toBe('News');
  });

  // ── Filter bar ──────────────────────────────────────────────────────────────

  it('renders filter buttons for All + each league source', () => {
    fixture.detectChanges();
    const buttons = fixture.nativeElement.querySelectorAll('.filter-btn');
    // 1 (All) + 7 league sources
    expect(buttons.length).toBe(1 + SOURCE_COUNT);
  });

  it('"All" filter button is active by default', () => {
    fixture.detectChanges();
    const activeBtn: HTMLElement = fixture.nativeElement.querySelector('.filter-btn.active');
    expect(activeBtn?.textContent?.trim()).toBe('All');
  });

  it('selectedFilter defaults to "all"', () => {
    expect(component.selectedFilter()).toBe('all');
  });

  it('clicking a filter button updates selectedFilter', () => {
    fixture.detectChanges();
    const buttons: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('.filter-btn');
    // Second button is NBA
    buttons[1].click();
    expect(component.selectedFilter()).toBe('NBA');
  });

  // ── Loading state ───────────────────────────────────────────────────────────

  it('isLoading() is true immediately after first detectChanges', () => {
    fixture.detectChanges();
    expect(component.isLoading()).toBe(true);
  });

  it('isLoading() is false after all resources settle', async () => {
    fixture.detectChanges();
    await settle();
    expect(component.isLoading()).toBe(false);
  });

  it('shows skeleton cards while loading', () => {
    fixture.detectChanges();
    const skeletons = fixture.nativeElement.querySelectorAll('.skeleton-card');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('hides skeleton cards after resources settle', async () => {
    fixture.detectChanges();
    await settle();
    const skeletons = fixture.nativeElement.querySelectorAll('.skeleton-card');
    expect(skeletons.length).toBe(0);
  });

  // ── Empty state ─────────────────────────────────────────────────────────────

  it('shows empty state when all sources return no articles', async () => {
    fixture.detectChanges();
    await settle();
    const empty = fixture.nativeElement.querySelector('.empty-state');
    expect(empty).not.toBeNull();
  });

  it('allArticles() is empty when mock returns no data', async () => {
    fixture.detectChanges();
    await settle();
    expect(component.allArticles()).toEqual([]);
  });

  // ── Article rendering ───────────────────────────────────────────────────────

  it('renders article cards when getNews returns data', async () => {
    const a1 = makeArticle({ id: 'a1', sourceName: 'NBA' });
    const a2 = makeArticle({ id: 'a2', sourceName: 'MLB' });
    mockEspn.getNews.mockResolvedValueOnce([a1]).mockResolvedValueOnce([a2]).mockResolvedValue([]);

    fixture.detectChanges();
    await settle();

    const cards = fixture.nativeElement.querySelectorAll('.news-card');
    expect(cards.length).toBe(2);
  });

  it('allArticles() deduplicates articles with the same id', async () => {
    const dupe = makeArticle({ id: 'same-id' });
    mockEspn.getNews.mockResolvedValue([dupe]);

    fixture.detectChanges();
    await settle();

    // 7 sources each return the same article — dedup keeps only 1
    expect(component.allArticles().length).toBe(1);
  });

  it('allArticles() sorts newest first', async () => {
    const older = makeArticle({ id: 'old', published: new Date('2026-06-15T00:00:00Z'), sourceName: 'NBA' });
    const newer = makeArticle({ id: 'new', published: new Date('2026-06-17T00:00:00Z'), sourceName: 'MLB' });
    mockEspn.getNews.mockResolvedValueOnce([older]).mockResolvedValueOnce([newer]).mockResolvedValue([]);

    fixture.detectChanges();
    await settle();

    const articles = component.allArticles();
    expect(articles[0].id).toBe('new');
    expect(articles[1].id).toBe('old');
  });

  // ── Filtering ───────────────────────────────────────────────────────────────

  it('filteredArticles() returns all articles when filter is "all"', async () => {
    const a1 = makeArticle({ id: 'a1', sourceName: 'NBA' });
    const a2 = makeArticle({ id: 'a2', sourceName: 'MLB' });
    mockEspn.getNews.mockResolvedValueOnce([a1]).mockResolvedValueOnce([a2]).mockResolvedValue([]);

    fixture.detectChanges();
    await settle();

    expect(component.filteredArticles().length).toBe(2);
  });

  it('filteredArticles() filters to the selected source', async () => {
    const nbaArticle = makeArticle({ id: 'n1', sourceName: 'NBA' });
    const mlbArticle = makeArticle({ id: 'm1', sourceName: 'MLB' });
    mockEspn.getNews.mockResolvedValueOnce([nbaArticle]).mockResolvedValueOnce([mlbArticle]).mockResolvedValue([]);

    fixture.detectChanges();
    await settle();

    component.selectedFilter.set('NBA');
    fixture.detectChanges();

    const filtered = component.filteredArticles();
    expect(filtered.length).toBe(1);
    expect(filtered[0].sourceName).toBe('NBA');
  });

  // ── getNews call count ──────────────────────────────────────────────────────

  it('calls getNews once per league source (7 total) on init', async () => {
    fixture.detectChanges();
    await settle();
    expect(mockEspn.getNews).toHaveBeenCalledTimes(SOURCE_COUNT);
  });

  // ── timeAgo helper ──────────────────────────────────────────────────────────

  it('timeAgo returns "just now" for very recent dates', () => {
    const now = new Date();
    expect(component.timeAgo(now)).toBe('just now');
  });

  it('timeAgo returns minutes for recent dates', () => {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
    expect(component.timeAgo(thirtyMinAgo)).toBe('30m ago');
  });

  it('timeAgo returns hours for same-day dates', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    expect(component.timeAgo(threeHoursAgo)).toBe('3h ago');
  });
});
