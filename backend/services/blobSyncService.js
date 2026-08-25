const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const fetch = require('node-fetch');
const FormData = require('form-data');
const db = require('../database');

// Resolve universal writable upload storage path
const UPLOAD_BASE_DIR = process.env.ELECTRON_USER_DATA
    ? path.join(process.env.ELECTRON_USER_DATA, 'uploads')
    : path.join(__dirname, '..', 'public', 'uploads');

try {
    if (!fs.existsSync(UPLOAD_BASE_DIR)) {
        fs.mkdirSync(UPLOAD_BASE_DIR, { recursive: true });
    }
} catch (e) {
    console.warn('[BlobSync] Upload base dir warning:', e.message);
}

// ── 1. COMPUTE SHA-256 HASH ──────────────────────────────────────────────────
function computeFileHash(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

// ── 2. SAVE LOCAL BLOB (CONTENT-ADDRESSABLE) ─────────────────────────────────
function saveLocalBlob(buffer, fileHash, originalName = 'document.pdf') {
    const ext = path.extname(originalName) || '.pdf';
    const fileName = `${fileHash}${ext}`;
    const filePath = path.join(UPLOAD_BASE_DIR, fileName);

    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, buffer);
    }

    // Register into blob_vault
    db.run(
        `INSERT INTO blob_vault (file_hash, file_size, mime_type, local_path, created_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(file_hash) DO NOTHING`,
        [fileHash, buffer.length, 'application/pdf', filePath]
    );

    return {
        fileHash,
        fileName,
        filePath,
        fileSize: buffer.length
    };
}

// ── 3. RESOLVE LOCAL BLOB PATH BY HASH ───────────────────────────────────────
function getLocalBlobPath(fileHash) {
    if (!fileHash || !fs.existsSync(UPLOAD_BASE_DIR)) return null;
    try {
        const files = fs.readdirSync(UPLOAD_BASE_DIR);
        const match = files.find(f => f.startsWith(fileHash));
        return match ? path.join(UPLOAD_BASE_DIR, match) : null;
    } catch {
        return null;
    }
}

// ── 4. BACKGROUND BLOB SYNC WORKER ──────────────────────────────────────────
async function syncPendingBlobs(remoteUrl, verifyToken) {
    if (!remoteUrl) return { synced: 0, downloaded: 0 };

    let uploadedCount = 0;
    let downloadedCount = 0;

    try {
        // A. PUSH: Find local files not yet synced to cloud
        const unSyncedFiles = await new Promise((resolve) => {
            db.all(
                `SELECT DISTINCT file_hash, file_name FROM case_files WHERE file_hash IS NOT NULL AND (is_synced = 0 OR is_synced IS NULL) LIMIT 10`,
                [],
                (err, rows) => resolve(rows || [])
            );
        });

        if (unSyncedFiles.length > 0) {
            const hashes = unSyncedFiles.map(f => f.file_hash).filter(Boolean);
            
            // Check which hashes the cloud server is actually missing
            const checkRes = await fetch(`${remoteUrl}/api/files/check-missing?hashes=${encodeURIComponent(hashes.join(','))}`, {
                headers: { 'Authorization': `Bearer ${verifyToken}` }
            });

            if (checkRes.ok) {
                const checkData = await checkRes.json();
                const missingOnServer = checkData.missing || [];

                for (const fileRecord of unSyncedFiles) {
                    const localPath = getLocalBlobPath(fileRecord.file_hash);
                    if (!localPath || !fs.existsSync(localPath)) continue;

                    if (missingOnServer.includes(fileRecord.file_hash)) {
                        // Upload missing blob to server
                        const form = new FormData();
                        form.append('file', fs.createReadStream(localPath), fileRecord.file_name);
                        form.append('file_hash', fileRecord.file_hash);

                        const uploadRes = await fetch(`${remoteUrl}/api/files/sync-blob`, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${verifyToken}`,
                                ...form.getHeaders()
                            },
                            body: form
                        });

                        if (uploadRes.ok) {
                            uploadedCount++;
                        }
                    }

                    // Mark as synced locally
                    await new Promise((resolve) => {
                        db.run(`UPDATE case_files SET is_synced = 1 WHERE file_hash = ?`, [fileRecord.file_hash], resolve);
                    });
                }
            }
        }

        // B. PULL: Pre-fetch missing cloud blobs for active matters to ensure 0ms offline access
        const allTrackedFiles = await new Promise((resolve) => {
            db.all(`SELECT file_hash, file_name FROM case_files WHERE file_hash IS NOT NULL LIMIT 20`, [], (err, rows) => resolve(rows || []));
        });

        for (const file of allTrackedFiles) {
            const localPath = getLocalBlobPath(file.file_hash);
            if (!localPath) {
                // Download blob from cloud server
                const blobRes = await fetch(`${remoteUrl}/api/files/blob/${file.file_hash}`, {
                    headers: { 'Authorization': `Bearer ${verifyToken}` }
                });

                if (blobRes.ok) {
                    const buffer = await blobRes.buffer();
                    saveLocalBlob(buffer, file.file_hash, file.file_name);
                    downloadedCount++;
                }
            }
        }

        return { uploaded: uploadedCount, downloaded: downloadedCount };
    } catch (err) {
        console.warn('[BlobSync] Background blob sync deferred:', err.message);
        return { uploaded: uploadedCount, downloaded: downloadedCount, error: err.message };
    }
}

module.exports = {
    UPLOAD_BASE_DIR,
    computeFileHash,
    saveLocalBlob,
    getLocalBlobPath,
    syncPendingBlobs
};
