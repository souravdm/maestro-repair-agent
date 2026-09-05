'use strict';

const fs = require('fs');
const path = require('path');

class TestDataReportGenerator {
  constructor(artifactsDir) {
    this.artifactsDir = artifactsDir;
  }

  buildCurl(result) {
    const req     = result.request || {};
    const method  = (req.method || 'GET').toUpperCase();
    const url     = req.url || result.url || '';
    const headers = req.headers || {};
    const body    = req.body;
    const headerFlags = Object.entries(headers)
      .map(([k, v]) => `  -H '${k}: ${String(v).replace(/'/g, "'\\''")}'`)
      .join(' \\\n');
    const bodyFlag = body != null
      ? ` \\\n  -d '${JSON.stringify(body).replace(/'/g, "'\\''")}'`
      : '';
    return `curl -X ${method} '${url}' \\\n${headerFlags}${bodyFlag}`;
  }

  curlBlock(result, uid) {
    if (!result || !result.request) return '';
    return `
      <div class="sub-label" style="margin-top:14px">cURL</div>
      <div style="display:flex;justify-content:flex-end;margin-bottom:4px">
        <button class="curl-btn" onclick="copyCurl(event,'curl-${uid}')">Copy</button>
      </div>
      <pre class="code curl-block" id="curl-${uid}">${this.escapeHtml(this.buildCurl(result))}</pre>`;
  }

  escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Build a per-user map of { user → { requestName → result } }
   * from a flat results array (each result has result.user and result.name).
   */
  groupByUser(results) {
    const map = {};
    for (const r of results) {
      const user = r.user || 'unknown';
      if (!map[user]) map[user] = {};
      map[user][r.name] = r;
    }
    return map;
  }

  /**
   * Render error detail HTML for a failed request.
   */
  failureHtml(result) {
    const code = result.statusCode || '—';
    const msg  = result.error ? this.escapeHtml(result.error) : `HTTP ${code}`;
    const body = result.data != null
      ? `<pre class="code">${this.escapeHtml(JSON.stringify(result.data, null, 2))}</pre>`
      : '';
    return `<p class="fail">❌ Failed (${code}) — ${msg}</p>${body}`;
  }

  /**
   * Render a collapsible section block.
   */
  section(title, contentHtml, uid, defaultOpen = false) {
    const openClass = defaultOpen ? ' open' : '';
    const chevron = defaultOpen ? '▼' : '▶';
    return `
      <div class="section${openClass}" id="sec-${uid}">
        <div class="section-header" onclick="toggleSection('sec-${uid}')">
          <span class="sec-chevron" id="sc-${uid}">${chevron}</span>
          <span>${this.escapeHtml(title)}</span>
        </div>
        <div class="section-body">${contentHtml}</div>
      </div>`;
  }

  /**
   * Render a key-value table from a flat object.
   */
  kvTable(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      return `<pre class="code">${this.escapeHtml(JSON.stringify(obj, null, 2))}</pre>`;
    }
    const rows = Object.entries(obj)
      .map(([k, v]) => {
        const val = v == null ? '<span class="null">null</span>'
          : typeof v === 'object' ? `<pre class="code inline">${this.escapeHtml(JSON.stringify(v, null, 2))}</pre>`
          : `<span>${this.escapeHtml(String(v))}</span>`;
        return `<tr><td class="kv-key">${this.escapeHtml(k)}</td><td class="kv-val">${val}</td></tr>`;
      }).join('');
    return `<table class="kv-table">${rows}</table>`;
  }

  /**
   * Render a list of NBA items.
   */
  nbaList(items, label) {
    if (!Array.isArray(items) || items.length === 0) {
      return `<p class="empty">No ${label} found.</p>`;
    }
    return items.map((nba, i) => {
      const title = nba.actionId || nba.nbaId || nba.id || nba.title || nba.type || `Item ${i + 1}`;
      return `<div class="nba-item">
        <div class="nba-title">${this.escapeHtml(String(title))}</div>
        <pre class="code">${this.escapeHtml(JSON.stringify(nba, null, 2))}</pre>
      </div>`;
    }).join('');
  }

  /**
   * Build profile section HTML.
   */
  buildProfileSection(result, uid, authResults = []) {
    if (!result || !result.success) {
      const failed = !result
        ? authResults.find(r => r && !r.success && !r.skipped)
        : result;
      if (failed) {
        const stepHtml = `<p class="fail-step">Auth stopped at: <code>${this.escapeHtml(failed.name)}</code></p>`;
        return this.section('👤 Profile', stepHtml + this.failureHtml(failed), uid);
      }
      return this.section('👤 Profile', '<p class="empty">Not available (request did not run)</p>', uid);
    }

    const d = result.extractedData || {};
    const rows = [
      ['Profile ID', d.profileId],
      ['Email', d.email],
      ['First Name', d.firstName],
      ['Last Name', d.lastName],
      ['Date of Birth', d.dateOfBirth],
      ['Level of Assurance', d.levelOfAssurance],
    ].filter(([, v]) => v != null);

    const basicHtml = rows.length
      ? `<table class="kv-table">${rows.map(([k, v]) => `<tr><td class="kv-key">${k}</td><td class="kv-val">${this.escapeHtml(v)}</td></tr>`).join('')}</table>`
      : '<p class="empty">No basic profile fields extracted.</p>';

    const phonesHtml = d.phones
      ? `<pre class="code">${this.escapeHtml(JSON.stringify(d.phones, null, 2))}</pre>`
      : '<p class="empty">No phone numbers.</p>';

    const ecHtml = d.extraCareCard
      ? this.kvTable(d.extraCareCard)
      : '<p class="empty">No ExtraCare card data.</p>';

    const idTypeSummaryHtml = d.linkedIds
      ? d.linkedIds.map(l => {
          const label = l.idType || l.sourceSystemName || '?';
          return `<span style="display:inline-block;margin:2px 4px 2px 0;padding:2px 8px;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:4px;font-size:11px;font-family:monospace;color:#334155">${this.escapeHtml(label)}</span>`;
        }).join('')
      : '<p class="empty">No linked IDs.</p>';

    const linkedHtml = d.linkedIds
      ? `<pre class="code">${this.escapeHtml(JSON.stringify(d.linkedIds, null, 2))}</pre>`
      : '';

    const inner = `
      <div class="sub-label">Basic Info</div>${basicHtml}
      <div class="sub-label">Phone Numbers</div>${phonesHtml}
      <div class="sub-label">ExtraCare Card</div>${ecHtml}
      <div class="sub-label">Linked ID Types</div><div style="padding:4px 0 8px">${idTypeSummaryHtml}</div>
      <div class="sub-label">Linked IDs (raw)</div>${linkedHtml || '<p class="empty">—</p>'}
      ${this.curlBlock(result, uid)}`;

    return this.section('👤 Profile', inner, uid, true);
  }

  /**
   * Build PE-Health section HTML.
   */
  buildHealthSection(result, uid) {
    if (!result) return this.section('🏥 PE-Health', '<p class="empty">Not available (request did not run)</p>', uid);
    if (!result.success) return this.section('🏥 PE-Health', this.failureHtml(result), uid);

    const d = result.extractedData || {};

    let lobHtml = '<p class="empty">No NBA data by LOB.</p>';
    if (d.nbaDataByLob && Object.keys(d.nbaDataByLob).length) {
      lobHtml = Object.entries(d.nbaDataByLob).map(([lob, entry]) => `
        <div class="lob-block">
          <div class="lob-title">${this.escapeHtml(lob)}</div>
          <pre class="code">${this.escapeHtml(JSON.stringify(entry, null, 2))}</pre>
        </div>`).join('');
    }

    const priorityHtml = d.priorityNbas
      ? this.nbaList(Array.isArray(d.priorityNbas) ? d.priorityNbas : [d.priorityNbas], 'priority NBAs')
      : '<p class="empty">No priority NBAs.</p>';

    const activityHtml = d.activityNbas
      ? this.nbaList(Array.isArray(d.activityNbas) ? d.activityNbas : [d.activityNbas], 'activity NBAs')
      : '<p class="empty">No activity NBAs.</p>';

    const additionalHtml = d.additionalData
      ? `<pre class="code">${this.escapeHtml(JSON.stringify(d.additionalData, null, 2))}</pre>`
      : '<p class="empty">No additional data.</p>';

    const inner = `
      <div class="sub-label">NBA Data by Line of Business</div>${lobHtml}
      <div class="sub-label">Priority NBAs</div>${priorityHtml}
      <div class="sub-label">Activity NBAs</div>${activityHtml}
      <div class="sub-label">Additional Data</div>${additionalHtml}
      ${this.curlBlock(result, uid)}`;

    return this.section('🏥 PE-Health', inner, uid);
  }

  /**
   * Build PE-Discovery section HTML.
   */
  buildDiscoverySection(result, uid) {
    if (!result) return this.section('🔍 PE-Discovery', '<p class="empty">Not available (request did not run)</p>', uid);
    if (!result.success) return this.section('🔍 PE-Discovery', this.failureHtml(result), uid);

    const d = result.extractedData || {};

    // CVS: nbaList[].nbaCardId  |  H100: dnba[].id + optional xpo/ehg arrays
    let nbaListHtml;
    if (d.nbaList) {
      nbaListHtml = this.nbaList(Array.isArray(d.nbaList) ? d.nbaList : [d.nbaList], 'discovery NBAs');
    } else if (d.dnba) {
      const items = Array.isArray(d.dnba) ? d.dnba : [d.dnba];
      nbaListHtml = items.length
        ? items.map((n, i) => {
            const title = n.id || `Item ${i + 1}`;
            return `<div class="nba-item">
              <div class="nba-title">${this.escapeHtml(String(title))}</div>
              <pre class="code">${this.escapeHtml(JSON.stringify(n, null, 2))}</pre>
            </div>`;
          }).join('')
        : '<p class="empty">No DNBA items.</p>';
    } else {
      nbaListHtml = '<p class="empty">No NBA list.</p>';
    }

    // H100 extra card groups (xpo, ehg) rendered as separate sub-sections
    const xpoHtml = d.xpo
      ? `<div class="sub-label">XPO</div><pre class="code">${this.escapeHtml(JSON.stringify(d.xpo, null, 2))}</pre>`
      : '';
    const ehgHtml = d.ehg
      ? `<div class="sub-label">EHG</div><pre class="code">${this.escapeHtml(JSON.stringify(d.ehg, null, 2))}</pre>`
      : '';

    const additionalHtml = d.additionalData
      ? `<pre class="code">${this.escapeHtml(JSON.stringify(d.additionalData, null, 2))}</pre>`
      : '';

    const inner = `
      <div class="sub-label">DNBA List</div>${nbaListHtml}
      ${xpoHtml}
      ${ehgHtml}
      ${additionalHtml ? `<div class="sub-label">Additional Data</div>${additionalHtml}` : ''}
      ${this.curlBlock(result, uid)}`;

    return this.section('🔍 PE-Discovery', inner, uid);
  }

  /**
   * Build PE-Shop section HTML.
   */
  buildShopSection(result, uid) {
    if (!result) return this.section('🛒 PE-Shop', '<p class="empty">Not available (request did not run)</p>', uid);
    if (!result.success) return this.section('🛒 PE-Shop', this.failureHtml(result), uid);

    const d = result.extractedData || {};

    let lobsHtml = '<p class="empty">No LOBs found.</p>';
    if (d.lobs) {
      const lobArr = Array.isArray(d.lobs) ? d.lobs : Object.entries(d.lobs).map(([k, v]) => ({ lob: k, ...v }));
      lobsHtml = lobArr.map((lob, i) => {
        const title = lob.lineOfBusiness || lob.lob || lob.name || `LOB ${i + 1}`;
        return `<div class="lob-block">
          <div class="lob-title">${this.escapeHtml(String(title))}</div>
          <pre class="code">${this.escapeHtml(JSON.stringify(lob, null, 2))}</pre>
        </div>`;
      }).join('');
    }

    const additionalHtml = d.additionalData
      ? `<pre class="code">${this.escapeHtml(JSON.stringify(d.additionalData, null, 2))}</pre>`
      : '<p class="empty">No additional data.</p>';

    const inner = `
      <div class="sub-label">Lines of Business</div>${lobsHtml}
      <div class="sub-label">Additional Data</div>${additionalHtml}
      ${this.curlBlock(result, uid)}`;

    return this.section('🛒 PE-Shop', inner, uid);
  }

  /**
   * Build PE-Med-Reminder section HTML.
   */
  buildMedReminderSection(result, uid) {
    if (!result) return this.section('💊 PE-Med-Reminder', '<p class="empty">Not available (request did not run)</p>', uid);
    if (!result.success) return this.section('💊 PE-Med-Reminder', this.failureHtml(result), uid);

    const d = result.extractedData || {};

    if (!d.members || !d.members.length) {
      return this.section('💊 PE-Med-Reminder', '<p class="empty">No medication reminder data returned.</p>', uid);
    }

    const flag = (val, label) => {
      const cls = val === true ? 'mr-flag-true' : val === false ? 'mr-flag-false' : 'mr-flag-null';
      const icon = val === true ? '✅' : val === false ? '❌' : '—';
      return `<span class="mr-flag ${cls}">${icon} ${this.escapeHtml(label)}</span>`;
    };

    const membersHtml = d.members.map(m => {
      const name = [m.firstName, m.lastName].filter(Boolean).join(' ') || m.patientId || 'Unknown';
      const memberTypeLabel = m.memberType ? `<span class="mr-member-type">${this.escapeHtml(m.memberType)}</span>` : '';

      const flagsHtml = `<div class="mr-flags">
        ${flag(m.isAnyRx, 'isAnyRx')}
        ${flag(m.isAnyReminderMed, 'isAnyReminderMed')}
        ${flag(m.isAnyReminderEnabled, 'isAnyReminderEnabled')}
      </div>`;

      let remindersHtml = '<p class="empty">No medication reminders.</p>';
      if (m.medicationReminders && m.medicationReminders.length) {
        remindersHtml = m.medicationReminders.map(mr => {
          const taken   = mr.adherenceInsight?.medsTaken   ?? '—';
          const skipped = mr.adherenceInsight?.medsSkipped ?? '—';
          const drugsHtml = (mr.drugs || []).map(d =>
            `<div class="mr-drug">
              <span class="mr-drug-name">${this.escapeHtml(d.drugName || '—')}</span>
              <span class="mr-drug-meta">ID: ${this.escapeHtml(d.drugId || '—')} &nbsp;|&nbsp; ${this.escapeHtml(d.reminderName || '—')}</span>
            </div>`
          ).join('');
          return `<div class="mr-reminder-block">
            <div class="mr-reminder-time">🕐 ${this.escapeHtml(mr.reminderTime || '—')}
              <span class="mr-adherence">taken: ${taken} &nbsp; skipped: ${skipped}</span>
            </div>
            ${drugsHtml}
          </div>`;
        }).join('');
      }

      return `<div class="mr-member-block">
        <div class="mr-member-header">${memberTypeLabel} <span class="mr-patient-name">${this.escapeHtml(name)}</span>
          <span class="mr-patient-id">(ID: ${this.escapeHtml(m.patientId || '—')})</span>
        </div>
        ${flagsHtml}
        <div class="sub-label" style="margin-top:10px">Medication Reminders</div>
        ${remindersHtml}
      </div>`;
    }).join('');

    return this.section('💊 PE-Med-Reminder', membersHtml + this.curlBlock(result, uid), uid);
  }

  /**
   * Build Benefits-Plan-Summaries section HTML.
   */
  buildBenefitsSection(result, uid) {
    if (!result) return '';
    if (!result.success) return this.section('💳 Benefits', this.failureHtml(result), uid);

    const d = result.extractedData || {};
    const lobs = d.lobs || [];

    if (!lobs.length) {
      return this.section('💳 Benefits', '<p class="empty">No plan data returned.</p>', uid);
    }

    const lobsHtml = lobs.map(lob => {
      const lobColor = lob.lobType === 'CAREMARK' ? '#1565c0' : lob.lobType === 'AETNA' ? '#880e4f' : '#333';
      const lobBg    = lob.lobType === 'CAREMARK' ? '#e3f2fd' : lob.lobType === 'AETNA' ? '#fce4ec' : '#f5f5f5';

      const plansHtml = (lob.plans || []).map(plan => {
        const accsHtml = (plan.accumulators || []).map(acc => {
          const memberId = acc.member?.id ? `<span style="color:#888;font-size:11px"> · Member: ${this.escapeHtml(acc.member.id)}</span>` : '';
          return `
          <tr>
            <td class="kv-key" style="font-size:12px">${this.escapeHtml(acc.label || acc.id)}${memberId}</td>
            <td class="kv-val" style="font-size:12px">
              <span style="color:#2e7d32;font-weight:600">$${(acc.spentAmount || 0).toLocaleString()}</span>
              &nbsp;/&nbsp; $${(acc.planAmount || 0).toLocaleString()}
              &nbsp;&nbsp;<span style="color:#888;font-size:11px">(${this.escapeHtml(acc.timePeriod || '')} · ${this.escapeHtml(acc.networkIndicator || '')})</span>
            </td>
          </tr>`;
        }).join('');

        return `<div style="margin-bottom:10px">
          <div style="font-size:12px;font-weight:700;color:#555;margin-bottom:4px">
            ${this.escapeHtml(plan.planType || plan.planName || '')}
            <span style="font-size:11px;color:#888;font-weight:500">&nbsp;(${this.escapeHtml(plan.planId || '')})</span>
            <span style="font-size:11px;color:#aaa;font-weight:400">&nbsp;${this.escapeHtml(plan.startDate || '')} – ${this.escapeHtml(plan.endDate || '')}</span>
          </div>
          ${accsHtml ? `<table class="kv-table">${accsHtml}</table>` : '<p class="empty">No accumulators.</p>'}
        </div>`;
      }).join('');

      return `<div class="lob-block">
        <div class="lob-title" style="background:${lobBg};color:${lobColor}">${this.escapeHtml(lob.lobType)}</div>
        <div style="padding:10px 0">
          ${plansHtml || '<p class="empty">No plan data.</p>'}
        </div>
      </div>`;
    }).join('');

    return this.section('💳 Benefits', lobsHtml + this.curlBlock(result, uid), uid);
  }

  /**
   * Build HAIO Insights section HTML.
   */
  buildHaioSection(result, uid) {
    if (!result) return this.section('💡 HAIO Insights', '<p class="empty">Not available (request did not run)</p>', uid);
    if (!result.success) return this.section('💡 HAIO Insights', this.failureHtml(result), uid);

    const d = result.extractedData || {};
    const haioData = d.haioData;

    if (!haioData || !Object.keys(haioData).length) {
      return this.section('💡 HAIO Insights', '<p class="empty">No HAIO insight data returned.</p>', uid);
    }

    const entriesHtml = Object.entries(haioData).map(([key, value]) => {
      const contentHtml = typeof value === 'object'
        ? `<pre class="code">${this.escapeHtml(JSON.stringify(value, null, 2))}</pre>`
        : `<span>${this.escapeHtml(String(value))}</span>`;
      return `
      <div class="sub-label">${this.escapeHtml(key)}</div>
      ${this.kvTable(value)}`;
    }).join('');

    const inner = `${entriesHtml}${this.curlBlock(result, uid)}`;
    return this.section('💡 HAIO Insights', inner, uid);
  }

  /**
   * Build a per-app per-user map: { cvs: { user → { name → result } }, h100: { … } }
   * Static since it doesn't depend on instance state — usable without constructing a
   * TestDataReportGenerator (e.g. from NbaCoverageChecker).
   */
  static groupByAppAndUser(results) {
    const map = { cvs: {}, h100: {} };
    for (const r of results) {
      const app  = r.app  || 'cvs';
      const user = r.user || 'unknown';
      if (!map[app])       map[app]       = {};
      if (!map[app][user]) map[app][user] = {};
      map[app][user][r.name] = r;
    }
    return map;
  }

  /**
   * Build user card HTML for a given app's data set.
   * @param {Object} byUser   - { user → { reqName → result } }
   * @param {Object} names    - { profile, health, shop, discovery, medReminder }
   * @param {string} idPrefix - Prefix for element IDs to avoid collisions between tabs
   */
  /**
   * Compute per-user derived feature flags (badges, benefit/eligibility booleans) from a
   * user's request-name → result map. Shared by buildUserCardsHtml() (for HTML badge
   * rendering) and NbaCoverageChecker (for coverage aggregation), so both stay consistent.
   * @param {Object} ur - { requestName → result } for a single user
   * @param {Object} names - { profile, health, shop, discovery, medReminder, benefits, haio }
   * @returns {Object} flags - { badges, hasProfile, medEligible, hasCaremarkPlan, hasAetnaPlan,
   *                              hasHaio, hasFrontStoreOrders, hasExtraCare }
   */
  static computeUserFlags(ur, names) {
    const profileResult     = ur[names.profile]     || null;
    const shopResult        = names.shop ? (ur[names.shop] || null) : null;
    const medReminderResult = ur[names.medReminder] || null;
    const benefitsResult    = names.benefits ? (ur[names.benefits] || null) : null;
    const haioResult        = names.haio ? (ur[names.haio] || null) : null;

    const pd     = profileResult?.extractedData || {};
    const badges = pd.featureBadges || {};
    const sd = shopResult?.extractedData        || {};
    const md = medReminderResult?.extractedData || {};

    const hasProfile  = !!(profileResult?.success && (pd.email || pd.firstName));
    const medEligible = (md.members || []).some(m => m.isAnyRx && m.isAnyReminderMed);

    const bd = benefitsResult?.extractedData || {};
    const hasCaremarkPlan = (bd.lobs || []).some(l => l.lobType === 'CAREMARK' && (l.plans || []).length > 0);
    const hasAetnaPlan    = (bd.lobs || []).some(l => l.lobType === 'AETNA'    && (l.plans || []).length > 0);
    const haiod           = haioResult?.extractedData || {};
    const hasHaio         = !!(haiod.haioData && Object.keys(haiod.haioData).length > 0);
    const hasFrontStoreOrders = !!(sd.additionalData?.hasPastFrontStoreOrders);

    const hasExtraCare = !!(pd.extraCareCard && (
      pd.extraCareCard.extraCareTied === 'Y' ||
      (pd.extraCareCard.extracareCardNumber != null && pd.extraCareCard.extracareCardNumber !== '')
    ));

    return { badges, hasProfile, medEligible, hasCaremarkPlan, hasAetnaPlan, hasHaio, hasFrontStoreOrders, hasExtraCare };
  }

  buildUserCardsHtml(byUser, names, idPrefix) {
    const users = Object.keys(byUser).sort();
    return users.map((user, ui) => {
      const ur  = byUser[user];
      const idx = `${idPrefix}${ui}`;

      const profileResult     = ur[names.profile]     || null;
      const healthResult      = ur[names.health]      || null;
      const discoveryResult   = ur[names.discovery]   || null;
      const shopResult        = names.shop ? (ur[names.shop] || null) : null;
      const medReminderResult = ur[names.medReminder] || null;
      const benefitsResult    = names.benefits ? (ur[names.benefits] || null) : null;
      const haioResult        = names.haio ? (ur[names.haio] || null) : null;

      const pd          = profileResult?.extractedData || {};
      const displayName = [pd.firstName, pd.lastName].filter(Boolean).join(' ') || user;
      const email       = pd.email || '';

      const authResults = Object.values(ur).filter(r =>
        !r.name.startsWith('PE-') && !r.name.startsWith('H100-PE-')
      );

      const profileHtml     = this.buildProfileSection(profileResult,     `p-${idx}`, authResults);
      const healthHtml      = this.buildHealthSection(healthResult,       `h-${idx}`);
      const discoveryHtml   = this.buildDiscoverySection(discoveryResult, `d-${idx}`);
      const shopHtml        = shopResult !== null ? this.buildShopSection(shopResult, `s-${idx}`) : '';
      const medReminderHtml = this.buildMedReminderSection(medReminderResult, `mr-${idx}`);
      const benefitsHtml    = this.buildBenefitsSection(benefitsResult, `b-${idx}`);
      const haioHtml        = haioResult !== null ? this.buildHaioSection(haioResult, `haio-${idx}`) : '';

      const hd = healthResult?.extractedData      || {};
      const dd = discoveryResult?.extractedData   || {};
      const sd = shopResult?.extractedData        || {};
      const md = medReminderResult?.extractedData || {};

      const {
        badges, hasProfile, medEligible, hasCaremarkPlan, hasAetnaPlan,
        hasHaio, hasFrontStoreOrders, hasExtraCare
      } = TestDataReportGenerator.computeUserFlags(ur, names);

      const badgesRow1Html = [
        badges.loa1      ? `<span class="feat-badge loa1">LOA1</span>`            : '',
        badges.caremark  ? `<span class="feat-badge caremark">Caremark</span>`    : '',
        badges.aetna     ? `<span class="feat-badge aetna">Aetna</span>`          : '',
        badges.specialty ? `<span class="feat-badge specialty">Specialty</span>`  : '',
        badges.rxc       ? `<span class="feat-badge rxc">RxC</span>`              : '',
        badges.mrn       ? `<span class="feat-badge mrn">MRN</span>`              : '',
        badges.oakStreet ? `<span class="feat-badge oakstreet">Oak Street</span>` : ''
      ].filter(Boolean).join('');

      const badgesRow2Html = [
        medEligible         ? `<span class="feat-badge outline medeligible">MedRem Eligible</span>`           : '',
        badges.counsel      ? `<span class="feat-badge outline counsel">Counsel</span>`                       : '',
        hasCaremarkPlan     ? `<span class="feat-badge outline hascaremarkplan">has Caremark Plan</span>`     : '',
        hasAetnaPlan        ? `<span class="feat-badge outline hasaetnaplan">has Aetna Plan</span>`           : '',
        hasExtraCare        ? `<span class="feat-badge outline extracare">ExtraCare</span>`                   : '',
        hasHaio             ? `<span class="feat-badge outline hashaio">HAIO Insight</span>`                  : '',
        hasFrontStoreOrders ? `<span class="feat-badge outline frontstoreorders">Front Store Orders</span>`   : ''
      ].filter(Boolean).join('');

      const featureBadgesHtml = badgesRow1Html || badgesRow2Html
        ? `<div class="badge-row">${badgesRow1Html || ''}</div>${badgesRow2Html ? `<div class="badge-row">${badgesRow2Html}</div>` : ''}`
        : '<span class="feat-badge none">No Features</span>';

      const activeBadges = [
        ...Object.entries(badges).filter(([, v]) => v).map(([k]) => k),
        hasProfile          ? 'hasprofile'       : '',
        medEligible         ? 'medeligible'      : '',
        hasCaremarkPlan     ? 'hascaremarkplan'  : '',
        hasAetnaPlan        ? 'hasaetnaplan'     : '',
        hasExtraCare        ? 'extracare'        : '',
        hasHaio             ? 'hashaio'          : '',
        hasFrontStoreOrders ? 'frontstoreorders' : ''
      ].filter(Boolean).join(' ');

      // H100 discovery uses dnba[].id + xpo[].id; CVS discovery uses nbaList[].nbaCardId; ehg excluded
      const dnbaItems = [...(dd.dnba || dd.nbaList || []), ...(dd.xpo || [])];
      const dnbaIds   = dnbaItems.map(n => n.id || n.nbaCardId).filter(Boolean);

      const allNbaIds = [
        ...(hd.priorityNbas || []), ...(hd.activityNbas || []),
        ...(sd.activityNbas  || []),
        ...(md.priorityNbas  || []), ...(md.activityNbas || [])
      ].map(n => n.nbaCardId).filter(Boolean).concat(dnbaIds).join(' ').toLowerCase();

      const userAnbaIds = [
        ...(hd.activityNbas || []), ...(sd.activityNbas || []), ...(md.activityNbas || [])
      ].map(n => n.nbaCardId).filter(Boolean).join(' ').toLowerCase();

      const userDnbaIds = dnbaIds.join(' ').toLowerCase();

      const linkedIdTypes  = (pd.linkedIds || []).map(l => l.idType || l.sourceSystemName || '').filter(Boolean).join(' ').toLowerCase();
      const linkedIdValues  = (pd.linkedIds || []).map(l => l.id || l.value || l.memberId || '').filter(Boolean).join(' ');
      const searchIds       = [pd.profileId || '', linkedIdValues].filter(Boolean).join(' ');

      return `
      <div class="user-card" id="card-${idx}" data-badges="${activeBadges}" data-nbas="${allNbaIds}" data-anba="${userAnbaIds}" data-dnba="${userDnbaIds}" data-linkedids="${linkedIdTypes}" data-searchids="${searchIds}">
        <div class="card-header" onclick="toggleCard('card-${idx}')">
          <div class="card-identity">
            <span class="card-chevron" id="cc-${idx}">▶</span>
            <div>
              <div class="card-name">${this.escapeHtml(displayName)}</div>
              <div class="card-email">${this.escapeHtml(email || user)}</div>
              ${!hasProfile ? '<span class="no-profile-label">No profile found</span>' : ''}
            </div>
          </div>
          <div class="card-stats">
            ${featureBadgesHtml}
          </div>
        </div>
        <div class="card-body" id="cb-${idx}" style="display:none">
          ${profileHtml}
          ${healthHtml}
          ${discoveryHtml}
          ${shopHtml}
          ${medReminderHtml}
          ${benefitsHtml}
          ${haioHtml}
        </div>
      </div>`;
    }).join('\n');
  }

  /**
   * Collect all unique ANBA/DNBA card IDs seen for a given app across a per-user results map.
   * Shared by the HTML filter-chip generation below and by NbaCoverageChecker.
   * @param {Object} byUser - { user → { requestName → result } } for a single app (cvs or h100)
   * @param {string} app - 'cvs' | 'h100'
   * @returns {{ anbaIds: Set<string>, dnbaIds: Set<string> }}
   */
  static collectNbaIds(byUser, app) {
    const anbaIds = new Set();
    const dnbaIds = new Set();
    const healthKey = app === 'h100' ? 'H100-PE-health' : 'PE-health';
    const discoveryKey = app === 'h100' ? 'H100-PE-discovery' : 'PE-discovery';
    const shopKey = app === 'h100' ? null : 'PE-shop';
    const medReminderKey = app === 'h100' ? 'H100-PE-med-reminder' : 'PE-med-reminder';

    Object.values(byUser).forEach(ur => {
      const hd = ur[healthKey]?.extractedData || {};
      const dd = ur[discoveryKey]?.extractedData || {};
      const sd = shopKey ? (ur[shopKey]?.extractedData || {}) : {};
      const md = ur[medReminderKey]?.extractedData || {};

      [...(hd.activityNbas || []), ...(sd.activityNbas || []), ...(md.activityNbas || [])]
        .forEach(n => { if (n.nbaCardId) anbaIds.add(n.nbaCardId); });

      if (app === 'h100') {
        // H100 discovery returns dnba[].id and xpo[].id (not nbaCardId); exclude ehg items
        [...(dd.dnba || []), ...(dd.xpo || [])]
          .forEach(n => { if (n.id) dnbaIds.add(n.id); });
      } else {
        (dd.nbaList || [])
          .forEach(n => { if (n.nbaCardId) dnbaIds.add(n.nbaCardId); });
      }
    });

    return { anbaIds, dnbaIds };
  }

  /**
   * Generate the full HTML test data report.
   */
  generateHtml(results, meta = {}) {
    const byAppUser  = TestDataReportGenerator.groupByAppAndUser(results);
    const cvsUsers   = byAppUser.cvs  || {};
    const h100Users  = byAppUser.h100 || {};
    const allUsers   = [...new Set([...Object.keys(cvsUsers), ...Object.keys(h100Users)])].sort();
    const timestamp  = meta.timestamp || new Date().toISOString();
    const env        = meta.env || 'qa2';

    // First pass: collect all unique ANBA/DNBA card IDs from CVS users for filter chips
    const { anbaIds: allAnbaIds, dnbaIds: allDnbaIds } = TestDataReportGenerator.collectNbaIds(cvsUsers, 'cvs');

    const anbaChips = [...allAnbaIds].sort().map(id =>
      `<button class="nba-chip anba-chip" data-nba="${id}" onclick="toggleNbaFilter(this,'anba')">${this.escapeHtml(id)}</button>`
    ).join('');
    const dnbaChips = [...allDnbaIds].sort().map(id =>
      `<button class="nba-chip dnba-chip" data-nba="${id}" onclick="toggleNbaFilter(this,'dnba')">${this.escapeHtml(id)}</button>`
    ).join('');
    const nbaFilterBar = (allAnbaIds.size + allDnbaIds.size) === 0 ? '' : `
  <div class="nba-filter-bar">
    ${allAnbaIds.size ? `<div class="nba-filter-group">
      <span class="nba-filter-label anba-label">ANBA</span>
      <div class="nba-chips">${anbaChips}</div>
    </div>` : ''}
    ${allDnbaIds.size ? `<div class="nba-filter-group">
      <span class="nba-filter-label dnba-label">DNBA</span>
      <div class="nba-chips">${dnbaChips}</div>
    </div>` : ''}
  </div>`;

    // Second pass: collect all unique ANBA/DNBA card IDs from H100 users
    const { anbaIds: allH100AnbaIds, dnbaIds: allH100DnbaIds } = TestDataReportGenerator.collectNbaIds(h100Users, 'h100');

    const h100AnbaChips = [...allH100AnbaIds].sort().map(id =>
      `<button class="nba-chip anba-chip" data-nba="${id}" onclick="toggleNbaFilter(this,'anba')">${this.escapeHtml(id)}</button>`
    ).join('');
    const h100DnbaChips = [...allH100DnbaIds].sort().map(id =>
      `<button class="nba-chip dnba-chip" data-nba="${id}" onclick="toggleNbaFilter(this,'dnba')">${this.escapeHtml(id)}</button>`
    ).join('');
    const h100NbaFilterBar = (allH100AnbaIds.size + allH100DnbaIds.size) === 0 ? '' : `
  <div class="nba-filter-bar">
    ${allH100AnbaIds.size ? `<div class="nba-filter-group">
      <span class="nba-filter-label anba-label">ANBA</span>
      <div class="nba-chips">${h100AnbaChips}</div>
    </div>` : ''}
    ${allH100DnbaIds.size ? `<div class="nba-filter-group">
      <span class="nba-filter-label dnba-label">DNBA</span>
      <div class="nba-chips">${h100DnbaChips}</div>
    </div>` : ''}
  </div>`;

    const cvsUserCards = Object.keys(cvsUsers).length
      ? this.buildUserCardsHtml(cvsUsers, {
          profile: 'profile_retrieve', health: 'PE-health', shop: 'PE-shop',
          discovery: 'PE-discovery', medReminder: 'PE-med-reminder',
          benefits: 'benefits-plan-summaries'
        }, 'c')
      : '<p style="padding:20px;color:#aaa">No CVS data collected.</p>';

    const h100UserCards = Object.keys(h100Users).length
      ? this.buildUserCardsHtml(h100Users, {
          profile: 'h100_profile_retrieve', health: 'H100-PE-health', shop: null,
          discovery: 'H100-PE-discovery', medReminder: 'H100-PE-med-reminder',
          benefits: 'H100-benefits-plan-summaries',
          haio: 'H100-home-haio-insights'
        }, 'h')
      : '<p style="padding:20px;color:#aaa">No H100 data collected.</p>';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CVS + Health100 Test Data Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f0f2f5; color: #333; }
    .header {
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 60%, #0f3460 100%);
      color: #fff;
      padding: 32px 40px;
    }
    .header h1 { font-size: 26px; font-weight: 700; margin-bottom: 6px; }
    .header p { font-size: 13px; opacity: 0.7; }
    .toolbar {
      background: #fff;
      border-bottom: 1px solid #e5e7eb;
      padding: 12px 40px;
      display: flex;
      gap: 10px;
      align-items: center;
      flex-wrap: wrap;
    }
    .toolbar-btn {
      padding: 6px 14px;
      border: 1px solid #ddd;
      background: #f8f9fa;
      border-radius: 6px;
      font-size: 13px;
      cursor: pointer;
      transition: background .15s;
    }
    .toolbar-btn:hover { background: #e9ecef; }
    .toolbar-count { margin-left: auto; font-size: 13px; color: #888; }
    .search-box {
      padding: 6px 12px;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 13px;
      width: 220px;
    }
    .main { padding: 24px 40px 40px; max-width: 1400px; margin: 0 auto; }
    .summary-bar {
      display: flex;
      gap: 16px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }
    .summary-pill {
      background: #fff;
      border-radius: 10px;
      padding: 14px 22px;
      box-shadow: 0 1px 4px rgba(0,0,0,.08);
      text-align: center;
      min-width: 110px;
    }
    .summary-pill .sp-val { font-size: 28px; font-weight: 700; }
    .summary-pill .sp-lbl { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: .5px; margin-top: 4px; }
    .summary-pill.total .sp-val { color: #667eea; }
    .filter-chip {
      padding: 8px 18px;
      border: 2px solid #ddd;
      background: #f8f9fa;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      text-transform: uppercase;
      letter-spacing: .4px;
      transition: all .15s;
      align-self: center;
    }
    .filter-chip:hover { border-color: #667eea; color: #667eea; background: #f0f1ff; }
    .filter-chip[data-badge="caremark"].active  { background: #e3f2fd; border-color: #1565c0; color: #1565c0; }
    .filter-chip[data-badge="aetna"].active     { background: #fce4ec; border-color: #880e4f; color: #880e4f; }
    .filter-chip[data-badge="specialty"].active { background: #f3e5f5; border-color: #6a1b9a; color: #6a1b9a; }
    .filter-chip[data-badge="rxc"].active       { background: #e8f5e9; border-color: #2e7d32; color: #2e7d32; }
    .filter-chip[data-badge="counsel"].active   { background: #fff3e0; border-color: #e65100; color: #e65100; }
    .filter-chip[data-badge="mrn"].active       { background: #e0f2f1; border-color: #00695c; color: #00695c; }
    .filter-chip[data-badge="oakStreet"].active   { background: #f1f8e9; border-color: #558b2f; color: #558b2f; }
    .filter-chip[data-badge="medeligible"].active     { background: #e8f5e9; border-color: #1b5e20; color: #1b5e20; }
    .filter-chip[data-badge="hascaremarkplan"].active { background: #e3f2fd; border-color: #1565c0; color: #1565c0; }
    .filter-chip[data-badge="hasaetnaplan"].active    { background: #fce4ec; border-color: #880e4f; color: #880e4f; }
    .filter-chip[data-badge="extracare"].active       { background: #f3e5f5; border-color: #6a1b9a; color: #6a1b9a; }
    .filter-chip[data-badge="loa1"].active            { background: #fff8e1; border-color: #f57f17; color: #f57f17; }
    .filter-chip[data-badge="hashaio"].active         { background: #e8f5e9; border-color: #00796b; color: #00796b; }
    .filter-chip[data-badge="frontstoreorders"].active { background: #fff4e5; border-color: #c05621; color: #c05621; }
    .user-card {
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 1px 6px rgba(0,0,0,.08);
      margin-bottom: 12px;
      overflow: hidden;
      border-left: 4px solid #667eea;
    }
    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      cursor: pointer;
      user-select: none;
      transition: background .15s;
    }
    .card-header:hover { background: #f8f9fa; }
    .card-identity { display: flex; align-items: center; gap: 12px; }
    .card-chevron { font-size: 11px; color: #999; transition: transform .2s; min-width: 12px; }
    .card-chevron.open { transform: rotate(90deg); color: #667eea; }
    .card-name { font-weight: 600; font-size: 15px; }
    .card-email { font-size: 12px; color: #888; margin-top: 2px; }
    .card-stats { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
    .badge-row   { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
    .feat-badge {
      font-size: 11px;
      font-weight: 700;
      padding: 3px 10px;
      border-radius: 12px;
      letter-spacing: .3px;
      text-transform: uppercase;
    }
    .feat-badge.caremark  { background: #e3f2fd; color: #1565c0; }
    .feat-badge.aetna     { background: #fce4ec; color: #880e4f; }
    .feat-badge.specialty { background: #f3e5f5; color: #6a1b9a; }
    .feat-badge.rxc       { background: #e8f5e9; color: #2e7d32; }
    .feat-badge.counsel   { background: #fff3e0; color: #e65100; }
    .feat-badge.mrn       { background: #e0f2f1; color: #00695c; }
    .feat-badge.oakstreet { background: #f1f8e9; color: #558b2f; }
    .feat-badge.loa1      { background: #fff8e1; color: #f57f17; }
    .feat-badge.medeligible    { background: #e8f5e9; color: #1b5e20; }
    .feat-badge.hascaremarkplan { background: #dbeafe; color: #1e40af; }
    .feat-badge.hasaetnaplan    { background: #fce7f3; color: #9d174d; }
    .feat-badge.extracare       { background: #f3e5f5; color: #6a1b9a; }
    .feat-badge.hashaio         { background: #e0f2f1; color: #00796b; }
    .feat-badge.frontstoreorders { background: #fff4e5; color: #c05621; }
    .feat-badge.outline {
      background: transparent !important;
      border: 1.5px solid currentColor;
      font-size: 8px;
      padding: 2px 7px;
    }
    .feat-badge.none      { background: #f5f5f5; color: #9e9e9e; }
    .card-body { border-top: 1px solid #f0f0f0; padding: 16px 20px; display: flex; flex-direction: column; gap: 8px; }
    .section {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      overflow: hidden;
    }
    .section-header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 11px 16px;
      background: #f7f8fa;
      cursor: pointer;
      font-weight: 600;
      font-size: 14px;
      user-select: none;
      transition: background .15s;
    }
    .section-header:hover { background: #eef0f4; }
    .sec-chevron { font-size: 10px; color: #999; transition: transform .2s; }
    .section.open .sec-chevron { transform: rotate(90deg); color: #667eea; }
    .section-body { padding: 14px 16px; display: none; }
    .section.open .section-body { display: block; }
    .sub-label {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .6px;
      color: #888;
      margin: 14px 0 8px;
    }
    .sub-label:first-child { margin-top: 0; }
    .kv-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .kv-key {
      padding: 6px 12px 6px 0;
      font-weight: 600;
      color: #555;
      white-space: nowrap;
      vertical-align: top;
      width: 160px;
    }
    .kv-val { padding: 6px 0; word-break: break-all; }
    .null { color: #aaa; font-style: italic; }
    pre.code {
      background: #1e1e2e;
      color: #cdd6f4;
      border-radius: 6px;
      padding: 12px 14px;
      font-size: 12px;
      overflow: auto;
      max-height: 380px;
      white-space: pre-wrap;
      word-break: break-all;
    }
    pre.code.inline { display: inline-block; padding: 4px 8px; font-size: 11px; vertical-align: middle; }
    .nba-item {
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      margin-bottom: 8px;
      overflow: hidden;
    }
    .nba-title {
      background: #f0f4ff;
      padding: 8px 12px;
      font-weight: 600;
      font-size: 13px;
      color: #3730a3;
    }
    .nba-item pre.code { border-radius: 0; max-height: 300px; }
    .lob-block { margin-bottom: 12px; }
    .lob-title {
      font-size: 13px;
      font-weight: 700;
      color: #1565c0;
      background: #e3f2fd;
      padding: 6px 12px;
      border-radius: 6px 6px 0 0;
    }
    .lob-block pre.code { border-radius: 0 0 6px 6px; margin-top: 0; }
    .empty { font-size: 13px; color: #aaa; font-style: italic; }
    .fail { font-size: 13px; color: #dc3545; font-weight: 600; }
    .fail-step { font-size: 12px; color: #6c757d; margin-bottom: 8px; }
    .fail-step code { background: #f5f5f5; padding: 2px 6px; border-radius: 4px; font-family: monospace; color: #c0392b; font-size: 12px; }
    .no-profile-label { font-size: 11px; font-weight: 700; color: #dc3545; background: #fdecea; border: 1px solid #f5c6cb; border-radius: 4px; padding: 2px 8px; margin-top: 3px; display: inline-block; }
    .nba-filter-bar {
      background: #fff;
      border-radius: 10px;
      padding: 14px 20px;
      box-shadow: 0 1px 4px rgba(0,0,0,.08);
      margin-bottom: 18px;
    }
    .nba-filter-group {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 10px;
    }
    .nba-filter-group:last-child { margin-bottom: 0; }
    .nba-filter-label {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: .5px;
      padding: 5px 10px;
      border-radius: 6px;
      white-space: nowrap;
      align-self: center;
      min-width: 48px;
      text-align: center;
    }
    .anba-label { background: #e3f2fd; color: #1565c0; }
    .dnba-label { background: #f3e5f5; color: #6a1b9a; }
    .nba-chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .nba-chip {
      padding: 4px 10px;
      border: 1px solid #ddd;
      background: #f8f9fa;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      transition: all .15s;
      font-family: monospace;
      letter-spacing: -.2px;
    }
    .nba-chip:hover { background: #f0f0f0; border-color: #aaa; }
    .anba-chip.active { background: #e3f2fd; border-color: #1565c0; color: #1565c0; }
    .dnba-chip.active { background: #f3e5f5; border-color: #6a1b9a; color: #6a1b9a; }
    .mr-member-block { border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px; margin-bottom: 12px; }
    .mr-member-block:last-child { margin-bottom: 0; }
    .mr-member-header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; flex-wrap: wrap; }
    .mr-member-type { background: #e8f5e9; color: #2e7d32; font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 2px 8px; border-radius: 10px; letter-spacing: .4px; }
    .mr-patient-name { font-size: 14px; font-weight: 700; color: #1a1a2e; }
    .mr-patient-id { font-size: 12px; color: #888; }
    .mr-flags { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 6px; }
    .mr-flag { font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: 10px; }
    .mr-flag-true  { background: #e8f5e9; color: #2e7d32; }
    .mr-flag-false { background: #fce4ec; color: #c62828; }
    .mr-flag-null  { background: #f5f5f5; color: #9e9e9e; }
    .mr-reminder-block { background: #fafafa; border: 1px solid #eee; border-radius: 6px; padding: 10px 12px; margin-bottom: 8px; }
    .mr-reminder-block:last-child { margin-bottom: 0; }
    .mr-reminder-time { font-size: 13px; font-weight: 700; color: #333; margin-bottom: 6px; display: flex; align-items: center; gap: 10px; }
    .mr-adherence { font-size: 11px; font-weight: 400; color: #888; }
    .mr-drug { display: flex; flex-direction: column; padding: 6px 0; border-bottom: 1px solid #eee; }
    .mr-drug:last-child { border-bottom: none; }
    .mr-drug-name { font-size: 13px; font-weight: 600; color: #1565c0; }
    .mr-drug-meta { font-size: 11px; color: #888; margin-top: 2px; }
    .hidden { display: none !important; }
    .curl-bar { display:flex; align-items:center; justify-content:space-between; margin-bottom:6px; }
    .curl-btn { padding:3px 12px; font-size:12px; font-weight:600; background:#667eea; color:#fff; border:none; border-radius:5px; cursor:pointer; transition:background .15s; }
    .curl-btn:hover { background:#5a6fd6; }
    .curl-btn.copied { background:#28a745; }
    .curl-block { background:#1e1e2e; color:#cba6f7; max-height:200px; }
    .app-tabs { display: flex; gap: 4px; margin-bottom: 20px; background: #fff; border-radius: 10px; padding: 6px; box-shadow: 0 1px 4px rgba(0,0,0,.08); width: fit-content; }
    .app-tab { padding: 8px 28px; border: none; background: transparent; border-radius: 7px; font-size: 14px; font-weight: 600; cursor: pointer; color: #888; transition: all .15s; }
    .app-tab:hover { color: #333; background: #f0f2f5; }
    .app-tab.active { background: #667eea; color: #fff; box-shadow: 0 2px 6px rgba(102,126,234,.4); }
    .tab-panel { display: none; }
    .tab-panel.active { display: block; }
    .profile-radio-group { display: flex; align-items: center; gap: 2px; background: #f0f2f5; border: 1px solid #ddd; border-radius: 8px; padding: 3px; }
    .profile-radio-group input[type="radio"] { display: none; }
    .profile-radio-group label { font-size: 12px; font-weight: 600; cursor: pointer; padding: 4px 12px; border-radius: 5px; color: #666; white-space: nowrap; transition: all .15s; }
    .profile-radio-group label:hover { color: #333; background: #e2e5ea; }
    .profile-radio-group input[type="radio"]:checked + label { background: #667eea; color: #fff; }
  </style>
</head>
<body>

<div class="header">
  <h1>CVS + Health100 — Test Data Report</h1>
  <p>Environment: ${this.escapeHtml(env.toUpperCase())} &nbsp;|&nbsp; Generated: ${new Date(timestamp).toLocaleString()} &nbsp;|&nbsp; ${allUsers.length} user(s)</p>
</div>

<div class="toolbar">
  <button class="toolbar-btn" onclick="expandAll()">Expand All</button>
  <button class="toolbar-btn" onclick="collapseAll()">Collapse All</button>
  <div class="profile-radio-group">
    <input type="radio" name="profile-filter" id="pf-all"  value="all"  checked onchange="setProfileFilter('all')">
    <label for="pf-all">All Users</label>
    <input type="radio" name="profile-filter" id="pf-has"  value="has"        onchange="setProfileFilter('has')">
    <label for="pf-has">Has Profile</label>
    <input type="radio" name="profile-filter" id="pf-none" value="none"       onchange="setProfileFilter('none')">
    <label for="pf-none">No Profile</label>
  </div>
  <input class="search-box" type="text" placeholder="Search user / email / NBA card ID…" oninput="filterCards(this.value)">
  <span class="toolbar-count" id="count-label">${allUsers.length} users</span>
</div>

<div class="main">
  <div class="app-tabs">
    <button class="app-tab active" data-tab="cvs"  onclick="switchTab('cvs')">💊 CVS</button>
    <button class="app-tab"        data-tab="h100" onclick="switchTab('h100')">🏥 Health100</button>
  </div>

  <div id="tab-cvs" class="tab-panel active">
  <div class="summary-bar">
    <div class="summary-pill total"><div class="sp-val">${Object.keys(cvsUsers).length || allUsers.length}</div><div class="sp-lbl">Users</div></div>
    <button class="filter-chip" data-badge="caremark"   onclick="toggleFilter(this)">Caremark</button>
    <button class="filter-chip" data-badge="aetna"      onclick="toggleFilter(this)">Aetna</button>
    <button class="filter-chip" data-badge="specialty"  onclick="toggleFilter(this)">Specialty</button>
    <button class="filter-chip" data-badge="rxc"        onclick="toggleFilter(this)">RxC</button>
    <button class="filter-chip" data-badge="counsel"    onclick="toggleFilter(this)">Counsel</button>
    <button class="filter-chip" data-badge="mrn"        onclick="toggleFilter(this)">MRN</button>
    <button class="filter-chip" data-badge="oakStreet"  onclick="toggleFilter(this)">Oak Street</button>
    <button class="filter-chip" data-badge="medeligible"     onclick="toggleFilter(this)">MedRem Eligible</button>
    <button class="filter-chip" data-badge="hascaremarkplan" onclick="toggleFilter(this)">has Caremark Plan</button>
    <button class="filter-chip" data-badge="hasaetnaplan"    onclick="toggleFilter(this)">has Aetna Plan</button>
    <button class="filter-chip" data-badge="extracare"       onclick="toggleFilter(this)">ExtraCare</button>
    <button class="filter-chip" data-badge="frontstoreorders" onclick="toggleFilter(this)">has Past FS Orders</button>
  </div>

  ${nbaFilterBar}
  <div id="cards-container-cvs">
    ${cvsUserCards}
  </div>
  </div>

  <div id="tab-h100" class="tab-panel">
  <div class="summary-bar">
    <div class="summary-pill total"><div class="sp-val">${Object.keys(h100Users).length || allUsers.length}</div><div class="sp-lbl">Users</div></div>
    <button class="filter-chip" data-badge="caremark"   onclick="toggleFilter(this)">Caremark</button>
    <button class="filter-chip" data-badge="aetna"      onclick="toggleFilter(this)">Aetna</button>
    <button class="filter-chip" data-badge="specialty"  onclick="toggleFilter(this)">Specialty</button>
    <button class="filter-chip" data-badge="rxc"        onclick="toggleFilter(this)">RxC</button>
    <button class="filter-chip" data-badge="counsel"    onclick="toggleFilter(this)">Counsel</button>
    <button class="filter-chip" data-badge="mrn"        onclick="toggleFilter(this)">MRN</button>
    <button class="filter-chip" data-badge="oakStreet"  onclick="toggleFilter(this)">Oak Street</button>
    <button class="filter-chip" data-badge="loa1"       onclick="toggleFilter(this)">LOA1</button>
    <button class="filter-chip" data-badge="medeligible"     onclick="toggleFilter(this)">MedRem Eligible</button>
    <button class="filter-chip" data-badge="hascaremarkplan" onclick="toggleFilter(this)">has Caremark Plan</button>
    <button class="filter-chip" data-badge="hasaetnaplan"    onclick="toggleFilter(this)">has Aetna Plan</button>
    <button class="filter-chip" data-badge="extracare"       onclick="toggleFilter(this)">ExtraCare</button>
    <button class="filter-chip" data-badge="hashaio"          onclick="toggleFilter(this)">HAIO Insight</button>
  </div>
  ${h100NbaFilterBar}
  <div id="cards-container-h100">
    ${h100UserCards}
  </div>
  </div>
</div>

<script>
  function copyCurl(event, id) {
    event.stopPropagation();
    const btn = event.currentTarget;
    const text = document.getElementById(id).textContent;
    navigator.clipboard.writeText(text).then(() => {
      btn.textContent = 'Copied!';
      btn.classList.add('copied');
      setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 2000);
    });
  }
  function toggleCard(id) {
    const card = document.getElementById(id);
    const body = document.getElementById('cb-' + id.replace('card-', ''));
    const chev = document.getElementById('cc-' + id.replace('card-', ''));
    const open = body.style.display !== 'none';
    body.style.display = open ? 'none' : 'block';
    chev.classList.toggle('open', !open);
  }

  function toggleSection(id) {
    const sec = document.getElementById(id);
    const uid = id.replace(/^sec-/, '');
    const chev = document.getElementById('sc-' + uid);
    sec.classList.toggle('open');
    chev.textContent = sec.classList.contains('open') ? '▼' : '▶';
  }

  function switchTab(tab) {
    document.querySelectorAll('.app-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + tab));
    activeFilters.clear();
    activeNbaFilters.anba.clear();
    activeNbaFilters.dnba.clear();
    profileFilter = 'all';
    document.querySelectorAll('.filter-chip.active, .nba-chip.active').forEach(c => c.classList.remove('active'));
    const allRadio = document.getElementById('pf-all');
    if (allRadio) allRadio.checked = true;
    applyFilters();
  }

  function activeContainer() {
    const panel = document.querySelector('.tab-panel.active');
    return panel ? panel.querySelectorAll('.user-card') : [];
  }

  function expandAll() {
    activeContainer().forEach(card => {
      const id = card.id.replace('card-', '');
      const body = document.getElementById('cb-' + id);
      const chev = document.getElementById('cc-' + id);
      if (body) { body.style.display = 'block'; if (chev) chev.classList.add('open'); }
    });
  }

  function collapseAll() {
    activeContainer().forEach(card => {
      const id = card.id.replace('card-', '');
      const body = document.getElementById('cb-' + id);
      const chev = document.getElementById('cc-' + id);
      if (body) { body.style.display = 'none'; if (chev) chev.classList.remove('open'); }
    });
  }

  let profileFilter = 'all';
  const activeFilters = new Set();
  const activeNbaFilters = { anba: new Set(), dnba: new Set() };

  function setProfileFilter(val) {
    profileFilter = val;
    applyFilters();
  }

  function toggleNbaFilter(btn, type) {
    const nba = btn.dataset.nba;
    if (activeNbaFilters[type].has(nba)) {
      activeNbaFilters[type].delete(nba);
      btn.classList.remove('active');
    } else {
      activeNbaFilters[type].add(nba);
      btn.classList.add('active');
    }
    applyFilters();
  }

  function toggleFilter(btn) {
    const badge = btn.dataset.badge;
    if (activeFilters.has(badge)) {
      activeFilters.delete(badge);
      btn.classList.remove('active');
    } else {
      activeFilters.add(badge);
      btn.classList.add('active');
    }
    applyFilters();
  }

  function filterCards(query) {
    applyFilters(query);
  }

  function applyFilters(query) {
    const searchInput = document.querySelector('.search-box');
    const q = (query !== undefined ? query : (searchInput ? searchInput.value : '')).toLowerCase().trim();
    let visible = 0;
    activeContainer().forEach(card => {
      const name    = card.querySelector('.card-name')?.textContent.toLowerCase()  || '';
      const email   = card.querySelector('.card-email')?.textContent.toLowerCase() || '';
      const nbas    = (card.dataset.nbas  || '').toLowerCase();
      const badges  = (card.dataset.badges || '').toLowerCase().split(' ');

      const linkedIds  = (card.dataset.linkedids  || '').toLowerCase();
      const searchIds  = (card.dataset.searchids   || '').toLowerCase();
      const textMatch  = !q || name.includes(q) || email.includes(q) || nbas.includes(q) || linkedIds.includes(q) || searchIds.includes(q);

      const badgeMatch = activeFilters.size === 0
        || [...activeFilters].some(f => badges.includes(f.toLowerCase()));

      const hasProfile = badges.includes('hasprofile');
      const profileMatch = profileFilter === 'all'
        || (profileFilter === 'has'  &&  hasProfile)
        || (profileFilter === 'none' && !hasProfile);

      const cardAnba = (card.dataset.anba || '').split(' ');
      const cardDnba = (card.dataset.dnba || '').split(' ');
      const anbaMatch = activeNbaFilters.anba.size === 0
        || [...activeNbaFilters.anba].some(f => cardAnba.includes(f));
      const dnbaMatch = activeNbaFilters.dnba.size === 0
        || [...activeNbaFilters.dnba].some(f => cardDnba.includes(f));

      const show = textMatch && badgeMatch && profileMatch && anbaMatch && dnbaMatch;
      card.classList.toggle('hidden', !show);
      if (show) visible++;
    });
    const total = activeContainer().length;
    const hasFilter = q || profileFilter !== 'all' || activeFilters.size > 0 || activeNbaFilters.anba.size > 0 || activeNbaFilters.dnba.size > 0;
    document.getElementById('count-label').textContent =
      hasFilter ? (visible + ' of ' + total + ' users') : (total + ' users');
  }
</script>
</body>
</html>`;
  }

  /**
   * Save the test data HTML report and return the file path.
   */
  saveReport(results, meta = {}) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const dir = path.join(this.artifactsDir, `test-data-report-${timestamp}`);
    fs.mkdirSync(dir, { recursive: true });

    const html = this.generateHtml(results, meta);
    const htmlPath = path.join(dir, 'test-data-report.html');
    fs.writeFileSync(htmlPath, html, 'utf8');

    const jsonPath = path.join(dir, 'test-data.json');
    const byUser = this.groupByUser(results);
    const summary = {};
    for (const [user, reqs] of Object.entries(byUser)) {
      summary[user] = {};
      for (const [name, r] of Object.entries(reqs)) {
        summary[user][name] = {
          success: r.success,
          statusCode: r.statusCode,
          extractedData: r.extractedData || null
        };
      }
    }
    fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2), 'utf8');

    return { htmlPath, jsonPath };
  }
}

module.exports = TestDataReportGenerator;
