const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error connecting to database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        initializeDb();
    }
});

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
        db.get("SELECT count(*) as count FROM users", (err, row) => {
            if (row && row.count === 0) {
                const crypto = require('crypto');
                const salt = crypto.randomBytes(16).toString('hex');
                const hash = crypto.createHash('sha256').update(salt + 'admin123').digest('hex');
                db.run(
                    `INSERT INTO users (id, username, display_name, password_hash, salt, role) VALUES (?, ?, ?, ?, ?, ?)`,
                    ['u_admin', 'admin', 'Sam Ogola (Admin)', hash, salt, 'admin'],
                    (err2) => {
                        if (!err2) console.log('Default admin user seeded. Username: admin / Password: admin123 — CHANGE THIS IN PRODUCTION.');
                    }
                );
            }
        });

        // ─────────────────────────────────────────────────────────────
        // SEED DATA — Case Tracking (unchanged from original)
        // ─────────────────────────────────────────────────────────────
        db.get("SELECT count(*) as count FROM case_tracking", (err, row) => {
            if (row && row.count === 0) {
                db.run(`INSERT INTO case_tracking (id, tracking_token, client_name, case_title, case_type, current_milestone, milestones_json, assigned_lawyer, fee_status) VALUES 
                    ('c1', 'SO-7782A', 'Peter Kamau Mwangi', 'Land Purchase Thika', 'Conveyancing', '2', '["Drafting Sale Agreement", "Execution", "Payment of Duties", "Registration", "Title Transfer"]', 'Kincy Nangami', 'paid'),
                    ('c2', 'SO-5591B', 'Grace Wanjiku', 'Company Registration', 'Corporate Law', '1', '["Initial Consultation", "Drafting Articles", "Regulatory Filing", "Compliance Review", "Final Certificates"]', 'Sam Ogola', 'pending'),
                    ('c3', 'SO-9922C', 'XYZ Logistics Ltd', 'Commercial Dispute', 'Litigation', '3', '["Filing in Court", "Mention/Directions", "Hearing Phase", "Judgment", "Execution"]', 'Muchiri Mutegi', 'paid')
                `);
            }
        });

        // ─────────────────────────────────────────────────────────────
        // SEED DATA — Leads (unchanged from original)
        // ─────────────────────────────────────────────────────────────
        db.get("SELECT count(*) as count FROM leads", (err, row) => {
            if (row && row.count === 0) {
                const now = new Date().toISOString();
                db.run(`INSERT INTO leads (id, full_name, phone, service_category, message, source, status, consultation_date, consultation_paid, assigned_lawyer) VALUES 
                    ('l1', 'David Onyango', '+254700000000', 'Civil Disputes', 'Contract breach - lease agreement', 'walk_in', 'pending_review', NULL, 0, NULL),
                    ('l2', 'Sarah Kiplagat', '+254711111111', 'Family Law', 'Divorce and child custody consultation', 'phone', 'consultation_set', '${now}', 1, 'Sam Ogola'),
                    ('l3', 'Ochieng Odhiambo', '+254722222222', 'Employment Law', 'Wrongful termination dispute', 'whatsapp', 'assigned', NULL, 0, 'Muchiri Mutegi')
                `);
            }
        });

        // ─────────────────────────────────────────────────────────────
        // SEED DATA — Court Calendar (demo events)
        // ─────────────────────────────────────────────────────────────
        db.get("SELECT count(*) as count FROM court_calendar", (err, row) => {
            if (row && row.count === 0) {
                const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
                const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
                db.run(`INSERT INTO court_calendar (id, case_id, event_title, event_type, event_date, notes) VALUES
                    ('ev1', 'c3', 'Commercial Dispute — Hearing Phase Mention', 'mention', '${tomorrow}', 'Milimani Commercial Courts. Room 4B. Judge Ngugi presiding.'),
                    ('ev2', 'c1', 'Title Deed Registration Deadline', 'filing_deadline', '${nextWeek}', 'File at Land Registry, Upper Hill.')
                `);
            }
        });

        // ─────────────────────────────────────────────────────────────
        // SEED DATA — Case Activities (demo notes)
        // ─────────────────────────────────────────────────────────────
        db.get("SELECT count(*) as count FROM case_activities", (err, row) => {
            if (row && row.count === 0) {
                db.run(`INSERT INTO case_activities (id, case_id, activity_type, description, recorded_by) VALUES
                    ('act1', 'c3', 'court_filing', 'Filed Petition at Milimani Commercial Court. Filing ref: MLM/CC/2026/1201.', 'Secretary'),
                    ('act2', 'c1', 'client_call', 'Called client re: document readiness. Client confirmed all documents ready for signing.', 'Kincy Nangami'),
                    ('act3', 'c2', 'internal_note', 'Awaiting KRA tax clearance certificate before regulatory filing can proceed.', 'Sam Ogola')
                `);
            }
        });

        // ─────────────────────────────────────────────────────────────
        // SEED DATA — Firm Expenses (demo entries)
        // ─────────────────────────────────────────────────────────────
        db.get("SELECT count(*) as count FROM firm_expenses", (err, row) => {
            if (row && row.count === 0) {
                db.run(`INSERT INTO firm_expenses (id, amount, category, description, recorded_by) VALUES
                    ('exp1', 1200, 'transport', 'Taxi fare - Milimani Court appearance', 'Secretary'),
                    ('exp2', 850, 'stationery', 'A4 printing paper and cartridges', 'Secretary'),
                    ('exp3', 500, 'filing_fees', 'Court filing stamp fee - XYZ Logistics matter', 'Secretary')
                `);
            }
        });

        console.log('Database initialized and all migrations applied safely.');
    });
}

module.exports = db;
