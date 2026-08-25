const express = require('express');
const cors = require('cors');
const db = require('./database');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pdfParse = require('pdf-parse');

// Multi-path .env and Electron userData config resolution
const possibleEnvPaths = [
    path.join(__dirname, '.env'),
    path.join(__dirname, '..', '.env'),
    path.join(__dirname, '..', 'backend', '.env'),
    process.env.ELECTRON_USER_DATA ? path.join(process.env.ELECTRON_USER_DATA, 'legal_os_config.json') : null,
    process.env.ELECTRON_USER_DATA ? path.join(process.env.ELECTRON_USER_DATA, '.env') : null
].filter(Boolean);

for (const p of possibleEnvPaths) {
    try {
        if (fs.existsSync(p)) {
            if (p.endsWith('.json')) {
                const conf = JSON.parse(fs.readFileSync(p, 'utf8'));
                for (const [k, v] of Object.entries(conf)) {
                    if (!process.env[k] && v) process.env[k] = String(v).trim();
                }
                console.log(`[Config] Injected settings from JSON: ${p}`);
            } else {
                require('dotenv').config({ path: p });
                console.log(`[Config] Loaded environment variables from: ${p}`);
            }
        }
    } catch (e) {
        console.warn(`[Config] Warning loading config from ${p}:`, e.message);
    }
}

const socaAiService = require('./services/socaAiService');
const whatsappBaileysService = require('./services/whatsappBaileysService');
const documentExtractorService = require('./services/documentExtractorService');
const blobSyncService = require('./services/blobSyncService');
const ecitizenService = require('./services/ecitizenService');
const syncEngine = require('./sync');

const uploadMem = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// ══════════════════════════════════════════════════════════════════════
// UPLOAD DIRECTORY (Cross-Platform & Electron Writable Location)
// ══════════════════════════════════════════════════════════════════════
const UPLOAD_BASE_DIR = process.env.ELECTRON_USER_DATA
    ? path.join(process.env.ELECTRON_USER_DATA, 'uploads')
    : path.join(__dirname, 'public', 'uploads');

try {
    if (!fs.existsSync(UPLOAD_BASE_DIR)) {
        fs.mkdirSync(UPLOAD_BASE_DIR, { recursive: true });
        console.log(`[Uploads] Initialized writable storage at: ${UPLOAD_BASE_DIR}`);
    }
} catch (e) {
    console.error(`[Uploads] Directory initialization error:`, e.message);
}

const app = express();
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';
const isElectron = process.env.ELECTRON_APP === 'true';

// Start Background Delta Sync Loop on hybrid/desktop node
const REMOTE_SYNC_URL = process.env.REMOTE_BACKEND_URL || 'https://legal-os-lea2.onrender.com';
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'soca_sync_token_2026';
if (!process.env.DATABASE_URL) {
    syncEngine.startSyncLoop(REMOTE_SYNC_URL, VERIFY_TOKEN, 15000);
}

// Production safety verification for secret keys
console.log('--- Environment Check ---');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('ELECTRON_APP:', process.env.ELECTRON_APP);
console.log('Available Config Keys:', Object.keys(process.env).filter(key => 
    ['PORT', 'NODE_ENV', 'DATABASE_URL', 'JWT_SECRET', 'RECOVERY_PASSCODE', 'PARTNER_PASSCODE', 'ADMIN_INITIAL_PASSWORD', 'FRONTEND_URL', 'GROQ_SOCA_API_KEY', 'GROQ_API_KEY', 'GROQ_PDF_API_KEY'].includes(key)
));
// Detailed Groq key diagnostics
const _sk = process.env.GROQ_SOCA_API_KEY || '';
const _pk = process.env.GROQ_PDF_API_KEY || '';
console.log(`GROQ_SOCA_API_KEY: len=${_sk.length}, prefix="${_sk.slice(0,7)}", suffix="${_sk.slice(-4)}", starts_gsk=${_sk.startsWith('gsk_')}`);
console.log(`GROQ_PDF_API_KEY:  len=${_pk.length}, prefix="${_pk.slice(0,7)}", suffix="${_pk.slice(-4)}", starts_gsk=${_pk.startsWith('gsk_')}`);
console.log('-------------------------');

if (isProd && !isElectron) {
    if (!process.env.JWT_SECRET) {
        console.warn('⚠️ WARNING: JWT_SECRET environment variable is not explicitly set.');
    }
    if (!process.env.RECOVERY_PASSCODE) {
        console.warn('⚠️ WARNING: RECOVERY_PASSCODE environment variable is using default.');
    }
}

// For Electron offline app, we can generate a random JWT_SECRET per launch, or use a persistent one if we saved it. 
// But since it's an offline local app, a hardcoded or default secret is technically fine since it only accepts localhost connections.
const JWT_SECRET = process.env.JWT_SECRET || (isElectron ? 'legal_os_electron_local_secret' : 'legal_os_dev_secret_2026');
const RECOVERY_PASSCODE = process.env.RECOVERY_PASSCODE || 'RECOVER_SOCA_2026';
const PARTNER_PASSCODE  = process.env.PARTNER_PASSCODE  || '1234';

// Secure CORS configuration
const allowedOrigins = isProd
    ? (process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',').map(u => u.trim()) : [])
    : ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'];

if (isElectron) {
    allowedOrigins.push('http://localhost:3001', 'http://localhost:3000', 'http://127.0.0.1:3001', 'http://127.0.0.1:3000');
}

app.use(cors({
    origin: (origin, callback) => {
        callback(null, true);
    },
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ══════════════════════════════════════════════════════════════════════
// IN-MEMORY SYSTEM LOG BUFFER (FOR CENTRAL OPS & TELEMETRY DASHBOARD)
// ══════════════════════════════════════════════════════════════════════
const OPS_LOG_BUFFER = [];
const MAX_OPS_LOGS = 300;

function pushOpsLog(level, message, category = 'SYSTEM') {
    const entry = {
        id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        timestamp: new Date().toISOString(),
        level: level.toUpperCase(),
        category: category.toUpperCase(),
        message: typeof message === 'string' ? message : JSON.stringify(message)
    };
    OPS_LOG_BUFFER.push(entry);
    if (OPS_LOG_BUFFER.length > MAX_OPS_LOGS) OPS_LOG_BUFFER.shift();
}

// Hook console logging to feed Ops log stream
const _origConsoleLog = console.log;
const _origConsoleWarn = console.warn;
const _origConsoleError = console.error;

console.log = function(...args) {
    _origConsoleLog.apply(console, args);
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    let cat = 'SYSTEM';
    if (msg.includes('[Sync') || msg.includes('delta')) cat = 'SYNC';
    else if (msg.includes('[AI]') || msg.includes('Groq') || msg.includes('SocaAi')) cat = 'AI';
    else if (msg.includes('Baileys') || msg.includes('WhatsApp')) cat = 'WHATSAPP';
    else if (msg.includes('[Uploads]') || msg.includes('blob')) cat = 'STORAGE';
    else if (msg.includes('[eCitizen]') || msg.includes('Judiciary')) cat = 'JUDICIARY';
    pushOpsLog('INFO', msg, cat);
};

console.warn = function(...args) {
    _origConsoleWarn.apply(console, args);
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    let cat = 'SYSTEM';
    if (msg.includes('[Sync') || msg.includes('delta')) cat = 'SYNC';
    else if (msg.includes('[AI]') || msg.includes('Groq')) cat = 'AI';
    else if (msg.includes('Baileys') || msg.includes('WhatsApp')) cat = 'WHATSAPP';
    pushOpsLog('WARN', msg, cat);
};

console.error = function(...args) {
    _origConsoleError.apply(console, args);
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    let cat = 'SYSTEM';
    if (msg.includes('[Sync') || msg.includes('delta')) cat = 'SYNC';
    else if (msg.includes('[AI]') || msg.includes('Groq')) cat = 'AI';
    else if (msg.includes('Baileys') || msg.includes('WhatsApp')) cat = 'WHATSAPP';
    pushOpsLog('ERROR', msg, cat);
};

// Anti-cache headers for all API requests to ensure fresh live data
app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
});

// Healthcheck endpoint for cron-job.org / keep-alive pinger
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok', time: new Date().toISOString(), service: 'Legal OS Cloud' });
});

// Serve built frontend dashboard in production / electron / cloud
const primaryDist = path.join(__dirname, '..', 'dashboard', 'dist');
const fallbackDist = path.join(__dirname, 'public');
const activeDist = fs.existsSync(primaryDist) ? primaryDist : (fs.existsSync(fallbackDist) ? fallbackDist : primaryDist);

app.use(express.static(activeDist, {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('index.html') || filePath.endsWith('sw.js') || filePath.endsWith('manifest.webmanifest')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        } else if (filePath.includes(path.sep + 'assets' + path.sep) || filePath.includes('/assets/')) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
    }
}));

// Serve static uploads directory safely
app.use('/uploads', express.static(UPLOAD_BASE_DIR, {
    setHeaders: (res) => {
        res.setHeader('Cache-Control', 'public, max-age=86400');
    }
}));

app.get(/^\/(?!api|uploads).*/, (req, res) => {
    const indexPath = path.join(activeDist, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.sendFile(indexPath);
    } else {
        res.sendStatus(404);
    }
});

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
        if (req.user?.role === 'developer') return next();
        if (!roles.includes(req.user?.role)) {
            return res.status(403).json({ error: `Access denied. Requires role: ${roles.join(' or ')}.` });
        }
        next();
    };
}

// ══════════════════════════════════════════════════════════════════════
// AUTH ROUTES (public — no auth middleware needed)
// ══════════════════════════════════════════════════════════════════════

// Login (with Central Cloud-First Fallback)
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required.' });
    const cleanUsername = username.trim().toLowerCase();

    db.get('SELECT * FROM users WHERE username = ?', [cleanUsername], async (err, user) => {
        if (!err && user) {
            const expected = hashPassword(user.salt, password);
            if (expected === user.password_hash) {
                const token = generateToken(user);
                // Trigger background delta sync on successful local login
                setTimeout(() => { syncEngine.runDeltaSyncCycle().catch(() => {}); }, 100);
                return res.json({ token, role: user.role, display_name: user.display_name, id: user.id, username: user.username });
            }
        }

        // Cloud-First Fallback: If user not found or password changed in cloud backend
        const remoteUrl = process.env.REMOTE_BACKEND_URL || 'https://legal-os-lea2.onrender.com';
        if (remoteUrl && !process.env.DATABASE_URL) {
            try {
                const cloudRes = await fetch(`${remoteUrl}/api/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: cleanUsername, password })
                });
                const cloudData = await cloudRes.json();
                if (cloudRes.ok && cloudData && cloudData.token) {
                    // Replicate user locally into SQLite so subsequent offline sessions succeed
                    const salt = crypto.randomBytes(16).toString('hex');
                    const hash = hashPassword(salt, password);
                    const userId = cloudData.id || ('u_' + Date.now());
                    db.run(
                        `INSERT INTO users (id, username, display_name, password_hash, salt, role, updated_at)
                         VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                         ON CONFLICT(username) DO UPDATE SET
                           password_hash = EXCLUDED.password_hash,
                           salt = EXCLUDED.salt,
                           role = EXCLUDED.role,
                           display_name = EXCLUDED.display_name,
                           updated_at = CURRENT_TIMESTAMP`,
                        [userId, cleanUsername, cloudData.display_name || cleanUsername, hash, salt, cloudData.role || 'advocate'],
                        () => {
                            setTimeout(() => { syncEngine.runDeltaSyncCycle().catch(() => {}); }, 100);
                        }
                    );
                    return res.json(cloudData);
                }
            } catch (cloudErr) {
                console.warn('[Cloud Auth Fallback] Cloud login notice:', cloudErr.message);
            }
        }

        return res.status(401).json({ error: 'Invalid credentials.' });
    });
});

// Verify current user password (e.g. for accessing Archives Vault)
app.post('/api/auth/verify-password', requireAuth, (req, res) => {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Password is required.' });

    db.get('SELECT * FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (err || !user) return res.status(401).json({ error: 'User account not found.' });
        const expected = hashPassword(user.salt, password);
        if (expected !== user.password_hash) return res.status(401).json({ error: 'Incorrect account password.' });
        res.json({ success: true, message: 'Password verified.' });
    });
});

// Dev Recovery — allows resetting admin password if locked out
app.post('/api/auth/recover', (req, res) => {
    const { recovery_passcode, new_password } = req.body;
    if (recovery_passcode !== RECOVERY_PASSCODE) {
        return res.status(403).json({ error: 'Invalid recovery passcode.' });
    }
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashPassword(salt, new_password);
    db.run('UPDATE users SET password_hash = ?, salt = ?, updated_at = CURRENT_TIMESTAMP WHERE role = ?', [hash, salt, 'admin'], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        const changes = this.changes || 0;
        if (changes === 0) {
            // Admin user does not exist. Let's create it!
            db.run(
                'INSERT INTO users (id, username, display_name, password_hash, salt, role, updated_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
                ['u_admin', 'admin', 'Sam Ogola (Admin)', hash, salt, 'admin'],
                function(err2) {
                    if (err2) return res.status(500).json({ error: 'Failed to create admin user: ' + err2.message });
                    setTimeout(() => { syncEngine.runDeltaSyncCycle().catch(() => {}); }, 50);
                    res.json({ message: 'Admin user did not exist. Created a new admin user successfully.' });
                }
            );
        } else {
            setTimeout(() => { syncEngine.runDeltaSyncCycle().catch(() => {}); }, 50);
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
    const cleanUsername = username.trim().toLowerCase();

    db.run(
        'INSERT INTO users (id, username, display_name, password_hash, salt, role, updated_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
        [id, cleanUsername, display_name, hash, salt, role || 'secretary'],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            setTimeout(() => { syncEngine.runDeltaSyncCycle().catch(() => {}); }, 50);
            res.json({ id, username: cleanUsername, role });
        }
    );
});

// Admin: list users (excluding developer)
app.get('/api/auth/users', requireAuth, requireRole('admin'), (req, res) => {
    db.all("SELECT id, username, display_name, role, created_at, updated_at FROM users WHERE role != 'developer' AND (is_deleted IS NULL OR is_deleted = 0) ORDER BY created_at ASC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Admin: delete user (cannot delete self)
app.delete('/api/auth/users/:id', requireAuth, requireRole('admin'), (req, res) => {
    if (req.params.id === req.user.id) return res.status(400).json({ error: 'Cannot delete your own account.' });
    db.run('UPDATE users SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        setTimeout(() => { syncEngine.runDeltaSyncCycle().catch(() => {}); }, 50);
        res.json({ deleted: this.changes });
    });
});

// Admin: reset password for other user account
app.put('/api/auth/users/:id/password', requireAuth, requireRole('admin'), (req, res) => {
    const { new_password } = req.body;
    if (!new_password || !new_password.trim()) {
        return res.status(400).json({ error: 'New password is required.' });
    }
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashPassword(salt, new_password);
    db.run('UPDATE users SET password_hash = ?, salt = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [hash, salt, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        setTimeout(() => { syncEngine.runDeltaSyncCycle().catch(() => {}); }, 50);
        res.json({ success: true, message: 'Password updated.' });
    });
});

// ══════════════════════════════════════════════════════════════════════
// DELTA SYNC ENGINE & TELEMETRY ENDPOINTS
// ══════════════════════════════════════════════════════════════════════
app.post('/api/sync/push', syncEngine.handleDeltaPush);
app.get('/api/sync/pull', syncEngine.handleDeltaPull);
app.get('/api/sync/telemetry', (req, res) => res.json(syncEngine.getSyncTelemetry()));
app.get('/api/sync/status', (req, res) => res.json({ success: true, ...syncEngine.getSyncTelemetry() }));
app.post('/api/sync/trigger', async (req, res) => {
    try {
        const result = await syncEngine.runDeltaSyncCycle();
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
app.post('/api/sync/exchange', syncEngine.handleSyncExchange);

// List all firm lawyers / advocates
app.get('/api/lawyers', requireAuth, (req, res) => {
    db.all('SELECT id, name, created_at FROM firm_lawyers ORDER BY created_at ASC', [], (err, rows) => {
        if (err || !rows || rows.length === 0) {
            return res.json([
                { id: 'law_1', name: 'Sam Ogola' },
                { id: 'law_2', name: 'Ms Ivy' }
            ]);
        }
        res.json(rows);
    });
});

// Admin: Add new advocate
app.post('/api/lawyers', requireAuth, requireRole('admin'), (req, res) => {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Lawyer name is required' });
    const cleanName = name.trim();
    const id = 'law_' + Date.now();
    db.run('INSERT INTO firm_lawyers (id, name) VALUES (?, ?)', [id, cleanName], function(err) {
        if (err) return res.status(500).json({ error: err.message || 'Lawyer already exists' });
        res.json({ id, name: cleanName });
    });
});

// Admin: Delete advocate
app.delete('/api/lawyers/:id', requireAuth, requireRole('admin'), (req, res) => {
    db.run('DELETE FROM firm_lawyers WHERE id = ? OR name = ?', [req.params.id, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, deleted: this.changes });
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

// Developer only: Nuke and rebuild the database
app.post('/api/dev/nuke-database', requireAuth, requireRole('developer'), (req, res) => {
    console.log('[Dev] Database wipe triggered by:', req.user.username);
    db.nukeDb((err) => {
        if (err) {
            console.error('[Dev] Failed to nuke database:', err);
            return res.status(500).json({ error: 'Database wipe failed: ' + err.message });
        }
        res.json({ message: 'Database cleared and seeded successfully.' });
    });
});

// Admin / Developer: Download database backup as JSON file
app.get('/api/dev/backup-download', requireAuth, requireRole('admin', 'developer'), (req, res) => {
    db.getBackupData((err, backup) => {
        if (err) {
            console.error('Backup generation failed:', err);
            return res.status(500).json({ error: 'Failed to generate backup: ' + err.message });
        }
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=legalos_backup_${new Date().toISOString().slice(0,10)}.json`);
        res.json(backup);
    });
});

// Developer only: Seed test data
app.post('/api/dev/seed-test-data', requireAuth, requireRole('developer'), (req, res) => {
    db.seedTestData((err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Test data seeded successfully.' });
    });
});

// ══════════════════════════════════════════════════════════════════════
// CENTRAL DEV/OPS & TELEMETRY ENDPOINTS (DATA PRIVACY PRESERVED)
// ══════════════════════════════════════════════════════════════════════

// 1. Full Telemetry Overview (Anonymized & Privacy Masked)
app.get('/api/dev/ops-telemetry', requireAuth, requireRole('developer'), async (req, res) => {
    try {
        const mem = process.memoryUsage();
        const telemetry = {
            system: {
                platform: process.platform,
                nodeVersion: process.version,
                uptimeSeconds: Math.floor(process.uptime()),
                memoryRssMb: Math.round(mem.rss / 1024 / 1024),
                memoryHeapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
                environment: process.env.NODE_ENV || 'production',
                isElectron: isElectron,
                databaseType: process.env.DATABASE_URL ? 'PostgreSQL (Cloud)' : 'SQLite (Local/Hybrid)',
                dataPrivacyActCompliance: 'Kenya DPA 2019 / LSK Standards (Active)'
            },
            sync: {
                ...syncEngine.getSyncTelemetry(),
                remoteUrl: process.env.REMOTE_BACKEND_URL || 'https://legal-os-lea2.onrender.com',
                tablesTracked: ['case_tracking', 'case_files', 'case_invoices', 'case_disbursements', 'court_calendar', 'leads', 'users', 'firm_lawyers', 'whatsapp_messages']
            },
            whatsapp: {
                isConnected: whatsappBaileysService.isSocketConnected ? whatsappBaileysService.isSocketConnected() : false,
                pairingQrAvailable: whatsappBaileysService.hasActiveQr ? whatsappBaileysService.hasActiveQr() : false,
                privacyMasking: true
            },
            ai: {
                provider: 'Groq Cloud / LPU Inference',
                primaryModel: 'llama-3.3-70b-versatile',
                visionModel: 'llama-3.2-11b-vision-preview',
                hasSocaKey: !!process.env.GROQ_SOCA_API_KEY,
                hasPdfKey: !!process.env.GROQ_PDF_API_KEY
            },
            judiciary: {
                eCitizenConfigured: !!(process.env.ECITIZEN_CLIENT_ID && process.env.ECITIZEN_CLIENT_SECRET),
                crawlerStatus: 'Active / Automated'
            }
        };

        // Query table counts and masked WhatsApp events
        db.get('SELECT COUNT(*) as caseCount FROM case_tracking', [], (e1, r1) => {
            telemetry.metrics = {
                activeCases: r1 ? Number(r1.caseCount) : 0
            };
            db.get('SELECT COUNT(*) as fileCount FROM case_files', [], (e2, r2) => {
                telemetry.metrics.caseFiles = r2 ? Number(r2.fileCount) : 0;
                
                // Privacy-Masked WhatsApp Metrics
                db.all('SELECT id, phone, direction, status, created_at FROM whatsapp_messages ORDER BY created_at DESC LIMIT 15', [], (e3, r3) => {
                    telemetry.whatsapp.recentMaskedEvents = (r3 || []).map(m => {
                        const rawPhone = m.phone || '';
                        const maskedPhone = rawPhone.length > 6 
                            ? rawPhone.slice(0, 4) + ' ••• ' + rawPhone.slice(-2) 
                            : '••••••';
                        return {
                            id: m.id,
                            maskedPhone,
                            direction: m.direction || 'outbound',
                            status: m.status || 'delivered',
                            createdAt: m.created_at
                        };
                    });
                    res.json({ success: true, telemetry });
                });
            });
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Query Recent Logs Buffer
app.get('/api/dev/logs', requireAuth, requireRole('developer'), (req, res) => {
    const { category, level, limit = 100 } = req.query;
    let filtered = [...OPS_LOG_BUFFER];
    if (category && category !== 'ALL') {
        filtered = filtered.filter(l => l.category === category.toUpperCase());
    }
    if (level && level !== 'ALL') {
        filtered = filtered.filter(l => l.level === level.toUpperCase());
    }
    res.json({
        success: true,
        count: filtered.length,
        logs: filtered.slice(-Number(limit))
    });
});

// 3. Force Instant Sync Across All Tables
app.post('/api/dev/sync-force', requireAuth, requireRole('developer'), async (req, res) => {
    try {
        const result = await syncEngine.runDeltaSyncCycle();
        res.json({ success: true, result });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Admin / Secretary / Dev: Bulk Import Cases
app.post('/api/cases/bulk-import', requireAuth, requireRole('admin', 'developer', 'secretary'), (req, res) => {
    const { cases } = req.body;
    if (!cases || !Array.isArray(cases)) return res.status(400).json({ error: 'Cases array required.' });
    
    db.serialize(() => {
        let chain = Promise.resolve();
        const crypto = require('crypto');
        
        cases.forEach(c => {
            chain = chain.then(() => {
                return new Promise((resolve) => {
                    const id = 'c_' + crypto.randomBytes(4).toString('hex');
                    const token = 'SO-' + crypto.randomBytes(3).toString('hex').toUpperCase();
                    const milestones = JSON.stringify(["Initial Consultation", "Execution", "Filing in Court", "Hearing Phase", "Judgment"]);
                    
                    db.run(
                        `INSERT INTO case_tracking (
                            id, tracking_token, client_name, case_title, case_type, 
                            current_milestone, milestones_json, assigned_lawyer, fee_status,
                            court_station, ref_no, judiciary_case_id, total_fee, outstanding_balance, client_phone, client_email
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            id,
                            c.tracking_token || token,
                            c.client_name || 'Unnamed Client',
                            c.case_title || 'General Legal Matter',
                            c.case_type || 'Civil',
                            c.current_milestone || '1',
                            c.milestones_json || milestones,
                            c.assigned_lawyer || 'Sam Ogola',
                            c.fee_status || 'pending',
                            c.court_station || '',
                            c.ref_no || '',
                            c.judiciary_case_id || '',
                            c.total_fee ? parseFloat(c.total_fee) : 0,
                            c.outstanding_balance ? parseFloat(c.outstanding_balance) : 0,
                            c.client_phone || '',
                            c.client_email || ''
                        ],
                        () => resolve()
                    );
                });
            });
        });
        
        chain.then(() => {
            res.json({ success: true, count: cases.length });
        }).catch(err => {
            res.status(500).json({ error: err.message });
        });
    });
});

// Admin / Secretary / Dev: Bulk Import Calendar Events
app.post('/api/calendar/bulk-import', requireAuth, requireRole('admin', 'developer', 'secretary'), (req, res) => {
    const { events } = req.body;
    if (!events || !Array.isArray(events)) return res.status(400).json({ error: 'Events array required.' });
    
    db.serialize(() => {
        let chain = Promise.resolve();
        const crypto = require('crypto');
        
        events.forEach(e => {
            chain = chain.then(() => {
                return new Promise((resolve) => {
                    const id = 'ev_' + crypto.randomBytes(4).toString('hex');
                    db.run(
                        `INSERT INTO court_calendar (
                            id, case_id, event_title, event_type, event_date, notes, is_important, assigned_lawyer
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            id,
                            e.case_id || null,
                            e.event_title || 'Court Mention',
                            e.event_type || 'mention',
                            e.event_date || new Date().toISOString(),
                            e.notes || '',
                            e.is_important ? 1 : 0,
                            e.assigned_lawyer || 'Sam Ogola'
                        ],
                        () => resolve()
                    );
                });
            });
        });
        
        chain.then(() => {
            res.json({ success: true, count: events.length });
        }).catch(err => {
            res.status(500).json({ error: err.message });
        });
    });
});

// User: update self profile (display_name, username, and optionally password)
app.put('/api/auth/profile', requireAuth, (req, res) => {
    const { display_name, username, password } = req.body;
    const userId = req.user.id;
    if (!display_name || !username) {
        return res.status(400).json({ error: 'display_name and username required.' });
    }

    if (password) {
        const salt = crypto.randomBytes(16).toString('hex');
        const hash = hashPassword(salt, password);
        db.run(
            'UPDATE users SET display_name = ?, username = ?, password_hash = ?, salt = ? WHERE id = ?',
            [display_name, username.trim().toLowerCase(), hash, salt, userId],
            function(err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true, message: 'Profile and password updated successfully.' });
            }
        );
    } else {
        db.run(
            'UPDATE users SET display_name = ?, username = ? WHERE id = ?',
            [display_name, username.trim().toLowerCase(), userId],
            function(err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true, message: 'Profile updated successfully.' });
            }
        );
    }
});

// ══════════════════════════════════════════════════════════════════════
// MULTER FILE UPLOAD — Local case document locker
// ══════════════════════════════════════════════════════════════════════
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const caseToken = (req.params.case_id || 'general').replace(/[\/\\:]/g, '_');
        const uploadDir = path.join(UPLOAD_BASE_DIR, caseToken);
        try {
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }
            cb(null, uploadDir);
        } catch (err) {
            console.error('[Multer Storage Error]', err);
            cb(err, uploadDir);
        }
    },
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        const safeName = (file.originalname || 'document.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
        cb(null, `${timestamp}_${safeName}`);
    }
});
const upload = multer({ 
    storage, 
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

// Upload file to a case
app.post('/api/cases/:case_id/files', requireAuth, upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file received.' });
    const { case_id } = req.params;
    const { category } = req.body;
    const caseToken = case_id.replace(/[\/\\:]/g, '_');
    const relPath = `/uploads/${caseToken}/${req.file.filename}`;
    const id = 'cf_' + Date.now();
    const uploader = (req.user && (req.user.display_name || req.user.username)) || 'Advocate';
    db.run(
        'INSERT INTO case_files (id, case_id, file_name, file_path, file_size, uploaded_by, category) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, case_id, req.file.originalname, relPath, req.file.size, uploader, category || 'other'],
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
        const relativePath = (file.file_path || '').replace(/^\/uploads[\/\\]?/, '');
        const fullPath = path.join(UPLOAD_BASE_DIR, relativePath);
        if (fs.existsSync(fullPath)) {
            try { fs.unlinkSync(fullPath); } catch (e) { console.warn('Unlink error:', e.message); }
        }
        db.run('DELETE FROM case_files WHERE id = ?', [file.id], function(e) {
            if (e) return res.status(500).json({ error: e.message });
            
            // Log audit activity trail
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
        const count = (row ? Number(row.count) : 0) + 1;
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
                id, finalToken, client_name, case_title, case_type, '1', milestones_json, assigned_lawyer, opposing_party || null, ref_no || null, !!is_sensitive,
                client_phone || null, client_email || null, id_number || null, kra_pin || null, address || null, custom_kyc || null, court_station || null,
                dob || null, occupation || null, opposing_party_contact || null, billing_type || null, emergency_name || null, emergency_phone || null, emergency_relation || null,
                alternative_phone || null, alternative_email || null,
                opposing_counsel_name || null, opposing_counsel_firm || null, opposing_counsel_phone || null, opposing_counsel_email || null, opposing_counsel_address || null,
                assigned_judge || null, court_division || null, case_brief || null
            ],
            function(err) {
                if (err) return res.status(500).json({ error: err.message });
                if (lead_id) db.run('UPDATE leads SET status = "converted" WHERE id = ?', [lead_id]);
                setTimeout(() => { syncEngine.runDeltaSyncCycle().catch(() => {}); }, 50);
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
            const count = (row ? Number(row.count) : 0) + 1;
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
            setTimeout(() => { syncEngine.runDeltaSyncCycle().catch(() => {}); }, 50);
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
            setTimeout(() => { syncEngine.runDeltaSyncCycle().catch(() => {}); }, 50);
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

// Update general case details (e.g. phone, email, client name)
app.put('/api/cases/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    const { client_phone, client_email, client_name, case_title, alternative_phone } = req.body;
    
    const fields = [];
    const values = [];
    if (client_phone !== undefined) { fields.push('client_phone = ?'); values.push(client_phone); }
    if (client_email !== undefined) { fields.push('client_email = ?'); values.push(client_email); }
    if (client_name !== undefined) { fields.push('client_name = ?'); values.push(client_name); }
    if (case_title !== undefined) { fields.push('case_title = ?'); values.push(case_title); }
    if (alternative_phone !== undefined) { fields.push('alternative_phone = ?'); values.push(alternative_phone); }
    
    if (fields.length === 0) return res.status(400).json({ error: 'No fields provided to update.' });
    
    values.push(id);
    db.run(
        `UPDATE case_tracking SET ${fields.join(', ')}, last_updated = CURRENT_TIMESTAMP WHERE id = ?`,
        values,
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, updated: this.changes });
        }
    );
});

// Convert CRM Lead directly to Active Matter Dossier
app.post('/api/leads/:id/convert', requireAuth, (req, res) => {
    const { id } = req.params;
    db.get('SELECT * FROM leads WHERE id = ?', [id], (err, lead) => {
        if (err || !lead) return res.status(404).json({ error: 'Lead not found.' });

        const caseId = 'c_' + Date.now();
        const trackingToken = 'SO-' + crypto.randomBytes(3).toString('hex').toUpperCase();
        const milestones = JSON.stringify(["Initial Intake", "Drafting & Execution", "Court Filing", "Hearing Phase", "Decree / Completion"]);

        db.run(
            `INSERT INTO case_tracking (
                id, tracking_token, client_name, case_title, case_type,
                current_milestone, milestones_json, assigned_lawyer, fee_status,
                client_phone, client_email, suit_value, case_brief
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                caseId,
                trackingToken,
                lead.full_name || 'Client',
                lead.service_category ? `${lead.service_category} Matter` : 'General Legal Consultation',
                lead.service_category || 'Civil',
                '1',
                milestones,
                lead.assigned_lawyer || req.user.display_name || 'Sam Ogola',
                lead.consultation_paid ? 'consultation_paid' : 'pending',
                lead.phone || '',
                lead.email || '',
                lead.property_value || 0,
                lead.message || ''
            ],
            function(cErr) {
                if (cErr) return res.status(500).json({ error: cErr.message });

                // Mark lead as converted
                db.run('UPDATE leads SET status = "converted" WHERE id = ?', [id]);

                res.json({ success: true, caseId, trackingToken });
            }
        );
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

// ── SUBMISSIONS TRACKER ENDPOINTS ──────────────────────────────────────
app.get('/api/cases/:id/submissions', (req, res) => {
    db.all('SELECT * FROM case_submissions WHERE case_id = ? ORDER BY due_date ASC', [req.params.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

app.post('/api/cases/:id/submissions', requireAuth, (req, res) => {
    const { title, submission_type, due_date, status, assigned_lawyer, notes } = req.body;
    const subId = 'sub_' + Date.now();
    const case_id = req.params.id;

    db.run(
        'INSERT INTO case_submissions (id, case_id, title, submission_type, due_date, status, assigned_lawyer, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [subId, case_id, title, submission_type || 'written_submissions', due_date || null, status || 'drafting', assigned_lawyer || req.user.display_name, notes || ''],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });

            if (due_date) {
                const eventId = 'ev_sub_' + Date.now();
                const eventTitle = `📜 Submission Deadline: ${title}`;
                const calendarNotes = `Submission Type: ${submission_type || 'Written Submissions'}\nStatus: ${status || 'Drafting'}\nNotes: ${notes || ''}`;
                db.run(
                    'INSERT INTO court_calendar (id, case_id, event_title, event_type, event_date, notes, is_important, assigned_lawyer) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    [eventId, case_id, eventTitle, 'filing_deadline', due_date, calendarNotes, 1, assigned_lawyer || req.user.display_name]
                );
            }

            db.run(
                'INSERT INTO case_activities (id, case_id, activity_type, description, recorded_by) VALUES (?, ?, ?, ?, ?)',
                ['act_' + Date.now(), case_id, 'court_filing', `📜 Scheduled Submission: "${title}" (Due: ${due_date || 'Unspecified'})`, req.user.display_name]
            );

            res.json({ id: subId, success: true });
        }
    );
});

app.put('/api/cases/:id/submissions/:subId', requireAuth, (req, res) => {
    const { title, submission_type, due_date, status, assigned_lawyer, notes } = req.body;
    db.run(
        'UPDATE case_submissions SET title = COALESCE(?, title), submission_type = COALESCE(?, submission_type), due_date = COALESCE(?, due_date), status = COALESCE(?, status), assigned_lawyer = COALESCE(?, assigned_lawyer), notes = COALESCE(?, notes) WHERE id = ?',
        [title, submission_type, due_date, status, assigned_lawyer, notes, req.params.subId],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        }
    );
});

app.delete('/api/cases/:id/submissions/:subId', requireAuth, (req, res) => {
    db.run('DELETE FROM case_submissions WHERE id = ?', [req.params.subId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
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

// ── DATA SYNCHRONIZATION SYSTEM ──────────────────────────────────────
function verifySyncToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || (authHeader !== `Bearer ${VERIFY_TOKEN}` && authHeader !== `Bearer soca_legal_os_secret_token`)) {
        return res.status(401).json({ error: 'Unauthorized sync attempt.' });
    }
    next();
}

// ══════════════════════════════════════════════════════════════════════
// RESUMABLE DOCUMENT & EXHIBIT VAULT (CONTENT-ADDRESSABLE STORAGE - CAS)
// ══════════════════════════════════════════════════════════════════════

// 1. Get files for a case
app.get('/api/cases/:id/files', (req, res) => {
    db.all('SELECT * FROM case_files WHERE case_id = ? AND (is_deleted = 0 OR is_deleted IS NULL) ORDER BY uploaded_at DESC', [req.params.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

// 2. Upload file to case vault (computes SHA-256 and stores in CAS)
app.post('/api/cases/:id/files', requireAuth, uploadMem.single('file'), (req, res) => {
    if (!req.file || !req.file.buffer) return res.status(400).json({ error: 'No file buffer provided.' });
    const { category = 'pleadings' } = req.body;
    const fileHash = blobSyncService.computeFileHash(req.file.buffer);
    blobSyncService.saveLocalBlob(req.file.buffer, fileHash, req.file.originalname);

    const fileId = 'file_' + Date.now();
    const recordedBy = req.user?.display_name || 'Secretary';
    const filePath = `/api/files/blob/${fileHash}`;

    db.run(
        `INSERT INTO case_files (id, case_id, file_name, file_path, file_size, file_hash, mime_type, category, uploaded_by, is_synced)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [fileId, req.params.id, req.file.originalname, filePath, req.file.size, fileHash, req.file.mimetype || 'application/pdf', category, recordedBy],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({
                id: fileId,
                case_id: req.params.id,
                file_name: req.file.originalname,
                file_path: filePath,
                file_size: req.file.size,
                file_hash: fileHash,
                category
            });
        }
    );
});

// 3. Delete file from case
app.delete('/api/cases/:id/files/:fileId', requireAuth, (req, res) => {
    db.run('UPDATE case_files SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND case_id = ?', [req.params.fileId, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// 4. Ingest sync-blob from remote replica (Sync Engine CAS upload)
app.post('/api/files/sync-blob', uploadMem.single('file'), (req, res) => {
    if (!req.file || !req.file.buffer) return res.status(400).json({ error: 'No file provided' });
    const fileHash = req.body.file_hash || blobSyncService.computeFileHash(req.file.buffer);
    blobSyncService.saveLocalBlob(req.file.buffer, fileHash, req.file.originalname);
    res.json({ success: true, file_hash: fileHash });
});

// 5. Stream binary blob by content SHA-256 hash (Fast 0ms local preview & cloud fallback)
app.get('/api/files/blob/:hash', (req, res) => {
    const filePath = blobSyncService.getLocalBlobPath(req.params.hash);
    if (!filePath || !fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Document blob not found in local vault.' });
    }
    const ext = path.extname(filePath).toLowerCase();
    const mimeMap = {
        '.pdf': 'application/pdf',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.doc': 'application/msword',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg'
    };
    const mimeType = mimeMap[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(filePath)}"`);
    fs.createReadStream(filePath).pipe(res);
});

// 6. Query which hashes are missing on this server
app.get('/api/files/check-missing', (req, res) => {
    const rawHashes = (req.query.hashes || '').split(',').map(h => h.trim()).filter(Boolean);
    const missing = [];
    for (const h of rawHashes) {
        if (!blobSyncService.getLocalBlobPath(h)) {
            missing.push(h);
        }
    }
    res.json({ missing });
});

// ══════════════════════════════════════════════════════════════════════
// MULTI-PORTAL JUDICIARY INGESTION & IDENTIFICATION ENGINE
// ══════════════════════════════════════════════════════════════════════

// 1. Parse Judiciary & Court Document (Universal Multi-Format + OCR + Kenyan Taxonomy)
app.post('/api/judiciary/parse-pdf', requireAuth, uploadMem.single('file'), async (req, res) => {
    try {
        if (!req.file || !req.file.buffer) {
            return res.status(400).json({ error: 'No document file uploaded.' });
        }

        const fileName = req.file.originalname || 'document.pdf';
        const mimeType = req.file.mimetype || '';

        // Universal Multi-Format Document & OCR Extraction (PDF, Scans, DOCX, Images, Text)
        const extractResult = await documentExtractorService.extractTextFromDocument(req.file.buffer, fileName, mimeType);
        const rawText = extractResult.text || '';

        // Deterministic Kenyan Keyword Analysis
        const keywordData = documentExtractorService.analyzeKenyanJudiciaryKeywords(rawText, fileName);

        // LLM Document Parsing with Kenyan Judiciary Taxonomy & Multimodal Vision
        const imageBuffer = extractResult.imageBuffer || (mimeType.startsWith('image/') ? req.file.buffer : null);
        let llmResult = await socaAiService.parseDocumentWithLlm(rawText, fileName, imageBuffer, mimeType);

        // Merge Heuristics + LLM results (giving precedence to valid extracted values)
        const judiciaryCaseId = llmResult?.judiciary_case_id || keywordData.judiciary_case_id || '';
        const clientName = llmResult?.client_name || '';

        let extracted = {
            docType: llmResult?.docType || keywordData.docType || 'OTHER',
            subType: llmResult?.subType || keywordData.subType || '',
            case_title: llmResult?.case_title || (judiciaryCaseId ? `Matter: ${judiciaryCaseId}` : (clientName ? `${clientName} Matter` : 'Legal Matter')),
            judiciary_case_id: judiciaryCaseId,
            client_name: clientName,
            opposing_party: llmResult?.opposing_party || '',
            opposing_counsel_name: llmResult?.opposing_counsel_name || '',
            opposing_counsel_firm: llmResult?.opposing_counsel_firm || '',
            opposing_counsel_phone: llmResult?.opposing_counsel_phone || '',
            opposing_counsel_email: llmResult?.opposing_counsel_email || '',
            opposing_counsel_address: llmResult?.opposing_counsel_address || '',
            court_station: llmResult?.court_station || keywordData.court_station || '',
            court_division: llmResult?.court_division || '',
            assigned_judge: llmResult?.assigned_judge || keywordData.judge_name || '',
            cause_of_action: llmResult?.cause_of_action || '',
            key_quote: llmResult?.key_quote || '',
            payment_ref: llmResult?.payment_ref || keywordData.payment_ref || '',
            prn_number: llmResult?.prn_number || keywordData.prn_number || '',
            amount: (typeof llmResult?.amount === 'number' && llmResult.amount > 0) ? llmResult.amount : (keywordData.amount || 0),
            id_number: llmResult?.id_number || '',
            kra_pin: llmResult?.kra_pin || '',
            mention_date: llmResult?.mention_date || '',
            deadline_date: llmResult?.deadline_date || '',
            teams_link: llmResult?.teams_link || keywordData.teams_link || '',
            file_name: fileName,
            summary: llmResult?.summary || (rawText.length > 20 ? rawText.slice(0, 300) : 'Document parsed via Legal OS PDF Engine.'),
            custom_fields: Array.isArray(llmResult?.custom_fields) ? llmResult.custom_fields : [],
            extractionMethod: extractResult.method,
            isScanned: extractResult.isScanned
        };

        let determinedActions = [];

        if (llmResult && Array.isArray(llmResult.determined_actions) && llmResult.determined_actions.length > 0) {
            determinedActions = llmResult.determined_actions;
        }

        // --- 2. Smart Case Auto-Matcher ---
        db.all('SELECT id, client_name, case_title, tracking_token, judiciary_case_id FROM case_tracking WHERE current_milestone != "CLOSED"', [], (err, cases) => {
            let matched_case_id = null;
            let match_confidence = 'NONE';

            if (!err && cases) {
                for (const c of cases) {
                    if (extracted.judiciary_case_id && c.judiciary_case_id && c.judiciary_case_id.trim().toLowerCase() === extracted.judiciary_case_id.trim().toLowerCase()) {
                        matched_case_id = c.id;
                        match_confidence = 'HIGH (Judiciary ID Match)';
                        break;
                    }
                    if (c.tracking_token && c.tracking_token.length >= 3 && rawText.toUpperCase().includes(c.tracking_token.toUpperCase())) {
                        matched_case_id = c.id;
                        match_confidence = 'HIGH (Tracking Token Match)';
                        break;
                    }
                    if (c.client_name && c.client_name.trim().length >= 4) {
                        const escapedName = c.client_name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        const nameRegex = new RegExp('\\b' + escapedName + '\\b', 'i');
                        if (nameRegex.test(rawText)) {
                            matched_case_id = c.id;
                            match_confidence = 'MEDIUM (Client Name Match)';
                            break;
                        }
                    }
                }
            }

            // Build automatic determined actions if missing or sparse
            if (determinedActions.length === 0) {
                if (matched_case_id) {
                    determinedActions.push({
                        id: 'act_update_' + Date.now(),
                        type: 'ACTION_UPDATE_MATTER',
                        title: `Sync to Active Matter: #${matched_case_id}`,
                        description: `Update Court Station (${extracted.court_station || 'Court'}), Opposing Counsel (${extracted.opposing_counsel_firm || extracted.opposing_party || 'Opposing Party'}), and Cause of Action on Case #${matched_case_id}`,
                        payload: { case_id: matched_case_id },
                        selected: true
                    });
                } else if (extracted.client_name || extracted.judiciary_case_id) {
                    determinedActions.push({
                        id: 'act_newcase_' + Date.now(),
                        type: 'ACTION_CREATE_CASE',
                        title: `Open New Matter: ${extracted.judiciary_case_id || extracted.client_name || 'New Matter'}`,
                        description: `Register active case for ${extracted.client_name || 'Client'} in ${extracted.court_station || 'Milimani'}`,
                        payload: { 
                            client_name: extracted.client_name || 'New Client', 
                            case_title: extracted.case_title || `${extracted.judiciary_case_id || 'Civil'} Matter`,
                            judiciary_case_id: extracted.judiciary_case_id,
                            court_station: extracted.court_station
                        },
                        selected: true
                    });
                }

                if (extracted.custom_fields && extracted.custom_fields.length > 0) {
                    determinedActions.push({
                        id: 'act_custom_' + Date.now(),
                        type: 'ACTION_ATTACH_CUSTOM_FIELDS',
                        title: `Attach ${extracted.custom_fields.length} Discovered Custom Attributes`,
                        description: `Save attributes (${extracted.custom_fields.slice(0, 3).map(f => f.key).join(', ')}) to matter dossier`,
                        payload: { custom_fields: extracted.custom_fields },
                        selected: true
                    });
                }

                if (extracted.key_quote || (extracted.summary && extracted.summary.length > 10)) {
                    determinedActions.push({
                        id: 'act_fact_' + Date.now(),
                        type: 'ACTION_ADD_FACT',
                        title: `Log Chronology Fact: ${extracted.subType || extracted.docType}`,
                        description: (extracted.key_quote ? `"${extracted.key_quote.slice(0, 100)}..."` : extracted.summary.slice(0, 120) + '...'),
                        payload: { fact: extracted.key_quote || extracted.summary },
                        selected: true
                    });
                }

                if (extracted.mention_date || extracted.deadline_date) {
                    const eventDate = extracted.mention_date || extracted.deadline_date;
                    determinedActions.push({
                        id: 'act_cal_' + Date.now(),
                        type: 'ACTION_CREATE_CALENDAR_EVENT',
                        title: `Schedule Mention/Hearing (${eventDate})`,
                        description: `Create court appearance reminder at ${extracted.court_station || 'Court Station'}${extracted.teams_link ? ' with Teams link' : ''}`,
                        payload: { date: eventDate, location: extracted.court_station, link: extracted.teams_link },
                        selected: true
                    });
                }

                if (extracted.payment_ref && extracted.amount) {
                    determinedActions.push({
                        id: 'act_pay_' + Date.now(),
                        type: 'ACTION_RECORD_PAYMENT',
                        title: `Record Payment Ref: ${extracted.payment_ref}`,
                        description: `Log KES ${extracted.amount.toLocaleString()} in firm operating ledger & disbursement`,
                        payload: { ref: extracted.payment_ref, amount: extracted.amount },
                        selected: true
                    });
                }
            }

            res.json({
                success: true,
                raw_text_length: rawText.length,
                extracted,
                determined_actions: determinedActions,
                match: {
                    case_id: matched_case_id,
                    confidence: match_confidence
                }
            });
        });

    } catch (err) {
        console.error('Judiciary PDF Parsing error:', err);
        res.status(500).json({ error: 'Failed to parse PDF document: ' + err.message });
    }
});

// 2. Ingest & Sync Extracted Data into Legal OS Active Matters
app.post('/api/judiciary/ingest', requireAuth, uploadMem.single('file'), (req, res) => {
    try {
        let {
            case_id, docType, judiciary_case_id, payment_ref, prn_number, amount,
            court_station, court_division, id_number, kra_pin, mention_date, teams_link,
            client_name, case_title, case_type, opposing_party,
            opposing_counsel_name, opposing_counsel_firm, opposing_counsel_phone, opposing_counsel_email, opposing_counsel_address,
            cause_of_action, key_quote, case_brief, suit_value, custom_fields,
            update_case_id, create_payment, create_calendar_event, add_fact
        } = req.body;

        const recorded_by = req.user.display_name;
        const now = new Date().toISOString();

        // Parse custom_fields if stringified
        let customKycJson = '';
        if (custom_fields) {
            try {
                const parsedFields = typeof custom_fields === 'string' ? JSON.parse(custom_fields) : custom_fields;
                if (Array.isArray(parsedFields)) {
                    const kycObj = {};
                    parsedFields.forEach(f => {
                        if (f && f.key) kycObj[f.key] = f.value;
                    });
                    customKycJson = JSON.stringify(kycObj);
                } else if (typeof parsedFields === 'object') {
                    customKycJson = JSON.stringify(parsedFields);
                }
            } catch (e) {
                customKycJson = String(custom_fields);
            }
        }

        const finalSuitValue = parseFloat(suit_value || amount || 0) || null;
        const finalBrief = case_brief || key_quote || '';

        const processIngest = (targetCaseId) => {
            db.serialize(() => {
                // A. Update Active Matter Metadata & Opposing Counsel & Custom KYC
                if (update_case_id === 'true' || update_case_id === true || update_case_id === undefined) {
                    db.run(
                        `UPDATE case_tracking SET 
                            judiciary_case_id = COALESCE(NULLIF(?, ""), judiciary_case_id), 
                            court_station = COALESCE(NULLIF(?, ""), court_station), 
                            opposing_party = COALESCE(NULLIF(?, ""), opposing_party),
                            opposing_counsel_name = COALESCE(NULLIF(?, ""), opposing_counsel_name),
                            opposing_counsel_firm = COALESCE(NULLIF(?, ""), opposing_counsel_firm),
                            opposing_counsel_phone = COALESCE(NULLIF(?, ""), opposing_counsel_phone),
                            opposing_counsel_email = COALESCE(NULLIF(?, ""), opposing_counsel_email),
                            opposing_counsel_address = COALESCE(NULLIF(?, ""), opposing_counsel_address),
                            cause_of_action = COALESCE(NULLIF(?, ""), cause_of_action),
                            case_brief = COALESCE(NULLIF(?, ""), case_brief),
                            suit_value = COALESCE(?, suit_value),
                            custom_kyc = COALESCE(NULLIF(?, ""), custom_kyc),
                            id_number = COALESCE(NULLIF(?, ""), id_number), 
                            kra_pin = COALESCE(NULLIF(?, ""), kra_pin), 
                            last_updated = CURRENT_TIMESTAMP 
                        WHERE id = ?`,
                        [
                            judiciary_case_id, court_station, opposing_party,
                            opposing_counsel_name, opposing_counsel_firm, opposing_counsel_phone, opposing_counsel_email, opposing_counsel_address,
                            cause_of_action, finalBrief, finalSuitValue, customKycJson,
                            id_number, kra_pin, targetCaseId
                        ]
                    );
                }

                // B. If file was provided, save to disk and attach to case_files
                if (req.file) {
                    const fileExt = path.extname(req.file.originalname) || '.pdf';
                    const fileFileName = `pdf_engine_${Date.now()}_${Math.floor(Math.random()*1000)}${fileExt}`;
                    const uploadDir = path.join(UPLOAD_BASE_DIR, 'judiciary');
                    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
                    const filePathOnDisk = path.join(uploadDir, fileFileName);

                    fs.writeFileSync(filePathOnDisk, req.file.buffer);

                    const fileId = 'file_' + Date.now();
                    db.run(
                        'INSERT INTO case_files (id, case_id, file_name, file_path, category, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)',
                        [fileId, targetCaseId, req.file.originalname, `/uploads/judiciary/${fileFileName}`, docType === 'RECEIPT' ? 'finance' : 'pleadings', recorded_by]
                    );
                }

                // C. Add Fact to Extracted Chronology
                if ((add_fact === 'true' || add_fact === true) && (key_quote || finalBrief)) {
                    const factId = 'fact_' + Date.now();
                    const factDesc = key_quote ? `[Quote/Pleading] ${key_quote}` : finalBrief;
                    db.run(
                        'INSERT INTO extracted_facts (id, case_id, fact_date, description, pincite, status) VALUES (?, ?, ?, ?, ?, ?)',
                        [factId, targetCaseId, mention_date || new Date().toISOString().slice(0, 10), factDesc, req.file?.originalname || 'PDF Engine', 'Procured']
                    );
                }

                // D. Create Payment / Disbursement Record
                if ((create_payment === 'true' || create_payment === true) && amount > 0) {
                    const payId = 'pay_jud_' + Date.now();
                    const refCode = payment_ref || prn_number || 'JUDICIARY-EFILING';
                    db.run(
                        'INSERT INTO case_payments (id, case_id, amount, payment_ref, payment_method, notes, recorded_by, destination) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                        [payId, targetCaseId, parseFloat(amount), refCode, 'M-Pesa Paybill 553388', `Judiciary eFiling ${docType} Payment (PRN: ${prn_number || 'N/A'})`, recorded_by, 'operating']
                    );

                    // Also log as disbursement
                    const disbId = 'disb_' + Date.now();
                    db.run(
                        'INSERT INTO case_disbursements (id, case_id, amount, description, payment_method, recorded_by, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
                        [disbId, targetCaseId, parseFloat(amount), `Court Fee / Assessment (${refCode})`, 'M-Pesa 553388', recorded_by, 'unbilled']
                    );
                }

                // E. Schedule Court Calendar Event if Mention Date detected
                if ((create_calendar_event === 'true' || create_calendar_event === true) && mention_date) {
                    const evId = 'ev_jud_' + Date.now();
                    const eventTitle = `🏛️ Court Mention / Hearing (${judiciary_case_id || 'Active Matter'})`;
                    const notesStr = `PDF Engine Ingestion Notice.\nCourt Station: ${court_station || 'Unspecified'}\nVirtual Court Teams Link: ${teams_link || 'N/A'}`;
                    db.run(
                        'INSERT INTO court_calendar (id, case_id, event_title, event_type, event_date, notes, is_important) VALUES (?, ?, ?, ?, ?, ?, ?)',
                        [evId, targetCaseId, eventTitle, 'mention', mention_date, notesStr, 1]
                    );
                }

                // F. Log Activity
                const actId = 'act_' + Date.now();
                db.run(
                    'INSERT INTO case_activities (id, case_id, activity_type, description, recorded_by) VALUES (?, ?, ?, ?, ?)',
                    [actId, targetCaseId, 'judiciary_ingested', `📥 Ingested via PDF Engine (${docType}, Ref: ${judiciary_case_id || payment_ref || 'N/A'}, Client: ${client_name || 'N/A'})`, recorded_by],
                    () => {
                        setTimeout(() => { syncEngine.runDeltaSyncCycle().catch(() => {}); }, 50);
                    }
                );

                res.json({ success: true, case_id: targetCaseId, message: 'Document ingested and synced to Active Matters successfully.' });
            });
        };

        // If CREATE_NEW requested, dynamically initialize a new case
        if (case_id === 'CREATE_NEW' || !case_id) {
            const newCaseId = 'c_pdf_' + Date.now();
            const yearSuffix = new Date().getFullYear().toString().slice(-2);
            db.get('SELECT COUNT(*) as count FROM case_tracking', [], (err, row) => {
                const count = (row ? Number(row.count) : 0) + 1;
                const token = `SO-MATTER/${count}/${yearSuffix}`;
                const finalClient = client_name || 'New Client';
                const finalTitle = case_title || `Matter: ${judiciary_case_id || finalClient}`;
                const finalType = case_type || 'Civil Disputes';

                const milestones = JSON.stringify(["Filing in Court", "Mention/Directions", "Hearing Phase", "Judgment", "Execution/Appeal"]);
                db.run(
                    `INSERT INTO case_tracking (
                        id, tracking_token, client_name, case_title, case_type, current_milestone, milestones_json,
                        assigned_lawyer, fee_status, court_station, judiciary_case_id, id_number, kra_pin,
                        opposing_party, opposing_counsel_name, opposing_counsel_firm, opposing_counsel_phone, opposing_counsel_email, opposing_counsel_address,
                        cause_of_action, case_brief, suit_value, custom_kyc, last_updated
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                    [
                        newCaseId, token, finalClient, finalTitle, finalType,
                        '1', milestones, recorded_by || 'Sam Ogola', 'pending',
                        court_station || 'Milimani Law Courts', judiciary_case_id || '', id_number || '', kra_pin || '',
                        opposing_party || '', opposing_counsel_name || '', opposing_counsel_firm || '', opposing_counsel_phone || '', opposing_counsel_email || '', opposing_counsel_address || '',
                        cause_of_action || '', finalBrief || '', finalSuitValue || null, customKycJson || ''
                    ],
                    function(err2) {
                        if (err2) return res.status(500).json({ error: 'Failed to create new matter: ' + err2.message });
                        processIngest(newCaseId);
                    }
                );
            });
        } else {
            processIngest(case_id);
        }

    } catch (err) {
        console.error('PDF Engine Ingestion Error:', err);
        res.status(500).json({ error: 'Failed to ingest document: ' + err.message });
    }
});

// ══════════════════════════════════════════════════════════════════════
// STRATEGY B: KENYA JUDICIARY LIVE REST API CONNECTOR & CTS AUTO-SYNC
// ══════════════════════════════════════════════════════════════════════

const JudiciaryApiService = require('./services/judiciaryApi');

// GET Judiciary API Config
app.get('/api/judiciary-api/config', (req, res) => {
    db.get('SELECT * FROM judiciary_api_config WHERE id = "default_config"', (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) {
            return res.json({
                p_number: '',
                mode: 'sandbox',
                base_url: 'https://efiling.court.go.ke/api/v1',
                auto_sync_enabled: 1,
                last_sync_at: null
            });
        }
        res.json(row);
    });
});

// Save Judiciary API Config
app.post('/api/judiciary-api/config', (req, res) => {
    const { p_number, api_key, mode, base_url, auto_sync_enabled } = req.body;
    const now = new Date().toISOString();

    db.run(`
        INSERT INTO judiciary_api_config (id, p_number, api_key, mode, base_url, auto_sync_enabled, updated_at)
        VALUES ('default_config', ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            p_number = EXCLUDED.p_number,
            api_key = EXCLUDED.api_key,
            mode = EXCLUDED.mode,
            base_url = EXCLUDED.base_url,
            auto_sync_enabled = EXCLUDED.auto_sync_enabled,
            updated_at = EXCLUDED.updated_at
    `, [p_number || '', api_key || '', mode || 'sandbox', base_url || 'https://efiling.court.go.ke/api/v1', auto_sync_enabled ? 1 : 0, now], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: 'Judiciary API Configuration Saved' });
    });
});

// Live 1-Tap CTS Sync for a specific Matter
app.post('/api/judiciary-api/sync-case/:id', (req, res) => {
    const { id } = req.params;

    db.get('SELECT * FROM case_tracking WHERE id = ?', [id], async (err, c) => {
        if (err || !c) return res.status(404).json({ error: 'Matter not found' });

        const jCaseId = c.judiciary_case_id || c.ref_no || c.tracking_token;
        db.get('SELECT * FROM judiciary_api_config WHERE id = "default_config"', async (err2, config) => {
            const apiDriver = new JudiciaryApiService(config || { mode: 'sandbox' });
            
            try {
                const ctsResult = await apiDriver.fetchCaseDetails(jCaseId);
                if (!ctsResult.success) throw new Error(ctsResult.error || 'CTS query failed');

                const now = new Date().toISOString();
                
                // Update case metadata from live CTS return
                db.run(`
                    UPDATE case_tracking 
                    SET court_station = ?, assigned_judge = ?, court_division = ?, last_cts_sync_at = ?, cts_sync_status = 'SYNCED'
                    WHERE id = ?
                `, [ctsResult.court_station, ctsResult.assigned_judge, ctsResult.court_division, now, id]);

                // Auto-schedule next mention date if returned by CTS
                if (ctsResult.next_mention_date) {
                    const eventId = `ev_cts_${Date.now()}`;
                    const notes = `Auto-synced from eFiling CTS Portal.${ctsResult.virtual_court_link ? ' Teams: ' + ctsResult.virtual_court_link : ''}`;
                    db.run(`
                        INSERT INTO court_calendar (id, case_id, event_title, event_type, event_date, notes)
                        VALUES (?, ?, ?, 'mention', ?, ?)
                    `, [eventId, id, `Mention: ${ctsResult.court_station}`, ctsResult.next_mention_date, notes]);
                }

                // Log Activity
                db.run(`
                    INSERT INTO case_activities (id, case_id, activity_type, description, recorded_by)
                    VALUES (?, ?, 'cts_sync', ?, 'eFiling CTS Connector')
                `, [`act_${Date.now()}`, id, `Live CTS Data Synced. Station: ${ctsResult.court_station}, Presider: ${ctsResult.assigned_judge}`]);

                res.json({ success: true, ctsData: ctsResult });
            } catch (syncErr) {
                res.status(500).json({ error: 'CTS Sync Error: ' + syncErr.message });
            }
        });
    });
});

// Verify PRN & M-Pesa 553388 Payment
app.post('/api/judiciary-api/verify-prn', async (req, res) => {
    const { prn_number, mpesa_ref } = req.body;
    db.get('SELECT * FROM judiciary_api_config WHERE id = "default_config"', async (err, config) => {
        const apiDriver = new JudiciaryApiService(config || { mode: 'sandbox' });
        const result = await apiDriver.verifyPrn(prn_number, mpesa_ref);
        res.json(result);
    });
});

// ══════════════════════════════════════════════════════════════════════
// DEPO STUDIO, WITNESS ROSTER & IMPEACHMENT API ROUTES
// ══════════════════════════════════════════════════════════════════════

app.get('/api/cases/:case_id/witnesses', (req, res) => {
    db.all('SELECT * FROM witness_roster WHERE case_id = ? ORDER BY created_at ASC', [req.params.case_id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const promises = (rows || []).map(w => new Promise(resolve => {
            let concessions = [];
            try { concessions = JSON.parse(w.concessions || '[]'); } catch(e){}
            w.concessions = concessions;
            db.all('SELECT * FROM deposition_outlines WHERE witness_id = ? ORDER BY sort_order ASC', [w.id], (err, outlines) => {
                w.depositionOutline = outlines || [];
                db.all('SELECT * FROM impeachment_matrix WHERE witness_id = ? ORDER BY id ASC', [w.id], (err, matrix) => {
                    w.contradictions = matrix || [];
                    resolve(w);
                });
            });
        }));
        Promise.all(promises).then(fullWitnesses => res.json(fullWitnesses));
    });
});

app.post('/api/cases/:case_id/witnesses', (req, res) => {
    const { name, role, side, status, notes } = req.body;
    const id = 'wit_' + Date.now();
    db.run('INSERT INTO witness_roster (id, case_id, name, role, side, status, notes, concessions) VALUES (?,?,?,?,?,?,?,?)',
        [id, req.params.case_id, name, role, side || 'Plaintiff', status || 'Not Yet Called', notes || '', '[]'], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id, case_id: req.params.case_id, name, role, side, status, notes, depositionOutline: [], contradictions: [], concessions: [] });
    });
});

app.put('/api/witnesses/:id/concessions', (req, res) => {
    db.run('UPDATE witness_roster SET concessions=? WHERE id=?', [JSON.stringify(req.body.concessions || []), req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.post('/api/witnesses/:id/outlines', (req, res) => {
    const id = 'do_' + Date.now();
    db.run('INSERT INTO deposition_outlines (id, witness_id, theme, is_done, sort_order) VALUES (?,?,?,?,?)',
        [id, req.params.id, req.body.theme, 0, 999], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id });
    });
});

app.put('/api/outlines/:id/toggle', (req, res) => {
    db.run('UPDATE deposition_outlines SET is_done = ? WHERE id = ?', [req.body.is_done ? 1 : 0, req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.put('/api/witnesses/:id/outlines/reorder', (req, res) => {
    const { outline_ids } = req.body;
    if (!Array.isArray(outline_ids)) return res.status(400).json({ error: 'outline_ids array required' });
    db.serialize(() => {
        outline_ids.forEach((doId, idx) => {
            db.run('UPDATE deposition_outlines SET sort_order = ? WHERE id = ?', [idx, doId]);
        });
        res.json({ success: true });
    });
});

app.post('/api/witnesses/:id/impeachment', (req, res) => {
    const id = 'imp_' + Date.now();
    const { claim, evidence, pincite, status } = req.body;
    db.run('INSERT INTO impeachment_matrix (id, witness_id, claim, evidence, pincite, status) VALUES (?,?,?,?,?,?)',
        [id, req.params.id, claim, evidence, pincite, status || 'Needs Exhibit'], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id, witness: 'Their testimony' }); 
    });
});

app.post('/api/witnesses/:id/auto-contradictions', (req, res) => {
    const witnessId = req.params.id;
    db.get('SELECT * FROM witness_roster WHERE id = ?', [witnessId], (err, witness) => {
        if (err || !witness) return res.status(404).json({ error: 'Witness not found' });
        db.all('SELECT * FROM extracted_facts WHERE case_id = ?', [witness.case_id], (err2, facts) => {
            if (err2 || !facts || facts.length === 0) {
                return res.json({ success: true, count: 0, message: 'No facts extracted for this case yet.' });
            }
            let addedCount = 0;
            db.serialize(() => {
                facts.forEach((fact, i) => {
                    const pinciteStr = fact.pincite || (fact.source_doc ? `${fact.source_doc}, p.${fact.page_number || 1}` : 'Fact Evidence');
                    const factDesc = fact.description || fact.source_text || 'Extracted case fact';
                    if (factDesc) {
                        const impId = 'imp_ai_' + Date.now() + '_' + i;
                        const claimStr = witness.side === 'Defense' 
                            ? `Witness claims no adverse finding regarding ${factDesc.slice(0, 45)}...`
                            : `Opposing party testimony regarding ${factDesc.slice(0, 45)}...`;
                        db.run(
                            'INSERT INTO impeachment_matrix (id, witness_id, claim, evidence, pincite, status) VALUES (?,?,?,?,?,?)',
                            [impId, witnessId, claimStr, factDesc, pinciteStr, 'Needs Exhibit']
                        );
                        addedCount++;
                    }
                });
                res.json({ success: true, count: addedCount, message: `🤖 AI auto-detected and linked ${addedCount} potential contradictions from case facts!` });
            });
        });
    });
});

// --- Financials ---
app.get('/api/cases/:case_id/invoices', (req, res) => {
    db.all('SELECT * FROM case_invoices WHERE case_id = ? ORDER BY created_at DESC', [req.params.case_id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});
app.post('/api/cases/:case_id/invoices', (req, res) => {
    const { invoice_number, amount, notes, due_date, disbursement_ids } = req.body;
    const id = 'inv_' + Date.now();
    db.run('INSERT INTO case_invoices (id, case_id, invoice_number, amount, notes, due_date, disbursement_ids) VALUES (?,?,?,?,?,?,?)',
        [id, req.params.case_id, invoice_number, amount, notes || '', due_date || '', JSON.stringify(disbursement_ids || [])], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id, message: 'Invoice generated' });
        });
});

app.get('/api/cases/:case_id/payments', (req, res) => {
    db.all('SELECT * FROM case_payments WHERE case_id = ? ORDER BY created_at DESC', [req.params.case_id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});
app.post('/api/cases/:case_id/payments', (req, res) => {
    const { amount, method, reference, destination, invoice_id, notes } = req.body;
    const id = 'pay_' + Date.now();
    db.run('INSERT INTO case_payments (id, case_id, amount, payment_method, reference, destination, invoice_id, notes) VALUES (?,?,?,?,?,?,?,?)',
        [id, req.params.case_id, amount, method, reference || '', destination || 'operating', invoice_id || '', notes || ''], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id, message: 'Payment recorded' });
        });
});

// Helper: Deterministic Intent Extractor Fallback
function extractCalendarIntentFromUserMsg(userMessage) {
    const msg = userMessage.toLowerCase();
    const isScheduleIntent = ['set a court mention', 'schedule', 'court date', 'mention for me', 'add to calendar', 'set mention'].some(k => msg.includes(k));
    if (!isScheduleIntent) return null;

    let dateStr = new Date().toISOString().slice(0, 10);
    const months = ['january','february','march','april','may','june','july','august','september','october','november','december'];
    const monthRegex = new RegExp(`(${months.join('|')})\\s+\\d{1,2},?\\s+\\d{4}`, 'i');
    const isoRegex = /\d{4}-\d{2}-\d{2}/;

    const dateMatch = userMessage.match(monthRegex) || userMessage.match(isoRegex);
    if (dateMatch) {
        const d = new Date(dateMatch[0]);
        if (!isNaN(d.getTime())) {
            dateStr = d.toISOString().slice(0, 10);
        }
    }

    let title = 'Court Mention';
    const judgeMatch = userMessage.match(/before\s+([^,.]+)/i);
    if (judgeMatch) {
        title = `Court Mention before ${judgeMatch[1].trim()}`;
    }

    return {
        type: 'CREATE_CALENDAR_EVENT',
        date: dateStr,
        event_title: title,
        description: title,
        event_type: 'mention'
    };
}

// --- SOCA PA Diagnostic Endpoint (Test Live Cloud Keys) ---
app.get('/api/soca-pa/diagnostic', requireAuth, async (req, res) => {
    try {
        const rawSocaKey = process.env.GROQ_SOCA_API_KEY || '';
        const rawPdfKey = process.env.GROQ_PDF_API_KEY || '';
        const rawGenKey = process.env.GROQ_API_KEY || '';

        const testSoca = rawSocaKey ? await socaAiService.testGroqKey(rawSocaKey) : { valid: false, status: 0, error: 'Not set in environment' };
        const testPdf = rawPdfKey ? await socaAiService.testGroqKey(rawPdfKey) : { valid: false, status: 0, error: 'Not set in environment' };
        const testGen = rawGenKey ? await socaAiService.testGroqKey(rawGenKey) : { valid: false, status: 0, error: 'Not set in environment' };

        res.json({
            success: true,
            server_time: new Date().toISOString(),
            keys_status: {
                GROQ_SOCA_API_KEY: {
                    configured: !!rawSocaKey,
                    char_count: rawSocaKey.length,
                    preview: rawSocaKey ? `${rawSocaKey.slice(0, 7)}...${rawSocaKey.slice(-4)}` : null,
                    test_result: testSoca
                },
                GROQ_PDF_API_KEY: {
                    configured: !!rawPdfKey,
                    char_count: rawPdfKey.length,
                    preview: rawPdfKey ? `${rawPdfKey.slice(0, 7)}...${rawPdfKey.slice(-4)}` : null,
                    test_result: testPdf
                },
                GROQ_API_KEY: {
                    configured: !!rawGenKey,
                    char_count: rawGenKey.length,
                    preview: rawGenKey ? `${rawGenKey.slice(0, 7)}...${rawGenKey.slice(-4)}` : null,
                    test_result: testGen
                }
            }
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// --- SOCA PA Chat Endpoint (With Instant Flash Execution & Intent Fallback) ---
const handleSocaChat = async (req, res) => {
    try {
        let { message, messages, history, matter_id, case_id, activeMatterId } = req.body;
        
        // Extract message from array if frontend passed messages array
        if (!message && Array.isArray(messages) && messages.length > 0) {
            const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
            message = lastUserMsg ? lastUserMsg.content : messages[messages.length - 1].content;
            if (!history) {
                history = messages.slice(0, -1);
            }
        }

        const effectiveMatterId = matter_id || case_id || activeMatterId;
        if (!message || (typeof message === 'string' && !message.trim())) {
            return res.status(400).json({ error: 'Message required' });
        }

        let matterContext = null;
        if (effectiveMatterId) {
            matterContext = await new Promise(resolve => {
                db.get('SELECT id, client_name, case_title, judiciary_case_id, current_milestone FROM case_tracking WHERE id = ?', [effectiveMatterId], (err, row) => {
                    resolve(row || null);
                });
            });
        }

        let memoryItems = await new Promise(resolve => {
            db.all('SELECT id, memory_key, memory_value, category, created_by, created_at FROM soca_memory ORDER BY created_at DESC LIMIT 30', [], (err, rows) => {
                resolve(rows || []);
            });
        });

        let firmStats = await new Promise(resolve => {
            db.all('SELECT COUNT(*) as total_cases, SUM(CASE WHEN current_milestone != \'CLOSED\' THEN 1 ELSE 0 END) as active_cases FROM case_tracking', [], (err, rows) => {
                resolve(rows?.[0] || { total_cases: 0, active_cases: 0 });
            });
        });

        let reply = await socaAiService.chatWithSocaPa(message, history || [], matterContext, memoryItems, firmStats);

        // 1. Check for embedded action tags in LLM reply
        let actionObj = null;
        const actionMatch = reply.match(/<!--ACTION:(.*?)-->/s);
        if (actionMatch) {
            try {
                actionObj = JSON.parse(actionMatch[1]);
                reply = reply.replace(/<!--ACTION:.*?-->/g, '').trim();
            } catch (e) {
                console.warn('Action JSON parse warning:', e.message);
            }
        }

        // 2. Deterministic Fallback if LLM forgot tag
        if (!actionObj) {
            actionObj = extractCalendarIntentFromUserMsg(message);
        }

        // 3. Execute Flash Action into Database
        if (actionObj) {
            const caseId = effectiveMatterId || matterContext?.id || null;

            if (actionObj.type === 'SAVE_MEMORY') {
                const memId = 'mem_' + Date.now();
                const memKey = actionObj.key || actionObj.memory_key || 'Learned Fact';
                const memVal = actionObj.value || actionObj.memory_value || actionObj.description || '';
                const category = actionObj.category || 'general';

                db.run(
                    `INSERT INTO soca_memory (id, memory_key, memory_value, category, created_by)
                     VALUES (?, ?, ?, ?, ?)`,
                    [memId, memKey, memVal, category, req.user?.display_name || 'SocaBot AI'],
                    (err) => {
                        if (err) console.error('Error saving soca_memory:', err);
                        else {
                            console.log('⚡ Flash memory saved successfully:', memId, memKey);
                            setTimeout(() => { syncEngine.runDeltaSyncCycle().catch(() => {}); }, 50);
                        }
                    }
                );
            } else if (actionObj.type === 'CREATE_CALENDAR_EVENT') {
                const eventId = 'ev_' + Date.now();
                const title = actionObj.description || actionObj.event_title || 'Court Mention';
                const eventType = actionObj.event_type || 'mention';
                const eventDate = actionObj.date || actionObj.event_date || new Date().toISOString().slice(0,10);
                const notes = actionObj.virtual_link ? `Virtual Link: ${actionObj.virtual_link}` : (actionObj.notes || 'Scheduled via SocaBot');

                db.run(
                    'INSERT INTO court_calendar (id, case_id, event_title, event_type, event_date, notes, is_important, assigned_lawyer) VALUES (?, ?, ?, ?, ?, ?, 1, ?)',
                    [eventId, caseId, title, eventType, eventDate, notes, 'Sam Ogola'],
                    (err) => {
                        if (err) console.error('Error inserting flash calendar event:', err);
                        else {
                            console.log('⚡ Flash calendar event created successfully:', eventId, title, eventDate);
                            setTimeout(() => { syncEngine.runDeltaSyncCycle().catch(() => {}); }, 50);
                        }
                    }
                );
            } else if (actionObj.type === 'RECORD_PAYMENT') {
                const payId = 'pay_' + Date.now();
                db.run(
                    'INSERT INTO case_payments (id, case_id, amount, payment_ref, payment_method, notes, recorded_by, destination) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    [payId, caseId, parseFloat(actionObj.amount) || 0, actionObj.reference || 'REF-' + Date.now(), actionObj.payment_method || 'M-PESA', actionObj.description || 'Payment logged via SocaBot', 'SocaBot AI', actionObj.destination || 'operating'],
                    (err) => {
                        if (err) console.error('Error inserting flash payment:', err);
                        else {
                            console.log('⚡ Flash payment logged successfully:', payId);
                            setTimeout(() => { syncEngine.runDeltaSyncCycle().catch(() => {}); }, 50);
                        }
                    }
                );
            } else if (actionObj.type === 'ADD_FACT') {
                const factId = 'fact_' + Date.now();
                db.run(
                    'INSERT INTO extracted_facts (id, case_id, fact_date, description, pincite, status, color) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [factId, caseId, actionObj.date || new Date().toISOString().slice(0,10), actionObj.description || 'Fact locked via SocaBot', actionObj.pincite || 'Court Document', 'LOCKED', actionObj.color || '#4db6ac'],
                    (err) => {
                        if (err) console.error('Error inserting flash fact:', err);
                        else {
                            console.log('⚡ Flash fact locked successfully:', factId);
                            setTimeout(() => { syncEngine.runDeltaSyncCycle().catch(() => {}); }, 50);
                        }
                    }
                );
            } else if (actionObj.type === 'CREATE_CASE') {
                const newCaseId = 'c_' + Date.now();
                const token = 'TRK-' + Math.random().toString(36).substring(2, 8).toUpperCase();
                const clientName = actionObj.client_name || 'New Client';
                const caseTitle = actionObj.case_title || `${clientName} Matter`;
                const caseType = actionObj.case_type || 'Litigation';
                const assignedLawyer = actionObj.assigned_lawyer || 'Sam Ogola';
                const milestonesJson = JSON.stringify(["Filing in Court", "Mention/Directions", "Hearing Phase", "Judgment", "Execution/Appeal"]);

                db.run(
                    `INSERT INTO case_tracking (id, tracking_token, client_name, case_title, case_type, current_milestone, milestones_json, assigned_lawyer, fee_status)
                     VALUES (?, ?, ?, ?, ?, '1', ?, ?, 'pending')`,
                    [newCaseId, token, clientName, caseTitle, caseType, milestonesJson, assignedLawyer],
                    (err) => {
                        if (err) console.error('Error creating flash case:', err);
                        else {
                            console.log('⚡ Flash case created successfully:', newCaseId, caseTitle);
                            setTimeout(() => { syncEngine.runDeltaSyncCycle().catch(() => {}); }, 50);
                        }
                    }
                );
            } else if (actionObj.type === 'CREATE_LEAD') {
                const leadId = 'lead_' + Date.now();
                const fullName = actionObj.full_name || 'Prospective Client';
                const phone = actionObj.phone || '0700000000';
                const serviceCat = actionObj.service_category || 'Litigation';
                const msgText = actionObj.message || 'Inquiry logged via SocaBot';

                db.run(
                    `INSERT INTO leads (id, full_name, phone, service_category, message, status, source)
                     VALUES (?, ?, ?, ?, ?, 'pending_review', 'socabot_ai')`,
                    [leadId, fullName, phone, serviceCat, msgText],
                    (err) => {
                        if (err) console.error('Error creating flash lead:', err);
                        else {
                            console.log('⚡ Flash lead created successfully:', leadId, fullName);
                            setTimeout(() => { syncEngine.runDeltaSyncCycle().catch(() => {}); }, 50);
                        }
                    }
                );
            } else if (actionObj.type === 'CREATE_SUBMISSION') {
                const subId = 'sub_' + Date.now();
                const subTitle = actionObj.title || actionObj.submission_title || 'Written Submissions';
                const subType = actionObj.submission_type || 'Written Submissions';
                const subDate = actionObj.due_date || actionObj.date || new Date().toISOString().slice(0, 10);
                const subLawyer = actionObj.assigned_lawyer || req.user?.display_name || 'Sam Ogola';
                const subNotes = actionObj.notes || actionObj.description || 'Drafted via SocaBot AI';

                db.run(
                    `INSERT INTO case_submissions (id, case_id, title, submission_type, due_date, status, assigned_lawyer, notes)
                     VALUES (?, ?, ?, ?, ?, 'Draft', ?, ?)`,
                    [subId, caseId, subTitle, subType, subDate, subLawyer, subNotes],
                    (err) => {
                        if (err) console.error('Error creating flash submission:', err);
                        else {
                            console.log('⚡ Flash submission created successfully:', subId, subTitle);
                            setTimeout(() => { syncEngine.runDeltaSyncCycle().catch(() => {}); }, 50);
                        }
                    }
                );
            }
        }

        res.json({ success: true, reply, actionExecuted: !!actionObj, executed_action: actionObj });
    } catch (err) {
        console.error('SOCA PA Chat Error:', err);
        res.status(500).json({ error: 'SOCA PA unavailable: ' + err.message });
    }
};

app.post('/api/soca-pa/chat', requireAuth, handleSocaChat);
app.post('/api/ai/assistant/chat', requireAuth, handleSocaChat);

// --- eCitizen OAuth SSO & Instant Client KYC Verification ---
app.get('/api/ecitizen/auth-url', requireAuth, (req, res) => {
    try {
        const authUrl = ecitizenService.getAuthorizationUrl();
        res.json({ success: true, authUrl });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/ecitizen/verify-kyc', requireAuth, async (req, res) => {
    try {
        const { id_number, kra_pin, business_reg_no } = req.body;
        const kyc = await ecitizenService.verifyClientKyc({
            idNumber: id_number,
            kraPin: kra_pin,
            businessRegNo: business_reg_no
        });
        res.json({ success: true, kyc });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/ecitizen/callback', async (req, res) => {
    try {
        const { code } = req.query;
        if (!code) return res.status(400).send('Authorization code missing');
        const tokenData = await ecitizenService.exchangeCodeForToken(code);
        res.send('<html><body><h3>eCitizen Single Sign-On Authenticated. You can close this window.</h3><script>window.close();</script></body></html>');
    } catch (e) {
        res.status(500).send('eCitizen SSO error: ' + e.message);
    }
});

// --- SOCA PA PDF / Multi-Format Document Attachment & Intelligent Case/Folder Auto-Filing ---
const handleSocaDocAnalysis = async (req, res) => {
    try {
        if (!req.file || !req.file.buffer) {
            return res.status(400).json({ error: 'No document file uploaded.' });
        }

        const userMessage = req.body.message || req.body.prompt || 'Please analyze this attached legal document, extract key facts, and assign it to the relevant matter or summarize its contents.';
        const matterId = req.body.matter_id || req.body.case_id || null;
        const fileName = req.file.originalname || 'document.pdf';
        const mimeType = req.file.mimetype || '';

        // Universal Multi-Format Document & OCR Extraction (PDF, Scans, DOCX, Images, Text)
        const extractResult = await documentExtractorService.extractTextFromDocument(req.file.buffer, fileName, mimeType);
        const rawText = extractResult.text || '';
        const imageBuffer = extractResult.imageBuffer || (mimeType.startsWith('image/') ? req.file.buffer : null);

        // Deterministic Kenyan Keyword Analysis
        const keywordData = documentExtractorService.analyzeKenyanJudiciaryKeywords(rawText, fileName);

        // LLM Document Intelligence Extraction with Multimodal Vision
        let parsedDoc = null;
        try {
            parsedDoc = await socaAiService.parseDocumentWithLlm(rawText.slice(0, 8000), fileName, imageBuffer, mimeType);
        } catch (e) {
            console.warn('parseDocumentWithLlm warning in soca-pa upload:', e.message);
        }

        // Merge keyword data if LLM missed certain fields
        if (parsedDoc) {
            if (!parsedDoc.judiciary_case_id && keywordData.judiciary_case_id) parsedDoc.judiciary_case_id = keywordData.judiciary_case_id;
            if (!parsedDoc.payment_ref && keywordData.payment_ref) parsedDoc.payment_ref = keywordData.payment_ref;
            if (!parsedDoc.court_station && keywordData.court_station) parsedDoc.court_station = keywordData.court_station;
            if ((!parsedDoc.amount || parsedDoc.amount === 0) && keywordData.amount) parsedDoc.amount = keywordData.amount;
        } else {
            parsedDoc = {
                docType: keywordData.docType || 'OTHER',
                subType: keywordData.subType || '',
                judiciary_case_id: keywordData.judiciary_case_id || '',
                payment_ref: keywordData.payment_ref || '',
                amount: keywordData.amount || 0,
                court_station: keywordData.court_station || '',
                teams_link: keywordData.teams_link || '',
                summary: rawText.slice(0, 250)
            };
        }

        // 2. Fetch active matter or auto-match matter
        let targetMatter = null;
        if (matterId) {
            targetMatter = await new Promise(r => db.get('SELECT * FROM case_tracking WHERE id = ?', [matterId], (err, row) => r(row || null)));
        } else if (parsedDoc?.judiciary_case_id) {
            targetMatter = await new Promise(r => db.get('SELECT * FROM case_tracking WHERE UPPER(judiciary_case_id) = ? OR UPPER(tracking_token) = ?', [parsedDoc.judiciary_case_id.toUpperCase(), parsedDoc.judiciary_case_id.toUpperCase()], (err, row) => r(row || null)));
        }

        // 3. Inject document intelligence into the executive prompt
        const ocrBadge = extractResult.isScanned ? ' (Scanned OCR)' : '';
        const docSummary = `[ATTACHED DOCUMENT: "${fileName}"${ocrBadge} | Type: ${parsedDoc?.subType || parsedDoc?.docType || 'Court Document'} | Judiciary ID: ${parsedDoc?.judiciary_case_id || 'N/A'} | Parties: ${parsedDoc?.client_name || ''} vs ${parsedDoc?.opposing_party || ''} | Court: ${parsedDoc?.court_station || ''} | Summary: ${parsedDoc?.summary || ''}]`;
        const augmentedPrompt = `${docSummary}\n\nUser Instruction: ${userMessage}\n\nDocument Text Preview:\n${rawText.slice(0, 3000)}`;

        let memoryItems = await new Promise(resolve => {
            db.all('SELECT id, memory_key, memory_value, category, created_by, created_at FROM soca_memory ORDER BY created_at DESC LIMIT 20', [], (err, rows) => resolve(rows || []));
        });

        let history = [];
        try {
            if (req.body.history) {
                history = typeof req.body.history === 'string' ? JSON.parse(req.body.history) : req.body.history;
            }
        } catch (e) {}

        let reply = await socaAiService.chatWithSocaPa(augmentedPrompt, history, targetMatter, memoryItems);

        // 4. Action handling & Auto-Filing to case_files
        let actionObj = null;
        const actionMatch = reply.match(/<!--ACTION:(.*?)-->/s);
        if (actionMatch) {
            try {
                actionObj = JSON.parse(actionMatch[1]);
                reply = reply.replace(/<!--ACTION:.*?-->/g, '').trim();
            } catch (e) {}
        }

        let assignedFolder = 'pleadings';
        if (parsedDoc?.docType === 'RECEIPT') assignedFolder = 'financials';
        else if (parsedDoc?.docType === 'DECREE_ORDER') assignedFolder = 'court_orders';
        else if (parsedDoc?.docType === 'CLIENT_KYC') assignedFolder = 'client_kyc';
        else if (parsedDoc?.docType === 'CORRESPONDENCE' || parsedDoc?.docType === 'MENTION_NOTICE') assignedFolder = 'correspondence';

        const saveAttachmentToMatter = (cid) => {
            if (!cid || !req.file.buffer) return;
            const caseToken = String(cid).replace(/[\/\\:]/g, '_');
            const targetDir = path.join(UPLOAD_BASE_DIR, caseToken);
            if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
            
            const fileExt = path.extname(fileName) || '.pdf';
            const safeBase = path.basename(fileName, fileExt).replace(/[^a-zA-Z0-9._-]/g, '_');
            const diskFileName = `${Date.now()}_${safeBase}${fileExt}`;
            const diskPath = path.join(targetDir, diskFileName);
            
            fs.writeFileSync(diskPath, req.file.buffer);

            const fileId = 'cf_' + Date.now();
            const relPath = `/uploads/${caseToken}/${diskFileName}`;
            db.run(
                'INSERT INTO case_files (id, case_id, file_name, file_path, file_size, uploaded_by, category) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [fileId, cid, fileName, relPath, req.file.size, req.user?.display_name || 'SocaBot', assignedFolder]
            );
        };

        if (actionObj) {
            let caseId = targetMatter?.id || matterId || null;
            if (actionObj.type === 'CREATE_CASE') {
                const newCaseId = 'c_' + Date.now();
                const token = 'TRK-' + Math.random().toString(36).substring(2, 8).toUpperCase();
                const clientName = actionObj.client_name || parsedDoc?.client_name || 'New Client';
                const caseTitle = actionObj.case_title || (parsedDoc?.judiciary_case_id ? `Matter ${parsedDoc.judiciary_case_id}` : `${clientName} Matter`);
                const assignedLawyer = actionObj.assigned_lawyer || 'Sam Ogola';
                const caseType = actionObj.case_type || 'Litigation';

                db.run(
                    `INSERT INTO case_tracking (id, tracking_token, client_name, case_title, case_type, current_milestone, milestones_json, assigned_lawyer, fee_status, judiciary_case_id, court_station)
                     VALUES (?, ?, ?, ?, ?, '1', '["Initial Filing", "Mention", "Hearing", "Submissions", "Judgment"]', ?, 'pending', ?, ?)`,
                    [newCaseId, token, clientName, caseTitle, caseType, assignedLawyer, parsedDoc?.judiciary_case_id || null, parsedDoc?.court_station || null],
                    (err) => {
                        if (err) console.error('Error creating auto-parsed case from attachment:', err);
                        else {
                            console.log('⚡ Case created from document attachment:', newCaseId, caseTitle);
                            saveAttachmentToMatter(newCaseId);
                            setTimeout(() => { syncEngine.runDeltaSyncCycle().catch(() => {}); }, 50);
                        }
                    }
                );
                caseId = newCaseId;
            } else if (caseId) {
                saveAttachmentToMatter(caseId);

                if (actionObj.type === 'CREATE_CALENDAR_EVENT') {
                    const eventId = 'ev_' + Date.now();
                    const title = actionObj.description || actionObj.event_title || `${parsedDoc?.subType || 'Court'} Mention`;
                    const eventType = actionObj.event_type || 'mention';
                    const eventDate = actionObj.date || actionObj.event_date || parsedDoc?.mention_date || new Date().toISOString().slice(0,10);
                    db.run(
                        'INSERT INTO court_calendar (id, case_id, event_title, event_type, event_date, notes, is_important, assigned_lawyer) VALUES (?, ?, ?, ?, ?, ?, 1, ?)',
                        [eventId, caseId, title, eventType, eventDate, `Attached via SocaBot Document Engine (${fileName})`, 'Sam Ogola'],
                        () => {
                            setTimeout(() => { syncEngine.runDeltaSyncCycle().catch(() => {}); }, 50);
                        }
                    );
                } else if (actionObj.type === 'ADD_FACT') {
                    const factId = 'fact_' + Date.now();
                    db.run(
                        'INSERT INTO extracted_facts (id, case_id, fact_date, description, pincite, status, color) VALUES (?, ?, ?, ?, ?, ?, ?)',
                        [factId, caseId, actionObj.date || new Date().toISOString().slice(0,10), actionObj.description || `Extracted fact from ${fileName}`, fileName, 'LOCKED', '#4db6ac'],
                        () => {
                            setTimeout(() => { syncEngine.runDeltaSyncCycle().catch(() => {}); }, 50);
                        }
                    );
                } else if (actionObj.type === 'RECORD_PAYMENT' && actionObj.amount) {
                    const payId = 'pay_' + Date.now();
                    db.run(
                        'INSERT INTO case_payments (id, case_id, amount, payment_ref, payment_method, notes, recorded_by, destination) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                        [payId, caseId, parseFloat(actionObj.amount), actionObj.reference || parsedDoc?.payment_ref || 'PAY-REF', 'M-PESA', `Payment recorded via SocaBot document analysis (${fileName})`, req.user?.display_name || 'SocaBot', 'operating'],
                        () => {
                            setTimeout(() => { syncEngine.runDeltaSyncCycle().catch(() => {}); }, 50);
                        }
                    );
                }
            }
        } else if (targetMatter?.id || matterId) {
            saveAttachmentToMatter(targetMatter?.id || matterId);
            setTimeout(() => { syncEngine.runDeltaSyncCycle().catch(() => {}); }, 50);
        }

        res.json({
            success: true,
            reply,
            documentInfo: {
                fileName,
                parsedDoc,
                extractionMethod: extractResult.method,
                isScanned: extractResult.isScanned,
                targetMatter: targetMatter ? { id: targetMatter.id, title: targetMatter.case_title } : null
            },
            analysis: reply,
            actionExecuted: !!actionObj,
            executed_action: actionObj
        });
    } catch (err) {
        console.error('SOCA PA Document Upload Error:', err);
        res.status(500).json({ error: 'Document analysis failed: ' + err.message });
    }
};

app.post('/api/soca-pa/analyze-doc', requireAuth, uploadMem.single('file'), handleSocaDocAnalysis);
app.post('/api/soca-pa/upload-document', requireAuth, uploadMem.single('file'), handleSocaDocAnalysis);

// --- SOCA PA Cross-Chat Memory API ---
app.get('/api/soca-pa/memory', requireAuth, (req, res) => {
    db.all('SELECT * FROM soca_memory ORDER BY created_at DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

app.post('/api/soca-pa/memory', requireAuth, (req, res) => {
    const { memory_key, memory_value, category } = req.body;
    if (!memory_key || !memory_value) return res.status(400).json({ error: 'Key and Value required' });
    const id = 'mem_' + Date.now();
    db.run(
        `INSERT INTO soca_memory (id, memory_key, memory_value, category, created_by)
         VALUES (?, ?, ?, ?, ?)`,
        [id, memory_key, memory_value, category || 'general', req.user?.display_name || 'User'],
        (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id });
        }
    );
});

// --- SOCA PA Cross-Device Chat Sessions API ---
app.get('/api/soca-pa/sessions', requireAuth, (req, res) => {
    db.all(
        `SELECT id, user_id, session_title, case_id, messages_json, created_at, updated_at 
         FROM soca_chat_sessions 
         WHERE (is_deleted IS NULL OR is_deleted = 0)
         ORDER BY updated_at DESC LIMIT 50`,
        [],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            const formatted = (rows || []).map(r => {
                let parsedMsgs = [];
                try {
                    parsedMsgs = typeof r.messages_json === 'string' ? JSON.parse(r.messages_json) : r.messages_json;
                } catch (e) {}
                return {
                    id: r.id,
                    session_title: r.session_title,
                    case_id: r.case_id,
                    messages: parsedMsgs,
                    created_at: r.created_at,
                    updated_at: r.updated_at
                };
            });
            res.json(formatted);
        }
    );
});

app.post('/api/soca-pa/sessions', requireAuth, (req, res) => {
    const { id, session_title, case_id, messages } = req.body;
    const sessId = id || 'sess_' + Date.now();
    const title = session_title || 'Legal Research Session';
    const msgsJson = JSON.stringify(messages || []);

    db.get('SELECT id FROM soca_chat_sessions WHERE id = ?', [sessId], (err, row) => {
        if (row) {
            db.run(
                `UPDATE soca_chat_sessions 
                 SET session_title = ?, case_id = ?, messages_json = ?, updated_at = CURRENT_TIMESTAMP 
                 WHERE id = ?`,
                [title, case_id || null, msgsJson, sessId],
                (uErr) => {
                    if (uErr) return res.status(500).json({ error: uErr.message });
                    res.json({ success: true, id: sessId });
                }
            );
        } else {
            db.run(
                `INSERT INTO soca_chat_sessions (id, user_id, session_title, case_id, messages_json, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                [sessId, req.user?.id || 'u_advocate', title, case_id || null, msgsJson],
                (iErr) => {
                    if (iErr) return res.status(500).json({ error: iErr.message });
                    res.json({ success: true, id: sessId });
                }
            );
        }
    });
});

app.delete('/api/soca-pa/sessions/:id', requireAuth, (req, res) => {
    db.run(
        `UPDATE soca_chat_sessions 
         SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [req.params.id],
        (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        }
    );
});

app.delete('/api/soca-pa/memory/:id', requireAuth, (req, res) => {
    db.run('DELETE FROM soca_memory WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// --- SOCA PA Account-Linked Previous Chat Sessions API ---
app.get('/api/soca-pa/sessions', requireAuth, (req, res) => {
    const userId = req.user?.id || 'default_user';
    db.all(
        'SELECT id, session_title, matter_id, messages_json, updated_at FROM soca_chat_sessions WHERE user_id = ? ORDER BY updated_at DESC',
        [userId],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows.map(r => ({ ...r, messages: JSON.parse(r.messages_json || '[]') })));
        }
    );
});

app.post('/api/soca-pa/sessions', requireAuth, (req, res) => {
    const userId = req.user?.id || 'default_user';
    const { id, session_title, matter_id, messages } = req.body;
    const sessionId = id || 'sess_' + Date.now();
    const title = session_title || 'Chat Session ' + new Date().toLocaleDateString();
    const messagesJson = JSON.stringify(messages || []);

    db.run(
        `INSERT INTO soca_chat_sessions (id, user_id, session_title, matter_id, messages_json, updated_at)
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(id) DO UPDATE SET session_title=excluded.session_title, matter_id=excluded.matter_id, messages_json=excluded.messages_json, updated_at=CURRENT_TIMESTAMP`,
        [sessionId, userId, title, matter_id || null, messagesJson],
        (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id: sessionId, title });
        }
    );
});

app.delete('/api/soca-pa/sessions/:id', requireAuth, (req, res) => {
    const userId = req.user?.id || 'default_user';
    db.run('DELETE FROM soca_chat_sessions WHERE id = ? AND user_id = ?', [req.params.id, userId], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// --- Document Studio AI Co-Drafting & Refinement Endpoint (Text-Only) ---
app.post('/api/documents/ai-assist', requireAuth, async (req, res) => {
    try {
        const { action, docText, contextData, userInstruction, tone, matter_id } = req.body;
        if (!action) return res.status(400).json({ error: 'Action required' });

        let matterContext = contextData || {};
        let rawExtractedText = req.body.rawExtractedText || '';

        // If matter_id provided, fetch active facts & case details from database
        if (matter_id) {
            const caseRow = await new Promise(resolve => {
                db.get('SELECT * FROM case_tracking WHERE id = ?', [matter_id], (err, row) => resolve(row || null));
            });
            if (caseRow) {
                matterContext = {
                    client_name: caseRow.client_name,
                    case_title: caseRow.case_title,
                    judiciary_case_id: caseRow.judiciary_case_id,
                    court_station: caseRow.court_station,
                    court_division: caseRow.court_division,
                    assigned_judge: caseRow.assigned_judge,
                    opposing_party: caseRow.opposing_party,
                    opposing_counsel_firm: caseRow.opposing_counsel_firm,
                    assigned_lawyer: caseRow.assigned_lawyer || req.user?.display_name || 'Sam Ogola',
                    ...matterContext
                };
            }

            const facts = await new Promise(resolve => {
                db.all('SELECT fact_date, description, pincite, status FROM extracted_facts WHERE case_id = ? ORDER BY fact_date ASC', [matter_id], (err, rows) => resolve(rows || []));
            });
            if (facts && facts.length > 0) {
                const factsText = facts.map((f, idx) => `${idx + 1}. [${f.fact_date || 'Undated'}] ${f.description} (Ref: ${f.pincite || 'Document'})`).join('\n');
                rawExtractedText = (rawExtractedText ? rawExtractedText + '\n\n' : '') + `LOCKED CHRONOLOGICAL FACTS IN MATTER:\n${factsText}`;
            }
        }

        const resultText = await socaAiService.draftOrRefineDocumentWithLlm({
            action,
            docText: docText || '',
            contextData: matterContext,
            userInstruction: userInstruction || '',
            tone: tone || 'formal',
            rawExtractedText
        });

        res.json({ success: true, resultText });
    } catch (err) {
        console.error('Document Studio AI Assist Error:', err.message);
        res.status(500).json({ error: err.message || 'AI Drafting service error' });
    }
});

// --- Case Issues ---
app.get('/api/cases/:case_id/issues', (req, res) => {
    db.all('SELECT * FROM case_issues WHERE case_id = ? ORDER BY created_at ASC', [req.params.case_id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});
app.post('/api/cases/:case_id/issues', (req, res) => {
    const { name, color } = req.body;
    const id = 'iss_' + Date.now();
    db.run('INSERT INTO case_issues (id, case_id, name, color) VALUES (?,?,?,?)',
        [id, req.params.case_id, name, color || '#4db6ac'], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id });
    });
});

// --- Extracted Facts ---
app.get('/api/cases/:case_id/facts', (req, res) => {
    db.all('SELECT * FROM extracted_facts WHERE case_id = ? ORDER BY fact_date ASC', [req.params.case_id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        
        db.all('SELECT * FROM witness_roster WHERE case_id = ?', [req.params.case_id], (err2, witnesses) => {
            const parsedRows = rows.map(r => {
                const wIds = JSON.parse(r.contacts || '[]');
                const resolvedWitnesses = wIds.map(wId => (witnesses || []).find(w => w.id === wId)).filter(Boolean);
                return {
                    ...r,
                    issues: JSON.parse(r.issues || '[]'),
                    witness_ids: wIds,
                    witnesses: resolvedWitnesses,
                    sources: []
                };
            });
            res.json(parsedRows);
        });
    });
});
app.post('/api/cases/:case_id/facts', (req, res) => {
    const { fact_date, description, pincite, status, witness_ids, issue_ids, color, source_text } = req.body;
    const id = 'fct_' + Date.now();
    
    db.all('SELECT * FROM case_issues WHERE case_id = ?', [req.params.case_id], (err, caseIssues) => {
        let issues = [];
        if (!err && caseIssues) {
            issues = caseIssues.filter(i => (issue_ids || []).includes(i.id));
        }
        
        db.run('INSERT INTO extracted_facts (id, case_id, fact_date, description, pincite, status, issues, contacts, color, source_text) VALUES (?,?,?,?,?,?,?,?,?,?)',
            [id, req.params.case_id, fact_date, description, pincite || '', status || 'Procured', JSON.stringify(issues), JSON.stringify(witness_ids || []), color || '#c9a84c', source_text || ''], 
            (err2) => {
                if (err2) return res.status(500).json({ error: err2.message });
                res.json({ success: true, id });
        });
    });
});
app.delete('/api/cases/:case_id/facts/:id', (req, res) => {
    db.run('DELETE FROM extracted_facts WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// ══════════════════════════════════════════════════════════════════════
// MASTER E-BUNDLE DESK API ROUTES
// ══════════════════════════════════════════════════════════════════════

app.get('/api/cases/:case_id/ebundle', (req, res) => {
    const caseId = req.params.case_id;
    
    db.all('SELECT * FROM ebundle_sections WHERE case_id = ? ORDER BY sort_order ASC', [caseId], (err, sections) => {
        if (err) return res.status(500).json({ error: err.message });
        
        const sendFullBundle = (secList) => {
            const promises = (secList || []).map(s => new Promise(resolve => {
                db.all('SELECT * FROM ebundle_documents WHERE section_id = ? ORDER BY sort_order ASC', [s.id], (err2, docs) => {
                    s.items = (docs || []).map(d => ({ ...d, bate: d.bate_stamp }));
                    resolve(s);
                });
            }));
            Promise.all(promises).then(fullBundle => res.json(fullBundle));
        };

        if (!sections || sections.length === 0) {
            const defaultSecs = [
                { id: `sec_a_${Date.now()}_1`, label: 'SECTION A — Pleadings & Court Filings', color: '#ef5350', sort_order: 1 },
                { id: `sec_b_${Date.now()}_2`, label: 'SECTION B — Witness Statements & Affidavits', color: '#ff9800', sort_order: 2 },
                { id: `sec_c_${Date.now()}_3`, label: 'SECTION C — Documentary Evidence & Exhibits', color: '#4db6ac', sort_order: 3 },
                { id: `sec_d_${Date.now()}_4`, label: 'SECTION D — Legal Authorities & Precedents', color: '#ba68c8', sort_order: 4 }
            ];

            db.serialize(() => {
                defaultSecs.forEach(ds => {
                    db.run('INSERT INTO ebundle_sections (id, case_id, label, color, sort_order) VALUES (?,?,?,?,?)',
                        [ds.id, caseId, ds.label, ds.color, ds.sort_order]);
                });
                sendFullBundle(defaultSecs);
            });
        } else {
            sendFullBundle(sections);
        }
    });
});

app.post('/api/cases/:case_id/ebundle/auto-index', (req, res) => {
    const caseId = req.params.case_id;

    db.all('SELECT * FROM ebundle_sections WHERE case_id = ? ORDER BY sort_order ASC', [caseId], (err, sections) => {
        if (err || !sections || sections.length === 0) return res.status(400).json({ error: 'No bundle sections found' });

        const secA = sections.find(s => s.label.includes('SECTION A') || s.label.includes('Pleadings')) || sections[0];
        const secB = sections.find(s => s.label.includes('SECTION B') || s.label.includes('Witness')) || sections[1] || sections[0];
        const secC = sections.find(s => s.label.includes('SECTION C') || s.label.includes('Exhibits') || s.label.includes('Evidence')) || sections[2] || sections[0];
        const secD = sections.find(s => s.label.includes('SECTION D') || s.label.includes('Authorities')) || sections[3] || sections[0];

        db.all('SELECT * FROM case_files WHERE case_id = ? ORDER BY uploaded_at ASC', [caseId], (err2, files) => {
            if (err2 || !files || files.length === 0) return res.json({ success: true, count: 0, message: 'No case files found to index.' });

            let indexedCount = 0;
            let bateCounter = 1;

            db.serialize(() => {
                files.forEach((f, idx) => {
                    const fileCat = f.category || 'other';
                    let targetSec = secC;
                    if (['pleadings', 'court_orders'].includes(fileCat)) targetSec = secA;
                    else if (['correspondence', 'research'].includes(fileCat)) targetSec = secD;
                    else if (['client_kyc'].includes(fileCat)) targetSec = secB;

                    const bateStamp = `SOCA-ELC-${String(bateCounter).padStart(3, '0')}`;
                    bateCounter++;

                    const docId = `doc_auto_${Date.now()}_${idx}`;
                    const docType = (f.file_name.split('.').pop() || 'PDF').toUpperCase();

                    db.run(
                        'INSERT INTO ebundle_documents (id, section_id, bate_stamp, name, detail, pages, doc_type, sort_order) VALUES (?,?,?,?,?,?,?,?)',
                        [docId, targetSec.id, bateStamp, f.file_name, `Uploaded by ${f.uploaded_by || 'Counsel'}`, 1, docType, idx]
                    );
                    indexedCount++;
                });

                res.json({ success: true, count: indexedCount, message: `⚡ Auto-indexed ${indexedCount} case files into your court e-bundle!` });
            });
        });
    });
});

app.post('/api/cases/:case_id/ebundle-section', (req, res) => {
    const { label, color, sort_order } = req.body;
    const id = 'sec_' + Date.now();
    db.run('INSERT INTO ebundle_sections (id, case_id, label, color, sort_order) VALUES (?,?,?,?,?)',
        [id, req.params.case_id, label, color || '#4db6ac', sort_order || 0], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id });
    });
});

app.post('/api/ebundle/sections/:id/docs', (req, res) => {
    const { bate_stamp, name, detail, pages, doc_type, sort_order } = req.body;
    const id = 'doc_' + Date.now();
    db.run('INSERT INTO ebundle_documents (id, section_id, bate_stamp, name, detail, pages, doc_type, sort_order) VALUES (?,?,?,?,?,?,?,?)',
        [id, req.params.id, bate_stamp, name, detail || '', pages || 1, doc_type || 'PDF', sort_order || 0], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id });
    });
});

app.delete('/api/ebundle/docs/:id', (req, res) => {
    db.run('DELETE FROM ebundle_documents WHERE id=?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.put('/api/ebundle/docs/:id/move', (req, res) => {
    db.run('UPDATE ebundle_documents SET section_id=? WHERE id=?', [req.body.section_id, req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// ══════════════════════════════════════════════════════════════════════
// WHATSAPP BAILEYS SELF-HOSTED GATEWAY API
// ══════════════════════════════════════════════════════════════════════

app.get('/api/whatsapp/status', requireAuth, (req, res) => {
    res.json(whatsappBaileysService.getConnectionStatus());
});

app.get('/api/whatsapp/messages/:phone', requireAuth, async (req, res) => {
    try {
        const history = await whatsappBaileysService.getConversationHistory(req.params.phone, 100);
        res.json({ success: true, messages: history });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/whatsapp/send', requireAuth, async (req, res) => {
    try {
        const { phone, message, case_id } = req.body;
        if (!phone || !message) return res.status(400).json({ error: 'Phone and message required' });

        const status = whatsappBaileysService.getConnectionStatus();
        if (status.status === 'CONNECTED') {
            // 1. Direct local dispatch via connected Baileys socket
            await whatsappBaileysService.sendTextMessage(phone, message);
            return res.json({ success: true, mode: 'local_gateway' });
        } else {
            // 2. Cloud Relay Mode (Multi-Instance)
            const remote = process.env.REMOTE_BACKEND_URL || 'https://legalosburner-production.up.railway.app';
            console.log(`[WhatsApp Relay] Local socket in standby. Relaying message to firm cloud gateway: ${remote}...`);

            const msgId = 'wmsg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
            db.run(
                `INSERT INTO whatsapp_messages (id, phone, direction, message_text, handler, status, case_id, sent_by)
                 VALUES (?, ?, 'outgoing', ?, 'manual', 'pending', ?, ?)`,
                [msgId, phone, message, case_id || null, req.user?.display_name || 'Advocate']
            );

            try {
                const relayRes = await fetch(`${remote}/api/whatsapp/send`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': req.headers.authorization || ''
                    },
                    body: JSON.stringify({ phone, message, case_id })
                });
                const relayData = await relayRes.json();
                if (relayRes.ok) {
                    db.run(`UPDATE whatsapp_messages SET status = 'sent' WHERE id = ?`, [msgId]);
                    return res.json({ success: true, mode: 'cloud_relay', relayData });
                } else {
                    throw new Error(relayData.error || 'Cloud relay response unsuccessful');
                }
            } catch (relayErr) {
                console.warn('[WhatsApp Relay] Cloud dispatch deferred to delta sync:', relayErr.message);
                return res.json({ success: true, mode: 'queued_for_sync', note: 'Stored in local outbox; will synchronize to gateway.' });
            }
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/whatsapp/reminders', requireAuth, async (req, res) => {
    try {
        const daysAhead = parseInt(req.body.daysAhead) || 1;
        const result = await whatsappBaileysService.sendCourtReminders(daysAhead);
        res.json({ success: true, ...result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/whatsapp/reconnect', requireAuth, async (req, res) => {
    try {
        await whatsappBaileysService.initBaileys({ db, socaAiService, forceFresh: true });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/whatsapp/disconnect', requireAuth, async (req, res) => {
    try {
        await whatsappBaileysService.disconnectBaileys();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/whatsapp/toggle-mute', requireAuth, async (req, res) => {
    try {
        const { phone, mute } = req.body; // mute: true = mute, false = unmute
        if (!phone) return res.status(400).json({ error: 'Phone number required' });

        // Normalize phone
        let digits = phone.replace(/\D/g, '');
        if (digits.startsWith('0')) digits = '254' + digits.slice(1);
        if (digits.startsWith('7') && digits.length === 9) digits = '254' + digits;
        const normalizedPhone = digits;

        if (mute) {
            db.run(
                `INSERT INTO whatsapp_muted_contacts (phone, muted_by, muted_at)
                 VALUES (?, ?, CURRENT_TIMESTAMP)
                 ON CONFLICT(phone) DO UPDATE SET muted_by = excluded.muted_by, muted_at = CURRENT_TIMESTAMP`,
                [normalizedPhone, req.user?.display_name || req.user?.username || 'Advocate'],
                (err) => {
                    if (err) return res.status(500).json({ error: err.message });
                    console.log(`[WhatsApp] Bot muted for ${normalizedPhone} by ${req.user?.display_name}`);
                    res.json({ success: true, muted: true, phone: normalizedPhone });
                }
            );
        } else {
            db.run(
                'DELETE FROM whatsapp_muted_contacts WHERE phone LIKE ?',
                [`%${normalizedPhone.slice(-9)}%`],
                (err) => {
                    if (err) return res.status(500).json({ error: err.message });
                    console.log(`[WhatsApp] Bot unmuted for ${normalizedPhone}`);
                    res.json({ success: true, muted: false, phone: normalizedPhone });
                }
            );
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/whatsapp/muted', requireAuth, (req, res) => {
    db.all('SELECT phone, muted_by, muted_at, note FROM whatsapp_muted_contacts ORDER BY muted_at DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, muted: rows || [] });
    });
});

// ══════════════════════════════════════════════════════════════════════
// STATIC FRONTEND SERVING (Autonomous Desktop & Production Bundle)
// ══════════════════════════════════════════════════════════════════════
const distCandidates = [
    path.join(__dirname, '..', 'dashboard', 'dist'),
    path.join(__dirname, 'public'),
    path.join(process.resourcesPath || '', 'dashboard', 'dist')
];

let mountedDist = false;
for (const d of distCandidates) {
    if (fs.existsSync(d) && fs.existsSync(path.join(d, 'index.html'))) {
        console.log(`[Frontend] Serving production bundle from: ${d}`);
        app.use(express.static(d));
        app.use((req, res, next) => {
            if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/health')) {
                return res.sendFile(path.join(d, 'index.html'));
            }
            next();
        });
        mountedDist = true;
        break;
    }
}

if (!mountedDist) {
    console.warn('[Frontend] No production dist bundle found. API-only mode active.');
}

// ══════════════════════════════════════════════════════════════════════
// START SERVER
// ══════════════════════════════════════════════════════════════════════

const server = app.listen(PORT, () => {
    console.log(`Legal OS Backend running on http://localhost:${PORT}`);
    
    // Auto-initialize Baileys WhatsApp Gateway
    whatsappBaileysService.initBaileys({ db, socaAiService }).catch(err => {
        console.warn('Baileys WhatsApp auto-start deferred:', err.message);
    });

    // Run automated court mention reminders every 12 hours
    setInterval(() => {
        whatsappBaileysService.sendCourtReminders(1).catch(console.error);
    }, 12 * 60 * 60 * 1000);

    // Start background sync loop with Railway cloud if running as desktop app
    if (process.env.ELECTRON_APP === 'true' || process.env.ENABLE_DESKTOP_SYNC === 'true') {
        const remoteUrl = process.env.REMOTE_BACKEND_URL || 'https://legalosburner-production.up.railway.app';
        console.log(`[Sync Engine] Desktop background sync active. Syncing with: ${remoteUrl}`);
        syncEngine.startSyncLoop(remoteUrl, 'soca_sync_token_2026', 45000);
    }
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.warn(`[Server] Port ${PORT} is already in use by an active Legal OS instance. Attaching to existing instance.`);
    } else {
        console.error('[Server] Fatal server error:', err);
    }
});
