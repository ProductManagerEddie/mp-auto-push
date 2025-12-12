from crawler.crawler import LotteryCrawler
import time

# 创建爬虫实例
crawler = LotteryCrawler()

# 爬取所有彩票类型
lottery_types = ['kl8', 'qlc', '3d']
for lottery_type in lottery_types:
    print(f"开始爬取{lottery_type}数据...")
    try:
        result = crawler.crawl_lottery_data(lottery_type, page_size=10)
        print(f"{lottery_type}爬取结果: {result}条数据")
    except Exception as e:
        print(f"{lottery_type}爬取失败: {e}")
    print("-" * 50)

print("所有彩票类型爬取完成!")
