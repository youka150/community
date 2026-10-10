'use client';

import { useState, useEffect } from 'react';
import { Activity, Users, TrendingUp, Award, MessageSquare, Eye, ArrowLeft, Zap, Target, Brain } from 'lucide-react';
import Link from 'next/link';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const CHART_COLORS = {
  primary: '#1E40AF',
  secondary: '#3B82F6', 
  accent: '#F59E0B',
  success: '#10b981',
  warning: '#F59E0B',
  danger: '#ef4444',
  pink: '#ec4899',
  orange: '#f97316',
};

// 统一的图表 Tooltip 样式
const tooltipStyle = {
  backgroundColor: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
  boxShadow: '0 10px 40px -10px rgba(0,0,0,0.1)',
  padding: '12px 16px',
};

export default function DashboardPage() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 实时数据流
  const realtimeData = {
    totalUsers: 50234,
    activeUsers: 12567,
    totalDiscussions: 45678,
    hotTopics: 2341,
    sentimentScore: 82,
    topIdeas: 156
  };

  // 趋势数据（模拟7天）
  const trendData = [
    { day: '周一', discussions: 5200, positive: 78, users: 8900 },
    { day: '周二', discussions: 6100, positive: 82, users: 10200 },
    { day: '周三', discussions: 5800, positive: 76, users: 9800 },
    { day: '周四', discussions: 6800, positive: 84, users: 11500 },
    { day: '周五', discussions: 7500, positive: 88, users: 12300 },
    { day: '周六', discussions: 6200, positive: 80, users: 10800 },
    { day: '周日', discussions: 6500, positive: 82, users: 11200 }
  ];

  // 热点话题实时流
  const hotTopicsStream = [
    { id: 1, topic: '夜间模式优化', trend: '', heat: 95 },
    { id: 2, topic: '数据同步速度', trend: '', heat: 88 },
    { id: 3, topic: 'AI智能推荐', trend: '', heat: 82 },
    { id: 4, topic: '隐私保护', trend: '', heat: 91 },
    { id: 5, topic: '协作功能', trend: '', heat: 76 }
  ];

  // 顶级用户
  const topUsers = [
    { name: 'TechExplorer', score: 95, avatar: '' },
    { name: 'InnovatorPro', score: 91, avatar: '' },
    { name: 'CreativeMinds', score: 88, avatar: '' },
    { name: 'DataNinja', score: 87, avatar: '' },
    { name: 'UXChampion', score: 85, avatar: '' }
  ];

  // 分类分布
  const categoryDistribution = [
    { category: 'UI/UX', value: 32, fill: CHART_COLORS.primary },
    { category: '性能优化', value: 24, fill: CHART_COLORS.success },
    { category: '新功能', value: 28, fill: CHART_COLORS.secondary },
    { category: '安全隐私', value: 16, fill: CHART_COLORS.warning }
  ];

  // 用户活跃度数据(按小时)
  const hourlyActivity = [
    { hour: '0:00', users: 1200 },
    { hour: '3:00', users: 800 },
    { hour: '6:00', users: 2100 },
    { hour: '9:00', users: 5600 },
    { hour: '12:00', users: 8900 },
    { hour: '15:00', users: 7200 },
    { hour: '18:00', users: 9500 },
    { hour: '21:00', users: 11200 },
    { hour: '24:00', users: 6500 }
  ];

  // 用户能力雷达图数据
  const userCapabilityData = [
    { subject: '创新能力', A: 92, fullMark: 100 },
    { subject: '影响力', A: 88, fullMark: 100 },
    { subject: '活跃度', A: 85, fullMark: 100 },
    { subject: '专业度', A: 95, fullMark: 100 },
    { subject: '贡献度', A: 90, fullMark: 100 }
  ];

  // 情感变化数据
  const sentimentTrend = [
    { name: '周一', positive: 78, negative: 12, neutral: 10 },
    { name: '周二', positive: 82, negative: 10, neutral: 8 },
    { name: '周三', positive: 76, negative: 14, neutral: 10 },
    { name: '周四', positive: 84, negative: 9, neutral: 7 },
    { name: '周五', positive: 88, negative: 7, neutral: 5 },
    { name: '周六', positive: 80, negative: 11, neutral: 9 },
    { name: '周日', positive: 82, negative: 10, neutral: 8 }
  ];

  // 指标卡片数据
  const metrics = [
    { icon: Users, label: '总用户数', value: realtimeData.totalUsers, change: '+12%', color: 'blue', gradient: 'from-blue-700 to-blue-500' },
    { icon: Activity, label: '活跃用户', value: realtimeData.activeUsers, change: '+23%', color: 'emerald', gradient: 'from-emerald-500 to-teal-500' },
    { icon: MessageSquare, label: '讨论总数', value: realtimeData.totalDiscussions, change: '+18%', color: 'blue', gradient: 'from-blue-600 to-blue-400' },
    { icon: TrendingUp, label: '热点话题', value: realtimeData.hotTopics, change: '+31%', color: 'amber', gradient: 'from-amber-500 to-amber-400' },
    { icon: Eye, label: '正面情感', value: `${realtimeData.sentimentScore}%`, change: '+8%', color: 'blue', gradient: 'from-blue-500 to-cyan-500' },
    { icon: Award, label: '优质创意', value: realtimeData.topIdeas, change: '+15%', color: 'teal', gradient: 'from-teal-500 to-emerald-400' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f7f9ff] via-[#fdfdff] to-[#f7fbff]">
      {/* 顶部标题栏 */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 border-b border-slate-200/80">
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Link href="/" className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-blue-700 to-blue-500 rounded-lg shadow-md">
                  <Brain className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-800">数据大屏</h1>
                  <p className="text-sm text-slate-500">实时监控  智能分析</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <div className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                  {time.toLocaleTimeString('zh-CN')}
                </div>
                <div className="text-sm text-slate-500">
                  {time.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-6">
        {/* 核心指标卡片 - 第一行 */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
          {metrics.map((metric, index) => (
            <div key={index} className="group bg-white rounded-lg p-4 border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-200 transition-all duration-200">
              {/* 顶部装饰条 */}
              <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-gradient-to-r ${metric.gradient} rounded-b-full opacity-0 group-hover:opacity-100 transition-opacity`} />
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2.5 bg-${metric.color}-50 rounded-xl`}>
                  <metric.icon className={`w-5 h-5 text-${metric.color}-600`} />
                </div>
                <span className="text-emerald-600 text-xs font-medium flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-full">
                  <TrendingUp className="w-3 h-3" />
                  {metric.change}
                </span>
              </div>
              <div className="text-2xl font-bold text-slate-800 mb-1">
                {typeof metric.value === 'number' ? metric.value.toLocaleString() : metric.value}
              </div>
              <div className="text-sm text-slate-500">{metric.label}</div>
            </div>
          ))}
        </div>

        {/* 主要内容区 - 第二行 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          {/* 趋势分析图表 - 使用 Area Chart */}
          <div className="lg:col-span-2 bg-white rounded-lg p-5 border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-3">
              <div className="p-2 bg-indigo-50 rounded-xl">
                <TrendingUp className="w-5 h-5 text-indigo-600" />
              </div>
              七日趋势分析
            </h3>
            
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorDiscussions" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.secondary} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={CHART_COLORS.secondary} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="day" stroke="#94a3b8" style={{ fontSize: '12px' }} axisLine={false} tickLine={false} />
                <YAxis stroke="#94a3b8" style={{ fontSize: '12px' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                <Area type="monotone" dataKey="discussions" stroke={CHART_COLORS.primary} strokeWidth={2} fillOpacity={1} fill="url(#colorDiscussions)" name="讨论数" />
                <Area type="monotone" dataKey="users" stroke={CHART_COLORS.secondary} strokeWidth={2} fillOpacity={1} fill="url(#colorUsers)" name="活跃用户" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* 热点话题实时流 */}
          <div className="bg-white rounded-lg p-5 border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-3">
              <div className="p-2 bg-amber-50 rounded-xl">
                <Activity className="w-5 h-5 text-amber-600" />
              </div>
              热点话题流
              <span className="ml-auto text-xs font-normal text-slate-400 bg-slate-100 px-2 py-1 rounded-full">实时更新</span>
            </h3>

            <div className="space-y-3">
              {hotTopicsStream.map((topic, index) => (
                <div key={topic.id} className="group rounded-xl p-4 bg-slate-50 border border-slate-100 hover:bg-white hover:border-amber-200 hover:shadow-md transition-all cursor-pointer">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className={`text-lg font-bold ${index < 3 ? 'text-amber-600' : 'text-slate-400'}`}>
                        #{index + 1}
                      </span>
                      <span className="text-lg">{topic.trend}</span>
                    </div>
                    <span className="text-lg font-bold text-amber-600">{topic.heat}</span>
                  </div>
                  <div className="text-sm font-medium text-slate-700 mb-2">{topic.topic}</div>
                  <div className="h-1.5 rounded-full overflow-hidden bg-slate-200">
                    <div className="h-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all" style={{ width: `${topic.heat}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 底部内容区 - 第三行 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          {/* 顶级用户榜 */}
          <div className="bg-white rounded-lg p-5 border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-3">
              <div className="p-2 bg-violet-50 rounded-xl">
                <Award className="w-5 h-5 text-violet-600" />
              </div>
              顶级贡献者
            </h3>

            <div className="space-y-3">
              {topUsers.map((user, index) => (
                <div key={index} className="flex items-center gap-4 rounded-xl p-3 bg-slate-50 border border-slate-100 hover:bg-white hover:border-violet-200 hover:shadow-md transition-all cursor-pointer">
                  <div className={`text-lg font-bold w-6 ${index < 3 ? 'text-violet-600' : 'text-slate-400'}`}>
                    #{index + 1}
                  </div>
                  <div className="text-2xl">{user.avatar}</div>
                  <div className="flex-1">
                    <div className="font-semibold text-slate-700">{user.name}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-slate-200">
                        <div className="h-full bg-gradient-to-r from-violet-500 to-purple-500" style={{ width: `${user.score}%` }} />
                      </div>
                      <span className="text-sm font-bold text-violet-600">{user.score}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 话题分类分布 - 使用 Pie Chart */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-xl">
                <MessageSquare className="w-5 h-5 text-blue-600" />
              </div>
              话题分类分布
            </h3>

            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={categoryDistribution} cx="50%" cy="50%" labelLine={false} outerRadius={80} innerRadius={50} fill="#8884d8" dataKey="value" paddingAngle={4}>
                  {categoryDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>

            <div className="grid grid-cols-2 gap-2 mt-4">
              {categoryDistribution.map((cat, index) => (
                <div key={index} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.fill }}></div>
                  <span className="text-xs text-slate-600">{cat.category}</span>
                  <span className="text-xs font-bold text-slate-800 ml-auto">{cat.value}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* 系统状态与智能洞察 */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-3">
              <div className="p-2 bg-emerald-50 rounded-xl">
                <Activity className="w-5 h-5 text-emerald-600" />
              </div>
              系统状态
            </h3>

            <div className="space-y-4 mb-6">
              {[
                { label: '数据采集', status: '运行中', value: 100, color: 'emerald' },
                { label: 'AI分析引擎', status: '98.5%', value: 98.5, color: 'indigo' },
                { label: '存储容量', status: '67.2%', value: 67.2, color: 'violet' },
              ].map((item, index) => (
                <div key={index} className="rounded-xl p-4 bg-slate-50">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-slate-600">{item.label}</span>
                    <span className={`text-sm font-medium text-${item.color}-600`}>{item.status}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden bg-slate-200">
                    <div className={`h-full bg-${item.color}-500 ${item.value === 100 ? 'animate-pulse' : ''}`} style={{ width: `${item.value}%` }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-xl p-5 bg-gradient-to-br from-indigo-500 to-violet-600">
              <h4 className="font-bold mb-2 flex items-center gap-2 text-white">
                 智能洞察
              </h4>
              <p className="text-sm mb-4 text-indigo-100 leading-relaxed">
                检测到"夜间模式"话题热度持续上升，建议优先级提升至最高。预计可提升用户满意度25%。
              </p>
              <button className="w-full px-4 py-2.5 bg-white text-indigo-600 rounded-lg text-sm font-medium hover:bg-indigo-50 transition-colors">
                查看详细报告
              </button>
            </div>
          </div>
        </div>

        {/* 新增第四行 - 更多图表 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 用户活跃度时段分析 - Bar Chart */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-3">
              <div className="p-2 bg-amber-50 rounded-xl">
                <Zap className="w-5 h-5 text-amber-600" />
              </div>
              24小时活跃度
            </h3>
            
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={hourlyActivity}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="hour" stroke="#94a3b8" style={{ fontSize: '11px' }} axisLine={false} tickLine={false} />
                <YAxis stroke="#94a3b8" style={{ fontSize: '11px' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="users" fill={CHART_COLORS.warning} name="活跃用户" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* 用户能力雷达图 - Radar Chart */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-3">
              <div className="p-2 bg-pink-50 rounded-xl">
                <Target className="w-5 h-5 text-pink-600" />
              </div>
              用户能力画像
            </h3>
            
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart data={userCapabilityData}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="subject" stroke="#64748b" style={{ fontSize: '12px' }} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} stroke="#94a3b8" style={{ fontSize: '11px' }} />
                <Radar name="平均能力" dataKey="A" stroke={CHART_COLORS.pink} fill={CHART_COLORS.pink} fillOpacity={0.4} strokeWidth={2} />
                <Tooltip contentStyle={tooltipStyle} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* 情感趋势堆叠面积图 - Stacked Area Chart */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-3">
              <div className="p-2 bg-emerald-50 rounded-xl">
                <Activity className="w-5 h-5 text-emerald-600" />
              </div>
              情感变化趋势
            </h3>
            
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={sentimentTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" style={{ fontSize: '12px' }} axisLine={false} tickLine={false} />
                <YAxis stroke="#94a3b8" style={{ fontSize: '11px' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                <Area type="monotone" dataKey="positive" stackId="1" stroke={CHART_COLORS.success} fill={CHART_COLORS.success} fillOpacity={0.8} name="正面" />
                <Area type="monotone" dataKey="neutral" stackId="1" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.6} name="中立" />
                <Area type="monotone" dataKey="negative" stackId="1" stroke={CHART_COLORS.danger} fill={CHART_COLORS.danger} fillOpacity={0.8} name="负面" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
