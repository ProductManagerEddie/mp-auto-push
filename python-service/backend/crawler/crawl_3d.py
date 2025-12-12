#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
手动爬取3D数据脚本，绕过今日爬取限制
"""

from crawler.crawler import LotteryCrawler
from models.models import get_lottery_type_id, save_lottery_result, log_crawl_task, mark_all_errors_as_fixed
import time
import random

def manual_crawl_3d():
    """手动爬取3D数据"""
    print("开始手动爬取3D数据...")
    
    crawler = LotteryCrawler()
    lottery_code = "3d"
    page_size = 30
    
    url = f"{crawler.base_url}?name={lottery_code}&issueCount=&issueStart=&issueEnd=&dayStart=&dayEnd=&pageNo=1&pageSize={page_size}&week=&systemType=PC"
    
    try:
        # 添加随机延迟
        delay = random.uniform(1, 3)
        print(f"等待{delay:.2f}秒后发送请求...")
        time.sleep(delay)
        
        # 更新请求头
        crawler._update_headers()
        
        # 发送请求
        response = crawler.session.get(url, timeout=15)
        response.raise_for_status()
        data = response.json()
        
        print(f"API响应状态: {data.get('state')}")
        print(f"获取到{len(data.get('result', []))}期数据")
        
        if data.get("state") == 0:
            result_list = data.get("result", [])
            print(f"成功获取到{len(result_list)}期{lottery_code}数据")
            
            # 获取彩票类型ID
            type_id = get_lottery_type_id(lottery_code)
            print(f"3D类型ID: {type_id}")
            
            if not type_id:
                print(f"未找到彩票类型：{lottery_code}")
                return 0
            
            # 处理每条开奖数据
            saved_count = 0
            for item in result_list:
                try:
                    # 解析日期
                    date_str = item.get("date", "")
                    if "(" in date_str:
                        draw_date = date_str.split("(")[0]
                    else:
                        draw_date = date_str
                    
                    # 解析红球（3D只有红球）
                    red_balls_str = item.get("red", "")
                    red_balls = red_balls_str.split(",") if red_balls_str else []
                    
                    # 构建结果字典
                    result = {
                        "type_id": type_id,
                        "issue": item.get("code", ""),
                        "draw_date": draw_date,
                        "red_balls": red_balls,
                        "blue_balls": None,
                        "sales": item.get("sales", ""),
                        "pool_money": item.get("poolmoney", ""),
                        "first_prize_count": 0,
                        "first_prize_amount": "",
                        "second_prize_count": 0,
                        "second_prize_amount": ""
                    }
                    
                    # 保存到数据库
                    save_lottery_result(result)
                    print(f"保存{lottery_code}期号：{result['issue']} 成功")
                    saved_count += 1
                except Exception as e:
                    print(f"处理{lottery_code}期号数据时出错：{e}")
                    continue
            
            # 记录成功的爬取任务
            log_crawl_task(lottery_code, "SUCCESS")
            
            # 标记错误为已修复
            print("爬取成功，自动将相关错误标记为已修复")
            fixed_count = mark_all_errors_as_fixed(lottery_code, "手动爬取成功，自动修复")
            print(f"成功修复了{fixed_count}个错误")
            
            return saved_count
        else:
            print(f"接口返回错误：{data.get('message', '未知错误')}")
            return 0
    except Exception as e:
        print(f"爬取3D数据时出错：{e}")
        return 0

if __name__ == "__main__":
    result = manual_crawl_3d()
    print(f"\n手动爬取完成，共保存{result}期3D数据")
