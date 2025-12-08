const axios = require('axios');

/**
 * 彩票数据服务
 */
class LotteryService {
    constructor() {
        // 默认使用本地彩票API，可通过环境变量配置
        this.apiUrl = process.env.LOTTERY_API_URL || 'http://localhost:5000';
        this.timeout = parseInt(process.env.LOTTERY_API_TIMEOUT) || 10000;
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
            
            const response = await axios.get(`${this.apiUrl}/api/lottery/${type}/latest`, {
                params: { limit },
                timeout: this.timeout
            });

            if (response.data && response.data.success && response.data.data) {
                console.log(`成功获取${response.data.data.length}条${type}彩票数据`);
                return response.data.data;
            } else {
                throw new Error('彩票API返回数据格式错误');
            }
        } catch (error) {
            console.error('获取彩票数据失败:', error.message);
            
            // 如果API调用失败，返回模拟数据
            console.log('使用模拟彩票数据...');
            return this.getMockLotteryData(type, limit);
        }
    }

    /**
     * 获取彩票历史数据
     * @param {string} type 彩票类型，默认为双色球(ssq)
     * @param {number} page 页码，默认为1
     * @param {number} limit 每页数量，默认为10
     * @returns {Promise<Object>} 彩票历史数据
     */
    async getLotteryHistory(type = 'ssq', page = 1, limit = 10) {
        try {
            console.log(`正在获取${type}彩票历史数据...`);
            
            const response = await axios.get(`${this.apiUrl}/api/lottery/${type}/history`, {
                params: { page, limit },
                timeout: this.timeout
            });

            if (response.data && response.data.success && response.data.data) {
                console.log(`成功获取${response.data.data.length}条${type}彩票历史数据`);
                return response.data.data;
            } else {
                throw new Error('彩票API返回数据格式错误');
            }
        } catch (error) {
            console.error('获取彩票历史数据失败:', error.message);
            
            // 如果API调用失败，返回模拟数据
            console.log('使用模拟彩票历史数据...');
            return this.getMockLotteryData(type, limit);
        }
    }

    /**
     * 获取彩票统计数据
     * @param {string} type 彩票类型，默认为双色球(ssq)
     * @returns {Promise<Object>} 彩票统计数据
     */
    async getLotteryStats(type = 'ssq') {
        try {
            console.log(`正在获取${type}彩票统计数据...`);
            
            const response = await axios.get(`${this.apiUrl}/api/lottery/${type}/stats`, {
                timeout: this.timeout
            });

            if (response.data && response.data.success && response.data.data) {
                console.log(`成功获取${type}彩票统计数据`);
                return response.data.data;
            } else {
                throw new Error('彩票API返回数据格式错误');
            }
        } catch (error) {
            console.error('获取彩票统计数据失败:', error.message);
            
            // 如果API调用失败，返回模拟数据
            console.log('使用模拟彩票统计数据...');
            return this.getMockLotteryStats(type);
        }
    }

    /**
     * 获取所有支持的彩票类型
     * @returns {Promise<Array>} 彩票类型列表
     */
    async getLotteryTypes() {
        try {
            console.log('正在获取彩票类型列表...');
            
            const response = await axios.get(`${this.apiUrl}/api/lottery/types`, {
                timeout: this.timeout
            });

            if (response.data && response.data.success && response.data.data) {
                console.log(`成功获取${response.data.data.length}种彩票类型`);
                return response.data.data;
            } else {
                throw new Error('彩票API返回数据格式错误');
            }
        } catch (error) {
            console.error('获取彩票类型失败:', error.message);
            
            // 如果API调用失败，返回模拟数据
            console.log('使用模拟彩票类型数据...');
            return this.getMockLotteryTypes();
        }
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
        
        if (latest.sales) {
            formattedText += `销售额：${latest.sales}元\n`;
        }
        
        if (latest.pool_money) {
            formattedText += `奖池金额：${latest.pool_money}元\n`;
        }
        
        if (latest.first_prize_count > 0) {
            formattedText += `一等奖：${latest.first_prize_count}注，每注${latest.first_prize_amount}元\n`;
        }
        
        if (latest.second_prize_count > 0) {
            formattedText += `二等奖：${latest.second_prize_count}注，每注${latest.second_prize_amount}元\n`;
        }
        
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

    /**
     * 生成模拟彩票数据
     * @param {string} type 彩票类型
     * @param {number} count 数据条数
     * @returns {Array} 模拟彩票数据
     */
    getMockLotteryData(type, count) {
        const mockData = [];
        const today = new Date();
        
        for (let i = 0; i < count; i++) {
            const date = new Date(today);
            // 为了测试前一天推送策略，所有彩票类型都使用1天间隔
            // 实际生产环境中可以恢复为不同类型的开奖间隔
            const drawInterval = 1;
            date.setDate(date.getDate() - i * drawInterval);
            
            // 生成基本数据
            const baseData = {
                issue: `2025${String(140 + i).padStart(3, '0')}`,
                draw_date: date.toISOString().split('T')[0],
                sales: Math.floor(Math.random() * 500000000) + 300000000,
                pool_money: Math.floor(Math.random() * 10000000000) + 8000000000,
                first_prize_count: Math.floor(Math.random() * 10),
                first_prize_amount: Math.floor(Math.random() * 10000000) + 5000000,
                second_prize_count: Math.floor(Math.random() * 50) + 10,
                second_prize_amount: Math.floor(Math.random() * 200000) + 100000
            };
            
            let lotteryData;
            
            // 根据不同彩票类型生成对应的数据
            switch (type) {
                case 'ssq': // 双色球
                    // 生成随机红球号码（1-33，选6个）
                    const redBalls = [];
                    while (redBalls.length < 6) {
                        const num = Math.floor(Math.random() * 33) + 1;
                        if (!redBalls.includes(num)) {
                            redBalls.push(num);
                        }
                    }
                    redBalls.sort((a, b) => a - b);
                    
                    // 生成随机蓝球号码（1-16，选1个）
                    const blueBall = Math.floor(Math.random() * 16) + 1;
                    
                    lotteryData = {
                        ...baseData,
                        red_balls: redBalls.map(n => String(n).padStart(2, '0')),
                        blue_balls: String(blueBall).padStart(2, '0')
                    };
                    break;
                    
                case 'kl8': // 快乐8
                    // 生成随机号码（1-80，选20个）
                    const kl8Balls = [];
                    while (kl8Balls.length < 20) {
                        const num = Math.floor(Math.random() * 80) + 1;
                        if (!kl8Balls.includes(num)) {
                            kl8Balls.push(num);
                        }
                    }
                    kl8Balls.sort((a, b) => a - b);
                    
                    lotteryData = {
                        ...baseData,
                        balls: kl8Balls.map(n => String(n).padStart(2, '0'))
                    };
                    break;
                    
                case 'qlc': // 七乐彩
                    // 生成随机号码（1-30，选7个）
                    const qlcBalls = [];
                    while (qlcBalls.length < 7) {
                        const num = Math.floor(Math.random() * 30) + 1;
                        if (!qlcBalls.includes(num)) {
                            qlcBalls.push(num);
                        }
                    }
                    qlcBalls.sort((a, b) => a - b);
                    
                    // 生成随机特别号码（1-30，选1个）
                    const specialBall = Math.floor(Math.random() * 30) + 1;
                    
                    lotteryData = {
                        ...baseData,
                        balls: qlcBalls.map(n => String(n).padStart(2, '0')),
                        special_ball: String(specialBall).padStart(2, '0')
                    };
                    break;
                    
                case '3d': // 福彩3D
                    // 生成随机百位号码（0-9，选1个）
                    const hundred = Math.floor(Math.random() * 10);
                    // 生成随机十位号码（0-9，选1个）
                    const ten = Math.floor(Math.random() * 10);
                    // 生成随机个位号码（0-9，选1个）
                    const one = Math.floor(Math.random() * 10);
                    
                    const threeDBalls = [hundred, ten, one];
                    
                    lotteryData = {
                        ...baseData,
                        balls: threeDBalls.map(n => String(n)),
                        number: threeDBalls.join('')
                    };
                    break;
                    
                default: // 默认生成双色球数据
                    // 生成随机红球号码（1-33，选6个）
                    const defaultRedBalls = [];
                    while (defaultRedBalls.length < 6) {
                        const num = Math.floor(Math.random() * 33) + 1;
                        if (!defaultRedBalls.includes(num)) {
                            defaultRedBalls.push(num);
                        }
                    }
                    defaultRedBalls.sort((a, b) => a - b);
                    
                    // 生成随机蓝球号码（1-16，选1个）
                    const defaultBlueBall = Math.floor(Math.random() * 16) + 1;
                    
                    lotteryData = {
                        ...baseData,
                        red_balls: defaultRedBalls.map(n => String(n).padStart(2, '0')),
                        blue_balls: String(defaultBlueBall).padStart(2, '0')
                    };
            }
            
            mockData.push(lotteryData);
        }
        
        return mockData;
    }

    /**
     * 生成模拟彩票统计数据
     * @param {string} type 彩票类型
     * @returns {Object} 模拟统计数据
     */
    getMockLotteryStats(type) {
        // 生成随机红球号码（1-33，选6个）
        const redBalls = [];
        while (redBalls.length < 6) {
            const num = Math.floor(Math.random() * 33) + 1;
            if (!redBalls.includes(num)) {
                redBalls.push(num);
            }
        }
        redBalls.sort((a, b) => a - b);
        
        // 生成随机蓝球号码（1-16，选1个）
        const blueBall = Math.floor(Math.random() * 16) + 1;
        
        return {
            total_draws: Math.floor(Math.random() * 1000) + 100,
            latest_red_balls: redBalls.map(n => String(n).padStart(2, '0')),
            latest_blue_balls: String(blueBall).padStart(2, '0')
        };
    }

    /**
     * 生成模拟彩票类型数据
     * @returns {Array} 模拟彩票类型
     */
    getMockLotteryTypes() {
        return [
            { id: 1, name: '双色球', code: 'ssq', description: '双色球彩票' },
            { id: 2, name: '福彩3D', code: '3d', description: '福彩3D彩票' },
            { id: 3, name: '七乐彩', code: 'qlc', description: '七乐彩彩票' },
            { id: 4, name: '快乐8', code: 'kl8', description: '快乐8彩票' }
        ];
    }
}

module.exports = LotteryService;
