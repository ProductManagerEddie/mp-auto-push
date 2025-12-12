# 应用配置
class Config:
    # 数据库配置
    DATABASE_FILE = 'lottery.db'
    
    # 爬虫配置
    CRAWLER_TIMEOUT = 15
    CRAWLER_HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Referer": "https://www.cwl.gov.cn/",
        "X-Requested-With": "XMLHttpRequest"
    }
    
    # 定时任务配置
    CRAWL_TIME = {
        "hour": 22,
        "minute": 30
    }
    
    # API配置
    API_RATE_LIMIT = 100  # 每分钟请求次数限制
    
    # 应用配置
    DEBUG = True
    HOST = '0.0.0.0'
    PORT = 5000
