'use client';

import { useState, useEffect, useCallback } from 'react';
import { Tabs, message, DatePicker, Select } from 'antd';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
import {
  BarChart3, Network, Brain, Sparkles, TrendingUp, ArrowLeft
} from 'lucide-react';
import Link from 'next/link';
import OverviewTab from './OverviewTab';
import NetworkGraphTab from '../huawei-dashboard/NetworkGraphTab';
import Image from 'next/image';
import AscendAIAnalysisTab from './AscendAIAnalysisTab';
import AscendBusinessInsights from './AscendBusinessInsights';
import PermissionLock from '@/components/data-workbench/PermissionLock';
import { useAuth } from '@/context/AuthContext';
import { hasTabAccess } from '@/lib/permissions';

/**
 * 昇腾社区数据分析大屏（主入口）
 * 与 HuaweiDashboard 架构对齐，4 个 Tab
 */
export function AscendDashboard() {
  const { role } = useAuth();

  const [activeTab, setActiveTab] = useState('overview');
  const [days, setDays] = useState('all');
  const [includeAuthorEdges, setIncludeAuthorEdges] = useState(true);

  const [dateRange, setDateRange] = useState(null);
  const [dateLimit, setDateLimit] = useState(null);

  // 获取日期范围限制
  useEffect(() => {
    fetch('/api/ascend/date-range')
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

  // 数据概览状态
  const [overview, setOverview] = useState(null);
  const [topTopics, setTopTopics] = useState([]);
  const [topQuestions, setTopQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 板块统计
  const [sectionStats, setSectionStats] = useState(null);
  // 问答健康度
  const [qaHealth, setQaHealth] = useState(null);

  // 网络图数据
  const [network, setNetwork] = useState(null);

  // 获取概览数据
  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (days === 'custom' && dateRange?.length === 2) {
        const s = dateRange[0].format('YYYY-MM-DD');
        const e = dateRange[1].format('YYYY-MM-DD');
        params.set('start', s);
        params.set('end', e);
        params.set('start_date', s);
        params.set('end_date', e);
      } else if (days === 'all') {
        params.set('useAllData', '1');
      } else {
        params.set('days', days);
      }

      const [ovRes, topicRes, questionRes, sectionRes, qaRes, netRes] = await Promise.all([
        fetch(`/api/ascend/overview?${params}`),
        fetch(`/api/ascend/top-posts?type=topic&metric=comments&limit=10&${params}`),
        fetch(`/api/ascend/top-posts?type=question&metric=comments&limit=10&${params}`),
        fetch(`/api/ascend/tags?type=sections`),
        fetch(`/api/ascend/tags?type=qa-health`),
        fetch(`/api/ascend/network?limit=400&includeAuthorEdges=${includeAuthorEdges ? 1 : 0}&${params}`),
      ]);

      const [ovData, topicData, questionData, sectionData, qaData, netData] = await Promise.all([
        ovRes.json(), topicRes.json(), questionRes.json(), sectionRes.json(), qaRes.json(), netRes.json(),
      ]);

      if (ovData.success) setOverview(ovData);
      else setError(ovData.error || '加载概览失败');

      if (topicData.success) setTopTopics(topicData.items || []);
      if (questionData.success) setTopQuestions(questionData.items || []);
      if (sectionData.success) setSectionStats(sectionData.data);
      if (qaData.success) setQaHealth(qaData.data);
      if (netData.success) setNetwork(netData);
    } catch (e) {
      setError(e.message || '网络请求失败');
    } finally {
      setLoading(false);
    }
  }, [days, dateRange, includeAuthorEdges]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  // 与华为版一致，统一构建请求参数传递给分析类面板
  let requestParams = '';
  if (days === 'custom' && dateRange?.length === 2) {
    const s = dateRange[0].format('YYYY-MM-DD');
    const e = dateRange[1].format('YYYY-MM-DD');
    requestParams = `&start=${s}&end=${e}&start_date=${s}&end_date=${e}`;
  } else {
    requestParams = days === 'all' ? '&useAllData=1' : `&days=${days}`;
  }

  const analysisLocked = !hasTabAccess(role, 'ascend-ai-analysis');
  const insightsLocked = !hasTabAccess(role, 'ascend-business-insights');

  const tabItems = [
    {
      key: 'overview',
      label: (
        <span className="flex items-center gap-2 text-sm">
          <BarChart3 className="w-4 h-4" />
          数据概览
        </span>
      ),
      children: (
        <OverviewTab
          overview={overview}
          topTopics={topTopics}
          topQuestions={topQuestions}
          sectionStats={sectionStats}
          qaHealth={qaHealth}
          days={days}
          loading={loading}
          error={error}
        />
      ),
    },
    {
      key: 'network',
      label: (
        <span className="flex items-center gap-2 text-sm">
          <Network className="w-4 h-4" />
          用户网络图
        </span>
      ),
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
      label: (
        <span className="flex items-center gap-2 text-sm">
          <Brain className="w-4 h-4" />
          {analysisLocked ? '🔒 智能分析' : '智能分析'}
        </span>
      ),
      children: (
        <PermissionLock locked={analysisLocked}>
          <AscendAIAnalysisTab requestParams={requestParams} />
        </PermissionLock>
      ),
    },
    {
      key: 'insights',
      label: (
        <span className="flex items-center gap-2 text-sm">
          <Sparkles className="w-4 h-4" />
          {insightsLocked ? '🔒 商业洞察' : '商业洞察'}
        </span>
      ),
      children: (
        <PermissionLock locked={insightsLocked}>
          <AscendBusinessInsights requestParams={requestParams} />
        </PermissionLock>
      ),
    },
  ];

  return (
    <div className="min-h-screen text-slate-800 selection:bg-sky-500/30">
      {/* 内容区顶部控制栏 */}
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-white/70 border-b border-slate-200/80 shadow-sm">
        <div className="px-6 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center overflow-hidden">
              <Image src="/ascend.png" alt="Logo" width={28} height={28} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800">昇腾开发者社区 · 趋势分析大屏</h1>
              <p className="text-xs text-slate-500">基于社区交互的智能洞察</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">时间范围：</span>
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
              value={String(days)}
              onChange={(val) => {
                setDays(val);
                if (val !== 'custom') setDateRange(null);
              }}
              style={{ width: 120 }}
              options={[
                { label: '自定义', value: 'custom' },
                { label: '全部数据', value: 'all' },
                { label: '近 7 天', value: '7' },
                { label: '近 30 天', value: '30' },
                { label: '近 90 天', value: '90' },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 py-4">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          className="ascend-dashboard-tabs"
          size="large"
        />
      </div>

      {/* 自定义样式 */}
      <style jsx global>{`
        .ascend-dashboard-tabs .ant-tabs-nav::before {
          border-bottom: 1px solid rgba(226,232,240,0.8) !important;
        }
        .ascend-dashboard-tabs .ant-tabs-tab {
          color: rgba(100, 116, 139, 0.8) !important;
          padding: 12px 4px !important;
        }
        .ascend-dashboard-tabs .ant-tabs-tab:hover {
          color: rgba(14, 165, 233, 0.9) !important;
        }
        .ascend-dashboard-tabs .ant-tabs-tab-active .ant-tabs-tab-btn {
          color: #38bdf8 !important;
        }
        .ascend-dashboard-tabs .ant-tabs-ink-bar {
          background: linear-gradient(to right, #0ea5e9, #3b82f6) !important;
          height: 3px !important;
          border-radius: 2px !important;
        }
      `}</style>
    </div>
  );
}
