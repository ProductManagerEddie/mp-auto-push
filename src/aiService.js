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
     * @param {string} newsContent 新闻内容
     * @returns {Promise<string>} 生成的文章内容
     */
    async generateArticle(newsContent) {
        try {
            console.log('正在调用元宝AI生成文章...');
            
            const prompt = `请根据以下新闻内容，生成一篇适合微信公众号发布的文章。要求：
1. 标题要吸引人，简洁明了
2. 内容要有条理，分段清晰
3. 语言要生动有趣，适合大众阅读
4. 可以适当添加一些评论和观点
5. 文章结构要完整，包含开头、正文和结尾
6. 字数控制在800-1500字之间

新闻内容：
${newsContent}`;

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