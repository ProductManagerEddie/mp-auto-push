#!/usr/bin/env node

require('dotenv').config();
const Scheduler = require('../scheduler/scheduler');
const { logger } = require('../utils/logger');

/**
 * 后台服务守护进程
 */
class Daemon {
    constructor() {
        this.scheduler = new Scheduler();
        this.isShuttingDown = false;
    }

    /**
     * 启动后台服务
     */
    start() {
        logger.info('=== 微信公众号自动推送后台服务启动 ===');
        logger.info(`进程ID: ${process.pid}`);
        logger.info(`Node.js版本: ${process.version}`);
        logger.info(`工作目录: ${process.cwd()}`);
        logger.info(`环境: ${process.env.NODE_ENV || 'production'}`);
        
        // 设置进程标题
        process.title = 'mp-auto-push-daemon';
        
        // 启动定时任务调度器
        this.scheduler.start();
        
        // 设置信号处理
        this.setupSignalHandlers();
        
        // 设置未捕获异常处理
        this.setupErrorHandlers();
        
        logger.info('后台服务启动完成');
        
        // 输出服务状态
        this.printStatus();
    }

    /**
     * 停止后台服务
     */
    async stop() {
        if (this.isShuttingDown) {
            logger.warn('服务正在关闭中...');
            return;
        }
        
        this.isShuttingDown = true;
        logger.info('开始关闭后台服务...');
        
        try {
            // 停止定时任务调度器
            this.scheduler.stop();
            
            logger.info('后台服务已安全关闭');
            process.exit(0);
        } catch (error) {
            logger.error('关闭服务时发生错误:', error);
            process.exit(1);
        }
    }

    /**
     * 设置信号处理器
     */
    setupSignalHandlers() {
        // 优雅关闭信号
        process.on('SIGTERM', () => {
            logger.info('收到SIGTERM信号，开始优雅关闭...');
            this.stop();
        });

        process.on('SIGINT', () => {
            logger.info('收到SIGINT信号，开始优雅关闭...');
            this.stop();
        });

        // 重启信号
        process.on('SIGUSR2', () => {
            logger.info('收到SIGUSR2信号，重启调度器...');
            this.restart();
        });

        // 状态查询信号
        process.on('SIGUSR1', () => {
            logger.info('收到SIGUSR1信号，输出状态信息...');
            this.printStatus();
        });
    }

    /**
     * 设置错误处理器
     */
    setupErrorHandlers() {
        // 未捕获的异常
        process.on('uncaughtException', (error) => {
            logger.error('未捕获的异常:', error);
            logger.error('进程将退出...');
            process.exit(1);
        });

        // 未处理的Promise拒绝
        process.on('unhandledRejection', (reason, promise) => {
            logger.error('未处理的Promise拒绝:', reason);
            logger.error('Promise:', promise);
        });

        // 警告处理
        process.on('warning', (warning) => {
            logger.warn('Node.js警告:', warning.message);
        });
    }

    /**
     * 重启调度器
     */
    restart() {
        logger.info('重启定时任务调度器...');
        this.scheduler.stop();
        setTimeout(() => {
            this.scheduler.start();
            logger.info('调度器重启完成');
        }, 1000);
    }

    /**
     * 打印服务状态
     */
    printStatus() {
        const status = this.scheduler.getStatus();
        const memoryUsage = process.memoryUsage();
        
        logger.info('=== 服务状态 ===');
        logger.info(`进程ID: ${process.pid}`);
        logger.info(`运行时间: ${Math.floor(status.uptime / 3600)}小时${Math.floor((status.uptime % 3600) / 60)}分钟`);
        logger.info(`调度器状态: ${status.isRunning ? '运行中' : '已停止'}`);
        logger.info(`活跃任务数: ${status.taskCount}`);
        logger.info(`任务列表: ${status.tasks.join(', ')}`);
        logger.info(`内存使用: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB / ${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`);
        logger.info('===============');
    }

    /**
     * 手动执行推送任务
     */
    async runTask() {
        logger.info('手动触发推送任务...');
        const result = await this.scheduler.runNow();
        
        if (result.success) {
            logger.info('手动任务执行成功');
        } else {
            logger.error('手动任务执行失败:', result.error);
        }
        
        return result;
    }
}

// 如果直接运行此文件
if (require.main === module) {
    const daemon = new Daemon();
    
    // 解析命令行参数
    const args = process.argv.slice(2);
    const command = args[0];
    
    switch (command) {
        case 'start':
            daemon.start();
            break;
            
        case 'stop':
            // 发送停止信号给运行中的进程
            const fs = require('fs');
            const path = require('path');
            const pidFile = path.join(__dirname, '../mp-auto-push.pid');
            
            if (fs.existsSync(pidFile)) {
                const pid = fs.readFileSync(pidFile, 'utf8').trim();
                try {
                    process.kill(pid, 'SIGTERM');
                    logger.info(`已发送停止信号给进程 ${pid}`);
                } catch (error) {
                    logger.error('停止进程失败:', error.message);
                }
            } else {
                logger.warn('未找到运行中的进程');
            }
            break;
            
        case 'restart':
            // 发送重启信号
            const fs2 = require('fs');
            const path2 = require('path');
            const pidFile2 = path2.join(__dirname, '../mp-auto-push.pid');
            
            if (fs2.existsSync(pidFile2)) {
                const pid = fs2.readFileSync(pidFile2, 'utf8').trim();
                try {
                    process.kill(pid, 'SIGUSR2');
                    logger.info(`已发送重启信号给进程 ${pid}`);
                } catch (error) {
                    logger.error('重启进程失败:', error.message);
                }
            } else {
                logger.warn('未找到运行中的进程');
            }
            break;
            
        case 'status':
            // 发送状态查询信号
            const fs3 = require('fs');
            const path3 = require('path');
            const pidFile3 = path3.join(__dirname, '../mp-auto-push.pid');
            
            if (fs3.existsSync(pidFile3)) {
                const pid = fs3.readFileSync(pidFile3, 'utf8').trim();
                try {
                    process.kill(pid, 'SIGUSR1');
                    logger.info(`已发送状态查询信号给进程 ${pid}`);
                } catch (error) {
                    logger.error('查询状态失败:', error.message);
                }
            } else {
                logger.warn('未找到运行中的进程');
            }
            break;
            
        case 'run':
            // 手动执行一次推送任务
            daemon.runTask().then(() => {
                process.exit(0);
            }).catch((error) => {
                logger.error('执行任务失败:', error);
                process.exit(1);
            });
            break;
            
        default:
            console.log(`
微信公众号自动推送后台服务

使用方法:
  node src/daemon.js <command>

命令:
  start     启动后台服务
  stop      停止后台服务
  restart   重启调度器
  status    查看服务状态
  run       手动执行一次推送任务

示例:
  node src/daemon.js start
  node src/daemon.js stop
  node src/daemon.js status
            `);
            process.exit(0);
    }
}

module.exports = Daemon;