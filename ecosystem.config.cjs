module.exports = {
  apps: [
    {
      name: 'santetravail',
      script: 'npx',
      args: 'wrangler pages dev dist --d1=santetravail-production --local --ip 127.0.0.1 --port 3000',
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork'
    }
  ]
}
