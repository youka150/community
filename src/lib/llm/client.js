/**
 * LLM客户端 - 统一的大语言模型调用接口
 * 支持多种OpenAI兼容的API（Kimi、DeepSeek、Gemini等）
 */
export default class LLMClient {
  constructor(config = {}) {
    this.apiKey = config.apiKey;
    this.baseURL = config.baseURL;
    this.modelName = config.modelName;
    this.maxRetries = config.maxRetries || 3;
    this.timeout = config.timeout || 60000; // 60秒

    if (!this.apiKey || !this.baseURL || !this.modelName) {
      throw new Error(`LLMClient configuration is incomplete for model: ${this.modelName}`);
    }
  }

  /**
   * 兼容 chat 方法调用
   */
  async chat(options = {}) {
    const { systemPrompt, userPrompt, temperature, maxTokens, json } = options;
    return this.generate(systemPrompt, userPrompt, { temperature, maxTokens, json });
  }

  async generate(systemPrompt, userPrompt, options = {}) {
    const { json = false, temperature = 0.7, maxTokens = 4096 } = options;

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

    if (json) {
      requestBody.response_format = { type: 'json_object' };
    }

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
          signal: AbortSignal.timeout(this.timeout)
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`LLM API Error (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        const content = data.choices[0]?.message?.content;

        if (!content) {
          throw new Error('LLM response content is empty.');
        }

        return content;

      } catch (error) {
        lastError = error;
        console.error(`LLM call failed (attempt ${attempt + 1}/${this.maxRetries}):`, error.message);
        if (attempt < this.maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
    }

    throw new Error(`LLM call failed after ${this.maxRetries} retries: ${lastError?.message || 'Unknown error'}`);
  }
}

/**
 * @param {'TREND_ANALYSIS' | 'USER_MODELING' | 'LEADERBOARD'} agentType
 * @returns {LLMClient}
 */
export function createLLMClient(agentType) {
  const apiKey = process.env[`${agentType}_API_KEY`] || process.env.TREND_ANALYSIS_API_KEY;
  const baseURL = process.env[`${agentType}_BASE_URL`] || process.env.TREND_ANALYSIS_BASE_URL;
  const modelName = process.env[`${agentType}_MODEL_NAME`] || process.env.TREND_ANALYSIS_MODEL_NAME;

  return new LLMClient({
    apiKey,
    baseURL,
    modelName,
  });
}
