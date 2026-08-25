const path = require('path');
const pg = require('pg');

let db;
const usePostgres = !!process.env.DATABASE_URL;

if (usePostgres) {
    console.log('PostgreSQL DATABASE_URL detected. Initializing PostgreSQL pool...');
    const pool = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false // Required for Railway SSL connection
        }
    });

    let queryChain = Promise.resolve();

    db = {
        serialize: function(callback) {
            callback();
        },
        run: function(sql, params, callback) {
            if (typeof params === 'function') {
                callback = params;
                params = [];
            }
            queryChain = queryChain.then(() => {
                return new Promise((resolve) => {
                    let count = 0;
                    let convertedSql = sql.replace(/\?/g, () => {
                        count++;
                        return `$${count}`;
                    });

                    // Type mapping for database creation
                    if (convertedSql.includes('CREATE TABLE')) {
                        convertedSql = convertedSql
                            .replace(/\bDATETIME\b/gi, 'TIMESTAMP')
                            .replace(/\bBOOLEAN DEFAULT 0\b/gi, 'BOOLEAN DEFAULT FALSE')
                            .replace(/\bBOOLEAN DEFAULT 1\b/gi, 'BOOLEAN DEFAULT TRUE');
                    }

                    pool.query(convertedSql, params, (err, res) => {
                        if (err) {
                            console.error('PostgreSQL db.run query failed:', convertedSql, 'Error:', err.message);
                        }
                        if (callback) {
                            const context = {
                                changes: res ? res.rowCount : 0,
                                lastID: null
                            };
                            callback.call(context, err);
                        }
                        resolve();
                    });
                });
            });
        },
        get: function(sql, params, callback) {
            if (typeof params === 'function') {
                callback = params;
                params = [];
            }
            queryChain = queryChain.then(() => {
                return new Promise((resolve) => {
                    let count = 0;
                    let convertedSql = sql.replace(/\?/g, () => {
                        count++;
                        return `$${count}`;
                    });

                    pool.query(convertedSql, params, (err, res) => {
                        if (err) {
                            console.error('PostgreSQL db.get query failed:', convertedSql, 'Error:', err.message);
                        }
                        if (callback) {
                            callback(err, res && res.rows ? res.rows[0] : null);
                        }
                        resolve();
                    });
                });
            });
        },
        all: function(sql, params, callback) {
            if (typeof params === 'function') {
                callback = params;
                params = [];
            }
            queryChain = queryChain.then(() => {
                return new Promise((resolve) => {
                    let count = 0;
                    let convertedSql = sql.replace(/\?/g, () => {
                        count++;
                        return `$${count}`;
                    });

                    // Intercept SQLite-specific PRAGMA query for column checks
                    if (convertedSql.includes('PRAGMA table_info')) {
                        const match = convertedSql.match(/PRAGMA table_info\(([^)]+)\)/i);
                        if (match) {
                            const tableName = match[1].trim().replace(/['"`]/g, '');
                            convertedSql = `SELECT column_name AS name FROM information_schema.columns WHERE table_name = $1 AND table_schema = 'public'`;
                            params = [tableName];
                        }
                    }

                    pool.query(convertedSql, params, (err, res) => {
                        if (err) {
                            console.error('PostgreSQL db.all query failed:', convertedSql, 'Error:', err.message);
                        }
                        if (callback) {
                            callback(err, res && res.rows ? res.rows : []);
                        }
                        resolve();
                    });
                });
            });
        }
    };

    // Initialize database schemas sequentially
    console.log('Connected to the PostgreSQL database.');
    initializeDb();
} else {
    // Lazy-load sqlite3 only when no DATABASE_URL is set (local dev only).
    // This prevents the GLIBC version crash on Railway's Linux containers.
    // sqlite3 is an optionalDependency - wrap in try/catch for clean errors.
    let sqlite3;
    try {
        sqlite3 = require('sqlite3').verbose();
    } catch (e) {
        console.error('FATAL: sqlite3 failed to load and no DATABASE_URL is set.');
        console.error('On Railway, add a PostgreSQL database and set DATABASE_URL.');
        console.error('Locally, run: npm install sqlite3');
        process.exit(1);
    }
    console.log('No DATABASE_URL found. Initializing SQLite...');
    const dbPath = process.env.ELECTRON_USER_DATA 
        ? path.join(process.env.ELECTRON_USER_DATA, 'database.sqlite')
        : path.resolve(__dirname, 'database.sqlite');
    console.log('SQLite database path:', dbPath);
    db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error('Error connecting to SQLite database:', err.message);
        } else {
            console.log('Connected to the SQLite database.');
            initializeDb();
        }
    });
}

// ──────────────────────────────────────────────────────────────────────
// SAFE ALTER TABLE HELPER
// SQLite: checks PRAGMA table_info before adding column (no IF NOT EXISTS)
// PostgreSQL: uses native ALTER TABLE ... ADD COLUMN IF NOT EXISTS with
//             proper type translation (BOOLEAN DEFAULT 0 → BOOLEAN DEFAULT FALSE)
// ──────────────────────────────────────────────────────────────────────
function safeAddColumn(table, column, definition) {
    return new Promise((resolve) => {
        // Translate SQLite-specific type syntax to PostgreSQL-compatible syntax
        const pgDefinition = definition
            .replace(/\bDATETIME\b/gi, 'TIMESTAMP')
            .replace(/\bBOOLEAN DEFAULT 0\b/gi, 'BOOLEAN DEFAULT FALSE')
            .replace(/\bBOOLEAN DEFAULT 1\b/gi, 'BOOLEAN DEFAULT TRUE')
            .replace(/\bINTEGER\b/gi, 'INTEGER');

        if (usePostgres) {
            // PostgreSQL supports ADD COLUMN IF NOT EXISTS natively
            db.run(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} ${pgDefinition}`, [], (err2) => {
                if (err2) console.error(`PG ALTER TABLE ${table} ADD ${column} failed:`, err2.message);
                resolve();
            });
        } else {
            // SQLite: check column existence first via PRAGMA
            db.all(`PRAGMA table_info(${table})`, [], (err, rows) => {
                if (err || !rows) return resolve();
                const exists = rows.some(r => r.name === column);
                if (!exists) {
                    // SQLite cannot use non-constant defaults like CURRENT_TIMESTAMP in ALTER TABLE ADD COLUMN
                    const sqliteDef = definition.replace(/\bDEFAULT\s+CURRENT_TIMESTAMP\b/gi, '');
                    db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${sqliteDef}`, [], (err2) => {
                        if (err2) console.error(`SQLite ALTER TABLE ${table} ADD ${column} failed:`, err2.message);
                        resolve();
                    });
                } else {
                    resolve();
                }
            });
        }
    });
}


function initializeDb() {
    db.serialize(async () => {

        // ─────────────────────────────────────────────────────────────
        // TABLE 1: leads (original — kept exactly as is)
        // ─────────────────────────────────────────────────────────────
        db.run(`
            CREATE TABLE IF NOT EXISTS leads (
                id TEXT PRIMARY KEY,
                full_name TEXT NOT NULL,
                email TEXT,
                phone TEXT NOT NULL,
                service_category TEXT NOT NULL,
                property_location TEXT,
                property_value REAL,
                message TEXT,
                source TEXT DEFAULT 'whatsapp',
                status TEXT DEFAULT 'pending_review',
                consultation_date DATETIME,
                consultation_paid BOOLEAN DEFAULT 0,
                assigned_lawyer TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // ─────────────────────────────────────────────────────────────
        // TABLE 2: case_tracking (original — kept exactly as is)
        // ─────────────────────────────────────────────────────────────
        db.run(`
            CREATE TABLE IF NOT EXISTS case_tracking (
                id TEXT PRIMARY KEY,
                tracking_token TEXT UNIQUE NOT NULL,
                client_name TEXT NOT NULL,
                case_title TEXT NOT NULL,
                case_type TEXT NOT NULL,
                current_milestone TEXT NOT NULL,
                milestones_json TEXT,
                completion_percentage INTEGER DEFAULT 0,
                assigned_lawyer TEXT,
                fee_status TEXT DEFAULT 'pending',
                last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // ─────────────────────────────────────────────────────────────
        // TABLE 3: whatsapp_sessions (original — kept exactly as is)
        // ─────────────────────────────────────────────────────────────
        db.run(`
            CREATE TABLE IF NOT EXISTS whatsapp_sessions (
                phone_number TEXT PRIMARY KEY,
                current_state TEXT NOT NULL,
                service_category TEXT,
                property_location TEXT,
                property_value REAL,
                client_name TEXT,
                last_interaction DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // ─────────────────────────────────────────────────────────────
        // NEW TABLE 4: court_calendar — Critical Dates Register
        // case_id is now nullable to support general office events.
        // ─────────────────────────────────────────────────────────────
        db.run(`
            CREATE TABLE IF NOT EXISTS court_calendar (
                id TEXT PRIMARY KEY,
                case_id TEXT,
                event_title TEXT NOT NULL,
                event_type TEXT NOT NULL DEFAULT 'mention',
                event_date DATETIME NOT NULL,
                notes TEXT,
                is_important BOOLEAN DEFAULT 0,
                assigned_lawyer TEXT,
                reminder_sent BOOLEAN DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // ─────────────────────────────────────────────────────────────
        // NEW TABLE 5: case_activities — Activity Log Timeline
        // is_starred: lets the secretary flag critical notes.
        // ─────────────────────────────────────────────────────────────
        db.run(`
            CREATE TABLE IF NOT EXISTS case_activities (
                id TEXT PRIMARY KEY,
                case_id TEXT NOT NULL,
                activity_type TEXT NOT NULL DEFAULT 'internal_note',
                description TEXT NOT NULL,
                recorded_by TEXT DEFAULT 'Secretary',
                is_starred BOOLEAN DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // ─────────────────────────────────────────────────────────────
        // NEW TABLE 6: firm_expenses — Operational Expense Tracker
        // ─────────────────────────────────────────────────────────────
        db.run(`
            CREATE TABLE IF NOT EXISTS firm_expenses (
                id TEXT PRIMARY KEY,
                amount REAL NOT NULL,
                category TEXT NOT NULL DEFAULT 'other',
                description TEXT,
                recorded_by TEXT DEFAULT 'Secretary',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // ─────────────────────────────────────────────────────────────
        // NEW TABLE 6B: case_payments — Installment Tracker
        // ─────────────────────────────────────────────────────────────
        db.run(`
            CREATE TABLE IF NOT EXISTS case_payments (
                id TEXT PRIMARY KEY,
                case_id TEXT NOT NULL,
                amount REAL NOT NULL,
                payment_ref TEXT,
                payment_method TEXT,
                notes TEXT,
                recorded_by TEXT DEFAULT 'Secretary',
                payment_date DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // ─────────────────────────────────────────────────────────────
        // NEW TABLE 7: users — Role-Based Access Control
        // Admin creates all other accounts. Passwords are salted SHA-256.
        // ─────────────────────────────────────────────────────────────
        db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                display_name TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                salt TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'advocate',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // ─────────────────────────────────────────────────────────────
        // NEW TABLE 8: case_files — Document/File Locker
        // Stores metadata for files uploaded per case.
        // ─────────────────────────────────────────────────────────────
        db.run(`
            CREATE TABLE IF NOT EXISTS case_files (
                id TEXT PRIMARY KEY,
                case_id TEXT NOT NULL,
                file_name TEXT NOT NULL,
                file_path TEXT NOT NULL,
                file_size INTEGER,
                uploaded_by TEXT DEFAULT 'Secretary',
                uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // TABLE 9: case_invoices — Client Invoices
        db.run(`
            CREATE TABLE IF NOT EXISTS case_invoices (
                id TEXT PRIMARY KEY,
                case_id TEXT NOT NULL,
                invoice_number TEXT UNIQUE NOT NULL,
                amount REAL NOT NULL,
                status TEXT DEFAULT 'draft',
                due_date DATETIME,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // TABLE 10: case_disbursements — Client Disbursements
        db.run(`
            CREATE TABLE IF NOT EXISTS case_disbursements (
                id TEXT PRIMARY KEY,
                case_id TEXT NOT NULL,
                amount REAL NOT NULL,
                description TEXT,
                payment_method TEXT DEFAULT 'M-PESA',
                recorded_by TEXT DEFAULT 'Secretary',
                status TEXT DEFAULT 'pending',
                invoice_id TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // TABLE 11: firm_lawyers — Dynamic Advocate Roster
        db.run(`
            CREATE TABLE IF NOT EXISTS firm_lawyers (
                id TEXT PRIMARY KEY,
                name TEXT UNIQUE NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // TABLE 12: case_submissions — Submissions & Authorities Tracker
        db.run(`
            CREATE TABLE IF NOT EXISTS case_submissions (
                id TEXT PRIMARY KEY,
                case_id TEXT NOT NULL,
                title TEXT NOT NULL,
                submission_type TEXT NOT NULL DEFAULT 'written_submissions',
                due_date DATETIME,
                status TEXT DEFAULT 'drafting',
                assigned_lawyer TEXT,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // TABLE 13: extracted_facts — Chronology and DocReviewer
        db.run(`
            CREATE TABLE IF NOT EXISTS extracted_facts (
                id TEXT PRIMARY KEY,
                case_id TEXT NOT NULL,
                fact_date TEXT,
                description TEXT NOT NULL,
                pincite TEXT,
                issues TEXT,
                contacts TEXT,
                status TEXT DEFAULT 'Procured',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // TABLE 14: witness_roster — DepoStudio
        db.run(`
            CREATE TABLE IF NOT EXISTS witness_roster (
                id TEXT PRIMARY KEY,
                case_id TEXT NOT NULL,
                name TEXT NOT NULL,
                role TEXT,
                side TEXT DEFAULT 'Plaintiff',
                status TEXT DEFAULT 'Not Yet Called',
                notes TEXT,
                concessions TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // TABLE 15: deposition_outlines — DepoStudio
        db.run(`
            CREATE TABLE IF NOT EXISTS deposition_outlines (
                id TEXT PRIMARY KEY,
                witness_id TEXT NOT NULL,
                theme TEXT NOT NULL,
                is_done BOOLEAN DEFAULT 0,
                sort_order INTEGER DEFAULT 0
            )
        `);

        // TABLE 16: impeachment_matrix — DepoStudio
        db.run(`
            CREATE TABLE IF NOT EXISTS impeachment_matrix (
                id TEXT PRIMARY KEY,
                witness_id TEXT NOT NULL,
                claim TEXT,
                evidence TEXT,
                pincite TEXT,
                status TEXT DEFAULT 'Needs Exhibit'
            )
        `);

        // TABLE 17: ebundle_sections — EBundleDesk
        db.run(`
            CREATE TABLE IF NOT EXISTS case_issues (
                id TEXT PRIMARY KEY,
                case_id TEXT NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                color TEXT DEFAULT '#4db6ac',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // TABLE 18: soca_chat_sessions — Account Linked Previous Chat History
        db.run(`
            CREATE TABLE IF NOT EXISTS soca_chat_sessions (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                session_title TEXT NOT NULL,
                matter_id TEXT,
                messages_json TEXT NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // TABLE 19: soca_memory — Cross-Chat Persistent Memory
        db.run(`
            CREATE TABLE IF NOT EXISTS soca_memory (
                id TEXT PRIMARY KEY,
                memory_key TEXT NOT NULL,
                memory_value TEXT NOT NULL,
                category TEXT DEFAULT 'general',
                created_by TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        db.run(`
            CREATE TABLE IF NOT EXISTS fact_sources (
                id TEXT PRIMARY KEY,
                fact_id TEXT NOT NULL,
                file_id TEXT NOT NULL,
                pincite TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (fact_id) REFERENCES extracted_facts(id) ON DELETE CASCADE,
                FOREIGN KEY (file_id) REFERENCES case_files(id) ON DELETE CASCADE
            )
        `);

        db.run(`
            CREATE TABLE IF NOT EXISTS fact_witnesses (
                fact_id TEXT NOT NULL,
                witness_id TEXT NOT NULL,
                PRIMARY KEY (fact_id, witness_id),
                FOREIGN KEY (fact_id) REFERENCES extracted_facts(id) ON DELETE CASCADE,
                FOREIGN KEY (witness_id) REFERENCES witness_roster(id) ON DELETE CASCADE
            )
        `);

        db.run(`
            CREATE TABLE IF NOT EXISTS fact_issues (
                fact_id TEXT NOT NULL,
                issue_id TEXT NOT NULL,
                PRIMARY KEY (fact_id, issue_id),
                FOREIGN KEY (fact_id) REFERENCES extracted_facts(id) ON DELETE CASCADE,
                FOREIGN KEY (issue_id) REFERENCES case_issues(id) ON DELETE CASCADE
            )
        `);

        db.run(`
            CREATE TABLE IF NOT EXISTS ebundle_sections (
                id TEXT PRIMARY KEY,
                case_id TEXT NOT NULL,
                label TEXT NOT NULL,
                color TEXT DEFAULT '#5c8df6',
                sort_order INTEGER DEFAULT 0
            )
        `);

        // TABLE 18: ebundle_documents — EBundleDesk
        db.run(`
            CREATE TABLE IF NOT EXISTS ebundle_documents (
                id TEXT PRIMARY KEY,
                section_id TEXT NOT NULL,
                bate_stamp TEXT NOT NULL,
                name TEXT NOT NULL,
                detail TEXT,
                pages INTEGER DEFAULT 1,
                doc_type TEXT DEFAULT 'PDF',
                sort_order INTEGER DEFAULT 0
            )
        `);

        // TABLE 19: trust_ledger — FinanceModule
        db.run(`
            CREATE TABLE IF NOT EXISTS trust_ledger (
                id TEXT PRIMARY KEY,
                case_id TEXT NOT NULL,
                type TEXT NOT NULL,
                amount REAL NOT NULL,
                reference TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // TABLE 23: whatsapp_messages — Persistent WhatsApp Messages & Communications
        db.run(`
            CREATE TABLE IF NOT EXISTS whatsapp_messages (
                id TEXT PRIMARY KEY,
                phone TEXT NOT NULL,
                direction TEXT NOT NULL,
                message_text TEXT NOT NULL,
                media_url TEXT,
                case_id TEXT,
                handler TEXT DEFAULT 'deterministic',
                status TEXT DEFAULT 'sent',
                sent_by TEXT DEFAULT 'SocaBot',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // TABLE 24: soca_chat_sessions — Persistent Multi-Device AI Research Sessions
        db.run(`
            CREATE TABLE IF NOT EXISTS soca_chat_sessions (
                id TEXT PRIMARY KEY,
                user_id TEXT,
                session_title TEXT,
                case_id TEXT,
                messages_json TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // TABLE 25: soca_memory — Persistent Cross-Chat Learned Facts & Rules
        db.run(`
            CREATE TABLE IF NOT EXISTS soca_memory (
                id TEXT PRIMARY KEY,
                memory_key TEXT NOT NULL,
                memory_value TEXT NOT NULL,
                category TEXT DEFAULT 'general',
                created_by TEXT DEFAULT 'SocaBot',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // ─────────────────────────────────────────────────────────────
        // SAFE COLUMN MIGRATIONS — case_tracking
        // These run only if the column doesn't already exist.
        // ─────────────────────────────────────────────────────────────
        await safeAddColumn('case_tracking', 'opposing_party',           'TEXT');
        await safeAddColumn('case_tracking', 'ref_no',                   'TEXT');
        await safeAddColumn('case_tracking', 'judiciary_case_id',        'TEXT');
        await safeAddColumn('case_tracking', 'judiciary_filing_token',   'TEXT');
        await safeAddColumn('case_tracking', 'trust_payment_status',     "TEXT DEFAULT 'none'");
        await safeAddColumn('case_tracking', 'trust_payment_ref',        'TEXT');
        await safeAddColumn('case_tracking', 'is_sensitive',             'BOOLEAN DEFAULT 0');
        await safeAddColumn('case_tracking', 'id_number',                'TEXT');
        await safeAddColumn('case_tracking', 'kra_pin',                  'TEXT');
        await safeAddColumn('case_tracking', 'address',                  'TEXT');
        await safeAddColumn('case_tracking', 'custom_kyc',               'TEXT');
        await safeAddColumn('case_tracking', 'court_station',            'TEXT');
        await safeAddColumn('case_tracking', 'total_fee',                'REAL');
        await safeAddColumn('case_tracking', 'outstanding_balance',      'REAL');
        await safeAddColumn('case_tracking', 'client_phone',             'TEXT');
        await safeAddColumn('case_tracking', 'client_email',             'TEXT');
        await safeAddColumn('case_tracking', 'opposing_counsel_name',     'TEXT');
        await safeAddColumn('case_tracking', 'opposing_counsel_firm',     'TEXT');
        await safeAddColumn('case_tracking', 'opposing_counsel_phone',    'TEXT');
        await safeAddColumn('case_tracking', 'opposing_counsel_email',    'TEXT');
        await safeAddColumn('case_tracking', 'opposing_counsel_address',  'TEXT');
        await safeAddColumn('case_tracking', 'cause_of_action',           'TEXT');
        await safeAddColumn('case_tracking', 'case_brief',                'TEXT');
        await safeAddColumn('case_tracking', 'suit_value',                'REAL');

        // ─────────────────────────────────────────────────────────────
        // SAFE COLUMN MIGRATIONS — leads
        // ─────────────────────────────────────────────────────────────
        await safeAddColumn('leads', 'opposing_party',   'TEXT');
        await safeAddColumn('leads', 'is_emergency',     'BOOLEAN DEFAULT 0');
        await safeAddColumn('leads', 'conflict_checked', 'BOOLEAN DEFAULT 0');
        await safeAddColumn('leads', 'id_number',        'TEXT');
        await safeAddColumn('leads', 'kra_pin',          'TEXT');
        await safeAddColumn('leads', 'address',          'TEXT');
        await safeAddColumn('leads', 'custom_kyc',       'TEXT');
        
        // ─────────────────────────────────────────────────────────────
        // SAFE COLUMN MIGRATIONS — firm_expenses
        // ─────────────────────────────────────────────────────────────
        await safeAddColumn('firm_expenses', 'case_id',   'TEXT');

        // ─────────────────────────────────────────────────────────────
        // SAFE COLUMN MIGRATIONS — court_calendar (new fields)
        // ─────────────────────────────────────────────────────────────
        await safeAddColumn('court_calendar', 'is_important',    'BOOLEAN DEFAULT 0');
        await safeAddColumn('court_calendar', 'assigned_lawyer', 'TEXT');

        // New client intake detail fields
        await safeAddColumn('case_tracking', 'dob', 'TEXT');
        await safeAddColumn('case_tracking', 'occupation', 'TEXT');
        await safeAddColumn('case_tracking', 'opposing_party_contact', 'TEXT');
        await safeAddColumn('case_tracking', 'billing_type', 'TEXT');
        await safeAddColumn('case_tracking', 'emergency_name', 'TEXT');
        await safeAddColumn('case_tracking', 'emergency_phone', 'TEXT');
        await safeAddColumn('case_tracking', 'emergency_relation', 'TEXT');
        await safeAddColumn('case_tracking', 'alternative_phone', 'TEXT');
        await safeAddColumn('case_tracking', 'alternative_email', 'TEXT');

        await safeAddColumn('leads', 'dob', 'TEXT');
        await safeAddColumn('leads', 'occupation', 'TEXT');
        await safeAddColumn('leads', 'opposing_party_contact', 'TEXT');
        await safeAddColumn('leads', 'billing_type', 'TEXT');
        await safeAddColumn('leads', 'emergency_name', 'TEXT');
        await safeAddColumn('leads', 'emergency_phone', 'TEXT');
        await safeAddColumn('leads', 'emergency_relation', 'TEXT');
        await safeAddColumn('leads', 'alternative_phone', 'TEXT');
        await safeAddColumn('leads', 'alternative_email', 'TEXT');

        // Traditional legal folder metadata columns
        await safeAddColumn('case_tracking', 'opposing_counsel_name', 'TEXT');
        await safeAddColumn('case_tracking', 'opposing_counsel_firm', 'TEXT');
        await safeAddColumn('case_tracking', 'opposing_counsel_phone', 'TEXT');
        await safeAddColumn('case_tracking', 'opposing_counsel_email', 'TEXT');
        await safeAddColumn('case_tracking', 'opposing_counsel_address', 'TEXT');
        await safeAddColumn('case_tracking', 'assigned_judge', 'TEXT');
        await safeAddColumn('case_tracking', 'court_division', 'TEXT');
        await safeAddColumn('case_tracking', 'case_brief', 'TEXT');
        await safeAddColumn('case_tracking', 'strategy_json', 'TEXT');

        await safeAddColumn('leads', 'opposing_counsel_name', 'TEXT');
        await safeAddColumn('leads', 'opposing_counsel_firm', 'TEXT');
        await safeAddColumn('leads', 'opposing_counsel_phone', 'TEXT');
        await safeAddColumn('leads', 'opposing_counsel_email', 'TEXT');
        await safeAddColumn('leads', 'opposing_counsel_address', 'TEXT');
        await safeAddColumn('leads', 'assigned_judge', 'TEXT');
        await safeAddColumn('leads', 'court_division', 'TEXT');

        await safeAddColumn('case_files', 'category', "TEXT DEFAULT 'other'");
        await safeAddColumn('case_files', 'file_hash', 'TEXT');
        await safeAddColumn('case_files', 'is_synced', 'BOOLEAN DEFAULT 0');
        await safeAddColumn('case_files', 'mime_type', 'TEXT');

        // ─────────────────────────────────────────────────────────────
        // SAFE COLUMN MIGRATIONS — soca_chat_sessions & whatsapp_messages
        // ─────────────────────────────────────────────────────────────
        await safeAddColumn('soca_chat_sessions', 'user_id',       'TEXT');
        await safeAddColumn('soca_chat_sessions', 'session_title', 'TEXT');
        await safeAddColumn('soca_chat_sessions', 'case_id',       'TEXT');
        await safeAddColumn('soca_chat_sessions', 'messages_json', 'TEXT');
        await safeAddColumn('soca_chat_sessions', 'created_at',    'DATETIME DEFAULT CURRENT_TIMESTAMP');

        await safeAddColumn('whatsapp_messages', 'phone',        'TEXT');
        await safeAddColumn('whatsapp_messages', 'direction',    'TEXT');
        await safeAddColumn('whatsapp_messages', 'message_text', 'TEXT');
        await safeAddColumn('whatsapp_messages', 'media_url',    'TEXT');
        await safeAddColumn('whatsapp_messages', 'case_id',      'TEXT');
        await safeAddColumn('whatsapp_messages', 'handler',      "TEXT DEFAULT 'deterministic'");
        await safeAddColumn('whatsapp_messages', 'status',       "TEXT DEFAULT 'sent'");
        await safeAddColumn('whatsapp_messages', 'sent_by',      "TEXT DEFAULT 'SocaBot'");
        await safeAddColumn('whatsapp_messages', 'created_at',   'DATETIME DEFAULT CURRENT_TIMESTAMP');

        // TABLE 22: blob_vault — Content-Addressable Storage (CAS) Index
        db.run(`
            CREATE TABLE IF NOT EXISTS blob_vault (
                file_hash TEXT PRIMARY KEY,
                file_size INTEGER,
                mime_type TEXT,
                local_path TEXT,
                is_cloud_synced BOOLEAN DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // TABLE 20: sync_outbox — Local Offline Mutation Queue (Write-Ahead Log)
        db.run(`
            CREATE TABLE IF NOT EXISTS sync_outbox (
                id TEXT PRIMARY KEY,
                table_name TEXT NOT NULL,
                row_id TEXT NOT NULL,
                action TEXT NOT NULL,
                payload_json TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                retry_count INTEGER DEFAULT 0,
                status TEXT DEFAULT 'pending'
            )
        `);

        // TABLE 21: sync_cursors — Local & Server Sync Cursors
        db.run(`
            CREATE TABLE IF NOT EXISTS sync_cursors (
                table_name TEXT PRIMARY KEY,
                last_pulled_at DATETIME,
                last_server_seq INTEGER DEFAULT 0
            )
        `);

        // ─────────────────────────────────────────────────────────────
        // UNIVERSAL SYNC TRACKING COLUMNS (Soft Deletes, Timestamps, Versions)
        // ─────────────────────────────────────────────────────────────
        const allSyncTables = [
            'leads', 'case_tracking', 'whatsapp_sessions', 'whatsapp_messages', 'court_calendar', 
            'case_activities', 'firm_expenses', 'case_payments', 'users', 
            'case_files', 'case_invoices', 'case_disbursements',
            'extracted_facts', 'witness_roster', 'deposition_outlines',
            'impeachment_matrix', 'case_issues', 'judiciary_api_config',
            'ebundle_sections', 'ebundle_documents', 'trust_ledger',
            'firm_lawyers', 'soca_chat_sessions', 'soca_memory',
            'case_submissions'
        ];

        for (const tbl of allSyncTables) {
            await safeAddColumn(tbl, 'updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
            await safeAddColumn(tbl, 'is_deleted', 'BOOLEAN DEFAULT 0');
            await safeAddColumn(tbl, 'deleted_at', 'DATETIME');
            await safeAddColumn(tbl, 'version_id', 'INTEGER DEFAULT 1');
        }

        // Install automatic Write-Ahead Log triggers on local SQLite
        if (!usePostgres) {
            for (const tbl of allSyncTables) {
                db.run(`
                    CREATE TRIGGER IF NOT EXISTS trg_sync_${tbl}_ins AFTER INSERT ON ${tbl}
                    BEGIN
                        INSERT INTO sync_outbox (id, table_name, row_id, action, payload_json, created_at, status)
                        VALUES ('mut_' || hex(randomblob(8)), '${tbl}', NEW.id, 'INSERT', '{}', CURRENT_TIMESTAMP, 'pending');
                    END;
                `);
                db.run(`
                    CREATE TRIGGER IF NOT EXISTS trg_sync_${tbl}_upd AFTER UPDATE ON ${tbl}
                    BEGIN
                        INSERT INTO sync_outbox (id, table_name, row_id, action, payload_json, created_at, status)
                        VALUES ('mut_' || hex(randomblob(8)), '${tbl}', NEW.id, 'UPDATE', '{}', CURRENT_TIMESTAMP, 'pending');
                    END;
                `);
                db.run(`
                    CREATE TRIGGER IF NOT EXISTS trg_sync_${tbl}_del AFTER DELETE ON ${tbl}
                    BEGIN
                        INSERT INTO sync_outbox (id, table_name, row_id, action, payload_json, created_at, status)
                        VALUES ('mut_' || hex(randomblob(8)), '${tbl}', OLD.id, 'DELETE', '{}', CURRENT_TIMESTAMP, 'pending');
                    END;
                `);
            }
        }

        // ─────────────────────────────────────────────────────────────
        // TABLE 15: judiciary_api_config (Strategy B Live API Settings)
        // ─────────────────────────────────────────────────────────────
        db.run(`
            CREATE TABLE IF NOT EXISTS judiciary_api_config (
                id TEXT PRIMARY KEY,
                p_number TEXT,
                api_key TEXT,
                mode TEXT DEFAULT 'sandbox',
                base_url TEXT DEFAULT 'https://efiling.court.go.ke/api/v1',
                auto_sync_enabled INTEGER DEFAULT 1,
                last_sync_at TEXT,
                updated_at TEXT
            )
        `);

        // ─────────────────────────────────────────────────────────────
        // SAFE COLUMN MIGRATIONS — case_activities (new fields)
        // ─────────────────────────────────────────────────────────────
        await safeAddColumn('case_activities', 'is_starred', 'BOOLEAN DEFAULT 0');

        // ─────────────────────────────────────────────────────────────
        // SAFE COLUMN MIGRATIONS — case_tracking (judiciary ingestion fields)
        // ─────────────────────────────────────────────────────────────
        await safeAddColumn('case_tracking', 'court_division', 'TEXT');
        await safeAddColumn('case_tracking', 'assigned_judge', 'TEXT');
        await safeAddColumn('case_tracking', 'courtroom_no', 'TEXT');
        await safeAddColumn('case_tracking', 'opposing_counsel', 'TEXT');

        // ─────────────────────────────────────────────────────────────
        // SAFE COLUMN MIGRATIONS — case_payments
        // ─────────────────────────────────────────────────────────────
        await safeAddColumn('case_payments', 'destination', "TEXT DEFAULT 'operating'");
        await safeAddColumn('case_payments', 'invoice_id', "TEXT");

        // ─────────────────────────────────────────────────────────────
        // SEED DATA — Default Admin User
        // ─────────────────────────────────────────────────────────────
        db.get("SELECT * FROM users WHERE username = 'admin'", (err, row) => {
            if (!row) {
                const crypto = require('crypto');
                const salt = crypto.randomBytes(16).toString('hex');
                const initialPassword = process.env.ADMIN_INITIAL_PASSWORD || 'admin123';
                const hash = crypto.createHash('sha256').update(salt + initialPassword).digest('hex');
                db.run(`INSERT INTO users (id, username, display_name, password_hash, salt, role) VALUES (?, ?, ?, ?, ?, ?)`, ['u_admin', 'admin', 'Sam Ogola (Admin)', hash, salt, 'admin']);
            }
        });

        // Seed default firm lawyers
        db.get("SELECT COUNT(*) as count FROM firm_lawyers", (err, row) => {
            if (!err && row && Number(row.count) === 0) {
                db.run("INSERT INTO firm_lawyers (id, name) VALUES ('law_1', 'Sam Ogola')");
                db.run("INSERT INTO firm_lawyers (id, name) VALUES ('law_2', 'Ms Ivy')");
                console.log('Default firm lawyers seeded.');
            }
        });

        console.log('Database initialized and all migrations applied safely.');
    });
}

function seedTestData(callback) {
    const crypto = require('crypto');
    const milestones = JSON.stringify(["Initial Consultation", "Execution", "Filing in Court", "Hearing Phase", "Judgment"]);
    const now = new Date();
    const time12h = new Date(now.getTime() + 12 * 60 * 60 * 1000).toISOString();
    const time18h = new Date(now.getTime() + 18 * 60 * 60 * 1000).toISOString();

    db.serialize(() => {
        const c1 = 'c_test_' + crypto.randomBytes(3).toString('hex');
        const c2 = 'c_test_' + crypto.randomBytes(3).toString('hex');

        db.run(`INSERT INTO case_tracking (id, tracking_token, client_name, case_title, case_type, current_milestone, milestones_json, assigned_lawyer, fee_status, court_station, ref_no, judiciary_case_id, total_fee, outstanding_balance, client_phone, client_email) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [c1, 'SO-ABCD12', 'John Doe', 'Doe v. Republic', 'Criminal', '3', milestones, 'Sam Ogola', 'pending', 'Milimani Law Courts', 'REF/2026/01', 'MIL-CR-101-2026', 150000, 50000, '+254712345678', 'john.doe@example.com']);

        db.run(`INSERT INTO case_tracking (id, tracking_token, client_name, case_title, case_type, current_milestone, milestones_json, assigned_lawyer, fee_status, court_station, ref_no, judiciary_case_id, total_fee, outstanding_balance, client_phone, client_email) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [c2, 'SO-WXYZ34', 'Jane Smith', 'Smith v. Kenya Power', 'Civil Disputes', '2', milestones, 'Sam Ogola', 'pending', 'Nairobi High Court', 'REF/2026/02', 'MIL-CC-502-2026', 250000, 120000, '+254787654321', 'jane.smith@example.com']);

        db.run(`INSERT INTO court_calendar (id, case_id, event_title, event_type, event_date, notes, is_important, assigned_lawyer, reminder_sent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            ['ev_test_' + crypto.randomBytes(3).toString('hex'), c1, 'Criminal Mention Hearing', 'mention', time12h, 'Milimani Court room 3. Focus on bail terms.', 1, 'Sam Ogola', 0]);

        db.run(`INSERT INTO court_calendar (id, case_id, event_title, event_type, event_date, notes, is_important, assigned_lawyer, reminder_sent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            ['ev_test_' + crypto.randomBytes(3).toString('hex'), c2, 'Final Zoom Judgment', 'judgment', time18h, 'Nairobi High Court Civil Division.', 1, 'Sam Ogola', 0],
            () => { if (callback) callback(null);

        const defaultIssues = ['Fraud / Illegality', 'Adverse Possession', 'S.26 LRA — Bona Fide Purchaser', 'Default / Repayment', 'Limitation of Actions'];
        const defaultContacts = ['Plaintiff / Claimant', 'Defendant / Respondent', 'Expert Witness', 'Surveyor'];
        
        defaultIssues.forEach((issue, i) => {
            db.run(`INSERT INTO case_issues (id, case_id, name, color) VALUES (?, ?, ?, ?)`, ['iss_' + crypto.randomBytes(3).toString('hex'), c1, issue, '#c9a84c']);
            db.run(`INSERT INTO case_issues (id, case_id, name, color) VALUES (?, ?, ?, ?)`, ['iss_' + crypto.randomBytes(3).toString('hex'), c2, issue, '#c9a84c']);
        });

        defaultContacts.forEach((contact, i) => {
            db.run(`INSERT INTO case_contacts (id, case_id, name, role) VALUES (?, ?, ?, ?)`, ['cnt_' + crypto.randomBytes(3).toString('hex'), c1, contact, 'Witness']);
            db.run(`INSERT INTO case_contacts (id, case_id, name, role) VALUES (?, ?, ?, ?)`, ['cnt_' + crypto.randomBytes(3).toString('hex'), c2, contact, 'Witness']);
        });
 }
        );
    });
}

function nukeDb(callback) {
    const tables = [
        'leads', 'case_tracking', 'whatsapp_sessions', 'court_calendar', 
        'case_activities', 'firm_expenses', 'case_payments', 'users', 
        'case_files', 'case_invoices', 'case_disbursements',
        'case_facts', 'case_issues', 'case_contacts',
        'extracted_facts', 'fact_sources', 'fact_witnesses', 'fact_issues', 'witness_roster',
        'case_submissions', 'judiciary_api_config', 'ebundle_sections', 'ebundle_documents',
        'trust_ledger', 'firm_lawyers', 'soca_chat_sessions', 'soca_memory'
    ];
    
    db.serialize(() => {
        if (usePostgres) {
            let dropChain = Promise.resolve();
            tables.forEach(table => {
                dropChain = dropChain.then(() => {
                    return new Promise((resolve) => {
                        db.run(`DROP TABLE IF EXISTS ${table} CASCADE`, [], () => resolve());
                    });
                });
            });
            dropChain.then(() => {
                initializeDb();
                if (callback) callback(null);
            });
        } else {
            let dropChain = Promise.resolve();
            tables.forEach(table => {
                dropChain = dropChain.then(() => {
                    return new Promise((resolve) => {
                        db.run(`DROP TABLE IF EXISTS ${table}`, [], () => resolve());
                    });
                });
            });
            dropChain.then(() => {
                initializeDb();
                if (callback) callback(null);
            });
        }
    });
}

db.nukeDb = nukeDb;
db.seedTestData = seedTestData;

function getBackupData(callback) {
    const tables = [
        'leads', 'case_tracking', 'whatsapp_sessions', 'court_calendar', 
        'case_activities', 'firm_expenses', 'case_payments', 'users', 
        'case_files', 'case_invoices', 'case_disbursements',
        'case_facts', 'case_issues', 'case_contacts',
        'extracted_facts', 'fact_sources', 'fact_witnesses', 'fact_issues', 'witness_roster',
        'case_submissions', 'judiciary_api_config', 'ebundle_sections', 'ebundle_documents',
        'trust_ledger', 'firm_lawyers', 'soca_chat_sessions', 'soca_memory'
    ];
    const backup = {};
    let chain = Promise.resolve();
    
    tables.forEach(table => {
        chain = chain.then(() => {
            return new Promise((resolve) => {
                db.all(`SELECT * FROM ${table}`, [], (err, rows) => {
                    if (!err && rows) {
                        backup[table] = rows;
                    } else {
                        backup[table] = [];
                    }
                    resolve();
                });
            });
        });
    });
    
    chain.then(() => {
        callback(null, backup);
    }).catch(err => {
        callback(err, null);
    });
}

db.getBackupData = getBackupData;

module.exports = db;
