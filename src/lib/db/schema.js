import { pgTable, serial, varchar, bigint, text, integer, timestamp, jsonb } from 'drizzle-orm/pg-core';

/**
 * B站UP主信息表
 */
export const bilibiliUpInfo = pgTable('bilibili_up_info', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 64 }),
  nickname: varchar('nickname', { length: 64 }),
  sex: varchar('sex', { length: 64 }),
  sign: text('sign'),
  avatar: varchar('avatar', { length: 255 }),
  addTs: bigint('add_ts', { mode: 'number' }).notNull(),
  lastModifyTs: bigint('last_modify_ts', { mode: 'number' }).notNull(),
  totalFans: bigint('total_fans', { mode: 'number' }),
  totalLiked: bigint('total_liked', { mode: 'number' }),
  userRank: integer('user_rank'),
  isOfficial: integer('is_official'),
});

/**
 * B站视频表
 */
export const bilibiliVideo = pgTable('bilibili_video', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 64 }),
  nickname: varchar('nickname', { length: 64 }),
  avatar: varchar('avatar', { length: 255 }),
  addTs: bigint('add_ts', { mode: 'number' }).notNull(),
  lastModifyTs: bigint('last_modify_ts', { mode: 'number' }).notNull(),
  videoId: varchar('video_id', { length: 64 }).notNull(),
  videoType: varchar('video_type', { length: 16 }).notNull(),
  title: varchar('title', { length: 500 }),
  desc: text('desc'),
  createTime: bigint('create_time', { mode: 'number' }).notNull(),
  likedCount: varchar('liked_count', { length: 16 }),
  dislikedCount: varchar('disliked_count', { length: 16 }),
  videoPlayCount: varchar('video_play_count', { length: 16 }),
  videoFavoriteCount: varchar('video_favorite_count', { length: 16 }),
  videoShareCount: varchar('video_share_count', { length: 16 }),
  videoCoinCount: varchar('video_coin_count', { length: 16 }),
  videoDanmaku: varchar('video_danmaku', { length: 16 }),
  videoComment: varchar('video_comment', { length: 16 }),
  videoUrl: varchar('video_url', { length: 512 }),
  videoCoverUrl: varchar('video_cover_url', { length: 512 }),
  sourceKeyword: varchar('source_keyword', { length: 255 }),
});

/**
 * B站视频评论表
 */
export const bilibiliVideoComment = pgTable('bilibili_video_comment', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 64 }),
  nickname: varchar('nickname', { length: 64 }),
  sex: varchar('sex', { length: 64 }),
  sign: text('sign'),
  avatar: varchar('avatar', { length: 255 }),
  addTs: bigint('add_ts', { mode: 'number' }).notNull(),
  lastModifyTs: bigint('last_modify_ts', { mode: 'number' }).notNull(),
  commentId: varchar('comment_id', { length: 64 }).notNull(),
  videoId: varchar('video_id', { length: 64 }).notNull(),
  content: text('content'),
  createTime: bigint('create_time', { mode: 'number' }).notNull(),
  subCommentCount: varchar('sub_comment_count', { length: 16 }).notNull(),
  parentCommentId: varchar('parent_comment_id', { length: 64 }),
  likeCount: varchar('like_count', { length: 255 }).default('0').notNull(),
});


/**
 * 抖音博主信息表
 */
export const douyinCreator = pgTable('dy_creator', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 128 }).notNull(),
  nickname: varchar('nickname', { length: 64 }),
  avatar: varchar('avatar', { length: 255 }),
  ipLocation: varchar('ip_location', { length: 255 }),
  addTs: bigint('add_ts', { mode: 'number' }).notNull(),
  lastModifyTs: bigint('last_modify_ts', { mode: 'number' }).notNull(),
  desc: text('desc'),
  gender: varchar('gender', { length: 1 }),
  follows: varchar('follows', { length: 16 }),
  fans: varchar('fans', { length: 16 }),
  interaction: varchar('interaction', { length: 16 }),
  videosCount: varchar('videos_count', { length: 16 }),
});

/**
 * 小红书博主信息表
 */
export const xhsCreator = pgTable('xhs_creator', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 64 }).notNull(),
  nickname: varchar('nickname', { length: 64 }),
  avatar: varchar('avatar', { length: 255 }),
  ipLocation: varchar('ip_location', { length: 255 }),
  addTs: bigint('add_ts', { mode: 'number' }).notNull(),
  lastModifyTs: bigint('last_modify_ts', { mode: 'number' }).notNull(),
  desc: text('desc'),
  gender: varchar('gender', { length: 1 }),
  follows: varchar('follows', { length: 16 }),
  fans: varchar('fans', { length: 16 }),
  interaction: varchar('interaction', { length: 16 }),
  tagList: text('tag_list'),
});

/**
 * 微博博主信息表
 */
export const weiboCreator = pgTable('weibo_creator', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 64 }).notNull(),
  nickname: varchar('nickname', { length: 64 }),
  avatar: varchar('avatar', { length: 255 }),
  ipLocation: varchar('ip_location', { length: 255 }),
  addTs: bigint('add_ts', { mode: 'number' }).notNull(),
  lastModifyTs: bigint('last_modify_ts', { mode: 'number' }).notNull(),
  desc: text('desc'),
  gender: varchar('gender', { length: 2 }),
  follows: varchar('follows', { length: 16 }),
  fans: varchar('fans', { length: 16 }),
  tagList: text('tag_list'),
});

/**
 * 贴吧创作者信息表
 */
export const tiebaCreator = pgTable('tieba_creator', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 64 }).notNull(),
  userName: varchar('user_name', { length: 64 }).notNull(),
  nickname: varchar('nickname', { length: 64 }),
  avatar: varchar('avatar', { length: 255 }),
  ipLocation: varchar('ip_location', { length: 255 }),
  addTs: bigint('add_ts', { mode: 'number' }).notNull(),
  lastModifyTs: bigint('last_modify_ts', { mode: 'number' }).notNull(),
  gender: varchar('gender', { length: 2 }),
  follows: varchar('follows', { length: 16 }),
  fans: varchar('fans', { length: 16 }),
  registrationDuration: varchar('registration_duration', { length: 16 }),
});

/**
 * 知乎创作者信息表
 */
export const zhihuCreator = pgTable('zhihu_creator', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 64 }).notNull(),
  userLink: varchar('user_link', { length: 255 }).notNull(),
  userNickname: varchar('user_nickname', { length: 64 }).notNull(),
  userAvatar: varchar('user_avatar', { length: 255 }).notNull(),
  urlToken: varchar('url_token', { length: 64 }).notNull(),
  gender: varchar('gender', { length: 16 }),
  ipLocation: varchar('ip_location', { length: 64 }),
  follows: integer('follows').default(0).notNull(),
  fans: integer('fans').default(0).notNull(),
  anwserCount: integer('anwser_count').default(0).notNull(),
  videoCount: integer('video_count').default(0).notNull(),
  questionCount: integer('question_count').default(0).notNull(),
  articleCount: integer('article_count').default(0).notNull(),
  columnCount: integer('column_count').default(0).notNull(),
  getVoteupCount: integer('get_voteup_count').default(0).notNull(),
  addTs: bigint('add_ts', { mode: 'number' }).notNull(),
  lastModifyTs: bigint('last_modify_ts', { mode: 'number' }).notNull(),
});

/**
 * 知乎内容表
 */
export const zhihuContent = pgTable('zhihu_content', {
  id: serial('id').primaryKey(),
  contentId: varchar('content_id', { length: 64 }).notNull(),
  contentType: varchar('content_type', { length: 16 }).notNull(),
  contentText: text('content_text'),
  contentUrl: varchar('content_url', { length: 255 }).notNull(),
  questionId: varchar('question_id', { length: 64 }),
  title: varchar('title', { length: 255 }).notNull(),
  desc: text('desc'),
  createdTime: varchar('created_time', { length: 32 }).notNull(),
  updatedTime: varchar('updated_time', { length: 32 }).notNull(),
  voteupCount: integer('voteup_count').default(0).notNull(),
  commentCount: integer('comment_count').default(0).notNull(),
  sourceKeyword: varchar('source_keyword', { length: 64 }),
  userId: varchar('user_id', { length: 64 }).notNull(),
  userLink: varchar('user_link', { length: 255 }).notNull(),
  userNickname: varchar('user_nickname', { length: 64 }).notNull(),
  userAvatar: varchar('user_avatar', { length: 255 }).notNull(),
  userUrlToken: varchar('user_url_token', { length: 255 }).notNull(),
  addTs: bigint('add_ts', { mode: 'number' }).notNull(),
  lastModifyTs: bigint('last_modify_ts', { mode: 'number' }).notNull(),
});

/**
 * 知乎评论表
 */
export const zhihuComment = pgTable('zhihu_comment', {
  id: serial('id').primaryKey(),
  commentId: varchar('comment_id', { length: 64 }).notNull(),
  parentCommentId: varchar('parent_comment_id', { length: 64 }),
  content: text('content').notNull(),
  publishTime: varchar('publish_time', { length: 32 }).notNull(),
  ipLocation: varchar('ip_location', { length: 64 }),
  subCommentCount: integer('sub_comment_count').default(0).notNull(),
  likeCount: integer('like_count').default(0).notNull(),
  dislikeCount: integer('dislike_count').default(0).notNull(),
  contentId: varchar('content_id', { length: 64 }).notNull(),
  contentType: varchar('content_type', { length: 16 }).notNull(),
  userId: varchar('user_id', { length: 64 }).notNull(),
  userLink: varchar('user_link', { length: 255 }).notNull(),
  userNickname: varchar('user_nickname', { length: 64 }).notNull(),
  userAvatar: varchar('user_avatar', { length: 255 }).notNull(),
  addTs: bigint('add_ts', { mode: 'number' }).notNull(),
  lastModifyTs: bigint('last_modify_ts', { mode: 'number' }).notNull(),
});


/**
 * 趋势分析报告主表
 */
export const trendReports = pgTable('trend_reports', {
  id: serial('id').primaryKey(),
  query: text('query').notNull(),                 // 分析的主题/查询词
  summary: text('summary'),                       // 简短摘要
  content: text('content'),                       // 完整的Markdown报告内容
  overallSentiment: varchar('overall_sentiment', { length: 16 }), // 总体情感(positive/neutral/negative)
  sentimentScore: integer('sentiment_score'),     // 情感得分 (存储为 0-100 的整数)
  sentimentDistribution: text('sentiment_distribution'), // 情感分布 JSON 字符串
  addTs: bigint('add_ts', { mode: 'number' }).notNull(), // 创建时间戳
});

/**
 * 趋势分析热点话题表
 */
export const trendTopics = pgTable('trend_topics', {
  id: serial('id').primaryKey(),
  reportId: integer('report_id').references(() => trendReports.id), // 关联主表
  topic: varchar('topic', { length: 255 }).notNull(),
  category: varchar('category', { length: 64 }),
  trend: varchar('trend', { length: 16 }),        // 趋势方向 (up/down/stable)
  mentions: integer('mentions'),                  // 讨论热度/提及数
  sentiment: integer('sentiment'),                // 情感得分 (0-100)
  description: text('description'),               // 话题描述
});

/**
 * 趋势分析维度表
 */
export const trendDimensions = pgTable('trend_dimensions', {
  id: serial('id').primaryKey(),
  reportId: integer('report_id').references(() => trendReports.id),
  dimension: varchar('dimension', { length: 255 }),
  summary: text('summary'),                       // 维度分析摘要
  keyPoints: text('key_points'),                  // 关键点列表 JSON 字符串
});

/**
 * 华为开发者社区 - 话题（原始表）
 */
export const huaweiTopics = pgTable('topics', {
  id: varchar('id', { length: 255 }).primaryKey(),
  user: varchar('user', { length: 255 }),
  userLevel: varchar('user_level', { length: 255 }),
  title: text('title'),
  url: varchar('url', { length: 255 }),
  content: text('content'),
  likes: integer('likes'),
  comments: integer('comments'),
  views: integer('views'),
  releaseTime: varchar('release_time', { length: 255 }),
});

/**
 * 华为开发者社区 - 话题评论（原始表）
 */
export const huaweiTopicsComments = pgTable('topics_comments', {
  commentId: varchar('comment_id', { length: 255 }).primaryKey(),
  topicUrl: varchar('topic_url', { length: 255 }),
  topicId: varchar('topic_id', { length: 255 }),
  postId: varchar('post_id', { length: 255 }),
  parentPostId: varchar('parent_post_id', { length: 255 }),
  level: integer('level'),
  parentId: varchar('parent_id', { length: 255 }),
  floor: integer('floor'),
  user: varchar('user', { length: 255 }),
  avatar: varchar('avatar', { length: 255 }),
  content: text('content'),
  contentRaw: text('content_raw'),
  likeCount: integer('like_count'),
  commentCount: integer('comment_count'),
  createTime: timestamp('create_time', { mode: 'date' }),
  updateTime: timestamp('update_time', { mode: 'date' }),
  ipRaw: varchar('ip_raw', { length: 255 }),
  anonymous: integer('anonymous'),
});

/**
 * 华为开发者社区 - 问答（原始表）
 */
export const huaweiQuestions = pgTable('questions', {
  id: varchar('id', { length: 255 }).primaryKey(),
  title: text('title'),
  url: varchar('url', { length: 255 }),
  releasedTime: varchar('released_time', { length: 255 }),
  comments: integer('comments'),
  views: integer('views'),
  bounties: integer('bounties'),
  likes: integer('likes'),
  content: text('content'),
});

/**
 * 华为开发者社区 - 问答评论（原始表）
 */
export const huaweiQuestionsComments = pgTable('questions_comments', {
  commentId: varchar('comment_id', { length: 255 }).primaryKey(),
  topicUrl: varchar('topic_url', { length: 255 }),
  topicId: varchar('topic_id', { length: 255 }),
  postId: varchar('post_id', { length: 255 }),
  parentPostId: varchar('parent_post_id', { length: 255 }),
  level: integer('level'),
  parentId: text('parent_id'),
  floor: integer('floor'),
  user: varchar('user', { length: 255 }),
  avatar: varchar('avatar', { length: 255 }),
  content: text('content'),
  contentRaw: text('content_raw'),
  likeCount: integer('like_count'),
  commentCount: integer('comment_count'),
  createTime: timestamp('create_time', { mode: 'date' }),
  updateTime: timestamp('update_time', { mode: 'date' }),
  ipRaw: varchar('ip_raw', { length: 255 }),
  anonymous: integer('anonymous'),
});

/**
 * 数据工作台 — 上传的数据集
 * columns: JSON数组，每项 { key, title, type }
 * data: JSONB数组，每项为一行数据 { [columnKey]: value }
 */
export const uploadedDatasets = pgTable('uploaded_datasets', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),         // 数据集名称
  description: text('description'),                          // 描述
  fileName: varchar('file_name', { length: 255 }),           // 原始文件名
  columns: jsonb('columns').notNull(),                       // 列定义 [{ key, title, type }]
  data: jsonb('data').notNull(),                             // 行数据 [{ colKey: value, ... }]
  rowCount: integer('row_count').default(0),                 // 行数
  uploadedBy: varchar('uploaded_by', { length: 64 }),        // 上传者角色
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow(),
});
