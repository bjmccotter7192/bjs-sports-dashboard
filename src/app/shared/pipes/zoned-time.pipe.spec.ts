import { ZonedTimePipe } from './zoned-time.pipe';

describe('ZonedTimePipe', () => {
  const pipe = new ZonedTimePipe();
  const date = new Date('2026-06-22T23:05:00Z');

  it('formats a date with day, time and zone label by default', () => {
    expect(pipe.transform(date, 'America/New_York')).toBe('Jun 22 · 7:05 PM ET');
  });

  it("formats only the time with the 'time' style", () => {
    expect(pipe.transform(date, 'America/Los_Angeles', 'time')).toBe('4:05 PM PT');
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
  ])('returns an empty string for a %s date', (_label, value) => {
    expect(pipe.transform(value, 'America/New_York')).toBe('');
  });

  it('returns an empty string instead of throwing for an invalid date', () => {
    expect(pipe.transform(new Date('not a date'), 'America/New_York')).toBe('');
  });
});
