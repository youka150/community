const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
require('dotenv').config({ path: '.env.local' });

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  const client = postgres(process.env.DATABASE_URL);
  
  try {
    console.log('Checking columns for table questions_comments...');
    const result = await client`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'questions_comments'
    `;
    console.log('Columns:', result);

  } catch (error) {
    console.error('Query failed:', error);
  } finally {
    await client.end();
  }
}

main();
