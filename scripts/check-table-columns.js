import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  const client = postgres(process.env.DATABASE_URL);
  
  try {
    console.log('Checking columns for table topics_comments...');
    const result = await client`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'topics_comments'
    `;
    console.log('Columns:', result);
    
    console.log('\nChecking columns for table topics...');
    const resultTopics = await client`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'topics'
    `;
    console.log('Columns:', resultTopics);

  } catch (error) {
    console.error('Query failed:', error);
  } finally {
    await client.end();
  }
}

main();
