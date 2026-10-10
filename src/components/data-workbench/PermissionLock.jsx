'use client';

import { Lock } from 'lucide-react';

/**
 * 权限锁组件 — 对无权限的 Tab/区域覆盖半透明遮罩
 * 内容仍然渲染（但 blur 模糊化），让用户知道功能存在
 *
 * @param {boolean} locked - 是否锁定
 * @param {string}  message - 锁定提示文案
 * @param {React.ReactNode} children - 被锁定的内容
 */
export default function PermissionLock({
  locked = false,
  message = '此功能需要更高权限，请联系管理员开通',
  children,
}) {
  if (!locked) return children;

  return (
    <div className="relative">
      {/* 原始内容（模糊化） */}
      <div className="filter blur-[6px] pointer-events-none select-none opacity-60">
        {children}
      </div>

      {/* 锁定覆盖层 */}
      <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/40 backdrop-blur-[2px] rounded-2xl">
        <div className="flex flex-col items-center gap-3 p-8 max-w-sm text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center shadow-sm">
            <Lock className="w-7 h-7 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-700">权限受限</h3>
          <p className="text-sm text-slate-500 leading-relaxed">{message}</p>
          <div className="mt-1 px-4 py-2 rounded-lg bg-slate-100 text-xs text-slate-500 font-medium">
            🔒 需要管理员 (Admin) 权限
          </div>
        </div>
      </div>
    </div>
  );
}
