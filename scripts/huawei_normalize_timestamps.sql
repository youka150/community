-- Huawei 数据时间戳规范化（一次性执行即可）
-- 目标：把 topics.release_time / questions.released_time（varchar）统一成 timestamp 列，便于按日/周统计。
-- 注意：release_time 的具体字符串格式可能不一致；这里提供多种常见格式的解析尝试，你可以按实际数据再补充。

BEGIN;

-- 1) topics: release_at
ALTER TABLE IF EXISTS public.topics
  ADD COLUMN IF NOT EXISTS release_at TIMESTAMP;

UPDATE public.topics
SET release_at = COALESCE(
  release_at,
  -- 2026-01-18 12:34:56
  CASE
    WHEN release_time ~ '^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$'
      THEN to_timestamp(release_time, 'YYYY-MM-DD HH24:MI:SS')
    ELSE NULL
  END,
  -- 2026-01-18 12:34
  CASE
    WHEN release_time ~ '^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}$'
      THEN to_timestamp(release_time, 'YYYY-MM-DD HH24:MI')
    ELSE NULL
  END,
  -- 2026/01/18 12:34:56
  CASE
    WHEN release_time ~ '^\d{4}/\d{2}/\d{2}\s+\d{2}:\d{2}:\d{2}$'
      THEN to_timestamp(replace(release_time, '/', '-'), 'YYYY-MM-DD HH24:MI:SS')
    ELSE NULL
  END,
  -- 2026/01/18 12:34
  CASE
    WHEN release_time ~ '^\d{4}/\d{2}/\d{2}\s+\d{2}:\d{2}$'
      THEN to_timestamp(replace(release_time, '/', '-'), 'YYYY-MM-DD HH24:MI')
    ELSE NULL
  END
)
WHERE release_at IS NULL
  AND release_time IS NOT NULL
  AND length(trim(release_time)) >= 10;

CREATE INDEX IF NOT EXISTS idx_topics_release_at ON public.topics(release_at);

-- 2) questions: released_at
ALTER TABLE IF EXISTS public.questions
  ADD COLUMN IF NOT EXISTS released_at TIMESTAMP;

UPDATE public.questions
SET released_at = COALESCE(
  released_at,
  CASE
    WHEN released_time ~ '^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$'
      THEN to_timestamp(released_time, 'YYYY-MM-DD HH24:MI:SS')
    ELSE NULL
  END,
  CASE
    WHEN released_time ~ '^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}$'
      THEN to_timestamp(released_time, 'YYYY-MM-DD HH24:MI')
    ELSE NULL
  END,
  CASE
    WHEN released_time ~ '^\d{4}/\d{2}/\d{2}\s+\d{2}:\d{2}:\d{2}$'
      THEN to_timestamp(replace(released_time, '/', '-'), 'YYYY-MM-DD HH24:MI:SS')
    ELSE NULL
  END,
  CASE
    WHEN released_time ~ '^\d{4}/\d{2}/\d{2}\s+\d{2}:\d{2}$'
      THEN to_timestamp(replace(released_time, '/', '-'), 'YYYY-MM-DD HH24:MI')
    ELSE NULL
  END
)
WHERE released_at IS NULL
  AND released_time IS NOT NULL
  AND length(trim(released_time)) >= 10;

CREATE INDEX IF NOT EXISTS idx_questions_released_at ON public.questions(released_at);

COMMIT;
