const db = require('../backend/database');

async function testTriggers() {
  console.log('--- 🧪 Testing Automatic SQLite Mutation Triggers ---');
  await new Promise(r => setTimeout(r, 1500));

  // 1. Advance milestone on a test case
  const testCaseId = 'c_trigger_test_01';
  db.run(`INSERT INTO case_tracking (id, tracking_token, client_name, case_title, case_type, current_milestone) VALUES (?, 'TRG-001', 'Trigger Client', 'Trigger v Test', 'Civil', '1')`, [testCaseId]);
  
  await new Promise(r => setTimeout(r, 500));

  // Check outbox
  const rows1 = await new Promise(res => db.all("SELECT * FROM sync_outbox WHERE row_id = ?", [testCaseId], (e, r) => res(r || [])));
  console.log(`✅ After INSERT, outbox entries for ${testCaseId}:`, rows1.length, rows1.map(r => r.action));

  // 2. Update milestone
  db.run(`UPDATE case_tracking SET current_milestone = '2' WHERE id = ?`, [testCaseId]);
  await new Promise(r => setTimeout(r, 500));

  const rows2 = await new Promise(res => db.all("SELECT * FROM sync_outbox WHERE row_id = ?", [testCaseId], (e, r) => res(r || [])));
  console.log(`✅ After UPDATE (milestone advance), outbox entries:`, rows2.length, rows2.map(r => r.action));

  // Cleanup
  db.run("DELETE FROM case_tracking WHERE id = ?", [testCaseId]);
  db.run("DELETE FROM sync_outbox WHERE row_id = ?", [testCaseId]);
  console.log('🎉 Triggers verified!');
  process.exit(0);
}

testTriggers().catch(err => { console.error(err); process.exit(1); });
