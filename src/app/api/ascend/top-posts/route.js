import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { clampInt, parseDateRange } from '../_utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseType(value) {
  return value === 'question' ? 'question' : 'topic';
}

function parseMetric(value) {
  if (value === 'views') return 'views';
  if (value === 'likes') return 'likes';
  return 'comments';
}

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const type = parseType(url.searchParams.get('type'));
    const metric = parseMetric(url.searchParams.get('metric'));
    const limit = clampInt(url.searchParams.get('limit'), { min: 1, max: 50, fallback: 10 });
    const { start, endExclusive } = parseDateRange(request, { defaultDays: 30 });
    const startTs = start.toISOString().slice(0, 10).replace(/-/g, '') + '000000';
    const endTs = endExclusive.toISOString().slice(0, 10).replace(/-/g, '') + '000000';

    // 昇腾 topics 和 questions 在同一张表 ascend_topics，通过 is_question 区分
    const isQuestionFilter = type === 'question' ? '1' : '0';

    const orderExpr =
      metric === 'comments'
        ? sql`COALESCE(c.comments_cnt, 0)`
        : metric === 'views'
          ? sql`CAST(COALESCE(NULLIF(t.views, ''), '0') AS INTEGER)`
          : sql`CAST(COALESCE(NULLIF(t.likes, ''), '0') AS INTEGER)`;

    const result = await db.execute(sql`
      WITH c AS (
        SELECT topic_id,
               COUNT(*)::int AS comments_cnt,
               COUNT(DISTINCT COALESCE(NULLIF(author_display_name, ''), author_id))::int AS participants_cnt
        FROM ascend_comments
        WHERE create_time IS NOT NULL
          AND create_time >= ${startTs}
          AND create_time < ${endTs}
          AND topic_id IS NOT NULL
        GROUP BY topic_id
      )
      SELECT t.topic_id AS id,
             t.title,
             t.thread_url AS url,
             t.author_nickname AS author,
             CAST(COALESCE(NULLIF(t.views, ''), '0') AS INTEGER) AS views,
             CAST(COALESCE(NULLIF(t.likes, ''), '0') AS INTEGER) AS likes,
             COALESCE(c.comments_cnt, 0)::int AS comments_cnt,
             COALESCE(c.participants_cnt, 0)::int AS participants_cnt,
             t.section_name,
             CAST(COALESCE(NULLIF(t.is_question, ''), '0') AS INTEGER) AS is_question
      FROM ascend_topics t
      LEFT JOIN c ON c.topic_id = t.topic_id
      WHERE t.title IS NOT NULL
        AND CAST(COALESCE(NULLIF(t.is_question, ''), '0') AS TEXT) = ${isQuestionFilter}
      ORDER BY ${orderExpr} DESC NULLS LAST
      LIMIT ${limit};
    `);

    const rows = Array.isArray(result?.rows) ? result.rows : result;
    return NextResponse.json({
      success: true,
      type,
      metric,
      range: { start: start.toISOString(), endExclusive: endExclusive.toISOString() },
      items: rows.map((r) => ({
        id: r.id,
        title: r.title,
        url: r.url,
        author: r.author,
        views: r.views ?? 0,
        likes: r.likes ?? 0,
        commentsCnt: r.comments_cnt ?? 0,
        participantsCnt: r.participants_cnt ?? 0,
        sectionName: r.section_name || '',
        isQuestion: r.is_question ?? 0,
      })),
    });
  } catch (error) {
    console.error('Ascend top-posts API error:', error);
    return NextResponse.json(
      { success: false, error: '获取昇腾 Top 内容失败', details: process.env.NODE_ENV === 'development' ? String(error?.stack || error) : undefined },
      { status: 500 }
    );
  }
}
