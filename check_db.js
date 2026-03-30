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
  const stacks = await client.query('SELECT id, name FROM "Stack" LIMIT 10');
  console.log(`Stacks: ${stacks.rowCount}`);
  stacks.rows.forEach(r => console.log(`  ${r.id}: ${r.name}`));
  const items = await client.query('SELECT id, name, "scheduleDays", frequency FROM "StackItem" LIMIT 20');
  console.log(`Items: ${items.rowCount}`);
  items.rows.forEach(r => console.log(`  ${r.name}: freq=${r.frequency}, days=${JSON.stringify(r.scheduleDays)}`));
  // Test the exact query Prisma would run
  const test = await client.query('SELECT * FROM "StackItem" LIMIT 1');
  if (test.rows[0]) console.log('Sample row keys:', Object.keys(test.rows[0]).join(', '));
  await client.end();
}
run().catch(e => { console.error(e); process.exit(1); });
