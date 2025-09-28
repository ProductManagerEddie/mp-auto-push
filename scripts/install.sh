#!/bin/bash

# 微信公众号自动推送项目安装脚本

# 项目根目录
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

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

# 检查Node.js版本
check_nodejs() {
    print_message $BLUE "检查Node.js环境..."
    
    if ! command -v node &> /dev/null; then
        print_message $RED "错误: 未安装Node.js"
        print_message $YELLOW "请先安装Node.js 16.0.0或更高版本"
        exit 1
    fi
    
    local node_version=$(node -v | sed 's/v//')
    local major_version=$(echo $node_version | cut -d. -f1)
    
    if [ "$major_version" -lt 16 ]; then
        print_message $RED "错误: Node.js版本过低 (当前: $node_version)"
        print_message $YELLOW "请升级到Node.js 16.0.0或更高版本"
        exit 1
    fi
    
    print_message $GREEN "Node.js版本: $node_version ✓"
}

# 检查npm
check_npm() {
    print_message $BLUE "检查npm环境..."
    
    if ! command -v npm &> /dev/null; then
        print_message $RED "错误: 未安装npm"
        exit 1
    fi
    
    local npm_version=$(npm -v)
    print_message $GREEN "npm版本: $npm_version ✓"
}

# 安装依赖
install_dependencies() {
    print_message $BLUE "安装项目依赖..."
    
    cd "$PROJECT_DIR"
    
    if [ -f "package-lock.json" ]; then
        npm ci
    else
        npm install
    fi
    
    if [ $? -eq 0 ]; then
        print_message $GREEN "依赖安装完成 ✓"
    else
        print_message $RED "依赖安装失败"
        exit 1
    fi
}

# 创建必要的目录
create_directories() {
    print_message $BLUE "创建必要的目录..."
    
    local dirs=("logs" "output")
    
    for dir in "${dirs[@]}"; do
        local dir_path="$PROJECT_DIR/$dir"
        if [ ! -d "$dir_path" ]; then
            mkdir -p "$dir_path"
            print_message $GREEN "创建目录: $dir ✓"
        else
            print_message $YELLOW "目录已存在: $dir"
        fi
    done
}

# 配置环境变量
setup_env() {
    print_message $BLUE "配置环境变量..."
    
    local env_file="$PROJECT_DIR/.env"
    local env_example="$PROJECT_DIR/.env.example"
    
    if [ ! -f "$env_file" ]; then
        if [ -f "$env_example" ]; then
            cp "$env_example" "$env_file"
            print_message $GREEN "已创建 .env 文件 ✓"
            print_message $YELLOW "请编辑 .env 文件，配置你的API密钥"
        else
            print_message $RED "错误: 未找到 .env.example 文件"
            exit 1
        fi
    else
        print_message $YELLOW ".env 文件已存在"
    fi
}

# 检查PM2
check_pm2() {
    print_message $BLUE "检查PM2进程管理器..."
    
    if ! command -v pm2 &> /dev/null; then
        print_message $YELLOW "PM2未安装，正在安装..."
        npm install -g pm2
        
        if [ $? -eq 0 ]; then
            print_message $GREEN "PM2安装完成 ✓"
        else
            print_message $RED "PM2安装失败"
            print_message $YELLOW "你仍然可以使用普通模式运行服务"
        fi
    else
        local pm2_version=$(pm2 -v)
        print_message $GREEN "PM2版本: $pm2_version ✓"
    fi
}

# 测试配置
test_config() {
    print_message $BLUE "测试配置..."
    
    cd "$PROJECT_DIR"
    
    # 测试帮助命令
    if npm run help > /dev/null 2>&1; then
        print_message $GREEN "配置测试通过 ✓"
    else
        print_message $RED "配置测试失败"
        print_message $YELLOW "请检查项目配置"
    fi
}

# 显示安装完成信息
show_completion() {
    print_message $GREEN "\n🎉 安装完成！"
    print_message $BLUE "\n下一步操作:"
    print_message $YELLOW "1. 编辑 .env 文件，配置你的API密钥:"
    print_message $NC "   nano .env"
    print_message $YELLOW "\n2. 测试运行:"
    print_message $NC "   npm start"
    print_message $YELLOW "\n3. 启动后台服务:"
    print_message $NC "   npm run daemon:start"
    print_message $YELLOW "\n4. 或使用PM2管理:"
    print_message $NC "   npm run pm2:start"
    print_message $BLUE "\n更多命令:"
    print_message $NC "   npm run help          # 查看帮助"
    print_message $NC "   npm run config        # 查看配置说明"
    print_message $NC "   ./scripts/service.sh  # 服务管理脚本"
    print_message $BLUE "\n项目目录结构:"
    print_message $NC "   src/           # 源代码"
    print_message $NC "   logs/          # 日志文件"
    print_message $NC "   output/        # 输出文件"
    print_message $NC "   scripts/       # 管理脚本"
}

# 主安装流程
main() {
    print_message $GREEN "开始安装微信公众号自动推送项目...\n"
    
    check_nodejs
    check_npm
    install_dependencies
    create_directories
    setup_env
    check_pm2
    test_config
    show_completion
}

# 运行主程序
main "$@"