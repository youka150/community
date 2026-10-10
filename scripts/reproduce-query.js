const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const { sql } = require('drizzle-orm');
require('dotenv').config({ path: '.env.local' });

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  const client = postgres(process.env.DATABASE_URL);
  const db = drizzle(client);

  const days = 30;
  const endExclusive = addDays(startOfDay(new Date()), 1);
  const start = addDays(endExclusive, -days);

  console.log('Start:', start);
  console.log('End:', endExclusive);

  try {
    console.log('Executing query...');
    const dailyResult = await db.execute(sql`
      WITH daily AS (
        WITH base AS (
          SELECT date_trunc('day', tc.create_time) AS day,
                 tc."user" AS actor,
                 tc.topic_id AS thread_id
          FROM topics_comments tc
          WHERE tc.create_time IS NOT NULL
            AND tc.create_time >= ${start.toISOString()}
            AND tc.create_time < ${endExclusive.toISOString()}
          UNION ALL
          SELECT date_trunc('day', qc.create_time) AS day,
                 qc."user" AS actor,
                 qc.topic_id AS thread_id
          FROM questions_comments qc
          WHERE qc.create_time IS NOT NULL
            AND qc.create_time >= ${start.toISOString()}
            AND qc.create_time < ${endExclusive.toISOString()}
        )
        SELECT day::date AS day,
               COUNT(*)::int AS comments_cnt,
               COUNT(DISTINCT actor)::int AS active_users_cnt,
               COUNT(DISTINCT thread_id)::int AS active_threads_cnt
        FROM base
        GROUP BY day
      ), stats AS (
        SELECT AVG(comments_cnt)::double precision AS mean,
               NULLIF(STDDEV_POP(comments_cnt), 0)::double precision AS std
        FROM daily
      )
      SELECT d.day,
             d.comments_cnt,
             d.active_users_cnt,
             d.active_threads_cnt,
             COALESCE((d.comments_cnt - s.mean) / s.std, 0)::double precision AS zscore
      FROM daily d
      CROSS JOIN stats s
      ORDER BY d.day ASC;
    `);
    
    console.log('Query success!');
    console.log('Rows:', dailyResult.length);
  } catch (error) {
    console.error('Query failed:', error);
  } finally {
    await client.end();
  }
}

main();
