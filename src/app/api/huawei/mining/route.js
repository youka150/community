import { NextResponse } from 'next/server';
import { clampInt } from '../_utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getBaseUrl() {
  return process.env.HUAWEI_MINING_BASE_URL || 'http://127.0.0.1:8008';
}

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const days = clampInt(url.searchParams.get('days'), { min: 1, max: 365, fallback: 30 });
    const topics = clampInt(url.searchParams.get('topics'), { min: 2, max: 20, fallback: 8 });
    const maxDocs = clampInt(url.searchParams.get('maxDocs'), { min: 50, max: 5000, fallback: 1200 });

    const base = getBaseUrl().replace(/\/$/, '');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45_000);

    const resp = await fetch(`${base}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days, n_topics: topics, max_docs: maxDocs }),
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
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const isAbort = String(error?.name || '').toLowerCase().includes('abort');
    return NextResponse.json(
      {
        success: false,
        error: isAbort ? '文本挖掘服务超时（请确认 Python 服务已启动）' : '调用文本挖掘服务失败',
        details: process.env.NODE_ENV === 'development' ? String(error?.stack || error) : undefined,
      },
      { status: 500 }
    );
  }
}
