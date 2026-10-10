import { Suspense } from 'react';
import AscendUserRankingBoard from '@/components/AscendUserRankingBoard';

export default function ConsoleAscendRankingPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-blue-500 animate-pulse">正在加载排行榜...</div>
      </div>
    }>
      <AscendUserRankingBoard />
    </Suspense>
  );
}
