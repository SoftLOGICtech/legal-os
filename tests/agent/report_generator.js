/**
 * Legal OS Synthetic Advocate Testing Agent - HTML & JSON Diagnostic Report Generator
 * Generates an executive visual HTML report with embedded screenshots, network diagnostics, and timing benchmarks
 */

const fs = require('fs');
const path = require('path');

class ReportGenerator {
  constructor(outputDir = path.join(process.cwd(), 'test-results')) {
    this.outputDir = outputDir;
    this.startTime = Date.now();
    this.suiteResults = [];
  }

  addSuiteResult(suiteName, steps, summary) {
    this.suiteResults.push({
      suiteName,
      steps,
      summary,
      timestamp: new Date().toISOString()
    });
  }

  generateJSON() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
    
    const data = {
      title: "Legal OS Synthetic Advocate Testing Agent - Diagnostic Report",
      generatedAt: new Date().toISOString(),
      totalDurationMs: Date.now() - this.startTime,
      suites: this.suiteResults
    };

    fs.writeFileSync(path.join(this.outputDir, 'report.json'), JSON.stringify(data, null, 2));
    return data;
  }

  generateHTML() {
    const json = this.generateJSON();
    
    let totalSteps = 0;
    let totalPassed = 0;
    let totalFailed = 0;
    let totalSkipped = 0;

    this.suiteResults.forEach(s => {
      s.steps.forEach(st => {
        totalSteps++;
        if (st.status === 'PASS') totalPassed++;
        else if (st.status === 'FAIL') totalFailed++;
        else totalSkipped++;
      });
    });

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Legal OS Diagnostic Test Report</title>
  <style>
    :root {
      --bg: #060e1c;
      --card-bg: #0d1b2a;
      --accent-gold: #d4af37;
      --accent-emerald: #10b981;
      --accent-red: #ef4444;
      --text: #e2e8f0;
      --text-muted: #94a3b8;
      --border: #1e293b;
    }
    body {
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      margin: 0;
      padding: 24px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--border);
      margin-bottom: 24px;
    }
    .title-group h1 {
      margin: 0;
      font-size: 1.8rem;
      color: #ffffff;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .badge-gold {
      background-color: rgba(212, 175, 55, 0.15);
      color: var(--accent-gold);
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 0.85rem;
      border: 1px solid rgba(212, 175, 55, 0.3);
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 16px;
      margin-bottom: 30px;
    }
    .stat-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px;
      text-align: center;
    }
    .stat-val {
      font-size: 2rem;
      font-weight: 700;
      margin-top: 4px;
    }
    .pass { color: var(--accent-emerald); }
    .fail { color: var(--accent-red); }
    .gold { color: var(--accent-gold); }
    
    .suite-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      margin-bottom: 24px;
      overflow: hidden;
    }
    .suite-header {
      padding: 16px 20px;
      background: rgba(255,255,255,0.02);
      border-bottom: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .suite-title {
      font-weight: 600;
      font-size: 1.1rem;
    }
    .step-list {
      padding: 16px 20px;
    }
    .step-item {
      display: flex;
      flex-direction: column;
      padding: 12px;
      border-bottom: 1px solid rgba(255,255,255,0.04);
      gap: 8px;
    }
    .step-item:last-child { border-bottom: none; }
    .step-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .status-tag {
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 700;
    }
    .tag-pass { background: rgba(16, 185, 129, 0.2); color: var(--accent-emerald); }
    .tag-fail { background: rgba(239, 68, 68, 0.2); color: var(--accent-red); }
    .tag-skip { background: rgba(148, 163, 184, 0.2); color: var(--text-muted); }

    .screenshot-thumb {
      max-width: 450px;
      border-radius: 8px;
      border: 1px solid var(--border);
      margin-top: 8px;
    }
    .error-box {
      background: rgba(239, 68, 68, 0.1);
      border-left: 3px solid var(--accent-red);
      padding: 10px;
      font-family: monospace;
      font-size: 0.85rem;
      color: #fca5a5;
      white-space: pre-wrap;
    }
  </style>
</head>
<body>

  <div class="header">
    <div class="title-group">
      <h1>⚖️ Legal OS Synthetic Advocate Testing Agent</h1>
      <span class="badge-gold">Diagnostic Suite Report</span>
    </div>
    <div style="color: var(--text-muted); font-size: 0.9rem;">
      Generated: ${new Date().toLocaleString()}
    </div>
  </div>

  <div class="stats-grid">
    <div class="stat-card">
      <div style="color: var(--text-muted); font-size: 0.85rem;">Total Scenarios</div>
      <div class="stat-val gold">${totalSteps}</div>
    </div>
    <div class="stat-card">
      <div style="color: var(--text-muted); font-size: 0.85rem;">Passed</div>
      <div class="stat-val pass">${totalPassed}</div>
    </div>
    <div class="stat-card">
      <div style="color: var(--text-muted); font-size: 0.85rem;">Failed</div>
      <div class="stat-val fail">${totalFailed}</div>
    </div>
    <div class="stat-card">
      <div style="color: var(--text-muted); font-size: 0.85rem;">Duration</div>
      <div class="stat-val">${(json.totalDurationMs / 1000).toFixed(2)}s</div>
    </div>
  </div>

  ${this.suiteResults.map(suite => `
    <div class="suite-card">
      <div class="suite-header">
        <div class="suite-title">${suite.suiteName}</div>
        <div>Passed ${suite.steps.filter(s => s.status === 'PASS').length} / ${suite.steps.length}</div>
      </div>
      <div class="step-list">
        ${suite.steps.map(step => `
          <div class="step-item">
            <div class="step-top">
              <div>
                <strong>${step.title}</strong>
                <span style="color: var(--text-muted); font-size: 0.85rem; margin-left: 10px;">${step.durationMs ? step.durationMs + 'ms' : ''}</span>
              </div>
              <span class="status-tag tag-${step.status.toLowerCase()}">${step.status}</span>
            </div>
            ${step.details ? `<div style="color: var(--text-muted); font-size: 0.9rem;">${step.details}</div>` : ''}
            ${step.error ? `<div class="error-box">${step.error}</div>` : ''}
            ${step.screenshot ? `<img class="screenshot-thumb" src="${step.screenshot}" alt="${step.title}">` : ''}
          </div>
        `).join('')}
      </div>
    </div>
  `).join('')}

</body>
</html>`;

    fs.writeFileSync(path.join(this.outputDir, 'report.html'), htmlContent);
    return path.join(this.outputDir, 'report.html');
  }
}

module.exports = ReportGenerator;
