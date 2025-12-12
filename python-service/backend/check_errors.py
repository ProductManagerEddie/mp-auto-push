import sqlite3

# 连接数据库
conn = sqlite3.connect('lottery.db')
cursor = conn.cursor()

# 查询错误日志
print("爬取错误日志：")
cursor.execute('SELECT * FROM crawl_error LIMIT 10')
errors = cursor.fetchall()

for error in errors:
    print(f"ID: {error[0]}, 彩票类型: {error[1]}, 错误类型: {error[2]}, 错误信息: {error[3]}, 爬取时间: {error[4]}, 是否已修复: {'是' if error[5] == 1 else '否'}")

# 查询爬取任务日志
print("\n爬取任务日志：")
cursor.execute('SELECT * FROM crawl_task LIMIT 10')
tasks = cursor.fetchall()

for task in tasks:
    print(f"ID: {task[0]}, 彩票类型: {task[1]}, 爬取时间: {task[2]}, 状态: {task[3]}")

# 关闭数据库连接
conn.close()
