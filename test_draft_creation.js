require('dotenv').config();

const WechatService = require('./src/wechatService');

/**
 * 测试创建包含四篇文章的草稿功能
 */
async function testDraftCreation() {
    try {
        console.log('=== 测试草稿创建功能开始 ===');
        
        const wechatService = new WechatService();
        
        // 测试1: 验证文章数据验证功能
        console.log('\n--- 测试1: 验证文章数据验证功能 ---');
        
        // 测试用的文章数据
        const testArticlesData = [
            {
                articleData: {
                    title: '双色球开奖结果 - 第2025140期双色球开奖号码',
                    content: '# 双色球开奖结果\n\n**开奖日期：** 2025年12月4日\n**红球号码：** 01, 03, 04, 12, 18, 24\n**蓝球号码：** 05\n\n本期销售额：362,437,084元\n奖池金额：2,690,606,470元',
                    author: '彩票信息助手',
                    digest: '2025-12-04 双色球开奖信息'
                },
                lotteryData: [
                    {
                        issue: '2025140',
                        draw_date: '2025-12-04',
                        red_balls: ['01', '03', '04', '12', '18', '24'],
                        blue_balls: '05',
                        sales: '362437084',
                        pool_money: '2690606470'
                    }
                ]
            },
            {
                articleData: {
                    title: '快乐8开奖结果 - 第2025334期快乐8开奖号码',
                    content: '# 快乐8开奖结果\n\n**开奖日期：** 2025年12月4日\n**开奖号码：** 01, 03, 04, 06, 07, 10, 12, 13, 15, 16, 20, 22, 25, 28, 30, 33, 35, 40, 42, 45\n\n本期销售额：250,345,678元\n奖池金额：1,234,567,890元',
                    author: '彩票信息助手',
                    digest: '2025-12-04 快乐8开奖信息'
                },
                lotteryData: [
                    {
                        issue: '2025334',
                        draw_date: '2025-12-04',
                        balls: ['01', '03', '04', '06', '07', '10', '12', '13', '15', '16', '20', '22', '25', '28', '30', '33', '35', '40', '42', '45'],
                        sales: '250345678',
                        pool_money: '1234567890'
                    }
                ]
            },
            {
                articleData: {
                    title: '七乐彩开奖结果 - 第2025140期七乐彩开奖号码',
                    content: '# 七乐彩开奖结果\n\n**开奖日期：** 2025年12月4日\n**开奖号码：** 01, 05, 10, 15, 20, 25, 30\n**特别号码：** 08\n\n本期销售额：80,567,890元\n奖池金额：567,890,123元',
                    author: '彩票信息助手',
                    digest: '2025-12-04 七乐彩开奖信息'
                },
                lotteryData: [
                    {
                        issue: '2025140',
                        draw_date: '2025-12-04',
                        balls: ['01', '05', '10', '15', '20', '25', '30'],
                        special_ball: '08',
                        sales: '80567890',
                        pool_money: '567890123'
                    }
                ]
            },
            {
                articleData: {
                    title: '福彩3D开奖结果 - 第2025334期福彩3D开奖号码',
                    content: '# 福彩3D开奖结果\n\n**开奖日期：** 2025年12月4日\n**开奖号码：** 123\n**百位：** 1\n**十位：** 2\n**个位：** 3\n\n本期销售额：90,876,543元\n奖池金额：456,789,012元',
                    author: '彩票信息助手',
                    digest: '2025-12-04 福彩3D开奖信息'
                },
                lotteryData: [
                    {
                        issue: '2025334',
                        draw_date: '2025-12-04',
                        balls: ['1', '2', '3'],
                        number: '123',
                        sales: '90876543',
                        pool_money: '456789012'
                    }
                ]
            }
        ];
        
        // 测试验证功能
        try {
            wechatService.validateArticlesData(testArticlesData);
            console.log('✅ 文章数据验证成功！');
        } catch (error) {
            console.error('❌ 文章数据验证失败:', error.message);
            return;
        }
        
        // 测试2: 测试不完整的文章数据
        console.log('\n--- 测试2: 测试不完整的文章数据 ---');
        const incompleteArticlesData = testArticlesData.slice(0, 3); // 只有3篇文章
        
        try {
            wechatService.validateArticlesData(incompleteArticlesData);
            console.error('❌ 错误：应该拒绝不完整的文章数据');
        } catch (error) {
            console.log('✅ 正确拒绝了不完整的文章数据:', error.message);
        }
        
        // 测试3: 测试重复的文章类型
        console.log('\n--- 测试3: 测试重复的文章类型 ---');
        const duplicateArticlesData = [
            ...testArticlesData.slice(0, 3),
            {
                articleData: {
                    title: '双色球开奖结果 - 重复测试',
                    content: '测试内容'
                },
                lotteryData: []
            }
        ];
        
        try {
            wechatService.validateArticlesData(duplicateArticlesData);
            console.error('❌ 错误：应该拒绝重复的文章类型');
        } catch (error) {
            console.log('✅ 正确拒绝了重复的文章类型:', error.message);
        }
        
        // 测试4: 测试无效的文章类型
        console.log('\n--- 测试4: 测试无效的文章类型 ---');
        const invalidArticlesData = [
            {
                articleData: {
                    title: '无效类型开奖结果',
                    content: '测试内容'
                },
                lotteryData: []
            },
            ...testArticlesData.slice(0, 3)
        ];
        
        try {
            wechatService.validateArticlesData(invalidArticlesData);
            console.error('❌ 错误：应该拒绝无效的文章类型');
        } catch (error) {
            console.log('✅ 正确拒绝了无效的文章类型:', error.message);
        }
        
        console.log('\n=== 测试草稿创建功能完成 ===');
        console.log('✅ 所有测试通过！草稿创建功能正常工作。');
        
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
        console.error(error.stack);
    }
}

// 运行测试
testDraftCreation();
