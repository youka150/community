# 启动 Python 分析服务
# 请在 community 项目根目录下运行此脚本

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "华为开发者社区分析服务启动脚本" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$servicePath = "python\huawei_mining_service"

# 检查虚拟环境
if (-not (Test-Path "$servicePath\venv")) {
    Write-Host "`n[1/3] 创建 Python 虚拟环境..." -ForegroundColor Yellow
    python -m venv "$servicePath\venv"
}

# 激活虚拟环境并安装依赖
Write-Host "`n[2/3] 安装 Python 依赖..." -ForegroundColor Yellow
& "$servicePath\venv\Scripts\pip.exe" install -r "$servicePath\requirements.txt" -q

# 复制 .env.local 到 Python 服务目录（供 dotenv 读取）
if (Test-Path ".env.local") {
    Copy-Item ".env.local" "$servicePath\.env" -Force
    Write-Host "已复制环境变量配置到 Python 服务目录" -ForegroundColor Green
}

# 启动服务
Write-Host "`n[3/3] 启动分析服务 (端口 8008)..." -ForegroundColor Yellow
Write-Host "服务地址: http://127.0.0.1:8008" -ForegroundColor Green
Write-Host "健康检查: http://127.0.0.1:8008/api/health" -ForegroundColor Green
Write-Host "按 Ctrl+C 停止服务`n" -ForegroundColor Gray

& "$servicePath\venv\Scripts\uvicorn.exe" app:app --host 0.0.0.0 --port 8008 --reload --app-dir "$servicePath"
