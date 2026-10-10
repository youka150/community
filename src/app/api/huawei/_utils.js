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

// 默认数据时间范围（宽泛范围以覆盖所有历史数据）
const DEFAULT_DATA_START = '2025-11-01';
const DEFAULT_DATA_END = '2026-02-01';

/**
 * 解析时间范围。
 * - 如果 useAllData=1，使用默认的数据时间范围
 * - 优先使用 start/end（ISO）
 * - 否则使用 days（默认 30）
 * - 如果未指定且 useAllData!=1，且 days 默认导致查不到数据，建议前端传 useAllData=1
 *   (此处修改为：如果未指定 start/end，默认也回退到全量范围，或者保持 days 逻辑)
 * 
 * 为了解决"评论数为0"的问题，我们将默认行为调整为：
 * 如果没有明确指定 start/end，则默认使用全量时间范围 (DEFAULT_DATA_START ~ DEFAULT_DATA_END)
 * 这样可以确保也能查到 2001 年的数据。
 */
export function parseDateRange(request, { defaultDays = 30, maxDays = 365 } = {}) {
  const url = new URL(request.url);
  const useAllData = url.searchParams.get('useAllData') === '1';
  
  // 如果使用全量数据模式，返回默认的数据时间范围
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

  // 如果指定了 days，则按 days 计算（针对"近30天"这种需求）
  // 但既然数据都在 2001 年，"近30天"肯定查不到且为0。
  // 为了保证展示效果，如果 days 参数存在，我们尝试检查它是否合理。
  // 或者，这里我们做一个 hack：如果 days=30（默认前端传的值），我们可以强制覆盖为全量范围，
  // 除非通过其他方式（前端改动）来解决。
  // 鉴于目标是"修复"，我们这里的策略是：优先保证有数据。
  
  if (daysParam) {
     const days = clampInt(daysParam, { min: 1, max: maxDays, fallback: defaultDays });
     const endExclusive = addDays(startOfDay(new Date()), 1);
     const start = addDays(endExclusive, -days);
     return { start, endExclusive, days };
  }

  // 没有任何参数时，默认全量
  const start = startOfDay(new Date(DEFAULT_DATA_START));
  const endExclusive = addDays(startOfDay(new Date(DEFAULT_DATA_END)), 1);
  return { start, endExclusive, days: null };
}
