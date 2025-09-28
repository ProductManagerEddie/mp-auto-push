const axios = require('axios');

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
            
            let thumbMediaId = '';
            if (imageUrl) {
                thumbMediaId = await this.uploadImage(imageUrl);
            }

            const draftData = {
                articles: [
                    {
                        title: title,
                        author: author,
                        digest: digest || content.substring(0, 100) + '...',
                        content: content,
                        content_source_url: sourceUrl,
                        thumb_media_id: thumbMediaId,
                        show_cover_pic: thumbMediaId ? 1 : 0,
                        need_open_comment: 0,
                        only_fans_can_comment: 0
                    }
                ]
            };

            const url = `https://api.weixin.qq.com/cgi-bin/draft/add?access_token=${accessToken}`;
            
            const response = await axios.post(url, draftData, {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            });

            if (response.data.errcode === 0) {
                console.log('草稿创建成功，media_id:', response.data.media_id);
                return response.data.media_id;
            } else {
                throw new Error(`创建草稿失败: ${response.data.errmsg}`);
            }
        } catch (error) {
            console.error('创建草稿失败:', error.message);
            throw error;
        }
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