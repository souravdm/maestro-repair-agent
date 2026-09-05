'use strict';

const fs = require('fs');
const yaml = require('js-yaml');
const TestDataReportGenerator = require('./test-data-report-generator');

// Request-name maps per app, matching the ones used in test-data-report-generator.js's
// generateHtml()/buildUserCardsHtml() calls, so flag/ID derivation stays consistent with
// what the HTML report shows.
const APP_NAMES = {
  cvs: {
    profile: 'profile_retrieve', health: 'PE-health', shop: 'PE-shop',
    discovery: 'PE-discovery', medReminder: 'PE-med-reminder',
    benefits: 'benefits-plan-summaries'
  },
  h100: {
    profile: 'h100_profile_retrieve', health: 'H100-PE-health', shop: null,
    discovery: 'H100-PE-discovery', medReminder: 'H100-PE-med-reminder',
    benefits: 'H100-benefits-plan-summaries',
    haio: 'H100-home-haio-insights'
  }
};

// Boolean flag keys computed by TestDataReportGenerator.computeUserFlags() that coverage
// config's `flags:` list may reference (besides raw featureBadges.* keys).
const DERIVED_FLAG_KEYS = [
  'hasProfile', 'medEligible', 'hasCaremarkPlan', 'hasAetnaPlan',
  'hasHaio', 'hasFrontStoreOrders', 'hasExtraCare'
];

class NbaCoverageChecker {
  /**
   * @param {string} configPath - path to a nba-coverage.yaml file with `cvs`/`h100` sections,
   *   each optionally containing `anbas`, `dnbas`, `benefits`, `flags` arrays of IDs/keys.
   */
  constructor(configPath) {
    this.configPath = configPath;
    const raw = fs.readFileSync(configPath, 'utf8');
    this.config = yaml.load(raw) || {};
  }

  /**
   * Determine which benefit/flag keys were seen as `true` for at least one user, for a
   * given app, using the same derivation as buildUserCardsHtml().
   * @returns {{ benefitsSeen: Set<string>, flagsSeen: Set<string> }}
   */
  computeSeenFlags(byUser, app) {
    const names = APP_NAMES[app];
    const benefitsSeen = new Set();
    const flagsSeen = new Set();

    Object.values(byUser).forEach(ur => {
      const f = TestDataReportGenerator.computeUserFlags(ur, names);

      if (f.hasCaremarkPlan) benefitsSeen.add('hasCaremarkPlan');
      if (f.hasAetnaPlan)    benefitsSeen.add('hasAetnaPlan');

      DERIVED_FLAG_KEYS.forEach(key => { if (f[key]) flagsSeen.add(key); });
      Object.entries(f.badges || {}).forEach(([k, v]) => { if (v) flagsSeen.add(k); });
    });

    return { benefitsSeen, flagsSeen };
  }

  /**
   * Build a coverage report comparing the yaml config's expected IDs/flags against what was
   * actually observed across all users in `results`, per app.
   * @param {Array} results - flat results array (same shape test-data-runner.js accumulates)
   * @returns {Object} { cvs: { anbas: [...], dnbas: [...], benefits: [...], flags: [...] }, h100: {...} }
   *   Each category is an array of { id, covered } entries.
   */
  checkCoverage(results) {
    const byAppUser = TestDataReportGenerator.groupByAppAndUser(results);
    const report = {};

    for (const app of ['cvs', 'h100']) {
      const appConfig = this.config[app] || {};
      const byUser = byAppUser[app] || {};

      const { anbaIds: seenAnba, dnbaIds: seenDnba } = TestDataReportGenerator.collectNbaIds(byUser, app);
      const { benefitsSeen, flagsSeen } = this.computeSeenFlags(byUser, app);

      report[app] = {
        anbas: (appConfig.anbas || []).map(id => ({ id, covered: seenAnba.has(id) })),
        dnbas: (appConfig.dnbas || []).map(id => ({ id, covered: seenDnba.has(id) })),
        benefits: (appConfig.benefits || []).map(id => ({ id, covered: benefitsSeen.has(id) })),
        flags: (appConfig.flags || []).map(id => ({ id, covered: flagsSeen.has(id) }))
      };
    }

    return report;
  }

  /**
   * Flatten a coverage report into overall pass/total counts per app.
   */
  summarize(coverageResult) {
    const summary = {};
    for (const [app, categories] of Object.entries(coverageResult)) {
      let covered = 0;
      let total = 0;
      for (const items of Object.values(categories)) {
        total += items.length;
        covered += items.filter(i => i.covered).length;
      }
      summary[app] = { covered, total };
    }
    return summary;
  }

  /**
   * Render a GitHub-flavored-markdown table per app/category, suitable for
   * $GITHUB_STEP_SUMMARY or a saved .md artifact.
   */
  toMarkdownTable(coverageResult) {
    const summary = this.summarize(coverageResult);
    const lines = ['# NBA / Benefits Coverage', ''];

    for (const [app, categories] of Object.entries(coverageResult)) {
      const { covered, total } = summary[app];
      lines.push(`## ${app.toUpperCase()} — ${covered}/${total} covered`, '');

      for (const [category, items] of Object.entries(categories)) {
        if (!items.length) continue;
        lines.push(`### ${category}`, '', '| ID | Covered |', '|---|---|');
        items
          .sort((a, b) => a.id.localeCompare(b.id))
          .forEach(({ id, covered }) => {
            lines.push(`| \`${id}\` | ${covered ? '✅' : '❌'} |`);
          });
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  /**
   * Short console-friendly summary line, e.g. "CVS: 42/45 covered | H100: 18/22 covered".
   */
  toConsoleSummary(coverageResult) {
    const summary = this.summarize(coverageResult);
    return Object.entries(summary)
      .map(([app, { covered, total }]) => `${app.toUpperCase()}: ${covered}/${total} covered`)
      .join(' | ');
  }

  /**
   * True if every configured ID/flag across all apps was covered.
   */
  isFullyCovered(coverageResult) {
    return Object.values(coverageResult).every(categories =>
      Object.values(categories).every(items => items.every(i => i.covered))
    );
  }
}

module.exports = NbaCoverageChecker;
