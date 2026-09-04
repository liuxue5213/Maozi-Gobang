/**
 * PM2 进程管理配置
 * 使用: pm2 start ecosystem.config.js
 */

module.exports = {
  apps: [
    {
      name: 'maozi-gobang',
      script: './src/index.js',
      cwd: '/opt/maozi-gobang',
      // 游戏房间状态在内存中，必须单实例 fork 模式
      // (cluster 模式会导致在线匹配跨进程失效、polling 升级间歇失败)
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      // 日志配置
      log_file: '/var/log/maozi-gobang/combined.log',
      out_file: '/var/log/maozi-gobang/out.log',
      error_file: '/var/log/maozi-gobang/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      // 自动重启
      autorestart: true,
      // 优雅关闭
      kill_timeout: 5000,
      listen_timeout: 10000,
      // 最大重启次数
      max_restarts: 10,
      min_uptime: '10s',
    },
  ],
};
