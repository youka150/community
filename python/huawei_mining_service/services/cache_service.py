"""
Redis 分布式缓存服务模块

特性：
- Redis 可用时使用 Redis，不可用时自动回退到内存缓存
- 分级 TTL 策略（L1=6h, L2=12h, L3=24h）
- 统一的 Key 命名规范：community:{type}:{params_hash}
- 缓存统计（命中率、Key数量）
"""

import json
import time
import hashlib
from typing import Any, Optional
from config import logger, REDIS_URL


# ========================= 分级 TTL 常量 =========================
CACHE_TTL_L1 = 43200     # 6小时 — 网络分析、主题模型、用户画像
CACHE_TTL_L2 = 43200     # 12小时 — AI 分析结果（LLM 调用昂贵）
CACHE_TTL_L3 = 86400     # 24小时 — 排行榜快照、商业热点

# Key 前缀
KEY_PREFIX = "community"


def _build_key(category: str, *args) -> str:
    """
    构建 Redis 缓存 Key。
    格式: community:{category}:{params_hash}
    使用 MD5 哈希参数，避免 Key 过长。
    """
    raw = "_".join(str(a) for a in args)
    params_hash = hashlib.md5(raw.encode()).hexdigest()[:12]
    return f"{KEY_PREFIX}:{category}:{params_hash}"


# ========================= 内存缓存后备 =========================

class _MemoryCache:
    """简单的内存缓存，当 Redis 不可用时作为后备方案。"""

    def __init__(self):
        self._store: dict[str, dict] = {}
        self._hits = 0
        self._misses = 0

    def get(self, key: str) -> Optional[Any]:
        item = self._store.get(key)
        if item is None:
            self._misses += 1
            return None
        # 检查是否过期
        if time.time() > item["expire_at"]:
            del self._store[key]
            self._misses += 1
            return None
        self._hits += 1
        return item["value"]

    def set(self, key: str, value: Any, ttl: int):
        self._store[key] = {
            "value": value,
            "expire_at": time.time() + ttl
        }

    def delete(self, key: str) -> bool:
        return self._store.pop(key, None) is not None

    def clear(self, prefix: Optional[str] = None) -> int:
        """清除缓存，支持按前缀清除。"""
        if prefix is None:
            count = len(self._store)
            self._store.clear()
            return count
        keys_to_delete = [k for k in self._store if k.startswith(prefix)]
        for k in keys_to_delete:
            del self._store[k]
        return len(keys_to_delete)

    def stats(self) -> dict:
        # 清理过期 Key
        now = time.time()
        expired_keys = [k for k, v in self._store.items() if now > v["expire_at"]]
        for k in expired_keys:
            del self._store[k]
        total = self._hits + self._misses
        return {
            "backend": "memory",
            "total_keys": len(self._store),
            "hits": self._hits,
            "misses": self._misses,
            "hit_rate": f"{(self._hits / total * 100):.1f}%" if total > 0 else "N/A"
        }


# ========================= Redis 缓存 =========================

class _RedisCache:
    """基于 Redis 的分布式缓存。"""

    def __init__(self, redis_url: str):
        import redis
        self._client = redis.from_url(
            redis_url,
            decode_responses=True,
            socket_connect_timeout=3,
            socket_timeout=3,
            retry_on_timeout=True
        )
        self._hits = 0
        self._misses = 0
        # 测试连接
        self._client.ping()
        logger.info(f"✅ Redis 连接成功: {redis_url}")

    def get(self, key: str) -> Optional[Any]:
        raw = self._client.get(key)
        if raw is None:
            self._misses += 1
            return None
        self._hits += 1
        return json.loads(raw)

    def set(self, key: str, value: Any, ttl: int):
        self._client.setex(key, ttl, json.dumps(value, ensure_ascii=False, default=str))

    def delete(self, key: str) -> bool:
        return self._client.delete(key) > 0

    def clear(self, prefix: Optional[str] = None) -> int:
        """清除缓存，支持按前缀清除。使用 SCAN 避免阻塞。"""
        pattern = f"{prefix}*" if prefix else f"{KEY_PREFIX}:*"
        count = 0
        cursor = 0
        while True:
            cursor, keys = self._client.scan(cursor=cursor, match=pattern, count=100)
            if keys:
                count += self._client.delete(*keys)
            if cursor == 0:
                break
        return count

    def stats(self) -> dict:
        info = self._client.info(section="keyspace")
        # 统计 community:* 的 Key 数量
        pattern = f"{KEY_PREFIX}:*"
        key_count = 0
        cursor = 0
        while True:
            cursor, keys = self._client.scan(cursor=cursor, match=pattern, count=100)
            key_count += len(keys)
            if cursor == 0:
                break

        total = self._hits + self._misses
        return {
            "backend": "redis",
            "redis_info": info,
            "total_keys": key_count,
            "hits": self._hits,
            "misses": self._misses,
            "hit_rate": f"{(self._hits / total * 100):.1f}%" if total > 0 else "N/A"
        }


# ========================= 缓存管理器 =========================

class CacheManager:
    """
    统一缓存管理器。
    自动选择 Redis 或内存后备，对外提供统一 API。
    """

    def __init__(self):
        self._cache = None
        self._initialized = False

    def initialize(self):
        """初始化缓存后端。"""
        if self._initialized:
            return

        if REDIS_URL:
            try:
                self._cache = _RedisCache(REDIS_URL)
                self._initialized = True
                return
            except Exception as e:
                logger.warning(f"⚠️ Redis 连接失败，回退到内存缓存: {e}")

        self._cache = _MemoryCache()
        self._initialized = True
        logger.info("📦 使用内存缓存模式")

    def _ensure_init(self):
        if not self._initialized:
            self.initialize()

    # ---------- 公共 API ----------

    def get(self, key: str) -> Optional[Any]:
        """获取缓存值，未命中返回 None。"""
        self._ensure_init()
        return self._cache.get(key)

    def set(self, key: str, value: Any, ttl: int = CACHE_TTL_L1):
        """设置缓存值。"""
        self._ensure_init()
        self._cache.set(key, value, ttl)

    def delete(self, key: str) -> bool:
        """删除指定缓存。"""
        self._ensure_init()
        return self._cache.delete(key)

    def clear(self, prefix: Optional[str] = None) -> int:
        """清除缓存，可选按前缀过滤。"""
        self._ensure_init()
        return self._cache.clear(prefix)

    def get_stats(self) -> dict:
        """获取缓存统计信息。"""
        self._ensure_init()
        return self._cache.stats()

    # ---------- 便捷方法 ----------

    def build_key(self, category: str, *args) -> str:
        """构建缓存 Key。"""
        return _build_key(category, *args)

    def get_or_compute(self, key: str, compute_fn, ttl: int = CACHE_TTL_L1):
        """
        获取缓存，如果未命中则执行计算函数并缓存结果。
        
        用法:
            result = cache_manager.get_or_compute(
                cache_manager.build_key("network", start, end, top_n),
                lambda: perform_network_analysis(edges_df, comments_df, top_n).model_dump(),
                ttl=CACHE_TTL_L1
            )
        """
        cached = self.get(key)
        if cached is not None:
            logger.info(f"🎯 缓存命中: {key}")
            return cached
        result = compute_fn()
        self.set(key, result, ttl)
        logger.info(f"💾 已缓存结果: {key} (TTL={ttl}s)")
        return result


# 全局单例
cache_manager = CacheManager()
