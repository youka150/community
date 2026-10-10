import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const base = process.env.HUAWEI_MINING_BASE_URL || 'http://127.0.0.1:8008';
    const resp = await fetch(`${base}/api/date-range`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    
    if (!resp.ok) {
      return NextResponse.json({ success: false, error: 'Python API request failed' }, { status: 502 });
    }
    const data = await resp.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch date range from Python' },
      { status: 500 }
    );
  }
}
