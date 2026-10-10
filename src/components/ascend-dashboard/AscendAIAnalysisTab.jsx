'use client';

import { useState, useCallback, useRef } from 'react';
import { Brain, Loader2, Users, TrendingUp, Network, Sparkles, ChevronDown, ChevronUp, Trophy, List, ChevronLeft, ChevronRight } from 'lucide-react';
import { Tabs, Modal } from 'antd';
import EnhancedMarkdown from '../EnhancedMarkdown';
import AscendUserDetailModal from '../AscendUserDetailModal';
import Link from 'next/link';
import NetworkWeightsEditor from '@/components/NetworkWeightsEditor';
import { useAnalysisContext } from '@/context/AnalysisContext';
import { appendWeightParams } from '@/utils/networkWeights';

/**
 * 昇腾社区 · 智能分析 Tab
 * 与华为版 AIAnalysisTab 功能一致，但 API 前缀为 /api/ascend/
 * 使用 AnalysisContext 保持分析结果
 */
export default function AscendAIAnalysisTab({ requestParams = '' }) {
  const { ascendAnalysisPanelData, setAscendAnalysisPanelData } = useAnalysisContext();

  const analysisData = ascendAnalysisPanelData;
  const setAnalysisData = setAscendAnalysisPanelData;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedCluster, setSelectedCluster] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [retryingSection, setRetryingSection] = useState(null);
  const [streamingSection, setStreamingSection] = useState(null);
  const [updatingNetworkWeights, setUpdatingNetworkWeights] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState('topics');
  const [tocVisible, setTocVisible] = useState(true);
  const contentAreaRef = useRef(null);

  const tocSections = [
    { id: 'topics', label: '热点话题 (LDA)', icon: <TrendingUp className="w-3.5 h-3.5" /> },
    { id: 'network', label: '社会网络分析', icon: <Network className="w-3.5 h-3.5" /> },
    { id: 'users', label: '用户画像聚类', icon: <Users className="w-3.5 h-3.5" /> },
    {
      id: 'ai', label: 'AI 智能洞察', icon: <Sparkles className="w-3.5 h-3.5" />,
      sub: [
        { id: 'ai-topic', label: '热点话题解读' },
        { id: 'ai-user', label: '用户画像洞察' },
        { id: 'ai-trend', label: '趋势总结' },
        { id: 'ai-rec', label: '建议' },
      ]
    },
  ];

  const handleTocClick = useCallback((id) => {
    const mainIds = ['topics', 'network', 'users', 'ai'];
    if (mainIds.includes(id)) {
      setActiveSubTab(id);
      contentAreaRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setActiveSubTab('ai');
      setTimeout(() => {
        const container = contentAreaRef.current;
        if (!container) return;
        const target = container.querySelector(`#${id}`);
        if (!target) return;
        const containerTop = container.getBoundingClientRect().top;
        const targetTop = target.getBoundingClientRect().top;
        container.scrollTo({ top: targetTop - containerTop + container.scrollTop - 16, behavior: 'smooth' });
      }, 80);
    }
  }, []);

  const processSSEStream = useCallback(async (response, onBaseData) => {
    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += value;
      const parts = buffer.split('\n\n');
      buffer = parts.pop() || '';

      for (const part of parts) {
        if (!part.trim()) continue;

        let event = 'message';
        let data = '';

        const eventMatch = part.match(/^event: (.*)$/m);
        if (eventMatch) event = eventMatch[1];

        const dataMatch = part.match(/^data: (.*)$/m);
        if (dataMatch) data = dataMatch[1];

        if (!data) continue;

        try {
          const parsed = JSON.parse(data);

          if (event === 'base_data' && onBaseData) {
            onBaseData(parsed);
          } else if (event === 'topic_start') {
            setStreamingSection('topic');
            setAnalysisData(prev => ({
              ...prev,
              ai_insights: { ...prev?.ai_insights, topic_insights: '' }
            }));
          } else if (event === 'user_start') {
            setStreamingSection('user');
            setAnalysisData(prev => ({
              ...prev,
              ai_insights: { ...prev?.ai_insights, user_insights: '' }
            }));
          } else if (event === 'trend_start') {
            setStreamingSection('trend');
            setAnalysisData(prev => ({
              ...prev,
              ai_insights: { ...prev?.ai_insights, trend_summary: '' }
            }));
          } else if (event === 'topic_chunk') {
            setAnalysisData(prev => ({
              ...prev,
              ai_insights: {
                ...prev?.ai_insights,
                topic_insights: (prev?.ai_insights?.topic_insights || '') + parsed.content
              }
            }));
          } else if (event === 'user_chunk') {
            setAnalysisData(prev => ({
              ...prev,
              ai_insights: {
                ...prev?.ai_insights,
                user_insights: (prev?.ai_insights?.user_insights || '') + parsed.content
              }
            }));
          } else if (event === 'trend_chunk') {
            setAnalysisData(prev => ({
              ...prev,
              ai_insights: {
                ...prev?.ai_insights,
                trend_summary: (prev?.ai_insights?.trend_summary || '') + parsed.content
              }
            }));
          } else if (event === 'topic_done' || event === 'user_done' || event === 'trend_done') {
            const key = event === 'topic_done' ? 'topic_insights' : event === 'user_done' ? 'user_insights' : 'trend_summary';
            setAnalysisData(prev => ({
              ...prev,
              ai_insights: { ...prev?.ai_insights, [key]: parsed.content }
            }));
          } else if (event === 'all_done') {
            setStreamingSection(null);
          }
        } catch (e) {
          console.warn('SSE 解析错误:', e);
        }
      }
    }
    setStreamingSection(null);
  }, [setAnalysisData]);

  const retryInsight = useCallback(async (insightType) => {
    if (!analysisData) return;
    setRetryingSection(insightType);
    setStreamingSection(insightType);

    const keyMap = { topic: 'topic_insights', user: 'user_insights', trend: 'trend_summary' };
    setAnalysisData(prev => ({
      ...prev,
      ai_insights: { ...prev.ai_insights, [keyMap[insightType]]: '' }
    }));

    try {
      const t = Date.now();
      const res = await fetch(`/api/ascend/analysis?stream=1&insight_type=${insightType}&t=${t}${requestParams}`);
      if (!res.ok) throw new Error(`重试失败: ${res.status}`);
      await processSSEStream(res);
    } catch (e) {
      console.error(`${insightType} 重试失败:`, e);
    } finally {
      setRetryingSection(null);
      setStreamingSection(null);
    }
  }, [analysisData, requestParams, processSSEStream]);

  const runAnalysis = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const t = Date.now();
      const res = await fetch(`/api/ascend/analysis?stream=1&t=${t}${requestParams}`);
      if (!res.ok) throw new Error(`分析服务请求失败: ${res.status}`);

      await processSSEStream(res, (baseData) => {
        setAnalysisData({
          ...baseData,
          ai_insights: {
            topic_insights: '',
            user_insights: '',
            trend_summary: '',
            recommendations: []
          }
        });
      });

      setAnalysisData(prev => ({
        ...prev,
        ai_insights: {
          ...prev?.ai_insights,
          recommendations: [
            '基于热点分析，建议关注昇腾社区开发者最关心的技术话题',
            '培养核心用户及高采纳率回答者，提升社区问答质量',
            '定期分析板块生态趋势，优化社区板块布局'
          ]
        }
      }));
    } catch (e) {
      console.error('分析错误:', e);
      setError(e.message || '分析失败');
    } finally {
      setLoading(false);
    }
  }, [requestParams, processSSEStream]);

  const rerunNetworkRanking = useCallback(async (weights) => {
    setUpdatingNetworkWeights(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('top_n', '20');
      params.set('t', String(Date.now()));
      if (weights) {
        appendWeightParams(params, weights);
      }

      const query = requestParams?.replace(/^&/, '');
      if (query) {
        const extra = new URLSearchParams(query);
        extra.forEach((value, key) => params.set(key, value));
      }

      const res = await fetch(`/api/ascend/network-analysis?${params.toString()}`);
      if (!res.ok) throw new Error(`网络分析重算失败: ${res.status}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || '网络分析重算失败');

      setAnalysisData((prev) => ({
        ...prev,
        network: json.data,
      }));
    } catch (e) {
      setError(e.message || '网络分析重算失败');
    } finally {
      setUpdatingNetworkWeights(false);
    }
  }, [requestParams]);

  const subTabItems = [
    {
      key: 'topics',
      label: <span className="flex items-center gap-2"><TrendingUp className="w-4 h-4" />热点话题 (LDA)</span>,
      children: <TopicsPanel analysisData={analysisData} />,
    },
    {
      key: 'network',
      label: <span className="flex items-center gap-2"><Network className="w-4 h-4" />社会网络分析</span>,
      children: (
        <NetworkPanel
          analysisData={analysisData}
          setSelectedUser={setSelectedUser}
          requestParams={requestParams}
          onApplyWeights={rerunNetworkRanking}
          weightLoading={updatingNetworkWeights}
        />
      ),
    },
    {
      key: 'users',
      label: <span className="flex items-center gap-2"><Users className="w-4 h-4" />用户画像聚类</span>,
      children: <UsersPanel analysisData={analysisData} setSelectedCluster={setSelectedCluster} />,
    },
    {
      key: 'ai',
      label: <span className="flex items-center gap-2"><Sparkles className="w-4 h-4" />AI 智能洞察</span>,
      children: (
        <AIInsightsPanel
          analysisData={analysisData}
          retryInsight={retryInsight}
          retryingSection={retryingSection}
          streamingSection={streamingSection}
        />
      ),
    },
  ];

  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-slate-200 p-6">
      {/* 标题栏 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl shadow-lg shadow-purple-500/20">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">智能分析</h2>
            <p className="text-sm text-slate-500">大模型驱动 · 昇腾社区深度分析</p>
          </div>
        </div>

        <button
          onClick={runAnalysis}
          disabled={loading}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 transition-all flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-purple-500/20"
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" />分析中...</>
          ) : (
            <><Sparkles className="w-4 h-4" />开始分析</>
          )}
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700">
          <div className="font-semibold">分析失败</div>
          <div className="text-sm mt-1 text-rose-600">{error}</div>
          <div className="text-xs mt-2 text-rose-500">
            提示：请确认 Python 分析服务已启动 (uvicorn app:app --port 8008)
          </div>
        </div>
      )}

      {!analysisData && !loading && !error && (
        <div className="text-center py-12 text-slate-500">
          <Brain className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>点击"开始分析"运行智能分析</p>
          <p className="text-sm mt-2 text-slate-600">将使用 LDA 主题建模、社会网络分析和大模型对昇腾社区进行深度分析</p>
        </div>
      )}

      {analysisData && (
        <div className="flex items-start gap-4">
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setTocVisible(v => !v)}
              title={tocVisible ? '隐藏目录' : '显示目录'}
              className="absolute -right-3 top-3 z-10 w-6 h-6 flex items-center justify-center rounded-full bg-slate-100 border border-slate-200 hover:border-sky-500/50 hover:text-sky-500 transition-all text-slate-400"
            >
              {tocVisible ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>

            {tocVisible && (
              <nav className="w-44 bg-slate-50 border border-slate-200 rounded-2xl p-3 sticky top-4">
                <div className="flex items-center gap-1.5 mb-3 px-1">
                  <List className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">目录</span>
                </div>
                <ul className="space-y-0.5">
                  {tocSections.map((section) => (
                    <li key={section.id}>
                      <button
                        onClick={() => handleTocClick(section.id)}
                        className={`w-full text-left px-2 py-1.5 rounded-lg text-sm transition-all flex items-center gap-1.5 group ${activeSubTab === section.id
                            ? 'bg-sky-500/20 text-sky-500 font-medium'
                            : 'text-slate-600 hover:bg-slate-200 hover:text-slate-800'
                          }`}
                      >
                        {section.icon && <span className="shrink-0">{section.icon}</span>}
                        <span className="truncate leading-snug">{section.label}</span>
                      </button>
                      {section.sub && activeSubTab === 'ai' && (
                        <ul className="mt-0.5 ml-3 space-y-0.5">
                          {section.sub.map((sub) => (
                            <li key={sub.id}>
                              <button
                                onClick={() => handleTocClick(sub.id)}
                                className="w-full text-left px-2 py-1 rounded-lg text-xs transition-all flex items-center gap-1 text-slate-500 hover:bg-slate-200 hover:text-slate-800"
                              >
                                <span className="w-1 h-1 rounded-full bg-current shrink-0 opacity-60" />
                                <span className="truncate">{sub.label}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              </nav>
            )}
          </div>

          <div ref={contentAreaRef} className="flex-1 min-w-0 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>
            <Tabs
              activeKey={activeSubTab}
              onChange={setActiveSubTab}
              items={subTabItems}
              tabBarStyle={{ marginBottom: '16px' }}
              className="ascend-analysis-tabs"
            />
          </div>
        </div>
      )}

      <ClusterModal
        selectedCluster={selectedCluster}
        setSelectedCluster={setSelectedCluster}
        setSelectedUser={setSelectedUser}
        analysisData={analysisData}
      />

      <AscendUserDetailModal
        open={!!selectedUser}
        userName={selectedUser}
        onClose={() => setSelectedUser(null)}
      />

      <style jsx global>{`
        .ascend-analysis-tabs .ant-tabs-nav::before {
          border-bottom: 1px solid rgba(226,232,240,0.8) !important;
        }
        .ascend-analysis-tabs .ant-tabs-tab {
          color: rgba(100, 116, 139, 0.8) !important;
        }
        .ascend-analysis-tabs .ant-tabs-tab-active .ant-tabs-tab-btn {
          color: #38bdf8 !important;
        }
        .ascend-analysis-tabs .ant-tabs-ink-bar {
          background: linear-gradient(to right, #0ea5e9, #8b5cf6) !important;
        }
      `}</style>
    </div>
  );
}

// ========== 子面板 ==========

function TopicsPanel({ analysisData }) {
  if (!analysisData?.topics?.topics?.length) {
    return <div className="text-center py-8 text-slate-500">暂无话题数据</div>;
  }
  return (
    <div className="space-y-3">
      {analysisData.topics.topics.map((topic, idx) => (
        <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
          <div className="font-medium text-slate-700 mb-2">{topic.label}</div>
          <div className="flex flex-wrap gap-2">
            {topic.keywords?.slice(0, 8).map((kw, i) => (
              <span key={i} className="px-2 py-1 text-xs bg-slate-100 border border-slate-200 rounded-full text-slate-600" style={{ opacity: 0.5 + kw.weight * 0.5 }}>
                {kw.word}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function NetworkPanel({ analysisData, setSelectedUser, requestParams = '', onApplyWeights, weightLoading = false }) {
  if (!analysisData?.network) {
    return <div className="text-center py-8 text-slate-500">暂无网络数据</div>;
  }

  const rankingParams = new URLSearchParams(requestParams.replace(/^&/, ''));
  if (analysisData.network?.weights) {
    appendWeightParams(rankingParams, analysisData.network.weights);
  }
  const rankingHref = `/ascend/ranking?${rankingParams.toString()}`;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: '用户节点', value: analysisData.network?.stats?.nodes ?? 0 },
          { label: '交互边', value: analysisData.network?.stats?.edges ?? 0 },
          { label: '网络密度', value: `${((analysisData.network?.stats?.density ?? 0) * 100).toFixed(2)}%` },
          { label: '社区数量', value: analysisData.network?.communities?.length ?? 0 },
        ].map((s, i) => (
          <div key={i} className="text-center p-3 bg-slate-50 rounded-xl border border-slate-100">
            <div className="text-2xl font-bold text-slate-800">{s.value}</div>
            <div className="text-sm text-slate-500">{s.label}</div>
          </div>
        ))}
      </div>

      {analysisData.network?.weights && (
        <div>
          <div className="text-sm font-medium text-slate-700 mb-2">⚖️ 本次评分权重（可编辑 · 8维）</div>
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-2">
            <div className="text-center p-2 bg-blue-50 rounded-lg border border-blue-100">
              <div className="text-xs text-slate-500">PageRank</div>
              <div className="font-bold text-blue-600">{(analysisData.network.weights.pagerank * 100).toFixed(1)}%</div>
            </div>
            <div className="text-center p-2 bg-purple-50 rounded-lg border border-purple-100">
              <div className="text-xs text-slate-500">入度</div>
              <div className="font-bold text-purple-600">{(analysisData.network.weights.in_degree * 100).toFixed(1)}%</div>
            </div>
            <div className="text-center p-2 bg-green-50 rounded-lg border border-green-100">
              <div className="text-xs text-slate-500">介数</div>
              <div className="font-bold text-green-600">{(analysisData.network.weights.betweenness * 100).toFixed(1)}%</div>
            </div>
            <div className="text-center p-2 bg-orange-50 rounded-lg border border-orange-100">
              <div className="text-xs text-slate-500">质量</div>
              <div className="font-bold text-orange-600">{(analysisData.network.weights.quality * 100).toFixed(1)}%</div>
            </div>
            <div className="text-center p-2 bg-pink-50 rounded-lg border border-pink-100">
              <div className="text-xs text-slate-500">创新</div>
              <div className="font-bold text-pink-600">{(analysisData.network.weights.innovation * 100).toFixed(1)}%</div>
            </div>
            <div className="text-center p-2 bg-teal-50 rounded-lg border border-teal-100">
              <div className="text-xs text-slate-500">情感</div>
              <div className="font-bold text-teal-600">{(analysisData.network.weights.sentiment * 100).toFixed(1)}%</div>
            </div>
            <div className="text-center p-2 bg-amber-50 rounded-lg border border-amber-100">
              <div className="text-xs text-slate-500">覆盖</div>
              <div className="font-bold text-amber-600">{(analysisData.network.weights.diversity * 100).toFixed(1)}%</div>
            </div>
            <div className="text-center p-2 bg-lime-50 rounded-lg border border-lime-100">
              <div className="text-xs text-slate-500">稳定</div>
              <div className="font-bold text-lime-600">{(analysisData.network.weights.consistency * 100).toFixed(1)}%</div>
            </div>
          </div>
          <div className="text-xs text-slate-400 mt-2">
            💡 首次为熵权法自动计算；你可以自定义权重并即时重算排行榜
          </div>
          <NetworkWeightsEditor
            className="mt-3"
            weights={analysisData.network.weights}
            loading={weightLoading}
            onApply={onApplyWeights}
            onReset={() => onApplyWeights?.(null)}
            title="自定义权重"
            description="修改任意维度后点击“应用并重算”，系统会自动归一化"
          />
        </div>
      )}

      <div>
        <div className="text-sm font-medium text-slate-700 mb-2">🏆 核心影响力用户 (Top 20)</div>
        <div className="space-y-2 overflow-y-auto">
          {analysisData.network?.top_users?.slice(0, 20).map((user, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setSelectedUser?.(user.user)}
              className="group w-full cursor-pointer text-left flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-sky-500/30 transition-all"
              title={`查看 ${user.user} 详情`}
            >
              <div className="flex items-center gap-3 flex-1">
                <span className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold ${idx < 3 ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white' : 'bg-sky-50 text-sky-500 border border-sky-200'}`}>
                  {idx + 1}
                </span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-800 truncate max-w-[120px] group-hover:text-indigo-600 transition-colors">{user.user}</span>
                    {user.quality_score >= 8 && (
                      <span className="px-2 py-0.5 text-xs bg-orange-100 text-orange-700 rounded-full border border-orange-200">高质量</span>
                    )}
                    {user.innovation_score >= 7 && (
                      <span className="px-2 py-0.5 text-xs bg-pink-100 text-pink-700 rounded-full border border-pink-200">创新者</span>
                    )}
                    {user.sentiment_score >= 8 && (
                      <span className="px-2 py-0.5 text-xs bg-teal-100 text-teal-700 rounded-full border border-teal-200">正能量</span>
                    )}
                    {user.consistency_score >= 7 && (
                      <span className="px-2 py-0.5 text-xs bg-lime-100 text-lime-700 rounded-full border border-lime-200">持续贡献</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span title="PageRank">PR: {(user.pagerank * 100).toFixed(2)}</span>
                <span title="入度">↓{user.in_degree}</span>
                <span title="出度">↑{user.out_degree}</span>
                {user.quality_score !== undefined && (
                  <span title="内容质量分" className="text-orange-600 font-medium">质:{user.quality_score.toFixed(1)}</span>
                )}
                {user.innovation_score !== undefined && (
                  <span title="创新度分数" className="text-pink-600 font-medium">创:{user.innovation_score.toFixed(1)}</span>
                )}
                {user.sentiment_score !== undefined && (
                  <span title="情感正向度" className="text-teal-600 font-medium">情:{user.sentiment_score.toFixed(1)}</span>
                )}
              </div>
            </button>
          ))}
        </div>
        <div className="flex justify-center mt-6">
          <Link
            href={rankingHref}
            className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-2xl hover:shadow-2xl hover:shadow-amber-500/30 transition-all transform hover:scale-105 font-semibold"
          >
            <Trophy className="w-6 h-6 text-white" />
            <div className='text-white'>
              <div className="text-lg font-semibold">查看完整榜单</div>
              <div className="text-xs opacity-90">Top 100 核心用户排行</div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}

function UsersPanel({ analysisData, setSelectedCluster }) {
  if (!analysisData?.users?.clusters?.length) {
    return <div className="text-center py-8 text-slate-500">暂无用户聚类数据</div>;
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {analysisData.users.clusters.map((cluster, idx) => (
        <div key={idx} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-8 h-8 flex items-center justify-center bg-violet-100 text-violet-600 rounded-full font-bold">{idx + 1}</span>
            <div>
              <div className="font-semibold text-slate-700">{cluster.label}</div>
              <div className="text-xs text-slate-500">{cluster.size} 位用户</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-slate-500">平均评论数: <span className="font-medium text-slate-700">{cluster.avg_comment_count?.toFixed(1)}</span></div>
            <div className="text-slate-500">平均获赞: <span className="font-medium text-slate-700">{cluster.avg_likes?.toFixed(1)}</span></div>
          </div>
          {cluster.semantic_keywords?.length > 0 && (
            <div className="mt-3">
              <div className="text-xs text-slate-500 mb-1.5">🔍 语义关键词</div>
              <div className="flex flex-wrap gap-1.5">
                {cluster.semantic_keywords.map((kw, ki) => (
                  <span key={ki} className="px-2 py-0.5 text-xs rounded-full bg-violet-50 border border-violet-200 text-violet-600">{kw}</span>
                ))}
              </div>
            </div>
          )}
          <div className="mt-4">
            <button
              onClick={() => setSelectedCluster(cluster)}
              className="w-full px-3 py-2 text-sm font-medium rounded-xl bg-white border border-slate-200 text-slate-700 hover:border-violet-300 hover:text-violet-600 transition-colors"
            >
              查看该群体用户
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function AIInsightsPanel({ analysisData, retryInsight, retryingSection, streamingSection }) {
  if (!analysisData?.ai_insights) {
    return <div className="text-center py-8 text-slate-500">暂无 AI 洞察数据</div>;
  }

  const sections = [
    { id: 'ai-topic', key: 'topic_insights', label: '📊 热点话题解读', type: 'topic', color: 'purple' },
    { id: 'ai-user', key: 'user_insights', label: '👥 用户画像洞察', type: 'user', color: 'pink' },
    { id: 'ai-trend', key: 'trend_summary', label: '📈 趋势总结', type: 'trend', color: 'indigo' },
  ];

  return (
    <div className="space-y-4">
      {sections.map((section) => {
        const content = analysisData.ai_insights?.[section.key];
        const isStreaming = streamingSection === section.type;
        const isEmpty = !content || content === 'AI分析暂不可用';
        const colorMap = {
          purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', cursor: 'bg-purple-500' },
          pink: { bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-700', cursor: 'bg-pink-500' },
          indigo: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700', cursor: 'bg-indigo-500' },
        };
        const c = colorMap[section.color];

        return (
          <div key={section.id} id={section.id}>
            <div className="flex items-center justify-between mb-2">
              <div className={`text-sm font-medium ${c.text}`}>{section.label}</div>
              {isEmpty && !isStreaming && (
                <button
                  onClick={() => retryInsight(section.type)}
                  disabled={retryingSection === section.type}
                  className={`text-xs px-2 py-1 rounded-lg ${c.bg} ${c.text} hover:opacity-80 disabled:opacity-50 flex items-center gap-1 border ${c.border}`}
                >
                  {retryingSection === section.type && <Loader2 className="w-3 h-3 animate-spin" />}
                  重试
                </button>
              )}
            </div>
            <div className={`p-4 ${c.bg} rounded-xl border ${c.border}`}>
              {content && !isEmpty ? (
                <>
                  <EnhancedMarkdown markdown={content} analysisData={analysisData} className="prose-lg text-slate-700" />
                  {isStreaming && <span className={`inline-block w-2 h-5 ${c.cursor} animate-pulse ml-0.5 align-middle`} />}
                </>
              ) : isStreaming ? (
                <div className={`flex items-center gap-2 ${c.text} text-sm`}><Loader2 className="w-4 h-4 animate-spin" /> 正在生成分析...</div>
              ) : (
                <div className="text-slate-500 text-sm">暂无数据，请点击重试</div>
              )}
            </div>
          </div>
        );
      })}

      {analysisData.ai_insights?.recommendations?.length > 0 && (
        <div id="ai-rec">
          <div className="text-sm font-medium text-emerald-400 mb-2">💡 建议</div>
          <ul className="space-y-2">
            {analysisData.ai_insights.recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2 text-base text-slate-400">
                <span className="text-emerald-500">•</span>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ClusterModal({ selectedCluster, setSelectedCluster, setSelectedUser, analysisData }) {
  return (
    <Modal
      open={!!selectedCluster}
      onCancel={() => setSelectedCluster(null)}
      title={
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-100 rounded-lg text-violet-700 font-bold">
            {(selectedCluster?.id ?? 0) + 1}
          </div>
          <div>
            <div className="text-lg font-bold text-slate-800">{selectedCluster?.label}</div>
            <div className="text-xs text-slate-500 font-normal">{selectedCluster?.size} 位用户</div>
          </div>
        </div>
      }
      footer={null}
      width={800}
      centered
    >
      <div className="p-4">
        <div className="text-sm text-slate-500 mb-3 flex justify-between">
          <span>用户列表</span>
          <span>共 {
            (() => {
              const assignments = analysisData?.users?.user_assignments || [];
              return assignments.filter(u => u.cluster === selectedCluster?.id).length;
            })()
          } 人</span>
        </div>
        <div className="max-h-[60vh] overflow-y-auto grid grid-cols-2 sm:grid-cols-4 gap-3 p-1">
          {selectedCluster && (() => {
            const assignments = analysisData?.users?.user_assignments || [];
            const matchList = assignments
              .filter((u) => u.cluster === selectedCluster.id)
              .sort((a, b) => (b.comment_count || 0) - (a.comment_count || 0))
              .map((u) => u.user_name || u.user);

            const fallbackList = selectedCluster.sample_users || [];
            const userList = matchList.length > 0 ? matchList : fallbackList;

            if (userList.length === 0) {
              return (
                <div className="col-span-full text-center text-slate-400 py-8">暂无可展示的用户</div>
              );
            }

            return userList.map((name, idx) => (
              <button
                key={`${name}-${idx}`}
                type="button"
                onClick={() => {
                  setSelectedUser?.(name);
                }}
                className="w-full cursor-pointer text-left px-3 py-2 rounded-xl bg-slate-50 border border-slate-100 text-sm text-slate-700 truncate hover:bg-violet-50 hover:text-violet-700 transition-colors flex items-center gap-2"
                title={`查看 ${name} 详情`}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-violet-300"></div>
                <span className="truncate">{name}</span>
              </button>
            ));
          })()}
        </div>
      </div>
    </Modal>
  );
}
