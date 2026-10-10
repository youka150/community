'use client';

import { useMemo, useState, useCallback } from 'react';
import {
  MessageSquare, Users, TrendingUp, AlertCircle, ExternalLink,
  BarChart3, HelpCircle, CheckCircle2, Tag, Layers, Activity,
} from 'lucide-react';
import { Modal, Tabs, Spin, Empty, List, Tag as AntTag } from 'antd';
import {
  ResponsiveContainer, LineChart, Line, CartesianGrid,
  XAxis, YAxis, Tooltip, Legend, BarChart, Bar,
  PieChart, Pie, Cell, Treemap, Sankey,
  RadialBarChart, RadialBar,
} from 'recharts';

const CHART_COLORS = {
  primary: '#0ea5e9',
  secondary: '#8b5cf6',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#06b6d4',
  muted: '#94a3b8',
};

const SECTION_COLORS = [
  '#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444',
  '#06b6d4', '#ec4899', '#f97316', '#14b8a6', '#a855f7',
  '#84cc16', '#e11d48', '#6366f1',
];

const tooltipStyle = {
  backgroundColor: 'rgba(255, 255, 255, 0.95)',
  border: '1px solid rgba(226,232,240,0.8)',
  borderRadius: '12px',
  boxShadow: '0 10px 40px -10px rgba(0,0,0,0.1)',
  padding: '12px 16px',
  color: '#475569',
};

function formatDayLabel(day) {
  if (!day) return '';
  const s = String(day);
  return s.length >= 10 ? s.slice(5, 10) : s;
}

/**
 * 昇腾数据概览 Tab
 * 包含统计卡片、活跃趋势图、板块生态分析、问答健康度仪表盘、Top 话题/问答
 */
export default function OverviewTab({ overview, topTopics, topQuestions, sectionStats, qaHealth, days, loading, error }) {
  const series = overview?.series || [];
  const summary = overview?.summary || {};

  // === 钻取 Modal ===
  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const [drilldownDate, setDrilldownDate] = useState(null);
  const [drilldownLoading, setDrilldownLoading] = useState(false);
  const [drilldownData, setDrilldownData] = useState({ users: [], topics: [], questions: [] });

  // 标签弹窗
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [tagsData, setTagsData] = useState([]);
  const [tagsLoading, setTagsLoading] = useState(false);

  const handleChartClick = useCallback(async (data) => {
    if (!data?.activePayload?.length) return;
    const payload = data.activePayload[0].payload;
    const fullDate = payload.day ? String(payload.day).slice(0, 10) : null;
    if (!fullDate) return;

    setDrilldownDate(fullDate);
    setDrilldownOpen(true);
    setDrilldownLoading(true);

    try {
      const res = await fetch(`/api/ascend/drilldown?date=${fullDate}`);
      const json = await res.json();
      if (json.success) setDrilldownData(json.data);
      else setDrilldownData({ users: [], topics: [], questions: [] });
    } catch {
      setDrilldownData({ users: [], topics: [], questions: [] });
    } finally {
      setDrilldownLoading(false);
    }
  }, []);

  const handleOpenTags = useCallback(async () => {
    setTagModalOpen(true);
    setTagsLoading(true);
    try {
      const res = await fetch('/api/ascend/tags?type=tags');
      const json = await res.json();
      if (json.success) setTagsData(json.data || []);
    } catch { /* ignore */ } finally {
      setTagsLoading(false);
    }
  }, []);

  const seriesForChart = useMemo(
    () => series.map((d) => ({ ...d, dayLabel: formatDayLabel(d.day) })),
    [series]
  );

  const peak = useMemo(() => {
    if (!series?.length) return null;
    return [...series].sort((a, b) => (b.zscore ?? 0) - (a.zscore ?? 0))[0];
  }, [series]);

  // 板块饼图数据
  const sectionPieData = useMemo(() => {
    if (!sectionStats?.sections) return [];
    return sectionStats.sections.map((s, i) => ({
      name: s.section_name,
      value: s.topic_count,
      views: s.total_views,
      authors: s.unique_authors,
      color: SECTION_COLORS[i % SECTION_COLORS.length],
    }));
  }, [sectionStats]);

  // 板块间用户流动（桑基图数据）
  const sankeyData = useMemo(() => {
    if (!sectionStats?.cross_flows?.length) return null;
    const flows = sectionStats.cross_flows;
    const nameSet = new Set();
    flows.forEach(f => { nameSet.add(f.source); nameSet.add(f.target); });
    const names = Array.from(nameSet);
    const nodes = names.map(n => ({ name: n }));
    const links = flows.map(f => ({
      source: names.indexOf(f.source),
      target: names.indexOf(f.target),
      value: f.user_count,
    })).filter(l => l.source !== -1 && l.target !== -1);
    return { nodes, links };
  }, [sectionStats]);

  // 热力矩阵数据
  const heatmapData = useMemo(() => {
    if (!sectionStats?.cross_flows?.length || !sectionStats?.sections?.length) return null;
    const sections = sectionStats.sections.map(s => s.section_name).slice(0, 10); // 限制前10个板块
    const matrix = [];
    const flowMap = new Map();
    sectionStats.cross_flows.forEach(f => {
      flowMap.set(`${f.source}|${f.target}`, f.user_count);
      flowMap.set(`${f.target}|${f.source}`, f.user_count);
    });
    // 对角线用各板块自身用户数
    const selfMap = new Map();
    sectionStats.sections.forEach(s => selfMap.set(s.section_name, s.unique_authors));

    sections.forEach((row, i) => {
      sections.forEach((col, j) => {
        const key = `${row}|${col}`;
        let val = 0;
        if (i === j) val = selfMap.get(row) || 0;
        else val = flowMap.get(key) || 0;
        matrix.push({ row, col, rowIdx: i, colIdx: j, value: val });
      });
    });
    return { sections, matrix };
  }, [sectionStats]);

  return (
    <div className="space-y-6">
      {/* 错误提示 */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-500 mt-0.5" />
          <div>
            <div className="font-semibold text-rose-700">加载失败</div>
            <div className="text-rose-600 text-sm mt-1">{error}</div>
          </div>
        </div>
      )}

      {/* ====== 统计卡片 ====== */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: '评论总量', value: summary.commentsCnt, icon: MessageSquare, color: 'sky' },
          { label: '参与用户', value: summary.uniqueUsersCnt, icon: Users, color: 'violet' },
          { label: '话题总数', value: summary.totalTopics, icon: BarChart3, color: 'emerald' },
          { label: '问答总数', value: summary.totalQuestions, icon: HelpCircle, color: 'amber' },
          { label: '峰值日', value: peak?.day?.slice(0, 10), subValue: peak?.zscore?.toFixed?.(2) ? `z=${peak.zscore.toFixed(2)}` : '', icon: TrendingUp, color: 'rose' },
        ].map((card, i) => {
          const colors = {
            sky: 'from-sky-50 to-white border-sky-100 text-sky-500',
            violet: 'from-violet-50 to-white border-violet-100 text-violet-500',
            emerald: 'from-emerald-50 to-white border-emerald-100 text-emerald-500',
            amber: 'from-amber-50 to-white border-amber-100 text-amber-500',
            rose: 'from-rose-50 to-white border-rose-100 text-rose-500',
          }[card.color];
          const Icon = card.icon;
          return (
            <div key={i} className={`bg-gradient-to-br ${colors} border rounded-2xl p-4 backdrop-blur-sm bg-white/80`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-500 mb-1">{card.label}</div>
                  <div className="text-xl font-bold text-slate-800">{card.value ?? '-'}</div>
                  {card.subValue && <div className="text-xs text-slate-500 mt-0.5">{card.subValue}</div>}
                </div>
                <Icon className="w-5 h-5 opacity-60" />
              </div>
            </div>
          );
        })}
      </div>

      {/* ====== 活跃趋势图 ====== */}
      <div className="bg-white/80 backdrop-blur rounded-3xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800">活跃趋势（按日）</h2>
            <p className="text-sm text-slate-500">点击某日查看详情</p>
          </div>
          {/* 标签云按钮 */}
          <button
            onClick={handleOpenTags}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-medium hover:bg-sky-500/20 transition-colors"
          >
            <Tag className="w-3.5 h-3.5" />
            标签词云
          </button>
        </div>

        <div className="h-[320px] cursor-pointer">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={seriesForChart} margin={{ top: 10, right: 20, left: 0, bottom: 0 }} onClick={handleChartClick}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="dayLabel" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend />
              <Line type="monotone" dataKey="commentsCnt" name="评论数" stroke={CHART_COLORS.primary} strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="activeUsersCnt" name="活跃用户" stroke={CHART_COLORS.secondary} strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="activeThreadsCnt" name="活跃话题" stroke={CHART_COLORS.success} strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ====== 板块生态 + 问答健康度 ====== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 板块分布环形图 */}
        <div className="bg-white/80 backdrop-blur rounded-3xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="w-5 h-5 text-sky-400" />
            <h2 className="text-lg font-bold text-slate-800">板块生态分布</h2>
          </div>
          {sectionPieData.length > 0 ? (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sectionPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={110}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => percent > 0.04 ? `${name.slice(0, 6)} ${(percent * 100).toFixed(0)}%` : ''}
                    labelLine={{ stroke: 'rgba(255,255,255,0.2)' }}
                  >
                    {sectionPieData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value, name, props) => {
                      const d = props.payload;
                      return [`帖子: ${d.value} | 浏览: ${(d.views || 0).toLocaleString()} | 作者: ${d.authors}`, d.name];
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty description="暂无板块数据" className="py-8" />
          )}
        </div>

        {/* 问答健康度仪表盘 */}
        <div className="bg-white/80 backdrop-blur rounded-3xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-bold text-slate-800">问答健康度</h2>
          </div>
          {qaHealth ? (
            <div className="space-y-4">
              {/* 环形进度指标 */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: '解决率', value: qaHealth.solve_rate, color: '#10b981', desc: `${qaHealth.solved_count}/${qaHealth.total_questions}` },
                  { label: '采纳率', value: qaHealth.adoption_rate, color: '#0ea5e9', desc: `${qaHealth.adopted_count}/${qaHealth.total_qa_comments}` },
                ].map((m, i) => (
                  <div key={i} className="text-center bg-slate-50 rounded-2xl p-4 border border-slate-100">
                    <div className="h-[100px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadialBarChart
                          cx="50%" cy="50%" innerRadius="60%" outerRadius="90%"
                          barSize={10} data={[{ value: m.value * 100, fill: m.color }]}
                          startAngle={90} endAngle={-270}
                        >
                          <RadialBar background={{ fill: 'rgba(0,0,0,0.05)' }} dataKey="value" cornerRadius={10} />
                        </RadialBarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="text-xl font-bold text-slate-800 -mt-2">{(m.value * 100).toFixed(1)}%</div>
                    <div className="text-xs text-slate-500">{m.label}</div>
                    <div className="text-xs text-slate-600 mt-0.5">{m.desc}</div>
                  </div>
                ))}
              </div>
              {/* 数字指标 */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: '平均回复数', value: qaHealth.avg_replies },
                  { label: '平均评论数', value: qaHealth.avg_comments },
                  { label: '平均浏览量', value: Math.round(qaHealth.avg_views).toLocaleString() },
                ].map((m, i) => (
                  <div key={i} className="text-center bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <div className="text-lg font-bold text-slate-800">{m.value}</div>
                    <div className="text-xs text-slate-500">{m.label}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <Empty description="暂无问答数据" className="py-8" />
          )}
        </div>
      </div>

      {/* ====== 热力矩阵：板块间用户流动 ====== */}
      {/* {heatmapData && (
        <div className="bg-white/80 backdrop-blur rounded-3xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="w-5 h-5 text-violet-400" />
            <h2 className="text-lg font-bold text-slate-800">板块间用户交叉参与（热力矩阵）</h2>
            <span className="text-xs text-slate-500">颜色越深表示同时参与两个板块的用户越多</span>
          </div>
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full">

              <div className="flex">
                <div className="w-28 shrink-0" />
                {heatmapData.sections.map((s, i) => (
                  <div key={i} className="w-20 shrink-0 text-center text-xs text-slate-500 truncate px-1" title={s}>
                    {s.length > 6 ? s.slice(0, 5) + '…' : s}
                  </div>
                ))}
              </div>

              {heatmapData.sections.map((row, ri) => (
                <div key={ri} className="flex items-center">
                  <div className="w-28 shrink-0 text-xs text-slate-500 truncate pr-2 text-right" title={row}>
                    {row.length > 10 ? row.slice(0, 9) + '…' : row}
                  </div>
                  {heatmapData.sections.map((col, ci) => {
                    const cell = heatmapData.matrix.find(m => m.rowIdx === ri && m.colIdx === ci);
                    const val = cell?.value || 0;
                    const maxVal = Math.max(...heatmapData.matrix.map(m => m.value), 1);
                    const intensity = val / maxVal;
                    const bgColor = ri === ci
                      ? `rgba(14, 165, 233, ${0.1 + intensity * 0.6})`
                      : `rgba(139, 92, 246, ${intensity * 0.7})`;
                    return (
                      <div
                        key={ci}
                        className="w-20 h-10 shrink-0 flex items-center justify-center text-xs font-medium rounded-sm mx-0.5 my-0.5 transition-all hover:scale-110"
                        style={{ backgroundColor: bgColor }}
                        title={`${row} ↔ ${col}: ${val} 个共同用户`}
                      >
                        <span className={val > 0 ? 'text-slate-800' : 'text-slate-400'}>{val || ''}</span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )} */}

      {/* ====== 板块用户数横向柱状图 ====== */}
      {/* {sectionPieData.length > 0 && (
        <div className="bg-white/80 backdrop-blur rounded-3xl border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-800 mb-4">各板块活跃作者数</h2>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sectionPieData} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis type="number" stroke="#64748b" fontSize={12} />
                <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={11} width={75} tick={{ fill: '#94a3b8' }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="authors" name="活跃作者数" fill={CHART_COLORS.primary} radius={[0, 6, 6, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )} */}

      {/* ====== Top 话题 / 问答 ====== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 话题 */}
        <div className="bg-white/80 backdrop-blur rounded-3xl border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-800 mb-1">Top 话题</h2>
          <p className="text-sm text-slate-500 mb-4">按评论量排序（is_question=0）</p>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topTopics.map((t) => ({ name: (t.title || '').slice(0, 10) + '…', commentsCnt: t.commentsCnt }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="commentsCnt" name="评论量" fill={CHART_COLORS.primary} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-2 max-h-[300px] overflow-y-auto">
            {topTopics.map((t) => (
              <a key={t.id} href={t.url || '#'} target="_blank" rel="noreferrer"
                className="block p-3 rounded-xl border border-slate-100 hover:border-sky-500/30 hover:bg-slate-50 transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-slate-700 truncate">{t.title || t.id}</div>
                  <div className="text-xs text-slate-500 flex-shrink-0">{t.commentsCnt} 评论</div>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-600 mt-1">
                  {t.author && <span>作者：{t.author}</span>}
                  {t.sectionName && <AntTag className="text-xs" color="blue">{t.sectionName}</AntTag>}
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* Top 问答 */}
        <div className="bg-white/80 backdrop-blur rounded-3xl border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-800 mb-1">Top 问答</h2>
          <p className="text-sm text-slate-500 mb-4">按评论量排序（is_question=1）</p>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topQuestions.map((q) => ({ name: (q.title || '').slice(0, 10) + '…', commentsCnt: q.commentsCnt }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="commentsCnt" name="评论量" fill={CHART_COLORS.secondary} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-2 max-h-[300px] overflow-y-auto">
            {topQuestions.map((q) => (
              <a key={q.id} href={q.url || '#'} target="_blank" rel="noreferrer"
                className="block p-3 rounded-xl border border-slate-100 hover:border-violet-500/30 hover:bg-slate-50 transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-slate-700 truncate">{q.title || q.id}</div>
                  <div className="text-xs text-slate-500 flex-shrink-0">{q.commentsCnt} 评论</div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* ====== 标签词云弹窗 ====== */}
      <Modal
        open={tagModalOpen}
        onCancel={() => setTagModalOpen(false)}
        title={<span className="text-lg font-bold">🏷️ 昇腾社区标签词云</span>}
        footer={null}
        width={680}
        centered
      >
        {tagsLoading ? (
          <div className="flex justify-center py-12"><Spin size="large" /></div>
        ) : tagsData.length > 0 ? (
          <div>
            {/* 词云展示 */}
            <div className="flex flex-wrap gap-2 justify-center py-6 px-4">
              {tagsData.map((tag, i) => {
                const maxCount = Math.max(...tagsData.map(t => t.topic_count || 0), 1);
                const ratio = (tag.topic_count || 0) / maxCount;
                const fontSize = 12 + ratio * 24;
                const opacity = 0.5 + ratio * 0.5;
                const colors = ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#6366f1', '#14b8a6', '#f97316'];
                const color = colors[i % colors.length];
                return (
                  <span
                    key={tag.tag_id}
                    className="inline-block px-2 py-1 rounded-lg hover:scale-110 transition-transform cursor-default"
                    style={{ fontSize: `${fontSize}px`, color, opacity }}
                    title={`${tag.tag_name}: ${tag.topic_count} 帖子 | ${tag.follow_num} 关注 | ${tag.quotes} 引用`}
                  >
                    {tag.tag_name}
                  </span>
                );
              })}
            </div>
            {/* 标签详情列表 */}
            <div className="mt-4 border-t pt-4 max-h-[300px] overflow-y-auto space-y-2">
              {tagsData.slice(0, 20).map((tag) => (
                <div key={tag.tag_id} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors">
                  <div>
                    <span className="font-medium text-slate-800">{tag.tag_name}</span>
                    {tag.description && <span className="text-xs text-slate-500 ml-2">{tag.description.slice(0, 50)}</span>}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span>{tag.topic_count} 帖子</span>
                    <span>{tag.follow_num} 关注</span>
                    <span>{tag.quotes} 引用</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <Empty description="暂无标签数据" className="py-8" />
        )}
      </Modal>

      {/* ====== 钻取 Modal ====== */}
      <Modal
        open={drilldownOpen}
        onCancel={() => setDrilldownOpen(false)}
        title={`${drilldownDate} 活跃详情`}
        footer={null}
        width={720}
        centered
      >
        {drilldownLoading ? (
          <div className="flex justify-center py-12"><Spin size="large" /></div>
        ) : (
          <Tabs
            defaultActiveKey="users"
            items={[
              {
                key: 'users',
                label: `活跃用户 (${drilldownData.users?.length || 0})`,
                children: drilldownData.users?.length ? (
                  <div className="max-h-[400px] overflow-y-auto">
                    <div className="flex flex-wrap gap-2">
                      {drilldownData.users.map((user) => (
                        <AntTag key={user} color="blue">{user}</AntTag>
                      ))}
                    </div>
                  </div>
                ) : <Empty description="当天无活跃用户" />,
              },
              {
                key: 'topics',
                label: `活跃话题 (${drilldownData.topics?.length || 0})`,
                children: drilldownData.topics?.length ? (
                  <List
                    className="max-h-[400px] overflow-y-auto"
                    dataSource={drilldownData.topics}
                    renderItem={(item) => (
                      <List.Item actions={[item.url && (
                        <a key="link" href={item.url} target="_blank" rel="noreferrer" className="text-indigo-600"><ExternalLink className="w-4 h-4" /></a>
                      )]}>
                        <List.Item.Meta title={item.title || item.id} description={`作者: ${item.author || '未知'} · 当日评论: ${item.comment_count}`} />
                      </List.Item>
                    )}
                  />
                ) : <Empty description="当天无活跃话题" />,
              },
              {
                key: 'questions',
                label: `活跃问答 (${drilldownData.questions?.length || 0})`,
                children: drilldownData.questions?.length ? (
                  <List
                    className="max-h-[400px] overflow-y-auto"
                    dataSource={drilldownData.questions}
                    renderItem={(item) => (
                      <List.Item actions={[item.url && (
                        <a key="link" href={item.url} target="_blank" rel="noreferrer" className="text-indigo-600"><ExternalLink className="w-4 h-4" /></a>
                      )]}>
                        <List.Item.Meta title={item.title || item.id} description={`当日评论: ${item.comment_count}`} />
                      </List.Item>
                    )}
                  />
                ) : <Empty description="当天无活跃问答" />,
              },
            ]}
          />
        )}
      </Modal>
    </div>
  );
}
