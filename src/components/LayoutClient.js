'use client';

import { Suspense } from 'react';
import RouteProgress from './RouteProgress';

export default function LayoutClient({ children }) {
  return (
    <>
      <Suspense fallback={null}>
        <RouteProgress />
      </Suspense>
      {children}
    </>
  );
}
