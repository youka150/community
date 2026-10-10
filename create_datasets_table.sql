-- 数据工作台：上传的数据集表
-- columns: JSONB 数组，每项 { key, title, type }
-- data: JSONB 数组，每项为一行数据 { [columnKey]: value }

CREATE TABLE IF NOT EXISTS uploaded_datasets (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  file_name VARCHAR(255),
  columns JSONB NOT NULL,
  data JSONB NOT NULL,
  row_count INTEGER DEFAULT 0,
  uploaded_by VARCHAR(64),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 为常用查询添加索引
CREATE INDEX IF NOT EXISTS idx_uploaded_datasets_created_at ON uploaded_datasets (created_at DESC);
