import { NextResponse } from 'next/server';

/**
 * 路由级权限中间件
 * 将权限配置硬编码在此处（中间件运行在 Edge Runtime，不能导入复杂模块）
 */

// 路由权限表（与 permissions.js 保持同步）
const ROUTE_PERMISSIONS = {
  '/console/huawei/users': ['admin'],
  '/console/ascend/users': ['admin'],
  '/console/dashboard': ['admin'],
  '/console/data-workbench': ['admin', 'data_engineer'],
};

// 获取角色默认页
function getDefaultRoute(role) {
  if (role === 'data_engineer') return '/console/data-workbench';
  return '/console/huawei';
}

export function middleware(request) {
  const url = request.nextUrl.clone();
  const path = url.pathname;

  // 仅拦截 /console 和 /dashboard 路由
  if (path.startsWith('/console') || path === '/dashboard') {
    const userRole = request.cookies.get('user_role')?.value;

    // 未登录 → 跳转登录页
    if (!userRole) {
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }

    // admin 拥有全部权限
    if (userRole === 'admin') {
      return NextResponse.next();
    }

    // /dashboard 旧路径兼容
    if (path === '/dashboard') {
      url.pathname = getDefaultRoute(userRole);
      return NextResponse.redirect(url);
    }

    // 检查受限路由
    for (const [route, allowedRoles] of Object.entries(ROUTE_PERMISSIONS)) {
      if (path === route || path.startsWith(route + '/')) {
        if (!allowedRoles.includes(userRole)) {
          url.pathname = getDefaultRoute(userRole);
          return NextResponse.redirect(url);
        }
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/console/:path*', '/dashboard'],
};
