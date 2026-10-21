import {
  EMPTY_CONFIG, MAX_NAME_LENGTH, dashboardTitle, decodeShareCode, encodeShareCode, isEmptyConfig, parseStoredConfig,
  sanitizeConfig, sanitizeName, sanitizeTeam, serializeConfig,
} from './config-validation';
import { MAX_TEAMS } from './leagues.config';
import { SAMPLE_CONFIG } from '../../testing/sample-config';
import { makeConfig, makeTeamConfig } from '../../testing/dashboard-config';

function encodeRaw(value: unknown): string {
  return btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

describe('config-validation', () => {
  // ── sanitizeTeam ────────────────────────────────────────────────────────

  describe('sanitizeTeam', () => {
    it('accepts a valid team', () => {
      const team = makeTeamConfig();
      expect(sanitizeTeam(team)).toEqual(team);
    });

    it('drops unknown fields', () => {
      const result = sanitizeTeam({ ...makeTeamConfig(), extra: '<script>' });
      expect(result).not.toHaveProperty('extra');
    });

    it.each([
      ['non-numeric espnId', { espnId: '10; drop' }],
      ['unknown league', { sport: 'cricket/ipl' }],
      ['motorsport league', { sport: 'racing/f1' }],
      ['color without #', { primaryColor: '003087' }],
      ['CSS injection in color', { primaryColor: 'red; background:url(x)' }],
      ['empty name', { name: '   ' }],
      ['overlong name', { name: 'x'.repeat(61) }],
      ['non-string name', { name: 42 }],
    ])('rejects %s', (_label, override) => {
      expect(sanitizeTeam({ ...makeTeamConfig(), ...override })).toBeNull();
    });

    it('rejects non-objects', () => {
      expect(sanitizeTeam(null)).toBeNull();
      expect(sanitizeTeam('team')).toBeNull();
    });
  });

  // ── sanitizeConfig ──────────────────────────────────────────────────────

  describe('sanitizeConfig', () => {
    it('keeps a valid config intact', () => {
      expect(sanitizeConfig(SAMPLE_CONFIG)).toEqual(SAMPLE_CONFIG);
    });

    it('drops invalid and duplicate teams', () => {
      const yankees = makeTeamConfig();
      const result = sanitizeConfig({ teams: [yankees, { ...yankees }, { bogus: true }] });
      expect(result.teams).toEqual([yankees]);
    });

    it(`caps teams at ${MAX_TEAMS}`, () => {
      const teams = Array.from({ length: MAX_TEAMS + 3 }, (_, i) => makeTeamConfig({ espnId: String(i + 1) }));
      expect(sanitizeConfig({ teams }).teams).toHaveLength(MAX_TEAMS);
    });

    it('resolves series/golf slugs against the catalog and ignores unknown ones', () => {
      const result = sanitizeConfig({ teams: [], series: ['racing/irl', 'racing/f1', 'racing/fake'], golf: ['golf/pga'] });
      // catalog order, not input order
      expect(result.series.map(s => s.sport)).toEqual(['racing/f1', 'racing/irl']);
      expect(result.golf.map(g => g.sport)).toEqual(['golf/pga']);
    });

    it('returns an empty config for garbage', () => {
      expect(sanitizeConfig(undefined)).toEqual(EMPTY_CONFIG);
      expect(sanitizeConfig({ teams: 'nope' })).toEqual(EMPTY_CONFIG);
    });
  });

  // ── localStorage format ─────────────────────────────────────────────────

  describe('serializeConfig / parseStoredConfig', () => {
    it('round-trips a config', () => {
      expect(parseStoredConfig(serializeConfig(SAMPLE_CONFIG))).toEqual(SAMPLE_CONFIG);
    });

    it('stores series and golf as slugs only', () => {
      const stored = JSON.parse(serializeConfig(SAMPLE_CONFIG));
      expect(stored.series).toEqual(['racing/f1', 'racing/nascar-premier', 'racing/irl']);
      expect(stored.golf).toEqual(['golf/pga']);
    });

    it('returns an empty config for missing, malformed, or unknown-version data', () => {
      expect(parseStoredConfig(null)).toEqual(EMPTY_CONFIG);
      expect(parseStoredConfig('{not json')).toEqual(EMPTY_CONFIG);
      expect(parseStoredConfig(JSON.stringify({ v: 99, teams: [makeTeamConfig()] }))).toEqual(EMPTY_CONFIG);
    });
  });

  // ── Share codes ─────────────────────────────────────────────────────────

  describe('encodeShareCode / decodeShareCode', () => {
    it('round-trips team ids, colors, series, and golf', () => {
      const decoded = decodeShareCode(encodeShareCode(SAMPLE_CONFIG))!;
      expect(decoded.teams).toEqual(SAMPLE_CONFIG.teams.map(t => ({
        sport: t.sport, espnId: t.espnId, primaryColor: t.primaryColor, secondaryColor: t.secondaryColor,
      })));
      expect(decoded.series).toEqual(SAMPLE_CONFIG.series.map(s => s.sport));
      expect(decoded.golf).toEqual(['golf/pga']);
    });

    it('produces a URL-safe code', () => {
      expect(encodeShareCode(SAMPLE_CONFIG)).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('never carries team names', () => {
      const json = atob(encodeShareCode(SAMPLE_CONFIG).replace(/-/g, '+').replace(/_/g, '/') + '==');
      expect(json).not.toContain('Yankees');
    });

    it.each([
      ['null', null],
      ['empty', ''],
      ['non-base64url characters', 'abc$%^'],
      ['not JSON', btoa('hello')],
      ['oversized', 'A'.repeat(2001)],
      ['wrong version', encodeRaw({ v: 2, t: [], s: [], g: [] })],
      ['missing teams array', encodeRaw({ v: 1 })],
    ])('rejects %s', (_label, code) => {
      expect(decodeShareCode(code as string | null)).toBeNull();
    });

    it('skips invalid team entries but keeps valid ones', () => {
      const code = encodeRaw({
        v: 1,
        t: [['baseball/mlb', '10'], ['cricket/ipl', '1'], ['baseball/mlb', 'abc'], 'junk', ['baseball/mlb', '10']],
        s: ['racing/f1', 'racing/fake'],
        g: [],
      });
      const decoded = decodeShareCode(code)!;
      expect(decoded.teams).toEqual([{ sport: 'baseball/mlb', espnId: '10' }]);
      expect(decoded.series).toEqual(['racing/f1']);
    });

    it('drops colors unless both are valid hex', () => {
      const code = encodeRaw({ v: 1, t: [['baseball/mlb', '10', '#003087', 'url(x)']], s: [], g: [] });
      expect(decodeShareCode(code)!.teams[0]).toEqual({ sport: 'baseball/mlb', espnId: '10' });
    });
  });

  it('isEmptyConfig is true only when nothing is selected', () => {
    expect(isEmptyConfig(makeConfig())).toBe(true);
    expect(isEmptyConfig(makeConfig({ teams: [makeTeamConfig()] }))).toBe(false);
    expect(isEmptyConfig(makeConfig({ golf: [...SAMPLE_CONFIG.golf] }))).toBe(false);
  });

  describe('sanitizeName / dashboardTitle', () => {
    it('strips control characters and caps the length', () => {
      expect(sanitizeName('BJ\u0000\n\u007f')).toBe('BJ');
      expect(sanitizeName('x'.repeat(50))).toHaveLength(MAX_NAME_LENGTH);
    });

    it('keeps spaces so typing is not disrupted', () => {
      expect(sanitizeName('The ')).toBe('The ');
    });

    it('returns empty for non-strings', () => {
      expect(sanitizeName(null)).toBe('');
      expect(sanitizeName(42)).toBe('');
    });

    it('builds the title from a trimmed name, or a neutral default', () => {
      expect(dashboardTitle("  BJ's ")).toBe("BJ's Sports Dashboard");
      expect(dashboardTitle('   ')).toBe('Sports Dashboard');
    });
  });

  it('accepts teams from every team league in the registry', () => {
    for (const sport of ['basketball/wnba', 'soccer/usa.1', 'soccer/eng.1', 'soccer/usa.nwsl', 'football/college-football',
      'basketball/mens-college-basketball', 'basketball/womens-college-basketball']) {
      expect(sanitizeTeam(makeTeamConfig({ sport: sport as never }))).not.toBeNull();
    }
  });
});
