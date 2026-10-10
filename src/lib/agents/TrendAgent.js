/**
 * 趋势分析Agent
 * 实现完整的创意社区趋势分析流程
 * 借鉴BettaFish的多步推理和反思机制
 */

import LLMClient from '../llm/clientForTrend.js'
import SearchToolkit from '../tools/search.js';
import {
  SYSTEM_PROMPT_ANALYSIS_STRUCTURE,
  SYSTEM_PROMPT_SEARCH_STRATEGY,
  SYSTEM_PROMPT_CONTENT_ANALYSIS,
  SYSTEM_PROMPT_REFLECTION,
  SYSTEM_PROMPT_EXTRACT_HOT_TOPICS,
  SYSTEM_PROMPT_SENTIMENT_ANALYSIS,
  SYSTEM_PROMPT_FINAL_REPORT,
  buildUserPrompt
} from '../prompts/trendAnalysis.js';

class TrendAnalysisAgent {
  constructor(config = {}) {
    this.llmClient = new LLMClient(config.llm);
    this.searchToolkit = new SearchToolkit();
    this.maxReflections = config.maxReflections || 2;
    this.maxSearchResults = config.maxSearchResults || 10;

    // 日志回调
    this.onLog = typeof config.onLog === 'function' ? config.onLog : null;

    this.state = {
      query: '',
      dimensions: [],
      analysisResults: [],
      hotTopics: [],
      sentimentData: [],
      finalReport: null
    };
  }

  // 统一的日志记录方法
  _log(type, message, data = null) {
    if (this.onLog) {
      this.onLog(type, message, data);
    } else {
      // 默认行为
      const logFunc = type === 'error' ? console.error : console.log;
      if (data) {
        logFunc(message, data);
      } else {
        logFunc(message);
      }
    }
  }

  /**
   * 执行完整的趋势分析
   */
  async analyze(query) {
    this._log('info', `🚀 开始趋势分析: ${query}`);
    this.state.query = query;

    try {
      // 步骤1: 生成分析结构
      await this._generateAnalysisStructure();

      // 步骤2: 对每个维度进行分析
      for (let i = 0; i < this.state.dimensions.length; i++) {
        await this._analyzeDimension(i);
      }

      // 步骤3: 提取热点话题
      await this._extractHotTopics();

      // 步骤4: 情感分析
      await this._performSentimentAnalysis();

      // 步骤5: 生成最终报告
      await this._generateFinalReport();

      return {
        success: true,
        data: {
          hotTopics: this.state.hotTopics,
          sentiment: this.state.sentimentData,
          dimensions: this.state.analysisResults,
          report: this.state.finalReport
        }
      };
    } catch (error) {
      this._log('error', `❌ 趋势分析失败: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 步骤1: 生成分析结构
   */
  async _generateAnalysisStructure() {
    this._log('info', '📋 生成分析结构...');

    const response = await this.llmClient.chat({
      systemPrompt: SYSTEM_PROMPT_ANALYSIS_STRUCTURE,
      userPrompt: `请为以下主题规划分析结构：\n\n${this.state.query}`,
      responseFormat: { type: 'json_object' },
      temperature: 0.7
    });

    this.state.dimensions = response.dimensions || [];
    this._log('info', `✅ 生成了 ${this.state.dimensions.length} 个分析维度`);
  }

  /**
   * 步骤2: 分析单个维度
   */
  async _analyzeDimension(dimensionIndex) {
    const dimension = this.state.dimensions[dimensionIndex];
    this._log('info', `\n🔍 分析维度 ${dimensionIndex + 1}/${this.state.dimensions.length}: ${dimension.title}`);

    // 2.1 规划搜索策略
    const searchStrategy = await this._planSearchStrategy(dimension);

    // 2.2 执行初始搜索
    const searchResults = await this._executeSearch(searchStrategy);

    // 2.3 分析搜索结果
    let analysis = await this._analyzeSearchResults(dimension, searchResults);

    // 2.4 反思和补充（最多maxReflections次）
    for (let i = 0; i < this.maxReflections; i++) {
      const reflection = await this._reflect(dimension, analysis);

      if (!reflection.need_more_search || reflection.completeness_score > 0.85) {
        this._log('info', `✅ 维度分析完成（完整度: ${(reflection.completeness_score * 100).toFixed(1)}%）`);
        break;
      }

      this._log('info', `🔄 补充搜索 (第${i + 1}次)...`);
      const additionalResults = await this._executeSearch(reflection.suggested_search);
      analysis = await this._analyzeSearchResults(dimension, additionalResults, analysis);
    }

    this.state.analysisResults.push({
      dimension: dimension.title,
      description: dimension.description,
      analysis: analysis
    });
  }

  /**
   * 2.1 规划搜索策略
   */
  async _planSearchStrategy(dimension) {
    this._log('info', '  📝 规划搜索策略...');

    const response = await this.llmClient.chat({
      systemPrompt: SYSTEM_PROMPT_SEARCH_STRATEGY,
      userPrompt: buildUserPrompt({
        query: this.state.query,
        dimension: dimension
      }),
      responseFormat: { type: 'json_object' },
      temperature: 0.5
    });

    this._log('info', `  ✅ 策略: 使用 ${response.search_tool} 搜索 "${response.search_query}"`);
    return response;
  }

  /**
   * 2.2 执行搜索
   */
  async _executeSearch(strategy) {
    this._log('info', '  🌐 执行搜索...');

    const toolMap = {
      'basic_search': { depth: 'basic', timeRange: 'all' },
      'deep_search': { depth: 'deep', timeRange: 'all' },
      'search_last_24h': { depth: 'basic', timeRange: '24h' },
      'search_last_week': { depth: 'basic', timeRange: 'week' },
      'search_by_date': {
        depth: 'basic',
        timeRange: 'custom',
        startDate: strategy.start_date,
        endDate: strategy.end_date
      }
    };

    const options = {
      ...toolMap[strategy.search_tool],
      maxResults: this.maxSearchResults
    };

    try {
      this._log('info', `  🔎 使用工具: ${strategy.search_tool}`, options);
      const results = await this.searchToolkit.search(strategy.search_query, options);
      this._log('info', `  ✅ 找到 ${results.results?.length || results?.data?.webPages?.value?.length || 0} 条结果`);
      return results.data || results;
    } catch (error) {
      this._log('error', `  ❌ 搜索失败: ${error.message}`);
      return { results: [], answer: null };
    }
  }

  /**
   * 2.3 分析搜索结果
   */
  async _analyzeSearchResults(dimension, searchResults, previousAnalysis = null) {
    this._log('info', '  🧠 分析搜索结果...');

    const response = await this.llmClient.chat({
      systemPrompt: SYSTEM_PROMPT_CONTENT_ANALYSIS,
      userPrompt: buildUserPrompt({
        dimension: dimension,
        search_results: searchResults.results?.slice(0, 15) || [],
        ai_summary: searchResults.answer,
        previous_analysis: previousAnalysis
      }),
      responseFormat: { type: 'json_object' },
      temperature: 0.6,
      maxTokens: 4096
    });

    this._log('info', '  ✅ 分析完成');
    return response;
  }

  /**
   * 2.4 反思分析质量
   */
  async _reflect(dimension, currentAnalysis) {
    this._log('info', '  🤔 反思分析质量...');

    const response = await this.llmClient.chat({
      systemPrompt: SYSTEM_PROMPT_REFLECTION,
      userPrompt: buildUserPrompt({
        dimension: dimension,
        current_analysis: currentAnalysis
      }),
      responseFormat: { type: 'json_object' },
      temperature: 0.5
    });

    return response;
  }

  /**
   * 步骤3: 提取热点话题
   */
  async _extractHotTopics() {
    this._log('info', '\n🔥 提取热点话题...');

    // 合并所有维度的关键要点
    const allKeyPoints = this.state.analysisResults
      .flatMap(result => result.analysis.key_points || []);

    const response = await this.llmClient.chat({
      systemPrompt: SYSTEM_PROMPT_EXTRACT_HOT_TOPICS,
      userPrompt: buildUserPrompt({
        query: this.state.query,
        analysis_results: this.state.analysisResults,
        key_points: allKeyPoints
      }),
      responseFormat: { type: 'json_object' },
      temperature: 0.6
    });

    this.state.hotTopics = response.hot_topics || [];
    this._log('info', `✅ 识别了 ${this.state.hotTopics.length} 个热点话题`);
  }

  /**
   * 步骤4: 情感分析
   */
  async _performSentimentAnalysis() {
    this._log('info', '\n😊 执行情感分析...');

    // 合并所有维度的情感数据
    const allSentiments = this.state.analysisResults
      .map(result => result.analysis.sentiment)
      .filter(s => s);

    if (allSentiments.length === 0) {
      this.state.sentimentData = {
        overall_sentiment: 'neutral',
        sentiment_score: 0.5,
        sentiment_distribution: { positive: 33, negative: 33, neutral: 34 }
      };
      return;
    }

    const response = await this.llmClient.chat({
      systemPrompt: SYSTEM_PROMPT_SENTIMENT_ANALYSIS,
      userPrompt: buildUserPrompt({
        query: this.state.query,
        dimension_sentiments: allSentiments,
        analysis_results: this.state.analysisResults
      }),
      responseFormat: { type: 'json_object' },
      temperature: 0.5
    });

    this.state.sentimentData = response;
    this._log('info', `✅ 情感分析完成 (总体: ${response.overall_sentiment})`);
  }

  /**
   * 步骤5: 生成最终报告（流式输出）
   */
  async _generateFinalReport() {
    this._log('info', '\n📄 生成最终报告...');

    // 准备用于生成报告的完整上下文数据
    const reportContext = {
      query: this.state.query,
      dimensions: this.state.analysisResults,
      hotTopics: this.state.hotTopics,
      sentiment: this.state.sentimentData,
      generatedAt: new Date().toISOString()
    };

    // 使用流式调用LLM生成Markdown报告
    let fullContent = '';

    // 发送报告开始事件
    this._log('report_start', '开始生成分析报告...');

    try {
      for await (const token of this.llmClient.chatStream({
        systemPrompt: SYSTEM_PROMPT_FINAL_REPORT,
        userPrompt: buildUserPrompt(reportContext),
        temperature: 0.6,
        maxTokens: 4096
      })) {
        fullContent += token;
        // 通过 onLog 回调逐 token 发送到前端
        this._log('report_chunk', token);
      }
    } catch (error) {
      this._log('error', `报告流式生成失败，尝试非流式回退: ${error.message}`);
      // 回退到非流式调用
      const reportContent = await this.llmClient.chat({
        systemPrompt: SYSTEM_PROMPT_FINAL_REPORT,
        userPrompt: buildUserPrompt(reportContext),
        temperature: 0.6,
        maxTokens: 4096
      });
      fullContent = reportContent.content || '';
    }

    // 更新state
    this.state.finalReport = {
      ...reportContext,
      summary: this._generateSummary(),
      content: fullContent
    };

    this._log('info', '✅ 最终报告生成完成');
  }

  /**
   * 生成执行摘要
   */
  _generateSummary() {
    const topicCount = this.state.hotTopics.length;
    const sentiment = this.state.sentimentData.overall_sentiment;
    const dimensionCount = this.state.analysisResults.length;

    return `关于"${this.state.query}"的趋势分析发现了${topicCount}个热点话题，` +
      `从${dimensionCount}个维度进行了深度分析。` +
      `总体情感倾向为${sentiment === 'positive' ? '积极' : sentiment === 'negative' ? '消极' : '中性'}，` +
      `情感得分为${(this.state.sentimentData.sentiment_score * 100).toFixed(1)}%。`;
  }

  /**
   * 获取当前状态
   */
  getState() {
    return this.state;
  }
}

export default TrendAnalysisAgent;
