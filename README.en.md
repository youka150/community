# community

**Huawei and Ascend Community Analytics Platform**

[中文](README.md) | English

A community analytics project built with Next.js and FastAPI. It provides community dashboards, user profiles and rankings, interaction networks, topic analysis, and a data workbench. Next.js API routes access PostgreSQL and call the Python service for text mining and network analysis.

## Features

- **Community dashboards:** activity trends, popular content, and interaction statistics for Huawei Developer Community and Ascend Community.
- **User analytics:** user details, clustering, influence rankings, and adjustable scoring weights.
- **Networks and topics:** interaction graph visualization, centrality metrics, LDA / BERTopic topic modeling, and hotspot identification.
- **AI analysis:** model-generated interpretations, trend analysis using Tavily / Bocha search, and saved reports.
- **Data workbench:** spreadsheet imports, dataset browsing and editing, and BI exploration.
- **Role views:** administrator, data engineer, and regular user views.

## Technology

| Layer | Main technologies |
| --- | --- |
| Web and API | Next.js 15, React 19 |
| UI and charts | Tailwind CSS, Ant Design, Recharts, React Force Graph |
| Data access | PostgreSQL, Drizzle ORM |
| Analysis service | FastAPI, pandas, scikit-learn, NetworkX, Gensim, BERTopic |
| Cache | In-memory cache, optional Redis |

## Run locally

Prepare Node.js 20+, Python 3.11, and PostgreSQL. Community dashboards require an existing community dataset. This repository contains database definitions and migration files; raw data and database backups are not included.

### 1. Install frontend dependencies

```bash
git clone https://github.com/youka150/community.git
cd community
npm ci
```

### 2. Configure environment variables

Copy `.env.example` to `.env.local` and fill in the database connection and the API settings needed for your features. In Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection shared by the Web app and Python service |
| `HUAWEI_MINING_BASE_URL` | Python service URL; defaults to `http://127.0.0.1:8008` |
| `TREND_ANALYSIS_API_KEY` | LLM API key |
| `TREND_ANALYSIS_BASE_URL` | LLM API base URL |
| `TREND_ANALYSIS_MODEL_NAME` | Model name |
| `TAVILY_API_KEY` / `BOCHA_API_KEY` | Search API keys for trend analysis |
| `BOCHA_BASE_URL` | Optional Bocha API base URL |
| `REDIS_URL` | Optional Redis connection |
| `MAX_REFLECTIONS` / `MAX_SEARCH_RESULTS` / `SEARCH_TIMEOUT` | Trend analysis settings |

### 3. Prepare the database

Database definitions are in `src/lib/db/schema.js`; existing migrations are in `drizzle/`. Community analysis reads Huawei `topics`, `questions`, and their comment tables, along with Ascend `ascend_*` tables. Prepare a database matching the current schema and import your own community data.

`create_datasets_table.sql` and `create_trend_tables.sql` initialize the uploaded dataset and trend report tables. `scripts/huawei_normalize_timestamps.sql` normalizes time fields in an existing Huawei dataset. Select the SQL files appropriate for your database structure.

### 4. Start the Python service

On Windows, run this from the project root in PowerShell:

```powershell
.\start-analysis-service.ps1
```

The script creates the service virtual environment, installs dependencies, copies `.env.local` to the service directory as `.env`, and starts port `8008`. Alternatively:

```bash
cd python/huawei_mining_service
python -m venv venv
# Windows PowerShell: .\venv\Scripts\Activate.ps1
# macOS / Linux: source venv/bin/activate
pip install -r requirements.txt
# Copy the root .env.local here as .env
uvicorn app:app --host 127.0.0.1 --port 8008 --reload
```

Health check: `http://127.0.0.1:8008/api/health`. API documentation: `http://127.0.0.1:8008/docs`. BERTopic may download a model on first use.

### 5. Start the Web app

Open another terminal at the project root:

```bash
npm run dev
```

Visit `http://localhost:3000`. Registration and login currently use browser local storage, with role cookies controlling page access for local demonstrations. Production deployment requires server-side authentication and API authorization.

Production build commands:

```bash
npm run build
npm start
```

## Project structure

```text
src/app/                       Pages and Next.js API routes
src/components/                Dashboards, user analytics, and data workbench
src/context/                   Authentication state and analysis context
src/lib/                       Database, trend Agent, LLM and search clients
src/utils/                     Network scoring weight utilities
python/huawei_mining_service/   FastAPI analysis service and algorithms
drizzle/                       Database migrations
scripts/                       Development and database maintenance scripts
public/                        Static assets
.env.example                   Configuration template without real credentials
```

## Repository contents

The repository includes application source, the dependency lockfile, database definitions, project assets, and configuration examples. Virtual environments, dependency directories, build output, real environment settings, logs, AI tool settings, thesis documents, and local experiment results are excluded.
