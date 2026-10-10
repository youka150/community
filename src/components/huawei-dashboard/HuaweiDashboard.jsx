'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, Share2, Lock } from 'lucide-react';
import { Select, Switch, Tabs, DatePicker } from 'antd';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
import OverviewTab from './OverviewTab';
import NetworkGraphTab from './NetworkGraphTab';
import AIAnalysisTab from './AIAnalysisTab';
import BusinessInsightsPanel from './BusinessInsightsPanel';
import PermissionLock from '@/components/data-workbench/PermissionLock';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import { hasTabAccess } from '@/lib/permissions';

/**
 * 华为开发者社区趋势分析大屏 - 主入口
 * 使用 Tabs 组织三个主页面：数据概览、网络图、智能分析
 */
export default function HuaweiDashboard() {
  const { role } = useAuth();

  // 共享状态
  const [days, setDays] = useState('all');
  const [includeAuthorEdges, setIncludeAuthorEdges] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  
  const [dateRange, setDateRange] = useState(null);
  const [dateLimit, setDateLimit] = useState(null);

  // 获取日期范围限制
  useEffect(() => {
    fetch('/api/date-range')
      .then(r => r.json())
      .then(json => {
        if (json.success && json.data) {
          setDateLimit({
            min: dayjs(json.data.min_date),
            max: dayjs(json.data.max_date)
          });
        }
      })
      .catch(console.error);
  }, []);

  // 数据状态
  const [overview, setOverview] = useState(null);
  const [topTopics, setTopTopics] = useState([]);
  const [topQuestions, setTopQuestions] = useState([]);
  const [network, setNetwork] = useState(null);

  // 统一数据请求
  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const t = Date.now();
      let daysParam = '';
      if (days === 'custom' && dateRange?.length === 2) {
        const s = dateRange[0].format('YYYY-MM-DD');
        const e = dateRange[1].format('YYYY-MM-DD');
        daysParam = `&start=${s}&end=${e}&start_date=${s}&end_date=${e}`;
      } else if (days === 'all') {
        daysParam = '&useAllData=1';
      } else {
        daysParam = `&days=${days}`;
      }

      const [overviewRes, topicsRes, questionsRes, networkRes] = await Promise.all([
        fetch(`/api/huawei/overview?t=${t}${daysParam}`),
        fetch(`/api/huawei/top-posts?type=topic&metric=comments&limit=10&t=${t}${daysParam}`),
        fetch(`/api/huawei/top-posts?type=question&metric=comments&limit=10&t=${t}${daysParam}`),
        fetch(`/api/huawei/network?limit=400&includeAuthorEdges=${includeAuthorEdges ? 1 : 0}&t=${t}${daysParam}`),
      ]);

      if (!overviewRes.ok) throw new Error(`overview 请求失败: ${overviewRes.status}`);
      if (!topicsRes.ok) throw new Error(`topics 请求失败: ${topicsRes.status}`);
      if (!questionsRes.ok) throw new Error(`questions 请求失败: ${questionsRes.status}`);
      if (!networkRes.ok) throw new Error(`network 请求失败: ${networkRes.status}`);

      const overviewJson = await overviewRes.json();
      const topicsJson = await topicsRes.json();
      const questionsJson = await questionsRes.json();
      const networkJson = await networkRes.json();

      if (!overviewJson.success) throw new Error(overviewJson.error || 'overview 返回失败');
      if (!topicsJson.success) throw new Error(topicsJson.error || 'topics 返回失败');
      if (!questionsJson.success) throw new Error(questionsJson.error || 'questions 返回失败');
      if (!networkJson.success) throw new Error(networkJson.error || 'network 返回失败');

      setOverview(overviewJson);
      setTopTopics(topicsJson.items || []);
      setTopQuestions(questionsJson.items || []);
      setNetwork(networkJson);
    } catch (e) {
      console.error(e);
      setError(e.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [days, dateRange, includeAuthorEdges]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // 构建请求参数字符串（传递给 AIAnalysisTab）
  let requestParams = '';
  if (days === 'custom' && dateRange?.length === 2) {
    const s = dateRange[0].format('YYYY-MM-DD');
    const e = dateRange[1].format('YYYY-MM-DD');
    requestParams = `&start=${s}&end=${e}&start_date=${s}&end_date=${e}`;
  } else {
    requestParams = days === 'all' ? '&useAllData=1' : `&days=${days}`;
  }

  // Tab 配置——受限 Tab 使用 PermissionLock 包装
  const analysisLocked = !hasTabAccess(role, 'huawei-ai-analysis');
  const insightsLocked = !hasTabAccess(role, 'huawei-business-insights');

  const tabItems = [
    {
      key: 'overview',
      label: '数据概览',
      children: (
        <OverviewTab
          overview={overview}
          topTopics={topTopics}
          topQuestions={topQuestions}
          days={days}
          loading={loading}
          error={error}
        />
      ),
    },
    {
      key: 'network',
      label: '用户网络图',
      children: (
        <NetworkGraphTab
          network={network}
          includeAuthorEdges={includeAuthorEdges}
          setIncludeAuthorEdges={setIncludeAuthorEdges}
        />
      ),
    },
    {
      key: 'analysis',
      label: analysisLocked ? (
        <span className="flex items-center gap-1.5">🔒 智能分析</span>
      ) : '智能分析',
      children: (
        <PermissionLock locked={analysisLocked}>
          <AIAnalysisTab requestParams={requestParams} />
        </PermissionLock>
      ),
    },
    {
      key: 'hotspots',
      label: insightsLocked ? (
        <span className="flex items-center gap-1.5">🔒 商业热点</span>
      ) : '商业热点',
      children: (
        <PermissionLock locked={insightsLocked}>
          <BusinessInsightsPanel requestParams={requestParams} />
        </PermissionLock>
      ),
    },
  ];

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* 内容区顶部控制栏 */}
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-white/70 border-b border-slate-200/80 shadow-sm">
        <div className="px-6 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center overflow-hidden">
              <Image src="/huawei.jpg" alt="Logo" width={36} height={36} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800">华为开发者社区 · 趋势分析大屏</h1>
              <p className="text-xs text-slate-500">基于评论交互的社交网络分析与用户建模</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <RangePicker
              value={days === 'custom' ? dateRange : null}
              onChange={(dates) => {
                setDateRange(dates);
                setDays('custom');
              }}
              disabledDate={(current) => {
                if (!dateLimit || !current) return false;
                return current.isBefore(dateLimit.min, 'day') || current.isAfter(dateLimit.max, 'day');
              }}
              presets={[
                { label: '近 7 天', value: [dayjs().subtract(7, 'd'), dayjs()] },
                { label: '近 30 天', value: [dayjs().subtract(30, 'd'), dayjs()] },
                { label: '近 90 天', value: [dayjs().subtract(90, 'd'), dayjs()] },
              ]}
              style={{ width: 260 }}
            />
            <Select
              value={days}
              onChange={(val) => {
                setDays(val);
                if (val !== 'custom') setDateRange(null);
              }}
              style={{ width: 120 }}
              options={[
                { label: '自定义', value: 'custom' },
                { label: '全部数据', value: 'all' },
                { label: '近 7 天', value: 7 },
                { label: '近 30 天', value: 30 },
                { label: '近 90 天', value: 90 },
              ]}
            />
            <button
              onClick={fetchAll}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors flex items-center gap-2"
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </button>
          </div>
        </div>
      </div>

      {/* 主内容区 - Tabs */}
      <div className="px-6 py-6 relative z-10">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          size="large"
          tabBarStyle={{
            backgroundColor: 'rgba(255,255,255,0.8)',
            backdropFilter: 'blur(12px)',
            padding: '8px 16px',
            borderRadius: '16px',
            marginBottom: '24px',
            border: '1px solid rgba(226,232,240,0.8)',
          }}
        />
      </div>
    </div>
  );
}
