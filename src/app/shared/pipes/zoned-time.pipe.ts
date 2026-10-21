import { Pipe, PipeTransform } from '@angular/core';
import { ZonedStyle, formatInZone } from '../../core/config/time-zones';

/**
 * `{{ game.date | zonedTime: zone() : 'dateTime' }}` → "Jun 22 · 1:05 PM ET".
 * Takes the zone as an argument (rather than injecting it) so the pipe stays pure
 * and re-renders when the zone signal changes.
 */
@Pipe({ name: 'zonedTime' })
export class ZonedTimePipe implements PipeTransform {
  transform(value: Date | null | undefined, zone: string, style: ZonedStyle = 'dateTime'): string {
    if (!value) return '';
    return formatInZone(value, zone, style);
  }
}
