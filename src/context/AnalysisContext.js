'use client';

import { createContext, useContext, useState, useCallback } from 'react';

/**
 * 全局分析状态 Context
 * 用于在页面切换时保持分析结果
 */
const AnalysisContext = createContext(null);

export function AnalysisProvider({ children }) {
  // AnalysisPanel 的分析数据
  const [analysisPanelData, setAnalysisPanelData] = useState(null);
  const [ascendAnalysisPanelData, setAscendAnalysisPanelData] = useState(null);

  // TrendAnalysis 的趋势分析数据
  const [trendAnalysisData, setTrendAnalysisData] = useState(null);
  const [trendReportContent, setTrendReportContent] = useState('');
  const [trendSearchQuery, setTrendSearchQuery] = useState('');
  const [trendLogs, setTrendLogs] = useState([]);

  // 昇腾 TrendAnalysis
  const [ascendTrendAnalysisData, setAscendTrendAnalysisData] = useState(null);
  const [ascendTrendReportContent, setAscendTrendReportContent] = useState('');
  const [ascendTrendSearchQuery, setAscendTrendSearchQuery] = useState('');
  const [ascendTrendLogs, setAscendTrendLogs] = useState([]);

  // BusinessInsightsPanel 的商业热点数据
  const [businessInsightsData, setBusinessInsightsData] = useState(null);
  const [commercialInsight, setCommercialInsight] = useState('');
  const [risingStarsInsight, setRisingStarsInsight] = useState('');

  // 昇腾 BusinessInsights
  const [ascendBusinessInsightsData, setAscendBusinessInsightsData] = useState(null);
  const [ascendCommercialInsight, setAscendCommercialInsight] = useState('');
  const [ascendRisingStarsInsight, setAscendRisingStarsInsight] = useState('');

  // 昇腾概览数据
  const [ascendOverviewData, setAscendOverviewData] = useState(null);

  // UserRankingBoard 的缓存数据 { 'huawei-50': { data, timestamp }, 'ascend-100': { data, timestamp } }
  const [rankingCache, setRankingCache] = useState({});

  // 获取缓存的排行数据
  const getCachedRanking = useCallback((topLimit, community = 'huawei') => {
    const cacheKey = `${community}-${topLimit}`;
    const cached = rankingCache[cacheKey];
    if (cached) {
      // 缓存有效期 5 分钟
      const isValid = Date.now() - cached.timestamp < 5 * 60 * 1000;
      if (isValid) {
        return cached.data;
      }
    }
    return null;
  }, [rankingCache]);

  // 设置排行数据缓存
  const setCachedRanking = useCallback((topLimit, data, community = 'huawei') => {
    const cacheKey = `${community}-${topLimit}`;
    setRankingCache(prev => ({
      ...prev,
      [cacheKey]: { data, timestamp: Date.now() }
    }));
  }, []);

  // 清除所有缓存
  const clearCache = useCallback(() => {
    setAnalysisPanelData(null);
    setAscendAnalysisPanelData(null);
    setTrendAnalysisData(null);
    setTrendReportContent('');
    setTrendSearchQuery('');
    setTrendLogs([]);
    setAscendTrendAnalysisData(null);
    setAscendTrendReportContent('');
    setAscendTrendSearchQuery('');
    setAscendTrendLogs([]);
    setBusinessInsightsData(null);
    setCommercialInsight('');
    setRisingStarsInsight('');
    setAscendBusinessInsightsData(null);
    setAscendCommercialInsight('');
    setAscendRisingStarsInsight('');
    setAscendOverviewData(null);
    setRankingCache({});
  }, []);

  const value = {
    // Huawei
    analysisPanelData,
    setAnalysisPanelData,
    trendAnalysisData,
    setTrendAnalysisData,
    trendReportContent,
    setTrendReportContent,
    trendSearchQuery,
    setTrendSearchQuery,
    trendLogs,
    setTrendLogs,
    businessInsightsData,
    setBusinessInsightsData,
    commercialInsight,
    setCommercialInsight,
    risingStarsInsight,
    setRisingStarsInsight,

    // Ascend
    ascendAnalysisPanelData,
    setAscendAnalysisPanelData,
    ascendTrendAnalysisData,
    setAscendTrendAnalysisData,
    ascendTrendReportContent,
    setAscendTrendReportContent,
    ascendTrendSearchQuery,
    setAscendTrendSearchQuery,
    ascendTrendLogs,
    setAscendTrendLogs,
    ascendBusinessInsightsData,
    setAscendBusinessInsightsData,
    ascendCommercialInsight,
    setAscendCommercialInsight,
    ascendRisingStarsInsight,
    setAscendRisingStarsInsight,
    ascendOverviewData,
    setAscendOverviewData,

    // UserRankingBoard
    rankingCache,
    getCachedRanking,
    setCachedRanking,

    // 通用
    clearCache,
  };

  return (
    <AnalysisContext.Provider value={value}>
      {children}
    </AnalysisContext.Provider>
  );
}

export function useAnalysisContext() {
  const context = useContext(AnalysisContext);
  if (!context) {
    throw new Error('useAnalysisContext 必须在 AnalysisProvider 内部使用');
  }
  return context;
}

export default AnalysisContext;
