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
    
    console.log(`[TopPosts] Range: ${start.toISOString()} ~ ${endExclusive.toISOString()} (Type: ${type}, Metric: ${metric})`);

    if (type === 'topic') {
      const orderExpr =
        metric === 'comments'
          ? sql`COALESCE(c.comments_cnt, 0)`
          : metric === 'views'
            ? sql`t.views`
            : sql`t.likes`;

      const result = await db.execute(sql`
        WITH c AS (
          SELECT topic_id,
                 COUNT(*)::int AS comments_cnt,
                 COUNT(DISTINCT "user")::int AS participants_cnt
          FROM topics_comments
          WHERE create_time IS NOT NULL
            AND create_time >= ${start.toISOString()}
            AND create_time < ${endExclusive.toISOString()}
            AND topic_id IS NOT NULL
          GROUP BY topic_id
        )
        SELECT t.id,
               t.title,
               t.url,
               t."user" AS author,
               t.views,
               t.likes,
               COALESCE(c.comments_cnt, 0)::int AS comments_cnt,
               COALESCE(c.participants_cnt, 0)::int AS participants_cnt
        FROM topics t
        LEFT JOIN c ON c.topic_id = t.id
        WHERE t.title IS NOT NULL
          AND t."user" IS NOT NULL
          AND t."user" != '匿名用户'
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
        })),
      });
    }

    // question
    // 注意：questions 表结构里未包含作者字段，因此这里只能做“内容 Top 榜”，无法构建 commenter->作者 的边。
    const orderExpr =
      metric === 'comments'
        ? sql`COALESCE(c.comments_cnt, 0)`
        : metric === 'views'
          ? sql`q.views`
          : sql`q.likes`;

    const result = await db.execute(sql`
      WITH c AS (
        SELECT topic_id,
               COUNT(*)::int AS comments_cnt,
               COUNT(DISTINCT "user")::int AS participants_cnt
                  FROM questions_comments
                WHERE create_time IS NOT NULL
                  AND create_time >= ${start.toISOString()}
                  AND create_time < ${endExclusive.toISOString()}
                  AND topic_id IS NOT NULL        GROUP BY topic_id
      )
      SELECT q.id,
             q.title,
             q.url,
             q.views,
             q.likes,
             q.bounties,
             COALESCE(c.comments_cnt, 0)::int AS comments_cnt,
             COALESCE(c.participants_cnt, 0)::int AS participants_cnt
      FROM questions q
      LEFT JOIN c ON c.topic_id = q.id
      WHERE q.title IS NOT NULL
        -- questions表通常没有user字段，如果有的话也应该过滤。假设目前没有。
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
        author: null,
        views: r.views ?? 0,
        likes: r.likes ?? 0,
        bounties: r.bounties ?? 0,
        commentsCnt: r.comments_cnt ?? 0,
        participantsCnt: r.participants_cnt ?? 0,
      })),
    });
  } catch (error) {
    console.error('Huawei top-posts API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取华为 Top 内容失败',
        details: process.env.NODE_ENV === 'development' ? String(error?.stack || error) : undefined,
      },
      { status: 500 }
    );
  }
}
