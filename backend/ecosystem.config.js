module.exports = {
  apps: [
    {
      name: 'tms-backend',
      script: './dist/server.js',
      cwd: '/opt/tms/backend',
      instances: 1,
      // Fork mode is required: Puppeteer spawns Chrome child processes,
      // and file uploads use local disk — cluster mode would break both.
      exec_mode: 'fork',
      watch: false,
      // Restart if memory exceeds 512MB (Puppeteer can spike during PDF generation)
      max_memory_restart: '512M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      // Log configuration
      error_file: '/var/log/tms/error.log',
      out_file: '/var/log/tms/out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      // Restart policy
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 5000,
      kill_timeout: 10000,
      listen_timeout: 10000,
    },
  ],
};
