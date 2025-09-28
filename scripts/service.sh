#!/bin/bash

# 微信公众号自动推送服务管理脚本

# 项目根目录
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_FILE="$PROJECT_DIR/mp-auto-push.pid"
LOG_DIR="$PROJECT_DIR/logs"
SERVICE_NAME="mp-auto-push"

# 确保日志目录存在
mkdir -p "$LOG_DIR"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_message() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# 检查服务状态
check_status() {
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        if ps -p "$pid" > /dev/null 2>&1; then
            return 0  # 服务正在运行
        else
            rm -f "$PID_FILE"  # 清理无效的PID文件
            return 1  # 服务未运行
        fi
    else
        return 1  # 服务未运行
    fi
}

# 启动服务
start_service() {
    print_message $BLUE "启动微信公众号自动推送服务..."
    
    if check_status; then
        print_message $YELLOW "服务已经在运行中 (PID: $(cat $PID_FILE))"
        return 1
    fi
    
    # 检查环境配置
    if [ ! -f "$PROJECT_DIR/.env" ]; then
        print_message $RED "错误: 未找到 .env 配置文件"
        print_message $YELLOW "请先复制 .env.example 到 .env 并配置相关参数"
        return 1
    fi
    
    # 启动服务
    cd "$PROJECT_DIR"
    nohup node src/daemon.js start > "$LOG_DIR/service.log" 2>&1 &
    local pid=$!
    
    # 保存PID
    echo $pid > "$PID_FILE"
    
    # 等待服务启动
    sleep 2
    
    if check_status; then
        print_message $GREEN "服务启动成功 (PID: $pid)"
        print_message $BLUE "日志文件: $LOG_DIR/service.log"
        print_message $BLUE "应用日志: $LOG_DIR/app.log"
        return 0
    else
        print_message $RED "服务启动失败"
        return 1
    fi
}

# 停止服务
stop_service() {
    print_message $BLUE "停止微信公众号自动推送服务..."
    
    if ! check_status; then
        print_message $YELLOW "服务未在运行"
        return 1
    fi
    
    local pid=$(cat "$PID_FILE")
    
    # 发送SIGTERM信号
    kill -TERM "$pid" 2>/dev/null
    
    # 等待服务停止
    local count=0
    while [ $count -lt 10 ]; do
        if ! ps -p "$pid" > /dev/null 2>&1; then
            break
        fi
        sleep 1
        count=$((count + 1))
    done
    
    # 如果服务仍在运行，强制杀死
    if ps -p "$pid" > /dev/null 2>&1; then
        print_message $YELLOW "强制停止服务..."
        kill -KILL "$pid" 2>/dev/null
    fi
    
    # 清理PID文件
    rm -f "$PID_FILE"
    
    print_message $GREEN "服务已停止"
}

# 重启服务
restart_service() {
    print_message $BLUE "重启微信公众号自动推送服务..."
    stop_service
    sleep 2
    start_service
}

# 查看服务状态
status_service() {
    print_message $BLUE "微信公众号自动推送服务状态:"
    
    if check_status; then
        local pid=$(cat "$PID_FILE")
        local uptime=$(ps -o etime= -p "$pid" 2>/dev/null | tr -d ' ')
        print_message $GREEN "状态: 运行中"
        print_message $GREEN "PID: $pid"
        print_message $GREEN "运行时间: $uptime"
        
        # 显示内存使用情况
        local memory=$(ps -o rss= -p "$pid" 2>/dev/null | tr -d ' ')
        if [ -n "$memory" ]; then
            local memory_mb=$((memory / 1024))
            print_message $GREEN "内存使用: ${memory_mb}MB"
        fi
    else
        print_message $RED "状态: 未运行"
    fi
    
    # 显示最近的日志
    if [ -f "$LOG_DIR/app.log" ]; then
        print_message $BLUE "\n最近的日志 (最后10行):"
        tail -n 10 "$LOG_DIR/app.log"
    fi
}

# 查看日志
view_logs() {
    local log_type=${1:-"app"}
    local log_file="$LOG_DIR/${log_type}.log"
    
    if [ -f "$log_file" ]; then
        print_message $BLUE "查看 $log_type 日志 (按 Ctrl+C 退出):"
        tail -f "$log_file"
    else
        print_message $RED "日志文件不存在: $log_file"
    fi
}

# 手动执行推送任务
run_task() {
    print_message $BLUE "手动执行推送任务..."
    cd "$PROJECT_DIR"
    node src/daemon.js run
}

# 显示帮助信息
show_help() {
    echo "微信公众号自动推送服务管理脚本"
    echo ""
    echo "使用方法:"
    echo "  $0 {start|stop|restart|status|logs|run|help}"
    echo ""
    echo "命令说明:"
    echo "  start    启动后台服务"
    echo "  stop     停止后台服务"
    echo "  restart  重启后台服务"
    echo "  status   查看服务状态"
    echo "  logs     查看应用日志 (实时)"
    echo "  run      手动执行一次推送任务"
    echo "  help     显示此帮助信息"
    echo ""
    echo "日志文件位置:"
    echo "  应用日志: $LOG_DIR/app.log"
    echo "  错误日志: $LOG_DIR/error.log"
    echo "  调度日志: $LOG_DIR/schedule.log"
    echo "  服务日志: $LOG_DIR/service.log"
}

# 主程序
case "$1" in
    start)
        start_service
        ;;
    stop)
        stop_service
        ;;
    restart)
        restart_service
        ;;
    status)
        status_service
        ;;
    logs)
        view_logs ${2:-"app"}
        ;;
    run)
        run_task
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        print_message $RED "错误: 未知命令 '$1'"
        echo ""
        show_help
        exit 1
        ;;
esac

exit $?