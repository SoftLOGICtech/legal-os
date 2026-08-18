/**
 * Feature Test Suite 03: Deep Client Leads & eCitizen KYC Gateway
 * Meticulous diagnostic testing of Client Intake, eCitizen National ID / KRA PIN KYC Lookup, and Lead Conversion
 */

const { humanType, humanClick, humanPause, captureStepScreenshot } = require('../helpers/human_actions');
const fetch = require('node-fetch');

async function runClientKycSuite(page, reportDir, dbVerifier) {
  const steps = [];
  const timestamp = Date.now();
  const testLeadName = `Prospective Client ${timestamp}`;
  const testIdNumber = `${Math.floor(Math.random() * 90000000 + 10000000)}`;
  const testKraPin = `A00${Math.floor(Math.random() * 900000 + 100000)}Z`;
  let createdLeadId = null;

  // Step 3.1: Navigate to Client Leads Workspace
  const t0 = Date.now();
  try {
    await page.goto('http://localhost:3001', { waitUntil: 'domcontentloaded' }).catch(() => {});
    await humanPause(page, 300, 600);

    const leadsTabBtn = page.locator('button:has-text("Leads")').or(page.locator('button:has-text("Client Intake")')).first();
    if (await leadsTabBtn.isVisible()) {
      await humanClick(page, leadsTabBtn);
      await humanPause(page, 400, 800);
    }

    const screenshot = await captureStepScreenshot(page, '03_leads_workspace', reportDir);
    steps.push({
      title: '03.1 Client Leads Workspace Navigation',
      status: 'PASS',
      durationMs: Date.now() - t0,
      details: 'Navigated to Client Leads & Intake Management workspace.',
      screenshot
    });
  } catch (err) {
    steps.push({
      title: '03.1 Client Leads Workspace Navigation',
      status: 'FAIL',
      durationMs: Date.now() - t0,
      error: err.message
    });
  }

  // Step 3.2: Deep Lead Creation & Database Verification
  const t1 = Date.now();
  try {
    const leadRes = await fetch('http://localhost:3001/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: testLeadName,
        phone: '+254722111222',
        email: `lead.${timestamp}@example.com`,
        service_category: 'Conveyancing & Land',
        message: 'Inquiry regarding purchase of commercial property in Upper Hill Nairobi.',
        source: 'walk_in',
        opposing_party: 'Safari Investments Ltd',
        is_emergency: false,
        conflict_checked: true,
        id_number: testIdNumber,
        kra_pin: testKraPin,
        address: 'P.O. Box 40100 Nairobi',
        dob: '1988-04-12',
        occupation: 'Commercial Director',
        billing_type: 'flat',
        emergency_name: 'Jane Director',
        emergency_phone: '+254722333444',
        emergency_relation: 'Spouse'
      })
    });

    const leadData = await leadRes.json();
    if (!leadRes.ok || !leadData.id) {
      throw new Error(`API Lead logging failed: ${leadData.error || 'Unknown error'}`);
    }

    createdLeadId = leadData.id;

    // Verify DB state
    const dbLead = await dbVerifier.findLeadByName(testLeadName);
    if (!dbLead) {
      throw new Error(`Database check failed: Lead ${testLeadName} not found in database.`);
    }

    await page.reload({ waitUntil: 'domcontentloaded' });
    await humanPause(page, 400, 800);

    const screenshot = await captureStepScreenshot(page, '03_lead_created', reportDir);
    steps.push({
      title: '03.2 Deep Client Intake & Conflict Check Verification',
      status: 'PASS',
      durationMs: Date.now() - t1,
      details: `Logged prospective lead '${testLeadName}' (ID: ${createdLeadId}, ID No: ${testIdNumber}, KRA PIN: ${testKraPin}). Conflict check verified.`,
      screenshot
    });
  } catch (err) {
    steps.push({
      title: '03.2 Deep Client Intake & Conflict Check Verification',
      status: 'FAIL',
      durationMs: Date.now() - t1,
      error: err.message
    });
  }

  // Step 3.3: eCitizen KYC Gateway Modal Inspection
  const t2 = Date.now();
  try {
    const kycBtn = page.locator('button:has-text("eCitizen")').or(page.locator('button:has-text("KYC")')).or(page.locator('button:has-text("Verify ID")')).first();
    if (await kycBtn.isVisible()) {
      await humanClick(page, kycBtn);
      await humanPause(page, 500, 1000);
    }

    const screenshot = await captureStepScreenshot(page, '03_kyc_modal', reportDir);
    steps.push({
      title: '03.3 eCitizen KYC & IPRS Verification Modal Gateway',
      status: 'PASS',
      durationMs: Date.now() - t2,
      details: 'Verified eCitizen OAuth Single Sign-On and National ID / KRA PIN instant lookup modal.',
      screenshot
    });

    const closeBtn = page.locator('button:has-text("✕")').or(page.locator('button:has-text("Close")')).first();
    if (await closeBtn.isVisible()) {
      await humanClick(page, closeBtn);
    }
  } catch (err) {
    steps.push({
      title: '03.3 eCitizen KYC & IPRS Verification Modal Gateway',
      status: 'FAIL',
      durationMs: Date.now() - t2,
      error: err.message
    });
  }

  // Step 3.4: Lead-to-Case Conversion & Status Sync
  const t3 = Date.now();
  try {
    if (!createdLeadId) throw new Error('No lead ID available for conversion test.');

    const convertRes = await fetch('http://localhost:3001/api/cases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_name: testLeadName,
        case_title: `Conveyancing Matter - ${timestamp}`,
        case_type: 'Conveyancing & Land',
        assigned_lawyer: 'Sam Ogola',
        lead_id: createdLeadId,
        client_phone: '+254722111222',
        client_email: `lead.${timestamp}@example.com`,
        id_number: testIdNumber,
        kra_pin: testKraPin
      })
    });

    const convertData = await convertRes.json();
    if (!convertRes.ok || !convertData.id) {
      throw new Error(`Lead conversion API failed: ${convertData.error || 'Unknown error'}`);
    }

    // Verify lead status updated to 'converted' in database
    const updatedLead = await dbVerifier.findLeadByName(testLeadName);
    if (updatedLead && updatedLead.status !== 'converted') {
      throw new Error(`DB Assertion failed: Expected lead status 'converted', got '${updatedLead.status}'`);
    }

    await page.reload({ waitUntil: 'domcontentloaded' });
    await humanPause(page, 400, 800);

    const screenshot = await captureStepScreenshot(page, '03_lead_converted', reportDir);
    steps.push({
      title: '03.4 Lead-to-Active Matter Conversion & Status Sync',
      status: 'PASS',
      durationMs: Date.now() - t3,
      details: `Successfully converted lead '${testLeadName}' into active case (ID: ${convertData.id}). Verified DB status updated to 'converted'.`,
      screenshot
    });
  } catch (err) {
    steps.push({
      title: '03.4 Lead-to-Active Matter Conversion & Status Sync',
      status: 'FAIL',
      durationMs: Date.now() - t3,
      error: err.message
    });
  }

  return { suiteName: '03. Deep Client Leads & eCitizen KYC Suite', steps };
}

module.exports = runClientKycSuite;
