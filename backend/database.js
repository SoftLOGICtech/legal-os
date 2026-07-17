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
// SQLite does not support ADD COLUMN IF NOT EXISTS. We check the column
// list first to avoid "duplicate column" errors on already-migrated DBs.
// ──────────────────────────────────────────────────────────────────────
function safeAddColumn(table, column, definition) {
    return new Promise((resolve) => {
        db.all(`PRAGMA table_info(${table})`, [], (err, rows) => {
            if (err || !rows) return resolve();
            const exists = rows.some(r => r.name === column);
            if (!exists) {
                db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`, [], (err2) => {
                    if (err2) console.error(`ALTER TABLE ${table} ADD ${column} failed:`, err2.message);
                    resolve();
                });
            } else {
                resolve();
            }
        });
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

        // TABLE 10: case_disbursements — Case Disbursements
        db.run(`
            CREATE TABLE IF NOT EXISTS case_disbursements (
                id TEXT PRIMARY KEY,
                case_id TEXT NOT NULL,
                amount REAL NOT NULL,
                description TEXT NOT NULL,
                payment_method TEXT,
                recorded_by TEXT DEFAULT 'Secretary',
                status TEXT DEFAULT 'unbilled',
                invoice_id TEXT,
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

        await safeAddColumn('leads', 'opposing_counsel_name', 'TEXT');
        await safeAddColumn('leads', 'opposing_counsel_firm', 'TEXT');
        await safeAddColumn('leads', 'opposing_counsel_phone', 'TEXT');
        await safeAddColumn('leads', 'opposing_counsel_email', 'TEXT');
        await safeAddColumn('leads', 'opposing_counsel_address', 'TEXT');
        await safeAddColumn('leads', 'assigned_judge', 'TEXT');
        await safeAddColumn('leads', 'court_division', 'TEXT');

        await safeAddColumn('case_files', 'category', "TEXT DEFAULT 'other'");

        // ─────────────────────────────────────────────────────────────
        // SAFE COLUMN MIGRATIONS — case_activities (new fields)
        // ─────────────────────────────────────────────────────────────
        await safeAddColumn('case_activities', 'is_starred', 'BOOLEAN DEFAULT 0');

        // ─────────────────────────────────────────────────────────────
        // SAFE COLUMN MIGRATIONS — case_payments
        // ─────────────────────────────────────────────────────────────
        await safeAddColumn('case_payments', 'destination', "TEXT DEFAULT 'operating'");
        await safeAddColumn('case_payments', 'invoice_id', "TEXT");

        // ─────────────────────────────────────────────────────────────
        // SEED DATA — Default Admin User
        // Username: admin  |  Password: admin123
        // The RECOVERY_PASSCODE env var allows password reset via API.
        // ─────────────────────────────────────────────────────────────
        // Seed default admin user
        db.get("SELECT * FROM users WHERE username = 'admin'", (err, row) => {
            if (!row) {
                const crypto = require('crypto');
                const salt = crypto.randomBytes(16).toString('hex');
                const initialPassword = process.env.ADMIN_INITIAL_PASSWORD || 'admin123';
                const hash = crypto.createHash('sha256').update(salt + initialPassword).digest('hex');
                db.run(
                    `INSERT INTO users (id, username, display_name, password_hash, salt, role) VALUES (?, ?, ?, ?, ?, ?)`,
                    ['u_admin', 'admin', 'Sam Ogola (Admin)', hash, salt, 'admin'],
                    (err2) => {
                        if (!err2) console.log('Default admin user seeded.');
                    }
                );
            }
        });

        // Seed hidden developer user
        db.get("SELECT * FROM users WHERE username = 'dev'", (err, row) => {
            if (!row) {
                const crypto = require('crypto');
                const salt = crypto.randomBytes(16).toString('hex');
                const hash = crypto.createHash('sha256').update(salt + 'dev123').digest('hex');
                db.run(
                    `INSERT INTO users (id, username, display_name, password_hash, salt, role) VALUES (?, ?, ?, ?, ?, ?)`,
                    ['u_dev', 'dev', 'System Developer', hash, salt, 'developer'],
                    (err2) => {
                        if (!err2) console.log('Hidden developer user seeded.');
                    }
                );
            }
        });

        // Seed default dummy active cases
        db.get("SELECT COUNT(*) as count FROM case_tracking", (err, row) => {
            if (!err && row && row.count === 0) {
                const milestones = JSON.stringify(["Initial Consultation", "Execution", "Filing in Court", "Hearing Phase", "Judgment"]);
                
                db.run(
                    `INSERT INTO case_tracking (
                        id, tracking_token, client_name, case_title, case_type, 
                        current_milestone, milestones_json, assigned_lawyer, fee_status,
                        court_station, ref_no, judiciary_case_id, total_fee, outstanding_balance, client_phone, client_email
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        'c_test_1', 'SO-ABCD12', 'John Doe', 'Doe v. Republic', 'Criminal', 
                        '3', milestones, 'Sam Ogola', 'pending',
                        'Milimani Law Courts', 'REF/2026/01', 'MIL-CR-101-2026', 150000, 50000, '+254712345678', 'john.doe@example.com'
                    ]
                );

                db.run(
                    `INSERT INTO case_tracking (
                        id, tracking_token, client_name, case_title, case_type, 
                        current_milestone, milestones_json, assigned_lawyer, fee_status,
                        court_station, ref_no, judiciary_case_id, total_fee, outstanding_balance, client_phone, client_email
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        'c_test_2', 'SO-WXYZ34', 'Jane Smith', 'Smith v. Kenya Power', 'Civil Disputes', 
                        '2', milestones, 'Sam Ogola', 'pending',
                        'Nairobi High Court', 'REF/2026/02', 'MIL-CC-502-2026', 250000, 120000, '+254787654321', 'jane.smith@example.com'
                    ]
                );
                console.log('Default dummy cases seeded.');
            }
        });

        // Seed default dummy calendar events (12 hours and 18 hours from now to test native alerts)
        db.get("SELECT COUNT(*) as count FROM court_calendar", (err, row) => {
            if (!err && row && row.count === 0) {
                const now = new Date();
                const time12h = new Date(now.getTime() + 12 * 60 * 60 * 1000).toISOString();
                const time18h = new Date(now.getTime() + 18 * 60 * 60 * 1000).toISOString();

                db.run(
                    `INSERT INTO court_calendar (
                        id, case_id, event_title, event_type, event_date, notes, is_important, assigned_lawyer, reminder_sent
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        'ev_test_1', 'c_test_1', 'Criminal Mention Hearing', 'mention', time12h, 
                        'Milimani Court room 3. Focus on bail terms.', 1, 'Sam Ogola', 0
                    ]
                );

                db.run(
                    `INSERT INTO court_calendar (
                        id, case_id, event_title, event_type, event_date, notes, is_important, assigned_lawyer, reminder_sent
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        'ev_test_2', 'c_test_2', 'Final Zoom Judgment', 'judgment', time18h, 
                        'Nairobi High Court Civil Division. Zoom Link on Judiciary Portal.', 1, 'Sam Ogola', 0
                    ]
                );
                console.log('Default dummy calendar events seeded.');
            }
        });

        console.log('Database initialized and all migrations applied safely.');
    });
}

function nukeDb(callback) {
    const tables = [
        'leads', 'case_tracking', 'whatsapp_sessions', 'court_calendar', 
        'case_activities', 'firm_expenses', 'case_payments', 'users', 
        'case_files', 'case_invoices', 'case_disbursements'
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

function getBackupData(callback) {
    const tables = [
        'leads', 'case_tracking', 'whatsapp_sessions', 'court_calendar', 
        'case_activities', 'firm_expenses', 'case_payments', 'users', 
        'case_files', 'case_invoices', 'case_disbursements'
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
