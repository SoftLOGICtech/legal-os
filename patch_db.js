const db = require('./backend/database.js');
setTimeout(() => {
    db.serialize(() => {
        db.run("ALTER TABLE extracted_facts ADD COLUMN color TEXT DEFAULT '#c9a84c'", (err) => {
            if (err) console.error(err.message);
            else console.log('Added color column');
        });
        db.run("ALTER TABLE extracted_facts ADD COLUMN source_text TEXT", (err) => {
            if (err) console.error(err.message);
            else console.log('Added source_text column');
            process.exit(0);
        });
    });
}, 1000);
