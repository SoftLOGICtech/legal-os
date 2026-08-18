const PDFDocument = require('./backend/node_modules/pdfkit');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// 1. Wipe case_files and mock uploads from SQLite database
const dbPath = path.join(__dirname, 'backend', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.run("DELETE FROM case_files");
    db.run("DELETE FROM extracted_facts");
    db.run("DELETE FROM fact_sources");
    db.run("DELETE FROM fact_witnesses");
    db.run("DELETE FROM fact_issues");
    console.log("Cleaned up old case files and facts from database.");
});
db.close();

// 2. Prepare mock_documents directory
const targetDir = path.join(__dirname, 'mock_documents');
if (fs.existsSync(targetDir)) {
    fs.rmSync(targetDir, { recursive: true, force: true });
}
fs.mkdirSync(targetDir, { recursive: true });

// Helper to create PDF using PDFKit
function createPdfDoc(outputPath, buildFn) {
    return new Promise((resolve) => {
        const doc = new PDFDocument({ margin: 50 });
        const stream = fs.createWriteStream(outputPath);
        doc.pipe(stream);
        buildFn(doc);
        doc.end();
        stream.on('finish', () => resolve());
    });
}

async function generateAllPdfs() {
    // ----------------------------------------------------
    // File 1: Multi-Page Land Title Deed (3 Pages)
    // ----------------------------------------------------
    await createPdfDoc(path.join(targetDir, 'Land_Title_Deed_1998.pdf'), (doc) => {
        // Page 1
        doc.fontSize(20).text('REPUBLIC OF KENYA', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(16).text('THE LAND REGISTRATION ACT (CAP. 300)', { align: 'center' });
        doc.fontSize(14).text('TITLE DEED - NAIROBI/BLOCK 82/104', { align: 'center' });
        doc.moveDown(1.5);

        doc.fontSize(11).text('TITLE NUMBER: NAIROBI/BLOCK 82/104');
        doc.text('APPROXIMATE AREA: 0.450 HECTARES');
        doc.text('REGISTERED OWNER: JOHN DOE (ID NO: 9948271)');
        doc.moveDown(1);

        doc.fontSize(12).text('SECTION I - PARCEL DETAILS', { underline: true });
        doc.fontSize(10).text(
            'This title deed is issued under the authority of the Registrar of Titles. ' +
            'The parcel of land situated in Nairobi County containing approximately 0.450 hectares is held in fee simple, ' +
            'subject to the special conditions and encumbrances listed in Section II below.'
        );
        doc.moveDown(2);
        doc.fontSize(9).text('— Page 1 —', { align: 'center' });

        // Page 2
        doc.addPage();
        doc.fontSize(12).text('SECTION II - ENCUMBRANCES AND REGISTERED CHARGES', { underline: true });
        doc.moveDown(1);

        doc.fontSize(10).text('Entry 1 (12th August 1998):', { bold: true });
        doc.text('Transfer of ownership from Ministry of Housing to John Doe for consideration of KES 50,000.');
        doc.moveDown(1);

        doc.fontSize(10).text('Entry 2 (14th October 2015):', { bold: true });
        doc.text('Caveat lodged by Jane Smith claiming beneficial interest under a Sale Agreement dated 10th May 2015.');
        doc.moveDown(1);

        doc.fontSize(10).text('Entry 3 (02nd January 2022):', { bold: true });
        doc.text('Charge registered in favor of Equity Bank Kenya Limited to secure KES 15,000,000.');
        doc.moveDown(3);
        doc.fontSize(9).text('— Page 2 —', { align: 'center' });

        // Page 3
        doc.addPage();
        doc.fontSize(12).text('SECTION III - EXECUTION & REGISTRATION STAMP', { underline: true });
        doc.moveDown(1.5);

        doc.fontSize(10).text('Given under my hand and official seal at Nairobi on this 12th day of August 1998.');
        doc.moveDown(3);

        doc.text('_____________________________________');
        doc.text('CHIEF LANDS OFFICER / REGISTRAR OF TITLES');
        doc.text('REPUBLIC OF KENYA');
        doc.moveDown(2);

        doc.text('[ OFFICIAL SEAL OF THE LAND REGISTRY ATTACHED ]');
        doc.moveDown(4);
        doc.fontSize(9).text('— Page 3 —', { align: 'center' });
    });

    // ----------------------------------------------------
    // File 2: HR Termination Email (Single Page)
    // ----------------------------------------------------
    await createPdfDoc(path.join(targetDir, 'HR_Termination_Email.pdf'), (doc) => {
        doc.fontSize(14).text('EXHIBIT HR-04: INTERNAL EMAIL CORRESPONDENCE', { underline: true });
        doc.moveDown(1);

        doc.fontSize(10).text('DATE: 15th March 2024');
        doc.text('FROM: hr.manager@company.com');
        doc.text('TO: executive.board@company.com');
        doc.text('SUBJECT: CONFIDENTIAL - Termination of JD (Sales Director)');
        doc.moveDown(1.5);

        doc.fontSize(11).text('Dear Board,');
        doc.moveDown(0.5);
        doc.text(
            'Following our discussion regarding the Q1 bonus payouts, we need to finalize the exit of JD. ' +
            'Let us find an excuse to terminate his contract before the 31st March bonus vesting deadline.'
        );
        doc.moveDown(0.5);
        doc.text(
            'While his formal performance metrics and KPI targets were technically met, we can cite "cultural fit" ' +
            'and procedural restructuring as the rationale.'
        );
        doc.moveDown(1.5);
        doc.text('Regards,\nHR Manager');
    });

    // ----------------------------------------------------
    // File 3: Bank Statement (2 Pages)
    // ----------------------------------------------------
    await createPdfDoc(path.join(targetDir, 'Bank_Statement_Oct_2023.pdf'), (doc) => {
        // Page 1
        doc.fontSize(16).text('EQUITY BANK KENYA LIMITED', { align: 'center' });
        doc.fontSize(12).text('OFFICIAL ACCOUNT STATEMENT', { align: 'center' });
        doc.moveDown(1);

        doc.fontSize(10).text('ACCOUNT NAME: JOHN DOE');
        doc.text('ACCOUNT NUMBER: 01802930293');
        doc.text('PERIOD: 01 OCT 2023 TO 31 OCT 2023');
        doc.text('BRANCH: NAIROBI CORPORATE');
        doc.moveDown(1.5);

        doc.fontSize(11).text('TRANSACTION HISTORY (PAGE 1 OF 2)', { underline: true });
        doc.moveDown(0.5);

        doc.fontSize(10).text('01-OCT-2023 | Opening Balance | KES 500,000.00');
        doc.text('05-OCT-2023 | Salary Deposit | KES 250,000.00 | Bal: KES 750,000.00');
        doc.text('12-OCT-2023 | Inward RTGS - Land Purchase | KES 10,000.00 | Bal: KES 760,000.00');
        doc.text('15-OCT-2023 | ATM Cash Withdrawal | KES 5,000.00 | Bal: KES 755,000.00');
        doc.moveDown(4);
        doc.fontSize(9).text('— Page 1 —', { align: 'center' });

        // Page 2
        doc.addPage();
        doc.fontSize(11).text('TRANSACTION HISTORY (PAGE 2 OF 2)', { underline: true });
        doc.moveDown(1);

        doc.fontSize(10).text('20-OCT-2023 | Legal Fees Payment | KES 150,000.00 | Bal: KES 605,000.00');
        doc.text('28-OCT-2023 | Stamp Duty Transfer | KES 20,000.00 | Bal: KES 585,000.00');
        doc.text('31-OCT-2023 | Closing Balance | KES 585,000.00');
        doc.moveDown(3);

        doc.text('THIS STATEMENT IS COMPUTER GENERATED AND REQUIRES NO PHYSICAL SIGNATURE.');
        doc.moveDown(4);
        doc.fontSize(9).text('— Page 2 —', { align: 'center' });
    });

    console.log("Successfully generated real, multi-page PDFs in mock_documents/");
}

generateAllPdfs();
