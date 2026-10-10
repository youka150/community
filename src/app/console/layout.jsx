import ConsoleSidebar from '@/components/ConsoleSidebar';

/**
 * 控制台布局 — 左侧固定侧边栏 + 右侧内容区
 */
export default function ConsoleLayout({ children }) {
  return (
    <div className="flex min-h-screen bg-gradient-to-b from-[#f7f9ff] via-[#fdfdff] to-[#f7fbff]">
      <ConsoleSidebar />
      <main className="flex-1 min-w-0 overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}
