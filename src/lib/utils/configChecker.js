/**
 * 配置检查脚本
 * 验证所有必需的环境变量是否正确配置
 */

export function checkConfig() {
  const config = {
    llm: {
      apiKey: process.env.TREND_ANALYSIS_API_KEY,
      baseURL: process.env.TREND_ANALYSIS_BASE_URL,
      modelName: process.env.TREND_ANALYSIS_MODEL_NAME,
    },
    search: {
      tavily: process.env.TAVILY_API_KEY,
      bocha: process.env.BOCHA_API_KEY,
    },
    settings: {
      maxSearchResults: parseInt(process.env.MAX_SEARCH_RESULTS) || 10,
      maxReflections: parseInt(process.env.MAX_REFLECTIONS) || 2,
      searchTimeout: parseInt(process.env.SEARCH_TIMEOUT) || 30,
    }
  };

  const errors = [];
  const warnings = [];

  // 检查 LLM 配置
  if (!config.llm.apiKey) {
    errors.push('❌ TREND_ANALYSIS_API_KEY 未配置');
  }
  if (!config.llm.baseURL) {
    warnings.push('⚠️  TREND_ANALYSIS_BASE_URL 未配置，将使用默认值');
  }
  if (!config.llm.modelName) {
    warnings.push('⚠️  TREND_ANALYSIS_MODEL_NAME 未配置，将使用默认值');
  }

  // 检查搜索工具
  if (!config.search.tavily && !config.search.bocha) {
    errors.push('❌ 至少需要配置 TAVILY_API_KEY 或 BOCHA_API_KEY 中的一个');
  }
  if (!config.search.tavily) {
    warnings.push('⚠️  TAVILY_API_KEY 未配置，Tavily 搜索将不可用');
  }
  if (!config.search.bocha) {
    warnings.push('⚠️  BOCHA_API_KEY 未配置，Bocha 搜索将不可用');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    config
  };
}

export function printConfigStatus() {
  const result = checkConfig();

  console.log('\n=== 配置检查结果 ===\n');

  if (result.errors.length > 0) {
    console.log('错误：');
    result.errors.forEach(error => console.log(error));
    console.log('');
  }

  if (result.warnings.length > 0) {
    console.log('警告：');
    result.warnings.forEach(warning => console.log(warning));
    console.log('');
  }

  if (result.isValid) {
    console.log('✅ 配置检查通过！');
    console.log('\n当前配置：');
    console.log(`  LLM: ${result.config.llm.modelName || 'default'}`);
    console.log(`  搜索工具: ${result.config.search.tavily ? 'Tavily' : ''} ${result.config.search.bocha ? 'Bocha' : ''}`);
    console.log(`  最大搜索结果: ${result.config.settings.maxSearchResults}`);
    console.log(`  最大反思次数: ${result.config.settings.maxReflections}`);
  } else {
    console.log('❌ 配置检查失败，请修复上述错误');
  }

  console.log('\n==================\n');

  return result.isValid;
}

const configChecker = { checkConfig, printConfigStatus };
export default configChecker;
