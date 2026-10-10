export const WEIGHT_DIMENSIONS = [
  { key: 'pagerank', label: 'PageRank' },
  { key: 'in_degree', label: '入度' },
  { key: 'betweenness', label: '介数' },
  { key: 'quality', label: '质量' },
  { key: 'innovation', label: '创新' },
  { key: 'sentiment', label: '情感' },
  { key: 'diversity', label: '覆盖' },
  { key: 'consistency', label: '稳定' },
];

const WEIGHT_KEYS = WEIGHT_DIMENSIONS.map((item) => item.key);

function toSafeNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, n);
}

export function normalizeWeights(rawWeights) {
  if (!rawWeights) return null;

  const base = {};
  let hasAny = false;

  WEIGHT_KEYS.forEach((key) => {
    const n = toSafeNumber(rawWeights[key]);
    base[key] = n;
    if (n > 0) hasAny = true;
  });

  if (!hasAny) return null;

  const maxVal = Math.max(...Object.values(base));
  const scale = maxVal > 1 ? 100 : 1;

  const normalizedInput = WEIGHT_KEYS.reduce((acc, key) => {
    acc[key] = base[key] / scale;
    return acc;
  }, {});

  const sum = Object.values(normalizedInput).reduce((acc, cur) => acc + cur, 0);
  if (sum <= 0) return null;

  return WEIGHT_KEYS.reduce((acc, key) => {
    acc[key] = Number((normalizedInput[key] / sum).toFixed(6));
    return acc;
  }, {});
}

export function toPercentWeights(weights) {
  const normalized = normalizeWeights(weights);
  const fallback = WEIGHT_KEYS.reduce((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {});

  if (!normalized) return fallback;

  return WEIGHT_KEYS.reduce((acc, key) => {
    acc[key] = Number((normalized[key] * 100).toFixed(2));
    return acc;
  }, {});
}

export function parseWeightsFromParams(paramsLike) {
  if (!paramsLike || typeof paramsLike.get !== 'function') return null;

  const raw = {};
  let hasAny = false;

  WEIGHT_KEYS.forEach((key) => {
    const val = paramsLike.get(`weight_${key}`);
    if (val !== null && val !== '') {
      raw[key] = val;
      hasAny = true;
    }
  });

  if (!hasAny) return null;
  return normalizeWeights(raw);
}

export function appendWeightParams(targetParams, weights) {
  if (!targetParams || typeof targetParams.set !== 'function') return;
  const normalized = normalizeWeights(weights);
  if (!normalized) return;

  WEIGHT_KEYS.forEach((key) => {
    targetParams.set(`weight_${key}`, String(normalized[key]));
  });
}

export function buildWeightQuery(weights) {
  const normalized = normalizeWeights(weights);
  if (!normalized) return '';

  const params = new URLSearchParams();
  appendWeightParams(params, normalized);
  return params.toString();
}
