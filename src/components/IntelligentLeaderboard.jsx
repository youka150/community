'use client';

import { useState, useEffect } from 'react';
import { Award, TrendingUp, Users, Target, Lightbulb, ArrowLeft, Download, Share2, BarChart3, Activity, Brain, Flame, MessageCircle, ThumbsUp, ThumbsDown, RotateCw, Calendar, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import ReactMarkdown from 'react-markdown';
import EnhancedMarkdown from './EnhancedMarkdown';

// 统一图表颜色
const CHART_COLORS = {
  primary: '#6366f1',
  secondary: '#8b5cf6',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#06b6d4',
  pink: '#ec4899',
  orange: '#f97316',
  muted: '#94a3b8',
};

const tooltipStyle = {
  backgroundColor: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
  boxShadow: '0 10px 40px -10px rgba(0,0,0,0.1)',
  padding: '12px 16px',
};

export default function IntelligentLeaderboardPage() {
  const [activeTab, setActiveTab] = useState('ideas');
  const [trendData, setTrendData] = useState(null);
  const [loadingTrend, setLoadingTrend] = useState(false);
  const [trendReportsList, setTrendReportsList] = useState([]);
  const [loadingReportsList, setLoadingReportsList] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState(null);

  // 获取趋势报告列表
  const fetchTrendReportsList = async () => {
    setLoadingReportsList(true);
    try {
      const res = await fetch(`/api/trends/list?limit=20&t=${new Date().getTime()}`);
      const json = await res.json();
      if (json.success && json.data.reports.length > 0) {
        setTrendReportsList(json.data.reports);
        // 默认选中最新的报告
        if (!selectedReportId) {
          setSelectedReportId(json.data.reports[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to fetch trend reports list:', error);
    } finally {
      setLoadingReportsList(false);
    }
  };

  // 获取单个报告详情
  const fetchTrendData = async (reportId) => {
    setLoadingTrend(true);
    try {
      const actualId = reportId || selectedReportId;
      if (!actualId) {
        // 如果没有指定ID，获取最新的
        const res = await fetch(`/api/trends/latest?t=${new Date().getTime()}`);
        const json = await res.json();
        if (json.success) {
          setTrendData(json.data);
        }
      } else {
        const res = await fetch(`/api/trends/${actualId}?t=${new Date().getTime()}`);
        const json = await res.json();
        if (json.success) {
          setTrendData(json.data);
        }
      }
    } catch (error) {
      console.error('Failed to fetch trend data:', error);
    } finally {
      setLoadingTrend(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'trends') {
      fetchTrendReportsList();
    }
  }, [activeTab]);

  // 当选中的报告ID变化时，获取其详情
  useEffect(() => {
    if (activeTab === 'trends' && selectedReportId) {
      fetchTrendData(selectedReportId);
    }
  }, [selectedReportId, activeTab]);

  // 产品创意榜单数据
  const productIdeas = [
    { id: 1, title: '智能夜间模式自动切换', description: '根据时间和环境光线自动调整界面主题，保护用户视力', novelty: 92, engagement: 1248, sentiment: 0.89, influence: 95, proposedBy: 'TechExplorer', category: 'UI/UX', priority: '高', votes: 856, comments: 234 },
    { id: 2, title: '跨设备数据实时同步优化', description: '采用增量同步技术，大幅提升多设备间数据同步速度', novelty: 85, engagement: 982, sentiment: 0.78, influence: 88, proposedBy: 'InnovatorPro', category: '性能', priority: '高', votes: 743, comments: 189 },
    { id: 3, title: 'AI智能推荐内容过滤', description: '基于用户兴趣和行为的个性化内容推荐系统', novelty: 88, engagement: 856, sentiment: 0.82, influence: 82, proposedBy: 'CreativeMinds', category: 'AI功能', priority: '中', votes: 621, comments: 156 },
    { id: 4, title: '隐私保护增强模式', description: '端到端加密通信，本地数据存储，无服务器追踪', novelty: 94, engagement: 743, sentiment: 0.95, influence: 92, proposedBy: 'DataNinja', category: '安全', priority: '高', votes: 892, comments: 267 },
    { id: 5, title: '协作工作空间', description: '支持多人实时协作，共享编辑，版本控制', novelty: 79, engagement: 654, sentiment: 0.76, influence: 75, proposedBy: 'UXChampion', category: '协作', priority: '中', votes: 543, comments: 142 }
  ];

  // 创意用户榜单数据
  const creativeUsers = [
    { id: 1, name: 'TechExplorer', avatar: '', score: 95, ideas: 15, quality: 92, impact: 1248, type: '意见领袖', achievements: ['金点子奖', '最佳贡献者', '社区之星'] },
    { id: 2, name: 'InnovatorPro', avatar: '', score: 91, ideas: 12, quality: 96, impact: 982, type: '产品专家', achievements: ['技术专家', '创新先锋'] },
    { id: 3, name: 'CreativeMinds', avatar: '', score: 88, ideas: 18, quality: 85, impact: 856, type: '潜力用户', achievements: ['创意之星', '新秀奖'] },
    { id: 4, name: 'DataNinja', avatar: '', score: 87, ideas: 10, quality: 94, impact: 743, type: '数据分析师', achievements: ['数据洞察奖'] },
    { id: 5, name: 'UXChampion', avatar: '', score: 85, ideas: 13, quality: 88, impact: 654, type: '品牌倡导者', achievements: ['用户体验奖', '社区贡献奖'] }
  ];

  // 竞品分析数据
  const competitors = [
    { name: '产品A', strengths: ['界面简洁', '性能优秀', '用户基数大'], weaknesses: ['功能单一', '缺乏创新', '客服响应慢'], userSentiment: 0.72, mentions: 2341, marketShare: 35 },
    { name: '产品B', strengths: ['功能丰富', '社区活跃', '更新频繁'], weaknesses: ['界面复杂', '学习成本高', '价格昂贵'], userSentiment: 0.68, mentions: 1876, marketShare: 28 },
    { name: '我们的产品', strengths: ['创新能力强', '用户体验好', '性价比高'], weaknesses: ['知名度低', '功能待完善', '市场份额小'], userSentiment: 0.85, mentions: 1234, marketShare: 15 }
  ];

  const competitorRadarData = [
    { subject: '功能丰富度', 产品A: 65, 产品B: 90, 我们的产品: 75, fullMark: 100 },
    { subject: '用户体验', 产品A: 85, 产品B: 60, 我们的产品: 92, fullMark: 100 },
    { subject: '性能表现', 产品A: 90, 产品B: 75, 我们的产品: 88, fullMark: 100 },
    { subject: '创新能力', 产品A: 50, 产品B: 70, 我们的产品: 95, fullMark: 100 },
    { subject: '市场份额', 产品A: 85, 产品B: 70, 我们的产品: 45, fullMark: 100 },
    { subject: '用户满意度', 产品A: 72, 产品B: 68, 我们的产品: 85, fullMark: 100 }
  ];

  const valueMatrixData = productIdeas.map(idea => ({ name: idea.title.substring(0, 10) + '...', impact: idea.engagement / 15, effort: 100 - idea.novelty, value: idea.influence }));
  const userContributionData = creativeUsers.map(user => ({ name: user.name, 创意数: user.ideas, 质量分: user.quality, 影响力: user.score }));

  const getPriorityStyle = (priority) => {
    const styles = {
      '高': 'bg-rose-50 text-rose-600 border-rose-200',
      '中': 'bg-amber-50 text-amber-600 border-amber-200',
      '低': 'bg-emerald-50 text-emerald-600 border-emerald-200'
    };
    return styles[priority] || 'bg-slate-50 text-slate-600 border-slate-200';
  };

  const tabs = [
    { id: 'ideas', label: '产品创意榜单', icon: Lightbulb, gradient: 'from-amber-500 to-orange-500' },
    { id: 'users', label: '创意用户榜单', icon: Users, gradient: 'from-violet-500 to-purple-500' },
    { id: 'competitors', label: '竞品分析', icon: Target, gradient: 'from-indigo-500 to-blue-500' },
    { id: 'trends', label: '趋势热点', icon: Flame, gradient: 'from-rose-500 to-red-500' }
  ];

  const getTrendIcon = (trend) => {
    if (trend === 'up') return '↗';
    if (trend === 'down') return '↘';
    return '→';
  };

  const getSentimentColor = (score) => {
    // score 是 0-100 的整数
    if (score >= 80) return 'text-emerald-600';
    if (score >= 60) return 'text-indigo-600';
    if (score >= 40) return 'text-amber-600';
    return 'text-rose-600';
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f7f9ff] via-[#fdfdff] to-[#f7fbff]">
      {/* 顶部导航栏 */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 border-b border-slate-200/80">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl">
                <Award className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-800">智能榜单生成</h1>
                <p className="text-sm text-slate-500">商业洞察与分析</p>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button className="px-4 py-2 rounded-lg bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 transition-all flex items-center gap-2 shadow-sm">
              <Download className="w-4 h-4" />
              导出
            </button>
            <button className="px-4 py-2 rounded-lg bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 transition-all flex items-center gap-2 shadow-sm">
              <Share2 className="w-4 h-4" />
              分享
            </button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-6 py-8">
        {/* Tab切换 */}
        <div className="flex gap-2 mb-8 bg-slate-100 rounded-xl p-1.5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-6 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${activeTab === tab.id
                  ? `bg-gradient-to-r ${tab.gradient} text-white shadow-lg`
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                }`}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* 产品创意榜单 */}
        {activeTab === 'ideas' && (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-3">
                  <div className="p-2 bg-amber-50 rounded-xl"><Award className="w-5 h-5 text-amber-600" /></div>
                  产品创意综合排行
                </h2>

                <div className="space-y-4">
                  {productIdeas.map((idea, index) => (
                    <div key={idea.id} className="group rounded-xl p-5 bg-slate-50 border border-slate-100 hover:bg-white hover:border-amber-200 hover:shadow-lg transition-all">
                      <div className="flex items-start gap-4">
                        <div className="flex flex-col items-center">
                          <div className={`text-2xl font-bold ${index < 3 ? 'text-amber-500' : 'text-slate-400'}`}>#{index + 1}</div>
                          {index < 3 && <div className="text-xl mt-1">{['', '', ''][index]}</div>}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-bold text-slate-800">{idea.title}</h3>
                            <span className={`px-2 py-1 rounded-full text-xs border ${getPriorityStyle(idea.priority)}`}>{idea.priority}优先级</span>
                          </div>
                          <p className="text-sm text-slate-500 mb-3">{idea.description}</p>
                          <div className="flex items-center gap-3 mb-3">
                            <span className="px-2 py-1 text-xs rounded-lg bg-amber-50 text-amber-700">{idea.category}</span>
                            <span className="text-xs text-slate-500">by {idea.proposedBy}</span>
                          </div>
                          <div className="grid grid-cols-4 gap-4 mb-3">
                            {[
                              { label: '新颖性', value: idea.novelty, color: 'text-violet-600' },
                              { label: '参与度', value: idea.engagement, color: 'text-indigo-600' },
                              { label: '情感倾向', value: `${(idea.sentiment * 100).toFixed(0)}%`, color: 'text-emerald-600' },
                              { label: '影响力', value: idea.influence, color: 'text-amber-600' }
                            ].map((metric, idx) => (
                              <div key={idx}>
                                <div className="text-xs text-slate-500 mb-1">{metric.label}</div>
                                <div className={`text-lg font-bold ${metric.color}`}>{metric.value}</div>
                              </div>
                            ))}
                          </div>
                          <div className="flex gap-6 text-sm text-slate-500">
                            <span> {idea.votes} 投票</span>
                            <span> {idea.comments} 评论</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 mb-4">评分维度说明</h3>
                <div className="space-y-3 text-sm">
                  {[
                    { color: 'bg-violet-500', title: '新颖性', desc: '创意的独特性和创新程度', textColor: 'text-violet-600' },
                    { color: 'bg-indigo-500', title: '参与度', desc: '讨论量、点赞数和回复数', textColor: 'text-indigo-600' },
                    { color: 'bg-emerald-500', title: '情感倾向', desc: '用户对创意的支持程度', textColor: 'text-emerald-600' },
                    { color: 'bg-amber-500', title: '影响力', desc: '提出者的社区影响力', textColor: 'text-amber-600' }
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <div className={`w-2 h-2 ${item.color} rounded-full mt-1.5`}></div>
                      <div>
                        <div className={`font-medium ${item.textColor}`}>{item.title}</div>
                        <div className="text-slate-500">{item.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-3">
                  <div className="p-2 bg-cyan-50 rounded-xl"><BarChart3 className="w-5 h-5 text-cyan-600" /></div>
                  价值-成本矩阵
                </h3>
                <ResponsiveContainer width="100%" height={280}>
                  <ScatterChart>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" dataKey="impact" name="影响力" stroke="#94a3b8" style={{ fontSize: '11px' }} label={{ value: '影响力', position: 'insideBottom', offset: -5, fill: '#64748b' }} />
                    <YAxis type="number" dataKey="effort" name="实现难度" stroke="#94a3b8" style={{ fontSize: '11px' }} label={{ value: '实现难度', angle: -90, position: 'insideLeft', fill: '#64748b' }} />
                    <ZAxis type="number" dataKey="value" range={[100, 500]} name="综合价值" />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={tooltipStyle} />
                    <Scatter name="创意" data={valueMatrixData} fill={CHART_COLORS.warning}>
                      {valueMatrixData.map((entry, index) => (<Cell key={`cell-${index}`} fill={index < 3 ? CHART_COLORS.warning : '#94a3b8'} />))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
                <div className="mt-3 text-xs text-center text-slate-500"> 右上角:高价值低难度(优先) | 左下角:低价值高难度(推迟)</div>
              </div>

              <div className="rounded-2xl p-6 bg-gradient-to-br from-amber-500 to-orange-600">
                <h3 className="text-lg font-bold mb-3 text-white"> 商业建议</h3>
                <ul className="text-sm space-y-2 text-amber-50">
                  <li> 优先开发Top3高优先级功能</li>
                  <li> "夜间模式"和"隐私保护"呼声最高</li>
                  <li> 建议Q2季度启动相关项目</li>
                  <li> 预计可提升用户满意度25%</li>
                </ul>
                <button className="w-full mt-4 px-4 py-2.5 bg-white text-amber-600 rounded-lg font-medium hover:bg-amber-50 transition-colors">生成完整报告</button>
              </div>
            </div>
          </div>
        )}

        {/* 创意用户榜单 */}
        {activeTab === 'users' && (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-3">
                  <div className="p-2 bg-violet-50 rounded-xl"><Award className="w-5 h-5 text-violet-600" /></div>
                  创意用户综合排行
                </h2>
                <div className="space-y-4">
                  {creativeUsers.map((user, index) => (
                    <div key={user.id} className="group rounded-xl p-5 bg-slate-50 border border-slate-100 hover:bg-white hover:border-violet-200 hover:shadow-lg transition-all">
                      <div className="flex items-start gap-4">
                        <div className="flex flex-col items-center">
                          <div className={`text-2xl font-bold ${index < 3 ? 'text-violet-500' : 'text-slate-400'}`}>#{index + 1}</div>
                          {index < 3 && <div className="text-xl mt-1">{['', '', ''][index]}</div>}
                        </div>
                        <div className="text-4xl">{user.avatar}</div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <h3 className="text-xl font-bold text-slate-800">{user.name}</h3>
                            <span className="px-2 py-1 text-xs rounded-lg border bg-violet-50 text-violet-600 border-violet-200">{user.type}</span>
                          </div>
                          <div className="mb-4">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-sm text-slate-500">综合评分</span>
                              <span className="text-2xl font-bold text-violet-600">{user.score}</span>
                            </div>
                            <div className="h-2 rounded-full overflow-hidden bg-slate-200">
                              <div className="h-full bg-gradient-to-r from-violet-500 to-purple-500" style={{ width: `${user.score}%` }} />
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-4 mb-3">
                            {[
                              { label: '创意数量', value: user.ideas, color: 'text-indigo-600' },
                              { label: '质量评分', value: user.quality, color: 'text-emerald-600' },
                              { label: '影响力', value: user.impact, color: 'text-amber-600' }
                            ].map((metric, idx) => (
                              <div key={idx} className="rounded-lg p-3 bg-white border border-slate-100">
                                <div className="text-xs text-slate-500 mb-1">{metric.label}</div>
                                <div className={`text-lg font-bold ${metric.color}`}>{metric.value}</div>
                              </div>
                            ))}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {user.achievements.map((achievement, idx) => (
                              <span key={idx} className="px-2 py-1 text-xs rounded-lg border bg-amber-50 text-amber-600 border-amber-200"> {achievement}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-3">
                  <div className="p-2 bg-violet-50 rounded-xl"><Activity className="w-5 h-5 text-violet-600" /></div>
                  用户贡献度对比
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={userContributionData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="name" stroke="#94a3b8" style={{ fontSize: '11px' }} angle={-15} textAnchor="end" height={60} />
                    <YAxis stroke="#94a3b8" style={{ fontSize: '11px' }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend />
                    <Bar dataKey="创意数" fill={CHART_COLORS.primary} radius={[6, 6, 0, 0]} />
                    <Bar dataKey="质量分" fill={CHART_COLORS.success} radius={[6, 6, 0, 0]} />
                    <Bar dataKey="影响力" fill={CHART_COLORS.warning} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 mb-4">榜单统计</h3>
                <div className="space-y-4">
                  {[
                    { label: '上榜用户', value: '156', color: 'text-violet-600' },
                    { label: '总创意数', value: '892', color: 'text-indigo-600' },
                    { label: '平均质量分', value: '87.5', color: 'text-emerald-600' }
                  ].map((stat, idx) => (
                    <div key={idx} className="rounded-xl p-4 bg-slate-50">
                      <div className="text-sm text-slate-500 mb-1">{stat.label}</div>
                      <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl p-6 bg-gradient-to-br from-violet-500 to-purple-600">
                <h3 className="text-lg font-bold mb-3 text-white"> 运营策略</h3>
                <ul className="text-sm space-y-2 text-violet-50">
                  <li> 邀请Top5用户参与产品共创会</li>
                  <li> 为金牌贡献者提供专属权益</li>
                  <li> 建立创意激励机制</li>
                  <li> 定期举办创意大赛活动</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* 竞品分析 */}
        {activeTab === 'competitors' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
              <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-3">
                <div className="p-2 bg-indigo-50 rounded-xl"><Target className="w-5 h-5 text-indigo-600" /></div>
                竞品综合能力对比
              </h2>
              <ResponsiveContainer width="100%" height={400}>
                <RadarChart data={competitorRadarData}>
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis dataKey="subject" stroke="#64748b" style={{ fontSize: '12px' }} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} stroke="#94a3b8" style={{ fontSize: '11px' }} />
                  <Radar name="产品A" dataKey="产品A" stroke={CHART_COLORS.danger} fill={CHART_COLORS.danger} fillOpacity={0.3} />
                  <Radar name="产品B" dataKey="产品B" stroke={CHART_COLORS.warning} fill={CHART_COLORS.warning} fillOpacity={0.3} />
                  <Radar name="我们的产品" dataKey="我们的产品" stroke={CHART_COLORS.primary} fill={CHART_COLORS.primary} fillOpacity={0.5} />
                  <Legend />
                  <Tooltip contentStyle={tooltipStyle} />
                </RadarChart>
              </ResponsiveContainer>
              <div className="mt-6 p-4 rounded-xl bg-indigo-50 border border-indigo-100">
                <h4 className="font-bold mb-2 text-indigo-700"> 对比分析结论</h4>
                <ul className="text-sm space-y-1 text-indigo-600">
                  <li> 我们的产品在"创新能力"和"用户满意度"方面领先</li>
                  <li> "市场份额"是当前最大短板，需要加强市场推广</li>
                  <li> 产品A的"性能表现"值得学习借鉴</li>
                  <li> 建议保持创新优势,同时提升功能丰富度</li>
                </ul>
              </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
              {competitors.map((competitor, index) => (
                <div key={index} className={`bg-white rounded-2xl p-6 border shadow-sm ${competitor.name === '我们的产品' ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-slate-100'}`}>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-slate-800">{competitor.name}</h3>
                    {competitor.name === '我们的产品' && <span className="px-2 py-1 text-xs rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200">当前产品</span>}
                  </div>
                  <div className="mb-6">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-slate-500">市场份额</span>
                      <span className="text-2xl font-bold text-indigo-600">{competitor.marketShare}%</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden bg-slate-200">
                      <div className="h-full bg-gradient-to-r from-indigo-500 to-blue-500" style={{ width: `${competitor.marketShare}%` }} />
                    </div>
                  </div>
                  <div className="mb-6">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-slate-500">用户情感</span>
                      <span className="text-2xl font-bold text-emerald-600">{(competitor.userSentiment * 100).toFixed(0)}%</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden bg-slate-200">
                      <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500" style={{ width: `${competitor.userSentiment * 100}%` }} />
                    </div>
                  </div>
                  <div className="mb-6 rounded-xl p-4 bg-slate-50">
                    <div className="text-sm text-slate-500 mb-1">社区提及次数</div>
                    <div className="text-2xl font-bold text-violet-600">{competitor.mentions}</div>
                  </div>
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-emerald-600 mb-2 flex items-center gap-2"><span></span> 优势</h4>
                    <ul className="space-y-1 text-sm text-slate-600">
                      {competitor.strengths.map((strength, idx) => (<li key={idx} className="flex items-start gap-2"><span className="text-emerald-500"></span>{strength}</li>))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-rose-600 mb-2 flex items-center gap-2"><span></span> 劣势</h4>
                    <ul className="space-y-1 text-sm text-slate-600">
                      {competitor.weaknesses.map((weakness, idx) => (<li key={idx} className="flex items-start gap-2"><span className="text-rose-500"></span>{weakness}</li>))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl p-8 bg-gradient-to-br from-indigo-500 to-blue-600">
              <h3 className="text-2xl font-bold mb-4 text-white"> 竞品分析总结</h3>
              <div className="grid md:grid-cols-3 gap-6">
                {[
                  { title: '市场机会', desc: '竞品A和B在创新功能上存在明显短板，我们可以通过快速迭代和用户共创建立差异化优势。' },
                  { title: '威胁分析', desc: '主要竞品拥有较大的用户基数和市场份额，需要重点提升品牌知名度和市场推广力度。' },
                  { title: '行动建议', desc: '聚焦用户体验和创新功能，加强社区运营，建立忠实用户群体，逐步扩大市场份额。' }
                ].map((item, idx) => (
                  <div key={idx}>
                    <h4 className="font-semibold mb-2 text-white">{item.title}</h4>
                    <p className="text-sm text-indigo-100">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 趋势热点 */}
        {activeTab === 'trends' && (
          <div className="space-y-6">
            {/* 历史报告选择器 */}
            {loadingReportsList ? (
              <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm text-center text-slate-400">
                加载报告列表中...
              </div>
            ) : trendReportsList.length > 0 ? (
              <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <Calendar className="w-5 h-5 text-violet-600" />
                  <h3 className="text-lg font-bold text-slate-800">历史分析报告</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {trendReportsList.map((report) => (
                    <button
                      key={report.id}
                      onClick={() => setSelectedReportId(report.id)}
                      className={`text-left p-4 rounded-xl border-2 transition-all ${selectedReportId === report.id
                          ? 'border-violet-500 bg-violet-50 shadow-md'
                          : 'border-slate-200 bg-slate-50 hover:border-violet-300 hover:bg-white'
                        }`}
                    >
                      <div className="font-semibold text-slate-800 truncate text-sm">{report.query}</div>
                      <div className="text-xs text-slate-500 mt-1">
                        {new Date(report.generatedAt).toLocaleDateString('zh-CN', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`inline-block w-2 h-2 rounded-full ${report.overallSentiment === 'positive' ? 'bg-emerald-500' :
                            report.overallSentiment === 'negative' ? 'bg-rose-500' :
                              'bg-slate-400'
                          }`} />
                        <span className="text-xs font-medium text-slate-600">得分: {report.sentimentScore}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm text-center text-slate-400">
                暂无趋势分析报告，请先在"趋势分析"页面生成报告
              </div>
            )}

            {trendData && (
              <div className="space-y-6">
                <div className="grid lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 space-y-6">
                    {/* 顶部摘要卡片 */}
                    {trendData?.report && (
                      <div className="bg-gradient-to-br from-rose-500 to-red-600 rounded-2xl p-6 shadow-lg text-white">
                        <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
                          <Activity className="w-6 h-6" />
                          趋势洞察摘要
                        </h2>
                        <p className="text-rose-100 mb-4 text-sm opacity-90">
                          主题：<span className="font-semibold">{trendData.report.query}</span> | 时间：{new Date(trendData.report.generatedAt).toLocaleString('zh-CN')}
                        </p>
                        <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
                          <p className="text-sm leading-relaxed">
                            {trendData.report.summary}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* 热点话题列表 */}
                    <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                      <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                          <div className="p-2 bg-rose-50 rounded-xl"><Flame className="w-5 h-5 text-rose-600" /></div>
                          热点话题排行
                        </h2>
                        <button
                          onClick={() => fetchTrendData(selectedReportId)}
                          disabled={loadingTrend}
                          className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
                          title="刷新数据"
                        >
                          <RotateCw className={`w-5 h-5 ${loadingTrend ? 'animate-spin' : ''}`} />
                        </button>
                      </div>

                      {loadingTrend && !trendData ? (
                        <div className="py-12 text-center text-slate-400">加载中...</div>
                      ) : !trendData?.hotTopics?.length ? (
                        <div className="py-12 text-center text-slate-400">暂无热点话题数据</div>
                      ) : (
                        <div className="space-y-4">
                          {trendData.hotTopics.map((topic, index) => (
                            <div key={index} className="group rounded-xl p-5 bg-slate-50 border border-slate-100 hover:bg-white hover:border-rose-200 hover:shadow-lg transition-all">
                              <div className="flex items-start gap-4">
                                <div className="flex flex-col items-center">
                                  <div className={`text-2xl font-bold ${index < 3 ? 'text-rose-500' : 'text-slate-400'}`}>#{index + 1}</div>
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-3 mb-2">
                                    <h3 className="text-lg font-bold text-slate-800">{topic.topic}</h3>
                                    <span className="px-2 py-1 rounded-full text-xs border bg-slate-100 text-slate-600">{topic.category}</span>
                                    <span className="text-lg font-bold text-slate-400">{getTrendIcon(topic.trend)}</span>
                                  </div>
                                  <p className="text-sm text-slate-500 mb-3">{topic.description}</p>

                                  <div className="flex items-center gap-6 text-sm">
                                    <div className="flex items-center gap-2 text-slate-600">
                                      <MessageCircle className="w-4 h-4" />
                                      <span>热度: {topic.mentions}</span>
                                    </div>
                                    <div className={`flex items-center gap-2 font-medium ${getSentimentColor(topic.sentiment)}`}>
                                      {topic.sentiment >= 60 ? <ThumbsUp className="w-4 h-4" /> : <ThumbsDown className="w-4 h-4" />}
                                      <span>情感: {topic.sentiment}%</span>
                                    </div>
                                  </div>

                                  {/* 情感条 */}
                                  <div className="mt-3 h-1.5 rounded-full overflow-hidden bg-slate-200">
                                    <div
                                      className={`h-full rounded-full transition-all ${topic.sentiment >= 80 ? 'bg-emerald-500' : topic.sentiment >= 60 ? 'bg-indigo-500' : topic.sentiment >= 40 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                      style={{ width: `${topic.sentiment}%` }}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 右侧边栏 */}
                  <div className="space-y-6">
                    {/* 情感概览 */}
                    {trendData?.report?.sentimentDistribution && (
                      <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                        <h3 className="text-lg font-bold text-slate-800 mb-4">情感分布概览</h3>
                        <div className="h-[250px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={[
                              { name: '正面', value: trendData.report.sentimentDistribution.positive || 0, fill: CHART_COLORS.success },
                              { name: '中立', value: trendData.report.sentimentDistribution.neutral || 0, fill: CHART_COLORS.muted },
                              { name: '负面', value: trendData.report.sentimentDistribution.negative || 0, fill: CHART_COLORS.danger }
                            ]}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                              <XAxis dataKey="name" axisLine={false} tickLine={false} />
                              <YAxis axisLine={false} tickLine={false} />
                              <Tooltip cursor={{ fill: 'transparent' }} contentStyle={tooltipStyle} />
                              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                                {
                                  [CHART_COLORS.success, CHART_COLORS.muted, CHART_COLORS.danger].map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry} />
                                  ))
                                }
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="mt-4 flex justify-between items-center p-4 bg-slate-50 rounded-xl">
                          <span className="text-sm text-slate-500">总体情感得分</span>
                          <span className={`text-2xl font-bold ${getSentimentColor(trendData.report.sentimentScore)}`}>
                            {trendData.report.sentimentScore}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* 关键维度 */}
                    <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                      <h3 className="text-lg font-bold text-slate-800 mb-4">分析维度拆解</h3>
                      <div className="space-y-4">
                        {trendData?.dimensions?.map((dim, idx) => (
                          <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                            <h4 className="font-bold text-slate-700 mb-2">{dim.dimension}</h4>
                            <div className="space-y-1">
                              {dim.keyPoints && dim.keyPoints.slice(0, 2).map((point, pIdx) => (
                                <div key={pIdx} className="flex items-start gap-2 text-sm text-slate-500">
                                  <span className="text-rose-400 mt-1">•</span>
                                  <span>{point}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                        {!trendData?.dimensions?.length && <div className="text-slate-400 text-sm text-center">暂无维度数据</div>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* AI 生成的完整分析报告 - 移动到下方并撑满 */}
                {trendData?.report?.content && (
                  <div className="bg-white rounded-2xl p-8 border border-slate-100 shadow-sm">
                    <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-3">
                      <Brain className="w-6 h-6 text-indigo-600" />
                      完整分析报告
                    </h2>
                    <div className="prose-invert max-w-none">
                      <EnhancedMarkdown
                        markdown={trendData.report.content}
                        analysisData={{
                          sentiment_distribution: trendData.report.sentimentDistribution,
                          topics: trendData.hotTopics
                        }}
                        className="text-slate-700"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
