/**
 * 趋势分析API端点
 * POST /api/trend-analysis
 */

import { NextResponse } from 'next/server';
import TrendAnalysisAgent from '@/lib/agents/TrendAgent';
import { db } from '@/lib/db';
import { trendReports, trendTopics, trendDimensions } from '@/lib/db/schema';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5分钟超时

export async function POST(request) {
  try {
    const { query, config } = await request.json();

    // 验证输入
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: '请提供有效的查询内容' },
        { status: 400 }
      );
    }

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        const onLog = (type, message, data) => {
          // 报告流式事件：使用独立的 SSE 事件类型
          if (type === 'report_chunk') {
            controller.enqueue(encoder.encode(`event: report_chunk\ndata: ${JSON.stringify({ content: message })}\n\n`));
            return;
          }
          if (type === 'report_start') {
            controller.enqueue(encoder.encode(`event: report_start\ndata: ${JSON.stringify({ message })}\n\n`));
            return;
          }

          let logMessage = message;
          // 对于info类型且有附加数据的情况，可以格式化一下
          if (type === 'info' && data) {
            logMessage = `${message} ${JSON.stringify(data)}`;
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type, message: logMessage })}\n\n`));
        };

        // 创建Agent实例, 传入日志回调
        const agent = new TrendAnalysisAgent({
          onLog,
          llm: {
            apiKey: process.env.TREND_ANALYSIS_API_KEY,
            baseURL: process.env.TREND_ANALYSIS_BASE_URL,
            modelName: process.env.TREND_ANALYSIS_MODEL_NAME,
          },
          maxReflections: config?.maxReflections || parseInt(process.env.MAX_REFLECTIONS) || 2,
          maxSearchResults: config?.maxSearchResults || parseInt(process.env.MAX_SEARCH_RESULTS) || 10,
        });

        // 异步执行分析，不阻塞响应
        (async () => {
          try {
            const result = await agent.analyze(query.trim());

            if (!result.success) {
              throw new Error(result.error || 'Agent分析失败');
            }

            // 发送最终数据
            const finalData = {
              success: true,
              data: result.data,
              timestamp: new Date().toISOString()
            };

            // 保存到数据库
            try {
              const { data } = result;
              const sentimentInfo = data.sentiment || {};

              // 1. 插入主报告
              const [insertedReport] = await db.insert(trendReports).values({
                query: query.trim(),
                summary: data.report?.summary || '',
                content: data.report?.content || '',
                overallSentiment: sentimentInfo.overall_sentiment || 'neutral',
                sentimentScore: Math.round((sentimentInfo.sentiment_score || 0) * 100),
                sentimentDistribution: JSON.stringify(sentimentInfo.sentiment_distribution || {}),
                addTs: Date.now(),
              }).returning({ id: trendReports.id });

              if (insertedReport) {
                const reportId = insertedReport.id;

                // 2. 插入热点话题
                if (data.hotTopics && data.hotTopics.length > 0) {
                  const topicsToInsert = data.hotTopics.map(topic => ({
                    reportId,
                    topic: topic.topic,
                    category: topic.category || '其他',
                    trend: topic.trend || 'stable',
                    mentions: topic.mentions || 0,
                    sentiment: Math.round((topic.sentiment || 0) * 100), // 存为整数 0-100
                    description: topic.description
                  }));
                  await db.insert(trendTopics).values(topicsToInsert);
                }

                // 3. 插入分析维度
                if (data.dimensions && data.dimensions.length > 0) {
                  const dimensionsToInsert = data.dimensions.map(dim => ({
                    reportId,
                    dimension: dim.dimension,
                    summary: dim.analysis?.summary || '',
                    keyPoints: JSON.stringify(dim.analysis?.key_points || [])
                  }));
                  await db.insert(trendDimensions).values(dimensionsToInsert);
                }

                console.log(`趋势分析结果已保存至数据库，Report ID: ${reportId}`);
              }
            } catch (dbError) {
              console.error('保存趋势分析结果到数据库失败:', dbError);
              // 数据库保存失败不应中断前端显示，只记录错误
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: '警告：分析结果保存到数据库失败，但不影响展示' })}\n\n`));
            }

            controller.enqueue(encoder.encode(`event: end\ndata: ${JSON.stringify(finalData)}\n\n`));

          } catch (error) {
            console.error('趋势分析流错误:', error);
            const errorData = {
              success: false,
              error: error.message || '服务器内部错误',
              details: process.env.NODE_ENV === 'development' ? error.stack : undefined
            };
            controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify(errorData)}\n\n`));
          } finally {
            controller.close();
          }
        })();
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // 关键：告诉 Nginx 或其他代理不要缓冲输出
      },
    });

  } catch (error) {
    console.error('趋势分析API入口错误:', error);
    // 捕获请求解析等早期错误
    return NextResponse.json(
      {
        success: false,
        error: error.message || '服务器内部错误',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

// 健康检查
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'trend-analysis',
    timestamp: new Date().toISOString(),
    config: {
      model: process.env.TREND_ANALYSIS_MODEL_NAME || 'not configured',
      maxReflections: parseInt(process.env.MAX_REFLECTIONS) || 2,
      maxSearchResults: parseInt(process.env.MAX_SEARCH_RESULTS) || 10,
    }
  });
}
