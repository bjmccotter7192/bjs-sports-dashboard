import { Injectable, signal } from '@angular/core';
import { DashboardConfig } from '../models/team-config.model';
import { DEFAULT_CONFIG } from '../config/teams.config';

/** Source of truth for which teams/series the dashboard shows. */
@Injectable({ providedIn: 'root' })
export class DashboardConfigService {
  readonly config = signal<DashboardConfig>(DEFAULT_CONFIG).asReadonly();
}
