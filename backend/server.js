const express = require('express');
const cors = require('cors');
const db = require('./database');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';

// Production safety verification for secret keys
console.log('--- Environment Check ---');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('Available Config Keys:', Object.keys(process.env).filter(key => 
    ['PORT', 'NODE_ENV', 'DATABASE_URL', 'JWT_SECRET', 'RECOVERY_PASSCODE', 'PARTNER_PASSCODE', 'ADMIN_INITIAL_PASSWORD', 'FRONTEND_URL'].includes(key)
));
console.log('-------------------------');

if (isProd) {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'legal_os_dev_secret_2026') {
        console.error('CRITICAL ERROR: JWT_SECRET environment variable is missing or using default in production!');
        process.exit(1);
    }
    if (!process.env.RECOVERY_PASSCODE || process.env.RECOVERY_PASSCODE === 'RECOVER_SOCA_2026') {
        console.error('CRITICAL ERROR: RECOVERY_PASSCODE environment variable is missing or using default in production!');
        process.exit(1);
    }
    if (!process.env.PARTNER_PASSCODE || process.env.PARTNER_PASSCODE === '1234') {
        console.error('CRITICAL ERROR: PARTNER_PASSCODE environment variable is missing or using default in production!');
        process.exit(1);
    }
}

const JWT_SECRET = process.env.JWT_SECRET || 'legal_os_dev_secret_2026';
const RECOVERY_PASSCODE = process.env.RECOVERY_PASSCODE || 'RECOVER_SOCA_2026';
const PARTNER_PASSCODE  = process.env.PARTNER_PASSCODE  || '1234';

// Secure CORS configuration
const allowedOrigins = isProd
    ? (process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',').map(u => u.trim()) : [])
    : ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Blocked by CORS'));
        }
    },
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// ──────────────────────────────────────────────────────────────────────
// AUTH HELPERS
// ──────────────────────────────────────────────────────────────────────
function hashPassword(salt, plaintext) {
    return crypto.createHash('sha256').update(salt + plaintext).digest('hex');
}

function generateToken(user) {
    return jwt.sign(
        { id: user.id, username: user.username, role: user.role, display_name: user.display_name },
        JWT_SECRET,
        { expiresIn: '12h' }
    );
}

// Middleware: require a valid JWT on protected routes
function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required.' });
    }
    try {
        req.user = jwt.verify(authHeader.slice(7), JWT_SECRET);
        next();
    } catch (e) {
        return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
    }
}

// Middleware: restrict to specific roles
function requireRole(...roles) {
    return (req, res, next) => {
        if (!roles.includes(req.user?.role)) {
            return res.status(403).json({ error: `Access denied. Requires role: ${roles.join(' or ')}.` });
        }
        next();
    };
}

// ══════════════════════════════════════════════════════════════════════
// AUTH ROUTES (public — no auth middleware needed)
// ══════════════════════════════════════════════════════════════════════

// Login
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required.' });

    db.get('SELECT * FROM users WHERE username = ?', [username.trim().toLowerCase()], (err, user) => {
        if (err || !user) return res.status(401).json({ error: 'Invalid credentials.' });
        const expected = hashPassword(user.salt, password);
        if (expected !== user.password_hash) return res.status(401).json({ error: 'Invalid credentials.' });
        const token = generateToken(user);
        res.json({ token, role: user.role, display_name: user.display_name, id: user.id });
    });
});

// Dev Recovery — allows resetting admin password if locked out
// Usage: POST /api/auth/recover  { recovery_passcode, new_password }
app.post('/api/auth/recover', (req, res) => {
    const { recovery_passcode, new_password } = req.body;
    if (recovery_passcode !== RECOVERY_PASSCODE) {
        return res.status(403).json({ error: 'Invalid recovery passcode.' });
    }
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashPassword(salt, new_password);
    db.run('UPDATE users SET password_hash = ?, salt = ? WHERE role = ?', [hash, salt, 'admin'], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        const changes = this.changes || 0;
        if (changes === 0) {
            // Admin user does not exist. Let's create it!
            db.run(
                'INSERT INTO users (id, username, display_name, password_hash, salt, role) VALUES (?, ?, ?, ?, ?, ?)',
                ['u_admin', 'admin', 'Sam Ogola (Admin)', hash, salt, 'admin'],
                function(err2) {
                    if (err2) return res.status(500).json({ error: 'Failed to create admin user: ' + err2.message });
                    res.json({ message: 'Admin user did not exist. Created a new admin user successfully.' });
                }
            );
        } else {
            res.json({ message: `Admin password reset. ${changes} account(s) updated.` });
        }
    });
});

// Admin: create user account
app.post('/api/auth/users', requireAuth, requireRole('admin'), (req, res) => {
    const { username, display_name, password, role } = req.body;
    if (!username || !password || !display_name) return res.status(400).json({ error: 'username, display_name and password required.' });
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashPassword(salt, password);
    const id = 'u_' + Date.now();
    db.run(
        'INSERT INTO users (id, username, display_name, password_hash, salt, role) VALUES (?, ?, ?, ?, ?, ?)',
        [id, username.trim().toLowerCase(), display_name, hash, salt, role || 'secretary'],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id, username, role });
        }
    );
});

// Admin: list users
app.get('/api/auth/users', requireAuth, requireRole('admin'), (req, res) => {
    db.all('SELECT id, username, display_name, role, created_at FROM users ORDER BY created_at ASC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Admin: delete user (cannot delete self)
app.delete('/api/auth/users/:id', requireAuth, requireRole('admin'), (req, res) => {
    if (req.params.id === req.user.id) return res.status(400).json({ error: 'Cannot delete your own account.' });
    db.run('DELETE FROM users WHERE id = ?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ deleted: this.changes });
    });
});

// Admin: change any user's password
app.put('/api/auth/users/:id/password', requireAuth, requireRole('admin'), (req, res) => {
    const { new_password } = req.body;
    if (!new_password) return res.status(400).json({ error: 'new_password required.' });
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashPassword(salt, new_password);
    db.run('UPDATE users SET password_hash = ?, salt = ? WHERE id = ?', [hash, salt, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ updated: this.changes });
    });
});

// ══════════════════════════════════════════════════════════════════════
// MULTER FILE UPLOAD — Local case document locker
// ══════════════════════════════════════════════════════════════════════
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const caseToken = (req.params.case_id || 'general').replace(/[\/\\:]/g, '_');
        const uploadDir = path.join(__dirname, 'public', 'uploads', caseToken);
        fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        cb(null, `${timestamp}_${safeName}`);
    }
});
const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } }); // 100MB limit

// Upload file to a case
app.post('/api/cases/:case_id/files', requireAuth, upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file received.' });
    const { case_id } = req.params;
    const { category } = req.body;
    const caseToken = case_id.replace(/[\/\\:]/g, '_');
    const relPath = `/uploads/${caseToken}/${req.file.filename}`;
    const id = 'cf_' + Date.now();
    db.run(
        'INSERT INTO case_files (id, case_id, file_name, file_path, file_size, uploaded_by, category) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, case_id, req.file.originalname, relPath, req.file.size, req.user.display_name, category || 'other'],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id, file_name: req.file.originalname, file_path: relPath, file_size: req.file.size, category: category || 'other' });
        }
    );
});

// Get files for a case
app.get('/api/cases/:case_id/files', requireAuth, (req, res) => {
    db.all('SELECT * FROM case_files WHERE case_id = ? ORDER BY uploaded_at DESC', [req.params.case_id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Delete file from case
app.delete('/api/cases/files/:id', requireAuth, (req, res) => {
    db.get('SELECT * FROM case_files WHERE id = ?', [req.params.id], (err, file) => {
        if (err || !file) return res.status(404).json({ error: 'File not found.' });
        const fullPath = path.join(__dirname, 'public', file.file_path);
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
        db.run('DELETE FROM case_files WHERE id = ?', [file.id], function(e) {
            if (e) return res.status(500).json({ error: e.message });
            
            // Log audit activity trail
            const crypto = require('crypto');
            const activityId = 'act_' + crypto.randomBytes(4).toString('hex');
            const desc = `🗑️ Deleted document: ${file.file_name} (Folder: ${(file.category || 'other').toUpperCase()})`;
            db.run('INSERT INTO case_activities (id, case_id, activity_type, description, recorded_by) VALUES (?, ?, ?, ?, ?)',
                [activityId, file.case_id, 'internal_note', desc, req.user?.display_name || 'Staff']);
                
            res.json({ deleted: this.changes });
        });
    });
});



// ══════════════════════════════════════════════════════════════════════
// LEADS
// ══════════════════════════════════════════════════════════════════════

// Get all leads
app.get('/api/leads', (req, res) => {
    db.all('SELECT * FROM leads ORDER BY created_at DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Create new lead manually
app.post('/api/leads', (req, res) => {
    const { 
        full_name, phone, email, service_category, message, source, opposing_party, is_emergency, conflict_checked,
        id_number, kra_pin, address, custom_kyc, dob, occupation, opposing_party_contact, billing_type,
        emergency_name, emergency_phone, emergency_relation, alternative_phone, alternative_email,
        opposing_counsel_name, opposing_counsel_firm, opposing_counsel_phone, opposing_counsel_email, opposing_counsel_address,
        assigned_judge, court_division
    } = req.body;
    const id = 'l_' + Date.now();
    db.run(
        `INSERT INTO leads (
            id, full_name, phone, email, service_category, message, source, opposing_party, is_emergency, conflict_checked,
            id_number, kra_pin, address, custom_kyc, dob, occupation, opposing_party_contact, billing_type,
            emergency_name, emergency_phone, emergency_relation, alternative_phone, alternative_email,
            opposing_counsel_name, opposing_counsel_firm, opposing_counsel_phone, opposing_counsel_email, opposing_counsel_address,
            assigned_judge, court_division
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            id, full_name, phone, email, service_category, message, source, opposing_party || null,
            is_emergency ? 1 : 0, conflict_checked ? 1 : 0, id_number || null, kra_pin || null, address || null,
            custom_kyc || null, dob || null, occupation || null, opposing_party_contact || null, billing_type || null,
            emergency_name || null, emergency_phone || null, emergency_relation || null, alternative_phone || null, alternative_email || null,
            opposing_counsel_name || null, opposing_counsel_firm || null, opposing_counsel_phone || null, opposing_counsel_email || null, opposing_counsel_address || null,
            assigned_judge || null, court_division || null
        ],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id, full_name, status: 'pending_review' });
        }
    );
});

// Update lead (general endpoint supporting all fields)
app.put('/api/leads/:id', (req, res) => {
    const { id } = req.params;
    const fields = [
        'status', 'consultation_date', 'consultation_paid', 'assigned_lawyer', 'full_name', 'phone', 'email',
        'service_category', 'message', 'source', 'opposing_party', 'is_emergency', 'conflict_checked',
        'id_number', 'kra_pin', 'address', 'custom_kyc', 'dob', 'occupation', 'opposing_party_contact',
        'billing_type', 'emergency_name', 'emergency_phone', 'emergency_relation', 'alternative_phone', 'alternative_email',
        'opposing_counsel_name', 'opposing_counsel_firm', 'opposing_counsel_phone', 'opposing_counsel_email', 'opposing_counsel_address',
        'assigned_judge', 'court_division'
    ];
    
    let sets = [];
    let params = [];
    for (const f of fields) {
        if (req.body[f] !== undefined) {
            sets.push(`${f} = ?`);
            params.push(f === 'consultation_paid' || f === 'is_emergency' || f === 'conflict_checked' ? (req.body[f] ? 1 : 0) : req.body[f]);
        }
    }
    
    if (sets.length === 0) return res.json({ updated: 0 });
    params.push(id);
    
    db.run(
        `UPDATE leads SET ${sets.join(', ')} WHERE id = ?`,
        params,
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ updated: this.changes });
        }
    );
});


// ══════════════════════════════════════════════════════════════════════
// CASES
// ══════════════════════════════════════════════════════════════════════

// Get all cases
app.get('/api/cases', (req, res) => {
    db.all('SELECT * FROM case_tracking ORDER BY last_updated DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Get suggested tracking token
app.get('/api/cases/suggest-token', (req, res) => {
    const { client_name } = req.query;
    if (!client_name) return res.json({ token: '' });
    const initials = client_name.trim().split(/\s+/).map(n => n[0].toUpperCase()).join('').substring(0, 4);
    const yearSuffix = new Date().getFullYear().toString().slice(-2);
    db.get('SELECT COUNT(*) as count FROM case_tracking', [], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        const count = (row ? row.count : 0) + 1;
        res.json({ token: `${initials}/${count}/${yearSuffix}` });
    });
});

// Create new case
app.post('/api/cases', (req, res) => {
    let { 
        client_name, case_title, case_type, assigned_lawyer, lead_id, opposing_party, ref_no, is_sensitive, tracking_token,
        client_phone, client_email, id_number, kra_pin, address, custom_kyc, court_station,
        dob, occupation, opposing_party_contact, billing_type, emergency_name, emergency_phone, emergency_relation,
        alternative_phone, alternative_email,
        opposing_counsel_name, opposing_counsel_firm, opposing_counsel_phone, opposing_counsel_email, opposing_counsel_address,
        assigned_judge, court_division, case_brief
    } = req.body;
    const id = 'c_' + Date.now();

    const processCreation = (finalToken) => {
        let defaultMilestones = ["Intake / Consult", "Research & Prep", "Drafting Documents", "Hearing / Processing", "Resolution / Closing"];
        if (case_type === "Conveyancing & Land") {
            defaultMilestones = ["Drafting Sale Agreement", "Execution of Documents", "Payment of Duties", "Registration", "Title Transfer"];
        } else if (["Civil Disputes", "Criminal Defense", "Litigation"].includes(case_type)) {
            defaultMilestones = ["Filing in Court", "Mention/Directions", "Hearing Phase", "Judgment", "Execution/Appeal"];
        } else if (case_type === "Corporate Law") {
            defaultMilestones = ["Initial Consultation", "Drafting Articles/Docs", "Regulatory Filing", "Compliance Review", "Final Certificates"];
        } else if (case_type === "Family Law") {
            defaultMilestones = ["Initial Consultation", "Mediation / Filing", "Hearing Phase", "Decree / Order", "Compliance & Closure"];
        } else if (case_type === "Succession") {
            defaultMilestones = ["Grant of Representation Filing", "Gazettement", "Confirmation of Grant", "Distribution", "Closure"];
        }

        const milestones_json = JSON.stringify(defaultMilestones);

        db.run(
            `INSERT INTO case_tracking (
                id, tracking_token, client_name, case_title, case_type, current_milestone, milestones_json, assigned_lawyer, opposing_party, ref_no, is_sensitive,
                client_phone, client_email, id_number, kra_pin, address, custom_kyc, court_station,
                dob, occupation, opposing_party_contact, billing_type, emergency_name, emergency_phone, emergency_relation,
                alternative_phone, alternative_email,
                opposing_counsel_name, opposing_counsel_firm, opposing_counsel_phone, opposing_counsel_email, opposing_counsel_address,
                assigned_judge, court_division, case_brief
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id, finalToken, client_name, case_title, case_type, '1', milestones_json, assigned_lawyer, opposing_party || null, ref_no || null, is_sensitive ? 1 : 0,
                client_phone || null, client_email || null, id_number || null, kra_pin || null, address || null, custom_kyc || null, court_station || null,
                dob || null, occupation || null, opposing_party_contact || null, billing_type || null, emergency_name || null, emergency_phone || null, emergency_relation || null,
                alternative_phone || null, alternative_email || null,
                opposing_counsel_name || null, opposing_counsel_firm || null, opposing_counsel_phone || null, opposing_counsel_email || null, opposing_counsel_address || null,
                assigned_judge || null, court_division || null, case_brief || null
            ],
            function(err) {
                if (err) return res.status(500).json({ error: err.message });
                if (lead_id) db.run('UPDATE leads SET status = "converted" WHERE id = ?', [lead_id]);
                res.json({ id, tracking_token: finalToken });
            }
        );
    };

    if (tracking_token) {
        processCreation(tracking_token);
    } else {
        const initials = client_name ? client_name.trim().split(/\s+/).map(n => n[0].toUpperCase()).join('').substring(0, 4) : 'SO';
        const yearSuffix = new Date().getFullYear().toString().slice(-2);
        db.get('SELECT COUNT(*) as count FROM case_tracking', [], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            const count = (row ? row.count : 0) + 1;
            const auto_token = `${initials}/${count}/${yearSuffix}`;
            processCreation(auto_token);
        });
    }
});

// Update case (general endpoint supporting all details)
app.put('/api/cases/:id', (req, res) => {
    const { id } = req.params;
    const fields = [
        'client_name', 'case_title', 'case_type', 'assigned_lawyer', 'opposing_party', 'ref_no', 'is_sensitive',
        'tracking_token', 'client_phone', 'client_email', 'id_number', 'kra_pin', 'address', 'custom_kyc',
        'court_station', 'dob', 'occupation', 'opposing_party_contact', 'billing_type',
        'emergency_name', 'emergency_phone', 'emergency_relation', 'alternative_phone', 'alternative_email',
        'opposing_counsel_name', 'opposing_counsel_firm', 'opposing_counsel_phone', 'opposing_counsel_email', 'opposing_counsel_address',
        'assigned_judge', 'court_division', 'case_brief'
    ];
    
    let sets = [];
    let params = [];
    for (const f of fields) {
        if (req.body[f] !== undefined) {
            sets.push(`${f} = ?`);
            params.push(f === 'is_sensitive' ? (req.body[f] ? 1 : 0) : req.body[f]);
        }
    }
    
    if (sets.length === 0) return res.json({ updated: 0 });
    params.push(id);
    
    db.run(
        `UPDATE case_tracking SET ${sets.join(', ')}, last_updated = CURRENT_TIMESTAMP WHERE id = ?`,
        params,
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ updated: this.changes });
        }
    );
});

// Update case milestone
app.put('/api/cases/:id/milestone', (req, res) => {
    const { id } = req.params;
    const { milestone } = req.body;
    db.run('UPDATE case_tracking SET current_milestone = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?',
        [milestone, id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ updated: this.changes });
        });
});

// Rollback milestone with Partner Passcode
app.put('/api/cases/:id/rollback-milestone', (req, res) => {
    const { id } = req.params;
    const { milestone, passcode } = req.body;
    if (passcode !== PARTNER_PASSCODE) {
        return res.status(403).json({ error: 'Unauthorized: Invalid Partner Passcode.' });
    }
    db.run('UPDATE case_tracking SET current_milestone = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?',
        [milestone, id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ updated: this.changes });
        });
});

// Edit custom milestones array
app.put('/api/cases/:id/edit-milestones', (req, res) => {
    const { id } = req.params;
    const { milestones_json } = req.body;
    db.run('UPDATE case_tracking SET milestones_json = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?',
        [milestones_json, id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ updated: this.changes });
        });
});

// Update trust payment status (minimal — reference only, no funds touched)
app.put('/api/cases/:id/payment', (req, res) => {
    const { trust_payment_status, trust_payment_ref, total_fee, outstanding_balance, fee_status } = req.body;
    db.run(
        'UPDATE case_tracking SET trust_payment_status = ?, trust_payment_ref = ?, total_fee = ?, outstanding_balance = ?, fee_status = ? WHERE id = ?',
        [trust_payment_status, trust_payment_ref, total_fee, outstanding_balance, fee_status, req.params.id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ updated: this.changes });
        }
    );
});

// Get case payments
app.get('/api/cases/:id/payments', (req, res) => {
    db.all('SELECT * FROM case_payments WHERE case_id = ? ORDER BY payment_date DESC', [req.params.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Add case payment
app.post('/api/cases/:id/payments', requireAuth, (req, res) => {
    const { amount, payment_ref, payment_method, notes, destination, invoice_id } = req.body;
    const id = 'pay_' + Date.now();
    const case_id = req.params.id;
    const recorded_by = req.user.display_name;
    const finalDest = destination || 'operating';

    db.run(
        'INSERT INTO case_payments (id, case_id, amount, payment_ref, payment_method, notes, recorded_by, destination, invoice_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [id, case_id, amount, payment_ref, payment_method, notes, recorded_by, finalDest, invoice_id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            
            // Auto-update outstanding balance ONLY if direct to operating account
            if (finalDest === 'operating') {
                db.get('SELECT outstanding_balance FROM case_tracking WHERE id = ?', [case_id], (err2, row) => {
                    if (!err2 && row) {
                        const newBal = (row.outstanding_balance || 0) - amount;
                        db.run('UPDATE case_tracking SET outstanding_balance = ? WHERE id = ?', [newBal, case_id]);
                    }
                });
            }

            // Recalculate invoice status if linked to an invoice
            if (invoice_id) {
                db.all('SELECT amount FROM case_payments WHERE invoice_id = ? AND destination = "operating"', [invoice_id], (err3, payments) => {
                    if (!err3 && payments) {
                        const totalPaidOnInvoice = payments.reduce((sum, p) => sum + p.amount, 0);
                        db.get('SELECT amount FROM case_invoices WHERE id = ?', [invoice_id], (err4, inv) => {
                            if (!err4 && inv) {
                                let newStatus = 'partially_paid';
                                if (totalPaidOnInvoice >= inv.amount) {
                                    newStatus = 'paid';
                                }
                                db.run('UPDATE case_invoices SET status = ? WHERE id = ?', [newStatus, invoice_id]);
                            }
                        });
                    }
                });
            }

            // Log activity
            const actId = 'act_' + Date.now() + Math.floor(Math.random()*1000);
            db.run(
                'INSERT INTO case_activities (id, case_id, activity_type, description, recorded_by) VALUES (?, ?, ?, ?, ?)',
                [actId, case_id, 'payment_received', `Received ${finalDest} payment of KES ${amount} via ${payment_method || 'Trust'}. Ref: ${payment_ref}`, recorded_by]
            );

            res.json({ id });
        }
    );
});

// Trust to Operating transfer
app.post('/api/cases/:id/trust-transfer', requireAuth, (req, res) => {
    const { amount, invoice_id, notes } = req.body;
    const case_id = req.params.id;
    const recorded_by = req.user.display_name;

    // Calculate current trust balance for this case
    db.all('SELECT amount FROM case_payments WHERE case_id = ? AND destination = "trust"', [case_id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const trustBalance = rows.reduce((sum, r) => sum + r.amount, 0);
        
        if (trustBalance < amount) {
            return res.status(400).json({ error: 'Insufficient trust funds available for this case.' });
        }

        // Debit trust, Credit operating
        const payIdDebit = 'pay_deb_' + Date.now();
        const payIdCredit = 'pay_crd_' + Date.now();

        db.serialize(() => {
            // Debit Trust
            db.run(
                'INSERT INTO case_payments (id, case_id, amount, payment_ref, payment_method, notes, recorded_by, destination) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [payIdDebit, case_id, -amount, 'TRUST-DEBIT', 'Trust Transfer', `Trust transfer debit for ${invoice_id}`, recorded_by, 'trust']
            );

            // Credit Operating
            db.run(
                'INSERT INTO case_payments (id, case_id, amount, payment_ref, payment_method, notes, recorded_by, destination, invoice_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [payIdCredit, case_id, amount, 'TRUST-CREDIT', 'Trust Transfer', notes || `Trust transfer credit payment`, recorded_by, 'operating', invoice_id],
                function(err2) {
                    if (err2) return res.status(500).json({ error: err2.message });

                    // Auto-update outstanding balance
                    db.get('SELECT outstanding_balance FROM case_tracking WHERE id = ?', [case_id], (err3, row) => {
                        if (!err3 && row) {
                            const newBal = (row.outstanding_balance || 0) - amount;
                            db.run('UPDATE case_tracking SET outstanding_balance = ? WHERE id = ?', [newBal, case_id]);
                        }
                    });

                    // Update invoice status
                    db.all('SELECT amount FROM case_payments WHERE invoice_id = ? AND destination = "operating"', [invoice_id], (err4, payments) => {
                        if (!err4 && payments) {
                            const totalPaidOnInvoice = payments.reduce((sum, p) => sum + p.amount, 0);
                            db.get('SELECT amount FROM case_invoices WHERE id = ?', [invoice_id], (err5, inv) => {
                                if (!err5 && inv) {
                                    let newStatus = 'partially_paid';
                                    if (totalPaidOnInvoice >= inv.amount) {
                                        newStatus = 'paid';
                                    }
                                    db.run('UPDATE case_invoices SET status = ? WHERE id = ?', [newStatus, invoice_id]);
                                }
                            });
                        }
                    });

                    // Log activity
                    const actId = 'act_' + Date.now();
                    db.run(
                        'INSERT INTO case_activities (id, case_id, activity_type, description, recorded_by) VALUES (?, ?, ?, ?, ?)',
                        [actId, case_id, 'trust_transfer', `Transferred KES ${amount} from Client Trust to Operating Account for Invoice ${invoice_id}`, recorded_by]
                    );

                    res.json({ success: true });
                }
            );
        });
    });
});

// GET Invoices for case
app.get('/api/cases/:id/invoices', (req, res) => {
    db.all('SELECT * FROM case_invoices WHERE case_id = ? ORDER BY created_at DESC', [req.params.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// POST Invoice for case
app.post('/api/cases/:id/invoices', requireAuth, (req, res) => {
    const { invoice_number, amount, notes, due_date, disbursement_ids } = req.body;
    const id = 'inv_' + Date.now();
    const case_id = req.params.id;

    db.run(
        'INSERT INTO case_invoices (id, case_id, invoice_number, amount, status, due_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, case_id, invoice_number, amount, 'draft', due_date, notes],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });

            // Link disbursements if any
            if (disbursement_ids && disbursement_ids.length > 0) {
                const placeholders = disbursement_ids.map(() => '?').join(',');
                db.run(`UPDATE case_disbursements SET status = 'billed', invoice_id = ? WHERE id IN (${placeholders})`, [id, ...disbursement_ids]);
            }
            res.json({ id });
        }
    );
});

// UPDATE Invoice status
app.put('/api/invoices/:id/status', requireAuth, (req, res) => {
    const { status } = req.body;
    db.run('UPDATE case_invoices SET status = ? WHERE id = ?', [status, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ updated: this.changes });
    });
});

// GET Disbursements for case
app.get('/api/cases/:id/disbursements', (req, res) => {
    db.all('SELECT * FROM case_disbursements WHERE case_id = ? ORDER BY created_at DESC', [req.params.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// POST Disbursement for case
app.post('/api/cases/:id/disbursements', requireAuth, (req, res) => {
    const { amount, description, payment_method } = req.body;
    const id = 'disb_' + Date.now();
    const case_id = req.params.id;
    const recorded_by = req.user.display_name;

    db.run(
        'INSERT INTO case_disbursements (id, case_id, amount, description, payment_method, recorded_by, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, case_id, amount, description, payment_method, recorded_by, 'unbilled'],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id });
        }
    );
});

// Update Judiciary e-filing references
app.put('/api/cases/:id/judiciary', (req, res) => {
    const { id } = req.params;
    const { judiciary_case_id, judiciary_filing_token } = req.body;
    db.run(
        'UPDATE case_tracking SET judiciary_case_id = ?, judiciary_filing_token = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?',
        [judiciary_case_id, judiciary_filing_token, id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ updated: this.changes });
        }
    );
});


// ══════════════════════════════════════════════════════════════════════
// COURT CALENDAR
// ══════════════════════════════════════════════════════════════════════

// Get all court events (optionally filter by case)
app.get('/api/calendar', (req, res) => {
    const { case_id } = req.query;
    const sql = case_id
        ? 'SELECT c.*, ct.client_name, ct.case_title FROM court_calendar c LEFT JOIN case_tracking ct ON c.case_id = ct.id WHERE c.case_id = ? ORDER BY c.event_date ASC'
        : 'SELECT c.*, ct.client_name, ct.case_title FROM court_calendar c LEFT JOIN case_tracking ct ON c.case_id = ct.id ORDER BY c.event_date ASC';
    db.all(sql, case_id ? [case_id] : [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Add a new calendar event
app.post('/api/calendar', requireAuth, (req, res) => {
    const { case_id, event_title, event_type, event_date, notes, is_important, assigned_lawyer } = req.body;
    const id = 'ev_' + Date.now();
    db.run(
        'INSERT INTO court_calendar (id, case_id, event_title, event_type, event_date, notes, is_important, assigned_lawyer) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [id, case_id || null, event_title, event_type || 'mention', event_date, notes || null,
         is_important ? 1 : 0, assigned_lawyer || null],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id });
        }
    );
});

// Delete a calendar event
app.delete('/api/calendar/:id', (req, res) => {
    db.run('DELETE FROM court_calendar WHERE id = ?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ deleted: this.changes });
    });
});

// Update calendar event details
app.put('/api/calendar/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    const { event_title, event_type, event_date, notes, is_important, assigned_lawyer } = req.body;
    db.run(
        'UPDATE court_calendar SET event_title = ?, event_type = ?, event_date = ?, notes = ?, is_important = ?, assigned_lawyer = ? WHERE id = ?',
        [event_title, event_type, event_date, notes, is_important ? 1 : 0, assigned_lawyer || null, id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ updated: this.changes });
        }
    );
});


// ══════════════════════════════════════════════════════════════════════
// CASE ACTIVITIES — Activity Log
// ══════════════════════════════════════════════════════════════════════

// Get activities for a specific case
app.get('/api/activities', (req, res) => {
    const { case_id } = req.query;
    const sql = case_id
        ? 'SELECT * FROM case_activities WHERE case_id = ? ORDER BY created_at DESC'
        : 'SELECT * FROM case_activities ORDER BY created_at DESC';
    db.all(sql, case_id ? [case_id] : [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Add a new activity
app.post('/api/activities', requireAuth, (req, res) => {
    const { case_id, activity_type, description, recorded_by, is_starred } = req.body;
    const id = 'act_' + Date.now();
    db.run(
        'INSERT INTO case_activities (id, case_id, activity_type, description, recorded_by, is_starred) VALUES (?, ?, ?, ?, ?, ?)',
        [id, case_id, activity_type || 'internal_note', description, recorded_by || 'Secretary', is_starred ? 1 : 0],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id });
        }
    );
});

// Toggle star on an activity
app.patch('/api/activities/:id/star', requireAuth, (req, res) => {
    db.get('SELECT is_starred FROM case_activities WHERE id = ?', [req.params.id], (err, row) => {
        if (err || !row) return res.status(404).json({ error: 'Activity not found.' });
        const newVal = row.is_starred ? 0 : 1;
        db.run('UPDATE case_activities SET is_starred = ? WHERE id = ?', [newVal, req.params.id], function(e) {
            if (e) return res.status(500).json({ error: e.message });
            res.json({ is_starred: newVal });
        });
    });
});


// ══════════════════════════════════════════════════════════════════════
// FIRM EXPENSES
// ══════════════════════════════════════════════════════════════════════

// Get all expenses (optionally filter by case or dates)
app.get('/api/expenses', (req, res) => {
    const { case_id, start_date, end_date } = req.query;
    let sql = 'SELECT e.*, c.client_name, c.case_title FROM firm_expenses e LEFT JOIN case_tracking c ON e.case_id = c.id WHERE 1=1';
    const params = [];
    if (case_id && case_id !== 'all') {
        sql += ' AND e.case_id = ?';
        params.push(case_id);
    }
    if (start_date) {
        sql += ' AND e.created_at >= ?';
        params.push(start_date + ' 00:00:00');
    }
    if (end_date) {
        sql += ' AND e.created_at <= ?';
        params.push(end_date + ' 23:59:59');
    }
    sql += ' ORDER BY e.created_at DESC';
    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Add a new expense
app.post('/api/expenses', (req, res) => {
    const { amount, category, description, recorded_by, case_id } = req.body;
    const id = 'exp_' + Date.now();
    db.run(
        'INSERT INTO firm_expenses (id, amount, category, description, recorded_by, case_id) VALUES (?, ?, ?, ?, ?, ?)',
        [id, amount, category || 'other', description, recorded_by || 'Secretary', case_id || null],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id });
        }
    );
});

// Delete an expense entry
app.delete('/api/expenses/:id', (req, res) => {
    db.run('DELETE FROM firm_expenses WHERE id = ?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ deleted: this.changes });
    });
});


// ══════════════════════════════════════════════════════════════════════
// CONFLICT CHECK — Smart Fuzzy Search
// ══════════════════════════════════════════════════════════════════════
// Checks a query string against all client names, opposing parties, and
// phone numbers across both cases and leads. Returns matches with a
// similarity score so the frontend can highlight potential conflicts.

function levenshtein(a, b) {
    a = a.toLowerCase(); b = b.toLowerCase();
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, (_, i) => [i]);
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = a[i - 1] === b[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
        }
    }
    return dp[m][n];
}

function similarityScore(a, b) {
    if (!a || !b) return 0;
    const dist = levenshtein(a, b);
    const maxLen = Math.max(a.length, b.length);
    return Math.round((1 - dist / maxLen) * 100);
}

// Score against all tokens in target (word-level matching for name fragments)
function bestTokenScore(query, target) {
    if (!target) return 0;
    const queryTokens = query.toLowerCase().split(/\s+/);
    const targetTokens = target.toLowerCase().split(/\s+/);
    let best = 0;
    for (const qt of queryTokens) {
        for (const tt of targetTokens) {
            const s = similarityScore(qt, tt);
            if (s > best) best = s;
        }
    }
    return best;
}

app.get('/api/conflict-check', (req, res) => {
    const { q } = req.query;
    if (!q || q.trim().length < 2) return res.json([]);

    const THRESHOLD = 80; // % similarity to flag as potential conflict

    // Pull all relevant records from both tables — including id_number and kra_pin
    db.all('SELECT id, client_name, opposing_party, case_title, case_type, assigned_lawyer, tracking_token, id_number, kra_pin FROM case_tracking', [], (err, cases) => {
        if (err) return res.status(500).json({ error: err.message });

        db.all('SELECT id, full_name, opposing_party, phone, service_category, assigned_lawyer, id_number, kra_pin FROM leads', [], (err2, leads) => {
            if (err2) return res.status(500).json({ error: err2.message });

            const results = [];
            const qNorm = q.trim().toLowerCase();

            for (const c of cases) {
                const clientScore    = bestTokenScore(q, c.client_name);
                const opposingScore  = bestTokenScore(q, c.opposing_party);
                // Exact match on ID / KRA PIN always scores 100
                const idScore  = (c.id_number  && c.id_number.trim().toLowerCase()  === qNorm) ? 100 : 0;
                const kraScore = (c.kra_pin    && c.kra_pin.trim().toLowerCase()    === qNorm) ? 100 : 0;
                const score = Math.max(clientScore, opposingScore, idScore, kraScore);
                if (score >= THRESHOLD) {
                    const match_field = idScore === 100 ? 'id_number'
                        : kraScore === 100 ? 'kra_pin'
                        : clientScore >= opposingScore ? 'client_name' : 'opposing_party';
                    results.push({
                        type: 'case',
                        id: c.id,
                        token: c.tracking_token,
                        name: c.client_name,
                        opposing_party: c.opposing_party,
                        detail: c.case_title,
                        category: c.case_type,
                        lawyer: c.assigned_lawyer,
                        match_field,
                        score
                    });
                }
            }

            for (const l of leads) {
                const nameScore     = bestTokenScore(q, l.full_name);
                const opposingScore = bestTokenScore(q, l.opposing_party);
                const phoneScore    = q === l.phone ? 100 : 0;
                const idScore  = (l.id_number  && l.id_number.trim().toLowerCase()  === qNorm) ? 100 : 0;
                const kraScore = (l.kra_pin    && l.kra_pin.trim().toLowerCase()    === qNorm) ? 100 : 0;
                const score = Math.max(nameScore, opposingScore, phoneScore, idScore, kraScore);
                if (score >= THRESHOLD) {
                    const match_field = idScore === 100 ? 'id_number'
                        : kraScore === 100 ? 'kra_pin'
                        : nameScore >= opposingScore ? 'full_name' : 'opposing_party';
                    results.push({
                        type: 'lead',
                        id: l.id,
                        name: l.full_name,
                        opposing_party: l.opposing_party,
                        detail: l.service_category,
                        lawyer: l.assigned_lawyer,
                        match_field,
                        score
                    });
                }
            }

            results.sort((a, b) => b.score - a.score);
            res.json(results);
        });
    });
});


// ══════════════════════════════════════════════════════════════════════
// DOCUMENT TEMPLATES
// ══════════════════════════════════════════════════════════════════════

// Static template registry
const TEMPLATES = [
    {
        id: 'notice_of_appearance',
        title: 'Notice of Appearance',
        description: 'Filed to formally register the firm as legal representatives in a matter.',
        fields: ['client_name', 'case_title', 'case_type', 'tracking_token', 'opposing_party', 'assigned_lawyer', 'ref_no']
    },
    {
        id: 'intake_confirmation',
        title: 'Client Intake Confirmation',
        description: 'Formal acknowledgement letter sent to the client on case registration.',
        fields: ['client_name', 'case_title', 'tracking_token', 'assigned_lawyer']
    },
    {
        id: 'hearing_notice',
        title: 'Hearing Notice to Client',
        description: 'Notifies the client of an upcoming court date or mention.',
        fields: ['client_name', 'case_title', 'event_title', 'event_date', 'notes']
    }
];

app.get('/api/templates', (req, res) => {
    res.json(TEMPLATES);
});


// ══════════════════════════════════════════════════════════════════════
// WEEKLY REPORT
// ══════════════════════════════════════════════════════════════════════

// Generate a weekly activity summary grouped by lawyer
app.get('/api/weekly-report', (req, res) => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    db.all(
        `SELECT a.*, ct.client_name, ct.case_title, ct.assigned_lawyer, ct.tracking_token
         FROM case_activities a
         LEFT JOIN case_tracking ct ON a.case_id = ct.id
         WHERE a.created_at >= ?
         ORDER BY ct.assigned_lawyer, a.created_at DESC`,
        [sevenDaysAgo],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });

            // Also grab upcoming calendar events within 7 days from now
            const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
            db.all(
                `SELECT c.*, ct.client_name, ct.case_title, ct.assigned_lawyer
                 FROM court_calendar c
                 LEFT JOIN case_tracking ct ON c.case_id = ct.id
                 WHERE c.event_date BETWEEN ? AND ?
                 ORDER BY c.event_date ASC`,
                [new Date().toISOString(), sevenDaysFromNow],
                (err2, events) => {
                    if (err2) return res.status(500).json({ error: err2.message });

                    // Group activities by lawyer
                    const byLawyer = {};
                    for (const row of rows) {
                        const lawyer = row.assigned_lawyer || 'Unassigned';
                        if (!byLawyer[lawyer]) byLawyer[lawyer] = { activities: [], upcoming_events: [] };
                        byLawyer[lawyer].activities.push(row);
                    }
                    for (const ev of events) {
                        const lawyer = ev.assigned_lawyer || 'Unassigned';
                        if (!byLawyer[lawyer]) byLawyer[lawyer] = { activities: [], upcoming_events: [] };
                        byLawyer[lawyer].upcoming_events.push(ev);
                    }

                    res.json({
                        generated_at: new Date().toISOString(),
                        week_start: sevenDaysAgo,
                        week_end: sevenDaysFromNow,
                        report: byLawyer
                    });
                }
            );
        }
    );
});


// ══════════════════════════════════════════════════════════════════════
// WHATSAPP CHATBOT FLOW ENGINE & MAPPING
// ══════════════════════════════════════════════════════════════════════

// Fuzzy keyword search to handle client spelling mistakes
function matchKeyword(word, list) {
    word = word.toLowerCase();
    for (const kw of list) {
        if (word.includes(kw) || kw.includes(word)) return true;
        if (word.length >= 4) {
            const dist = levenshtein(word, kw);
            const score = 1 - dist / Math.max(word.length, kw.length);
            if (score >= 0.8) return true;
        }
    }
    return false;
}

// Intent detector using keywords and Levenshtein matches
function detectIntent(text) {
    const tokens = text.toLowerCase().split(/\s+/);
    const statusKeywords = ['status', 'track', 'check', 'progress', 'milestone', 'stage', 'phase', 'update'];
    const intakeKeywords = ['hire', 'lawyer', 'consult', 'case', 'inquiry', 'advocate', 'problem', 'issue', 'legal', 'help', 'register', 'start', 'inquire'];
    const contactKeywords = ['office', 'address', 'contact', 'map', 'hours', 'location', 'phone', 'number', 'email', 'find'];
    const handoverKeywords = ['human', 'secretary', 'lawyer', 'person', 'staff', 'speak', 'agent', 'representative', 'handover', 'talk'];
    const restartKeywords = ['restart', 'reset', 'clear'];

    for (const t of tokens) {
        if (matchKeyword(t, restartKeywords)) return 'RESTART';
        if (matchKeyword(t, handoverKeywords)) return 'HANDOVER';
        if (matchKeyword(t, statusKeywords)) return 'STATUS';
        if (matchKeyword(t, intakeKeywords)) return 'INTAKE';
        if (matchKeyword(t, contactKeywords)) return 'CONTACT';
    }
    return null;
}

// Context-aware category auto-detector
function detectCategory(text) {
    const tokens = text.toLowerCase().split(/\s+/);
    const landKeywords = ['land', 'plot', 'property', 'buy', 'sell', 'conveyance', 'title', 'deed', 'purchase', 'house', 'realestate', 'shamba'];
    const civilKeywords = ['dispute', 'sue', 'court', 'claim', 'debt', 'breach', 'contract', 'money', 'civil', 'agreement'];
    const familyKeywords = ['divorce', 'custody', 'child', 'marriage', 'separation', 'spouse', 'husband', 'wife', 'maintenance', 'succession', 'estate', 'will'];
    const criminalKeywords = ['police', 'arrest', 'bail', 'jail', 'criminal', 'prosecute', 'charge', 'offense', 'theft', 'assault'];
    const corporateKeywords = ['company', 'business', 'incorporate', 'register', 'corporate', 'partnership', 'shares', 'llc', 'firm'];

    for (const t of tokens) {
        if (matchKeyword(t, landKeywords)) return 'Conveyancing & Land';
        if (matchKeyword(t, civilKeywords)) return 'Civil Disputes';
        if (matchKeyword(t, familyKeywords)) return 'Family Law';
        if (matchKeyword(t, criminalKeywords)) return 'Criminal Defense';
        if (matchKeyword(t, corporateKeywords)) return 'Corporate Law';
    }
    return null;
}

// Generates Kenyan Advocates scale fee estimations and stamp duty
function getEstimateResponse(category, propertyValue) {
    if (category === 'Conveyancing & Land') {
        const val = parseFloat(propertyValue) || 0;
        const stampDuty = val * 0.04;
        const legalFee = Math.max(30000, val * 0.01);
        const regFee = 5000;
        const searchFee = 2500;
        const total = stampDuty + legalFee + regFee + searchFee;

        return `💰 *Estimated Transaction Costs Breakdown:*\n\n` +
          `• *Property Value:* KES ${val.toLocaleString()}\n` +
          `• *Stamp Duty (4%):* KES ${stampDuty.toLocaleString()}\n` +
          `• *Legal Fees (Scale):* KES ${legalFee.toLocaleString()}\n` +
          `• *Govt Registration Fee:* KES ${regFee.toLocaleString()}\n` +
          `• *Search & Title Verification:* KES ${searchFee.toLocaleString()}\n\n` +
          `💵 *TOTAL ESTIMATED COST:* KES ${total.toLocaleString()}\n\n` +
          `_Note: This is an administrative estimate. Official quotes are subject to final document review by an advocate._`;
    }
    
    if (category === 'Civil Disputes') {
        return `💰 *Civil Disputes Fee Estimate:*\n\n` +
          `• *Initial Retainer Fee:* KES 50,000\n` +
          `• *Court Filing & Processing:* KES 5,000\n\n` +
          `💵 *TOTAL ESTIMATED DEPOSIT:* KES 55,000\n\n` +
          `_Note: Retainers cover drafting, pleadings, and initial mentions. Hearing fees are billed per appearance._`;
    }
    
    if (category === 'Family Law') {
        return `💰 *Family Law / Succession Fee Estimate:*\n\n` +
          `• *Succession / Divorce Retainer:* KES 45,000\n` +
          `• *Filing & Gazettement:* KES 4,000\n\n` +
          `💵 *TOTAL ESTIMATED DEPOSIT:* KES 49,000\n\n` +
          `_Note: Standard packages cover name searches, filings, and uncontested hearings._`;
    }
    
    if (category === 'Criminal Defense') {
        return `💰 *Criminal Defense Representation Estimate:*\n\n` +
          `• *Urgent Station / Mention Representation:* KES 30,000\n` +
          `• *Bail Application Processing:* KES 10,000\n\n` +
          `💵 *TOTAL ESTIMATED DEPOSIT:* KES 40,000\n\n` +
          `_Note: For emergencies, contact our offices immediately. Initial deposits cover immediate intervention._`;
    }
    
    if (category === 'Corporate Law') {
        return `💰 *Corporate / Business Setup package:*\n\n` +
          `• *eCitizen Government Registry Fee:* KES 10,800\n` +
          `• *Articles of Association & Legal Facilitation:* KES 15,000\n\n` +
          `💵 *TOTAL PACKAGE PRICE:* KES 25,800\n\n` +
          `_Note: Includes certificate of incorporation, CR12 form, and tax registration guidance._`;
    }
    return '';
}

// REST endpoints to load and manage chatbot sessions from dashboard
app.get('/api/whatsapp/session', requireAuth, (req, res) => {
    const { phone } = req.query;
    if (!phone) return res.status(400).json({ error: 'Phone number required' });
    const formatted = phone.trim().replace(/\+/g, '');
    db.get('SELECT * FROM whatsapp_sessions WHERE phone_number = ? OR phone_number = ?', [formatted, '+' + formatted], (err, session) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(session || null);
    });
});

app.put('/api/whatsapp/session', requireAuth, (req, res) => {
    const { phone, current_state } = req.body;
    if (!phone || !current_state) return res.status(400).json({ error: 'Phone and state required' });
    const formatted = phone.trim().replace(/\+/g, '');
    db.run('UPDATE whatsapp_sessions SET current_state = ?, last_interaction = CURRENT_TIMESTAMP WHERE phone_number = ? OR phone_number = ?',
        [current_state, formatted, '+' + formatted], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
});

// Main session updater helper
const updateSession = (phone, updates, cb) => {
    const keys = Object.keys(updates);
    if (keys.length === 0) { if (cb) cb(); return; }
    const sets = keys.map(k => `${k} = ?`).join(', ');
    const params = keys.map(k => updates[k]);
    params.push(phone);
    db.run(`UPDATE whatsapp_sessions SET ${sets}, last_interaction = CURRENT_TIMESTAMP WHERE phone_number = ?`, params, (err) => {
        if (cb) cb(err);
    });
};

// Core Chatbot state-machine message parser
const handleWhatsAppMessage = (fromPhone, messageText, profileName, callback) => {
    const text = messageText.trim();
    const upperText = text.toUpperCase();

    db.get('SELECT * FROM whatsapp_sessions WHERE phone_number = ?', [fromPhone], (err, session) => {
        if (err) return callback("Error loading session.");

        if (!session) {
            const newSession = { phone_number: fromPhone, current_state: 'WELCOME', client_name: profileName || null };
            db.run('INSERT INTO whatsapp_sessions (phone_number, current_state, client_name) VALUES (?, ?, ?)',
                [fromPhone, 'WELCOME', newSession.client_name], () => {
                    processMessage(newSession, text, upperText, callback);
                });
        } else {
            processMessage(session, text, upperText, callback);
        }
    });
};

const processMessage = (session, text, upperText, callback) => {
    // Check if the bot is paused by the secretary
    if (session.current_state === 'HANDOVER' || session.current_state === 'PAUSED') {
        if (upperText === 'RESTART' || upperText === 'RESET') {
            updateSession(session.phone_number, { current_state: 'WELCOME' }, () => {
                callback("🔄 Chatbot re-activated.\n\n👋 Welcome to *Sam Ogola & Co Advocates*.\n\nHow can we help you today?\n\n*1* — Check Case Status\n*2* — Submit New Inquiry\n*3* — Our Office & Contact\n\nReply with a number to continue.");
            });
        } else {
            // Keep silent, secretary has manual control
            callback("You are currently connected to a staff member. Please wait for a reply, or type *RESTART* to return to the automated assistant.");
        }
        return;
    }

    const intent = detectIntent(text);

    // Global overrides
    if (intent === 'RESTART') {
        updateSession(session.phone_number, { current_state: 'WELCOME', service_category: null, property_location: null, property_value: null }, () => {
            callback("🔄 Restarting session…\n\n👋 Welcome to *Sam Ogola & Co Advocates*.\n\nHow can we help you today?\n\n*1* — Check Case Status\n*2* — Submit New Inquiry\n*3* — Our Office & Contact\n\nReply with a number to continue.");
        });
        return;
    }
    if (intent === 'HANDOVER') {
        updateSession(session.phone_number, { current_state: 'HANDOVER' }, () => {
            callback("🛎️ Handing over to secretary… A staff member will reply directly to this thread shortly.");
        });
        return;
    }
    if (intent === 'CONTACT') {
        callback("📍 *Sam Ogola & Co Advocates*\nAnniversary Towers, University Way\nNairobi, Kenya\n\n🕒 Mon–Fri: 8:00am – 5:00pm\n📞 +254 700 000 000\n📧 info@samogola.co.ke\n\nType *MENU* to return to the main menu.");
        return;
    }

    // State machine steps
    switch (session.current_state) {
        case 'WELCOME':
            if (text === '1' || intent === 'STATUS') {
                updateSession(session.phone_number, { current_state: 'AWAITING_CASE_TOKEN' }, () => {
                    callback("Please reply with your *case tracking token* (e.g. SO-AB12):");
                });
            } else if (text === '2' || intent === 'INTAKE') {
                // Check if user has already supplied a practice category in their message
                const detectedCat = detectCategory(text);
                if (detectedCat) {
                    updateSession(session.phone_number, { current_state: 'AWAITING_INQUIRY_NAME', service_category: detectedCat }, () => {
                        callback(`Great! I've logged this as a *${detectedCat}* inquiry.\n\nPlease reply with your *full name* to start:`);
                    });
                } else {
                    updateSession(session.phone_number, { current_state: 'AWAITING_INQUIRY_NAME' }, () => {
                        callback("Please reply with your *full name* to start the inquiry:");
                    });
                }
            } else if (text === '3') {
                callback("📍 *Sam Ogola & Co Advocates*\nAnniversary Towers, University Way\nNairobi, Kenya\n\n🕒 Mon–Fri: 8:00am – 5:00pm\n📞 +254 700 000 000\n📧 info@samogola.co.ke\n\nType *MENU* to return to the main menu.");
            } else {
                callback("👋 Welcome to *Sam Ogola & Co Advocates*.\n\nReply with:\n*1* — Check Case Status\n*2* — Submit New Inquiry\n*3* — Our Office & Contact");
            }
            break;

        case 'AWAITING_CASE_TOKEN':
            db.get('SELECT * FROM case_tracking WHERE UPPER(tracking_token) = ?', [upperText], (err, caseData) => {
                if (err || !caseData) {
                    callback(`❌ Case not found for *${text.toUpperCase()}*.\n\nPlease double check your token and try again, or reply *MENU* to return to the main menu.`);
                    return;
                }
                const milestones = JSON.parse(caseData.milestones_json || '["Intake","Research","Drafting","Processing","Resolution"]');
                const phaseNum = caseData.current_milestone === 'CLOSED' ? null : (parseInt(caseData.current_milestone) || 1);
                const phaseName = caseData.current_milestone === 'CLOSED' ? 'CLOSED' : milestones[phaseNum - 1] || `Phase ${phaseNum}`;
                const bars = milestones.map((_, i) => (i + 1) <= (phaseNum || milestones.length + 1) ? '█' : '░').join('');

                const reply = `⚖️ *Case Status Update*\n\n` +
                  `*Token:* ${caseData.tracking_token}\n` +
                  `*Client:* ${caseData.client_name}\n` +
                  `*Matter:* ${caseData.case_title}\n` +
                  `*Lawyer:* ${caseData.assigned_lawyer}\n\n` +
                  `📍 Currently at *Phase ${phaseNum || 'CLOSED'} of ${milestones.length}: ${phaseName}*\n\n` +
                  `Progress: ${bars}\n\n` +
                  `Type *MENU* to return to the main menu.`;

                updateSession(session.phone_number, { current_state: 'WELCOME' }, () => {
                    callback(reply, caseData);
                });
            });
            break;

        case 'AWAITING_INQUIRY_NAME':
            if (text.length < 2) {
                callback("Please enter a valid full name (minimum 2 characters):");
                return;
            }
            if (session.service_category) {
                // Category was already auto-detected! Skip categories step
                if (session.service_category === 'Conveyancing & Land') {
                    updateSession(session.phone_number, { current_state: 'AWAITING_INQUIRY_PROPERTY_LOCATION', client_name: text }, () => {
                        callback("Got it! For Conveyancing matters, where is the property located?");
                    });
                } else {
                    updateSession(session.phone_number, { current_state: 'AWAITING_INQUIRY_DETAILS', client_name: text }, () => {
                        const estimateInfo = getEstimateResponse(session.service_category);
                        callback(`${estimateInfo}\n\nPlease describe your request or issue in a few sentences to finalize:`);
                    });
                }
            } else {
                updateSession(session.phone_number, { current_state: 'AWAITING_INQUIRY_CATEGORY', client_name: text }, () => {
                    callback("Thank you! Please select a practice area by replying with the number:\n\n*1* — Conveyancing & Land\n*2* — Civil Disputes\n*3* — Family Law\n*4* — Criminal Defense\n*5* — Corporate Law");
                });
            }
            break;

        case 'AWAITING_INQUIRY_CATEGORY':
            const cats = { '1': 'Conveyancing & Land', '2': 'Civil Disputes', '3': 'Family Law', '4': 'Criminal Defense', '5': 'Corporate Law' };
            const cat = cats[text];
            if (!cat) {
                callback("Please select a valid option (1, 2, 3, 4, or 5):");
                return;
            }
            if (cat === 'Conveyancing & Land') {
                updateSession(session.phone_number, { current_state: 'AWAITING_INQUIRY_PROPERTY_LOCATION', service_category: cat }, () => {
                    callback("Where is the property located?");
                });
            } else {
                updateSession(session.phone_number, { current_state: 'AWAITING_INQUIRY_DETAILS', service_category: cat }, () => {
                    const estimateInfo = getEstimateResponse(cat);
                    callback(`${estimateInfo}\n\nPlease describe your request or issue in a few sentences to finalize:`);
                });
            }
            break;

        case 'AWAITING_INQUIRY_PROPERTY_LOCATION':
            if (text.length < 2) {
                callback("Please enter a valid property location:");
                return;
            }
            updateSession(session.phone_number, { current_state: 'AWAITING_INQUIRY_PROPERTY_VALUE', property_location: text }, () => {
                callback("What is the estimated value of the property in KES?");
            });
            break;

        case 'AWAITING_INQUIRY_PROPERTY_VALUE':
            const val = parseFloat(text.replace(/,/g, ''));
            if (isNaN(val) || val <= 0) {
                callback("Please enter a valid positive number for the property value:");
                return;
            }
            updateSession(session.phone_number, { current_state: 'AWAITING_INQUIRY_DETAILS', property_value: val }, () => {
                const estimateInfo = getEstimateResponse('Conveyancing & Land', val);
                callback(`${estimateInfo}\n\nPlease describe your request or issue in a few sentences to finalize:`);
            });
            break;

        case 'AWAITING_INQUIRY_DETAILS':
            if (text.length < 5) {
                callback("Please describe your issue in a bit more detail (minimum 5 characters):");
                return;
            }
            const crypto = require('crypto');
            const leadId = 'lead_' + crypto.randomBytes(4).toString('hex');
            const newLead = {
                id: leadId,
                full_name: session.client_name || 'WhatsApp Client',
                email: '',
                phone: session.phone_number,
                service_category: session.service_category || 'Civil Disputes',
                property_location: session.property_location || null,
                property_value: session.property_value || null,
                message: text,
                source: 'whatsapp',
                status: 'pending_review'
            };

            db.run(`INSERT INTO leads (id, full_name, email, phone, service_category, property_location, property_value, message, source, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [newLead.id, newLead.full_name, newLead.email, newLead.phone, newLead.service_category,
                 newLead.property_location, newLead.property_value, newLead.message, newLead.source, newLead.status],
                (err) => {
                    if (err) {
                        callback("Sorry, there was an error submitting your inquiry. Please try again later.");
                        return;
                    }
                    
                    // Create an activity notification in the backend
                    db.run('INSERT INTO case_activities (id, case_id, activity_type, description, recorded_by) VALUES (?, ?, ?, ?, ?)',
                        ['act_' + crypto.randomBytes(4).toString('hex'), 'general', 'internal_note', `🤖 Chatbot Lead: New inquiry registered for ${newLead.full_name} (${newLead.service_category})`, 'Chatbot Assistant']);
                    
                    updateSession(session.phone_number, {
                        current_state: 'WELCOME',
                        service_category: null,
                        property_location: null,
                        property_value: null,
                        client_name: null
                    }, () => {
                        callback(`Thank you, *${newLead.full_name}*! Your inquiry has been logged as a lead in our system.\n\nA staff member will review it and get in touch with you shortly.\n\nType *MENU* to return to the main menu.`);
                    });
                }
            );
            break;

        default:
            updateSession(session.phone_number, { current_state: 'WELCOME' }, () => {
                callback("Type *MENU* to return to the main menu.");
            });
            break;
    }
};

app.get('/webhook', (req, res) => {
    const verify_token = process.env.VERIFY_TOKEN;
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode && token && mode === 'subscribe' && token === verify_token) {
        console.log('WEBHOOK_VERIFIED');
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
});

app.post('/webhook', (req, res) => {
    let fromPhone = '';
    let messageText = '';
    let profileName = '';
    let isTwilio = false;
    let isMeta = false;

    const isJsonRequest = req.headers['content-type']?.includes('json');

    // Twilio (Must be url-encoded, not JSON)
    if (req.body.From && req.body.Body && !isJsonRequest) {
        fromPhone = req.body.From;
        messageText = req.body.Body;
        profileName = req.body.ProfileName || '';
        isTwilio = true;
    }
    // Meta
    else if (req.body.object === 'whatsapp_business_account' && req.body.entry) {
        try {
            const entry = req.body.entry[0];
            const change = entry.changes[0];
            const val = change.value;
            if (val.messages && val.messages[0]) {
                const msg = val.messages[0];
                fromPhone = msg.from;
                if (msg.type === 'text' && msg.text) {
                    messageText = msg.text.body;
                }
                if (val.contacts && val.contacts[0]) {
                    profileName = val.contacts[0].profile?.name || '';
                }
                isMeta = true;
            }
        } catch (e) {
            console.error("Error parsing Meta webhook JSON:", e);
        }
    }
    // Direct API / Simulator
    else if (req.body.From || req.body.phone) {
        fromPhone = req.body.From || req.body.phone;
        messageText = req.body.Body || req.body.message || '';
        profileName = req.body.ProfileName || req.body.name || '';
    }

    if (!fromPhone || !messageText) {
        return res.sendStatus(200);
    }

    console.log(`Chatbot message from ${fromPhone}: "${messageText}"`);

    handleWhatsAppMessage(fromPhone, messageText, profileName, (replyText, caseData) => {
        if (isTwilio) {
            res.type('text/xml');
            res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${replyText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</Message></Response>`);
        } else if (isMeta) {
            res.sendStatus(200);
        } else {
            res.json({ reply: replyText, caseData });
        }
    });
});


// ══════════════════════════════════════════════════════════════════════
// START SERVER
// ══════════════════════════════════════════════════════════════════════

app.listen(PORT, () => {
    console.log(`Legal OS Backend running on http://localhost:${PORT}`);
});
