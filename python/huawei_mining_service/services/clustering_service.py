import pandas as pd
import numpy as np
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from sklearn.feature_extraction.text import TfidfVectorizer
from typing import List, Dict, Any, Optional
from config import logger
from schemas import UserProfileResult
import jieba
import re

# ---------------------------------------------------------------------------
# 语义编码器（懒加载，支持 sentence-transformers 不存在时优雅降级）
# ---------------------------------------------------------------------------
_semantic_model = None
_SEMANTIC_MODEL_NAME = 'paraphrase-multilingual-MiniLM-L12-v2'  # 支持中文，384 维
_SEMANTIC_DIM = 20   # PCA 降维后保留维度
_SEMANTIC_WEIGHT = 0.4  # 语义特征权重（行为特征权重 = 1 - 语义权重）

def _get_semantic_model():
    """懒加载语义模型，失败时返回 None"""
    global _semantic_model
    if _semantic_model is not None:
        return _semantic_model
    try:
        from sentence_transformers import SentenceTransformer
        logger.info(f"加载语义模型: {_SEMANTIC_MODEL_NAME}")
        _semantic_model = SentenceTransformer(_SEMANTIC_MODEL_NAME)
        logger.info("语义模型加载成功")
    except Exception as e:
        logger.warning(f"sentence-transformers 不可用，将退回纯行为特征聚类: {e}")
        _semantic_model = None
    return _semantic_model


def _build_user_texts(comments_df: pd.DataFrame) -> Dict[str, str]:
    """为每位用户拼接其所有评论文本（用于语义编码）"""
    user_texts = (
        comments_df[comments_df['content'].notna()]
        .groupby('user_name')['content']
        .apply(lambda x: ' '.join(x.astype(str).tolist()))
        .to_dict()
    )
    return user_texts


def _extract_cluster_keywords(texts: List[str], top_n: int = 5) -> List[str]:
    """用 TF-IDF + jieba 从文本列表中提取代表性关键词"""
    if not texts:
        return []

    def _tokenize(text: str) -> str:
        tokens = jieba.lcut(re.sub(r'[^\u4e00-\u9fa5a-zA-Z0-9]', ' ', text))
        return ' '.join(t for t in tokens if len(t) > 1)

    tokenized = [_tokenize(t) for t in texts if t.strip()]
    if not tokenized or all(not t for t in tokenized):
        return []

    try:
        tfidf = TfidfVectorizer(max_features=200, max_df=0.95, min_df=1)
        tfidf.fit(tokenized)
        # 计算整体 TF-IDF 均值，取最高分词
        matrix = tfidf.transform(tokenized).toarray()
        mean_scores = matrix.mean(axis=0)
        vocab = tfidf.get_feature_names_out()
        top_indices = mean_scores.argsort()[::-1][:top_n]
        return [vocab[i] for i in top_indices]
    except Exception:
        return []


def perform_user_clustering(comments_df: pd.DataFrame, n_clusters: int = 5) -> UserProfileResult:
    """执行用户画像聚类（行为特征 + 语义向量融合）"""
    logger.info(f"开始用户聚类分析，评论数: {len(comments_df)}")

    if comments_df.empty:
        return UserProfileResult(clusters=[], user_assignments=[])

    # ---- 1. 聚合用户行为特征 ------------------------------------------------
    user_features = comments_df.groupby('user_name').agg({
        'comment_id': 'count',  # 评论数
        'like_count': 'sum',    # 总获赞
        'topic_id': 'nunique',  # 参与话题数
        'content': lambda x: x.str.len().mean() if x.notna().any() else 0  # 平均评论长度
    }).reset_index()
    user_features.columns = ['user_name', 'comment_count', 'total_likes', 'topic_count', 'avg_content_length']

    # 确保聚类数合理
    if len(user_features) < n_clusters * 2:
        n_clusters = max(2, len(user_features) // 2)

    feature_cols = ['comment_count', 'total_likes', 'topic_count', 'avg_content_length']
    beh_scaler = StandardScaler()
    beh_scaled = beh_scaler.fit_transform(user_features[feature_cols].fillna(0))  # (N, 4)

    # ---- 2. 语义特征编码（可选）--------------------------------------------
    semantic_enabled = False
    sem_model = _get_semantic_model()
    sem_keywords_by_cluster: Dict[int, List[str]] = {}

    if sem_model is not None:
        try:
            user_texts_map = _build_user_texts(comments_df)
            # 按 user_features 的顺序构建文本列表，缺失用空字符替代
            texts_ordered = [
                user_texts_map.get(u, '') for u in user_features['user_name']
            ]

            logger.info(f"开始语义编码 {len(texts_ordered)} 位用户文本...")
            embeddings = sem_model.encode(
                texts_ordered,
                batch_size=64,
                show_progress_bar=False,
                normalize_embeddings=True,  # 余弦空间对齐
            )  # (N, 384)

            # PCA 降维（若用户数 < _SEMANTIC_DIM 则取 min）
            actual_dim = min(_SEMANTIC_DIM, len(user_features) - 1, embeddings.shape[1])
            if actual_dim >= 2:
                pca = PCA(n_components=actual_dim, random_state=42)
                sem_reduced = pca.fit_transform(embeddings)  # (N, actual_dim)
                sem_scaler = StandardScaler()
                sem_scaled = sem_scaler.fit_transform(sem_reduced)  # 标准化

                # 按权重拼接：行为(1-w) : 语义(w)
                beh_w = (1.0 - _SEMANTIC_WEIGHT) * beh_scaled
                sem_w = _SEMANTIC_WEIGHT * sem_scaled
                features_scaled = np.hstack([beh_w, sem_w])  # (N, 4+actual_dim)
                semantic_enabled = True
                logger.info(f"语义特征融合完成，维度: {features_scaled.shape}，PCA保留方差: {pca.explained_variance_ratio_.sum():.2%}")
            else:
                features_scaled = beh_scaled
        except Exception as e:
            logger.warning(f"语义特征提取失败，回退行为特征: {e}")
            features_scaled = beh_scaled
    else:
        features_scaled = beh_scaled

    # ---- 3. K-Means 聚类 ---------------------------------------------------
    kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
    user_features['cluster'] = kmeans.fit_predict(features_scaled)

    # ---- 4. 为每个聚类提取语义关键词 ----------------------------------------
    if semantic_enabled:
        user_texts_map = _build_user_texts(comments_df)  # 复用或重新取
        for cid in range(n_clusters):
            cluster_users = user_features[user_features['cluster'] == cid]['user_name'].tolist()
            cluster_texts = [user_texts_map.get(u, '') for u in cluster_users]
            sem_keywords_by_cluster[cid] = _extract_cluster_keywords(cluster_texts, top_n=6)
    
    # 计算全局统计量用于对比
    global_means = user_features[feature_cols].mean()
    
    clusters = []
    used_labels = set()
    
    # 定义特征描述映射
    feature_descriptors = {
        'comment_count': ('高频互动', '低频潜水'),
        'total_likes': ('高认可度', '普通'),
        'topic_count': ('广泛涉猎', '专注单一'),
        'avg_content_length': ('深度长文', '简短发言')
    }
    
    # 获取聚类中心并排序（按规模倒序，优先给大群组命名）
    cluster_stats = []
    for cid in range(n_clusters):
        cluster_data = user_features[user_features['cluster'] == cid]
        size = len(cluster_data)
        if size == 0: 
            continue
        center = cluster_data[feature_cols].mean()
        cluster_stats.append({'id': cid, 'size': size, 'center': center, 'data': cluster_data})
        
    cluster_stats.sort(key=lambda x: x['size'], reverse=True)
    
    for stat in cluster_stats:
        cid = stat['id']
        center = stat['center']
        cluster_data = stat['data']
        
        # 计算特征相对于全局均值的倍数
        ratios = center / global_means
        
        # 找出最显著的特征（倍数最大的）
        sorted_features = ratios.sort_values(ascending=False)
        primary_feature = sorted_features.index[0]
        primary_score = sorted_features.iloc[0]
        
        label = "普通用户"
        
        # 规则生成与去重逻辑
        if primary_score > 3.0: # 显著高于平均
            if primary_feature == 'total_likes':
                label = "高质量内容创作者"
            elif primary_feature == 'comment_count':
                label = "社区活跃领袖"
            elif primary_feature == 'topic_count':
                label = "话题百晓生"
            elif primary_feature == 'avg_content_length':
                label = "深度思考者"
        elif primary_score > 1.5: # 略高于平均
            if primary_feature == 'total_likes':
                label = "受认可用户"
            elif primary_feature == 'comment_count':
                label = "活跃参与者"
            elif primary_feature == 'topic_count':
                label = "兴趣广泛用户"
            elif primary_feature == 'avg_content_length':
                label = "认真评论用户"
        elif primary_score < 0.5:  # 显著低于平均
            label = "潜水围观用户"
             
        # 如果标签已存在，尝试组合第二特征
        if label in used_labels:
            secondary_feature = sorted_features.index[1]
            desc = feature_descriptors.get(secondary_feature, ('其他', '其他'))[0]
            label = f"{desc}的{label}"
            # 再次重复则加群体编号兜底
            if label in used_labels:
                label = f"{label}(群体{cid + 1})"

        used_labels.add(label)

        # 语义关键词（仅在语义模式下有值）
        sem_kws = sem_keywords_by_cluster.get(cid, [])

        clusters.append({
            "id": int(cid),
            "label": label,
            "size": int(stat['size']),
            "avg_comment_count": float(center['comment_count']),
            "avg_likes": float(center['total_likes']),
            "avg_topic_count": float(center['topic_count']),
            "avg_content_length": float(center['avg_content_length']),
            "semantic_keywords": sem_kws,          # 语义关键词（空列表表示未启用）
            "sample_users": cluster_data['user_name'].head(5).tolist(),
        })
    
    # 恢复按ID排序以便前端展示稳定
    clusters.sort(key=lambda x: x['id'])
    
    # 用户分配结果
    user_assignments = user_features[['user_name', 'cluster', 'comment_count', 'total_likes']].to_dict('records')
    
    mode_tag = "行为+语义" if semantic_enabled else "纯行为"
    logger.info(f"用户聚类完成 [{mode_tag}]，{n_clusters} 个群体")
    return UserProfileResult(
        clusters=clusters,
        user_assignments=user_assignments
    )
