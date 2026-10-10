const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
require('dotenv').config({ path: '.env.local' });

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  console.log('Connecting to database...');
  // 屏蔽具体密码信息
  console.log('Connection string starts with:', process.env.DATABASE_URL.substring(0, 15) + '...');

  const client = postgres(process.env.DATABASE_URL);
  const db = drizzle(client);

  try {
    console.log('Running test query...');
    const result = await db.execute('SELECT NOW()');
    console.log('Query successful:', result);
  } catch (error) {
    console.error('Database connection or query failed:', error);
  } finally {
    await client.end();
  }
}

main();
