const fs = require('fs');
const path = require('path');
const { monitorLogger } = require('./logger');

/**
 * 监控与告警服务
 */
class Monitor {
    constructor() {
        this.errorCount = 0;
        this.lastAlertTime = 0;
        this.alertCooldown = 3600000; // 1小时告警冷却时间
        this.alertThreshold = 3; // 错误告警阈值
        this.status = {
            lastCrawlTime: null,
            lastPushTime: null,
            crawlSuccess: 0,
            crawlFailed: 0,
            pushSuccess: 0,
            pushFailed: 0,
            lastError: null
        };
        
        // 监控配置
        this.config = {
            enableAlert: process.env.ENABLE_ALERT === 'true' || false,
            alertWebhook: process.env.ALERT_WEBHOOK || null,
            alertEmail: process.env.ALERT_EMAIL || null,
            logFile: path.join(__dirname, '../logs/monitor.log')
        };
        
        // 初始化监控日志
        this.initMonitorLog();
    }
    
    /**
     * 初始化监控日志
     */
    initMonitorLog() {
        const logDir = path.dirname(this.config.logFile);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
        
        // 写入初始化日志
        this.writeMonitorLog('info', '监控服务初始化完成', {
            config: this.config,
            timestamp: new Date().toISOString()
        });
    }
    
    /**
     * 写入监控日志
     * @param {string} level 日志级别
     * @param {string} message 日志消息
     * @param {Object} data 附加数据
     */
    writeMonitorLog(level, message, data = {}) {
        const logEntry = {
            level,
            message,
            data,
            timestamp: new Date().toISOString()
        };
        
        // 写入文件
        const logString = JSON.stringify(logEntry) + '\n';
        fs.appendFileSync(this.config.logFile, logString, 'utf8');
        
        // 同时输出到控制台
        const logMethod = monitorLogger[level] || monitorLogger.info;
        logMethod(message, data);
    }
    
    /**
     * 更新爬取状态
     * @param {Object} crawlResult 爬取结果
     */
    updateCrawlStatus(crawlResult) {
        this.status.lastCrawlTime = new Date();
        this.status.crawlSuccess = crawlResult.success;
        this.status.crawlFailed = crawlResult.failed;
        
        this.writeMonitorLog('info', '爬取任务完成', {
            result: crawlResult,
            status: this.status
        });
        
        // 检查是否需要告警
        if (crawlResult.failed > 0) {
            this.handleError('crawl', `爬取失败，${crawlResult.failed}个类型失败`, crawlResult);
        }
    }
    
    /**
     * 更新推送状态
     * @param {Object} pushResult 推送结果
     */
    updatePushStatus(pushResult) {
        this.status.lastPushTime = new Date();
        
        if (pushResult.success) {
            this.status.pushSuccess++;
        } else {
            this.status.pushFailed++;
        }
        
        this.writeMonitorLog('info', '推送任务完成', {
            result: pushResult,
            status: this.status
        });
        
        // 检查是否需要告警
        if (!pushResult.success) {
            this.handleError('push', '推送失败', pushResult);
        }
    }
    
    /**
     * 处理错误
     * @param {string} type 错误类型
     * @param {string} message 错误消息
     * @param {Object} errorData 错误数据
     */
    handleError(type, message, errorData) {
        this.errorCount++;
        this.status.lastError = {
            type,
            message,
            timestamp: new Date(),
            data: errorData
        };
        
        this.writeMonitorLog('error', message, {
            error: this.status.lastError,
            errorCount: this.errorCount
        });
        
        // 检查是否需要发送告警
        this.checkAndSendAlert(type, message, errorData);
    }
    
    /**
     * 检查并发送告警
     * @param {string} type 错误类型
     * @param {string} message 错误消息
     * @param {Object} errorData 错误数据
     */
    checkAndSendAlert(type, message, errorData) {
        // 检查是否启用告警
        if (!this.config.enableAlert) {
            this.writeMonitorLog('info', '告警功能未启用，跳过发送告警');
            return;
        }
        
        // 检查告警冷却时间
        const now = Date.now();
        if (now - this.lastAlertTime < this.alertCooldown) {
            this.writeMonitorLog('info', '告警冷却中，跳过发送告警');
            return;
        }
        
        // 检查错误数量是否达到阈值
        if (this.errorCount < this.alertThreshold) {
            this.writeMonitorLog('info', `错误数量未达到阈值(${this.errorCount}/${this.alertThreshold})，跳过发送告警`);
            return;
        }
        
        // 发送告警
        this.sendAlert(type, message, errorData);
        
        // 更新告警时间和重置错误计数
        this.lastAlertTime = now;
        this.errorCount = 0;
    }
    
    /**
     * 发送告警
     * @param {string} type 错误类型
     * @param {string} message 错误消息
     * @param {Object} errorData 错误数据
     */
    async sendAlert(type, message, errorData) {
        this.writeMonitorLog('info', '开始发送告警', {
            type,
            message,
            config: this.config
        });
        
        try {
            // 支持多种告警方式
            const alertMethods = [];
            
            // Webhook告警
            if (this.config.alertWebhook) {
                alertMethods.push(this.sendWebhookAlert(type, message, errorData));
            }
            
            // 邮件告警（待实现）
            if (this.config.alertEmail) {
                this.writeMonitorLog('warn', '邮件告警功能尚未实现');
            }
            
            // 等待所有告警发送完成
            await Promise.all(alertMethods);
            
            this.writeMonitorLog('info', '告警发送成功');
        } catch (error) {
            this.writeMonitorLog('error', '告警发送失败', {
                error: error.message
            });
        }
    }
    
    /**
     * 发送Webhook告警
     * @param {string} type 错误类型
     * @param {string} message 错误消息
     * @param {Object} errorData 错误数据
     */
    async sendWebhookAlert(type, message, errorData) {
        const axios = require('axios');
        
        const alertData = {
            title: `彩票推送服务告警 - ${type.toUpperCase()} ERROR`,
            message: message,
            type: type,
            timestamp: new Date().toISOString(),
            errorCount: this.errorCount,
            status: this.status,
            errorData: errorData
        };
        
        await axios.post(this.config.alertWebhook, alertData, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });
    }
    
    /**
     * 获取当前监控状态
     * @returns {Object} 监控状态
     */
    getStatus() {
        return {
            ...this.status,
            errorCount: this.errorCount,
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage(),
            timestamp: new Date().toISOString()
        };
    }
    
    /**
     * 重置监控状态
     */
    resetStatus() {
        this.status = {
            lastCrawlTime: this.status.lastCrawlTime,
            lastPushTime: this.status.lastPushTime,
            crawlSuccess: 0,
            crawlFailed: 0,
            pushSuccess: 0,
            pushFailed: 0,
            lastError: null
        };
        
        this.errorCount = 0;
        
        this.writeMonitorLog('info', '监控状态已重置');
    }
    
    /**
     * 健康检查
     * @returns {Object} 健康检查结果
     */
    healthCheck() {
        const status = this.getStatus();
        const now = Date.now();
        
        // 检查最近是否有活动
        const isActive = 
            status.lastCrawlTime && (now - status.lastCrawlTime.getTime() < 24 * 60 * 60 * 1000) ||
            status.lastPushTime && (now - status.lastPushTime.getTime() < 24 * 60 * 60 * 1000);
        
        // 检查是否有未修复的错误
        const hasError = status.lastError !== null;
        
        return {
            status: isActive && !hasError ? 'healthy' : 'unhealthy',
            active: isActive,
            hasError: hasError,
            ...status
        };
    }
}

// 导出单例实例
let monitorInstance = null;

function getMonitor() {
    if (!monitorInstance) {
        monitorInstance = new Monitor();
    }
    return monitorInstance;
}

module.exports = {
    Monitor,
    getMonitor
};
