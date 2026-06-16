/**
 * MotorsportPanelComponent unit tests.
 *
 * KEY CONCEPTS:
 *
 * - provideZonelessChangeDetection() opts the TestBed out of Zone.js so
 *   change detection is explicit — we drive it via fixture.detectChanges().
 * - signal inputs set via fixture.componentRef.setInput(); the component has
 *   no constructor injection so tests are fully synchronous.
 * - MotorsportPanelComponent imports DatePipe (standalone), so Angular's
 *   compiler resolves it automatically when the component is in TestBed imports.
 * - DOM queries verify rendered output rather than component properties, making
 *   the tests resilient to internal refactors.
 */
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { MotorsportPanelComponent } from './motorsport-panel.component';
import { SeriesConfig } from '../../../core/models/team-config.model';
import { makeRace } from '../../../testing/test-fixtures';

// ── Shared fixture config ────────────────────────────────────────────────────

// Minimal SeriesConfig — only the fields MotorsportPanelComponent reads.
const f1: SeriesConfig = {
  kind: 'series',
  name: 'Formula 1',
  shortName: 'F1',
  sport: 'racing/f1',
  primaryColor: '#E10600',
  secondaryColor: '#1f1f1f',
};

// Helper to keep TestBed creation DRY.
function createFixture(): ComponentFixture<MotorsportPanelComponent> {
  return TestBed.createComponent(MotorsportPanelComponent);
}

// ── Spec suite ───────────────────────────────────────────────────────────────

// Demonstrates: zoneless TestBed setup for a standalone component with an imported pipe.
describe('MotorsportPanelComponent', () => {
  let fixture: ComponentFixture<MotorsportPanelComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      // DatePipe is resolved transitively because the component declares it in imports.
      imports: [MotorsportPanelComponent],
      providers: [provideZonelessChangeDetection()],
    });
    fixture = createFixture();
  });

  // Demonstrates: input.required() — component is usable as soon as setInput is called.
  it('creates when the required series input is provided', () => {
    fixture.componentRef.setInput('series', f1);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  // Demonstrates: default null value of optional race input shows the no-race placeholder.
  it('shows "No race data" placeholder when race input is null', () => {
    fixture.componentRef.setInput('series', f1);
    // race is not set — defaults to null per input<Race | null>(null).
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.no-race-text')?.textContent).toContain('No race data');
  });

  // Demonstrates: stateLabel computed returns 'NEXT RACE' for pre state.
  it('shows "NEXT RACE" label when race state is pre', () => {
    const race = makeRace({ status: { state: 'pre', description: 'Scheduled', detail: 'Scheduled' } });

    fixture.componentRef.setInput('series', f1);
    fixture.componentRef.setInput('race', race);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.race-state-label')?.textContent?.trim()).toBe('NEXT RACE');
  });

  // Demonstrates: stateLabel computed returns 'LAST RACE' for post state.
  it('shows "LAST RACE" label when race state is post', () => {
    const race = makeRace({
      status: { state: 'post', description: 'Final', detail: 'Final' },
      winner: { driverName: 'Max Verstappen', teamName: 'Red Bull Racing' },
    });

    fixture.componentRef.setInput('series', f1);
    fixture.componentRef.setInput('race', race);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.race-state-label')?.textContent?.trim()).toBe('LAST RACE');
  });

  // Demonstrates: winner block rendered only when state is post and race.winner is set.
  it('shows winner driver name when state is post and a winner is present', () => {
    const race = makeRace({
      status: { state: 'post', description: 'Final', detail: 'Final' },
      winner: { driverName: 'Lewis Hamilton', teamName: 'Ferrari' },
    });

    fixture.componentRef.setInput('series', f1);
    fixture.componentRef.setInput('race', race);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    const winnerName = el.querySelector('.winner-name')?.textContent?.trim();
    expect(winnerName).toBe('Lewis Hamilton');
  });

  // Demonstrates: race name is always rendered in the panel body when a race is provided.
  it('shows the race name', () => {
    const race = makeRace({
      name: 'British Grand Prix',
      status: { state: 'pre', description: 'Scheduled', detail: 'Scheduled' },
    });

    fixture.componentRef.setInput('series', f1);
    fixture.componentRef.setInput('race', race);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.race-name')?.textContent?.trim()).toBe('British Grand Prix');
  });
});
