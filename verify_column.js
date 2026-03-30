const { Client } = require('pg');

async function testPooler() {
  const client = new Client({
    host: 'aws-0-us-east-1.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    user: 'postgres.iygpnvihbhjkwbkkkwvq',
    password: 'q2Ec168dvPFJTPPC',
    ssl: { rejectUnauthorized: false }
  });
  try {
    await client.connect();
    const res = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'StackItem' AND column_name = 'scheduleDays'`);
    console.log('POOLER (6543):', res.rows.length > 0 ? 'scheduleDays EXISTS' : 'scheduleDays MISSING');
    await client.end();
  } catch(e) {
    console.log('POOLER ERROR:', e.message);
  }
}

async function testDirect() {
  const client = new Client({
    host: 'db.iygpnvihbhjkwbkkkwvq.supabase.co',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: 'q2Ec168dvPFJTPPC',
    ssl: { rejectUnauthorized: false }
  });
  try {
    await client.connect();
    const res = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'StackItem' AND column_name = 'scheduleDays'`);
    console.log('DIRECT (5432):', res.rows.length > 0 ? 'scheduleDays EXISTS' : 'scheduleDays MISSING');
    await client.end();
  } catch(e) {
    console.log('DIRECT ERROR:', e.message);
  }
}

testDirect().then(() => testPooler());
