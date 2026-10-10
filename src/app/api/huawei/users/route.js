import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getBaseUrl() {
  return process.env.HUAWEI_MINING_BASE_URL || 'http://127.0.0.1:8008';
}

/**
 * 用户列表 API：代理调用 Python 后端 /api/users
 * 支持搜索和分页
 */
export async function GET(request) {
  try {
    const url = new URL(request.url);
    const search = url.searchParams.get('search') || '';
    const page = url.searchParams.get('page') || '1';
    const pageSize = url.searchParams.get('page_size') || '50';

    const base = getBaseUrl().replace(/\/$/, '');
    const params = new URLSearchParams({ search, page, page_size: pageSize });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);

    const resp = await fetch(`${base}/api/users?${params.toString()}`, {
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
        error: isAbort ? '用户列表查询超时' : '查询用户列表失败',
        details: process.env.NODE_ENV === 'development' ? String(error?.stack || error) : undefined,
      },
      { status: 500 }
    );
  }
}
