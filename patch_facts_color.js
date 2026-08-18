const fs = require('fs');

let dbCode = fs.readFileSync('backend/database.js', 'utf8');

// Update database schema to add color to extracted_facts
dbCode = dbCode.replace(
  /status TEXT,\s*issues TEXT,\s*contacts TEXT,\s*created_at DATETIME/g,
  `status TEXT,
            issues TEXT,
            contacts TEXT,
            color TEXT,
            created_at DATETIME`
);

fs.writeFileSync('backend/database.js', dbCode);
console.log('Successfully patched database.js to add color to facts');

let serverCode = fs.readFileSync('backend/server.js', 'utf8');

// Update server POST endpoint
serverCode = serverCode.replace(
  /const { fact_date, description, pincite, status, sources, witness_ids, issue_ids } = req\.body;/g,
  `const { fact_date, description, pincite, status, sources, witness_ids, issue_ids, color } = req.body;`
);

serverCode = serverCode.replace(
  /db\.run\('INSERT INTO extracted_facts \(id, case_id, fact_date, description, pincite, status\) VALUES \(\?,\?,\?,\?,\?,\?\)',\s*\[id, req\.params\.case_id, fact_date, description, pincite \|\| null, status\|\|'Procured'\]/g,
  `db.run('INSERT INTO extracted_facts (id, case_id, fact_date, description, pincite, status, color) VALUES (?,?,?,?,?,?,?)',
                  [id, req.params.case_id, fact_date, description, pincite || null, status||'Procured', color || '#c9a84c']`
);

// Update server PUT endpoint
serverCode = serverCode.replace(
  /const { fact_date, description, pincite, issues, contacts, status } = req\.body;/g,
  `const { fact_date, description, pincite, issues, contacts, status, color } = req.body;`
);

serverCode = serverCode.replace(
  /db\.run\('UPDATE extracted_facts SET fact_date=\?, description=\?, pincite=\?, issues=\?, contacts=\?, status=\? WHERE id=\?',\s*\[fact_date, description, pincite, JSON\.stringify\(issues\|\|\[\]\), JSON\.stringify\(contacts\|\|\[\]\), status, req\.params\.id\]/g,
  `db.run('UPDATE extracted_facts SET fact_date=?, description=?, pincite=?, issues=?, contacts=?, status=?, color=? WHERE id=?',
          [fact_date, description, pincite, JSON.stringify(issues||[]), JSON.stringify(contacts||[]), status, color, req.params.id]`
);

fs.writeFileSync('backend/server.js', serverCode);
console.log('Successfully patched server.js endpoints to handle color');
