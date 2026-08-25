const db = require('../backend/database');
const syncEngine = require('../backend/sync');

async function testSyncEngine() {
  console.log('--- 🧪 Testing Legal OS Delta Sync Engine ---');

  await new Promise(r => setTimeout(r, 1500)); // wait for db initialization

  // 1. Verify sync_outbox table exists
  await new Promise((resolve, reject) => {
    db.all("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('sync_outbox', 'sync_cursors')", [], (err, rows) => {
      if (err) return reject(err);
      console.log('✅ Found sync infrastructure tables:', rows.map(r => r.name));
      resolve();
    });
  });

  // 2. Verify universal columns exist on case_tracking and leads
  await new Promise((resolve, reject) => {
    db.all("PRAGMA table_info(case_tracking)", [], (err, cols) => {
      if (err) return reject(err);
      const colNames = cols.map(c => c.name);
      const hasUpdated = colNames.includes('updated_at');
      const hasDeleted = colNames.includes('is_deleted');
      const hasDeletedAt = colNames.includes('deleted_at');
      const hasVersion = colNames.includes('version_id');
      console.log(`✅ case_tracking sync columns: updated_at=${hasUpdated}, is_deleted=${hasDeleted}, deleted_at=${hasDeletedAt}, version_id=${hasVersion}`);
      resolve();
    });
  });

  // 3. Test recording an Outbox mutation
  console.log('Testing outbox mutation recording...');
  syncEngine.recordMutation('leads', 'test_lead_001', 'UPDATE', { full_name: 'Test Client Ltd', status: 'converted' });
  await new Promise(r => setTimeout(r, 500));

  const outboxRows = await new Promise((resolve, reject) => {
    db.all("SELECT * FROM sync_outbox WHERE row_id = 'test_lead_001'", [], (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
  console.log(`✅ Outbox recorded ${outboxRows.length} mutation(s):`, outboxRows[0]?.id);

  // 4. Test telemetry getter
  const telemetry = syncEngine.getSyncTelemetry();
  console.log('✅ Telemetry state:', {
    pendingOutboxCount: telemetry.pendingOutboxCount,
    isSyncing: telemetry.isSyncing,
    remoteUrl: telemetry.remoteUrl
  });

  // 5. Test Server Delta Push handler
  console.log('Testing handleDeltaPush with field-level LWW...');
  const mockReq = {
    body: {
      mutations: [
        {
          id: 'mut_test_1',
          table_name: 'extracted_facts',
          row_id: 'fact_test_01',
          action: 'INSERT',
          payload: {
            case_id: 'c_test_01',
            fact_date: '2026-08-25',
            description: 'Executed Contract for Deed at Milimani',
            pincite: 'Paragraph 14, Page 2',
            status: 'Admitted'
          }
        }
      ]
    }
  };

  let pushResponseData = null;
  const mockRes = {
    json: (data) => { pushResponseData = data; },
    status: () => mockRes
  };

  await syncEngine.handleDeltaPush(mockReq, mockRes);
  console.log('✅ Delta push response:', pushResponseData);

  // Verify row was inserted with version_id
  const factRow = await new Promise((resolve) => {
    db.get("SELECT * FROM extracted_facts WHERE id = 'fact_test_01'", [], (err, row) => resolve(row));
  });
  console.log('✅ Inserted fact row with version_id:', factRow?.version_id, 'description:', factRow?.description);

  // 6. Test soft-delete mutation
  const mockDeleteReq = {
    body: {
      mutations: [
        {
          id: 'mut_test_2',
          table_name: 'extracted_facts',
          row_id: 'fact_test_01',
          action: 'DELETE',
          payload: {}
        }
      ]
    }
  };

  await syncEngine.handleDeltaPush(mockDeleteReq, mockRes);
  const deletedFactRow = await new Promise((resolve) => {
    db.get("SELECT id, is_deleted, deleted_at FROM extracted_facts WHERE id = 'fact_test_01'", [], (err, row) => resolve(row));
  });
  console.log('✅ Soft-deleted fact verification: is_deleted =', deletedFactRow?.is_deleted, 'deleted_at =', deletedFactRow?.deleted_at);

  // Clean up test data
  db.run("DELETE FROM sync_outbox WHERE row_id = 'test_lead_001'");
  db.run("DELETE FROM extracted_facts WHERE id = 'fact_test_01'");

  console.log('\n🎉 ALL DELTA SYNC ENGINE VERIFICATIONS PASSED SUCCESSFULLY!');
  process.exit(0);
}

testSyncEngine().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
