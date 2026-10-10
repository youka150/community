# community

**华为与昇腾社区数据分析平台**

中文 | [English](README.en.md)

基于 Next.js 和 FastAPI 的社区分析项目，提供社区概览、用户画像与排名、交互网络、话题分析和数据工作台。前端通过 Next.js API 访问 PostgreSQL，并调用 Python 服务完成文本挖掘和网络计算。

## 功能

- **社区看板**：华为开发者社区与昇腾社区的活跃趋势、热门内容和互动统计。
- **用户分析**：用户详情、用户分群、影响力排名及可调整的评分权重。
- **网络与话题分析**：交互网络可视化、中心性指标、LDA / BERTopic 主题分析和热点识别。
- **AI 分析**：大模型生成分析解读，结合 Tavily / Bocha 搜索进行趋势分析并保存报告。
- **数据工作台**：导入表格、查看和编辑数据集、开展 BI 探索。
- **角色视图**：管理员、数据工程师和普通用户的页面访问与操作视图。

## 技术栈

| 层级 | 主要技术 |
| --- | --- |
| Web 与 API | Next.js 15、React 19 |
| 界面与图表 | Tailwind CSS、Ant Design、Recharts、React Force Graph |
| 数据访问 | PostgreSQL、Drizzle ORM |
| 分析服务 | FastAPI、pandas、scikit-learn、NetworkX、Gensim、BERTopic |
| 缓存 | 内存缓存，可选 Redis |

## 本地运行

准备 Node.js 20+、Python 3.11 和 PostgreSQL。社区看板需要已有的社区数据；仓库包含数据库结构与迁移文件，不包含原始数据或数据库备份。

### 1. 安装前端依赖

```bash
git clone https://github.com/youka150/community.git
cd community
npm ci
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env.local`，填写数据库连接及需要启用的 API 配置。Windows PowerShell：

```powershell
Copy-Item .env.example .env.local
```

| 变量 | 用途 |
| --- | --- |
| `DATABASE_URL` | PostgreSQL 连接，前端与 Python 服务共用 |
| `HUAWEI_MINING_BASE_URL` | Python 分析服务地址，默认 `http://127.0.0.1:8008` |
| `TREND_ANALYSIS_API_KEY` | 大模型 API 密钥 |
| `TREND_ANALYSIS_BASE_URL` | 大模型 API 基础地址 |
| `TREND_ANALYSIS_MODEL_NAME` | 大模型名称 |
| `TAVILY_API_KEY` / `BOCHA_API_KEY` | 趋势分析使用的搜索服务密钥 |
| `BOCHA_BASE_URL` | 可选的 Bocha API 基础地址 |
| `REDIS_URL` | 可选的 Redis 连接 |
| `MAX_REFLECTIONS` / `MAX_SEARCH_RESULTS` / `SEARCH_TIMEOUT` | 趋势分析配置 |

### 3. 准备数据库

数据库定义位于 `src/lib/db/schema.js`，已有迁移位于 `drizzle/`。社区分析读取华为的 `topics`、`questions` 及对应评论表，以及昇腾的 `ascend_*` 表。请按当前结构准备数据库并导入自己的社区数据。

`create_datasets_table.sql` 和 `create_trend_tables.sql` 分别用于初始化上传数据集与趋势报告表；`scripts/huawei_normalize_timestamps.sql` 用于已有华为数据的时间字段规范化。SQL 文件按实际数据库结构选用。

### 4. 启动 Python 分析服务

Windows PowerShell 可在项目根目录运行：

```powershell
.\start-analysis-service.ps1
```

脚本会创建服务虚拟环境、安装依赖、将 `.env.local` 复制为服务目录的 `.env`，并启动端口 `8008`。也可手动运行：

```bash
cd python/huawei_mining_service
python -m venv venv
# Windows PowerShell: .\venv\Scripts\Activate.ps1
# macOS / Linux: source venv/bin/activate
pip install -r requirements.txt
# 将根目录的 .env.local 复制到当前目录并命名为 .env
uvicorn app:app --host 127.0.0.1 --port 8008 --reload
```

健康检查：`http://127.0.0.1:8008/api/health`；API 文档：`http://127.0.0.1:8008/docs`。首次使用 BERTopic 时可能需要下载模型。

### 5. 启动 Web 应用

在另一个终端回到项目根目录：

```bash
npm run dev
```

打开 `http://localhost:3000`。当前注册与登录使用浏览器本地存储，角色通过 Cookie 控制页面访问，适合本地演示；正式部署前需要接入服务端身份认证和 API 权限校验。

生产构建命令：

```bash
npm run build
npm start
```

## 项目结构

```text
src/app/                       页面与 Next.js API 路由
src/components/                社区看板、用户分析、数据工作台
src/context/                   登录状态与分析上下文
src/lib/                       数据库、趋势分析 Agent、LLM 与搜索客户端
src/utils/                     网络评分权重工具
python/huawei_mining_service/   FastAPI 分析服务与算法
drizzle/                       数据库迁移
scripts/                       开发辅助与数据库维护脚本
public/                        页面静态资源
.env.example                   不含真实密钥的配置示例
```

## 仓库内容

仓库保留运行所需的源码、依赖锁文件、数据库定义、项目资源和配置示例。虚拟环境、依赖目录、构建产物、真实环境变量、日志、AI 工具配置、论文材料和本地实验结果均不上传。
