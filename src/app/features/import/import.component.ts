import { Component, computed, inject, resource } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { EspnService } from '../../core/services/espn.service';
import { DashboardConfigService } from '../../core/services/dashboard-config.service';
import { SharedSelection, decodeShareCode, isEmptyConfig, teamKey } from '../../core/config/config-validation';
import { GOLF_OPTIONS, SERIES_OPTIONS, leagueLabel } from '../../core/config/leagues.config';
import { DashboardConfig, League, TeamColors, TeamConfig, TeamOption } from '../../core/models/team-config.model';
import { fetchAll } from '../../core/utils/fetch-all';

/**
 * Applies a share link (#/import?c=...). The link only carries league + team ids
 * (and optional colors); names, abbreviations, and missing colors are resolved from ESPN.
 */
@Component({
  selector: 'app-import',
  imports: [RouterLink],
  templateUrl: './import.component.html',
  styleUrl: './import.component.scss',
})
export class ImportComponent {
  private espn = inject(EspnService);
  private store = inject(DashboardConfigService);
  private router = inject(Router);

  readonly selection = decodeShareCode(inject(ActivatedRoute).snapshot.queryParamMap.get('c'));
  readonly replacesExisting = !this.store.isEmpty();

  private resolved = resource({
    // undefined (invalid link) leaves the resource idle — nothing is fetched
    params: () => this.selection ?? undefined,
    loader: ({ params }) => this.resolve(params),
  });

  readonly isLoading = this.resolved.isLoading;

  /** The config this link would produce, with teams resolved against ESPN. */
  readonly preview = computed(() => this.resolved.hasValue() ? this.resolved.value() : null);

  readonly isEmptyPreview = computed(() => {
    const p = this.preview();
    return !p || isEmptyConfig(p.config);
  });

  private async resolve(sel: SharedSelection): Promise<{ config: DashboardConfig; missing: number }> {
    const options = await fetchAll(sel.teams.map(t => t.sport), sport => this.espn.getTeams(sport), [] as TeamOption[]);
    const matched = sel.teams.flatMap(ref => {
      const option = options.get(ref.sport)?.find(o => teamKey(o.config) === teamKey(ref));
      return option ? [{ ref, config: option.config }] : [];
    });

    // Picker options carry placeholder colors; fetch real ones for teams the link has none for
    const needColors = matched.filter(m => !m.ref.primaryColor).map(m => m.config);
    const colors = await fetchAll(
      needColors,
      t => this.espn.getTeamColors(t.sport, t.espnId) as Promise<TeamColors | null>,
      null
    );

    const teams: TeamConfig[] = matched.map(({ ref, config }) =>
      ref.primaryColor && ref.secondaryColor
        ? { ...config, primaryColor: ref.primaryColor, secondaryColor: ref.secondaryColor }
        : { ...config, ...(colors.get(config) ?? {}) }
    );
    return {
      config: {
        teams,
        series: SERIES_OPTIONS.filter(o => sel.series.includes(o.sport)),
        golf: GOLF_OPTIONS.filter(o => sel.golf.includes(o.sport)),
      },
      missing: sel.teams.length - teams.length,
    };
  }

  label(slug: League) {
    return leagueLabel(slug);
  }

  apply() {
    const p = this.preview();
    if (!p || isEmptyConfig(p.config)) return;
    this.store.replace(p.config);
    this.router.navigate(['/today']);
  }
}
