'use client';

import { useEffect, useMemo, useState } from 'react';
import { InputNumber, Button } from 'antd';
import { RefreshCw, SlidersHorizontal } from 'lucide-react';
import { WEIGHT_DIMENSIONS, normalizeWeights, toPercentWeights } from '@/utils/networkWeights';

export default function NetworkWeightsEditor({
  weights,
  loading = false,
  onApply,
  onReset,
  title = '权重设置',
  description = '修改后将自动归一化并重新计算排行',
  className = '',
}) {
  const [draft, setDraft] = useState(() => toPercentWeights(weights));

  useEffect(() => {
    setDraft(toPercentWeights(weights));
  }, [weights]);

  const sum = useMemo(() => {
    return WEIGHT_DIMENSIONS.reduce((acc, item) => acc + (Number(draft[item.key]) || 0), 0);
  }, [draft]);

  const normalizedDraft = useMemo(() => normalizeWeights(draft), [draft]);

  const updateItem = (key, value) => {
    setDraft((prev) => ({
      ...prev,
      [key]: Math.max(0, Number(value) || 0),
    }));
  };

  const handleApply = () => {
    if (!normalizedDraft || !onApply) return;
    onApply(normalizedDraft);
  };

  return (
    <div className={`rounded-2xl border border-slate-200 bg-white/80 p-3 ${className}`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <SlidersHorizontal className="w-4 h-4" />
          {title}
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={onReset}
          className="text-xs px-2 py-1 rounded-lg border border-slate-200 text-slate-600 hover:border-sky-300 hover:text-sky-600 disabled:opacity-50 inline-flex items-center gap-1"
        >
          <RefreshCw className="w-3 h-3" />
          恢复熵权法
        </button>
      </div>

      <div className="text-xs text-slate-500 mb-3">{description}</div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {WEIGHT_DIMENSIONS.map((item) => (
          <label key={item.key} className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-2">
            <div className="text-xs text-slate-500 mb-1">{item.label}</div>
            <InputNumber
              value={draft[item.key]}
              min={0}
              max={100}
              precision={2}
              controls={false}
              // addonAfter="%" deprecated in antd v5, use suffix instead
              suffix="%"
              onChange={(v) => updateItem(item.key, v)}
              style={{ width: '100%' }}
            />
          </label>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="text-xs text-slate-500">
          当前输入总和: <span className="font-semibold text-slate-700">{sum.toFixed(2)}%</span>
        </div>
        <Button
          type="primary"
          disabled={loading || !normalizedDraft}
          onClick={handleApply}
          // className="px-3 py-1.5 rounded-lg bg-sky-500 text-white text-sm hover:bg-sky-600 disabled:opacity-50"
        >
          {loading ? '重算中...' : '应用并重算'}
        </Button>
      </div>
    </div>
  );
}
