'use client';

import { useState, useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { BarChart3, TrendingUp, PieChart as PieChartIcon, GitBranchPlus, Palette } from 'lucide-react';
import { Select } from 'antd';

/**
 * BI 可视化探索组件
 * 用户自助选择字段 → 自动生成图表
 *
 * @param {Array} columns - [{ key, title, type }]
 * @param {Array} data - 行数据
 */

const CHART_PALETTE = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#06b6d4',
  '#8b5cf6', '#ec4899', '#f97316', '#14b8a6', '#3b82f6',
  '#a855f7', '#84cc16',
];

const tooltipStyle = {
  backgroundColor: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
  boxShadow: '0 10px 40px -10px rgba(0,0,0,0.1)',
  padding: '12px 16px',
  fontSize: '13px',
};

const CHART_TYPES = [
  { id: 'bar', label: '柱状图', icon: BarChart3, desc: '分类对比' },
  { id: 'line', label: '折线图', icon: TrendingUp, desc: '趋势变化' },
  { id: 'pie', label: '饼图', icon: PieChartIcon, desc: '占比分析' },
  { id: 'scatter', label: '散点图', icon: GitBranchPlus, desc: '相关性' },
];

export default function BIExplorer({ columns = [], data = [] }) {
  const [chartType, setChartType] = useState('bar');
  const [xField, setXField] = useState('');
  const [yField, setYField] = useState('');
  const [groupField, setGroupField] = useState('');

  // 分类列（文本列）和数值列
  const textColumns = columns.filter((c) => c.type !== 'number');
  const numColumns = columns.filter((c) => c.type === 'number');

  // 自动选默认字段
  useMemo(() => {
    if (!xField && textColumns.length > 0) setXField(textColumns[0].key);
    if (!yField && numColumns.length > 0) setYField(numColumns[0].key);
  }, [columns]);

  // 准备图表数据
  const chartData = useMemo(() => {
    if (!xField || !yField) return [];

    if (chartType === 'pie') {
      // 饼图：按 xField 分组，对 yField 求和
      const grouped = {};
      data.forEach((row) => {
        const key = String(row[xField] ?? '(空)');
        const val = Number(row[yField]) || 0;
        grouped[key] = (grouped[key] || 0) + val;
      });
      return Object.entries(grouped)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 15); // 限制 15 项
    }

    if (chartType === 'scatter') {
      // 散点图：X 和 Y 都是数值
      return data
        .map((row) => ({
          x: Number(row[xField]) || 0,
          y: Number(row[yField]) || 0,
          name: row[groupField] || '',
        }))
        .slice(0, 500); // 限制 500 点
    }

    // 柱状图 / 折线图
    if (groupField) {
      // 分组模式：按 xField 分组，groupField 为系列
      const grouped = {};
      const seriesSet = new Set();
      data.forEach((row) => {
        const x = String(row[xField] ?? '');
        const g = String(row[groupField] ?? '');
        seriesSet.add(g);
        if (!grouped[x]) grouped[x] = { name: x };
        grouped[x][g] = (grouped[x][g] || 0) + (Number(row[yField]) || 0);
      });
      return { data: Object.values(grouped).slice(0, 50), series: [...seriesSet].slice(0, 10) };
    }

    // 非分组：按 xField 聚合 yField
    const grouped = {};
    data.forEach((row) => {
      const key = String(row[xField] ?? '');
      const val = Number(row[yField]) || 0;
      if (!grouped[key]) grouped[key] = { name: key, value: 0, count: 0 };
      grouped[key].value += val;
      grouped[key].count += 1;
    });
    return Object.values(grouped).slice(0, 50);
  }, [data, xField, yField, groupField, chartType]);

  const renderChart = () => {
    if (!xField || !yField) {
      return (
        <div className="flex items-center justify-center h-[360px] text-slate-400">
          <div className="text-center">
            <Palette className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>请选择 X 轴和 Y 轴字段</p>
          </div>
        </div>
      );
    }

    if (chartType === 'bar') {
      const isGrouped = Array.isArray(chartData.series);
      const d = isGrouped ? chartData.data : chartData;
      return (
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={d}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="name" stroke="#94a3b8" style={{ fontSize: '12px' }} axisLine={false} tickLine={false} />
            <YAxis stroke="#94a3b8" style={{ fontSize: '12px' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend />
            {isGrouped ? (
              chartData.series.map((s, i) => (
                <Bar key={s} dataKey={s} fill={CHART_PALETTE[i % CHART_PALETTE.length]} radius={[4, 4, 0, 0]} />
              ))
            ) : (
              <Bar dataKey="value" radius={[4, 4, 0, 0]} name={columns.find((c) => c.key === yField)?.title || yField}>
                {d.map((_, i) => <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />)}
              </Bar>
            )}
          </BarChart>
        </ResponsiveContainer>
      );
    }

    if (chartType === 'line') {
      const isGrouped = Array.isArray(chartData.series);
      const d = isGrouped ? chartData.data : chartData;
      return (
        <ResponsiveContainer width="100%" height={360}>
          <LineChart data={d}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="name" stroke="#94a3b8" style={{ fontSize: '12px' }} axisLine={false} tickLine={false} />
            <YAxis stroke="#94a3b8" style={{ fontSize: '12px' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend />
            {isGrouped ? (
              chartData.series.map((s, i) => (
                <Line key={s} dataKey={s} stroke={CHART_PALETTE[i % CHART_PALETTE.length]} strokeWidth={2} dot={{ r: 3 }} />
              ))
            ) : (
              <Line dataKey="value" stroke={CHART_PALETTE[0]} strokeWidth={2} dot={{ r: 3 }} name={columns.find((c) => c.key === yField)?.title || yField} />
            )}
          </LineChart>
        </ResponsiveContainer>
      );
    }

    if (chartType === 'pie') {
      return (
        <ResponsiveContainer width="100%" height={360}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              outerRadius={130}
              innerRadius={60}
              fill="#8884d8"
              dataKey="value"
              paddingAngle={2}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            >
              {chartData.map((_, i) => (
                <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
      );
    }

    if (chartType === 'scatter') {
      return (
        <ResponsiveContainer width="100%" height={360}>
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis type="number" dataKey="x" name={columns.find((c) => c.key === xField)?.title || xField} stroke="#94a3b8" />
            <YAxis type="number" dataKey="y" name={columns.find((c) => c.key === yField)?.title || yField} stroke="#94a3b8" />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={tooltipStyle} />
            <Scatter name="数据" data={chartData} fill={CHART_PALETTE[0]}>
              {chartData.map((_, i) => <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />)}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      );
    }

    return null;
  };

  return (
    <div className="space-y-4">
      {/* 图表类型选择 */}
      <div className="flex flex-wrap gap-2">
        {CHART_TYPES.map((ct) => {
          const Icon = ct.icon;
          return (
            <button
              key={ct.id}
              onClick={() => setChartType(ct.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${chartType === ct.id
                ? 'bg-teal-600 text-white shadow-lg shadow-teal-200'
                : 'bg-white text-slate-600 border border-slate-200 hover:border-teal-200 hover:text-teal-600'
                }`}
            >
              <Icon className="w-4 h-4" />
              {ct.label}
              <span className={`text-xs ${chartType === ct.id ? 'text-teal-100' : 'text-slate-400'}`}>
                {ct.desc}
              </span>
            </button>
          );
        })}
      </div>

      {/* 字段映射 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-2 flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
            X 轴 / 分类字段
          </label>
          <Select
            value={xField || undefined}
            onChange={setXField}
            placeholder="请选择 X 轴"
            className="w-full"
            size="large"
            options={columns.map((col) => ({ label: `${col.title} (${col.type === 'number' ? '数值' : '文本'})`, value: col.key }))}
            allowClear
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-2 flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-teal-400" />
            Y 轴 / 数值字段
          </label>
          <Select
            value={yField || undefined}
            onChange={setYField}
            placeholder="请选择 Y 轴"
            className="w-full"
            size="large"
            options={columns.map((col) => ({ label: `${col.title} (${col.type === 'number' ? '数值' : '文本'})`, value: col.key }))}
            allowClear
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-2 flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            分组字段 (可选)
          </label>
          <Select
            value={groupField || undefined}
            onChange={setGroupField}
            placeholder="无分组"
            className="w-full"
            size="large"
            options={textColumns.map((col) => ({ label: col.title, value: col.key }))}
            allowClear
          />
        </div>
      </div>

      {/* 图表展示区 */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        {renderChart()}
      </div>
    </div>
  );
}
