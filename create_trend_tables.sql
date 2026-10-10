-- 创建趋势分析报告主表
CREATE TABLE IF NOT EXISTS trend_reports (
    id SERIAL PRIMARY KEY,
    query TEXT NOT NULL,
    summary TEXT,
    content TEXT,
    overall_sentiment VARCHAR(16),
    sentiment_score INTEGER,
    sentiment_distribution TEXT,
    add_ts BIGINT NOT NULL
);

-- 创建热点话题表
CREATE TABLE IF NOT EXISTS trend_topics (
    id SERIAL PRIMARY KEY,
    report_id INTEGER REFERENCES trend_reports(id) ON DELETE CASCADE,
    topic VARCHAR(255) NOT NULL,
    category VARCHAR(64),
    trend VARCHAR(16),
    mentions INTEGER,
    sentiment INTEGER,
    description TEXT
);

-- 创建分析维度表
CREATE TABLE IF NOT EXISTS trend_dimensions (
    id SERIAL PRIMARY KEY,
    report_id INTEGER REFERENCES trend_reports(id) ON DELETE CASCADE,
    dimension VARCHAR(255),
    summary TEXT,
    key_points TEXT
);

-- 添加注释（可选）
COMMENT ON TABLE trend_reports IS '趋势分析报告主表';
COMMENT ON COLUMN trend_reports.query IS '分析的主题/查询词';
COMMENT ON COLUMN trend_reports.add_ts IS '创建时间戳';

COMMENT ON TABLE trend_topics IS '趋势分析热点话题表';
COMMENT ON COLUMN trend_topics.trend IS '趋势方向 (up/down/stable)';
COMMENT ON COLUMN trend_topics.mentions IS '讨论热度/提及数';

COMMENT ON TABLE trend_dimensions IS '趋势分析维度表';
COMMENT ON COLUMN trend_dimensions.key_points IS '关键点列表 JSON 字符串';