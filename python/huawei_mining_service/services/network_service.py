import pandas as pd
import networkx as nx
import numpy as np
from typing import Optional, List, Dict, Any
from config import logger
from schemas import NetworkAnalysisResult
from utils import calculate_entropy_weights
from scoring import (
    calculate_content_quality_score, calculate_innovation_score,
    calculate_sentiment_score,
    calculate_topic_diversity_score, calculate_activity_consistency_score,
)

def perform_network_analysis(
    edges_df: pd.DataFrame, 
    comments_df: Optional[pd.DataFrame] = None,
    top_n: int = 20,
    custom_weights: Optional[Dict[str, float]] = None,
) -> NetworkAnalysisResult:
    """
    执行社会网络分析（改进版，集成内容质量和创新度）
    """
    logger.info(f"开始网络分析，边数量: {len(edges_df)}")
    
    if edges_df.empty:
        return NetworkAnalysisResult(stats={}, top_users=[], communities=[], weights={})
    
    # 构建有向图
    G = nx.DiGraph()
    for _, row in edges_df.iterrows():
        G.add_edge(row['src'], row['dst'], weight=row['weight'], type=row.get('type', 'unknown'))
    
    # 基本统计
    stats = {
        "nodes": G.number_of_nodes(),
        "edges": G.number_of_edges(),
        "density": nx.density(G),
        "avg_clustering": nx.average_clustering(G.to_undirected()) if G.number_of_nodes() > 0 else 0
    }
    
    # 计算中心性指标
    pagerank = nx.pagerank(G, weight='weight') if G.number_of_nodes() > 0 else {}
    # 入度
    in_degree = dict(G.in_degree(weight='weight'))
    # 出度
    out_degree = dict(G.out_degree(weight='weight'))
    
    # 计算介数中心性（可能比较慢，只在小图上计算）
    betweenness = {}
    if G.number_of_nodes() <= 1500:
        betweenness = nx.betweenness_centrality(G, weight='weight')

    # 计算内容质量、创新度及新增3个维度（如果提供了评论数据）
    quality_scores = {}
    innovation_scores = {}
    sentiment_scores = {}
    diversity_scores = {}
    consistency_scores = {}

    if comments_df is not None and not comments_df.empty:
        try:
            quality_df = calculate_content_quality_score(comments_df)
            quality_scores = dict(zip(quality_df['user_name'], quality_df['quality_score']))

            innovation_df = calculate_innovation_score(comments_df)
            innovation_scores = dict(zip(innovation_df['user_name'], innovation_df['innovation_score']))

            sentiment_df = calculate_sentiment_score(comments_df)
            sentiment_scores = dict(zip(sentiment_df['user_name'], sentiment_df['sentiment_score']))

            diversity_df = calculate_topic_diversity_score(comments_df)
            diversity_scores = dict(zip(diversity_df['user_name'], diversity_df['diversity_score']))

            consistency_df = calculate_activity_consistency_score(comments_df)
            consistency_scores = dict(zip(consistency_df['user_name'], consistency_df['consistency_score']))

            # 提取用户头像
            if 'avatar' in comments_df.columns:
                temp_df = comments_df[['user_name', 'avatar']].dropna().drop_duplicates(subset=['user_name'], keep='last')
                avatar_map = dict(zip(temp_df['user_name'], temp_df['avatar']))
            else:
                avatar_map = {}
        except Exception as e:
            logger.warning(f"评分维度计算失败: {e}")
            avatar_map = {}
    
    # 构建用户指标矩阵
    user_scores = []
    nodes_list = list(G.nodes())
    
    # 归一化 in_degree（用于熵权法计算）
    max_in_degree = max(in_degree.values()) if in_degree else 1
    
    indicators_matrix = []
    
    for node in nodes_list:
        pr = pagerank.get(node, 0) / max(pagerank.values()) if pagerank else 0  # 归一化到0-1
        ind = in_degree.get(node, 0) / max_in_degree
        btw = betweenness.get(node, 0)
        qual = quality_scores.get(node, 0) / 10  # 归一化到0-1
        innov = innovation_scores.get(node, 0) / 10
        sent = sentiment_scores.get(node, 5.0) / 10  # 默认中性5.0
        div = diversity_scores.get(node, 0) / 10
        cons = consistency_scores.get(node, 1.0) / 10

        indicators_matrix.append([pr, ind, btw, qual, innov, sent, div, cons])

        user_scores.append({
            "user": node,
            "avatar": avatar_map.get(node),
            "pagerank": pr,
            "in_degree": in_degree.get(node, 0),
            "out_degree": out_degree.get(node, 0),
            "betweenness": btw,
            "quality_score": quality_scores.get(node, 0),
            "innovation_score": innovation_scores.get(node, 0),
            "sentiment_score": sentiment_scores.get(node, 5.0),
            "diversity_score": diversity_scores.get(node, 0),
            "consistency_score": consistency_scores.get(node, 1.0),
        })
    
    # 使用熵权法计算权重（支持前端自定义权重覆盖）
    dim_names = ["pagerank", "in_degree", "betweenness", "quality",
                 "innovation", "sentiment", "diversity", "consistency"]
    indicators_array = np.array(indicators_matrix)
    weights_array = None

    if custom_weights:
        custom_vector = np.array([
            max(float(custom_weights.get(name, 0.0)), 0.0) for name in dim_names
        ], dtype=float)
        custom_sum = float(custom_vector.sum())
        if custom_sum > 0:
            weights_array = custom_vector / custom_sum
            weights_dict = {name: float(weights_array[idx]) for idx, name in enumerate(dim_names)}
        else:
            logger.warning("收到自定义权重但总和为0，回退为熵权法")

    if indicators_array.shape[0] > 0:
        if weights_array is None:
            weights_array = calculate_entropy_weights(indicators_array)

            if len(weights_array) == 8:
                weights_dict = {
                    "pagerank": float(weights_array[0]),
                    "in_degree": float(weights_array[1]),
                    "betweenness": float(weights_array[2]),
                    "quality": float(weights_array[3]),
                    "innovation": float(weights_array[4]),
                    "sentiment": float(weights_array[5]),
                    "diversity": float(weights_array[6]),
                    "consistency": float(weights_array[7]),
                }
            else:
                # 降级到均等权重
                n_dims = len(weights_array) if len(weights_array) > 0 else 8
                equal_w = 1.0 / n_dims
                weights_dict = {name: equal_w for name in dim_names[:n_dims]}
    else:
        if weights_array is None:
            weights_array = np.array([1 / 8] * 8, dtype=float)
            weights_dict = {
                "pagerank": 1/8, "in_degree": 1/8, "betweenness": 1/8,
                "quality": 1/8, "innovation": 1/8, "sentiment": 1/8,
                "diversity": 1/8, "consistency": 1/8,
            }
    
    # 计算综合影响力分数
    for i, user_data in enumerate(user_scores):
        if i < len(indicators_matrix):
            ind_values = indicators_matrix[i]
            influence = sum(ind_values[j] * weights_array[j] for j in range(len(weights_array)))
            user_data["influence_score"] = float(influence)
        else:
            user_data["influence_score"] = 0
    
    # 按影响力排序（同分时按用户名稳定排序，避免边界抖动）
    def _ranking_key(user_data: Dict[str, Any]):
        score = float(user_data.get("influence_score", 0.0) or 0.0)
        name = str(user_data.get("user") or "")
        return (-score, name)

    top_users = sorted(user_scores, key=_ranking_key)[:top_n]
    
    # 社区检测（使用无向图）
    communities = []
    try:
        G_undirected = G.to_undirected()
        if G_undirected.number_of_nodes() > 2:
            from networkx.algorithms.community import louvain_communities
            community_list = louvain_communities(G_undirected, weight='weight', seed=42)
            logger.info(f"使用 Louvain 方法，找到最佳社区数量: {len(community_list)}")
            for i, comm in enumerate(community_list):
                communities.append({
                    "id": i,
                    "size": len(comm),
                    # "members": list(comm)[:20]  # 每个社区最多显示20个成员
                    "members": list(comm)
                })
    except Exception as e:
        logger.warning(f"社区检测失败: {e}")
    
    logger.info(f"网络分析完成，节点数: {stats['nodes']}, 检测到{len(communities)}个社区")
    logger.info(f"本次分析使用的权重: {weights_dict}")
    
    return NetworkAnalysisResult(
        stats=stats,
        top_users=top_users,
        communities=communities,
        weights=weights_dict,
        all_users=user_scores
    )
