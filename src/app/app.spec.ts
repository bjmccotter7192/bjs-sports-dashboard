import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideZonelessChangeDetection } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { App } from './app';
import { NAME_STORAGE_KEY } from './core/services/dashboard-config.service';
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
});
