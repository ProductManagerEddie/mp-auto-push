module.exports = {
  apps: [{
    name: 'mp-auto-push',
    script: 'src/server/daemon.js',
    args: 'start',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    },
    env_development: {
      NODE_ENV: 'development'
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true,
    cron_restart: '0 4 * * *', // 每天凌晨4点重启
    min_uptime: '10s',
    max_restarts: 10,
    restart_delay: 4000
  }]
};