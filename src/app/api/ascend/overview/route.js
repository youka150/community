import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { parseDateRange } from '../_utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { start, endExclusive } = parseDateRange(request, { defaultDays: 30 });
    // 昇腾时间格式: 20260208041236（纯数字字符串，字典序 = 时间序）
    const startTs = start.toISOString().slice(0, 10).replace(/-/g, '') + '000000';
    const endTs = endExclusive.toISOString().slice(0, 10).replace(/-/g, '') + '000000';

    const dailyResult = await db.execute(sql`
      WITH daily AS (
        SELECT
          LEFT(c.create_time, 8) AS day,
          COUNT(*)::int AS comments_cnt,
          COUNT(DISTINCT COALESCE(NULLIF(c.author_display_name, ''), c.author_id))::int AS active_users_cnt,
          COUNT(DISTINCT c.topic_id)::int AS active_threads_cnt
        FROM ascend_comments c
        WHERE c.create_time IS NOT NULL
          AND c.create_time >= ${startTs}
          AND c.create_time < ${endTs}
          AND COALESCE(NULLIF(c.author_display_name, ''), c.author_id) IS NOT NULL
        GROUP BY LEFT(c.create_time, 8)
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
      SELECT
        COUNT(*)::int AS comments_cnt,
        COUNT(DISTINCT COALESCE(NULLIF(author_display_name, ''), author_id))::int AS unique_users_cnt
      FROM ascend_comments
      WHERE create_time IS NOT NULL
        AND create_time >= ${startTs}
        AND create_time < ${endTs}
        AND COALESCE(NULLIF(author_display_name, ''), author_id) IS NOT NULL
    `);

    // 额外统计：话题总数、问答总数
    const topicSummary = await db.execute(sql`
      SELECT
        COUNT(*)::int AS total_topics,
        SUM(CASE WHEN CAST(COALESCE(NULLIF(is_question, ''), '0') AS INTEGER) = 1 THEN 1 ELSE 0 END)::int AS total_questions,
        SUM(CAST(COALESCE(NULLIF(views, ''), '0') AS INTEGER))::bigint AS total_views
      FROM ascend_topics
    `);

    const daily = Array.isArray(dailyResult?.rows) ? dailyResult.rows : dailyResult;
    const summaryRow = (Array.isArray(summaryResult?.rows) ? summaryResult.rows : summaryResult)?.[0];
    const topicRow = (Array.isArray(topicSummary?.rows) ? topicSummary.rows : topicSummary)?.[0];

    // 将 YYYYMMDD 格式转为 YYYY-MM-DD
    const formatDay = (d) => {
      const s = String(d);
      if (s.length >= 8) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
      return s;
    };

    return NextResponse.json({
      success: true,
      range: {
        start: start.toISOString(),
        endExclusive: endExclusive.toISOString(),
      },
      summary: {
        commentsCnt: summaryRow?.comments_cnt ?? 0,
        uniqueUsersCnt: summaryRow?.unique_users_cnt ?? 0,
        totalTopics: topicRow?.total_topics ?? 0,
        totalQuestions: topicRow?.total_questions ?? 0,
        totalViews: Number(topicRow?.total_views ?? 0),
      },
      series: daily.map((r) => ({
        day: formatDay(r.day),
        commentsCnt: r.comments_cnt,
        activeUsersCnt: r.active_users_cnt,
        activeThreadsCnt: r.active_threads_cnt,
        zscore: Number(r.zscore ?? 0),
      })),
    });
  } catch (error) {
    console.error('Ascend overview API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取昇腾趋势概览失败',
        details: process.env.NODE_ENV === 'development' ? String(error?.stack || error) : undefined,
      },
      { status: 500 }
    );
  }
}
