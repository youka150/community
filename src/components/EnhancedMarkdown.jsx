'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// 统一的图表配色
const CHART_COLORS = {
  primary: '#6366f1',
  secondary: '#8b5cf6',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#06b6d4',
  muted: '#94a3b8'
};

const chartTooltipStyle = {
  backgroundColor: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
  boxShadow: '0 10px 40px -10px rgba(0,0,0,0.1)',
  padding: '12px 16px'
};

const getLanguageClassName = (className = '') => {
  const tokens = className.split(/\s+/).filter(Boolean);
  const languageToken = tokens.find((token) => token.startsWith('language-'));
  return languageToken || '';
};

// 从对象中安全地获取嵌套属性的辅助函数
const get = (obj, path, defaultValue = null) => {
  const keys = Array.isArray(path) ? path : path.split('.');
  const result = keys.reduce((xs, x) => (xs && xs[x] !== undefined ? xs[x] : defaultValue), obj);
  return result;
};


// 渲染情感分布柱状图
const renderSentimentBarChart = (data) => {
  if (!data) return <div className="text-sm text-red-500"></div>;
  const chartData = [{ name: '情感分布', ...data }];
  return (
    <ResponsiveContainer width="100%" height={100}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
        <YAxis type="category" dataKey="name" hide />
        <Tooltip contentStyle={chartTooltipStyle} />
        <Bar dataKey="positive" stackId="a" fill={CHART_COLORS.success} name="正面" />
        <Bar dataKey="neutral" stackId="a" fill={CHART_COLORS.muted} name="中立" />
        <Bar dataKey="negative" stackId="a" fill={CHART_COLORS.danger} name="负面" />
      </BarChart>
    </ResponsiveContainer>
  );
};

// 渲染热点话题提及量条形图
const renderHotTopicsBarChart = (data) => {
  if (!Array.isArray(data) || data.length === 0) return <div className="text-sm text-red-500"></div>;
  const chartData = [...data].sort((a, b) => b.mentions - a.mentions).slice(0, 7); // 只显示前7名
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" />
        <YAxis type="category" dataKey="topic" width={120} tick={{ fontSize: 12 }} />
        <Tooltip contentStyle={chartTooltipStyle} />
        <Legend />
        <Bar dataKey="mentions" fill={CHART_COLORS.primary} name="提及量" />
      </BarChart>
    </ResponsiveContainer>
  );
};


const EnhancedMarkdown = ({
  markdown,
  analysisData,
  className = '',
  customComponents = {},
  headingAnchorIds = []
}) => {
  if (!markdown) {
    return null;
  }

  // 渲染逻辑
  const renderContent = () => {
    // 修复 Markdown 标题缺失空格的问题，例如 ###Executive -> ### Executive
    const fixedMarkdown = markdown.replace(/^(#{1,6})([^#\s])/gm, '$1 $2');
    const chartRegex = /\[CHART-GENERATOR::(\{[\s\S]*?\})\]/g;
    const parts = fixedMarkdown.split(chartRegex);
    let headingCursor = 0;
    const nodeToIdMap = new WeakMap();

    const createHeadingRenderer = (Tag, className) => ({ node, ...props }) => {
      let currentHeadingId;
      if (node && nodeToIdMap.has(node)) {
        currentHeadingId = nodeToIdMap.get(node);
      } else {
        currentHeadingId = headingAnchorIds[headingCursor];
        headingCursor += 1;
        if (node) {
          nodeToIdMap.set(node, currentHeadingId);
        }
      }

      return <Tag id={currentHeadingId} className={className} {...props} />;
    };

    return parts.map((part, index) => {
      if (index % 2 === 1) {
        try {
          // 清理JSON字符串中的单引号并替换为双引号
          const cleanedJsonString = part.replace(/'/g, '"');
          const chartInstruction = JSON.parse(cleanedJsonString);
          const { chartType, dataKey } = chartInstruction;
          
          const chartData = get(analysisData, dataKey);
          
          switch (chartType) {
            case 'sentiment_distribution_bar':
              return <div key={index} className="my-8">{renderSentimentBarChart(chartData)}</div>;
            case 'hot_topics_bar':
              return <div key={index} className="my-8">{renderHotTopicsBarChart(chartData)}</div>;
            default:
              return <div key={index} className="text-sm text-yellow-500">[未知图表类型: {chartType}]</div>;
          }
        } catch (error) {
          console.error("图表指令解析失败:", error);
          return <div key={index} className="text-sm text-red-500">[图表指令解析失败]</div>;
        }
      } else {
        // 默认组件 + 外部传入的 customComponents 合并（外部优先）
        const defaultComponents = {
          h1: createHeadingRenderer('h1', 'text-xl font-bold text-indigo-700 mt-6 mb-3 break-words'),
          h2: createHeadingRenderer('h2', 'text-lg font-bold text-indigo-700 mt-5 mb-2 break-words'),
          h3: createHeadingRenderer('h3', 'text-base font-bold text-indigo-700 mt-4 mb-2 break-words'),
          h4: createHeadingRenderer('h4', 'text-base font-semibold text-indigo-700 mt-4 mb-2 break-words'),
          h5: createHeadingRenderer('h5', 'text-base font-semibold text-indigo-700 mt-4 mb-2 break-words'),
          h6: createHeadingRenderer('h6', 'text-base font-semibold text-indigo-700 mt-4 mb-2 break-words'),
          p: ({node, ...props}) => <p className="text-base text-slate-700 leading-relaxed mb-4 break-words" {...props} />,
          ul: ({node, ...props}) => <ul className="list-disc list-outside ml-5 mb-4 space-y-1 break-words" {...props} />,
          ol: ({node, ...props}) => <ol className="list-decimal list-outside ml-5 mb-4 space-y-1 break-words" {...props} />,
          li: ({node, ...props}) => <li className="text-base text-slate-700 break-words" {...props} />,
          a: ({node, ...props}) => <a className="text-indigo-600 underline break-all" target="_blank" rel="noreferrer" {...props} />,
          strong: ({node, ...props}) => <strong className="font-bold text-indigo-700 break-words" {...props} />,
          blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-indigo-200 pl-4 py-1 my-4 bg-indigo-50/50 rounded-r text-slate-600 italic break-words" {...props} />,
          code: ({inline, children, className: codeClassName, ...props}) => {
            const languageClassName = getLanguageClassName(codeClassName);
            const isInlineCode = inline ?? !languageClassName;

            if (isInlineCode) {
              return <code className="px-1.5 py-0.5 rounded-md border border-slate-200 bg-slate-100 text-slate-800 whitespace-nowrap" {...props}>{children}</code>;
            }
            return <code className={`font-mono text-[13px] leading-6 text-slate-800 ${languageClassName}`} {...props}>{children}</code>;
          },
          pre: ({node, ...props}) => <pre className="max-w-full overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 text-slate-800 p-4 my-4" {...props} />,
          table: ({node, ...props}) => (
            <div className="my-4 max-w-full overflow-x-auto">
              <table className="w-full table-auto border-collapse text-sm break-words" {...props} />
            </div>
          ),
          thead: ({node, ...props}) => <thead className="bg-slate-100" {...props} />,
          th: ({node, ...props}) => <th className="border border-slate-200 px-3 py-2 text-left align-top break-words" {...props} />,
          td: ({node, ...props}) => <td className="border border-slate-200 px-3 py-2 align-top break-words" {...props} />,
        };
        return (
          <ReactMarkdown 
            key={index} 
            remarkPlugins={[remarkGfm]}
            components={{ ...defaultComponents, ...customComponents }}
          >
            {part}
          </ReactMarkdown>
        );
      }
    });
  };

  const baseClassName = 'prose prose-indigo max-w-none';
  const mergedClassName = className ? `${baseClassName} ${className}` : baseClassName;

  return (
    <div className={mergedClassName}>
      {renderContent()}
    </div>
  );
};

export default EnhancedMarkdown;
