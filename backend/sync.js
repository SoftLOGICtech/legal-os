const db = require('./database');
const fetch = require('node-fetch');

const SYNC_TABLES = [
  {
    name: 'users',
    key: 'id',
    cols: ['id', 'username', 'display_name', 'password_hash', 'salt', 'role', 'created_at']
  },
  {
    name: 'leads',
    key: 'id',
    cols: [
      'id', 'full_name', 'email', 'phone', 'service_category', 'property_location', 
      'property_value', 'message', 'source', 'status', 'consultation_date', 
      'consultation_paid', 'assigned_lawyer', 'created_at', 'opposing_party', 
      'is_emergency', 'conflict_checked', 'id_number', 'kra_pin', 'address', 'custom_kyc'
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
      'opposing_counsel_address', 'assigned_judge', 'court_division', 'case_brief'
    ]
  },
  {
    name: 'court_calendar',
    key: 'id',
    cols: ['id', 'case_id', 'event_title', 'event_type', 'event_date', 'notes', 'is_important', 'assigned_lawyer', 'reminder_sent', 'created_at']
  },
  {
    name: 'case_activities',
    key: 'id',
    cols: ['id', 'case_id', 'activity_type', 'description', 'recorded_by', 'is_starred', 'created_at']
  },
  {
    name: 'firm_expenses',
    key: 'id',
    cols: ['id', 'amount', 'category', 'description', 'recorded_by', 'created_at', 'case_id']
  },
  {
    name: 'case_payments',
    key: 'id',
    cols: ['id', 'case_id', 'amount', 'payment_ref', 'payment_method', 'notes', 'recorded_by', 'payment_date', 'destination', 'invoice_id']
  },
  {
    name: 'case_files',
    key: 'id',
    cols: ['id', 'case_id', 'file_name', 'file_path', 'file_size', 'uploaded_by', 'uploaded_at', 'category']
  },
  {
    name: 'case_invoices',
    key: 'id',
    cols: ['id', 'case_id', 'invoice_number', 'amount', 'status', 'due_date', 'notes', 'created_at']
  },
  {
    name: 'case_disbursements',
    key: 'id',
    cols: ['id', 'case_id', 'amount', 'description', 'payment_method', 'recorded_by', 'status', 'invoice_id', 'created_at']
  },
  {
    name: 'firm_lawyers',
    key: 'id',
    cols: ['id', 'name', 'created_at']
  },
  {
    name: 'case_submissions',
    key: 'id',
    cols: ['id', 'case_id', 'title', 'submission_type', 'due_date', 'status', 'assigned_lawyer', 'notes', 'created_at']
  },
  {
    name: 'extracted_facts',
    key: 'id',
    cols: ['id', 'case_id', 'fact_date', 'description', 'pincite', 'issues', 'contacts', 'status', 'created_at']
  },
  {
    name: 'witness_roster',
    key: 'id',
    cols: ['id', 'case_id', 'name', 'role', 'side', 'status', 'notes', 'concessions', 'created_at']
  },
  {
    name: 'deposition_outlines',
    key: 'id',
    cols: ['id', 'witness_id', 'theme', 'is_done', 'sort_order']
  },
  {
    name: 'impeachment_matrix',
    key: 'id',
    cols: ['id', 'witness_id', 'claim', 'evidence', 'pincite', 'status']
  },
  {
    name: 'case_issues',
    key: 'id',
    cols: ['id', 'case_id', 'name', 'description', 'color', 'created_at']
  },
  {
    name: 'judiciary_api_config',
    key: 'id',
    cols: ['id', 'p_number', 'api_key', 'mode', 'base_url', 'auto_sync_enabled', 'last_sync_at', 'updated_at']
  }
];

// Helper to construct upsert queries compatible with both SQLite and Postgres
function buildUpsertQuery(tableName, key, cols) {
  const placeholders = cols.map((_, i) => `?`).join(', ');
  const updateSets = cols
    .filter(c => c !== key)
    .map(c => `${c} = EXCLUDED.${c}`)
    .join(', ');

  let timestampCol = cols.find(c => c === 'last_updated' || c === 'updated_at' || c === 'created_at');
  let whereClause = '';
  if (timestampCol) {
    whereClause = `WHERE EXCLUDED.${timestampCol} > ${tableName}.${timestampCol} OR ${tableName}.${timestampCol} IS NULL OR EXCLUDED.${timestampCol} IS NULL`;
  }

  return `
    INSERT INTO ${tableName} (${cols.join(', ')})
    VALUES (${placeholders})
    ON CONFLICT (${key})
    DO UPDATE SET ${updateSets}
    ${whereClause}
  `;
}

// ── SERVER-SIDE SYNC EXCHANGE HANDLER ──────────────────────────────────────────
async function handleSyncExchange(req, res) {
  const localData = req.body;
  const remoteResponseData = {};

  try {
    for (const table of SYNC_TABLES) {
      const rows = localData[table.name] || [];
      const upsertSql = buildUpsertQuery(table.name, table.key, table.cols);

      // Perform upsert of all received rows into PostgreSQL database
      for (const row of rows) {
        const values = table.cols.map(c => row[c] === undefined ? null : row[c]);
        await new Promise((resolve, reject) => {
          db.run(upsertSql, values, function(err) {
            if (err) {
              console.error(`[Sync] Error upserting into server table ${table.name}:`, err.message);
              reject(err);
            } else {
              resolve();
            }
          });
        });
      }

      // Query latest dataset to return to client
      const allRows = await new Promise((resolve, reject) => {
        db.all(`SELECT * FROM ${table.name}`, [], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
      remoteResponseData[table.name] = allRows;
    }

    res.json({ success: true, data: remoteResponseData });
  } catch (err) {
    console.error('[Sync Server] Sync exchange failed:', err);
    res.status(500).json({ error: 'Sync exchange failed: ' + err.message });
  }
}

// ── CLIENT-SIDE SYNC LOOP RUNNER ──────────────────────────────────────────────
async function runClientSync(remoteUrl, verifyToken) {
  console.log('[Sync Client] Initiating synchronization with:', remoteUrl);
  const clientPayload = {};

  try {
    // 1. Gather all local SQLite data
    for (const table of SYNC_TABLES) {
      const localRows = await new Promise((resolve, reject) => {
        db.all(`SELECT * FROM ${table.name}`, [], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
      clientPayload[table.name] = localRows;
    }

    // 2. POST payload to the cloud backend
    const res = await fetch(`${remoteUrl}/api/sync-exchange`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${verifyToken}`
      },
      body: JSON.stringify(clientPayload)
    });

    if (!res.ok) {
      throw new Error(`Cloud server returned HTTP status ${res.status}`);
    }

    const result = await res.json();
    if (!result.success || !result.data) {
      throw new Error('Cloud server returned unsuccessful sync response');
    }

    // 3. Upsert received remote data into the local SQLite database
    const remoteData = result.data;
    for (const table of SYNC_TABLES) {
      const rows = remoteData[table.name] || [];
      const upsertSql = buildUpsertQuery(table.name, table.key, table.cols);

      for (const row of rows) {
        const values = table.cols.map(c => row[c] === undefined ? null : row[c]);
        await new Promise((resolve, reject) => {
          db.run(upsertSql, values, function(err) {
            if (err) reject(err);
            else resolve();
          });
        });
      }
    }

    console.log('[Sync Client] Synchronization completed successfully.');
  } catch (err) {
    console.error('[Sync Client] Synchronization failed:', err.message);
  }
}

function startSyncLoop(remoteUrl, verifyToken, intervalMs = 60000) {
  if (!remoteUrl) {
    console.log('[Sync Client] No REMOTE_BACKEND_URL provided. Client sync disabled.');
    return;
  }

  // Initial sync attempt after 5 seconds startup delay
  setTimeout(() => {
    runClientSync(remoteUrl, verifyToken);
  }, 5000);

  // Set recurring sync timer
  setInterval(() => {
    runClientSync(remoteUrl, verifyToken);
  }, intervalMs);
}

module.exports = {
  handleSyncExchange,
  startSyncLoop
};
