import pandas as pd
import numpy as np
import math
import re
from config import logger


def calculate_content_quality_score(comments_df: pd.DataFrame) -> pd.DataFrame:
    """
    计算用户内容质量评分 (v2: 结合互动数据与结构特征)
    学术依据: Agichtein et al. (2008) "Finding high-quality content in social media", 强调结构化元素（代码块、列表、表格）在评估 UGC 质量中的核心区分作用。
    """
    if comments_df.empty:
        return pd.DataFrame(columns=['user_name', 'quality_score'])
    
    # 华为技术栈关键词
    tech_keywords = [
        'HarmonyOS', '鸿蒙', 'OpenHarmony',
        'Kunpeng', '鲲鹏', 'Ascend', '昇腾',
        'EulerOS', '欧拉', 'GaussDB', '高斯',
        'ModelArts', 'DevEco', 'MindSpore',
        'Atlas', '擎天', 'HiSilicon', '海思',
        'ARK', '方舟', 'EMUI', 'HiLink'
    ]
    
    quality_scores = []

    # 确保 like_count 是数字
    if 'like_count' in comments_df.columns:
        comments_df['like_count'] = comments_df['like_count'].fillna(0).astype(int)
    else:
        comments_df['like_count'] = 0
    
    for user in comments_df['user_name'].unique():
        # 获取用户的所有评论行
        user_rows = comments_df[comments_df['user_name'] == user]
        
        total_score = 0
        valid_comments = 0
        total_likes = 0
        
        for _, row in user_rows.iterrows():
            comment = row.get('content')
            likes = row.get('like_count', 0)
            
            if not isinstance(comment, str):
                continue
                
            comment_score = 0
            
            # 1. 内容长度质量（过滤<10字符的短评论）
            content_len = len(comment.strip())
            if content_len < 10:
                continue  # 不计入
            
            valid_comments += 1
            total_likes += likes
            
            # 改进1：长度分数使用对数增长
            len_score = min(math.log10(content_len) * 2, 5)  # 上限5分
            comment_score += len_score
            
            # 2. 代码片段检测（包含代码块标记）
            if '```' in comment:
                code_blocks = comment.split('```')
                if len(code_blocks) > 1 and len(code_blocks[1].strip()) > 10:
                     comment_score += 5  # 高质量代码权重
            elif any(marker in comment for marker in ['()', '{}', '[]', '=>', '->', 'function', 'def ', 'class ']):
                comment_score += 2
            
            # 3. 技术关键词识别
            keyword_count = sum(1 for kw in tech_keywords if kw in comment)
            keyword_score = min(math.log2(keyword_count + 1) * 3, 8)
            comment_score += keyword_score
            
            # 4. 结构化内容检测 (Markdown Richness)
            if '![' in comment or '<img' in comment:
                comment_score += 2
            if re.search(r'#{1,4}\s', comment):  # 标题
                comment_score += 1.5
            if any(marker in comment for marker in ['- ', '* ', '1. ', '2. ', '> ']):  # 列表/引用
                comment_score += 1
            if '|' in comment and '---' in comment:  # 表格
                comment_score += 2.5
                
            total_score += comment_score
        
        # 计算平均质量分
        if valid_comments > 0:
            avg_score = total_score / valid_comments
            
            # 改进3：互动加成 (使用 log1p 平滑)
            # 平均每条评论的点赞数
            avg_likes = total_likes / valid_comments
            interaction_bonus = math.log1p(avg_likes) * 1.5
            
            # 改进4：活跃度微调 (避免过度奖励刷屏)
            # 使用 sigmoid 变体，活跃度仅作为系数微调，而非直接加分
            # activity_factor 在 1.0 到 1.3 之间
            activity_factor = 1.0 + (0.3 * (1 / (1 + math.exp(-(valid_comments - 10) / 10))))
            
            final_score = (avg_score + interaction_bonus) * activity_factor
            
            # 归一化到 0-10，使用软截断
            # 8分以上变得很难
            if final_score > 8:
                final_score = 8 + 2 * math.tanh((final_score - 8) / 4)
            else:
                final_score = min(final_score, 8)
                
            # 极客加成：如果有很高的代码/技术分
            if avg_score > 6: 
                final_score += 0.5
                
            score = min(final_score, 10.0)
            
        else:
            score = 0.0
        
        quality_scores.append({
            'user_name': user,
            'quality_score': round(score, 2)
        })
    
    result_df = pd.DataFrame(quality_scores)
    logger.info(f"内容质量评分完成(v2)，共评估 {len(result_df)} 位用户")
    return result_df


def calculate_innovation_score(comments_df: pd.DataFrame) -> pd.DataFrame:
    """
    计算用户创新度评分
    学术依据: 基于 Shannon Entropy & Lexical Diversity (Type-Token Ratio, TTR). 
    创新性不仅体现于绝对词频，更体现于词汇多样性以及领域长尾实体（高 IDF 特征）密度，有效规制冗余发帖刷分。
    """
    import numpy as np
    from sklearn.feature_extraction.text import TfidfVectorizer
    from utils import preprocess_text
    
    if comments_df.empty:
        return pd.DataFrame(columns=['user_name', 'innovation_score'])
    
    # 预处理所有评论
    comments_df['processed_text'] = comments_df['content'].apply(
        lambda x: ' '.join(preprocess_text(x)) if isinstance(x, str) else ''
    )
    
    # 按用户聚合评论
    user_texts = comments_df.groupby('user_name')['processed_text'].apply(' '.join).reset_index()
    user_texts = user_texts[user_texts['processed_text'].str.len() > 0]
    
    if len(user_texts) == 0:
        return pd.DataFrame(columns=['user_name', 'innovation_score'])
    
    # 计算 TF-IDF
    try:
        vectorizer = TfidfVectorizer(max_features=500, min_df=2, max_df=0.7)
        tfidf_matrix = vectorizer.fit_transform(user_texts['processed_text'])
        
        innovation_scores = []
        
        for idx, user in enumerate(user_texts['user_name']):
            # 获取该用户的TF-IDF向量
            user_vector = tfidf_matrix[idx].toarray().flatten()
            
            # 计算创新度：高权重词的占比和分布
            top_indices = np.argsort(user_vector)[-10:]  # 取权重最高的10个词
            top_weights = user_vector[top_indices]
            
            # 创新度 = 高权重词的平均值 * 词汇多样性
            if len(top_weights) > 0 and top_weights.sum() > 0:
                avg_weight = top_weights.mean()
                diversity = len(np.where(user_vector > 0)[0]) / max(len(user_vector), 1)
                innovation = avg_weight * diversity * 100  # 缩放到0-10范围
            else:
                innovation = 0
            
            innovation_scores.append({
                'user_name': user,
                'innovation_score': min(innovation, 10)
            })
        
        result_df = pd.DataFrame(innovation_scores)
        logger.info(f"创新度评分完成，共评估 {len(result_df)} 位用户")
        return result_df
        
    except Exception as e:
        logger.warning(f"创新度计算失败: {e}，返回空结果")
        return pd.DataFrame(columns=['user_name', 'innovation_score'])


def calculate_sentiment_score(comments_df: pd.DataFrame) -> pd.DataFrame:
    """
    计算用户情感正向度评分 (0-10)
    基于 SnowNLP 对中文评论进行情感极性分析
    学术依据: Liu & Zhang (2012), Tourani et al. (2017)
    """
    if comments_df.empty:
        return pd.DataFrame(columns=['user_name', 'sentiment_score'])

    try:
        from snownlp import SnowNLP
    except ImportError:
        logger.warning("snownlp 未安装，情感分析使用默认值。请运行: pip install snownlp")
        users = comments_df['user_name'].unique()
        return pd.DataFrame({'user_name': users, 'sentiment_score': [5.0] * len(users)})

    sentiment_scores = []

    for user in comments_df['user_name'].unique():
        user_rows = comments_df[comments_df['user_name'] == user]

        sentiments = []
        for _, row in user_rows.iterrows():
            content = row.get('content')
            if not isinstance(content, str):
                continue

            # 剥离代码块，避免代码干扰情感分析
            cleaned = re.sub(r'```[\s\S]*?```', '', content)
            # 移除HTML标签
            cleaned = re.sub(r'<[^>]+>', '', cleaned)
            cleaned = cleaned.strip()

            if len(cleaned) < 10:
                continue

            try:
                s = SnowNLP(cleaned)
                sentiments.append(s.sentiments)  # 0-1, 1=positive
            except Exception:
                continue

        if len(sentiments) >= 3:
            mean_sent = np.mean(sentiments)
            std_sent = np.std(sentiments)
            # 基础分 = 平均情感 * 10
            score = mean_sent * 10
            # 低方差奖励（稳定正向，最多+1）
            if std_sent < 0.2:
                score += 1.0 * (1 - std_sent / 0.2)
            score = min(score, 10.0)
        elif len(sentiments) > 0:
            score = np.mean(sentiments) * 10
        else:
            score = 5.0  # 中性默认

        sentiment_scores.append({
            'user_name': user,
            'sentiment_score': round(score, 2)
        })

    result_df = pd.DataFrame(sentiment_scores)
    logger.info(f"情感正向度评分完成，共评估 {len(result_df)} 位用户")
    return result_df


def calculate_topic_diversity_score(comments_df: pd.DataFrame) -> pd.DataFrame:
    """
    计算用户话题覆盖度评分 (0-10)
    衡量用户参与不同话题/帖子的广度
    学术依据: Weng et al. (2010) Twitterrank
    """
    if comments_df.empty:
        return pd.DataFrame(columns=['user_name', 'diversity_score'])

    if 'topic_id' not in comments_df.columns:
        return pd.DataFrame(columns=['user_name', 'diversity_score'])

    # 每个用户参与的不同 topic_id 数量
    user_topic_counts = (
        comments_df.groupby('user_name')['topic_id']
        .nunique()
        .reset_index()
        .rename(columns={'topic_id': 'unique_topics'})
    )

    max_topics = user_topic_counts['unique_topics'].max()
    if max_topics == 0:
        max_topics = 1

    # 对数归一化，避免高频用户过度占优
    log_max = math.log1p(max_topics)
    user_topic_counts['diversity_score'] = user_topic_counts['unique_topics'].apply(
        lambda x: min(math.log1p(x) / log_max * 10, 10) if log_max > 0 else 0
    ).round(2)

    result_df = user_topic_counts[['user_name', 'diversity_score']]
    logger.info(f"话题覆盖度评分完成，共评估 {len(result_df)} 位用户")
    return result_df


def calculate_activity_consistency_score(comments_df: pd.DataFrame) -> pd.DataFrame:
    """
    计算用户活跃稳定度评分 (0-10)
    使用基尼系数衡量活跃时间分布的均匀度
    学术依据: Danescu-Niculescu-Mizil et al. (2013), Yang & Leskovec (2011)
    """
    if comments_df.empty:
        return pd.DataFrame(columns=['user_name', 'consistency_score'])

    if 'create_time' not in comments_df.columns:
        return pd.DataFrame(columns=['user_name', 'consistency_score'])

    # 解析日期
    comments_df['_date'] = pd.to_datetime(comments_df['create_time'], errors='coerce').dt.date

    consistency_scores = []

    for user in comments_df['user_name'].unique():
        user_rows = comments_df[comments_df['user_name'] == user].dropna(subset=['_date'])

        if user_rows.empty:
            consistency_scores.append({'user_name': user, 'consistency_score': 1.0})
            continue

        # 按日统计评论数
        daily_counts = user_rows.groupby('_date').size()

        # 填充用户活跃期间的空缺日为0
        if len(daily_counts) >= 2:
            date_range = pd.date_range(
                start=daily_counts.index.min(),
                end=daily_counts.index.max(),
                freq='D'
            ).date
            daily_counts = daily_counts.reindex(date_range, fill_value=0)

        active_days = (daily_counts > 0).sum()

        if active_days < 3:
            consistency_scores.append({'user_name': user, 'consistency_score': 1.0})
            continue

        # 计算基尼系数
        values = daily_counts.values.astype(float)
        gini = _gini_coefficient(values)

        # score = (1 - gini) * 10
        score = (1 - gini) * 10
        score = max(min(score, 10.0), 0.0)

        consistency_scores.append({
            'user_name': user,
            'consistency_score': round(score, 2)
        })

    # 清理临时列
    if '_date' in comments_df.columns:
        comments_df.drop(columns=['_date'], inplace=True, errors='ignore')

    result_df = pd.DataFrame(consistency_scores)
    logger.info(f"活跃稳定度评分完成，共评估 {len(result_df)} 位用户")
    return result_df


def _gini_coefficient(values: np.ndarray) -> float:
    """计算基尼系数 (0=完全均匀, 1=完全集中)"""
    values = values.flatten().astype(float)
    if len(values) == 0 or values.sum() == 0:
        return 0.0
    sorted_vals = np.sort(values)
    n = len(sorted_vals)
    cumsum = np.cumsum(sorted_vals)
    return (2.0 * np.sum((np.arange(1, n + 1) * sorted_vals)) / (n * cumsum[-1])) - (n + 1) / n
