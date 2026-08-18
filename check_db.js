const db = require('./backend/database.js');
setTimeout(() => {
  // Try leads table which is the case tracking table
  db.all("SELECT id, case_name, client_name FROM leads ORDER BY created_at DESC LIMIT 10", [], (e, r) => {
    if (e) {
      console.log('leads error:', e.message);
      // Try case_tracking differently
      db.all("PRAGMA table_info(case_tracking)", [], (e2, r2) => {
        console.log('case_tracking columns:', JSON.stringify(r2));
        process.exit(0);
      });
    } else {
      console.log('LEADS:', JSON.stringify(r, null, 2));
      db.all("PRAGMA table_info(leads)", [], (e3, r3) => {
        console.log('leads columns:', JSON.stringify(r3?.map(c => c.name)));
        process.exit(0);
      });
    }
  });
}, 1500);
