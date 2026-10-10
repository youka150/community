import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { trendReports, trendTopics, trendDimensions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 获取单个趋势分析的完整详情
 * GET /api/trends/[id]
 */
export async function GET(request, { params }) {
  try {
    const { id } = params;

    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json(
        { success: false, error: 'Invalid report ID' },
        { status: 400 }
      );
    }

    const reportId = parseInt(id);

    // 并行获取报告、热点和维度数据
    const [reportResults, topics, dimensions] = await Promise.all([
      db.select().from(trendReports).where(eq(trendReports.id, reportId)),
      db.select().from(trendTopics).where(eq(trendTopics.reportId, reportId)),
      db.select().from(trendDimensions).where(eq(trendDimensions.reportId, reportId))
    ]);

    if (!reportResults || reportResults.length === 0) {
      return NextResponse.json(
        { success: false, error: '报告不存在' },
        { status: 404 }
      );
    }

    const report = reportResults[0];

    // 还原 sentimentDistribution 从 JSON 字符串到对象
    let sentimentDistribution = null;
    try {
      if (report.sentimentDistribution) {
        sentimentDistribution = JSON.parse(report.sentimentDistribution);
      }
    } catch (e) {
      console.error('解析情感分布JSON失败:', e);
    }

    // 还原维度中的 keyPoints
    const formattedDimensions = dimensions.map(dim => {
      let keyPoints = [];
      try {
        if (dim.keyPoints) {
          keyPoints = JSON.parse(dim.keyPoints);
        }
      } catch (e) {
        console.error('解析维度关键点JSON失败:', e);
      }
      return {
        ...dim,
        keyPoints
      };
    });

    const data = {
      report: {
        ...report,
        sentimentDistribution,
        generatedAt: new Date(report.addTs).toISOString()
      },
      hotTopics: topics,
      dimensions: formattedDimensions
    };

    return NextResponse.json({
      success: true,
      data
    });

  } catch (error) {
    console.error('获取趋势分析详情失败:', error);
    return NextResponse.json(
      { success: false, error: '获取数据失败' },
      { status: 500 }
    );
  }
}
