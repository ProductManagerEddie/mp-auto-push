require('dotenv').config();

const LotteryService = require('./lotteryService');
const AIService = require('./aiService');
const WeChatService = require('./wechatService');
const { logger } = require('./logger');
const fs = require('fs').promises;
const path = require('path');

/**
 * 主程序 - 整合所有功能
 */
class AutoPushApp {
    constructor(options = {}) {
        this.lotteryService = new LotteryService();
        this.aiService = new AIService();
        this.wechatService = new WeChatService();
        this.isServiceMode = options.serviceMode || false;
        
        // 配置AI服务（智谱智能体）
        if (process.env.ZHIPU_API_KEY) {
            this.aiService.setToken(process.env.ZHIPU_API_KEY);
        } else {
            const message = '错误: 请在.env文件中配置ZHIPU_API_KEY';
            if (this.isServiceMode) {
                logger.error(message);
                throw new Error(message);
            } else {
                console.error(message);
                process.exit(1);
            }
        }
        
        // 配置微信服务（可选）
        if (process.env.WECHAT_APP_ID && process.env.WECHAT_APP_SECRET) {
            this.wechatService.setConfig(
                process.env.WECHAT_APP_ID,
                process.env.WECHAT_APP_SECRET
            );
        } else {
            const message = '警告: 未配置微信公众号信息，文章将保存到本地';
            if (this.isServiceMode) {
                logger.warn(message);
            } else {
                console.warn(message);
            }
        }
    }

    /**
     * 执行完整的推送流程
     * @param {Object} options 推送选项
     * @param {string} options.taskId 任务ID（可选）
     * @returns {Promise<Object>} 推送结果
     */
    async run(options = {}) {
        // 重试次数配置
        const MAX_RETRIES = 3;
        let retryCount = 0;
        
        while (retryCount <= MAX_RETRIES) {
            try {
                const logInfo = this.isServiceMode ? logger.info.bind(logger) : console.log;
                
                logInfo('=== 微信公众号自动推送开始 ===');
                logInfo('时间:', new Date().toLocaleString());
                logInfo('任务ID:', options.taskId || 'manual');
                
                // 获取前一天日期（格式：YYYY-MM-DD）
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                const yesterdayDate = yesterday.toISOString().split('T')[0];
                logInfo('推送日期:', yesterdayDate);
                logInfo('推送内容: 前一天的完整开奖信息');
                logInfo('当前系统日期:', new Date().toISOString().split('T')[0]);
                
                // 为了兼容后续代码，将yesterdayDate赋值给today变量
                const today = yesterdayDate;
                
                // 删除昨天上传的素材
                if (process.env.WECHAT_APP_ID && process.env.WECHAT_APP_SECRET) {
                    logInfo('\n步骤0: 删除昨天上传的素材');
                    const deletedCount = await this.wechatService.deleteYesterdayMaterials();
                    logInfo(`✅ 成功删除${deletedCount}条昨天上传的素材`);
                }
                
                // 定义需要推送的彩票类型（固定顺序）
                const lotteryTypes = [
                    { code: 'ssq', name: '双色球' },
                    { code: 'kl8', name: '快乐8' },
                    { code: 'qlc', name: '七乐彩' },
                    { code: '3d', name: '福彩3D' }
                ];
                
                // 用于存放当天开奖的文章数据
                const articlesData = [];
                const allLotteryData = {};
                const allArticleData = [];
                
                // 步骤1-3: 为每种彩票类型获取数据、生成文章、解析文章
                for (const lotteryType of lotteryTypes) {
                    logInfo(`\n=== ${lotteryType.name} 处理开始 ===`);
                    
                    // 步骤1: 获取最新彩票数据
                    logInfo(`
步骤1: 获取最新${lotteryType.name}数据`);
                    const lotteryData = await this.lotteryService.getLatestLotteryData(lotteryType.code);
                    allLotteryData[lotteryType.code] = lotteryData;
                    
                    // 调试日志：打印彩票数据的日期范围
                    if (lotteryData && lotteryData.length > 0) {
                        const firstDate = lotteryData[0].draw_date;
                        const lastDate = lotteryData[lotteryData.length - 1].draw_date;
                        logInfo(`${lotteryType.name}数据日期范围: ${lastDate} 至 ${firstDate}`);
                        logInfo(`${lotteryType.name}数据示例:`, lotteryData[0].draw_date, lotteryData[0].issue);
                    }
                    
                    // 检查是否有前一天开奖的数据
                    let targetLotteryData = lotteryData.filter(item => item.draw_date === today);
                    
                    // 严格遵循数据优先级规则：只使用前一天的数据
                    if (targetLotteryData.length === 0) {
                        if (lotteryData.length > 0) {
                            // 记录日志但不生成文章
                            logInfo(`ℹ️  前一天${lotteryType.name}无开奖信息，不生成文章`);
                        } else {
                            logInfo(`ℹ️  ${lotteryType.name}无任何开奖信息，跳过处理`);
                        }
                        logInfo(`=== ${lotteryType.name} 处理完成 (无符合条件的数据) ===`);
                        continue;
                    } else {
                        logInfo(`✅ 找到${targetLotteryData.length}条${lotteryType.name}开奖信息: ${today}`);
                    }
                    
                    // 使用目标开奖数据（前一天或最新一期）
                    const formattedLottery = this.lotteryService.formatLotteryForAI(targetLotteryData);
                    
                    // 步骤2: 生成文章
                    logInfo(`\n步骤2: 调用AI生成${lotteryType.name}文章`);
                    const article = await this.aiService.generateArticle(formattedLottery, lotteryType.code);
                    
                    // 步骤3: 解析文章
                    logInfo(`\n步骤3: 解析${lotteryType.name}文章内容`);
                    let { title, content } = this.wechatService.parseArticle(article);
                    
                    // 获取最新一期彩票数据的期号
                    const latestIssue = targetLotteryData[0].issue;
                    
                    // 生成统一格式的标题: 【彩票类型】开奖结果第【开奖期号】期中奖号码
                    const standardizedTitle = `【${lotteryType.name}】开奖结果第${latestIssue}期中奖号码`;
                    
                    logInfo(`${lotteryType.name}文章标题:`, standardizedTitle);
                    logInfo(`${lotteryType.name}文章长度:`, content.length, '字符');
                    
                    // 将markdown格式的内容转换为HTML格式（与推送文章保持一致）
                    const htmlContent = this.wechatService.convertMarkdownToHtml(content);
                    
                    // 构建文章数据
                    const articleData = {
                        title: standardizedTitle,
                        content: htmlContent, // 使用HTML格式内容
                        author: '彩票信息助手',
                        digest: `${today} ${lotteryType.name}开奖信息`,
                        sourceUrl: ''
                    };
                    
                    allArticleData.push({ articleData, lotteryDate: today });
                    
                    // 添加到文章数据数组，用于创建草稿
                    articlesData.push({
                        articleData: articleData,
                        lotteryData: targetLotteryData,
                        lotteryType: lotteryType.code // 添加彩票类型标识
                    });
                    
                    logInfo(`=== ${lotteryType.name} 处理完成 ===`);
                }
                
                // 检查是否有当天开奖的彩票信息
                if (articlesData.length === 0) {
                    logInfo('\nℹ️  当天所有彩票均无开奖信息，不生成草稿文章');
                    logInfo('\n=== 推送流程完成 ===');
                    
                    // 返回结果
                    return {
                        success: true,
                        taskId: options.taskId || 'manual',
                        lotteryData: allLotteryData,
                        articles: [],
                        mediaId: null,
                        publishResult: null,
                        publishStatus: null,
                        timestamp: new Date().toISOString(),
                        retries: retryCount,
                        error: null,
                        message: '当天所有彩票均无开奖信息，不生成草稿文章'
                    };
                }
                
                // 步骤4: 推送到微信公众号草稿箱
                logInfo(`\n=== 所有当天开奖彩票处理完成，共${articlesData.length}种彩票有开奖信息，开始创建草稿 ===`);
                logInfo('\n步骤4: 推送到微信公众号');
                
                let mediaId = null;
                let publishResult = null;
                let publishStatus = null;
                let pushErrorDetails = null;
                
                // 检查微信配置
                if (!process.env.WECHAT_APP_ID || !process.env.WECHAT_APP_SECRET) {
                    logInfo('⚠️  微信公众号配置未设置，跳过推送步骤');
                    logInfo('请在.env文件中设置 WECHAT_APP_ID 和 WECHAT_APP_SECRET');
                } else {
                    try {
                        // 推送到微信公众号草稿箱
                        mediaId = await this.wechatService.createDraft(articlesData);
                        logInfo('✅ 文章已成功推送到微信公众号草稿箱');
                        logInfo('草稿ID:', mediaId);
                        
                        // 检查是否需要自动发布
                        const autoPublish = options.autoPublish !== undefined ? options.autoPublish : process.env.AUTO_PUBLISH === 'true';
                        if (autoPublish) {
                            logInfo('🚀 开始自动发布文章...');
                            publishResult = await this.wechatService.publishDraft(mediaId);
                            logInfo('✅ 文章发布请求已提交');
                            logInfo('发布任务ID:', publishResult.publish_id);
                            
                            // 检查是否需要查询发布状态
                            const checkStatus = options.checkPublishStatus !== undefined ? options.checkPublishStatus : process.env.CHECK_PUBLISH_STATUS !== 'false';
                            if (checkStatus) {
                                logInfo('⏳ 等待3秒后查询发布状态...');
                                await new Promise(resolve => setTimeout(resolve, 3000));
                                
                                publishStatus = await this.wechatService.getPublishStatus(publishResult.publish_id);
                                const statusText = this.wechatService.getPublishStatusText(publishStatus.status);
                                logInfo(`📊 发布状态: ${statusText}`);
                                
                                if (publishStatus.status === 0) {
                                    logInfo('🎉 文章发布成功！');
                                    if (publishStatus.articleUrl) {
                                        logInfo('📖 文章链接:', publishStatus.articleUrl);
                                    }
                                } else if (publishStatus.status === 1) {
                                    logInfo('⏳ 文章正在发布中，请稍后查看公众号');
                                } else {
                                    logInfo('❌ 文章发布失败，请检查内容是否符合微信规范');
                                    if (publishStatus.failReason) {
                                        logInfo('失败详情:', publishStatus.failReason);
                                    }
                                }
                            }
                        } else {
                            logInfo('💡 自动发布已关闭，文章已保存为草稿');
                            logInfo('如需自动发布，请在.env文件中设置 AUTO_PUBLISH=true');
                        }
                    } catch (pushError) {
                        logInfo('❌ 微信推送失败:', pushError.message);
                        if (pushError.stack) {
                            logInfo('错误堆栈:', pushError.stack);
                        }
                        logInfo('💡 文章将保存到本地文件作为备份');
                        // 将错误信息添加到结果中，以便记录到历史
                        pushErrorDetails = {
                            message: pushError.message,
                            stack: pushError.stack
                        };
                    }
                }
                
                // 无论是否推送微信，都保存所有当天开奖的文章到本地文件作为备份
                for (const { articleData, lotteryDate } of allArticleData) {
                    await this.saveArticleToFile(articleData, lotteryDate);
                }
                
                logInfo('\n=== 推送流程完成 ===');
                
                // 返回完整的结果
                return {
                    success: true,
                    taskId: options.taskId || 'manual',
                    lotteryData: allLotteryData,
                    articles: allArticleData.map(item => item.articleData),
                    mediaId: mediaId,
                    publishResult: publishResult,
                    publishStatus: publishStatus,
                    timestamp: new Date().toISOString(),
                    retries: retryCount,
                    error: pushErrorDetails || null,
                    message: `成功处理${articlesData.length}种彩票的开奖信息`
                };
                
            } catch (error) {
                retryCount++;
                const logError = this.isServiceMode ? logger.error.bind(logger) : console.error;
                logError(`\n❌ 推送流程失败 (第${retryCount}次尝试):`, error.message);
                
                if (this.isServiceMode) {
                    logger.error('错误详情:', error);
                } else {
                    console.error('错误详情:', error);
                }
                
                // 如果达到最大重试次数，返回失败结果
                if (retryCount > MAX_RETRIES) {
                    logError(`\n❌ 推送流程最终失败，已重试${MAX_RETRIES}次`);
                    return {
                        success: false,
                        taskId: options.taskId || 'manual',
                        error: error.message,
                        timestamp: new Date().toISOString(),
                        retries: retryCount - 1
                    };
                }
                
                // 等待一段时间后重试
                const delay = Math.pow(2, retryCount) * 1000; // 指数退避策略
                logError(`⏳ 将在${delay}ms后重试...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    /**
     * 保存文章到本地文件
     * @param {Object} articleData 文章数据
     * @param {string} date 日期
     */
    async saveArticleToFile(articleData, date) {
        const fs = require('fs').promises;
        const path = require('path');
        
        try {
            // 创建按年月分组的目录结构
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            
            const outputDir = path.join(__dirname, '../output', `${year}`, `${month}`);
            await fs.mkdir(outputDir, { recursive: true });
            
            // 生成文件名，包含时间戳避免重复
            const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const filename = `article_${date.replace(/\//g, '-')}_${timestamp}.md`;
            const filepath = path.join(outputDir, filename);
            
            // 构建更详细的文章内容
            const content = `# ${articleData.title}

**📅 发布日期:** ${date}
**👤 作者:** ${articleData.author || '彩票信息助手'}
**📝 摘要:** ${articleData.digest || ''}
**🔗 来源链接:** ${articleData.sourceUrl || ''}
**⏰ 保存时间:** ${now.toLocaleString('zh-CN')}

---

${articleData.content}

---

> 本文由微信公众号自动推送工具生成并保存
> 生成时间: ${now.toLocaleString('zh-CN')}
`;
            
            await fs.writeFile(filepath, content, 'utf8');
            
            const logInfo = this.isServiceMode ? logger.info.bind(logger) : console.log;
            logInfo('📄 文章已保存到本地文件:', filepath);
            
            // 同时保存一份JSON格式的数据，便于后续处理
            const jsonFilepath = filepath.replace('.md', '.json');
            const jsonData = {
                ...articleData,
                saveTime: now.toISOString(),
                date: date,
                filepath: filepath
            };
            
            await fs.writeFile(jsonFilepath, JSON.stringify(jsonData, null, 2), 'utf8');
            logInfo('📊 文章数据已保存到:', jsonFilepath);
            
        } catch (error) {
            const logError = this.isServiceMode ? logger.error.bind(logger) : console.error;
            logError('保存文章到本地失败:', error.message);
        }
    }

    /**
     * 设置AI服务配置
     * @param {string} token 智谱AI Token
     */
    setAIConfig(token) {
        if (token) this.aiService.setToken(token);
    }

    /**
     * 设置微信公众号配置
     * @param {string} appId 应用ID
     * @param {string} appSecret 应用密钥
     */
    setWechatConfig(appId, appSecret) {
        this.wechatService.setConfig(appId, appSecret);
    }
}

// 如果直接运行此文件
if (require.main === module) {
    // 解析命令行参数
    const args = process.argv.slice(2);
    
    if (args.includes('--help') || args.includes('-h')) {
        console.log(`
微信公众号自动推送工具

使用方法:
  npm start              # 执行一次推送
  npm run daemon         # 启动后台服务
  npm run help           # 显示帮助信息
  npm run config         # 显示配置说明

环境变量配置:
  ZHIPU_API_KEY         # 智谱智能体的API密钥 (必需)
  ZHIPU_APP_ID          # 智谱智能体的应用ID (必需)
  ZHIPU_USER_ID         # 智谱智能体的用户ID (可选)
  WECHAT_APP_ID         # 微信公众号AppID (可选)
  WECHAT_APP_SECRET     # 微信公众号AppSecret (可选)

后台服务管理:
  npm run daemon start  # 启动后台服务
  npm run daemon stop   # 停止后台服务
  npm run daemon status # 查看服务状态
  npm run daemon run    # 手动执行一次推送

示例:
  # 复制环境变量模板
  cp .env.example .env
  
  # 编辑.env文件，填入你的配置
  # 然后运行推送
  npm start
  
  # 或启动后台服务（每天8点自动推送）
  npm run daemon start
        `);
        process.exit(0);
    }
    
    if (args.includes('--config')) {
        console.log(`
配置说明:

1. 智谱智能体配置 (必需):
   - 访问 https://zhipu-ai.feishu.cn/wiki/Wsr1wXmHXicO3AkdZPVcBANbnvb 获取API访问权限
   - 在.env文件中设置:
     ZHIPU_API_KEY=your_zhipu_api_key_here
     ZHIPU_APP_ID=your_zhipu_application_id_here
     ZHIPU_USER_ID=your_user_id_here (可选)

2. 微信公众号配置 (可选):
   - 登录微信公众平台 https://mp.weixin.qq.com/
   - 在开发 -> 基本配置中获取AppID和AppSecret
   - 在.env文件中设置:
     WECHAT_APP_ID=your_app_id_here
     WECHAT_APP_SECRET=your_app_secret_here

3. 后台服务配置:
   - 服务将在每天上午8点自动执行推送
   - 日志文件保存在 logs/ 目录下
   - 支持PM2进程管理

注意: 如果未配置微信公众号，文章将保存到本地文件
        `);
        process.exit(0);
    }
    
    // 创建应用实例并运行
    const app = new AutoPushApp();
    app.run().catch(error => {
        console.error('应用运行失败:', error);
        process.exit(1);
    });
}

module.exports = AutoPushApp;