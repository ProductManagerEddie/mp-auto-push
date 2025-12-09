const cron = require('node-cron');
const { scheduleLogger } = require('./logger');
const AutoPushApp = require('./index');
const { getMonitor } = require('./monitor');

/**
 * 定时任务调度器
 */
class Scheduler {
    constructor() {
        this.tasks = new Map();
        this.isRunning = false;
        this.startTime = null;
        this.app = new AutoPushApp({ serviceMode: true });
    }

    /**
     * 启动定时任务
     */
    start() {
        if (this.isRunning) {
            scheduleLogger.warn('调度器已经在运行中');
            return;
        }

        scheduleLogger.info('启动定时任务调度器');
        
        // 每天10:00执行彩票数据爬取任务
        const crawlTask = cron.schedule('0 10 * * *', async () => {
            await this.executeCrawlTask();
        }, {
            scheduled: false,
            timezone: process.env.TIMEZONE || 'Asia/Shanghai'
        });

        // 每天10:30执行推送任务
        const dailyTask = cron.schedule('30 10 * * *', async () => {
            await this.executePushTask();
        }, {
            scheduled: false,
            timezone: process.env.TIMEZONE || 'Asia/Shanghai'
        });

        // 测试任务：每分钟执行一次（仅在开发模式下）
        let testTask = null;
        if (process.env.NODE_ENV === 'development') {
            testTask = cron.schedule('*/1 * * * *', async () => {
                scheduleLogger.info('执行测试任务（开发模式）');
                await this.executePushTask();
            }, {
                scheduled: false,
                timezone: process.env.TIMEZONE || 'Asia/Shanghai'
            });
        }

        // 健康检查任务：每小时执行一次
        const healthCheckTask = cron.schedule('0 * * * *', () => {
            this.healthCheck();
        }, {
            scheduled: false,
            timezone: process.env.TIMEZONE || 'Asia/Shanghai'
        });

        // 启动任务
        crawlTask.start();
        dailyTask.start();
        healthCheckTask.start();
        
        if (testTask) {
            testTask.start();
            this.tasks.set('test', testTask);
            scheduleLogger.info('测试任务已启动（开发模式）');
        }

        this.tasks.set('crawl', crawlTask);
        this.tasks.set('daily', dailyTask);
        this.tasks.set('health', healthCheckTask);
        
        this.isRunning = true;
        
        scheduleLogger.info('定时任务已启动:');
        scheduleLogger.info('- 彩票数据爬取: 每天10:00');
        scheduleLogger.info('- 每日推送: 每天10:30');
        scheduleLogger.info('- 健康检查: 每小时');
        if (process.env.NODE_ENV === 'development') {
            scheduleLogger.info('- 测试任务: 每分钟（开发模式）');
        }
    }

    /**
     * 停止定时任务
     */
    stop() {
        if (!this.isRunning) {
            scheduleLogger.warn('调度器未在运行');
            return;
        }

        scheduleLogger.info('停止定时任务调度器');
        
        this.tasks.forEach((task, name) => {
            task.stop();
            scheduleLogger.info(`已停止任务: ${name}`);
        });
        
        this.tasks.clear();
        this.isRunning = false;
        
        scheduleLogger.info('所有定时任务已停止');
    }

    /**
     * 执行彩票数据爬取任务
     */
    async executeCrawlTask() {
        scheduleLogger.info('开始执行彩票数据爬取任务');
        
        try {
            // 支持的彩票类型
            const lotteryTypes = ['ssq', 'kl8', 'qlc', '3d'];
            const lotteryTypeNameMap = {
                'ssq': '双色球',
                'kl8': '快乐8',
                'qlc': '七乐彩',
                '3d': '福彩3D'
            };
            
            scheduleLogger.info(`爬取以下彩票类型数据: ${lotteryTypes.map(type => lotteryTypeNameMap[type]).join(', ')}`);
            
            // 记录爬取结果
            const crawlResults = {
                success: 0,
                failed: 0,
                details: {}
            };
            
            // 爬取每种彩票类型的数据
            for (const type of lotteryTypes) {
                scheduleLogger.info(`爬取${lotteryTypeNameMap[type]}数据...`);
                
                try {
                    // 调用彩票服务的爬取方法
                    const lotteryData = await this.app.lotteryService.getLatestLotteryData(type, 10);
                    
                    // 数据验证
                    if (lotteryData && lotteryData.length > 0) {
                        scheduleLogger.info(`成功爬取${lotteryTypeNameMap[type]}数据，共${lotteryData.length}条记录`);
                        crawlResults.success++;
                        crawlResults.details[type] = {
                            status: 'success',
                            count: lotteryData.length,
                            latestIssue: lotteryData[0].issue,
                            latestDate: lotteryData[0].draw_date
                        };
                    } else {
                        scheduleLogger.warn(`${lotteryTypeNameMap[type]}数据为空或无效`);
                        crawlResults.failed++;
                        crawlResults.details[type] = {
                            status: 'empty',
                            count: 0
                        };
                    }
                } catch (error) {
                    scheduleLogger.error(`爬取${lotteryTypeNameMap[type]}数据失败:`, error.message);
                    crawlResults.failed++;
                    crawlResults.details[type] = {
                        status: 'error',
                        message: error.message
                    };
                }
            }
            
            // 记录完整的爬取结果
            scheduleLogger.info('彩票数据爬取任务执行完成', crawlResults);
            
            // 更新监控状态
            const monitor = getMonitor();
            monitor.updateCrawlStatus(crawlResults);
            
            // 如果有失败，发送告警
            if (crawlResults.failed > 0) {
                scheduleLogger.error('部分彩票数据爬取失败，需要检查', {
                    failedCount: crawlResults.failed,
                    successCount: crawlResults.success,
                    totalCount: lotteryTypes.length
                });
            }
            
            return crawlResults;
            
        } catch (error) {
            scheduleLogger.error('彩票数据爬取任务异常:', error);
            return {
                success: 0,
                failed: 4,
                details: {
                    error: error.message
                }
            };
        }
    }
    
    /**
     * 执行推送任务
     */
    async executePushTask() {
        scheduleLogger.info('开始执行定时推送任务');
        
        try {
            const result = await this.app.run();
            
            // 更新监控状态
            const monitor = getMonitor();
            monitor.updatePushStatus(result);
            
            if (result.success) {
                scheduleLogger.info('定时推送任务执行成功', {
                    title: result.title,
                    mediaId: result.mediaId || '本地保存',
                    timestamp: new Date().toISOString()
                });
            } else {
                scheduleLogger.error('定时推送任务执行失败', result);
            }
            
            return result;
            
        } catch (error) {
            scheduleLogger.error('定时推送任务异常:', error);
            throw error;
        }
    }

    /**
     * 手动执行推送任务
     */
    async runNow() {
        scheduleLogger.info('手动触发推送任务');
        return await this.executePushTask();
    }

    /**
     * 健康检查
     */
    healthCheck() {
        const memoryUsage = process.memoryUsage();
        const uptime = process.uptime();
        
        scheduleLogger.info('系统健康检查:');
        scheduleLogger.info(`- 运行时间: ${Math.floor(uptime / 3600)}小时${Math.floor((uptime % 3600) / 60)}分钟`);
        scheduleLogger.info(`- 内存使用: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`);
        scheduleLogger.info(`- 活跃任务数: ${this.tasks.size}`);
        scheduleLogger.info(`- 调度器状态: ${this.isRunning ? '运行中' : '已停止'}`);
    }

    /**
     * 获取任务状态
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            taskCount: this.tasks.size,
            tasks: Array.from(this.tasks.keys()),
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage()
        };
    }

    /**
     * 添加自定义定时任务
     * @param {string} name 任务名称
     * @param {string} cronExpression cron表达式
     * @param {Function} taskFunction 任务函数
     */
    addTask(name, cronExpression, taskFunction) {
        if (this.tasks.has(name)) {
            scheduleLogger.warn(`任务 ${name} 已存在，将被替换`);
            this.tasks.get(name).stop();
        }

        const task = cron.schedule(cronExpression, taskFunction, {
            scheduled: false,
            timezone: process.env.TIMEZONE || 'Asia/Shanghai'
        });

        this.tasks.set(name, task);
        
        if (this.isRunning) {
            task.start();
            scheduleLogger.info(`已添加并启动任务: ${name} (${cronExpression})`);
        } else {
            scheduleLogger.info(`已添加任务: ${name} (${cronExpression})，等待调度器启动`);
        }
    }

    /**
     * 移除任务
     * @param {string} name 任务名称
     */
    removeTask(name) {
        if (this.tasks.has(name)) {
            this.tasks.get(name).stop();
            this.tasks.delete(name);
            scheduleLogger.info(`已移除任务: ${name}`);
        } else {
            scheduleLogger.warn(`任务 ${name} 不存在`);
        }
    }
}

module.exports = Scheduler;