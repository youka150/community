import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 钻取 API：获取指定日期的活跃用户和话题/问答
 * GET /api/huawei/drilldown?date=2025-12-16
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { success: false, error: '需要提供有效的日期参数 (YYYY-MM-DD)' },
        { status: 400 }
      );
    }

    // 查询该日期的活跃用户
    const usersResult = await db.execute(sql`
      SELECT DISTINCT tc."user" AS user_name
      FROM topics_comments tc
      WHERE DATE(tc.create_time) = ${date}
        AND tc."user" IS NOT NULL AND tc."user" != '匿名用户'
      UNION
      SELECT DISTINCT qc."user" AS user_name
      FROM questions_comments qc
      WHERE DATE(qc.create_time) = ${date}
        AND qc."user" IS NOT NULL AND qc."user" != '匿名用户'
      ORDER BY user_name
    `);

    // 查询该日期的活跃话题
    const topicsResult = await db.execute(sql`
      SELECT t.id, t.title, t."user" AS author, t.url, COUNT(tc.comment_id)::int AS comment_count
      FROM topics t
      JOIN topics_comments tc ON t.id = tc.topic_id
      WHERE DATE(tc.create_time) = ${date}
      GROUP BY t.id, t.title, t."user", t.url
      ORDER BY comment_count DESC
      LIMIT 20
    `);

    // 查询该日期的活跃问答
    const questionsResult = await db.execute(sql`
      SELECT q.id, q.title, q.url, COUNT(qc.comment_id)::int AS comment_count
      FROM questions q
      JOIN questions_comments qc ON q.id = qc.question_id
      WHERE DATE(qc.create_time) = ${date}
      GROUP BY q.id, q.title, q.url
      ORDER BY comment_count DESC
      LIMIT 20
    `);

    const users = Array.isArray(usersResult?.rows) ? usersResult.rows : usersResult;
    const topics = Array.isArray(topicsResult?.rows) ? topicsResult.rows : topicsResult;
    const questions = Array.isArray(questionsResult?.rows) ? questionsResult.rows : questionsResult;

    return NextResponse.json({
      success: true,
      date,
      data: {
        users: users.map((u) => u.user_name),
        topics: topics.map((t) => ({
          id: t.id,
          title: t.title,
          author: t.author,
          url: t.url,
          commentCount: t.comment_count,
        })),
        questions: questions.map((q) => ({
          id: q.id,
          title: q.title,
          url: q.url,
          commentCount: q.comment_count,
        })),
      },
    });
  } catch (error) {
    console.error('Huawei drilldown API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取钻取数据失败',
        details: process.env.NODE_ENV === 'development' ? String(error?.stack || error) : undefined,
      },
      { status: 500 }
    );
  }
}
