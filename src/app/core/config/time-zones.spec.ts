import {
  TIME_ZONE_OPTIONS, browserTimeZone, dateKeyInZone, formatInZone, isOverrideOption, isValidTimeZone, zoneLabel,
} from './time-zones';

const SUMMER = new Date('2026-06-22T17:05:00Z');   // 1:05 PM EDT
const WINTER = new Date('2026-01-10T01:05:00Z');   // 8:05 PM EST on Jan 9

describe('time-zones', () => {
  it('formats date + time with a stable US label', () => {
    expect(formatInZone(SUMMER, 'America/Detroit', 'dateTime')).toBe('Jun 22 · 1:05 PM ET');
    expect(formatInZone(SUMMER, 'America/Chicago', 'dateTime')).toBe('Jun 22 · 12:05 PM CT');
    expect(formatInZone(SUMMER, 'America/Los_Angeles', 'time')).toBe('10:05 AM PT');
  });

  it('applies DST per date in the target zone', () => {
    expect(formatInZone(WINTER, 'America/New_York', 'dateTime')).toBe('Jan 9 · 8:05 PM ET');
    expect(formatInZone(WINTER, 'America/Chicago', 'time')).toBe('7:05 PM CT');
  });

  it.each([
    ['America/Detroit', 'ET'],
    ['America/Indiana/Indianapolis', 'ET'],
    ['America/Toronto', 'ET'],
    ['America/Denver', 'MT'],
    ['America/Phoenix', 'MST'],
    ['America/Anchorage', 'AKT'],
    ['Pacific/Honolulu', 'HT'],
    ['Europe/London', 'UK'],
    ['UTC', 'UTC'],
  ])('labels %s as %s', (zone, label) => {
    expect(zoneLabel(zone, SUMMER)).toBe(label);
  });

  it("falls back to Intl's short name for zones without a US label", () => {
    expect(zoneLabel('America/Bogota', SUMMER)).toBe('GMT-5');
  });

  it('keys a moment by its calendar day in the zone', () => {
    // 2026-06-23 04:30 UTC is still June 22 on the West Coast
    const late = new Date('2026-06-23T04:30:00Z');
    expect(dateKeyInZone(late, 'America/Los_Angeles')).toBe('20260622');
    expect(dateKeyInZone(late, 'America/New_York')).toBe('20260623');
  });

  it('validates zones', () => {
    expect(isValidTimeZone('America/Detroit')).toBe(true);
    expect(isValidTimeZone('Not/AZone')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
    expect(isValidTimeZone(42)).toBe(false);
  });

  it('only accepts curated zones as overrides', () => {
    expect(TIME_ZONE_OPTIONS.every(o => isValidTimeZone(o.zone))).toBe(true);
    expect(isOverrideOption('America/Chicago')).toBe(true);
    expect(isOverrideOption('America/Detroit')).toBe(false);
    expect(isOverrideOption(null)).toBe(false);
  });

  it('returns the browser zone, or Eastern when Intl gives nothing usable', () => {
    expect(isValidTimeZone(browserTimeZone())).toBe(true);
    const spy = vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions')
      .mockReturnValue({ timeZone: undefined } as unknown as Intl.ResolvedDateTimeFormatOptions);
    expect(browserTimeZone()).toBe('America/New_York');
    spy.mockRestore();
  });
});
