/**
 * 开发环境路由预加载脚本
 * 使用: node scripts/preload-dev-routes.js
 * 
 * 在启动开发服务器后运行此脚本，将预加载所有路由
 * 避免用户首次访问时的编译延迟
 */

const http = require('http');
const { URL } = require('url');

// 配置
const BASE_URL = 'http://localhost:3000';
const TIMEOUT = 60000; // 60秒超时

// 要预加载的路由
const ROUTES = [
  '/',
  '/trend-analysis',
  '/user-modeling',
  '/leaderboard',
  '/dashboard',
  '/analysis',
];

/**
 * 发送 HTTP 请求预加载路由
 */
function preloadRoute(route) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + route);
    
    const request = http.get(url, (response) => {
      let data = '';
      
      response.on('data', (chunk) => {
        data += chunk;
      });
      
      response.on('end', () => {
        resolve({
          route,
          status: response.statusCode,
          success: response.statusCode === 200,
        });
      });
    });

    request.on('error', (error) => {
      reject({
        route,
        error: error.message,
        success: false,
      });
    });

    request.setTimeout(TIMEOUT, () => {
      request.destroy();
      reject({
        route,
        error: '请求超时',
        success: false,
      });
    });
  });
}

/**
 * 并发预加载多个路由
 */
async function preloadAllRoutes() {
  console.log('🚀 开始预加载路由...\n');
  console.log(`📍 服务器地址: ${BASE_URL}\n`);

  // 首先检查服务器是否在线
  try {
    const serverCheck = await preloadRoute('/');
    if (!serverCheck.success) {
      throw new Error('服务器未响应');
    }
  } catch (error) {
    console.error('❌ 错误: 无法连接到开发服务器');
    console.error(`   请确保运行了 npm run dev 并且服务器在 ${BASE_URL}`);
    process.exit(1);
  }

  // 预加载所有路由
  const startTime = Date.now();
  const results = [];

  console.log('预加载进度:');
  console.log('─'.repeat(50));

  for (const route of ROUTES) {
    try {
      const routeStartTime = Date.now();
      const result = await preloadRoute(route);
      const duration = Date.now() - routeStartTime;
      
      results.push({
        ...result,
        duration,
      });

      const status = result.success ? '✓' : '✗';
      const icon = result.success ? '📄' : '❌';
      console.log(`${icon} ${status} ${route.padEnd(20)} ${duration}ms`);
    } catch (error) {
      console.log(`❌ ✗ ${error.route?.padEnd(20)} 失败: ${error.error}`);
      results.push({
        route: error.route,
        success: false,
        duration: 0,
        error: error.error,
      });
    }
  }

  const totalTime = Date.now() - startTime;

  console.log('─'.repeat(50) + '\n');

  // 统计结果
  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  console.log('📊 预加载统计:');
  console.log(`   ✓ 成功: ${successCount}/${ROUTES.length}`);
  if (failCount > 0) {
    console.log(`   ✗ 失败: ${failCount}/${ROUTES.length}`);
  }
  console.log(`   ⏱️  总耗时: ${totalTime}ms\n`);

  // 显示预期的性能改进
  if (successCount === ROUTES.length) {
    console.log('✅ 所有路由已预加载!');
    console.log('   用户首次访问时将获得更快的响应速度。\n');
  }
}

// 开始预加载
preloadAllRoutes().catch((error) => {
  console.error('预加载过程出错:', error);
  process.exit(1);
});
