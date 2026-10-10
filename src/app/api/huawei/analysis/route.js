import { NextResponse } from 'next/server';
import { clampInt, parseDateRange } from '../_utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getBaseUrl() {
  return process.env.HUAWEI_MINING_BASE_URL || 'http://127.0.0.1:8008';
}

/**
 * 统一的分析API：代理调用Python分析服务
 * 支持的endpoint参数：
 * - topics: LDA主题分析
 * - network-analysis: 社会网络分析
 * - user-profiles: 用户画像聚类
 * - ai-analysis: 完整的AI智能分析
 * 
 * 流式参数 stream=1 时，ai-analysis 端点会使用 SSE 透传
 */
export async function GET(request) {
  try {
    const url = new URL(request.url);
    const endpoint = url.searchParams.get('endpoint') || 'ai-analysis';
    const isStream = url.searchParams.get('stream') === '1';
    
    // 使用统一的日期解析逻辑 (支持 useAllData=1)
    const { start, endExclusive } = parseDateRange(request);
    const startDate = start.toISOString().split('T')[0];
    const endDate = endExclusive.toISOString().split('T')[0];
    const nTopics = clampInt(url.searchParams.get('nTopics'), { min: 2, max: 20, fallback: 8 });
    const nClusters = clampInt(url.searchParams.get('nClusters'), { min: 2, max: 10, fallback: 5 });
    const topN = clampInt(url.searchParams.get('topN') || url.searchParams.get('top_n'), { min: 5, max: 100, fallback: 20 });
    const weightKeys = ['pagerank', 'in_degree', 'betweenness', 'quality', 'innovation', 'sentiment', 'diversity', 'consistency'];

    const base = getBaseUrl().replace(/\/$/, '');

    // ========== 流式模式：SSE 透传 ==========
    if (isStream && endpoint === 'ai-analysis') {
      const insightType = url.searchParams.get('insightType');
      
      // 根据是否有 insightType 决定调用全量流式还是单个流式
      const streamEndpoint = insightType 
        ? `${base}/api/ai-analysis/stream-single?start_date=${startDate}&end_date=${endDate}&insight_type=${insightType}`
        : `${base}/api/ai-analysis/stream?start_date=${startDate}&end_date=${endDate}`;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 300_000); // 5分钟超时（流式需要更长时间）

      try {
        const resp = await fetch(streamEndpoint, {
          method: 'GET',
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (!resp.ok) {
          const text = await resp.text().catch(() => '');
          return NextResponse.json(
            { success: false, error: `Python 流式服务请求失败: ${resp.status}`, details: text.slice(0, 4000) },
            { status: 502 }
          );
        }

        // 直接透传 SSE 流
        return new Response(resp.body, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        });
      } catch (err) {
        clearTimeout(timer);
        throw err;
      }
    }

    // ========== 非流式模式：保持原有逻辑 ==========
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120_000); // 2分钟超时

    // 构建查询参数
    const params = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
    });
    
    if (endpoint === 'topics') {
      params.set('n_topics', String(nTopics));
    } else if (endpoint === 'user-profiles') {
      params.set('n_clusters', String(nClusters));
    } else if (endpoint === 'network-analysis') {
      params.set('top_n', String(topN));
      weightKeys.forEach((key) => {
        const v = url.searchParams.get(`weight_${key}`);
        if (v !== null && v !== '') {
          params.set(`weight_${key}`, v);
        }
      });
    } else if (endpoint === 'ai-analysis') {
      const insightType = url.searchParams.get('insightType');
      if (insightType) {
        params.set('insight_type', insightType);
      }
    }

    const resp = await fetch(`${base}/api/${endpoint}?${params.toString()}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      return NextResponse.json(
        { success: false, error: `Python 服务请求失败: ${resp.status}`, details: text.slice(0, 4000) },
        { status: 502 }
      );
    }

    const data = await resp.json();
    return NextResponse.json(data);
  } catch (error) {
    const isAbort = String(error?.name || '').toLowerCase().includes('abort');
    return NextResponse.json(
      {
        success: false,
        error: isAbort ? '分析服务超时（请确认 Python 服务已启动）' : '调用分析服务失败',
        details: process.env.NODE_ENV === 'development' ? String(error?.stack || error) : undefined,
      },
      { status: 500 }
    );
  }
}

