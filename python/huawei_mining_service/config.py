import os
import logging
from dotenv import load_dotenv

# 设置环境变量以消除 joblib 和 sklearn 的警告 ( must be set before importing sklearn)
os.environ["LOKY_MAX_CPU_COUNT"] = "4"
os.environ["OMP_NUM_THREADS"] = "4"

# 加载环境变量
load_dotenv()

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 数据库连接配置
DATABASE_URL = os.getenv("DATABASE_URL", "")

# 大模型API配置
LLM_API_KEY = os.getenv("TREND_ANALYSIS_API_KEY", "")
LLM_BASE_URL = os.getenv("TREND_ANALYSIS_BASE_URL", "")
LLM_MODEL_NAME = os.getenv("TREND_ANALYSIS_MODEL_NAME", "")

# Redis缓存配置
REDIS_URL = os.getenv("REDIS_URL", "")
