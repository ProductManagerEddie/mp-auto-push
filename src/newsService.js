const axios = require('axios');

/**
 * 获取60s新闻服务
 */
class NewsService {
    constructor() {
        this.apiUrl = 'http://localhost:4399/v2/60s';
    }

    /**
     * 获取最新新闻
     * @returns {Promise<Object>} 新闻数据
     */
    async getLatestNews() {
        try {
            console.log('正在获取最新新闻...');
            const response = await axios.get(this.apiUrl, {
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            if (response.data && response.data.code === 200) {
                console.log(`成功获取新闻，日期: ${response.data.data.date}`);
                return response.data.data;
            } else {
                throw new Error(`API返回数据格式错误: ${JSON.stringify(response.data)}`);
            }
        } catch (error) {
            // 详细的错误信息
            let errorMessage = '获取新闻失败: ';
            
            if (error.code === 'ECONNABORTED') {
                errorMessage += '请求超时 (10秒)';
            } else if (error.code === 'ENOTFOUND') {
                errorMessage += '域名解析失败，请检查网络连接';
            } else if (error.code === 'ECONNREFUSED') {
                errorMessage += '连接被拒绝，服务器可能不可用';
            } else if (error.code === 'ETIMEDOUT') {
                errorMessage += '连接超时，网络可能不稳定';
            } else if (error.response) {
                errorMessage += `HTTP ${error.response.status} - ${error.response.statusText}`;
            } else {
                errorMessage += error.message;
            }
            
            console.error(errorMessage);
            console.error('错误详情:', {
                code: error.code,
                message: error.message,
                url: this.apiUrl,
                timeout: '10000ms'
            });
            
            // 返回模拟数据以便测试其他功能
            console.log('🔄 网络异常，返回模拟新闻数据用于测试...');
            return this.getMockNewsData();
        }
    }

    /**
     * 获取模拟新闻数据（用于网络异常时的测试）
     * @returns {Object} 模拟新闻数据
     */
    getMockNewsData() {
        const today = new Date();
        const dateStr = today.toISOString().split('T')[0];
        
        return {
            date: dateStr,
            day_of_week: '星期' + ['日', '一', '二', '三', '四', '五', '六'][today.getDay()],
            lunar_date: '农历测试',
            news: [
                '【模拟新闻】这是一条模拟新闻，用于测试系统功能',
                '【模拟新闻】当前网络连接异常，无法获取实时新闻',
                '【模拟新闻】系统正在使用备用数据确保服务正常运行',
                '【模拟新闻】请检查网络连接或稍后重试',
                '【模拟新闻】感谢您的理解与支持'
            ],
            tip: '网络异常时的温馨提示：请保持耐心，我们正在努力恢复服务',
            image: '',
            cover: '',
            link: ''
        };
    }

    /**
     * 格式化新闻数据为文本
     * @param {Object} newsData 新闻数据
     * @returns {string} 格式化后的新闻文本
     */
    formatNewsForAI(newsData) {
        const { date, news, tip, day_of_week, lunar_date } = newsData;
        
        let formattedText = `今日新闻摘要 (${date} ${day_of_week} ${lunar_date})\n\n`;
        
        news.forEach((item, index) => {
            formattedText += `${index + 1}. ${item}\n`;
        });
        
        if (tip) {
            formattedText += `\n今日寄语：${tip}`;
        }
        
        return formattedText;
    }
}

module.exports = NewsService;