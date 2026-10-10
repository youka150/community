/**
 * 路由预加载策略
 * 这个模块用于在应用初始化时预加载所有关键路由
 * 避免用户首次访问时出现编译延迟
 */

export function preloadRoutes() {
  if (typeof window === 'undefined') return; // 仅在客户端运行

  // 预加载所有关键路由对应的组件
  const routes = [
    '/trend-analysis',
    '/huawei/users',
    '/huawei/ranking',
    '/leaderboard',
    '/dashboard',
    '/analysis',
    '/huawei',
  ];

  // 创建预加载链接
  routes.forEach((route) => {
    // 方法1: 使用 prefetch - 在浏览器空闲时加载
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = route;
        link.as = 'fetch';
        document.head.appendChild(link);
      });
    }
  });
}

/**
 * 使用 Next.js Router 的 prefetch 功能
 * 在 Link 组件或手动调用时预取路由
 */
export function useRoutePreloading() {
  if (typeof window === 'undefined') return;

  // 这个函数会在应用挂载时被调用
  const preloadAll = async () => {
    try {
      // 通过触发路由加载来预加载
      const routes = [
        '/trend-analysis',
        '/huawei/users',
        '/huawei/ranking',
        '/leaderboard',
        '/dashboard',
        '/analysis',
        '/huawei',
      ];

      for (const route of routes) {
        // 注意: 这只会在生产环境中真正生效
        // 在开发环境中仍然会触发编译
        await fetch(route).catch(() => {
          // 忽略错误，这只是预加载
        });
      }
    } catch (error) {
      console.error('预加载路由失败:', error);
    }
  };

  return { preloadAll };
}
