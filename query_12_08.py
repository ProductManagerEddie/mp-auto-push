import sys
import os

# 添加项目路径到Python路径
sys.path.append('/Users/eddie/工作空间/05workspace/01project/04mp_auto_push_caipiao/mp-auto-push/shuangseqiu/backend')

from models import get_db_connection

def query_12_08_data():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    print("查询2025-12-08的开奖数据：")
    cursor.execute('SELECT lr.*, lt.name, lt.code FROM lottery_result lr JOIN lottery_type lt ON lr.type_id = lt.id WHERE lr.draw_date = ? ORDER BY lt.code', ('2025-12-08',))
    rows = cursor.fetchall()
    
    print(f"共找到{len(rows)}条数据：")
    for row in rows:
        print(f"ID: {row[0]}, 名称: {row[-2]}, 代码: {row[-1]}, 期号: {row[2]}, 日期: {row[3]}")
    
    conn.close()

if __name__ == "__main__":
    query_12_08_data()