from typing import List
from collections import Counter
from gensim import corpora
from gensim.models import LdaModel
from config import logger
from schemas import TopicModelResult
from utils import preprocess_text

def perform_lda_analysis(texts: List[str], n_topics: int = 8) -> TopicModelResult:
    """执行LDA主题建模"""
    logger.info(f"开始LDA分析，文本数量: {len(texts)}, 主题数: {n_topics}")
    
    # 预处理文本
    processed_texts = [preprocess_text(t) for t in texts if t]
    processed_texts = [t for t in processed_texts if len(t) >= 3]
    
    if len(processed_texts) < n_topics * 2:
        logger.warning(f"有效文本数量不足: {len(processed_texts)}")
        return TopicModelResult(topics=[], topic_distribution=[], doc_topics=[])
    
    # 构建词典和语料库
    dictionary = corpora.Dictionary(processed_texts)
    dictionary.filter_extremes(no_below=3, no_above=0.8)
    corpus = [dictionary.doc2bow(text) for text in processed_texts]
    
    # 训练LDA模型
    lda_model = LdaModel(
        corpus=corpus,
        id2word=dictionary,
        num_topics=n_topics,
        passes=15,
        random_state=42,
        alpha='auto',
        eta='auto'
    )
    
    # 提取主题
    topics = []
    for idx in range(n_topics):
        topic_words = lda_model.show_topic(idx, topn=10)
        topics.append({
            "id": idx,
            "keywords": [{"word": w, "weight": float(s)} for w, s in topic_words],
            "label": f"主题{idx + 1}: " + "/".join([w for w, _ in topic_words[:3]])
        })
    
    # 计算主题分布
    topic_counts = Counter()
    doc_topics = []
    for i, doc_bow in enumerate(corpus):
        topic_dist = lda_model.get_document_topics(doc_bow)
        if topic_dist:
            dominant_topic = max(topic_dist, key=lambda x: x[1])
            topic_counts[dominant_topic[0]] += 1
            doc_topics.append({
                "doc_id": i,
                "topic_id": dominant_topic[0],
                "probability": float(dominant_topic[1])
            })
    
    topic_distribution = [
        {"topic_id": tid, "count": count, "percentage": count / len(corpus) * 100}
        for tid, count in topic_counts.most_common()
    ]
    
    logger.info(f"LDA分析完成，提取了{len(topics)}个主题")
    return TopicModelResult(
        topics=topics,
        topic_distribution=topic_distribution,
        doc_topics=doc_topics[:100]  # 只返回前100个文档的主题
    )
