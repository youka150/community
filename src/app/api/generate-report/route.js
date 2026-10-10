/**
 * 生成报告API端点
 * POST /api/generate-report
 */

import { NextResponse } from 'next/server';
import LLMClient from '@/lib/llm/client.js';
import { SYSTEM_PROMPT_FINAL_REPORT, buildUserPrompt } from '@/lib/prompts/trendAnalysis.js';

export const runtime = 'nodejs';
export const maxDuration = 120; // 2分钟超时

export async function POST(request) {
  try {
    const { query, analysisData } = await request.json();

    // 验证输入
    if (!query || !analysisData) {
      return NextResponse.json(
        { success: false, error: '缺少必要的参数' },
        { status: 400 }
      );
    }

    // 创建LLM客户端
    const llmClient = new LLMClient({
      apiKey: process.env.TREND_ANALYSIS_API_KEY,
      baseURL: process.env.TREND_ANALYSIS_BASE_URL,
      modelName: process.env.TREND_ANALYSIS_MODEL_NAME,
    });

    // 生成完整报告
    console.log('📝 开始生成完整报告...');
    
    const response = await llmClient.chat({
      systemPrompt: SYSTEM_PROMPT_FINAL_REPORT,
      userPrompt: buildUserPrompt({
        query: query,
        hot_topics: analysisData.hotTopics || [],
        sentiment: analysisData.sentiment || {},
        dimensions: analysisData.dimensions || [],
        report: analysisData.report || {}
      }),
      temperature: 0.7,
      maxTokens: 4096
    });

    // 生成Markdown报告
    const report = generateMarkdownReport(query, analysisData, response);

    console.log('✅ 报告生成完成');

    return NextResponse.json({
      success: true,
      report: report,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('报告生成失败:', error);
    return NextResponse.json(
      { success: false, error: error.message || '报告生成失败' },
      { status: 500 }
    );
  }
}

/**
 * 生成Markdown格式的完整报告
 */
function generateMarkdownReport(query, analysisData, llmResponse) {
  const { hotTopics, sentiment, dimensions, report } = analysisData;
  const timestamp = new Date().toLocaleString('zh-CN');

  let markdown = `# 趋势分析报告

**主题:** ${query}  
**生成时间:** ${timestamp}

---

## 📊 执行摘要

${report?.summary || '本次分析对主题进行了全面深入的研究，从多个维度识别热点话题、分析情感倾向和用户观点。'}

### 关键指标

- **热点话题数:** ${hotTopics?.length || 0}
- **分析维度数:** ${dimensions?.length || 0}
- **总体情感:** ${sentiment?.overall_sentiment === 'positive' ? '积极' : sentiment?.overall_sentiment === 'negative' ? '消极' : '中性'} (${sentiment?.sentiment_score ? Math.round(sentiment.sentiment_score * 100) : 50}%)
- **总讨论量:** ${hotTopics?.reduce((sum, topic) => sum + (topic.mentions || 0), 0) || 0}

---

## 🔥 热点话题排行

`;

  if (hotTopics && hotTopics.length > 0) {
    hotTopics.forEach((topic, index) => {
      markdown += `
### ${index + 1}. ${topic.topic}

${topic.description || ''}

- **讨论量:** ${topic.mentions?.toLocaleString() || 'N/A'}
- **情感得分:** ${topic.sentiment !== undefined ? (topic.sentiment * 100).toFixed(0) + '%' : 'N/A'}
- **趋势:** ${topic.trend === 'up' ? '上升 ↗' : topic.trend === 'down' ? '下降 ↘' : '平稳 →'}
${topic.category ? `- **分类:** ${topic.category}` : ''}

`;
    });
  } else {
    markdown += '\n暂无热点话题数据\n';
  }

  markdown += `
---

## 📈 多维度深度分析

`;

  if (dimensions && dimensions.length > 0) {
    dimensions.forEach((dim, index) => {
      markdown += `
### ${index + 1}. ${dim.dimension}

${dim.description || ''}

#### 分析摘要

${dim.analysis?.summary || '暂无摘要'}

`;

      if (dim.analysis?.key_points && dim.analysis.key_points.length > 0) {
        markdown += `
#### 关键发现

`;
        dim.analysis.key_points.forEach(point => {
          markdown += `- ${point}\n`;
        });
      }

      if (dim.analysis?.sentiment) {
        markdown += `
#### 情感分析

- **总体倾向:** ${dim.analysis.sentiment.overall === 'positive' ? '积极' : dim.analysis.sentiment.overall === 'negative' ? '消极' : '中性'}
- **情感得分:** ${dim.analysis.sentiment.score !== undefined ? Math.round(dim.analysis.sentiment.score * 100) + '%' : 'N/A'}
${dim.analysis.sentiment.description ? `- **详细说明:** ${dim.analysis.sentiment.description}` : ''}

`;
      }

      if (dim.analysis?.trends && dim.analysis.trends.length > 0) {
        markdown += `
#### 趋势观察

`;
        dim.analysis.trends.forEach(trend => {
          markdown += `- ${trend}\n`;
        });
      }

      if (dim.analysis?.insights) {
        markdown += `
#### 深度洞察

${dim.analysis.insights}

`;
      }

      markdown += '\n---\n';
    });
  } else {
    markdown += '\n暂无维度分析数据\n\n---\n';
  }

  markdown += `
## 😊 情感分析总结

`;

  if (sentiment && sentiment.overall_sentiment) {
    markdown += `
### 总体情感倾向

- **情感分类:** ${sentiment.overall_sentiment === 'positive' ? '积极 ✅' : sentiment.overall_sentiment === 'negative' ? '消极 ❌' : '中性 ⚖️'}
- **情感得分:** ${sentiment.sentiment_score ? Math.round(sentiment.sentiment_score * 100) + '%' : 'N/A'}
- **趋势:** ${sentiment.trend === 'improving' ? '改善中' : sentiment.trend === 'declining' ? '下降中' : '保持稳定'}

`;

    if (sentiment.sentiment_distribution) {
      markdown += `
### 情感分布

- **正面:** ${sentiment.sentiment_distribution.positive || 0}%
- **中性:** ${sentiment.sentiment_distribution.neutral || 0}%
- **负面:** ${sentiment.sentiment_distribution.negative || 0}%

`;
    }

    if (sentiment.emotion_categories && sentiment.emotion_categories.length > 0) {
      markdown += `
### 主要情绪类别

${sentiment.emotion_categories.map(e => `- ${e}`).join('\n')}

`;
    }

    if (sentiment.analysis) {
      markdown += `
### 详细分析

${sentiment.analysis}

`;
    }
  } else {
    markdown += '\n暂无情感分析数据\n';
  }

  markdown += `
---

## 🎯 综合洞察与建议

${llmResponse || '基于以上分析，建议关注热点话题的发展趋势，积极响应用户关注的问题，并持续监测情感变化。'}

---

## 📝 报告说明

本报告由AI趋势分析系统自动生成，基于多源数据搜索、多维度分析和深度学习模型。报告内容仅供参考，具体决策请结合实际情况。

**生成引擎:** BettaFish-inspired Trend Analysis Agent  
**分析时间:** ${timestamp}  
**数据来源:** 社区讨论、用户反馈、热点话题等多源数据

---

*本报告结束*
`;

  return markdown;
}
