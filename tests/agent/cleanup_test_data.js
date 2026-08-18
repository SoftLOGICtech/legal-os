/**
 * Legal OS Synthetic Advocate Testing Agent - Database Test Data Cleanup
 * Removes synthetic test records (cases, leads, calendar events, invoices) created during test runs
 */

const fetch = require('node-fetch');
const path = require('path');
const db = require('../../backend/database');

async function cleanupTestData() {
  console.log('\n🧹 Cleaning up synthetic test data from local database...');

  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // 1. Delete test cases
      db.run(
        `DELETE FROM case_tracking WHERE case_title LIKE 'SOCA High Court Suit%' OR case_title LIKE 'Agent Case%' OR case_title LIKE 'Conveyancing Matter -%'`,
        function(err) {
          if (!err) console.log(`  - Deleted ${this.changes} test cases.`);
        }
      );

      // 2. Delete test leads
      db.run(
        `DELETE FROM leads WHERE full_name LIKE 'Prospective Client%'`,
        function(err) {
          if (!err) console.log(`  - Deleted ${this.changes} test leads.`);
        }
      );

      // 3. Delete test calendar events
      db.run(
        `DELETE FROM court_calendar WHERE event_title LIKE 'High Court Hearing%' OR event_title LIKE '📜 Submission Deadline: Skeleton Arguments%'`,
        function(err) {
          if (!err) console.log(`  - Deleted ${this.changes} test calendar events.`);
        }
      );

      // 4. Delete test invoices
      db.run(
        `DELETE FROM case_invoices WHERE invoice_number LIKE 'INV-%'`,
        function(err) {
          if (!err) console.log(`  - Deleted ${this.changes} test invoices.`);
        }
      );

      // 5. Delete test submissions
      db.run(
        `DELETE FROM case_submissions WHERE title LIKE 'Skeleton Arguments%'`,
        function(err) {
          if (!err) console.log(`  - Deleted ${this.changes} test submissions.`);
          console.log('✅ Test data cleanup complete! Database is squeaky clean.\n');
          resolve();
        }
      );
    });
  });
}

if (require.main === module) {
  cleanupTestData().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = cleanupTestData;
