'use client';

import { useState, useCallback, useMemo, useRef } from 'react';
import {
  Gem, Loader2, Rocket, TrendingUp, Users,
  ChevronDown, ChevronUp, Sparkles, Target, Zap, MessageSquare,
} from 'lucide-react';
import EnhancedMarkdown from '../EnhancedMarkdown';
import AnalysisTOC from '../AnalysisTOC';
import AscendUserDetailModal from '../AscendUserDetailModal';
import { useAnalysisContext } from '@/context/AnalysisContext';

const HEADING_FIX_REGEX = /^(#{1,6})([^#\s])/gm;
const CHART_BLOCK_REGEX = /\[CHART-GENERATOR::(\{[\s\S]*?\})\]/g;
const MARKDOWN_HEADING_REGEX = /^(#{1,6})\s+(.+?)\s*$/;

function normalizeTocLabel(label = '') {
  return label.replace(/\s+/g, '').replace(/[：:]/g, '').toLowerCase();
}

function buildHeadingTree(items, excludedLabels = []) {
  if (!Array.isArray(items) || items.length === 0) return [];

  const excludedSet = new Set(excludedLabels.map((label) => normalizeTocLabel(label)));
  const filtered = items.filter((item) => !excludedSet.has(normalizeTocLabel(item.label)));

  if (filtered.length === 0) return [];

  const roots = [];
  const stack = [];

  filtered.forEach((item) => {
    const node = { id: item.id, label: item.label, sub: [] };

    while (stack.length > 0 && item.level <= stack[stack.length - 1].level) {
      stack.pop();
    }

    if (stack.length === 0) {
      roots.push(node);
    } else {
      stack[stack.length - 1].node.sub.push(node);
    }

    stack.push({ level: item.level, node });
  });

  const prune = (nodes) => nodes.map((node) => (
    node.sub.length > 0
      ? { id: node.id, label: node.label, sub: prune(node.sub) }
      : { id: node.id, label: node.label }
  ));

  return prune(roots);
}

function extractMarkdownHeadings(markdown, prefix) {
  if (!markdown) return [];

  const normalizedMarkdown = markdown
    .replace(HEADING_FIX_REGEX, '$1 $2')
    .replace(CHART_BLOCK_REGEX, '');

  const lines = normalizedMarkdown.split('\n');
  let headingCount = 0;
  let inCodeFence = false;
  const result = [];

  lines.forEach((line) => {
    if (/^\s*```/.test(line)) {
      inCodeFence = !inCodeFence;
      return;
    }

    if (inCodeFence) return;

    const match = line.match(MARKDOWN_HEADING_REGEX);
    if (!match) return;

    const level = match[1].length;
    const plainLabel = match[2]
      .replace(/\[(.*?)\]\(.*?\)/g, '$1')
      .replace(/[>*_`~]/g, '')
      .trim();

    if (!plainLabel) return;

    headingCount += 1;
    result.push({
      id: `${prefix}-${headingCount}`,
      label: plainLabel,
      level,
    });
  });

  return result;
}

/**
 * 昇腾社区商业热点挖掘面板
 * 与华为商业热点面板保持一致的交互与布局，API 前缀为 /api/ascend/
 */
export default function AscendBusinessInsights({ requestParams = '' }) {
  const {
    ascendBusinessInsightsData: data,
    setAscendBusinessInsightsData: setData,
    ascendCommercialInsight: commercialInsight,
    setAscendCommercialInsight: setCommercialInsight,
    ascendRisingStarsInsight: risingStarsInsight,
    setAscendRisingStarsInsight: setRisingStarsInsight,
  } = useAnalysisContext();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [streamingSection, setStreamingSection] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [tocVisible, setTocVisible] = useState(true);
  const scrollContainerRef = useRef(null);
  const commercialScrollRef = useRef(null);
  const starsInsightScrollRef = useRef(null);
  const [expandedSections, setExpandedSections] = useState({
    clusters: true,
    commercial: true,
    stars: true,
    starsInsight: true,
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const processSSEStream = useCallback(async (response) => {
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
        let rawData = '';

        const eventMatch = part.match(/^event: (.*)$/m);
        if (eventMatch) event = eventMatch[1];

        const dataMatch = part.match(/^data: (.*)$/m);
        if (dataMatch) rawData = dataMatch[1];

        if (!rawData) continue;

        try {
          const parsed = JSON.parse(rawData);

          if (event === 'base_data') {
            setData(parsed);
          } else if (event === 'commercial_start') {
            setStreamingSection('commercial');
            setCommercialInsight('');
          } else if (event === 'commercial_chunk') {
            setCommercialInsight(prev => prev + parsed.content);
          } else if (event === 'commercial_done') {
            setCommercialInsight(parsed.content || '分析暂不可用');
          } else if (event === 'rising_stars_start') {
            setStreamingSection('rising_stars');
            setRisingStarsInsight('');
          } else if (event === 'rising_stars_chunk') {
            setRisingStarsInsight(prev => prev + parsed.content);
          } else if (event === 'rising_stars_done') {
            setRisingStarsInsight(parsed.content || '分析暂不可用');
          } else if (event === 'hotspot_all_done') {
            setStreamingSection(null);
          }
        } catch (e) {
          console.warn('SSE 解析错误:', e);
        }
      }
    }
    setStreamingSection(null);
  }, []);

  const runAnalysis = useCallback(async () => {
    setLoading(true);
    setError(null);
    setData(null);
    setCommercialInsight('');
    setRisingStarsInsight('');

    try {
      const t = Date.now();
      const res = await fetch(`/api/ascend/hotspots?stream=1&t=${t}${requestParams}`);

      if (!res.ok) {
        throw new Error(`商业热点分析请求失败: ${res.status}`);
      }

      await processSSEStream(res);
    } catch (e) {
      console.error('商业热点分析错误:', e);
      setError(e.message || '分析失败');
    } finally {
      setLoading(false);
    }
  }, [requestParams, processSSEStream]);

  const hotspots = data?.hotspots;
  const risingStars = data?.rising_stars;

  // ✅ 使用 ascend- 前缀，避免与华为面板 ID 全局冲突（Ant Design Tabs 将所有 tab 保留在 DOM）
  const commercialHeadingItems = useMemo(
    () => extractMarkdownHeadings(commercialInsight, 'ascend-commercial-sub'),
    [commercialInsight]
  );

  const starsHeadingItems = useMemo(
    () => extractMarkdownHeadings(risingStarsInsight, 'ascend-stars-insight-sub'),
    [risingStarsInsight]
  );

  const commercialHeadingTree = useMemo(
    () => buildHeadingTree(commercialHeadingItems, ['商业变现雷达', '商业热点雷达']),
    [commercialHeadingItems]
  );

  const starsHeadingTree = useMemo(
    () => buildHeadingTree(starsHeadingItems, ['新星培育分析', '新星培育策略', '潜力培育分析']),
    [starsHeadingItems]
  );

  // ✅ section 顶级 ID 也使用 ascend- 前缀
  const tocSections = useMemo(() => [
    { id: 'ascend-clusters', label: '精英与语义聚类' },
    {
      id: 'ascend-commercial',
      label: '商业变现雷达',
    },
    { id: 'ascend-stars', label: '潜力新星推荐' },
    {
      id: 'ascend-stars-insight',
      label: '新星培育分析',
    },
  ], []);

  const showToc = !!(data || commercialInsight || risingStarsInsight);

  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-slate-100 shadow-[0_20px_60px_-20px_rgba(15,23,42,0.25)] p-6">
      <div className="flex items-start gap-4">
        {showToc && (
          <AnalysisTOC
            sections={tocSections}
            scrollContainerRef={scrollContainerRef}
            visible={tocVisible}
            onToggle={() => setTocVisible(v => !v)}
          />
        )}

        <div
          ref={scrollContainerRef}
          className="flex-1 min-w-0 overflow-y-auto"
          style={{ maxHeight: 'calc(100vh - 180px)', scrollPaddingTop: '8px' }}
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl">
                <Gem className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">商业热点挖掘</h2>
                <p className="text-sm text-slate-500">精英用户语义聚类 · 商业变现雷达 · 潜力新星预测</p>
              </div>
            </div>

            <button
              onClick={runAnalysis}
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white hover:from-amber-600 hover:to-orange-700 transition-all flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-amber-500/20"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  挖掘中...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  开始挖掘
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700">
              <div className="font-semibold">分析失败</div>
              <div className="text-sm mt-1">{error}</div>
              <div className="text-xs mt-2 text-rose-600">
                提示：请确认 Python 分析服务已启动 (uvicorn app:app --port 8008)
              </div>
            </div>
          )}

          {!data && !loading && !error && (
            <div className="text-center py-12 text-slate-400">
              <Gem className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>点击"开始挖掘"发掘商业热点</p>
              <p className="text-sm mt-2">将通过语义聚类分析核心用户群体的深层需求，并用 AI 提炼商业机会</p>
            </div>
          )}

          {(data || commercialInsight) && (
            <div className="space-y-6">
              {hotspots?.clusters?.length > 0 && (
                <div id="ascend-clusters" className="border border-slate-100 rounded-2xl overflow-hidden bg-white scroll-mt-4">
                  <button
                    onClick={() => toggleSection('clusters')}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-amber-50 to-orange-50 hover:from-amber-100 hover:to-orange-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Target className="w-5 h-5 text-amber-600" />
                      <span className="font-semibold text-slate-800">精英用户语义热点簇</span>
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                        {hotspots.elite_count} 位精英 · {hotspots.clusters.length} 个语义簇
                      </span>
                    </div>
                    {expandedSections.clusters ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>

                  {expandedSections.clusters && (
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      {hotspots.clusters.map((cluster, idx) => (
                        <div key={idx} className="p-4 bg-gradient-to-br from-amber-50/50 to-orange-50/50 rounded-2xl border border-amber-100 hover:shadow-md transition-shadow">
                          <div className="flex items-center gap-2 mb-3">
                            <span className="w-8 h-8 flex items-center justify-center bg-gradient-to-br from-amber-400 to-orange-500 text-white rounded-full text-xs font-bold">
                              {idx + 1}
                            </span>
                            <div>
                              <div className="font-semibold text-slate-800">语义簇 #{cluster.cluster_id + 1}</div>
                              <div className="text-xs text-slate-500">{cluster.member_count} 位用户</div>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {cluster.keywords?.map((kw, i) => (
                              <span key={i} className="px-2 py-0.5 text-xs bg-white border border-amber-200 rounded-full text-amber-700 font-medium">
                                {kw}
                              </span>
                            ))}
                          </div>

                          {cluster.sample_snippets?.length > 0 && (
                            <div className="text-xs text-slate-500 space-y-1.5 mt-2 border-t border-amber-100 pt-2">
                              {cluster.sample_snippets.slice(0, 3).map((s, i) => (
                                <div key={i} className="flex gap-1.5 items-start cursor-pointer hover:bg-amber-100/50 p-2 -mx-2 rounded-lg transition-all group" onClick={() => setSelectedUser(s.user)}>
                                  <MessageSquare className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                  <span>
                                    <span className="font-medium text-slate-600 group-hover:text-amber-700 transition-colors">{s.user}:</span>{' '}
                                    <span className="group-hover:text-slate-700 transition-colors">{s.snippet}</span>
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div id="ascend-commercial" className="border border-slate-100 rounded-2xl overflow-hidden bg-white scroll-mt-4">
                <button
                  onClick={() => toggleSection('commercial')}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-orange-50 to-rose-50 hover:from-orange-100 hover:to-rose-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-orange-600" />
                    <span className="font-semibold text-slate-800">商业变现雷达</span>
                  </div>
                  {expandedSections.commercial ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>

                {expandedSections.commercial && (
                  <div className="flex items-start h-[500px] border-t border-slate-100 bg-gradient-to-br from-orange-50/20 to-rose-50/20">
                    <div 
                      ref={commercialScrollRef}
                      className="flex-1 h-full overflow-y-auto p-6 scroll-smooth"
                    >
                      {commercialInsight && commercialInsight !== '分析暂不可用' ? (
                        <>
                          <EnhancedMarkdown
                            markdown={commercialInsight}
                            className="prose-lg text-slate-700"
                            headingAnchorIds={commercialHeadingItems.map((item) => item.id)}
                          />
                          {streamingSection === 'commercial' && <span className="inline-block w-2 h-5 bg-orange-500 animate-pulse ml-0.5 align-middle" />}
                        </>
                      ) : streamingSection === 'commercial' ? (
                        <div className="flex items-center gap-2 text-orange-500 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> 正在生成商业洞察...</div>
                      ) : loading ? (
                        <div className="flex items-center gap-2 text-slate-400 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> 准备数据中（语义向量化）...</div>
                      ) : (
                        <div className="text-slate-400 text-sm">点击"开始挖掘"生成商业洞察</div>
                      )}
                    </div>
                    {commercialHeadingTree.length > 0 && (
                      <div className="w-56 h-full overflow-y-auto border-l border-orange-100 bg-white/50 p-4">
                        <AnalysisTOC
                          sections={commercialHeadingTree}
                          scrollContainerRef={commercialScrollRef}
                          visible={true}
                          isInner={true}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {risingStars?.length > 0 && (
                <div id="ascend-stars" className="border border-slate-100 rounded-2xl overflow-hidden bg-white scroll-mt-4">
                  <button
                    onClick={() => toggleSection('stars')}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-sky-50 to-indigo-50 hover:from-sky-100 hover:to-indigo-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Rocket className="w-5 h-5 text-sky-600" />
                      <span className="font-semibold text-slate-800">潜力新星推荐</span>
                      <span className="text-xs bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full">
                        {risingStars.length} 位候选
                      </span>
                    </div>
                    {expandedSections.stars ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>

                  {expandedSections.stars && (
                    <div className="p-4">
                      <div className="space-y-2">
                        {risingStars.map((star, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 hover:shadow-md transition-all cursor-pointer hover:border-indigo-300 group" onClick={() => setSelectedUser(star.user)}>
                            <div className="flex items-center gap-3 flex-1">
                              <span className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold ${idx < 3 ? 'bg-gradient-to-br from-sky-400 to-indigo-500 text-white' : 'bg-sky-100 text-sky-700'}`}>
                                {idx + 1}
                              </span>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-slate-800 truncate max-w-[160px] group-hover:text-indigo-600 transition-colors">{star.user}</span>
                                  {star.potential_score >= 0.4 && (
                                    <span className="flex items-center px-2 py-0.5 text-xs bg-sky-100 text-sky-700 rounded-full border border-sky-200">
                                      <Sparkles className="w-3 h-3 inline mr-1" />高潜力
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-slate-500">
                              <span title="与精英群体语义相似度">
                                相似度: <span className="font-medium text-sky-600">{(star.similarity_to_elite * 100).toFixed(1)}%</span>
                              </span>
                              <span title="当前影响力评分">
                                当前影响力: <span className="font-medium text-sky-600">{(star?.current_influence * 100).toFixed(1)}</span>
                              </span>
                              <span title="潜力评分">
                                潜力分: <span className="font-medium text-indigo-600">{(star.potential_score * 100).toFixed(1)}</span>
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {(risingStarsInsight || streamingSection === 'rising_stars') && (
                <div id="ascend-stars-insight" className="border border-slate-100 rounded-2xl overflow-hidden bg-white scroll-mt-4">
                  <button
                    onClick={() => toggleSection('starsInsight')}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-indigo-600" />
                      <span className="font-semibold text-slate-800">新星培育策略</span>
                    </div>
                    {expandedSections.starsInsight ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>

                  {expandedSections.starsInsight && (
                    <div className="flex items-start h-[500px] border-t border-slate-100 bg-gradient-to-br from-indigo-50/20 to-purple-50/20">
                      <div 
                        ref={starsInsightScrollRef}
                        className="flex-1 h-full overflow-y-auto p-6 scroll-smooth"
                      >
                        {risingStarsInsight && risingStarsInsight !== '分析暂不可用' ? (
                          <>
                            <EnhancedMarkdown
                              markdown={risingStarsInsight}
                              className="prose-lg text-slate-700"
                              headingAnchorIds={starsHeadingItems.map((item) => item.id)}
                            />
                            {streamingSection === 'rising_stars' && <span className="inline-block w-2 h-5 bg-indigo-500 animate-pulse ml-0.5 align-middle" />}
                          </>
                        ) : streamingSection === 'rising_stars' ? (
                          <div className="flex items-center gap-2 text-indigo-500 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> 正在生成新星培育分析...</div>
                        ) : (
                          <div className="text-slate-400 text-sm">等待分析完成...</div>
                        )}
                      </div>
                      {starsHeadingTree.length > 0 && (
                        <div className="w-56 h-full overflow-y-auto border-l border-indigo-100 bg-white/50 p-4">
                          <AnalysisTOC
                            sections={starsHeadingTree}
                            scrollContainerRef={starsInsightScrollRef}
                            visible={true}
                            isInner={true}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <AscendUserDetailModal
            open={!!selectedUser}
            userName={selectedUser}
            onClose={() => setSelectedUser(null)}
          />
        </div>
      </div>
    </div>
  );
}
