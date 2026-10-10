/**
 * 搜索工具集成 - Tavily和Bocha API
 * 提供统一的搜索接口
 */

/**
 * Tavily搜索客户端
 */
export class TavilySearchClient {
  constructor(apiKey = process.env.TAVILY_API_KEY) {
    if (!apiKey) {
      throw new Error('TAVILY_API_KEY未配置');
    }
    this.apiKey = apiKey;
    this.baseURL = 'https://api.tavily.com';
  }

  /**
   * 基础新闻搜索
   */
  async basicSearchNews(query, maxResults = 7) {
    return await this._search({
      query,
      max_results: maxResults,
      search_depth: 'basic',
      include_answer: false,
      topic: 'general'
    });
  }

  /**
   * 深度新闻分析
   */
  async deepSearchNews(query) {
    return await this._search({
      query,
      search_depth: 'advanced',
      max_results: 20,
      include_answer: true,
      topic: 'general'
    });
  }

  /**
   * 搜索过去24小时的新闻
   */
  async searchNewsLast24Hours(query, maxResults = 10) {
    return await this._search({
      query,
      max_results: maxResults,
      days: 1,
      topic: 'general'
    });
  }

  /**
   * 搜索过去一周的新闻
   */
  async searchNewsLastWeek(query, maxResults = 15) {
    return await this._search({
      query,
      max_results: maxResults,
      days: 7,
      topic: 'general'
    });
  }

  /**
   * 按日期范围搜索
   */
  async searchNewsByDate(query, startDate, endDate, maxResults = 15) {
    // 计算天数差
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

    return await this._search({
      query,
      max_results: maxResults,
      days: Math.max(1, days),
      topic: 'general'
    });
  }

  /**
   * 内部搜索方法
   */
  async _search(params) {
    try {
      const response = await fetch(`${this.baseURL}/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(params)
      });

      if (!response.ok) {
        throw new Error(`Tavily搜索失败: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        query: data.query,
        answer: data.answer || null,
        results: (data.results || []).map(item => ({
          title: item.title,
          url: item.url,
          content: item.content,
          score: item.score,
          publishedDate: item.published_date
        })),
        images: (data.images || []).map(item => ({
          url: item.url,
          description: item.description
        }))
      };
    } catch (error) {
      console.error('Tavily搜索错误:', error);
      throw error;
    }
  }
}

/**
 * Bocha搜索客户端（多模态）
 */
export class BochaSearchClient {
  constructor(apiKey = process.env.BOCHA_API_KEY, baseURL = process.env.BOCHA_BASE_URL) {
    if (!apiKey) {
      throw new Error('BOCHA_API_KEY未配置');
    }
    this.apiKey = apiKey;
    this.baseURL = baseURL || 'https://api.bochaai.com/v1/web-search';
  }

  /**
   * 综合搜索（网页+AI总结）
   */
  async comprehensiveSearch(query, maxResults = 10) {
    return await this._search({
      query,
      freshness: 'noLimit',
      summary: true,
      count: maxResults
    });
  }

  /**
   * 搜索过去24小时
   */
  async searchLast24Hours(query, maxResults = 10) {
    return await this._search({
      query,
      freshness: 'oneDay',
      summary: true,
      count: maxResults
    });
  }

  /**
   * 搜索过去一周
   */
  async searchLastWeek(query, maxResults = 10) {
    return await this._search({
      query,
      freshness: 'oneWeek',
      summary: true,
      count: maxResults
    });
  }

  /**
   * 纯网页搜索（无AI总结）
   */
  async webSearchOnly(query, maxResults = 10) {
    return await this._search({
      query,
      freshness: 'noLimit',
      summary: false,
      count: maxResults
    });
  }

  /**
   * 内部搜索方法
   */
  async _search(params) {
    try {
      const response = await fetch(this.baseURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': '*/*'
        },
        body: JSON.stringify(params)
      });

      if (!response.ok) {
        throw new Error(`Bocha搜索失败: ${response.status}`);
      }

      const data = await response.json();
      
      // 解析Bocha的响应结构
      const result = {
        query: params.query,
        answer: null,
        results: [],
        images: [],
        followUps: []
      };

      // 解析网页搜索结果
      if (data.data?.webPages?.value) {
        result.results = data.data.webPages.value.map(item => ({
          title: item.name || '',
          url: item.url || '',
          content: item.snippet || '',
          displayUrl: item.displayUrl || '',
          dateCrawled: item.dateLastCrawled || null,
          siteName: item.siteName || null,
          siteIcon: item.siteIcon || null,
          isFamilyFriendly: item.isFamilyFriendly || null,
          isNavigational: item.isNavigational || null
        }));
      }

      // 解析图片结果
      if (data.data?.images?.value) {
        result.images = data.data.images.value.map(item => ({
          url: item.contentUrl || '',
          title: item.name || '',
          thumbnailUrl: item.thumbnailUrl || '',
          hostPageUrl: item.hostPageUrl || '',
          contentSize: item.contentSize || null,
          imageId: item.imageId || null,
          accentColor: item.accentColor || null
        }));
      }

      // 如果有queryContext中的原始查询信息
      if (data.data?.queryContext?.originalQuery) {
        result.originalQuery = data.data.queryContext.originalQuery;
      }

      return result;
    } catch (error) {
      console.error('Bocha搜索错误:', error);
      throw error;
    }
  }
}

/**
 * 统一的搜索工具管理器
 */
export class SearchToolkit {
  constructor() {
    this.tavilyClient = null;
    this.bochaClient = null;

    // 初始化可用的客户端
    try {
      this.tavilyClient = new TavilySearchClient();
      console.log('Tavily搜索客户端已初始化');
    } catch (error) {
      console.warn('Tavily客户端初始化失败:', error.message);
    }

    try {
      this.bochaClient = new BochaSearchClient();
      console.log('Bocha搜索客户端已初始化');
    } catch (error) {
      console.warn('Bocha客户端初始化失败:', error.message);
    }

    if (!this.tavilyClient && !this.bochaClient) {
      throw new Error('没有可用的搜索工具，请配置TAVILY_API_KEY或BOCHA_API_KEY');
    }
  }

  /**
   * 执行搜索（自动选择可用工具）
   */
  async search(query, options = {}) {
    const {
      tool = 'tavily', // 'tavily', 'bocha', 'auto'
      depth = 'basic', // 'basic', 'deep'
      timeRange = 'noLimit', // 'all', '24h', 'week', 'noLimit'
      startDate = null,
      endDate = null,
      maxResults = 10
    } = options;

    // 自动选择工具
    let selectedTool = tool;
    if (tool === 'auto') {
      selectedTool = this.tavilyClient ? 'tavily' : 'bocha';
    }

    // 根据工具和参数执行搜索
    if (selectedTool === 'tavily' && this.tavilyClient) {
      return await this._searchWithTavily(query, { depth, timeRange, startDate, endDate, maxResults });
    } else if (selectedTool === 'bocha' && this.bochaClient) {
      return await this._searchWithBocha(query, { timeRange, maxResults });
    } else {
      throw new Error(`搜索工具 ${selectedTool} 不可用`);
    }
  }

  async _searchWithTavily(query, options) {
    const { depth, timeRange, startDate, endDate, maxResults } = options;

    if (depth === 'deep') {
      return await this.tavilyClient.deepSearchNews(query);
    } else if (timeRange === '24h') {
      return await this.tavilyClient.searchNewsLast24Hours(query, maxResults);
    } else if (timeRange === 'week') {
      return await this.tavilyClient.searchNewsLastWeek(query, maxResults);
    } else if (timeRange === 'custom' && startDate && endDate) {
      return await this.tavilyClient.searchNewsByDate(query, startDate, endDate, maxResults);
    } else {
      return await this.tavilyClient.basicSearchNews(query, maxResults);
    }
  }

  async _searchWithBocha(query, options) {
    const { timeRange, maxResults } = options;
    console.log('使用Bocha搜索，时间范围:', timeRange);

    if (timeRange === '24h') {
      return await this.bochaClient.searchLast24Hours(query, maxResults);
    } else if (timeRange === 'week') {
      return await this.bochaClient.searchLastWeek(query, maxResults);
    } else {
      return await this.bochaClient.comprehensiveSearch(query, maxResults);
    }
  }

  /**
   * 获取可用工具列表
   */
  getAvailableTools() {
    return {
      tavily: !!this.tavilyClient,
      bocha: !!this.bochaClient
    };
  }
}

export default SearchToolkit;
