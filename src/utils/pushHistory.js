const fs = require('fs').promises;
const path = require('path');
const { logger } = require('./logger');

/**
 * 推送历史记录管理模块
 */
class PushHistory {
    constructor() {
        this.historyDir = path.join(__dirname, '../history');
        this.historyFile = path.join(this.historyDir, 'push_history.json');
        this.initialize();
    }

    /**
     * 初始化历史记录目录和文件
     */
    async initialize() {
        try {
            // 确保历史记录目录存在
            await fs.mkdir(this.historyDir, { recursive: true });
            
            // 检查历史记录文件是否存在，不存在则创建
            try {
                await fs.access(this.historyFile);
            } catch (error) {
                // 文件不存在，创建空的历史记录文件
                await fs.writeFile(this.historyFile, JSON.stringify([], null, 2), 'utf8');
                logger.info('创建推送历史记录文件:', this.historyFile);
            }
        } catch (error) {
            logger.error('初始化推送历史记录失败:', error);
            throw error;
        }
    }

    /**
     * 读取所有历史记录
     * @returns {Promise<Array>} 历史记录数组
     */
    async readHistory() {
        try {
            const data = await fs.readFile(this.historyFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            logger.error('读取推送历史记录失败:', error);
            return [];
        }
    }

    /**
     * 写入历史记录
     * @param {Array} history 历史记录数组
     * @returns {Promise<void>}
     */
    async writeHistory(history) {
        try {
            await fs.writeFile(this.historyFile, JSON.stringify(history, null, 2), 'utf8');
        } catch (error) {
            logger.error('写入推送历史记录失败:', error);
            throw error;
        }
    }

    /**
     * 保存推送任务
     * @param {Object} task 推送任务对象
     * @returns {Promise<void>}
     */
    async saveTask(task) {
        try {
            const history = await this.readHistory();
            history.push(task);
            await this.writeHistory(history);
            logger.info('保存推送任务记录:', task.id);
        } catch (error) {
            logger.error('保存推送任务记录失败:', error);
            throw error;
        }
    }

    /**
     * 更新推送任务
     * @param {Object} updatedTask 更新后的任务对象
     * @returns {Promise<void>}
     */
    async updateTask(updatedTask) {
        try {
            const history = await this.readHistory();
            const taskIndex = history.findIndex(task => task.id === updatedTask.id);
            
            if (taskIndex !== -1) {
                history[taskIndex] = updatedTask;
                await this.writeHistory(history);
                logger.info('更新推送任务记录:', updatedTask.id);
            } else {
                logger.warn('更新推送任务记录失败: 任务不存在', updatedTask.id);
            }
        } catch (error) {
            logger.error('更新推送任务记录失败:', error);
            throw error;
        }
    }

    /**
     * 根据ID查询推送任务
     * @param {string} taskId 任务ID
     * @returns {Promise<Object|null>} 推送任务对象或null
     */
    async getTaskById(taskId) {
        try {
            const history = await this.readHistory();
            return history.find(task => task.id === taskId) || null;
        } catch (error) {
            logger.error('查询推送任务记录失败:', error);
            return null;
        }
    }

    /**
     * 查询推送历史记录
     * @param {Object} options 查询选项
     * @param {number} options.page 页码（默认1）
     * @param {number} options.limit 每页数量（默认10）
     * @param {string} options.status 任务状态（可选，如：pending, running, completed, failed, cancelled）
     * @returns {Promise<Object>} 分页查询结果
     */
    async getHistory(options = {}) {
        try {
            const { page = 1, limit = 10, status } = options;
            const history = await this.readHistory();
            
            // 按状态筛选
            let filteredHistory = history;
            if (status) {
                filteredHistory = history.filter(task => task.status === status);
            }
            
            // 按创建时间倒序排序
            filteredHistory.sort((a, b) => {
                return new Date(b.createTime) - new Date(a.createTime);
            });
            
            // 分页处理
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + limit;
            const paginatedHistory = filteredHistory.slice(startIndex, endIndex);
            
            return {
                total: filteredHistory.length,
                page: page,
                limit: limit,
                pages: Math.ceil(filteredHistory.length / limit),
                data: paginatedHistory
            };
        } catch (error) {
            logger.error('查询推送历史记录失败:', error);
            return {
                total: 0,
                page: options.page || 1,
                limit: options.limit || 10,
                pages: 0,
                data: []
            };
        }
    }

    /**
     * 删除推送任务记录
     * @param {string} taskId 任务ID
     * @returns {Promise<boolean>} 是否删除成功
     */
    async deleteTask(taskId) {
        try {
            const history = await this.readHistory();
            const filteredHistory = history.filter(task => task.id !== taskId);
            
            if (filteredHistory.length !== history.length) {
                await this.writeHistory(filteredHistory);
                logger.info('删除推送任务记录:', taskId);
                return true;
            } else {
                logger.warn('删除推送任务记录失败: 任务不存在', taskId);
                return false;
            }
        } catch (error) {
            logger.error('删除推送任务记录失败:', error);
            return false;
        }
    }

    /**
     * 清理旧的历史记录
     * @param {number} days 保留天数（默认30天）
     * @returns {Promise<number>} 删除的记录数量
     */
    async cleanupOldRecords(days = 30) {
        try {
            const history = await this.readHistory();
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);
            
            const filteredHistory = history.filter(task => {
                const taskDate = new Date(task.createTime);
                return taskDate >= cutoffDate;
            });
            
            const deletedCount = history.length - filteredHistory.length;
            
            if (deletedCount > 0) {
                await this.writeHistory(filteredHistory);
                logger.info(`清理旧的推送任务记录，共删除 ${deletedCount} 条记录`);
            }
            
            return deletedCount;
        } catch (error) {
            logger.error('清理旧的推送任务记录失败:', error);
            return 0;
        }
    }

    /**
     * 获取任务状态统计
     * @returns {Promise<Object>} 状态统计对象
     */
    async getStatusStats() {
        try {
            const history = await this.readHistory();
            const stats = {
                total: history.length,
                pending: 0,
                running: 0,
                completed: 0,
                failed: 0,
                cancelled: 0
            };
            
            history.forEach(task => {
                if (stats.hasOwnProperty(task.status)) {
                    stats[task.status]++;
                }
            });
            
            return stats;
        } catch (error) {
            logger.error('获取推送任务状态统计失败:', error);
            return {
                total: 0,
                pending: 0,
                running: 0,
                completed: 0,
                failed: 0,
                cancelled: 0
            };
        }
    }
}

module.exports = PushHistory;
