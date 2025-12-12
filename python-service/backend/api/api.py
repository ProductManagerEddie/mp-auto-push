from flask import Blueprint, jsonify, request
from models.models import get_lottery_type_id, get_latest_results, get_all_results, get_db_connection

api_bp = Blueprint('api', __name__)

@api_bp.route('/lottery/<string:type_code>/latest', methods=['GET'])
def get_latest_lottery_results(type_code):
    """获取指定彩票类型的最新开奖结果"""
    # 获取查询参数
    limit = request.args.get('limit', default=10, type=int)
    
    # 获取彩票类型ID
    type_id = get_lottery_type_id(type_code)
    if not type_id:
        return jsonify({'error': 'Invalid lottery type'}), 400
    
    # 获取最新结果
    results = get_latest_results(type_id, limit)
    
    # 格式化结果
    formatted_results = []
    for result in results:
        formatted_results.append({
            'issue': result['issue'],
            'draw_date': result['draw_date'],
            'red_balls': result['red_balls'].split(','),
            'blue_balls': result['blue_balls'] if result['blue_balls'] else None,
            'sales': result['sales'],
            'pool_money': result['pool_money'],
            'first_prize_count': result['first_prize_count'],
            'first_prize_amount': result['first_prize_amount'],
            'second_prize_count': result['second_prize_count'],
            'second_prize_amount': result['second_prize_amount']
        })
    
    return jsonify({
        'success': True,
        'data': formatted_results,
        'count': len(formatted_results)
    })

@api_bp.route('/lottery/<string:type_code>/history', methods=['GET'])
def get_history_lottery_results(type_code):
    """获取指定彩票类型的历史开奖结果，支持分页"""
    # 获取查询参数
    page = request.args.get('page', default=1, type=int)
    limit = request.args.get('limit', default=20, type=int)
    offset = (page - 1) * limit
    
    # 获取彩票类型ID
    type_id = get_lottery_type_id(type_code)
    if not type_id:
        return jsonify({'error': 'Invalid lottery type'}), 400
    
    # 获取历史结果
    results = get_all_results(type_id, offset, limit)
    
    # 获取总记录数
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT COUNT(*) FROM lottery_result WHERE type_id = ?', (type_id,))
    total = cursor.fetchone()[0]
    conn.close()
    
    # 格式化结果
    formatted_results = []
    for result in results:
        formatted_results.append({
            'issue': result['issue'],
            'draw_date': result['draw_date'],
            'red_balls': result['red_balls'].split(','),
            'blue_balls': result['blue_balls'] if result['blue_balls'] else None,
            'sales': result['sales'],
            'pool_money': result['pool_money'],
            'first_prize_count': result['first_prize_count'],
            'first_prize_amount': result['first_prize_amount'],
            'second_prize_count': result['second_prize_count'],
            'second_prize_amount': result['second_prize_amount']
        })
    
    return jsonify({
        'success': True,
        'data': formatted_results,
        'count': len(formatted_results),
        'total': total,
        'page': page,
        'limit': limit
    })

@api_bp.route('/lottery/<string:type_code>/stats', methods=['GET'])
def get_lottery_stats(type_code):
    """获取指定彩票类型的统计数据"""
    # 获取彩票类型ID
    type_id = get_lottery_type_id(type_code)
    if not type_id:
        return jsonify({'error': 'Invalid lottery type'}), 400
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 计算红球频率
    cursor.execute('''
        SELECT ball, COUNT(*) as count
        FROM (
            SELECT TRIM(value) as ball
            FROM lottery_result, json_each(REPLACE(red_balls, ',', '|'))
            WHERE type_id = ?
        )
        GROUP BY ball
        ORDER BY count DESC, ball
    ''', (type_id,))
    red_ball_freq = {row[0]: row[1] for row in cursor.fetchall()}
    
    # 计算蓝球频率
    cursor.execute('''
        SELECT TRIM(value) as ball, COUNT(*) as count
        FROM (
            SELECT TRIM(value) as ball
            FROM lottery_result, json_each(REPLACE(blue_balls, ',', '|'))
            WHERE type_id = ? AND blue_balls IS NOT NULL
        )
        GROUP BY ball
        ORDER BY count DESC, ball
    ''', (type_id,))
    blue_ball_freq = {row[0]: row[1] for row in cursor.fetchall()}
    
    # 获取最近5期号码
    cursor.execute('''
        SELECT issue, red_balls, blue_balls
        FROM lottery_result
        WHERE type_id = ?
        ORDER BY draw_date DESC
        LIMIT 5
    ''', (type_id,))
    recent_results = []
    for row in cursor.fetchall():
        recent_results.append({
            'issue': row[0],
            'red_balls': row[1].split(','),
            'blue_balls': row[2] if row[2] else None
        })
    
    conn.close()
    
    return jsonify({
        'success': True,
        'data': {
            'red_ball_frequency': red_ball_freq,
            'blue_ball_frequency': blue_ball_freq,
            'recent_results': recent_results
        }
    })

@api_bp.route('/lottery/types', methods=['GET'])
def get_lottery_types():
    """获取所有支持的彩票类型"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT id, name, code, description FROM lottery_type')
    types = cursor.fetchall()
    conn.close()
    
    # 格式化结果
    formatted_types = []
    for type_item in types:
        formatted_types.append({
            'id': type_item['id'],
            'name': type_item['name'],
            'code': type_item['code'],
            'description': type_item['description']
        })
    
    return jsonify({
        'success': True,
        'data': formatted_types
    })

@api_bp.route('/admin/cleanup', methods=['POST'])
def cleanup_data():
    """手动触发数据清理任务"""
    from models.models import clean_old_data
    
    result = clean_old_data()
    
    if result['status'] == 'success':
        return jsonify({
            'success': True,
            'message': result['message'],
            'deleted_rows': result['deleted_rows'],
            'backup_file': result['backup_file']
        })
    else:
        return jsonify({
            'success': False,
            'message': result['message']
        }), 500

@api_bp.route('/admin/cleanup/logs', methods=['GET'])
def get_cleanup_logs_api():
    """获取数据清理日志"""
    from models.models import get_cleanup_logs
    
    limit = request.args.get('limit', default=20, type=int)
    logs = get_cleanup_logs(limit)
    
    return jsonify({
        'success': True,
        'data': logs,
        'count': len(logs)
    })

@api_bp.route('/crawl')
def crawl_data():
    """手动触发数据爬取"""
    try:
        from crawler.crawler import LotteryCrawler
        import time
        start_time = time.time()
        
        crawler = LotteryCrawler()
        # 爬取所有彩票类型
        lottery_types = ['ssq', 'kl8', '3d', 'qlc']
        result = {}
        for lottery_type in lottery_types:
            print(f"开始爬取{lottery_type}数据...")
            try:
                data = crawler.crawl_lottery_data(lottery_type, page_size=5)
                result[lottery_type] = {"status": "success", "data": len(data) if isinstance(data, list) else data}
            except Exception as e:
                result[lottery_type] = {"status": "error", "message": str(e)}
        
        elapsed_time = time.time() - start_time
        print(f"爬取完成，耗时：{elapsed_time:.2f}秒")
        
        return {
            "status": "success", 
            "message": "数据爬取完成", 
            "result": result, 
            "elapsed_time": elapsed_time
        }
    except Exception as e:
        return {
            "status": "error", 
            "message": f"爬取失败：{str(e)}"
        }, 500
