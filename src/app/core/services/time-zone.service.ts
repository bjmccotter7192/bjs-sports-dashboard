import { Injectable, computed, signal } from '@angular/core';
import { TIME_ZONE_OPTIONS, browserTimeZone, isOverrideOption, zoneLabel } from '../config/time-zones';

export const TIME_ZONE_STORAGE_KEY = 'sports-dashboard:timezone';

/** The zone game times are shown in: a saved override, else the browser's zone. */
@Injectable({ providedIn: 'root' })
export class TimeZoneService {
  readonly browserZone = browserTimeZone();

  /** '' = follow the browser */
  private overrideState = signal(this.load());
  readonly override = this.overrideState.asReadonly();

  readonly zone = computed(() => this.overrideState() || this.browserZone);
  readonly label = computed(() => zoneLabel(this.zone()));
  readonly browserLabel = zoneLabel(this.browserZone);

  /** Pass '' to follow the browser. Anything not in TIME_ZONE_OPTIONS is ignored. */
  setOverride(zone: string) {
    if (zone && !isOverrideOption(zone)) return;
    this.overrideState.set(zone);
    try {
      if (zone) localStorage.setItem(TIME_ZONE_STORAGE_KEY, zone);
      else localStorage.removeItem(TIME_ZONE_STORAGE_KEY);
    } catch {
      // Storage blocked — keep the in-memory choice for this session
    }
  }

  readonly options = TIME_ZONE_OPTIONS;

  private load(): string {
    try {
      const stored = localStorage.getItem(TIME_ZONE_STORAGE_KEY);
      return isOverrideOption(stored) ? stored : '';
    } catch {
      return '';
    }
  }
}
