import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { RaceStatsModalComponent } from './race-stats-modal.component';
import { makeRace } from '../../../testing/test-fixtures';
import { RaceFinisher } from '../../../core/models/game.model';

const topFinishers: RaceFinisher[] = [
  { position: 1, driverName: 'Lewis Hamilton', shortName: 'L. Hamilton', winner: true },
  { position: 2, driverName: 'Max Verstappen', shortName: 'M. Verstappen', winner: false },
  { position: 3, driverName: 'Charles Leclerc', shortName: 'C. Leclerc', winner: false },
];

describe('RaceStatsModalComponent', () => {
  let fixture: ComponentFixture<RaceStatsModalComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [RaceStatsModalComponent],
      providers: [provideZonelessChangeDetection()],
    });
    fixture = TestBed.createComponent(RaceStatsModalComponent);
  });

  // Demonstrates: component creates with the required race input.
  it('creates when the required race input is provided', () => {
    fixture.componentRef.setInput('race', makeRace());
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  // Demonstrates: race name renders in the modal header.
  it('shows race name in header', () => {
    fixture.componentRef.setInput('race', makeRace({ name: 'British Grand Prix' }));
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.race-name')?.textContent?.trim()).toBe('British Grand Prix');
  });

  // Demonstrates: status detail renders below race name.
  it('shows race status detail in header', () => {
    fixture.componentRef.setInput('race', makeRace({
      status: { state: 'post', description: 'Final', detail: 'Final' },
    }));
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.race-detail')?.textContent?.trim()).toBe('Final');
  });

  // Demonstrates: no-results placeholder when topFinishers is absent.
  it('shows "no results" message when topFinishers is undefined', () => {
    fixture.componentRef.setInput('race', makeRace({ topFinishers: undefined }));
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.no-stats')?.textContent).toContain('No results available');
  });

  // Demonstrates: finisher rows render for each entry in topFinishers.
  it('renders one finisher row per entry', () => {
    fixture.componentRef.setInput('race', makeRace({ topFinishers }));
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelectorAll('.finisher-row')).toHaveLength(3);
  });

  // Demonstrates: driver names render in order.
  it('shows driver names in position order', () => {
    fixture.componentRef.setInput('race', makeRace({ topFinishers }));
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const names = [...el.querySelectorAll('.driver-name')].map(n => n.textContent?.trim());
    expect(names).toEqual(['Lewis Hamilton', 'Max Verstappen', 'Charles Leclerc']);
  });

  // Demonstrates: winner row gets .winner class and P1 position gets .gold class.
  it('applies winner and gold classes to the P1 row', () => {
    fixture.componentRef.setInput('race', makeRace({ topFinishers }));
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const rows = el.querySelectorAll('.finisher-row');
    expect(rows[0].classList.contains('winner')).toBe(true);
    expect(rows[0].querySelector('.position')?.classList.contains('gold')).toBe(true);
    expect(rows[1].classList.contains('winner')).toBe(false);
    expect(rows[1].querySelector('.position')?.classList.contains('gold')).toBe(false);
  });

  // Demonstrates: trophy badge only appears on the winner row.
  it('shows trophy badge only for the winner row', () => {
    fixture.componentRef.setInput('race', makeRace({ topFinishers }));
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelectorAll('.winner-badge')).toHaveLength(1);
  });

  // Demonstrates: flag img renders when finisher has a flag URL.
  it('renders flag image when finisher has a flag URL', () => {
    const withFlag: RaceFinisher[] = [
      { position: 1, driverName: 'Lewis Hamilton', shortName: 'L. Hamilton', winner: true, flag: 'https://example.com/gb.png' },
    ];
    fixture.componentRef.setInput('race', makeRace({ topFinishers: withFlag }));
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const img = el.querySelector('img.flag') as HTMLImageElement | null;
    expect(img).toBeTruthy();
    expect(img?.src).toContain('example.com/gb.png');
  });

  // Demonstrates: no flag img when finisher has no flag URL.
  it('renders no flag image when finisher has no flag', () => {
    fixture.componentRef.setInput('race', makeRace({ topFinishers }));
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('img.flag')).toBeNull();
  });

  // Demonstrates: close button emits close output.
  it('emits close when close button is clicked', () => {
    fixture.componentRef.setInput('race', makeRace({ topFinishers }));
    fixture.detectChanges();
    const emitted: unknown[] = [];
    fixture.componentInstance.close.subscribe(() => emitted.push(null));
    (fixture.nativeElement.querySelector('.close-btn') as HTMLElement).click();
    expect(emitted).toHaveLength(1);
  });

  // Demonstrates: clicking the backdrop emits close.
  it('emits close when backdrop is clicked', () => {
    fixture.componentRef.setInput('race', makeRace({ topFinishers }));
    fixture.detectChanges();
    const emitted: unknown[] = [];
    fixture.componentInstance.close.subscribe(() => emitted.push(null));
    (fixture.nativeElement.querySelector('.modal-backdrop') as HTMLElement).click();
    expect(emitted).toHaveLength(1);
  });
});
