import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { trendReports, trendTopics, trendDimensions } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // 确保不缓存，获取最新数据

export async function GET() {
  try {
    // 1. 获取最新的一条分析报告
    const reports = await db
      .select()
      .from(trendReports)
      .orderBy(desc(trendReports.addTs))
      .limit(1);

    if (!reports || reports.length === 0) {
      return NextResponse.json({
        success: true,
        data: null,
        message: '暂无趋势分析数据'
      });
    }

    const report = reports[0];

    // 2. 并行获取关联的话题和维度数据
    const [topics, dimensions] = await Promise.all([
      db.select().from(trendTopics).where(eq(trendTopics.reportId, report.id)),
      db.select().from(trendDimensions).where(eq(trendDimensions.reportId, report.id))
    ]);

    // 3. 组装返回数据
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
    console.error('获取最新趋势分析失败:', error);
    return NextResponse.json(
      { success: false, error: '获取数据失败' },
      { status: 500 }
    );
  }
}