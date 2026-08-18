const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.join(__dirname, 'backend', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

// Find the first case or create one to attach mock docs to
db.get("SELECT id FROM case_tracking LIMIT 1", (err, row) => {
    let caseId = row ? row.id : 'CAS-001';
    
    if (!row) {
        db.run("INSERT INTO case_tracking (id, title, status) VALUES (?, ?, ?)", [caseId, 'Mock Test Suite Case', 'Active']);
    }

    const caseToken = caseId.replace(/[\/\\:]/g, '_');
    const uploadDir = path.join(__dirname, 'backend', 'uploads', caseToken);

    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }

    const mockDocs = [
        {
            name: 'Land_Title_Deed_1998.txt',
            content: `REPUBLIC OF KENYA\nTITLE DEED - NAIROBI/BLOCK 82/104\n\nThis deed is made on 12th August 1998.\nThe Commissioner of Lands hereby deposits and registers this parcel to JOHN DOE.\nAny transfer requires written consent.\n\nSignature: [Commissioner of Lands]\nStamp: PAID KES 50,000`
        },
        {
            name: 'HR_Termination_Email.txt',
            content: `From: hr.manager@company.com\nTo: executive.board@company.com\nDate: 15th March 2024\nSubject: Termination of JD\n\nLet's find an excuse to get rid of him before bonuses are paid. \nHis performance review was fine, but we can cite "cultural fit".\n\nBest,\nHR Manager`
        },
        {
            name: 'Bank_Statement_Oct_2023.txt',
            content: `EQUITY BANK KENYA\nAccount Statement\nAccount: 01802930293\nDate: 01 Oct 2023 - 31 Oct 2023\n\nTransactions:\n12-Oct: INWARD RTGS - KES 10,000 (Purchase of Block 82/104)\n15-Oct: ATM WITHDRAWAL - KES 5,000\n\nBalance: KES 15,200`
        }
    ];

    mockDocs.forEach((doc, idx) => {
        const filePath = path.join(uploadDir, doc.name);
        fs.writeFileSync(filePath, doc.content);
        const relPath = `/uploads/${caseToken}/${doc.name}`;
        
        db.run(`INSERT INTO case_files (id, case_id, file_name, file_path, file_size, uploaded_by, category) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [`mock_cf_${idx}_${Date.now()}`, caseId, doc.name, relPath, Buffer.byteLength(doc.content, 'utf8'), 'System', 'exhibits']
        );
    });

    db.close(() => {
        console.log("Mock suite created successfully for Case ID: " + caseId);
    });
});
