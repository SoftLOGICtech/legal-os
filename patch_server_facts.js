const fs = require('fs');

let serverCode = fs.readFileSync('backend/server.js', 'utf8');

// I will just replace the previously added endpoints with the corrected ones using string replacement
const oldEndpoints = `
// --- Case Facts, Issues, Contacts (Chronology) ---
app.get('/api/cases/:case_id/issues', (req, res) => {
    db.all('SELECT * FROM case_issues WHERE case_id = ? ORDER BY created_at ASC', [req.params.case_id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});
app.post('/api/cases/:case_id/issues', (req, res) => {
    const { name, color } = req.body;
    const id = 'iss_' + Date.now();
    db.run('INSERT INTO case_issues (id, case_id, name, color) VALUES (?,?,?,?)',
        [id, req.params.case_id, name, color || '#c9a84c'], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id });
    });
});

app.get('/api/cases/:case_id/witnesses', (req, res) => {
    db.all('SELECT * FROM case_contacts WHERE case_id = ? ORDER BY created_at ASC', [req.params.case_id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});
app.post('/api/cases/:case_id/witnesses', (req, res) => {
    const { name, role, email, phone } = req.body;
    const id = 'cnt_' + Date.now();
    db.run('INSERT INTO case_contacts (id, case_id, name, role, email, phone) VALUES (?,?,?,?,?,?)',
        [id, req.params.case_id, name, role, email, phone], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id });
    });
});

app.get('/api/cases/:case_id/facts', (req, res) => {
    db.all('SELECT * FROM case_facts WHERE case_id = ? ORDER BY fact_date ASC', [req.params.case_id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        // parse JSON fields
        const parsedRows = rows.map(r => ({
            ...r,
            issues: JSON.parse(r.issues_json || '[]'),
            witness_ids: JSON.parse(r.contacts_json || '[]'),
            sources: JSON.parse(r.sources_json || '[]')
        }));
        res.json(parsedRows);
    });
});
app.post('/api/cases/:case_id/facts', (req, res) => {
    const { fact_date, description, pincite, status, sources, witness_ids, issue_ids, notes, color, source_text } = req.body;
    const id = 'fct_' + Date.now();
    
    // We need to fetch the issue objects to return them in 'issues' array or just save issue_ids in issues_json
    // Actually DocReviewer uses f.issues to display them. So we should fetch issue details.
    db.all('SELECT * FROM case_issues WHERE case_id = ?', [req.params.case_id], (err, caseIssues) => {
        let issues = [];
        if (!err && caseIssues) {
            issues = caseIssues.filter(i => (issue_ids || []).includes(i.id));
        }
        
        db.run('INSERT INTO case_facts (id, case_id, fact_date, description, status, notes, issues_json, contacts_json, sources_json, color, source_text) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
            [id, req.params.case_id, fact_date, description, status || 'Procured', notes || '', JSON.stringify(issues), JSON.stringify(witness_ids || []), JSON.stringify(sources || []), color || '#c9a84c', source_text || ''], 
            (err2) => {
                if (err2) return res.status(500).json({ error: err2.message });
                res.json({ success: true, id });
        });
    });
});`;


const newEndpoints = `
// --- Case Facts, Issues, Contacts (Chronology) ---
app.get('/api/cases/:case_id/issues', (req, res) => {
    db.all('SELECT * FROM case_issues WHERE case_id = ? ORDER BY created_at ASC', [req.params.case_id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});
app.post('/api/cases/:case_id/issues', (req, res) => {
    const { name, color } = req.body;
    const id = 'iss_' + Date.now();
    db.run('INSERT INTO case_issues (id, case_id, name, color) VALUES (?,?,?,?)',
        [id, req.params.case_id, name, color || '#4db6ac'], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id });
    });
});

app.get('/api/cases/:case_id/witnesses', (req, res) => {
    db.all('SELECT * FROM witness_roster WHERE case_id = ? ORDER BY created_at ASC', [req.params.case_id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});
app.post('/api/cases/:case_id/witnesses', (req, res) => {
    const { name, role, side } = req.body;
    const id = 'wit_' + Date.now();
    db.run('INSERT INTO witness_roster (id, case_id, name, role, side) VALUES (?,?,?,?,?)',
        [id, req.params.case_id, name, role, side || 'Plaintiff'], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id });
    });
});

app.get('/api/cases/:case_id/facts', (req, res) => {
    db.all('SELECT * FROM extracted_facts WHERE case_id = ? ORDER BY fact_date ASC', [req.params.case_id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        // parse JSON fields
        const parsedRows = rows.map(r => ({
            ...r,
            issues: JSON.parse(r.issues || '[]'),
            witness_ids: JSON.parse(r.contacts || '[]'),
            sources: [] // We can handle sources relationally later, DocReviewer uses pincite
        }));
        res.json(parsedRows);
    });
});
app.post('/api/cases/:case_id/facts', (req, res) => {
    const { fact_date, description, pincite, status, sources, witness_ids, issue_ids, notes, color, source_text } = req.body;
    const id = 'fct_' + Date.now();
    
    // We need to fetch the issue objects to return them in 'issues' array
    db.all('SELECT * FROM case_issues WHERE case_id = ?', [req.params.case_id], (err, caseIssues) => {
        let issues = [];
        if (!err && caseIssues) {
            issues = caseIssues.filter(i => (issue_ids || []).includes(i.id));
        }
        
        db.run('INSERT INTO extracted_facts (id, case_id, fact_date, description, pincite, status, issues, contacts, color, source_text) VALUES (?,?,?,?,?,?,?,?,?,?)',
            [id, req.params.case_id, fact_date, description, pincite || '', status || 'Procured', JSON.stringify(issues), JSON.stringify(witness_ids || []), color || '#c9a84c', source_text || ''], 
            (err2) => {
                if (err2) return res.status(500).json({ error: err2.message });
                res.json({ success: true, id });
        });
    });
});`;

serverCode = serverCode.replace(oldEndpoints, newEndpoints);
fs.writeFileSync('backend/server.js', serverCode);
console.log('Successfully corrected server endpoints');
