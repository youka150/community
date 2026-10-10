"""
昇腾社区 — ascend_* 表专用数据库查询
共用 huawei_mining_service 的数据库连接
"""

import pandas as pd
from fastapi import HTTPException
from config import logger, DATABASE_URL
from sqlalchemy import text
from datetime import datetime, timedelta
import json


def get_db_engine():
    """获取数据库连接引擎（复用）"""
    try:
        from sqlalchemy import create_engine
    except ImportError:
        logger.error("缺少 sqlalchemy 库，请运行: pip install sqlalchemy")
        raise HTTPException(status_code=500, detail="缺少 sqlalchemy 依赖")

    if not DATABASE_URL:
        raise HTTPException(status_code=500, detail="DATABASE_URL 未配置")

    db_url = DATABASE_URL
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)

    return create_engine(db_url)


# ========================= 时间工具 =========================

def _ascend_time_filter(col_name: str, start_date: str, end_date: str) -> str:
    """
    生成昇腾时间过滤条件。
    ascend 原始时间格式为纯数字如 '20260208041236'（YYYYMMDDHHmmss）
    直接做字符串比较 >= 和 < 即可（字典序等价于时间序）
    """
    # 将 ISO 日期转为昇腾格式：2026-02-08 -> 20260208000000
    start_ts = start_date.replace("-", "") + "000000"
    end_ts = end_date.replace("-", "") + "000000"
    return f"{col_name} >= '{start_ts}' AND {col_name} < '{end_ts}'"


def _parse_ascend_time(time_str):
    """将昇腾时间字符串转为 datetime 对象"""
    if not time_str or not isinstance(time_str, str):
        return None
    try:
        # 格式：20260208041236
        return datetime.strptime(time_str[:14], "%Y%m%d%H%M%S")
    except (ValueError, IndexError):
        return None


# ========================= 排行榜表 =========================

def init_ascend_ranking_table():
    """初始化昇腾排行榜历史记录表"""
    engine = get_db_engine()
    create_table_sql = """
    CREATE TABLE IF NOT EXISTS ascend_user_ranking_history (
        id SERIAL PRIMARY KEY,
        query_start_date DATE NOT NULL,
        query_end_date DATE NOT NULL,
        top_n INTEGER NOT NULL,
        ranking_data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_ascend_ranking_created_at ON ascend_user_ranking_history(created_at);
    """
    try:
        with engine.connect() as conn:
            conn.execute(text(create_table_sql))
            conn.commit()
            logger.info("昇腾排行榜历史表检查/创建成功")
    except Exception as e:
        logger.error(f"初始化昇腾排行榜表失败: {e}")


def save_ascend_ranking_snapshot(start_date: str, end_date: str, top_n: int, ranking_data: dict):
    """保存昇腾排行榜快照（带频率限制）"""
    try:
        engine = get_db_engine()
        check_sql = """
        SELECT COUNT(*) FROM ascend_user_ranking_history
        WHERE query_start_date = :start_date
          AND query_end_date = :end_date
          AND top_n = :top_n
          AND created_at > :time_threshold
        """
        time_threshold = datetime.now() - timedelta(hours=1)

        with engine.connect() as conn:
            result = conn.execute(text(check_sql), {
                "start_date": start_date,
                "end_date": end_date,
                "top_n": top_n,
                "time_threshold": time_threshold
            }).scalar()

            if result > 0:
                logger.info(f"最近1小时内已保存过昇腾排行，跳过")
                return

            insert_sql = """
            INSERT INTO ascend_user_ranking_history (query_start_date, query_end_date, top_n, ranking_data)
            VALUES (:start_date, :end_date, :top_n, :ranking_data)
            """
            conn.execute(text(insert_sql), {
                "start_date": start_date,
                "end_date": end_date,
                "top_n": top_n,
                "ranking_data": json.dumps(ranking_data)
            })
            conn.commit()
            logger.info("成功保存昇腾用户排行快照")

    except Exception as e:
        logger.error(f"保存昇腾排行快照失败: {e}")


def fetch_ascend_date_range() -> dict:
    """获取昇腾数据库中最早和最新的评论日期 (格式 YYYYMMDDHH24MISS -> YYYY-MM-DD)"""
    engine = get_db_engine()
    query = """
    SELECT MIN(create_time) AS min_date, MAX(create_time) AS max_date
    FROM ascend_comments
    WHERE create_time IS NOT NULL AND create_time != ''
    """
    try:
        with engine.connect() as conn:
            row = conn.execute(text(query)).fetchone()
            
            if row and row[0] and row[1]:
                min_str = str(row[0])
                max_str = str(row[1])
                
                min_date = f"{min_str[:4]}-{min_str[4:6]}-{min_str[6:8]}" if len(min_str) >= 8 else "2026-01-01"
                max_date = f"{max_str[:4]}-{max_str[4:6]}-{max_str[6:8]}" if len(max_str) >= 8 else "2026-12-31"
                
                return {
                    "min_date": min_date,
                    "max_date": max_date
                }
            return {"min_date": "2026-01-01", "max_date": "2026-12-31"}
    except Exception as e:
        logger.error(f"查询昇腾日期范围失败: {e}")
        return {"min_date": "2026-01-01", "max_date": "2026-12-31"}


# ========================= 评论查询 =========================

def fetch_ascend_comments(start_date: str = "2026-01-01", end_date: str = "2026-04-01") -> pd.DataFrame:
    """
    获取昇腾评论数据（供 services 使用）
    返回格式与华为版 fetch_comments 兼容：user_name, content, create_time, like_count, parent_id, topic_id, topic_author, topic_title
    """
    engine = get_db_engine()
    time_filter = _ascend_time_filter("c.create_time", start_date, end_date)

    query = f"""
    SELECT
        c.comment_id,
        c.topic_id,
        c.author_display_name AS user_name,
        c.content_text AS content,
        TO_TIMESTAMP(c.create_time, 'YYYYMMDDHH24MISS') AS create_time,
        CAST(COALESCE(NULLIF(c.likes, ''), '0') AS INTEGER) AS like_count,
        c.parent_comment_id AS parent_id,
        c.author_icon AS avatar,
        CAST(COALESCE(NULLIF(c.adopted, ''), '0') AS INTEGER) AS adopted,
        CAST(COALESCE(NULLIF(c.level, ''), '1') AS INTEGER) AS comment_level,
        t.author_nickname AS topic_author,
        t.title AS topic_title,
        t.section_name,
        CAST(COALESCE(NULLIF(t.is_question, ''), '0') AS INTEGER) AS is_question
    FROM ascend_comments c
    LEFT JOIN ascend_topics t ON t.topic_id = c.topic_id
    WHERE {time_filter}
      AND c.author_display_name IS NOT NULL AND c.author_display_name != ''
    ORDER BY c.create_time
    """
    try:
        with engine.connect() as conn:
            df = pd.read_sql(query, conn)
        logger.info(f"昇腾评论查询完成，共 {len(df)} 条")
        return df
    except Exception as e:
        logger.error(f"查询昇腾评论失败: {e}")
        return pd.DataFrame()


# ========================= 用户交互 =========================

def fetch_ascend_user_interactions(start_date: str = "2026-01-01", end_date: str = "2026-04-01") -> pd.DataFrame:
    """
    获取昇腾用户交互数据（构建社会网络边）
    返回格式兼容: src, dst, weight, type
    """
    engine = get_db_engine()
    time_filter_child = _ascend_time_filter("child.create_time", start_date, end_date)
    time_filter_c = _ascend_time_filter("c.create_time", start_date, end_date)

    query = f"""
    WITH reply_edges AS (
        SELECT
            child.author_display_name AS src,
            parent.author_display_name AS dst,
            COUNT(*) AS weight,
            'reply' AS type
        FROM ascend_comments child
        JOIN ascend_comments parent ON parent.comment_id = child.parent_comment_id
        WHERE {time_filter_child}
            AND child.author_display_name IS NOT NULL AND child.author_display_name != ''
            AND parent.author_display_name IS NOT NULL AND parent.author_display_name != ''
            AND child.author_display_name <> parent.author_display_name
        GROUP BY child.author_display_name, parent.author_display_name
    ),
    author_edges AS (
        SELECT
            c.author_display_name AS src,
            t.author_nickname AS dst,
            COUNT(*) AS weight,
            'comment_to_author' AS type
        FROM ascend_comments c
        JOIN ascend_topics t ON t.topic_id = c.topic_id
        WHERE {time_filter_c}
            AND c.author_display_name IS NOT NULL AND c.author_display_name != ''
            AND t.author_nickname IS NOT NULL AND t.author_nickname != ''
            AND c.author_display_name <> t.author_nickname
        GROUP BY c.author_display_name, t.author_nickname
    )
    SELECT * FROM reply_edges
    UNION ALL
    SELECT * FROM author_edges
    """
    try:
        with engine.connect() as conn:
            df = pd.read_sql(query, conn)
        logger.info(f"昇腾交互数据查询完成，共 {len(df)} 条边")
        return df
    except Exception as e:
        logger.error(f"查询昇腾交互数据失败: {e}")
        return pd.DataFrame()


# ========================= 用户详情 =========================

def fetch_ascend_user_detail(user_name: str) -> dict:
    """
    获取指定昇腾用户的详情数据（话题 + 评论）
    """
    engine = get_db_engine()

    # 1. 用户发布的帖子（author_nickname 匹配）
    topics_query = """
    SELECT topic_id AS id, title, detail_content_text AS content,
           CAST(COALESCE(NULLIF(views, ''), '0') AS INTEGER) AS views,
           CAST(COALESCE(NULLIF(likes, ''), '0') AS INTEGER) AS likes,
           CAST(COALESCE(NULLIF(comments, ''), '0') AS INTEGER) AS comments,
           TO_TIMESTAMP(create_time, 'YYYYMMDDHH24MISS') AS release_time,
           thread_url AS url,
           CAST(COALESCE(NULLIF(is_question, ''), '0') AS INTEGER) AS is_question,
           section_name
    FROM ascend_topics
    WHERE author_nickname = %(user_name)s
    ORDER BY create_time DESC
    LIMIT 50
    """

    # 2. 用户的评论（join topic 获取标题）
    comments_query = """
    SELECT
        c.comment_id,
        c.content_text AS content,
        CAST(COALESCE(NULLIF(c.likes, ''), '0') AS INTEGER) AS like_count,
        TO_TIMESTAMP(c.create_time, 'YYYYMMDDHH24MISS') AS create_time,
        t.title AS topic_title,
        t.topic_id,
        t.thread_url AS topic_url,
        CAST(COALESCE(NULLIF(t.is_question, ''), '0') AS INTEGER) AS is_question,
        CAST(COALESCE(NULLIF(c.adopted, ''), '0') AS INTEGER) AS adopted,
        t.section_name
    FROM ascend_comments c
    LEFT JOIN ascend_topics t ON t.topic_id = c.topic_id
    WHERE c.author_display_name = %(user_name)s
    ORDER BY c.create_time DESC
    LIMIT 200
    """

    try:
        with engine.connect() as conn:
            topics_df = pd.read_sql(topics_query, conn, params={"user_name": user_name})
            comments_df = pd.read_sql(comments_query, conn, params={"user_name": user_name})

        # 处理话题
        topics_list = []
        for _, row in topics_df.iterrows():
            content_str = str(row.get("content", "") or "")
            topics_list.append({
                "id": row["id"],
                "title": row.get("title", ""),
                "summary": content_str[:150] + ("..." if len(content_str) > 150 else ""),
                "views": int(row.get("views", 0) or 0),
                "likes": int(row.get("likes", 0) or 0),
                "comments": int(row.get("comments", 0) or 0),
                "release_time": str(row.get("release_time", "")),
                "url": row.get("url", ""),
                "is_question": int(row.get("is_question", 0) or 0),
                "section_name": row.get("section_name", ""),
            })

        # 处理评论（区分话题评论和问答评论）
        topic_comments_list = []
        question_comments_list = []
        for _, row in comments_df.iterrows():
            comment_data = {
                "comment_id": row["comment_id"],
                "content": str(row.get("content", "") or ""),
                "like_count": int(row.get("like_count", 0) or 0),
                "create_time": str(row.get("create_time", "")),
                "topic_title": row.get("topic_title", ""),
                "topic_id": row.get("topic_id", ""),
                "topic_url": row.get("topic_url", ""),
                "adopted": int(row.get("adopted", 0) or 0),
                "section_name": row.get("section_name", ""),
            }
            if int(row.get("is_question", 0) or 0) == 1:
                comment_data["source"] = "question"
                comment_data["question_title"] = comment_data.pop("topic_title")
                comment_data["question_id"] = comment_data.pop("topic_id")
                comment_data["question_url"] = comment_data.pop("topic_url")
                question_comments_list.append(comment_data)
            else:
                comment_data["source"] = "topic"
                topic_comments_list.append(comment_data)

        # 统计
        total_topic_likes = int(topics_df["likes"].fillna(0).sum()) if not topics_df.empty else 0
        total_comment_likes = int(comments_df["like_count"].fillna(0).sum()) if not comments_df.empty else 0
        adopted_count = int(comments_df["adopted"].fillna(0).sum()) if not comments_df.empty else 0

        return {
            "user_name": user_name,
            "topics": topics_list,
            "topic_comments": topic_comments_list,
            "question_comments": question_comments_list,
            "stats": {
                "topic_count": len(topics_list),
                "topic_comment_count": len(topic_comments_list),
                "question_comment_count": len(question_comments_list),
                "total_likes": total_topic_likes + total_comment_likes,
                "adopted_count": adopted_count,
            }
        }
    except Exception as e:
        logger.error(f"查询昇腾用户详情失败: {e}")
        return {
            "user_name": user_name,
            "topics": [],
            "topic_comments": [],
            "question_comments": [],
            "stats": {"topic_count": 0, "topic_comment_count": 0, "question_comment_count": 0, "total_likes": 0, "adopted_count": 0}
        }


# ========================= 用户列表 =========================

def fetch_ascend_all_users(search: str = "", page: int = 1, page_size: int = 50) -> dict:
    """
    获取昇腾用户列表（直接从 ascend_users 表读取，已有聚合数据）
    """
    engine = get_db_engine()

    # 动态统计每个人在本地库里的真实话题数和评论数，使得左右两侧数据对齐
    count_query = """
    WITH user_stats AS (
        SELECT
            u.nick_name AS user_name,
            u.level_name,
            COALESCE(t.topic_count, 0) AS topic_count,
            COALESCE(tc.comment_count, 0) AS comment_count,
            COALESCE(t.topic_likes, 0) + COALESCE(tc.comment_likes, 0) AS total_likes,
            CAST(COALESCE(NULLIF(u.followers, ''), '0') AS INTEGER) AS followers,
            CAST(COALESCE(NULLIF(u.following, ''), '0') AS INTEGER) AS following,
            COALESCE(u.is_hero, '0') AS is_hero
        FROM ascend_users u
        LEFT JOIN (
            SELECT author_nickname AS user_name, COUNT(*) AS topic_count, SUM(CAST(COALESCE(NULLIF(likes, ''), '0') AS INTEGER)) AS topic_likes
            FROM ascend_topics WHERE author_nickname IS NOT NULL AND author_nickname != '匿名用户'
            GROUP BY author_nickname
        ) t ON t.user_name = u.nick_name
        LEFT JOIN (
            SELECT author_display_name AS user_name, COUNT(*) AS comment_count, SUM(CAST(COALESCE(NULLIF(likes, ''), '0') AS INTEGER)) AS comment_likes
            FROM ascend_comments WHERE author_display_name IS NOT NULL AND author_display_name != '匿名用户'
            GROUP BY author_display_name
        ) tc ON tc.user_name = u.nick_name
    )
    SELECT * FROM user_stats
    WHERE user_name IS NOT NULL AND user_name != ''
      AND (:search = '' OR user_name ILIKE :search_pattern)
    ORDER BY comment_count DESC, total_likes DESC
    """

    total_query = """
    SELECT COUNT(*)
    FROM ascend_users u
    WHERE u.nick_name IS NOT NULL AND u.nick_name != ''
      AND (:search = '' OR u.nick_name ILIKE :search_pattern)
    """

    try:
        search_pattern = f"%{search}%" if search else "%"
        offset = (page - 1) * page_size

        with engine.connect() as conn:
            total = conn.execute(text(total_query), {
                "search": search or "",
                "search_pattern": search_pattern
            }).scalar() or 0

            paged_query = count_query + " LIMIT :limit OFFSET :offset"
            rows = conn.execute(text(paged_query), {
                "search": search or "",
                "search_pattern": search_pattern,
                "limit": page_size,
                "offset": offset
            }).fetchall()

        users = []
        for row in rows:
            users.append({
                "user_name": row[0],
                "level_name": row[1] or "Lv 0",
                "topic_count": int(row[2]),
                "comment_count": int(row[3]),
                "total_likes": int(row[4]),
                "followers": int(row[5]),
                "following": int(row[6]),
                "is_hero": str(row[7]) == "1",
            })

        return {
            "users": users,
            "total": total,
            "page": page,
            "page_size": page_size,
        }
    except Exception as e:
        logger.error(f"查询昇腾用户列表失败: {e}")
        return {"users": [], "total": 0, "page": page, "page_size": page_size}


# ========================= 日期钻取 =========================

def fetch_ascend_daily_drilldown(date: str) -> dict:
    """
    获取指定日期的活跃用户和活跃话题（date 格式: YYYY-MM-DD）
    """
    engine = get_db_engine()
    date_prefix = date.replace("-", "")  # '2026-02-08' -> '20260208'

    users_query = f"""
    SELECT DISTINCT author_display_name AS user_name
    FROM ascend_comments
    WHERE create_time LIKE '{date_prefix}%'
      AND author_display_name IS NOT NULL AND author_display_name != ''
    ORDER BY user_name
    """

    topics_query = f"""
    SELECT t.topic_id AS id, t.title, t.author_nickname AS author, t.thread_url AS url,
           COUNT(c.comment_id) AS comment_count,
           CAST(COALESCE(NULLIF(t.is_question, ''), '0') AS INTEGER) AS is_question
    FROM ascend_topics t
    JOIN ascend_comments c ON t.topic_id = c.topic_id
    WHERE c.create_time LIKE '{date_prefix}%'
    GROUP BY t.topic_id, t.title, t.author_nickname, t.thread_url, t.is_question
    ORDER BY comment_count DESC
    LIMIT 20
    """

    try:
        with engine.connect() as conn:
            users_df = pd.read_sql(users_query, conn)
            topics_df = pd.read_sql(topics_query, conn)

        # 区分话题和问答
        topics_list = []
        questions_list = []
        for _, row in topics_df.iterrows():
            item = {
                "id": row["id"],
                "title": row.get("title", ""),
                "author": row.get("author", ""),
                "url": row.get("url", ""),
                "comment_count": int(row.get("comment_count", 0)),
            }
            if int(row.get("is_question", 0)) == 1:
                questions_list.append(item)
            else:
                topics_list.append(item)

        return {
            "users": users_df['user_name'].tolist() if not users_df.empty else [],
            "topics": topics_list,
            "questions": questions_list,
        }
    except Exception as e:
        logger.error(f"查询昇腾钻取数据失败: {e}")
        return {"users": [], "topics": [], "questions": []}


# ========================= 用户画像 =========================

def fetch_ascend_user_ranking_info(user_name: str) -> dict | None:
    """从 ascend_user_ranking_history 最新记录中查找指定用户排行信息"""
    engine = get_db_engine()
    query = """
    SELECT ranking_data, top_n, created_at
    FROM ascend_user_ranking_history
    ORDER BY created_at DESC
    LIMIT 1
    """
    try:
        with engine.connect() as conn:
            row = conn.execute(text(query)).fetchone()

        if not row:
            return None

        ranking_data = row[0] if isinstance(row[0], dict) else json.loads(row[0])
        top_n = row[1]
        created_at = str(row[2])

        top_users = ranking_data.get("top_users", [])
        for idx, u in enumerate(top_users):
            if u.get("user") == user_name:
                return {
                    "rank": idx + 1,
                    "total_ranked": len(top_users),
                    "top_n": top_n,
                    "influence_score": u.get("influence_score", 0),
                    "pagerank": u.get("pagerank", 0),
                    "in_degree": u.get("in_degree", 0),
                    "out_degree": u.get("out_degree", 0),
                    "quality_score": u.get("quality_score", 0),
                    "innovation_score": u.get("innovation_score", 0),
                    "betweenness": u.get("betweenness", 0),
                    "sentiment_score": u.get("sentiment_score", 0),
                    "diversity_score": u.get("diversity_score", 0),
                    "consistency_score": u.get("consistency_score", 0),
                    "snapshot_time": created_at,
                }

        return {
            "rank": None,
            "total_ranked": len(top_users),
            "top_n": top_n,
            "influence_score": None,
            "snapshot_time": created_at,
        }

    except Exception as e:
        logger.error(f"查询昇腾用户排行信息失败: {e}")
        return None


def fetch_ascend_user_profile(user_name: str) -> dict:
    """
    聚合昇腾用户完整画像：基础详情 + 元数据 + 日活跃度 + 互动排行 + 排行榜联动
    """
    engine = get_db_engine()

    # 1. 基础详情
    base_detail = fetch_ascend_user_detail(user_name)

    # 2. 从 ascend_users 获取元数据
    user_meta_query = """
    SELECT uid, nick_name, level_name, icon, profile,
           COALESCE(is_hero, '0') AS is_hero,
           CAST(COALESCE(NULLIF(posts, ''), '0') AS INTEGER) AS posts,
           CAST(COALESCE(NULLIF(topics, ''), '0') AS INTEGER) AS topics,
           CAST(COALESCE(NULLIF(comments, ''), '0') AS INTEGER) AS comments,
           CAST(COALESCE(NULLIF(likes, ''), '0') AS INTEGER) AS likes,
           CAST(COALESCE(NULLIF(favorites, ''), '0') AS INTEGER) AS favorites,
           CAST(COALESCE(NULLIF(followers, ''), '0') AS INTEGER) AS followers,
           CAST(COALESCE(NULLIF(following, ''), '0') AS INTEGER) AS following
    FROM ascend_users
    WHERE nick_name = :user_name
    LIMIT 1
    """

    # 3. 日活跃度
    daily_query = """
    SELECT LEFT(create_time, 8) AS day, COUNT(*) AS cnt
    FROM ascend_comments
    WHERE author_display_name = :user_name
      AND author_display_name != ''
    GROUP BY LEFT(create_time, 8)
    ORDER BY day
    """

    # 4. 互动最多的话题 Top 10
    top_interacted_topics_query = """
    SELECT t.topic_id AS id, t.title, t.thread_url AS url,
           COUNT(c.comment_id) AS interaction_count,
           CAST(COALESCE(NULLIF(t.is_question, ''), '0') AS INTEGER) AS is_question
    FROM ascend_comments c
    JOIN ascend_topics t ON t.topic_id = c.topic_id
    WHERE c.author_display_name = :user_name AND c.author_display_name != ''
    GROUP BY t.topic_id, t.title, t.thread_url, t.is_question
    ORDER BY interaction_count DESC
    LIMIT 10
    """

    # 5. 评论深度
    comment_depth_query = """
    SELECT
        AVG(LENGTH(content_text)) AS avg_length,
        MAX(LENGTH(content_text)) AS max_length,
        MIN(LENGTH(content_text)) AS min_length,
        COUNT(*) AS total_comments
    FROM ascend_comments
    WHERE author_display_name = :user_name AND author_display_name != ''
      AND content_text IS NOT NULL AND content_text != ''
    """

    # 6. 首次和最后活跃时间
    activity_range_query = """
    SELECT MIN(create_time) AS first_active, MAX(create_time) AS last_active
    FROM ascend_comments
    WHERE author_display_name = :user_name AND author_display_name != ''
    """

    # 7. 用户参与的板块
    section_query = """
    SELECT DISTINCT t.section_name, COUNT(*) AS cnt
    FROM ascend_comments c
    JOIN ascend_topics t ON t.topic_id = c.topic_id
    WHERE c.author_display_name = :user_name AND c.author_display_name != ''
      AND t.section_name IS NOT NULL AND t.section_name != ''
    GROUP BY t.section_name
    ORDER BY cnt DESC
    """

    try:
        with engine.connect() as conn:
            params = {"user_name": user_name}

            # 用户元数据
            user_meta_row = conn.execute(text(user_meta_query), params).fetchone()
            user_meta = {}
            if user_meta_row:
                user_meta = {
                    "uid": user_meta_row[0],
                    "level_name": user_meta_row[2] or "Lv 0",
                    "icon": user_meta_row[3],
                    "profile": user_meta_row[4],
                    "is_hero": str(user_meta_row[5]) == "1",
                    "posts": int(user_meta_row[6]),
                    "topics": int(user_meta_row[7]),
                    "comments": int(user_meta_row[8]),
                    "likes": int(user_meta_row[9]),
                    "favorites": int(user_meta_row[10]),
                    "followers": int(user_meta_row[11]),
                    "following": int(user_meta_row[12]),
                }

            # 日活跃度
            daily_df = pd.read_sql(text(daily_query), conn, params=params)
            daily_activity = []
            for _, row in daily_df.iterrows():
                day_str = str(row["day"])
                # 转成 YYYY-MM-DD 格式
                if len(day_str) >= 8:
                    formatted = f"{day_str[:4]}-{day_str[4:6]}-{day_str[6:8]}"
                else:
                    formatted = day_str
                daily_activity.append({
                    "date": formatted,
                    "count": int(row["cnt"])
                })

            # 互动排行
            topics_df = pd.read_sql(text(top_interacted_topics_query), conn, params=params)
            top_topics = []
            top_questions = []
            for _, row in topics_df.iterrows():
                item = {
                    "id": row["id"],
                    "title": row.get("title", ""),
                    "url": row.get("url", ""),
                    "interaction_count": int(row["interaction_count"])
                }
                if int(row.get("is_question", 0)) == 1:
                    top_questions.append(item)
                else:
                    top_topics.append(item)

            # 评论深度
            depth_row = conn.execute(text(comment_depth_query), params).fetchone()
            comment_depth = {
                "avg_length": round(float(depth_row[0]), 1) if depth_row and depth_row[0] else 0,
                "max_length": int(depth_row[1]) if depth_row and depth_row[1] else 0,
                "min_length": int(depth_row[2]) if depth_row and depth_row[2] else 0,
                "total_comments": int(depth_row[3]) if depth_row and depth_row[3] else 0,
            }

            # 活跃时间范围
            range_row = conn.execute(text(activity_range_query), params).fetchone()
            first_active = None
            last_active = None
            if range_row:
                fa = _parse_ascend_time(range_row[0])
                la = _parse_ascend_time(range_row[1])
                first_active = str(fa) if fa else None
                last_active = str(la) if la else None
            activity_range = {
                "first_active": first_active,
                "last_active": last_active,
            }

            # 板块参与
            section_df = pd.read_sql(text(section_query), conn, params=params)
            sections = []
            for _, row in section_df.iterrows():
                sections.append({
                    "name": row["section_name"],
                    "count": int(row["cnt"]),
                })

        # 排行榜联动
        ranking_info = fetch_ascend_user_ranking_info(user_name)

        # 用户标签
        tags = []
        stats = base_detail.get("stats", {})
        if stats.get("topic_count", 0) >= 3:
            tags.append("话题创作者")
        if stats.get("topic_comment_count", 0) + stats.get("question_comment_count", 0) >= 10:
            tags.append("活跃评论者")
        if stats.get("total_likes", 0) >= 20:
            tags.append("高人气用户")
        if comment_depth.get("avg_length", 0) >= 100:
            tags.append("深度评论者")
        if stats.get("adopted_count", 0) >= 3:
            tags.append("优质答主")
        if user_meta.get("is_hero"):
            tags.append("社区英雄")
        if len(sections) >= 3:
            tags.append("跨板块达人")
        if ranking_info and ranking_info.get("rank") is not None:
            if ranking_info["rank"] <= 10:
                tags.append("Top 10 核心用户")
            elif ranking_info["rank"] <= 50:
                tags.append("Top 50 影响力用户")
            else:
                tags.append("榜上有名")

        # 参与度
        topic_participation = stats.get("topic_count", 0) + stats.get("topic_comment_count", 0)
        question_participation = stats.get("question_comment_count", 0)

        return {
            **base_detail,
            "user_meta": user_meta,
            "daily_activity": daily_activity,
            "top_interacted_topics": top_topics,
            "top_interacted_questions": top_questions,
            "comment_depth": comment_depth,
            "activity_range": activity_range,
            "ranking_info": ranking_info,
            "tags": tags,
            "sections": sections,
            "participation": {
                "topic": topic_participation,
                "question": question_participation,
            }
        }

    except Exception as e:
        logger.error(f"查询昇腾用户画像失败: {e}")
        return {
            **base_detail,
            "user_meta": {},
            "daily_activity": [],
            "top_interacted_topics": [],
            "top_interacted_questions": [],
            "comment_depth": {},
            "activity_range": {},
            "ranking_info": None,
            "tags": [],
            "sections": [],
            "participation": {"topic": 0, "question": 0},
        }


# ========================= 标签数据 =========================

def fetch_ascend_tags() -> list:
    """获取所有昇腾标签"""
    engine = get_db_engine()
    query = """
    SELECT tag_id, tag_name, description,
           COALESCE(follow_num, 0) AS follow_num,
           COALESCE(quotes, 0) AS quotes,
           COALESCE(digests, 0) AS digests,
           COALESCE(topic_count, 0) AS topic_count
    FROM ascend_tags
    ORDER BY topic_count DESC
    """
    try:
        with engine.connect() as conn:
            df = pd.read_sql(query, conn)
        return df.to_dict('records')
    except Exception as e:
        logger.error(f"查询昇腾标签失败: {e}")
        return []


# ========================= 板块统计 =========================

def fetch_ascend_section_stats() -> dict:
    """获取昇腾各板块统计数据"""
    engine = get_db_engine()

    section_query = """
    SELECT
        section_name,
        COUNT(*) AS topic_count,
        SUM(CASE WHEN CAST(COALESCE(NULLIF(is_question, ''), '0') AS INTEGER) = 1 THEN 1 ELSE 0 END) AS question_count,
        SUM(CAST(COALESCE(NULLIF(views, ''), '0') AS INTEGER)) AS total_views,
        SUM(CAST(COALESCE(NULLIF(likes, ''), '0') AS INTEGER)) AS total_likes,
        SUM(CAST(COALESCE(NULLIF(comments, ''), '0') AS INTEGER)) AS total_comments,
        COUNT(DISTINCT author_nickname) AS unique_authors
    FROM ascend_topics
    WHERE section_name IS NOT NULL AND section_name != ''
    GROUP BY section_name
    ORDER BY topic_count DESC
    """

    # 板块间用户流动（用户同时参与多个板块）
    cross_section_query = """
    SELECT
        s1.section_name AS source,
        s2.section_name AS target,
        COUNT(DISTINCT s1.user_name) AS user_count
    FROM (
        SELECT DISTINCT c.author_display_name AS user_name, t.section_name
        FROM ascend_comments c
        JOIN ascend_topics t ON t.topic_id = c.topic_id
        WHERE c.author_display_name IS NOT NULL AND c.author_display_name != ''
          AND t.section_name IS NOT NULL AND t.section_name != ''
    ) s1
    JOIN (
        SELECT DISTINCT c.author_display_name AS user_name, t.section_name
        FROM ascend_comments c
        JOIN ascend_topics t ON t.topic_id = c.topic_id
        WHERE c.author_display_name IS NOT NULL AND c.author_display_name != ''
          AND t.section_name IS NOT NULL AND t.section_name != ''
    ) s2 ON s1.user_name = s2.user_name AND s1.section_name < s2.section_name
    GROUP BY s1.section_name, s2.section_name
    HAVING COUNT(DISTINCT s1.user_name) >= 2
    ORDER BY user_count DESC
    """

    try:
        with engine.connect() as conn:
            sections_df = pd.read_sql(section_query, conn)
            cross_df = pd.read_sql(cross_section_query, conn)

        sections = sections_df.to_dict('records')
        cross_flows = cross_df.to_dict('records')

        return {
            "sections": sections,
            "cross_flows": cross_flows,
        }
    except Exception as e:
        logger.error(f"查询昇腾板块统计失败: {e}")
        return {"sections": [], "cross_flows": []}


# ========================= 问答健康度 =========================

def fetch_ascend_qa_health() -> dict:
    """获取昇腾问答健康度指标"""
    engine = get_db_engine()

    query = """
    SELECT
        COUNT(*) AS total_questions,
        SUM(CASE WHEN CAST(COALESCE(NULLIF(solved, ''), '0') AS INTEGER) = 1 THEN 1 ELSE 0 END) AS solved_count,
        AVG(CAST(COALESCE(NULLIF(replies, ''), '0') AS INTEGER)) AS avg_replies,
        AVG(CAST(COALESCE(NULLIF(comments, ''), '0') AS INTEGER)) AS avg_comments,
        AVG(CAST(COALESCE(NULLIF(views, ''), '0') AS INTEGER)) AS avg_views
    FROM ascend_topics
    WHERE CAST(COALESCE(NULLIF(is_question, ''), '0') AS INTEGER) = 1
    """

    adopted_query = """
    SELECT COUNT(*) AS adopted_count
    FROM ascend_comments c
    JOIN ascend_topics t ON t.topic_id = c.topic_id
    WHERE CAST(COALESCE(NULLIF(t.is_question, ''), '0') AS INTEGER) = 1
      AND CAST(COALESCE(NULLIF(c.adopted, ''), '0') AS INTEGER) = 1
    """

    total_qa_comments_query = """
    SELECT COUNT(*) AS total_qa_comments
    FROM ascend_comments c
    JOIN ascend_topics t ON t.topic_id = c.topic_id
    WHERE CAST(COALESCE(NULLIF(t.is_question, ''), '0') AS INTEGER) = 1
    """

    # 未解决问题 Top 10
    unsolved_query = """
    SELECT topic_id AS id, title, thread_url AS url,
           CAST(COALESCE(NULLIF(views, ''), '0') AS INTEGER) AS views,
           CAST(COALESCE(NULLIF(replies, ''), '0') AS INTEGER) AS replies,
           author_nickname AS author
    FROM ascend_topics
    WHERE CAST(COALESCE(NULLIF(is_question, ''), '0') AS INTEGER) = 1
      AND CAST(COALESCE(NULLIF(solved, ''), '0') AS INTEGER) = 0
    ORDER BY CAST(COALESCE(NULLIF(views, ''), '0') AS INTEGER) DESC
    LIMIT 10
    """

    try:
        with engine.connect() as conn:
            row = conn.execute(text(query)).fetchone()
            adopted_row = conn.execute(text(adopted_query)).fetchone()
            total_qa_row = conn.execute(text(total_qa_comments_query)).fetchone()
            unsolved_df = pd.read_sql(unsolved_query, conn)

        total_questions = int(row[0]) if row else 0
        solved_count = int(row[1]) if row else 0
        avg_replies = round(float(row[2]), 1) if row and row[2] else 0
        avg_comments = round(float(row[3]), 1) if row and row[3] else 0
        avg_views = round(float(row[4]), 1) if row and row[4] else 0
        adopted_count = int(adopted_row[0]) if adopted_row else 0
        total_qa_comments = int(total_qa_row[0]) if total_qa_row else 0

        unsolved_list = unsolved_df.to_dict('records') if not unsolved_df.empty else []

        return {
            "total_questions": total_questions,
            "solved_count": solved_count,
            "solve_rate": round(solved_count / total_questions, 4) if total_questions > 0 else 0,
            "adopted_count": adopted_count,
            "total_qa_comments": total_qa_comments,
            "adoption_rate": round(adopted_count / total_qa_comments, 4) if total_qa_comments > 0 else 0,
            "avg_replies": avg_replies,
            "avg_comments": avg_comments,
            "avg_views": avg_views,
            "unsolved_top": unsolved_list,
        }
    except Exception as e:
        logger.error(f"查询昇腾问答健康度失败: {e}")
        return {
            "total_questions": 0, "solved_count": 0, "solve_rate": 0,
            "adopted_count": 0, "total_qa_comments": 0, "adoption_rate": 0,
            "avg_replies": 0, "avg_comments": 0, "avg_views": 0,
            "unsolved_top": [],
        }
