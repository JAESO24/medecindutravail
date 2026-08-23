export type EmailBindings = {
  GMAIL_USER: string
  GMAIL_APP_PASSWORD: string
}

export type EmailRecipient = { name?: string; email: string } | string

export async function sendEmail(
  env: EmailBindings,
  to: EmailRecipient | EmailRecipient[],
  subject: string,
  html: string
): Promise<void> {
  // Import différé : `cloudflare:sockets` n'existe que sur le vrai runtime Workers
  // (déploiement, ou `wrangler pages dev`) — pas sous `vite dev` (exécution Node.js).
  const { WorkerMailer } = await import('worker-mailer')

  const mailer = await WorkerMailer.connect({
    credentials: {
      username: env.GMAIL_USER,
      password: env.GMAIL_APP_PASSWORD,
    },
    authType: 'login',
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
  })

  const recipients = Array.isArray(to) ? to : [to]

  await mailer.send({
    from: { name: 'SantéTravail.CI', email: env.GMAIL_USER },
    to: recipients as any,
    subject,
    html,
  })
}

export function welcomeEmailHtml(params: {
  nom: string
  prenom: string
  email: string
  password: string
  role: string
}): string {
  return `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
      <h2 style="color:#006B3C">Bienvenue sur SantéTravail.CI</h2>
      <p>Bonjour ${params.prenom} ${params.nom},</p>
      <p>Votre compte (${params.role}) a été créé. Voici vos identifiants de connexion :</p>
      <p style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px">
        <strong>Email :</strong> ${params.email}<br>
        <strong>Mot de passe :</strong> ${params.password}
      </p>
      <p>Nous vous recommandons de changer ce mot de passe après votre première connexion.</p>
    </div>
  `
}
