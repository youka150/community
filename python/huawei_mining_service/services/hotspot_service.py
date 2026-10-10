"""
商业热点挖掘服务
基于核心用户群(KOL)语义聚类 + LLM商业提炼，挖掘可操作的商业热点。
同时支持"高潜用户预测(Rising Stars)"——通过语义相似度发现潜力新星。
"""

import json
import numpy as np
import pandas as pd
from typing import List, Dict, AsyncGenerator
from config import logger

# ============ 语义向量化与聚类 ============


def _get_embedding_model():
    """延迟加载 sentence-transformers 模型（单例缓存）"""
    if not hasattr(_get_embedding_model, "_model"):
        from sentence_transformers import SentenceTransformer

        logger.info(
            "🔄 加载 sentence-transformers 模型 (paraphrase-multilingual-MiniLM-L12-v2)..."
        )
        _get_embedding_model._model = SentenceTransformer(
            "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
        )
        logger.info("✅ Embedding 模型加载完成")
    return _get_embedding_model._model


def _aggregate_user_texts(comments_df: pd.DataFrame, user_list: list) -> Dict[str, str]:
    """
    将指定用户的所有评论聚合为一段文本。
    返回 {user_name: aggregated_text}
    """
    filtered = comments_df[comments_df["user_name"].isin(user_list)]
    if filtered.empty:
        return {}

    grouped = (
        filtered.groupby("user_name")["content"]
        .apply(
            lambda texts: "\n".join(
                [t for t in texts if isinstance(t, str) and len(t.strip()) > 10]
            )
        )
        .reset_index()
    )

    result = {}
    for _, row in grouped.iterrows():
        if len(row["content"].strip()) > 20:
            result[row["user_name"]] = row["content"]
    return result


def _compute_embeddings(texts: List[str]) -> np.ndarray:
    """批量计算文本embedding"""
    model = _get_embedding_model()
    # 截断过长的文本（避免超出模型限制）
    truncated = [t[:2000] for t in texts]
    embeddings = model.encode(
        truncated, show_progress_bar=False, normalize_embeddings=True
    )
    return embeddings


def _semantic_cluster(embeddings: np.ndarray, n_clusters: int = 5) -> np.ndarray:
    """对 embedding 矩阵做 KMeans 聚类"""
    from sklearn.cluster import KMeans

    # 确保聚类数不超过样本数
    actual_k = min(n_clusters, len(embeddings))
    if actual_k < 2:
        return np.zeros(len(embeddings), dtype=int)

    km = KMeans(n_clusters=actual_k, random_state=42, n_init=10)
    labels = km.fit_predict(embeddings)
    return labels


def _extract_cluster_keywords(
    texts: List[str], labels: np.ndarray
) -> Dict[int, List[str]]:
    """为每个聚类提取代表性关键词（基于TF-IDF）"""
    from sklearn.feature_extraction.text import TfidfVectorizer
    from utils import preprocess_text

    cluster_keywords = {}
    unique_labels = sorted(set(labels))

    for label in unique_labels:
        cluster_texts = [texts[i] for i in range(len(texts)) if labels[i] == label]
        if not cluster_texts:
            continue

        # 预处理并合并
        processed = []
        for t in cluster_texts:
            words = preprocess_text(t) if isinstance(t, str) else []
            processed.append(" ".join(words))

        try:
            vectorizer = TfidfVectorizer(max_features=200, min_df=1, max_df=0.9)
            tfidf = vectorizer.fit_transform(processed)
            feature_names = vectorizer.get_feature_names_out()

            # 取整个簇的平均TF-IDF，选Top关键词
            mean_tfidf = tfidf.mean(axis=0).A1
            top_indices = mean_tfidf.argsort()[-8:][::-1]
            cluster_keywords[int(label)] = [feature_names[i] for i in top_indices]
        except Exception:
            cluster_keywords[int(label)] = []

    return cluster_keywords


# ============ 核心分析函数 ============


def analyze_elite_hotspots(
    top_users: List[Dict],
    comments_df: pd.DataFrame,
    n_clusters: int = 4,
    top_percent: float = 0.15,
) -> Dict:
    """
    路线一：基于核心用户群(KOL)的商业热点语义提取

    1. 筛选 Top N% 精英用户（基于 influence_score）
    2. 聚合其评论文本，做 sentence-transformers 向量化
    3. KMeans 语义聚类，提取每个聚类的关键词和代表性评论

    返回结构化的聚类结果，供后续 LLM 商业化提炼。
    """
    logger.info(f"🔍 开始精英用户商业热点分析 (top_percent={top_percent})")

    if not top_users or comments_df.empty:
        logger.warning("缺少用户或评论数据，无法进行热点分析")
        return {"clusters": [], "elite_count": 0}

    # 1. 筛选精英用户
    elite_count = max(int(len(top_users) * top_percent), 3)
    sorted_users = sorted(
        top_users, key=lambda u: u.get("influence_score", 0), reverse=True
    )
    elite_users = [u["user"] for u in sorted_users[:elite_count]]
    logger.info(f"📊 筛选出 {len(elite_users)} 位精英用户")

    # 2. 聚合文本
    user_texts = _aggregate_user_texts(comments_df, elite_users)
    if len(user_texts) < 2:
        logger.warning("精英用户有效文本不足，降级返回")
        return {"clusters": [], "elite_count": len(elite_users)}

    users_ordered = list(user_texts.keys())
    texts_ordered = list(user_texts.values())

    # 3. 向量化
    logger.info("🧠 计算语义向量...")
    embeddings = _compute_embeddings(texts_ordered)

    # 4. 语义聚类
    actual_n = min(n_clusters, len(texts_ordered))
    logger.info(f"🔢 语义聚类 (k={actual_n})...")
    labels = _semantic_cluster(embeddings, n_clusters=actual_n)

    # 5. 提取关键词
    cluster_keywords = _extract_cluster_keywords(texts_ordered, labels)

    # 6. 组装结果
    clusters = []
    for label_id in sorted(set(labels)):
        members = [
            users_ordered[i] for i in range(len(users_ordered)) if labels[i] == label_id
        ]
        member_texts = [
            texts_ordered[i] for i in range(len(texts_ordered)) if labels[i] == label_id
        ]

        # 取每个用户的前 200 字作为样本
        sample_snippets = []
        for u, t in zip(members, member_texts):
            snippet = t[:200].replace("\n", " ").strip()
            sample_snippets.append({"user": u, "snippet": snippet})

        clusters.append(
            {
                "cluster_id": int(label_id),
                "keywords": cluster_keywords.get(int(label_id), []),
                "member_count": len(members),
                "members": members,
                "sample_snippets": sample_snippets[:5],  # 取前5条样本
            }
        )

    logger.info(f"✅ 精英热点分析完成，产生 {len(clusters)} 个语义簇")
    return {
        "clusters": clusters,
        "elite_count": len(elite_users),
        "elite_users": elite_users,
    }


def predict_rising_stars(
    top_users: List[Dict],
    all_user_names: List[str],
    comments_df: pd.DataFrame,
    top_k_elite: int = 15,
    max_stars: int = 15,
    similarity_threshold: float = 0.5,
) -> List[Dict]:
    """
    路线二：高潜价值用户预测 (Rising Stars)

    原理：计算普通用户 embedding 与精英群体质心的真实余弦相似度，
    只有相似度超过阈值的用户才被认为是"潜力新星"。
    潜力分 = 语义相似度 * 0.7 + 成长空间 * 0.3，上限为 1.0。
    """
    logger.info("🚀 开始高潜用户预测 (Rising Stars) - 基于余弦相似度")

    if not top_users or comments_df.empty:
        return []

    sorted_users = sorted(
        top_users, key=lambda u: u.get("influence_score", 0), reverse=True
    )
    actual_top_k = min(top_k_elite, len(sorted_users))
    elite_names = [u["user"] for u in sorted_users[:actual_top_k]]
    elite_set = set(elite_names)

    # 普通用户 = 全部用户 - 精英用户集
    ordinary_names = [n for n in all_user_names if n not in elite_set]

    if len(ordinary_names) == 0:
        logger.info("无普通用户可分析，跳过")
        return []

    # 聚合文本
    elite_texts = _aggregate_user_texts(comments_df, elite_names)
    ordinary_texts = _aggregate_user_texts(comments_df, ordinary_names)

    if len(elite_texts) < 3 or len(ordinary_texts) < 2:
        logger.warning("用户文本数据不足，跳过 Rising Stars (精英群体至少需要3位)")
        return []

    elite_keys = list(elite_texts.keys())
    elite_vals = list(elite_texts.values())
    ordinary_keys = list(ordinary_texts.keys())
    ordinary_vals = list(ordinary_texts.values())

    logger.info(
        f"🧠 计算 {len(elite_keys)} 位精英 + {len(ordinary_keys)} 位普通用户的语义向量..."
    )
    elite_embs = _compute_embeddings(elite_vals)   # shape: (E, D)，已 L2 归一化
    ordinary_embs = _compute_embeddings(ordinary_vals)  # shape: (N, D)，已 L2 归一化

    # 构建精英多中心：对精英做 KMeans（最多3簇），用多个质心覆盖精英群的语义多样性
    n_elite_clusters = min(3, len(elite_embs))
    if n_elite_clusters >= 2:
        from sklearn.cluster import KMeans
        km = KMeans(n_clusters=n_elite_clusters, random_state=42, n_init=10)
        km.fit(elite_embs)
        # 对质心做 L2 归一化，使点积 == 余弦相似度
        centroids = km.cluster_centers_
        norms = np.linalg.norm(centroids, axis=1, keepdims=True)
        centroids = centroids / np.maximum(norms, 1e-9)
    else:
        # 只有1个质心：取均值并归一化
        centroid = elite_embs.mean(axis=0)
        norm = np.linalg.norm(centroid)
        centroids = (centroid / max(norm, 1e-9)).reshape(1, -1)

    # 余弦相似度：ordinary_embs 已归一化，centroids 已归一化 → 点积即余弦相似度
    # cos_matrix shape: (N, n_elite_clusters)
    cos_matrix = ordinary_embs @ centroids.T
    # 取每位普通用户与最近精英簇的最大余弦相似度
    cos_scores = cos_matrix.max(axis=1)   # shape: (N,)

    # 构建影响力查找表与基线
    influence_map = {u["user"]: u.get("influence_score", 0) for u in top_users}
    ordinary_influences = [influence_map.get(k, 0) for k in ordinary_keys]
    
    import math
    if ordinary_influences:
        inf_max = max(ordinary_influences) if max(ordinary_influences) > 0 else 1e-6
    else:
        inf_max = 1e-6

    rising_stars = []
    for i, name in enumerate(ordinary_keys):
        similarity = float(cos_scores[i])

        # 只收录真正与精英语义相似的用户
        if similarity < similarity_threshold:
            continue

        current_influence = influence_map.get(name, 0)
        
        # 成长空间评估 (Growth Room)
        # 学术依据: "Rising Stars in Online Networks"
        # 节点潜力不仅是相似度，还需要将中心性(影响力)的倒数化作上升势能。
        # 使用极大值归一化的指数平滑衰减 (Exponential Decay)，避免线性归一导致的数值塌缩。
        # 影响力极小时成长空间接近1.0，随影响力上升平滑衰减。
        normalized_inf = current_influence / inf_max
        growth_room = math.exp(-3.0 * normalized_inf)  # k=3.0 控制衰减速率

        # 复合潜力得分 (Potential Score)
        # 放弃生硬的 0.7加权，采用效用理论中的调和函数 (Harmonic Mean)，
        # 凸显既有内容相似优势，又能兼顾广阔成长的“双优潜力股”。
        if similarity + growth_room > 0:
            potential_score = 2 * (similarity * growth_room) / (similarity + growth_room)
        else:
            potential_score = 0.0

        rising_stars.append(
            {
                "user": name,
                "similarity_to_elite": round(similarity, 4),
                "current_influence": round(current_influence, 6),
                "growth_room": round(growth_room, 4),  # 暴露给下游 LLM 分析
                "potential_score": round(potential_score, 4),
            }
        )

    # 测试打印影响力分
    print(f"普通用户影响力分布 (部分)：{rising_stars[:50]}")
    # 按潜力分排序
    rising_stars.sort(key=lambda x: x["potential_score"], reverse=True)

    logger.info(
        f"✅ 相似度阈值 {similarity_threshold}：{len(rising_stars)} 位候选新星，返回 Top {max_stars}"
    )
    return rising_stars[:max_stars]


# ============ LLM 商业提炼（流式） ============


def _build_commercial_prompt(clusters: List[Dict], elite_users: List[str]) -> tuple:
    """构建商业热点分析的 LLM prompt"""

    # 构建聚类摘要
    cluster_summaries = []
    for c in clusters:
        summary = {
            "簇ID": c["cluster_id"],
            "关键词": c["keywords"],
            "成员数": c["member_count"],
            "代表性发言": [s["snippet"] for s in c.get("sample_snippets", [])],
        }
        cluster_summaries.append(summary)

    prompt = f"""你是一位资深商业分析师和产品战略顾问。以下是从华为开发者社区中高影响力核心用户群体（共{len(elite_users)}位精英）的发言内容经过语义聚类后的结果：

{json.dumps(cluster_summaries, ensure_ascii=False, indent=2)}

请你从**商业变现和产品创新**的角度，深入分析每个语义簇并输出：

## 📊 商业热点雷达

对每个语义簇：
1. **热点命名**：用一个简洁有力的标题概括该领域
2. **商业机会分析**：该领域存在哪些可商业化的机会（产品、服务、解决方案）
3. **用户痛点提炼**：核心用户在该领域的主要诉求和未满足需求
4. **变现建议**：具体的商业化路径和优先级评估（高/中/低）
5. **竞品对标**：该领域的竞争态势和差异化机会

## 💡 综合战略建议

基于所有聚类的分析，给出：
1. 最值得投入的 Top 3 商业方向（附理由）
2. 短期速赢机会（3个月内可落地）
3. 中长期战略方向（6-12个月规划）

请用专业但易懂的中文输出，使用 Markdown 格式，确保内容对产品经理和商业决策者有直接参考价值。"""

    system_prompt = "你是一位洞察力极强的商业分析师，擅长从技术社区讨论中提炼商业机会和产品创新方向。你的分析以数据为基础，结论具有可操作性。"

    return prompt, system_prompt


def _build_rising_stars_prompt(rising_stars: List[Dict]) -> tuple:
    """构建潜力新星分析的 LLM prompt"""

    stars_data = [
        {
            "用户": s["user"],
            "与精英群体语义相似度": s["similarity_to_elite"],
            "当前影响力": s["current_influence"],
            "成长空间指数": s.get("growth_room", 0.0),
            "潜力评分": s["potential_score"],
        }
        for s in rising_stars[:10]
    ]

    prompt = f"""你是社区运营和用户增长专家。以下是通过语义匹配算法发现的"潜力新星"用户——他们的内容质量和关注领域与社区核心KOL高度相似，但目前影响力尚低：

{json.dumps(stars_data, ensure_ascii=False, indent=2)}

请分析这些潜力新星并给出运营建议：

## 🌟 潜力新星画像分析

1. **群体特征**：这些高潜用户与现有KOL的共性是什么？
2. **成长瓶颈**：他们为什么"影响力低但内容好"？可能的原因
3. **培育策略**：如何帮助他们提升影响力？（内容推荐、专区展示、官方互动等）

## 🎯 运营行动计划

1. **优先关注名单**：应该重点培养的前3位用户及理由
2. **激活方案**：具体的运营动作和预期效果
3. **KPI指标**：如何衡量培育效果

请用简洁易懂的中文输出，使用 Markdown 格式。"""

    system_prompt = "你是社区运营和用户增长领域的专家，擅长识别和培育高潜力用户。"

    return prompt, system_prompt


async def stream_commercial_insights(
    clusters: List[Dict], elite_users: List[str], rising_stars: List[Dict]
) -> AsyncGenerator[str, None]:
    """
    流式输出商业热点分析 + 潜力新星分析（SSE 格式）
    """
    from services.llm_service import call_llm_stream

    # 1. 商业热点分析
    yield f"event: commercial_start\ndata: {json.dumps({'type': 'commercial'})} \n\n"

    prompt, sys_prompt = _build_commercial_prompt(clusters, elite_users)
    full_text = ""
    async for token in call_llm_stream(prompt, sys_prompt):
        full_text += token
        yield f"event: commercial_chunk\ndata: {json.dumps({'content': token})}\n\n"

    yield f"event: commercial_done\ndata: {json.dumps({'type': 'commercial', 'content': full_text or '分析暂不可用'})}\n\n"

    # 2. 潜力新星分析
    if rising_stars:
        yield f"event: rising_stars_start\ndata: {json.dumps({'type': 'rising_stars'})}\n\n"

        prompt2, sys_prompt2 = _build_rising_stars_prompt(rising_stars)
        full_text2 = ""
        async for token in call_llm_stream(prompt2, sys_prompt2):
            full_text2 += token
            yield f"event: rising_stars_chunk\ndata: {json.dumps({'content': token})}\n\n"

        yield f"event: rising_stars_done\ndata: {json.dumps({'type': 'rising_stars', 'content': full_text2 or '分析暂不可用'})}\n\n"

    yield f"event: hotspot_all_done\ndata: {json.dumps({'status': 'completed'})}\n\n"
    logger.info("✅ 商业热点流式分析全部完成")
