const fs = require('fs');

let dbCode = fs.readFileSync('backend/database.js', 'utf8');

const tableCreationStr = `
        db.run(\`CREATE TABLE IF NOT EXISTS extracted_facts (
            id TEXT PRIMARY KEY,
            case_id TEXT,
            fact_date TEXT,
            description TEXT,
            pincite TEXT,
            status TEXT,
            issues TEXT,
            contacts TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )\`);

        db.run(\`CREATE TABLE IF NOT EXISTS fact_sources (
            id TEXT PRIMARY KEY,
            fact_id TEXT,
            file_id TEXT,
            pincite TEXT
        )\`);

        db.run(\`CREATE TABLE IF NOT EXISTS fact_witnesses (
            fact_id TEXT,
            witness_id TEXT,
            PRIMARY KEY(fact_id, witness_id)
        )\`);

        db.run(\`CREATE TABLE IF NOT EXISTS fact_issues (
            fact_id TEXT,
            issue_id TEXT,
            PRIMARY KEY(fact_id, issue_id)
        )\`);

        db.run(\`CREATE TABLE IF NOT EXISTS witness_roster (
            id TEXT PRIMARY KEY,
            case_id TEXT,
            name TEXT,
            role TEXT,
            side TEXT,
            status TEXT,
            notes TEXT,
            concessions TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )\`);
`;

// Insert the new tables after case_files (avoid duplicating case_issues which I already added)
dbCode = dbCode.replace(
  /db\.run\(`CREATE TABLE IF NOT EXISTS case_issues[^`]+`\);/,
  match => match + '\n' + tableCreationStr
);

const newTablesArray = `'leads', 'case_tracking', 'whatsapp_sessions', 'court_calendar', 
        'case_activities', 'firm_expenses', 'case_payments', 'users', 
        'case_files', 'case_invoices', 'case_disbursements',
        'case_facts', 'case_issues', 'case_contacts',
        'extracted_facts', 'fact_sources', 'fact_witnesses', 'fact_issues', 'witness_roster'`;

dbCode = dbCode.replace(
  /'leads', 'case_tracking', 'whatsapp_sessions', 'court_calendar', \s*'case_activities', 'firm_expenses', 'case_payments', 'users', \s*'case_files', 'case_invoices', 'case_disbursements',\s*'case_facts', 'case_issues', 'case_contacts'/g,
  newTablesArray
);

// Add seeding for witness_roster
const seedCode = `
        defaultContacts.forEach((contact, i) => {
            db.run(\`INSERT INTO witness_roster (id, case_id, name, role) VALUES (?, ?, ?, ?)\`, ['wit_' + crypto.randomBytes(3).toString('hex'), c1, contact, 'Witness']);
            db.run(\`INSERT INTO witness_roster (id, case_id, name, role) VALUES (?, ?, ?, ?)\`, ['wit_' + crypto.randomBytes(3).toString('hex'), c2, contact, 'Witness']);
        });
`;

// Append seeding
dbCode = dbCode.replace(
  /defaultContacts\.forEach\(\(contact, i\) => \{[^}]+}\);/,
  match => match + '\n' + seedCode
);

fs.writeFileSync('backend/database.js', dbCode);
console.log('Successfully patched database.js with exact fact schema');
