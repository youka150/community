'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, List } from 'lucide-react';

/**
 * 通用 AI 分析目录组件（TOC）
 *
 * props:
 *   sections:            Array<{ id: string, label: string, icon?: ReactNode, sub?: Array<{id,label}> }>
 *   scrollContainerRef:  React.RefObject<HTMLElement>  —— 卡片内容滚动容器
 *   visible:             boolean
 *   onToggle:            () => void
 *   activeId:            string (可选，受控高亮)
 *   onSectionClick:      (id: string) => void (可选，点击时额外回调，如切换 Tab)
 */
export default function AnalysisTOC({
  sections = [],
  scrollContainerRef,
  visible = true,
  onToggle,
  activeId,
  onSectionClick,
  isInner = false,
}) {
  const [internalActiveId, setInternalActiveId] = useState(sections[0]?.id ?? '');
  // 点击滚动时加锁，防止 IntersectionObserver 乱改 activeId
  const isManualScrollingRef = useRef(false);
  const manualScrollTimerRef = useRef(null);

  const currentActiveId = activeId ?? internalActiveId;

  /**
   * 滚动到锚点：
   * - 使用 container.querySelector 而非 document.getElementById，
   *   防止 Ant Design Tabs 把所有 tab DOM 保留在页面中时出现全局 ID 冲突
   * - 加 SCROLL_TOP_OFFSET 留出顶部空白，避免标题紧贴容器顶部
   */
  const SCROLL_TOP_OFFSET = 8;

  const scrollToSection = useCallback((id) => {
    const container = scrollContainerRef?.current;
    if (!container) return;

    // ✅ 关键修复：限定在 scrollContainer 内部查找，避免跨 Tab ID 冲突
    const target = container.querySelector(`#${CSS.escape(id)}`);
    if (!target) return;

    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const scrollMarginTop =
      Number.parseFloat(window.getComputedStyle(target).scrollMarginTop || '0') || 0;
    const offset =
      container.scrollTop +
      (targetRect.top - containerRect.top) -
      scrollMarginTop -
      SCROLL_TOP_OFFSET;

    // 加锁：smooth scroll 动画期间屏蔽 IntersectionObserver 的 activeId 更新
    isManualScrollingRef.current = true;
    clearTimeout(manualScrollTimerRef.current);
    manualScrollTimerRef.current = setTimeout(() => {
      isManualScrollingRef.current = false;
    }, 800);

    setInternalActiveId(id);
    container.scrollTo({ top: Math.max(offset, 0), behavior: 'smooth' });
    onSectionClick?.(id);
  }, [scrollContainerRef, onSectionClick]);

  // IntersectionObserver：自动更新高亮（点击滚动期间不更新）
  useEffect(() => {
    if (!visible) return;
    const container = scrollContainerRef?.current;
    if (!container) return;

    const flattenIds = (nodes = []) =>
      nodes.flatMap((node) => [node.id, ...(node.sub ? flattenIds(node.sub) : [])]);
    const allIds = sections.flatMap((section) => [
      section.id,
      ...(section.sub ? flattenIds(section.sub) : []),
    ]);

    // ✅ 同样使用 container.querySelector 查找，避免全局 ID 冲突
    const targets = allIds
      .map((id) => container.querySelector(`#${CSS.escape(id)}`))
      .filter(Boolean);

    if (targets.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // 点击触发的滚动期间，忽略 Observer 的自动高亮更新
        if (isManualScrollingRef.current) return;

        const visibleEntries = entries.filter((e) => e.isIntersecting);
        if (visibleEntries.length > 0) {
          const containerTop = container.getBoundingClientRect().top;
          const nearest = [...visibleEntries].sort(
            (a, b) =>
              Math.abs(a.boundingClientRect.top - containerTop) -
              Math.abs(b.boundingClientRect.top - containerTop)
          )[0];
          setInternalActiveId(nearest.target.id);
        }
      },
      { root: container, rootMargin: '-10% 0px -60% 0px', threshold: 0 }
    );

    targets.forEach((el) => observer.observe(el));
    return () => {
      observer.disconnect();
      clearTimeout(manualScrollTimerRef.current);
    };
  }, [sections, scrollContainerRef, visible]);

  const renderSubTree = useCallback(
    (nodes = [], depth = 1) => {
      if (!nodes?.length) return null;

      return (
        <ul
          className={`mt-0.5 space-y-0.5 ${
            depth > 1 ? 'ml-3 pl-2 border-l border-slate-200/90' : 'ml-3'
          }`}
        >
          {nodes.map((node) => (
            <li key={node.id}>
              <button
                onClick={() => scrollToSection(node.id)}
                className={`w-full text-left rounded-lg transition-all px-2 py-1 text-xs ${
                  currentActiveId === node.id
                    ? 'bg-violet-50 text-violet-600 font-medium'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                }`}
                style={{ paddingLeft: `${8 + (depth - 1) * 8}px` }}
              >
                <span className="truncate block">{node.label}</span>
              </button>
              {renderSubTree(node.sub, depth + 1)}
            </li>
          ))}
        </ul>
      );
    },
    [currentActiveId, scrollToSection]
  );

  return (
    <div className={`relative flex-shrink-0 ${isInner ? 'w-full' : ''}`}>
      {/* 展开/折叠按钮 */}
      {!isInner && onToggle && (
        <button
          onClick={onToggle}
          title={visible ? '隐藏目录' : '显示目录'}
          className="absolute -right-3 top-3 z-10 w-6 h-6 flex items-center justify-center rounded-full bg-white border border-slate-200 shadow-sm hover:border-violet-300 hover:text-violet-600 transition-all"
        >
          {visible ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
      )}

      {visible && (
        <nav className={`${isInner ? 'w-full' : 'w-44 bg-slate-50/80 border border-slate-100 rounded-2xl p-3'} sticky top-4`}>
          {/* 标题 */}
          <div className={`flex items-center gap-1.5 mb-3 ${isInner ? '' : 'px-1'}`}>
            <List className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">目录</span>
          </div>

          {/* 目录条目 */}
          <ul className="space-y-0.5">
            {sections.map((section) => (
              <li key={section.id}>
                <button
                  onClick={() => scrollToSection(section.id)}
                  className={`w-full text-left px-2 py-1.5 rounded-lg text-sm transition-all flex items-center gap-1.5 group ${
                    currentActiveId === section.id
                      ? 'bg-violet-100 text-violet-700 font-medium'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                  }`}
                >
                  {section.icon && (
                    <span className="shrink-0 text-slate-400 group-hover:text-slate-600 text-xs">
                      {section.icon}
                    </span>
                  )}
                  <span className="truncate leading-snug">{section.label}</span>
                </button>

                {/* 子条目 */}
                {section.sub?.length > 0 && renderSubTree(section.sub)}
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
