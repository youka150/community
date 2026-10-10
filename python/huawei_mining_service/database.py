import pandas as pd
from fastapi import HTTPException
from config import logger, DATABASE_URL
from sqlalchemy import text
from datetime import datetime, timedelta
import json

def get_db_engine():
    """获取数据库连接引擎"""
    try:
        from sqlalchemy import create_engine
    except ImportError:
        logger.error("缺少 sqlalchemy 库，请运行: pip install sqlalchemy")
        raise HTTPException(status_code=500, detail="缺少 sqlalchemy 依赖")

    if not DATABASE_URL:
        raise HTTPException(status_code=500, detail="DATABASE_URL 未配置")
    
    # 将 postgres:// 转换为 postgresql:// (SQLAlchemy 需要)
    db_url = DATABASE_URL
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
        
    return create_engine(db_url)


def init_ranking_table():
    """初始化排行榜历史记录表"""
    engine = get_db_engine()
    create_table_sql = """
    CREATE TABLE IF NOT EXISTS user_ranking_history (
        id SERIAL PRIMARY KEY,
        query_start_date DATE NOT NULL,
        query_end_date DATE NOT NULL,
        top_n INTEGER NOT NULL,
        ranking_data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_ranking_created_at ON user_ranking_history(created_at);
    """
    try:
        with engine.connect() as conn:
            conn.execute(text(create_table_sql))
            conn.commit()
            logger.info("排行榜历史表检查/创建成功")
    except Exception as e:
        logger.error(f"初始化排行榜表失败: {e}")


def save_ranking_snapshot(start_date: str, end_date: str, top_n: int, ranking_data: dict):
    """保存排行榜快照（带频率限制）"""
    try:
        engine = get_db_engine()
        
        # 检查最近1小时是否已有相同条件的记录
        check_sql = """
        SELECT COUNT(*) FROM user_ranking_history 
        WHERE query_start_date = :start_date 
          AND query_end_date = :end_date 
          AND top_n = :top_n
          AND created_at > :time_threshold
        """
        
        # 计算1小时前的时间
        time_threshold = datetime.now() - timedelta(hours=1)
        
        with engine.connect() as conn:
            result = conn.execute(text(check_sql), {
                "start_date": start_date,
                "end_date": end_date,
                "top_n": top_n,
                "time_threshold": time_threshold
            }).scalar()
            
            if result > 0:
                logger.info(f"最近1小时内已保存过 {start_date}~{end_date} Top{top_n} 的排行，跳过保存")
                return

            # 插入新记录
            insert_sql = """
            INSERT INTO user_ranking_history (query_start_date, query_end_date, top_n, ranking_data)
            VALUES (:start_date, :end_date, :top_n, :ranking_data)
            """
            
            conn.execute(text(insert_sql), {
                "start_date": start_date,
                "end_date": end_date,
                "top_n": top_n,
                "ranking_data": json.dumps(ranking_data) # Ensure it's JSON string or rely on driver JSON support
            })
            conn.commit()
            logger.info("成功保存用户排行快照")
            
    except Exception as e:
        logger.error(f"保存排行快照失败: {e}")


def fetch_date_range() -> dict:
    """获取数据库中最早和最新的评论日期"""
    engine = get_db_engine()
    query = """
    SELECT MIN(create_time) AS min_date, MAX(create_time) AS max_date
    FROM (
        SELECT create_time FROM topics_comments
        UNION ALL
        SELECT create_time FROM questions_comments
    ) all_comments
    """
    try:
        with engine.connect() as conn:
            row = conn.execute(text(query)).fetchone()
            
            if row and row[0] and row[1]:
                return {
                    "min_date": str(row[0])[:10],  # YYYY-MM-DD
                    "max_date": str(row[1])[:10]
                }
            return {"min_date": "2025-01-01", "max_date": "2026-12-31"}
    except Exception as e:
        logger.error(f"查询日期范围失败: {e}")
        return {"min_date": "2025-01-01", "max_date": "2026-12-31"}


def fetch_comments(start_date: str = "2025-12-01", end_date: str = "2025-12-31") -> pd.DataFrame:
    """获取评论数据"""
    engine = get_db_engine()
    query = """
    SELECT 
        tc.comment_id,
        tc.topic_id,
        tc."user" as user_name,
        tc.content,
        tc.create_time,
        tc.like_count,
        tc.parent_id,
        tc.avatar,
        t."user" as topic_author,
        t.title as topic_title
    FROM topics_comments tc
    LEFT JOIN topics t ON t.id = tc.topic_id
    WHERE tc.create_time >= %(start)s AND tc.create_time < %(end)s
      AND tc."user" IS NOT NULL AND tc."user" != '匿名用户'
    ORDER BY tc.create_time
    """
    try:
        with engine.connect() as conn:
            df = pd.read_sql(query, conn, params={"start": start_date, "end": end_date})
        return df
    except Exception as e:
        logger.error(f"查询评论失败: {e}")
        # 如果是依赖缺失导致的错误（如缺少 psycopg2）
        if "No module named" in str(e) or "psycopg2" in str(e):
             logger.error("请确认已安装 psycopg2-binary: pip install psycopg2-binary")
        return pd.DataFrame()


def fetch_topics(start_date: str = "2025-12-01", end_date: str = "2025-12-31") -> pd.DataFrame:
    """获取话题数据"""
    engine = get_db_engine()
    query = """
    SELECT 
        t.id,
        t.title,
        t.content,
        t."user" as author,
        t.views,
        t.likes,
        t.comments,
        t.release_time
    FROM topics t
    WHERE t."user" != '匿名用户'
    """
    try:
        with engine.connect() as conn:
            df = pd.read_sql(query, conn)
        return df
    except Exception as e:
        logger.error(f"查询话题失败: {e}")
        return pd.DataFrame()


def fetch_user_interactions(start_date: str = "2025-12-01", end_date: str = "2025-12-31") -> pd.DataFrame:
    """获取用户交互数据"""
    engine = get_db_engine()
    query = """
    WITH reply_edges AS (
        SELECT 
            child."user" AS src,
            parent."user" AS dst,
            COUNT(*) AS weight,
            'reply' AS type
        FROM topics_comments child
        JOIN topics_comments parent ON parent.comment_id = child.parent_id
        WHERE child.create_time >= %(start)s AND child.create_time < %(end)s
            AND child."user" IS NOT NULL AND child."user" != '匿名用户'
            AND parent."user" IS NOT NULL AND parent."user" != '匿名用户'
            AND child."user" <> parent."user"
        GROUP BY child."user", parent."user"
    ),
    author_edges AS (
        SELECT 
            c."user" AS src,
            t."user" AS dst,
            COUNT(*) AS weight,
            'comment_to_author' AS type
        FROM topics_comments c
        JOIN topics t ON t.id = c.topic_id
        WHERE c.create_time >= %(start)s AND c.create_time < %(end)s
            AND c."user" IS NOT NULL AND c."user" != '匿名用户'
            AND t."user" IS NOT NULL AND t."user" != '匿名用户'
            AND c."user" <> t."user"
        GROUP BY c."user", t."user"
    )
    SELECT * FROM reply_edges
    UNION ALL
    SELECT * FROM author_edges
    """
    try:
        with engine.connect() as conn:
            df = pd.read_sql(query, conn, params={"start": start_date, "end": end_date})
        return df
    except Exception as e:
        logger.error(f"查询交互数据失败: {e}")
        return pd.DataFrame()


def fetch_user_detail(user_name: str) -> dict:
    """
    获取指定用户的详情数据（话题 + 话题评论 + 问答评论）
    涵盖 topics、topics_comments、questions_comments 三张表
    """
    engine = get_db_engine()

    # 1. 用户发布的话题（topics 表）
    topics_query = """
    SELECT id, title, content, views, likes, comments, release_time, url
    FROM topics
    WHERE "user" = %(user_name)s
    ORDER BY release_time DESC
    LIMIT 50
    """

    # 2. 用户在话题下的评论（topics_comments JOIN topics）
    topic_comments_query = """
    SELECT
        tc.comment_id,
        tc.content,
        tc.like_count,
        tc.create_time,
        t.title AS topic_title,
        t.id AS topic_id,
        t.url AS topic_url
    FROM topics_comments tc
    LEFT JOIN topics t ON t.id = tc.topic_id
    WHERE tc."user" = %(user_name)s
      AND tc."user" != '匿名用户'
    ORDER BY tc.create_time DESC
    LIMIT 150
    """

    # 3. 用户在问答下的评论（questions_comments JOIN questions）
    question_comments_query = """
    SELECT
        qc.comment_id,
        qc.content,
        qc.like_count,
        qc.create_time,
        q.title AS question_title,
        q.id AS question_id,
        q.url AS question_url
    FROM questions_comments qc
    LEFT JOIN questions q ON q.id = qc.topic_id
    WHERE qc."user" = %(user_name)s
      AND qc."user" != '匿名用户'
    ORDER BY qc.create_time DESC
    LIMIT 150
    """

    try:
        with engine.connect() as conn:
            topics_df = pd.read_sql(topics_query, conn, params={"user_name": user_name})
            topic_comments_df = pd.read_sql(topic_comments_query, conn, params={"user_name": user_name})
            question_comments_df = pd.read_sql(question_comments_query, conn, params={"user_name": user_name})

        # 处理话题数据
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
            })

        # 处理话题评论数据
        topic_comments_list = []
        for _, row in topic_comments_df.iterrows():
            topic_comments_list.append({
                "comment_id": row["comment_id"],
                "content": str(row.get("content", "") or ""),
                "like_count": int(row.get("like_count", 0) or 0),
                "create_time": str(row.get("create_time", "")),
                "topic_title": row.get("topic_title", ""),
                "topic_id": row.get("topic_id", ""),
                "topic_url": row.get("topic_url", ""),
                "source": "topic",
            })

        # 处理问答评论数据
        question_comments_list = []
        for _, row in question_comments_df.iterrows():
            question_comments_list.append({
                "comment_id": row["comment_id"],
                "content": str(row.get("content", "") or ""),
                "like_count": int(row.get("like_count", 0) or 0),
                "create_time": str(row.get("create_time", "")),
                "question_title": row.get("question_title", ""),
                "question_id": row.get("question_id", ""),
                "question_url": row.get("question_url", ""),
                "source": "question",
            })

        # 统计信息
        total_topic_likes = int(topics_df["likes"].fillna(0).sum()) if not topics_df.empty else 0
        total_comment_likes = (
            int(topic_comments_df["like_count"].fillna(0).sum()) +
            int(question_comments_df["like_count"].fillna(0).sum())
        )

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
            }
        }
    except Exception as e:
        logger.error(f"查询用户详情失败: {e}")
        return {
            "user_name": user_name,
            "topics": [],
            "topic_comments": [],
            "question_comments": [],
            "stats": {"topic_count": 0, "topic_comment_count": 0, "question_comment_count": 0, "total_likes": 0}
        }


def fetch_daily_drilldown(date: str) -> dict:
    """
    获取指定日期的活跃用户列表和活跃话题/问答列表
    date 格式: YYYY-MM-DD
    """
    engine = get_db_engine()
    
    # 查询该日期活跃的用户（有发表评论的）
    users_query = """
    SELECT DISTINCT tc."user" as user_name
    FROM topics_comments tc
    WHERE DATE(tc.create_time) = %(date)s
      AND tc."user" IS NOT NULL AND tc."user" != '匿名用户'
    UNION
    SELECT DISTINCT qc."user" as user_name
    FROM questions_comments qc
    WHERE DATE(qc.create_time) = %(date)s
      AND qc."user" IS NOT NULL AND qc."user" != '匿名用户'
    ORDER BY user_name
    """
    
    # 查询该日期有评论活动的话题
    topics_query = """
    SELECT DISTINCT t.id, t.title, t."user" as author, t.url, COUNT(tc.comment_id) as comment_count
    FROM topics t
    JOIN topics_comments tc ON t.id = tc.topic_id
    WHERE DATE(tc.create_time) = %(date)s
    GROUP BY t.id, t.title, t."user", t.url
    ORDER BY comment_count DESC
    LIMIT 20
    """
    
    # 查询该日期有评论活动的问答
    questions_query = """
    SELECT DISTINCT q.id, q.title, q.url, COUNT(qc.comment_id) as comment_count
    FROM questions q
    JOIN questions_comments qc ON q.id = qc.question_id
    WHERE DATE(qc.create_time) = %(date)s
    GROUP BY q.id, q.title, q.url
    ORDER BY comment_count DESC
    LIMIT 20
    """
    
    try:
        with engine.connect() as conn:
            users_df = pd.read_sql(users_query, conn, params={"date": date})
            topics_df = pd.read_sql(topics_query, conn, params={"date": date})
            questions_df = pd.read_sql(questions_query, conn, params={"date": date})
        
        return {
            "users": users_df['user_name'].tolist() if not users_df.empty else [],
            "topics": topics_df.to_dict('records') if not topics_df.empty else [],
            "questions": questions_df.to_dict('records') if not questions_df.empty else []
        }
    except Exception as e:
        logger.error(f"查询钻取数据失败: {e}")
        return {"users": [], "topics": [], "questions": []}


def fetch_all_users(search: str = "", page: int = 1, page_size: int = 50) -> dict:
    """
    获取所有用户列表（左侧栏用）
    支持模糊搜索、分页，按评论数降序排列
    """
    engine = get_db_engine()

    # 统计每个用户的话题数、评论数、总获赞
    count_query = """
    WITH user_stats AS (
        SELECT
            u.user_name,
            COALESCE(t.topic_count, 0) AS topic_count,
            COALESCE(tc.comment_count, 0) + COALESCE(qc.comment_count, 0) AS comment_count,
            COALESCE(t.topic_likes, 0) + COALESCE(tc.comment_likes, 0) + COALESCE(qc.comment_likes, 0) AS total_likes
        FROM (
            SELECT DISTINCT "user" AS user_name FROM topics WHERE "user" IS NOT NULL AND "user" != '匿名用户'
            UNION
            SELECT DISTINCT "user" AS user_name FROM topics_comments WHERE "user" IS NOT NULL AND "user" != '匿名用户'
            UNION
            SELECT DISTINCT "user" AS user_name FROM questions_comments WHERE "user" IS NOT NULL AND "user" != '匿名用户'
        ) u
        LEFT JOIN (
            SELECT "user" AS user_name, COUNT(*) AS topic_count, COALESCE(SUM(likes), 0) AS topic_likes
            FROM topics WHERE "user" IS NOT NULL AND "user" != '匿名用户'
            GROUP BY "user"
        ) t ON t.user_name = u.user_name
        LEFT JOIN (
            SELECT "user" AS user_name, COUNT(*) AS comment_count, COALESCE(SUM(like_count), 0) AS comment_likes
            FROM topics_comments WHERE "user" IS NOT NULL AND "user" != '匿名用户'
            GROUP BY "user"
        ) tc ON tc.user_name = u.user_name
        LEFT JOIN (
            SELECT "user" AS user_name, COUNT(*) AS comment_count, COALESCE(SUM(like_count), 0) AS comment_likes
            FROM questions_comments WHERE "user" IS NOT NULL AND "user" != '匿名用户'
            GROUP BY "user"
        ) qc ON qc.user_name = u.user_name
    )
    SELECT * FROM user_stats
    WHERE (:search = '' OR user_name ILIKE :search_pattern)
    ORDER BY comment_count DESC, total_likes DESC
    """

    total_query = """
    SELECT COUNT(DISTINCT u.user_name)
    FROM (
        SELECT DISTINCT "user" AS user_name FROM topics WHERE "user" IS NOT NULL AND "user" != '匿名用户'
        UNION
        SELECT DISTINCT "user" AS user_name FROM topics_comments WHERE "user" IS NOT NULL AND "user" != '匿名用户'
        UNION
        SELECT DISTINCT "user" AS user_name FROM questions_comments WHERE "user" IS NOT NULL AND "user" != '匿名用户'
    ) u
    WHERE (:search = '' OR u.user_name ILIKE :search_pattern)
    """

    try:
        search_pattern = f"%{search}%" if search else "%"
        offset = (page - 1) * page_size

        with engine.connect() as conn:
            # 总数
            total = conn.execute(text(total_query), {
                "search": search or "",
                "search_pattern": search_pattern
            }).scalar() or 0

            # 分页数据
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
                "topic_count": int(row[1]),
                "comment_count": int(row[2]),
                "total_likes": int(row[3]),
            })

        return {
            "users": users,
            "total": total,
            "page": page,
            "page_size": page_size,
        }
    except Exception as e:
        logger.error(f"查询用户列表失败: {e}")
        return {"users": [], "total": 0, "page": page, "page_size": page_size}


def fetch_user_ranking_info(user_name: str) -> dict | None:
    """
    从 user_ranking_history 最新记录中查找指定用户的排行榜信息
    返回排名、影响力分、PageRank、质量分、创新分等
    """
    engine = get_db_engine()

    # 取最新一条排行记录（top_n 最大的）
    query = """
    SELECT ranking_data, top_n, created_at
    FROM user_ranking_history
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

        # ranking_data 结构: { "stats": {...}, "top_users": [...], "communities": [...], "weights": {...} }
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

        # 用户不在排行榜中
        return {
            "rank": None,
            "total_ranked": len(top_users),
            "top_n": top_n,
            "influence_score": None,
            "snapshot_time": created_at,
        }

    except Exception as e:
        logger.error(f"查询用户排行信息失败: {e}")
        return None


def fetch_user_profile(user_name: str) -> dict:
    """
    聚合用户完整画像数据：
    - 基础详情（话题 + 评论）
    - 月度活跃度时间线
    - 互动最多的话题/问答 Top 排行
    - 评论深度统计
    - 排行榜联动信息
    """
    engine = get_db_engine()

    # 1. 复用 fetch_user_detail 获取基础数据
    base_detail = fetch_user_detail(user_name)

    # 2. 日活跃度（话题评论 + 问答评论按日聚合）
    daily_query = """
    SELECT day, SUM(cnt) AS count FROM (
        SELECT TO_CHAR(create_time, 'YYYY-MM-DD') AS day, COUNT(*) AS cnt
        FROM topics_comments
        WHERE "user" = %(user_name)s AND "user" != '匿名用户'
        GROUP BY TO_CHAR(create_time, 'YYYY-MM-DD')
        UNION ALL
        SELECT TO_CHAR(create_time, 'YYYY-MM-DD') AS day, COUNT(*) AS cnt
        FROM questions_comments
        WHERE "user" = %(user_name)s AND "user" != '匿名用户'
        GROUP BY TO_CHAR(create_time, 'YYYY-MM-DD')
    ) combined
    GROUP BY day
    ORDER BY day
    """

    # 3. 互动最多的话题 Top 10
    top_interacted_topics_query = """
    SELECT t.id, t.title, t.url, COUNT(tc.comment_id) AS interaction_count
    FROM topics_comments tc
    JOIN topics t ON t.id = tc.topic_id
    WHERE tc."user" = %(user_name)s AND tc."user" != '匿名用户'
    GROUP BY t.id, t.title, t.url
    ORDER BY interaction_count DESC
    LIMIT 10
    """

    # 4. 互动最多的问答 Top 10
    top_interacted_questions_query = """
    SELECT q.id, q.title, q.url, COUNT(qc.comment_id) AS interaction_count
    FROM questions_comments qc
    JOIN questions q ON q.id = qc.topic_id
    WHERE qc."user" = %(user_name)s AND qc."user" != '匿名用户'
    GROUP BY q.id, q.title, q.url
    ORDER BY interaction_count DESC
    LIMIT 10
    """

    # 5. 评论深度统计（平均长度、最长评论等）
    comment_depth_query = """
    SELECT
        AVG(LENGTH(content)) AS avg_length,
        MAX(LENGTH(content)) AS max_length,
        MIN(LENGTH(content)) AS min_length,
        COUNT(*) AS total_comments
    FROM (
        SELECT content FROM topics_comments WHERE "user" = :user_name AND "user" != '匿名用户'
        UNION ALL
        SELECT content FROM questions_comments WHERE "user" = :user_name AND "user" != '匿名用户'
    ) all_comments
    WHERE content IS NOT NULL AND content != ''
    """

    # 6. 首次和最后活跃时间
    activity_range_query = """
    SELECT MIN(create_time) AS first_active, MAX(create_time) AS last_active
    FROM (
        SELECT create_time FROM topics_comments WHERE "user" = :user_name AND "user" != '匿名用户'
        UNION ALL
        SELECT create_time FROM questions_comments WHERE "user" = :user_name AND "user" != '匿名用户'
    ) all_activity
    """

    try:
        with engine.connect() as conn:
            params = {"user_name": user_name}

            # 日活跃度
            daily_df = pd.read_sql(daily_query, conn, params=params)
            daily_activity = []
            for _, row in daily_df.iterrows():
                daily_activity.append({
                    "date": row["day"],
                    "count": int(row["count"])
                })

            # 互动最多的话题
            topics_df = pd.read_sql(top_interacted_topics_query, conn, params=params)
            top_topics = []
            for _, row in topics_df.iterrows():
                top_topics.append({
                    "id": row["id"],
                    "title": row.get("title", ""),
                    "url": row.get("url", ""),
                    "interaction_count": int(row["interaction_count"])
                })

            # 互动最多的问答
            questions_df = pd.read_sql(top_interacted_questions_query, conn, params=params)
            top_questions = []
            for _, row in questions_df.iterrows():
                top_questions.append({
                    "id": row["id"],
                    "title": row.get("title", ""),
                    "url": row.get("url", ""),
                    "interaction_count": int(row["interaction_count"])
                })

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
            activity_range = {
                "first_active": str(range_row[0]) if range_row and range_row[0] else None,
                "last_active": str(range_row[1]) if range_row and range_row[1] else None,
            }

        # 3. 排行榜联动
        ranking_info = fetch_user_ranking_info(user_name)

        # 4. 自动生成用户标签
        tags = []
        stats = base_detail.get("stats", {})
        if stats.get("topic_count", 0) >= 5:
            tags.append("话题创作者")
        if stats.get("topic_comment_count", 0) + stats.get("question_comment_count", 0) >= 20:
            tags.append("活跃评论者")
        if stats.get("total_likes", 0) >= 50:
            tags.append("高人气用户")
        if comment_depth.get("avg_length", 0) >= 100:
            tags.append("深度评论者")
        if ranking_info and ranking_info.get("rank") is not None:
            if ranking_info["rank"] <= 10:
                tags.append("Top 10 核心用户")
            elif ranking_info["rank"] <= 50:
                tags.append("Top 50 影响力用户")
            else:
                tags.append("榜上有名")
            if ranking_info.get("quality_score", 0) and ranking_info["quality_score"] >= 8:
                tags.append("高质量贡献者")
            if ranking_info.get("innovation_score", 0) and ranking_info["innovation_score"] >= 7:
                tags.append("创新先锋")
            if ranking_info.get("sentiment_score", 0) and ranking_info["sentiment_score"] >= 8:
                tags.append("正能量贡献者")
            if ranking_info.get("consistency_score", 0) and ranking_info["consistency_score"] >= 7:
                tags.append("持续活跃")
            if ranking_info.get("diversity_score", 0) and ranking_info["diversity_score"] >= 8:
                tags.append("跨领域达人")

        # 话题参与度 vs 问答参与度
        topic_participation = stats.get("topic_count", 0) + stats.get("topic_comment_count", 0)
        question_participation = stats.get("question_comment_count", 0)

        return {
            **base_detail,
            "daily_activity": daily_activity,
            "top_interacted_topics": top_topics,
            "top_interacted_questions": top_questions,
            "comment_depth": comment_depth,
            "activity_range": activity_range,
            "ranking_info": ranking_info,
            "tags": tags,
            "participation": {
                "topic": topic_participation,
                "question": question_participation,
            }
        }

    except Exception as e:
        logger.error(f"查询用户画像失败: {e}")
        return {
            **base_detail,
            "daily_activity": [],
            "top_interacted_topics": [],
            "top_interacted_questions": [],
            "comment_depth": {},
            "activity_range": {},
            "ranking_info": None,
            "tags": [],
            "participation": {"topic": 0, "question": 0},
        }
