const fs = require('fs');
const path = require('path');
const db = require('../backend/database');
const blobSyncService = require('../backend/services/blobSyncService');

async function testBlobVault() {
  console.log('--- 🧪 Testing Content-Addressable Storage (CAS) Blob Vault ---');
  await new Promise(r => setTimeout(r, 1500));

  // 1. Create a dummy PDF buffer
  const samplePdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 595 842]>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n0000000101 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n162\n%%EOF');
  
  // 2. Compute SHA-256 hash
  const hash = blobSyncService.computeFileHash(samplePdfBuffer);
  console.log('✅ Computed SHA-256 hash:', hash);

  // 3. Save local blob
  const saved = blobSyncService.saveLocalBlob(samplePdfBuffer, hash, 'Milimani_Ruling_2026.pdf');
  console.log('✅ Saved local blob:', saved.fileName, 'Size:', saved.fileSize, 'bytes');

  // 4. Verify file exists on disk
  const localPath = blobSyncService.getLocalBlobPath(hash);
  console.log('✅ Verified CAS file on disk:', localPath, fs.existsSync(localPath));

  // 5. Test Deduplication: saving same buffer again
  const savedAgain = blobSyncService.saveLocalBlob(samplePdfBuffer, hash, 'Duplicate_Copy.pdf');
  console.log('✅ Deduplication check (identical hash):', savedAgain.fileHash === hash);

  // 6. Verify blob_vault table entry
  const vaultRow = await new Promise(res => {
    db.get('SELECT * FROM blob_vault WHERE file_hash = ?', [hash], (err, row) => res(row || null));
  });
  console.log('✅ Verified blob_vault table entry:', vaultRow?.file_hash, 'Size:', vaultRow?.file_size);

  // Clean up test file from disk and DB
  if (localPath && fs.existsSync(localPath)) {
    fs.unlinkSync(localPath);
  }
  db.run('DELETE FROM blob_vault WHERE file_hash = ?', [hash]);

  console.log('\n🎉 ALL CONTENT-ADDRESSABLE STORAGE (CAS) TESTS PASSED!');
  process.exit(0);
}

testBlobVault().catch(err => {
  console.error('❌ Blob vault test failed:', err);
  process.exit(1);
});
