/**
 * Master General End-to-End Test Suite 08
 * Executes a continuous, end-to-end advocate workflow combining auth, case management, client intake, document studio, calendar, and AI assistant
 */

const runAuthDashboardSuite = require('./01_auth_dashboard.spec.js');
const runCaseLifecycleSuite = require('./02_case_lifecycle.spec.js');
const runClientKycSuite = require('./03_client_kyc.spec.js');
const runDocumentStudioSuite = require('./04_document_studio.spec.js');
const runCalendarSubmissionsSuite = require('./05_calendar_submissions.spec.js');
const runFinancialsSuite = require('./06_financials.spec.js');
const runAiAssistantSuite = require('./07_ai_assistant.spec.js');

async function runGeneralE2ESuite(page, reportDir, dbVerifier) {
  const allSteps = [];

  console.log('🚀 Running Master General End-to-End User Journey...');

  const s1 = await runAuthDashboardSuite(page, reportDir, dbVerifier);
  allSteps.push(...s1.steps);

  const s2 = await runCaseLifecycleSuite(page, reportDir, dbVerifier);
  allSteps.push(...s2.steps);

  const s3 = await runClientKycSuite(page, reportDir, dbVerifier);
  allSteps.push(...s3.steps);

  const s4 = await runDocumentStudioSuite(page, reportDir, dbVerifier);
  allSteps.push(...s4.steps);

  const s5 = await runCalendarSubmissionsSuite(page, reportDir, dbVerifier);
  allSteps.push(...s5.steps);

  const s6 = await runFinancialsSuite(page, reportDir, dbVerifier);
  allSteps.push(...s6.steps);

  const s7 = await runAiAssistantSuite(page, reportDir, dbVerifier);
  allSteps.push(...s7.steps);

  return { suiteName: '08. Master General End-to-End Advocate User Journey', steps: allSteps };
}

module.exports = runGeneralE2ESuite;
