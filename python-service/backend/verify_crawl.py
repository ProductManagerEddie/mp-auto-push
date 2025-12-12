#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
爬取数据验证脚本
用于验证爬取数据的完整性、准确性和完整性
"""

import sqlite3
import datetime

class CrawlVerifier:
    """爬取数据验证类"""
    
    def __init__(self, db_file='lottery.db'):
        """初始化验证器"""
        self.db_file = db_file
        self.conn = sqlite3.connect(db_file)
        self.cursor = self.conn.cursor()
        
    def __del__(self):
        """销毁验证器，关闭数据库连接"""
        if hasattr(self, 'conn'):
            self.conn.close()
    
    def verify_lottery_types(self):
        """验证彩票类型数据"""
        print("=== 验证彩票类型数据 ===")
        
        self.cursor.execute('SELECT * FROM lottery_type')
        types = self.cursor.fetchall()
        
        expected_types = ['ssq', 'kl8', 'qlc', '3d']
        actual_types = [row[2] for row in types]
        
        print(f"预期彩票类型: {expected_types}")
        print(f"实际彩票类型: {actual_types}")
        
        # 检查是否有缺失的类型
        missing_types = [t for t in expected_types if t not in actual_types]
        if missing_types:
            print(f"❌ 缺失彩票类型: {missing_types}")
        else:
            print("✅ 所有彩票类型都已存在")
        
        return {
            'expected_count': len(expected_types),
            'actual_count': len(actual_types),
            'missing_types': missing_types
        }
    
    def verify_lottery_results(self):
        """验证彩票结果数据"""
        print("\n=== 验证彩票结果数据 ===")
        
        # 获取所有彩票类型
        self.cursor.execute('SELECT id, code FROM lottery_type')
        types = self.cursor.fetchall()
        
        results = {}
        for type_id, type_code in types:
            print(f"\n--- 验证{type_code}数据 ---")
            
            # 获取该类型的所有结果
            self.cursor.execute('''
                SELECT * FROM lottery_result 
                WHERE type_id = ? 
                ORDER BY draw_date DESC
            ''', (type_id,))
            results_list = self.cursor.fetchall()
            
            result_count = len(results_list)
            print(f"共获取到{result_count}期{type_code}数据")
            
            if result_count == 0:
                print(f"❌ {type_code}没有爬取到任何数据")
                results[type_code] = {
                    'count': 0,
                    'latest_date': None,
                    'has_missing_fields': True,
                    'has_duplicates': False,
                    'error_fields': []
                }
                continue
            
            # 检查最新数据的日期
            latest_date = results_list[0][3]
            print(f"最新一期数据日期: {latest_date}")
            
            # 检查是否有缺失的关键字段
            missing_fields = []
            for idx, result in enumerate(results_list[:10]):
                issue = result[2]
                draw_date = result[3]
                red_balls = result[4]
                
                if not issue:
                    missing_fields.append(f"第{idx+1}期缺失期号")
                if not draw_date:
                    missing_fields.append(f"第{idx+1}期缺失日期")
                if not red_balls:
                    missing_fields.append(f"第{idx+1}期缺失红球")
            
            # 检查是否有重复数据
            self.cursor.execute('''
                SELECT issue, COUNT(*) FROM lottery_result 
                WHERE type_id = ? 
                GROUP BY issue 
                HAVING COUNT(*) > 1
            ''', (type_id,))
            duplicates = self.cursor.fetchall()
            
            if duplicates:
                print(f"❌ {type_code}存在重复数据: {duplicates}")
            else:
                print(f"✅ {type_code}没有重复数据")
            
            if missing_fields:
                print(f"❌ {type_code}存在缺失字段: {missing_fields[:5]}...")
            else:
                print(f"✅ {type_code}关键字段完整")
            
            results[type_code] = {
                'count': result_count,
                'latest_date': latest_date,
                'has_missing_fields': len(missing_fields) > 0,
                'has_duplicates': len(duplicates) > 0,
                'error_fields': missing_fields
            }
        
        return results
    
    def verify_crawl_tasks(self):
        """验证爬取任务日志"""
        print("\n=== 验证爬取任务日志 ===")
        
        self.cursor.execute('SELECT * FROM crawl_task ORDER BY crawl_time DESC')
        tasks = self.cursor.fetchall()
        
        print(f"共记录了{len(tasks)}个爬取任务")
        
        if len(tasks) > 0:
            latest_task = tasks[0]
            print(f"最新任务: 彩票类型={latest_task[1]}, 状态={latest_task[3]}, 时间={latest_task[2]}")
        
        # 统计成功和失败的任务数
        self.cursor.execute('SELECT status, COUNT(*) FROM crawl_task GROUP BY status')
        status_counts = self.cursor.fetchall()
        print("任务状态分布:")
        for status, count in status_counts:
            print(f"  {status}: {count}个")
        
        return {
            'total_tasks': len(tasks),
            'status_counts': dict(status_counts)
        }
    
    def verify_crawl_errors(self):
        """验证爬取错误日志"""
        print("\n=== 验证爬取错误日志 ===")
        
        # 统计未修复的错误
        self.cursor.execute('SELECT COUNT(*) FROM crawl_error WHERE is_fixed = 0')
        unfixed_count = self.cursor.fetchone()[0]
        
        # 统计已修复的错误
        self.cursor.execute('SELECT COUNT(*) FROM crawl_error WHERE is_fixed = 1')
        fixed_count = self.cursor.fetchone()[0]
        
        print(f"未修复的错误: {unfixed_count}个")
        print(f"已修复的错误: {fixed_count}个")
        print(f"总错误数: {unfixed_count + fixed_count}个")
        
        # 统计错误类型
        self.cursor.execute('SELECT error_type, COUNT(*) FROM crawl_error GROUP BY error_type')
        error_types = self.cursor.fetchall()
        print("错误类型分布:")
        for error_type, count in error_types:
            print(f"  {error_type}: {count}个")
        
        # 获取未修复的错误详情
        self.cursor.execute('SELECT * FROM crawl_error WHERE is_fixed = 0 LIMIT 5')
        unfixed_errors = self.cursor.fetchall()
        if unfixed_errors:
            print("未修复的错误详情:")
            for error in unfixed_errors:
                print(f"  ID: {error[0]}, 类型: {error[1]}, 错误类型: {error[2]}, 时间: {error[4]}")
        
        return {
            'unfixed_count': unfixed_count,
            'fixed_count': fixed_count,
            'total_errors': unfixed_count + fixed_count,
            'error_types': dict(error_types)
        }
    
    def run_full_verification(self):
        """运行完整验证"""
        print("===== 爬取数据验证报告 ====")
        print(f"验证时间: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"数据库文件: {self.db_file}")
        
        verification_results = {
            'verification_time': datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'lottery_types': self.verify_lottery_types(),
            'lottery_results': self.verify_lottery_results(),
            'crawl_tasks': self.verify_crawl_tasks(),
            'crawl_errors': self.verify_crawl_errors()
        }
        
        print("\n===== 验证总结 ====")
        
        # 计算总分数
        total_score = 0
        max_score = 100
        
        # 验证彩票类型（20分）
        if not verification_results['lottery_types']['missing_types']:
            total_score += 20
        else:
            total_score += 20 - len(verification_results['lottery_types']['missing_types']) * 5
        
        # 验证彩票结果（40分）
        for type_code, result in verification_results['lottery_results'].items():
            if result['count'] > 0:
                total_score += 10
                if not result['has_missing_fields']:
                    total_score += 5
                if not result['has_duplicates']:
                    total_score += 5
        
        # 验证爬取任务（20分）
        if verification_results['crawl_tasks']['total_tasks'] > 0:
            total_score += 10
        if 'SUCCESS' in verification_results['crawl_tasks']['status_counts']:
            total_score += 10
        
        # 验证爬取错误（20分）
        if verification_results['crawl_errors']['unfixed_count'] == 0:
            total_score += 20
        else:
            total_score += max(0, 20 - verification_results['crawl_errors']['unfixed_count'] * 5)
        
        print(f"验证得分: {total_score}/{max_score}")
        
        # 生成建议
        print("\n===== 建议 ====")
        if verification_results['crawl_errors']['unfixed_count'] > 0:
            print(f"1. 有{verification_results['crawl_errors']['unfixed_count']}个未修复的错误，建议及时修复")
        
        for type_code, result in verification_results['lottery_results'].items():
            if result['count'] == 0:
                print(f"2. {type_code}没有爬取到任何数据，建议检查爬取配置")
            if result['has_missing_fields']:
                print(f"3. {type_code}存在缺失字段，建议检查数据解析逻辑")
            if result['has_duplicates']:
                print(f"4. {type_code}存在重复数据，建议检查去重逻辑")
        
        if verification_results['crawl_tasks']['total_tasks'] == 0:
            print(f"5. 没有记录到爬取任务，建议检查调度配置")
        
        print("\n===== 验证完成 ====")
        
        return verification_results

if __name__ == '__main__':
    verifier = CrawlVerifier()
    verifier.run_full_verification()
