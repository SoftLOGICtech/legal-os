const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // Patch Conveyancing
    db.run(`UPDATE case_tracking SET milestones_json = '["Drafting Sale Agreement", "Execution", "Payment of Duties", "Registration", "Title Transfer"]' WHERE case_type = 'Conveyancing'`);
    // Patch Corporate Law
    db.run(`UPDATE case_tracking SET milestones_json = '["Initial Consultation", "Drafting Articles", "Regulatory Filing", "Compliance Review", "Final Certificates"]' WHERE case_type = 'Corporate Law'`);
    // Patch Litigation
    db.run(`UPDATE case_tracking SET milestones_json = '["Filing in Court", "Mention/Directions", "Hearing Phase", "Judgment", "Execution"]' WHERE case_type = 'Litigation'`);
    
    console.log("Database successfully patched with milestone data.");
});
db.close();
