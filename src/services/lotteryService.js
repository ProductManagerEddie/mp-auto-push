const sqlite3 = require('sqlite3').verbose();

/**
 * 彩票数据服务
 */
class LotteryService {
    constructor() {
        // 数据库文件路径，与Python后端保持一致
        this.dbPath = '/Users/eddie/工作空间/05workspace/01project/04mp_auto_push_caipiao/mp-auto-push/python-service/backend/lottery.db';
    }

    /**
     * 获取最新彩票数据
     * @param {string} type 彩票类型，默认为双色球(ssq)
     * @param {number} limit 获取数量，默认为5
     * @returns {Promise<Object>} 彩票数据
     */
    async getLatestLotteryData(type = 'ssq', limit = 5) {
        try {
            console.log(`正在获取${type}彩票数据...`);
            
            // 使用Promise包装sqlite3查询
            const lotteryData = await new Promise((resolve, reject) => {
                const db = new sqlite3.Database(this.dbPath, sqlite3.OPEN_READONLY, (err) => {
                    if (err) {
                        return reject(new Error(`数据库连接失败: ${err.message}`));
                    }
                });

                // 查询彩票类型ID
                db.get('SELECT id FROM lottery_type WHERE code = ?', [type], (err, typeRow) => {
                    if (err) {
                        db.close();
                        return reject(new Error(`查询彩票类型失败: ${err.message}`));
                    }

                    if (!typeRow) {
                        db.close();
                        return reject(new Error(`未找到彩票类型: ${type}`));
                    }

                    const typeId = typeRow.id;

                    // 查询最新的彩票结果
                    const query = `
                        SELECT * FROM lottery_result 
                        WHERE type_id = ? 
                        ORDER BY draw_date DESC, issue DESC 
                        LIMIT ?
                    `;

                    db.all(query, [typeId, limit], (err, rows) => {
                        db.close();

                        if (err) {
                            return reject(new Error(`查询彩票数据失败: ${err.message}`));
                        }

                        // 处理查询结果，将逗号分隔的字符串转换为数组
                        const result = rows.map(row => {
                            const processedRow = {
                                ...row,
                                red_balls: row.red_balls ? row.red_balls.split(',').map(ball => ball.trim()) : [],
                                blue_balls: row.blue_balls ? [row.blue_balls.trim()] : null
                            };

                            // 福彩3D特殊处理
                            if (type === '3d') {
                                processedRow.balls = processedRow.red_balls;
                                processedRow.number = processedRow.red_balls.join('');
                            }
                            // 七乐彩特殊处理
                            else if (type === 'qlc' && processedRow.blue_balls) {
                                processedRow.special_ball = processedRow.blue_balls[0];
                                processedRow.balls = processedRow.red_balls;
                            }
                            // 快乐8特殊处理
                            else if (type === 'kl8') {
                                processedRow.balls = processedRow.red_balls;
                            }

                            return processedRow;
                        });

                        resolve(result);
                    });
                });
            });

            console.log(`成功获取${lotteryData.length}条${type}彩票数据`);
            
            // 数据校验：确保关键字段存在且为真实值
            this.validateLotteryData(lotteryData);
            
            return lotteryData;
        } catch (error) {
            console.error('获取彩票数据失败:', error.message);
            // 不使用模拟数据，直接抛出错误
            throw error;
        }
    }



    /**
     * 验证彩票数据真实性
     * @param {Array} lotteryData 彩票数据数组
     * @throws {Error} 验证失败时抛出错误
     */
    validateLotteryData(lotteryData) {
        if (!Array.isArray(lotteryData) || lotteryData.length === 0) {
            throw new Error('彩票数据不能为空数组');
        }
        
        let validCount = 0;
        
        for (const data of lotteryData) {
            // 检查期号字段
            if (!data.issue || typeof data.issue !== 'string') {
                console.warn('期数字段无效:', data.issue);
                continue;
            }
            
            // 检查开奖日期
            if (!data.draw_date || typeof data.draw_date !== 'string') {
                console.warn('开奖日期字段无效:', data.draw_date);
                continue;
            }
            
            // 检查号码字段
            const hasValidNumbers = 
                (data.red_balls && Array.isArray(data.red_balls) && data.red_balls.length > 0) ||
                (data.balls && Array.isArray(data.balls) && data.balls.length > 0);
            
            if (!hasValidNumbers) {
                console.warn('开奖号码字段无效:', data);
                continue;
            }
            
            // 标记为有效数据
            validCount++;
        }
        
        if (validCount === 0) {
            throw new Error('彩票数据中没有有效的真实数据');
        }
        
        console.log('彩票数据验证通过，共找到', validCount, '条有效真实数据');
    }
    

    
    /**
     * 将彩票数据格式化为适合AI处理的文本
     * @param {Array} lotteryData 彩票数据数组
     * @param {Object} stats 彩票统计数据
     * @returns {string} 格式化后的文本
     */
    formatLotteryForAI(lotteryData, stats = null) {
        if (!lotteryData || lotteryData.length === 0) {
            return '今日暂无彩票数据';
        }

        let formattedText = '最新彩票开奖信息：\n\n';
        
        // 添加最新开奖信息
        const latest = lotteryData[0];
        formattedText += `【${latest.issue}期】开奖结果：\n`;
        formattedText += `开奖日期：${latest.draw_date}\n`;
        
        // 处理不同彩票类型的号码格式
        if (latest.red_balls && latest.red_balls.length > 0) {
            // 双色球 - 红球+蓝球
            formattedText += `红球号码：${latest.red_balls.join(', ')}\n`;
            if (latest.blue_balls) {
                formattedText += `蓝球号码：${latest.blue_balls}\n`;
            }
        } else if (latest.balls && latest.balls.length > 0) {
            // 快乐8、七乐彩、福彩3D - 普通号码
            formattedText += `开奖号码：${latest.balls.join(', ')}\n`;
            // 处理特殊号码（如七乐彩的特别号）
            if (latest.special_ball) {
                formattedText += `特别号码：${latest.special_ball}\n`;
            }
            // 处理福彩3D的数字格式
            if (latest.number) {
                formattedText += `中奖数字：${latest.number}\n`;
            }
        }
        
        // 使用真实数值，不使用任何默认值或占位符
        formattedText += `销售额：${latest.sales}元\n`;
        formattedText += `奖池金额：${latest.pool_money}元\n`;
        formattedText += `一等奖：${latest.first_prize_count}注，每注${latest.first_prize_amount}元\n`;
        formattedText += `二等奖：${latest.second_prize_count}注，每注${latest.second_prize_amount}元\n`;
        
        formattedText += '\n';
        
        // 添加历史开奖信息（最多3期）
        if (lotteryData.length > 1) {
            formattedText += '近期开奖结果：\n';
            const historyCount = Math.min(lotteryData.length - 1, 3);
            
            for (let i = 1; i <= historyCount; i++) {
                const history = lotteryData[i];
                formattedText += `【${history.issue}期】`;
                
                if (history.red_balls && history.red_balls.length > 0) {
                    formattedText += `红球：${history.red_balls.join(', ')}`;
                }
                
                if (history.blue_balls) {
                    formattedText += ` 蓝球：${history.blue_balls}`;
                }
                
                formattedText += '\n';
            }
            
            formattedText += '\n';
        }
        
        // 添加统计数据
        if (stats) {
            formattedText += '彩票统计信息：\n';
            formattedText += `总开奖期数：${stats.total_draws}期\n`;
            
            if (stats.latest_red_balls && stats.latest_red_balls.length > 0) {
                formattedText += `最新红球号码：${stats.latest_red_balls.join(', ')}\n`;
            }
            
            if (stats.latest_blue_balls) {
                formattedText += `最新蓝球号码：${stats.latest_blue_balls}\n`;
            }
        }
        
        return formattedText;
    }


}

module.exports = LotteryService;
