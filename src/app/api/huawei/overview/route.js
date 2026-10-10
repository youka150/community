import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { parseDateRange } from '../_utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { start, endExclusive } = parseDateRange(request, { defaultDays: 30 });

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

    const summaryResult = await db.execute(sql`
      WITH actors AS (
        SELECT tc."user" AS actor
        FROM topics_comments tc
        WHERE tc.create_time IS NOT NULL
          AND tc.create_time >= ${start.toISOString()}
          AND tc.create_time < ${endExclusive.toISOString()}
        UNION ALL
        SELECT qc."user" AS actor
        FROM questions_comments qc
        WHERE qc.create_time IS NOT NULL
          AND qc.create_time >= ${start.toISOString()}
          AND qc.create_time < ${endExclusive.toISOString()}
      )
      SELECT COUNT(*)::int AS comments_cnt,
             COUNT(DISTINCT actor)::int AS unique_users_cnt
      FROM actors;
    `);

    const daily = Array.isArray(dailyResult?.rows) ? dailyResult.rows : dailyResult;
    const summaryRow = (Array.isArray(summaryResult?.rows) ? summaryResult.rows : summaryResult)?.[0];

    return NextResponse.json({
      success: true,
      range: {
        start: start.toISOString(),
        endExclusive: endExclusive.toISOString(),
      },
      summary: {
        commentsCnt: summaryRow?.comments_cnt ?? 0,
        uniqueUsersCnt: summaryRow?.unique_users_cnt ?? 0,
      },
      series: daily.map((r) => ({
        day: r.day,
        commentsCnt: r.comments_cnt,
        activeUsersCnt: r.active_users_cnt,
        activeThreadsCnt: r.active_threads_cnt,
        zscore: Number(r.zscore ?? 0),
      })),
    });
  } catch (error) {
    console.error('Huawei overview API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取华为趋势概览失败',
        details: process.env.NODE_ENV === 'development' ? String(error?.stack || error) : undefined,
      },
      { status: 500 }
    );
  }
}
