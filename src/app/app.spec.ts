import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideZonelessChangeDetection } from '@angular/core';
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
});
