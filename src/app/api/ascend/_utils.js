export function clampInt(value, { min = 1, max = 10_000, fallback = min } = {}) {
  const num = Number.parseInt(String(value ?? ''), 10);
  if (Number.isNaN(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// 昇腾数据时间范围
const DEFAULT_DATA_START = '2026-01-01';
const DEFAULT_DATA_END = '2026-04-01';

/**
 * 解析昇腾时间范围。
 * - useAllData=1：使用全量数据范围
 * - 优先使用 start/end
 * - 否则默认全量
 */
export function parseDateRange(request, { defaultDays = 30, maxDays = 365 } = {}) {
  const url = new URL(request.url);
  const useAllData = url.searchParams.get('useAllData') === '1';
  
  if (useAllData) {
    const start = startOfDay(new Date(DEFAULT_DATA_START));
    const endExclusive = addDays(startOfDay(new Date(DEFAULT_DATA_END)), 1);
    return { start, endExclusive, days: null, useAllData: true };
  }
  
  const daysParam = url.searchParams.get('days');
  const startParam = url.searchParams.get('start');
  const endParam = url.searchParams.get('end');

  if (startParam && endParam) {
    const start = startOfDay(new Date(startParam));
    const endExclusive = addDays(startOfDay(new Date(endParam)), 1);
    return { start, endExclusive, days: null };
  }

  if (daysParam) {
     const days = clampInt(daysParam, { min: 1, max: maxDays, fallback: defaultDays });
     const endExclusive = addDays(startOfDay(new Date()), 1);
     const start = addDays(endExclusive, -days);
     return { start, endExclusive, days };
  }

  // 默认全量
  const start = startOfDay(new Date(DEFAULT_DATA_START));
  const endExclusive = addDays(startOfDay(new Date(DEFAULT_DATA_END)), 1);
  return { start, endExclusive, days: null };
}

/**
 * 获取 Python 后端基础 URL（共用 8008，昇腾路由前缀 /api/ascend/）
 */
export function getBaseUrl() {
  return process.env.HUAWEI_MINING_BASE_URL || 'http://127.0.0.1:8008';
}
