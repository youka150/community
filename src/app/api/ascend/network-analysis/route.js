import { NextResponse } from 'next/server';
import { parseDateRange, getBaseUrl } from '../_utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 昇腾网络分析（排行）API — 代理到 Python 后端 /api/ascend/network-analysis
 */
export async function GET(request) {
  try {
    const url = new URL(request.url);
    const topN = url.searchParams.get('top_n') || '30';
    const { start, endExclusive } = parseDateRange(request);
    const startDate = start.toISOString().split('T')[0];
    const endDate = endExclusive.toISOString().split('T')[0];

    const base = getBaseUrl().replace(/\/$/, '');
    const params = new URLSearchParams({ start_date: startDate, end_date: endDate, top_n: topN });
    const weightKeys = ['pagerank', 'in_degree', 'betweenness', 'quality', 'innovation', 'sentiment', 'diversity', 'consistency'];
    weightKeys.forEach((key) => {
      const v = url.searchParams.get(`weight_${key}`);
      if (v !== null && v !== '') {
        params.set(`weight_${key}`, v);
      }
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60_000);
    const resp = await fetch(`${base}/api/ascend/network-analysis?${params.toString()}`, {
      method: 'GET', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
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
      { success: false, error: isAbort ? '昇腾网络分析服务超时' : '调用昇腾网络分析服务失败', details: process.env.NODE_ENV === 'development' ? String(error?.stack || error) : undefined },
      { status: 500 }
    );
  }
}
