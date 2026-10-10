'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import {
  BarChart3, Users, Trophy, TrendingUp, ChevronDown, ChevronRight,
  PanelLeftClose, PanelLeftOpen, Home, Sparkles, PieChart, Award, Layers,
  LayoutDashboard, LogOut, Database
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { hasRouteAccess } from '@/lib/permissions';

/**
 * 控制台侧边栏 — 统一导航菜单
 * 支持折叠/展开、分组展开/收起、当前路由高亮
 */
export default function ConsoleSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { role, logout } = useAuth();

  // 根据当前路由自动展开对应分组
  const [expandedGroups, setExpandedGroups] = useState(() => {
    const groups = {};
    if (pathname?.startsWith('/console/huawei')) groups.huawei = true;
    if (pathname?.startsWith('/console/ascend')) groups.ascend = true;
    return groups;
  });

  // 路由变化时自动展开对应分组
  useEffect(() => {
    if (pathname?.startsWith('/console/huawei')) {
      setExpandedGroups(prev => ({ ...prev, huawei: true }));
    }
    if (pathname?.startsWith('/console/ascend')) {
      setExpandedGroups(prev => ({ ...prev, ascend: true }));
    }
  }, [pathname]);

  const toggleGroup = (key) => {
    setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const isActive = (path) => pathname === path;
  const isGroupActive = (prefix) => pathname?.startsWith(prefix);

  // 菜单配置 — 基于 hasRouteAccess 进行权限过滤
  const menuConfig = [
    {
      type: 'link',
      key: 'trend',
      label: '趋势分析',
      icon: TrendingUp,
      href: '/console/trend-analysis',
      color: 'violet',
    },
    {
      type: 'divider',
    },
    {
      type: 'group',
      key: 'huawei',
      label: '华为社区',
      logo: '/huawei.jpg',
      color: 'indigo',
      children: [
        { key: 'huawei-dashboard', label: '数据大屏', icon: BarChart3, href: '/console/huawei' },
        { key: 'huawei-users', label: '用户建模', icon: Users, href: '/console/huawei/users' },
        { key: 'huawei-ranking', label: '排行榜', icon: Trophy, href: '/console/huawei/ranking' },
      ].filter(child => hasRouteAccess(role, child.href)),
    },
    {
      type: 'group',
      key: 'ascend',
      label: '昇腾社区',
      logo: '/ascend.png',
      color: 'sky',
      children: [
        { key: 'ascend-dashboard', label: '数据大屏', icon: PieChart, href: '/console/ascend' },
        { key: 'ascend-users', label: '用户建模', icon: Users, href: '/console/ascend/users' },
        { key: 'ascend-ranking', label: '排行榜', icon: Award, href: '/console/ascend/ranking' },
      ].filter(child => hasRouteAccess(role, child.href)),
    },
    {
      type: 'divider',
    },
    {
      type: 'link',
      key: 'data-workbench',
      label: '数据工作台',
      icon: Database,
      href: '/console/data-workbench',
      color: 'teal',
    },
    {
      type: 'link',
      key: 'dashboard',
      label: '数据驾驶舱',
      icon: LayoutDashboard,
      href: '/console/dashboard',
      color: 'emerald',
    },
    {
      type: 'link',
      key: 'leaderboard',
      label: '榜单中心',
      icon: Layers,
      href: '/console/leaderboard',
      color: 'amber',
    },
  ].filter(item => {
    // 分隔线始终保留
    if (item.type === 'divider') return true;
    // link 类型：检查路由权限
    if (item.type === 'link' && item.href) return hasRouteAccess(role, item.href);
    // group 类型：至少有一个可见子项才保留
    if (item.type === 'group') return (item.children || []).length > 0;
    return true;
  });

  // 色彩映射
  const colorMap = {
    indigo: {
      active: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      hover: 'hover:bg-indigo-50/50 hover:text-indigo-600',
      icon: 'text-indigo-500',
      groupBg: 'bg-indigo-500',
      indicator: 'bg-indigo-500',
    },
    sky: {
      active: 'bg-sky-50 text-sky-700 border-sky-200',
      hover: 'hover:bg-sky-50/50 hover:text-sky-600',
      icon: 'text-sky-500',
      groupBg: 'bg-sky-500',
      indicator: 'bg-sky-500',
    },
    violet: {
      active: 'bg-violet-50 text-violet-700 border-violet-200',
      hover: 'hover:bg-violet-50/50 hover:text-violet-600',
      icon: 'text-violet-500',
      indicator: 'bg-violet-500',
    },
    emerald: {
      active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      hover: 'hover:bg-emerald-50/50 hover:text-emerald-600',
      icon: 'text-emerald-500',
      indicator: 'bg-emerald-500',
    },
    amber: {
      active: 'bg-amber-50 text-amber-700 border-amber-200',
      hover: 'hover:bg-amber-50/50 hover:text-amber-600',
      icon: 'text-amber-500',
      indicator: 'bg-amber-500',
    },
    teal: {
      active: 'bg-teal-50 text-teal-700 border-teal-200',
      hover: 'hover:bg-teal-50/50 hover:text-teal-600',
      icon: 'text-teal-500',
      indicator: 'bg-teal-500',
    },
  };

  const renderMenuItem = (item) => {
    if (item.type === 'divider') {
      return <div key={Math.random()} className={`my-2 border-t border-slate-100 ${collapsed ? 'mx-2' : 'mx-3'}`} />;
    }

    if (item.type === 'link') {
      const active = isActive(item.href);
      const colors = colorMap[item.color] || colorMap.indigo;
      const Icon = item.icon;

      return (
        <Link
          key={item.key}
          href={item.href}
          className={`
            flex items-center gap-3 rounded-xl transition-all duration-200 group relative
            ${collapsed ? 'px-3 py-2.5 justify-center mx-1' : 'px-3 py-2.5 mx-2'}
            ${active
              ? `${colors.active} border shadow-sm`
              : `text-slate-600 border border-transparent ${colors.hover}`
            }
          `}
          title={collapsed ? item.label : undefined}
        >
          {/* 激活指示线 */}
          {active && (
            <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full ${colors.indicator}`} />
          )}
          <Icon className={`w-[18px] h-[18px] shrink-0 ${active ? colors.icon : 'text-slate-400 group-hover:text-slate-600'}`} />
          {!collapsed && (
            <span className="text-sm font-medium truncate">{item.label}</span>
          )}
        </Link>
      );
    }

    if (item.type === 'group') {
      const expanded = expandedGroups[item.key];
      const groupActive = isGroupActive(`/console/${item.key}`);
      const colors = colorMap[item.color] || colorMap.indigo;

      return (
        <div key={item.key} className="space-y-0.5">
          {/* 分组标题 */}
          <button
            onClick={() => toggleGroup(item.key)}
            className={`
              w-full flex items-center gap-2.5 rounded-xl transition-all duration-200 group
              ${collapsed ? 'px-3 py-2.5 justify-center mx-1' : 'px-3 py-2.5 mx-2'}
              ${groupActive
                ? 'text-slate-800'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }
            `}
            title={collapsed ? item.label : undefined}
          >
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 overflow-hidden ${groupActive ? '' : 'opacity-70 group-hover:opacity-100'
              }`}>
              <Image src={item.logo} alt={item.label} width={24} height={24} className="object-contain" />
            </div>
            {!collapsed && (
              <>
                <span className="text-sm font-semibold flex-1 text-left truncate">{item.label}</span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${expanded ? '' : '-rotate-90'}`} />
              </>
            )}
          </button>

          {/* 子菜单 */}
          {!collapsed && expanded && (
            <div className="ml-5 pl-3 border-l-2 border-slate-100 space-y-0.5 py-0.5">
              {item.children.map((child) => {
                const active = isActive(child.href);
                const ChildIcon = child.icon;

                return (
                  <Link
                    key={child.key}
                    href={child.href}
                    className={`
                      flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-200 group relative
                      ${active
                        ? `${colors.active} border shadow-sm`
                        : `text-slate-500 border border-transparent ${colors.hover}`
                      }
                    `}
                  >
                    <ChildIcon className={`w-4 h-4 shrink-0 ${active ? colors.icon : 'text-slate-400'}`} />
                    <span className="text-sm font-medium truncate">{child.label}</span>
                  </Link>
                );
              })}
            </div>
          )}

          {/* 折叠态下弹出子菜单用 tooltip 代替 */}
          {collapsed && (
            <div className="flex flex-col items-center gap-1 mx-1">
              {item.children.map((child) => {
                const active = isActive(child.href);
                const ChildIcon = child.icon;

                return (
                  <Link
                    key={child.key}
                    href={child.href}
                    className={`
                      p-2 rounded-lg transition-all duration-200 relative
                      ${active
                        ? `${colors.active} border shadow-sm`
                        : `text-slate-400 border border-transparent ${colors.hover}`
                      }
                    `}
                    title={child.label}
                  >
                    <ChildIcon className={`w-4 h-4 ${active ? colors.icon : ''}`} />
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <aside
      className={`
        shrink-0 flex flex-col h-screen sticky top-0 z-40
        bg-white/80 backdrop-blur-xl border-r border-slate-200/80
        transition-all duration-300 ease-in-out
        ${collapsed ? 'w-[68px]' : 'w-[240px]'}
      `}
    >
      {/* Logo 区域 */}
      <div className={`flex items-center gap-2.5 px-4 py-5 border-b border-slate-100 ${collapsed ? 'justify-center' : ''}`}>
        <Link href="/" className="flex items-center gap-2.5 group shrink-0" title="返回首页">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center overflow-hidden group-hover:scale-105 transition-transform">
            <Image src="/logo.svg" alt="InsightAI" width={36} height={36} />
          </div>
          {!collapsed && (
            <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-700 to-sky-600 truncate">
              InsightAI
            </span>
          )}
        </Link>
      </div>

      {/* 菜单区域 */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 space-y-0.5 scrollbar-thin">
        {menuConfig.map(renderMenuItem)}
      </nav>

      {/* 底部操作区 */}
      <div className="border-t border-slate-100 p-3 space-y-2">
        {/* 返回首页 */}
        <Link
          href="/"
          className={`
            flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all duration-200
            text-slate-500 hover:text-indigo-600 hover:bg-indigo-50/50
            ${collapsed ? 'justify-center' : ''}
          `}
          title="返回首页"
        >
          <Home className="w-4 h-4 shrink-0" />
          {!collapsed && <span className="text-sm font-medium">返回首页</span>}
        </Link>

        {/* 退出登录 */}
        {role && (
          <button
            onClick={logout}
            className={`
            flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all duration-200 w-full
            text-slate-500 hover:text-red-600 hover:bg-red-50
            ${collapsed ? 'justify-center' : ''}
          `}
            title="退出登录"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!collapsed && <span className="text-sm font-medium">退出登录</span>}
          </button>
        )}

        {/* 折叠按钮 */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`
            flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all duration-200 w-full
            text-slate-400 hover:text-slate-600 hover:bg-slate-50
            ${collapsed ? 'justify-center' : ''}
          `}
          title={collapsed ? '展开侧边栏' : '收起侧边栏'}
        >
          {collapsed
            ? <PanelLeftOpen className="w-4 h-4" />
            : <PanelLeftClose className="w-4 h-4" />
          }
          {!collapsed && <span className="text-xs text-slate-400">收起菜单</span>}
        </button>
      </div>
    </aside>
  );
}
