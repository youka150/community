'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { ShieldCheck, User, ArrowRight, BrainCircuit, Activity, Database } from 'lucide-react';
import Image from 'next/image';

const ROLES = [
  {
    key: 'admin',
    label: '系统管理员',
    tag: 'Admin',
    desc: '全局视图、数据驾驶舱、微观用户建模、数据工作台',
    icon: ShieldCheck,
    color: {
      selected: 'border-indigo-500 bg-indigo-50 shadow-md scale-[1.02]',
      unselected: 'border-slate-100 bg-white hover:border-indigo-200 hover:bg-slate-50',
      avatar: { on: 'bg-indigo-500 text-white', off: 'bg-slate-100 text-slate-500' },
      text: 'text-indigo-800',
      dot: 'bg-indigo-500',
      gradient: 'from-indigo-600 to-indigo-500 shadow-indigo-500/30',
    },
  },
  {
    key: 'data_engineer',
    label: '数据工程师',
    tag: 'Data Engineer',
    desc: '数据工作台（上传/编辑/BI探索）、社区大屏只读',
    icon: Database,
    color: {
      selected: 'border-teal-500 bg-teal-50 shadow-md scale-[1.02]',
      unselected: 'border-slate-100 bg-white hover:border-teal-200 hover:bg-slate-50',
      avatar: { on: 'bg-teal-500 text-white', off: 'bg-slate-100 text-slate-500' },
      text: 'text-teal-800',
      dot: 'bg-teal-500',
      gradient: 'from-teal-600 to-emerald-500 shadow-teal-500/30',
    },
  },
  {
    key: 'user',
    label: '普通用户',
    tag: 'User',
    desc: '社区基础大屏、趋势预判与积分榜单',
    icon: User,
    color: {
      selected: 'border-sky-500 bg-sky-50 shadow-md scale-[1.02]',
      unselected: 'border-slate-100 bg-white hover:border-sky-200 hover:bg-slate-50',
      avatar: { on: 'bg-sky-500 text-white', off: 'bg-slate-100 text-slate-500' },
      text: 'text-sky-800',
      dot: 'bg-sky-500',
      gradient: 'from-sky-600 to-cyan-500 shadow-sky-500/30',
    },
  },
];

export default function LoginPage() {
  const { login } = useAuth();
  const [mode, setMode] = useState('login');
  const [selectedRole, setSelectedRole] = useState('user');
  const [formState, setFormState] = useState({
    username: '',
    password: '',
    confirmPassword: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const currentRole = ROLES.find((r) => r.key === selectedRole);

  const readUsers = () => {
    try {
      return JSON.parse(localStorage.getItem('insightai_users') || '[]');
    } catch {
      return [];
    }
  };

  const writeUsers = (users) => {
    localStorage.setItem('insightai_users', JSON.stringify(users));
  };

  const handleLogin = () => {
    setIsLoading(true);
    setFormError('');

    setTimeout(() => {
      const { username, password } = formState;
      if (!username || !password) {
        setFormError('请输入用户名和密码');
        setIsLoading(false);
        return;
      }

      const users = readUsers();
      const matched = users.find((u) => u.username === username);
      if (!matched || matched.password !== password) {
        setFormError('用户名或密码错误');
        setIsLoading(false);
        return;
      }

      localStorage.setItem('insightai_current_user', JSON.stringify(matched));
      login(matched.role);
    }, 300);
  };

  const handleRegister = () => {
    setIsLoading(true);
    setFormError('');

    setTimeout(() => {
      const { username, password, confirmPassword } = formState;
      if (!username || !password) {
        setFormError('请输入用户名和密码');
        setIsLoading(false);
        return;
      }

      if (password !== confirmPassword) {
        setFormError('两次输入的密码不一致');
        setIsLoading(false);
        return;
      }

      const users = readUsers();
      if (users.some((u) => u.username === username)) {
        setFormError('该用户名已存在');
        setIsLoading(false);
        return;
      }

      const newUser = { username, password, role: selectedRole };
      writeUsers([...users, newUser]);
      localStorage.setItem('insightai_current_user', JSON.stringify(newUser));
      login(selectedRole);
    }, 300);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center relative overflow-hidden font-sans">
      {/* 背景光晕 */}
      <div className="absolute top-[-10%] left-[-5%] w-[40vw] h-[40vw] rounded-full bg-indigo-300/30 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[45vw] h-[45vw] rounded-full bg-sky-300/30 blur-[120px] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f080_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f080_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-5xl flex flex-col md:flex-row items-center justify-center gap-10 p-6">

        {/* 左侧品牌 */}
        <div className="flex-1 w-full text-center md:text-left flex flex-col justify-center items-center md:items-start space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-white shadow-xl flex items-center justify-center border border-indigo-50">
            <Image src="/logo.svg" alt="Logo" width={48} height={48} className="object-cover" />
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-800 tracking-tight leading-tight">
            欢迎登录 <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-sky-500">InsightAI</span> 系统
          </h1>
          <p className="text-slate-500 text-lg max-w-sm leading-relaxed">
            极速接入跨社区多维数据洞察。保护隐私，基于角色的鉴权体系。
          </p>
          <div className="hidden md:flex gap-4 opacity-70">
            <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
              <BrainCircuit className="w-4 h-4 text-indigo-500" />
              智能建模
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
              <Activity className="w-4 h-4 text-sky-500" />
              实时分析
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
              <Database className="w-4 h-4 text-teal-500" />
              数据工作台
            </div>
          </div>
        </div>

        {/* 右侧登录卡片 */}
        <div className="w-full max-w-md bg-white/80 backdrop-blur-xl border border-slate-200 shadow-2xl shadow-indigo-200/50 rounded-3xl p-8">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-slate-800">
              {mode === 'login' ? '登录系统' : '注册账号'}
            </h2>
            <p className="text-sm text-slate-500 mt-2">
              {mode === 'login'
                ? '输入账号密码进入系统'
                : '选择角色后创建账号并进入系统'}
            </p>
          </div>

          <div className="space-y-4 mb-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">用户名</label>
              <input
                value={formState.username}
                onChange={(e) => setFormState((prev) => ({ ...prev, username: e.target.value }))}
                placeholder="请输入用户名"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">密码</label>
              <input
                type="password"
                value={formState.password}
                onChange={(e) => setFormState((prev) => ({ ...prev, password: e.target.value }))}
                placeholder="请输入密码"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
              />
            </div>
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">确认密码</label>
                <input
                  type="password"
                  value={formState.confirmPassword}
                  onChange={(e) => setFormState((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                  placeholder="请再次输入密码"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
                />
              </div>
            )}
          </div>

          {mode === 'register' && (
            <div className="space-y-3 mb-6">
              <div className="text-xs font-semibold text-slate-500">选择角色</div>
              {ROLES.map((r) => {
                const Icon = r.icon;
                const selected = selectedRole === r.key;

                return (
                  <button
                    key={r.key}
                    onClick={() => setSelectedRole(r.key)}
                    className={`w-full flex items-center p-4 rounded-2xl border-2 transition-all duration-300 ${selected ? r.color.selected : r.color.unselected
                      }`}
                  >
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center mr-4 transition-colors ${selected ? r.color.avatar.on : r.color.avatar.off
                      }`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="text-left flex-1">
                      <h3 className={`font-bold text-sm ${selected ? r.color.text : 'text-slate-700'}`}>
                        {r.label} ({r.tag})
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">{r.desc}</p>
                    </div>
                    {selected && (
                      <div className={`ml-auto w-3 h-3 rounded-full ${r.color.dot}`} />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {formError && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
              {formError}
            </div>
          )}

          <button
            onClick={mode === 'login' ? handleLogin : handleRegister}
            disabled={isLoading}
            className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all flex justify-center items-center gap-2 bg-gradient-to-r ${currentRole?.color.gradient || 'from-indigo-600 to-indigo-500 shadow-indigo-500/30'
              } ${isLoading ? 'opacity-80 scale-95' : 'hover:-translate-y-1'}`}
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                {mode === 'login' ? '登录并进入系统' : '注册并进入系统'} <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>

          <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
            <button
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                setFormError('');
              }}
              className="text-indigo-600 hover:text-indigo-700 font-semibold"
            >
              {mode === 'login' ? '没有账号？去注册' : '已有账号？去登录'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
