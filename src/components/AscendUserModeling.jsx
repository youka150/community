'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Empty, Spin, Input, Pagination } from 'antd';
import {
  ArrowLeft, Search, User, FileText, MessageSquare, ThumbsUp,
  Eye, MessageCircle, Clock, ExternalLink, Trophy, TrendingUp,
  Award, Sparkles, BarChart3, Users, HelpCircle, Hash, Zap,
  Activity, BookOpen, Star, ChevronRight, Home, Shield, Layers
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  ResponsiveContainer, Cell, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';

/**
 * 昇腾社区 · 用户建模页面
 * 左侧栏：用户列表（支持搜索/分页）
 * 右侧：选中用户的多维度画像
 */
export default function AscendUserModeling() {
  // 左侧栏状态
  const [userList, setUserList] = useState([]);
  const [userTotal, setUserTotal] = useState(0);
  const [userPage, setUserPage] = useState(1);
  const [userSearch, setUserSearch] = useState('');
  const [userListLoading, setUserListLoading] = useState(false);

  // 右侧画像状态
  const [selectedUser, setSelectedUser] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState(null);

  const searchTimerRef = useRef(null);

  // 获取用户列表
  const fetchUserList = useCallback(async (search = '', page = 1) => {
    setUserListLoading(true);
    try {
      const params = new URLSearchParams({
        search,
        page: String(page),
        page_size: '30',
        t: String(Date.now()),
      });
      const res = await fetch(`/api/ascend/users?${params}`);
      if (!res.ok) throw new Error(`请求失败: ${res.status}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || '获取用户列表失败');
      setUserList(json.data?.users || []);
      setUserTotal(json.data?.total || 0);
    } catch (e) {
      console.error('获取用户列表失败:', e);
    } finally {
      setUserListLoading(false);
    }
  }, []);

  // 获取用户画像
  const fetchProfile = useCallback(async (userName) => {
    setProfileLoading(true);
    setProfileError(null);
    try {
      const res = await fetch(`/api/ascend/user-profile?user_name=${encodeURIComponent(userName)}&t=${Date.now()}`);
      if (!res.ok) throw new Error(`请求失败: ${res.status}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || '获取用户画像失败');
      setProfileData(json.data);
    } catch (e) {
      console.error('获取用户画像失败:', e);
      setProfileError(e.message || '加载失败');
    } finally {
      setProfileLoading(false);
    }
  }, []);

  // 初始加载用户列表
  useEffect(() => {
    fetchUserList();
  }, [fetchUserList]);

  // 搜索防抖
  const handleSearchChange = (e) => {
    const val = e.target.value;
    setUserSearch(val);
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setUserPage(1);
      fetchUserList(val, 1);
    }, 400);
  };

  // 分页
  const handlePageChange = (page) => {
    setUserPage(page);
    fetchUserList(userSearch, page);
  };

  // 选择用户
  const handleSelectUser = (userName) => {
    setSelectedUser(userName);
    fetchProfile(userName);
  };

  // 格式化时间
  const formatTime = (timeStr) => {
    if (!timeStr || timeStr === 'None') return '未知';
    try {
      const d = new Date(timeStr);
      if (isNaN(d.getTime())) return timeStr;
      return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
    } catch {
      return timeStr;
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* 内容区顶部标题栏 */}
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-white/70 border-b border-slate-200/80 shadow-sm">
        <div className="px-6 py-3 flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-sky-500 to-blue-600 rounded-xl shadow-lg shadow-sky-500/20">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">昇腾社区 · 用户建模</h1>
            <p className="text-xs text-slate-500">多维度用户画像分析与排行榜联动</p>
          </div>
        </div>
      </div>

      {/* 主内容区 — 左右布局 */}
      <div className="px-6 py-6 relative z-10 flex gap-6" style={{ minHeight: 'calc(100vh - 65px)' }}>
        {/* 左侧栏 — 用户列表 */}
        <aside className="w-[320px] shrink-0 flex flex-col">
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-slate-200 shadow-sm flex flex-col" style={{ height: 'calc(100vh - 110px)', position: 'sticky', top: '80px' }}>
            {/* 搜索框 */}
            <div className="p-4 border-b border-slate-100">
              <Input
                prefix={<Search className="w-4 h-4 text-slate-400" />}
                placeholder="搜索用户名..."
                value={userSearch}
                onChange={handleSearchChange}
                allowClear
                className="rounded-xl border-slate-200"
              />
              <div className="text-xs text-slate-500 mt-2">
                共 {userTotal} 位用户
              </div>
            </div>

            {/* 用户列表 */}
            <div className="flex-1 overflow-y-auto px-2 py-2">
              {userListLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-5 h-5 border-2 border-slate-200 border-t-sky-500 rounded-full animate-spin" />
                </div>
              ) : userList.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">暂无用户</div>
              ) : (
                userList.map((u, idx) => (
                  <button
                    key={u.user_name}
                    onClick={() => handleSelectUser(u.user_name)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl mb-1 transition-all group
                      ${selectedUser === u.user_name
                        ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/20'
                        : 'hover:bg-slate-100 text-slate-700'
                      }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                        ${selectedUser === u.user_name
                          ? 'bg-white/20 text-white'
                          : 'bg-sky-50 text-sky-600 border border-sky-100'
                        }`}>
                        {u.user_name?.charAt(0)?.toUpperCase() || 'U'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`font-medium truncate text-sm ${selectedUser === u.user_name ? 'text-white' : 'text-slate-800'}`}>
                            {u.user_name}
                          </span>
                          {u.is_hero && <Shield className="w-3.5 h-3.5 text-amber-500 shrink-0" title="社区英雄" />}
                        </div>
                        <div className={`flex items-center gap-3 text-xs mt-0.5
                          ${selectedUser === u.user_name ? 'text-white/70' : 'text-slate-400'}`}>
                          <span className="flex items-center gap-0.5">
                            <MessageCircle className="w-3 h-3" />
                            {u.comment_count || 0}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <ThumbsUp className="w-3 h-3" />
                            {u.total_likes || 0}
                          </span>
                          {u.topic_count > 0 && (
                            <span className="flex items-center gap-0.5">
                              <FileText className="w-3 h-3" />
                              {u.topic_count}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className={`w-4 h-4 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity
                        ${selectedUser === u.user_name ? 'opacity-100 text-white/60' : 'text-slate-300'}`} />
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* 分页 */}
            {userTotal > 30 && (
              <div className="p-3 border-t border-slate-100 flex justify-center">
                <Pagination
                  current={userPage}
                  pageSize={30}
                  total={userTotal}
                  onChange={handlePageChange}
                  showSizeChanger={false}
                  size="small"
                  simple
                />
              </div>
            )}
          </div>
        </aside>

        {/* 右侧 — 用户画像 */}
        <main className="flex-1 min-w-0 flex flex-col min-h-0" style={{ height: 'calc(100vh - 110px)' }}>
          <div className="flex-1 overflow-hidden min-h-0 h-full">
            {!selectedUser ? (
              <EmptyState />
            ) : profileLoading ? (
              <LoadingState />
            ) : profileError ? (
              <ErrorState error={profileError} />
            ) : profileData ? (
              <UserProfile data={profileData} formatTime={formatTime} />
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}

// ========== 空状态 ==========
function EmptyState() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-sky-50 to-blue-50 flex items-center justify-center border border-sky-100">
          <Users className="w-10 h-10 text-sky-400" />
        </div>
        <h3 className="text-lg font-semibold text-slate-700 mb-2">选择一位用户</h3>
        <p className="text-sm text-slate-500 max-w-[300px] mx-auto">
          从左侧列表中选择或搜索一位用户，查看其多维度画像分析
        </p>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center h-full">
      <Spin size="large" tip="正在构建用户画像...">
        <div className="p-12" />
      </Spin>
    </div>
  );
}

function ErrorState({ error }) {
  return (
    <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 mt-4">
      <div className="font-semibold text-rose-700">加载失败</div>
      <div className="text-sm text-rose-600 mt-1">{error}</div>
    </div>
  );
}

// ========== 用户画像主面板 ==========
function UserProfile({ data, formatTime }) {
  const stats = data?.stats || {};
  const meta = data?.user_meta || {};
  const ranking = data?.ranking_info;
  const tags = data?.tags || [];
  const activity = data?.activity_range || {};
  const daily = data?.daily_activity || [];
  const sections = data?.sections || [];

  const allComments = [
    ...(data?.topic_comments || []),
    ...(data?.question_comments || []),
  ].sort((a, b) => {
    const timeA = new Date(a.create_time || 0).getTime();
    const timeB = new Date(b.create_time || 0).getTime();
    return timeB - timeA;
  });

  // 雷达图数据
  const radarData = [];
  if (ranking) {
    const dimensions = [
      { key: 'pagerank', label: 'PageRank', max: 10 },
      { key: 'in_degree', label: '入度', max: 10 },
      { key: 'betweenness', label: '介数中心', max: 10 },
      { key: 'quality_score', label: '内容质量', max: 10 },
      { key: 'innovation_score', label: '创新度', max: 10 },
      { key: 'sentiment_score', label: '情感正向', max: 10 },
      { key: 'diversity_score', label: '话题覆盖', max: 10 },
      { key: 'consistency_score', label: '活跃稳定', max: 10 },
    ];
    dimensions.forEach(d => {
      radarData.push({ subject: d.label, value: ranking[d.key]?.toFixed(2) ?? 0, fullMark: d.max });
    });
  }

  // 图表色彩
  const CHART_COLORS = ['#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#f97316', '#f59e0b', '#eab308', '#84cc16'];
  const tooltipStyle = {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    border: '1px solid rgba(226,232,240,0.8)',
    borderRadius: '12px',
    color: '#475569',
  };

  const renderOverview = () => (
    <div className="space-y-4">
      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard
          icon={<FileText className="w-4 h-4" />}
          label="发布话题"
          value={stats.topic_count || 0}
          color="sky"
        />
        <StatCard
          icon={<MessageSquare className="w-4 h-4" />}
          label="发表评论"
          value={(stats.topic_comment_count || 0) + (stats.question_comment_count || 0)}
          color="blue"
        />
        <StatCard
          icon={<ThumbsUp className="w-4 h-4" />}
          label="总获赞"
          value={stats.total_likes || 0}
          color="amber"
        />
        <StatCard
          icon={<Award className="w-4 h-4" />}
          label="被采纳"
          value={stats.adopted_count || 0}
          color="emerald"
        />
        <StatCard
          icon={<Layers className="w-4 h-4" />}
          label="覆盖板块"
          value={sections.length || 0}
          color="violet"
        />
      </div>

      {/* 排行榜联动卡片 */}
      {ranking?.rank && (
        <RankingCard ranking={ranking} userName={data?.user_name} />
      )}

      {/* 雷达图 + 板块分布 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 多维能力评估 */}
        {radarData.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
              <Shield className="w-4 h-4 text-sky-500" />
              多维能力评估
            </h3>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                  <PolarGrid stroke="rgba(0,0,0,0.06)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 11 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 10]} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <Radar name="评分" dataKey="value" stroke="#0ea5e9" fill="#0ea5e9" fillOpacity={0.25} strokeWidth={2} />
                  <ReTooltip contentStyle={tooltipStyle} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* 板块分布 */}
        {sections.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
              <Layers className="w-4 h-4 text-violet-500" />
              板块参与分布
            </h3>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sections.slice(0, 8)} layout="vertical" margin={{ top: 5, right: 10, left: 80, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={true} vertical={true} />
                  <XAxis type="number" stroke="#94a3b8" fontSize={11} />
                  <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={11} width={80} tick={{ fill: '#64748b' }} interval={0} />
                  <ReTooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="count" name="评论数" radius={[0, 6, 6, 0]} barSize={12}>
                    {sections.slice(0, 8).map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* 活跃度时间线 */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4 text-sky-500" />
          日活跃度趋势
        </h3>
        {daily.length > 0 ? (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={daily} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickFormatter={(v) => v?.slice(5) || v}
                axisLine={false}
                tickLine={false}
              />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <ReTooltip
                contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: 13 }}
                formatter={(v) => [`${v} 条评论`, '活跃度']}
                labelFormatter={(v) => `${v}`}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={30} fill="#0ea5e9" opacity={0.8} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-8 text-slate-400 text-sm">暂无活跃数据</div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-4 flex flex-col h-full min-h-0">
      {/* 用户头部 + 标签 */}
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-slate-200 shadow-sm p-6 shrink-0">
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-lg shadow-sky-500/20 shrink-0">
            <span className="text-2xl font-bold text-white">{data.user_name?.charAt(0)?.toUpperCase() || 'U'}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-2xl font-bold text-slate-800">{data.user_name}</h2>
              {meta.level_name && <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded-full border border-blue-100">{meta.level_name}</span>}
              {meta.is_hero && <span className="px-2 py-0.5 bg-amber-50 text-amber-600 text-xs rounded-full border border-amber-200 flex items-center gap-1"><Shield className="w-3 h-3" />社区英雄</span>}
            </div>

            <div className="flex items-center gap-3 mt-2 text-sm text-slate-500">
              <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 opacity-70" />
                {activity.first_active
                  ? `活跃于 ${formatTime(activity.first_active)} ~ ${formatTime(activity.last_active)}`
                  : '暂无活跃记录'}
              </span>
              <span className="text-slate-300">|</span>
              <span className="flex items-center gap-1"><Users className="w-4 h-4 opacity-70" />{meta.followers || 0} 粉丝</span>
            </div>

            {/* 标签 */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3 mb-1">
                {tags.map((tag, i) => (
                  <span
                    key={i}
                    className={`px-2.5 py-1 text-xs rounded-full font-medium border
                      ${tag.includes('Top 10') ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : tag.includes('Top 50') ? 'bg-orange-50 text-orange-700 border-orange-200'
                          : tag.includes('核心') || tag.includes('高质量') ? 'bg-sky-50 text-sky-700 border-sky-200'
                            : tag.includes('创新') ? 'bg-pink-50 text-pink-700 border-pink-200'
                              : tag.includes('高人气') ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                      }`}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
          {/* 排行榜徽章 */}
          {ranking?.rank && (
            <Link
              href={{
                pathname: '/console/ascend/ranking',
                query: { locate_user: data.user_name },
              }}
              className="shrink-0 flex flex-col items-center p-4 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 hover:shadow-md hover:shadow-amber-500/10 transition-all group"
            >
              <Trophy className="w-6 h-6 text-amber-500 mb-1 group-hover:scale-110 transition-transform" />
              <div className="text-2xl font-bold text-amber-600">#{ranking.rank}</div>
              <div className="text-xs text-amber-500/80">影响力排行</div>
            </Link>
          )}
        </div>
      </div>

      <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-slate-200 shadow-sm p-5 flex-1 flex flex-col overflow-hidden min-h-0">
        <ContentTabs
          data={data}
          allComments={allComments}
          formatTime={formatTime}
          renderOverview={renderOverview}
        />
      </div>
    </div>
  );
}

// ========== 统计卡片子组件 ==========
function StatCard({ icon, label, value, color }) {
  const colorMap = {
    sky: 'bg-sky-50 border-sky-100 text-sky-600',
    blue: 'bg-blue-50 border-blue-100 text-blue-600',
    violet: 'bg-violet-50 border-violet-100 text-violet-600',
    rose: 'bg-rose-50 border-rose-100 text-rose-600',
    amber: 'bg-amber-50 border-amber-100 text-amber-600',
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-600',
  };

  return (
    <div className={`p-3 rounded-xl border ${colorMap[color] || colorMap.sky}`}>
      <div className="flex items-center justify-between opacity-80 mb-2">
        <span className="text-xs font-medium">{label}</span>
        {icon}
      </div>
      <div className="text-2xl font-bold">{typeof value === 'number' ? value.toLocaleString() : value}</div>
    </div>
  );
}

// ========== 排行榜联动卡片 ==========
function RankingCard({ ranking, userName }) {
  const metrics = [
    { label: '综合影响力', value: ranking.influence_score?.toFixed(4), icon: <Zap className="w-3.5 h-3.5" />, color: 'text-amber-600' },
    { label: 'PageRank', value: ranking.pagerank ? (ranking.pagerank * 100).toFixed(2) : '—', icon: <TrendingUp className="w-3.5 h-3.5" />, color: 'text-sky-600' },
    { label: '入度(被回复)', value: ranking.in_degree, icon: <MessageSquare className="w-3.5 h-3.5" />, color: 'text-purple-600' },
    { label: '内容质量', value: ranking.quality_score?.toFixed(1), icon: <Award className="w-3.5 h-3.5" />, color: 'text-orange-600' },
    { label: '互动创新', value: ranking.innovation_score?.toFixed(1), icon: <Sparkles className="w-3.5 h-3.5" />, color: 'text-pink-600' },
    { label: '情感正向', value: ranking.sentiment_score?.toFixed(1), icon: <TrendingUp className="w-3.5 h-3.5" />, color: 'text-teal-600' },
    { label: '话题覆盖', value: ranking.diversity_score?.toFixed(1), icon: <Layers className="w-3.5 h-3.5" />, color: 'text-cyan-600' },
    { label: '活跃稳定', value: ranking.consistency_score?.toFixed(1), icon: <Activity className="w-3.5 h-3.5" />, color: 'text-lime-600' },
  ];

  return (
    <div className="bg-gradient-to-r from-amber-50/70 to-orange-50/70 backdrop-blur rounded-2xl border border-amber-200/60 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-amber-800 flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-500" />
          排行榜表现
          <span className="text-sm font-normal text-amber-600/70 px-1 bg-amber-100 rounded-full">Top {ranking.top_n}</span>
        </h3>
        <Link
          href={{
            pathname: '/console/ascend/ranking',
            query: { locate_user: userName || '' },
          }}
          className="text-sm px-2.5 py-1 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors flex items-center gap-1"
        >
          查看完整榜单 <ChevronRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {metrics.map((m, i) => (
          <div key={i} className="text-center py-2 px-1 rounded-xl bg-white/70 border border-amber-100">
            <div className={`flex justify-center mb-1 ${m.color} opacity-70`}>{m.icon}</div>
            <div className={`text-sm font-bold ${m.color}`}>{m.value ?? '—'}</div>
            <div className="text-[10px] text-slate-500 mt-0.5 bg-transparent border-none truncate">{m.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ========== 内容标签页 ==========
function ContentTabs({ data, allComments, formatTime, renderOverview }) {
  const stats = data?.stats || {};
  const [activeTab, setActiveTab] = useState('overview');

  const tabs = [
    { key: 'overview', icon: BarChart3, label: '画像概览', count: null },
    { key: 'topics', icon: FileText, label: '发布的话题', count: stats.topic_count || 0 },
    { key: 'comments', icon: MessageSquare, label: '发表的评论', count: (stats.topic_comment_count || 0) + (stats.question_comment_count || 0) },
    { key: 'interactions', icon: TrendingUp, label: '互动内容榜', count: null },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return renderOverview?.() || null;
      case 'topics':
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {(data?.topics?.length || 0) === 0 ? (
              <div className="lg:col-span-2">
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无话题" className="py-6" />
              </div>
            ) : (
              data.topics.map((topic, idx) => <TopicCard key={topic.id || idx} topic={topic} formatTime={formatTime} />)
            )}
          </div>
        );
      case 'comments':
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {allComments.length === 0 ? (
              <div className="lg:col-span-2">
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无评论" className="py-6" />
              </div>
            ) : (
              allComments.map((c, idx) => <CommentCard key={c.comment_id || idx} comment={c} formatTime={formatTime} />)
            )}
          </div>
        );
      case 'interactions':
        return <InteractionRanking data={data} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* 紧凑标签栏 */}
      <div className="flex items-center gap-1 mb-4 p-1 bg-slate-50 border border-slate-100 rounded-xl w-fit">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5
                ${activeTab === tab.key
                  ? 'bg-white text-sky-600 shadow-sm border border-slate-200/50'
                  : 'text-slate-500 hover:text-slate-800'
                }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
              {tab.count !== null && (
                <span className={`px-1.5 py-0.5 text-[10px] rounded-full 
                  ${activeTab === tab.key ? 'bg-sky-50 text-sky-600' : 'bg-slate-100 text-slate-400'}`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {/* 内容区域：限制高度，超出滚动 */}
      <div className="pr-2 flex-1 min-h-0 overflow-y-auto overflow-x-hidden" style={{ maxHeight: 'calc(100vh - 350px)' }}>
        {renderContent()}
      </div>
    </div>
  );
}

// ========== 话题卡片 ==========
function TopicCard({ topic, formatTime }) {
  return (
    <div className="group p-4 rounded-xl bg-white border border-slate-100 hover:border-sky-200 hover:shadow-md transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-slate-800 mb-1.5 line-clamp-2 group-hover:text-sky-600 transition-colors">
            {topic.title || '无标题'}
          </h4>
          {topic.summary && (
            <p className="text-sm text-slate-500 line-clamp-2 mb-3 bg-slate-50 p-2 rounded-lg">{topic.summary}</p>
          )}
          <div className="flex items-center gap-4 text-xs text-slate-400 mt-2">
            <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" />{topic.views || 0}</span>
            <span className="flex items-center gap-1"><ThumbsUp className="w-3.5 h-3.5" />{topic.likes || 0}</span>
            <span className="flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" />{topic.comments || 0}</span>
            <span className="flex items-center gap-1 ml-auto text-slate-300"><Clock className="w-3 h-3" />{formatTime(topic.release_time)}</span>
          </div>
        </div>
        {topic.url && (
          <a href={topic.url} target="_blank" rel="noopener noreferrer"
            className="shrink-0 p-2 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors border border-transparent hover:border-sky-100"
            title="查看原文" onClick={(e) => e.stopPropagation()}>
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
      </div>
    </div>
  );
}

// ========== 评论卡片 ==========
function CommentCard({ comment, formatTime }) {
  const isQuestion = comment.source === 'question';
  const parentTitle = isQuestion ? comment.question_title : comment.topic_title;
  const parentUrl = isQuestion ? comment.question_url : comment.topic_url;

  return (
    <div className="group p-4 rounded-xl bg-white border border-slate-100 hover:border-sky-200 hover:shadow-md transition-all">
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2 flex-1 min-w-0 pr-2">
          <span className={`px-2 py-0.5 text-xs rounded-full font-medium shrink-0
            ${isQuestion
              ? 'bg-amber-50 text-amber-600 border border-amber-200'
              : 'bg-sky-50 text-sky-600 border border-sky-200'
            }`}>
            {isQuestion ? '问答' : '话题'}
          </span>
          <span className="text-xs text-slate-500 truncate" title={parentTitle}>
            {parentTitle || '未知话题'}
          </span>
        </div>
        {parentUrl && (
          <a href={parentUrl} target="_blank" rel="noopener noreferrer"
            className="shrink-0 text-slate-300 hover:text-sky-500 transition-colors"
            title="查看原帖" onClick={(e) => e.stopPropagation()}>
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
      </div>
      <div className="text-sm text-slate-700 mb-3 bg-slate-50 rounded-lg p-3 line-clamp-3">
        {comment.content || '（空评论）'}
      </div>
      <div className="flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1"><ThumbsUp className="w-3.5 h-3.5" />{comment.like_count || 0}</span>
          {comment.adopted === 1 && (
            <span className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 font-medium">
              <Shield className="w-3 h-3" /> 被采纳
            </span>
          )}
        </div>
        <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{formatTime(comment.create_time)}</span>
      </div>
    </div>
  );
}

// ========== 互动排行 ==========
function InteractionRanking({ data }) {
  const topTopics = data?.top_interacted_topics || [];
  const topQuestions = data?.top_interacted_questions || [];

  if (topTopics.length === 0 && topQuestions.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无互动数据" className="py-8" />;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* 话题互动 Top */}
      <div>
        <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4 text-sky-500" />
          常互动的话题
        </h4>
        <div className="space-y-2">
          {topTopics.length === 0 ? (
            <div className="text-sm text-slate-400 text-center py-4 bg-slate-50 rounded-xl">暂无数据</div>
          ) : topTopics.map((t, i) => (
            <div key={t.id || i} className="flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-100 hover:border-sky-200 hover:shadow-sm transition-all group">
              <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold
                ${i < 3 ? 'bg-sky-500 text-white shadow-sm' : 'bg-slate-100 text-slate-500'}`}>
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-700 truncate group-hover:text-sky-600 transition-colors">
                  {t.title || '未知话题'}
                </div>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <span className="text-xs bg-sky-50 text-sky-600 px-2 py-0.5 rounded-full font-medium">{t.interaction_count} 回复</span>
                {t.url && (
                  <a href={t.url} target="_blank" rel="noopener noreferrer"
                    className="text-slate-300 hover:text-sky-500 transition-colors">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 问答互动 Top */}
      <div>
        <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-amber-500" />
          常互动的问答
        </h4>
        <div className="space-y-2">
          {topQuestions.length === 0 ? (
            <div className="text-sm text-slate-400 text-center py-4 bg-slate-50 rounded-xl">暂无数据</div>
          ) : (
            topQuestions.map((q, i) => (
              <div key={q.id || i} className="flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-100 hover:border-amber-200 hover:shadow-sm transition-all group">
                <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold
                  ${i < 3 ? 'bg-amber-500 text-white shadow-sm' : 'bg-slate-100 text-slate-500'}`}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-700 truncate group-hover:text-amber-600 transition-colors">
                    {q.title || '未知问答'}
                  </div>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  <span className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full font-medium">{q.interaction_count} 回复</span>
                  {q.url && (
                    <a href={q.url} target="_blank" rel="noopener noreferrer"
                      className="text-slate-300 hover:text-amber-500 transition-colors">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
