import { NextResponse } from 'next/server';
import { getBaseUrl } from '../_utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 昇腾标签列表、板块统计、问答健康度 API
 * 支持 type 参数: tags / sections / qa-health
 */
export async function GET(request) {
  try {
    const url = new URL(request.url);
    const type = url.searchParams.get('type') || 'tags';

    const base = getBaseUrl().replace(/\/$/, '');
    let endpoint;

    switch (type) {
      case 'sections':
        endpoint = '/api/ascend/section-stats';
        break;
      case 'qa-health':
        endpoint = '/api/ascend/qa-health';
        break;
      default:
        endpoint = '/api/ascend/tags';
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);

    const resp = await fetch(`${base}${endpoint}`, {
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
    return NextResponse.json(
      { success: false, error: '昇腾数据查询失败', details: process.env.NODE_ENV === 'development' ? String(error?.stack || error) : undefined },
      { status: 500 }
    );
  }
}
