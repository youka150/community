/**
 * LLM客户端 - 统一的大语言模型调用接口
 * 支持多种OpenAI兼容的API（Kimi、DeepSeek、Gemini等）
 */

import { en } from "zod/v4/locales";

class LLMClient {
  constructor(config = {}) {
    this.apiKey = config.apiKey || process.env.TREND_ANALYSIS_API_KEY;
    this.baseURL = config.baseURL || process.env.TREND_ANALYSIS_BASE_URL;
    this.modelName = config.modelName || process.env.TREND_ANALYSIS_MODEL_NAME;
    this.maxRetries = config.maxRetries || 4;
    this.timeout = config.timeout || 180000; // 180秒
  }

  /**
   * 调用LLM生成内容
   * @param {Object} params - 请求参数
   * @param {string} params.systemPrompt - 系统提示词
   * @param {string} params.userPrompt - 用户提示词
   * @param {Object} params.responseFormat - 响应格式（可选，用于JSON模式）
   * @param {number} params.temperature - 温度参数（默认0.7）
   * @param {number} params.maxTokens - 最大token数
   * @returns {Promise<Object>} LLM响应
   */
  async chat({ systemPrompt, userPrompt, responseFormat = null, temperature = 0.7, maxTokens = 4096 }) {
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    const requestBody = {
      model: this.modelName,
      messages,
      temperature,
      max_tokens: maxTokens,
    };

    // 如果指定了响应格式（JSON模式）
    if (responseFormat) {
      requestBody.response_format = responseFormat;
    }

    let lastError = null;
    
    // 重试机制
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const response = await fetch(`${this.baseURL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(this.timeout)
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`LLM API错误 (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        const content = data.choices[0]?.message?.content;

        if (!content) {
          throw new Error('LLM返回内容为空');
        }

        // 如果期望JSON响应，尝试解析
        if (responseFormat?.type === 'json_object') {
          try {
            return JSON.parse(content);
          } catch (parseError) {
            console.warn('JSON解析失败，返回原始内容:', parseError);
            // 尝试提取JSON
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              return JSON.parse(jsonMatch[0]);
            }
            throw new Error(`无法解析JSON响应: ${content}`);
          }
        }

        return { content };

      } catch (error) {
        lastError = error;
        console.error(`LLM调用失败 (尝试 ${attempt + 1}/${this.maxRetries}):`, error.message);
        
        // 如果不是最后一次尝试，等待后重试
        if (attempt < this.maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
    }

    throw new Error(`LLM调用失败，已重试${this.maxRetries}次: ${lastError?.message || '未知错误'}`);
  }

  /**
   * 流式调用LLM生成内容（用于 Markdown 文本类输出）
   * @param {Object} params
   * @returns {AsyncGenerator<string>} 逐 token yield 文本内容
   */
  async *chatStream({ systemPrompt, userPrompt, temperature = 0.7, maxTokens = 4096 }) {
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    const requestBody = {
      model: this.modelName,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: true
    };

    let lastError = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const response = await fetch(`${this.baseURL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(this.timeout * 2) // 流式需要更长超时
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`LLM API错误 (${response.status}): ${errorText}`);
        }

        const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
        let buffer = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += value;
          const lines = buffer.split('\n');
          buffer = lines.pop(); // 保留最后一行（可能不完整）

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;

            const dataStr = trimmed.slice(6);
            if (dataStr === '[DONE]') return;

            try {
              const chunk = JSON.parse(dataStr);
              const content = chunk.choices?.[0]?.delta?.content;
              if (content) {
                yield content;
              }
            } catch {
              // 忽略解析失败的行
            }
          }
        }
        return; // 成功完成，退出重试

      } catch (error) {
        lastError = error;
        console.error(`LLM流式调用失败 (尝试 ${attempt + 1}/${this.maxRetries}):`, error.message);
        if (attempt < this.maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
    }

    throw new Error(`LLM流式调用失败，已重试${this.maxRetries}次: ${lastError?.message || '未知错误'}`);
  }

  /**
   * 获取模型信息
   */
  getModelInfo() {
    return {
      modelName: this.modelName,
      baseURL: this.baseURL
    };
  }
}

export default LLMClient;
