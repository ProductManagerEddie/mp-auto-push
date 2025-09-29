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
    async createDraft(articleData) {
        try {
            console.log('正在创建公众号草稿...');
            const accessToken = await this.getAccessToken();
            
            const { title, content, author = '', digest = '', imageUrl, sourceUrl = '' } = articleData;
            
            // 验证并截断标题以符合微信公众号限制
            const validatedTitle = this.validateAndTruncateTitle(title);
            
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
     * 检查并截断标题以符合微信公众号限制
     * @param {string} title 原始标题
     * @returns {string} 处理后的标题
     */
    validateAndTruncateTitle(title) {
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

        console.log(`标题过长，需要截断: ${title.length}字符, ${titleBytes}字节 > ${MAX_TITLE_BYTES}字节`);
        
        // 逐字符截断，确保不超过字节限制
        let truncatedTitle = '';
        let currentBytes = 0;
        
        for (let i = 0; i < title.length; i++) {
            const char = title[i];
            const charBytes = Buffer.byteLength(char, 'utf8');
            
            // 如果加上这个字符会超过限制，就停止
            if (currentBytes + charBytes > MAX_TITLE_BYTES - 3) { // 预留3字节给省略号
                break;
            }
            
            truncatedTitle += char;
            currentBytes += charBytes;
        }
        
        // 添加省略号
        truncatedTitle += '...';
        
        const finalBytes = Buffer.byteLength(truncatedTitle, 'utf8');
        console.log(`标题截断完成: ${truncatedTitle.length}字符, ${finalBytes}字节`);
        console.log(`截断后标题: ${truncatedTitle}`);
        
        return truncatedTitle;
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