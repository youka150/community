"""
华为开发者社区 & 昇腾社区 - 社会网络分析与智能挖掘服务
"""

from contextlib import asynccontextmanager
from datetime import datetime
from typing import Optional, Dict
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from config import logger, DATABASE_URL, LLM_API_KEY, LLM_BASE_URL
from database import fetch_comments, fetch_user_interactions
from services.lda_service import perform_lda_analysis
from services.bertopic_service import perform_bertopic_analysis
from services.network_service import perform_network_analysis
from services.clustering_service import perform_user_clustering
from services.llm_service import perform_ai_analysis, stream_all_insights, stream_single_insight
from services.hotspot_service import analyze_elite_hotspots, predict_rising_stars, stream_commercial_insights
from services.cache_service import cache_manager, CACHE_TTL_L1, CACHE_TTL_L2, CACHE_TTL_L3
from database import fetch_comments, fetch_user_interactions, init_ranking_table, save_ranking_snapshot, fetch_daily_drilldown, fetch_user_detail, fetch_all_users, fetch_user_profile, fetch_date_range

# 昇腾社区数据层
from ascend_database import (
    fetch_ascend_comments, fetch_ascend_user_interactions,
    fetch_ascend_user_detail, fetch_ascend_all_users,
    fetch_ascend_user_profile, fetch_ascend_daily_drilldown,
    fetch_ascend_tags, fetch_ascend_section_stats,
    fetch_ascend_qa_health, init_ascend_ranking_table,
    save_ascend_ranking_snapshot, fetch_ascend_date_range
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 服务启动时初始化排行榜表和缓存服务
    init_ranking_table()
    init_ascend_ranking_table()  # 昇腾排行榜表
    cache_manager.initialize()
    try:
        yield
    finally:
        db = getattr(app.state, "db", None)
        if db is not None:
            db.close()


app = FastAPI(
    title="华为 & 昇腾开发者社区分析服务",
    description="社会网络分析、用户建模、热点识别（同时服务华为社区和昇腾社区）",
    version="2.0.0",
    lifespan=lifespan
)

# 跨域配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


WEIGHT_KEYS = [
    "pagerank", "in_degree", "betweenness", "quality",
    "innovation", "sentiment", "diversity", "consistency",
]


def parse_custom_weights(request: Request) -> Optional[Dict[str, float]]:
    """从 query 参数中解析自定义权重。支持 0-1 和 0-100 两种输入。"""
    parsed: Dict[str, float] = {}
    has_any = False

    for key in WEIGHT_KEYS:
        raw = request.query_params.get(f"weight_{key}")
        if raw is None or raw == "":
            continue

        try:
            val = max(float(raw), 0.0)
        except ValueError:
            continue

        has_any = True
        parsed[key] = val

    if not has_any:
        return None

    max_val = max(parsed.values()) if parsed else 0.0
    scale = 100.0 if max_val > 1.0 else 1.0

    full_weights = {key: max(parsed.get(key, 0.0) / scale, 0.0) for key in WEIGHT_KEYS}
    total = sum(full_weights.values())
    if total <= 0:
        return None

    return {key: full_weights[key] / total for key in WEIGHT_KEYS}


@app.get("/")
async def root():
    return {"message": "华为开发者社区分析服务", "version": "1.0.0"}


@app.get("/api/health")
async def health_check():
    """健康检查"""
    return {
        "status": "ok",
        "database": bool(DATABASE_URL),
        "llm": bool(LLM_API_KEY and LLM_BASE_URL)
    }


@app.get("/api/date-range")
async def get_date_range_api():
    """获取整体数据库时间范围限制"""
    try:
        cache_key = "global_date_range"
        cached = cache_manager.get(cache_key)
        if cached is not None:
            return {"success": True, "data": cached}
            
        result = fetch_date_range()
        cache_manager.set(cache_key, result, CACHE_TTL_L2)
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"获取日期限制失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/ascend/date-range")
async def get_ascend_date_range_api():
    """获取昇腾整体数据库时间范围限制"""
    try:
        cache_key = "ascend_global_date_range"
        cached = cache_manager.get(cache_key)
        if cached is not None:
            return {"success": True, "data": cached}
            
        result = fetch_ascend_date_range()
        cache_manager.set(cache_key, result, CACHE_TTL_L2)
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"获取昇腾日期限制失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/topics")
async def get_topic_analysis(
    start_date: str = Query(default="2025-12-01"),
    end_date: str = Query(default="2025-12-31"),
    n_topics: int = Query(default=8, ge=2, le=20),
    method: str = Query(default="lda", description="主题模型类型: lda 或 bertopic"),
    use_cache: bool = Query(default=True)
):
    """主题分析（支持 LDA 和 BERTopic），结果缓存 10 分钟"""
    try:
        # 1. 检查缓存
        cache_key = cache_manager.build_key("topics", start_date, end_date, n_topics, method)
        if use_cache:
            cached = cache_manager.get(cache_key)
            if cached is not None:
                return {"success": True, "data": cached["data"], "meta": {**cached["meta"], "cached": True}}

        # 2. 实时计算
        comments_df = fetch_comments(start_date, end_date)
        if comments_df.empty:
            return {"success": False, "error": "没有找到评论数据"}
        
        texts = comments_df['content'].dropna().tolist()
        
        if method.lower() == "bertopic":
            result = perform_bertopic_analysis(texts, n_topics)
            if not result.topics:
                logger.warning("BERTopic 返回结果为空，可能发生错误")
        else:
            result = perform_lda_analysis(texts, n_topics)

        response_data = result.model_dump()
        meta = {"total_docs": len(texts), "date_range": {"start": start_date, "end": end_date}, "method": method}

        # 3. 写入缓存
        cache_manager.set(cache_key, {"data": response_data, "meta": meta}, CACHE_TTL_L1)

        return {"success": True, "data": response_data, "meta": meta}
    except Exception as e:
        logger.error(f"主题分析失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/network-analysis")
async def get_network_analysis(
    request: Request,
    start_date: str = Query(default="2025-12-01"),
    end_date: str = Query(default="2025-12-31"),
    top_n: int = Query(default=20, ge=5, le=100),
    use_cache: bool = Query(default=True),         # 允许前端强制刷新
    t: int = Query(default=0)                      # 接收时间戳防止浏览器缓存，但不作为后端缓存key
):
    """社会网络分析（增强版），结果缓存 10 分钟"""
    try:
        custom_weights = parse_custom_weights(request)
        use_cache = use_cache and not custom_weights

        # 1. 检查缓存
        cache_key = cache_manager.build_key("network", start_date, end_date, top_n)
        if use_cache:
            cached = cache_manager.get(cache_key)
            if cached is not None:
                return {
                    "success": True,
                    "data": cached,
                    "meta": {
                        "date_range": {"start": start_date, "end": end_date},
                        "cached": True
                    }
                }
        
        # 2. 实时计算
        edges_df = fetch_user_interactions(start_date, end_date)
        comments_df = fetch_comments(start_date, end_date)
        
        result = perform_network_analysis(edges_df, comments_df, top_n, custom_weights=custom_weights)
        result_data = result.model_dump()
        
        # 保存排行快照
        save_ranking_snapshot(start_date, end_date, top_n, result_data)
        
        # 3. 写入缓存
        cache_manager.set(cache_key, result_data, CACHE_TTL_L1)
        
        return {
            "success": True,
            "data": result_data,
            "meta": {"date_range": {"start": start_date, "end": end_date}}
        }
    except Exception as e:
        logger.error(f"网络分析失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/user-profiles")
async def get_user_profiles(
    start_date: str = Query(default="2025-12-01"),
    end_date: str = Query(default="2025-12-31"),
    n_clusters: int = Query(default=5, ge=2, le=10),
    use_cache: bool = Query(default=True)
):
    """用户画像聚类，结果缓存 10 分钟"""
    try:
        # 1. 检查缓存
        cache_key = cache_manager.build_key("profiles", start_date, end_date, n_clusters)
        if use_cache:
            cached = cache_manager.get(cache_key)
            if cached is not None:
                return {"success": True, "data": cached["data"], "meta": {**cached["meta"], "cached": True}}

        # 2. 实时计算
        comments_df = fetch_comments(start_date, end_date)
        if comments_df.empty:
            return {"success": False, "error": "没有找到评论数据"}
        
        result = perform_user_clustering(comments_df, n_clusters)
        response_data = result.model_dump()
        meta = {"total_users": comments_df['user_name'].nunique(), "date_range": {"start": start_date, "end": end_date}}

        # 3. 写入缓存
        cache_manager.set(cache_key, {"data": response_data, "meta": meta}, CACHE_TTL_L1)

        return {"success": True, "data": response_data, "meta": meta}
    except Exception as e:
        logger.error(f"用户聚类失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/ai-analysis")
async def get_ai_analysis(
    start_date: str = Query(default="2025-12-01"),
    end_date: str = Query(default="2025-12-31"),
    insight_type: str = Query(default=None)  # 'topic', 'user', 'trend', or None for all
):
    """大模型智能分析（支持单独重试某个洞察）"""
    try:
        # 获取数据
        comments_df = fetch_comments(start_date, end_date)
        edges_df = fetch_user_interactions(start_date, end_date)
        
        if comments_df.empty:
            return {"success": False, "error": "没有找到评论数据"}
        
        texts = comments_df['content'].dropna().tolist()
        sample_comments = texts[:50] if len(texts) > 50 else texts
        
        # 如果指定了 insight_type，只获取单个洞察
        if insight_type:
            from services.llm_service import retry_single_insight
            
            # 准备必要的数据
            topic_result = perform_lda_analysis(texts, n_topics=5)
            network_result = perform_network_analysis(edges_df, comments_df, top_n=10)
            user_result = perform_user_clustering(comments_df, n_clusters=4)
            
            single_insight = await retry_single_insight(
                insight_type=insight_type,
                topics=topic_result.topics,
                top_users=network_result.top_users,
                clusters=user_result.clusters,
                sample_comments=sample_comments
            )
            
            return {
                "success": True,
                "data": {
                    "ai_insights": single_insight
                },
                "meta": {
                    "date_range": {"start": start_date, "end": end_date},
                    "analyzed_at": datetime.now().isoformat(),
                    "insight_type": insight_type
                }
            }
        
        # 完整分析
        topic_result = perform_lda_analysis(texts, n_topics=5)
        network_result = perform_network_analysis(edges_df, comments_df, top_n=10)
        user_result = perform_user_clustering(comments_df, n_clusters=4)
        
        # AI 智能分析
        ai_result = await perform_ai_analysis(
            topics=topic_result.topics,
            top_users=network_result.top_users,
            clusters=user_result.clusters,
            sample_comments=sample_comments
        )
        
        return {
            "success": True,
            "data": {
                "topics": topic_result.model_dump(),
                "network": network_result.model_dump(),
                "users": user_result.model_dump(),
                "ai_insights": ai_result.model_dump()
            },
            "meta": {
                "date_range": {"start": start_date, "end": end_date},
                "analyzed_at": datetime.now().isoformat()
            }
        }
    except Exception as e:
        logger.error(f"AI分析失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/ai-analysis/stream")
async def get_ai_analysis_stream(
    start_date: str = Query(default="2025-12-01"),
    end_date: str = Query(default="2025-12-31"),
):
    """流式 AI 智能分析 — 逐字输出 3 个洞察（SSE 格式）"""
    try:
        comments_df = fetch_comments(start_date, end_date)
        edges_df = fetch_user_interactions(start_date, end_date)

        if comments_df.empty:
            raise HTTPException(status_code=400, detail="没有找到评论数据")

        texts = comments_df['content'].dropna().tolist()
        sample_comments = texts[:50] if len(texts) > 50 else texts

        # 先执行非流式的结构分析（LDA、网络、聚类），这些结果作为 LLM prompt 的输入
        topic_result = perform_lda_analysis(texts, n_topics=5)
        network_result = perform_network_analysis(edges_df, comments_df, top_n=10)
        user_result = perform_user_clustering(comments_df, n_clusters=4)

        import json as _json

        async def generate():
            # 先发送非 AI 的结构化数据
            base_data = {
                "topics": topic_result.model_dump(),
                "network": network_result.model_dump(),
                "users": user_result.model_dump(),
            }
            yield f"event: base_data\ndata: {_json.dumps(base_data, ensure_ascii=False)}\n\n"

            # 然后流式输出 3 个 AI 洞察
            async for event in stream_all_insights(
                topics=topic_result.topics,
                top_users=network_result.top_users,
                clusters=user_result.clusters,
                sample_comments=sample_comments
            ):
                yield event

        return StreamingResponse(generate(), media_type="text/event-stream")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"流式AI分析失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/ai-analysis/stream-single")
async def get_ai_analysis_stream_single(
    start_date: str = Query(default="2025-12-01"),
    end_date: str = Query(default="2025-12-31"),
    insight_type: str = Query(..., description="洞察类型: topic, user, trend"),
):
    """流式重试单个 AI 洞察（SSE 格式）"""
    try:
        comments_df = fetch_comments(start_date, end_date)
        edges_df = fetch_user_interactions(start_date, end_date)

        if comments_df.empty:
            raise HTTPException(status_code=400, detail="没有找到评论数据")

        texts = comments_df['content'].dropna().tolist()
        sample_comments = texts[:50] if len(texts) > 50 else texts

        topic_result = perform_lda_analysis(texts, n_topics=5)
        network_result = perform_network_analysis(edges_df, comments_df, top_n=10)
        user_result = perform_user_clustering(comments_df, n_clusters=4)

        async def generate():
            async for event in stream_single_insight(
                insight_type=insight_type,
                topics=topic_result.topics,
                top_users=network_result.top_users,
                clusters=user_result.clusters,
                sample_comments=sample_comments
            ):
                yield event

        return StreamingResponse(generate(), media_type="text/event-stream")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"单个洞察流式重试失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/commercial-hotspots")
async def get_commercial_hotspots(
    start_date: str = Query(default="2025-12-01"),
    end_date: str = Query(default="2025-12-31"),
    top_n: int = Query(default=50, ge=10, le=200),
    n_clusters: int = Query(default=4, ge=2, le=8),
    use_cache: bool = Query(default=True),
):
    """商业热点挖掘，结果缓存 24 小时"""
    try:
        # 1. 检查缓存
        cache_key = cache_manager.build_key("hotspots", start_date, end_date, top_n, n_clusters)
        if use_cache:
            cached = cache_manager.get(cache_key)
            if cached is not None:
                return {"success": True, "data": cached["data"], "meta": {**cached["meta"], "cached": True}}

        # 2. 实时计算
        comments_df = fetch_comments(start_date, end_date)
        edges_df = fetch_user_interactions(start_date, end_date)

        if comments_df.empty:
            return {"success": False, "error": "没有找到评论数据"}

        # 复用现有的网络分析获取用户影响力排名
        network_result = perform_network_analysis(edges_df, comments_df, top_n=top_n)
        top_users = network_result.top_users

        # 精英用户商业热点聚类
        hotspot_result = analyze_elite_hotspots(
            top_users=top_users,
            comments_df=comments_df,
            n_clusters=n_clusters
        )

        # 高潜用户预测
        all_user_names = comments_df['user_name'].unique().tolist()
        rising_stars = predict_rising_stars(
            top_users=network_result.all_users or top_users,
            all_user_names=all_user_names,
            comments_df=comments_df
        )

        response_data = {
            "hotspots": hotspot_result,
            "rising_stars": rising_stars,
            "network_weights": network_result.weights
        }
        meta = {"date_range": {"start": start_date, "end": end_date}, "analyzed_at": datetime.now().isoformat()}

        # 3. 写入缓存（24小时）
        cache_manager.set(cache_key, {"data": response_data, "meta": meta}, CACHE_TTL_L3)

        return {"success": True, "data": response_data, "meta": meta}
    except Exception as e:
        logger.error(f"商业热点分析失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/commercial-hotspots/stream")
async def get_commercial_hotspots_stream(
    start_date: str = Query(default="2025-12-01"),
    end_date: str = Query(default="2025-12-31"),
    top_n: int = Query(default=50, ge=10, le=200),
    n_clusters: int = Query(default=4, ge=2, le=8),
):
    """商业热点挖掘（流式SSE）— 先发送结构化数据，再流式输出LLM商业分析"""
    try:
        comments_df = fetch_comments(start_date, end_date)
        edges_df = fetch_user_interactions(start_date, end_date)

        if comments_df.empty:
            raise HTTPException(status_code=400, detail="没有找到评论数据")

        network_result = perform_network_analysis(edges_df, comments_df, top_n=top_n)
        top_users = network_result.top_users

        hotspot_result = analyze_elite_hotspots(
            top_users=top_users,
            comments_df=comments_df,
            n_clusters=n_clusters
        )

        all_user_names = comments_df['user_name'].unique().tolist()
        rising_stars = predict_rising_stars(
            top_users=network_result.all_users or top_users,
            all_user_names=all_user_names,
            comments_df=comments_df
        )

        import json as _json

        async def generate():
            # 先发送结构化数据
            base_data = {
                "hotspots": hotspot_result,
                "rising_stars": rising_stars,
                "network_weights": network_result.weights
            }
            yield f"event: base_data\ndata: {_json.dumps(base_data, ensure_ascii=False)}\n\n"

            # 然后流式输出 LLM 商业分析
            async for event in stream_commercial_insights(
                clusters=hotspot_result.get("clusters", []),
                elite_users=hotspot_result.get("elite_users", []),
                rising_stars=rising_stars
            ):
                yield event

        return StreamingResponse(generate(), media_type="text/event-stream")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"商业热点流式分析失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/drilldown")
async def get_drilldown_data(
    date: str = Query(..., description="日期，格式 YYYY-MM-DD")
):
    """获取指定日期的活跃用户和活跃话题/问答（用于钻取功能）"""
    try:
        result = fetch_daily_drilldown(date)
        return {
            "success": True,
            "date": date,
            "data": result
        }
    except Exception as e:
        logger.error(f"钻取数据获取失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/user-detail")
async def get_user_detail(
    user_name: str = Query(..., description="用户名"),
    use_cache: bool = Query(default=True),
    t: int = Query(default=0)  # 接收时间戳防止浏览器缓存，但不作为后端缓存key
):
    """获取指定用户的话题、话题评论、问答评论详情，结果缓存 1 小时"""
    try:
        # 1. 检查缓存
        cache_key = cache_manager.build_key("user_detail", user_name)
        if use_cache:
            cached = cache_manager.get(cache_key)
            if cached is not None:
                return {
                    "success": True, 
                    "data": cached,
                    "meta": {"cached": True}
                }

        # 2. 实时查询
        result = fetch_user_detail(user_name)
        
        # 3. 写入缓存 (L1 = 1小时)
        cache_manager.set(cache_key, result, CACHE_TTL_L1)
        
        return {
            "success": True,
            "data": result,
            "meta": {"cached": False}
        }
    except Exception as e:
        logger.error(f"用户详情获取失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/users")
async def get_users(
    search: str = Query(default="", description="搜索关键词（用户名模糊匹配）"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=10, le=200),
    use_cache: bool = Query(default=True),
):
    """获取用户列表（支持搜索分页，用于左侧栏展示）"""
    try:
        cache_key = cache_manager.build_key("users_list", search, page, page_size)
        if use_cache:
            cached = cache_manager.get(cache_key)
            if cached is not None:
                return {"success": True, "data": cached, "meta": {"cached": True}}

        result = fetch_all_users(search=search, page=page, page_size=page_size)

        cache_manager.set(cache_key, result, CACHE_TTL_L1)

        return {"success": True, "data": result, "meta": {"cached": False}}
    except Exception as e:
        logger.error(f"获取用户列表失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/user-profile")
async def get_user_profile(
    user_name: str = Query(..., description="用户名"),
    use_cache: bool = Query(default=True),
    t: int = Query(default=0),
):
    """获取用户完整画像（含排行榜联动），结果缓存 1 小时"""
    try:
        cache_key = cache_manager.build_key("user_profile", user_name)
        if use_cache:
            cached = cache_manager.get(cache_key)
            if cached is not None:
                return {"success": True, "data": cached, "meta": {"cached": True}}

        result = fetch_user_profile(user_name)

        cache_manager.set(cache_key, result, CACHE_TTL_L1)

        return {"success": True, "data": result, "meta": {"cached": False}}
    except Exception as e:
        logger.error(f"获取用户画像失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/analyze")
async def analyze_full(
    days: int = 30,
    n_topics: int = 8,
    max_docs: int = 1200
):
    """完整分析（兼容原有接口）"""
    end_date = "2025-12-31"
    start_date = "2025-12-01"
    
    try:
        result = await get_ai_analysis(start_date, end_date)
        return result
    except Exception as e:
        logger.error(f"完整分析失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ========================= 昇腾社区 API =========================

@app.get("/api/ascend/topics")
async def get_ascend_topic_analysis(
    start_date: str = Query(default="2026-01-01"),
    end_date: str = Query(default="2026-04-01"),
    n_topics: int = Query(default=8, ge=2, le=20),
    method: str = Query(default="lda"),
    use_cache: bool = Query(default=True)
):
    """昇腾社区主题分析"""
    try:
        cache_key = cache_manager.build_key("ascend_topics", start_date, end_date, n_topics, method)
        if use_cache:
            cached = cache_manager.get(cache_key)
            if cached is not None:
                return {"success": True, "data": cached["data"], "meta": {**cached["meta"], "cached": True}}

        comments_df = fetch_ascend_comments(start_date, end_date)
        if comments_df.empty:
            return {"success": False, "error": "没有找到昇腾评论数据"}

        texts = comments_df['content'].dropna().tolist()
        if method.lower() == "bertopic":
            result = perform_bertopic_analysis(texts, n_topics)
        else:
            result = perform_lda_analysis(texts, n_topics)

        response_data = result.model_dump()
        meta = {"total_docs": len(texts), "date_range": {"start": start_date, "end": end_date}, "method": method}
        cache_manager.set(cache_key, {"data": response_data, "meta": meta}, CACHE_TTL_L1)
        return {"success": True, "data": response_data, "meta": meta}
    except Exception as e:
        logger.error(f"昇腾主题分析失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/ascend/network-analysis")
async def get_ascend_network_analysis(
    request: Request,
    start_date: str = Query(default="2026-01-01"),
    end_date: str = Query(default="2026-04-01"),
    top_n: int = Query(default=20, ge=5, le=100),
    use_cache: bool = Query(default=True),
    t: int = Query(default=0)
):
    """昇腾社区网络分析（与华为对齐，8 维评分）"""
    try:
        custom_weights = parse_custom_weights(request)
        use_cache = use_cache and not custom_weights

        cache_key = cache_manager.build_key("ascend_network", start_date, end_date, top_n)
        if use_cache:
            cached = cache_manager.get(cache_key)
            if cached is not None:
                return {"success": True, "data": cached, "meta": {"date_range": {"start": start_date, "end": end_date}, "cached": True}}

        edges_df = fetch_ascend_user_interactions(start_date, end_date)
        comments_df = fetch_ascend_comments(start_date, end_date)

        result = perform_network_analysis(edges_df, comments_df, top_n, custom_weights=custom_weights)
        result_data = result.model_dump()

        save_ascend_ranking_snapshot(start_date, end_date, top_n, result_data)
        cache_manager.set(cache_key, result_data, CACHE_TTL_L1)

        return {"success": True, "data": result_data, "meta": {"date_range": {"start": start_date, "end": end_date}}}
    except Exception as e:
        logger.error(f"昇腾网络分析失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/ascend/user-profiles")
async def get_ascend_user_profiles(
    start_date: str = Query(default="2026-01-01"),
    end_date: str = Query(default="2026-04-01"),
    n_clusters: int = Query(default=5, ge=2, le=10),
    use_cache: bool = Query(default=True)
):
    """昇腾社区用户画像聚类"""
    try:
        cache_key = cache_manager.build_key("ascend_profiles", start_date, end_date, n_clusters)
        if use_cache:
            cached = cache_manager.get(cache_key)
            if cached is not None:
                return {"success": True, "data": cached["data"], "meta": {**cached["meta"], "cached": True}}

        comments_df = fetch_ascend_comments(start_date, end_date)
        if comments_df.empty:
            return {"success": False, "error": "没有找到昇腾评论数据"}

        result = perform_user_clustering(comments_df, n_clusters)
        response_data = result.model_dump()
        meta = {"total_users": comments_df['user_name'].nunique(), "date_range": {"start": start_date, "end": end_date}}
        cache_manager.set(cache_key, {"data": response_data, "meta": meta}, CACHE_TTL_L1)
        return {"success": True, "data": response_data, "meta": meta}
    except Exception as e:
        logger.error(f"昇腾用户聚类失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/ascend/ai-analysis/stream")
async def get_ascend_ai_analysis_stream(
    start_date: str = Query(default="2026-01-01"),
    end_date: str = Query(default="2026-04-01"),
):
    """昇腾社区流式 AI 智能分析"""
    try:
        comments_df = fetch_ascend_comments(start_date, end_date)
        edges_df = fetch_ascend_user_interactions(start_date, end_date)

        if comments_df.empty:
            raise HTTPException(status_code=400, detail="没有找到昇腾评论数据")

        texts = comments_df['content'].dropna().tolist()
        sample_comments = texts[:50] if len(texts) > 50 else texts

        topic_result = perform_lda_analysis(texts, n_topics=5)
        network_result = perform_network_analysis(edges_df, comments_df, top_n=10)
        user_result = perform_user_clustering(comments_df, n_clusters=4)

        import json as _json

        async def generate():
            base_data = {
                "topics": topic_result.model_dump(),
                "network": network_result.model_dump(),
                "users": user_result.model_dump(),
            }
            yield f"event: base_data\ndata: {_json.dumps(base_data, ensure_ascii=False)}\n\n"

            async for event in stream_all_insights(
                topics=topic_result.topics,
                top_users=network_result.top_users,
                clusters=user_result.clusters,
                sample_comments=sample_comments
            ):
                yield event

        return StreamingResponse(generate(), media_type="text/event-stream")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"昇腾流式AI分析失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/ascend/ai-analysis/stream-single")
async def get_ascend_ai_analysis_stream_single(
    start_date: str = Query(default="2026-01-01"),
    end_date: str = Query(default="2026-04-01"),
    insight_type: str = Query(..., description="洞察类型: topic, user, trend"),
):
    """昇腾社区流式重试单个 AI 洞察"""
    try:
        comments_df = fetch_ascend_comments(start_date, end_date)
        edges_df = fetch_ascend_user_interactions(start_date, end_date)

        if comments_df.empty:
            raise HTTPException(status_code=400, detail="没有找到昇腾评论数据")

        texts = comments_df['content'].dropna().tolist()
        sample_comments = texts[:50] if len(texts) > 50 else texts

        topic_result = perform_lda_analysis(texts, n_topics=5)
        network_result = perform_network_analysis(edges_df, comments_df, top_n=10)
        user_result = perform_user_clustering(comments_df, n_clusters=4)

        async def generate():
            async for event in stream_single_insight(
                insight_type=insight_type,
                topics=topic_result.topics,
                top_users=network_result.top_users,
                clusters=user_result.clusters,
                sample_comments=sample_comments
            ):
                yield event

        return StreamingResponse(generate(), media_type="text/event-stream")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"昇腾单个洞察流式重试失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/ascend/commercial-hotspots/stream")
async def get_ascend_commercial_hotspots_stream(
    start_date: str = Query(default="2026-01-01"),
    end_date: str = Query(default="2026-04-01"),
    top_n: int = Query(default=50, ge=10, le=200),
    n_clusters: int = Query(default=4, ge=2, le=8),
):
    """昇腾社区商业热点挖掘（流式SSE）"""
    try:
        comments_df = fetch_ascend_comments(start_date, end_date)
        edges_df = fetch_ascend_user_interactions(start_date, end_date)

        if comments_df.empty:
            raise HTTPException(status_code=400, detail="没有找到昇腾评论数据")

        network_result = perform_network_analysis(edges_df, comments_df, top_n=top_n)
        top_users = network_result.top_users

        hotspot_result = analyze_elite_hotspots(
            top_users=top_users,
            comments_df=comments_df,
            n_clusters=n_clusters
        )

        all_user_names = comments_df['user_name'].unique().tolist()
        rising_stars = predict_rising_stars(
            top_users=top_users,
            all_user_names=all_user_names,
            comments_df=comments_df
        )

        import json as _json

        async def generate():
            base_data = {
                "hotspots": hotspot_result,
                "rising_stars": rising_stars,
                "network_weights": network_result.weights
            }
            yield f"event: base_data\ndata: {_json.dumps(base_data, ensure_ascii=False)}\n\n"

            async for event in stream_commercial_insights(
                clusters=hotspot_result.get("clusters", []),
                elite_users=hotspot_result.get("elite_users", []),
                rising_stars=rising_stars
            ):
                yield event

        return StreamingResponse(generate(), media_type="text/event-stream")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"昇腾商业热点流式分析失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/ascend/drilldown")
async def get_ascend_drilldown_data(
    date: str = Query(..., description="日期，格式 YYYY-MM-DD")
):
    """昇腾社区指定日期钻取"""
    try:
        result = fetch_ascend_daily_drilldown(date)
        return {"success": True, "date": date, "data": result}
    except Exception as e:
        logger.error(f"昇腾钻取数据获取失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/ascend/user-detail")
async def get_ascend_user_detail(
    user_name: str = Query(..., description="用户名"),
    use_cache: bool = Query(default=True),
    t: int = Query(default=0)
):
    """昇腾社区用户详情"""
    try:
        cache_key = cache_manager.build_key("ascend_user_detail", user_name)
        if use_cache:
            cached = cache_manager.get(cache_key)
            if cached is not None:
                return {"success": True, "data": cached, "meta": {"cached": True}}

        result = fetch_ascend_user_detail(user_name)
        cache_manager.set(cache_key, result, CACHE_TTL_L1)
        return {"success": True, "data": result, "meta": {"cached": False}}
    except Exception as e:
        logger.error(f"昇腾用户详情获取失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/ascend/users")
async def get_ascend_users(
    search: str = Query(default="", description="搜索关键词"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=10, le=200),
    use_cache: bool = Query(default=True),
):
    """昇腾社区用户列表"""
    try:
        cache_key = cache_manager.build_key("ascend_users_list", search, page, page_size)
        if use_cache:
            cached = cache_manager.get(cache_key)
            if cached is not None:
                return {"success": True, "data": cached, "meta": {"cached": True}}

        result = fetch_ascend_all_users(search=search, page=page, page_size=page_size)
        cache_manager.set(cache_key, result, CACHE_TTL_L1)
        return {"success": True, "data": result, "meta": {"cached": False}}
    except Exception as e:
        logger.error(f"昇腾获取用户列表失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/ascend/user-profile")
async def get_ascend_user_profile(
    user_name: str = Query(..., description="用户名"),
    use_cache: bool = Query(default=True),
    t: int = Query(default=0),
):
    """昇腾社区用户完整画像"""
    try:
        cache_key = cache_manager.build_key("ascend_user_profile", user_name)
        if use_cache:
            cached = cache_manager.get(cache_key)
            if cached is not None:
                return {"success": True, "data": cached, "meta": {"cached": True}}

        result = fetch_ascend_user_profile(user_name)
        cache_manager.set(cache_key, result, CACHE_TTL_L1)
        return {"success": True, "data": result, "meta": {"cached": False}}
    except Exception as e:
        logger.error(f"昇腾获取用户画像失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/ascend/tags")
async def get_ascend_tags(
    use_cache: bool = Query(default=True),
):
    """昇腾社区标签列表"""
    try:
        cache_key = cache_manager.build_key("ascend_tags")
        if use_cache:
            cached = cache_manager.get(cache_key)
            if cached is not None:
                return {"success": True, "data": cached, "meta": {"cached": True}}

        result = fetch_ascend_tags()
        cache_manager.set(cache_key, result, CACHE_TTL_L2)
        return {"success": True, "data": result, "meta": {"cached": False}}
    except Exception as e:
        logger.error(f"昇腾获取标签失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/ascend/section-stats")
async def get_ascend_section_stats(
    use_cache: bool = Query(default=True),
):
    """昇腾社区板块统计（含板块间用户流动数据，用于桑基图/热力矩阵）"""
    try:
        cache_key = cache_manager.build_key("ascend_section_stats")
        if use_cache:
            cached = cache_manager.get(cache_key)
            if cached is not None:
                return {"success": True, "data": cached, "meta": {"cached": True}}

        result = fetch_ascend_section_stats()
        cache_manager.set(cache_key, result, CACHE_TTL_L2)
        return {"success": True, "data": result, "meta": {"cached": False}}
    except Exception as e:
        logger.error(f"昇腾获取板块统计失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/ascend/qa-health")
async def get_ascend_qa_health(
    use_cache: bool = Query(default=True),
):
    """昇腾社区问答健康度指标"""
    try:
        cache_key = cache_manager.build_key("ascend_qa_health")
        if use_cache:
            cached = cache_manager.get(cache_key)
            if cached is not None:
                return {"success": True, "data": cached, "meta": {"cached": True}}

        result = fetch_ascend_qa_health()
        cache_manager.set(cache_key, result, CACHE_TTL_L2)
        return {"success": True, "data": result, "meta": {"cached": False}}
    except Exception as e:
        logger.error(f"昇腾获取问答健康度失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ========================= 缓存管理 API =========================

@app.get("/api/cache/stats")
async def get_cache_stats():
    """获取缓存统计信息（后端类型、Key数量、命中率）"""
    return {
        "success": True,
        "data": cache_manager.get_stats()
    }


@app.delete("/api/cache/clear")
async def clear_cache(
    prefix: str = Query(default=None, description="可选前缀过滤，如 'community:network' 只清除网络分析缓存")
):
    """清除缓存，支持按前缀过滤"""
    count = cache_manager.clear(prefix)
    return {
        "success": True,
        "message": f"已清除 {count} 个缓存条目",
        "cleared_count": count
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8008)
