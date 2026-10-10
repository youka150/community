import re
import jieba
import numpy as np
from typing import List
from config import logger
from nltk.corpus import stopwords

# 中文停用词
STOPWORDS = set([
    '的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一', '一个',
    '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好',
    '自己', '这', '那', '吧', '啊', '呢', '吗', '嗯', '哦', '哈', '呀', '哇',
    '可以', '怎么', '什么', '这个', '那个', '还是', '但是', '或者', '如果', '因为',
    '所以', '而且', '然后', '可能', '应该', '需要', '已经', '一下', '一些', '非常',
    '比较', '还有', '没', '更', '最', '太', '被', '把', '让', '给', '跟', '从',
    # 代码关键字过滤
    'const', 'var', 'let', 'function', 'class', 'import', 'export', 'return',
    'this', 'super', 'void', 'null', 'true', 'false', 'if', 'else', 'for', 
    'while', 'switch', 'case', 'break', 'continue', 'new', 'try', 'catch',
    'async', 'await', 'static', 'public', 'private', 'protected', 'interface',
    'extends', 'implements', 'package', 'number', 'string', 'boolean', 'any',
])

ch_stopwords = set(stopwords.words('chinese'))
STOPWORDS.update(ch_stopwords)

def preprocess_text(text: str) -> List[str]:
    """中文文本预处理"""
    if not text or not isinstance(text, str):
        return []
    
    # 移除HTML标签
    text = re.sub(r'<[^>]+>', '', text)
    # 移除URL
    text = re.sub(r'http[s]?://\S+', '', text)
    # 移除特殊字符
    text = re.sub(r'[^\u4e00-\u9fa5a-zA-Z0-9]', ' ', text)
    
    # 分词
    words = jieba.lcut(text)
    
    # 过滤停用词和短词
    words = [w for w in words if len(w) > 1 and w not in STOPWORDS]
    
    return words


def calculate_entropy_weights(indicators: np.ndarray) -> np.ndarray:
    """
    使用熵权法计算指标权重
    """
    if indicators.shape[0] == 0:
        return np.array([])
    
    # 数据标准化（Min-Max归一化）
    min_vals = indicators.min(axis=0)
    max_vals = indicators.max(axis=0)
    ranges = max_vals - min_vals
    
    # 避免除零错误
    ranges[ranges == 0] = 1
    normalized = (indicators - min_vals) / ranges
    
    # 避免log(0)，添加极小值
    normalized = normalized + 1e-10
    
    # 计算各指标的信息熵
    n = indicators.shape[0]
    p = normalized / normalized.sum(axis=0)  # 归一化为概率分布
    entropy = -np.sum(p * np.log(p), axis=0) / np.log(n)
    
    # 计算信息效用值（冗余度）
    utility = 1 - entropy
    
    # 归一化得到权重
    weights = utility / utility.sum()
    
    logger.info(f"熵权法计算完成，权重分布: {dict(zip(range(len(weights)), weights))}")
    return weights
