const axios = require('axios');
const marked = require('marked');
const { createCanvas, registerFont } = require('canvas');
const path = require('path');
const fs = require('fs');

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
     * @param {string} imageUrl 图片URL或本地文件路径
     * @returns {Promise<string>} media_id
     */
    async uploadImage(imageUrl) {
        try {
            console.log('正在上传图片素材...');
            const accessToken = await this.getAccessToken();
            
            let imageStream;
            let filename = 'image.jpg';
            
            // 检查是否是本地文件路径
            if (imageUrl.startsWith('file://') || !imageUrl.startsWith('http')) {
                // 处理本地文件
                const filePath = imageUrl.startsWith('file://') ? imageUrl.substring(7) : imageUrl;
                console.log('上传本地文件:', filePath);
                
                // 检查文件是否存在
                if (!fs.existsSync(filePath)) {
                    throw new Error(`本地文件不存在: ${filePath}`);
                }
                
                // 获取文件名
                filename = path.basename(filePath);
                
                // 创建文件流
                imageStream = fs.createReadStream(filePath);
            } else {
                // 处理远程URL
                console.log('下载远程图片:', imageUrl);
                const imageResponse = await axios.get(imageUrl, {
                    responseType: 'stream',
                    timeout: 15000
                });
                
                imageStream = imageResponse.data;
            }

            const FormData = require('form-data');
            const form = new FormData();
            form.append('media', imageStream, {
                filename: filename,
                contentType: 'image/jpeg'
            });

            const uploadUrl = `https://api.weixin.qq.com/cgi-bin/material/add_material?access_token=${accessToken}&type=image`;
            
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
     * @param {Array} articlesData 多篇文章数据数组，根据实际获取的开奖信息数量灵活调整
     * @returns {Promise<string>} media_id
     */
    async createDraft(articlesData) {
        try {
            console.log('正在创建公众号草稿...');
            const accessToken = await this.getAccessToken();
            
            // 验证文章数据
            this.validateArticlesData(articlesData);
            
            // 处理每篇文章
            const articles = [];
            for (const articleItem of articlesData) {
                const { articleData, lotteryData } = articleItem;
                const { title, content, author = '', digest = '' } = articleData;
                
                // 验证并优化标题以符合微信公众号限制
                console.log(`使用smart模式处理标题: ${title}`);
                const validatedTitle = this.validateAndTruncateTitle(title, 'smart');
                
                // 使用已经转换好的HTML格式内容
                const htmlContent = content;
                
                let thumbMediaId = '';

                if (lotteryData) {
                    // 如果有彩票数据，生成彩票图片
                    try {
                        const lotteryImagePath = await this.generateLotteryImage(lotteryData);
                        // 将本地图片路径转换为file:// URL
                        const lotteryImageUrl = `file://${lotteryImagePath}`;
                        thumbMediaId = await this.uploadImage(lotteryImageUrl);
                        console.log('使用生成的彩票图片上传成功，media_id:', thumbMediaId);
                    } catch (error) {
                        console.error('生成彩票图片失败:', error.message);
                        // 如果彩票图片生成失败，尝试使用默认图片
                        const defaultImageUrl = 'https://picsum.photos/seed/lottery/800/600.jpg';
                        try {
                            thumbMediaId = await this.uploadImage(defaultImageUrl);
                            console.log('使用默认图片上传成功，media_id:', thumbMediaId);
                        } catch (defaultError) {
                            console.error('默认图片上传失败:', defaultError.message);
                            thumbMediaId = '';
                        }
                    }
                } else {
                    // 如果没有提供彩票数据，尝试上传一个默认图片
                    // 使用一个公开可访问的图片URL
                    const defaultImageUrl = 'https://picsum.photos/seed/lottery/800/600.jpg';
                    try {
                        thumbMediaId = await this.uploadImage(defaultImageUrl);
                        console.log('使用默认图片上传成功，media_id:', thumbMediaId);
                    } catch (error) {
                        console.error('默认图片上传失败:', error.message);
                        // 如果默认图片上传失败，使用一个空字符串，让微信API使用默认图片
                        thumbMediaId = '';
                    }
                }

                articles.push({
                    title: validatedTitle,
                    author: author,
                    digest: digest || content.substring(0, 100) + '...',
                    content: htmlContent,
                    thumb_media_id: thumbMediaId,
                    need_open_comment: 0,
                    only_fans_can_comment: 0
                });
            }

            const draftData = {
                articles: articles
            };
            console.log('草稿数据:', draftData);
            const url = `https://api.weixin.qq.com/cgi-bin/draft/add?access_token=${accessToken}`;
            
            const response = await axios.post(url, draftData, {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            });

            // 检查微信API响应
            if (response.data.errcode && response.data.errcode !== 0) {
                console.error('微信API返回错误:', JSON.stringify(response.data));
                throw new Error(`创建草稿失败: 错误码${response.data.errcode}, 错误信息: ${response.data.errmsg}`);
            }
            
            if (response.data.media_id) {
                console.log('草稿创建成功，media_id:', response.data.media_id);
                return response.data.media_id;
            } else {
                console.error('草稿创建失败，未返回media_id:', JSON.stringify(response.data));
                throw new Error(`创建草稿失败: 未返回media_id`);
            }
        } catch (error) {
            console.error('创建草稿失败:', error.message);
            throw error;
        }
    }

    /**
     * 验证文章数据，确保每篇文章包含有效的开奖信息
     * @param {Array} articlesData 多篇文章数据数组
     * @throws {Error} 验证失败时抛出错误
     */
    validateArticlesData(articlesData) {
        // 验证文章数量
        if (!Array.isArray(articlesData)) {
            throw new Error('文章数据必须是数组');
        }
        
        // 如果没有文章数据，直接通过验证（在主程序中已处理）
        if (articlesData.length === 0) {
            console.log('文章数据为空，跳过验证');
            return;
        }
        
        // 定义支持的彩票类型（固定顺序）
        const supportedTypes = ['ssq', 'kl8', 'qlc', '3d'];
        const articleTypes = [];
        
        // 验证每篇文章的类型
        for (const articleItem of articlesData) {
            const { articleData, lotteryType } = articleItem;
            
            if (!articleData || typeof articleData !== 'object') {
                throw new Error('每篇文章必须包含有效的articleData对象');
            }
            
            if (!articleData.title || !articleData.content) {
                throw new Error('每篇文章必须包含标题和内容');
            }
            
            let resolvedType = lotteryType;
            
            // 如果没有直接提供lotteryType，则尝试从标题中提取
            if (!resolvedType) {
                resolvedType = this.extractLotteryTypeFromTitle(articleData.title);
            }
            
            if (!resolvedType) {
                throw new Error(`无法确定文章类型，标题："${articleData.title}"`);
            }
            
            if (!supportedTypes.includes(resolvedType)) {
                throw new Error(`文章类型"${resolvedType}"无效，必须是以下类型之一：${supportedTypes.join(', ')}`);
            }
            
            articleTypes.push(resolvedType);
        }
        
        // 验证没有重复的文章类型
        const uniqueTypes = [...new Set(articleTypes)];
        
        if (uniqueTypes.length !== articleTypes.length) {
            throw new Error('文章类型不能有重复');
        }
        
        console.log(`文章数据验证通过，共包含${articlesData.length}篇文章`);
    }

    /**
     * 从文章标题中提取彩票类型
     * @param {string} title 文章标题
     * @returns {string|null} 彩票类型，如ssq、kl8、qlc、3d，提取失败返回null
     */
    extractLotteryTypeFromTitle(title) {
        const typeMap = {
            '双色球': 'ssq',
            '快乐8': 'kl8',
            '七乐彩': 'qlc',
            '福彩3D': '3d',
            '3D': '3d'
        };
        
        for (const [keyword, type] of Object.entries(typeMap)) {
            if (title.includes(keyword)) {
                return type;
            }
        }
        
        return null;
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
            // 转换markdown为HTML（使用新版本marked API）
            const htmlContent = marked.parse(markdownContent, {
                breaks: true,        // 支持换行符转换为<br>
                gfm: true,          // 支持GitHub风格的markdown
                sanitize: false,    // 不过滤HTML标签
                smartLists: true,   // 智能列表
                smartypants: false  // 不转换引号等字符
            });
            
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

        // 添加整体容器样式
        optimizedHtml = `<div style="max-width: 680px; margin: 0 auto; padding: 20px; background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">${optimizedHtml}</div>`;

        // 为段落添加更丰富的样式
        optimizedHtml = optimizedHtml.replace(/<p>/g, '<p style="margin: 16px 0; line-height: 1.8; text-align: justify; font-size: 16px; color: #333333;">');
        
        // 为标题添加优化样式
        optimizedHtml = optimizedHtml.replace(/<h1>/g, '<h1 style="font-size: 28px; font-weight: bold; margin: 25px 0 15px 0; color: #2c3e50; text-align: center; padding: 15px 0; border-bottom: 2px solid #e8e8e8;">');
        optimizedHtml = optimizedHtml.replace(/<h2>/g, '<h2 style="font-size: 24px; font-weight: bold; margin: 22px 0 12px 0; color: #34495e; background-color: #f8f9fa; padding: 10px 15px; border-left: 4px solid #3498db;">');
        optimizedHtml = optimizedHtml.replace(/<h3>/g, '<h3 style="font-size: 20px; font-weight: bold; margin: 20px 0 10px 0; color: #2c3e50; padding: 8px 12px; background-color: #f0f2f5;">');
        
        // 为列表添加优化样式
        optimizedHtml = optimizedHtml.replace(/<ul>/g, '<ul style="margin: 16px 0; padding-left: 25px; background-color: #fafafa; padding: 15px; border-radius: 8px;">');
        optimizedHtml = optimizedHtml.replace(/<ol>/g, '<ol style="margin: 16px 0; padding-left: 25px; background-color: #fafafa; padding: 15px; border-radius: 8px;">');
        optimizedHtml = optimizedHtml.replace(/<li>/g, '<li style="margin: 8px 0; line-height: 1.8; font-size: 15px; color: #4a5568; list-style-type: disc; list-style-position: inside;">');
        
        // 为强调文本添加样式
        optimizedHtml = optimizedHtml.replace(/<strong>/g, '<strong style="font-weight: bold; color: #e74c3c; background-color: #fff5f5; padding: 2px 6px; border-radius: 3px;">');
        optimizedHtml = optimizedHtml.replace(/<em>/g, '<em style="font-style: italic; color: #3498db; background-color: #f0f8ff; padding: 2px 6px; border-radius: 3px;">');
        
        // 为引用添加样式
        optimizedHtml = optimizedHtml.replace(/<blockquote>/g, '<blockquote style="margin: 20px 0; padding: 15px 20px; border-left: 4px solid #3498db; background-color: #f8f9fa; font-style: italic; border-radius: 0 8px 8px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">');
        
        // 为开奖结果添加特殊样式（通用）
        optimizedHtml = optimizedHtml.replace(/## 开奖结果一览|## 开奖结果速览|## 开奖结果/g, '<div style="margin: 20px 0; padding: 20px; background-color: #e8f5e8; border-radius: 10px; border: 1px solid #c8e6c9;"><h3 style="margin-top: 0; color: #2e7d32; font-size: 18px;">开奖结果一览</h3>');
        
        // 为数据分析添加特殊样式（通用）
        optimizedHtml = optimizedHtml.replace(/## 数据分析与趋势解读|## 数据分析|## 趋势解读/g, '<div style="margin: 20px 0; padding: 20px; background-color: #e3f2fd; border-radius: 10px; border: 1px solid #bbdefb;"><h3 style="margin-top: 0; color: #1565c0; font-size: 18px;">数据分析与趋势解读</h3>');
        
        // 为号码分析添加特殊样式（通用，适用于所有彩票类型）
        optimizedHtml = optimizedHtml.replace(/### 红球分析|### 蓝球分析|### 号码分析|### 数字分析/g, '<h4 style="margin: 18px 0 10px 0; color: #e53935; font-size: 16px; padding-bottom: 5px; border-bottom: 1px dashed #ffcdd2;">号码分析</h4>');
        
        // 为近期对比添加特殊样式（通用）
        optimizedHtml = optimizedHtml.replace(/### 近期对比|### 历史数据对比|### 近期走势/g, '<h4 style="margin: 18px 0 10px 0; color: #f57c00; font-size: 16px; padding-bottom: 5px; border-bottom: 1px dashed #ffe0b2;">近期对比</h4>');
        
        // 为结论添加特殊样式（通用）
        optimizedHtml = optimizedHtml.replace(/## 结语|## 总结|## 购彩小贴士/g, '<div style="margin: 20px 0; padding: 20px; background-color: #fff3e0; border-radius: 10px; border: 1px solid #ffe0b2;"><h3 style="margin-top: 0; color: #ef6c00; font-size: 18px;">结语</h3>');
        
        // 为快乐8号码添加特殊样式
        optimizedHtml = optimizedHtml.replace(/红球号码：|红球：|蓝球号码：|蓝球：|号码：|数字：|开奖号码：/g, '<strong style="font-weight: bold; color: #e74c3c; background-color: #fff5f5; padding: 3px 8px; border-radius: 4px; margin: 0 2px;">开奖号码：</strong>');
        
        // 为特殊标签添加样式（如开奖日期、号码等）
        optimizedHtml = optimizedHtml.replace(/\*\*(.*?)\*\*/g, '<span style="font-weight: bold; color: #e74c3c; background-color: #fff5f5; padding: 3px 8px; border-radius: 4px; margin: 0 2px;">$1</span>');
        
        // 为#标签添加样式
        optimizedHtml = optimizedHtml.replace(/#{1,3} (.*?)(?=<|$)/g, '<span style="color: #95a5a6; font-size: 14px; margin-right: 10px;">#$1</span>');
        
        // 添加结束标签的样式（如果有需要）
        optimizedHtml = optimizedHtml.replace(/<\/div>\s*<\/div>/g, '</div></div>');

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
            () => this.buildTitleFromParts(title, ['今天', '喵彩票信息助手', '新闻罐头', 'Wi-Fi'], maxBytes),
            
            // 策略3: 保留最有特色的部分
            () => this.buildTitleFromParts(title, ['两脚兽教授', '本喵彩票信息助手', 'Wi-Fi尾巴天线'], maxBytes),
            
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
        const specialWords = ['喵呜', '喵彩票信息助手', '两脚兽', '新闻罐头', 'Wi-Fi', '小鱼干'];
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
     * 获取素材列表
     * @param {string} type 素材类型，默认为image
     * @param {number} offset 偏移量，默认为0
     * @param {number} count 获取数量，默认为20
     * @returns {Promise<Object>} 素材列表
     */
    async getMaterialList(type = 'image', offset = 0, count = 20) {
        try {
            console.log(`正在获取${type}类型的素材列表...`);
            const accessToken = await this.getAccessToken();
            
            const response = await axios.post(`https://api.weixin.qq.com/cgi-bin/material/batchget_material?access_token=${accessToken}`, {
                type,
                offset,
                count
            }, {
                timeout: 10000,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.data && response.data.item) {
                console.log(`成功获取${response.data.item.length}条${type}素材`);
                return response.data.item;
            } else {
                console.log('没有获取到素材或返回格式错误:', response.data);
                return [];
            }
        } catch (error) {
            console.error('获取素材列表失败:', error.message);
            return [];
        }
    }
    
    /**
     * 删除素材
     * @param {string} mediaId 素材ID
     * @returns {Promise<boolean>} 删除结果
     */
    async deleteMaterial(mediaId) {
        try {
            console.log(`正在删除素材: ${mediaId}...`);
            const accessToken = await this.getAccessToken();
            
            const response = await axios.post(`https://api.weixin.qq.com/cgi-bin/material/del_material?access_token=${accessToken}`, {
                media_id: mediaId
            }, {
                timeout: 10000,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.data && response.data.errcode === 0) {
                console.log(`素材删除成功: ${mediaId}`);
                return true;
            } else {
                console.error(`素材删除失败: ${mediaId}，错误码: ${response.data.errcode}，错误信息: ${response.data.errmsg}`);
                return false;
            }
        } catch (error) {
            console.error(`删除素材时发生错误: ${mediaId}`, error.message);
            return false;
        }
    }
    
    /**
     * 删除昨天上传的素材
     * @returns {Promise<number>} 删除的素材数量
     */
    async deleteYesterdayMaterials() {
        try {
            console.log('开始删除昨天上传的素材...');
            
            // 计算昨天的日期
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayDateStr = yesterday.toISOString().split('T')[0];
            
            console.log(`删除${yesterdayDateStr}上传的素材`);
            
            // 获取所有图片素材
            const materials = await this.getMaterialList('image', 0, 100);
            
            let deletedCount = 0;
            
            // 遍历素材，删除昨天上传的素材
            for (const material of materials) {
                // 获取素材创建时间
                const createTime = new Date(material.update_time * 1000);
                const createDateStr = createTime.toISOString().split('T')[0];
                
                // 检查是否是昨天上传的素材
                if (createDateStr === yesterdayDateStr) {
                    const success = await this.deleteMaterial(material.media_id);
                    if (success) {
                        deletedCount++;
                    }
                }
            }
            
            console.log(`成功删除${deletedCount}条昨天上传的素材`);
            return deletedCount;
        } catch (error) {
            console.error('删除昨天素材时发生错误:', error.message);
            return 0;
        }
    }

    /**
     * 解析文章标题和内容
     * @param {string} article 完整文章
     * @returns {Object} 解析后的文章数据
     */
    parseArticle(article) {
        // 处理undefined或null的文章内容
        if (!article) {
            return {
                title: '默认文章标题',
                content: '暂无文章内容'
            };
        }
        
        // 处理空字符串
        const trimmedArticle = article.trim();
        if (!trimmedArticle) {
            return {
                title: '默认文章标题',
                content: '暂无文章内容'
            };
        }
        
        const lines = article.split('\n');
        let title = '';
        let content = '';
        
        // 查找标题（通常是第一行或包含"标题"的行）
        for (let i = 0; i < Math.min(10, lines.length); i++) {
            const line = lines[i].trim();
            if (line && line.length > 5 && line.length < 100) {
                // 接受markdown标题
                title = line.replace(/^#+\s*/, '').replace(/^标题[:：]\s*/, '');
                content = lines.slice(i + 1).join('\n').trim();
                break;
            }
        }
        
        // 如果没找到合适的标题，使用默认标题
        if (!title) {
            title = '今日彩票分析';
            content = trimmedArticle;
        }
        
        // 确保内容不为空
        if (!content || content.trim() === '') {
            content = '暂无详细分析内容，请查看最新开奖结果。';
        }
        
        return { title, content };
    }

    /**
     * 生成彩票开奖信息图片
     * @param {Object} lotteryData 彩票数据
     * @returns {Promise<string>} 图片路径
     */
    async generateLotteryImage(lotteryData) {
        try {
            // 确保目录存在
            const imageDir = path.join(__dirname, '../images');
            if (!fs.existsSync(imageDir)) {
                fs.mkdirSync(imageDir, { recursive: true });
            }

            // 获取最新一期彩票数据
            const latest = lotteryData[0];
            if (!latest) {
                throw new Error('没有彩票数据');
            }

            // 创建图片
            const width = 800;
            const height = 600;
            
            // 创建canvas
            const canvas = createCanvas(width, height);
            const ctx = canvas.getContext('2d');
            
            // 设置背景色为白色
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, width, height);
            
            // 设置文字样式
            ctx.fillStyle = '#000000';
            ctx.font = '32px sans-serif';
            
            // 添加标题
            const title = `双色球第${latest.issue}期开奖结果`;
            ctx.font = 'bold 36px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(title, width / 2, 70);
            
            // 设置文字左对齐
            ctx.textAlign = 'left';
            ctx.font = '32px sans-serif';
            
            // 添加开奖日期
            const dateText = `开奖日期: ${latest.draw_date}`;
            ctx.fillText(dateText, 100, 150);
            
            // 添加红球
            const redBallsText = `红球: ${latest.red_balls.join(' ')}`;
            ctx.fillText(redBallsText, 100, 250);
            
            // 添加蓝球
            const blueBallText = `蓝球: ${latest.blue_balls}`;
            ctx.fillText(blueBallText, 100, 350);
            
            // 添加奖池信息
            const poolText = `奖池: ${latest.pool_money}元`;
            ctx.fillText(poolText, 100, 450);

            // 保存图片
            const imagePath = path.join(imageDir, `lottery_${latest.issue}.png`);
            const buffer = canvas.toBuffer('image/png');
            fs.writeFileSync(imagePath, buffer);

            console.log(`彩票图片已生成: ${imagePath}`);
            return imagePath;
        } catch (error) {
            console.error('生成彩票图片失败:', error);
            throw error;
        }
    }
}

module.exports = WechatService;