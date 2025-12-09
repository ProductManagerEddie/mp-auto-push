import sys
import os

# 添加项目路径到Python路径
sys.path.append('/Users/eddie/工作空间/05workspace/01project/04mp_auto_push_caipiao/mp-auto-push/shuangseqiu/backend')

from models import get_db_connection

def check_db_status():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    print("最近的爬取任务：")
    cursor.execute('SELECT * FROM crawl_task ORDER BY crawl_time DESC LIMIT 10')
    rows = cursor.fetchall()
    for row in rows:
        print(f"ID: {row['id']}, 彩票代码: {row['lottery_code']}, 状态: {row['status']}, 爬取时间: {row['crawl_time']}")
    
    print("\n未修复的错误：")
    cursor.execute('SELECT * FROM crawl_error WHERE is_fixed = 0 ORDER BY crawl_time DESC LIMIT 10')
    rows = cursor.fetchall()
    for row in rows:
        print(row)
    
    print("\n最近的开奖结果：")
    cursor.execute('SELECT lr.*, lt.name, lt.code FROM lottery_result lr JOIN lottery_type lt ON lr.type_id = lt.id ORDER BY lr.draw_date DESC LIMIT 20')
    rows = cursor.fetchall()
    for row in rows:
        print(f"ID: {row['id']}, 名称: {row['name']}, 代码: {row['code']}, 期号: {row['issue']}, 日期: {row['draw_date']}")
    
    conn.close()

if __name__ == "__main__":
    check_db_status()