const fs = require('fs');
const path = require('path');

function makePdf(text, filename) {
  const lines = text.split('\n');
  let streamText = 'BT /F1 12 Tf 50 720 Td 14 TL ';
  lines.forEach((line, i) => {
    const escaped = line.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
    if (i === 0) streamText += '(' + escaped + ') Tj ';
    else streamText += '\' (' + escaped + ') Tj ';
  });
  streamText += 'ET';
  
  const streamLen = Buffer.byteLength(streamText);

  const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length ${streamLen} >>
stream
${streamText}
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000244 00000 n 
0000000318 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
397
%%EOF`;

  fs.writeFileSync(filename, pdfContent);
}

const outDir = 'C:/Users/Elitebook/.gemini/antigravity-ide/brain/f226ec83-3005-4d32-a8b1-4bf7fbce48ed/scratch';

makePdf(
`REPUBLIC OF KENYA
TITLE DEED - NAIROBI/BLOCK 82/104

This deed is made on 12th August 1998.
The Commissioner of Lands hereby deposits and registers this parcel to JOHN DOE.
Any transfer requires written consent.

Signature: [Commissioner of Lands]
Stamp: PAID KES 50,000`,
path.join(outDir, 'Land_Title_Deed_1998.pdf')
);

makePdf(
`From: hr.manager@company.com
To: executive.board@company.com
Date: 15th March 2024
Subject: Termination of JD

Let's find an excuse to get rid of him before bonuses are paid.
His performance review was fine, but we can cite cultural fit.

Best,
HR Manager`,
path.join(outDir, 'HR_Termination_Email.pdf')
);

makePdf(
`EQUITY BANK KENYA
Account Statement
Account: 01802930293
Date: 01 Oct 2023 - 31 Oct 2023

Transactions:
12-Oct: INWARD RTGS - KES 10,000 (Purchase of Block 82/104)
15-Oct: ATM WITHDRAWAL - KES 5,000

Balance: KES 15,200`,
path.join(outDir, 'Bank_Statement_Oct_2023.pdf')
);

console.log('PDFs generated successfully!');
