'use client';

import { useState, useEffect } from 'react';
import { Modal, Tabs, Spin, Empty, Radio, Select } from 'antd';
import {
  MessageSquare, FileText, HelpCircle, ThumbsUp, Eye,
  MessageCircle, Clock, ExternalLink, User
} from 'lucide-react';

/**
 * 用户详情弹窗组件
 * 展示用户发布的话题、话题评论和问答评论
 *
 * @param {boolean} open - 是否显示弹窗
 * @param {string} userName - 用户名
 * @param {function} onClose - 关闭回调
 */
export default function UserDetailModal({ open, userName, onClose }) {
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
      const res = await fetch(`/api/huawei/user-detail?user_name=${encodeURIComponent(name)}&t=${Date.now()}`);
      if (!res.ok) throw new Error(`请求失败: ${res.status}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || '获取用户详情失败');
      setData(json.data);
    } catch (e) {
      console.error('获取用户详情失败:', e);
      setError(e.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  // 格式化时间
  const formatTime = (timeStr) => {
    if (!timeStr) return '未知';
    try {
      const d = new Date(timeStr);
      if (isNaN(d.getTime())) return timeStr;
      return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
    } catch {
      return timeStr;
    }
  };

  const stats = data?.stats || {};

  // 话题卡片
  const renderTopicCard = (topic, idx) => (
    <div
      key={topic.id || idx}
      className="group p-4 rounded-xl bg-white border border-slate-100 hover:border-indigo-200 hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-slate-800 mb-1 line-clamp-2 group-hover:text-indigo-600 transition-colors">
            {topic.title || '无标题'}
          </h4>
          {topic.summary && (
            <p className="text-sm text-slate-500 line-clamp-2 mb-3">{topic.summary}</p>
          )}
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <Eye className="w-3.5 h-3.5" />
              {topic.views || 0}
            </span>
            <span className="flex items-center gap-1">
              <ThumbsUp className="w-3.5 h-3.5" />
              {topic.likes || 0}
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle className="w-3.5 h-3.5" />
              {topic.comments || 0}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {formatTime(topic.release_time)}
            </span>
          </div>
        </div>
        {topic.url && (
          <a
            href={topic.url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
            title="查看原文"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
      </div>
    </div>
  );

  // 评论卡片（话题评论 / 问答评论）
  const renderCommentCard = (comment, idx) => {
    const isQuestion = comment.source === 'question';
    const parentTitle = isQuestion ? comment.question_title : comment.topic_title;
    const parentUrl = isQuestion ? comment.question_url : comment.topic_url;

    return (
      <div
        key={comment.comment_id || idx}
        className="group p-4 rounded-xl bg-white border border-slate-100 hover:border-violet-200 hover:shadow-md transition-all"
      >
        {/* 所属话题/问答标题 */}
        <div className="flex items-center gap-2 mb-2">
          <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${isQuestion
              ? 'bg-amber-50 text-amber-600 border border-amber-200'
              : 'bg-indigo-50 text-indigo-600 border border-indigo-200'
            }`}>
            {isQuestion ? '问答' : '话题'}
          </span>
          <span className="text-xs text-slate-500 truncate flex-1" title={parentTitle}>
            {parentTitle || '未知话题'}
          </span>
          {parentUrl && (
            <a
              href={parentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-slate-400 hover:text-indigo-600 transition-colors"
              title="查看原帖"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>

        {/* 评论内容 */}
        <p className="text-sm text-slate-700 mb-2 line-clamp-3 leading-relaxed">
          {comment.content || '（空评论）'}
        </p>

        {/* 底部信息 */}
        <div className="flex items-center gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <ThumbsUp className="w-3.5 h-3.5" />
            {comment.like_count || 0}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {formatTime(comment.create_time)}
          </span>
        </div>
      </div>
    );
  };

  // 合并所有评论（话题评论 + 问答评论）
  let allComments = [
    ...(data?.topic_comments || []),
    ...(data?.question_comments || []),
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
        <span className="flex items-center gap-1.5">
          <FileText className="w-4 h-4" />
          发布的话题
          <span className="ml-1 px-1.5 py-0.5 text-xs bg-slate-100 text-slate-600 rounded-full">
            {stats.topic_count || 0}
          </span>
        </span>
      ),
      children: (
        <div className="max-h-[55vh] overflow-y-auto pr-1 space-y-3">
          {(data?.topics?.length || 0) === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="暂无话题"
              className="py-8"
            />
          ) : (
            data.topics.map((topic, idx) => renderTopicCard(topic, idx))
          )}
        </div>
      ),
    },
    {
      key: 'comments',
      label: (
        <span className="flex items-center gap-1.5">
          <MessageSquare className="w-4 h-4" />
          发表的评论
          <span className="ml-1 px-1.5 py-0.5 text-xs bg-slate-100 text-slate-600 rounded-full">
            {(stats.topic_comment_count || 0) + (stats.question_comment_count || 0)}
          </span>
        </span>
      ),
      children: (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-100">
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
          <div className="max-h-[50vh] overflow-y-auto pr-1 space-y-3">
            {allComments.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="暂无评论"
                className="py-8"
              />
            ) : (
              allComments.map((comment, idx) => renderCommentCard(comment, idx))
            )}
          </div>
        </div>
      ),
    },
  ];

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={720}
      centered
      // destroyOnClose
      destroyOnHidden
      title={
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md">
            <User className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-lg font-bold text-slate-800">{userName}</div>
            <div className="text-xs text-slate-500 font-normal">用户动态详情</div>
          </div>
        </div>
      }
    >
      {/* 统计卡片 */}
      {!loading && data && (
        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="text-center p-2.5 bg-indigo-50 rounded-xl border border-indigo-100">
            <div className="text-lg font-bold text-indigo-600">{stats.topic_count || 0}</div>
            <div className="text-xs text-slate-500">话题</div>
          </div>
          <div className="text-center p-2.5 bg-violet-50 rounded-xl border border-violet-100">
            <div className="text-lg font-bold text-violet-600">{stats.topic_comment_count || 0}</div>
            <div className="text-xs text-slate-500">话题评论</div>
          </div>
          <div className="text-center p-2.5 bg-amber-50 rounded-xl border border-amber-100">
            <div className="text-lg font-bold text-amber-600">{stats.question_comment_count || 0}</div>
            <div className="text-xs text-slate-500">问答评论</div>
          </div>
          <div className="text-center p-2.5 bg-rose-50 rounded-xl border border-rose-100">
            <div className="text-lg font-bold text-rose-600">{stats.total_likes || 0}</div>
            <div className="text-xs text-slate-500">总获赞</div>
          </div>
        </div>
      )}

      {/* 内容区域 */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Spin size="large" tip="加载中...">
            <div className="p-8" />
          </Spin>
        </div>
      ) : error ? (
        <div className="py-8 text-center">
          <div className="text-rose-500 font-medium mb-2">加载失败</div>
          <div className="text-sm text-slate-400">{error}</div>
        </div>
      ) : data ? (
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          className="user-detail-tabs"
        />
      ) : null}
    </Modal>
  );
}
