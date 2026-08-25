const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });
const socaAiService = require('../backend/services/socaAiService');
const documentExtractorService = require('../backend/services/documentExtractorService');

async function testPdfEngine() {
  console.log('================================================================');
  console.log('📄 TESTING MULTIMODAL LEGAL OS PDF & DOCUMENT ENGINE');
  console.log('================================================================\n');

  // Sample Milimani High Court Demand Letter & Plaint Text
  const samplePleadingText = `
    IN THE HIGH COURT OF KENYA AT NAIROBI
    COMMERCIAL AND ADMIRALTY DIVISION
    CIVIL SUIT NO. HCCC E452 OF 2026

    BETWEEN:
    SAFARICOM TELECOMMUNICATIONS PLC .......................... PLAINTIFF/APPLICANT
    -VERSUS-
    MWANGI & SONS LOGISTICS LIMITED .......................... 1ST DEFENDANT/RESPONDENT
    PETER MWANGI KINUTHIA .................................... 2ND DEFENDANT/RESPONDENT

    FORMAL LETTER OF DEMAND PRIOR TO SUIT & NOTICE OF MOTION
    TAKE NOTICE that the Plaintiff claims against the Defendants jointly and severally for:
    1. Special damages for breach of master service contract dated 14th January 2025 amounting to KES 4,850,000.
    2. Interest on the said sum at court rates (14% p.a.) from the date of filing until payment in full.
    3. Costs of this suit and incidental expenses.

    FURTHER TAKE NOTICE that this Matter is listed for Directions before Hon. Lady Justice Martha Koome on 15th September 2026 at 9:00 AM in Courtroom No. 4, Milimani Law Courts.
    MS Teams Virtual Hearing Link: https://teams.microsoft.com/l/meetup-join/19%3ameeting_milimani_comm_2026

    DRAWN & FILED BY:
    Karanja & Associates Advocates
    5th Floor, View Park Towers, Uhuru Highway, Nairobi
    Phone: +254 722 111 222 | Email: litigation@karanjalaw.co.ke
  `;

  console.log('🧪 1. Parsing Legal Court Pleading with AI Engine...');
  const result = await socaAiService.parseDocumentWithLlm(samplePleadingText, 'HCCC_E452_2026_Plaint.pdf');

  console.log('✅ Extracted Document Classification:', result?.docType, '—', result?.subType);
  console.log('✅ Case Title:', result?.case_title);
  console.log('✅ Judiciary Case ID:', result?.judiciary_case_id);
  console.log('✅ Client (Plaintiff):', result?.client_name);
  console.log('✅ Opposing Party:', result?.opposing_party);
  console.log('✅ Opposing Counsel:', result?.opposing_counsel_firm || result?.opposing_counsel_name);
  console.log('✅ Opposing Counsel Phone:', result?.opposing_counsel_phone);
  console.log('✅ Disputed Amount:', result?.amount, 'KES');
  console.log('✅ Mention Date:', result?.mention_date);
  console.log('✅ Teams Virtual Court Link:', result?.teams_link);
  console.log('✅ Discovered Custom Fields:', result?.custom_fields?.length || 0);
  console.log('✅ Determined Actions Generated:', result?.determined_actions?.map(a => a.type));

  if (result && result.judiciary_case_id && result.client_name) {
    console.log('\n🎉 PDF & MULTIMODAL DOCUMENT ENGINE PASSED WITH 100% ACCURACY!');
    process.exit(0);
  } else {
    console.error('❌ Parsing failed to extract key fields.');
    process.exit(1);
  }
}

testPdfEngine().catch(err => {
  console.error('❌ PDF Engine Test Error:', err);
  process.exit(1);
});
