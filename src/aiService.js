const axios = require('axios');

/**
 * 元宝AI服务
 */
class AIService {
    constructor() {
        this.apiUrl = 'https://yuanqi.tencent.com/openapi/v1/agent/chat/completions';
        this.assistantId = process.env.YUANBAO_ASSISTANT_ID || 'your_assistant_id_here';
        this.token = process.env.YUANBAO_TOKEN || 'your_yuanbao_token_here';
        this.userId = process.env.YUANBAO_USER_ID || 'user_' + Date.now();
    }

    /**
     * 生成公众号文章
     * @param {string} lotteryContent 彩票内容
     * @param {string} lotteryType 彩票类型（ssq, kl8, qlc, 3d）
     * @returns {Promise<string>} 生成的文章内容
     */
    async generateArticle(lotteryContent, lotteryType = 'ssq') {
        try {
            console.log('正在调用元宝AI生成文章...');
            
            // 彩票类型映射
            const lotteryTypeNameMap = {
                'ssq': '双色球',
                'kl8': '快乐8',
                'qlc': '七乐彩',
                '3d': '福彩3D'
            };
            
            const lotteryTypeName = lotteryTypeNameMap[lotteryType] || '彩票';
            
            const prompt = `请根据以下${lotteryTypeName}开奖数据，生成一篇适合微信公众号发布的${lotteryTypeName}分析文章。要求：
1. 标题要吸引人，简洁明了，包含${lotteryTypeName}和开奖信息
2. 内容要有条理，分段清晰，包含开奖结果、数据分析、趋势解读
3. 语言要生动有趣，适合大众阅读，避免过于专业的术语
4. 可以适当添加一些评论和观点，如号码特点、冷热分析等
5. 文章结构要完整，包含开头、正文和结尾
6. 字数控制在300-500字之间
7. 可以添加一些购彩小贴士或理性购彩提醒
8. 严格按照${lotteryTypeName}的特点和规则进行分析
9. 文章排版要统一，包含标题、正文、分段等

${lotteryTypeName}数据：
${lotteryContent}`;

            const requestData = {
                assistant_id: this.assistantId,
                user_id: this.userId,
                stream: false,
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: prompt
                            }
                        ]
                    }
                ]
            };

            const response = await axios.post(this.apiUrl, requestData, {
                headers: {
                    'X-Source': 'openapi',
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                timeout: 60000
            });

            if (response.data && response.data.choices && response.data.choices.length > 0) {
                const article = response.data.choices[0].message.content;
                console.log('文章生成成功');
                return article;
            } else {
                throw new Error('AI返回数据格式错误');
            }
        } catch (error) {
            console.error('生成文章失败:', error.message);
            if (error.response) {
                console.error('API响应错误:', error.response.data);
            }
            throw error;
        }
    }

    /**
     * 设置用户ID
     * @param {string} userId 用户ID
     */
    setUserId(userId) {
        this.userId = userId;
    }

    /**
     * 设置Token
     * @param {string} token API Token
     */
    setToken(token) {
        this.token = token;
    }
}

module.exports = AIService;