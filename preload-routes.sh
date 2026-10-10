#!/bin/bash
# 这个脚本在 build 后运行，预加载所有路由

# 等待服务器启动
sleep 5

echo "开始预加载所有路由..."

# 预加载所有路由
curl -s http://localhost:3000/ > /dev/null &
curl -s http://localhost:3000/trend-analysis > /dev/null &
curl -s http://localhost:3000/user-modeling > /dev/null &
curl -s http://localhost:3000/leaderboard > /dev/null &
curl -s http://localhost:3000/dashboard > /dev/null &
curl -s http://localhost:3000/analysis > /dev/null &

wait

echo "所有路由预加载完成！"
