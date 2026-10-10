import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { trendReports } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 获取趋势分析历史列表
 * GET /api/trends/list?limit=10&offset=0
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit')) || 20, 100);
    const offset = parseInt(searchParams.get('offset')) || 0;

    // 查询报告列表，仅返回摘要数据（不返回完整content）
    const reports = await db
      .select({
        id: trendReports.id,
        query: trendReports.query,
        summary: trendReports.summary,
        overallSentiment: trendReports.overallSentiment,
        sentimentScore: trendReports.sentimentScore,
        addTs: trendReports.addTs,
      })
      .from(trendReports)
      .orderBy(desc(trendReports.addTs))
      .limit(limit)
      .offset(offset);

    // 获取总数
    const countResult = await db
      .select({ count: trendReports.id })
      .from(trendReports);

    const totalCount = countResult.length;

    // 格式化时间
    const formattedReports = reports.map(report => ({
      ...report,
      generatedAt: new Date(report.addTs).toISOString(),
      timestamp: report.addTs,
    }));

    return NextResponse.json({
      success: true,
      data: {
        reports: formattedReports,
        pagination: {
          total: totalCount,
          limit,
          offset,
          hasMore: offset + limit < totalCount,
        }
      }
    });

  } catch (error) {
    console.error('获取趋势报告列表失败:', error);
    return NextResponse.json(
      { success: false, error: '获取列表失败' },
      { status: 500 }
    );
  }
}
