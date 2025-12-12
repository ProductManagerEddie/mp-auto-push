from apscheduler.schedulers.background import BackgroundScheduler
from crawler.crawler import LotteryCrawler

class LotteryScheduler:
    """彩票数据定时爬取调度器"""
    
    def __init__(self):
        self.scheduler = BackgroundScheduler()
        self.crawler = LotteryCrawler()
    
    def start(self):
        """启动定时任务"""
        # 每天10:20执行一次数据爬取
        self.scheduler.add_job(
            self.safe_crawl_all_lottery_data,
            'cron',
            hour=10,
            minute=20,
            id='daily_crawl',
            name='每日彩票数据爬取',
            replace_existing=True
        )
        
        # 添加一个立即执行的任务，用于初始化数据（只执行一次）
        from datetime import datetime
        self.scheduler.add_job(
            self.safe_crawl_all_lottery_data,
            'date',
            run_date=datetime.now(),
            id='initial_crawl',
            name='初始化彩票数据爬取',
            replace_existing=True,
            misfire_grace_time=30
        )
        
        self.scheduler.start()
        print("定时任务已启动")
    
    def safe_crawl_all_lottery_data(self):
        """安全爬取所有彩票数据，先检查是否有未修复的错误"""
        import logging
        from models.models import has_unfixed_errors
        
        # 配置日志
        logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
        logger = logging.getLogger(__name__)
        
        logger.info("开始执行安全爬取任务")
        
        # 检查是否有未修复的错误
        try:
            unfixed_errors = has_unfixed_errors()
            if unfixed_errors:
                logger.warning("存在未修复的爬取错误，跳过本次爬取任务")
                print("存在未修复的爬取错误，跳过本次爬取任务")
                return
            
            logger.info("所有已知爬取错误均已修复，开始执行爬取任务")
            print("所有已知爬取错误均已修复，开始执行爬取任务")
            self.crawler.crawl_all_lottery_data()
            logger.info("爬取任务执行完成")
        except Exception as e:
            logger.error(f"执行爬取任务时发生错误: {e}", exc_info=True)
            print(f"执行爬取任务时发生错误: {e}")
            return
    
    def stop(self):
        """停止定时任务"""
        self.scheduler.shutdown()
        print("定时任务已停止")
    
    def get_jobs(self):
        """获取所有定时任务"""
        return self.scheduler.get_jobs()
