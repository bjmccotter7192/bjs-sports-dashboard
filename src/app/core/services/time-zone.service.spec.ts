import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TIME_ZONE_STORAGE_KEY, TimeZoneService } from './time-zone.service';
import { browserTimeZone } from '../config/time-zones';

describe('TimeZoneService', () => {
  function create(): TimeZoneService {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    return TestBed.inject(TimeZoneService);
  }

  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('follows the browser zone by default', () => {
    const service = create();
    expect(service.override()).toBe('');
    expect(service.zone()).toBe(browserTimeZone());
  });

  it('setOverride switches the zone and label, and persists', () => {
    const service = create();
    service.setOverride('America/Los_Angeles');
    expect(service.zone()).toBe('America/Los_Angeles');
    expect(service.label()).toBe('PT');
    expect(localStorage.getItem(TIME_ZONE_STORAGE_KEY)).toBe('America/Los_Angeles');
  });

  it("setOverride('') returns to the browser zone and clears storage", () => {
    const service = create();
    service.setOverride('America/Chicago');
    service.setOverride('');
    expect(service.zone()).toBe(service.browserZone);
    expect(localStorage.getItem(TIME_ZONE_STORAGE_KEY)).toBeNull();
  });

  it('ignores zones outside the curated list', () => {
    const service = create();
    service.setOverride('Not/AZone');
    service.setOverride('America/Bogota');
    expect(service.override()).toBe('');
  });

  it('loads a saved override and ignores a tampered one', () => {
    localStorage.setItem(TIME_ZONE_STORAGE_KEY, 'America/Denver');
    expect(create().zone()).toBe('America/Denver');

    TestBed.resetTestingModule();
    localStorage.setItem(TIME_ZONE_STORAGE_KEY, '<script>');
    expect(create().override()).toBe('');
  });

  it('starts on the browser zone when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(create().override()).toBe('');
  });
});
