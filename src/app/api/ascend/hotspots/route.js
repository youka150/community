import { NextResponse } from 'next/server';
import { parseDateRange, getBaseUrl } from '../_utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 昇腾商业热点挖掘 API — 代理到 Python 后端 /api/ascend/commercial-hotspots/stream
 */
export async function GET(request) {
  try {
    const url = new URL(request.url);
    const isStream = url.searchParams.get('stream') === '1';
    const { start, endExclusive } = parseDateRange(request);
    const startDate = start.toISOString().split('T')[0];
    const endDate = endExclusive.toISOString().split('T')[0];

    const base = getBaseUrl().replace(/\/$/, '');
    const params = new URLSearchParams({ start_date: startDate, end_date: endDate });

    if (isStream) {
      const streamUrl = `${base}/api/ascend/commercial-hotspots/stream?${params.toString()}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 300_000);

      try {
        const resp = await fetch(streamUrl, { method: 'GET', signal: controller.signal });
        clearTimeout(timer);

        if (!resp.ok) {
          const text = await resp.text().catch(() => '');
          return NextResponse.json(
            { success: false, error: `Python 流式服务请求失败: ${resp.status}`, details: text.slice(0, 4000) },
            { status: 502 }
          );
        }

        return new Response(resp.body, {
          headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
        });
      } catch (err) {
        clearTimeout(timer);
        throw err;
      }
    }

    // 非流式
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120_000);
    const resp = await fetch(`${base}/api/ascend/commercial-hotspots?${params.toString()}`, {
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
      { success: false, error: isAbort ? '昇腾商业热点分析服务超时' : '调用昇腾商业热点分析服务失败', details: process.env.NODE_ENV === 'development' ? String(error?.stack || error) : undefined },
      { status: 500 }
    );
  }
}
