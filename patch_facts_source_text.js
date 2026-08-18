const fs = require('fs');

let dbCode = fs.readFileSync('backend/database.js', 'utf8');

// Update database schema to add source_text to extracted_facts
dbCode = dbCode.replace(
  /color TEXT,\s*created_at DATETIME/g,
  `color TEXT,
            source_text TEXT,
            created_at DATETIME`
);

fs.writeFileSync('backend/database.js', dbCode);
console.log('Successfully patched database.js to add source_text to facts');

let serverCode = fs.readFileSync('backend/server.js', 'utf8');

// Update server POST endpoint
serverCode = serverCode.replace(
  /const { fact_date, description, pincite, status, sources, witness_ids, issue_ids, color } = req\.body;/g,
  `const { fact_date, description, pincite, status, sources, witness_ids, issue_ids, color, source_text } = req.body;`
);

serverCode = serverCode.replace(
  /db\.run\('INSERT INTO extracted_facts \(id, case_id, fact_date, description, pincite, status, color\) VALUES \(\?,\?,\?,\?,\?,\?,\?\)',\s*\[id, req\.params\.case_id, fact_date, description, pincite \|\| null, status\|\|'Procured', color \|\| '#c9a84c'\]/g,
  `db.run('INSERT INTO extracted_facts (id, case_id, fact_date, description, pincite, status, color, source_text) VALUES (?,?,?,?,?,?,?,?)',
                  [id, req.params.case_id, fact_date, description, pincite || null, status||'Procured', color || '#c9a84c', source_text || null]`
);

fs.writeFileSync('backend/server.js', serverCode);
console.log('Successfully patched server.js endpoints to handle source_text');
