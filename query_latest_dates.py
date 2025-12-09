import sys
import os

# 添加项目路径到Python路径
sys.path.append('/Users/eddie/工作空间/05workspace/01project/04mp_auto_push_caipiao/mp-auto-push/shuangseqiu/backend')

from models import get_db_connection

def query_latest_dates():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    print("最新的20个开奖日期：")
    cursor.execute('SELECT lr.draw_date FROM lottery_result lr ORDER BY lr.draw_date DESC LIMIT 20')
    rows = cursor.fetchall()
    
    for i, row in enumerate(rows, 1):
        print(f"{i}. {row[0]}")
    
    # 检查是否有12-08的数据
    print("\n检查2025-12-08的数据位置：")
    cursor.execute('SELECT COUNT(*) FROM lottery_result WHERE draw_date > ?', ('2025-12-08',))
    count_after = cursor.fetchone()[0]
    print(f"2025-12-08之后有{count_after}条数据")
    
    conn.close()

if __name__ == "__main__":
    query_latest_dates()