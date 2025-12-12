import sys
import os
import logging

# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# 添加backend目录到Python搜索路径
base_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, base_dir)
logger.info(f"添加到Python路径: {base_dir}")
logger.info(f"当前工作目录: {os.getcwd()}")
logger.info(f"环境变量: {os.environ}")

# 尝试导入所有依赖
logger.info("开始导入依赖...")
try:
    from flask import Flask
    logger.info("成功导入Flask")
except Exception as e:
    logger.error(f"导入Flask失败: {e}")
    raise

try:
    from flask_cors import CORS
    logger.info("成功导入Flask-CORS")
except Exception as e:
    logger.error(f"导入Flask-CORS失败: {e}")
    raise

try:
    from models.models import init_db, clean_old_data
    logger.info("成功导入models")
except Exception as e:
    logger.error(f"导入models失败: {e}")
    raise

try:
    from api.api import api_bp
    logger.info("成功导入api_bp")
except Exception as e:
    logger.error(f"导入api_bp失败: {e}")
    raise

try:
    from scheduler import LotteryScheduler
    logger.info("成功导入LotteryScheduler")
except Exception as e:
    logger.error(f"导入LotteryScheduler失败: {e}")
    raise

try:
    from apscheduler.schedulers.background import BackgroundScheduler
    logger.info("成功导入APScheduler")
except Exception as e:
    logger.error(f"导入APScheduler失败: {e}")
    raise

try:
    from crawler.crawler import LotteryCrawler
    logger.info("成功导入LotteryCrawler")
except Exception as e:
    logger.error(f"导入LotteryCrawler失败: {e}")
    raise

# 创建Flask应用
app = Flask(__name__)
logger.info("Flask应用创建成功")

# 配置CORS，允许前端跨域访问
CORS(app, resources={r"/api/*": {"origins": "*"}})
logger.info("CORS配置成功")

# 注册API蓝图
app.register_blueprint(api_bp, url_prefix='/api')
logger.info("API蓝图注册成功")

# 初始化数据库
try:
    init_db()
    logger.info("数据库初始化成功")
except Exception as e:
    logger.error(f"数据库初始化失败: {e}")
    # 继续运行，即使数据库初始化失败

# 设置定时数据清理任务
try:
    # 在Serverless环境中，APScheduler的cron任务可能无法正常工作
    # 只在本地环境中启动调度器
    if not os.environ.get('VERCEL_ENV'):
        logger.info("本地环境，启动APScheduler")
        # 创建后台调度器
        scheduler = BackgroundScheduler()
        
        # 添加每周执行一次的清理任务（每周凌晨2点执行）
        scheduler.add_job(
            clean_old_data, 
            'cron', 
            day_of_week='sun', 
            hour=2, 
            minute=0,
            id='clean_old_data_job',
            replace_existing=True
        )
        
        # 启动调度器
        scheduler.start()
        logger.info("数据清理定时任务已启动，每周日凌晨2点执行")
    else:
        logger.info("Serverless环境，跳过APScheduler启动")
except Exception as e:
    logger.error(f"启动定时任务失败：{str(e)}")
    logger.info("在Serverless环境中，定时任务可能需要外部触发")

# 手动触发爬取的API接口已移至api.py蓝图中

@app.route('/')
def index():
    """应用首页"""
    logger.info("收到根路径请求")
    return "彩票数据API服务正在运行中..."

@app.route('/health')
def health_check():
    """健康检查接口"""
    logger.info("收到健康检查请求")
    try:
        # 尝试进行简单的数据库查询，验证数据库连接
        from models.models import get_db_connection
        conn = get_db_connection(read_only=True)
        cursor = conn.cursor()
        cursor.execute('SELECT 1')
        cursor.fetchone()
        conn.close()
        return {"status": "ok", "database": "connected"}
    except Exception as e:
        logger.error(f"健康检查数据库连接失败：{e}")
        # 即使数据库连接失败，也返回基本的健康状态
        return {"status": "ok", "database": f"error: {str(e)}"}

# 在Vercel环境中，应用通过WSGI调用，不需要直接运行
# 但仍需要保留__main__块用于本地开发
if __name__ == '__main__':
    # 获取端口号，默认8080
    port = int(os.environ.get('PORT', 8080))
    logger.info(f"启动应用，端口：{port}")
    # 启动应用
    app.run(host='0.0.0.0', port=port, debug=True)
    logger.info("应用已启动")
