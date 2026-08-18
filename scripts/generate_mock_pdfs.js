const fs = require('fs');
const path = require('path');
// Use pdfkit from backend/node_modules
const PDFDocument = require(path.join(__dirname, '../backend/node_modules/pdfkit'));

const outputDir = path.join(__dirname, '../mock_tests');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log('Generating realistic legal PDF documents in:', outputDir);

// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENT 1: ELC Plaint & Statement of Claim
// ─────────────────────────────────────────────────────────────────────────────
function generatePlaint() {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  const stream = fs.createWriteStream(path.join(outputDir, '01_Plaint_and_Statement_of_Claim.pdf'));
  doc.pipe(stream);

  // Court Header
  doc.font('Helvetica-Bold').fontSize(14).text('REPUBLIC OF KENYA', { align: 'center' });
  doc.fontSize(12).text('IN THE ENVIRONMENT AND LAND COURT AT NAIROBI', { align: 'center' });
  doc.fontSize(11).text('ELC SUIT NO. E042 OF 2024', { align: 'center' });
  doc.moveDown(1);

  // Parties Box
  doc.font('Helvetica-Bold').fontSize(10).text('SAMUEL OGOLA ............................................................................ PLAINTIFF');
  doc.moveDown(0.5);
  doc.font('Helvetica-Bold').fontSize(10).text('VERSUS', { align: 'center' });
  doc.moveDown(0.5);
  doc.text('1. KILIMANI PROPERTIES LIMITED');
  doc.text('2. THE CHIEF LAND REGISTRAR ................................................. DEFENDANTS');
  doc.moveDown(1);

  // Line separator
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#1e293b');
  doc.moveDown(1);

  // Heading
  doc.font('Helvetica-Bold').fontSize(13).text('PLAINT', { align: 'center', underline: true });
  doc.moveDown(1);

  // Body Paragraphs
  doc.font('Helvetica').fontSize(10).text('1. The Plaintiff is an adult male of sound mind residing in Nairobi within the Republic of Kenya whose address for service for the purpose of this suit is care of SAM OGOLA & CO. ADVOCATES, P.O. Box 45012-00100, Nairobi.', { lineGap: 4 });
  doc.moveDown(0.5);

  doc.text('2. The 1st Defendant is a private limited liability company incorporated under the Companies Act (Cap 486) carrying on commercial real estate development within Nairobi County.', { lineGap: 4 });
  doc.moveDown(0.5);

  doc.text('3. At all material times, the Plaintiff is and was the registered absolute proprietor of all that parcel of land known as NAIROBI/BLOCK 82/104 measuring approximately 0.450 Hectares (hereinafter referred to as "the Suit Property").', { lineGap: 4 });
  doc.moveDown(0.5);

  doc.text('4. On or about 14th February 2024, the 1st Defendant, its agents, servants, and/or contractors wrongfully and without color of right trespassed onto the Suit Property, erected steel fencing perimeter walls, and commenced unauthorized excavations.', { lineGap: 4 });
  doc.moveDown(0.5);

  doc.text('5. PARTICULAR OF TRESPASS AND DAMAGE:', { underline: true });
  doc.text('   (a) Encroachment of 3.2 meters along the northern boundary of LR NAIROBI/BLOCK 82/104.');
  doc.text('   (b) Destruction of indigenous trees and boundary beacons valued at KES 3,500,000.');
  doc.text('   (c) Depriving the Plaintiff of quiet possession and lawful economic utilization of the Suit Property.');
  doc.moveDown(1);

  doc.font('Helvetica-Bold').text('REASON WHEREFORE THE PLAINTIFF PRAYS FOR JUDGMENT AGAINST THE DEFENDANTS FOR:');
  doc.font('Helvetica').text('A. A permanent injunction restraining the 1st Defendant from entering, excavating or building on LR NAIROBI/BLOCK 82/104.');
  doc.text('B. An order compelling the 2nd Defendant to rectify the boundary registry entries.');
  doc.text('C. General damages for trespass valued at KES 24,500,000.');
  doc.text('D. Costs of this suit together with interest at court rates.');
  doc.moveDown(2);

  // Signature Block
  doc.text('DATED at NAIROBI this 18th day of March 2024.');
  doc.moveDown(1.5);
  doc.font('Helvetica-Bold').text('____________________________________');
  doc.text('SAM OGOLA & CO. ADVOCATES');
  doc.font('Helvetica').text('Advocates for the Plaintiff');
  doc.text('P.O. Box 45012-00100, Nairobi');
  doc.text('Email: litigation@ogola-advocates.co.ke');

  doc.end();
}

// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENT 2: Official Title Deed Certificate
// ─────────────────────────────────────────────────────────────────────────────
function generateTitleDeed() {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  const stream = fs.createWriteStream(path.join(outputDir, '02_Official_Title_Deed_Certificate.pdf'));
  doc.pipe(stream);

  // Outer Border Box
  doc.rect(30, 30, 535, 782).stroke('#94a3b8');
  doc.rect(34, 34, 527, 774).stroke('#cbd5e1');

  doc.font('Helvetica-Bold').fontSize(16).fillColor('#0f172a').text('REPUBLIC OF KENYA', { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(11).fillColor('#334155').text('THE REGISTRATION OF TITLES ACT (CAP. 281)', { align: 'center' });
  doc.fontSize(14).fillColor('#b45309').text('CERTIFICATE OF TITLE', { align: 'center' });
  doc.moveDown(1);

  doc.fontSize(10).fillColor('#000');
  doc.font('Helvetica-Bold').text('TITLE NO: ', { continued: true }).font('Helvetica').text('NAIROBI/BLOCK 82/104');
  doc.font('Helvetica-Bold').text('APPROXIMATE AREA: ', { continued: true }).font('Helvetica').text('0.450 Hectares (1.112 Acres)');
  doc.font('Helvetica-Bold').text('REGISTRY MAP SHEET NO: ', { continued: true }).font('Helvetica').text('Sheet 14, Plan No. 492/IX');
  doc.moveDown(1);

  doc.text('This is to certify that ', { continued: true });
  doc.font('Helvetica-Bold').text('SAMUEL OGOLA (ID NO. 22894012)', { continued: true });
  doc.font('Helvetica').text(' is now registered as the absolute proprietor as lessee from the Government of Kenya of ALL THAT piece of land situate in the City of Nairobi containing by measurement 0.450 Hectares or thereabouts.');
  doc.moveDown(1);

  doc.font('Helvetica-Bold').text('MEMORANDUM OF ENCUMBRANCES, LEASES AND CHARGES:');
  doc.moveDown(0.5);

  // Table header
  const tableTop = doc.y;
  doc.rect(50, tableTop, 495, 20).fill('#f1f5f9');
  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(9);
  doc.text('Entry No.', 55, tableTop + 5);
  doc.text('Nature of Encumbrance', 120, tableTop + 5);
  doc.text('Amount / Ref', 340, tableTop + 5);
  doc.text('Date', 450, tableTop + 5);

  let y = tableTop + 25;
  doc.font('Helvetica').fontSize(8.5);
  
  // Row 1
  doc.text('1', 55, y);
  doc.text('Grant under Crown Lands Ordinance (99 Years)', 120, y);
  doc.text('Annual Rent KES 4,500', 340, y);
  doc.text('12/08/1998', 450, y);
  y += 18;

  // Row 2
  doc.text('2', 55, y);
  doc.text('Charge to NCBA Bank Kenya PLC', 120, y);
  doc.text('KES 12,000,000', 340, y);
  doc.text('04/11/2015', 450, y);
  y += 18;

  // Row 3
  doc.text('3', 55, y);
  doc.text('Discharge of Charge (NCBA Bank Kenya PLC)', 120, y);
  doc.text('FULL DISCHARGE', 340, y);
  doc.text('19/01/2022', 450, y);
  y += 30;

  doc.y = y;
  doc.font('Helvetica-Bold').fontSize(10).text('GIVEN under my hand and the Official Seal of the Land Registry at Nairobi this 12th day of August 1998.');
  doc.moveDown(2);

  // Seal box
  doc.rect(70, doc.y, 100, 70).stroke('#b45309');
  doc.fontSize(8).fillColor('#b45309').text('OFFICIAL SEAL\nLAND REGISTRY\nNAIROBI', 80, doc.y + 20, { align: 'center' });

  doc.fontSize(10).fillColor('#000');
  doc.text('_____________________________________', 300, doc.y - 40);
  doc.font('Helvetica-Bold').text('CHIEF LAND REGISTRAR', 300, doc.y);
  doc.font('Helvetica').fontSize(8).text('REPUBLIC OF KENYA', 300, doc.y);

  doc.end();
}

// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENT 3: Witness Statement of Eng. Peter Akwala
// ─────────────────────────────────────────────────────────────────────────────
function generateWitnessStatement() {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  const stream = fs.createWriteStream(path.join(outputDir, '03_Witness_Statement_Akwala.pdf'));
  doc.pipe(stream);

  doc.font('Helvetica-Bold').fontSize(12).text('IN THE ENVIRONMENT AND LAND COURT AT NAIROBI', { align: 'center' });
  doc.fontSize(10).text('ELC SUIT NO. E042 OF 2024', { align: 'center' });
  doc.moveDown(0.5);
  doc.text('SAMUEL OGOLA ............................................................................ PLAINTIFF');
  doc.text('VERSUS');
  doc.text('KILIMANI PROPERTIES LIMITED & ANOTHER .......................... DEFENDANTS');
  doc.moveDown(1);

  doc.font('Helvetica-Bold').fontSize(12).text('WITNESS STATEMENT OF ENG. PETER AKWALA (CHIEF SURVEYOR)', { align: 'center', underline: true });
  doc.moveDown(1);

  doc.font('Helvetica').fontSize(10).text('I, ENG. PETER AKWALA, a Licensed Surveyor of Post Office Box Number 19203-00100 Nairobi in the Republic of Kenya do hereby state as follows:', { lineGap: 4 });
  doc.moveDown(0.5);

  doc.text('1. I am a registered surveyor under the Surveyors Act (Cap 299) with over 22 years of continuous practice in cadastral mapping, geodetic surveys, and boundary verification across Kenya.', { lineGap: 4 });
  doc.moveDown(0.5);

  doc.text('2. On 14th February 2024, I was instructed by the Plaintiff, Mr. Samuel Ogola, to carry out a comprehensive boundary re-establishment survey on parcel LR NAIROBI/BLOCK 82/104.', { lineGap: 4 });
  doc.moveDown(0.5);

  doc.text('3. Accompanied by my survey crew, I deployed Trimble R10 GNSS RTK survey equipment anchored onto Survey Control Beacon SK-104 located along Argwings Kodhek Road.', { lineGap: 4 });
  doc.moveDown(0.5);

  doc.text('4. UPON FIELD INVESTIGATION AND BEACON RE-ESTABLISHMENT, I OBSERVED THE FOLLOWING:', { font: 'Helvetica-Bold' });
  doc.text('   (a) Beacon No. 82/104/NW had been forcibly uprooted and shifted 3.20 meters southwards into the Plaintiff property.');
  doc.text('   (b) The 1st Defendant had erected a temporary pre-cast concrete boundary wall encroaching over an area of 144.0 square meters belonging to the Plaintiff.');
  doc.text('   (c) Heavy excavator tire tracks were noted inside the Plaintiff boundary with significant topsoil excavation.');
  doc.moveDown(1);

  doc.text('5. I compiled Cadastral Survey Plan No. PA/2024/082 attached hereto as Exhibit PA-1 confirming the exact encroachment dimensions.', { lineGap: 4 });
  doc.moveDown(0.5);

  doc.text('6. I confirm that the statements made herein are true to the best of my knowledge, information, and expert belief.', { lineGap: 4 });
  doc.moveDown(1.5);

  doc.font('Helvetica-Bold').text('DATED at NAIROBI this 20th day of February 2024.');
  doc.moveDown(1.5);
  
  doc.text('_____________________________________');
  doc.text('ENG. PETER AKWALA, MISK');
  doc.font('Helvetica').fontSize(9).text('Licensed Surveyor (Reg No. MISK/294/2002)');

  doc.moveDown(1.5);
  doc.font('Helvetica-Bold').fontSize(9).text('DRAWN & FILED BY:');
  doc.font('Helvetica').text('SAM OGOLA & CO. ADVOCATES, NAIROBI');

  doc.end();
}

// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENT 4: Judiciary eFiling Assessment Receipt
// ─────────────────────────────────────────────────────────────────────────────
function generateJudiciaryReceipt() {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  const stream = fs.createWriteStream(path.join(outputDir, '04_Judiciary_eFiling_Receipt_PRN.pdf'));
  doc.pipe(stream);

  // Judiciary Header Box
  doc.rect(40, 40, 515, 80).fill('#064e3b');
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(16).text('KENYA JUDICIARY eFILING PORTAL', 50, 55, { align: 'center' });
  doc.fontSize(10).text('OFFICIAL COURT ASSESSMENT & PAYMENT RECEIPT', { align: 'center' });
  doc.fontSize(9).text('HTTP://EFILING.COURT.GO.KE · PRN: 2026-8849-0192', { align: 'center' });

  doc.moveDown(3);
  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(10);
  
  // Details grid
  doc.text('PAYMENT REFERENCE (PRN): ', 50, doc.y, { continued: true }).font('Helvetica').text('2026-8849-0192');
  doc.font('Helvetica-Bold').text('M-PESA TRANSACTION CODE: ', { continued: true }).font('Helvetica').text('RBL9948271');
  doc.font('Helvetica-Bold').text('PAYMENT DATE & TIME: ', { continued: true }).font('Helvetica').text('18th March 2024 at 10:42:15 EAT');
  doc.font('Helvetica-Bold').text('COURT STATION: ', { continued: true }).font('Helvetica').text('Milimani Environment & Land Court');
  doc.font('Helvetica-Bold').text('CASE NUMBER: ', { continued: true }).font('Helvetica').text('ELC SUIT NO. E042 OF 2024');
  doc.font('Helvetica-Bold').text('CASE TITLE: ', { continued: true }).font('Helvetica').text('SAMUEL OGOLA vs KILIMANI PROPERTIES LTD');
  doc.font('Helvetica-Bold').text('PAYER / ADVOCATE: ', { continued: true }).font('Helvetica').text('SAM OGOLA & CO. ADVOCATES (P.105/14920/22)');
  doc.moveDown(1.5);

  // Fee Table
  const tY = doc.y;
  doc.rect(50, tY, 495, 20).fill('#0f172a');
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9);
  doc.text('Item Code', 60, tY + 5);
  doc.text('Description of Assessment Fee', 150, tY + 5);
  doc.text('Qty', 390, tY + 5);
  doc.text('Amount (KES)', 440, tY + 5);

  let rowY = tY + 25;
  doc.fillColor('#0f172a').font('Helvetica').fontSize(9);

  const fees = [
    ['FEE-001', 'Plaint & Statement of Claim Assessment Fee', '1', '15,500.00'],
    ['FEE-014', 'Certificate of Urgency Application', '1', '2,500.00'],
    ['FEE-022', 'Summons to Enter Appearance (x2 Defendants)', '2', '500.00'],
    ['FEE-088', 'Judiciary ICT Processing & Archival Levy', '1', '500.00']
  ];

  fees.forEach(f => {
    doc.text(f[0], 60, rowY);
    doc.text(f[1], 150, rowY);
    doc.text(f[2], 390, rowY);
    doc.text(f[3], 440, rowY);
    rowY += 20;
  });

  doc.moveTo(50, rowY).lineTo(545, rowY).stroke('#94a3b8');
  rowY += 8;

  doc.font('Helvetica-Bold').fontSize(11);
  doc.text('TOTAL AMOUNT PAID (KES):', 250, rowY);
  doc.fillColor('#047857').text('KES 19,000.00', 440, rowY);
  doc.fillColor('#0f172a');

  rowY += 40;
  doc.rect(50, rowY, 495, 50).fill('#f8fafc').stroke('#cbd5e1');
  doc.fillColor('#334155').font('Helvetica').fontSize(8.5);
  doc.text('STATUS: VERIFIED & CLEARED BY JUDICIARY REGISTRY SYSTEM', 60, rowY + 12);
  doc.text('PAYBILL NO: 553388 (KENYA JUDICIARY E-FILING ACCOUNT)', 60, rowY + 26);
  doc.text('This electronic receipt is computer-generated and legally valid without physical stamp.', 60, rowY + 38);

  doc.end();
}

// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENT 5: Bank Audit Trail Statement (NCBA)
// ─────────────────────────────────────────────────────────────────────────────
function generateBankStatement() {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  const stream = fs.createWriteStream(path.join(outputDir, '05_Bank_Audit_Trail_Statement.pdf'));
  doc.pipe(stream);

  // NCBA Header
  doc.font('Helvetica-Bold').fontSize(16).fillColor('#0369a1').text('NCBA BANK KENYA PLC', 50, 50);
  doc.font('Helvetica').fontSize(9).fillColor('#475569').text('Commercial Banking Division · Upper Hill Branch, Nairobi');
  doc.text('Tel: +254 20 2884000 · Swift: NCBAKENA');
  doc.moveDown(1.5);

  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(13).text('CLIENT TRUST ACCOUNT STATEMENT', { align: 'center', underline: true });
  doc.moveDown(1);

  doc.font('Helvetica-Bold').fontSize(9);
  doc.text('ACCOUNT NAME: ', 50, doc.y, { continued: true }).font('Helvetica').text('SAM OGOLA & CO ADVOCATES - CLIENT TRUST A/C');
  doc.font('Helvetica-Bold').text('ACCOUNT NUMBER: ', { continued: true }).font('Helvetica').text('01802930293100');
  doc.font('Helvetica-Bold').text('CASE REFERENCE: ', { continued: true }).font('Helvetica').text('SO/104/26 (ELC SUIT NO. E042/2024)');
  doc.font('Helvetica-Bold').text('STATEMENT PERIOD: ', { continued: true }).font('Helvetica').text('01 February 2024 to 31 March 2024');
  doc.moveDown(1.5);

  // Table Header
  const bY = doc.y;
  doc.rect(50, bY, 495, 20).fill('#0369a1');
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8.5);
  doc.text('Date', 55, bY + 5);
  doc.text('Transaction Details', 120, bY + 5);
  doc.text('Ref / M-Pesa', 280, bY + 5);
  doc.text('Debit (KES)', 360, bY + 5);
  doc.text('Credit (KES)', 425, bY + 5);
  doc.text('Balance (KES)', 485, bY + 5);

  let rY = bY + 25;
  doc.fillColor('#0f172a').font('Helvetica').fontSize(8);

  const txs = [
    ['01/02/2024', 'Opening Balance Brought Forward', 'BAL-FWD', '-', '-', '120,000.00'],
    ['10/02/2024', 'Client Retainer Deposit - Samuel Ogola', 'RTGS-9921', '-', '500,000.00', '620,000.00'],
    ['18/02/2024', 'Judiciary eFiling PRN 2026-8849 Assessment', 'RBL9948271', '19,000.00', '-', '601,000.00'],
    ['22/02/2024', 'Boundary Survey Professional Fee (Eng. Akwala)', 'EFT-00491', '75,000.00', '-', '526,000.00'],
    ['05/03/2024', 'Land Registry Search & Beacon Verification', 'MPESA-QW11', '8,500.00', '-', '517,500.00'],
    ['18/03/2024', 'Court Process Server Expenses (Milimani)', 'CASH-991', '12,000.00', '-', '505,500.00']
  ];

  txs.forEach(t => {
    doc.text(t[0], 55, rY);
    doc.text(t[1], 120, rY);
    doc.text(t[2], 280, rY);
    doc.text(t[3], 360, rY);
    doc.text(t[4], 425, rY);
    doc.text(t[5], 485, rY);
    rY += 18;
  });

  doc.moveTo(50, rY).lineTo(545, rY).stroke('#0369a1');
  rY += 10;

  doc.font('Helvetica-Bold').fontSize(9);
  doc.text('CLOSING TRUST BALANCE AS AT 31/03/2024:', 180, rY);
  doc.fillColor('#0284c7').text('KES 505,500.00', 440, rY);

  rY += 40;
  doc.fillColor('#475569').font('Helvetica').fontSize(8);
  doc.text('Certified True Copy of Bank Audit Trail. Generated by NCBA Core Banking System.', 50, rY, { align: 'center' });

  doc.end();
}

// Generate all 5 PDFs
try {
  generatePlaint();
  generateTitleDeed();
  generateWitnessStatement();
  generateJudiciaryReceipt();
  generateBankStatement();
  console.log('Successfully generated 5 hyper-realistic test PDFs in mock_tests folder!');
} catch (err) {
  console.error('Error generating PDFs:', err);
}
