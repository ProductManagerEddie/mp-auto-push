#!/bin/bash

# 启动脚本：同时启动Flask API和彩票数据爬取调度器

echo "正在启动彩票数据服务..."

# 获取脚本所在目录
BASE_DIR=$(cd "$(dirname "$0")" && pwd)

# 启动Flask API
echo "启动Flask API服务..."
cd "$BASE_DIR"
python app.py &
API_PID=$!
echo "Flask API服务已启动，PID: $API_PID"

# 等待API启动
sleep 5

# 启动彩票数据爬取调度器
echo "启动彩票数据爬取调度器..."
cd "$BASE_DIR"
python -c "from scheduler import LotteryScheduler; scheduler = LotteryScheduler(); scheduler.start(); import time; while True: time.sleep(3600)" &
SCHEDULER_PID=$!
echo "调度器已启动，PID: $SCHEDULER_PID"

echo "所有服务已启动完成！"
echo "- Flask API: http://localhost:5000"
echo "- 调度器：定时执行爬取任务"

echo ""
echo "按 Ctrl+C 停止所有服务"

# 等待用户中断
wait $API_PID $SCHEDULER_PID