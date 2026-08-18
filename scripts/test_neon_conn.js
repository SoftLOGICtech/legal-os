const { Pool } = require('pg');

const DATABASE_URL = "postgresql://neondb_owner:npg_s3aNemClp9LD@ep-royal-shadow-b1ommb70.c-5.eu-central-1.aws.neon.tech/neondb?sslmode=require";

async function testNeon() {
  console.log("Connecting to Neon PostgreSQL...");
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const res = await pool.query("SELECT NOW(), version();");
    console.log("Connected successfully to Neon Postgres!");
    console.log("Server Time:", res.rows[0].now);
    console.log("Version:", res.rows[0].version);
  } catch (err) {
    console.error("Connection failed:", err.message);
  } finally {
    await pool.end();
  }
}

testNeon();
