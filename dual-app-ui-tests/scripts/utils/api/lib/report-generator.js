/**
 * Report Generator - Creates JSON and HTML test reports
 */

const fs = require('fs');
const path = require('path');

class ReportGenerator {
  constructor(outputDir) {
    this.outputDir = outputDir;
    this.timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    this.reportDir = path.join(outputDir, `api-test-report-${this.timestamp}`);
    this.responsesDir = path.join(this.reportDir, 'responses');
    
    // Create directories
    if (!fs.existsSync(this.reportDir)) {
      fs.mkdirSync(this.reportDir, { recursive: true });
    }
    if (!fs.existsSync(this.responsesDir)) {
      fs.mkdirSync(this.responsesDir, { recursive: true });
    }
  }

  /**
   * Save response to file
   * @param {string} name - Request name
   * @param {Object} response - Response object
   * @returns {string} File path
   */
  saveResponse(name, response) {
    const fileName = this.sanitizeFileName(name);
    const filePath = path.join(this.responsesDir, `${fileName}.json`);
    fs.writeFileSync(filePath, JSON.stringify(response, null, 2));
    return filePath;
  }

  /**
   * Generate test report
   * @param {string} suiteName - Test suite name
   * @param {Array} results - Test results array
   * @returns {Object} Report object
   */
  generateReport(suiteName, results) {
    const totalRequests = results.length;
    const totalPassed = results.filter(r => r.success).length;
    const totalSkipped = results.filter(r => r.skipped).length;
    const totalFailed = totalRequests - totalPassed - totalSkipped;
    const countable = totalRequests - totalSkipped;
    const passRate = countable > 0 ? ((totalPassed / countable) * 100).toFixed(2) : '0.00';

    const report = {
      timestamp: new Date().toISOString(),
      suite: suiteName,
      totalRequests,
      totalPassed,
      totalFailed,
      totalSkipped,
      summary: {
        totalRequests,
        passed: totalPassed,
        failed: totalFailed,
        skipped: totalSkipped,
        passRate: `${passRate}%`
      },
      results
    };

    return report;
  }

  /**
   * Save JSON report
   * @param {Object} report - Report object
   * @returns {string} File path
   */
  saveJsonReport(report) {
    const filePath = path.join(this.reportDir, 'report.json');
    fs.writeFileSync(filePath, JSON.stringify(report, null, 2));
    return filePath;
  }

  /**
   * Save HTML report
   * @param {Object} report - Report object
   * @returns {string} File path
   */
  saveHtmlReport(report) {
    const html = this.generateHtmlReport(report);
    const filePath = path.join(this.reportDir, 'report.html');
    fs.writeFileSync(filePath, html);
    return filePath;
  }

  /**
   * Escape HTML special characters
   */
  escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Build a curl command string from a result object
   */
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

  /**
   * Pretty-print and escape a value for display in HTML
   */
  formatJson(value) {
    if (value === null || value === undefined) return '<em style="color:#999">none</em>';
    const str = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    return this.escapeHtml(str);
  }

  /**
   * Generate HTML report content
   * @param {Object} report - Report object
   * @returns {string} HTML content
   */
  generateHtmlReport(report) {
    const passRate = parseFloat(report.summary.passRate);
    const passColor = passRate === 100 ? '#28a745' : passRate >= 80 ? '#ffc107' : '#dc3545';

    const resultsHtml = report.results.map((result, idx) => {
      const req = result.request || {};
      const reqHeaders = req.headers ? JSON.stringify(req.headers, null, 2) : null;
      const reqBody = req.body != null ? (typeof req.body === 'string' ? req.body : JSON.stringify(req.body, null, 2)) : null;
      const resHeadersRaw = result.responseHeaders || result.headers || null;
      const resHeaders = resHeadersRaw ? JSON.stringify(resHeadersRaw, null, 2) : null;
      const resBody = result.data != null ? (typeof result.data === 'string' ? result.data : JSON.stringify(result.data, null, 2)) : null;
      const userBadge = result.user ? `<span class="user-badge">${this.escapeHtml(result.user)}</span>` : '';
      const statusBadge = result.success
        ? `<span class="badge pass">✅ PASS</span>`
        : result.skipped
          ? `<span class="badge skip">⚠ SKIP</span>`
          : `<span class="badge fail">❌ FAIL</span>`;
      const methodClass = (result.method || 'GET').toLowerCase();

      return `
      <tr class="result-row ${result.success ? 'success' : result.skipped ? 'skipped' : 'failure'}" onclick="toggleDetail('detail-${idx}', this)">
        <td><span class="chevron" id="chev-${idx}">▶</span> ${userBadge}<strong>${this.escapeHtml(result.name)}</strong></td>
        <td><span class="method ${methodClass}">${this.escapeHtml(result.method || '')}</span></td>
        <td class="${result.success ? 'status-ok' : 'status-err'}">${result.statusCode || 'ERROR'}</td>
        <td>${result.timing != null ? result.timing + 'ms' : '—'}</td>
        <td>${statusBadge}</td>
      </tr>
      <tr class="detail-row" id="detail-${idx}" style="display:none">
        <td colspan="5">
          <div class="detail-panel">
            <div class="detail-tabs">
              <button class="tab-btn active" onclick="switchTab(event,'req-${idx}','res-${idx}')">Request</button>
              <button class="tab-btn" onclick="switchTab(event,'res-${idx}','req-${idx}')">Response</button>
            </div>
            <div class="tab-pane" id="req-${idx}">
              <div class="detail-section">
                <div class="detail-label">URL</div>
                <pre class="code-block url-block">${this.escapeHtml((req.url || result.url || ''))}</pre>
              </div>
              <div class="detail-section">
                <div class="detail-label">Headers</div>
                <pre class="code-block">${this.formatJson(reqHeaders)}</pre>
              </div>
              <div class="detail-section">
                <div class="detail-label">Body</div>
                <pre class="code-block">${this.formatJson(reqBody)}</pre>
              </div>
              <div class="detail-section">
                <div class="curl-bar">
                  <span class="detail-label" style="margin:0">cURL</span>
                  <button class="curl-btn" onclick="copyCurl(event,'curl-${idx}')">Copy</button>
                </div>
                <pre class="code-block curl-block" id="curl-${idx}">${this.escapeHtml(this.buildCurl(result))}</pre>
              </div>
            </div>
            <div class="tab-pane" id="res-${idx}" style="display:none">
              ${result.error ? `<div class="detail-section"><div class="detail-label error-label">Error</div><pre class="code-block error-block">${this.escapeHtml(result.error)}</pre></div>` : ''}
              <div class="detail-section">
                <div class="detail-label">Headers</div>
                <pre class="code-block">${this.formatJson(resHeaders)}</pre>
              </div>
              <div class="detail-section">
                <div class="detail-label">Body</div>
                <pre class="code-block">${this.formatJson(resBody)}</pre>
              </div>
            </div>
          </div>
        </td>
      </tr>`;
    }).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>API Test Report — ${this.escapeHtml(report.suite)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f0f2f5;
      padding: 24px;
      color: #1a1a2e;
    }
    .container {
      max-width: 1300px;
      margin: 0 auto;
      background: #fff;
      border-radius: 10px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #fff;
      padding: 36px 40px;
    }
    .header h1 { font-size: 28px; font-weight: 700; margin-bottom: 6px; }
    .header p { font-size: 13px; opacity: 0.85; }
    .summary {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 0;
      border-bottom: 1px solid #eee;
    }
    .summary-card {
      text-align: center;
      padding: 24px 20px;
      border-right: 1px solid #eee;
    }
    .summary-card:last-child { border-right: none; }
    .summary-card .label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 8px; }
    .summary-card .value { font-size: 36px; font-weight: 700; }
    .summary-card.total .value { color: #667eea; }
    .summary-card.pass .value { color: #28a745; }
    .summary-card.fail .value { color: #dc3545; }
    .summary-card.skip .value { color: #e67e22; }
    .summary-card.rate .value { font-size: 28px; color: ${passColor}; }
    .content { padding: 24px 30px 30px; }
    .content h2 { font-size: 17px; font-weight: 600; color: #333; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    thead tr { background: #f7f8fa; }
    th {
      padding: 11px 14px;
      text-align: left;
      font-weight: 600;
      font-size: 12px;
      color: #555;
      text-transform: uppercase;
      letter-spacing: .4px;
      border-bottom: 2px solid #e5e7eb;
    }
    .result-row td { padding: 11px 14px; border-bottom: 1px solid #f0f0f0; vertical-align: middle; }
    .result-row { cursor: pointer; transition: background .15s; }
    .result-row:hover { background: #f7f8ff; }
    .result-row.failure td { background: #fff8f8; }
    .result-row.failure:hover td { background: #fff0f0; }
    .result-row.skipped td { background: #fffbf0; }
    .result-row.skipped:hover td { background: #fff5e0; }
    .chevron { display: inline-block; font-size: 10px; margin-right: 6px; color: #999; transition: transform .2s; }
    .chevron.open { transform: rotate(90deg); color: #667eea; }
    .user-badge {
      display: inline-block;
      background: #eef2ff;
      color: #667eea;
      font-size: 11px;
      font-weight: 600;
      padding: 2px 7px;
      border-radius: 10px;
      margin-right: 6px;
      vertical-align: middle;
    }
    .method {
      display: inline-block;
      font-size: 11px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 4px;
      letter-spacing: .3px;
    }
    .method.get  { background: #e8f5e9; color: #2e7d32; }
    .method.post { background: #e3f2fd; color: #1565c0; }
    .method.put  { background: #fff3e0; color: #e65100; }
    .method.patch { background: #f3e5f5; color: #6a1b9a; }
    .method.delete { background: #ffebee; color: #c62828; }
    .status-ok  { color: #2e7d32; font-weight: 600; }
    .status-err { color: #c62828; font-weight: 600; }
    .badge { font-size: 12px; font-weight: 600; }
    .badge.pass { color: #28a745; }
    .badge.skip { color: #e67e22; }
    .badge.fail { color: #dc3545; }
    .detail-row td { padding: 0; background: #f9fafc; border-bottom: 2px solid #e5e7eb; }
    .detail-panel { padding: 16px 20px 20px; }
    .detail-tabs { display: flex; gap: 4px; margin-bottom: 14px; }
    .tab-btn {
      padding: 6px 16px;
      border: 1px solid #ddd;
      background: #fff;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      color: #555;
      transition: all .15s;
    }
    .tab-btn.active { background: #667eea; color: #fff; border-color: #667eea; }
    .tab-btn:hover:not(.active) { background: #f0f2ff; border-color: #667eea; color: #667eea; }
    .detail-section { margin-bottom: 14px; }
    .detail-section:last-child { margin-bottom: 0; }
    .detail-label {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .5px;
      color: #888;
      margin-bottom: 6px;
    }
    .detail-label.error-label { color: #dc3545; }
    .code-block {
      background: #1e1e2e;
      color: #cdd6f4;
      font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace;
      font-size: 12.5px;
      line-height: 1.6;
      padding: 14px 16px;
      border-radius: 6px;
      overflow-x: auto;
      white-space: pre-wrap;
      word-break: break-all;
      max-height: 420px;
      overflow-y: auto;
    }
    .url-block {
      background: #1e2a1e;
      color: #a6e3a1;
      max-height: 60px;
    }
    .error-block {
      background: #2a1e1e;
      color: #f38ba8;
    }
    .curl-bar { display:flex; align-items:center; justify-content:space-between; margin-bottom:6px; }
    .curl-btn { padding:3px 12px; font-size:12px; font-weight:600; background:#667eea; color:#fff; border:none; border-radius:5px; cursor:pointer; transition:background .15s; }
    .curl-btn:hover { background:#5a6fd6; }
    .curl-btn.copied { background:#28a745; }
    .curl-block { background:#1e1e2e; color:#cba6f7; max-height:200px; }
    .footer {
      background: #f7f8fa;
      padding: 16px 30px;
      text-align: center;
      color: #999;
      font-size: 11px;
      border-top: 1px solid #eee;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>API Test Report</h1>
      <p>${this.escapeHtml(report.suite)} &nbsp;·&nbsp; ${new Date(report.timestamp).toLocaleString()}</p>
    </div>

    <div class="summary">
      <div class="summary-card total">
        <div class="label">Total</div>
        <div class="value">${report.summary.totalRequests}</div>
      </div>
      <div class="summary-card pass">
        <div class="label">Passed</div>
        <div class="value">${report.summary.passed}</div>
      </div>
      <div class="summary-card fail">
        <div class="label">Failed</div>
        <div class="value">${report.summary.failed}</div>
      </div>
      <div class="summary-card skip">
        <div class="label">Skipped</div>
        <div class="value">${report.summary.skipped}</div>
      </div>
      <div class="summary-card rate">
        <div class="label">Pass Rate</div>
        <div class="value">${report.summary.passRate}</div>
      </div>
    </div>

    <div class="content">
      <h2>Results — click a row to inspect</h2>
      <table>
        <thead>
          <tr>
            <th>Request</th>
            <th>Method</th>
            <th>Status</th>
            <th>Timing</th>
            <th>Result</th>
          </tr>
        </thead>
        <tbody>
          ${resultsHtml}
        </tbody>
      </table>
    </div>

    <div class="footer">
      Generated ${new Date().toLocaleString()} &nbsp;·&nbsp; ${this.escapeHtml(this.responsesDir)}
    </div>
  </div>

  <script>
    function toggleDetail(id, row) {
      const detail = document.getElementById(id);
      const idx = id.split('-')[1];
      const chev = document.getElementById('chev-' + idx);
      const isOpen = detail.style.display !== 'none';
      detail.style.display = isOpen ? 'none' : 'table-row';
      chev.classList.toggle('open', !isOpen);
    }
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
    function switchTab(event, showId, hideId) {
      event.stopPropagation();
      document.getElementById(showId).style.display = 'block';
      document.getElementById(hideId).style.display = 'none';
      const panel = event.target.closest('.detail-panel');
      panel.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      event.target.classList.add('active');
    }
  </script>
</body>
</html>`;
  }

  /**
   * Sanitize filename
   * @param {string} name - Original name
   * @returns {string} Sanitized filename
   */
  sanitizeFileName(name) {
    return name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  }

  /**
   * Get report directory
   * @returns {string} Report directory path
   */
  getReportDir() {
    return this.reportDir;
  }
}

module.exports = ReportGenerator;
