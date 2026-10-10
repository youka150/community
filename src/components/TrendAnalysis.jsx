'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { TrendingUp, ThumbsUp, ThumbsDown, MessageSquare, Clock, ArrowLeft, Filter, Calendar, BarChart3, PieChart as PieChartIcon, Loader2, Search, AlertCircle, Download, FileText, Sparkles, Zap, Activity, Target, Eye, Layers, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { marked } from 'marked';
import EnhancedMarkdown from './EnhancedMarkdown';
import AnalysisTOC from './AnalysisTOC';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, ComposedChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Select } from 'antd';
import { useAnalysisContext } from '@/context/AnalysisContext';

// 图表通用样式 - 升级版
const chartTooltipStyle = {
  backgroundColor: 'rgba(255, 255, 255, 0.95)',
  border: 'none',
  borderRadius: '16px',
  boxShadow: '0 20px 40px -10px rgba(0,0,0,0.15), 0 0 0 1px rgba(99, 102, 241, 0.1)',
  padding: '16px 20px',
  backdropFilter: 'blur(10px)'
};

// 动画关键帧
const pulseKeyframes = `
@keyframes pulse-ring {
  0% { transform: scale(0.8); opacity: 0.5; }
  50% { transform: scale(1.2); opacity: 0; }
  100% { transform: scale(0.8); opacity: 0.5; }
}
@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
}
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
@keyframes gradient-shift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
`;

export default function TrendAnalysisPage() {
  const handleDownloadReport = () => {
    if (!reportContent) return;

    const htmlContent = marked(reportContent);
    const fullHtml = `
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>趋势分析报告</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; line-height: 1.7; color: #1e293b; max-width: 800px; margin: 40px auto; padding: 20px; background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); }
          h1, h2, h3 { color: #4338ca; border-bottom: 2px solid rgba(67, 56, 202, 0.2); padding-bottom: .5em; }
          h1 { font-size: 2em; }
          h2 { font-size: 1.5em; }
          h3 { font-size: 1.2em; }
          strong { color: #4338ca; }
          code { background-color: #f1f5f9; padding: .2em .4em; margin: 0; font-size: 85%; border-radius: 6px; }
          pre { background-color: #1e293b; color: #e2e8f0; padding: 20px; overflow: auto; border-radius: 12px; }
          table { border-collapse: collapse; width: 100%; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
          th, td { border: 1px solid rgba(67, 56, 202, 0.2); padding: 12px 16px; }
          th { font-weight: 600; background: rgba(67, 56, 202, 0.08); color: #4338ca; }
          blockquote { color: #64748b; margin: 0; padding-left: 1em; border-left: 4px solid #6366f1; background: #f8fafc; padding: 1em; border-radius: 0 8px 8px 0; }
        </style>
      </head>
      <body>
        ${htmlContent}
      </body>
      </html>
    `;

    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `趋势分析报告-${new Date().toISOString().slice(0, 10)}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 使用全局 Context 存储分析数据，确保页面切换时数据不丢失
  const {
    trendAnalysisData,
    setTrendAnalysisData,
    trendReportContent,
    setTrendReportContent,
    trendSearchQuery,
    setTrendSearchQuery,
    trendLogs,
    setTrendLogs,
  } = useAnalysisContext();

  const [timeRange, setTimeRange] = useState('week');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const logContainerRef = useRef(null);

  // 使用 Context 中的数据
  const searchQuery = trendSearchQuery;
  const setSearchQuery = setTrendSearchQuery;
  const analysisData = trendAnalysisData;
  const setAnalysisData = setTrendAnalysisData;
  const reportContent = trendReportContent;
  const setReportContent = setTrendReportContent;
  const logs = trendLogs;
  const setLogs = setTrendLogs;
  const [isStreamingReport, setIsStreamingReport] = useState(false);
  const [tocVisible, setTocVisible] = useState(true);
  const reportScrollRef = useRef(null);

  // 自动从 markdown 标题解析 TOC 条目
  const reportTocSections = useMemo(() => {
    if (!reportContent) return [];
    const lines = reportContent.split('\n');
    const sections = [];
    let h2Count = 0;
    lines.forEach((line) => {
      const h2Match = line.match(/^##\s+(.+)/);
      const h3Match = line.match(/^###\s+(.+)/);
      if (h2Match) {
        h2Count++;
        sections.push({ id: `toc-h2-${h2Count}`, label: h2Match[1].trim() });
      } else if (h3Match && sections.length > 0) {
        const parent = sections[sections.length - 1];
        if (!parent.sub) parent.sub = [];
        parent.sub.push({ id: `toc-h3-${sections.length}-${parent.sub.length + 1}`, label: h3Match[1].trim() });
      }
    });
    return sections;
  }, [reportContent]);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const handleAnalyze = async () => {
    if (!searchQuery.trim()) {
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setAnalysisData(null);
    setReportContent('');
    setLogs([]);

    try {
      const response = await fetch('/api/trend-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: searchQuery }),
      });

      if (!response.ok) {
        throw new Error(`请求失败，状态码: ${response.status}`);
      }

      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += value;
        const lines = buffer.split('\n\n');
        buffer = lines.pop(); // 保留最后一部分可能不完整的 SSE 事件

        for (const line of lines) {
          if (!line.trim()) continue;

          let event = 'message';
          let data = '';

          const eventMatch = line.match(/^event: (.*)$/m);
          if (eventMatch) {
            event = eventMatch[1];
          }

          const dataMatch = line.match(/^data: (.*)$/m);
          if (dataMatch) {
            data = dataMatch[1];
          }

          if (event === 'message') {
            const logData = JSON.parse(data);
            setLogs(prev => [...prev, logData]);
          } else if (event === 'report_start') {
            setIsStreamingReport(true);
            setReportContent('');
            setLogs(prev => [...prev, { type: 'info', message: '开始流式生成分析报告...' }]);
          } else if (event === 'report_chunk') {
            const chunk = JSON.parse(data);
            setReportContent(prev => prev + chunk.content);
          } else if (event === 'end') {
            setIsStreamingReport(false);
            const finalResult = JSON.parse(data);
            if (finalResult.success) {
              setAnalysisData(finalResult.data);
              // 报告内容已通过流式设置，只在没有流式内容时回退使用完整报告
              setReportContent(prev => prev || finalResult.data?.report?.content || '');
            } else {
              throw new Error(finalResult.error || '分析最终步骤失败');
            }
          } else if (event === 'error') {
            setIsStreamingReport(false);
            const errorResult = JSON.parse(data);
            throw new Error(errorResult.error || '分析过程中发生错误');
          }
        }
      }
    } catch (err) {
      console.error('分析错误:', err);
      setError(err.message || '分析过程中出现错误，请稍后重试');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const hotTopics = analysisData?.hotTopics || [];
  const sentimentInfo = analysisData?.sentiment || {};
  const dimensions = analysisData?.dimensions || [];

  const sentimentData = sentimentInfo.sentiment_distribution ? [
    {
      time: '当前分析',
      positive: sentimentInfo.sentiment_distribution.positive || 0,
      negative: sentimentInfo.sentiment_distribution.negative || 0,
      neutral: sentimentInfo.sentiment_distribution.neutral || 0
    }
  ] : [];

  const stats = {
    totalDiscussions: hotTopics.reduce((sum, topic) => sum + (topic.mentions || 0), 0),
    positiveSentiment: sentimentInfo.sentiment_score ? Math.round(sentimentInfo.sentiment_score * 100) : 0,
    hotTopicsCount: hotTopics.length,
    dimensionsCount: dimensions.length
  };

  const getSentimentColor = (score) => {
    if (score >= 0.8) return 'text-emerald-500';
    if (score >= 0.6) return 'text-indigo-500';
    if (score >= 0.4) return 'text-amber-500';
    return 'text-rose-500';
  };

  const getTrendIcon = (trend) => {
    if (trend === 'up') return <TrendingUp className="w-4 h-4 ml-1 inline" />;
    if (trend === 'down') return <TrendingUp className="w-4 h-4 ml-1 inline transform rotate-180" />;
    return null;
  };

  // 统计卡片配置
  const statCards = [
    {
      icon: MessageSquare,
      value: stats.totalDiscussions.toLocaleString(),
      label: '总讨论数',
      gradient: 'from-indigo-500 to-violet-500',
      bgGradient: 'from-indigo-50 to-violet-50',
      iconBg: 'bg-indigo-100',
      iconColor: 'text-indigo-600'
    },
    {
      icon: ThumbsUp,
      value: `${stats.positiveSentiment}%`,
      label: '情感得分',
      gradient: 'from-emerald-500 to-teal-500',
      bgGradient: 'from-emerald-50 to-teal-50',
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600'
    },
    {
      icon: TrendingUp,
      value: stats.hotTopicsCount,
      label: '热点话题',
      gradient: 'from-violet-500 to-purple-500',
      bgGradient: 'from-violet-50 to-purple-50',
      iconBg: 'bg-violet-100',
      iconColor: 'text-violet-600'
    },
    {
      icon: Layers,
      value: stats.dimensionsCount,
      label: '分析维度',
      gradient: 'from-amber-500 to-orange-500',
      bgGradient: 'from-amber-50 to-orange-50',
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600'
    }
  ];

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* 注入动画样式 */}
      <style dangerouslySetInnerHTML={{ __html: pulseKeyframes }} />

      {/* 背景装饰 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {/* 网格背景 */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.03)_1px,transparent_1px)] bg-[size:60px_60px]" />
      </div>

      {/* 内容区顶部标题栏 */}
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-white/70 border-b border-slate-200/80 shadow-sm">
        <div className="px-6 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 shadow-lg shadow-indigo-500/25">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-lg font-bold bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 bg-clip-text text-transparent">
              创意热点识别与趋势分析
            </h1>
          </div>

          <div className="flex gap-3">
            <button className="px-4 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 transition-all flex items-center gap-2 font-medium border border-slate-200 hover:border-indigo-300 hover:shadow-md hover:shadow-indigo-100/50 group">
              <Filter className="w-4 h-4 group-hover:text-indigo-600 transition-colors" />
              <span className="group-hover:text-indigo-600 transition-colors">筛选</span>
            </button>
            <Select
              value={timeRange}
              onChange={setTimeRange}
              style={{ width: 100 }}
              suffixIcon={<Calendar className="w-4 h-4 text-slate-400" />}
              options={[
                { label: '今日', value: 'day' },
                { label: '本周', value: 'week' },
                { label: '本月', value: 'month' },
              ]}
            />
          </div>
        </div>
      </div>

      <div className="px-6 py-8 relative z-10">
        {/* 搜索区域 - 增强版 */}
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 rounded-3xl blur-xl opacity-20 animate-pulse" />
          <div className="relative bg-white/80 backdrop-blur-xl rounded-3xl p-8 border border-white/50 shadow-xl shadow-indigo-100/50">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 shadow-lg shadow-indigo-500/30">
                <Search className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">
                  输入要分析的主题
                </h2>
                <p className="text-sm text-slate-500 mt-0.5">AI 将深度分析话题热度、情感倾向与用户观点</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-1 relative group">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAnalyze()}
                  placeholder="例如：产品创意社区的用户反馈分析"
                  disabled={isAnalyzing}
                  className="w-full px-6 py-4 rounded-2xl bg-slate-50/80 border-2 border-slate-200/50 text-slate-800 placeholder-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all text-lg disabled:opacity-50"
                />
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 opacity-0 group-focus-within:opacity-10 transition-opacity pointer-events-none" />
              </div>
              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing || !searchQuery.trim()}
                className={`px-8 py-4 rounded-2xl font-semibold flex items-center gap-3 transition-all text-lg ${isAnalyzing || !searchQuery.trim()
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 hover:from-indigo-500 hover:via-violet-500 hover:to-purple-500 text-white shadow-xl shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-[1.02] active:scale-[0.98]'
                  }`}
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    分析中...
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5" />
                    开始分析
                  </>
                )}
              </button>
            </div>

            {error && (
              <div className="mt-6 p-5 rounded-2xl bg-gradient-to-r from-rose-50 to-pink-50 border border-rose-200/50 flex items-start gap-4">
                <div className="p-2 rounded-xl bg-rose-100">
                  <AlertCircle className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <div className="font-semibold mb-1 text-rose-800">分析失败</div>
                  <div className="text-rose-600 text-sm">{error}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 加载状态 - 增强版 */}
        {isAnalyzing && (
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-violet-500 rounded-3xl blur-xl opacity-10 animate-pulse" />
            <div className="relative bg-white/80 backdrop-blur-xl rounded-3xl p-12 text-center border border-white/50 shadow-xl">
              <div className="relative w-24 h-24 mx-auto mb-8">
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-indigo-100 to-violet-100 animate-pulse" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative">
                    <div className="absolute inset-0 rounded-full bg-indigo-500/20 animate-ping" />
                    <Loader2 className="w-12 h-12 text-indigo-600 animate-spin relative z-10" />
                  </div>
                </div>
              </div>
              <h3 className="text-2xl font-bold mb-3 bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                正在进行深度分析...
              </h3>
              <p className="text-slate-500">
                AI 正在搜索相关内容、分析情感倾向、识别热点话题，这可能需要 1-2 分钟
              </p>

              {/* 进度指示器 */}
              <div className="mt-8 flex justify-center gap-2">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 实时日志 - 终端风格 */}
        {isAnalyzing && logs.length > 0 && (
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-slate-900 rounded-3xl blur-xl opacity-50" />
            <div className="relative bg-slate-900 rounded-3xl overflow-hidden border border-slate-700/50 shadow-2xl">
              {/* 终端标题栏 */}
              <div className="flex items-center gap-2 px-4 py-3 bg-slate-800/50 border-b border-slate-700/50">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500" />
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                </div>
                <span className="ml-3 text-xs text-slate-400 font-mono">analysis-terminal</span>
                <Activity className="w-4 h-4 text-emerald-500 ml-auto animate-pulse" />
              </div>

              <div
                ref={logContainerRef}
                className="p-6 text-sm font-mono h-72 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-400 scrollbar-track-transparent"
              >
                {logs.map((log, index) => (
                  <div key={index} className={`flex items-start gap-3 mb-2 ${log.type === 'error' ? 'text-rose-400' : 'text-slate-300'}`}>
                    <span className="text-slate-600 select-none shrink-0">{String(index + 1).padStart(3, '0')}</span>
                    <span className="text-indigo-400 select-none">→</span>
                    <span className="whitespace-pre-wrap break-all">{log.message}</span>
                  </div>
                ))}
                <div className="flex items-center gap-2 text-emerald-400 mt-2">
                  <span className="animate-pulse">▋</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 概览统计卡片 - 增强版 */}
        {analysisData && !isAnalyzing && (
          <div className="grid md:grid-cols-4 gap-5 mb-8">
            {statCards.map((card, index) => (
              <div
                key={index}
                className="group relative"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                {/* 卡片发光效果 */}
                <div className={`absolute inset-0 bg-gradient-to-r ${card.gradient} rounded-2xl blur-xl opacity-0 group-hover:opacity-20 transition-opacity duration-500`} />

                <div className="relative bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white/50 shadow-lg shadow-slate-200/50 hover:shadow-xl hover:shadow-indigo-100/50 transition-all duration-300 hover:-translate-y-1 overflow-hidden">
                  {/* 顶部渐变条 */}
                  <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${card.gradient}`} />

                  {/* 背景装饰 */}
                  <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${card.bgGradient} rounded-full blur-2xl opacity-50 -translate-y-1/2 translate-x-1/2`} />

                  <div className="relative">
                    <div className="flex justify-between items-start mb-4">
                      <div className={`p-3 rounded-xl ${card.iconBg} group-hover:scale-110 transition-transform duration-300`}>
                        <card.icon className={`w-6 h-6 ${card.iconColor}`} />
                      </div>
                      <div className={`text-xs font-medium px-2 py-1 rounded-full bg-gradient-to-r ${card.bgGradient} ${card.iconColor}`}>
                        实时
                      </div>
                    </div>
                    <div className="text-3xl font-bold mb-1 text-slate-800">{card.value}</div>
                    <div className="text-sm text-slate-500">{card.label}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 主内容区域 */}
        {analysisData && !isAnalyzing && (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* 左侧：热点话题排行 */}
            <div className="lg:col-span-1 space-y-6">
              {/* 热点话题列表 */}
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-3xl blur-xl opacity-0 group-hover:opacity-10 transition-opacity duration-500" />
                <div className="relative bg-white/80 backdrop-blur-sm rounded-3xl p-6 border border-white/50 shadow-lg">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 shadow-lg shadow-indigo-500/25">
                        <TrendingUp className="w-5 h-5 text-white" />
                      </div>
                      热点话题排行
                    </h2>
                    <span className="text-sm text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
                      {hotTopics.length} 个话题
                    </span>
                  </div>

                  {hotTopics.length > 0 ? (
                    <div className="space-y-3">
                      {hotTopics.map((topic, index) => (
                        <div
                          key={index}
                          className="group/item relative rounded-2xl p-4 bg-gradient-to-br from-slate-50 to-white border border-slate-100 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-100/50 transition-all duration-300 cursor-pointer overflow-hidden"
                        >
                          {/* 排名徽章 */}
                          <div className={`absolute -left-1 -top-1 w-10 h-10 flex items-center justify-center ${index === 0 ? 'bg-gradient-to-br from-amber-400 to-orange-500' :
                            index === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-400' :
                              index === 2 ? 'bg-gradient-to-br from-amber-600 to-amber-700' :
                                'bg-gradient-to-br from-slate-200 to-slate-300'
                            } rounded-br-2xl shadow-lg`}>
                            <span className={`text-sm font-bold ${index < 3 ? 'text-white' : 'text-slate-600'}`}>
                              {index + 1}
                            </span>
                          </div>

                          <div className="ml-8">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <h3 className="text-base font-semibold text-slate-800 group-hover/item:text-indigo-600 transition-colors">
                                {topic.topic}
                              </h3>
                              {topic.category && (
                                <span className="px-2.5 py-0.5 text-xs rounded-full bg-gradient-to-r from-indigo-100 to-violet-100 text-indigo-700 font-medium">
                                  {topic.category}
                                </span>
                              )}
                              {topic.trend && (
                                <span className={`text-lg ${topic.trend === 'up' ? 'text-emerald-500' :
                                  topic.trend === 'down' ? 'text-rose-500' : 'text-slate-400'
                                  }`}>
                                  {getTrendIcon(topic.trend)}
                                </span>
                              )}
                            </div>
                            {topic.description && (
                              <p className="text-sm mb-3 text-slate-500">{topic.description}</p>
                            )}
                            <div className="flex items-center gap-4 text-sm">
                              {topic.mentions && (
                                <span className="flex items-center gap-1.5 text-slate-500">
                                  <MessageSquare className="w-3.5 h-3.5" />
                                  <span className="font-medium">{topic.mentions.toLocaleString()}</span>
                                </span>
                              )}
                              {topic.sentiment !== undefined && (
                                <span className={`flex items-center gap-1.5 font-medium ${getSentimentColor(topic.sentiment)}`}>
                                  {topic.sentiment >= 0.6 ? <ThumbsUp className="w-3.5 h-3.5" /> : <ThumbsDown className="w-3.5 h-3.5" />}
                                  {(topic.sentiment * 100).toFixed(0)}%
                                </span>
                              )}
                            </div>
                          </div>

                          {/* 情感进度条 */}
                          {topic.sentiment !== undefined && (
                            <div className="mt-4 ml-8 h-1.5 rounded-full overflow-hidden bg-slate-100">
                              <div
                                className={`h-full transition-all duration-500 rounded-full ${topic.sentiment >= 0.8 ? 'bg-gradient-to-r from-emerald-400 to-teal-500' :
                                  topic.sentiment >= 0.6 ? 'bg-gradient-to-r from-indigo-400 to-violet-500' :
                                    'bg-gradient-to-r from-amber-400 to-orange-500'
                                  }`}
                                style={{ width: `${topic.sentiment * 100}%` }}
                              />
                            </div>
                          )}

                          {/* Hover 箭头 */}
                          <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 opacity-0 group-hover/item:opacity-100 group-hover/item:translate-x-1 transition-all" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-slate-100 flex items-center justify-center">
                        <TrendingUp className="w-10 h-10 text-slate-300" />
                      </div>
                      <p className="text-slate-400">暂无热点话题数据</p>
                    </div>
                  )}
                </div>
              </div>

              {/* 情感趋势图 */}
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-purple-500 rounded-3xl blur-xl opacity-0 group-hover:opacity-10 transition-opacity duration-500" />
                <div className="relative bg-white/80 backdrop-blur-sm rounded-3xl p-6 border border-white/50 shadow-lg">
                  <h2 className="text-lg font-bold mb-6 text-slate-800 flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 shadow-lg shadow-violet-500/25">
                      <Activity className="w-5 h-5 text-white" />
                    </div>
                    情感分析趋势
                  </h2>

                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={sentimentData} barCategoryGap="20%">
                      <defs>
                        <linearGradient id="positiveGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity={1} />
                          <stop offset="100%" stopColor="#14b8a6" stopOpacity={0.8} />
                        </linearGradient>
                        <linearGradient id="neutralGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#94a3b8" stopOpacity={1} />
                          <stop offset="100%" stopColor="#cbd5e1" stopOpacity={0.8} />
                        </linearGradient>
                        <linearGradient id="negativeGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#ef4444" stopOpacity={1} />
                          <stop offset="100%" stopColor="#f87171" stopOpacity={0.8} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="time" stroke="#94a3b8" style={{ fontSize: '12px' }} axisLine={false} tickLine={false} />
                      <YAxis stroke="#94a3b8" style={{ fontSize: '12px' }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={chartTooltipStyle} cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }} />
                      <Legend wrapperStyle={{ paddingTop: '20px' }} />
                      <Bar dataKey="positive" stackId="a" fill="url(#positiveGradient)" name="正面" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="neutral" stackId="a" fill="url(#neutralGradient)" name="中立" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="negative" stackId="a" fill="url(#negativeGradient)" name="负面" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* 右侧：维度分析详情 */}
            <div className="space-y-6 lg:col-span-2">
              {/* 分析维度列表 */}
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-3xl blur-xl opacity-0 group-hover:opacity-10 transition-opacity duration-500" />
                <div className="relative bg-white/80 backdrop-blur-sm rounded-3xl p-6 border border-white/50 shadow-lg overflow-hidden">
                  <h3 className="text-lg font-bold mb-6 text-slate-800 flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/25">
                      <Target className="w-5 h-5 text-white" />
                    </div>
                    分析维度
                  </h3>

                  <div className="gap-6">
                    {dimensions.length > 0 ? dimensions.map((dim, index) => (
                      <div
                        key={index}
                        className="rounded-2xl p-5 bg-gradient-to-br from-slate-50 to-white border border-slate-100 hover:border-emerald-200 hover:shadow-lg hover:shadow-emerald-100/50 transition-all duration-300"
                      >
                        <div className="flex items-start gap-3 mb-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white bg-gradient-to-br ${index % 4 === 0 ? 'from-indigo-500 to-violet-500' :
                            index % 4 === 1 ? 'from-emerald-500 to-teal-500' :
                              index % 4 === 2 ? 'from-amber-500 to-orange-500' :
                                'from-rose-500 to-pink-500'
                            }`}>
                            {index + 1}
                          </div>
                          <h2 className="text-base font-semibold text-slate-800 flex-1">
                            {dim.dimension}
                          </h2>
                        </div>
                        <p className="mb-3 text-slate-500 leading-relaxed">
                          {dim.analysis?.summary}
                        </p>
                        {dim.analysis?.key_points && (
                          <div className="space-y-2">
                            {dim.analysis.key_points.slice(0, 2).map((point, idx) => (
                              <div key={idx} className="flex items-start gap-2 text-slate-600">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-2 shrink-0" />
                                <span>{point}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )) : (
                      <p className="text-sm text-slate-400 col-span-2 text-center py-8">暂无维度分析数据</p>
                    )}
                  </div>
                </div>
              </div>

              {/* 情感详情 */}
              {sentimentInfo.overall_sentiment && (
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-3xl blur-xl opacity-0 group-hover:opacity-10 transition-opacity duration-500" />
                  <div className="relative bg-white/80 backdrop-blur-sm rounded-3xl p-6 border border-white/50 shadow-lg">
                    <h2 className="text-lg font-bold mb-6 text-slate-800 flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 shadow-lg shadow-cyan-500/25">
                        <Eye className="w-5 h-5 text-white" />
                      </div>
                      情感详情
                    </h2>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-50 to-white border border-slate-100">
                        <span className="text-sm text-slate-500 block mb-2">总体倾向</span>
                        <span className={`text-2xl font-bold capitalize ${getSentimentColor(sentimentInfo.sentiment_score)}`}>
                          {sentimentInfo.overall_sentiment === 'positive' ? '积极' :
                            sentimentInfo.overall_sentiment === 'negative' ? '消极' : '中性'}
                        </span>
                      </div>
                      <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-50 to-white border border-slate-100">
                        <span className="text-sm text-slate-500 block mb-2">情感得分</span>
                        <span className={`text-2xl font-bold ${getSentimentColor(sentimentInfo.sentiment_score)}`}>
                          {Math.round(sentimentInfo.sentiment_score * 100)}%
                        </span>
                      </div>
                    </div>
                    {sentimentInfo.analysis && (
                      <p className="mt-6 text-sm text-slate-600 leading-relaxed p-4 rounded-xl bg-slate-50 border border-slate-100">
                        {sentimentInfo.analysis}
                      </p>
                    )}
                  </div>
                </div>
              )}


              {/* 分析摘要 */}
              {analysisData.report?.summary && (
                <div className="relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-600 rounded-3xl" />
                  <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[size:20px_20px] opacity-20" />
                  <div className="relative p-8">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2.5 rounded-xl bg-white/20 backdrop-blur-sm">
                        <Sparkles className="w-6 h-6 text-white" />
                      </div>
                      <h3 className="text-xl font-bold text-white">
                        分析摘要
                      </h3>
                    </div>
                    <p className="text-base text-white/90 leading-relaxed">
                      {analysisData.report.summary}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 分析报告 — 流式生成时也实时显示 */}
        {(reportContent || isStreamingReport) && (
          <div className="relative mt-8 group">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-3xl blur-xl opacity-0 group-hover:opacity-10 transition-opacity duration-500" />
            <div className="relative bg-white/80 backdrop-blur-sm rounded-3xl p-8 border border-white/50 shadow-lg overflow-hidden">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 shadow-lg shadow-indigo-500/25">
                    <FileText className="w-6 h-6 text-white" />
                  </div>
                  趋势分析报告
                  {isStreamingReport && (
                    <span className="text-sm font-normal text-indigo-500 animate-pulse">生成中...</span>
                  )}
                </h2>
                {!isStreamingReport && reportContent && (
                  <button
                    onClick={handleDownloadReport}
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 hover:from-indigo-500 hover:via-violet-500 hover:to-purple-500 text-white font-semibold flex items-center gap-2 transition-all shadow-xl shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Download className="w-5 h-5" />
                    下载报告
                  </button>
                )}
              </div>

              {/* 两列布局：左 TOC + 右报告内容 */}
              <div className="flex items-start gap-4">
                {/* 左侧目录 */}
                {reportTocSections.length > 0 && (
                  <AnalysisTOC
                    sections={reportTocSections}
                    scrollContainerRef={reportScrollRef}
                    visible={tocVisible}
                    onToggle={() => setTocVisible(v => !v)}
                  />
                )}

                {/* 右侧报告内容区 */}
                <div
                  ref={reportScrollRef}
                  className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden"
                  style={{ maxHeight: '70vh' }}
                >
                  <div className="prose prose-slate max-w-none break-words">
                    {reportContent ? (
                      <EnhancedMarkdownWithAnchors
                        markdown={reportContent}
                        analysisData={analysisData}
                        tocSections={reportTocSections}
                      />
                    ) : (
                      <div className="text-slate-400 text-sm">正在等待报告内容...</div>
                    )}
                    {isStreamingReport && <span className="inline-block w-2 h-5 bg-indigo-500 animate-pulse ml-0.5 align-middle" />}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 无数据提示 - 增强版 */}
        {!analysisData && !isAnalyzing && (
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-3xl blur-2xl opacity-10 group-hover:opacity-20 transition-opacity duration-500" />
            <div className="relative bg-white/80 backdrop-blur-xl rounded-3xl p-16 text-center border border-white/50 shadow-xl overflow-hidden">
              {/* 装饰元素 */}
              <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-10 left-10 w-20 h-20 bg-indigo-200/50 rounded-full blur-2xl" />
                <div className="absolute bottom-10 right-10 w-32 h-32 bg-violet-200/50 rounded-full blur-2xl" />
                <div className="absolute top-1/2 left-1/4 w-16 h-16 bg-cyan-200/30 rounded-full blur-xl" />
              </div>

              <div className="relative z-10">
                <div className="w-28 h-28 mx-auto mb-8 rounded-3xl bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center shadow-inner relative group-hover:scale-110 transition-transform duration-500">
                  <Search className="w-14 h-14 text-slate-300" />
                  <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shadow-lg">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                </div>
                <h3 className="text-3xl font-bold mb-4 bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 bg-clip-text text-transparent">
                  开始您的趋势分析
                </h3>
                <p className="mb-10 text-slate-500 max-w-lg mx-auto text-lg leading-relaxed">
                  输入任何主题，AI 将为您进行深度分析，识别热点话题、分析情感倾向和用户观点
                </p>
                <div className="flex justify-center gap-4 flex-wrap">
                  <button
                    onClick={() => {
                      setSearchQuery('产品创意社区的用户反馈');
                    }}
                    className="px-6 py-3 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 hover:from-indigo-50 hover:to-violet-50 text-slate-700 hover:text-indigo-700 font-medium transition-all border border-slate-200 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-100/50 hover:-translate-y-0.5 flex items-center gap-2"
                  >
                    <Sparkles className="w-5 h-5 text-indigo-500" />
                    产品创意社区
                  </button>
                  <button
                    onClick={() => {
                      setSearchQuery('技术社区的热门话题');
                    }}
                    className="px-6 py-3 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 hover:from-indigo-50 hover:to-violet-50 text-slate-700 hover:text-indigo-700 font-medium transition-all border border-slate-200 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-100/50 hover:-translate-y-0.5 flex items-center gap-2"
                  >
                    <Activity className="w-5 h-5 text-orange-500" />
                    技术社区热门话题
                  </button>
                  <button
                    onClick={() => {
                      setSearchQuery('AI 人工智能发展趋势');
                    }}
                    className="px-6 py-3 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 hover:from-indigo-50 hover:to-violet-50 text-slate-700 hover:text-indigo-700 font-medium transition-all border border-slate-200 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-100/50 hover:-translate-y-0.5 flex items-center gap-2"
                  >
                    <Target className="w-5 h-5 text-blue-500" />
                    AI 发展趋势
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 带锚点 id 的 Markdown 渲染组件
 * 在渲染 h2/h3 时自动注入与 TOC sections 对应的 id
 */
function EnhancedMarkdownWithAnchors({ markdown, analysisData, tocSections = [] }) {
  // 构建标题文本 → id 的映射
  const headingIdMap = useMemo(() => {
    const map = {};
    let h2Count = 0;
    const processedSections = [];
    tocSections.forEach((s) => {
      map[s.label] = s.id;
      processedSections.push(s);
      if (s.sub) {
        s.sub.forEach((sub) => {
          map[sub.label] = sub.id;
        });
      }
    });
    return map;
  }, [tocSections]);

  return (
    <EnhancedMarkdown
      markdown={markdown}
      analysisData={analysisData}
      customComponents={{
        h2: ({ node, children, ...props }) => {
          const text = typeof children === 'string' ? children : (Array.isArray(children) ? children.join('') : '');
          const id = headingIdMap[text] || undefined;
          return <h2 id={id} {...props}>{children}</h2>;
        },
        h3: ({ node, children, ...props }) => {
          const text = typeof children === 'string' ? children : (Array.isArray(children) ? children.join('') : '');
          const id = headingIdMap[text] || undefined;
          return <h3 id={id} {...props}>{children}</h3>;
        },
      }}
    />
  );
}
