'use client';

import { useRef, useEffect, useState } from 'react';
import { motion, useScroll, useTransform, useSpring, AnimatePresence } from 'framer-motion';
import { Activity, BookOpen, Brain, Sparkles, Fingerprint, Flame, Target, Users, BarChart3, Presentation, Database } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

// ==========================================
// 1. 视差爆缩入海 (Hero 装置)
// ==========================================
const HeroSection = () => {
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"]
  });

  const smoothProgress = useSpring(scrollYProgress, { stiffness: 100, damping: 20, restDelta: 0.001 });

  // 使得面板一开始的位置更低，避免挡住文字
  const boardScale = useTransform(smoothProgress, [0, 0.5, 1], [0.8, 0.95, 1]);
  const boardY = useTransform(smoothProgress, [0, 0.5, 1], ["75vh", "20vh", "0vh"]); // 起始拉低到 75vh
  const boardRotateX = useTransform(smoothProgress, [0, 0.5], [20, 0]);
  const boardBlur = useTransform(smoothProgress, [0, 0.4], ["blur(12px)", "blur(0px)"]);

  const textScale = useTransform(smoothProgress, [0, 0.4], [1, 0.85]);
  const textOpacity = useTransform(smoothProgress, [0, 0.25], [1, 0]);
  const textY = useTransform(smoothProgress, [0, 0.4], [0, 60]);

  // 面板内部卡片的滞后放大效果
  const innerCardScale = useTransform(smoothProgress, [0.3, 0.6], [0.8, 1]);
  const innerCardOpacity = useTransform(smoothProgress, [0.3, 0.6], [0, 1]);

  return (
    <div ref={containerRef} className="h-[250vh] relative bg-[#fafafc]">
      <div className="sticky top-0 h-screen flex flex-col items-center justify-center overflow-hidden perspective-[1200px]">

        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[10%] left-[20%] w-[30vw] h-[30vw] bg-indigo-300/30 blur-[120px] rounded-full mix-blend-multiply" />
          <div className="absolute bottom-[20%] right-[10%] w-[40vw] h-[40vw] bg-sky-200/40 blur-[130px] rounded-full mix-blend-multiply" />
        </div>

        {/* 核心文案位置上移 top-[15%] */}
        <motion.div
          style={{ scale: textScale, opacity: textOpacity, y: textY }}
          className="absolute top-[15%] flex flex-col items-center z-10 w-full px-6"
        >
          <div className="inline-flex items-center gap-2 text-sm font-black bg-white/50 backdrop-blur-md border border-slate-200/60 text-slate-800 px-5 py-2 rounded-full mb-8 shadow-sm">
            <Sparkles className="w-4 h-4 text-indigo-500" /> 企业主导型创意社区用户行为特征建模与创意洞察系统
          </div>
          <h1 className="text-6xl md:text-8xl lg:text-9xl font-black text-slate-900 text-center leading-[1.05]">
            释放社区数据的 <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-br from-indigo-600 via-sky-500 to-teal-400 drop-shadow-sm">
              商业潜能
            </span>
          </h1>
          <p className="mt-8 text-xl md:text-2xl font-medium text-slate-500 max-w-2xl text-center">
            一站式智能分析平台，将海量无序的用户讨论转化为高价值的创意洞察与商业决策依据。
          </p>
        </motion.div>

        {/* 巨型悬浮模拟屏 */}
        <motion.div
          style={{
            scale: boardScale,
            y: boardY,
            rotateX: boardRotateX,
            filter: boardBlur
          }}
          className="absolute z-20 w-[94vw] md:w-[85vw] lg:w-[75vw] h-[65vh] md:h-[75vh] bg-white/60 backdrop-blur-3xl border-[1px] border-white/80 rounded-[2.5rem] md:rounded-[3.5rem] shadow-[0_40px_100px_-20px_rgba(79,70,229,0.15)] overflow-hidden flex flex-col"
        >
          <div className="w-full h-16 border-b border-white/50 flex items-center px-8 gap-2 bg-white/30">
            <div className="w-3 h-3 rounded-full bg-slate-300" />
            <div className="w-3 h-3 rounded-full bg-slate-300" />
            <div className="w-3 h-3 rounded-full bg-slate-300" />
          </div>

          <div className="flex-1 relative w-full h-full flex items-center justify-center bg-slate-50/30 overflow-hidden">
            <svg viewBox="0 0 800 400" className="w-full h-full opacity-60">
              <defs>
                <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#4F46E5" stopOpacity="0" />
                  <stop offset="50%" stopColor="#0EA5E9" stopOpacity="1" />
                  <stop offset="100%" stopColor="#14B8A6" stopOpacity="0" />
                </linearGradient>
              </defs>
              <g fill="none" stroke="url(#lineGrad)" strokeWidth="2" opacity="0.5">
                <path d="M 0,200 Q 200,50 400,200 T 800,200" />
                <path d="M 0,220 Q 200,90 400,220 T 800,220" />
                <path d="M 0,240 Q 200,130 400,240 T 800,240" />
                <path d="M 0,180 Q 200,-10 400,180 T 800,180" />
                <path d="M 0,260 Q 300,400 400,260 T 800,260" />
              </g>
              <circle cx="400" cy="200" r="150" fill="none" stroke="#6366f1" strokeWidth="1" strokeDasharray="4 8">
                <animateTransform attributeName="transform" type="rotate" from="0 400 200" to="360 400 200" dur="20s" repeatCount="indefinite" />
              </circle>
              <circle cx="400" cy="200" r="100" fill="none" stroke="#38bdf8" strokeWidth="2" strokeDasharray="10 10">
                <animateTransform attributeName="transform" type="rotate" from="360 400 200" to="0 400 200" dur="15s" repeatCount="indefinite" />
              </circle>
              <circle cx="400" cy="200" r="40" fill="#4F46E5" fillOpacity="0.1" />
              <circle cx="400" cy="200" r="10" fill="#4F46E5" />
            </svg>

            {/* 顶上来的动态卡片 */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <motion.div
                style={{ scale: innerCardScale, opacity: innerCardOpacity }}
                className="backdrop-blur-md bg-white border border-white px-10 py-6 rounded-3xl shadow-2xl flex flex-col items-center gap-2"
              >
                <div className="text-xl font-bold text-slate-800 tracking-tight">社会网络分析已就绪</div>
                <div className="text-sm font-medium text-slate-400">System Online</div>
              </motion.div>
            </div>

          </div>
        </motion.div>
      </div>
    </div>
  );
};

// ==========================================
// 2. 双核算力引擎 (Bento Box Matrix)
// ==========================================
const BentoBoxSection = () => {
  return (
    <div className="relative z-10 bg-white py-32 px-6 border-b border-t border-slate-100 rounded-t-[3rem] -mt-10 overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-24">
          <h2 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tighter mb-6">双核心社区 · 全景洞察引擎</h2>
          <p className="text-xl text-slate-500 font-medium">针对华为开发者社区与昇腾社区，提供定制化的多维数据交互洞察能力，全面赋能业务增长与生态繁荣。</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 md:auto-rows-[340px] gap-6">
          {/* 大卡片: 华为 */}
          <motion.div
            whileHover={{ y: -8 }}
            className="md:col-span-3 bg-gradient-to-br from-indigo-50/60 to-white hover:from-white hover:to-indigo-50 border border-slate-200/60 rounded-[3rem] p-10 md:p-14 relative overflow-hidden group shadow-lg hover:shadow-2xl transition-all duration-500"
          >
            {/* <div className="absolute right-0 top-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-400/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" /> */}
            <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-8 shadow-xl shadow-indigo-600/10">
              <Image src="/huawei.jpg" alt="华为" width={56} height={56} className="w-14 h-14 object-contain" />
            </div>
            <h3 className="text-4xl font-extrabold text-slate-900 mb-4">华为开发者版图</h3>
            <p className="text-xl text-slate-500 max-w-lg leading-relaxed mb-8 z-10 relative">
              搭载 NLP 语言引擎，更早发现创新概念，用引力波模型追踪多维度影响力。
            </p>
            <div className="absolute right-4 -bottom-10 w-[70%] sm:w-[50%] h-[60%] sm:h-[80%] bg-white/80 rounded-tl-3xl border-t border-l border-slate-100 shadow-[0_-10px_40px_rgb(0,0,0,0.05)] p-6 group-hover:translate-x-2 group-hover:-translate-y-2 transition-transform duration-700">
              <div className="space-y-4">
                <div className="flex items-center gap-3"><div className="w-4 h-4 rounded-full bg-indigo-500" /><div className="h-3 w-1/2 bg-slate-100 rounded-full" /></div>
                <div className="flex items-center gap-3"><div className="w-4 h-4 rounded-full bg-sky-400" /><div className="h-3 w-3/4 bg-slate-100 rounded-full" /></div>
                <div className="flex items-center gap-3"><div className="w-4 h-4 rounded-full bg-teal-400" /><div className="h-3 w-1/3 bg-slate-100 rounded-full" /></div>
              </div>
            </div>
          </motion.div>

          <motion.div
            whileHover={{ y: -8 }}
            className="md:col-span-1 bg-white border border-slate-200/60 rounded-[3rem] p-10 flex flex-col justify-center items-center text-center shadow-lg hover:shadow-2xl hover:shadow-sky-500/10 transition-all duration-500"
          >
            <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-sky-400 to-indigo-600 mb-2">5K+</div>
            <div className="text-slate-500 font-bold tracking-wide">分析节点</div>
          </motion.div>

          <motion.div
            whileHover={{ y: -8 }}
            className="md:col-span-2 bg-gradient-to-tr from-slate-50 to-slate-100 border border-slate-200/60 hover:border-violet-200 rounded-[3rem] p-10 md:p-14 shadow-lg hover:shadow-2xl transition-all duration-500 flex flex-col justify-between overflow-hidden relative group"
          >
            <div className="relative z-10">
              <div className="w-16 h-16 rounded-2xl bg-white text-violet-600 flex items-center justify-center mb-6 shadow-sm">
                <Fingerprint className="w-8 h-8" />
              </div>
              <h3 className="text-3xl font-extrabold text-slate-800 mb-3">深度用户画像</h3>
              <p className="text-lg text-slate-500">极其细致的用户影响力结构建模，剖析每一次有效交互的实际穿透力。</p>
            </div>
            <div className="absolute right-[-10%] bottom-[-20%] opacity-10 group-hover:scale-110 transition-transform duration-1000">
              <Fingerprint className="w-64 h-64 text-violet-900" />
            </div>
          </motion.div>

          {/* 中等卡片 3 - 改为浅色生态版 */}
          <motion.div
            whileHover={{ y: -8 }}
            className="md:col-span-2 bg-gradient-to-br from-teal-50 to-emerald-50 border border-teal-100/60 rounded-[3rem] p-10 md:p-14 shadow-lg hover:shadow-2xl hover:shadow-teal-500/10 relative overflow-hidden group transition-all duration-500"
          >
            <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.3)_50%,transparent_75%)] bg-[length:400%_400%] group-hover:animate-shimmer" />
            <div className="relative z-10 flex flex-col h-full justify-center">
              <div className="w-20 h-20 rounded-3xl justify-center mb-8">
                <Image src="/ascend.png" alt="昇腾" width={56} height={56} className="w-14 h-14 object-contain" />
              </div>
              <h3 className="text-3xl font-extrabold text-teal-900 mb-4">昇腾生态监测</h3>
              <p className="text-lg text-teal-700/80 max-w-sm mb-6">深入剖析 AI 算力开发者最核心的技术问答版块，掌控大盘温度与板块热点引擎。</p>
              <div className="inline-flex items-center gap-2 text-teal-600 font-bold bg-white/50 w-fit px-4 py-2 rounded-full backdrop-blur-sm border border-white">
                <Activity className="w-5 h-5" /> Live Matrix
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};


// ==========================================
// 3. 多角色卡片 (流畅的手风琴扩张版块)
// ==========================================
const RoleGuidesAccordion = () => {
  const [hoveredIndex, setHoveredIndex] = useState(0);

  const roles = [
    {
      id: "operations",
      label: '运营',
      desc: '精准打击预警点，实时转换社区热度',
      color: 'indigo',
      icon: <Users className="w-8 h-8" />,
      steps: ['进入趋势分析，筛选最近7天热点并设置预警阈值。', '观察活跃度变化，定位异常波动话题。', '将高热话题同步到活动池，快速制定运营动作。']
    },
    {
      id: "product",
      label: '产品',
      desc: '倾听用户真实反馈，迭代痛点功能',
      color: 'sky',
      icon: <Target className="w-8 h-8" />,
      steps: ['从趋势分析中提取高频痛点关键词，建立需求候选。', '查看高价值创意提案与关键用户观点。', '结合用户画像判断优先级，沉淀迭代计划。']
    },
    {
      id: "management",
      label: '管理',
      desc: '总揽全盘基建健康度，复盘业务战略',
      color: 'violet',
      icon: <Presentation className="w-8 h-8" />,
      steps: ['通过总览指标快速掌握社区热度与质量变化。', '利用榜单识别核心贡献者与高潜业务方向。', '基于仪表盘复盘策略效果，按月追踪目标。']
    },
    {
      id: "dataEngineer",
      label: '数据',
      desc: '构建坚实底层数据堡垒，清洗挖掘报表',
      color: 'teal',
      icon: <Database className="w-8 h-8" />,
      steps: ['前往数据工作台，上传并同步各社区数据。', '在线浏览和编辑表格，进行自动化数据清洗。', '切换到BI探索，一键生成可视化分析图表。']
    }
  ];

  return (
    <div className="py-24 bg-white relative z-10 border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-6">
        <div className="mb-16 text-center">
          <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter mb-4">为所有角色赋予能力</h2>
          <p className="text-xl text-slate-500">打破部门数据孤岛，每一位成员都将成为敏锐的分析专家。</p>
        </div>

        <div className="flex flex-col md:flex-row gap-4 h-[600px] w-full">
          {roles.map((role, idx) => {
            const isHovered = hoveredIndex === idx;
            const bgGradientMap = {
              indigo: 'from-indigo-600/5 to-indigo-100/40 border-indigo-200/60',
              sky: 'from-sky-600/5 to-sky-100/40 border-sky-200/60',
              violet: 'from-violet-600/5 to-violet-100/40 border-violet-200/60',
              teal: 'from-teal-600/5 to-teal-100/40 border-teal-200/60',
            };
            const activeColorMap = {
              indigo: 'bg-indigo-600 text-white',
              sky: 'bg-sky-500 text-white',
              violet: 'bg-violet-600 text-white',
              teal: 'bg-teal-500 text-white',
            };
            const inactiveColorMap = {
              indigo: 'bg-indigo-50 text-indigo-500',
              sky: 'bg-sky-50 text-sky-500',
              violet: 'bg-violet-50 text-violet-500',
              teal: 'bg-teal-50 text-teal-500',
            };

            return (
              <motion.div
                key={role.id}
                onMouseEnter={() => setHoveredIndex(idx)}
                layout
                initial={{ borderRadius: "2rem" }}
                animate={{
                  flex: isHovered ? 4 : 1,
                  borderRadius: "2rem"
                }}
                transition={{ type: "spring", bounce: 0.2, duration: 0.8 }}
                className={`relative overflow-hidden cursor-pointer flex flex-col items-center justify-start p-8 md:p-10 border bg-gradient-to-br ${bgGradientMap[role.color]}`}
              >
                {/* 角色图标始终在上方 */}
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 mb-6 transition-all duration-500 ${isHovered ? activeColorMap[role.color] + ' shadow-lg scale-110' : inactiveColorMap[role.color]}`}>
                  {role.icon}
                </div>

                <motion.h3
                  layout="position"
                  className={`text-2xl md:text-3xl font-black ${isHovered ? 'text-slate-900 mb-2' : 'text-slate-500 rotate-0 md:rotate-90 md:mt-10 md:origin-center whitespace-nowrap'}`}
                >
                  {role.label}视角
                </motion.h3>

                <AnimatePresence>
                  {isHovered && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.4, delay: 0.1 }}
                      className="w-full flex-1 flex flex-col mt-4 min-w-[250px]"
                    >
                      <p className="text-slate-600 font-medium mb-8 text-center">{role.desc}</p>
                      <div className="space-y-4 w-full">
                        {role.steps.map((step, sIdx) => (
                          <div key={sIdx} className="w-full bg-white/60 backdrop-blur-md rounded-2xl p-4 flex gap-4 border border-white items-start">
                            <div className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-xs font-bold ${activeColorMap[role.color]}`}>
                              {sIdx + 1}
                            </div>
                            <span className="text-slate-700 font-medium leading-relaxed">{step}</span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ==========================================
// 4. 时空剥离体验 (Pinned ScrollyTelling)
// ==========================================
const ScrollyTellingSection = () => {
  const wrapperRef = useRef(null);

  const { scrollYProgress } = useScroll({
    target: wrapperRef,
    offset: ["start start", "end end"]
  });

  // 添加显示控制，使用 visibility 防止打断 framer-motion 的监听，同时达到防重叠的效果
  const visibility1 = useTransform(scrollYProgress, [0, 0.32, 0.33], ['visible', 'visible', 'hidden']);
  const visibility2 = useTransform(scrollYProgress, (v) => (v >= 0.26 && v <= 0.68 ? 'visible' : 'hidden'));
  const visibility3 = useTransform(scrollYProgress, [0, 0.6, 0.61], ['hidden', 'hidden', 'visible']);

  // 第一幕参数 Phase 1 (0 -> 0.3)
  const dotScale = useTransform(scrollYProgress, [0.0, 0.2, 0.3], [1, 2, 0]);
  const text1Opacity = useTransform(scrollYProgress, [0, 0.2, 0.3], [1, 1, 0]);
  const text1Y = useTransform(scrollYProgress, [0, 0.2, 0.3], [0, 0, -30]);

  // 第二幕参数 Phase 2 (0.3 -> 0.6)
  const linePathLength = useTransform(scrollYProgress, [0.3, 0.5, 0.66], [0, 1, 0]);
  const text2Opacity = useTransform(scrollYProgress, [0.3, 0.4, 0.55, 0.65], [0, 1, 1, 0]);
  const text2Y = useTransform(scrollYProgress, [0.3, 0.4, 0.55, 0.65], [30, 0, 0, -30]);

  // 第三幕参数 Phase 3 (0.6 -> 1.0)
  const explosionScale = useTransform(scrollYProgress, [0.66, 0.85, 1], [0, 10, 10]);
  const explosionOpacity = useTransform(scrollYProgress, [0.66, 0.85, 0.95, 1], [0, 0.8, 1, 0]);
  const text3Opacity = useTransform(scrollYProgress, [0.66, 0.75, 0.9, 1], [0, 1, 1, 0]);
  const text3Y = useTransform(scrollYProgress, [0.66, 0.75, 0.9, 1], [30, 0, 0, -30]);

  const titleOpacity = useTransform(scrollYProgress, [0.85, 0.95], [1, 0]);

  return (
    <section ref={wrapperRef} className="h-[400vh] relative bg-slate-50">
      <div className="sticky top-0 h-screen flex flex-col items-center justify-center overflow-hidden">

        <motion.div style={{ opacity: titleOpacity }} className="mb-12 text-center">
          <h2 className="text-4xl md:text-5xl font-black text-slate-800">在滚动中探索 <span className="text-indigo-600">运营时空</span></h2>
          <p className="text-lg text-slate-500 mt-4">停留，注视，滚动鼠标。见证杂乱信息升华为决断力的全过程。</p>
        </motion.div>

        <div className="relative w-[90vw] md:w-[70vw] lg:w-[60vw] h-[50vh] md:h-[60vh] bg-white border border-slate-200/80 rounded-[3rem] shadow-[0_30px_100px_-20px_rgba(79,70,229,0.15)] overflow-hidden flex flex-col items-center justify-center">

          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-50 to-transparent" />

          {/* Canvas 对于 SVG */}
          <svg viewBox="0 0 400 400" className="absolute w-full h-full max-h-full opacity-80 pointer-events-none">
            {/* 幕一：原初散点收集 */}
            <motion.g style={{ scale: dotScale, visibility: visibility1, transformOrigin: '200px 200px' }}>
              <circle cx="100" cy="150" r="10" fill="#cbd5e1" />
              <circle cx="120" cy="250" r="15" fill="#cbd5e1" />
              <circle cx="300" cy="100" r="12" fill="#cbd5e1" />
              <circle cx="280" cy="300" r="20" fill="#cbd5e1" />
              <circle cx="200" cy="200" r="5" fill="#94a3b8" />
            </motion.g>

            {/* 幕二：神经互联网络生成 */}
            <motion.g stroke="#6366f1" strokeWidth="4" strokeLinecap="round" style={{ visibility: visibility2, opacity: text2Opacity }}>
              <motion.path d="M100 150 L200 200 L300 100" style={{ pathLength: linePathLength }} />
              <motion.path d="M120 250 L200 200 L280 300" style={{ pathLength: linePathLength }} />
              <motion.path d="M100 150 L120 250" style={{ pathLength: linePathLength }} opacity="0.3" />
              <motion.path d="M300 100 L280 300" style={{ pathLength: linePathLength }} opacity="0.3" />
            </motion.g>

            {/* 幕三：超新星结晶爆发 */}
            <motion.g style={{ scale: explosionScale, opacity: explosionOpacity, visibility: visibility3, transformOrigin: '200px 200px' }}>
              <circle cx="200" cy="200" r="30" fill="url(#coreGlow)" />
              <defs>
                <radialGradient id="coreGlow">
                  <stop offset="0%" stopColor="#818cf8" stopOpacity="1" />
                  <stop offset="100%" stopColor="#4f46e5" stopOpacity="0" />
                </radialGradient>
              </defs>
            </motion.g>
          </svg>

          {/* 中枢文案浮层 */}
          <div className="relative z-20 w-full flex items-center justify-center">
            <motion.div
              style={{ opacity: text1Opacity, y: text1Y, visibility: visibility1 }}
              className="absolute z-10 text-2xl md:text-4xl font-black text-slate-800 bg-white/70 backdrop-blur-xl px-10 py-6 text-center border border-white rounded-[2rem] shadow-xl"
            >
              <div className="text-xl text-slate-500 font-bold mb-2">Phase 01</div>
              无序的社区交互<span className="text-sky-500">散点捕捉</span>
            </motion.div>


            <motion.div
              style={{ opacity: text3Opacity, y: text3Y, visibility: visibility3 }}
              className="absolute z-20 text-2xl md:text-4xl font-black text-white bg-indigo-600/90 backdrop-blur-xl px-10 py-6 text-center border border-indigo-400/50 rounded-[2rem] shadow-xl shadow-indigo-600/30"
            >
              <div className="text-xl text-indigo-200 font-bold mb-2">Phase 02</div>
              输出<span className="text-white">高潜业务行动派</span>
            </motion.div>
          </div>

        </div>
      </div>
    </section>
  );
};


// ==========================================
// 5. 发射控制台 (Footer CTA)
// ==========================================
const CallToAction = () => {
  return (
    <div className="bg-slate-50 py-40 px-6 overflow-hidden relative">
      <div className="max-w-4xl mx-auto text-center relative z-10">
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 30 }}
          whileInView={{ scale: 1, opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ type: "spring", stiffness: 50 }}
        >
          <h2 className="text-5xl md:text-7xl font-black tracking-tighter text-slate-900 mb-8">
            未来，源自此刻的洞察。
          </h2>
          <p className="text-xl md:text-2xl text-slate-500 font-medium mb-12">
            全面支持华为开发者生态与昇腾产品线。
          </p>
          <Link href="/login">
            <button className="group relative inline-flex h-16 items-center justify-center overflow-hidden rounded-full bg-slate-900 px-12 font-bold text-white text-lg transition-transform hover:scale-105 active:scale-95 shadow-xl shadow-slate-900/20">
              <span className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-500 to-transparent transition-all group-hover:h-full group-hover:opacity-20" />
              开启 InsightAI 终端
            </button>
          </Link>
        </motion.div>
      </div>
    </div>
  )
}

// 主页面入口
export default function WelcomePage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#fafafc] font-sans selection:bg-indigo-300/40">

      {/* 极简全局 Navbar */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-500 ${scrolled ? 'bg-white/70 backdrop-blur-xl border-b border-white shadow-sm py-4' : 'bg-transparent py-6'}`}>
        <div className="container mx-auto px-8 max-w-7xl flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Image src="/logo.svg" alt="Logo" width={40} height={40} className="rounded-xl shadow-sm" />
            <span className="text-xl font-extrabold tracking-tight text-slate-900 text-transparent bg-clip-text bg-gradient-to-br from-indigo-600 via-sky-500 to-teal-400 drop-shadow-sm">InsightAI</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/console/leaderboard" className="hidden sm:block text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors">
              榜单开放中心
            </Link>
            <Link href="/login" className="text-sm font-bold bg-white border border-slate-200 text-slate-800 px-5 py-2.5 rounded-full hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm">
              进入系统
            </Link>
          </div>
        </div>
      </nav>

      <HeroSection />

      <BentoBoxSection />

      {/* 崭新加入的角色扩张手风琴组件 */}
      <RoleGuidesAccordion />

      <ScrollyTellingSection />

      <CallToAction />

      <footer className="bg-white py-10 border-t border-slate-100 text-center text-slate-500 text-sm font-medium">
        © 2026 本科毕业设计专用系统<br />
        <span className="text-slate-400 mt-2 block">Powered by Next.js 15 & Framer Motion</span>
      </footer>

    </div>
  );
}
