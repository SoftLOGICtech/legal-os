const db = require('./database');
const fetch = require('node-fetch');
const crypto = require('crypto');

// ── SYNCED TABLES SPECIFICATION ──────────────────────────────────────────────
const SYNC_TABLES = [
  {
    name: 'users',
    key: 'id',
    cols: ['id', 'username', 'display_name', 'password_hash', 'salt', 'role', 'created_at', 'updated_at', 'is_deleted', 'deleted_at', 'version_id']
  },
  {
    name: 'leads',
    key: 'id',
    cols: [
      'id', 'full_name', 'email', 'phone', 'service_category', 'property_location', 
      'property_value', 'message', 'source', 'status', 'consultation_date', 
      'consultation_paid', 'assigned_lawyer', 'created_at', 'opposing_party', 
      'is_emergency', 'conflict_checked', 'id_number', 'kra_pin', 'address', 'custom_kyc',
      'dob', 'occupation', 'opposing_party_contact', 'billing_type', 'emergency_name',
      'emergency_phone', 'emergency_relation', 'alternative_phone', 'alternative_email',
      'opposing_counsel_name', 'opposing_counsel_firm', 'opposing_counsel_phone',
      'opposing_counsel_email', 'opposing_counsel_address', 'assigned_judge', 'court_division',
      'updated_at', 'is_deleted', 'deleted_at', 'version_id'
    ]
  },
  {
    name: 'case_tracking',
    key: 'id',
    cols: [
      'id', 'tracking_token', 'client_name', 'case_title', 'case_type', 'current_milestone', 
      'milestones_json', 'completion_percentage', 'assigned_lawyer', 'fee_status', 'last_updated', 
      'opposing_party', 'ref_no', 'judiciary_case_id', 'judiciary_filing_token', 
      'trust_payment_status', 'trust_payment_ref', 'is_sensitive', 'id_number', 'kra_pin', 
      'address', 'custom_kyc', 'court_station', 'total_fee', 'outstanding_balance', 
      'client_phone', 'client_email', 'last_cts_sync_at', 'cts_sync_status',
      'billing_type', 'emergency_name', 'emergency_phone', 'emergency_relation',
      'alternative_phone', 'alternative_email', 'opposing_counsel_name',
      'opposing_counsel_firm', 'opposing_counsel_phone', 'opposing_counsel_email',
      'opposing_counsel_address', 'assigned_judge', 'court_division', 'case_brief',
      'cause_of_action', 'suit_value', 'strategy_json', 'courtroom_no', 'opposing_counsel',
      'updated_at', 'is_deleted', 'deleted_at', 'version_id'
    ]
  },
  {
    name: 'court_calendar',
    key: 'id',
    cols: ['id', 'case_id', 'event_title', 'event_type', 'event_date', 'notes', 'is_important', 'assigned_lawyer', 'reminder_sent', 'created_at', 'updated_at', 'is_deleted', 'deleted_at', 'version_id']
  },
  {
    name: 'case_activities',
    key: 'id',
    cols: ['id', 'case_id', 'activity_type', 'description', 'recorded_by', 'is_starred', 'created_at', 'updated_at', 'is_deleted', 'deleted_at', 'version_id']
  },
  {
    name: 'firm_expenses',
    key: 'id',
    cols: ['id', 'case_id', 'amount', 'category', 'description', 'recorded_by', 'created_at', 'updated_at', 'is_deleted', 'deleted_at', 'version_id']
  },
  {
    name: 'case_payments',
    key: 'id',
    cols: ['id', 'case_id', 'amount', 'payment_ref', 'payment_method', 'notes', 'recorded_by', 'payment_date', 'destination', 'invoice_id', 'updated_at', 'is_deleted', 'deleted_at', 'version_id']
  },
  {
    name: 'case_files',
    key: 'id',
    cols: ['id', 'case_id', 'file_name', 'file_path', 'file_size', 'uploaded_by', 'uploaded_at', 'category', 'updated_at', 'is_deleted', 'deleted_at', 'version_id']
  },
  {
    name: 'case_invoices',
    key: 'id',
    cols: ['id', 'case_id', 'invoice_number', 'amount', 'status', 'due_date', 'notes', 'created_at', 'updated_at', 'is_deleted', 'deleted_at', 'version_id']
  },
  {
    name: 'case_disbursements',
    key: 'id',
    cols: ['id', 'case_id', 'amount', 'description', 'payment_method', 'recorded_by', 'status', 'invoice_id', 'created_at', 'updated_at', 'is_deleted', 'deleted_at', 'version_id']
  },
  {
    name: 'firm_lawyers',
    key: 'id',
    cols: ['id', 'name', 'created_at', 'updated_at', 'is_deleted', 'deleted_at', 'version_id']
  },
  {
    name: 'case_submissions',
    key: 'id',
    cols: ['id', 'case_id', 'title', 'submission_type', 'due_date', 'status', 'assigned_lawyer', 'notes', 'created_at', 'updated_at', 'is_deleted', 'deleted_at', 'version_id']
  },
  {
    name: 'extracted_facts',
    key: 'id',
    cols: ['id', 'case_id', 'fact_date', 'description', 'pincite', 'issues', 'contacts', 'status', 'created_at', 'updated_at', 'is_deleted', 'deleted_at', 'version_id']
  },
  {
    name: 'witness_roster',
    key: 'id',
    cols: ['id', 'case_id', 'name', 'role', 'side', 'status', 'notes', 'concessions', 'created_at', 'updated_at', 'is_deleted', 'deleted_at', 'version_id']
  },
  {
    name: 'deposition_outlines',
    key: 'id',
    cols: ['id', 'witness_id', 'theme', 'is_done', 'sort_order', 'updated_at', 'is_deleted', 'deleted_at', 'version_id']
  },
  {
    name: 'impeachment_matrix',
    key: 'id',
    cols: ['id', 'witness_id', 'claim', 'evidence', 'pincite', 'status', 'updated_at', 'is_deleted', 'deleted_at', 'version_id']
  },
  {
    name: 'case_issues',
    key: 'id',
    cols: ['id', 'case_id', 'name', 'description', 'color', 'created_at', 'updated_at', 'is_deleted', 'deleted_at', 'version_id']
  },
  {
    name: 'ebundle_sections',
    key: 'id',
    cols: ['id', 'case_id', 'label', 'color', 'sort_order', 'updated_at', 'is_deleted', 'deleted_at', 'version_id']
  },
  {
    name: 'ebundle_documents',
    key: 'id',
    cols: ['id', 'section_id', 'bate_stamp', 'name', 'detail', 'pages', 'doc_type', 'sort_order', 'updated_at', 'is_deleted', 'deleted_at', 'version_id']
  },
  {
    name: 'trust_ledger',
    key: 'id',
    cols: ['id', 'case_id', 'type', 'amount', 'reference', 'created_at', 'updated_at', 'is_deleted', 'deleted_at', 'version_id']
  },
  {
    name: 'soca_memory',
    key: 'id',
    cols: ['id', 'memory_key', 'memory_value', 'category', 'created_by', 'created_at', 'updated_at', 'is_deleted', 'deleted_at', 'version_id']
  },
  {
    name: 'judiciary_api_config',
    key: 'id',
    cols: ['id', 'p_number', 'api_key', 'mode', 'base_url', 'auto_sync_enabled', 'last_sync_at', 'updated_at', 'is_deleted', 'deleted_at', 'version_id']
  }
];

// ── SYNC TELEMETRY & MUTEX LOCKS ─────────────────────────────────────────────
let isSyncInProgress = false;
let globalRemoteUrl = process.env.REMOTE_BACKEND_URL || 'https://legal-os-lea2.onrender.com';
let globalVerifyToken = process.env.VERIFY_TOKEN || 'soca_sync_token_2026';

const telemetry = {
  isConnected: false,
  lastSyncedAt: null,
  pendingOutboxCount: 0,
  isSyncing: false,
  lastError: null,
  remoteUrl: globalRemoteUrl
};

// ── OUTBOX WRITE-AHEAD LOG HELPER ─────────────────────────────────────────────
function recordMutation(tableName, rowId, action, payload = {}) {
  const mutationId = 'mut_' + crypto.randomBytes(8).toString('hex');
  const payloadStr = JSON.stringify(payload);
  const sql = `INSERT INTO sync_outbox (id, table_name, row_id, action, payload_json, created_at, status) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'pending')`;
  
  db.run(sql, [mutationId, tableName, rowId, action, payloadStr], (err) => {
    if (err) {
      console.warn(`[Sync Outbox] Failed to record mutation for ${tableName}/${rowId}:`, err.message);
    } else {
      updatePendingOutboxCount();
    }
  });
}

function updatePendingOutboxCount() {
  db.get(`SELECT COUNT(*) as count FROM sync_outbox WHERE status = 'pending'`, [], (err, row) => {
    if (!err && row) {
      telemetry.pendingOutboxCount = Number(row.count) || 0;
    }
  });
}

// ── FIELD-LEVEL LWW & UPSERT HELPER ──────────────────────────────────────────
function buildFieldLevelUpsert(tableName, key, cols) {
  const placeholders = cols.map(() => `?`).join(', ');
  const updateSets = cols
    .filter(c => c !== key)
    .map(c => `${c} = COALESCE(EXCLUDED.${c}, ${tableName}.${c})`)
    .join(', ');

  return `
    INSERT INTO ${tableName} (${cols.join(', ')})
    VALUES (${placeholders})
    ON CONFLICT (${key})
    DO UPDATE SET ${updateSets},
      version_id = COALESCE(${tableName}.version_id, 1) + 1,
      updated_at = CURRENT_TIMESTAMP
  `;
}

// ── SERVER-SIDE: DELTA PUSH HANDLER ──────────────────────────────────────────
async function handleDeltaPush(req, res) {
  const { mutations = [] } = req.body || {};
  const processedIds = [];

  try {
    for (const mut of mutations) {
      const { id, table_name, row_id, action, payload = {} } = mut;
      const tableDef = SYNC_TABLES.find(t => t.name === table_name);
      if (!tableDef) continue;

      if (action === 'DELETE') {
        // Soft-delete tombstone
        await new Promise((resolve) => {
          db.run(
            `UPDATE ${table_name} SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE ${tableDef.key} = ?`,
            [row_id],
            (err) => {
              if (err) console.error(`[Sync Server Push] Delete failed for ${table_name}/${row_id}:`, err.message);
              resolve();
            }
          );
        });
      } else {
        // Check if row already exists on server
        const existingRow = await new Promise((resolve) => {
          db.get(`SELECT ${tableDef.key} FROM ${table_name} WHERE ${tableDef.key} = ?`, [row_id], (err, row) => resolve(row || null));
        });

        if (existingRow) {
          // Field-Level LWW Update: only update the fields present in the payload!
          const payloadKeys = Object.keys(payload).filter(k => tableDef.cols.includes(k) && k !== tableDef.key);
          if (payloadKeys.length > 0) {
            const setClauses = payloadKeys.map(k => `${k} = ?`).join(', ');
            const setValues = payloadKeys.map(k => payload[k]);
            const updateSql = `UPDATE ${table_name} SET ${setClauses}, version_id = COALESCE(version_id, 1) + 1, updated_at = CURRENT_TIMESTAMP, is_deleted = 0, deleted_at = NULL WHERE ${tableDef.key} = ?`;
            await new Promise((resolve) => {
              db.run(updateSql, [...setValues, row_id], (err) => {
                if (err) console.error(`[Sync Server Push] Update failed for ${table_name}/${row_id}:`, err.message);
                resolve();
              });
            });
          }
        } else {
          // Full Insert for new row
          const fullRow = { ...payload, [tableDef.key]: row_id, is_deleted: 0, deleted_at: null };
          const validCols = Object.keys(fullRow).filter(k => tableDef.cols.includes(k));
          const placeholders = validCols.map(() => '?').join(', ');
          const values = validCols.map(c => fullRow[c]);
          const insertSql = `INSERT INTO ${table_name} (${validCols.join(', ')}) VALUES (${placeholders})`;
          await new Promise((resolve) => {
            db.run(insertSql, values, (err) => {
              if (err) console.error(`[Sync Server Push] Insert failed for ${table_name}/${row_id}:`, err.message);
              resolve();
            });
          });
        }
      }

      processedIds.push(id);
    }

    res.json({
      success: true,
      processed_ids: processedIds,
      server_timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('[Sync Server] Delta Push failed:', err);
    res.status(500).json({ error: 'Delta push failed: ' + err.message });
  }
}

// ── SERVER-SIDE: DELTA PULL HANDLER ──────────────────────────────────────────
async function handleDeltaPull(req, res) {
  const since = req.query.since || '1970-01-01T00:00:00.000Z';
  const deltas = {};

  try {
    for (const table of SYNC_TABLES) {
      const timeCols = ['updated_at', 'deleted_at', 'created_at', 'last_updated', 'uploaded_at', 'payment_date'];
      const activeTimeCols = timeCols.filter(col => table.cols && table.cols.includes(col));

      let query;
      let params;

      if (activeTimeCols.length > 0 && since !== '1970-01-01T00:00:00.000Z' && since !== '1970-01-01') {
        const whereConditions = activeTimeCols.map(col => `${col} > ?`).join(' OR ');
        query = `SELECT * FROM ${table.name} WHERE ${whereConditions}`;
        params = activeTimeCols.map(() => since);
      } else {
        query = `SELECT * FROM ${table.name}`;
        params = [];
      }

      const rows = await new Promise((resolve) => {
        db.all(query, params, (err, resultRows) => {
          if (err) {
            // Safe fallback: select all rows from table
            db.all(`SELECT * FROM ${table.name}`, [], (err2, fallbackRows) => {
              if (err2) {
                console.warn(`[Sync Pull Notice] Table ${table.name} fallback read:`, err2.message);
                resolve([]);
              } else {
                resolve(fallbackRows || []);
              }
            });
          } else {
            resolve(resultRows || []);
          }
        });
      });
      deltas[table.name] = rows;
    }

    res.json({
      success: true,
      deltas,
      server_timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('[Sync Server] Delta Pull failed:', err);
    res.status(500).json({ error: 'Delta pull failed: ' + err.message });
  }
}

// ── CLIENT-SIDE: DELTA SYNC CYCLE RUNNER (WITH MUTEX DEDUPLICATION) ───────────
async function runDeltaSyncCycle(remoteUrl = globalRemoteUrl, verifyToken = globalVerifyToken) {
  if (isSyncInProgress) {
    console.log('[Sync Client] Sync cycle already in-flight. Skipping duplicate invocation.');
    return { success: false, message: 'Sync already in progress' };
  }

  isSyncInProgress = true;
  telemetry.isSyncing = true;

  try {
    // 1. Fetch pending outbox mutations
    const pendingMutations = await new Promise((resolve, reject) => {
      db.all(`SELECT * FROM sync_outbox WHERE status = 'pending' ORDER BY created_at ASC LIMIT 100`, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    // 2. PUSH deltas to server if there are pending mutations
    if (pendingMutations.length > 0) {
      const formattedMutations = [];
      for (const m of pendingMutations) {
        let payload = JSON.parse(m.payload_json || '{}');
        // If trigger queued empty payload, query full row from SQLite
        if (Object.keys(payload).length === 0 && m.action !== 'DELETE') {
          const rowData = await new Promise((resolve) => {
            db.get(`SELECT * FROM ${m.table_name} WHERE id = ?`, [m.row_id], (err, row) => resolve(row || null));
          });
          if (rowData) payload = rowData;
        }
        formattedMutations.push({
          id: m.id,
          table_name: m.table_name,
          row_id: m.row_id,
          action: m.action,
          payload
        });
      }

      const pushRes = await fetch(`${remoteUrl}/api/sync/push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${verifyToken}`
        },
        body: JSON.stringify({ mutations: formattedMutations })
      });

      if (pushRes.ok) {
        const pushResult = await pushRes.json();
        if (pushResult.processed_ids && pushResult.processed_ids.length > 0) {
          const placeholders = pushResult.processed_ids.map(() => '?').join(',');
          await new Promise((resolve) => {
            db.run(`DELETE FROM sync_outbox WHERE id IN (${placeholders})`, pushResult.processed_ids, resolve);
          });
        }
      }
    }

    // 3. Determine last pulled timestamp
    const cursorRow = await new Promise((resolve) => {
      db.get(`SELECT last_pulled_at FROM sync_cursors WHERE table_name = '_global'`, [], (err, row) => {
        resolve(row || null);
      });
    });
    const sinceTimestamp = cursorRow && cursorRow.last_pulled_at ? cursorRow.last_pulled_at : '1970-01-01T00:00:00.000Z';

    // 4. PULL remote deltas from server
    const pullRes = await fetch(`${remoteUrl}/api/sync/pull?since=${encodeURIComponent(sinceTimestamp)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${verifyToken}`
      }
    });

    if (!pullRes.ok) {
      throw new Error(`Cloud server returned HTTP ${pullRes.status}`);
    }

    const pullResult = await pullRes.json();
    if (!pullResult.success || !pullResult.deltas) {
      throw new Error('Cloud server returned invalid delta structure');
    }

    // 5. Apply incoming deltas to local SQLite
    const incomingRowIds = [];
    for (const table of SYNC_TABLES) {
      const incomingRows = pullResult.deltas[table.name] || [];
      const upsertSql = buildFieldLevelUpsert(table.name, table.key, table.cols);

      for (const row of incomingRows) {
        if (row.id) incomingRowIds.push(row.id);
        if (row.is_deleted === 1 || row.is_deleted === true) {
          await new Promise((resolve) => {
            db.run(`UPDATE ${table.name} SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP WHERE ${table.key} = ?`, [row[table.key]], resolve);
          });
        } else {
          const values = table.cols.map(c => row[c] === undefined ? null : row[c]);
          await new Promise((resolve) => {
            db.run(upsertSql, values, resolve);
          });
        }
      }
    }

    // Clean up any duplicate outbox records triggered by incoming remote writes
    if (incomingRowIds.length > 0) {
      const placeholders = incomingRowIds.map(() => '?').join(',');
      await new Promise(resolve => db.run(`DELETE FROM sync_outbox WHERE row_id IN (${placeholders})`, incomingRowIds, resolve));
    }

    // 6. Update global cursor & telemetry
    const newServerTime = pullResult.server_timestamp || new Date().toISOString();
    await new Promise((resolve) => {
      db.run(
        `INSERT INTO sync_cursors (table_name, last_pulled_at) VALUES ('_global', ?) ON CONFLICT(table_name) DO UPDATE SET last_pulled_at = EXCLUDED.last_pulled_at`,
        [newServerTime],
        resolve
      );
    });

    // 7. Background Blob Synchronization (Content-Addressable Vault)
    try {
      const blobSyncService = require('./services/blobSyncService');
      await blobSyncService.syncPendingBlobs(remoteUrl, verifyToken);
    } catch (blobErr) {
      console.warn('[Sync Client] Blob sync notice:', blobErr.message);
    }

    telemetry.isConnected = true;
    telemetry.lastSyncedAt = new Date().toISOString();
    telemetry.lastError = null;
    updatePendingOutboxCount();

    return { success: true, timestamp: telemetry.lastSyncedAt };
  } catch (err) {
    console.warn('[Sync Client] Delta cycle notice:', err.message);
    telemetry.isConnected = false;
    telemetry.lastError = err.message;
    updatePendingOutboxCount();
    return { success: false, error: err.message };
  } finally {
    isSyncInProgress = false;
    telemetry.isSyncing = false;
  }
}

// ── GET TELEMETRY STATUS ─────────────────────────────────────────────────────
function getSyncTelemetry() {
  updatePendingOutboxCount();
  return {
    ...telemetry,
    isSyncing: isSyncInProgress
  };
}

// ── BACKGROUND SYNC LOOP INITIATOR ───────────────────────────────────────────
function startSyncLoop(remoteUrl, verifyToken, intervalMs = 45000) {
  if (remoteUrl) globalRemoteUrl = remoteUrl;
  if (verifyToken) globalVerifyToken = verifyToken;
  telemetry.remoteUrl = globalRemoteUrl;

  console.log('[Sync Engine] Initialized with remote backend:', globalRemoteUrl);

  // Initial attempt after 4 seconds startup
  setTimeout(() => {
    runDeltaSyncCycle(globalRemoteUrl, globalVerifyToken);
  }, 4000);

  // Recurring loop
  setInterval(() => {
    runDeltaSyncCycle(globalRemoteUrl, globalVerifyToken);
  }, intervalMs);
}

// ── LEGACY FALLBACK FOR BACKWARD COMPATIBILITY ───────────────────────────────
async function handleSyncExchange(req, res) {
  return handleDeltaPush(req, res);
}

module.exports = {
  SYNC_TABLES,
  recordMutation,
  handleDeltaPush,
  handleDeltaPull,
  runDeltaSyncCycle,
  getSyncTelemetry,
  startSyncLoop,
  handleSyncExchange
};
