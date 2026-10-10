import { NextResponse } from 'next/server';
import { getBaseUrl } from '../_utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 昇腾用户详情 API — 代理到 Python /api/ascend/user-detail
 */
export async function GET(request) {
  try {
    const url = new URL(request.url);
    const userName = url.searchParams.get('user_name') || '';
    if (!userName) {
      return NextResponse.json({ success: false, error: '缺少 user_name 参数' }, { status: 400 });
    }

    const base = getBaseUrl().replace(/\/$/, '');
    const params = new URLSearchParams({ user_name: userName, t: String(Date.now()) });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);

    const resp = await fetch(`${base}/api/ascend/user-detail?${params.toString()}`, {
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
      { success: false, error: isAbort ? '昇腾用户详情查询超时' : '查询昇腾用户详情失败', details: process.env.NODE_ENV === 'development' ? String(error?.stack || error) : undefined },
      { status: 500 }
    );
  }
}
