'use client';

import { useState, useEffect } from 'react';
import { Modal, Tabs, Spin, Empty, Tag, Radio, Select } from 'antd';
import {
  MessageSquare, FileText, HelpCircle, ThumbsUp,
  Clock, ExternalLink, User, CheckCircle2, Layers,
} from 'lucide-react';

/**
 * 昇腾用户详情弹窗
 * 展示用户的话题、话题评论、问答评论（标注被采纳状态）
 *
 * @param {boolean} open
 * @param {string} userName
 * @param {function} onClose
 */
export default function AscendUserDetailModal({ open, userName, onClose }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState('topics');
  const [commentSort, setCommentSort] = useState('time_desc');
  const [commentFilter, setCommentFilter] = useState('all');

  useEffect(() => {
    if (open && userName) {
      fetchUserDetail(userName);
      setActiveTab('topics');
    }
    if (!open) {
      setData(null);
      setError(null);
    }
  }, [open, userName]);

  const fetchUserDetail = async (name) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/ascend/user-detail?user_name=${encodeURIComponent(name)}&t=${Date.now()}`);
      if (!res.ok) throw new Error(`请求失败: ${res.status}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || '获取用户详情失败');
      setData(json.data);
    } catch (e) {
      console.error('获取昇腾用户详情失败:', e);
      setError(e.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timeStr) => {
    if (!timeStr || timeStr === 'None') return '未知';
    try {
      const d = new Date(timeStr);
      if (isNaN(d.getTime())) return timeStr;
      return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
    } catch {
      return timeStr;
    }
  };

  const stats = data?.stats || {};

  // 处理合并评论数据
  let allComments = [
    ...(data?.topic_comments || []).map(c => ({...c, source: 'topic'})),
    ...(data?.question_comments || []).map(c => ({...c, source: 'question'})),
  ];

  if (commentFilter === 'topic') {
    allComments = allComments.filter(c => c.source !== 'question');
  } else if (commentFilter === 'question') {
    allComments = allComments.filter(c => c.source === 'question');
  }

  allComments.sort((a, b) => {
    if (commentSort === 'time_desc') {
        return new Date(b.create_time || 0).getTime() - new Date(a.create_time || 0).getTime();
    } else if (commentSort === 'time_asc') {
        return new Date(a.create_time || 0).getTime() - new Date(b.create_time || 0).getTime();
    } else if (commentSort === 'length_desc') {
        return (b.content || '').length - (a.content || '').length;
    } else if (commentSort === 'length_asc') {
        return (a.content || '').length - (b.content || '').length;
    }
    return 0;
  });

  const tabItems = [
    {
      key: 'topics',
      label: (
        <span className="flex items-center gap-1.5 text-sm">
          <FileText className="w-3.5 h-3.5" />
          发布话题 ({stats.topic_count || 0})
        </span>
      ),
      children: renderTopics(data?.topics || [], formatTime),
    },
    {
      key: 'comments',
      label: (
        <span className="flex items-center gap-1.5 text-sm">
          <MessageSquare className="w-3.5 h-3.5" />
          发表的评论 ({(stats.topic_comment_count || 0) + (stats.question_comment_count || 0)})
        </span>
      ),
      children: (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between bg-sky-50/50 p-2 rounded-lg border border-sky-100">
            <Radio.Group 
              value={commentFilter} 
              onChange={e => setCommentFilter(e.target.value)}
              size="small"
              optionType="button"
              buttonStyle="solid"
            >
              <Radio.Button value="all">全部</Radio.Button>
              <Radio.Button value="topic">话题评论</Radio.Button>
              <Radio.Button value="question">问答评论</Radio.Button>
            </Radio.Group>
            
            <Select
              value={commentSort}
              onChange={setCommentSort}
              size="small"
              options={[
                { value: 'time_desc', label: '最新时间' },
                { value: 'time_asc', label: '最早时间' },
                { value: 'length_desc', label: '字数最多' },
                { value: 'length_asc', label: '字数最少' },
              ]}
              style={{ width: 110 }}
            />
          </div>
          {renderComments(allComments, formatTime, '符合条件的评论')}
        </div>
      )
    },
  ];

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center">
            <User className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="text-base font-bold">{userName || '用户详情'}</span>
            <span className="text-xs text-slate-400 ml-2 font-normal">昇腾社区</span>
          </div>
        </div>
      }
      footer={null}
      width={800}
      centered
      destroyOnHidden
    >
      {loading ? (
        <div className="flex justify-center items-center py-16">
          <Spin size="large" tip="正在加载用户详情..." >
            <div className="p-12" />
          </Spin>
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 my-4">
          <div className="font-semibold text-rose-700">加载失败</div>
          <div className="text-sm text-rose-600 mt-1">{error}</div>
        </div>
      ) : data ? (
        <div>
          {/* 汇总统计 */}
          <div className="grid grid-cols-4 gap-3 mb-4">
            {[
              { label: '话题数', value: stats.topic_count, color: 'bg-sky-50 text-sky-600' },
              { label: '评论数', value: (stats.topic_comment_count || 0) + (stats.question_comment_count || 0), color: 'bg-violet-50 text-violet-600' },
              { label: '获赞数', value: stats.total_likes, color: 'bg-amber-50 text-amber-600' },
              { label: '被采纳', value: stats.adopted_count, color: 'bg-emerald-50 text-emerald-600' },
            ].map((s, i) => (
              <div key={i} className={`text-center p-3 rounded-xl ${s.color}`}>
                <div className="text-lg font-bold">{s.value ?? 0}</div>
                <div className="text-xs mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
          <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} size="small" />
        </div>
      ) : null}
    </Modal>
  );
}

function renderTopics(topics, formatTime) {
  if (!topics.length) return <Empty description="暂无话题" className="py-8" />;
  return (
    <div className="max-h-[400px] overflow-y-auto space-y-3 pr-1">
      {topics.map((t) => (
        <div key={t.id} className="p-3 rounded-xl border border-slate-100 hover:border-sky-200 hover:bg-sky-50/30 transition-all">
          <div className="flex items-center gap-2 justify-between">
            <span className="font-medium text-slate-800 text-sm flex-1 line-clamp-2">{t.title || t.id}</span>
            {t.url && (
              <a href={t.url} target="_blank" rel="noreferrer" className="text-sky-500 hover:text-sky-700 shrink-0">
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
          {t.summary && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{t.summary}</p>}
          <div className="flex items-center gap-3 mt-2 text-xs text-slate-400 flex-wrap">
            {t.is_question === 1 && <Tag color="orange" className="text-xs">问答</Tag>}
            {t.section_name && <Tag color="blue" className="text-xs">{t.section_name}</Tag>}
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatTime(t.release_time)}</span>
            <span>{t.views} 浏览</span>
            <span>{t.likes} 赞</span>
            <span>{t.comments} 评论</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function renderComments(comments, formatTime, emptyText) {
  if (!comments.length) return <Empty description={`暂无${emptyText}`} className="py-8" />;
  return (
    <div className="max-h-[400px] overflow-y-auto space-y-3 pr-1">
      {comments.map((c, idx) => {
        const topicTitle = c.topic_title || c.question_title || '';
        const topicUrl = c.topic_url || c.question_url || '';
        return (
          <div key={c.comment_id || idx} className="p-3 rounded-xl border border-slate-100 hover:border-sky-200 hover:bg-sky-50/30 transition-all">
            {/* 引用来源 */}
            <div className="text-xs text-slate-400 mb-1.5 flex items-center gap-1">
              <Layers className="w-3 h-3" />
              {topicTitle ? (
                topicUrl ? (
                  <a href={topicUrl} target="_blank" rel="noreferrer" className="text-sky-500 hover:underline truncate">{topicTitle}</a>
                ) : <span className="truncate">{topicTitle}</span>
              ) : '未知话题'}
              {c.section_name && <Tag color="blue" className="text-xs ml-1">{c.section_name}</Tag>}
            </div>
            {/* 评论内容 */}
            <div className="text-sm text-slate-700 line-clamp-3">{c.content || '(空内容)'}</div>
            <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatTime(c.create_time)}</span>
              <span className="flex items-center gap-1"><ThumbsUp className="w-3 h-3" />{c.like_count ?? 0} 赞</span>
              {c.adopted === 1 && (
                <span className="flex items-center gap-1 text-emerald-600 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />已被采纳
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
