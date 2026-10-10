/**
 * 权限配置中心 — 集中管理所有角色与权限规则
 *
 * 角色：admin / user / data_engineer
 * 粒度：路由级 + Tab级
 */

// ===== 角色定义 =====
export const ROLES = {
  ADMIN: 'admin',
  USER: 'user',
  DATA_ENGINEER: 'data_engineer',
};

// ===== 路由级权限 =====
export const ROUTE_PERMISSIONS = {
  '/console/trend-analysis': [ROLES.ADMIN, ROLES.USER, ROLES.DATA_ENGINEER],
  '/console/huawei': [ROLES.ADMIN, ROLES.USER, ROLES.DATA_ENGINEER],
  '/console/huawei/users': [ROLES.ADMIN],
  '/console/huawei/ranking': [ROLES.ADMIN, ROLES.USER, ROLES.DATA_ENGINEER],
  '/console/ascend': [ROLES.ADMIN, ROLES.USER, ROLES.DATA_ENGINEER],
  '/console/ascend/users': [ROLES.ADMIN],
  '/console/ascend/ranking': [ROLES.ADMIN, ROLES.USER, ROLES.DATA_ENGINEER],
  '/console/dashboard': [ROLES.ADMIN],
  '/console/leaderboard': [ROLES.ADMIN, ROLES.USER, ROLES.DATA_ENGINEER],
  '/console/data-workbench': [ROLES.ADMIN, ROLES.DATA_ENGINEER],
};

// ===== Tab级权限 =====
// key 对应各大屏组件中 Tab 的 id
export const TAB_PERMISSIONS = {
  // 华为大屏
  'huawei-overview': [ROLES.ADMIN, ROLES.USER, ROLES.DATA_ENGINEER],
  'huawei-ai-analysis': [ROLES.ADMIN],
  'huawei-network-graph': [ROLES.ADMIN, ROLES.USER, ROLES.DATA_ENGINEER],
  'huawei-business-insights': [ROLES.ADMIN],
  // 昇腾大屏
  'ascend-overview': [ROLES.ADMIN, ROLES.USER, ROLES.DATA_ENGINEER],
  'ascend-ai-analysis': [ROLES.ADMIN],
  'ascend-business-insights': [ROLES.ADMIN],
};

// ===== 工具函数 =====

/**
 * 判断角色是否拥有某路由的访问权限
 */
export function hasRouteAccess(role, path) {
  // admin 拥有全部权限
  if (role === ROLES.ADMIN) return true;

  // 精确匹配
  if (ROUTE_PERMISSIONS[path]) {
    return ROUTE_PERMISSIONS[path].includes(role);
  }

  // 默认：已登录即可访问
  return !!role;
}

/**
 * 判断角色是否拥有某 Tab 的访问权限
 */
export function hasTabAccess(role, tabKey) {
  if (role === ROLES.ADMIN) return true;
  if (TAB_PERMISSIONS[tabKey]) {
    return TAB_PERMISSIONS[tabKey].includes(role);
  }
  return true; // 未配置的 Tab 默认允许
}

/**
 * 获取角色被限制访问的路由列表
 */
export function getRestrictedRoutes(role) {
  if (role === ROLES.ADMIN) return [];
  return Object.entries(ROUTE_PERMISSIONS)
    .filter(([, roles]) => !roles.includes(role))
    .map(([path]) => path);
}

/**
 * 获取角色的默认首页
 */
export function getDefaultRoute(role) {
  switch (role) {
    case ROLES.DATA_ENGINEER:
      return '/console/data-workbench';
    case ROLES.ADMIN:
      return '/console/huawei';
    default:
      return '/console/huawei';
  }
}
