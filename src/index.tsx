/// <reference types="@cloudflare/workers-types" />
/// <reference lib="DOM" />

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import { sendEmail, welcomeEmailHtml } from './email'
import { deactivateUser } from './user-management'

type Bindings = {
  DB: D1Database
  GMAIL_USER: string
  GMAIL_APP_PASSWORD: string
  CRON_SECRET: string
}

type AppVariables = {
  session: Record<string, any> | null
  tenantId: string | number | null
  userId: number | null
}

const app = new Hono<{ Bindings: Bindings; Variables: AppVariables }>()

app.use('/api/*', cors())
app.use('/static/*', serveStatic({ root: './public' }))

// ============================================================
// UTILITAIRES INTERNES
// ============================================================
async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function generateToken(): Promise<string> {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('')
}

// Middleware d'authentification — vérifie le token de session
async function requireAuth(c: any, next: any) {
  const token = c.req.header('X-Session-Token') || c.req.query('token')
  if (!token) return c.json({ error: 'Authentification requise' }, 401)

  const session = await c.env.DB.prepare(
    `SELECT s.*, u.id as user_id, u.nom, u.prenom, u.email, u.role, u.profil_id,
            u.tenant_id, u.actif
     FROM sessions s
     JOIN users u ON s.user_id = u.id
     WHERE s.token = ? AND s.expires_at > datetime('now') AND u.actif = 1`
  ).bind(token).first() as any

  if (!session) return c.json({ error: 'Session expirée ou invalide' }, 401)

  // Mettre à jour le timestamp d'activité
  await c.env.DB.prepare(
    "UPDATE sessions SET last_activity = datetime('now') WHERE token = ?"
  ).bind(token).run()

  c.set('session', session)
  c.set('tenantId', session.tenant_id)
  c.set('userId', session.user_id)
  await next()
}

// Vérification d'une permission
async function hasPermission(db: D1Database, profilId: number | null, role: string, module: string, action: string): Promise<boolean> {
  if (role === 'superadmin') return true
  if (!profilId) {
    // Permissions par défaut selon le rôle
    const defaults: Record<string, string[]> = {
      admin: ['read', 'write', 'delete'],
      medecin: ['read', 'write'],
      infirmier: ['read']
    }
    return (defaults[role] || []).includes(action)
  }
  const perm = await db.prepare(
    `SELECT id FROM profil_permissions
     WHERE profil_id = ? AND module = ? AND action = ? AND autorise = 1`
  ).bind(profilId, module, action).first()
  return !!perm
}

// ============================================================
// ROUTE DE SANTÉ
// ============================================================
app.get('/api/health', (c) => c.json({ status: 'ok', version: '2.0.0', timestamp: new Date().toISOString() }))

// ============================================================
// AUTHENTIFICATION
// ============================================================

// Connexion
app.post('/api/auth/login', async (c) => {
  const { email, password, tenant_code } = await c.req.json()
  if (!email || !password) return c.json({ error: 'Email et mot de passe requis' }, 400)

  const hash = await sha256(password)

  let userQuery = `
    SELECT u.id, u.nom, u.prenom, u.email, u.role, u.specialite, u.telephone,
           u.tenant_id, u.profil_id, u.actif, u.numero_ordre,
           t.nom as tenant_nom, t.code as tenant_code, t.logo_url as tenant_logo,
           t.actif as tenant_actif,
           p.nom as profil_nom
    FROM users u
    LEFT JOIN tenants t ON u.tenant_id = t.id
    LEFT JOIN profils p ON u.profil_id = p.id
    WHERE u.email = ? AND u.password_hash = ? AND u.actif = 1`

  const params: any[] = [email, hash]

  if (tenant_code) {
    userQuery += ` AND t.code = ?`
    params.push(tenant_code)
  }

  const user = await c.env.DB.prepare(userQuery).bind(...params).first() as any

  if (!user) return c.json({ error: 'Identifiants incorrects ou compte désactivé' }, 401)
  if (user.tenant_actif === 0) return c.json({ error: 'Ce compte entreprise est suspendu. Contactez l\'administrateur.' }, 403)

  // Créer une session
  const token = await generateToken()
  const expiresAt = new Date()
  expiresAt.setHours(expiresAt.getHours() + 8) // 8 heures

  await c.env.DB.prepare(
    `INSERT INTO sessions (user_id, token, expires_at, ip_address, user_agent)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(user.id, token, expiresAt.toISOString(), c.req.header('CF-Connecting-IP') || '0.0.0.0', c.req.header('User-Agent') || '').run()

  // Récupérer les permissions du profil
  let permissions: any = {}
  if (user.profil_id) {
    const perms = await c.env.DB.prepare(
      `SELECT module, action FROM profil_permissions WHERE profil_id = ? AND autorise = 1`
    ).bind(user.profil_id).all()
    perms.results.forEach((p: any) => {
      if (!permissions[p.module]) permissions[p.module] = []
      permissions[p.module].push(p.action)
    })
  }

  const { password_hash, ...safeUser } = user as any

  return c.json({
    success: true,
    token,
    user: { ...safeUser, permissions },
    expires_at: expiresAt.toISOString()
  })
})

// Déconnexion
app.post('/api/auth/logout', async (c) => {
  const token = c.req.header('X-Session-Token')
  if (token) {
    await c.env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run()
  }
  return c.json({ success: true })
})

// Changer son mot de passe
app.post('/api/auth/change-password', async (c) => {
  const { userId, oldPassword, newPassword } = await c.req.json()
  if (!newPassword || newPassword.length < 8) {
    return c.json({ error: 'Le nouveau mot de passe doit comporter au moins 8 caractères.' }, 400)
  }
  const oldHash = await sha256(oldPassword)
  const newHash = await sha256(newPassword)

  const user = await c.env.DB.prepare('SELECT id FROM users WHERE id = ? AND password_hash = ?').bind(userId, oldHash).first()
  if (!user) return c.json({ error: 'Ancien mot de passe incorrect' }, 401)

  await c.env.DB.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(newHash, userId).run()
  return c.json({ success: true })
})

// Vérifier si un token est encore valide
app.get('/api/auth/verify', requireAuth, async (c) => {
  const session = c.get('session') as any
  const perms = await c.env.DB.prepare(
    `SELECT module, action FROM profil_permissions WHERE profil_id = ? AND autorise = 1`
  ).bind(session.profil_id || 0).all()
  const permissions: any = {}
  perms.results.forEach((p: any) => {
    if (!permissions[p.module]) permissions[p.module] = []
    permissions[p.module].push(p.action)
  })
  return c.json({ valid: true, user: { ...session, permissions } })
})

// ============================================================
// GESTION DES TENANTS (SuperAdmin uniquement)
// ============================================================
app.get('/api/tenants', requireAuth, async (c) => {
  const session = c.get('session') as any
  if (session.role !== 'superadmin') return c.json({ error: 'Accès refusé' }, 403)

  const tenants = await c.env.DB.prepare(`
    SELECT t.*, COUNT(u.id) as nb_users,
           COUNT(DISTINCT tw.id) as nb_travailleurs
    FROM tenants t
    LEFT JOIN users u ON t.id = u.tenant_id AND u.actif = 1
    LEFT JOIN travailleurs tw ON t.id = tw.tenant_id
    GROUP BY t.id
    ORDER BY t.nom
  `).all()
  return c.json(tenants.results)
})

app.post('/api/tenants', requireAuth, async (c) => {
  const session = c.get('session') as any
  if (session.role !== 'superadmin') return c.json({ error: 'Accès refusé' }, 403)

  const data = await c.req.json()
  if (!data.nom || !data.code) return c.json({ error: 'Nom et code requis' }, 400)

  const existing = await c.env.DB.prepare('SELECT id FROM tenants WHERE code = ?').bind(data.code.toUpperCase()).first()
  if (existing) return c.json({ error: 'Ce code est déjà utilisé' }, 409)

  const result = await c.env.DB.prepare(
    `INSERT INTO tenants (nom, code, secteur, adresse, ville, telephone, email, contact_admin, actif)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`
  ).bind(data.nom, data.code.toUpperCase(), data.secteur || null, data.adresse || null, data.ville || null, data.telephone || null, data.email || null, data.contact_admin || null).run()

  const tenantId = result.meta.last_row_id

  // Créer l'administrateur du tenant
  if (data.admin_email && data.admin_password) {
    const hash = await sha256(data.admin_password)
    await c.env.DB.prepare(
      `INSERT INTO users (nom, prenom, email, password_hash, role, tenant_id, actif)
       VALUES (?, ?, ?, ?, 'admin', ?, 1)`
    ).bind(data.admin_nom || 'Admin', data.admin_prenom || '', data.admin_email, hash, tenantId).run()

    c.executionCtx.waitUntil(
      sendEmail(
        c.env,
        { name: `${data.admin_prenom || ''} ${data.admin_nom || 'Admin'}`, email: data.admin_email },
        'Votre compte SantéTravail.CI',
        welcomeEmailHtml({ nom: data.admin_nom || 'Admin', prenom: data.admin_prenom || '', email: data.admin_email, password: data.admin_password, role: 'admin' })
      ).catch((e: unknown) => console.error('Envoi email bienvenue échoué:', e))
    )
  }

  return c.json({ id: tenantId, ...data }, 201)
})

app.put('/api/tenants/:id', requireAuth, async (c) => {
  const session = c.get('session') as any
  if (session.role !== 'superadmin') return c.json({ error: 'Accès refusé' }, 403)

  const id = c.req.param('id')
  const data = await c.req.json()
  await c.env.DB.prepare(
    `UPDATE tenants SET nom=?, secteur=?, adresse=?, ville=?, telephone=?, email=?,
     contact_admin=?, actif=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`
  ).bind(data.nom, data.secteur, data.adresse, data.ville, data.telephone, data.email, data.contact_admin, data.actif ?? 1, id).run()
  return c.json({ success: true })
})

// ============================================================
// GESTION DES PROFILS ET PERMISSIONS
// ============================================================

// Lister les profils du tenant
app.get('/api/profils', requireAuth, async (c) => {
  const tenantId = c.get('tenantId')
  const profils = await c.env.DB.prepare(
    `SELECT p.*, COUNT(u.id) as nb_utilisateurs
     FROM profils p
     LEFT JOIN users u ON p.id = u.profil_id AND u.actif = 1
     WHERE p.tenant_id = ?
     GROUP BY p.id
     ORDER BY p.nom`
  ).bind(tenantId).all()
  return c.json(profils.results)
})

app.get('/api/profils/:id', requireAuth, async (c) => {
  const tenantId = c.get('tenantId')
  const id = c.req.param('id')

  const profil = await c.env.DB.prepare(
    'SELECT * FROM profils WHERE id = ? AND tenant_id = ?'
  ).bind(id, tenantId).first()
  if (!profil) return c.json({ error: 'Profil non trouvé' }, 404)

  const permissions = await c.env.DB.prepare(
    'SELECT * FROM profil_permissions WHERE profil_id = ?'
  ).bind(id).all()

  return c.json({ ...profil, permissions: permissions.results })
})

app.post('/api/profils', requireAuth, async (c) => {
  const session = c.get('session') as any
  const tenantId = c.get('tenantId')
  const ok = await hasPermission(c.env.DB, session.profil_id, session.role, 'utilisateurs', 'write')
  if (!ok) return c.json({ error: 'Permission refusée' }, 403)

  const data = await c.req.json()
  if (!data.nom) return c.json({ error: 'Nom du profil requis' }, 400)

  const result = await c.env.DB.prepare(
    'INSERT INTO profils (tenant_id, nom, description) VALUES (?, ?, ?)'
  ).bind(tenantId, data.nom, data.description || null).run()

  const profilId = result.meta.last_row_id

  // Insérer les permissions définies
  if (data.permissions && Array.isArray(data.permissions)) {
    for (const perm of data.permissions) {
      await c.env.DB.prepare(
        `INSERT OR REPLACE INTO profil_permissions (profil_id, module, action, autorise)
         VALUES (?, ?, ?, ?)`
      ).bind(profilId, perm.module, perm.action, perm.autorise ? 1 : 0).run()
    }
  }

  return c.json({ id: profilId }, 201)
})

app.put('/api/profils/:id', requireAuth, async (c) => {
  const session = c.get('session') as any
  const tenantId = c.get('tenantId')
  const ok = await hasPermission(c.env.DB, session.profil_id, session.role, 'utilisateurs', 'write')
  if (!ok) return c.json({ error: 'Permission refusée' }, 403)

  const id = c.req.param('id')
  const data = await c.req.json()

  await c.env.DB.prepare(
    'UPDATE profils SET nom=?, description=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=?'
  ).bind(data.nom, data.description, id, tenantId).run()

  // Mettre à jour les permissions
  if (data.permissions && Array.isArray(data.permissions)) {
    await c.env.DB.prepare('DELETE FROM profil_permissions WHERE profil_id = ?').bind(id).run()
    for (const perm of data.permissions) {
      await c.env.DB.prepare(
        `INSERT INTO profil_permissions (profil_id, module, action, autorise)
         VALUES (?, ?, ?, ?)`
      ).bind(id, perm.module, perm.action, perm.autorise ? 1 : 0).run()
    }
  }

  return c.json({ success: true })
})

app.delete('/api/profils/:id', requireAuth, async (c) => {
  const session = c.get('session') as any
  const tenantId = c.get('tenantId')
  const ok = await hasPermission(c.env.DB, session.profil_id, session.role, 'utilisateurs', 'delete')
  if (!ok) return c.json({ error: 'Permission refusée' }, 403)

  const id = c.req.param('id')
  const used = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM users WHERE profil_id = ? AND actif = 1').bind(id).first() as any
  if (used?.cnt > 0) return c.json({ error: 'Ce profil est encore assigné à des utilisateurs actifs.' }, 409)

  await c.env.DB.prepare('DELETE FROM profil_permissions WHERE profil_id = ?').bind(id).run()
  await c.env.DB.prepare('DELETE FROM profils WHERE id = ? AND tenant_id = ?').bind(id, tenantId).run()
  return c.json({ success: true })
})

// ============================================================
// DASHBOARD / STATISTIQUES
// ============================================================
app.get('/api/dashboard/stats', requireAuth, async (c) => {
  const tenantId = c.get('tenantId')
  const [totalTravailleurs, totalVisitesMois, aptesCount, alertesActives, visitesAujourdhui, consulAujourdhui] = await Promise.all([
    c.env.DB.prepare("SELECT COUNT(*) as count FROM travailleurs WHERE statut = 'actif' AND tenant_id = ?").bind(tenantId).first(),
    c.env.DB.prepare("SELECT COUNT(*) as count FROM visites_medicales WHERE strftime('%Y-%m', date_visite) = strftime('%Y-%m', 'now') AND tenant_id = ?").bind(tenantId).first(),
    c.env.DB.prepare("SELECT COUNT(*) as count FROM visites_medicales WHERE aptitude IN ('apte', 'apte_amenagement') AND date_visite >= date('now', '-1 year') AND tenant_id = ?").bind(tenantId).first(),
    c.env.DB.prepare("SELECT COUNT(*) as count FROM alertes WHERE statut = 'active' AND tenant_id = ?").bind(tenantId).first(),
    c.env.DB.prepare("SELECT COUNT(*) as count FROM visites_medicales WHERE date_visite = date('now') AND statut IN ('planifiee', 'realisee') AND tenant_id = ?").bind(tenantId).first(),
    c.env.DB.prepare("SELECT COUNT(*) as count FROM consultations WHERE date(date_consultation) = date('now') AND tenant_id = ?").bind(tenantId).first()
  ])

  return c.json({
    totalTravailleurs: (totalTravailleurs as any)?.count || 0,
    visitesParMois: (visitesAujourdhui as any)?.count || 0,
    visitesMonth: (totalVisitesMois as any)?.count || 0,
    aptes: (aptesCount as any)?.count || 0,
    alertesActives: (alertesActives as any)?.count || 0,
    consultationsAujourdhui: (consulAujourdhui as any)?.count || 0
  })
})

app.get('/api/dashboard/visites-semaine', requireAuth, async (c) => {
  const tenantId = c.get('tenantId')
  const visites = await c.env.DB.prepare(`
    SELECT date_visite, COUNT(*) as count, type_visite
    FROM visites_medicales
    WHERE date_visite >= date('now', '-7 days') AND tenant_id = ?
    GROUP BY date_visite, type_visite
    ORDER BY date_visite
  `).bind(tenantId).all()
  return c.json(visites.results)
})

app.get('/api/dashboard/prochaines-visites', requireAuth, async (c) => {
  const tenantId = c.get('tenantId')
  const visites = await c.env.DB.prepare(`
    SELECT vm.id, vm.date_visite, vm.heure_visite, vm.type_visite, vm.statut,
           t.nom, t.prenom, t.poste, e.nom as entreprise
    FROM visites_medicales vm
    JOIN travailleurs t ON vm.travailleur_id = t.id
    LEFT JOIN entreprises e ON t.entreprise_id = e.id
    LEFT JOIN users u ON vm.medecin_id = u.id
    WHERE vm.date_visite >= date('now') AND vm.statut = 'planifiee' AND vm.tenant_id = ?
    ORDER BY vm.date_visite, vm.heure_visite
    LIMIT 10
  `).bind(tenantId).all()
  return c.json(visites.results)
})

app.get('/api/dashboard/alertes', requireAuth, async (c) => {
  const tenantId = c.get('tenantId')
  const alertes = await c.env.DB.prepare(`
    SELECT a.*, t.nom, t.prenom
    FROM alertes a
    LEFT JOIN travailleurs t ON a.travailleur_id = t.id
    WHERE a.statut = 'active' AND a.tenant_id = ?
    ORDER BY CASE a.priorite WHEN 'urgente' THEN 1 WHEN 'haute' THEN 2 WHEN 'normale' THEN 3 ELSE 4 END
    LIMIT 10
  `).bind(tenantId).all()
  return c.json(alertes.results)
})

// ============================================================
// ENTREPRISES (clientes du service médical, au sein d'un tenant)
// ============================================================
app.get('/api/entreprises', requireAuth, async (c) => {
  const tenantId = c.get('tenantId')
  const entreprises = await c.env.DB.prepare(
    `SELECT e.*, COUNT(t.id) as nb_travailleurs
     FROM entreprises e
     LEFT JOIN travailleurs t ON e.id = t.entreprise_id
     WHERE e.tenant_id = ?
     GROUP BY e.id ORDER BY e.nom`
  ).bind(tenantId).all()
  return c.json(entreprises.results)
})

app.post('/api/entreprises', requireAuth, async (c) => {
  const session = c.get('session') as any
  const tenantId = c.get('tenantId')
  const ok = await hasPermission(c.env.DB, session.profil_id, session.role, 'entreprises', 'write')
  if (!ok) return c.json({ error: 'Permission refusée' }, 403)

  const data = await c.req.json()
  const result = await c.env.DB.prepare(
    `INSERT INTO entreprises (tenant_id, nom, secteur, adresse, ville, telephone, email, contact_rh,
     effectif, categorie, type_service_sante, numero_agrement, date_agrement, type_equipement, risques_professionnels)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(tenantId, data.nom, data.secteur, data.adresse, data.ville, data.telephone, data.email, data.contact_rh,
    data.effectif || 0, data.categorie || 'E', data.type_service_sante || 'autonome',
    data.numero_agrement || null, data.date_agrement || null, data.type_equipement || 'fixe',
    data.risques_professionnels || null).run()
  return c.json({ id: result.meta.last_row_id, ...data }, 201)
})

app.put('/api/entreprises/:id', requireAuth, async (c) => {
  const session = c.get('session') as any
  const tenantId = c.get('tenantId')
  const ok = await hasPermission(c.env.DB, session.profil_id, session.role, 'entreprises', 'write')
  if (!ok) return c.json({ error: 'Permission refusée' }, 403)

  const id = c.req.param('id')
  const data = await c.req.json()
  await c.env.DB.prepare(
    `UPDATE entreprises SET nom=?, secteur=?, adresse=?, ville=?, telephone=?, email=?, contact_rh=?,
     effectif=?, categorie=?, type_service_sante=?, numero_agrement=?, date_agrement=?,
     type_equipement=?, risques_professionnels=?, updated_at=CURRENT_TIMESTAMP
     WHERE id=? AND tenant_id=?`
  ).bind(data.nom, data.secteur, data.adresse, data.ville, data.telephone, data.email, data.contact_rh,
    data.effectif || 0, data.categorie || 'E', data.type_service_sante || 'autonome',
    data.numero_agrement || null, data.date_agrement || null, data.type_equipement || 'fixe',
    data.risques_professionnels || null, id, tenantId).run()
  return c.json({ success: true })
})

app.delete('/api/entreprises/:id', requireAuth, async (c) => {
  const session = c.get('session') as any
  const tenantId = c.get('tenantId')
  const ok = await hasPermission(c.env.DB, session.profil_id, session.role, 'entreprises', 'delete')
  if (!ok) return c.json({ error: 'Permission refusée' }, 403)

  const id = c.req.param('id')
  const used = await c.env.DB.prepare("SELECT COUNT(*) as cnt FROM travailleurs WHERE entreprise_id = ? AND statut = 'actif'").bind(id).first() as any
  if (used?.cnt > 0) return c.json({ error: 'Cette entreprise a des travailleurs actifs.' }, 409)

  await c.env.DB.prepare('DELETE FROM entreprises WHERE id = ? AND tenant_id = ?').bind(id, tenantId).run()
  return c.json({ success: true })
})

// ============================================================
// TRAVAILLEURS
// ============================================================
app.get('/api/travailleurs', requireAuth, async (c) => {
  const tenantId = c.get('tenantId')
  const search = c.req.query('search') || ''
  const entrepriseId = c.req.query('entreprise_id')

  let query = `
    SELECT t.*, e.nom as entreprise_nom
    FROM travailleurs t
    LEFT JOIN entreprises e ON t.entreprise_id = e.id
    WHERE t.statut != 'inactif' AND t.tenant_id = ?
  `
  const params: any[] = [tenantId]

  if (search) {
    query += ` AND (t.nom LIKE ? OR t.prenom LIKE ? OR t.numero_matricule LIKE ? OR t.poste LIKE ?)`
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`)
  }
  if (entrepriseId) {
    query += ` AND t.entreprise_id = ?`
    params.push(entrepriseId)
  }
  query += ' ORDER BY t.nom, t.prenom'

  const workers = await c.env.DB.prepare(query).bind(...params).all()
  return c.json(workers.results)
})

app.get('/api/travailleurs/:id', requireAuth, async (c) => {
  const tenantId = c.get('tenantId')
  const id = c.req.param('id')
  const travailleur = await c.env.DB.prepare(`
    SELECT t.*, e.nom as entreprise_nom
    FROM travailleurs t
    LEFT JOIN entreprises e ON t.entreprise_id = e.id
    WHERE t.id = ? AND t.tenant_id = ?
  `).bind(id, tenantId).first()
  if (!travailleur) return c.json({ error: 'Travailleur non trouvé' }, 404)

  const derniereVisite = await c.env.DB.prepare(
    'SELECT * FROM visites_medicales WHERE travailleur_id = ? ORDER BY date_visite DESC LIMIT 1'
  ).bind(id).first()
  const derniereConsultation = await c.env.DB.prepare(
    'SELECT * FROM consultations WHERE travailleur_id = ? ORDER BY date_consultation DESC LIMIT 1'
  ).bind(id).first()

  return c.json({ ...travailleur, derniereVisite, derniereConsultation })
})

app.post('/api/travailleurs', requireAuth, async (c) => {
  const session = c.get('session') as any
  const tenantId = c.get('tenantId')
  const ok = await hasPermission(c.env.DB, session.profil_id, session.role, 'travailleurs', 'write')
  if (!ok) return c.json({ error: 'Permission refusée' }, 403)

  const data = await c.req.json()
  const result = await c.env.DB.prepare(`
    INSERT INTO travailleurs (tenant_id, nom, prenom, date_naissance, sexe, numero_matricule, poste,
    entreprise_id, telephone, email, adresse, groupe_sanguin, allergies, antecedents_personnels,
    antecedents_familiaux, traitement_en_cours, date_embauche, type_contrat, loge_par_employeur,
    categorie_risque, frequence_visite_mois, statut)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    tenantId, data.nom, data.prenom, data.date_naissance, data.sexe, data.numero_matricule, data.poste,
    data.entreprise_id, data.telephone, data.email, data.adresse, data.groupe_sanguin,
    data.allergies, data.antecedents_personnels, data.antecedents_familiaux,
    data.traitement_en_cours, data.date_embauche,
    data.type_contrat || 'cdi', data.loge_par_employeur || 0,
    data.categorie_risque || 'standard', data.frequence_visite_mois || 12,
    data.statut || 'actif'
  ).run()
  return c.json({ id: result.meta.last_row_id, ...data }, 201)
})

app.post('/api/travailleurs/import', requireAuth, async (c) => {
  const session = c.get('session') as any
  const tenantId = c.get('tenantId')
  const ok = await hasPermission(c.env.DB, session.profil_id, session.role, 'travailleurs', 'write')
  if (!ok) return c.json({ error: 'Permission refusée' }, 403)

  const rows = await c.req.json()
  if (!Array.isArray(rows) || rows.length === 0) return c.json({ error: 'Aucune donnée à importer' }, 400)

  const importedIds: number[] = []
  for (const data of rows) {
    if (!data.nom || !data.prenom || !data.date_naissance) {
      return c.json({ error: 'Chaque travailleur doit avoir nom, prénom et date naissance' }, 400)
    }

    let entrepriseId = null
    if (data.entreprise) {
      const entreprise = await c.env.DB.prepare('SELECT id FROM entreprises WHERE tenant_id = ? AND nom = ?').bind(tenantId, data.entreprise).first()
      if (entreprise) entrepriseId = entreprise.id
      else {
        const createdEnt = await c.env.DB.prepare('INSERT INTO entreprises (tenant_id, nom) VALUES (?, ?)').bind(tenantId, data.entreprise).run()
        entrepriseId = createdEnt.meta.last_row_id as number
      }
    }

    const result = await c.env.DB.prepare(`
      INSERT INTO travailleurs (tenant_id, nom, prenom, date_naissance, sexe, numero_matricule, poste,
      entreprise_id, telephone, email, adresse, groupe_sanguin, allergies, antecedents_personnels,
      antecedents_familiaux, traitement_en_cours, date_embauche, type_contrat, loge_par_employeur,
      categorie_risque, frequence_visite_mois, statut)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      tenantId, data.nom, data.prenom, data.date_naissance, data.sexe, data.numero_matricule, data.poste,
      entrepriseId, data.telephone, data.email, data.adresse, data.groupe_sanguin,
      data.allergies || null, data.antecedents_personnels || null, data.antecedents_familiaux || null,
      data.traitement_en_cours || null, data.date_embauche || null,
      data.type_contrat || 'cdi', data.loge_par_employeur ? 1 : 0,
      data.categorie_risque || 'standard', data.frequence_visite_mois ? Number(data.frequence_visite_mois) : 12,
      data.statut || 'actif'
    ).run()

    importedIds.push(result.meta.last_row_id as number)
  }

  return c.json({ imported: importedIds.length, ids: importedIds })
})

app.put('/api/travailleurs/:id', requireAuth, async (c) => {
  const session = c.get('session') as any
  const tenantId = c.get('tenantId')
  const ok = await hasPermission(c.env.DB, session.profil_id, session.role, 'travailleurs', 'write')
  if (!ok) return c.json({ error: 'Permission refusée' }, 403)

  const id = c.req.param('id')
  const data = await c.req.json()
  await c.env.DB.prepare(`
    UPDATE travailleurs SET nom=?, prenom=?, date_naissance=?, sexe=?, numero_matricule=?, poste=?,
    entreprise_id=?, telephone=?, email=?, adresse=?, groupe_sanguin=?, allergies=?,
    antecedents_personnels=?, antecedents_familiaux=?, traitement_en_cours=?, date_embauche=?,
    type_contrat=?, loge_par_employeur=?, categorie_risque=?, frequence_visite_mois=?,
    statut=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=?
  `).bind(
    data.nom, data.prenom, data.date_naissance, data.sexe, data.numero_matricule, data.poste,
    data.entreprise_id, data.telephone, data.email, data.adresse, data.groupe_sanguin,
    data.allergies, data.antecedents_personnels, data.antecedents_familiaux,
    data.traitement_en_cours, data.date_embauche,
    data.type_contrat || 'cdi', data.loge_par_employeur || 0,
    data.categorie_risque || 'standard', data.frequence_visite_mois || 12,
    data.statut, id, tenantId
  ).run()
  return c.json({ success: true })
})

app.delete('/api/travailleurs/:id', requireAuth, async (c) => {
  const session = c.get('session') as any
  const tenantId = c.get('tenantId')
  const ok = await hasPermission(c.env.DB, session.profil_id, session.role, 'travailleurs', 'delete')
  if (!ok) return c.json({ error: 'Permission refusée' }, 403)

  const id = c.req.param('id')
  await c.env.DB.prepare("UPDATE travailleurs SET statut='inactif', updated_at=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=?").bind(id, tenantId).run()
  return c.json({ success: true })
})

// Dossier médical complet
app.get('/api/travailleurs/:id/dossier', requireAuth, async (c) => {
  const tenantId = c.get('tenantId')
  const id = c.req.param('id')

  const [visites, consultations, constantes, prescriptions, examens, certificats, maladies] = await Promise.all([
    c.env.DB.prepare("SELECT vm.*, u.nom as medecin_nom, u.prenom as medecin_prenom FROM visites_medicales vm LEFT JOIN users u ON vm.medecin_id = u.id WHERE vm.travailleur_id = ? AND vm.tenant_id = ? ORDER BY vm.date_visite DESC").bind(id, tenantId).all(),
    c.env.DB.prepare("SELECT c.*, u.nom as praticien_nom, u.prenom as praticien_prenom FROM consultations c LEFT JOIN users u ON c.praticien_id = u.id WHERE c.travailleur_id = ? AND c.tenant_id = ? ORDER BY c.date_consultation DESC").bind(id, tenantId).all(),
    c.env.DB.prepare("SELECT * FROM constantes WHERE travailleur_id = ? ORDER BY date_mesure DESC LIMIT 10").bind(id).all(),
    c.env.DB.prepare("SELECT * FROM prescriptions WHERE travailleur_id = ? ORDER BY date_prescription DESC").bind(id).all(),
    c.env.DB.prepare("SELECT * FROM examens WHERE travailleur_id = ? ORDER BY date_demande DESC").bind(id).all(),
    c.env.DB.prepare("SELECT ca.*, u.nom as medecin_nom FROM certificats_aptitude ca LEFT JOIN users u ON ca.medecin_id = u.id WHERE ca.travailleur_id = ? ORDER BY ca.date_emission DESC LIMIT 5").bind(id).all(),
    c.env.DB.prepare("SELECT * FROM maladies_accidents WHERE travailleur_id = ? ORDER BY date_evenement DESC LIMIT 10").bind(id).all()
  ])

  return c.json({
    visites: visites.results,
    consultations: consultations.results,
    constantes: constantes.results,
    prescriptions: prescriptions.results,
    examens: examens.results,
    certificats: certificats.results,
    maladies: maladies.results
  })
})

// ============================================================
// VISITES MÉDICALES
// ============================================================
app.get('/api/visites', requireAuth, async (c) => {
  const tenantId = c.get('tenantId')
  const mois = c.req.query('mois')
  const statut = c.req.query('statut')
  const type = c.req.query('type')

  let query = `
    SELECT vm.*, t.nom, t.prenom, t.poste, t.numero_matricule,
           e.nom as entreprise, u.nom as medecin_nom, u.prenom as medecin_prenom
    FROM visites_medicales vm
    JOIN travailleurs t ON vm.travailleur_id = t.id
    LEFT JOIN entreprises e ON t.entreprise_id = e.id
    LEFT JOIN users u ON vm.medecin_id = u.id
    WHERE vm.tenant_id = ?
  `
  const params: any[] = [tenantId]

  if (mois) { query += ` AND strftime('%Y-%m', vm.date_visite) = ?`; params.push(mois) }
  if (statut) { query += ` AND vm.statut = ?`; params.push(statut) }
  if (type) { query += ` AND vm.type_visite = ?`; params.push(type) }

  query += ' ORDER BY vm.date_visite DESC, vm.heure_visite'

  const visites = await c.env.DB.prepare(query).bind(...params).all()
  return c.json(visites.results)
})

app.get('/api/visites/:id', requireAuth, async (c) => {
  const tenantId = c.get('tenantId')
  const id = c.req.param('id')
  const visite = await c.env.DB.prepare(`
    SELECT vm.*, t.nom, t.prenom, t.poste, t.numero_matricule, t.groupe_sanguin, t.antecedents_personnels,
           e.nom as entreprise, u.nom as medecin_nom, u.prenom as medecin_prenom
    FROM visites_medicales vm
    JOIN travailleurs t ON vm.travailleur_id = t.id
    LEFT JOIN entreprises e ON t.entreprise_id = e.id
    LEFT JOIN users u ON vm.medecin_id = u.id
    WHERE vm.id = ? AND vm.tenant_id = ?
  `).bind(id, tenantId).first()
  if (!visite) return c.json({ error: 'Visite non trouvée' }, 404)
  return c.json(visite)
})

app.post('/api/visites', requireAuth, async (c) => {
  const session = c.get('session') as any
  const tenantId = c.get('tenantId')
  const ok = await hasPermission(c.env.DB, session.profil_id, session.role, 'visites', 'write')
  if (!ok) return c.json({ error: 'Permission refusée' }, 403)

  const data = await c.req.json()
  const result = await c.env.DB.prepare(`
    INSERT INTO visites_medicales (tenant_id, travailleur_id, medecin_id, type_visite, date_visite,
    heure_visite, statut, motif, conclusions, aptitude, restrictions, prochaine_visite)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    tenantId, data.travailleur_id, data.medecin_id, data.type_visite, data.date_visite,
    data.heure_visite, data.statut || 'planifiee', data.motif, data.conclusions,
    data.aptitude, data.restrictions, data.prochaine_visite
  ).run()

  if (data.prochaine_visite) {
    await c.env.DB.prepare(
      "INSERT INTO alertes (tenant_id, travailleur_id, type_alerte, message, priorite, date_echeance) VALUES (?, ?, 'visite_echeance', ?, 'normale', ?)"
    ).bind(tenantId, data.travailleur_id, 'Prochaine visite médicale programmée', data.prochaine_visite).run()
  }

  return c.json({ id: result.meta.last_row_id, ...data }, 201)
})

app.put('/api/visites/:id', requireAuth, async (c) => {
  const session = c.get('session') as any
  const tenantId = c.get('tenantId')
  const ok = await hasPermission(c.env.DB, session.profil_id, session.role, 'visites', 'write')
  if (!ok) return c.json({ error: 'Permission refusée' }, 403)

  const id = c.req.param('id')
  const data = await c.req.json()
  await c.env.DB.prepare(`
    UPDATE visites_medicales SET travailleur_id=?, medecin_id=?, type_visite=?, date_visite=?,
    heure_visite=?, statut=?, motif=?, conclusions=?, aptitude=?, restrictions=?, prochaine_visite=?,
    updated_at=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=?
  `).bind(
    data.travailleur_id, data.medecin_id, data.type_visite, data.date_visite,
    data.heure_visite, data.statut, data.motif, data.conclusions,
    data.aptitude, data.restrictions, data.prochaine_visite, id, tenantId
  ).run()
  return c.json({ success: true })
})

app.delete('/api/visites/:id', requireAuth, async (c) => {
  const session = c.get('session') as any
  const tenantId = c.get('tenantId')
  const ok = await hasPermission(c.env.DB, session.profil_id, session.role, 'visites', 'delete')
  if (!ok) return c.json({ error: 'Permission refusée' }, 403)

  const id = c.req.param('id')
  await c.env.DB.prepare("UPDATE visites_medicales SET statut='annulee' WHERE id=? AND tenant_id=?").bind(id, tenantId).run()
  return c.json({ success: true })
})

// ============================================================
// CONSULTATIONS
// ============================================================
app.get('/api/consultations', requireAuth, async (c) => {
  const tenantId = c.get('tenantId')
  const travailleurId = c.req.query('travailleur_id')
  const today = c.req.query('today')

  let query = `
    SELECT c.*, t.nom, t.prenom, t.numero_matricule, t.poste,
           e.nom as entreprise, u.nom as praticien_nom, u.prenom as praticien_prenom
    FROM consultations c
    JOIN travailleurs t ON c.travailleur_id = t.id
    LEFT JOIN entreprises e ON t.entreprise_id = e.id
    LEFT JOIN users u ON c.praticien_id = u.id
    WHERE c.tenant_id = ?
  `
  const params: any[] = [tenantId]

  if (travailleurId) { query += ` AND c.travailleur_id = ?`; params.push(travailleurId) }
  if (today === 'true') { query += ` AND date(c.date_consultation) = date('now')` }

  query += ' ORDER BY c.date_consultation DESC LIMIT 100'

  const consultations = await c.env.DB.prepare(query).bind(...params).all()
  return c.json(consultations.results)
})

app.post('/api/consultations', requireAuth, async (c) => {
  const session = c.get('session') as any
  const tenantId = c.get('tenantId')
  const ok = await hasPermission(c.env.DB, session.profil_id, session.role, 'consultations', 'write')
  if (!ok) return c.json({ error: 'Permission refusée' }, 403)

  const data = await c.req.json()
  const result = await c.env.DB.prepare(`
    INSERT INTO consultations (tenant_id, travailleur_id, praticien_id, date_consultation, motif,
    symptomes, examen_clinique, diagnostic, traitement, prescriptions, examens_demandes,
    certificat_travail, arret_travail_jours, observations)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    tenantId, data.travailleur_id, data.praticien_id, data.date_consultation || new Date().toISOString(),
    data.motif, data.symptomes, data.examen_clinique, data.diagnostic, data.traitement,
    data.prescriptions, data.examens_demandes, data.certificat_travail || 0,
    data.arret_travail_jours || 0, data.observations
  ).run()

  const consultId = result.meta.last_row_id

  if (data.constantes) {
    const cv = data.constantes
    const imc = cv.poids && cv.taille ? (cv.poids / ((cv.taille / 100) ** 2)).toFixed(1) : null
    await c.env.DB.prepare(`
      INSERT INTO constantes (travailleur_id, consultation_id, poids, taille, imc, tension_systolique,
      tension_diastolique, frequence_cardiaque, temperature, saturation_oxygene, glycemie, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      data.travailleur_id, consultId, cv.poids, cv.taille, imc, cv.tension_systolique,
      cv.tension_diastolique, cv.frequence_cardiaque, cv.temperature, cv.saturation_oxygene, cv.glycemie, cv.notes
    ).run()
  }

  return c.json({ id: consultId, ...data }, 201)
})

app.put('/api/consultations/:id', requireAuth, async (c) => {
  const session = c.get('session') as any
  const tenantId = c.get('tenantId')
  const ok = await hasPermission(c.env.DB, session.profil_id, session.role, 'consultations', 'write')
  if (!ok) return c.json({ error: 'Permission refusée' }, 403)

  const id = c.req.param('id')
  const data = await c.req.json()
  await c.env.DB.prepare(`
    UPDATE consultations SET motif=?, symptomes=?, examen_clinique=?, diagnostic=?, traitement=?,
    prescriptions=?, examens_demandes=?, certificat_travail=?, arret_travail_jours=?, observations=?
    WHERE id=? AND tenant_id=?
  `).bind(
    data.motif, data.symptomes, data.examen_clinique, data.diagnostic, data.traitement,
    data.prescriptions, data.examens_demandes, data.certificat_travail || 0,
    data.arret_travail_jours || 0, data.observations, id, tenantId
  ).run()
  return c.json({ success: true })
})

// ============================================================
// CONSTANTES VITALES
// ============================================================
app.get('/api/constantes/:travailleurId', requireAuth, async (c) => {
  const travailleurId = c.req.param('travailleurId')
  const constantes = await c.env.DB.prepare(
    'SELECT * FROM constantes WHERE travailleur_id = ? ORDER BY date_mesure DESC LIMIT 20'
  ).bind(travailleurId).all()
  return c.json(constantes.results)
})

app.post('/api/constantes', requireAuth, async (c) => {
  const data = await c.req.json()
  const imc = data.poids && data.taille ? (data.poids / ((data.taille / 100) ** 2)).toFixed(1) : null
  const result = await c.env.DB.prepare(`
    INSERT INTO constantes (travailleur_id, consultation_id, poids, taille, imc, tension_systolique,
    tension_diastolique, frequence_cardiaque, temperature, saturation_oxygene, glycemie, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    data.travailleur_id, data.consultation_id, data.poids, data.taille, imc, data.tension_systolique,
    data.tension_diastolique, data.frequence_cardiaque, data.temperature, data.saturation_oxygene,
    data.glycemie, data.notes
  ).run()
  return c.json({ id: result.meta.last_row_id, ...data, imc }, 201)
})

// ============================================================
// ALERTES
// ============================================================
app.get('/api/alertes', requireAuth, async (c) => {
  const tenantId = c.get('tenantId')
  const alertes = await c.env.DB.prepare(`
    SELECT a.*, t.nom, t.prenom, t.poste
    FROM alertes a
    LEFT JOIN travailleurs t ON a.travailleur_id = t.id
    WHERE a.statut = 'active' AND a.tenant_id = ?
    ORDER BY CASE a.priorite WHEN 'urgente' THEN 1 WHEN 'haute' THEN 2 WHEN 'normale' THEN 3 ELSE 4 END,
    a.date_echeance ASC
  `).bind(tenantId).all()
  return c.json(alertes.results)
})

app.put('/api/alertes/:id', requireAuth, async (c) => {
  const session = c.get('session') as any
  const tenantId = c.get('tenantId')
  const ok = await hasPermission(c.env.DB, session.profil_id, session.role, 'alertes', 'write')
  if (!ok) return c.json({ error: 'Permission refusée' }, 403)

  const id = c.req.param('id')
  const data = await c.req.json()
  const dateEcheance = data.date_echeance || null
  await c.env.DB.prepare(
    `UPDATE alertes SET message=?, priorite=?, date_echeance=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=?`
  ).bind(data.message, data.priorite, dateEcheance, id, tenantId).run()
  return c.json({ success: true })
})

app.delete('/api/alertes/:id', requireAuth, async (c) => {
  const session = c.get('session') as any
  const tenantId = c.get('tenantId')
  const ok = await hasPermission(c.env.DB, session.profil_id, session.role, 'alertes', 'delete')
  if (!ok) return c.json({ error: 'Permission refusée' }, 403)

  const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM alertes WHERE id=? AND tenant_id=?').bind(id, tenantId).run()
  return c.json({ success: true })
})

app.put('/api/alertes/:id/traiter', requireAuth, async (c) => {
  const tenantId = c.get('tenantId')
  const id = c.req.param('id')
  await c.env.DB.prepare("UPDATE alertes SET statut='traitee' WHERE id=? AND tenant_id=?").bind(id, tenantId).run()
  return c.json({ success: true })
})

// Digest quotidien des alertes actives par email — appelé par le Worker cron compagnon
// (Cloudflare Pages ne supporte pas les Cron Triggers, d'où cet endpoint protégé par secret)
app.post('/api/cron/alertes-email', async (c) => {
  if (!c.env.CRON_SECRET || c.req.header('X-Cron-Secret') !== c.env.CRON_SECRET) {
    return c.json({ error: 'Non autorisé' }, 401)
  }

  const tenants = await c.env.DB.prepare("SELECT id, nom FROM tenants WHERE actif = 1").all()
  let tenantsNotifies = 0

  for (const tenant of tenants.results as any[]) {
    const alertes = await c.env.DB.prepare(`
      SELECT a.*, t.nom, t.prenom
      FROM alertes a
      LEFT JOIN travailleurs t ON a.travailleur_id = t.id
      WHERE a.statut = 'active' AND a.tenant_id = ?
      ORDER BY CASE a.priorite WHEN 'urgente' THEN 1 WHEN 'haute' THEN 2 WHEN 'normale' THEN 3 ELSE 4 END,
      a.date_echeance ASC
    `).bind(tenant.id).all()
    if (alertes.results.length === 0) continue

    const destinataires = await c.env.DB.prepare(
      "SELECT email FROM users WHERE tenant_id = ? AND role IN ('admin','medecin') AND actif = 1 AND email IS NOT NULL"
    ).bind(tenant.id).all()
    const emails = (destinataires.results as any[]).map((u) => u.email)
    if (emails.length === 0) continue

    const itemsHtml = (alertes.results as any[]).map((a) =>
      `<li><strong>[${a.priorite}]</strong> ${a.nom ? `${a.prenom} ${a.nom} — ` : ''}${a.message}${a.date_echeance ? ` (échéance : ${a.date_echeance})` : ''}</li>`
    ).join('')

    await sendEmail(
      c.env,
      emails,
      `SantéTravail.CI — ${alertes.results.length} alerte(s) active(s)`,
      `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2 style="color:#006B3C">Alertes actives — ${tenant.nom}</h2>
          <ul style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 12px 12px 28px">
            ${itemsHtml}
          </ul>
        </div>
      `
    ).catch((e: unknown) => console.error(`Envoi digest alertes échoué pour tenant ${tenant.id}:`, e))
    tenantsNotifies++
  }

  return c.json({ success: true, tenants_notifies: tenantsNotifies })
})

// ============================================================
// UTILISATEURS
// ============================================================
app.get('/api/users', requireAuth, async (c) => {
  const session = c.get('session') as any
  const tenantId = c.get('tenantId')
  const ok = await hasPermission(c.env.DB, session.profil_id, session.role, 'utilisateurs', 'read')
  if (!ok) return c.json({ error: 'Permission refusée' }, 403)

  const users = await c.env.DB.prepare(
    `SELECT u.id, u.nom, u.prenom, u.email, u.role, u.specialite, u.telephone,
            u.actif, u.created_at, u.numero_ordre, u.profil_id,
            p.nom as profil_nom
     FROM users u
     LEFT JOIN profils p ON u.profil_id = p.id
     WHERE u.tenant_id = ?
     ORDER BY u.nom`
  ).bind(tenantId).all()
  return c.json(users.results)
})

app.post('/api/users', requireAuth, async (c) => {
  const session = c.get('session') as any
  const tenantId = c.get('tenantId')
  const ok = await hasPermission(c.env.DB, session.profil_id, session.role, 'utilisateurs', 'write')
  if (!ok) return c.json({ error: 'Permission refusée' }, 403)

  const data = await c.req.json()
  const password = data.password || 'SanteTravail2026!'
  const hash = await sha256(password)

  const result = await c.env.DB.prepare(
    `INSERT INTO users (tenant_id, nom, prenom, email, password_hash, role, specialite, telephone, numero_ordre, profil_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(tenantId, data.nom, data.prenom, data.email, hash, data.role, data.specialite, data.telephone, data.numero_ordre || null, data.profil_id || null).run()

  c.executionCtx.waitUntil(
    sendEmail(
      c.env,
      { name: `${data.prenom} ${data.nom}`, email: data.email },
      'Votre compte SantéTravail.CI',
      welcomeEmailHtml({ nom: data.nom, prenom: data.prenom, email: data.email, password, role: data.role })
    ).catch((e) => console.error('Envoi email bienvenue échoué:', e))
  )

  return c.json({ id: result.meta.last_row_id }, 201)
})

app.put('/api/users/:id', requireAuth, async (c) => {
  const session = c.get('session') as any
  const tenantId = c.get('tenantId')
  const ok = await hasPermission(c.env.DB, session.profil_id, session.role, 'utilisateurs', 'write')
  if (!ok) return c.json({ error: 'Permission refusée' }, 403)

  const id = c.req.param('id')
  const data = await c.req.json()
  await c.env.DB.prepare(
    `UPDATE users SET nom=?, prenom=?, email=?, role=?, specialite=?, telephone=?, actif=?,
     numero_ordre=?, profil_id=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=?`
  ).bind(data.nom, data.prenom, data.email, data.role, data.specialite, data.telephone,
    data.actif ?? 1, data.numero_ordre || null, data.profil_id || null, id, tenantId).run()
  return c.json({ success: true })
})

app.delete('/api/users/:id', requireAuth, async (c) => {
  const session = c.get('session') as any
  const tenantId = c.get('tenantId')
  const ok = await hasPermission(c.env.DB, session.profil_id, session.role, 'utilisateurs', 'delete')
  if (!ok) return c.json({ error: 'Permission refusée' }, 403)

  const currentUserId = c.get('userId')
  const id = c.req.param('id')
  if (Number(id) === Number(currentUserId)) {
    return c.json({ error: 'Vous ne pouvez pas supprimer votre propre compte.' }, 400)
  }

  // Suppression réelle : d'abord les sessions, puis l'utilisateur
  await c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id).run()
  await c.env.DB.prepare('DELETE FROM users WHERE id = ? AND tenant_id = ?').bind(id, tenantId).run()

  return c.json({ success: true })
})

// ============================================================
// REGISTRE DE VISITE JOURNALIÈRE (Art. 7, 29 — Décret 2026-206)
// ============================================================
app.get('/api/registre-journalier', requireAuth, async (c) => {
  const tenantId = c.get('tenantId')
  const date = c.req.query('date') || new Date().toISOString().slice(0, 10)
  const entrepriseId = c.req.query('entreprise_id')
  let query = `
    SELECT r.*, t.numero_matricule as mat_travailleur,
           u.nom as medecin_nom, u.prenom as medecin_prenom
    , (SELECT COUNT(*) FROM registre_confirmations rc WHERE rc.registre_id = r.id) as confirme_count
    FROM registre_journalier r
    LEFT JOIN travailleurs t ON r.travailleur_id = t.id
    LEFT JOIN users u ON r.medecin_id = u.id
    WHERE r.date_visite = ? AND r.tenant_id = ?`
  const params: any[] = [date, tenantId]
  if (entrepriseId) { query += ' AND r.entreprise = ?'; params.push(entrepriseId) }
  query += ' ORDER BY r.heure_arrivee ASC'
  const rows = await c.env.DB.prepare(query).bind(...params).all()
  return c.json(rows.results)
})

app.post('/api/registre-journalier/:id/confirmer', requireAuth, async (c) => {
  const session = c.get('session') as any
  const tenantId = c.get('tenantId')
  const ok = await hasPermission(c.env.DB, session.profil_id, session.role, 'registre', 'write')
  if (!ok) return c.json({ error: 'Permission refusée' }, 403)

  const id = c.req.param('id')
  // Ensure confirmations table exists
  await c.env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS registre_confirmations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      registre_id INTEGER NOT NULL,
      tenant_id INTEGER,
      user_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run()

  await c.env.DB.prepare(`INSERT INTO registre_confirmations (registre_id, tenant_id, user_id) VALUES (?, ?, ?)`)
    .bind(id, tenantId, session.user_id || null).run()

  return c.json({ success: true })
})

app.get('/api/registre-journalier/periode', requireAuth, async (c) => {
  const tenantId = c.get('tenantId')
  const du = c.req.query('du')
  const au = c.req.query('au')
  const entrepriseId = c.req.query('entreprise_id')
  let query = `
    SELECT r.*, u.nom as medecin_nom, u.prenom as medecin_prenom
    FROM registre_journalier r
    LEFT JOIN users u ON r.medecin_id = u.id
    WHERE r.tenant_id = ?`
  const params: any[] = [tenantId]
  if (du) { query += ' AND r.date_visite >= ?'; params.push(du) }
  if (au) { query += ' AND r.date_visite <= ?'; params.push(au) }
  if (entrepriseId) { query += ' AND r.entreprise = ?'; params.push(entrepriseId) }
  query += ' ORDER BY r.date_visite DESC, r.heure_arrivee ASC LIMIT 500'
  const rows = await c.env.DB.prepare(query).bind(...params).all()
  return c.json(rows.results)
})

app.post('/api/registre-journalier', requireAuth, async (c) => {
  const session = c.get('session') as any
  const tenantId = c.get('tenantId')
  const ok = await hasPermission(c.env.DB, session.profil_id, session.role, 'registre', 'write')
  if (!ok) return c.json({ error: 'Permission refusée' }, 403)

  const data = await c.req.json()
  let nom = data.nom_prenom, poste = data.poste_travail

  if (data.travailleur_id) {
    const t = await c.env.DB.prepare('SELECT * FROM travailleurs WHERE id = ? AND tenant_id = ?').bind(data.travailleur_id, tenantId).first() as any
    if (t) {
      nom = nom || (t.nom + ' ' + (t.prenom || ''))
      poste = poste || t.poste
    }
  }

  const result = await c.env.DB.prepare(`
    INSERT INTO registre_journalier (tenant_id, date_visite, heure_arrivee, travailleur_id, medecin_id,
    nom_prenom, entreprise, poste_travail, type_visite, motif, aptitude_conclue, observations)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    tenantId,
    data.date_visite || new Date().toISOString().slice(0, 10),
    data.heure_arrivee || new Date().toTimeString().slice(0, 5),
    data.travailleur_id || null, data.medecin_id || session.user_id || null,
    nom || 'Non renseigné',
    data.entreprise || null, poste || null,
    data.type_visite || 'spontanee', data.motif || null,
    data.aptitude_conclue || null, data.observations || null
  ).run()
  return c.json({ id: result.meta.last_row_id }, 201)
})

app.put('/api/registre-journalier/:id', requireAuth, async (c) => {
  const session = c.get('session') as any
  const tenantId = c.get('tenantId')
  const ok = await hasPermission(c.env.DB, session.profil_id, session.role, 'registre', 'write')
  if (!ok) return c.json({ error: 'Permission refusée' }, 403)

  const id = c.req.param('id')
  const data = await c.req.json()
  let nom = data.nom_prenom, poste = data.poste_travail
  if (data.travailleur_id) {
    const t = await c.env.DB.prepare('SELECT * FROM travailleurs WHERE id = ? AND tenant_id = ?').bind(data.travailleur_id, tenantId).first() as any
    if (t) {
      nom = nom || (t.nom + ' ' + (t.prenom || ''))
      poste = poste || t.poste
    }
  }

  await c.env.DB.prepare(`
    UPDATE registre_journalier SET date_visite=?, heure_arrivee=?, travailleur_id=?, medecin_id=?,
      nom_prenom=?, entreprise=?, poste_travail=?, type_visite=?, motif=?, aptitude_conclue=?, observations=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=? AND tenant_id=?
  `).bind(
    data.date_visite || new Date().toISOString().slice(0, 10),
    data.heure_arrivee || new Date().toTimeString().slice(0, 5),
    data.travailleur_id || null, data.medecin_id || session.user_id || null,
    nom || 'Non renseigné', data.entreprise || null, poste || null,
    data.type_visite || 'spontanee', data.motif || null,
    data.aptitude_conclue || null, data.observations || null,
    id, tenantId
  ).run()
  return c.json({ success: true })
})

app.delete('/api/registre-journalier/:id', requireAuth, async (c) => {
  const session = c.get('session') as any
  const tenantId = c.get('tenantId')
  const ok = await hasPermission(c.env.DB, session.profil_id, session.role, 'registre', 'delete')
  if (!ok) return c.json({ error: 'Permission refusée' }, 403)

  const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM registre_journalier WHERE id=? AND tenant_id=?').bind(id, tenantId).run()
  return c.json({ success: true })
})

app.get('/api/registre-journalier/stats/:date', requireAuth, async (c) => {
  const tenantId = c.get('tenantId')
  const date = c.req.param('date')
  const stats = await c.env.DB.prepare(`
    SELECT COUNT(*) as total,
           SUM(CASE WHEN type_visite='embauche' THEN 1 ELSE 0 END) as embauche,
           SUM(CASE WHEN type_visite='periodique' THEN 1 ELSE 0 END) as periodique,
           SUM(CASE WHEN type_visite='reprise' THEN 1 ELSE 0 END) as reprise,
           SUM(CASE WHEN type_visite='spontanee' THEN 1 ELSE 0 END) as spontanee
    FROM registre_journalier WHERE date_visite = ? AND tenant_id = ?
  `).bind(date, tenantId).first()
  return c.json(stats)
})

// ============================================================
// CERTIFICATS D'APTITUDE/INAPTITUDE (Art. 25-28)
// ============================================================
app.get('/api/certificats', requireAuth, async (c) => {
  const tenantId = c.get('tenantId')
  const travailleurId = c.req.query('travailleur_id')
  let query = `
    SELECT ca.*, t.nom, t.prenom, t.poste, t.numero_matricule, e.nom as entreprise,
           u.nom as medecin_nom, u.prenom as medecin_prenom
    FROM certificats_aptitude ca
    JOIN travailleurs t ON ca.travailleur_id = t.id
    LEFT JOIN entreprises e ON t.entreprise_id = e.id
    LEFT JOIN users u ON ca.medecin_id = u.id
    WHERE ca.tenant_id = ?`
  const params: any[] = [tenantId]
  if (travailleurId) { query += ' AND ca.travailleur_id = ?'; params.push(travailleurId) }
  query += ' ORDER BY ca.date_emission DESC'
  const rows = await c.env.DB.prepare(query).bind(...params).all()
  return c.json(rows.results)
})

app.get('/api/certificats/:id', requireAuth, async (c) => {
  const tenantId = c.get('tenantId')
  const id = c.req.param('id')
  const cert = await c.env.DB.prepare(`
    SELECT ca.*, t.nom, t.prenom, t.date_naissance, t.sexe, t.poste, t.numero_matricule,
           t.groupe_sanguin, t.antecedents_personnels, t.allergies,
           e.nom as entreprise, e.adresse as entreprise_adresse,
           u.nom as medecin_nom, u.prenom as medecin_prenom, u.specialite as medecin_specialite
    FROM certificats_aptitude ca
    JOIN travailleurs t ON ca.travailleur_id = t.id
    LEFT JOIN entreprises e ON t.entreprise_id = e.id
    LEFT JOIN users u ON ca.medecin_id = u.id
    WHERE ca.id = ? AND ca.tenant_id = ?
  `).bind(id, tenantId).first()
  if (!cert) return c.json({ error: 'Certificat non trouvé' }, 404)
  return c.json(cert)
})

app.post('/api/certificats', requireAuth, async (c) => {
  const session = c.get('session') as any
  const tenantId = c.get('tenantId')
  const ok = await hasPermission(c.env.DB, session.profil_id, session.role, 'certificats', 'write')
  if (!ok) return c.json({ error: 'Permission refusée' }, 403)

  const data = await c.req.json()

  // Validation Art. 26 : pour l'inaptitude, 2 examens + étude du poste obligatoires
  if (data.aptitude && data.aptitude.includes('inapte')) {
    if (!data.etude_poste_realisee || !data.deux_examens_realises) {
      return c.json({ error: 'Art. 26 : Pour constater une inaptitude, une étude du poste ET deux examens médicaux espacés de 2 semaines sont obligatoires.' }, 422)
    }
  }

  const year = new Date().getFullYear()
  const countRow = await c.env.DB.prepare(
    "SELECT COUNT(*) as cnt FROM certificats_aptitude WHERE tenant_id = ? AND strftime('%Y', date_emission) = ?"
  ).bind(tenantId, String(year)).first() as any
  const num = String((countRow?.cnt || 0) + 1).padStart(4, '0')
  const numero = `CERT-${year}-${num}`

  const validite = data.validite_mois || 12
  const expiration = new Date()
  expiration.setMonth(expiration.getMonth() + validite)

  const result = await c.env.DB.prepare(`
    INSERT INTO certificats_aptitude (tenant_id, numero_certificat, visite_id, travailleur_id, medecin_id,
    date_emission, type_certificat, aptitude, etude_poste_realisee, deux_examens_realises,
    date_premier_examen, date_second_examen, poste_travail, restrictions, amenagements,
    motif_inaptitude, validite_jours, date_expiration, observations)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    tenantId, numero, data.visite_id || null, data.travailleur_id, data.medecin_id,
    data.date_emission || new Date().toISOString().slice(0, 10),
    data.type_certificat || 'aptitude', data.aptitude,
    data.etude_poste_realisee || 0, data.deux_examens_realises || 0,
    data.date_premier_examen || null, data.date_second_examen || null,
    data.poste_travail, data.restrictions, data.amenagements, data.motif_inaptitude,
    validite * 30, expiration.toISOString().slice(0, 10), data.observations
  ).run()

  if (data.aptitude && data.aptitude.includes('inapte')) {
    await c.env.DB.prepare(
      "INSERT INTO alertes (tenant_id, travailleur_id, type_alerte, message, priorite, date_echeance) VALUES (?, ?, 'risque_expose', ?, 'haute', ?)"
    ).bind(tenantId, data.travailleur_id, `Inaptitude constatée (${data.aptitude}) — Certificat ${numero}`, expiration.toISOString().slice(0, 10)).run()
  }

  return c.json({ id: result.meta.last_row_id, numero_certificat: numero }, 201)
})

app.put('/api/certificats/:id', requireAuth, async (c) => {
  const session = c.get('session') as any
  const tenantId = c.get('tenantId')
  const ok = await hasPermission(c.env.DB, session.profil_id, session.role, 'certificats', 'write')
  if (!ok) return c.json({ error: 'Permission refusée' }, 403)

  const id = c.req.param('id')
  const data = await c.req.json()
  await c.env.DB.prepare(`
    UPDATE certificats_aptitude SET visite_id=?, travailleur_id=?, medecin_id=?, date_emission=?,
      type_certificat=?, aptitude=?, etude_poste_realisee=?, deux_examens_realises=?, date_premier_examen=?,
      date_second_examen=?, poste_travail=?, restrictions=?, amenagements=?, motif_inaptitude=?,
      validite_jours=?, date_expiration=?, observations=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=? AND tenant_id=?
  `).bind(
    data.visite_id || null, data.travailleur_id, data.medecin_id || session.user_id,
    data.date_emission || new Date().toISOString().slice(0, 10),
    data.type_certificat || 'aptitude', data.aptitude,
    data.etude_poste_realisee || 0, data.deux_examens_realises || 0,
    data.date_premier_examen || null, data.date_second_examen || null,
    data.poste_travail || null, data.restrictions || null, data.amenagements || null,
    data.motif_inaptitude || null, data.validite_jours || null, data.date_expiration || null,
    data.observations || null, id, tenantId
  ).run()
  return c.json({ success: true })
})

app.delete('/api/certificats/:id', requireAuth, async (c) => {
  const session = c.get('session') as any
  const tenantId = c.get('tenantId')
  const ok = await hasPermission(c.env.DB, session.profil_id, session.role, 'certificats', 'delete')
  if (!ok) return c.json({ error: 'Permission refusée' }, 403)

  const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM certificats_aptitude WHERE id=? AND tenant_id=?').bind(id, tenantId).run()
  return c.json({ success: true })
})

// Contester un certificat (Art. 28 — délai 2 mois)
app.post('/api/certificats/:id/contester', requireAuth, async (c) => {
  const tenantId = c.get('tenantId')
  const id = c.req.param('id')
  const { motif } = await c.req.json()
  const cert = await c.env.DB.prepare("SELECT * FROM certificats_aptitude WHERE id = ? AND tenant_id = ?").bind(id, tenantId).first() as any
  if (!cert) return c.json({ error: 'Certificat non trouvé' }, 404)

  const dateEmission = new Date(cert.date_emission)
  const deuxMois = new Date(dateEmission)
  deuxMois.setMonth(deuxMois.getMonth() + 2)
  if (new Date() > deuxMois) {
    return c.json({ error: 'Art. 28 : Le délai de 2 mois pour contester est dépassé.' }, 400)
  }

  await c.env.DB.prepare(`
    UPDATE certificats_aptitude SET conteste=1, date_contestation=date('now'),
    motif_contestation=?, statut='conteste' WHERE id=? AND tenant_id=?
  `).bind(motif, id, tenantId).run()
  return c.json({ success: true, message: 'Contestation enregistrée. Le médecin inspecteur dispose de 4 mois pour statuer (Art. 28).' })
})

// Envoyer le certificat par email au travailleur
app.post('/api/certificats/:id/envoyer-email', requireAuth, async (c) => {
  const tenantId = c.get('tenantId')
  const id = c.req.param('id')
  const { email: overrideEmail } = await c.req.json().catch(() => ({} as any))

  const cert = await c.env.DB.prepare(`
    SELECT ca.*, t.nom, t.prenom, t.email as travailleur_email
    FROM certificats_aptitude ca
    JOIN travailleurs t ON ca.travailleur_id = t.id
    WHERE ca.id = ? AND ca.tenant_id = ?
  `).bind(id, tenantId).first() as any
  if (!cert) return c.json({ error: 'Certificat non trouvé' }, 404)

  const email = overrideEmail || cert.travailleur_email
  if (!email) return c.json({ error: "Aucune adresse email pour ce travailleur. Fournissez-en une." }, 400)

  await sendEmail(
    c.env,
    { name: `${cert.prenom} ${cert.nom}`, email },
    `Certificat d'aptitude ${cert.numero_certificat}`,
    `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#006B3C">Certificat d'aptitude médicale</h2>
        <p>Bonjour ${cert.prenom} ${cert.nom},</p>
        <p>Voici les conclusions de votre certificat <strong>${cert.numero_certificat}</strong> émis le ${cert.date_emission} :</p>
        <p style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px">
          <strong>Aptitude :</strong> ${cert.aptitude}<br>
          ${cert.restrictions ? `<strong>Restrictions :</strong> ${cert.restrictions}<br>` : ''}
          ${cert.amenagements ? `<strong>Aménagements :</strong> ${cert.amenagements}<br>` : ''}
          <strong>Valide jusqu'au :</strong> ${cert.date_expiration}
        </p>
        <p>Le document officiel complet reste disponible auprès de votre service de médecine du travail.</p>
      </div>
    `
  )

  return c.json({ success: true })
})

// ============================================================
// MALADIES PROFESSIONNELLES & ACCIDENTS (Art. 11, 14, 30)
// ============================================================
app.get('/api/maladies-accidents', requireAuth, async (c) => {
  const tenantId = c.get('tenantId')
  const travailleurId = c.req.query('travailleur_id')
  let query = `
    SELECT ma.*, t.nom, t.prenom, t.poste, e.nom as entreprise
    FROM maladies_accidents ma
    JOIN travailleurs t ON ma.travailleur_id = t.id
    LEFT JOIN entreprises e ON t.entreprise_id = e.id
    WHERE ma.tenant_id = ?`
  const params: any[] = [tenantId]
  if (travailleurId) { query += ' AND ma.travailleur_id = ?'; params.push(travailleurId) }
  query += ' ORDER BY ma.date_evenement DESC'
  const rows = await c.env.DB.prepare(query).bind(...params).all()
  return c.json(rows.results)
})

app.post('/api/maladies-accidents', requireAuth, async (c) => {
  const session = c.get('session') as any
  const tenantId = c.get('tenantId')
  const ok = await hasPermission(c.env.DB, session.profil_id, session.role, 'maladies', 'write')
  if (!ok) return c.json({ error: 'Permission refusée' }, 403)

  const data = await c.req.json()
  const result = await c.env.DB.prepare(`
    INSERT INTO maladies_accidents (tenant_id, travailleur_id, medecin_id, type_evenement,
    date_evenement, date_declaration, declare_24h, medecin_chef_notifie, inspection_notifiee,
    description, siege_lesion, nature_lesion, circonstances, agent_causal,
    arret_travail, duree_arret_jours, hospitalisation, sequelles,
    organisme_securite_sociale, statut)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    tenantId, data.travailleur_id, data.medecin_id || session.user_id || null,
    data.type_evenement, data.date_evenement,
    data.date_declaration || new Date().toISOString().slice(0, 10),
    data.declare_24h || 0, data.medecin_chef_notifie || 0, data.inspection_notifiee || 0,
    data.description, data.siege_lesion || null, data.nature_lesion || null,
    data.circonstances || null, data.agent_causal || null,
    data.arret_travail || 0, data.duree_arret_jours || 0,
    data.hospitalisation || 0, data.sequelles || null,
    data.organisme_securite_sociale || null, data.statut || 'declare'
  ).run()

  if (data.type_evenement === 'maladie_contagieuse' || data.type_evenement === 'maladie_infectieuse') {
    await c.env.DB.prepare(
      "INSERT INTO alertes (tenant_id, travailleur_id, type_alerte, message, priorite) VALUES (?, ?, 'risque_expose', ?, 'urgente')"
    ).bind(tenantId, data.travailleur_id, '⚠️ URGENT (Art. 30) : Maladie contagieuse — Notification obligatoire dans les 24 h au médecin chef et à l\'inspecteur du travail').run()
  }

  return c.json({ id: result.meta.last_row_id }, 201)
})

app.put('/api/maladies-accidents/:id', requireAuth, async (c) => {
  const session = c.get('session') as any
  const tenantId = c.get('tenantId')
  const ok = await hasPermission(c.env.DB, session.profil_id, session.role, 'maladies', 'write')
  if (!ok) return c.json({ error: 'Permission refusée' }, 403)

  const id = c.req.param('id')
  const data = await c.req.json()
  await c.env.DB.prepare(`
    UPDATE maladies_accidents SET travailleur_id=?, medecin_id=?, type_evenement=?, date_evenement=?,
      date_declaration=?, declare_24h=?, medecin_chef_notifie=?, inspection_notifiee=?, description=?,
      siege_lesion=?, nature_lesion=?, circonstances=?, agent_causal=?, arret_travail=?,
      duree_arret_jours=?, hospitalisation=?, sequelles=?, organisme_securite_sociale=?, statut=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=? AND tenant_id=?
  `).bind(
    data.travailleur_id, data.medecin_id || session.user_id || null, data.type_evenement,
    data.date_evenement, data.date_declaration || new Date().toISOString().slice(0, 10),
    data.declare_24h || 0, data.medecin_chef_notifie || 0, data.inspection_notifiee || 0,
    data.description || null, data.siege_lesion || null, data.nature_lesion || null,
    data.circonstances || null, data.agent_causal || null, data.arret_travail || 0,
    data.duree_arret_jours || 0, data.hospitalisation || 0, data.sequelles || null,
    data.organisme_securite_sociale || null, data.statut || 'declare', id, tenantId
  ).run()
  return c.json({ success: true })
})

app.delete('/api/maladies-accidents/:id', requireAuth, async (c) => {
  const session = c.get('session') as any
  const tenantId = c.get('tenantId')
  const ok = await hasPermission(c.env.DB, session.profil_id, session.role, 'maladies', 'delete')
  if (!ok) return c.json({ error: 'Permission refusée' }, 403)

  const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM maladies_accidents WHERE id=? AND tenant_id=?').bind(id, tenantId).run()
  return c.json({ success: true })
})

// ============================================================
// FICHE D'ENTREPRISE / RISQUES (Art. 12, 14, 36)
// ============================================================
app.get('/api/fiche-entreprise/:entrepriseId', requireAuth, async (c) => {
  const tenantId = c.get('tenantId')
  const id = c.req.param('entrepriseId')
  const fiche = await c.env.DB.prepare(`
    SELECT fe.*, e.nom as entreprise_nom, e.secteur,
           u.nom as medecin_nom, u.prenom as medecin_prenom
    FROM fiche_entreprise fe
    JOIN entreprises e ON fe.entreprise_id = e.id
    LEFT JOIN users u ON fe.medecin_id = u.id
    WHERE fe.entreprise_id = ? AND fe.tenant_id = ?
    ORDER BY fe.date_mise_a_jour DESC LIMIT 1
  `).bind(id, tenantId).first()
  return c.json(fiche || null)
})

app.post('/api/fiche-entreprise', requireAuth, async (c) => {
  const session = c.get('session') as any
  const tenantId = c.get('tenantId')
  const ok = await hasPermission(c.env.DB, session.profil_id, session.role, 'entreprises', 'write')
  if (!ok) return c.json({ error: 'Permission refusée' }, 403)

  const data = await c.req.json()
  const effectif = data.effectif_total || 0
  let categorie = 'E'
  if (effectif > 5000) categorie = 'A'
  else if (effectif >= 1000) categorie = 'B'
  else if (effectif >= 500) categorie = 'C'
  else if (effectif >= 100) categorie = 'D'

  await c.env.DB.prepare('UPDATE entreprises SET effectif=?, categorie=? WHERE id=? AND tenant_id=?').bind(effectif, categorie, data.entreprise_id, tenantId).run()

  const existing = await c.env.DB.prepare('SELECT id FROM fiche_entreprise WHERE entreprise_id = ? AND tenant_id = ?').bind(data.entreprise_id, tenantId).first() as any
  if (existing) {
    await c.env.DB.prepare(`
      UPDATE fiche_entreprise SET medecin_id=?, date_mise_a_jour=date('now'), effectif_total=?,
      effectif_femmes=?, effectif_jeunes=?, effectif_handicapes=?,
      postes_risque=?, risques_chimiques=?, risques_physiques=?,
      risques_biologiques=?, risques_ergonomiques=?, risques_psychosociaux=?,
      epi_fournis=?, formation_securite=?, plan_prevention=?, observations=?
      WHERE entreprise_id=? AND tenant_id=?
    `).bind(
      data.medecin_id || session.user_id, data.effectif_total, data.effectif_femmes || 0,
      data.effectif_jeunes || 0, data.effectif_handicapes || 0,
      data.postes_risque, data.risques_chimiques, data.risques_physiques,
      data.risques_biologiques, data.risques_ergonomiques, data.risques_psychosociaux,
      data.epi_fournis, data.formation_securite || 0, data.plan_prevention, data.observations,
      data.entreprise_id, tenantId
    ).run()
    return c.json({ success: true, categorie })
  }

  const result = await c.env.DB.prepare(`
    INSERT INTO fiche_entreprise (tenant_id, entreprise_id, date_mise_a_jour, medecin_id,
    effectif_total, effectif_femmes, effectif_jeunes, effectif_handicapes,
    postes_risque, risques_chimiques, risques_physiques, risques_biologiques,
    risques_ergonomiques, risques_psychosociaux, epi_fournis, formation_securite,
    plan_prevention, observations)
    VALUES (?, ?, date('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    tenantId, data.entreprise_id, data.medecin_id || session.user_id,
    data.effectif_total, data.effectif_femmes || 0, data.effectif_jeunes || 0, data.effectif_handicapes || 0,
    data.postes_risque, data.risques_chimiques, data.risques_physiques,
    data.risques_biologiques, data.risques_ergonomiques, data.risques_psychosociaux,
    data.epi_fournis, data.formation_securite || 0, data.plan_prevention, data.observations
  ).run()
  return c.json({ id: result.meta.last_row_id, categorie }, 201)
})

// ============================================================
// TIERS-TEMPS TECHNIQUE (Art. 6, 14 — Décret 2026-206)
// ============================================================
app.get('/api/tiers-temps', requireAuth, async (c) => {
  const tenantId = c.get('tenantId')
  const entrepriseId = c.req.query('entreprise_id')
  const mois = c.req.query('mois')
  let query = `
    SELECT tt.*, e.nom as entreprise_nom, u.nom as medecin_nom, u.prenom as medecin_prenom
    FROM tiers_temps tt
    JOIN entreprises e ON tt.entreprise_id = e.id
    LEFT JOIN users u ON tt.medecin_id = u.id
    WHERE tt.tenant_id = ?`
  const params: any[] = [tenantId]
  if (entrepriseId) { query += ' AND tt.entreprise_id = ?'; params.push(entrepriseId) }
  if (mois) { query += " AND strftime('%Y-%m', tt.date_mission) = ?"; params.push(mois) }
  query += ' ORDER BY tt.date_mission DESC'
  const rows = await c.env.DB.prepare(query).bind(...params).all()
  return c.json(rows.results)
})

app.post('/api/tiers-temps', requireAuth, async (c) => {
  const session = c.get('session') as any
  const tenantId = c.get('tenantId')
  const ok = await hasPermission(c.env.DB, session.profil_id, session.role, 'tiers_temps', 'write')
  if (!ok) return c.json({ error: 'Permission refusée' }, 403)

  const data = await c.req.json()
  const result = await c.env.DB.prepare(`
    INSERT INTO tiers_temps (tenant_id, medecin_id, entreprise_id, date_mission, type_mission,
    duree_heures, description, participants, resultats, recommandations)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    tenantId, data.medecin_id || session.user_id, data.entreprise_id,
    data.date_mission || new Date().toISOString().slice(0, 10),
    data.type_mission, data.duree_heures || 1,
    data.description || null, data.participants || null,
    data.resultats || null, data.recommandations || null
  ).run()
  return c.json({ id: result.meta.last_row_id }, 201)
})

app.put('/api/tiers-temps/:id', requireAuth, async (c) => {
  const session = c.get('session') as any
  const tenantId = c.get('tenantId')
  const ok = await hasPermission(c.env.DB, session.profil_id, session.role, 'tiers_temps', 'write')
  if (!ok) return c.json({ error: 'Permission refusée' }, 403)

  const id = c.req.param('id')
  const data = await c.req.json()
  await c.env.DB.prepare(`
    UPDATE tiers_temps SET medecin_id=?, entreprise_id=?, date_mission=?, type_mission=?,
      duree_heures=?, description=?, participants=?, resultats=?, recommandations=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=? AND tenant_id=?
  `).bind(
    data.medecin_id || session.user_id, data.entreprise_id,
    data.date_mission || new Date().toISOString().slice(0, 10),
    data.type_mission, data.duree_heures || 1,
    data.description || null, data.participants || null,
    data.resultats || null, data.recommandations || null,
    id, tenantId
  ).run()
  return c.json({ success: true })
})

app.delete('/api/tiers-temps/:id', requireAuth, async (c) => {
  const session = c.get('session') as any
  const tenantId = c.get('tenantId')
  const ok = await hasPermission(c.env.DB, session.profil_id, session.role, 'tiers_temps', 'delete')
  if (!ok) return c.json({ error: 'Permission refusée' }, 403)

  const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM tiers_temps WHERE id=? AND tenant_id=?').bind(id, tenantId).run()
  return c.json({ success: true })
})

app.get('/api/tiers-temps/stats', requireAuth, async (c) => {
  const tenantId = c.get('tenantId')
  const annee = c.req.query('annee') || new Date().getFullYear()
  const stats = await c.env.DB.prepare(`
    SELECT tt.entreprise_id, e.nom as entreprise,
           COUNT(*) as nb_missions, SUM(tt.duree_heures) as total_heures
    FROM tiers_temps tt
    JOIN entreprises e ON tt.entreprise_id = e.id
    WHERE strftime('%Y', tt.date_mission) = ? AND tt.tenant_id = ?
    GROUP BY tt.entreprise_id, e.nom
  `).bind(String(annee), tenantId).all()
  return c.json(stats.results)
})

// ============================================================
// RAPPORTS ANNUELS (Art. 30.1)
// ============================================================
app.get('/api/rapports-annuels', requireAuth, async (c) => {
  const tenantId = c.get('tenantId')
  const annee = c.req.query('annee')
  const entrepriseId = c.req.query('entreprise_id')
  let query = `
    SELECT ra.*, e.nom as entreprise_nom, u.nom as medecin_nom, u.prenom as medecin_prenom
    FROM rapports_annuels ra
    LEFT JOIN entreprises e ON ra.entreprise_id = e.id
    LEFT JOIN users u ON ra.medecin_chef_id = u.id
    WHERE ra.tenant_id = ?`
  const params: any[] = [tenantId]
  if (annee) { query += ' AND ra.annee = ?'; params.push(annee) }
  if (entrepriseId) { query += ' AND ra.entreprise_id = ?'; params.push(entrepriseId) }
  query += ' ORDER BY ra.annee DESC'
  const rows = await c.env.DB.prepare(query).bind(...params).all()
  return c.json(rows.results)
})

app.post('/api/rapports-annuels/generer', requireAuth, async (c) => {
  const session = c.get('session') as any
  const tenantId = c.get('tenantId')
  const { entreprise_id, annee } = await c.req.json()
  const medecin_id = session.user_id

  const [visites, consultations, maladies, registre] = await Promise.all([
    c.env.DB.prepare(`
      SELECT COUNT(*) as total,
             SUM(CASE WHEN vm.type_visite='embauche' THEN 1 ELSE 0 END) as embauche,
             SUM(CASE WHEN vm.type_visite='periodique' THEN 1 ELSE 0 END) as periodique,
             SUM(CASE WHEN vm.type_visite='reprise' THEN 1 ELSE 0 END) as reprise,
             SUM(CASE WHEN vm.type_visite='spontanee' THEN 1 ELSE 0 END) as spontanee,
             SUM(CASE WHEN vm.aptitude='apte' THEN 1 ELSE 0 END) as aptes,
             SUM(CASE WHEN vm.aptitude IN ('apte_amenagement','apte_temporaire') THEN 1 ELSE 0 END) as aptes_restriction,
             SUM(CASE WHEN vm.aptitude='inapte_temporaire' THEN 1 ELSE 0 END) as inaptes_temp,
             SUM(CASE WHEN vm.aptitude='inapte_definitif' THEN 1 ELSE 0 END) as inaptes_def
      FROM visites_medicales vm
      JOIN travailleurs t ON vm.travailleur_id = t.id
      WHERE t.entreprise_id = ? AND strftime('%Y', vm.date_visite) = ? AND vm.tenant_id = ?
    `).bind(entreprise_id, String(annee), tenantId).first(),
    c.env.DB.prepare(`SELECT COUNT(*) as total FROM consultations c JOIN travailleurs t ON c.travailleur_id = t.id WHERE t.entreprise_id = ? AND strftime('%Y', c.date_consultation) = ? AND c.tenant_id = ?`).bind(entreprise_id, String(annee), tenantId).first(),
    c.env.DB.prepare(`SELECT COUNT(*) as mp, SUM(CASE WHEN type_evenement='accident_travail' THEN 1 ELSE 0 END) as at FROM maladies_accidents ma JOIN travailleurs t ON ma.travailleur_id = t.id WHERE t.entreprise_id = ? AND strftime('%Y', ma.date_evenement) = ? AND ma.tenant_id = ?`).bind(entreprise_id, String(annee), tenantId).first(),
    c.env.DB.prepare(`SELECT COUNT(*) as cnt FROM registre_journalier WHERE strftime('%Y', date_visite) = ? AND tenant_id = ?`).bind(String(annee), tenantId).first()
  ])

  const v = visites as any; const m = maladies as any
  const rData = {
    nb_visites_embauche: v?.embauche || 0, nb_visites_periodiques: v?.periodique || 0,
    nb_visites_reprise: v?.reprise || 0, nb_visites_spontanees: v?.spontanee || 0,
    nb_visites_journalieres: (registre as any)?.cnt || 0,
    nb_consultations_total: (consultations as any)?.total || 0,
    nb_maladies_pro: m?.mp || 0, nb_accidents_travail: m?.at || 0,
    nb_aptes: v?.aptes || 0, nb_aptes_amenagement: v?.aptes_restriction || 0,
    nb_inaptes_temporaires: v?.inaptes_temp || 0, nb_inaptes_definitifs: v?.inaptes_def || 0
  }

  const existing = await c.env.DB.prepare('SELECT id FROM rapports_annuels WHERE entreprise_id=? AND annee=? AND tenant_id=?').bind(entreprise_id, annee, tenantId).first() as any
  if (existing) {
    await c.env.DB.prepare(`
      UPDATE rapports_annuels SET medecin_chef_id=?, nb_visites_embauche=?, nb_visites_periodiques=?,
      nb_visites_reprises=?, nb_visites_total=?, nb_aptes=?, nb_aptes_amenagement=?,
      nb_inaptes_temporaires=?, nb_inaptes_definitifs=?, nb_maladies_pro=?, nb_accidents_travail=?,
      updated_at=CURRENT_TIMESTAMP WHERE entreprise_id=? AND annee=? AND tenant_id=?
    `).bind(
      medecin_id, rData.nb_visites_embauche, rData.nb_visites_periodiques,
      rData.nb_visites_reprise, (v?.total || 0),
      rData.nb_aptes, rData.nb_aptes_amenagement, rData.nb_inaptes_temporaires, rData.nb_inaptes_definitifs,
      rData.nb_maladies_pro, rData.nb_accidents_travail,
      entreprise_id, annee, tenantId
    ).run()
    return c.json({ success: true, id: existing.id, ...rData })
  }

  const result = await c.env.DB.prepare(`
    INSERT INTO rapports_annuels (tenant_id, entreprise_id, annee, medecin_chef_id,
    nb_visites_embauche, nb_visites_periodiques, nb_visites_reprises, nb_visites_total,
    nb_aptes, nb_aptes_amenagement, nb_inaptes_temporaires, nb_inaptes_definitifs,
    nb_maladies_pro, nb_accidents_travail)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    tenantId, entreprise_id, annee, medecin_id,
    rData.nb_visites_embauche, rData.nb_visites_periodiques, rData.nb_visites_reprise, (v?.total || 0),
    rData.nb_aptes, rData.nb_aptes_amenagement, rData.nb_inaptes_temporaires, rData.nb_inaptes_definitifs,
    rData.nb_maladies_pro, rData.nb_accidents_travail
  ).run()
  return c.json({ id: result.meta.last_row_id, ...rData }, 201)
})

app.put('/api/rapports-annuels/:id', requireAuth, async (c) => {
  const tenantId = c.get('tenantId')
  const id = c.req.param('id')
  const data = await c.req.json()
  await c.env.DB.prepare(`
    UPDATE rapports_annuels SET principaux_risques=?, actions_prevention=?,
    observations_generales=?, recommandations=?, statut=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=? AND tenant_id=?
  `).bind(data.principaux_risques, data.actions_prevention, data.observations_generales, data.recommandations, data.statut || 'brouillon', id, tenantId).run()
  return c.json({ success: true })
})

app.delete('/api/rapports-annuels/:id', requireAuth, async (c) => {
  const session = c.get('session') as any
  const tenantId = c.get('tenantId')
  const ok = await hasPermission(c.env.DB, session.profil_id, session.role, 'rapports', 'delete')
  if (!ok) return c.json({ error: 'Permission refusée' }, 403)

  const id = c.req.param('id')
  const existing = await c.env.DB.prepare('SELECT statut FROM rapports_annuels WHERE id=? AND tenant_id=?').bind(id, tenantId).first() as any
  if (!existing) return c.json({ error: 'Rapport introuvable' }, 404)
  if (existing.statut === 'transmis') return c.json({ error: 'Impossible de supprimer un rapport transmis' }, 409)

  await c.env.DB.prepare('DELETE FROM rapports_annuels WHERE id=? AND tenant_id=?').bind(id, tenantId).run()
  return c.json({ success: true })
})

app.post('/api/rapports-annuels/:id/transmettre', requireAuth, async (c) => {
  const tenantId = c.get('tenantId')
  const id = c.req.param('id')
  await c.env.DB.prepare(
    `UPDATE rapports_annuels SET statut='transmis', date_transmission=date('now'), updated_at=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=?`
  ).bind(id, tenantId).run()
  return c.json({ success: true, message: 'Rapport marqué comme transmis à l\'Inspecteur du Travail et au Médecin Inspecteur (Art. 30.1).' })
})

// ============================================================
// COMPTES-RENDUS TRIMESTRIELS (Art. 30.2)
// ============================================================
app.get('/api/comptes-rendus', requireAuth, async (c) => {
  const tenantId = c.get('tenantId')
  const rows = await c.env.DB.prepare(`
    SELECT cr.*, e.nom as entreprise_nom, u.nom as medecin_nom, u.prenom as medecin_prenom
    FROM comptes_rendus_trimestriels cr
    LEFT JOIN entreprises e ON cr.entreprise_id = e.id
    LEFT JOIN users u ON cr.medecin_id = u.id
    WHERE cr.tenant_id = ?
    ORDER BY cr.annee DESC, cr.trimestre DESC
  `).bind(tenantId).all()
  return c.json(rows.results)
})

app.post('/api/comptes-rendus', requireAuth, async (c) => {
  const session = c.get('session') as any
  const tenantId = c.get('tenantId')
  const ok = await hasPermission(c.env.DB, session.profil_id, session.role, 'rapports', 'write')
  if (!ok) return c.json({ error: 'Permission refusée' }, 403)

  const data = await c.req.json()

  const existing = await c.env.DB.prepare(
    'SELECT id FROM comptes_rendus_trimestriels WHERE tenant_id=? AND entreprise_id=? AND annee=? AND trimestre=?'
  ).bind(tenantId, data.entreprise_id || null, data.annee, data.trimestre).first() as any

  if (existing) {
    await c.env.DB.prepare(`
      UPDATE comptes_rendus_trimestriels SET nb_visites=?, nb_pathologies_detectees=?,
      nb_tiers_temps_heures=?, faits_marquants=?, actions_menees=?, points_vigilance=?, statut=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).bind(
      data.nb_visites || 0, data.nb_pathologies_detectees || 0, data.nb_tiers_temps_heures || 0,
      data.faits_marquants, data.actions_menees, data.points_vigilance,
      data.statut || 'brouillon', existing.id
    ).run()
    return c.json({ success: true, id: existing.id })
  }

  const result = await c.env.DB.prepare(`
    INSERT INTO comptes_rendus_trimestriels (tenant_id, entreprise_id, annee, trimestre, medecin_id,
    nb_visites, nb_pathologies_detectees, nb_tiers_temps_heures, faits_marquants, actions_menees,
    points_vigilance, statut)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    tenantId, data.entreprise_id || null, data.annee, data.trimestre,
    data.medecin_id || session.user_id,
    data.nb_visites || 0, data.nb_pathologies_detectees || 0, data.nb_tiers_temps_heures || 0,
    data.faits_marquants, data.actions_menees, data.points_vigilance, data.statut || 'brouillon'
  ).run()
  return c.json({ id: result.meta.last_row_id }, 201)
})

app.put('/api/comptes-rendus/:id', requireAuth, async (c) => {
  const session = c.get('session') as any
  const tenantId = c.get('tenantId')
  const ok = await hasPermission(c.env.DB, session.profil_id, session.role, 'rapports', 'write')
  if (!ok) return c.json({ error: 'Permission refusée' }, 403)

  const id = c.req.param('id')
  const data = await c.req.json()
  await c.env.DB.prepare(`
    UPDATE comptes_rendus_trimestriels SET nb_visites=?, nb_pathologies_detectees=?,
      nb_tiers_temps_heures=?, faits_marquants=?, actions_menees=?, points_vigilance=?, statut=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=? AND tenant_id=?
  `).bind(
    data.nb_visites || 0, data.nb_pathologies_detectees || 0, data.nb_tiers_temps_heures || 0,
    data.faits_marquants, data.actions_menees, data.points_vigilance,
    data.statut || 'brouillon', id, tenantId
  ).run()
  return c.json({ success: true })
})

app.delete('/api/comptes-rendus/:id', requireAuth, async (c) => {
  const session = c.get('session') as any
  const tenantId = c.get('tenantId')
  const ok = await hasPermission(c.env.DB, session.profil_id, session.role, 'rapports', 'delete')
  if (!ok) return c.json({ error: 'Permission refusée' }, 403)

  const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM comptes_rendus_trimestriels WHERE id=? AND tenant_id=?').bind(id, tenantId).run()
  return c.json({ success: true })
})

// ============================================================
// RECHERCHE GLOBALE
// ============================================================
app.get('/api/recherche', requireAuth, async (c) => {
  const tenantId = c.get('tenantId')
  const q = c.req.query('q') || ''
  if (q.length < 2) return c.json([])

  const travailleurs = await c.env.DB.prepare(`
    SELECT t.id, t.nom, t.prenom, t.numero_matricule, t.poste, e.nom as entreprise,
           'travailleur' as type
    FROM travailleurs t
    LEFT JOIN entreprises e ON t.entreprise_id = e.id
    WHERE (t.nom LIKE ? OR t.prenom LIKE ? OR t.numero_matricule LIKE ?)
      AND t.statut = 'actif' AND t.tenant_id = ?
    LIMIT 10
  `).bind(`%${q}%`, `%${q}%`, `%${q}%`, tenantId).all()

  return c.json(travailleurs.results)
})

// ============================================================
// EXPORT CSV (pour impression/export Excel côté client)
// ============================================================
app.get('/api/export/:module', requireAuth, async (c) => {
  const tenantId = c.get('tenantId')
  const module = c.req.param('module')
  const entrepriseId = c.req.query('entreprise_id')
  const du = c.req.query('du')
  const au = c.req.query('au')

  let rows: any[] = []

  if (module === 'travailleurs') {
    const r = await c.env.DB.prepare(
      `SELECT t.nom, t.prenom, t.numero_matricule, t.poste, e.nom as entreprise,
              t.sexe, t.date_naissance, t.groupe_sanguin, t.date_embauche, t.type_contrat,
              t.categorie_risque, t.frequence_visite_mois, t.telephone, t.email, t.statut
       FROM travailleurs t LEFT JOIN entreprises e ON t.entreprise_id = e.id
       WHERE t.tenant_id = ? AND t.statut != 'inactif' ORDER BY t.nom`
    ).bind(tenantId).all()
    rows = r.results

  } else if (module === 'visites') {
    let q = `SELECT vm.date_visite, vm.heure_visite, vm.type_visite, vm.statut, vm.aptitude,
                    t.nom, t.prenom, t.numero_matricule, e.nom as entreprise,
                    u.nom as medecin_nom, vm.motif, vm.conclusions, vm.prochaine_visite
             FROM visites_medicales vm
             JOIN travailleurs t ON vm.travailleur_id = t.id
             LEFT JOIN entreprises e ON t.entreprise_id = e.id
             LEFT JOIN users u ON vm.medecin_id = u.id
             WHERE vm.tenant_id = ?`
    const p: any[] = [tenantId]
    if (du) { q += ' AND vm.date_visite >= ?'; p.push(du) }
    if (au) { q += ' AND vm.date_visite <= ?'; p.push(au) }
    if (entrepriseId) { q += ' AND t.entreprise_id = ?'; p.push(entrepriseId) }
    q += ' ORDER BY vm.date_visite DESC'
    const r = await c.env.DB.prepare(q).bind(...p).all()
    rows = r.results

  } else if (module === 'registre') {
    let q = `SELECT r.date_visite, r.heure_arrivee, r.nom_prenom, r.entreprise,
                    r.poste_travail, r.type_visite, r.motif, r.aptitude_conclue,
                    u.nom as medecin_nom, r.observations
             FROM registre_journalier r
             LEFT JOIN users u ON r.medecin_id = u.id
             WHERE r.tenant_id = ?`
    const p: any[] = [tenantId]
    if (du) { q += ' AND r.date_visite >= ?'; p.push(du) }
    if (au) { q += ' AND r.date_visite <= ?'; p.push(au) }
    q += ' ORDER BY r.date_visite DESC, r.heure_arrivee ASC'
    const r = await c.env.DB.prepare(q).bind(...p).all()
    rows = r.results

  } else if (module === 'certificats') {
    const r = await c.env.DB.prepare(
      `SELECT ca.numero_certificat, ca.date_emission, ca.type_certificat, ca.aptitude,
              t.nom, t.prenom, t.numero_matricule, e.nom as entreprise,
              u.nom as medecin_nom, ca.restrictions, ca.date_expiration, ca.statut
       FROM certificats_aptitude ca
       JOIN travailleurs t ON ca.travailleur_id = t.id
       LEFT JOIN entreprises e ON t.entreprise_id = e.id
       LEFT JOIN users u ON ca.medecin_id = u.id
       WHERE ca.tenant_id = ? ORDER BY ca.date_emission DESC`
    ).bind(tenantId).all()
    rows = r.results

  } else if (module === 'maladies') {
    const r = await c.env.DB.prepare(
      `SELECT ma.date_evenement, ma.date_declaration, ma.type_evenement, ma.description,
              t.nom, t.prenom, e.nom as entreprise, t.poste,
              ma.siege_lesion, ma.nature_lesion, ma.duree_arret_jours, ma.statut
       FROM maladies_accidents ma
       JOIN travailleurs t ON ma.travailleur_id = t.id
       LEFT JOIN entreprises e ON t.entreprise_id = e.id
       WHERE ma.tenant_id = ? ORDER BY ma.date_evenement DESC`
    ).bind(tenantId).all()
    rows = r.results

  } else if (module === 'tiers-temps') {
    const r = await c.env.DB.prepare(
      `SELECT tt.date_mission, tt.type_mission, e.nom as entreprise,
              tt.duree_heures, tt.description, tt.participants,
              tt.resultats, tt.recommandations,
              u.nom as medecin_nom
       FROM tiers_temps tt
       LEFT JOIN entreprises e ON tt.entreprise_id = e.id
       LEFT JOIN users u ON tt.medecin_id = u.id
       WHERE tt.tenant_id = ? ORDER BY tt.date_mission DESC`
    ).bind(tenantId).all()
    rows = r.results

  } else if (module === 'consultations') {
    let q = `SELECT c.date_consultation, t.nom, t.prenom, t.numero_matricule,
                    e.nom as entreprise, t.poste,
                    c.motif, c.diagnostic, c.prescriptions,
                    u.nom as praticien_nom, u.prenom as praticien_prenom,
                    c.arret_travail_jours
             FROM consultations c
             JOIN travailleurs t ON c.travailleur_id = t.id
             LEFT JOIN entreprises e ON t.entreprise_id = e.id
             LEFT JOIN users u ON c.praticien_id = u.id
             WHERE c.tenant_id = ?`
    const p: any[] = [tenantId]
    if (du) { q += ' AND c.date_consultation >= ?'; p.push(du) }
    if (au) { q += ' AND c.date_consultation <= ?'; p.push(au) }
    q += ' ORDER BY c.date_consultation DESC'
    const r = await c.env.DB.prepare(q).bind(...p).all()
    rows = r.results
  }

  if (rows.length === 0) return c.json({ error: 'Aucune donnée à exporter' }, 404)

  // Générer le CSV
  const headers = Object.keys(rows[0]).join(';')
  const csvRows = rows.map(row =>
    Object.values(row).map(v => {
      if (v === null || v === undefined) return ''
      const s = String(v).replace(/"/g, '""')
      return s.includes(';') || s.includes('\n') ? `"${s}"` : s
    }).join(';')
  )
  const csv = '\uFEFF' + headers + '\n' + csvRows.join('\n') // BOM UTF-8 pour Excel

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${module}_export_${new Date().toISOString().slice(0, 10)}.csv"`
    }
  })
})

// ============================================================
// PRESCRIPTIONS / ORDONNANCES
// ============================================================

// Lister ordonnances d'un travailleur
app.get('/api/prescriptions', requireAuth, async (c) => {
  const tenantId = c.get('tenantId')
  const travailleurId = c.req.query('travailleur_id')
  const visiteId = c.req.query('visite_id')
  let q = `SELECT p.*, u.nom as medecin_nom, u.prenom as medecin_prenom, u.specialite,
                  t.nom as travailleur_nom, t.prenom as travailleur_prenom
           FROM prescriptions p
           LEFT JOIN users u ON p.medecin_id = u.id
           LEFT JOIN travailleurs t ON p.travailleur_id = t.id
           WHERE p.tenant_id = ?`
  const params: any[] = [tenantId]
  if (travailleurId) { q += ' AND p.travailleur_id = ?'; params.push(travailleurId) }
  if (visiteId) { q += ' AND p.visite_id = ?'; params.push(visiteId) }
  q += ' ORDER BY p.date_prescription DESC'
  const r = await c.env.DB.prepare(q).bind(...params).all()
  return c.json(r.results)
})

// Détail ordonnance + lignes
app.get('/api/prescriptions/:id', requireAuth, async (c) => {
  const tenantId = c.get('tenantId')
  const id = c.req.param('id')
  const p = await c.env.DB.prepare(
    `SELECT p.*, u.nom as medecin_nom, u.prenom as medecin_prenom, u.specialite,
            u.numero_ordre, t.nom as travailleur_nom, t.prenom as travailleur_prenom,
            t.date_naissance, t.numero_matricule, t.poste,
            e.nom as entreprise_nom, ten.nom as tenant_nom
     FROM prescriptions p
     LEFT JOIN users u ON p.medecin_id = u.id
     LEFT JOIN travailleurs t ON p.travailleur_id = t.id
     LEFT JOIN entreprises e ON t.entreprise_id = e.id
     LEFT JOIN tenants ten ON p.tenant_id = ten.id
     WHERE p.id = ? AND p.tenant_id = ?`
  ).bind(id, tenantId).first()
  if (!p) return c.json({ error: 'Ordonnance introuvable' }, 404)
  const lignes = await c.env.DB.prepare(
    'SELECT * FROM ordonnance_lignes WHERE prescription_id = ? ORDER BY id'
  ).bind(id).all()
  return c.json({ ...(p as any), lignes: lignes.results })
})

// Créer ordonnance avec ses lignes
app.post('/api/prescriptions', requireAuth, async (c) => {
  const tenantId = c.get('tenantId'); const user = c.get('session') as any
  const body = await c.req.json()
  const { travailleur_id, visite_id, consultation_id, lignes = [], notes, renouvellement } = body
  // Générer numéro ordonnance
  const num = `ORD-${tenantId}-${Date.now()}`
  const r = await c.env.DB.prepare(
    `INSERT INTO prescriptions (tenant_id, travailleur_id, consultation_id, visite_id, medecin_id,
      date_prescription, medicaments, numero_ordonnance, notes, renouvellement, statut)
     VALUES (?, ?, ?, ?, ?, date('now'), ?, ?, ?, ?, 'active')`
  ).bind(tenantId, travailleur_id, consultation_id || null, visite_id || null, user.user_id,
         lignes.map((l: any) => l.medicament).join(', '), num, notes || null, renouvellement ? 1 : 0
  ).run()
  const prescId = r.meta.last_row_id
  // Insérer les lignes
  for (const l of lignes) {
    await c.env.DB.prepare(
      `INSERT INTO ordonnance_lignes (prescription_id, tenant_id, medicament, forme, dosage,
        posologie, duree, quantite, voie, instructions)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(prescId, tenantId, l.medicament, l.forme || null, l.dosage || null,
           l.posologie, l.duree || null, l.quantite || null, l.voie || 'orale', l.instructions || null
    ).run()
  }
  return c.json({ id: prescId, numero: num })
})

app.put('/api/prescriptions/:id', requireAuth, async (c) => {
  const tenantId = c.get('tenantId')
  const id = c.req.param('id')
  const { statut, notes } = await c.req.json()
  await c.env.DB.prepare(
    'UPDATE prescriptions SET statut = ?, notes = ? WHERE id = ? AND tenant_id = ?'
  ).bind(statut, notes, id, tenantId).run()
  return c.json({ success: true })
})

// Envoyer l'ordonnance par email au travailleur
app.post('/api/prescriptions/:id/envoyer-email', requireAuth, async (c) => {
  const tenantId = c.get('tenantId')
  const id = c.req.param('id')
  const { email: overrideEmail } = await c.req.json().catch(() => ({} as any))

  const presc = await c.env.DB.prepare(`
    SELECT p.*, t.nom as travailleur_nom, t.prenom as travailleur_prenom, t.email as travailleur_email,
           u.nom as medecin_nom, u.prenom as medecin_prenom
    FROM prescriptions p
    LEFT JOIN travailleurs t ON p.travailleur_id = t.id
    LEFT JOIN users u ON p.medecin_id = u.id
    WHERE p.id = ? AND p.tenant_id = ?
  `).bind(id, tenantId).first() as any
  if (!presc) return c.json({ error: 'Ordonnance introuvable' }, 404)

  const email = overrideEmail || presc.travailleur_email
  if (!email) return c.json({ error: "Aucune adresse email pour ce travailleur. Fournissez-en une." }, 400)

  const lignes = await c.env.DB.prepare(
    'SELECT * FROM ordonnance_lignes WHERE prescription_id = ? ORDER BY id'
  ).bind(id).all()

  const lignesHtml = (lignes.results as any[]).map((l) =>
    `<li>${l.medicament}${l.dosage ? ` (${l.dosage})` : ''} — ${l.posologie}${l.duree ? `, ${l.duree}` : ''}</li>`
  ).join('')

  await sendEmail(
    c.env,
    { name: `${presc.travailleur_prenom} ${presc.travailleur_nom}`, email },
    `Votre ordonnance ${presc.numero_ordonnance}`,
    `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#006B3C">Ordonnance médicale</h2>
        <p>Bonjour ${presc.travailleur_prenom} ${presc.travailleur_nom},</p>
        <p>Ordonnance <strong>${presc.numero_ordonnance}</strong> du ${presc.date_prescription}, prescrite par Dr. ${presc.medecin_prenom || ''} ${presc.medecin_nom || ''} :</p>
        <ul style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 12px 12px 28px">
          ${lignesHtml}
        </ul>
        ${presc.notes ? `<p><strong>Notes :</strong> ${presc.notes}</p>` : ''}
      </div>
    `
  )

  return c.json({ success: true })
})

app.delete('/api/prescriptions/:id', requireAuth, async (c) => {
  const tenantId = c.get('tenantId')
  const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM ordonnance_lignes WHERE prescription_id = ?').bind(id).run()
  await c.env.DB.prepare('DELETE FROM prescriptions WHERE id = ? AND tenant_id = ?').bind(id, tenantId).run()
  return c.json({ success: true })
})

// ============================================================
// EXAMENS COMPLÉMENTAIRES PRESCRITS
// ============================================================

app.get('/api/examens', requireAuth, async (c) => {
  const tenantId = c.get('tenantId')
  const travailleurId = c.req.query('travailleur_id')
  const visiteId = c.req.query('visite_id')
  let q = `SELECT ex.*, t.nom as travailleur_nom, t.prenom as travailleur_prenom
           FROM examens ex
           LEFT JOIN travailleurs t ON ex.travailleur_id = t.id
           WHERE ex.tenant_id = ?`
  const params: any[] = [tenantId]
  if (travailleurId) { q += ' AND ex.travailleur_id = ?'; params.push(travailleurId) }
  if (visiteId) { q += ' AND ex.visite_id = ?'; params.push(visiteId) }
  q += ' ORDER BY ex.date_demande DESC, ex.created_at DESC'
  const r = await c.env.DB.prepare(q).bind(...params).all()
  return c.json(r.results)
})

app.get('/api/examens/:id', requireAuth, async (c) => {
  const tenantId = c.get('tenantId')
  const id = c.req.param('id')
  const ex = await c.env.DB.prepare(
    `SELECT ex.*, t.nom as travailleur_nom, t.prenom as travailleur_prenom,
            t.date_naissance, t.numero_matricule, t.poste,
            e.nom as entreprise_nom, ten.nom as tenant_nom
     FROM examens ex
     LEFT JOIN travailleurs t ON ex.travailleur_id = t.id
     LEFT JOIN entreprises e ON t.entreprise_id = e.id
     LEFT JOIN tenants ten ON ex.tenant_id = ten.id
     WHERE ex.id = ? AND ex.tenant_id = ?`
  ).bind(id, tenantId).first()
  if (!ex) return c.json({ error: 'Examen introuvable' }, 404)
  return c.json(ex)
})

app.post('/api/examens', requireAuth, async (c) => {
  const tenantId = c.get('tenantId'); const user = c.get('session') as any
  const body = await c.req.json()
  const examens = Array.isArray(body) ? body : [body]
  const ids: number[] = []
  const num = `BON-${tenantId}-${Date.now()}`
  for (const ex of examens) {
    const r = await c.env.DB.prepare(
      `INSERT INTO examens (tenant_id, travailleur_id, consultation_id, visite_id,
        type_examen, nom_examen, date_demande, laboratoire, urgent,
        statut, numero_bon, interpretation)
       VALUES (?, ?, ?, ?, ?, ?, date('now'), ?, ?, 'prescrit', ?, ?)`
    ).bind(tenantId, ex.travailleur_id, ex.consultation_id || null, ex.visite_id || null,
           ex.type_examen, ex.nom_examen, ex.laboratoire || null, ex.urgent ? 1 : 0,
           num, ex.interpretation || null
    ).run()
    ids.push(r.meta.last_row_id as number)
  }
  return c.json({ ids, numero_bon: num })
})

app.put('/api/examens/:id', requireAuth, async (c) => {
  const tenantId = c.get('tenantId')
  const id = c.req.param('id')
  const { statut, resultat, interpretation, date_resultat, laboratoire } = await c.req.json()
  await c.env.DB.prepare(
    `UPDATE examens SET statut = ?, resultat = ?, interpretation = ?,
      date_resultat = ?, laboratoire = ? WHERE id = ? AND tenant_id = ?`
  ).bind(statut || 'prescrit', resultat || null, interpretation || null,
         date_resultat || null, laboratoire || null, id, tenantId).run()
  return c.json({ success: true })
})

app.delete('/api/examens/:id', requireAuth, async (c) => {
  const tenantId = c.get('tenantId')
  const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM examens WHERE id = ? AND tenant_id = ?').bind(id, tenantId).run()
  return c.json({ success: true })
})

// ============================================================
// ATTESTATIONS VIH
// ============================================================

app.get('/api/attestations-vih', requireAuth, async (c) => {
  const tenantId = c.get('tenantId')
  const travailleurId = c.req.query('travailleur_id')
  let q = `SELECT av.*, u.nom as medecin_nom, u.prenom as medecin_prenom,
                  t.nom as travailleur_nom, t.prenom as travailleur_prenom
           FROM attestations_vih av
           LEFT JOIN users u ON av.medecin_id = u.id
           LEFT JOIN travailleurs t ON av.travailleur_id = t.id
           WHERE av.tenant_id = ?`
  const params: any[] = [tenantId]
  if (travailleurId) { q += ' AND av.travailleur_id = ?'; params.push(travailleurId) }
  q += ' ORDER BY av.date_test DESC'
  const r = await c.env.DB.prepare(q).bind(...params).all()
  return c.json(r.results)
})

app.get('/api/attestations-vih/:id', requireAuth, async (c) => {
  const tenantId = c.get('tenantId')
  const id = c.req.param('id')
  const av = await c.env.DB.prepare(
    `SELECT av.*, u.nom as medecin_nom, u.prenom as medecin_prenom,
            u.specialite, u.numero_ordre, u.telephone as medecin_tel,
            t.nom as travailleur_nom, t.prenom as travailleur_prenom,
            t.date_naissance, t.sexe, t.numero_matricule, t.poste,
            e.nom as entreprise_nom, ten.nom as tenant_nom
     FROM attestations_vih av
     LEFT JOIN users u ON av.medecin_id = u.id
     LEFT JOIN travailleurs t ON av.travailleur_id = t.id
     LEFT JOIN entreprises e ON t.entreprise_id = e.id
     LEFT JOIN tenants ten ON av.tenant_id = ten.id
     WHERE av.id = ? AND av.tenant_id = ?`
  ).bind(id, tenantId).first()
  if (!av) return c.json({ error: 'Attestation introuvable' }, 404)
  return c.json(av)
})

app.post('/api/attestations-vih', requireAuth, async (c) => {
  const tenantId = c.get('tenantId'); const user = c.get('session') as any
  const body = await c.req.json()
  const { travailleur_id, visite_id, consultation_id, date_test, observations,
          counseling_pre_realise, consentement_eclaire } = body
  const num = `ATT-VIH-${tenantId}-${Date.now()}`
  const r = await c.env.DB.prepare(
    `INSERT INTO attestations_vih (tenant_id, travailleur_id, medecin_id, visite_id,
      consultation_id, numero_attestation, date_test, counseling_pre_realise,
      consentement_eclaire, observations)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(tenantId, travailleur_id, user.user_id, visite_id || null, consultation_id || null,
         num, date_test || new Date().toISOString().split('T')[0],
         counseling_pre_realise !== false ? 1 : 0,
         consentement_eclaire !== false ? 1 : 0, observations || null
  ).run()
  return c.json({ id: r.meta.last_row_id, numero: num })
})

app.delete('/api/attestations-vih/:id', requireAuth, async (c) => {
  const tenantId = c.get('tenantId')
  const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM attestations_vih WHERE id = ? AND tenant_id = ?').bind(id, tenantId).run()
  return c.json({ success: true })
})

// Enrichir le dossier patient avec prescriptions + examens + attestations VIH
app.get('/api/travailleurs/:id/dossier-complet', requireAuth, async (c) => {
  const tenantId = c.get('tenantId')
  const id = c.req.param('id')
  const [presc, exams, vih] = await Promise.all([
    c.env.DB.prepare(
      `SELECT p.*, u.nom as medecin_nom, u.prenom as medecin_prenom
       FROM prescriptions p LEFT JOIN users u ON p.medecin_id = u.id
       WHERE p.travailleur_id = ? AND p.tenant_id = ? ORDER BY p.date_prescription DESC`
    ).bind(id, tenantId).all(),
    c.env.DB.prepare(
      `SELECT * FROM examens WHERE travailleur_id = ? AND tenant_id = ? ORDER BY date_demande DESC, created_at DESC`
    ).bind(id, tenantId).all(),
    c.env.DB.prepare(
      `SELECT av.*, u.nom as medecin_nom, u.prenom as medecin_prenom
       FROM attestations_vih av LEFT JOIN users u ON av.medecin_id = u.id
       WHERE av.travailleur_id = ? AND av.tenant_id = ? ORDER BY av.date_test DESC`
    ).bind(id, tenantId).all()
  ])
  return c.json({
    prescriptions: presc.results,
    examens: exams.results,
    attestations_vih: vih.results
  })
})

// ============================================================
// INITIALISATION DE LA BASE DE DONNÉES
// ============================================================
app.post('/api/setup', async (c) => {
  try {
    // ── Tables fondamentales ─────────────────────────────────────
    const schema = `
      CREATE TABLE IF NOT EXISTS tenants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nom TEXT NOT NULL,
        code TEXT UNIQUE NOT NULL,
        secteur TEXT,
        adresse TEXT,
        ville TEXT,
        telephone TEXT,
        email TEXT,
        contact_admin TEXT,
        logo_url TEXT,
        actif INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER REFERENCES tenants(id),
        nom TEXT NOT NULL,
        prenom TEXT NOT NULL,
        email TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('superadmin','admin','medecin','infirmier')),
        specialite TEXT,
        telephone TEXT,
        numero_ordre TEXT,
        profil_id INTEGER,
        actif INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(email, tenant_id)
      );
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        token TEXT UNIQUE NOT NULL,
        expires_at DATETIME NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS profils (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER REFERENCES tenants(id),
        nom TEXT NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS profil_permissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        profil_id INTEGER NOT NULL REFERENCES profils(id),
        module TEXT NOT NULL,
        action TEXT NOT NULL CHECK(action IN ('read','write','delete')),
        autorise INTEGER DEFAULT 0,
        UNIQUE(profil_id, module, action)
      );
      CREATE TABLE IF NOT EXISTS entreprises (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER REFERENCES tenants(id),
        nom TEXT NOT NULL,
        secteur TEXT,
        adresse TEXT,
        ville TEXT,
        telephone TEXT,
        email TEXT,
        contact_rh TEXT,
        effectif INTEGER DEFAULT 0,
        categorie TEXT DEFAULT 'E' CHECK(categorie IN ('A','B','C','D','E')),
        type_service_sante TEXT DEFAULT 'autonome',
        numero_agrement TEXT,
        date_agrement DATE,
        type_equipement TEXT DEFAULT 'fixe',
        risques_professionnels TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS travailleurs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER REFERENCES tenants(id),
        nom TEXT NOT NULL,
        prenom TEXT NOT NULL,
        date_naissance DATE NOT NULL,
        sexe TEXT CHECK(sexe IN ('M','F')),
        numero_matricule TEXT,
        poste TEXT,
        entreprise_id INTEGER REFERENCES entreprises(id),
        telephone TEXT,
        email TEXT,
        adresse TEXT,
        groupe_sanguin TEXT,
        allergies TEXT,
        antecedents_personnels TEXT,
        antecedents_familiaux TEXT,
        traitement_en_cours TEXT,
        date_embauche DATE,
        type_contrat TEXT DEFAULT 'cdi',
        loge_par_employeur INTEGER DEFAULT 0,
        categorie_risque TEXT DEFAULT 'standard',
        frequence_visite_mois INTEGER DEFAULT 12,
        statut TEXT DEFAULT 'actif',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS visites_medicales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER REFERENCES tenants(id),
        travailleur_id INTEGER NOT NULL REFERENCES travailleurs(id),
        medecin_id INTEGER REFERENCES users(id),
        type_visite TEXT NOT NULL,
        date_visite DATE NOT NULL,
        heure_visite TIME,
        statut TEXT DEFAULT 'planifiee',
        motif TEXT,
        conclusions TEXT,
        aptitude TEXT,
        restrictions TEXT,
        prochaine_visite DATE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS consultations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER REFERENCES tenants(id),
        travailleur_id INTEGER NOT NULL REFERENCES travailleurs(id),
        praticien_id INTEGER REFERENCES users(id),
        date_consultation DATETIME NOT NULL,
        motif TEXT NOT NULL,
        symptomes TEXT,
        examen_clinique TEXT,
        diagnostic TEXT,
        traitement TEXT,
        prescriptions TEXT,
        examens_demandes TEXT,
        certificat_travail INTEGER DEFAULT 0,
        arret_travail_jours INTEGER DEFAULT 0,
        observations TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS constantes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        travailleur_id INTEGER NOT NULL REFERENCES travailleurs(id),
        consultation_id INTEGER REFERENCES consultations(id),
        date_mesure DATETIME DEFAULT CURRENT_TIMESTAMP,
        poids REAL, taille REAL, imc REAL,
        tension_systolique INTEGER, tension_diastolique INTEGER,
        frequence_cardiaque INTEGER, temperature REAL,
        saturation_oxygene REAL, glycemie REAL, notes TEXT
      );
      CREATE TABLE IF NOT EXISTS prescriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        consultation_id INTEGER REFERENCES consultations(id),
        travailleur_id INTEGER NOT NULL REFERENCES travailleurs(id),
        medecin_id INTEGER REFERENCES users(id),
        date_prescription DATE DEFAULT CURRENT_DATE,
        medicaments TEXT NOT NULL,
        posologie TEXT, duree TEXT, notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS examens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        travailleur_id INTEGER NOT NULL REFERENCES travailleurs(id),
        consultation_id INTEGER REFERENCES consultations(id),
        type_examen TEXT NOT NULL, nom_examen TEXT NOT NULL,
        date_demande DATE, date_resultat DATE,
        resultat TEXT, interpretation TEXT, fichier_url TEXT,
        charge_employeur INTEGER DEFAULT 1,
        frais_transport_pris_en_charge INTEGER DEFAULT 0,
        en_desaccord INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS alertes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER REFERENCES tenants(id),
        travailleur_id INTEGER REFERENCES travailleurs(id),
        type_alerte TEXT NOT NULL,
        message TEXT NOT NULL,
        priorite TEXT DEFAULT 'normale',
        statut TEXT DEFAULT 'active',
        date_echeance DATE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `
    // ── Tables Décret N°2026-206 ──────────────────────────────────
    const schemaDecret = `
      CREATE TABLE IF NOT EXISTS registre_journalier (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER REFERENCES tenants(id),
        date_visite DATE NOT NULL,
        heure_arrivee TIME,
        travailleur_id INTEGER REFERENCES travailleurs(id),
        nom_prenom TEXT NOT NULL,
        entreprise TEXT,
        poste_travail TEXT,
        type_visite TEXT CHECK(type_visite IN ('embauche','periodique','reprise','spontanee','pre_reprise','tiers_temps')),
        motif TEXT,
        aptitude_conclue TEXT,
        medecin_id INTEGER REFERENCES users(id),
        observations TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS certificats_aptitude (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER REFERENCES tenants(id),
        numero_certificat TEXT NOT NULL,
        travailleur_id INTEGER NOT NULL REFERENCES travailleurs(id),
        visite_id INTEGER REFERENCES visites_medicales(id),
        medecin_id INTEGER REFERENCES users(id),
        date_emission DATE NOT NULL,
        type_certificat TEXT NOT NULL,
        aptitude TEXT NOT NULL,
        restrictions TEXT, amenagements TEXT,
        etude_poste_realisee INTEGER DEFAULT 0,
        deux_examens_realises INTEGER DEFAULT 0,
        date_premier_examen DATE, date_second_examen DATE,
        poste_travail TEXT, motif_inaptitude TEXT,
        validite_jours INTEGER DEFAULT 365,
        date_expiration DATE,
        conteste INTEGER DEFAULT 0,
        date_contestation DATE, motif_contestation TEXT,
        statut TEXT DEFAULT 'valide',
        observations TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS maladies_accidents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER REFERENCES tenants(id),
        travailleur_id INTEGER NOT NULL REFERENCES travailleurs(id),
        medecin_id INTEGER REFERENCES users(id),
        type_evenement TEXT NOT NULL,
        date_evenement DATE NOT NULL,
        date_declaration DATE NOT NULL,
        declare_24h INTEGER DEFAULT 0,
        description TEXT NOT NULL,
        siege_lesion TEXT, nature_lesion TEXT,
        circonstances TEXT, agent_causal TEXT,
        arret_travail INTEGER DEFAULT 0,
        duree_arret_jours INTEGER DEFAULT 0,
        hospitalisation INTEGER DEFAULT 0, sequelles TEXT,
        medecin_chef_notifie INTEGER DEFAULT 0,
        inspection_notifiee INTEGER DEFAULT 0,
        organisme_securite_sociale TEXT,
        statut TEXT DEFAULT 'declare',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS fiche_entreprise (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER REFERENCES tenants(id),
        entreprise_id INTEGER NOT NULL REFERENCES entreprises(id),
        date_mise_a_jour DATE NOT NULL,
        medecin_id INTEGER REFERENCES users(id),
        effectif_total INTEGER DEFAULT 0,
        effectif_femmes INTEGER DEFAULT 0,
        effectif_jeunes INTEGER DEFAULT 0,
        effectif_handicapes INTEGER DEFAULT 0,
        postes_risque TEXT,
        risques_chimiques TEXT, risques_physiques TEXT,
        risques_biologiques TEXT, risques_ergonomiques TEXT,
        risques_psychosociaux TEXT,
        epi_fournis TEXT,
        formation_securite INTEGER DEFAULT 0,
        plan_prevention TEXT, observations TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS tiers_temps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER REFERENCES tenants(id),
        medecin_id INTEGER REFERENCES users(id),
        entreprise_id INTEGER NOT NULL REFERENCES entreprises(id),
        date_mission DATE NOT NULL,
        duree_heures REAL DEFAULT 0,
        type_mission TEXT NOT NULL CHECK(type_mission IN (
          'visite_poste','etude_ergonomique','analyse_risques','formation_sst',
          'enquete_accident','investigation_maladie','reunion_chsct',
          'campagne_sensibilisation','vaccination','bilan_collectif',
          'rapport_inspection','consultation_externe','autre'
        )),
        description TEXT, participants TEXT,
        resultats TEXT, recommandations TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS rapports_annuels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER REFERENCES tenants(id),
        annee INTEGER NOT NULL,
        medecin_chef_id INTEGER REFERENCES users(id),
        entreprise_id INTEGER REFERENCES entreprises(id),
        nb_travailleurs_suivis INTEGER DEFAULT 0,
        nb_visites_embauche INTEGER DEFAULT 0,
        nb_visites_periodiques INTEGER DEFAULT 0,
        nb_visites_reprises INTEGER DEFAULT 0,
        nb_visites_total INTEGER DEFAULT 0,
        nb_aptes INTEGER DEFAULT 0,
        nb_aptes_amenagement INTEGER DEFAULT 0,
        nb_inaptes_temporaires INTEGER DEFAULT 0,
        nb_inaptes_definitifs INTEGER DEFAULT 0,
        nb_maladies_pro INTEGER DEFAULT 0,
        nb_accidents_travail INTEGER DEFAULT 0,
        nb_jours_arret_total INTEGER DEFAULT 0,
        principaux_risques TEXT,
        actions_prevention TEXT,
        observations_generales TEXT,
        recommandations TEXT,
        statut TEXT DEFAULT 'brouillon',
        date_transmission DATE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS comptes_rendus_trimestriels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER REFERENCES tenants(id),
        annee INTEGER NOT NULL,
        trimestre INTEGER NOT NULL CHECK(trimestre IN (1,2,3,4)),
        medecin_id INTEGER REFERENCES users(id),
        entreprise_id INTEGER REFERENCES entreprises(id),
        nb_visites INTEGER DEFAULT 0,
        nb_pathologies_detectees INTEGER DEFAULT 0,
        nb_tiers_temps_heures REAL DEFAULT 0,
        faits_marquants TEXT, actions_menees TEXT, points_vigilance TEXT,
        statut TEXT DEFAULT 'brouillon',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `

    // Exécuter les créations
    for (const stmt of [...schema.split(';'), ...schemaDecret.split(';')]) {
      const s = stmt.trim()
      if (s) await c.env.DB.prepare(s).run()
    }

    // ── Données initiales ─────────────────────────────────────────
    // Tenant principal (service de médecine du travail)
    let tenantId: number
    const existingTenant = await c.env.DB.prepare("SELECT id FROM tenants WHERE code = 'SANTE-CI'").first() as any
    if (!existingTenant) {
      const tRes = await c.env.DB.prepare(
        `INSERT INTO tenants (nom, code, secteur, ville, email, actif)
         VALUES ('SanteTravail.CI', 'SANTE-CI', 'Médecine du Travail', 'Abidjan', 'contact@santetravail.ci', 1)`
      ).run()
      tenantId = tRes.meta.last_row_id as number
    } else {
      tenantId = existingTenant.id
    }

    // Super-administrateur (sans tenant)
    const superHash = await sha256('SuperAdmin2026!')
    await c.env.DB.prepare(
      `INSERT OR IGNORE INTO users (nom, prenom, email, password_hash, role, actif)
       VALUES ('SYSTÈME', 'Super Admin', 'superadmin@santetravail.ci', ?, 'superadmin', 1)`
    ).bind(superHash).run()

    // Utilisateurs du tenant principal
    const adminHash = await sha256('Admin2026!')
    await c.env.DB.prepare(
      `INSERT OR IGNORE INTO users (tenant_id, nom, prenom, email, password_hash, role, specialite, telephone)
       VALUES (?, 'KONAN', 'Dr. Kouadio', 'admin@santetravail.ci', ?, 'admin', 'Médecine du Travail', '+225 07 00 00 01')`
    ).bind(tenantId, adminHash).run()

    await c.env.DB.prepare(
      `INSERT OR IGNORE INTO users (tenant_id, nom, prenom, email, password_hash, role, specialite, telephone)
       VALUES (?, 'BAMBA', 'Dr. Fatoumata', 'medecin@santetravail.ci', ?, 'medecin', 'Médecine Générale', '+225 07 00 00 02')`
    ).bind(tenantId, adminHash).run()

    await c.env.DB.prepare(
      `INSERT OR IGNORE INTO users (tenant_id, nom, prenom, email, password_hash, role, specialite, telephone)
       VALUES (?, 'OUATTARA', 'Inf. Aminata', 'infirmier@santetravail.ci', ?, 'infirmier', 'Soins Infirmiers', '+225 07 00 00 03')`
    ).bind(tenantId, adminHash).run()

    // Profils par défaut
    const profilAdminRes = await c.env.DB.prepare(
      "INSERT OR IGNORE INTO profils (tenant_id, nom, description) VALUES (?, 'Administrateur', 'Accès complet à toutes les fonctionnalités')"
    ).bind(tenantId).run()
    const profilMedecinRes = await c.env.DB.prepare(
      "INSERT OR IGNORE INTO profils (tenant_id, nom, description) VALUES (?, 'Médecin', 'Lecture et saisie des données médicales')"
    ).bind(tenantId).run()
    const profilInfRes = await c.env.DB.prepare(
      "INSERT OR IGNORE INTO profils (tenant_id, nom, description) VALUES (?, 'Infirmier(ère)', 'Lecture des données et saisie des constantes')"
    ).bind(tenantId).run()

    const modules = ['travailleurs','entreprises','visites','consultations','certificats',
                     'registre','tiers_temps','maladies','rapports','utilisateurs','alertes']
    const profilAdminId = profilAdminRes.meta.last_row_id
    const profilMedecinId = profilMedecinRes.meta.last_row_id
    const profilInfId = profilInfRes.meta.last_row_id

    for (const mod of modules) {
      for (const action of ['read', 'write', 'delete']) {
        if (profilAdminId) await c.env.DB.prepare("INSERT OR IGNORE INTO profil_permissions (profil_id, module, action, autorise) VALUES (?, ?, ?, 1)").bind(profilAdminId, mod, action).run()
        if (profilMedecinId) {
          const a = action === 'delete' ? 0 : (mod === 'utilisateurs' ? 0 : 1)
          await c.env.DB.prepare("INSERT OR IGNORE INTO profil_permissions (profil_id, module, action, autorise) VALUES (?, ?, ?, ?)").bind(profilMedecinId, mod, action, a).run()
        }
        if (profilInfId) {
          const a = action === 'read' ? 1 : (mod === 'constantes' || mod === 'registre' ? 1 : 0)
          await c.env.DB.prepare("INSERT OR IGNORE INTO profil_permissions (profil_id, module, action, autorise) VALUES (?, ?, ?, ?)").bind(profilInfId, mod, action, a).run()
        }
      }
    }

    return c.json({
      success: true,
      message: 'Base de données initialisée avec succès !',
      tenant: { id: tenantId, code: 'SANTE-CI' },
      comptes: [
        { role: 'superadmin', email: 'superadmin@santetravail.ci', mdp: 'SuperAdmin2026!' },
        { role: 'admin', email: 'admin@santetravail.ci', mdp: 'Admin2026!' },
        { role: 'medecin', email: 'medecin@santetravail.ci', mdp: 'Admin2026!' },
        { role: 'infirmier', email: 'infirmier@santetravail.ci', mdp: 'Admin2026!' }
      ]
    })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// ============================================================
// PAGE PRINCIPALE (SPA)
// ============================================================
app.get('*', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="color-scheme" content="light">
  <title>SanteTravail.CI — Médecine du Travail</title>
  <link href="/static/style.css" rel="stylesheet">
  <!-- FontAwesome servi localement — zéro latence CDN -->
  <link href="/static/fontawesome.min.css" rel="stylesheet">
  <style>
    /* Écran de chargement initial */
    #app-loading {
      position: fixed; inset: 0; background: #f9fafb;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center; z-index: 9999;
    }
    #app-loading .logo-icon {
      width: 64px; height: 64px; background: #006B3C; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 28px; color: white; margin-bottom: 16px;
    }
    #app-loading h1 { font-family: sans-serif; font-size: 1.5rem; font-weight: 700; color: #006B3C; }
    #app-loading p { font-family: sans-serif; font-size: 0.875rem; color: #6b7280; margin-top: 6px; }
    #app-loading .spinner {
      width: 32px; height: 32px; border: 3px solid #e5e7eb;
      border-top-color: #006B3C; border-radius: 50%;
      animation: spin 0.8s linear infinite; margin-top: 20px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body class="bg-gray-50 font-sans">
  <!-- Écran de chargement visible pendant le chargement des scripts CDN -->
  <div id="app-loading">
    <div class="logo-icon">&#9829;</div>
    <h1>SanteTravail<span style="color:#FF8C00">.CI</span></h1>
    <p>Médecine du Travail — Côte d'Ivoire</p>
    <div class="spinner"></div>
  </div>
  <div id="app"></div>
  <!-- Scripts CDN chargés en async pour ne pas bloquer le rendu -->
  <script>
    // Chargement séquentiel des dépendances puis lancement de l'app
    (function() {
      var loaded = 0;
      var scripts = [
        '/static/axios.min.js'
      ];
      function loadNext(i) {
        if (i >= scripts.length) {
          // Tout chargé — injecter app.js
          var appScript = document.createElement('script');
          appScript.src = '/static/app.js';
          appScript.onload = function() {
            document.getElementById('app-loading').style.display = 'none';
          };
          document.body.appendChild(appScript);
          return;
        }
        var s = document.createElement('script');
        s.src = scripts[i];
        s.async = false;
        s.onload = function() { loadNext(i + 1); };
        s.onerror = function() { loadNext(i + 1); }; // continuer même si un CDN échoue
        document.body.appendChild(s);
      }
      loadNext(0);
    })();
  </script>
</body>
</html>`)
})

// Affiche l'erreur réelle au lieu d'un 500 muet (utile aussi en prod)
app.onError((err, c) => {
  console.error('API Error:', err)
  return c.json({ error: err instanceof Error ? err.message : String(err) }, err instanceof Error ? 500 : 400)
})

export default app
