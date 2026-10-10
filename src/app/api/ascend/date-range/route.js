import { NextResponse } from 'next/server';
import { getBaseUrl } from '../_utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const base = getBaseUrl().replace(/\/$/, '');
    const resp = await fetch(`${base}/api/ascend/date-range`, {
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
      { success: false, error: 'Failed to fetch Ascend date range from Python' },
      { status: 500 }
    );
  }
}
