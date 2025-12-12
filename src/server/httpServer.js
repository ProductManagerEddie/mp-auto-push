const express = require('express');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const { logger } = require('./logger');
const AutoPushApp = require('./index');
const PushHistory = require('./pushHistory');

/**
 * HTTP服务模块，提供手动触发推送的API接口
 */
class HttpServer {
    constructor() {
        this.app = express();
        this.port = process.env.HTTP_PORT || 3000;
        this.autoPushApp = new AutoPushApp({ serviceMode: true });
        this.pushHistory = new PushHistory();
        this.runningTasks = new Map();
        this.setupMiddleware();
        this.setupRoutes();
        this.server = null;
    }

    /**
     * 设置中间件
     */
    setupMiddleware() {
        // 解析JSON请求体
        this.app.use(bodyParser.json({ limit: '10mb' }));
        
        // 解析URL编码的请求体
        this.app.use(bodyParser.urlencoded({ extended: true }));
        
        // CORS配置
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
            if (req.method === 'OPTIONS') {
                return res.sendStatus(200);
            }
            next();
        });
        
        // 日志中间件
        this.app.use((req, res, next) => {
            logger.info(`HTTP请求: ${req.method} ${req.url}`, {
                ip: req.ip,
                userAgent: req.get('User-Agent')
            });
            next();
        });
        
        // 错误处理中间件
        this.app.use((err, req, res, next) => {
            logger.error('HTTP请求错误:', err);
            res.status(500).json({
                success: false,
                error: '服务器内部错误',
                message: err.message
            });
        });
    }

    /**
     * 设置路由
     */
    setupRoutes() {
        // 健康检查端点
        this.app.get('/health', (req, res) => {
            res.json({
                success: true,
                status: 'ok',
                timestamp: new Date().toISOString(),
                service: 'mp-auto-push'
            });
        });

        // 服务状态端点
        this.app.get('/api/status', (req, res) => {
            const status = {
                success: true,
                serverStatus: 'running',
                httpPort: this.port,
                runningTasks: this.runningTasks.size,
                timestamp: new Date().toISOString()
            };
            res.json(status);
        });

        // 触发推送端点
        this.app.post('/api/push', async (req, res) => {
            try {
                // 验证API密钥
                if (!this.validateApiKey(req)) {
                    return res.status(401).json({
                        success: false,
                        error: '未授权访问',
                        message: 'API密钥无效'
                    });
                }

                const taskId = uuidv4();
                const pushParams = req.body;
                
                // 创建推送任务记录
                const task = {
                    id: taskId,
                    status: 'pending',
                    createTime: new Date().toISOString(),
                    updateTime: new Date().toISOString(),
                    params: pushParams,
                    result: null
                };

                // 保存到运行中的任务
                this.runningTasks.set(taskId, task);
                
                // 保存到历史记录
                await this.pushHistory.saveTask(task);

                // 异步执行推送任务
                this.executePushTask(taskId, pushParams);

                // 返回任务ID
                res.status(202).json({
                    success: true,
                    message: '推送任务已接收',
                    taskId: taskId,
                    status: 'pending',
                    createTime: task.createTime
                });

            } catch (error) {
                logger.error('触发推送失败:', error);
                res.status(400).json({
                    success: false,
                    error: '请求失败',
                    message: error.message
                });
            }
        });

        // 查询推送历史记录（需要放在/api/push/:id之前）
        this.app.get('/api/push/history', async (req, res) => {
            try {
                // 验证API密钥
                if (!this.validateApiKey(req)) {
                    return res.status(401).json({
                        success: false,
                        error: '未授权访问',
                        message: 'API密钥无效'
                    });
                }

                const { page = 1, limit = 10, status } = req.query;
                const history = await this.pushHistory.getHistory({
                    page: parseInt(page),
                    limit: parseInt(limit),
                    status: status
                });

                res.json({
                    success: true,
                    data: history
                });

            } catch (error) {
                logger.error('查询推送历史失败:', error);
                res.status(500).json({
                    success: false,
                    error: '服务器内部错误',
                    message: error.message
                });
            }
        });

        // 查询推送任务状态（需要放在/api/push/history之后）
        this.app.get('/api/push/:id', async (req, res) => {
            try {
                // 验证API密钥
                if (!this.validateApiKey(req)) {
                    return res.status(401).json({
                        success: false,
                        error: '未授权访问',
                        message: 'API密钥无效'
                    });
                }

                const taskId = req.params.id;
                const task = await this.pushHistory.getTaskById(taskId);
                
                if (!task) {
                    return res.status(404).json({
                        success: false,
                        error: '任务不存在',
                        message: `推送任务 ${taskId} 不存在`
                    });
                }

                res.json({
                    success: true,
                    data: task
                });

            } catch (error) {
                logger.error('查询推送状态失败:', error);
                res.status(500).json({
                    success: false,
                    error: '服务器内部错误',
                    message: error.message
                });
            }
        });

        // 取消推送任务
        this.app.post('/api/push/:id/cancel', async (req, res) => {
            try {
                // 验证API密钥
                if (!this.validateApiKey(req)) {
                    return res.status(401).json({
                        success: false,
                        error: '未授权访问',
                        message: 'API密钥无效'
                    });
                }

                const taskId = req.params.id;
                
                if (this.runningTasks.has(taskId)) {
                    const task = this.runningTasks.get(taskId);
                    task.status = 'cancelled';
                    task.updateTime = new Date().toISOString();
                    
                    // 保存到历史记录
                    await this.pushHistory.updateTask(task);
                    
                    // 从运行中的任务中移除
                    this.runningTasks.delete(taskId);

                    res.json({
                        success: true,
                        message: '推送任务已取消',
                        taskId: taskId
                    });
                } else {
                    res.status(404).json({
                        success: false,
                        error: '任务不存在或已完成',
                        message: `推送任务 ${taskId} 不存在或已完成`
                    });
                }

            } catch (error) {
                logger.error('取消推送任务失败:', error);
                res.status(500).json({
                    success: false,
                    error: '服务器内部错误',
                    message: error.message
                });
            }
        });
    }

    /**
     * 验证API密钥
     * @param {Object} req 请求对象
     * @returns {boolean} 是否验证通过
     */
    validateApiKey(req) {
        const apiKey = req.get('X-API-Key') || req.query.apiKey;
        const expectedKey = process.env.API_KEY || 'default_api_key';
        
        if (!apiKey || apiKey !== expectedKey) {
            logger.warn('API密钥验证失败:', {
                receivedKey: apiKey ? '***' : 'undefined',
                ip: req.ip
            });
            return false;
        }
        
        return true;
    }

    /**
     * 执行推送任务
     * @param {string} taskId 任务ID
     * @param {Object} pushParams 推送参数
     */
    async executePushTask(taskId, pushParams) {
        try {
            logger.info(`开始执行推送任务: ${taskId}`, pushParams);
            
            // 更新任务状态为运行中
            const task = this.runningTasks.get(taskId);
            task.status = 'running';
            task.updateTime = new Date().toISOString();
            await this.pushHistory.updateTask(task);

            // 执行推送
            const result = await this.autoPushApp.run();
            
            // 更新任务状态为成功
            task.status = 'completed';
            task.result = result;
            task.updateTime = new Date().toISOString();
            
            // 保存到历史记录
            await this.pushHistory.updateTask(task);
            
            // 从运行中的任务中移除
            this.runningTasks.delete(taskId);
            
            logger.info(`推送任务完成: ${taskId}`, result);
            
        } catch (error) {
            logger.error(`推送任务失败: ${taskId}`, error);
            
            // 更新任务状态为失败
            if (this.runningTasks.has(taskId)) {
                const task = this.runningTasks.get(taskId);
                task.status = 'failed';
                task.result = {
                    success: false,
                    error: error.message
                };
                task.updateTime = new Date().toISOString();
                
                // 保存到历史记录
                await this.pushHistory.updateTask(task);
                
                // 从运行中的任务中移除
                this.runningTasks.delete(taskId);
            }
        }
    }

    /**
     * 启动HTTP服务
     * @returns {Promise<void>}
     */
    async start() {
        return new Promise((resolve, reject) => {
            this.server = this.app.listen(this.port, () => {
                logger.info(`HTTP服务已启动，监听端口: ${this.port}`);
                resolve();
            }).on('error', (error) => {
                logger.error('HTTP服务启动失败:', error);
                reject(error);
            });
        });
    }

    /**
     * 停止HTTP服务
     * @returns {Promise<void>}
     */
    async stop() {
        if (this.server) {
            return new Promise((resolve, reject) => {
                this.server.close((error) => {
                    if (error) {
                        logger.error('HTTP服务停止失败:', error);
                        reject(error);
                    } else {
                        logger.info('HTTP服务已停止');
                        resolve();
                    }
                });
            });
        }
    }
}

module.exports = HttpServer;
