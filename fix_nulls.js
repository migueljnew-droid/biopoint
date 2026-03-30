const { Client } = require('pg');
const client = new Client({
  host: 'db.iygpnvihbhjkwbkkkwvq.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'q2Ec168dvPFJTPPC',
  ssl: { rejectUnauthorized: false }
});
async function run() {
  await client.connect();
  // Check current state
  const check = await client.query('SELECT id, name, "scheduleDays" FROM "StackItem" LIMIT 10');
  console.log('Current state:');
  check.rows.forEach(r => console.log(`  ${r.name}: scheduleDays = ${JSON.stringify(r.scheduleDays)}`));
  // Set NULL scheduleDays to empty array
  const fix = await client.query(`UPDATE "StackItem" SET "scheduleDays" = '{}' WHERE "scheduleDays" IS NULL`);
  console.log(`Fixed ${fix.rowCount} rows with NULL scheduleDays`);
  // Also set default
  await client.query(`ALTER TABLE "StackItem" ALTER COLUMN "scheduleDays" SET DEFAULT '{}'`);
  console.log('Set default to empty array');
  await client.end();
}
run().catch(e => { console.error(e); process.exit(1); });
