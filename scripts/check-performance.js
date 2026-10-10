// 性能检查脚本
const fs = require('fs');
const path = require('path');

console.log('🔍 Next.js 性能检查\n');

// 1. 检查大型依赖
console.log('📦 检查包体积...');
try {
  const packageJson = require('../package.json');
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
  
  const largeDeps = ['antd', 'recharts', 'd3-cloud', 'lucide-react'];
  console.log('\n大型依赖包:');
  largeDeps.forEach(dep => {
    if (deps[dep]) {
      console.log(`  ✓ ${dep}: ${deps[dep]} (建议使用动态导入)`);
    }
  });
} catch (e) {
  console.log('  ⚠ 无法读取 package.json');
}

// 2. 检查是否存在 loading.js 文件
console.log('\n📄 检查加载状态文件...');
const appDir = path.join(__dirname, '../src/app');
const routes = ['dashboard', 'trend-analysis', 'leaderboard', 'user-modeling'];

routes.forEach(route => {
  const loadingPath = path.join(appDir, route, 'loading.js');
  if (fs.existsSync(loadingPath)) {
    console.log(`  ✓ ${route}/loading.js 存在`);
  } else {
    console.log(`  ✗ ${route}/loading.js 缺失`);
  }
});

// 3. 检查配置优化
console.log('\n⚙️  检查配置优化...');
try {
  const configPath = path.join(__dirname, '../next.config.mjs');
  const configContent = fs.readFileSync(configPath, 'utf8');
  
  const checks = [
    { name: 'swcMinify', present: configContent.includes('swcMinify') },
    { name: 'optimizePackageImports', present: configContent.includes('optimizePackageImports') },
    { name: 'splitChunks', present: configContent.includes('splitChunks') },
  ];
  
  checks.forEach(check => {
    console.log(`  ${check.present ? '✓' : '✗'} ${check.name}`);
  });
} catch (e) {
  console.log('  ⚠ 无法读取配置文件');
}

// 4. 建议
console.log('\n💡 优化建议:');
console.log('  1. 对大型图表组件使用动态导入');
console.log('  2. 启用路由预加载 (prefetch)');
console.log('  3. 优化数据库查询和 API 响应时间');
console.log('  4. 考虑使用 React Server Components');
console.log('  5. 在生产环境使用 CDN 加速');
console.log('  6. 实施数据缓存策略');

console.log('\n✨ 运行 npm run dev 查看进度条效果');
console.log('🚀 运行 npm run build 查看构建优化结果\n');
