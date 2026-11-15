module.exports = {
  apps: [{
    name: 'halcyon',
    cwd: __dirname,
    script: './server.cjs',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '128M',
    restart_delay: 1000,
    kill_timeout: 5000,
    time: true,
    env: { NODE_ENV: 'production', PORT: '3108', HOST: '127.0.0.1' },
  }],
};
