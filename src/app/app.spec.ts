import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Component, provideZonelessChangeDetection } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { App } from './app';
import { CONFIG_STORAGE_KEY, NAME_STORAGE_KEY } from './core/services/dashboard-config.service';
import { serializeConfig } from './core/config/config-validation';
import { makeConfig, makeTeamConfig } from './testing/dashboard-config';
import { routes } from './app.routes';

describe('App', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes), provideZonelessChangeDetection()],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the nav bar', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.navbar')).toBeTruthy();
    expect(compiled.querySelector('.brand-title')?.textContent?.trim()).toBe('Sports Dashboard');
  });

  it('uses the saved dashboard name in the nav bar and browser tab', async () => {
    localStorage.setItem(NAME_STORAGE_KEY, "BJ's");
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).querySelector('.brand-title')?.textContent?.trim()).toBe("BJ's Sports Dashboard");
    expect(TestBed.inject(Title).getTitle()).toBe("BJ's Sports Dashboard");
  });

  it('links to Settings with a labelled gear icon', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const link = (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>('.navbar-links a.settings-link')!;
    expect(link.getAttribute('aria-label')).toBe('Settings');
    expect(link.getAttribute('href')).toContain('/settings');
    expect(link.querySelector('svg.gear-icon')).not.toBeNull();
    expect(link.textContent?.trim()).toBe('');
  });

  // ── Leagues ▾ dropdown ────────────────────────────────────────────────────

  function withTeams() {
    localStorage.setItem(CONFIG_STORAGE_KEY, serializeConfig(makeConfig({ teams: [
      makeTeamConfig({ espnId: '13', sport: 'hockey/nhl' }),
      makeTeamConfig({ espnId: '18', sport: 'basketball/nba' }),
    ] })));
  }

  it('hides the Leagues dropdown when no teams are followed', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.leagues-dropdown')).toBeNull();
  });

  it('lists followed leagues in the dropdown and closes on Escape or outside click', async () => {
    withTeams();
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const toggle = root.querySelector<HTMLButtonElement>('.dropdown-toggle')!;
    expect(root.querySelector('.dropdown-menu')).toBeNull();

    toggle.click();
    fixture.detectChanges();
    const links = [...root.querySelectorAll<HTMLAnchorElement>('.dropdown-menu a')];
    expect(links.map(a => a.textContent?.trim())).toEqual(['NBA', 'NHL']);
    expect(links[0].getAttribute('href')).toContain('/league/nba');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(root.querySelector('.dropdown-menu')).toBeNull();

    toggle.click();
    fixture.detectChanges();
    document.body.click();
    fixture.detectChanges();
    expect(root.querySelector('.dropdown-menu')).toBeNull();
  });

  it('closes the dropdown after picking a league', async () => {
    withTeams();
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('.dropdown-toggle')!.click();
    fixture.detectChanges();
    root.querySelector<HTMLAnchorElement>('.dropdown-menu a')!.click();
    fixture.detectChanges();
    expect(root.querySelector('.dropdown-menu')).toBeNull();
  });

  it('highlights the Leagues toggle only while on a /league/ page', async () => {
    withTeams();
    const router = TestBed.inject(Router);
    router.resetConfig([
      { path: 'league/:league', component: StubPage },
      { path: 'today', component: StubPage },
    ]);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const toggle = () => (fixture.nativeElement as HTMLElement).querySelector('.dropdown-toggle')!;
    expect(toggle().classList.contains('active')).toBe(false);

    await router.navigateByUrl('/league/nba');
    fixture.detectChanges();
    expect(toggle().classList.contains('active')).toBe(true);

    await router.navigateByUrl('/today');
    fixture.detectChanges();
    expect(toggle().classList.contains('active')).toBe(false);
  });

  // ── Mobile menu ───────────────────────────────────────────────────────────

  function openMobileMenu() {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('.hamburger')!.click();
    fixture.detectChanges();
    return { fixture, root };
  }

  it('opens and closes the mobile menu from the hamburger button', () => {
    const { fixture, root } = openMobileMenu();
    const hamburger = root.querySelector<HTMLButtonElement>('.hamburger')!;
    expect(root.querySelector('.mobile-menu')).not.toBeNull();
    expect(hamburger.classList.contains('open')).toBe(true);

    hamburger.click();
    fixture.detectChanges();
    expect(root.querySelector('.mobile-menu')).toBeNull();
    expect(hamburger.classList.contains('open')).toBe(false);
  });

  it('closes the mobile menu when the overlay is clicked', () => {
    const { fixture, root } = openMobileMenu();
    root.querySelector<HTMLElement>('.mobile-menu-overlay')!.click();
    fixture.detectChanges();
    expect(root.querySelector('.mobile-menu')).toBeNull();
    expect(root.querySelector('.mobile-menu-overlay')).toBeNull();
  });

  it('lists every nav link in the mobile menu and closes it when any is clicked', () => {
    withTeams();
    const { fixture, root } = openMobileMenu();
    const labels = [...root.querySelectorAll<HTMLAnchorElement>('.mobile-menu a')].map(a => a.textContent?.trim());
    expect(labels).toEqual(['Last Played', 'Today', 'Schedule', 'News', 'NBA', 'NHL', 'Settings']);
    expect(root.querySelector('.mobile-section-label')?.textContent).toBe('Leagues');

    for (let i = 0; i < labels.length; i++) {
      if (!root.querySelector('.mobile-menu')) {
        root.querySelector<HTMLButtonElement>('.hamburger')!.click();
        fixture.detectChanges();
      }
      root.querySelectorAll<HTMLAnchorElement>('.mobile-menu a')[i].click();
      fixture.detectChanges();
      expect(root.querySelector('.mobile-menu'), `after clicking ${labels[i]}`).toBeNull();
    }
  });

  it('hides the Leagues section of the mobile menu when no teams are followed', () => {
    const { root } = openMobileMenu();
    expect(root.querySelector('.mobile-section-label')).toBeNull();
    expect(root.querySelector('.mobile-sub-link')).toBeNull();
  });

  it('closes the mobile menu when the window grows past 768px but not below it', () => {
    const { fixture, root } = openMobileMenu();
    const width = vi.spyOn(window, 'innerWidth', 'get');

    width.mockReturnValue(768);
    window.dispatchEvent(new Event('resize'));
    fixture.detectChanges();
    expect(root.querySelector('.mobile-menu')).not.toBeNull();

    width.mockReturnValue(1024);
    window.dispatchEvent(new Event('resize'));
    fixture.detectChanges();
    expect(root.querySelector('.mobile-menu')).toBeNull();
    width.mockRestore();
  });
});

@Component({ template: '' })
class StubPage {}
