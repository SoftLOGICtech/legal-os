const fs = require('fs');
let code = fs.readFileSync('dashboard/src/components/DocReviewer.jsx', 'utf8');
code = code.replace(
  '\\`https://cdnjs.cloudflare.com/ajax/libs/pdf.js/\\${pdfjsLib.version}/pdf.worker.min.mjs\\`;',
  '`https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;'
);
fs.writeFileSync('dashboard/src/components/DocReviewer.jsx', code);
console.log('Fixed syntax error!');
