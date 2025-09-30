const axios = require('axios');
const { marked } = require('marked');

/**
 * 微信公众号服务
 */
class WechatService {
    constructor() {
        this.appId = process.env.WECHAT_APP_ID;
        this.appSecret = process.env.WECHAT_APP_SECRET;
        this.accessToken = null;
        this.tokenExpireTime = 0;
    }

    /**
     * 获取访问令牌
     * @returns {Promise<string>} access_token
     */
    async getAccessToken() {
        try {
            // 检查token是否过期
            if (this.accessToken && Date.now() < this.tokenExpireTime) {
                return this.accessToken;
            }

            console.log('正在获取微信访问令牌...');
            const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${this.appId}&secret=${this.appSecret}`;
            
            const response = await axios.get(url, { timeout: 10000 });
            
            if (response.data.access_token) {
                this.accessToken = response.data.access_token;
                // 提前5分钟过期，确保token有效性
                this.tokenExpireTime = Date.now() + (response.data.expires_in - 300) * 1000;
                console.log('访问令牌获取成功');
                return this.accessToken;
            } else {
                throw new Error(`获取access_token失败: ${response.data.errmsg}`);
            }
        } catch (error) {
            console.error('获取访问令牌失败:', error.message);
            throw error;
        }
    }

    /**
     * 上传图片素材
     * @param {string} imageUrl 图片URL
     * @returns {Promise<string>} media_id
     */
    async uploadImage(imageUrl) {
        try {
            console.log('正在上传图片素材...');
            const accessToken = await this.getAccessToken();
            
            // 下载图片
            const imageResponse = await axios.get(imageUrl, {
                responseType: 'stream',
                timeout: 15000
            });

            const FormData = require('form-data');
            const form = new FormData();
            form.append('media', imageResponse.data, {
                filename: 'image.jpg',
                contentType: 'image/jpeg'
            });

            const uploadUrl = `https://api.weixin.qq.com/cgi-bin/media/upload?access_token=${accessToken}&type=image`;
            
            const uploadResponse = await axios.post(uploadUrl, form, {
                headers: {
                    ...form.getHeaders()
                },
                timeout: 30000
            });

            if (uploadResponse.data.media_id) {
                console.log('图片上传成功');
                return uploadResponse.data.media_id;
            } else {
                throw new Error(`图片上传失败: ${uploadResponse.data.errmsg}`);
            }
        } catch (error) {
            console.error('上传图片失败:', error.message);
            throw error;
        }
    }

    /**
     * 创建草稿
     * @param {Object} articleData 文章数据
     * @returns {Promise<string>} media_id
     */
    async createDraft(articleData, titleMode = 'smart') {
        try {
            console.log('正在创建公众号草稿...');
            const accessToken = await this.getAccessToken();
            
            const { title, content, author = '', digest = '', imageUrl, sourceUrl = '' } = articleData;
            
            // 验证并优化标题以符合微信公众号限制
            console.log(`使用${titleMode}模式处理标题: ${title}`);
            const validatedTitle = this.validateAndTruncateTitle(title, titleMode);
            
            // 将markdown格式的内容转换为HTML格式
            console.log('正在将Markdown内容转换为HTML格式...');
            const htmlContent = this.convertMarkdownToHtml(content);
            
            let thumbMediaId = 'o_s2F7-Cq3hnVhL1sgs57RmEKtl0CsG7HZ_LYY2jYTZoyUQM2AnKQH4SrqHXBJ2o';

            if (imageUrl) {
                // thumbMediaId = await this.uploadImage(imageUrl);
            }

            const draftData = {
                articles: [
                    {
                        title: validatedTitle,
                        author: author,
                        digest: digest || content.substring(0, 100) + '...',
                        content: htmlContent,
                        thumb_media_id: thumbMediaId,
                        need_open_comment: 0,
                        only_fans_can_comment: 0
                    }
                ]
            };
            console.log('草稿数据:', draftData);
            const url = `https://api.weixin.qq.com/cgi-bin/draft/add?access_token=${accessToken}`;
            
            const response = await axios.post(url, draftData, {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            });

            if (response.data.media_id) {
                console.log('草稿创建成功，media_id:', response.data.media_id);
                return response.data.media_id;
            } else {
                console.error('草稿创建失败:', JSON.stringify(response.data));
                throw new Error(`创建草稿失败: ${response.data.errmsg}`);
            }
        } catch (error) {
            console.error('创建草稿失败:', error.message);
            throw error;
        }
    }

    /**
     * 发布草稿
     * @param {string} mediaId 草稿的media_id
     * @returns {Promise<string>} 发布结果
     */
    async publishDraft(mediaId) {
        try {
            console.log('正在发布草稿...');
            const accessToken = await this.getAccessToken();
            
            const publishData = {
                media_id: mediaId
            };

            const response = await axios.post(
                `https://api.weixin.qq.com/cgi-bin/freepublish/submit?access_token=${accessToken}`,
                publishData,
                {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (response.data.errcode === 0) {
                console.log('草稿发布成功，publish_id:', response.data.publish_id);
                return response.data.publish_id;
            } else {
                console.error('草稿发布失败:', JSON.stringify(response.data));
                throw new Error(`发布草稿失败: ${response.data.errmsg}`);
            }
        } catch (error) {
            console.error('发布草稿失败:', error.message);
            throw error;
        }
    }

    /**
     * 查询发布状态
     * @param {string} publishId 发布任务的publish_id
     * @returns {Promise<Object>} 发布状态信息
     */
    async getPublishStatus(publishId) {
        try {
            const accessToken = await this.getAccessToken();
            
            const response = await axios.post(
                `https://api.weixin.qq.com/cgi-bin/freepublish/get?access_token=${accessToken}`,
                {
                    publish_id: publishId
                },
                {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (response.data.errcode === 0) {
                return {
                    status: response.data.publish_status,
                    statusText: this.getPublishStatusText(response.data.publish_status),
                    failReason: response.data.fail_reason || '',
                    articleId: response.data.article_id || '',
                    articleUrl: response.data.article_url || ''
                };
            } else {
                throw new Error(`查询发布状态失败: ${response.data.errmsg}`);
            }
        } catch (error) {
            console.error('查询发布状态失败:', error.message);
            throw error;
        }
    }

    /**
     * 获取发布状态文本描述
     * @param {number} status 发布状态码
     * @returns {string} 状态描述
     */
    getPublishStatusText(status) {
        const statusMap = {
            0: '发布成功',
            1: '发布失败',
            2: '审核中',
            3: '原创校验中',
            4: '原创校验失败',
            5: '成功后用户删除所有文章'
        };
        return statusMap[status] || '未知状态';
    }

    /**
     * 将markdown格式转换为HTML格式
     * @param {string} markdownContent markdown格式的内容
     * @returns {string} HTML格式的内容
     */
    convertMarkdownToHtml(markdownContent) {
        try {
            // 配置marked选项，适合微信公众号
            marked.setOptions({
                breaks: true,        // 支持换行符转换为<br>
                gfm: true,          // 支持GitHub风格的markdown
                sanitize: false,    // 不过滤HTML标签
                smartLists: true,   // 智能列表
                smartypants: false  // 不转换引号等字符
            });

            // 转换markdown为HTML
            const htmlContent = marked(markdownContent);
            
            // 微信公众号HTML样式优化
            const styledHtml = this.optimizeHtmlForWechat(htmlContent);
            
            console.log('Markdown转HTML成功');
            return styledHtml;
        } catch (error) {
            console.error('Markdown转HTML失败:', error.message);
            // 如果转换失败，返回原始内容
            return markdownContent;
        }
    }

    /**
     * 优化HTML内容以适配微信公众号
     * @param {string} htmlContent 原始HTML内容
     * @returns {string} 优化后的HTML内容
     */
    optimizeHtmlForWechat(htmlContent) {
        let optimizedHtml = htmlContent;

        // 为段落添加样式
        optimizedHtml = optimizedHtml.replace(/<p>/g, '<p style="margin: 10px 0; line-height: 1.6; text-align: justify;">');
        
        // 为标题添加样式
        optimizedHtml = optimizedHtml.replace(/<h1>/g, '<h1 style="font-size: 24px; font-weight: bold; margin: 20px 0 10px 0; color: #333;">');
        optimizedHtml = optimizedHtml.replace(/<h2>/g, '<h2 style="font-size: 20px; font-weight: bold; margin: 18px 0 8px 0; color: #333;">');
        optimizedHtml = optimizedHtml.replace(/<h3>/g, '<h3 style="font-size: 18px; font-weight: bold; margin: 16px 0 6px 0; color: #333;">');
        
        // 为列表添加样式
        optimizedHtml = optimizedHtml.replace(/<ul>/g, '<ul style="margin: 10px 0; padding-left: 20px;">');
        optimizedHtml = optimizedHtml.replace(/<ol>/g, '<ol style="margin: 10px 0; padding-left: 20px;">');
        optimizedHtml = optimizedHtml.replace(/<li>/g, '<li style="margin: 5px 0; line-height: 1.6;">');
        
        // 为强调文本添加样式
        optimizedHtml = optimizedHtml.replace(/<strong>/g, '<strong style="font-weight: bold; color: #d32f2f;">');
        optimizedHtml = optimizedHtml.replace(/<em>/g, '<em style="font-style: italic; color: #1976d2;">');
        
        // 为引用添加样式
        optimizedHtml = optimizedHtml.replace(/<blockquote>/g, '<blockquote style="margin: 15px 0; padding: 10px 15px; border-left: 4px solid #ddd; background-color: #f9f9f9; font-style: italic;">');

        return optimizedHtml;
    }

    /**
     * 智能优化标题以符合微信公众号限制
     * @param {string} title 原始标题
     * @param {string} mode 处理模式: 'smart'(智能), 'simple'(简单截断), 'extract'(提取关键词)
     * @returns {string} 处理后的标题
     */
    validateAndTruncateTitle(title, mode = 'smart') {
        const MAX_TITLE_BYTES = 64; // 微信公众号标题最大字节数
        
        if (!title) {
            return '无标题';
        }

        // 检查字节长度
        const titleBytes = Buffer.byteLength(title, 'utf8');
        
        if (titleBytes <= MAX_TITLE_BYTES) {
            console.log(`标题长度检查通过: ${title.length}字符, ${titleBytes}字节`);
            return title;
        }

        console.log(`标题过长，需要优化: ${title.length}字符, ${titleBytes}字节 > ${MAX_TITLE_BYTES}字节`);
        console.log(`使用${mode}模式处理标题`);
        
        let optimizedTitle = '';
        
        switch (mode) {
            case 'smart':
                optimizedTitle = this.smartTitleOptimization(title, MAX_TITLE_BYTES);
                break;
            case 'extract':
                optimizedTitle = this.extractKeywordsTitle(title, MAX_TITLE_BYTES);
                break;
            case 'simple':
            default:
                optimizedTitle = this.simpleTruncateTitle(title, MAX_TITLE_BYTES);
                break;
        }
        
        const finalBytes = Buffer.byteLength(optimizedTitle, 'utf8');
        console.log(`标题优化完成: ${optimizedTitle.length}字符, ${finalBytes}字节`);
        console.log(`优化后标题: ${optimizedTitle}`);
        
        return optimizedTitle;
    }

    /**
     * 智能标题优化 - 保留最有趣和最重要的部分
     * @param {string} title 原始标题
     * @param {number} maxBytes 最大字节数
     * @returns {string} 优化后的标题
     */
    smartTitleOptimization(title, maxBytes) {
        // 定义关键词优先级（越高越重要）
        const keywordPriority = {
            // 时间相关
            '今天': 3, '明天': 3, '昨天': 3,
            '2025': 2, '2024': 2, '年': 1, '月': 1, '日': 1,
            
            // 有趣的表达
            '喵呜': 5, '喵喵': 5, '两脚兽': 4, '教授': 3,
            '新闻罐头': 5, 'Wi-Fi': 4, '尾巴天线': 4,
            '小鱼干': 4, '本喵': 4,
            
            // 动作词
            '截获': 3, '带着': 2, '准备': 2, '看看': 2,
            
            // 修饰词
            '新鲜': 3, '重点': 3, '好多': 2
        };

        // 尝试不同的组合策略
        const strategies = [
            // 策略1: 保留开头的称呼 + 核心内容
            () => this.buildTitleFromParts(title, ['喵呜~', '新闻罐头', 'Wi-Fi尾巴天线', '小鱼干'], maxBytes),
            
            // 策略2: 保留时间 + 特色词汇
            () => this.buildTitleFromParts(title, ['今天', '喵喵酱', '新闻罐头', 'Wi-Fi'], maxBytes),
            
            // 策略3: 保留最有特色的部分
            () => this.buildTitleFromParts(title, ['两脚兽教授', '本喵喵酱', 'Wi-Fi尾巴天线'], maxBytes),
            
            // 策略4: 简化版本
            () => this.buildTitleFromParts(title, ['喵呜~', '今天', '新闻'], maxBytes)
        ];

        // 尝试每个策略，返回第一个成功的
        for (const strategy of strategies) {
            const result = strategy();
            if (result && Buffer.byteLength(result, 'utf8') <= maxBytes) {
                return result;
            }
        }

        // 如果所有策略都失败，使用简单截断
        return this.simpleTruncateTitle(title, maxBytes);
    }

    /**
     * 从标题中构建包含指定关键词的新标题
     * @param {string} originalTitle 原始标题
     * @param {string[]} keywords 要包含的关键词
     * @param {number} maxBytes 最大字节数
     * @returns {string} 构建的标题
     */
    buildTitleFromParts(originalTitle, keywords, maxBytes) {
        const foundParts = [];
        
        // 查找包含关键词的部分
        for (const keyword of keywords) {
            if (originalTitle.includes(keyword)) {
                // 找到关键词周围的上下文
                const index = originalTitle.indexOf(keyword);
                let start = Math.max(0, index - 5);
                let end = Math.min(originalTitle.length, index + keyword.length + 5);
                
                // 调整边界到合适的位置（避免截断字符）
                while (start > 0 && !/[，。！？~\s]/.test(originalTitle[start - 1])) {
                    start--;
                }
                while (end < originalTitle.length && !/[，。！？~\s]/.test(originalTitle[end])) {
                    end++;
                }
                
                const part = originalTitle.substring(start, end).trim();
                if (part && !foundParts.includes(part)) {
                    foundParts.push(part);
                }
            }
        }

        if (foundParts.length === 0) {
            return null;
        }

        // 组合找到的部分
        let result = foundParts.join(' ');
        
        // 如果还是太长，尝试只用最重要的部分
        if (Buffer.byteLength(result, 'utf8') > maxBytes - 3) {
            result = foundParts[0];
        }
        
        // 如果还是太长，进行截断
        if (Buffer.byteLength(result, 'utf8') > maxBytes - 3) {
            result = this.simpleTruncateTitle(result, maxBytes);
        } else {
            result += '...';
        }

        return result;
    }

    /**
     * 提取关键词生成标题
     * @param {string} title 原始标题
     * @param {number} maxBytes 最大字节数
     * @returns {string} 关键词标题
     */
    extractKeywordsTitle(title, maxBytes) {
        // 提取关键信息
        const keywords = [];
        
        // 提取时间信息
        const timeMatch = title.match(/\d{4}年\d{1,2}月\d{1,2}日/);
        if (timeMatch) {
            keywords.push(timeMatch[0]);
        } else if (title.includes('今天')) {
            keywords.push('今天');
        }
        
        // 提取特色词汇
        const specialWords = ['喵呜', '喵喵酱', '两脚兽', '新闻罐头', 'Wi-Fi', '小鱼干'];
        for (const word of specialWords) {
            if (title.includes(word) && keywords.length < 3) {
                keywords.push(word);
            }
        }
        
        // 添加通用词
        if (keywords.length < 2) {
            keywords.push('新闻速递');
        }

        let result = keywords.join(' ') + '...';
        
        // 确保不超过字节限制
        if (Buffer.byteLength(result, 'utf8') > maxBytes) {
            result = keywords[0] + '...';
        }

        return result;
    }

    /**
     * 简单截断标题（原来的方法）
     * @param {string} title 原始标题
     * @param {number} maxBytes 最大字节数
     * @returns {string} 截断后的标题
     */
    simpleTruncateTitle(title, maxBytes) {
        let truncatedTitle = '';
        let currentBytes = 0;
        
        for (let i = 0; i < title.length; i++) {
            const char = title[i];
            const charBytes = Buffer.byteLength(char, 'utf8');
            
            if (currentBytes + charBytes > maxBytes - 3) {
                break;
            }
            
            truncatedTitle += char;
            currentBytes += charBytes;
        }
        
        return truncatedTitle + '...';
    }

    /**
     * 设置微信公众号配置
     * @param {string} appId 应用ID
     * @param {string} appSecret 应用密钥
     */
    setConfig(appId, appSecret) {
        this.appId = appId;
        this.appSecret = appSecret;
        // 重置token
        this.accessToken = null;
        this.tokenExpireTime = 0;
    }

    /**
     * 解析文章标题和内容
     * @param {string} article 完整文章
     * @returns {Object} 解析后的文章数据
     */
    parseArticle(article) {
        const lines = article.split('\n');
        let title = '';
        let content = '';
        
        // 查找标题（通常是第一行或包含"标题"的行）
        for (let i = 0; i < Math.min(5, lines.length); i++) {
            const line = lines[i].trim();
            if (line && !line.startsWith('#') && line.length > 5 && line.length < 100) {
                title = line.replace(/^#+\s*/, '').replace(/^标题[:：]\s*/, '');
                content = lines.slice(i + 1).join('\n').trim();
                break;
            }
        }
        
        // 如果没找到合适的标题，使用默认标题
        if (!title) {
            title = '今日新闻速览';
            content = article;
        }
        
        return { title, content };
    }
}

module.exports = WechatService;