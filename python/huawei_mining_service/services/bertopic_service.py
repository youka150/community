from typing import List
from collections import Counter
from config import logger
from schemas import TopicModelResult
from utils import preprocess_text

def perform_bertopic_analysis(texts: List[str], n_topics: int = 8) -> TopicModelResult:
    """执行BERTopic主题建模"""
    logger.info(f"开始BERTopic分析，文本数量: {len(texts)}, 期望主题数(近似): {n_topics}")
    
    # 过滤无效文本
    valid_texts = [t for t in texts if t and len(t.strip()) >= 5]
    
    if len(valid_texts) < n_topics * 2:
        logger.warning(f"有效文本数量不足: {len(valid_texts)}，无法进行良好的BERTopic聚类")
        return TopicModelResult(topics=[], topic_distribution=[], doc_topics=[])
    
    try:
        from bertopic import BERTopic
        from sentence_transformers import SentenceTransformer
        # 为了与 hotspot_service.py 中的向量化模型保持一致和复用，我们加载相同的模型
        # 或者直接让 BERTopic 下载它的默认模型
        # 使用多语言模型以支持中文
        embedding_model = SentenceTransformer('sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2')
        
        # 预处理文本（分词并用空格连接，BERTopic内部会通过CountVectorizer提取词频）
        # 这里可以选择是否真的使用 jieba 分词后的结果，或者直接将原文本喂给 BERTopic。
        # 考虑到中文的特性，直接喂切分好的文本有好处，但 BERTopic 也可以通过配置中文的 CountVectorizer 来跑原文本。
        # 为了简单和一致，使用 preprocess_text 预处理后的列表连接成字符串
        processed_docs = [' '.join(preprocess_text(t)) for t in valid_texts]
        
        # 构建 BERTopic
        # nr_topics='auto' 可以让 HDBSCAN 自动聚类，或者传入具体的 n_topics 强行合并到该数量
        topic_model = BERTopic(
            embedding_model=embedding_model,
            nr_topics=n_topics + 1,  # 包含-1异常主题
            calculate_probabilities=True,
            verbose=False
        )
        
        topics_labels, probabilities = topic_model.fit_transform(processed_docs)
        
        # 提取主题
        freq = topic_model.get_topic_info()
        topics = []
        topic_counts = Counter()
        doc_topics = []
        
        # 组装返回数据结构以向后兼容现有的 TopicModelResult
        # BERTopic 的 -1 是异常（未分类）类，将其作为单独的主题或其他处理
        for _, row in freq.iterrows():
            topic_id = row['Topic']
            if topic_id == -1:
                continue # 可选择跳过异常类
            
            topic_words = topic_model.get_topic(topic_id)
            if not topic_words:
                continue
                
            keywords = [{"word": w, "weight": float(s)} for w, s in topic_words]
            label = f"主题{topic_id + 1}: " + "/".join([w for w, _ in topic_words[:3]])
            
            topics.append({
                "id": int(topic_id),
                "keywords": keywords,
                "label": label
            })
            
        # 计算主题分布及文档主题映射
        for i, (topic_id, prob_array) in enumerate(zip(topics_labels, probabilities)):
            if topic_id == -1:
                continue # 这里忽略 -1
            
            topic_counts[topic_id] += 1
            max_prob = float(max(prob_array)) if prob_array is not None and len(prob_array) > 0 else 1.0
            
            doc_topics.append({
                "doc_id": i,
                "topic_id": int(topic_id),
                "probability": max_prob
            })
            
        total_assigned = sum(topic_counts.values())
        topic_distribution = [
            {"topic_id": int(tid), "count": int(count), "percentage": float(count) / total_assigned * 100 if total_assigned > 0 else 0.0}
            for tid, count in topic_counts.most_common()
        ]
        
        logger.info(f"BERTopic分析完成，提取了{len(topics)}个主题(不含异常簇)")
        return TopicModelResult(
            topics=topics,
            topic_distribution=topic_distribution,
            doc_topics=doc_topics[:100]  # 向后兼容，只返回前100个文档给前端
        )
        
    except Exception as e:
        logger.error(f"BERTopic 初始化或执行失败: {e}")
        # 出错时返回空结果
        return TopicModelResult(topics=[], topic_distribution=[], doc_topics=[])
