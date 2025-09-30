# 微信公众号自动推送工具

一个基于Node.js的微信公众号文章自动推送工具，能够从指定的新闻API获取最新资讯，通过元宝AI生成公众号文章，并自动推送到微信公众号草稿箱。支持后台服务运行和定时任务调度。

## 功能特性

- 🔄 **自动获取新闻**: 从60s读世界API获取每日新闻资讯
- 🤖 **AI文章生成**: 使用元宝AI将新闻内容转换为适合公众号的文章格式
- 📱 **微信推送**: 自动将生成的文章推送到微信公众号草稿箱
- 💾 **本地备份**: 支持将文章保存到本地文件（当微信配置缺失时）
- ⏰ **定时任务**: 支持每天8点自动执行推送任务
- 🔧 **后台服务**: 支持后台守护进程运行，提供服务管理功能
- 📊 **日志记录**: 完整的日志记录系统，支持不同级别的日志输出
- 🚀 **进程管理**: 支持PM2进程管理，提供进程监控和自动重启
- ⚙️ **灵活配置**: 支持环境变量配置，易于部署和管理

## 工作流程

1. **获取新闻数据** - 从 `https://60s.viki.moe/v2/60s` 获取最新的新闻信息
2. **AI内容生成** - 将新闻数据发送给元宝AI，生成适合公众号的文章内容
3. **内容解析** - 解析AI生成的文章，提取标题和正文内容
4. **推送发布** - 将文章推送到微信公众号草稿箱，或保存到本地文件

## 安装使用

### 环境要求

- Node.js 16.0.0 或更高版本
- npm 或 yarn 包管理器
- PM2 (可选，用于进程管理)

### 快速开始

#### 方法一：自动安装（推荐）

```bash
# 克隆项目
git clone <repository-url>
cd mp-auto-push

# 运行自动安装脚本
./scripts/install.sh
```

#### 方法二：手动安装

1. **克隆项目**
```bash
git clone <repository-url>
cd mp-auto-push
```

2. **安装依赖**
```bash
npm install
```

3. **配置环境变量**
```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件，填入你的配置信息
nano .env
```

4. **创建必要目录**
```bash
mkdir -p logs output
```

### 运行方式

#### 单次执行
```bash
# 执行一次推送
npm start

# 查看帮助信息
npm run help

# 查看配置说明
npm run config
```

#### 后台服务模式
```bash
# 启动后台服务（每天8点自动推送）
npm run daemon:start

# 停止后台服务
npm run daemon:stop

# 重启后台服务
npm run daemon:restart

# 查看服务状态
npm run daemon:status

# 手动执行一次推送
npm run daemon:run
```

#### 使用PM2管理（推荐生产环境）
```bash
# 启动PM2服务
npm run pm2:start

# 查看服务状态
npm run pm2:status

# 查看日志
npm run pm2:logs

# 重启服务
npm run pm2:restart

# 停止服务
npm run pm2:stop
```

#### 使用服务管理脚本
```bash
# 启动服务
./scripts/service.sh start

# 停止服务
./scripts/service.sh stop

# 查看状态
./scripts/service.sh status

# 查看日志
./scripts/service.sh logs
```

## 配置说明

### 环境变量配置

编辑 `.env` 文件：

```env
# 元宝AI配置 (必需)
YUANBAO_TOKEN=your_yuanbao_token
YUANBAO_USER_ID=your_user_id

# 微信公众号配置 (可选)
WECHAT_APP_ID=your_wechat_app_id
WECHAT_APP_SECRET=your_wechat_app_secret
```

### 元宝AI配置

- `YUANBAO_TOKEN`: 元宝AI的访问令牌（必需）
- `YUANBAO_USER_ID`: 用户ID（必需）

获取方式：访问 [元宝AI官网](https://yuanbao.tencent.com/) 注册并获取API访问权限

### 微信公众号配置

需要在[微信公众平台](https://mp.weixin.qq.com/)获取：

- `WECHAT_APP_ID`: 公众号的AppID
- `WECHAT_APP_SECRET`: 公众号的AppSecret

**注意**: 
- 微信公众号需要已认证并开通相关接口权限
- 如果不配置微信公众号信息，文章将保存到本地 `output` 目录

### 定时任务配置

后台服务默认配置：
- **推送时间**: 每天上午8:00自动执行
- **健康检查**: 每小时执行一次
- **开发模式**: 每分钟执行一次（仅在NODE_ENV=development时）

可以在 `src/scheduler.js` 中修改定时规则。

## 命令行选项

```bash
# 显示帮助信息
npm run help

# 显示配置说明
npm run config

# 直接运行
npm run dev
```

## API接口说明

### 60s新闻API

- **接口地址**: `https://60s.viki.moe/v2/60s`
- **请求方式**: GET
- **返回格式**: JSON

响应数据结构：
```json
{
  "code": 200,
  "message": "获取成功",
  "data": {
    "date": "2025-09-28",
    "news": ["新闻1", "新闻2", "..."],
    "image": "图片URL",
    "tip": "每日寄语",
    "cover": "封面图URL",
    "link": "原文链接"
  }
}
```

### 元宝AI接口

- **接口地址**: `https://yuanqi.tencent.com/openapi/v1/agent/chat/completions`
- **智能体ID**: `Q9ZpgTtHwdjZ`
- **请求方式**: POST
- **认证方式**: Bearer Token

## 项目结构

```
mp-auto-push/
├── src/
│   ├── index.js          # 主程序入口
│   ├── newsService.js    # 新闻获取服务
│   ├── aiService.js      # AI文章生成服务
│   ├── wechatService.js  # 微信公众号服务
│   ├── daemon.js         # 后台服务守护进程
│   ├── scheduler.js      # 定时任务调度器
│   └── logger.js         # 日志记录模块
├── scripts/
│   ├── service.sh        # 服务管理脚本
│   └── install.sh        # 自动安装脚本
├── logs/                 # 日志文件目录
│   ├── app.log          # 应用日志
│   ├── error.log        # 错误日志
│   ├── schedule.log     # 调度日志
│   └── pm2-*.log        # PM2日志
├── output/               # 本地文章输出目录
├── ecosystem.config.js   # PM2配置文件
├── .env.example          # 环境变量配置示例
├── .gitignore           # Git忽略文件
├── package.json         # 项目配置
└── README.md           # 项目说明
```

## 日志管理

项目提供完整的日志记录功能：

### 日志文件

- `logs/app.log` - 应用运行日志
- `logs/error.log` - 错误日志
- `logs/schedule.log` - 定时任务日志
- `logs/pm2-*.log` - PM2进程管理日志

### 日志级别

- **info** - 一般信息
- **warn** - 警告信息
- **error** - 错误信息
- **debug** - 调试信息

### 查看日志

```bash
# 查看应用日志
tail -f logs/app.log

# 查看错误日志
tail -f logs/error.log

# 查看调度日志
tail -f logs/schedule.log

# 使用服务脚本查看日志
./scripts/service.sh logs
```

## 错误处理

程序包含完善的错误处理机制：

- **网络请求失败**: 自动重试和超时处理
- **API调用失败**: 详细的错误信息输出
- **配置缺失**: 友好的提示信息
- **文件操作失败**: 异常捕获和日志记录
- **进程异常**: 自动重启和状态监控

## 服务监控

### 健康检查

后台服务包含自动健康检查功能：
- 每小时检查一次服务状态
- 记录内存使用情况
- 监控任务执行状态

### 进程管理

使用PM2进行进程管理：
- 自动重启异常进程
- 内存使用监控
- 日志轮转管理
- 集群模式支持

### 状态查询

```bash
# 查看服务状态
npm run daemon:status

# 查看PM2状态
npm run pm2:status

# 使用服务脚本查看状态
./scripts/service.sh status
```

## 注意事项

1. **API限制**: 请注意各API的调用频率限制
2. **网络环境**: 确保服务器能够访问相关API接口
3. **权限配置**: 微信公众号需要相应的接口权限
4. **数据安全**: 请妥善保管API密钥和配置信息
5. **定时任务**: 确保系统时间准确，避免定时任务执行异常
6. **磁盘空间**: 定期清理日志文件，避免磁盘空间不足
7. **进程监控**: 建议使用PM2或systemd进行生产环境部署

## 鸣谢

感谢以下优秀的开源项目和服务，为本项目提供了重要支持：

### 🌍 数据源
- **[60s API](https://github.com/vikiboss/60s)** <mcreference link="https://github.com/vikiboss/60s" index="0">0</mcreference>
  - 提供高质量的每日新闻数据源
  - 毫秒级响应，全球CDN加速
  - 开源、可靠、免费的新闻API服务

### 🤖 AI服务
- **[腾讯元宝](https://yuanbao.tencent.com/)** <mcreference link="https://yuanbao.tencent.com/" index="1">1</mcreference>
  - 提供强大的AI文章生成能力
  - 智能内容创作和文本处理
  - 专业的智能助手服务

感谢这些项目的开发者和维护者，让我们能够构建更好的自动化工具！

## 许可证

MIT License

## 贡献

欢迎提交Issue和Pull Request来改进这个项目。

## 更新日志

### v1.0.0
- 初始版本发布
- 支持60s新闻获取
- 支持元宝AI文章生成
- 支持微信公众号推送
- 支持本地文件保存