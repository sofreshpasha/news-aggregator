module.exports = {
  apps: [
    {
      name: 'news-aggregator',
      script: 'src/index.js',
      
      // Автоперезапуск
      autorestart: true,
      watch: false,
      max_restarts: 10,
      restart_delay: 5000,
      
      // Логи
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      
      // Переменные окружения
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
