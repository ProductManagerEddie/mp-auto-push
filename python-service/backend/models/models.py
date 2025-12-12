import sqlite3
import os

# 数据库文件路径，与Node.js后端保持一致
DB_FILE = '/Users/eddie/工作空间/05workspace/01project/04mp_auto_push_caipiao/mp-auto-push/python-service/backend/lottery.db'

def init_db():
    """初始化数据库，创建必要的数据表"""
    try:
        # 确保/tmp目录存在且可写
        if not os.path.exists('/tmp'):
            os.makedirs('/tmp')
        
        # 尝试创建或连接数据库
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        
        # 设置事务为只读模式，尝试先进行表结构检查
        cursor.execute('PRAGMA read_uncommitted = 1')
        
        # 检查表是否存在，不存在则创建
        tables_to_create = {
            'lottery_type': '''
                CREATE TABLE IF NOT EXISTS lottery_type (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    code TEXT NOT NULL UNIQUE,
                    description TEXT
                )
            ''',
            'lottery_result': '''
                CREATE TABLE IF NOT EXISTS lottery_result (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    type_id INTEGER NOT NULL,
                    issue TEXT NOT NULL,
                    draw_date TEXT NOT NULL,
                    red_balls TEXT NOT NULL,
                    blue_balls TEXT,
                    sales TEXT,
                    pool_money TEXT,
                    first_prize_count INTEGER,
                    first_prize_amount TEXT,
                    second_prize_count INTEGER,
                    second_prize_amount TEXT,
                    FOREIGN KEY (type_id) REFERENCES lottery_type(id),
                    UNIQUE(type_id, issue)
                )
            ''',
            'crawl_error': '''
                CREATE TABLE IF NOT EXISTS crawl_error (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    lottery_code TEXT NOT NULL,
                    error_type TEXT NOT NULL,
                    error_message TEXT NOT NULL,
                    crawl_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    is_fixed INTEGER DEFAULT 0,
                    fix_time TIMESTAMP,
                    fix_note TEXT
                )
            ''',
            'crawl_task': '''
                CREATE TABLE IF NOT EXISTS crawl_task (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    lottery_code TEXT NOT NULL,
                    crawl_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    status TEXT NOT NULL
                )
            ''',
            'cleanup_log': '''
                CREATE TABLE IF NOT EXISTS cleanup_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    cleanup_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    deleted_rows INTEGER,
                    backup_file TEXT,
                    status TEXT,
                    error_message TEXT
                )
            '''
        }
        
        # 逐个创建表，捕获写入错误
        for table_name, create_sql in tables_to_create.items():
            try:
                cursor.execute(create_sql)
            except sqlite3.OperationalError as e:
                if "readonly" in str(e).lower():
                    print(f"警告：无法创建表{table_name}，可能是只读环境")
                    break
                else:
                    raise
        
        # 插入初始彩票类型数据，使用try-except捕获写入错误
        lottery_types = [
            ('双色球', 'ssq', '每周二、四、日21:15开奖'),
            ('快乐8', 'kl8', '每日21:30开奖'),
            ('七乐彩', 'qlc', '每周一、三、五21:15开奖'),
            ('福彩3D', '3d', '每日21:15开奖')
        ]
        
        try:
            cursor.executemany('''
                INSERT OR IGNORE INTO lottery_type (name, code, description) VALUES (?, ?, ?)
            ''', lottery_types)
            conn.commit()
            conn.close()
            print("数据库初始化完成")
        except sqlite3.OperationalError as e:
            if "readonly" in str(e).lower():
                print(f"警告：无法插入初始数据，可能是只读环境：{e}")
                conn.close()
                # 尝试只读连接
                try:
                    conn = sqlite3.connect(f'file:{DB_FILE}?mode=ro', uri=True)
                    conn.close()
                    print("只读连接成功，数据库初始化完成（只读模式）")
                except Exception as ro_error:
                    print(f"只读连接也失败: {ro_error}")
                    print("数据库功能可能无法正常使用")
            else:
                raise
    except sqlite3.OperationalError as e:
        print(f"数据库初始化警告: {e}")
        print("可能是因为在只读环境中运行，某些功能可能受限")
        # 在只读环境中，尝试只读连接，不执行写入操作
        try:
            conn = sqlite3.connect(f'file:{DB_FILE}?mode=ro', uri=True)
            conn.close()
            print("只读连接成功，数据库初始化完成（只读模式）")
        except Exception as ro_error:
            print(f"只读连接也失败: {ro_error}")
            print("数据库功能可能无法正常使用")
    except Exception as e:
        print(f"数据库初始化失败: {e}")
        import traceback
        traceback.print_exc()

def get_db_connection(read_only=False):
    """获取数据库连接"""
    try:
        if read_only:
            conn = sqlite3.connect(f'file:{DB_FILE}?mode=ro', uri=True)
        else:
            conn = sqlite3.connect(DB_FILE)
        conn.row_factory = sqlite3.Row
        return conn
    except sqlite3.OperationalError as e:
        if "readonly" in str(e).lower():
            print(f"警告：无法获取读写连接，尝试只读连接：{e}")
            try:
                conn = sqlite3.connect(f'file:{DB_FILE}?mode=ro', uri=True)
                conn.row_factory = sqlite3.Row
                return conn
            except Exception as ro_error:
                print(f"只读连接也失败: {ro_error}")
                raise
        else:
            raise

def get_lottery_type_id(code):
    """根据彩票类型代码获取类型ID"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT id FROM lottery_type WHERE code = ?', (code,))
    result = cursor.fetchone()
    conn.close()
    return result['id'] if result else None

def save_lottery_result(result):
    """保存彩票开奖结果到数据库"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        INSERT OR REPLACE INTO lottery_result (
            type_id, issue, draw_date, red_balls, blue_balls, sales, pool_money,
            first_prize_count, first_prize_amount, second_prize_count, second_prize_amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        result['type_id'],
        result['issue'],
        result['draw_date'],
        ','.join(result['red_balls']),
        result['blue_balls'] or '',
        result['sales'] or '',
        result['pool_money'] or '',
        result['first_prize_count'] or 0,
        result['first_prize_amount'] or '',
        result['second_prize_count'] or 0,
        result['second_prize_amount'] or ''
    ))
    
    conn.commit()
    conn.close()

def get_latest_results(lottery_type_id, limit=10):
    """获取最新的开奖结果"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT * FROM lottery_result WHERE type_id = ? ORDER BY draw_date DESC LIMIT ?
    ''', (lottery_type_id, limit))
    results = cursor.fetchall()
    conn.close()
    return results

def get_all_results(lottery_type_id, offset=0, limit=20):
    """获取所有开奖结果，支持分页"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT * FROM lottery_result WHERE type_id = ? ORDER BY draw_date DESC LIMIT ? OFFSET ?
    ''', (lottery_type_id, limit, offset))
    results = cursor.fetchall()
    conn.close()
    return results

def get_result_by_issue(lottery_type_id, issue):
    """根据期号获取开奖结果"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT * FROM lottery_result WHERE type_id = ? AND issue = ?
    ''', (lottery_type_id, issue))
    result = cursor.fetchone()
    conn.close()
    return result

def log_crawl_error(lottery_code, error_type, error_message):
    """记录爬取错误"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO crawl_error (lottery_code, error_type, error_message)
        VALUES (?, ?, ?)
    ''', (lottery_code, error_type, error_message))
    conn.commit()
    conn.close()

def has_unfixed_errors(lottery_code=None):
    """检查是否有未修复的错误"""
    import logging
    
    # 配置日志
    logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
    logger = logging.getLogger(__name__)
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        if lottery_code:
            logger.info(f"检查{lottery_code}是否有未修复的错误")
            cursor.execute('''
                SELECT COUNT(*) FROM crawl_error
                WHERE is_fixed = 0 AND lottery_code = ?
            ''', (lottery_code,))
        else:
            logger.info("检查所有彩票类型是否有未修复的错误")
            cursor.execute('''
                SELECT COUNT(*) FROM crawl_error
                WHERE is_fixed = 0
            ''')
        count = cursor.fetchone()[0]
        conn.close()
        logger.info(f"未修复的错误数量: {count}")
        return count > 0
    except Exception as e:
        logger.error(f"检查未修复错误时发生错误: {e}", exc_info=True)
        print(f"检查未修复错误时发生错误: {e}")
        return False

def mark_error_as_fixed(error_id, fix_note=""):
    """标记错误为已修复"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE crawl_error
        SET is_fixed = 1, fix_time = CURRENT_TIMESTAMP, fix_note = ?
        WHERE id = ?
    ''', (fix_note, error_id))
    conn.commit()
    conn.close()

def mark_all_errors_as_fixed(lottery_code, fix_note=""):
    """自动修复指定彩票类型的所有错误"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE crawl_error
        SET is_fixed = 1, fix_time = CURRENT_TIMESTAMP, fix_note = ?
        WHERE lottery_code = ? AND is_fixed = 0
    ''', (fix_note, lottery_code))
    affected_rows = cursor.rowcount
    conn.commit()
    conn.close()
    return affected_rows

def can_crawl_today(lottery_code, force=False):
    """检查今天是否需要爬取该彩票数据"""
    if force:
        return True
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 获取今天的本地日期
    today = conn.execute("SELECT DATE('now', 'localtime')").fetchone()[0]
    
    # 检查今天是否有成功的爬取记录
    cursor.execute('''
        SELECT COUNT(*) FROM crawl_task
        WHERE DATE(crawl_time, 'localtime') = ? AND lottery_code = ? AND status = 'SUCCESS'
    ''', (today, lottery_code))
    success_count = cursor.fetchone()[0]
    
    if success_count > 0:
        conn.close()
        return False
    
    conn.close()
    return True

def log_crawl_task(lottery_code, status):
    """记录爬取任务"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO crawl_task (lottery_code, status)
        VALUES (?, ?)
    ''', (lottery_code, status))
    conn.commit()
    conn.close()

# 数据库自动清理相关功能
def backup_database():
    """备份数据库文件"""
    import shutil
    import datetime
    
    try:
        # 在Serverless环境中，只能使用/tmp目录进行写入操作
        backup_dir = os.path.join('/tmp', 'backups')
        if not os.path.exists(backup_dir):
            os.makedirs(backup_dir)
        
        # 生成备份文件名
        backup_file = os.path.join(backup_dir, f'lottery_backup_{datetime.datetime.now().strftime("%Y%m%d_%H%M%S")}.db')
        
        # 复制数据库文件
        shutil.copy2(DB_FILE, backup_file)
        
        print(f"数据库备份成功：{backup_file}")
        return backup_file
    except Exception as e:
        print(f"数据库备份失败：{str(e)}")
        return None

def clean_old_data():
    """清理一年前的彩票数据，只保留最近一年的数据"""
    import datetime
    import logging
    
    # 配置日志
    log_file = os.path.join('/tmp', 'cleanup.log')  # 使用/tmp目录存储日志文件
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(log_file),
            logging.StreamHandler()
        ]
    )
    logger = logging.getLogger('lottery_cleanup')
    
    try:
        logger.info("开始执行数据清理任务")
        
        # 1. 备份数据库
        backup_file = backup_database()
        if backup_file:
            logger.info(f"数据库备份成功：{backup_file}")
        else:
            logger.warning("数据库备份失败，继续执行清理任务")
        
        # 2. 计算一年前的日期
        one_year_ago = datetime.datetime.now() - datetime.timedelta(days=365)
        one_year_ago_str = one_year_ago.strftime("%Y-%m-%d")
        logger.info(f"清理{one_year_ago_str}之前的数据")
        
        # 3. 执行数据清理
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # 尝试清理彩票结果数据
        try:
            cursor.execute('''
                DELETE FROM lottery_result
                WHERE draw_date < ?
            ''', (one_year_ago_str,))
            deleted_rows = cursor.rowcount
            conn.commit()
            
            logger.info(f"成功清理{deleted_rows}条过期数据")
        except sqlite3.OperationalError as e:
            if "readonly" in str(e).lower():
                logger.warning(f"无法执行数据清理，数据库为只读：{e}")
                deleted_rows = 0
                conn.rollback()
            else:
                raise
        
        # 4. 记录清理任务到数据库（创建清理日志表）
        try:
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS cleanup_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    cleanup_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    deleted_rows INTEGER,
                    backup_file TEXT,
                    status TEXT,
                    error_message TEXT
                )
            ''')
            
            cursor.execute('''
                INSERT INTO cleanup_log (deleted_rows, backup_file, status, error_message)
                VALUES (?, ?, ?, ?)
            ''', (deleted_rows, backup_file, "success", ""))
            conn.commit()
        except sqlite3.OperationalError as e:
            if "readonly" in str(e).lower():
                logger.warning(f"无法记录清理日志，数据库为只读：{e}")
                conn.rollback()
            else:
                raise
        
        conn.close()
        
        logger.info("数据清理任务执行完成")
        return {
            "status": "success",
            "deleted_rows": deleted_rows,
            "backup_file": backup_file,
            "message": "数据清理完成"
        }
    except Exception as e:
        logger.error(f"数据清理失败：{str(e)}")
        
        # 记录错误日志到数据库
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS cleanup_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    cleanup_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    deleted_rows INTEGER,
                    backup_file TEXT,
                    status TEXT,
                    error_message TEXT
                )
            ''')
            
            cursor.execute('''
                INSERT INTO cleanup_log (deleted_rows, backup_file, status, error_message)
                VALUES (?, ?, ?, ?)
            ''', (0, backup_file, "error", str(e)))
            conn.commit()
            conn.close()
        except Exception as db_error:
            logger.error(f"记录清理日志失败：{str(db_error)}")
        
        return {
            "status": "error",
            "deleted_rows": 0,
            "backup_file": backup_file,
            "message": f"数据清理失败：{str(e)}"
        }

def get_cleanup_logs(limit=20):
    """获取清理日志"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT id, cleanup_time, deleted_rows, backup_file, status, error_message
        FROM cleanup_log
        ORDER BY cleanup_time DESC
        LIMIT ?
    ''', (limit,))
    
    logs = cursor.fetchall()
    conn.close()
    
    return [{"id": log["id"], "cleanup_time": log["cleanup_time"], "deleted_rows": log["deleted_rows"], "backup_file": log["backup_file"], "status": log["status"], "error_message": log["error_message"]} for log in logs]

# 初始化数据库
if __name__ == '__main__':
    init_db()
    print("数据库初始化完成！")
