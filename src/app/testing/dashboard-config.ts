/**
 * Test helpers for DashboardConfigService.
 *
 * Usage:
 *   providers: [provideDashboardConfig(makeConfig({ teams: [yankees] }))]
 */
import { signal } from '@angular/core';
import { DashboardConfigService } from '../core/services/dashboard-config.service';
import { DashboardConfig, TeamConfig } from '../core/models/team-config.model';
import { DEFAULT_CONFIG } from '../core/config/teams.config';

export function provideDashboardConfig(config: DashboardConfig = DEFAULT_CONFIG) {
  return { provide: DashboardConfigService, useValue: { config: signal(config).asReadonly() } };
}

export function makeConfig(overrides: Partial<DashboardConfig> = {}): DashboardConfig {
  return { teams: [], series: [], golf: [], ...overrides };
}

export function makeTeamConfig(overrides: Partial<TeamConfig> = {}): TeamConfig {
  return {
    kind: 'team',
    espnId: '10',
    abbreviation: 'NYY',
    name: 'New York Yankees',
    shortName: 'Yankees',
    sport: 'baseball/mlb',
    primaryColor: '#003087',
    secondaryColor: '#E4E4E4',
    ...overrides,
  };
}
