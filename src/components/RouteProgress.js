'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export default function RouteProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let timer;
    let progressTimer;

    // 路由开始变化时
    const startLoading = () => {
      setLoading(true);
      setProgress(0);

      // 模拟进度条加载
      let currentProgress = 0;
      progressTimer = setInterval(() => {
        currentProgress += Math.random() * 15;
        if (currentProgress > 90) {
          currentProgress = 90; // 最多到90%，等待实际完成
          clearInterval(progressTimer);
        }
        setProgress(currentProgress);
      }, 200);
    };

    // 路由变化完成时
    const stopLoading = () => {
      setProgress(100);
      timer = setTimeout(() => {
        setLoading(false);
        setProgress(0);
      }, 300);
    };

    // 监听路由变化
    startLoading();
    const timeoutId = setTimeout(stopLoading, 100);

    return () => {
      clearTimeout(timer);
      clearTimeout(timeoutId);
      clearInterval(progressTimer);
    };
  }, [pathname, searchParams]);

  if (!loading) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 h-1 z-[9999] bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 transition-all duration-200 ease-out shadow-lg"
      style={{
        width: `${progress}%`,
        opacity: loading ? 1 : 0,
      }}
    >
      <div className="h-full w-full bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-pulse" />
    </div>
  );
}
