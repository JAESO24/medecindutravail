export type Env = {
  TARGET_URL: string
  CRON_SECRET: string
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      fetch(`${env.TARGET_URL}/api/cron/alertes-email`, {
        method: 'POST',
        headers: { 'X-Cron-Secret': env.CRON_SECRET },
      }).then(async (res) => {
        console.log('Digest alertes:', res.status, await res.text())
      })
    )
  },
}
