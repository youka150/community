"""
昇腾社区 — 用户评分算法
与华为社区对齐，统一采用 8 维评分。
"""

import pandas as pd
import numpy as np
import re
from config import logger

try:
    from snownlp import SnowNLP
    HAS_SNOWNLP = True
except ImportError:
    HAS_SNOWNLP = False
    logger.warning("snownlp 未安装，情感评分将使用默认值")

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    HAS_SKLEARN = True
except ImportError:
    HAS_SKLEARN = False
    logger.warning("sklearn 未安装，创新度评分将使用默认值")


# ========================= 昇腾技术关键词 =========================

ASCEND_TECH_KEYWORDS = [
    # 昇腾核心
    'Ascend', '昇腾', 'NPU', 'Davinci', '达芬奇',
    # 开发框架
    'CANN', 'AscendCL', 'ACL', 'MindSpore', 'MindStudio', 'MindIE',
    'MindX', 'DVPP', 'AIPP', 'ModelZoo', 'ATC',
    # 硬件产品
    'Atlas', 'Atlas 200', 'Atlas 300', 'Atlas 500', 'Atlas 800',
    'Atlas 900', '香橙派', 'Orange Pi',
    # AI 生态
    'PyTorch', 'TensorFlow', 'ONNX', 'Ascend C',
    'DeepSeek', 'LLM', '大模型',
    # 技术概念
    '算子', '推理', '训练', '量化', '蒸馏', '微调',
    '迁移学习', '模型转换', '模型部署', '精度对齐',
    'kernel', 'operator', 'inference', 'training',
    # 代码相关
    'API', 'SDK', 'driver', '驱动', 'firmware', '固件',
]

ASCEND_TECH_KEYWORDS_LOWER = [kw.lower() for kw in ASCEND_TECH_KEYWORDS]

# 代码模式检测
CODE_PATTERNS = [
    r'```[\s\S]*?```',
    r'def\s+\w+\s*\(',
    r'class\s+\w+[:\(]',
    r'import\s+\w+',
    r'from\s+\w+\s+import',
    r'#include',
    r'\.py\b',
    r'\.cpp\b',
    r'print\s*\(',
    r'return\s+',
    r'if\s+.*:',
    r'for\s+.*:',
    r'\w+\.\w+\(',
]


# ========================= 维度 1: 内容质量分 =========================

def calculate_content_quality_score(comments_df: pd.DataFrame) -> pd.DataFrame:
    """
    内容质量评分（0-10）
    综合考虑：评论长度、技术关键词匹配、代码检测、结构化标记、获赞数
    学术依据: Agichtein et al. (2008) "Finding high-quality content in social media", 结合长度、富文本信息（代码特征）与点赞带来的群体认同感评估 UGC。
    """
    if comments_df.empty:
        return pd.DataFrame(columns=['user_name', 'quality_score'])

    def score_single(content, like_count):
        if not content or not isinstance(content, str):
            return 0

        content_lower = content.lower()
        length = len(content)

        # 长度分
        if length < 10:
            length_score = 0.5
        elif length < 50:
            length_score = 2
        elif length < 200:
            length_score = 4
        elif length < 500:
            length_score = 6
        else:
            length_score = 8

        # 技术关键词
        tech_count = sum(1 for kw in ASCEND_TECH_KEYWORDS_LOWER if kw in content_lower)
        tech_score = min(tech_count * 0.8, 4)

        # 代码检测与结构化 (Richness)
        code_count = sum(1 for pattern in CODE_PATTERNS if re.search(pattern, content))
        if re.search(r'#{1,4}\s', content) or re.search(r'\- |\* |1\. ', content):
            code_count += 2
        code_score = min(code_count * 0.8, 4)

        # 获赞加成
        like_bonus = min(float(like_count or 0) * 0.3, 3)

        raw = (length_score * 0.3 + tech_score * 0.25 + code_score * 0.25 + like_bonus * 0.2)
        return min(raw, 10)

    df = comments_df.copy()
    df['_quality'] = df.apply(
        lambda r: score_single(r.get('content', ''), r.get('like_count', 0)), axis=1
    )

    result = df.groupby('user_name')['_quality'].mean().reset_index()
    result.columns = ['user_name', 'quality_score']
    result['quality_score'] = result['quality_score'].clip(0, 10).round(2)
    return result


# ========================= 维度 2: 创新度分 =========================

def calculate_innovation_score(comments_df: pd.DataFrame) -> pd.DataFrame:
    """
    创新度评分（0-10）
    使用 TF-IDF 与词汇多样性衡量用户用词独特性
    学术依据: 基于 Shannon Entropy & Lexical Diversity (Type-Token Ratio).
    对于技术社区，结合高 IDF 特征密度能有效凸显具备领域深度但又发言不水的精英用户。
    """
    if comments_df.empty or not HAS_SKLEARN:
        if not HAS_SKLEARN:
            logger.warning("sklearn 不可用，创新度使用默认值 5.0")
        return pd.DataFrame({'user_name': comments_df['user_name'].unique() if not comments_df.empty else [],
                             'innovation_score': 5.0})

    df = comments_df.copy()
    df['content'] = df['content'].fillna('').astype(str)

    # 用户级别文本聚合
    user_texts = df.groupby('user_name')['content'].apply(lambda x: ' '.join(x)).reset_index()

    if len(user_texts) < 2:
        user_texts['innovation_score'] = 5.0
        return user_texts[['user_name', 'innovation_score']]

    try:
        # 使用更大的特征范围与文档频率设定捕捉领域词
        vectorizer = TfidfVectorizer(max_features=2000, max_df=0.7, min_df=1)
        tfidf_matrix = vectorizer.fit_transform(user_texts['content'])
        
        innovation_scores = []
        for idx, row in user_texts.iterrows():
            text = row['content']
            words = text.split()
            # 词汇多样性
            ttr = len(set(words)) / len(words) if len(words) > 0 else 0
            diversity_score = min(ttr * 20, 10)
            
            # 高 IDF 词汇密度计算
            user_vector = tfidf_matrix[idx].toarray().flatten()
            non_zero_indices = np.where(user_vector > 0)[0]
            if len(non_zero_indices) > 0:
                top_k = max(int(len(non_zero_indices) * 0.15), min(10, len(non_zero_indices)))
                top_weights = user_vector[np.argsort(user_vector)[-top_k:]]
                avg_tfidf = top_weights.mean()
            else:
                avg_tfidf = 0
            tfidf_score = min(avg_tfidf * 40, 10)
            
            # 综合
            innovation = 0.4 * diversity_score + 0.6 * tfidf_score
            innovation_scores.append(round(min(max(innovation, 1.0), 10.0), 2))
            
        user_texts['innovation_score'] = innovation_scores

    except Exception as e:
        logger.warning(f"TF-IDF 计算失败: {e}")
        user_texts['innovation_score'] = 5.0

    return user_texts[['user_name', 'innovation_score']]


# ========================= 维度 3: 情感正向度 =========================

def calculate_sentiment_score(comments_df: pd.DataFrame) -> pd.DataFrame:
    """
    情感正向度（0-10）
    使用 SnowNLP 对每条评论进行情感分析
    """
    if comments_df.empty:
        return pd.DataFrame(columns=['user_name', 'sentiment_score'])

    if not HAS_SNOWNLP:
        users = comments_df['user_name'].unique()
        return pd.DataFrame({'user_name': users, 'sentiment_score': 5.0})

    df = comments_df.copy()

    def get_sentiment(content):
        if not content or not isinstance(content, str) or len(content.strip()) < 3:
            return 0.5
        try:
            return SnowNLP(content).sentiments
        except Exception:
            return 0.5

    df['_sentiment'] = df['content'].apply(get_sentiment)
    result = df.groupby('user_name')['_sentiment'].mean().reset_index()
    result.columns = ['user_name', 'sentiment_score']
    result['sentiment_score'] = (result['sentiment_score'] * 10).clip(0, 10).round(2)
    return result


# ========================= 维度 5: 话题覆盖度 =========================

def calculate_topic_diversity_score(comments_df: pd.DataFrame) -> pd.DataFrame:
    """
    话题覆盖度（0-10）
    衡量用户参与不同话题的数量
    """
    if comments_df.empty:
        return pd.DataFrame(columns=['user_name', 'diversity_score'])

    df = comments_df.copy()
    topic_counts = df.groupby('user_name')['topic_id'].nunique().reset_index()
    topic_counts.columns = ['user_name', 'unique_topics']

    max_topics = topic_counts['unique_topics'].max()
    if max_topics > 0:
        topic_counts['diversity_score'] = (
            np.log1p(topic_counts['unique_topics']) / np.log1p(max_topics) * 10
        ).clip(0, 10).round(2)
    else:
        topic_counts['diversity_score'] = 0

    return topic_counts[['user_name', 'diversity_score']]


# ========================= 维度 6: 活跃稳定度 =========================

def calculate_activity_consistency_score(comments_df: pd.DataFrame) -> pd.DataFrame:
    """
    活跃稳定度（0-10）
    使用基尼系数衡量用户活跃天数的分布均匀程度
    """
    if comments_df.empty:
        return pd.DataFrame(columns=['user_name', 'consistency_score'])

    df = comments_df.copy()
    # 提取日期（从 create_time 取日期部分）
    df['_day'] = pd.to_datetime(df['create_time'], errors='coerce').dt.date

    def gini_consistency(group):
        daily_counts = group.groupby('_day').size().values
        if len(daily_counts) <= 1:
            return 5.0  # 只有一天活跃，给中间分

        n = len(daily_counts)
        sorted_counts = np.sort(daily_counts)
        index = np.arange(1, n + 1)
        gini = (2 * (index * sorted_counts).sum() / (n * sorted_counts.sum())) - (n + 1) / n
        # gini 在 0（完全均匀） ~ 1（完全不均匀） 之间
        # 反转：越均匀分越高
        return round((1 - gini) * 10, 2)

    results = df.groupby('user_name').apply(gini_consistency).reset_index()
    results.columns = ['user_name', 'consistency_score']
    results['consistency_score'] = results['consistency_score'].clip(0, 10)
    return results


