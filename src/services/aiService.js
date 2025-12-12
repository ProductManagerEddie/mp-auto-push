const axios = require('axios');

/**
 * 智谱AI服务
 */
class AIService {
    constructor() {
        // 智谱AI标准聊天接口
        this.apiUrl = process.env.ZHIPU_API_URL || 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
        this.token = process.env.ZHIPU_API_KEY || 'your_zhipu_api_key_here';
        this.model = process.env.ZHIPU_MODEL || 'glm-4-flash'; // 默认使用glm-4-flash模型
    }

    /**
     * 生成公众号文章
     * @param {string} lotteryContent 彩票内容
     * @param {string} lotteryType 彩票类型（ssq, kl8, qlc, 3d）
     * @returns {Promise<string>} 生成的文章内容
     */
    async generateArticle(lotteryContent, lotteryType = 'ssq') {
        const startTime = Date.now();
        console.log(`正在调用智谱AI生成${lotteryType}文章...`);
        
        try {
            // 彩票类型映射
            const lotteryTypeNameMap = {
                'ssq': '双色球',
                'kl8': '快乐8',
                'qlc': '七乐彩',
                '3d': '福彩3D'
            };
            
            const lotteryTypeName = lotteryTypeNameMap[lotteryType] || '彩票';
            
            // 系统提示
            const systemPrompt = `你是一个专业的彩票分析员，擅长撰写彩票开奖信息分析文章。`;
            
            // 用户请求
            const userPrompt = `请根据以下${lotteryTypeName}开奖数据，生成一篇适合微信公众号发布的${lotteryTypeName}分析文章。要求：
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

            // 智谱AI标准聊天接口请求格式
            const requestData = {
                model: this.model,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                temperature: 0.7,
                top_p: 0.95,
                max_tokens: 1000,
                stream: false
            };

            const response = await axios.post(this.apiUrl, requestData, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                timeout: 60000
            });

            const endTime = Date.now();
            console.log(`智谱AI调用成功，耗时${endTime - startTime}ms`);
            
            // 智谱AI标准聊天接口响应解析
            if (response.data && response.data.choices && Array.isArray(response.data.choices) && response.data.choices.length > 0) {
                const firstChoice = response.data.choices[0];
                if (firstChoice.message && firstChoice.message.content) {
                    console.log('文章生成成功，内容长度:', firstChoice.message.content.length, '字符');
                    return firstChoice.message.content;
                }
            }
            
            // 处理错误响应
            const errorMsg = response.data?.error?.message || response.data?.message || 'AI返回数据格式错误';
            console.error('智谱AI响应错误:', JSON.stringify(response.data, null, 2));
            throw new Error(`AI返回数据错误: ${errorMsg}`);
        } catch (error) {
            const endTime = Date.now();
            console.error(`生成文章失败，耗时${endTime - startTime}ms:`, error.message);
            if (error.response) {
                console.error('API响应错误详情:', JSON.stringify(error.response.data, null, 2));
                console.error('API响应状态:', error.response.status);
                console.error('API响应头:', JSON.stringify(error.response.headers, null, 2));
            } else if (error.request) {
                console.error('API请求未收到响应:', error.request);
            } else {
                console.error('API请求配置错误:', error.message);
            }
            
            // 抛出详细错误，包含更多上下文信息
            throw new Error(`智谱AI生成文章失败 [${lotteryType}]: ${error.message}`);
        }
    }

    /**
     * 设置模型名称
     * @param {string} model 智谱AI模型名称
     */
    setModel(model) {
        this.model = model;
    }

    /**
     * 设置API URL
     * @param {string} apiUrl 智谱AI API URL
     */
    setApiUrl(apiUrl) {
        this.apiUrl = apiUrl;
    }

    /**
     * 设置API Key
     * @param {string} apiKey 智谱AI API Key
     */
    setToken(apiKey) {
        this.token = apiKey;
    }

    /**
     * 设置API Key（别名，保持向后兼容）
     * @param {string} apiKey 智谱AI API Key
     */
    setApiKey(apiKey) {
        this.token = apiKey;
    }


}

module.exports = AIService;