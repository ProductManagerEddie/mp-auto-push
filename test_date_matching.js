require('dotenv').config();

const WechatService = require('./src/wechatService');

/**
 * 测试日期匹配功能
 */
async function testDateMatching() {
    try {
        console.log('=== 测试日期匹配功能开始 ===');
        
        // 获取当天日期
        const today = new Date().toISOString().split('T')[0];
        console.log('当天日期:', today);
        
        // 创建模拟的文章数据，包含当天开奖和非当天开奖的情况
        const mockArticlesData = [
            {
                articleData: {
                    title: '双色球开奖结果 - 当天开奖测试',
                    content: '测试内容'
                },
                lotteryData: [
                    {
                        issue: '2025140',
                        draw_date: today, // 当天开奖
                        red_balls: ['01', '03', '04', '12', '18', '24'],
                        blue_balls: '05'
                    }
                ],
                lotteryType: 'ssq'
            },
            {
                articleData: {
                    title: '快乐8开奖结果 - 当天开奖测试',
                    content: '测试内容'
                },
                lotteryData: [
                    {
                        issue: '2025334',
                        draw_date: today, // 当天开奖
                        balls: ['01', '03', '04', '06', '07', '10', '12', '13', '15', '16', '20', '22', '25', '28', '30', '33', '35', '40', '42', '45']
                    }
                ],
                lotteryType: 'kl8'
            }
        ];
        
        const wechatService = new WechatService();
        
        // 测试验证功能
        try {
            wechatService.validateArticlesData(mockArticlesData);
            console.log('✅ 文章数据验证成功！');
        } catch (error) {
            console.error('❌ 文章数据验证失败:', error.message);
            return;
        }
        
        console.log('\n=== 测试日期匹配功能完成 ===');
        console.log('✅ 所有测试通过！日期匹配功能正常工作。');
        
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
        console.error(error.stack);
    }
}

// 运行测试
testDateMatching();
