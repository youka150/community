'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArrowLeft, Trophy, Download, Award, Sparkles, Home, Users, ArrowUp, ArrowDown } from 'lucide-react';
import { Select, Segmented, Pagination, DatePicker } from 'antd';
import dayjs from 'dayjs';
const { RangePicker } = DatePicker;
import { useSearchParams } from 'next/navigation';
import { useAnalysisContext } from '@/context/AnalysisContext';
import UserDetailModal from './UserDetailModal';
import NetworkWeightsEditor from '@/components/NetworkWeightsEditor';
import { appendWeightParams, parseWeightsFromParams } from '@/utils/networkWeights';

const normalizeUserName = (name) => String(name || '').trim().toLowerCase();

/**
 * 榜单 - 完整的用户排行榜页面
 * 支持Top 50/100切换，多维度排序，技术栈标签展示
 */
export default function UserRankingBoard() {
  // 使用全局 Context 缓存排行数据
  const { getCachedRanking, setCachedRanking } = useAnalysisContext();

  const [topLimit, setTopLimit] = useState(50);
  const [sortBy, setSortBy] = useState('influence_score'); // 排序字段
  const [sortOrder, setSortOrder] = useState('desc');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [usersData, setUsersData] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState(null);
  const [pendingLocateUser, setPendingLocateUser] = useState('');
  const [highlightUser, setHighlightUser] = useState('');
  const [locateMessage, setLocateMessage] = useState('');
  const [loadedTopLimit, setLoadedTopLimit] = useState(null);
  const rowRefs = useRef({});
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
    return 'all'; // 默认全量
  });

  const [dateRange, setDateRange] = useState(() => {
    if (initStartDate && initEndDate) {
      return [dayjs(initStartDate), dayjs(initEndDate)];
    }
    return null;
  });

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

  const pageSize = 10;

  useEffect(() => {
    const target = locateParam.trim();
    if (target) {
      setPendingLocateUser(target);
      setLocateMessage('');
    }
  }, [locateParam]);

  const fetchRankingData = async () => {
    setLoading(true);
    setError(null);

    try {
      const t = Date.now();
      let queryParams = '';
      if (dateType === 'custom' && dateRange?.length === 2) {
        const s = dateRange[0].format('YYYY-MM-DD');
        const e = dateRange[1].format('YYYY-MM-DD');
        queryParams = `&start=${s}&end=${e}&start_date=${s}&end_date=${e}`;
      } else if (dateType === 'all') {
        queryParams = '&useAllData=1';
      } else {
        queryParams = `&days=${dateType}`;
      }

      const params = new URLSearchParams();
      params.set('endpoint', 'network-analysis');
      params.set('top_n', String(topLimit));
      params.set('t', String(t));
      if (queryParams.startsWith('&')) {
        const extra = new URLSearchParams(queryParams.slice(1));
        extra.forEach((value, key) => params.set(key, value));
      }
      appendWeightParams(params, appliedWeights);

      const res = await fetch(`/api/huawei/analysis?${params.toString()}`);

      if (!res.ok) {
        throw new Error(`请求失败: ${res.status}`);
      }

      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error || '获取数据失败');
      }

      const data = json.data?.top_users || [];
      setUsersData(data);
      setDisplayWeights(json.data?.weights || null);
      setLoadedTopLimit(topLimit);

    } catch (e) {
      console.error('榜单加载错误:', e);
      setError(e.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
    fetchRankingData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topLimit, dateType, dateRange, appliedWeights]);

  // 排序用户数据
  const sortedUsers = [...usersData].sort((a, b) => {
    const valA = a[sortBy] || 0;
    const valB = b[sortBy] || 0;
    const diff = valB - valA;
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
    if (!pendingLocateUser || loading || loadedTopLimit !== topLimit || sortedUsers.length === 0) {
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

    if (topLimit < 100) {
      setLocateMessage(`当前 Top ${topLimit} 未命中，已自动扩展到 Top 100 继续定位`);
      setTopLimit(100);
      return;
    }

    setLocateMessage(`未在实时榜单中找到 ${pendingLocateUser}，可能与建模快照存在时间差`);
    setPendingLocateUser('');
  }, [pendingLocateUser, loading, loadedTopLimit, topLimit, sortedUsers]);

  useEffect(() => {
    if (!highlightUser) return;

    const rowEl = rowRefs.current[highlightUser];
    if (rowEl) {
      rowEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const timer = setTimeout(() => setHighlightUser(''), 2200);
      return () => clearTimeout(timer);
    }
  }, [highlightUser, currentPage]);

  // 导出CSV
  const exportCSV = () => {
    const headers = ['排名', '用户名', '综合影响力', 'PageRank', '入度', '出度', '质量分', '创新分', '情感分', '覆盖分', '稳定分'];
    const rows = sortedUsers.map((user, idx) => [
      idx + 1,
      user.user,
      user.influence_score?.toFixed(4) || 0,
      user.pagerank?.toFixed(4) || 0,
      user.in_degree || 0,
      user.out_degree || 0,
      user.quality_score?.toFixed(2) || 0,
      user.innovation_score?.toFixed(2) || 0,
      user.sentiment_score?.toFixed(2) || 0,
      user.diversity_score?.toFixed(2) || 0,
      user.consistency_score?.toFixed(2) || 0,
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `华为开发者社区-榜单-Top${topLimit}.csv`;
    link.click();
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* 内容区顶部标题栏 */}
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-white/70 border-b border-slate-200/80 shadow-sm">
        <div className="px-6 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl">
              <Trophy className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800">华为开发者社区 · 榜单</h1>
              <p className="text-xs text-slate-500">基于综合影响力的核心用户排行</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={exportCSV}
              disabled={loading || usersData.length === 0}
              className="px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              导出CSV
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 py-8 relative z-10">
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

              <div className="bg-white p-1 rounded-xl shadow-sm border border-slate-100">
                <Segmented
                  options={[
                    { label: 'Top 30', value: 30 },
                    { label: 'Top 50', value: 50 },
                    { label: 'Top 100', value: 100 },
                  ]}
                  value={topLimit}
                  onChange={setTopLimit}
                />
              </div>
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
                options={[
                  { label: '综合影响力', value: 'influence_score' },
                  { label: 'PageRank', value: 'pagerank' },
                  { label: '入度（被回复数）', value: 'in_degree' },
                  { label: '内容质量分', value: 'quality_score' },
                  { label: '创新度分', value: 'innovation_score' },
                  { label: '情感正向度', value: 'sentiment_score' },
                  { label: '话题覆盖度', value: 'diversity_score' },
                  { label: '活跃稳定度', value: 'consistency_score' },
                ]}
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 mb-3 text-rose-700">
            <div className="font-semibold">加载失败</div>
            <div className="text-sm mt-1">{error}</div>
          </div>
        )}

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

        {/* 榜单表格 */}
        <div className="bg-white/80 backdrop-blur rounded-3xl border border-white/60 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">排名</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">用户</th>
                  <th
                    className={`px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider cursor-pointer hover:text-indigo-500 ${sortBy === 'influence_score' ? 'text-indigo-600' : 'text-slate-600'}`}
                    onClick={() => handleSort('influence_score')}
                  >
                    <span className="inline-flex items-center justify-end gap-1 w-full">
                      综合影响力
                      {sortBy === 'influence_score' && (
                        sortOrder === 'asc'
                          ? <ArrowUp className="w-3.5 h-3.5" />
                          : <ArrowDown className="w-3.5 h-3.5" />
                      )}
                    </span>
                  </th>
                  <th
                    className={`px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider cursor-pointer hover:text-indigo-500 ${sortBy === 'pagerank' ? 'text-indigo-600' : 'text-slate-600'}`}
                    onClick={() => handleSort('pagerank')}
                  >
                    <span className="inline-flex items-center justify-end gap-1 w-full">
                      PageRank
                      {sortBy === 'pagerank' && (
                        sortOrder === 'asc'
                          ? <ArrowUp className="w-3.5 h-3.5" />
                          : <ArrowDown className="w-3.5 h-3.5" />
                      )}
                    </span>
                  </th>
                  <th
                    className={`px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider cursor-pointer hover:text-indigo-500 ${sortBy === 'in_degree' ? 'text-indigo-600' : 'text-slate-600'}`}
                    onClick={() => handleSort('in_degree')}
                  >
                    <span className="inline-flex items-center justify-end gap-1 w-full">
                      入度(被回复)
                      {sortBy === 'in_degree' && (
                        sortOrder === 'asc'
                          ? <ArrowUp className="w-3.5 h-3.5" />
                          : <ArrowDown className="w-3.5 h-3.5" />
                      )}
                    </span>
                  </th>
                  <th
                    className={`px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider cursor-pointer hover:text-indigo-500 ${sortBy === 'quality_score' ? 'text-indigo-600' : 'text-slate-600'}`}
                    onClick={() => handleSort('quality_score')}
                  >
                    <span className="inline-flex items-center justify-end gap-1 w-full">
                      内容质量
                      {sortBy === 'quality_score' && (
                        sortOrder === 'asc'
                          ? <ArrowUp className="w-3.5 h-3.5" />
                          : <ArrowDown className="w-3.5 h-3.5" />
                      )}
                    </span>
                  </th>
                  <th
                    className={`px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider cursor-pointer hover:text-indigo-500 ${sortBy === 'innovation_score' ? 'text-indigo-600' : 'text-slate-600'}`}
                    onClick={() => handleSort('innovation_score')}
                  >
                    <span className="inline-flex items-center justify-end gap-1 w-full">
                      创新度
                      {sortBy === 'innovation_score' && (
                        sortOrder === 'asc'
                          ? <ArrowUp className="w-3.5 h-3.5" />
                          : <ArrowDown className="w-3.5 h-3.5" />
                      )}
                    </span>
                  </th>
                  <th
                    className={`px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider cursor-pointer hover:text-indigo-500 ${sortBy === 'sentiment_score' ? 'text-indigo-600' : 'text-slate-600'}`}
                    onClick={() => handleSort('sentiment_score')}
                  >
                    <span className="inline-flex items-center justify-end gap-1 w-full">
                      情感正向度
                      {sortBy === 'sentiment_score' && (
                        sortOrder === 'asc'
                          ? <ArrowUp className="w-3.5 h-3.5" />
                          : <ArrowDown className="w-3.5 h-3.5" />
                      )}
                    </span>
                  </th>
                  <th
                    className={`px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider cursor-pointer hover:text-indigo-500 ${sortBy === 'diversity_score' ? 'text-indigo-600' : 'text-slate-600'}`}
                    onClick={() => handleSort('diversity_score')}
                  >
                    <span className="inline-flex items-center justify-end gap-1 w-full">
                      话题覆盖度
                      {sortBy === 'diversity_score' && (
                        sortOrder === 'asc'
                          ? <ArrowUp className="w-3.5 h-3.5" />
                          : <ArrowDown className="w-3.5 h-3.5" />
                      )}
                    </span>
                  </th>
                  <th
                    className={`px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider cursor-pointer hover:text-indigo-500 ${sortBy === 'consistency_score' ? 'text-indigo-600' : 'text-slate-600'}`}
                    onClick={() => handleSort('consistency_score')}
                  >
                    <span className="inline-flex items-center justify-end gap-1 w-full">
                      活跃稳定度
                      {sortBy === 'consistency_score' && (
                        sortOrder === 'asc'
                          ? <ArrowUp className="w-3.5 h-3.5" />
                          : <ArrowDown className="w-3.5 h-3.5" />
                      )}
                    </span>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">标签</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-12 text-center text-slate-400">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-5 h-5 border-2 border-slate-300 border-t-amber-500 rounded-full animate-spin" />
                        加载中...
                      </div>
                    </td>
                  </tr>
                ) : sortedUsers.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-12 text-center text-slate-400">
                      暂无数据
                    </td>
                  </tr>
                ) : (
                  sortedUsers
                    .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                    .map((user, idx) => {
                      const realIdx = (currentPage - 1) * pageSize + idx;
                      const isHighlighted = highlightUser === user.user;
                      return (
                        <tr
                          key={`${user.user || 'user'}-${realIdx}`}
                          ref={(node) => {
                            if (user.user) {
                              if (node) rowRefs.current[user.user] = node;
                              else delete rowRefs.current[user.user];
                            }
                          }}
                          className={`transition-all duration-300 cursor-pointer group
                            ${isHighlighted
                              ? 'bg-amber-100/70 ring-1 ring-inset ring-amber-300 shadow-md scale-[1.01]'
                              : 'hover:bg-indigo-50/50'
                            }`}
                          onClick={() => setSelectedUser(user.user)}
                        >
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
                                {user.user}
                              </span>
                              {realIdx < 3 && <Trophy className="w-4 h-4 text-amber-500" />}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-semibold text-indigo-600">{(user.influence_score || 0).toFixed(4)}</span>
                          </td>
                          <td className="px-4 py-3 text-right text-slate-600">{((user.pagerank || 0) * 100).toFixed(2)}</td>
                          <td className="px-4 py-3 text-right text-slate-600">{user.in_degree || 0}</td>
                          <td className="px-4 py-3 text-right">
                            <span className={`font-medium ${(user.quality_score || 0) >= 8 ? 'text-orange-600' : 'text-slate-600'
                              }`}>
                              {(user.quality_score || 0).toFixed(1)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className={`font-medium ${(user.innovation_score || 0) >= 7 ? 'text-pink-600' : 'text-slate-600'
                              }`}>
                              {(user.innovation_score || 0).toFixed(1)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className={`font-medium ${(user.sentiment_score || 0) >= 8 ? 'text-teal-600' : 'text-slate-600'}`}>
                              {(user.sentiment_score || 0).toFixed(1)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className={`font-medium ${(user.diversity_score || 0) >= 8 ? 'text-amber-600' : 'text-slate-600'}`}>
                              {(user.diversity_score || 0).toFixed(1)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className={`font-medium ${(user.consistency_score || 0) >= 7 ? 'text-lime-600' : 'text-slate-600'}`}>
                              {(user.consistency_score || 0).toFixed(1)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1 flex-wrap">
                              {(user.quality_score || 0) >= 8 && (
                                <span className="px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded-full border border-orange-200 flex items-center gap-1">
                                  <Award className="w-3 h-3" />
                                  高质量
                                </span>
                              )}
                              {(user.innovation_score || 0) >= 7 && (
                                <span className="px-2 py-1 text-xs bg-pink-100 text-pink-700 rounded-full border border-pink-200 flex items-center gap-1">
                                  <Sparkles className="w-3 h-3" />
                                  创新者
                                </span>
                              )}
                              {(user.sentiment_score || 0) >= 8 && (
                                <span className="px-2 py-1 text-xs bg-teal-100 text-teal-700 rounded-full border border-teal-200">
                                  正能量
                                </span>
                              )}
                              {(user.consistency_score || 0) >= 7 && (
                                <span className="px-2 py-1 text-xs bg-lime-100 text-lime-700 rounded-full border border-lime-200">
                                  持续贡献
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 分页组件 */}
        {!loading && sortedUsers.length > 0 && (
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

      {/* 用户详情弹窗 */}
      <UserDetailModal
        open={!!selectedUser}
        userName={selectedUser}
        onClose={() => setSelectedUser(null)}
      />
    </div>
  );
}
