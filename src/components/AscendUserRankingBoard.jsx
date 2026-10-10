'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Select, Spin, Empty, Pagination, Segmented, DatePicker } from 'antd';
import dayjs from 'dayjs';
const { RangePicker } = DatePicker;
import { useSearchParams } from 'next/navigation';
import {
  ArrowLeft, Trophy, Home, Award, Sparkles, ArrowUp, ArrowDown,
} from 'lucide-react';
import AscendUserDetailModal from './AscendUserDetailModal';
import { useAnalysisContext } from '@/context/AnalysisContext';
import NetworkWeightsEditor from '@/components/NetworkWeightsEditor';
import { appendWeightParams, parseWeightsFromParams } from '@/utils/networkWeights';

const normalizeUserName = (name) => String(name || '').trim().toLowerCase();

const DIMENSION_LABELS = {
  influence_score: '综合影响力',
  pagerank: 'PageRank',
  in_degree: '入度(被回复)',
  betweenness: '中介中心性',
  quality_score: '内容质量',
  innovation_score: '创新度',
  sentiment_score: '情感正向度',
  diversity_score: '话题覆盖度',
  consistency_score: '活跃稳定度',
};

const TABLE_DIMENSIONS = [
  'influence_score',
  'pagerank',
  'in_degree',
  'betweenness',
  'quality_score',
  'innovation_score',
  'sentiment_score',
  'diversity_score',
  'consistency_score',
];

/**
 * 昇腾社区排行榜（与华为对齐，8 维）
 */
export default function AscendUserRankingBoard() {
  const { getCachedRanking, setCachedRanking } = useAnalysisContext();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [topN, setTopN] = useState(50); // Default to 50 like topLimit in UserRankingBoard
  const [sortBy, setSortBy] = useState('influence_score');
  const [sortOrder, setSortOrder] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pendingLocateUser, setPendingLocateUser] = useState('');
  const [highlightUser, setHighlightUser] = useState('');
  const [locateMessage, setLocateMessage] = useState('');
  const [loadedTopN, setLoadedTopN] = useState(null);
  const rowRefs = useRef({});
  const pageSize = 10;

  const searchParams = useSearchParams();
  const initStartDate = searchParams.get('start_date');
  const initEndDate = searchParams.get('end_date');
  const initDays = searchParams.get('days');
  const initUseAllData = searchParams.get('useAllData');
  const locateParam = searchParams.get('locate_user') || searchParams.get('user_name') || '';
  const [appliedWeights, setAppliedWeights] = useState(() => parseWeightsFromParams(searchParams));
  const [displayWeights, setDisplayWeights] = useState(null);

  const [dateType, setDateType] = useState(() => {
    if (initStartDate && initEndDate) return 'custom';
    if (initUseAllData === '1') return 'all';
    if (initDays) return initDays;
    return 'all';
  });

  const [dateRange, setDateRange] = useState(() => {
    if (initStartDate && initEndDate) {
      return [dayjs(initStartDate), dayjs(initEndDate)];
    }
    return null;
  });

  const [dateLimit, setDateLimit] = useState(null);

  useEffect(() => {
    const target = locateParam.trim();
    if (target) {
      setPendingLocateUser(target);
      setLocateMessage('');
    }
  }, [locateParam]);

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

  // 用户弹窗
  const [modalOpen, setModalOpen] = useState(false);
  const [modalUser, setModalUser] = useState('');

  const fetchRanking = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        top_n: String(topN),
        t: String(Date.now()),
      });
      
      if (dateType === 'custom' && dateRange?.length === 2) {
        const s = dateRange[0].format('YYYY-MM-DD');
        const e = dateRange[1].format('YYYY-MM-DD');
        params.append('start', s);
        params.append('end', e);
        params.append('start_date', s);
        params.append('end_date', e);
      } else if (dateType === 'all') {
        params.append('useAllData', '1');
      } else {
        params.append('days', dateType);
      }
      appendWeightParams(params, appliedWeights);

      const res = await fetch(`/api/ascend/network-analysis?${params}`);
      if (!res.ok) throw new Error(`请求失败: ${res.status}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || '获取排行失败');

      const rankingData = json.data;
      setData(rankingData);
      setDisplayWeights(rankingData?.weights || null);
      setLoadedTopN(topN);

    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [topN, dateType, dateRange, appliedWeights]);

  useEffect(() => {
    setCurrentPage(1);
    fetchRanking();
  }, [fetchRanking]);

  const topUsers = data?.top_users || data?.network?.top_users || data?.data?.network?.top_users || [];

  const sortedUsers = [...topUsers].sort((a, b) => {
    const av = a[sortBy] ?? 0;
    const bv = b[sortBy] ?? 0;
    const diff = bv - av;
    return sortOrder === 'desc' ? diff : -diff;
  });

  const handleSort = (key) => {
    if (sortBy === key) {
      setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
      return;
    }
    setSortBy(key);
    setSortOrder('desc');
  };

  useEffect(() => {
    if (!pendingLocateUser || loading || loadedTopN !== topN || sortedUsers.length === 0) {
      return;
    }

    const target = normalizeUserName(pendingLocateUser);
    const idx = sortedUsers.findIndex((u) => normalizeUserName(u.user) === target);

    if (idx >= 0) {
      const matchedUser = sortedUsers[idx].user;
      const targetPage = Math.floor(idx / pageSize) + 1;
      setCurrentPage(targetPage);
      setHighlightUser(matchedUser);
      setPendingLocateUser('');
      setLocateMessage(`已定位到 ${matchedUser}（第 ${idx + 1} 名，第 ${targetPage} 页）`);
      return;
    }

    if (topN < 100) {
      setLocateMessage(`当前 Top ${topN} 未命中，已自动扩展到 Top 100 继续定位`);
      setTopN(100);
      return;
    }

    setLocateMessage(`未在实时榜单中找到 ${pendingLocateUser}，可能与建模快照存在时间差`);
    setPendingLocateUser('');
  }, [pendingLocateUser, loading, loadedTopN, topN, sortedUsers]);

  useEffect(() => {
    if (!highlightUser) return;

    const rowEl = rowRefs.current[highlightUser];
    if (rowEl) {
      rowEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const timer = setTimeout(() => setHighlightUser(''), 2200);
      return () => clearTimeout(timer);
    }
  }, [highlightUser, currentPage]);

  const handleUserClick = (userName) => {
    setModalUser(userName);
    setModalOpen(true);
  };

  return (
    <div className="min-h-screen text-slate-800">
      {/* 内容区顶部标题栏 */}
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-white/70 border-b border-slate-200/80 shadow-sm">
        <div className="px-6 py-3 flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl shadow-lg shadow-amber-500/20">
            <Trophy className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">昇腾社区 · 影响力排行榜</h1>
            <p className="text-xs text-slate-500">与华为一致的 8 维综合评分</p>
          </div>
        </div>
      </div>

      <div className="px-6 py-8">
        {/* 控制栏 */}
        <div className="bg-white/80 backdrop-blur rounded-2xl border border-white/60 shadow-lg p-4 mb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-600">榜单范围:</span>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-slate-200">
                  <RangePicker
                    value={dateType === 'custom' ? dateRange : null}
                    onChange={(dates) => {
                      setDateRange(dates);
                      setDateType('custom');
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
                    style={{ width: 230 }}
                    variant="borderless"
                  />
                  <div className="w-px h-6 bg-slate-200 mx-1"></div>
                  <Select
                    value={String(dateType)}
                    onChange={(val) => {
                      setDateType(val);
                      if (val !== 'custom') setDateRange(null);
                    }}
                    style={{ width: 110 }}
                    variant="borderless"
                    options={[
                      { label: '自定义', value: 'custom' },
                      { label: '全部数据', value: 'all' },
                      { label: '近 7 天', value: '7' },
                      { label: '近 30 天', value: '30' },
                      { label: '近 90 天', value: '90' },
                    ]}
                  />
                </div>
                <Segmented
                  value={topN}
                  onChange={setTopN}
                  options={[
                    { label: 'Top 30', value: 30 },
                    { label: 'Top 50', value: 50 },
                    { label: 'Top 100', value: 100 },
                  ]}
                  className="!bg-slate-100"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-600">排序:</span>
              <Select
                value={sortBy}
                onChange={(val) => {
                  setSortBy(val);
                  setSortOrder('desc');
                }}
                style={{ width: 160 }}
                options={TABLE_DIMENSIONS.map((k) => ({ value: k, label: DIMENSION_LABELS[k] }))}
              />
            </div>
          </div>
        </div>
        {locateMessage && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 mb-3 text-sm text-amber-700">
            {locateMessage}
          </div>
        )}

        {(displayWeights || appliedWeights) && (
          <div className="mb-3">
            <NetworkWeightsEditor
              weights={displayWeights || appliedWeights}
              loading={loading}
              onApply={(weights) => {
                setCurrentPage(1);
                setAppliedWeights(weights);
              }}
              onReset={() => {
                setCurrentPage(1);
                setAppliedWeights(null);
              }}
              title="榜单权重设置"
              description="支持在详细榜单页直接调整维度权重并重算排名"
            />
          </div>
        )}
        {loading ? (
          <div className="flex justify-center py-20"><Spin size="large" tip="正在计算排行..."><div className="p-12" /></Spin></div>
        ) : error ? (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-center">
            <div className="text-rose-700 font-semibold">加载失败</div>
            <div className="text-rose-600 text-sm mt-1">{error}</div>
          </div>
        ) : sortedUsers.length === 0 ? (
          <Empty description="暂无排行数据" className="py-20" />
        ) : (
          <div className="space-y-3">
            {/* 排行列表 */}
            <div className="bg-white/80 backdrop-blur rounded-3xl border border-white/60 shadow-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">排名</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">用户</th>
                      {TABLE_DIMENSIONS.map((key) => (
                        <th
                          key={key}
                          className={`px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider cursor-pointer hover:text-indigo-500 ${sortBy === key ? 'text-indigo-600' : 'text-slate-600'}`}
                          onClick={() => handleSort(key)}
                        >
                          <span className="inline-flex items-center justify-end gap-1 w-full">
                            {DIMENSION_LABELS[key]}
                            {sortBy === key && (
                              sortOrder === 'asc'
                                ? <ArrowUp className="w-3.5 h-3.5" />
                                : <ArrowDown className="w-3.5 h-3.5" />
                            )}
                          </span>
                        </th>
                      ))}
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">标签</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sortedUsers
                      .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                      .map((u, i) => {
                        const realIdx = (currentPage - 1) * pageSize + i;
                        const isHighlighted = highlightUser === u.user;
                        return (
                          <tr
                            key={`${u.user || 'user'}-${realIdx}`}
                            ref={(node) => {
                              if (u.user) {
                                if (node) rowRefs.current[u.user] = node;
                                else delete rowRefs.current[u.user];
                              }
                            }}
                            className={`transition-all duration-300 cursor-pointer group
                              ${isHighlighted
                                ? 'bg-amber-100/70 ring-1 ring-inset ring-amber-300 shadow-md scale-[1.01]'
                                : 'hover:bg-indigo-50/50'
                              }`}
                            onClick={() => handleUserClick(u.user)}>
                            <td className="px-4 py-3">
                              <div className={`w-10 h-10 flex items-center justify-center rounded-full font-bold text-sm ${realIdx < 3
                                ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md'
                                : realIdx < 10
                                  ? 'bg-gradient-to-br from-indigo-400 to-purple-500 text-white'
                                  : 'bg-slate-100 text-slate-600'
                                }`}>
                                {realIdx + 1}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-slate-800 group-hover:text-indigo-600 transition-colors">
                                  {u.user}
                                </span>
                                {realIdx < 3 && <Trophy className="w-4 h-4 text-amber-500" />}
                              </div>
                            </td>
                            {TABLE_DIMENSIONS.map((key) => (
                              <td key={key} className={`px-4 py-3 text-right ${sortBy === key ? 'text-indigo-600 font-medium' : 'text-slate-600'}`}>
                                {typeof u[key] === 'number' ? (u[key] < 1 ? u[key].toFixed(4) : u[key].toFixed(2)) : '-'}
                              </td>
                            ))}
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-1 flex-wrap">
                                {(u.quality_score || 0) >= 8 && (
                                  <span className="px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded-full border border-orange-200 flex items-center gap-1">
                                    <Award className="w-3 h-3" />
                                    高质量
                                  </span>
                                )}
                                {(u.innovation_score || 0) >= 7 && (
                                  <span className="px-2 py-1 text-xs bg-pink-100 text-pink-700 rounded-full border border-pink-200 flex items-center gap-1">
                                    <Sparkles className="w-3 h-3" />
                                    创新者
                                  </span>
                                )}
                                {(u.sentiment_score || 0) >= 8 && (
                                  <span className="px-2 py-1 text-xs bg-teal-100 text-teal-700 rounded-full border border-teal-200">
                                    正能量
                                  </span>
                                )}
                                {(u.consistency_score || 0) >= 7 && (
                                  <span className="px-2 py-1 text-xs bg-lime-100 text-lime-700 rounded-full border border-lime-200">
                                    持续贡献
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 分页组件 */}
            {sortedUsers.length > 0 && (
              <div className="flex justify-center mt-3">
                <Pagination
                  current={currentPage}
                  pageSize={pageSize}
                  total={sortedUsers.length}
                  onChange={setCurrentPage}
                  showSizeChanger={false}
                  showQuickJumper
                />
              </div>
            )}

          </div>
        )}
      </div>

      <AscendUserDetailModal open={modalOpen} userName={modalUser} onClose={() => setModalOpen(false)} />
    </div>
  );
}
