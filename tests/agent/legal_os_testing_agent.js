/**
 * Legal OS Synthetic Advocate Testing Agent - Master CLI Orchestrator
 * Usage:
 *   node tests/agent/legal_os_testing_agent.js
 *   node tests/agent/legal_os_testing_agent.js --headed
 *   node tests/agent/legal_os_testing_agent.js --feature=cases
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ApiInterceptor = require('./helpers/api_interceptor');
const DbVerifier = require('./helpers/db_verifier');
const ReportGenerator = require('./report_generator');

const runAuthDashboardSuite = require('./features/01_auth_dashboard.spec');
const runCaseLifecycleSuite = require('./features/02_case_lifecycle.spec');
const runClientKycSuite = require('./features/03_client_kyc.spec');
const runDocumentStudioSuite = require('./features/04_document_studio.spec');
const runCalendarSubmissionsSuite = require('./features/05_calendar_submissions.spec');
const runFinancialsSuite = require('./features/06_financials.spec');
const runAiAssistantSuite = require('./features/07_ai_assistant.spec');
const runGeneralE2ESuite = require('./features/08_general_e2e.spec');

async function main() {
  const args = process.argv.slice(2);
  const isHeaded = args.includes('--headed');
  const featureArg = args.find(a => a.startsWith('--feature='))?.split('=')[1] || 'general';

  console.log('\n======================================================');
  console.log('⚖️   LEGAL OS SYNTHETIC ADVOCATE TESTING AGENT');
  console.log('======================================================');
  console.log(`Mode:    ${isHeaded ? '🖥️  HEADED (Interactive Desktop Visual)' : '⚡ HEADLESS'}`);
  console.log(`Feature: ${featureArg.toUpperCase()}`);
  console.log('------------------------------------------------------\n');

  const reportDir = path.join(process.cwd(), 'test-results');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const reportGen = new ReportGenerator(reportDir);
  const dbVerifier = new DbVerifier();

  // Launch Playwright Browser (uses system Edge/Chrome or installed Chromium)
  let browser;
  try {
    browser = await chromium.launch({
      channel: 'msedge',
      headless: !isHeaded,
      slowMo: isHeaded ? 650 : 0
    });
  } catch (e1) {
    try {
      browser = await chromium.launch({
        channel: 'chrome',
        headless: !isHeaded,
        slowMo: isHeaded ? 650 : 0
      });
    } catch (e2) {
      browser = await chromium.launch({
        headless: !isHeaded,
        slowMo: isHeaded ? 650 : 0
      });
    }
  }

  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 }
  });

  const page = await context.newPage();
  const interceptor = new ApiInterceptor();
  interceptor.attach(page);

  try {
    if (featureArg === 'auth') {
      const res = await runAuthDashboardSuite(page, reportDir, dbVerifier);
      reportGen.addSuiteResult(res.suiteName, res.steps);
    } else if (featureArg === 'cases') {
      await runAuthDashboardSuite(page, reportDir, dbVerifier);
      const res = await runCaseLifecycleSuite(page, reportDir, dbVerifier);
      reportGen.addSuiteResult(res.suiteName, res.steps);
    } else if (featureArg === 'kyc') {
      await runAuthDashboardSuite(page, reportDir, dbVerifier);
      const res = await runClientKycSuite(page, reportDir, dbVerifier);
      reportGen.addSuiteResult(res.suiteName, res.steps);
    } else if (featureArg === 'documents') {
      await runAuthDashboardSuite(page, reportDir, dbVerifier);
      const res = await runDocumentStudioSuite(page, reportDir, dbVerifier);
      reportGen.addSuiteResult(res.suiteName, res.steps);
    } else if (featureArg === 'calendar') {
      await runAuthDashboardSuite(page, reportDir, dbVerifier);
      const res = await runCalendarSubmissionsSuite(page, reportDir, dbVerifier);
      reportGen.addSuiteResult(res.suiteName, res.steps);
    } else if (featureArg === 'financials') {
      await runAuthDashboardSuite(page, reportDir, dbVerifier);
      const res = await runFinancialsSuite(page, reportDir, dbVerifier);
      reportGen.addSuiteResult(res.suiteName, res.steps);
    } else if (featureArg === 'ai') {
      await runAuthDashboardSuite(page, reportDir, dbVerifier);
      const res = await runAiAssistantSuite(page, reportDir, dbVerifier);
      reportGen.addSuiteResult(res.suiteName, res.steps);
    } else {
      // General E2E Master Pass
      const res = await runGeneralE2ESuite(page, reportDir, dbVerifier);
      reportGen.addSuiteResult(res.suiteName, res.steps);
    }

  } catch (err) {
    console.error('❌ Agent encountered execution error:', err.message);
  } finally {
    await browser.close();
    
    const htmlReportPath = reportGen.generateHTML();
    console.log('\n======================================================');
    console.log('✅ SYNTHETIC ADVOCATE TESTING AGENT RUN COMPLETE');
    console.log(`📄 Diagnostic HTML Report: file:///${htmlReportPath.replace(/\\/g, '/')}`);
    console.log('======================================================\n');
  }
}

main();
