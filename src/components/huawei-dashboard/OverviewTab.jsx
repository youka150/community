'use client';

import { useMemo, useState, useCallback } from 'react';
import { MessageSquare, Users, TrendingUp, AlertCircle, ExternalLink } from 'lucide-react';
import { Modal, Tabs, Spin, Empty, List, Tag } from 'antd';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  BarChart,
  Bar,
} from 'recharts';

const CHART_COLORS = {
  primary: '#6366f1',
  secondary: '#8b5cf6',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#06b6d4',
  muted: '#94a3b8',
};

const tooltipStyle = {
  backgroundColor: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
  boxShadow: '0 10px 40px -10px rgba(0,0,0,0.1)',
  padding: '12px 16px',
};

function formatDayLabel(day) {
  if (!day) return '';
  const s = String(day);
  return s.length >= 10 ? s.slice(5, 10) : s;
}

/**
 * 数据概览 Tab
 * 包含统计卡片、活跃趋势图、Top 话题/问答
 */
export default function OverviewTab({ overview, topTopics, topQuestions, days, loading, error }) {
  const series = overview?.series || [];

  // 钻取 Modal 状态
  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const [drilldownDate, setDrilldownDate] = useState(null);
  const [drilldownLoading, setDrilldownLoading] = useState(false);
  const [drilldownData, setDrilldownData] = useState({ users: [], topics: [], questions: [] });

  // 点击图表某一天时触发
  const handleChartClick = useCallback(async (data) => {
    if (!data?.activePayload?.length) return;
    const payload = data.activePayload[0].payload;
    // payload.day 是完整日期 YYYY-MM-DD
    const fullDate = payload.day ? String(payload.day).slice(0, 10) : null;
    if (!fullDate) return;

    setDrilldownDate(fullDate);
    setDrilldownOpen(true);
    setDrilldownLoading(true);

    try {
      const res = await fetch(`/api/huawei/drilldown?date=${fullDate}`);
      const json = await res.json();
      if (json.success) {
        setDrilldownData(json.data);
      } else {
        setDrilldownData({ users: [], topics: [], questions: [] });
      }
    } catch (e) {
      console.error('Drilldown fetch error:', e);
      setDrilldownData({ users: [], topics: [], questions: [] });
    } finally {
      setDrilldownLoading(false);
    }
  }, []);

  const seriesForChart = useMemo(
    () =>
      series.map((d) => ({
        ...d,
        dayLabel: formatDayLabel(d.day),
      })),
    [series]
  );

  const peak = useMemo(() => {
    if (!series?.length) return null;
    return [...series].sort((a, b) => (b.zscore ?? 0) - (a.zscore ?? 0))[0];
  }, [series]);

  return (
    <div className="space-y-6">
      {/* 错误提示 */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 mt-0.5" />
          <div>
            <div className="font-semibold text-rose-800">加载失败</div>
            <div className="text-rose-700 text-sm mt-1">{error}</div>
            <div className="text-rose-700 text-xs mt-2">
              提示：请确认 Postgres 连接到 huawei 库，并且存在 topics/topics_comments/questions/questions_comments 四张表。
            </div>
          </div>
        </div>
      )}

      {/* 指标卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white/80 backdrop-blur rounded-2xl border border-white/60 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.3)] p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-500">评论总量</div>
              <div className="text-2xl font-bold text-slate-800 mt-1">{overview?.summary?.commentsCnt ?? '-'}</div>
            </div>
            <div className="p-3 rounded-xl bg-indigo-50 text-indigo-600">
              <MessageSquare className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur rounded-2xl border border-white/60 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.3)] p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-500">参与用户数（去重）</div>
              <div className="text-2xl font-bold text-slate-800 mt-1">{overview?.summary?.uniqueUsersCnt ?? '-'}</div>
            </div>
            <div className="p-3 rounded-xl bg-violet-50 text-violet-600">
              <Users className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur rounded-2xl border border-white/60 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.3)] p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-500">突发峰值日（z-score 最大）</div>
              <div className="text-2xl font-bold text-slate-800 mt-1">{peak?.day ? String(peak.day).slice(0, 10) : '-'}</div>
              <div className="text-xs text-slate-500 mt-1">z = {peak?.zscore?.toFixed ? peak.zscore.toFixed(2) : '-'}</div>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>

      {/* 活跃趋势图 */}
      <div className="bg-white/80 backdrop-blur rounded-3xl border border-white/60 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.3)] p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800">活跃趋势（按日）</h2>
            <p className="text-sm text-slate-500">comments / active users / active threads</p>
          </div>
        </div>

        <div className="h-[320px] cursor-pointer" title="点击某一天查看详情">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={seriesForChart} margin={{ top: 10, right: 20, left: 0, bottom: 0 }} onClick={handleChartClick}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="dayLabel" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend />
              <Line type="monotone" dataKey="commentsCnt" name="评论数" stroke={CHART_COLORS.primary} strokeWidth={3} dot={false} />
              <Line type="monotone" dataKey="activeUsersCnt" name="活跃用户" stroke={CHART_COLORS.secondary} strokeWidth={3} dot={false} />
              <Line type="monotone" dataKey="activeThreadsCnt" name="活跃话题/问答" stroke={CHART_COLORS.success} strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top 话题 / 问答 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 话题 */}
        <div className="bg-white/80 backdrop-blur rounded-3xl border border-white/60 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.3)] p-6">
          <h2 className="text-lg font-bold text-slate-800 mb-1">Top 话题（topics）</h2>
          <p className="text-sm text-slate-500 mb-4">按{days === 'all' ? '全部' : `近 ${days} 天`}评论量排序</p>

          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topTopics.map((t) => ({ name: (t.title || '').slice(0, 10) + '…', commentsCnt: t.commentsCnt }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="commentsCnt" name="评论量" fill={CHART_COLORS.primary} radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 space-y-2">
            {topTopics.map((t) => (
              <a
                key={t.id}
                href={t.url || '#'}
                target="_blank"
                rel="noreferrer"
                className="block p-3 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-slate-800 truncate">{t.title || t.id}</div>
                  <div className="text-xs text-slate-500 flex-shrink-0">{t.commentsCnt} 评论</div>
                </div>
                {t.author && <div className="text-xs text-slate-500 mt-1">作者：{t.author}</div>}
              </a>
            ))}
          </div>
        </div>

        {/* Top 问答 */}
        <div className="bg-white/80 backdrop-blur rounded-3xl border border-white/60 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.3)] p-6">
          <h2 className="text-lg font-bold text-slate-800 mb-1">Top 问答（questions）</h2>
          <p className="text-sm text-slate-500 mb-4">按{days === 'all' ? '全部' : `近 ${days} 天`}评论量排序</p>

          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topQuestions.map((q) => ({ name: (q.title || '').slice(0, 10) + '…', commentsCnt: q.commentsCnt }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="commentsCnt" name="评论量" fill={CHART_COLORS.secondary} radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 space-y-2">
            {topQuestions.map((q) => (
              <a
                key={q.id}
                href={q.url || '#'}
                target="_blank"
                rel="noreferrer"
                className="block p-3 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-slate-800 truncate">{q.title || q.id}</div>
                  <div className="text-xs text-slate-500 flex-shrink-0">{q.commentsCnt} 评论</div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* 数据钻取 Modal */}
      <Modal
        open={drilldownOpen}
        onCancel={() => setDrilldownOpen(false)}
        title={`${drilldownDate} 活跃详情`}
        footer={null}
        width={720}
        centered
      >
        {drilldownLoading ? (
          <div className="flex justify-center py-12">
            <Spin size="large" />
          </div>
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
                        <Tag key={user} color="blue">{user}</Tag>
                      ))}
                    </div>
                  </div>
                ) : (
                  <Empty description="当天无活跃用户" />
                ),
              },
              {
                key: 'topics',
                label: `活跃话题 (${drilldownData.topics?.length || 0})`,
                children: drilldownData.topics?.length ? (
                  <List
                    className="max-h-[400px] overflow-y-auto"
                    dataSource={drilldownData.topics}
                    renderItem={(item) => (
                      <List.Item
                        actions={[
                          item.url && (
                            <a key="link" href={item.url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:text-indigo-800">
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          ),
                        ]}
                      >
                        <List.Item.Meta
                          title={item.title || item.id}
                          description={`作者: ${item.author || '未知'} · 当日评论: ${item.commentCount}`}
                        />
                      </List.Item>
                    )}
                  />
                ) : (
                  <Empty description="当天无活跃话题" />
                ),
              },
              {
                key: 'questions',
                label: `活跃问答 (${drilldownData.questions?.length || 0})`,
                children: drilldownData.questions?.length ? (
                  <List
                    className="max-h-[400px] overflow-y-auto"
                    dataSource={drilldownData.questions}
                    renderItem={(item) => (
                      <List.Item
                        actions={[
                          item.url && (
                            <a key="link" href={item.url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:text-indigo-800">
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          ),
                        ]}
                      >
                        <List.Item.Meta
                          title={item.title || item.id}
                          description={`当日评论: ${item.commentCount}`}
                        />
                      </List.Item>
                    )}
                  />
                ) : (
                  <Empty description="当天无活跃问答" />
                ),
              },
            ]}
          />
        )}
      </Modal>
    </div>
  );
}
