#!/usr/bin/env node

require('dotenv').config();
const HttpServer = require('./httpServer');
const { logger } = require('./logger');
const { v4: uuidv4 } = require('uuid');

/**
 * 手动触发推送服务启动入口
 */
class Server {
    constructor() {
        this.httpServer = null;
        this.processId = process.pid;
        this.startTime = new Date();
    }

    /**
     * 启动服务
     */
    async start() {
        try {
            logger.info('=== 微信公众号自动推送服务启动 ===');
            logger.info(`进程ID: ${this.processId}`);
            logger.info(`Node.js版本: ${process.version}`);
            logger.info(`工作目录: ${process.cwd()}`);
            logger.info(`环境: ${process.env.NODE_ENV || 'production'}`);
            logger.info(`服务ID: ${uuidv4()}`);
            
            // 初始化HTTP服务器
            this.httpServer = new HttpServer();
            
            // 启动HTTP服务
            await this.httpServer.start();
            
            // 设置信号处理
            this.setupSignalHandlers();
            
            // 设置未捕获异常处理
            this.setupErrorHandlers();
            
            logger.info('=== 微信公众号自动推送服务启动完成 ===');
            
        } catch (error) {
            logger.error('服务启动失败:', error);
            process.exit(1);
        }
    }

    /**
     * 设置信号处理器
     */
    setupSignalHandlers() {
        // 优雅关闭信号
        process.on('SIGTERM', async () => {
            logger.info('收到SIGTERM信号，开始优雅关闭...');
            await this.stop();
        });

        process.on('SIGINT', async () => {
            logger.info('收到SIGINT信号，开始优雅关闭...');
            await this.stop();
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
     * 停止服务
     */
    async stop() {
        try {
            logger.info('开始关闭服务...');
            
            if (this.httpServer) {
                await this.httpServer.stop();
            }
            
            logger.info('服务已安全关闭');
            logger.info(`服务运行时间: ${Math.floor((Date.now() - this.startTime.getTime()) / 1000)}秒`);
            process.exit(0);
            
        } catch (error) {
            logger.error('关闭服务时发生错误:', error);
            process.exit(1);
        }
    }
}

// 如果直接运行此文件
if (require.main === module) {
    const server = new Server();
    server.start().catch(error => {
        logger.error('服务启动失败:', error);
        process.exit(1);
    });
}

module.exports = Server;
