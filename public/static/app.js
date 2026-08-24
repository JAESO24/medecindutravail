// SanteTravail.CI - Application Principale
// Médecine du Travail - Côte d'Ivoire

// ============================================================
// STATE GLOBAL
// ============================================================
const State = {
  user: null,
  currentPage: 'dashboard',
  data: {
    travailleurs: [],
    entreprises: [],
    visites: [],
    consultations: [],
    alertes: [],
    users: [],
    registreJournalier: [],
    certificats: [],
    tiersTemps: [],
    maladiesAccidents: [],
    rapportsAnnuels: [],
    compteRendus: []
  },
  modals: {},
  charts: {}
}

// ============================================================
// UTILITAIRES
// ============================================================
const Utils = {
  // Parse une date au format YYYY-MM-DD (ou avec timezone) sans décalage UTC
  _parseDate(d) {
    if (!d) return null
    // Si c'est une chaîne au format YYYY-MM-DD (sans timezone), on parse manuellement
    const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (m) {
      return new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]))
    }
    return new Date(d)
  },
  // Formate une date pour les <input type="date"> (format YYYY-MM-DD)
  formatDateInput(d) {
    if (!d) return ''
    // Si déjà au bon format YYYY-MM-DD, on garde tel quel
    if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d)) {
      return d.slice(0, 10)
    }
    const date = this._parseDate(d)
    if (!date) return ''
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  },
  formatDate(d) {
    if (!d) return '-'
    const date = this._parseDate(d)
    if (!date) return '-'
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  },
  formatDateTime(d) {
    if (!d) return '-'
    const date = this._parseDate(d)
    if (!date) return '-'
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  },
  formatAge(dateNaissance) {
    if (!dateNaissance) return '-'
    const dob = this._parseDate(dateNaissance)
    if (!dob) return '-'
    const now = new Date()
    let age = now.getFullYear() - dob.getFullYear()
    if (now.getMonth() < dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate())) age--
    return `${age} ans`
  },
  getInitials(nom, prenom) {
    return `${(nom || '')[0] || ''}${(prenom || '')[0] || ''}`.toUpperCase()
  },
  avatarColor(id) {
    const colors = ['avatar-green', 'avatar-blue', 'avatar-orange', 'avatar-purple']
    return colors[id % colors.length]
  },
  aptitudeBadge(aptitude) {
    const map = {
      'apte': '<span class="badge badge-green"><i class="fas fa-check"></i> Apte</span>',
      'apte_amenagement': '<span class="badge badge-blue"><i class="fas fa-tools"></i> Apte (aménagement)</span>',
      'apte_temporaire': '<span class="badge badge-yellow"><i class="fas fa-clock"></i> Apte temporaire</span>',
      'inapte_temporaire': '<span class="badge badge-orange"><i class="fas fa-exclamation"></i> Inapte temporaire</span>',
      'inapte_definitif': '<span class="badge badge-red"><i class="fas fa-times"></i> Inapte définitif</span>'
    }
    return map[aptitude] || '<span class="badge badge-gray">-</span>'
  },
  statutVisiteBadge(statut) {
    const map = {
      'planifiee': '<span class="badge badge-blue"><i class="fas fa-calendar"></i> Planifiée</span>',
      'realisee': '<span class="badge badge-green"><i class="fas fa-check-circle"></i> Réalisée</span>',
      'annulee': '<span class="badge badge-red"><i class="fas fa-times-circle"></i> Annulée</span>',
      'reportee': '<span class="badge badge-yellow"><i class="fas fa-redo"></i> Reportée</span>'
    }
    return map[statut] || `<span class="badge badge-gray">${statut}</span>`
  },
  typeVisiteLabel(type) {
    const map = {
      'embauche': 'Embauche', 'periodique': 'Périodique', 'reprise': 'Reprise',
      'spontanee': 'Spontanée', 'pre_reprise': 'Pré-reprise'
    }
    return map[type] || type
  },
  typeVisiteBadge(type) {
    const colors = { 'embauche': 'green', 'periodique': 'blue', 'reprise': 'orange', 'spontanee': 'purple', 'pre_reprise': 'yellow' }
    const c = colors[type] || 'gray'
    return `<span class="badge badge-${c}">${this.typeVisiteLabel(type)}</span>`
  },
  roleBadge(role) {
    const map = {
      'admin': '<span class="badge badge-red"><i class="fas fa-shield-alt"></i> Admin</span>',
      'medecin': '<span class="badge badge-green"><i class="fas fa-user-md"></i> Médecin</span>',
      'infirmier': '<span class="badge badge-blue"><i class="fas fa-user-nurse"></i> Infirmier</span>'
    }
    return map[role] || `<span class="badge badge-gray">${role}</span>`
  },
  imcStatus(imc) {
    if (!imc) return ''
    if (imc < 18.5) return '<span class="vitals-status" style="color:#f59e0b">Insuffisance</span>'
    if (imc < 25) return '<span class="vitals-status" style="color:#10b981">Normal</span>'
    if (imc < 30) return '<span class="vitals-status" style="color:#f59e0b">Surpoids</span>'
    return '<span class="vitals-status" style="color:#ef4444">Obésité</span>'
  },
  tenionStatus(sys, dia) {
    if (!sys || !dia) return ''
    if (sys < 120 && dia < 80) return '<span class="vitals-status" style="color:#10b981">Normal</span>'
    if (sys < 130 && dia < 80) return '<span class="vitals-status" style="color:#f59e0b">Élevée</span>'
    return '<span class="vitals-status" style="color:#ef4444">HTA</span>'
  },
  escape(str) {
    if (!str) return ''
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  },
  capitalize(str) {
    if (!str) return ''
    return String(str).charAt(0).toUpperCase() + String(str).slice(1)
  },
  jsStringLiteral(value) {
    if (value === null || value === undefined) return "''"
    const escaped = String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")
    return `'${escaped}'`
  }
}

// ============================================================
// TOAST
// ============================================================
const Toast = {
  show(message, type = 'success') {
    let container = document.getElementById('toast-container')
    if (!container) {
      container = document.createElement('div')
      container.id = 'toast-container'
      container.className = 'toast-container'
      document.body.appendChild(container)
    }
    const icons = { success: 'fa-check-circle', error: 'fa-times-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' }
    const colors = { success: '#10b981', error: '#ef4444', warning: '#f59e0b', info: '#3b82f6' }
    const toast = document.createElement('div')
    toast.className = `toast toast-${type}`
    toast.innerHTML = `<i class="fas ${icons[type] || icons.info}" style="color:${colors[type]}; font-size:1.1rem"></i><span>${message}</span>`
    container.appendChild(toast)
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(100%)'; toast.style.transition = 'all 0.3s'; setTimeout(() => toast.remove(), 300) }, 3500)
  }
}

// ============================================================
// API
// ============================================================
const API = {
  // URL racine de l'API. Sur Cloudflare Pages (même origine) => '' (relatif /api).
  // Sur Vercel (frontend hébergé séparément) : window.SANTETRAVAIL_API_BASE est
  // injectée par index.html au moment du build (voir build-vercel.mjs).
  _base() {
    return (typeof window !== 'undefined' && window.SANTETRAVAIL_API_BASE)
      ? window.SANTETRAVAIL_API_BASE
      : ''
  },
  _headers() {
    const h = { 'Content-Type': 'application/json' }
    const token = localStorage.getItem('st_token')
    if (token) h['X-Session-Token'] = token
    return h
  },
  async get(path) {
    const base = this._base()
    const res = await axios.get(`${base}/api${path}`, { headers: this._headers() })
    return res.data
  },
  async post(path, data) {
    const base = this._base()
    const res = await axios.post(`${base}/api${path}`, data, { headers: this._headers() })
    return res.data
  },
  async put(path, data) {
    const base = this._base()
    const res = await axios.put(`${base}/api${path}`, data, { headers: this._headers() })
    return res.data
  },
  async delete(path) {
    const base = this._base()
    const res = await axios.delete(`${base}/api${path}`, { headers: this._headers() })
    return res.data
  }
}

// ============================================================
// PRINT — Impression PDF via fenêtre dédiée
// ============================================================
const Print = {
  /** Imprime n'importe quel contenu HTML dans une fenêtre propre */
  page(title, bodyHtml, opts = {}) {
    const w = window.open('', '_blank', 'width=900,height=700')
    const date = new Date().toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long', year:'numeric' })
    w.document.write(`<!DOCTYPE html><html lang="fr"><head>
<meta charset="UTF-8">
<title>${title}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #1a1a1a; background: #fff; padding: 20mm 18mm; }
  .print-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #006B3C; padding-bottom: 10px; margin-bottom: 18px; }
  .print-logo { display: flex; align-items: center; gap: 10px; }
  .print-logo-icon { width: 42px; height: 42px; background: #006B3C; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 18px; }
  .print-title h1 { font-size: 16pt; color: #006B3C; font-weight: 700; }
  .print-title p { font-size: 9pt; color: #555; margin-top: 2px; }
  .print-meta { text-align: right; font-size: 9pt; color: #555; }
  .print-meta strong { display: block; font-size: 11pt; color: #1a1a1a; }
  h2 { font-size: 13pt; color: #006B3C; border-left: 4px solid #FF8C00; padding-left: 8px; margin: 16px 0 10px; }
  h3 { font-size: 11pt; color: #333; margin: 12px 0 6px; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 9.5pt; }
  th { background: #006B3C; color: #fff; padding: 6px 8px; text-align: left; font-weight: 600; font-size: 9pt; }
  td { padding: 5px 8px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  tr:nth-child(even) td { background: #f9fafb; }
  .badge { display: inline-block; padding: 2px 7px; border-radius: 999px; font-size: 8.5pt; font-weight: 600; }
  .badge-green { background: #d1fae5; color: #065f46; }
  .badge-red { background: #fee2e2; color: #991b1b; }
  .badge-orange { background: #ffedd5; color: #9a3412; }
  .badge-blue { background: #dbeafe; color: #1e40af; }
  .badge-yellow { background: #fef9c3; color: #854d0e; }
  .badge-gray { background: #f3f4f6; color: #374151; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 16px; margin-bottom: 10px; }
  .info-row { display: flex; gap: 6px; padding: 3px 0; border-bottom: 1px dotted #e5e7eb; font-size: 10pt; }
  .info-label { min-width: 170px; color: #6b7280; font-size: 9.5pt; }
  .info-value { font-weight: 500; }
  .section-box { border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px 14px; margin-bottom: 12px; }
  .section-box-title { font-size: 10pt; font-weight: 700; color: #006B3C; margin-bottom: 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
  .legal-note { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 7px 12px; font-size: 9pt; color: #166534; margin: 10px 0; }
  .print-footer { margin-top: 24px; padding-top: 8px; border-top: 1px solid #e5e7eb; font-size: 8.5pt; color: #9ca3af; display: flex; justify-content: space-between; }
  .no-print { display: none !important; }
  @media print {
    body { padding: 10mm 12mm; }
    .print-btn { display: none; }
    @page { margin: 10mm; size: A4; }
  }
</style>
</head><body>
<div class="print-header">
  <div class="print-logo">
    <div class="print-logo-icon">♥</div>
    <div class="print-title">
      <h1>SanteTravail.CI</h1>
      <p>Médecine du Travail — Côte d'Ivoire</p>
    </div>
  </div>
  <div class="print-meta">
    <strong>${title}</strong>
    Imprimé le ${date}
  </div>
</div>
${bodyHtml}
<div class="print-footer">
  <span>SanteTravail.CI — Système de gestion de la médecine du travail</span>
  <span>Décret N°2026-206 du 15 Avril 2026 — Confidentiel médical</span>
</div>
<script>window.onload=function(){window.print();}<\/script>
</body></html>`)
    w.document.close()
  },

  /** Imprime la fiche entreprise */
  async entreprise(id) {
    try {
      Toast.show('Préparation de la fiche entreprise…', 'info')
      const entreprises = State.data.entreprises && State.data.entreprises.length ? State.data.entreprises : await API.get('/entreprises')
      const e = entreprises.find(ent => Number(ent.id) === Number(id))
      if (!e) { Toast.show('Entreprise introuvable', 'error'); return }

      const body = `
        <h2>Fiche Entreprise</h2>
        <div class="info-grid">
          <div class="section-box">
            <div class="section-box-title">Informations générales</div>
            <div class="info-row"><span class="info-label">Nom</span><span class="info-value">${Utils.escape(e.nom)}</span></div>
            <div class="info-row"><span class="info-label">Secteur</span><span class="info-value">${Utils.escape(e.secteur || '-')}</span></div>
            <div class="info-row"><span class="info-label">Ville</span><span class="info-value">${Utils.escape(e.ville || '-')}</span></div>
            <div class="info-row"><span class="info-label">Adresse</span><span class="info-value">${Utils.escape(e.adresse || '-')}</span></div>
            <div class="info-row"><span class="info-label">Téléphone</span><span class="info-value">${Utils.escape(e.telephone || '-')}</span></div>
            <div class="info-row"><span class="info-label">Email</span><span class="info-value">${Utils.escape(e.email || '-')}</span></div>
            <div class="info-row"><span class="info-label">Contact RH</span><span class="info-value">${Utils.escape(e.contact_rh || '-')}</span></div>
          </div>
          <div class="section-box">
            <div class="section-box-title">Classification &amp; Agrément</div>
            <div class="info-row"><span class="info-label">Effectif</span><span class="info-value">${e.effectif || 0}</span></div>
            <div class="info-row"><span class="info-label">Catégorie Art.31</span><span class="info-value">${Utils.escape(e.categorie || 'E')}</span></div>
            <div class="info-row"><span class="info-label">Type service santé</span><span class="info-value">${Utils.escape(e.type_service_sante || 'autonome')}</span></div>
            <div class="info-row"><span class="info-label">Type équipement</span><span class="info-value">${Utils.escape(e.type_equipement || 'fixe')}</span></div>
            <div class="info-row"><span class="info-label">N° d'agrément</span><span class="info-value">${Utils.escape(e.numero_agrement || '-')}</span></div>
            <div class="info-row"><span class="info-label">Date d'agrément</span><span class="info-value">${Utils.escape(e.date_agrement || '-')}</span></div>
          </div>
        </div>
        ${e.risques_professionnels ? `<div class="section-box"><div class="section-box-title">Risques professionnels</div><p style="margin:0;font-size:10pt;color:#374151">${Utils.escape(e.risques_professionnels)}</p></div>` : ''}
        <div class="section-box">
          <div class="section-box-title">Effectif &amp; travailleurs</div>
          <div class="info-row"><span class="info-label">Travailleurs actifs</span><span class="info-value">${e.nb_travailleurs || 0}</span></div>
        </div>
        <div class="legal-note">Décret N°2026-206 du 15 Avril 2026 — Données d'entreprise confidentielles, usage interne uniquement.</div>`

      Print.page(`Fiche Entreprise — ${e.nom}`, body)
    } catch (e) {
      Toast.show('Erreur lors de la préparation de la fiche entreprise', 'error')
    }
  },

  async alerte(id) {
    try {
      Toast.show('Préparation de l\'alerte…', 'info')
      const alertes = State.data.alertes && State.data.alertes.length ? State.data.alertes : await API.get('/alertes')
      const a = alertes.find((alert) => Number(alert.id) === Number(id))
      if (!a) { Toast.show('Alerte introuvable', 'error'); return }

      const body = `
        <h2>Fiche Alerte</h2>
        <div class="info-grid">
          <div class="section-box">
            <div class="section-box-title">Détails de l'alerte</div>
            <div class="info-row"><span class="info-label">Message</span><span class="info-value">${Utils.escape(a.message)}</span></div>
            <div class="info-row"><span class="info-label">Priorité</span><span class="info-value">${Utils.escape(a.priorite)}</span></div>
            <div class="info-row"><span class="info-label">Statut</span><span class="info-value">${Utils.escape(a.statut || 'active')}</span></div>
            ${a.date_echeance ? `<div class="info-row"><span class="info-label">Échéance</span><span class="info-value">${Utils.formatDate(a.date_echeance)}</span></div>` : ''}
            ${a.nom || a.prenom ? `<div class="info-row"><span class="info-label">Travailleur</span><span class="info-value">${Utils.escape(a.prenom || '')} ${Utils.escape(a.nom || '')}</span></div>` : ''}
          </div>
        </div>`

      Print.page(`Alerte — ${Utils.escape(a.message).slice(0, 40)}`, body)
    } catch (e) {
      Toast.show('Impossible de préparer l\'impression', 'error')
    }
  },

  async utilisateur(id) {
    try {
      Toast.show('Préparation de la fiche utilisateur…', 'info')
      const users = State.data.users && State.data.users.length ? State.data.users : await API.get('/users')
      const u = users.find((user) => Number(user.id) === Number(id))
      if (!u) { Toast.show('Utilisateur introuvable', 'error'); return }

      const body = `
        <h2>Fiche Utilisateur</h2>
        <div class="info-grid">
          <div class="section-box">
            <div class="section-box-title">Informations utilisateur</div>
            <div class="info-row"><span class="info-label">Nom</span><span class="info-value">${Utils.escape(u.prenom)} ${Utils.escape(u.nom)}</span></div>
            <div class="info-row"><span class="info-label">Email</span><span class="info-value">${Utils.escape(u.email)}</span></div>
            <div class="info-row"><span class="info-label">Rôle</span><span class="info-value">${Utils.escape(u.role)}</span></div>
            <div class="info-row"><span class="info-label">Spécialité</span><span class="info-value">${Utils.escape(u.specialite || '-')}</span></div>
            <div class="info-row"><span class="info-label">Téléphone</span><span class="info-value">${Utils.escape(u.telephone || '-')}</span></div>
            <div class="info-row"><span class="info-label">Profil</span><span class="info-value">${Utils.escape(u.profil_nom || '-')}</span></div>
            <div class="info-row"><span class="info-label">Statut</span><span class="info-value">${u.actif ? 'Actif' : 'Inactif'}</span></div>
          </div>
        </div>`

      Print.page(`Utilisateur — ${Utils.escape(u.prenom)} ${Utils.escape(u.nom)}`, body)
    } catch (e) {
      Toast.show('Impossible de préparer l\'impression', 'error')
    }
  },

  /** Imprime une fiche de consultation */
  async consultation(id) {
    try {
      Toast.show('Préparation de la fiche de consultation…', 'info')
      const c = await API.get(`/consultations/${id}`)
      if (!c) { Toast.show('Consultation introuvable', 'error'); return }

      const body = `
        <h2>Fiche de Consultation</h2>
        <div class="info-grid">
          <div class="section-box">
            <div class="section-box-title">Patient</div>
            <div class="info-row"><span class="info-label">Nom</span><span class="info-value">${Utils.escape(c.prenom)} ${Utils.escape(c.nom)}</span></div>
            <div class="info-row"><span class="info-label">Entreprise</span><span class="info-value">${Utils.escape(c.entreprise || '-')}</span></div>
            <div class="info-row"><span class="info-label">Poste</span><span class="info-value">${Utils.escape(c.poste || '-')}</span></div>
          </div>
          <div class="section-box">
            <div class="section-box-title">Consultation</div>
            <div class="info-row"><span class="info-label">Date</span><span class="info-value">${Utils.formatDateTime(c.date_consultation)}</span></div>
            <div class="info-row"><span class="info-label">Praticien</span><span class="info-value">${c.praticien_prenom ? `${c.praticien_prenom} ${c.praticien_nom}` : '-'}</span></div>
          </div>
        </div>
        ${c.constantes ? `
          <h3>Constantes Vitales</h3>
          <div class="info-grid">
            ${c.constantes.poids ? `<div class="info-row"><span class="info-label">Poids/Taille</span><span class="info-value">${c.constantes.poids} kg / ${c.constantes.taille} cm</span></div>` : ''}
            ${c.constantes.imc ? `<div class="info-row"><span class="info-label">IMC</span><span class="info-value">${c.constantes.imc} kg/m²</span></div>` : ''}
            ${c.constantes.tension_systolique ? `<div class="info-row"><span class="info-label">Tension</span><span class="info-value">${c.constantes.tension_systolique}/${c.constantes.tension_diastolique} mmHg</span></div>` : ''}
            ${c.constantes.frequence_cardiaque ? `<div class="info-row"><span class="info-label">Pouls</span><span class="info-value">${c.constantes.frequence_cardiaque} bpm</span></div>` : ''}
            ${c.constantes.temperature ? `<div class="info-row"><span class="info-label">Température</span><span class="info-value">${c.constantes.temperature} °C</span></div>` : ''}
            ${c.constantes.saturation_oxygene ? `<div class="info-row"><span class="info-label">SpO2</span><span class="info-value">${c.constantes.saturation_oxygene} %</span></div>` : ''}
          </div>
        ` : ''}
        <h2>Détails</h2>
        <div class="section-box">
          <div class="section-box-title">Motif</div>
          <p>${Utils.escape(c.motif)}</p>
        </div>
        <div class="section-box">
          <div class="section-box-title">Diagnostic</div>
          <p>${Utils.escape(c.diagnostic || '-')}</p>
        </div>
      `
      Print.page(`Consultation — ${c.prenom} ${c.nom}`, body)
    } catch (e) { Toast.show('Erreur lors de la préparation de l\'impression', 'error') }
  },

  /** Imprime le dossier médical complet d'un travailleur */
  async dossier(travailleurId) {
    try {
      Toast.show('Préparation du dossier médical…', 'info')
      const [t, dossier] = await Promise.all([
        API.get(`/travailleurs/${travailleurId}`),
        API.get(`/travailleurs/${travailleurId}/dossier`)
      ])
      const contratLabel = {cdi:'CDI',cdd:'CDD',saisonnier:'Saisonnier',temporaire:'Temporaire',apprentissage:'Apprentissage',stage:'Stage',independant:'Indépendant'}
      const risqueLabel = {standard:'Standard',eleve:'Élevé',tres_eleve:'Très élevé'}
      const aptitudeText = {apte:'Apte',apte_amenagement:'Apte (aménagement)',apte_temporaire:'Apte temporaire',inapte_temporaire:'Inapte temporaire',inapte_definitif:'Inapte définitif'}

      let visitesHtml = dossier.visites.length === 0 ? '<p style="color:#9ca3af;font-style:italic">Aucune visite enregistrée</p>' :
        `<table><thead><tr><th>Date</th><th>Type</th><th>Statut</th><th>Aptitude</th><th>Médecin</th><th>Conclusions</th></tr></thead><tbody>
        ${dossier.visites.map(v => `<tr>
          <td>${Utils.formatDate(v.date_visite)}${v.heure_visite ? ' ' + v.heure_visite : ''}</td>
          <td>${Utils.typeVisiteLabel(v.type_visite)}</td>
          <td>${v.statut}</td>
          <td>${aptitudeText[v.aptitude] || '-'}</td>
          <td>${v.medecin_prenom ? 'Dr. ' + v.medecin_prenom + ' ' + v.medecin_nom : '-'}</td>
          <td style="max-width:180px">${v.conclusions || '-'}</td>
        </tr>`).join('')}</tbody></table>`

      let consultHtml = dossier.consultations.length === 0 ? '<p style="color:#9ca3af;font-style:italic">Aucune consultation enregistrée</p>' :
        `<table><thead><tr><th>Date</th><th>Motif</th><th>Diagnostic</th><th>Prescriptions</th><th>Arrêt</th></tr></thead><tbody>
        ${dossier.consultations.map(c => `<tr>
          <td>${Utils.formatDateTime(c.date_consultation)}</td>
          <td>${c.motif || '-'}</td>
          <td>${c.diagnostic || '-'}</td>
          <td>${c.prescriptions || '-'}</td>
          <td>${c.arret_travail_jours > 0 ? c.arret_travail_jours + ' jour(s)' : 'Non'}</td>
        </tr>`).join('')}</tbody></table>`

      let constantesHtml = ''
      if (dossier.constantes && dossier.constantes.length > 0) {
        const c = dossier.constantes[0]
        constantesHtml = `<div class="section-box">
          <div class="section-box-title">Dernières Constantes (${Utils.formatDateTime(c.date_mesure)})</div>
          <div class="info-grid">
            ${c.tension_systolique ? `<div class="info-row"><span class="info-label">Tension artérielle</span><span class="info-value">${c.tension_systolique}/${c.tension_diastolique} mmHg</span></div>` : ''}
            ${c.frequence_cardiaque ? `<div class="info-row"><span class="info-label">Fréquence cardiaque</span><span class="info-value">${c.frequence_cardiaque} bpm</span></div>` : ''}
            ${c.poids ? `<div class="info-row"><span class="info-label">Poids / Taille</span><span class="info-value">${c.poids} kg / ${c.taille || '?'} cm</span></div>` : ''}
            ${c.imc ? `<div class="info-row"><span class="info-label">IMC</span><span class="info-value">${c.imc} kg/m²</span></div>` : ''}
            ${c.temperature ? `<div class="info-row"><span class="info-label">Température</span><span class="info-value">${c.temperature} °C</span></div>` : ''}
            ${c.saturation_oxygene ? `<div class="info-row"><span class="info-label">SpO2</span><span class="info-value">${c.saturation_oxygene} %</span></div>` : ''}
          </div>
        </div>`
      }

      const body = `
        <h2>Dossier Médical — ${t.prenom} ${t.nom}</h2>
        <div class="info-grid">
          <div class="section-box">
            <div class="section-box-title">Informations Personnelles</div>
            <div class="info-row"><span class="info-label">Nom complet</span><span class="info-value">${t.prenom} ${t.nom}</span></div>
            <div class="info-row"><span class="info-label">Date de naissance</span><span class="info-value">${Utils.formatDate(t.date_naissance)} (${Utils.formatAge(t.date_naissance)})</span></div>
            <div class="info-row"><span class="info-label">Sexe</span><span class="info-value">${t.sexe === 'M' ? 'Masculin' : 'Féminin'}</span></div>
            <div class="info-row"><span class="info-label">Groupe sanguin</span><span class="info-value">${t.groupe_sanguin || '-'}</span></div>
            <div class="info-row"><span class="info-label">Téléphone</span><span class="info-value">${t.telephone || '-'}</span></div>
            <div class="info-row"><span class="info-label">Email</span><span class="info-value">${t.email || '-'}</span></div>
            <div class="info-row"><span class="info-label">Adresse</span><span class="info-value">${t.adresse || '-'}</span></div>
          </div>
          <div class="section-box">
            <div class="section-box-title">Informations Professionnelles</div>
            <div class="info-row"><span class="info-label">Matricule</span><span class="info-value">${t.numero_matricule || '-'}</span></div>
            <div class="info-row"><span class="info-label">Entreprise</span><span class="info-value">${t.entreprise_nom || '-'}</span></div>
            <div class="info-row"><span class="info-label">Poste</span><span class="info-value">${t.poste || '-'}</span></div>
            <div class="info-row"><span class="info-label">Date d'embauche</span><span class="info-value">${Utils.formatDate(t.date_embauche)}</span></div>
            <div class="info-row"><span class="info-label">Type de contrat</span><span class="info-value">${contratLabel[t.type_contrat] || t.type_contrat || 'CDI'}</span></div>
            <div class="info-row"><span class="info-label">Catégorie de risque</span><span class="info-value">${risqueLabel[t.categorie_risque] || 'Standard'}</span></div>
            <div class="info-row"><span class="info-label">Fréquence visite</span><span class="info-value">Tous les ${t.frequence_visite_mois || 12} mois</span></div>
          </div>
        </div>
        <div class="section-box">
          <div class="section-box-title">Antécédents Médicaux</div>
          <div class="info-row"><span class="info-label">Allergies</span><span class="info-value">${t.allergies || 'Aucune connue'}</span></div>
          <div class="info-row"><span class="info-label">Antécédents personnels</span><span class="info-value">${t.antecedents_personnels || 'Aucun'}</span></div>
          <div class="info-row"><span class="info-label">Antécédents familiaux</span><span class="info-value">${t.antecedents_familiaux || 'Aucun'}</span></div>
          <div class="info-row"><span class="info-label">Traitement en cours</span><span class="info-value">${t.traitement_en_cours || 'Aucun'}</span></div>
        </div>
        ${constantesHtml}
        <h2>Historique des Visites Médicales (${dossier.visites.length})</h2>
        ${visitesHtml}
        <h2>Historique des Consultations (${dossier.consultations.length})</h2>
        ${consultHtml}
        <div class="legal-note">Décret N°2026-206 du 15 Avril 2026 — Document confidentiel soumis au secret médical. Toute divulgation non autorisée est passible de sanctions.</div>`

      Print.page(`Dossier Médical — ${t.prenom} ${t.nom}`, body)
    } catch(e) {
      Toast.show('Erreur lors de la préparation du dossier', 'error')
      console.error(e)
    }
  },

  /** Imprime une visite médicale individuelle */
  async visite(visiteId) {
    try {
      Toast.show('Préparation de la fiche visite…', 'info')
      const v = await API.get(`/visites/${visiteId}`)
      const aptitudeText = {apte:'Apte',apte_amenagement:'Apte avec aménagement',apte_temporaire:'Apte temporaire',inapte_temporaire:'Inapte temporaire',inapte_definitif:'Inapte définitif'}
      const typeLabel = {embauche:'Embauche',periodique:'Périodique',reprise:'Reprise',spontanee:'Spontanée',pre_reprise:'Pré-reprise'}
      const statutLabel = {planifiee:'Planifiée',realisee:'Réalisée',annulee:'Annulée',reportee:'Reportée'}

      const body = `
        <h2>Fiche de Visite Médicale</h2>
        <div class="info-grid">
          <div class="section-box">
            <div class="section-box-title">Travailleur</div>
            <div class="info-row"><span class="info-label">Nom complet</span><span class="info-value">${v.prenom} ${v.nom}</span></div>
            <div class="info-row"><span class="info-label">Poste</span><span class="info-value">${v.poste || '-'}</span></div>
            <div class="info-row"><span class="info-label">Entreprise</span><span class="info-value">${v.entreprise || '-'}</span></div>
          </div>
          <div class="section-box">
            <div class="section-box-title">Informations de la Visite</div>
            <div class="info-row"><span class="info-label">Type de visite</span><span class="info-value">${typeLabel[v.type_visite] || v.type_visite}</span></div>
            <div class="info-row"><span class="info-label">Date</span><span class="info-value">${Utils.formatDate(v.date_visite)} ${v.heure_visite || ''}</span></div>
            <div class="info-row"><span class="info-label">Statut</span><span class="info-value">${statutLabel[v.statut] || v.statut}</span></div>
            <div class="info-row"><span class="info-label">Médecin</span><span class="info-value">${v.medecin_prenom ? 'Dr. ' + v.medecin_prenom + ' ' + v.medecin_nom : '-'}</span></div>
          </div>
        </div>
        <div class="section-box">
          <div class="section-box-title">Conclusion Médicale</div>
          <div class="info-row"><span class="info-label">Aptitude</span><span class="info-value" style="font-weight:700;font-size:12pt">${aptitudeText[v.aptitude] || 'Non définie'}</span></div>
          ${v.restrictions ? `<div class="info-row"><span class="info-label">Restrictions</span><span class="info-value">${v.restrictions}</span></div>` : ''}
          ${v.prochaine_visite ? `<div class="info-row"><span class="info-label">Prochaine visite</span><span class="info-value" style="color:#006B3C;font-weight:600">${Utils.formatDate(v.prochaine_visite)}</span></div>` : ''}
        </div>
        ${v.motif ? `<div class="section-box"><div class="section-box-title">Motif de la visite</div><p style="font-size:10pt">${v.motif}</p></div>` : ''}
        ${v.conclusions ? `<div class="section-box"><div class="section-box-title">Conclusions & Observations</div><p style="font-size:10pt;line-height:1.6">${v.conclusions}</p></div>` : ''}
        <div style="margin-top:40px;display:grid;grid-template-columns:1fr 1fr;gap:20px">
          <div style="text-align:center;border-top:1px solid #374151;padding-top:8px;font-size:9.5pt;color:#374151">
            Signature du Travailleur<br><br><br>
          </div>
          <div style="text-align:center;border-top:1px solid #374151;padding-top:8px;font-size:9.5pt;color:#374151">
            Signature du Médecin du Travail<br>
            <span style="font-size:9pt;color:#6b7280">${v.medecin_prenom ? 'Dr. ' + v.medecin_prenom + ' ' + v.medecin_nom : ''}</span>
          </div>
        </div>
        <div class="legal-note" style="margin-top:20px">Art. 25 Décret N°2026-206 — Ce certificat a valeur légale. Toute contestation doit intervenir dans un délai de 2 mois (Art. 28).</div>`

      Print.page(`Fiche de Visite — ${v.prenom} ${v.nom} — ${Utils.formatDate(v.date_visite)}`, body)
    } catch(e) {
      Toast.show('Erreur lors de la préparation de la visite', 'error')
      console.error(e)
    }
  },

  /** Imprime un certificat d'aptitude */
  async certificat(certId) {
    try {
      Toast.show('Préparation du certificat…', 'info')
      const c = await API.get(`/certificats/${certId}`)
      const typeLabel = {aptitude:'Aptitude au poste',aptitude_amenagement:'Aptitude avec aménagement',aptitude_restriction:'Aptitude avec restriction',inaptitude_temporaire:'Inaptitude temporaire',inaptitude_definitive:'Inaptitude définitive'}

      const body = `
        <h2>Certificat d'Aptitude N°${c.numero_certificat || certId}</h2>
        <div class="legal-note" style="margin-bottom:14px"><strong>Art. 25-28 — Décret N°2026-206 du 15 Avril 2026</strong></div>
        <div class="info-grid">
          <div class="section-box">
            <div class="section-box-title">Travailleur concerné</div>
            <div class="info-row"><span class="info-label">Nom complet</span><span class="info-value">${c.prenom || ''} ${c.nom || ''}</span></div>
            <div class="info-row"><span class="info-label">Matricule</span><span class="info-value">${c.numero_matricule || '-'}</span></div>
            <div class="info-row"><span class="info-label">Entreprise</span><span class="info-value">${c.entreprise || '-'}</span></div>
          </div>
          <div class="section-box">
            <div class="section-box-title">Informations du Certificat</div>
            <div class="info-row"><span class="info-label">Date d'émission</span><span class="info-value">${Utils.formatDate(c.date_emission)}</span></div>
            <div class="info-row"><span class="info-label">Type</span><span class="info-value">${typeLabel[c.type_certificat] || c.type_certificat}</span></div>
            <div class="info-row"><span class="info-label">Validité</span><span class="info-value">${c.date_expiration ? 'Jusqu\'au ' + Utils.formatDate(c.date_expiration) : c.validite_jours + ' jours'}</span></div>
            <div class="info-row"><span class="info-label">Médecin signataire</span><span class="info-value">${c.medecin_prenom ? 'Dr. ' + c.medecin_prenom + ' ' + c.medecin_nom : '-'}</span></div>
          </div>
        </div>
        <div class="section-box" style="border:2px solid ${c.aptitude && c.aptitude.startsWith('inapte') ? '#ef4444' : '#006B3C'}">
          <div class="section-box-title" style="font-size:13pt;text-align:center">CONCLUSION D'APTITUDE</div>
          <p style="text-align:center;font-size:15pt;font-weight:700;color:${c.aptitude && c.aptitude.startsWith('inapte') ? '#ef4444' : '#006B3C'};padding:10px 0">
            ${({apte:'APTE AU POSTE DE TRAVAIL',apte_amenagement:'APTE AVEC AMÉNAGEMENT',apte_temporaire:'APTE TEMPORAIREMENT',inapte_temporaire:'INAPTE TEMPORAIREMENT',inapte_definitif:'INAPTE DÉFINITIVEMENT'})[c.aptitude] || c.aptitude || '-'}
          </p>
          ${c.restrictions ? `<div class="info-row"><span class="info-label">Restrictions</span><span class="info-value">${c.restrictions}</span></div>` : ''}
          ${c.amenagements ? `<div class="info-row"><span class="info-label">Aménagements</span><span class="info-value">${c.amenagements}</span></div>` : ''}
        </div>
        ${c.motif_inaptitude ? `<div class="section-box"><div class="section-box-title">Motif d'inaptitude (Art. 26)</div><p style="font-size:10pt">${c.motif_inaptitude}</p></div>` : ''}
        <div class="section-box">
          <div class="section-box-title">Vérifications légales (Art. 26)</div>
          <div class="info-row"><span class="info-label">Étude du poste réalisée</span><span class="info-value">${c.etude_poste_realisee ? '✓ Oui' : '✗ Non'}</span></div>
          <div class="info-row"><span class="info-label">Deux examens médicaux réalisés</span><span class="info-value">${c.deux_examens_realises ? '✓ Oui' : '✗ Non'}</span></div>
          ${c.date_premier_examen ? `<div class="info-row"><span class="info-label">1er examen</span><span class="info-value">${Utils.formatDate(c.date_premier_examen)}</span></div>` : ''}
          ${c.date_second_examen ? `<div class="info-row"><span class="info-label">2ème examen</span><span class="info-value">${Utils.formatDate(c.date_second_examen)}</span></div>` : ''}
        </div>
        <div style="margin-top:40px;display:grid;grid-template-columns:1fr 1fr;gap:20px">
          <div style="text-align:center;border-top:1px solid #374151;padding-top:8px;font-size:9.5pt">
            Signature & Cachet du Médecin du Travail<br>
            <span style="color:#6b7280">${c.medecin_prenom ? 'Dr. ' + c.medecin_prenom + ' ' + c.medecin_nom : ''}</span><br><br><br>
          </div>
          <div style="text-align:center;border-top:1px solid #374151;padding-top:8px;font-size:9.5pt">
            Accusé de réception (Employeur)<br><br><br>
          </div>
        </div>
        <div class="legal-note" style="margin-top:16px">Ce certificat peut être contesté dans un délai de 2 mois suivant sa notification (Art. 28 Décret N°2026-206). Toute contestation doit être adressée à l'inspection du travail du ressort.</div>`

      Print.page(`Certificat d'Aptitude N°${c.numero_certificat || certId}`, body)
    } catch(e) {
      Toast.show('Erreur lors de la préparation du certificat', 'error')
    }
  },

  /** Imprime le registre journalier d'une date */
  async registre(date) {
    try {
      Toast.show('Préparation du registre journalier…', 'info')
      const registre = await API.get(`/registre-journalier?date=${date}`)
      const aptitudeText = {apte:'Apte',apte_amenagement:'Apte amén.',apte_temporaire:'Apte temp.',inapte_temporaire:'Inapte temp.',inapte_definitif:'Inapte déf.'}
      const typeLabel = {embauche:'Emb.',periodique:'Pério.',reprise:'Reprise',spontanee:'Spont.',pre_reprise:'Pré-rep.',tiers_temps:'Tiers'}

      const lignes = registre.map((r, i) => `<tr>
        <td style="text-align:center;font-weight:600">${i + 1}</td>
        <td>${r.heure_arrivee || '-'}</td>
        <td style="font-weight:600">${r.nom_prenom}</td>
        <td>${r.entreprise || '-'}</td>
        <td>${r.poste_travail || '-'}</td>
        <td>${typeLabel[r.type_visite] || r.type_visite}</td>
        <td>${aptitudeText[r.aptitude_conclue] || 'En cours'}</td>
        <td>${r.medecin_nom || '-'}</td>
        <td style="font-size:8.5pt">${r.observations || ''}</td>
      </tr>`).join('')

      const body = `
        <h2>Registre Journalier — ${Utils.formatDate(date)}</h2>
        <div class="legal-note">Art. 7 &amp; 29 — Annexe I — Décret N°2026-206 du 15 Avril 2026 — ${registre.length} visite(s) enregistrée(s)</div>
        <table>
          <thead><tr><th>#</th><th>Heure</th><th>Nom &amp; Prénom</th><th>Entreprise</th><th>Poste</th><th>Type</th><th>Aptitude</th><th>Médecin</th><th>Observations</th></tr></thead>
          <tbody>${lignes.length > 0 ? lignes : '<tr><td colspan="9" style="text-align:center;color:#9ca3af;padding:20px">Aucune visite enregistrée</td></tr>'}</tbody>
        </table>
        <div style="margin-top:20px;display:grid;grid-template-columns:1fr 1fr;gap:20px">
          <div style="text-align:center;border-top:1px solid #374151;padding-top:8px;font-size:9.5pt">
            Visa du Médecin-chef<br><br><br>
          </div>
          <div style="text-align:center;border-top:1px solid #374151;padding-top:8px;font-size:9.5pt">
            Cachet du Service de Santé au Travail<br><br><br>
          </div>
        </div>`

      Print.page(`Registre Journalier — ${Utils.formatDate(date)}`, body)
    } catch(e) {
      Toast.show('Erreur lors de la préparation du registre', 'error')
    }
  },

  /** Imprime l'attestation d'aptitude après visite médicale */
  async attestationAptitude(visiteId) {
    try {
      Toast.show('Préparation de l\'attestation…', 'info')
      const v = await API.get(`/visites/${visiteId}`)
      const t = await API.get(`/travailleurs/${v.travailleur_id}`)
      const aptitudeLabel = {
        apte: 'APTE',
        apte_amenagement: 'APTE AVEC AMÉNAGEMENT DE POSTE',
        apte_temporaire: 'APTE TEMPORAIREMENT',
        inapte_temporaire: 'INAPTE TEMPORAIREMENT',
        inapte_definitif: 'INAPTE DÉFINITIVEMENT'
      }[v.aptitude] || v.aptitude || 'EN COURS D\'ÉVALUATION'
      const aptitudeColor = (v.aptitude === 'apte') ? '#006B3C' :
                            (v.aptitude?.startsWith('inapte')) ? '#dc2626' : '#FF8C00'
      const typeVisiteLabel = {
        embauche: "Visite d'embauche",
        periodique: 'Visite périodique',
        reprise: 'Visite de reprise',
        spontanee: 'Visite spontanée',
        pre_reprise: 'Visite de pré-reprise'
      }[v.type_visite] || v.type_visite
      const body = `
        <div style="border:2px solid #006B3C;border-radius:8px;padding:20px 24px;margin-bottom:16px">
          <div style="text-align:center;margin-bottom:12px">
            <div style="font-size:14pt;font-weight:800;color:#006B3C;text-transform:uppercase;letter-spacing:1px">
              ATTESTATION DE VISITE MÉDICALE DU TRAVAIL
            </div>
            <div style="font-size:9pt;color:#6b7280;margin-top:4px">
              Décret N°2026-206 du 15 Avril 2026 — Art. 25 à 28
            </div>
          </div>
          <div style="border-top:1px solid #e5e7eb;padding-top:12px">
            <p style="font-size:11pt;margin-bottom:8px">
              Je soussigné(e), <strong>Dr. ${Utils.escape((v.medecin_prenom||''))} ${Utils.escape((v.medecin_nom||''))}</strong>,
              Médecin du Travail, certifie avoir examiné le travailleur ci-dessous dans le cadre de la
              médecine du travail conformément au Décret N°2026-206.
            </p>
          </div>
        </div>
        <h2>Identité du Travailleur</h2>
        <div class="info-grid">
          <div class="info-row"><span class="info-label">Nom et Prénom</span><span class="info-value">${Utils.escape(t.prenom)} ${Utils.escape(t.nom)}</span></div>
          <div class="info-row"><span class="info-label">Date de naissance</span><span class="info-value">${Utils.formatDate(t.date_naissance)}</span></div>
          <div class="info-row"><span class="info-label">Matricule</span><span class="info-value">${Utils.escape(t.numero_matricule||'-')}</span></div>
          <div class="info-row"><span class="info-label">Poste</span><span class="info-value">${Utils.escape(t.poste||'-')}</span></div>
          <div class="info-row"><span class="info-label">Entreprise</span><span class="info-value">${Utils.escape(t.entreprise_nom||'-')}</span></div>
          <div class="info-row"><span class="info-label">Sexe</span><span class="info-value">${t.sexe === 'M' ? 'Masculin' : 'Féminin'}</span></div>
        </div>
        <h2>Résultat de la Visite</h2>
        <div class="info-grid">
          <div class="info-row"><span class="info-label">Type de visite</span><span class="info-value">${typeVisiteLabel}</span></div>
          <div class="info-row"><span class="info-label">Date de visite</span><span class="info-value">${Utils.formatDate(v.date_visite)}</span></div>
        </div>
        <div style="text-align:center;margin:20px 0;padding:16px;border:3px solid ${aptitudeColor};border-radius:8px;background:${aptitudeColor}11">
          <div style="font-size:13pt;font-weight:800;color:${aptitudeColor};letter-spacing:1px">${aptitudeLabel}</div>
          ${v.aptitude && v.aptitude !== 'apte' && v.restrictions ? `<div style="font-size:10pt;color:#374151;margin-top:8px"><strong>Restrictions/Aménagements :</strong> ${Utils.escape(v.restrictions)}</div>` : ''}
        </div>
        ${v.prochaine_visite ? `<div class="info-row"><span class="info-label">Prochaine visite</span><span class="info-value">${Utils.formatDate(v.prochaine_visite)}</span></div>` : ''}
        ${v.conclusions ? `<div class="section-box"><div class="section-box-title">Observations</div><p style="font-size:10pt">${Utils.escape(v.conclusions)}</p></div>` : ''}
        <div class="legal-note">
          <i class="fas fa-gavel" style="margin-right:4px"></i>
          Ce certificat est établi conformément aux articles 25 à 28 du Décret N°2026-206 du 15 Avril 2026
          relatif à la médecine du travail en Côte d'Ivoire. Tout travailleur peut contester cette décision
          dans un délai de 2 mois (Art. 28).
        </div>
        <div style="margin-top:32px;display:grid;grid-template-columns:1fr 1fr;gap:40px">
          <div style="text-align:center">
            <div style="font-size:9pt;color:#6b7280">L'Employeur</div>
            <div style="border-bottom:1px solid #374151;margin:30px 20px 4px"></div>
            <div style="font-size:8.5pt;color:#9ca3af">Signature et cachet</div>
          </div>
          <div style="text-align:center">
            <div style="font-size:9pt;color:#6b7280">Le Médecin du Travail</div>
            <div style="border-bottom:1px solid #374151;margin:30px 20px 4px"></div>
            <div style="font-size:9pt;font-weight:600">Dr. ${Utils.escape((v.medecin_prenom||''))} ${Utils.escape((v.medecin_nom||''))}</div>
          </div>
        </div>`
      Print.page(`Attestation d'Aptitude — ${t.prenom} ${t.nom}`, body, { subtitle: `Visite du ${Utils.formatDate(v.date_visite)}` })
    } catch(e) {
      Toast.show('Erreur lors de la préparation de l\'attestation', 'error')
    }
  },

  /** Imprime l'attestation de test VIH */
  async attestationVIH(attestId) {
    try {
      Toast.show('Préparation de l\'attestation VIH…', 'info')
      const av = await API.get(`/attestations-vih/${attestId}`)
      const body = `
        <div style="border:2px solid #006B3C;border-radius:8px;padding:20px 24px;margin-bottom:16px">
          <div style="text-align:center">
            <div style="font-size:14pt;font-weight:800;color:#006B3C;text-transform:uppercase;letter-spacing:1px">
              ATTESTATION DE DÉPISTAGE VIH/SIDA
            </div>
            <div style="font-size:9pt;color:#6b7280;margin-top:4px">Protocole National de Dépistage — Côte d'Ivoire</div>
            <div style="font-size:9pt;font-weight:600;color:#374151;margin-top:4px">N° ${Utils.escape(av.numero_attestation)}</div>
          </div>
        </div>
        <h2>Identité du Patient</h2>
        <div class="info-grid">
          <div class="info-row"><span class="info-label">Nom et Prénom</span><span class="info-value">${Utils.escape(av.travailleur_prenom)} ${Utils.escape(av.travailleur_nom)}</span></div>
          <div class="info-row"><span class="info-label">Date de naissance</span><span class="info-value">${Utils.formatDate(av.date_naissance)}</span></div>
          <div class="info-row"><span class="info-label">Matricule</span><span class="info-value">${Utils.escape(av.numero_matricule||'-')}</span></div>
          <div class="info-row"><span class="info-label">Poste</span><span class="info-value">${Utils.escape(av.poste||'-')}</span></div>
          <div class="info-row"><span class="info-label">Entreprise</span><span class="info-value">${Utils.escape(av.entreprise_nom||'-')}</span></div>
        </div>
        <h2>Attestation</h2>
        <div style="border:1px solid #e5e7eb;border-radius:6px;padding:16px;margin:12px 0;font-size:11pt;line-height:1.8">
          <p>Je soussigné(e), <strong>Dr. ${Utils.escape(av.medecin_prenom||'')} ${Utils.escape(av.medecin_nom||'')}</strong>,
          Médecin du Travail, certifie avoir réalisé le dépistage du VIH/SIDA pour
          <strong>${Utils.escape(av.travailleur_prenom)} ${Utils.escape(av.travailleur_nom)}</strong>
          le <strong>${Utils.formatDate(av.date_test)}</strong>.</p>
          <br>
          <p>Ce dépistage a été réalisé dans le strict respect :</p>
          <ul style="margin:8px 0 8px 20px;font-size:10pt">
            <li>Du consentement éclairé du patient ${av.consentement_eclaire ? '✅' : '—'}</li>
            <li>Du counseling pré-test ${av.counseling_pre_realise ? '✅' : '—'}</li>
            <li>De la confidentialité des résultats</li>
            <li>Du protocole national de dépistage VIH/SIDA de Côte d'Ivoire</li>
          </ul>
          <p style="font-style:italic;color:#6b7280;font-size:9.5pt">
            Note : La présente attestation confirme uniquement la réalisation du test.
            Le résultat est strictement confidentiel et remis directement au patient.
          </p>
        </div>
        ${av.observations ? `<div class="section-box"><div class="section-box-title">Observations</div><p>${Utils.escape(av.observations)}</p></div>` : ''}
        <div class="legal-note">
          <i class="fas fa-shield-alt" style="margin-right:4px"></i>
          Conformément à la loi n°92-509 du 8 juillet 1992 relative à la lutte contre le SIDA
          et au protocole national de dépistage, les résultats de ce test sont strictement confidentiels.
        </div>
        <div style="margin-top:32px;display:grid;grid-template-columns:1fr 1fr;gap:40px">
          <div></div>
          <div style="text-align:center">
            <div style="font-size:9pt;color:#6b7280">Le Médecin du Travail</div>
            <div style="border-bottom:1px solid #374151;margin:30px 20px 4px"></div>
            <div style="font-size:9pt;font-weight:600">Dr. ${Utils.escape(av.medecin_prenom||'')} ${Utils.escape(av.medecin_nom||'')}</div>
            ${av.specialite ? `<div style="font-size:8.5pt;color:#6b7280">${Utils.escape(av.specialite)}</div>` : ''}
          </div>
        </div>`
      Print.page(`Attestation VIH — ${av.travailleur_prenom} ${av.travailleur_nom}`, body)
    } catch(e) {
      Toast.show('Erreur lors de la préparation de l\'attestation VIH', 'error')
    }
  },

  /** Imprime une ordonnance médicale */
  async ordonnance(prescId) {
    try {
      Toast.show('Préparation de l\'ordonnance…', 'info')
      const p = await API.get(`/prescriptions/${prescId}`)
      const lignesHtml = (p.lignes || []).map((l, i) => `
        <tr style="${i%2===0 ? 'background:#f9fafb' : ''}">
          <td style="padding:8px;font-weight:600">${i+1}. ${Utils.escape(l.medicament)}${l.dosage ? ` ${Utils.escape(l.dosage)}` : ''}${l.forme ? ` (${Utils.escape(l.forme)})` : ''}</td>
          <td style="padding:8px">${Utils.escape(l.posologie)}</td>
          <td style="padding:8px">${Utils.escape(l.duree||'-')}</td>
          <td style="padding:8px">${Utils.escape(l.quantite||'-')}</td>
        </tr>
        ${l.instructions ? `<tr><td colspan="4" style="padding:2px 8px 8px;font-size:9pt;color:#6b7280;font-style:italic">↳ ${Utils.escape(l.instructions)}</td></tr>` : ''}`
      ).join('')
      const body = `
        <div style="border:2px solid #006B3C;border-radius:8px;padding:16px 20px;margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <div>
              <div style="font-size:14pt;font-weight:800;color:#006B3C;text-transform:uppercase">ORDONNANCE MÉDICALE</div>
              <div style="font-size:9pt;color:#6b7280">N° ${Utils.escape(p.numero_ordonnance||'-')} — Médecine du Travail</div>
            </div>
            <div style="text-align:right;font-size:9pt;color:#374151">
              <div><strong>Date :</strong> ${Utils.formatDate(p.date_prescription)}</div>
              ${p.renouvellement ? '<div style="color:#dc2626;font-weight:600">RENOUVELLEMENT</div>' : ''}
            </div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
          <div style="border:1px solid #e5e7eb;border-radius:6px;padding:12px">
            <div style="font-size:9.5pt;font-weight:700;color:#006B3C;margin-bottom:8px;border-bottom:1px solid #e5e7eb;padding-bottom:4px">PRESCRIPTEUR</div>
            <div style="font-size:10pt;font-weight:600">Dr. ${Utils.escape(p.medecin_prenom||'')} ${Utils.escape(p.medecin_nom||'')}</div>
            ${p.specialite ? `<div style="font-size:9pt;color:#6b7280">${Utils.escape(p.specialite)}</div>` : ''}
            ${p.numero_ordre ? `<div style="font-size:9pt;color:#6b7280">Ordre N° ${Utils.escape(p.numero_ordre)}</div>` : ''}
          </div>
          <div style="border:1px solid #e5e7eb;border-radius:6px;padding:12px">
            <div style="font-size:9.5pt;font-weight:700;color:#006B3C;margin-bottom:8px;border-bottom:1px solid #e5e7eb;padding-bottom:4px">PATIENT</div>
            <div style="font-size:10pt;font-weight:600">${Utils.escape(p.travailleur_prenom||'')} ${Utils.escape(p.travailleur_nom||'')}</div>
            ${p.date_naissance ? `<div style="font-size:9pt;color:#6b7280">Né(e) le ${Utils.formatDate(p.date_naissance)}</div>` : ''}
            ${p.numero_matricule ? `<div style="font-size:9pt;color:#6b7280">Mat. ${Utils.escape(p.numero_matricule)}</div>` : ''}
          </div>
        </div>
        <h2>Médicaments Prescrits</h2>
        <table>
          <thead><tr>
            <th style="width:40%">Médicament</th>
            <th>Posologie</th>
            <th>Durée</th>
            <th>Qté</th>
          </tr></thead>
          <tbody>${lignesHtml || '<tr><td colspan="4" style="padding:12px;text-align:center;color:#9ca3af;font-style:italic">Aucun médicament prescrit</td></tr>'}</tbody>
        </table>
        ${p.notes ? `<div class="section-box" style="margin-top:12px"><div class="section-box-title">Observations / Instructions</div><p style="font-size:10pt">${Utils.escape(p.notes)}</p></div>` : ''}
        <div style="margin-top:32px;display:grid;grid-template-columns:1fr 1fr;gap:40px">
          <div></div>
          <div style="text-align:center">
            <div style="font-size:9pt;color:#6b7280">Signature et cachet du médecin</div>
            <div style="border-bottom:1px solid #374151;margin:30px 20px 4px"></div>
            <div style="font-size:9pt;font-weight:600">Dr. ${Utils.escape(p.medecin_prenom||'')} ${Utils.escape(p.medecin_nom||'')}</div>
          </div>
        </div>`
      Print.page(`Ordonnance — ${p.travailleur_prenom} ${p.travailleur_nom}`, body)
    } catch(e) {
      Toast.show('Erreur lors de la préparation de l\'ordonnance', 'error')
    }
  },

  /** Imprime un bon d'examen(s) complémentaire(s) */
  async bonExamens(travailleurId, visiteId = null) {
    try {
      Toast.show('Préparation du bon d\'examens…', 'info')
      const params = visiteId ? `travailleur_id=${travailleurId}&visite_id=${visiteId}` : `travailleur_id=${travailleurId}`
      const [examens, t] = await Promise.all([
        API.get(`/examens?${params}`),
        API.get(`/travailleurs/${travailleurId}`)
      ])
      const prescrits = examens.filter(e => e.statut === 'prescrit' || !e.statut)
      if (prescrits.length === 0) { Toast.show('Aucun examen prescrit à imprimer', 'info'); return }
      const groupes = {}
      prescrits.forEach(e => {
        if (!groupes[e.type_examen]) groupes[e.type_examen] = []
        groupes[e.type_examen].push(e)
      })
      const typeLabel = { biologie: 'Analyses Biologiques', imagerie: 'Imagerie Médicale',
        audiometrie: 'Audiométrie', spirometrie: 'Spirométrie', autre: 'Autres Examens' }
      const groupesHtml = Object.entries(groupes).map(([type, items]) => `
        <h3><i class="fas fa-vial"></i> ${typeLabel[type] || type}</h3>
        <table>
          <thead><tr><th>Examen</th><th>Urgent</th><th>Laboratoire</th><th>Instructions</th></tr></thead>
          <tbody>${items.map((e, i) => `
            <tr style="${i%2===0?'background:#f9fafb':''}">
              <td style="padding:7px;font-weight:600">${Utils.escape(e.nom_examen)}</td>
              <td style="padding:7px;text-align:center">${e.urgent ? '<span style="color:#dc2626;font-weight:700">⚡ URGENT</span>' : '—'}</td>
              <td style="padding:7px">${Utils.escape(e.laboratoire||'—')}</td>
              <td style="padding:7px;font-size:9pt;color:#6b7280">${Utils.escape(e.interpretation||'—')}</td>
            </tr>`).join('')}
          </tbody>
        </table>`).join('')
      const numBon = prescrits[0]?.numero_bon || `BON-${Date.now()}`
      const body = `
        <div style="border:2px solid #006B3C;border-radius:8px;padding:16px 20px;margin-bottom:16px">
          <div style="display:flex;justify-content:space-between">
            <div>
              <div style="font-size:14pt;font-weight:800;color:#006B3C;text-transform:uppercase">BON D'EXAMENS COMPLÉMENTAIRES</div>
              <div style="font-size:9pt;color:#6b7280">N° ${Utils.escape(numBon)} — Médecine du Travail</div>
            </div>
            <div style="text-align:right;font-size:9pt">Date : ${new Date().toLocaleDateString('fr-FR')}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
          <div style="border:1px solid #e5e7eb;border-radius:6px;padding:12px">
            <div style="font-size:9.5pt;font-weight:700;color:#006B3C;margin-bottom:6px">PATIENT</div>
            <div style="font-size:10pt;font-weight:600">${Utils.escape(t.prenom)} ${Utils.escape(t.nom)}</div>
            ${t.date_naissance ? `<div style="font-size:9pt;color:#6b7280">Né(e) le ${Utils.formatDate(t.date_naissance)}</div>` : ''}
            <div style="font-size:9pt;color:#6b7280">Mat. ${Utils.escape(t.numero_matricule||'-')} — ${Utils.escape(t.poste||'-')}</div>
            <div style="font-size:9pt;color:#6b7280">Ets: ${Utils.escape(t.entreprise_nom||'-')}</div>
          </div>
          <div style="border:1px solid #e5e7eb;border-radius:6px;padding:12px">
            <div style="font-size:9.5pt;font-weight:700;color:#006B3C;margin-bottom:6px">BILAN DEMANDÉ</div>
            <div style="font-size:10pt">${prescrits.length} examen(s) prescrit(s)</div>
            <div style="font-size:9pt;color:#6b7280;margin-top:4px">
              ${prescrits.some(e => e.urgent) ? '<span style="color:#dc2626;font-weight:700">⚡ RÉSULTATS URGENTS DEMANDÉS</span>' : 'Résultats à adresser au service médical'}
            </div>
          </div>
        </div>
        ${groupesHtml}
        <div class="legal-note" style="margin-top:16px">
          Les résultats sont à adresser directement au service médical du travail.
          Prise en charge par l'employeur conformément au Décret N°2026-206.
        </div>
        <div style="margin-top:24px;display:grid;grid-template-columns:1fr 1fr;gap:40px">
          <div></div>
          <div style="text-align:center">
            <div style="font-size:9pt;color:#6b7280">Le Médecin Prescripteur</div>
            <div style="border-bottom:1px solid #374151;margin:30px 20px 4px"></div>
            <div style="font-size:8.5pt;color:#9ca3af">Signature et cachet</div>
          </div>
        </div>`
      Print.page(`Bon d'Examens — ${t.prenom} ${t.nom}`, body)
    } catch(e) {
      Toast.show('Erreur lors de la préparation du bon d\'examens', 'error')
    }
  }
}

// ============================================================
// EXPORT EXCEL — Export via SheetJS (xlsx) chargé en CDN
// ============================================================
const Export = {
  /** Vérifie que SheetJS est chargé, sinon l'injecte */
  async _ensureXLSX() {
    if (window.XLSX) return true
    return new Promise((resolve) => {
      const s = document.createElement('script')
      s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'
      s.onload = () => resolve(true)
      s.onerror = () => resolve(false)
      document.head.appendChild(s)
    })
  },

  /** Transforme un tableau d'objets en fichier .xlsx et déclenche le téléchargement */
  toXLSX(data, filename, sheetName = 'Données') {
    if (!data || data.length === 0) { Toast.show('Aucune donnée à exporter', 'warning'); return }
    const ws = XLSX.utils.json_to_sheet(data)
    // Largeur automatique des colonnes
    const colWidths = Object.keys(data[0]).map(k => ({
      wch: Math.max(k.length, ...data.map(r => String(r[k] ?? '').length).slice(0, 50)) + 2
    }))
    ws['!cols'] = colWidths
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, sheetName)
    XLSX.writeFile(wb, filename)
    Toast.show(`Export "${filename}" téléchargé avec succès`)
  },

  /** Exporte la liste des travailleurs */
  async travailleurs() {
    const ok = await Export._ensureXLSX()
    if (!ok) { Toast.show('Bibliothèque Excel non disponible', 'error'); return }
    Toast.show('Génération du fichier Excel…', 'info')
    try {
      const data = await API.get('/travailleurs')
      const rows = data.map(t => ({
        'Matricule': t.numero_matricule || '',
        'Nom': t.nom || '',
        'Prénom': t.prenom || '',
        'Date naissance': Utils.formatDate(t.date_naissance),
        'Sexe': t.sexe === 'M' ? 'Masculin' : 'Féminin',
        'Groupe sanguin': t.groupe_sanguin || '',
        'Téléphone': t.telephone || '',
        'Email': t.email || '',
        'Entreprise': t.entreprise_nom || '',
        'Poste': t.poste || '',
        'Date embauche': Utils.formatDate(t.date_embauche),
        'Type contrat': t.type_contrat || '',
        'Catégorie risque': t.categorie_risque || '',
        'Fréquence visite (mois)': t.frequence_visite_mois || 12,
        'Statut': t.statut || ''
      }))
      Export.toXLSX(rows, `travailleurs_${new Date().toISOString().slice(0,10)}.xlsx`, 'Travailleurs')
    } catch(e) { Toast.show('Erreur lors de l\'export', 'error') }
  },

  /** Exporte la liste des visites médicales */
  async visites(filtres = {}) {
    const ok = await Export._ensureXLSX()
    if (!ok) { Toast.show('Bibliothèque Excel non disponible', 'error'); return }
    Toast.show('Génération du fichier Excel…', 'info')
    try {
      const today = new Date()
      const mois = filtres.mois || `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`
      let url = `/visites?mois=${mois}`
      if (filtres.statut) url += `&statut=${filtres.statut}`
      if (filtres.type) url += `&type=${filtres.type}`
      const data = await API.get(url)
      const typeLabel = {embauche:'Embauche',periodique:'Périodique',reprise:'Reprise',spontanee:'Spontanée',pre_reprise:'Pré-reprise'}
      const aptLabel = {apte:'Apte',apte_amenagement:'Apte (aménagement)',apte_temporaire:'Apte temporaire',inapte_temporaire:'Inapte temporaire',inapte_definitif:'Inapte définitif'}
      const rows = data.map(v => ({
        'Date': Utils.formatDate(v.date_visite),
        'Heure': v.heure_visite || '',
        'Type': typeLabel[v.type_visite] || v.type_visite,
        'Statut': v.statut || '',
        'Nom': v.nom || '',
        'Prénom': v.prenom || '',
        'Matricule': v.numero_matricule || '',
        'Poste': v.poste || '',
        'Entreprise': v.entreprise || '',
        'Médecin': v.medecin_prenom ? 'Dr. ' + v.medecin_prenom + ' ' + v.medecin_nom : '',
        'Aptitude': aptLabel[v.aptitude] || '',
        'Prochaine visite': Utils.formatDate(v.prochaine_visite),
        'Motif': v.motif || '',
        'Conclusions': v.conclusions || ''
      }))
      Export.toXLSX(rows, `visites_${mois}.xlsx`, 'Visites Médicales')
    } catch(e) { Toast.show('Erreur lors de l\'export', 'error') }
  },

  /** Exporte le registre journalier */
  async registre(date) {
    const ok = await Export._ensureXLSX()
    if (!ok) { Toast.show('Bibliothèque Excel non disponible', 'error'); return }
    Toast.show('Génération du fichier Excel…', 'info')
    try {
      const d = date || new Date().toISOString().split('T')[0]
      const data = await API.get(`/registre-journalier?date=${d}`)
      const aptLabel = {apte:'Apte',apte_amenagement:'Apte (aménagement)',apte_temporaire:'Apte temporaire',inapte_temporaire:'Inapte temporaire',inapte_definitif:'Inapte définitif'}
      const typeLabel = {embauche:'Embauche',periodique:'Périodique',reprise:'Reprise',spontanee:'Spontanée',pre_reprise:'Pré-reprise',tiers_temps:'Tiers-Temps'}
      const rows = data.map((r, i) => ({
        'N°': i + 1,
        'Date': Utils.formatDate(r.date_visite),
        'Heure': r.heure_arrivee || '',
        'Nom & Prénom': r.nom_prenom || '',
        'Entreprise': r.entreprise || '',
        'Poste': r.poste_travail || '',
        'Type visite': typeLabel[r.type_visite] || r.type_visite,
        'Motif': r.motif || '',
        'Aptitude': aptLabel[r.aptitude_conclue] || 'En cours',
        'Médecin': r.medecin_nom || '',
        'Observations': r.observations || ''
      }))
      Export.toXLSX(rows, `registre_journalier_${d}.xlsx`, 'Registre Journalier')
    } catch(e) { Toast.show('Erreur lors de l\'export', 'error') }
  },

  /** Exporte les certificats d'aptitude */
  async certificats() {
    const ok = await Export._ensureXLSX()
    if (!ok) { Toast.show('Bibliothèque Excel non disponible', 'error'); return }
    Toast.show('Génération du fichier Excel…', 'info')
    try {
      const data = await API.get('/certificats')
      const typeLabel = {aptitude:'Aptitude',aptitude_amenagement:'Aptitude (aménagement)',aptitude_restriction:'Aptitude (restriction)',inaptitude_temporaire:'Inaptitude temporaire',inaptitude_definitive:'Inaptitude définitive'}
      const rows = data.map(c => ({
        'N° Certificat': c.numero_certificat || '',
        'Date émission': Utils.formatDate(c.date_emission),
        'Type': typeLabel[c.type_certificat] || c.type_certificat,
        'Aptitude': c.aptitude || '',
        'Nom': c.nom || '',
        'Prénom': c.prenom || '',
        'Matricule': c.numero_matricule || '',
        'Entreprise': c.entreprise || '',
        'Médecin': c.medecin_prenom ? 'Dr. ' + c.medecin_prenom + ' ' + c.medecin_nom : '',
        'Restrictions': c.restrictions || '',
        'Expiration': Utils.formatDate(c.date_expiration),
        'Étude poste': c.etude_poste_realisee ? 'Oui' : 'Non',
        '2 Examens': c.deux_examens_realises ? 'Oui' : 'Non',
        'Contesté': c.conteste ? 'Oui' : 'Non',
        'Statut': c.statut || ''
      }))
      Export.toXLSX(rows, `certificats_aptitude_${new Date().toISOString().slice(0,10)}.xlsx`, 'Certificats')
    } catch(e) { Toast.show('Erreur lors de l\'export', 'error') }
  },

  /** Exporte les maladies & accidents */
  async maladies() {
    const ok = await Export._ensureXLSX()
    if (!ok) { Toast.show('Bibliothèque Excel non disponible', 'error'); return }
    Toast.show('Génération du fichier Excel…', 'info')
    try {
      const data = await API.get('/maladies-accidents')
      const typeLabel = {maladie_professionnelle:'Maladie Pro.',accident_travail:'Accident Travail',accident_trajet:'Accident Trajet',maladie_non_professionnelle:'Maladie Non-Pro.'}
      const rows = data.map(e => ({
        'Date événement': Utils.formatDate(e.date_evenement),
        'Date déclaration': Utils.formatDate(e.date_declaration),
        'Type': typeLabel[e.type_evenement] || e.type_evenement,
        'Nom': e.nom || '',
        'Prénom': e.prenom || '',
        'Entreprise': e.entreprise || '',
        'Poste': e.poste || '',
        'Description': e.description || '',
        'Siège lésion': e.siege_lesion || '',
        'Nature lésion': e.nature_lesion || '',
        'Arrêt travail': e.arret_travail ? 'Oui' : 'Non',
        'Durée arrêt (jours)': e.duree_arret_jours || 0,
        'Déclaré 24h': e.declare_24h ? 'Oui' : 'Non',
        'Médecin-chef notifié': e.medecin_chef_notifie ? 'Oui' : 'Non',
        'Statut': e.statut || ''
      }))
      Export.toXLSX(rows, `maladies_accidents_${new Date().toISOString().slice(0,10)}.xlsx`, 'Maladies & Accidents')
    } catch(e) { Toast.show('Erreur lors de l\'export', 'error') }
  },

  /** Exporte les missions de tiers-temps */
  async tiersTemps() {
    const ok = await Export._ensureXLSX()
    if (!ok) { Toast.show('Bibliothèque Excel non disponible', 'error'); return }
    Toast.show('Génération du fichier Excel…', 'info')
    try {
      const data = await API.get('/tiers-temps')
      const typeLabel = {visite_poste:'Visite de poste',etude_ergonomique:'Étude ergonomique',analyse_risques:'Analyse des risques',formation_sst:'Formation SST',enquete_accident:'Enquête accident',investigation_maladie:'Investigation maladie prof.',reunion_chsct:'Réunion CHSCT',campagne_sensibilisation:'Campagne sensibilisation',vaccination:'Vaccination',bilan_collectif:'Bilan collectif',rapport_inspection:'Rapport inspection',consultation_externe:'Consultation externe',autre:'Autre'}
      const rows = data.map(m => ({
        'Date': Utils.formatDate(m.date_mission),
        'Entreprise': m.entreprise_nom || '',
        'Type mission': typeLabel[m.type_mission] || m.type_mission,
        'Durée (heures)': m.duree_heures || 0,
        'Description': m.description || '',
        'Participants': m.participants || '',
        'Résultats': m.resultats || '',
        'Recommandations': m.recommandations || ''
      }))
      Export.toXLSX(rows, `tiers_temps_${new Date().toISOString().slice(0,10)}.xlsx`, 'Tiers-Temps')
    } catch(e) { Toast.show('Erreur lors de l\'export', 'error') }
  },

  /** Exporte les consultations */
  async consultations() {
    const ok = await Export._ensureXLSX()
    if (!ok) { Toast.show('Bibliothèque Excel non disponible', 'error'); return }
    Toast.show('Génération du fichier Excel…', 'info')
    try {
      const data = await API.get('/consultations')
      const rows = data.map(c => ({
        'Date': Utils.formatDateTime(c.date_consultation),
        'Nom': c.nom || '',
        'Prénom': c.prenom || '',
        'Entreprise': c.entreprise || '',
        'Motif': c.motif || '',
        'Diagnostic': c.diagnostic || '',
        'Prescriptions': c.prescriptions || '',
        'Praticien': c.praticien_prenom ? c.praticien_prenom + ' ' + c.praticien_nom : '',
        'Arrêt travail (jours)': c.arret_travail_jours || 0
      }))
      Export.toXLSX(rows, `consultations_${new Date().toISOString().slice(0,10)}.xlsx`, 'Consultations')
    } catch(e) { Toast.show('Erreur lors de l\'export', 'error') }
  }
}

// ============================================================
// AUTH
// ============================================================
const Auth = {
  render() {
    document.getElementById('app').innerHTML = `
      <div class="login-bg">
        <div class="login-card">
          <div class="login-logo">
            <div class="logo-icon"><i class="fas fa-heartbeat"></i></div>
            <h1>SanteTravail<span style="color:#FF8C00">.CI</span></h1>
            <p>Gestion Médicale du Travail en Côte d'Ivoire</p>
          </div>
          <form id="login-form">
            <div class="form-group">
              <label class="form-label"><i class="fas fa-envelope mr-1"></i> Adresse Email</label>
              <input type="email" id="login-email" class="form-input" placeholder="email@santetravail.ci" required>
            </div>
            <div class="form-group">
              <label class="form-label"><i class="fas fa-lock mr-1"></i> Mot de passe</label>
              <div class="search-box">
                <input type="password" id="login-password" class="form-input" placeholder="••••••••" required>
              </div>
            </div>
            <div id="login-error" class="text-red-600 text-sm mb-3 hidden"></div>
            <button type="submit" class="btn btn-primary w-full justify-center" style="width:100%">
              <i class="fas fa-sign-in-alt"></i> Se connecter
            </button>
          </form>
        </div>
      </div>
    `
    document.getElementById('login-form').addEventListener('submit', Auth.handleLogin)
  },
  async handleLogin(e) {
    e.preventDefault()
    const email = document.getElementById('login-email').value
    const password = document.getElementById('login-password').value
    const btn = e.target.querySelector('button[type="submit"]')
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connexion...'
    try {
      const res = await API.post('/auth/login', { email, password })
      State.user = res.user
      localStorage.setItem('st_user', JSON.stringify(res.user))
      if (res.token) localStorage.setItem('st_token', res.token)
      App.render()
    } catch(err) {
      const errDiv = document.getElementById('login-error')
      errDiv.textContent = 'Email ou mot de passe incorrect'
      errDiv.classList.remove('hidden')
      btn.disabled = false; btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Se connecter'
    }
  },
  logout() {
    const token = localStorage.getItem('st_token')
    if (token) API.post('/auth/logout', {}).catch(() => {})
    State.user = null
    localStorage.removeItem('st_user')
    localStorage.removeItem('st_token')
    Auth.render()
  }
}

// ============================================================
// APP LAYOUT
// ============================================================
const App = {
  render() {
    const roleIcon = { admin: 'fas fa-shield-alt', medecin: 'fas fa-user-md', infirmier: 'fas fa-user-nurse' }
    document.getElementById('app').innerHTML = `
      <!-- Sidebar -->
      <aside class="sidebar" id="sidebar">
        <div class="sidebar-header">
          <div class="sidebar-logo">
            <div class="logo-icon"><i class="fas fa-heartbeat"></i></div>
            <div>
              <h2>SanteTravail<span style="color:#FF8C00">.CI</span></h2>
              <span>Médecine du Travail</span>
            </div>
          </div>
        </div>
        <div class="sidebar-user">
          <div style="display:flex;align-items:center;gap:0.65rem">
            <div class="user-avatar"><i class="${roleIcon[State.user?.role] || 'fas fa-user'}"></i></div>
            <div style="min-width:0;flex:1">
              <div style="font-size:0.8rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${Utils.escape(State.user?.prenom)} ${Utils.escape(State.user?.nom)}</div>
              <div style="font-size:0.68rem;color:rgba(255,255,255,0.4);margin-top:1px">${Utils.escape(State.user?.specialite || State.user?.role)}</div>
            </div>
            <div style="width:7px;height:7px;background:#10b981;border-radius:50%;flex-shrink:0" title="En ligne"></div>
          </div>
        </div>
        <nav class="sidebar-nav">
          <div class="nav-section">Navigation</div>
          <div class="nav-item ${State.currentPage === 'dashboard' ? 'active' : ''}" onclick="App.navigate('dashboard')">
            <i class="fas fa-tachometer-alt"></i><span>Tableau de bord</span>
          </div>
          <div class="nav-item ${State.currentPage === 'travailleurs' ? 'active' : ''}" onclick="App.navigate('travailleurs')">
            <i class="fas fa-users"></i><span>Travailleurs</span>
          </div>
          <div class="nav-item ${State.currentPage === 'visites' ? 'active' : ''}" onclick="App.navigate('visites')">
            <i class="fas fa-calendar-check"></i><span>Visites Médicales</span>
          </div>
          <div class="nav-item ${State.currentPage === 'consultations' ? 'active' : ''}" onclick="App.navigate('consultations')">
            <i class="fas fa-stethoscope"></i><span>Consultations</span>
          </div>
          <div class="nav-item ${State.currentPage === 'calendrier' ? 'active' : ''}" onclick="App.navigate('calendrier')">
            <i class="fas fa-calendar-alt"></i><span>Calendrier</span>
          </div>
          <div class="nav-section">📋 Décret N°2026-206</div>
          <div class="nav-item ${State.currentPage === 'registre' ? 'active' : ''}" onclick="App.navigate('registre')">
            <i class="fas fa-book-medical"></i><span>Registre Journalier</span>
            <small style="font-size:0.6rem;opacity:0.6">Art.7/29</small>
          </div>
          <div class="nav-item ${State.currentPage === 'certificats' ? 'active' : ''}" onclick="App.navigate('certificats')">
            <i class="fas fa-file-medical-alt"></i><span>Certificats Aptitude</span>
            <small style="font-size:0.6rem;opacity:0.6">Art.25-28</small>
          </div>
          <div class="nav-item ${State.currentPage === 'tiers-temps' ? 'active' : ''}" onclick="App.navigate('tiers-temps')">
            <i class="fas fa-hard-hat"></i><span>Tiers-Temps Technique</span>
            <small style="font-size:0.6rem;opacity:0.6">Art.6/14</small>
          </div>
          <div class="nav-item ${State.currentPage === 'maladies' ? 'active' : ''}" onclick="App.navigate('maladies')">
            <i class="fas fa-virus"></i><span>Maladies &amp; Accidents</span>
            <small style="font-size:0.6rem;opacity:0.6">Art.11/30</small>
          </div>
          <div class="nav-item ${State.currentPage === 'fiche-entreprise' ? 'active' : ''}" onclick="App.navigate('fiche-entreprise')">
            <i class="fas fa-industry"></i><span>Fiches Risques</span>
            <small style="font-size:0.6rem;opacity:0.6">Art.12/14</small>
          </div>
          <div class="nav-item ${State.currentPage === 'rapports' ? 'active' : ''}" onclick="App.navigate('rapports')">
            <i class="fas fa-chart-bar"></i><span>Rapports Annuels</span>
            <small style="font-size:0.6rem;opacity:0.6">Art.30.1</small>
          </div>
          <div class="nav-item ${State.currentPage === 'comptes-rendus' ? 'active' : ''}" onclick="App.navigate('comptes-rendus')">
            <i class="fas fa-clipboard-list"></i><span>Comptes-Rendus Trim.</span>
            <small style="font-size:0.6rem;opacity:0.6">Art.30.2</small>
          </div>
          <div class="nav-section">Administration</div>
          <div class="nav-item ${State.currentPage === 'entreprises' ? 'active' : ''}" onclick="App.navigate('entreprises')">
            <i class="fas fa-building"></i><span>Entreprises</span>
          </div>
          <div class="nav-item ${State.currentPage === 'alertes' ? 'active' : ''}" onclick="App.navigate('alertes')">
            <i class="fas fa-bell"></i><span>Alertes</span>
            <span class="nav-badge" id="alertes-badge">0</span>
          </div>
          ${State.user?.role === 'admin' ? `
          <div class="nav-item ${State.currentPage === 'utilisateurs' ? 'active' : ''}" onclick="App.navigate('utilisateurs')">
            <i class="fas fa-user-cog"></i><span>Utilisateurs</span>
          </div>` : ''}
        </nav>
        <!-- Banner bas sidebar -->
        <div class="sidebar-bottom-banner">
          <div class="banner-icon">🏥</div>
          <div style="font-weight:700;font-size:0.8rem;margin-bottom:0.2rem">SanteTravail.CI</div>
          <p>Médecine du travail — Décret N°2026-206</p>
        </div>
        <!-- Déconnexion -->
        <div style="padding:0.5rem 0.75rem 1rem">
          <div class="nav-item" onclick="Auth.logout()" style="color:rgba(255,255,255,0.4)">
            <i class="fas fa-sign-out-alt"></i><span>Déconnexion</span>
          </div>
        </div>
      </aside>
      <!-- Main -->
      <div class="main-layout">
        <header class="topbar">
          <div style="display:flex;align-items:center;gap:0.875rem">
            <button class="topbar-icon-btn" onclick="App.toggleSidebar()" id="menu-btn" style="display:none">
              <i class="fas fa-bars"></i>
            </button>
            <div class="topbar-title" id="topbar-page-title">
              <i class="fas fa-tachometer-alt" style="color:#185EF0"></i>
              Tableau de bord
              <small>${new Date().toLocaleDateString('fr-FR', {weekday:'long',day:'numeric',month:'long'})}</small>
            </div>
          </div>
          <div class="topbar-actions">
            <!-- Search -->
            <div class="search-box" style="width:240px">
              <i class="fas fa-search"></i>
              <input type="text" id="global-search" class="form-input" placeholder="Rechercher..." style="padding-left:2.25rem;height:36px;font-size:0.82rem;border-radius:10px;background:#f4f7fc;border-color:#eef0f5" oninput="App.handleSearch(this.value)">
            </div>
            <!-- Notif bell -->
            <div class="topbar-icon-btn" onclick="App.navigate('alertes')" title="Alertes">
              <i class="fas fa-bell"></i>
              <span class="notif-dot" id="notif-dot" style="display:none"></span>
            </div>
            <!-- User chip -->
            <div class="topbar-user" onclick="App.navigate('utilisateurs')">
              <div class="topbar-user-avatar">${(State.user?.prenom||'U')[0]}${(State.user?.nom||'')[0]}</div>
              <div style="font-size:0.78rem">
                <div style="font-weight:600;color:#111827;line-height:1.2">${Utils.escape(State.user?.prenom)}</div>
                <div style="color:#9ca3af;font-size:0.68rem">${Utils.escape(State.user?.role)}</div>
              </div>
            </div>
          </div>
        </header>
        <!-- Search Results Dropdown -->
        <div id="search-results" class="card" style="position:fixed;top:62px;left:295px;width:360px;z-index:200;display:none;max-height:300px;overflow-y:auto"></div>
        <main class="content" id="page-content">
          <div class="empty-state"><div class="spinner mx-auto"></div></div>
        </main>
      </div>
    `
    App.loadPage()
    App.loadAlertesCount()
  },
  toggleSidebar() {
    const sidebar = document.getElementById('sidebar')
    sidebar.classList.toggle('open')
    let backdrop = document.getElementById('sidebar-backdrop')
    if (sidebar.classList.contains('open')) {
      if (!backdrop) {
        backdrop = document.createElement('div')
        backdrop.id = 'sidebar-backdrop'
        backdrop.className = 'sidebar-backdrop'
        backdrop.onclick = () => App.closeSidebar()
        document.body.appendChild(backdrop)
      }
    } else if (backdrop) {
      backdrop.remove()
    }
  },
  closeSidebar() {
    const sidebar = document.getElementById('sidebar')
    if (sidebar) sidebar.classList.remove('open')
    const backdrop = document.getElementById('sidebar-backdrop')
    if (backdrop) backdrop.remove()
  },
  async loadAlertesCount() {
    try {
      const alertes = await API.get('/alertes')
      const count = alertes.length
      const badge = document.getElementById('alertes-badge')
      const dot   = document.getElementById('notif-dot')
      if (badge) badge.textContent = count
      if (dot)   dot.style.display = count > 0 ? 'block' : 'none'
    } catch {}
  },
  navigate(page, params = {}) {
    State.currentPage = page
    State.currentParams = params
    // Sur mobile : referme la sidebar après le choix d'une page
    if (window.innerWidth <= 768) App.closeSidebar()
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'))
    document.querySelectorAll(`.nav-item`).forEach(el => { if (el.getAttribute('onclick')?.includes(page)) el.classList.add('active') })
    // Mise à jour titre topbar
    const pageTitles = {
      dashboard: ['fas fa-tachometer-alt','#185EF0','Tableau de bord'],
      travailleurs: ['fas fa-users','#006B3C','Travailleurs'],
      visites: ['fas fa-calendar-check','#10b981','Visites Médicales'],
      consultations: ['fas fa-stethoscope','#3b82f6','Consultations'],
      calendrier: ['fas fa-calendar-alt','#8b5cf6','Calendrier'],
      entreprises: ['fas fa-building','#6b7280','Entreprises'],
      alertes: ['fas fa-bell','#ef4444','Alertes'],
      utilisateurs: ['fas fa-user-cog','#374151','Utilisateurs'],
      registre: ['fas fa-book-medical','#006B3C','Registre Journalier'],
      certificats: ['fas fa-file-medical-alt','#006B3C','Certificats Aptitude'],
      'tiers-temps': ['fas fa-hard-hat','#FF8C00','Tiers-Temps'],
      maladies: ['fas fa-virus','#ef4444','Maladies & Accidents'],
      'fiche-entreprise': ['fas fa-industry','#374151','Fiches Risques'],
      rapports: ['fas fa-chart-bar','#3b82f6','Rapports Annuels'],
      'comptes-rendus': ['fas fa-clipboard-list','#6b7280','Comptes-Rendus'],
    }
    const titleEl = document.getElementById('topbar-page-title')
    if (titleEl && pageTitles[page]) {
      const [icon, color, label] = pageTitles[page]
      titleEl.innerHTML = `<i class="${icon}" style="color:${color}"></i> ${label}`
    }
    App.loadPage()
  },
  async loadPage() {
    const pages = {
      dashboard: Dashboard, travailleurs: Travailleurs, visites: Visites,
      consultations: Consultations, calendrier: Calendrier, entreprises: Entreprises,
      alertes: Alertes, utilisateurs: Utilisateurs,
      registre: RegistreJournalier, certificats: Certificats,
      'tiers-temps': TiersTemps, maladies: MaladiesAccidents,
      'fiche-entreprise': FicheEntreprise, rapports: RapportsAnnuels,
      'comptes-rendus': ComptesRendus
    }
    const Page = pages[State.currentPage]
    if (Page) await Page.render()
  },
  async handleSearch(q) {
    const dropdown = document.getElementById('search-results')
    if (q.length < 2) { dropdown.style.display = 'none'; return }
    try {
      const results = await API.get(`/recherche?q=${encodeURIComponent(q)}`)
      if (results.length === 0) { dropdown.style.display = 'none'; return }
      dropdown.innerHTML = results.map(r => `
        <div class="p-3 border-b cursor-pointer hover:bg-gray-50" onclick="Travailleurs.viewDossier(${r.id}); document.getElementById('search-results').style.display='none'; document.getElementById('global-search').value=''">
          <div style="font-weight:600;font-size:0.875rem">${Utils.escape(r.prenom)} ${Utils.escape(r.nom)}</div>
          <div style="font-size:0.75rem;color:#6b7280">${Utils.escape(r.poste)} - ${Utils.escape(r.entreprise)} | ${Utils.escape(r.numero_matricule)}</div>
        </div>
      `).join('')
      dropdown.style.display = 'block'
    } catch {}
  }
}

// ============================================================
// DASHBOARD
// ============================================================
const Dashboard = {
  _chartInstance: null,

  async render() {
    document.getElementById('page-content').innerHTML = `<div class="empty-state"><div class="spinner" style="margin:0 auto"></div></div>`

    const [stats, prochaines, alertes] = await Promise.all([
      API.get('/dashboard/stats'),
      API.get('/dashboard/prochaines-visites'),
      API.get('/dashboard/alertes')
    ])
    let certStats = {}, ttStats = {}, rapportsList = []
    try { certStats = (await API.get('/certificats')).reduce((a, c) => { if (c.statut === 'expire') a.expires = (a.expires||0)+1; if (c.conteste) a.contestes = (a.contestes||0)+1; a.total = (a.total||0)+1; return a }, {}) } catch {}
    try { ttStats = await API.get('/tiers-temps/stats') } catch {}
    try { rapportsList = await API.get('/rapports-annuels') } catch {}

    const now     = new Date()
    const dayName = now.toLocaleDateString('fr-FR', { weekday: 'long' })
    const dayStr  = now.toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' })
    const prenom  = Utils.escape(State.user?.prenom || '')

    // Jours semaine pour mini planning
    const weekDays = []
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay() + 1)
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek); d.setDate(startOfWeek.getDate() + i)
      weekDays.push({
        label: d.toLocaleDateString('fr-FR', { weekday: 'short' }).slice(0,3),
        num:   d.getDate(),
        isToday: d.toDateString() === now.toDateString()
      })
    }

    document.getElementById('page-content').innerHTML = `
      <div class="page">

        <!-- ===== WELCOME BANNER ===== -->
        <div class="dash-welcome">
          <div style="position:relative;z-index:1">
            <h2>Bonjour, ${prenom} 👋</h2>
            <p>${Utils.capitalize(dayName)}, ${dayStr}</p>
            <div class="badge-pill">
              <i class="fas fa-calendar-check"></i>
              ${stats.visitesMonth || 0} visite(s) ce mois
            </div>
          </div>
          <i class="fas fa-heartbeat dash-welcome-icon"></i>
        </div>

        <!-- ===== KPI CARDS ===== -->
        <div class="grid-4 mb-4">
          <div class="stat-card green" style="cursor:pointer" onclick="App.navigate('travailleurs')">
            <div style="display:flex;align-items:center;justify-content:space-between">
              <div class="stat-icon"><i class="fas fa-users"></i></div>
              <span class="badge badge-green" style="font-size:0.65rem">Actifs</span>
            </div>
            <div class="stat-value">${stats.totalTravailleurs}</div>
            <div class="stat-label">Travailleurs suivis</div>
            <div class="stat-trend up"><i class="fas fa-arrow-up"></i> Sous suivi médical</div>
          </div>
          <div class="stat-card orange" style="cursor:pointer" onclick="App.navigate('visites')">
            <div style="display:flex;align-items:center;justify-content:space-between">
              <div class="stat-icon"><i class="fas fa-calendar-check"></i></div>
              <span class="badge badge-orange" style="font-size:0.65rem">Ce mois</span>
            </div>
            <div class="stat-value">${stats.visitesMonth}</div>
            <div class="stat-label">Visites médicales</div>
            <div class="stat-trend up"><i class="fas fa-arrow-up"></i> Visites réalisées</div>
          </div>
          <div class="stat-card blue" style="cursor:pointer" onclick="App.navigate('consultations')">
            <div style="display:flex;align-items:center;justify-content:space-between">
              <div class="stat-icon"><i class="fas fa-stethoscope"></i></div>
              <span class="badge badge-blue" style="font-size:0.65rem">Aujourd\'hui</span>
            </div>
            <div class="stat-value">${stats.consultationsAujourdhui}</div>
            <div class="stat-label">Consultations</div>
            <div class="stat-trend up"><i class="fas fa-clock"></i> Journée en cours</div>
          </div>
          <div class="stat-card red" style="cursor:pointer" onclick="App.navigate('alertes')">
            <div style="display:flex;align-items:center;justify-content:space-between">
              <div class="stat-icon"><i class="fas fa-bell"></i></div>
              <span class="badge badge-red" style="font-size:0.65rem">Actives</span>
            </div>
            <div class="stat-value">${stats.alertesActives}</div>
            <div class="stat-label">Alertes en cours</div>
            <div class="stat-trend ${stats.alertesActives > 0 ? 'down' : 'up'}">
              <i class="fas fa-${stats.alertesActives > 0 ? 'exclamation-circle' : 'check-circle'}"></i>
              ${stats.alertesActives > 0 ? 'Nécessitent attention' : 'Aucune alerte'}
            </div>
          </div>
        </div>

        <!-- ===== LIGNE 2 : Graphique + Planning semaine ===== -->
        <div style="display:grid;grid-template-columns:1.7fr 1fr;gap:1.25rem;margin-bottom:1.25rem">

          <!-- Graphique activité mensuelle -->
          <div class="card">
            <div class="card-header">
              <h3><i class="fas fa-chart-bar" style="color:#185EF0"></i> Activité médicale</h3>
              <div style="display:flex;gap:0.5rem;font-size:0.72rem;color:#6b7280">
                <span style="display:flex;align-items:center;gap:0.3rem"><span style="width:10px;height:10px;background:#185EF0;border-radius:2px;display:inline-block"></span>Visites</span>
                <span style="display:flex;align-items:center;gap:0.3rem"><span style="width:10px;height:10px;background:#10b981;border-radius:2px;display:inline-block"></span>Consultations</span>
                <span style="display:flex;align-items:center;gap:0.3rem"><span style="width:10px;height:10px;background:#f59e0b;border-radius:2px;display:inline-block"></span>Alertes</span>
              </div>
            </div>
            <div class="card-body" style="padding:1rem 1.35rem">
              <canvas id="activityChart" height="130"></canvas>
            </div>
          </div>

          <!-- Mini planning semaine -->
          <div class="card">
            <div class="card-header">
              <h3><i class="fas fa-calendar-week" style="color:#8b5cf6"></i> Semaine</h3>
              <button class="btn btn-outline btn-sm" onclick="App.navigate('calendrier')" style="font-size:0.72rem">Calendrier</button>
            </div>
            <div class="card-body" style="padding:0.75rem 1rem">
              <!-- Jours semaine -->
              <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:1rem">
                ${weekDays.map(d => `
                  <div style="text-align:center">
                    <div style="font-size:0.62rem;color:#9ca3af;margin-bottom:3px;text-transform:uppercase">${d.label}</div>
                    <div style="width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto;font-size:0.78rem;font-weight:${d.isToday?'700':'500'};background:${d.isToday?'#185EF0':'transparent'};color:${d.isToday?'white':'#374151'}">${d.num}</div>
                  </div>`).join('')}
              </div>
              <!-- Prochaines visites planning -->
              ${prochaines.slice(0,4).map(v => `
                <div class="schedule-item">
                  <div class="schedule-time">${v.heure_visite || Utils.formatDate(v.date_visite).slice(0,5)}</div>
                  <div class="schedule-dot" style="background:${v.type_visite==='periodique'?'#185EF0':v.type_visite==='embauche'?'#10b981':'#f59e0b'}"></div>
                  <div class="schedule-content">
                    <div class="title">${Utils.escape(v.prenom)} ${Utils.escape(v.nom)}</div>
                    <div class="sub">${Utils.typeVisiteLabel(v.type_visite)||v.type_visite}</div>
                  </div>
                </div>`).join('') || '<div style="text-align:center;padding:1rem;color:#9ca3af;font-size:0.8rem"><i class="fas fa-calendar" style="display:block;font-size:1.5rem;margin-bottom:0.5rem"></i>Aucune visite planifiée</div>'}
            </div>
          </div>
        </div>

        <!-- ===== LIGNE 3 : Alertes + Indicateurs décret + Actions rapides ===== -->
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1.25rem;margin-bottom:1.25rem">

          <!-- Alertes prioritaires -->
          <div class="card">
            <div class="card-header">
              <h3><i class="fas fa-exclamation-triangle" style="color:#f59e0b"></i> Alertes</h3>
              <button class="btn btn-outline btn-sm" onclick="App.navigate('alertes')" style="font-size:0.72rem">Voir tout</button>
            </div>
            <div class="card-body" style="padding:0.5rem 1rem">
              ${alertes.length === 0 ?
                `<div style="text-align:center;padding:1.5rem 0;color:#9ca3af">
                  <i class="fas fa-check-circle" style="font-size:2rem;color:#10b981;display:block;margin-bottom:0.5rem"></i>
                  <span style="font-size:0.82rem">Aucune alerte active</span>
                </div>` :
                alertes.slice(0,5).map(a => `
                  <div class="reminder-item">
                    <span class="reminder-priority ${a.priorite==='urgente'?'rp-high':a.priorite==='haute'?'rp-medium':'rp-low'}">${a.priorite==='urgente'?'Urgent':a.priorite==='haute'?'Haute':'Basse'}</span>
                    <div style="flex:1;min-width:0">
                      <div style="font-size:0.8rem;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${a.prenom?Utils.escape(a.prenom)+' '+Utils.escape(a.nom)+' — ':''}</div>
                      <div style="font-size:0.72rem;color:#6b7280;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${Utils.escape(a.message)}</div>
                    </div>
                    <button onclick="Alertes.traiter(${a.id})" style="background:none;border:none;color:#9ca3af;cursor:pointer;font-size:1rem" title="Traiter">✓</button>
                  </div>`).join('')}
            </div>
          </div>

          <!-- Indicateurs Décret N°2026-206 -->
          <div class="card">
            <div class="card-header">
              <h3><i class="fas fa-gavel" style="color:#006B3C"></i> Décret N°2026-206</h3>
            </div>
            <div class="card-body" style="padding:0.75rem 1rem">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.6rem">
                <div style="background:#f0fdf4;padding:0.75rem;border-radius:10px;text-align:center;cursor:pointer" onclick="App.navigate('certificats')">
                  <div style="font-size:1.5rem;font-weight:800;color:#006B3C">${certStats.total||0}</div>
                  <div style="font-size:0.7rem;color:#4b5563;margin-top:0.1rem"><i class="fas fa-file-medical-alt mr-1"></i>Certificats</div>
                  ${(certStats.expires||0)>0?`<div style="font-size:0.65rem;color:#ef4444;margin-top:0.1rem">${certStats.expires} expirés</div>`:''}
                </div>
                <div style="background:#fff7ed;padding:0.75rem;border-radius:10px;text-align:center;cursor:pointer" onclick="App.navigate('tiers-temps')">
                  <div style="font-size:1.5rem;font-weight:800;color:#FF8C00">${ttStats.total_heures?parseFloat(ttStats.total_heures).toFixed(0):0}h</div>
                  <div style="font-size:0.7rem;color:#4b5563;margin-top:0.1rem"><i class="fas fa-hard-hat mr-1"></i>Tiers-Temps</div>
                  <div style="font-size:0.65rem;color:#6b7280">${ttStats.nb_missions||0} mission(s)</div>
                </div>
                <div style="background:#fef2f2;padding:0.75rem;border-radius:10px;text-align:center;cursor:pointer" onclick="App.navigate('maladies')">
                  <div style="font-size:1.5rem;font-weight:800;color:#ef4444">${certStats.contestes||0}</div>
                  <div style="font-size:0.7rem;color:#4b5563;margin-top:0.1rem"><i class="fas fa-balance-scale mr-1"></i>Contestations</div>
                  <div style="font-size:0.65rem;color:#6b7280">Art.28</div>
                </div>
                <div style="background:#eff6ff;padding:0.75rem;border-radius:10px;text-align:center;cursor:pointer" onclick="App.navigate('rapports')">
                  <div style="font-size:1.5rem;font-weight:800;color:#185EF0">${Array.isArray(rapportsList)?rapportsList.filter(r=>r.statut==='brouillon').length:0}</div>
                  <div style="font-size:0.7rem;color:#4b5563;margin-top:0.1rem"><i class="fas fa-chart-bar mr-1"></i>Rapports</div>
                  <div style="font-size:0.65rem;color:#6b7280">À finaliser</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Actions rapides -->
          <div class="card">
            <div class="card-header">
              <h3><i class="fas fa-bolt" style="color:#FF8C00"></i> Actions rapides</h3>
            </div>
            <div class="card-body" style="padding:0.75rem 1rem;display:flex;flex-direction:column;gap:0.5rem">
              <button class="btn btn-primary" style="justify-content:flex-start;border-radius:10px" onclick="Travailleurs.openModal()">
                <i class="fas fa-user-plus" style="width:18px"></i> Nouveau travailleur
              </button>
              <button class="btn btn-secondary" style="justify-content:flex-start;border-radius:10px" onclick="Visites.openModal()">
                <i class="fas fa-calendar-plus" style="width:18px"></i> Planifier une visite
              </button>
              <button class="btn btn-outline" style="justify-content:flex-start;border-radius:10px" onclick="Consultations.openModal()">
                <i class="fas fa-stethoscope" style="width:18px"></i> Nouvelle consultation
              </button>
              <div style="border-top:1px solid #f3f4f6;margin-top:0.25rem;padding-top:0.5rem;display:grid;grid-template-columns:1fr 1fr;gap:0.4rem">
                <button class="btn btn-outline btn-sm" style="border-radius:8px;font-size:0.75rem" onclick="RegistreJournalier.openModal()">
                  <i class="fas fa-book-medical" style="color:#006B3C"></i> Registre
                </button>
                <button class="btn btn-outline btn-sm" style="border-radius:8px;font-size:0.75rem" onclick="Certificats.openModal()">
                  <i class="fas fa-file-medical-alt" style="color:#10b981"></i> Certificat
                </button>
                <button class="btn btn-outline btn-sm" style="border-radius:8px;font-size:0.75rem" onclick="TiersTemps.openModal()">
                  <i class="fas fa-hard-hat" style="color:#FF8C00"></i> Mission
                </button>
                <button class="btn btn-outline btn-sm" style="border-radius:8px;font-size:0.75rem" onclick="MaladiesAccidents.openModal()">
                  <i class="fas fa-virus" style="color:#ef4444"></i> Maladie
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>
    `

    // ===== CHART.JS — Graphique activité =====
    Dashboard._initChart(stats)
  },

  _initChart(stats) {
    // Charger Chart.js si pas encore présent
    if (typeof Chart === 'undefined') {
      const s = document.createElement('script')
      s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'
      s.onload = () => Dashboard._drawChart(stats)
      document.head.appendChild(s)
    } else {
      Dashboard._drawChart(stats)
    }
  },

  _drawChart(stats) {
    const canvas = document.getElementById('activityChart')
    if (!canvas) return
    if (Dashboard._chartInstance) { Dashboard._chartInstance.destroy(); Dashboard._chartInstance = null }

    const months = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']
    const now = new Date()
    const labels = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      labels.push(months[d.getMonth()])
    }
    // Données simulées basées sur les stats réelles pour le mois courant
    const vm = stats.visitesMonth || 0
    const ca = stats.consultationsAujourdhui || 0
    const aa = stats.alertesActives || 0
    const visData        = [Math.max(1,Math.round(vm*0.5)), Math.max(1,Math.round(vm*0.7)), Math.max(1,Math.round(vm*0.85)), Math.max(1,Math.round(vm*0.9)), Math.max(1,Math.round(vm*0.95)), vm]
    const consultData    = [Math.max(0,Math.round(ca*4)), Math.max(0,Math.round(ca*5)), Math.max(0,Math.round(ca*6)), Math.max(0,Math.round(ca*7)), Math.max(0,Math.round(ca*8)), ca]
    const alertesData    = [Math.max(0,Math.round(aa*0.6)), Math.max(0,Math.round(aa*0.8)), Math.max(0,Math.round(aa*1.1)), Math.max(0,Math.round(aa*0.9)), Math.max(0,Math.round(aa*1.2)), aa]

    Dashboard._chartInstance = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Visites',       data: visData,     backgroundColor: '#185EF0', borderRadius: 6, borderSkipped: false },
          { label: 'Consultations', data: consultData,  backgroundColor: '#10b981', borderRadius: 6, borderSkipped: false },
          { label: 'Alertes',       data: alertesData,  backgroundColor: '#f59e0b', borderRadius: 6, borderSkipped: false }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 11 }, color: '#9ca3af' } },
          y: { grid: { color: '#f3f4f6' }, ticks: { font: { size: 11 }, color: '#9ca3af' }, beginAtZero: true }
        }
      }
    })
  }
}


const ImportTravailleurs = {
  async _ensureXLSX() {
    if (window.XLSX) return true
    return Export._ensureXLSX()
  },

  async downloadTemplate() {
    const ok = await this._ensureXLSX()
    if (!ok) { Toast.show('Bibliothèque Excel non disponible', 'error'); return }
    const rows = [{
      'Matricule': '',
      'Nom': '',
      'Prénom': '',
      'Date naissance': 'YYYY-MM-DD',
      'Sexe': 'M ou F',
      'Poste': '',
      'Entreprise': '',
      'Téléphone': '',
      'Email': '',
      'Adresse': '',
      'Groupe sanguin': '',
      'Date embauche': 'YYYY-MM-DD',
      'Type contrat': 'cdi',
      'Catégorie risque': 'standard',
      'Statut': 'actif'
    }]
    Export.toXLSX(rows, 'travailleurs_template.xlsx', 'Travailleurs')
  },

  async openModal() {
    const existing = document.getElementById('import-travailleurs-modal')
    if (existing) existing.remove()
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="import-travailleurs-modal">
        <div class="modal modal-md">
          <div class="modal-header">
            <h3><i class="fas fa-file-import" style="color:#2563eb"></i> Importer des Travailleurs</h3>
            <button class="btn btn-outline btn-sm btn-icon" onclick="document.getElementById('import-travailleurs-modal').remove()"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Fichier Excel / CSV</label>
              <input type="file" id="import-travailleurs-file" class="form-input" accept=".xlsx,.xls,.csv">
            </div>
            <div class="form-group" style="margin-top:1rem">
              <button class="btn btn-outline btn-sm" type="button" onclick="ImportTravailleurs.downloadTemplate()"><i class="fas fa-download mr-1"></i>Télécharger un modèle</button>
            </div>
            <div style="font-size:0.9rem;color:#6b7280;margin-top:12px">
              Le fichier doit contenir au moins les colonnes « Nom », « Prénom » et « Date naissance ».
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" type="button" onclick="document.getElementById('import-travailleurs-modal').remove()">Annuler</button>
            <button class="btn btn-primary" type="button" onclick="ImportTravailleurs.importFile()"><i class="fas fa-file-upload mr-1"></i>Importer</button>
          </div>
        </div>
      </div>`)
  },

  async importFile() {
    const input = document.getElementById('import-travailleurs-file')
    if (!input || !(input instanceof HTMLInputElement) || !input.files || input.files.length === 0) {
      Toast.show('Sélectionnez un fichier à importer', 'warning')
      return
    }
    const file = input.files[0]
    const ok = await this._ensureXLSX()
    if (!ok) { Toast.show('Bibliothèque Excel non disponible', 'error'); return }
    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })
      if (!rows || rows.length === 0) {
        Toast.show('Fichier vide ou mal formaté', 'error')
        return
      }
      const payload = rows.map(row => ({
        numero_matricule: row['Matricule'] || row['numero_matricule'] || '',
        nom: row['Nom'] || row['nom'] || '',
        prenom: row['Prénom'] || row['prenom'] || '',
        date_naissance: row['Date naissance'] || row['date_naissance'] || row['Date de naissance'] || '',
        sexe: row['Sexe'] || row['sexe'] || '',
        poste: row['Poste'] || row['poste'] || '',
        entreprise: row['Entreprise'] || row['entreprise'] || '',
        telephone: row['Téléphone'] || row['telephone'] || '',
        email: row['Email'] || row['email'] || '',
        adresse: row['Adresse'] || row['adresse'] || '',
        groupe_sanguin: row['Groupe sanguin'] || row['groupe_sanguin'] || '',
        date_embauche: row['Date embauche'] || row['date_embauche'] || '',
        type_contrat: row['Type contrat'] || row['type_contrat'] || 'cdi',
        categorie_risque: row['Catégorie risque'] || row['categorie_risque'] || 'standard',
        statut: row['Statut'] || row['statut'] || 'actif'
      })).filter(r => r.nom && r.prenom && r.date_naissance)
      if (payload.length === 0) {
        Toast.show('Aucune ligne valide trouvée. Vérifiez le modèle.', 'error')
        return
      }
      const res = await API.post('/travailleurs/import', payload)
      Toast.show(`Import réussi : ${res.imported} travailleurs`)
      document.getElementById('import-travailleurs-modal').remove()
      await Travailleurs.render()
    } catch (e) {
      Toast.show(e.response?.data?.error || 'Erreur lors de l\'import', 'error')
    }
  }
}

// ============================================================
// TRAVAILLEURS
// ============================================================
const Travailleurs = {
  current: null,
  async render() {
    document.getElementById('page-content').innerHTML = `<div class="empty-state"><div class="spinner" style="margin:0 auto"></div></div>`
    const [travailleurs, entreprises] = await Promise.all([API.get('/travailleurs'), API.get('/entreprises')])
    State.data.travailleurs = travailleurs
    State.data.entreprises = entreprises
    document.getElementById('page-content').innerHTML = `
      <div class="page">
        <div class="section-header">
          <h2><i class="fas fa-users" style="color:#006B3C"></i> Travailleurs <span style="font-size:0.875rem;font-weight:400;color:#6b7280">(${travailleurs.length})</span></h2>
          <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
            <button class="btn btn-outline btn-sm" onclick="Export.travailleurs()" title="Exporter en Excel"><i class="fas fa-file-excel" style="color:#217346"></i> Excel</button>
            <button class="btn btn-outline btn-sm" onclick="ImportTravailleurs.openModal()" title="Importer des travailleurs"><i class="fas fa-file-import" style="color:#2563eb"></i> Importer</button>
            <button class="btn btn-primary" onclick="Travailleurs.openModal()"><i class="fas fa-user-plus"></i> Nouveau Travailleur</button>
          </div>
        </div>
        <!-- Filtres -->
        <div class="card mb-4">
          <div class="card-body" style="padding:0.875rem">
            <div style="display:flex;gap:0.75rem;align-items:center;flex-wrap:wrap">
              <div class="search-box" style="flex:1;min-width:200px">
                <i class="fas fa-search"></i>
                <input type="text" class="form-input" placeholder="Rechercher (nom, matricule, poste...)" oninput="Travailleurs.filter(this.value)" id="tw-search">
              </div>
              <select class="form-input" style="width:200px" onchange="Travailleurs.filterEntreprise(this.value)" id="tw-ent">
                <option value="">Toutes les entreprises</option>
                ${entreprises.map(e => `<option value="${e.id}">${Utils.escape(e.nom)}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>
        <div id="tw-list">
          ${Travailleurs.renderTable(travailleurs)}
        </div>
      </div>
    `
  },
  renderTable(data) {
    if (data.length === 0) return '<div class="empty-state card"><i class="fas fa-users"></i><h3>Aucun travailleur trouvé</h3><p>Ajoutez votre premier travailleur</p></div>'
    return `
      <div class="card">
        <table class="data-table">
          <thead><tr><th>Travailleur</th><th>Entreprise</th><th>Poste</th><th>Groupe Sanguin</th><th>Statut</th><th>Actions</th></tr></thead>
          <tbody>
            ${data.map(t => `
              <tr>
                <td>
                  <div style="display:flex;align-items:center;gap:0.75rem">
                    <div class="avatar ${Utils.avatarColor(t.id)}">${Utils.getInitials(t.nom, t.prenom)}</div>
                    <div>
                      <div style="font-weight:600">${Utils.escape(t.prenom)} ${Utils.escape(t.nom)}</div>
                      <div style="font-size:0.75rem;color:#6b7280">${Utils.escape(t.numero_matricule)} | ${Utils.formatAge(t.date_naissance)}</div>
                    </div>
                  </div>
                </td>
                <td style="font-size:0.875rem">${Utils.escape(t.entreprise_nom || '-')}</td>
                <td style="font-size:0.875rem">${Utils.escape(t.poste || '-')}</td>
                <td><span class="badge badge-red">${Utils.escape(t.groupe_sanguin || '-')}</span></td>
                <td>${t.statut === 'actif' ? '<span class="badge badge-green">Actif</span>' : '<span class="badge badge-gray">Inactif</span>'}</td>
                <td>
                  <div style="display:flex;gap:0.35rem">
                    <button class="btn btn-outline btn-sm btn-icon" onclick="Travailleurs.viewDossier(${t.id})" title="Dossier médical"><i class="fas fa-folder-open"></i></button>
                    <button class="btn btn-outline btn-sm btn-icon" onclick="Travailleurs.openModal(${t.id})" title="Modifier"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-danger btn-sm btn-icon" onclick="Travailleurs.delete(${t.id}, '${Utils.escape(t.nom)} ${Utils.escape(t.prenom)}')" title="Supprimer"><i class="fas fa-trash"></i></button>
                  </div>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`
  },
  async filter(q) {
    const ent = document.getElementById('tw-ent')?.value || ''
    let url = '/travailleurs?'
    if (q) url += `search=${encodeURIComponent(q)}&`
    if (ent) url += `entreprise_id=${ent}`
    try {
      const data = await API.get(url)
      document.getElementById('tw-list').innerHTML = Travailleurs.renderTable(data)
    } catch {}
  },
  async filterEntreprise(entId) {
    const q = document.getElementById('tw-search')?.value || ''
    let url = '/travailleurs?'
    if (q) url += `search=${encodeURIComponent(q)}&`
    if (entId) url += `entreprise_id=${entId}`
    try {
      const data = await API.get(url)
      document.getElementById('tw-list').innerHTML = Travailleurs.renderTable(data)
    } catch {}
  },
  async viewDossier(id) {
    const [travailleur, dossier] = await Promise.all([API.get(`/travailleurs/${id}`), API.get(`/travailleurs/${id}/dossier`)])
    const sexeLabel = travailleur.sexe === 'M' ? 'Masculin' : 'Féminin'
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="dossier-modal">
        <div class="modal modal-xl">
          <div class="modal-header">
            <h3 style="display:flex;align-items:center;gap:0.75rem">
              <div class="avatar ${Utils.avatarColor(id)}" style="width:40px;height:40px;font-size:1rem">${Utils.getInitials(travailleur.nom, travailleur.prenom)}</div>
              Dossier Médical - ${Utils.escape(travailleur.prenom)} ${Utils.escape(travailleur.nom)}
            </h3>
            <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
              <button class="btn btn-outline btn-sm" onclick="Print.dossier(${id})" title="Imprimer le dossier médical"><i class="fas fa-print"></i> Dossier</button>
              <button class="btn btn-primary btn-sm" onclick="Visites.openModal(null, ${id})"><i class="fas fa-calendar-plus"></i> Visite</button>
              <button class="btn btn-secondary btn-sm" onclick="Consultations.openModal(null, ${id})"><i class="fas fa-stethoscope"></i> Consultation</button>
              <button class="btn btn-outline btn-sm" onclick="Ordonnances.openModal(null,${id},null,null)" style="color:#006B3C;border-color:#006B3C"><i class="fas fa-prescription"></i> Ordonnance</button>
              <button class="btn btn-outline btn-sm" onclick="ExamensPrescrits.openModal(${id})" style="color:#3b82f6;border-color:#3b82f6"><i class="fas fa-microscope"></i> Examens</button>
              <button class="btn btn-outline btn-sm" onclick="AttestationsVIH.openModal(${id})" style="color:#dc2626;border-color:#dc2626"><i class="fas fa-ribbon"></i> Test VIH</button>
              <button class="btn btn-outline btn-sm btn-icon" onclick="document.getElementById('dossier-modal').remove()"><i class="fas fa-times"></i></button>
            </div>
          </div>
          <div class="modal-body">
            <div class="tabs" id="dossier-tabs">
              <button class="tab-btn active" data-tab="profil" onclick="Travailleurs.switchTab('profil', this)"><i class="fas fa-id-card"></i> Profil</button>
              <button class="tab-btn" data-tab="visites" onclick="Travailleurs.switchTab('visites', this)"><i class="fas fa-calendar-check"></i> Visites (${dossier.visites.length})</button>
              <button class="tab-btn" data-tab="consultations" onclick="Travailleurs.switchTab('consultations', this)"><i class="fas fa-stethoscope"></i> Consultations (${dossier.consultations.length})</button>
              <button class="tab-btn" data-tab="constantes" onclick="Travailleurs.switchTab('constantes', this)"><i class="fas fa-heartbeat"></i> Constantes</button>
              <button class="tab-btn" data-tab="ordonnances" onclick="Travailleurs.switchTab('ordonnances', this); Ordonnances.renderForDossier(${id},'tab-ordonnances')"><i class="fas fa-prescription" style="color:#006B3C"></i> Ordonnances</button>
              <button class="tab-btn" data-tab="examens" onclick="Travailleurs.switchTab('examens', this); ExamensPrescrits.renderForDossier(${id},'tab-examens')"><i class="fas fa-microscope" style="color:#3b82f6"></i> Examens</button>
              <button class="tab-btn" data-tab="vih" onclick="Travailleurs.switchTab('vih', this); AttestationsVIH.renderForDossier(${id},'tab-vih')"><i class="fas fa-ribbon" style="color:#dc2626"></i> Test VIH</button>
            </div>
            <!-- Profil Tab -->
            <div id="tab-profil">
              <div class="grid-2 gap-4">
                <div>
                  <div class="dossier-section">
                    <h4><i class="fas fa-user mr-1"></i> Informations Personnelles</h4>
                    <div class="info-row"><span class="info-label">Nom complet</span><span class="info-value">${Utils.escape(travailleur.prenom)} ${Utils.escape(travailleur.nom)}</span></div>
                    <div class="info-row"><span class="info-label">Date de naissance</span><span class="info-value">${Utils.formatDate(travailleur.date_naissance)} (${Utils.formatAge(travailleur.date_naissance)})</span></div>
                    <div class="info-row"><span class="info-label">Sexe</span><span class="info-value">${sexeLabel}</span></div>
                    <div class="info-row"><span class="info-label">Matricule</span><span class="info-value">${Utils.escape(travailleur.numero_matricule || '-')}</span></div>
                    <div class="info-row"><span class="info-label">Téléphone</span><span class="info-value">${Utils.escape(travailleur.telephone || '-')}</span></div>
                    <div class="info-row"><span class="info-label">Email</span><span class="info-value">${Utils.escape(travailleur.email || '-')}</span></div>
                    <div class="info-row"><span class="info-label">Adresse</span><span class="info-value">${Utils.escape(travailleur.adresse || '-')}</span></div>
                  </div>
                  <div class="dossier-section">
                    <h4><i class="fas fa-briefcase mr-1"></i> Informations Professionnelles (Décret 2026-206)</h4>
                    <div class="info-row"><span class="info-label">Entreprise</span><span class="info-value">${Utils.escape(travailleur.entreprise_nom || '-')}</span></div>
                    <div class="info-row"><span class="info-label">Poste</span><span class="info-value">${Utils.escape(travailleur.poste || '-')}</span></div>
                    <div class="info-row"><span class="info-label">Date d'embauche</span><span class="info-value">${Utils.formatDate(travailleur.date_embauche)}</span></div>
                    <div class="info-row"><span class="info-label">Type de contrat (Art.2)</span><span class="info-value"><span class="badge badge-blue" style="font-size:0.75rem">${{cdi:'CDI',cdd:'CDD',saisonnier:'Saisonnier',temporaire:'Temporaire',apprentissage:'Apprentissage',stage:'Stage',independant:'Indépendant'}[travailleur.type_contrat]||travailleur.type_contrat||'CDI'}</span></span></div>
                    <div class="info-row"><span class="info-label">Logé par l'employeur</span><span class="info-value">${travailleur.loge_par_employeur ? '✅ Oui' : 'Non'}</span></div>
                    <div class="info-row"><span class="info-label">Catégorie de risque</span><span class="info-value"><span class="badge ${travailleur.categorie_risque==='tres_eleve'?'badge-red':travailleur.categorie_risque==='eleve'?'badge-orange':'badge-green'}" style="font-size:0.75rem">${{standard:'Standard',eleve:'Élevé',tres_eleve:'Très élevé'}[travailleur.categorie_risque]||'Standard'}</span></span></div>
                    <div class="info-row"><span class="info-label">Fréquence visite (mois)</span><span class="info-value">Tous les ${travailleur.frequence_visite_mois||12} mois</span></div>
                  </div>
                </div>
                <div>
                  <div class="dossier-section">
                    <h4><i class="fas fa-heartbeat mr-1"></i> Données Médicales</h4>
                    <div class="info-row"><span class="info-label">Groupe sanguin</span><span class="info-value"><span class="badge badge-red">${Utils.escape(travailleur.groupe_sanguin || '-')}</span></span></div>
                    <div class="info-row"><span class="info-label">Allergies</span><span class="info-value">${Utils.escape(travailleur.allergies || 'Aucune connue')}</span></div>
                    <div class="info-row"><span class="info-label">Antécédents perso.</span><span class="info-value">${Utils.escape(travailleur.antecedents_personnels || 'Aucun')}</span></div>
                    <div class="info-row"><span class="info-label">Antécédents familiaux</span><span class="info-value">${Utils.escape(travailleur.antecedents_familiaux || 'Aucun')}</span></div>
                    <div class="info-row"><span class="info-label">Traitement en cours</span><span class="info-value">${Utils.escape(travailleur.traitement_en_cours || 'Aucun')}</span></div>
                  </div>
                  ${travailleur.derniereVisite ? `
                  <div class="dossier-section">
                    <h4><i class="fas fa-clipboard-check mr-1"></i> Dernière Visite Médicale</h4>
                    <div class="info-row"><span class="info-label">Date</span><span class="info-value">${Utils.formatDate(travailleur.derniereVisite.date_visite)}</span></div>
                    <div class="info-row"><span class="info-label">Type</span><span class="info-value">${Utils.typeVisiteBadge(travailleur.derniereVisite.type_visite)}</span></div>
                    <div class="info-row"><span class="info-label">Aptitude</span><span class="info-value">${Utils.aptitudeBadge(travailleur.derniereVisite.aptitude)}</span></div>
                    ${travailleur.derniereVisite.prochaine_visite ? `<div class="info-row"><span class="info-label">Prochaine visite</span><span class="info-value">${Utils.formatDate(travailleur.derniereVisite.prochaine_visite)}</span></div>` : ''}
                  </div>` : ''}
                </div>
              </div>
            </div>
            <!-- Visites Tab -->
            <div id="tab-visites" style="display:none">
              ${dossier.visites.length === 0 ? '<div class="empty-state"><i class="fas fa-calendar"></i><h3>Aucune visite enregistrée</h3></div>' :
              `<div class="timeline">
                ${dossier.visites.map(v => `
                  <div class="timeline-item">
                    <div class="timeline-dot ${v.statut === 'realisee' ? 'green' : v.statut === 'annulee' ? 'red' : 'blue'}"></div>
                    <div class="timeline-content">
                      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:0.5rem">
                        <div>${Utils.typeVisiteBadge(v.type_visite)} ${Utils.statutVisiteBadge(v.statut)}</div>
                        <span style="font-size:0.75rem;color:#6b7280">${Utils.formatDate(v.date_visite)}</span>
                      </div>
                      ${v.aptitude ? `<div style="margin-bottom:0.3rem">${Utils.aptitudeBadge(v.aptitude)}</div>` : ''}
                      ${v.conclusions ? `<p style="font-size:0.8rem;color:#374151;margin:0.25rem 0 0">${Utils.escape(v.conclusions)}</p>` : ''}
                      <div style="font-size:0.75rem;color:#9ca3af;margin-top:0.3rem">Dr. ${Utils.escape(v.medecin_prenom || '')} ${Utils.escape(v.medecin_nom || 'N/A')}</div>
                      ${v.statut === 'realisee' ? `
                      <div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.5rem">
                        ${v.aptitude ? `<button class="btn btn-outline btn-sm" onclick="Print.attestationAptitude(${v.id})" style="font-size:0.72rem;padding:2px 8px"><i class="fas fa-certificate mr-1" style="color:#006B3C"></i>Attestation aptitude</button>` : ''}
                        <button class="btn btn-outline btn-sm" onclick="Print.visite(${v.id})" style="font-size:0.72rem;padding:2px 8px"><i class="fas fa-print mr-1"></i>Fiche visite</button>
                        <button class="btn btn-outline btn-sm" onclick="Ordonnances.openModal(${v.id},${v.travailleur_id},null,null)" style="font-size:0.72rem;padding:2px 8px;color:#006B3C;border-color:#006B3C"><i class="fas fa-prescription mr-1"></i>Ordonnance</button>
                        <button class="btn btn-outline btn-sm" onclick="ExamensPrescrits.openModal(${v.travailleur_id},${v.id})" style="font-size:0.72rem;padding:2px 8px;color:#3b82f6;border-color:#3b82f6"><i class="fas fa-microscope mr-1"></i>Examens</button>
                        <button class="btn btn-outline btn-sm" onclick="AttestationsVIH.openModal(${v.travailleur_id},${v.id})" style="font-size:0.72rem;padding:2px 8px;color:#dc2626;border-color:#dc2626"><i class="fas fa-ribbon mr-1"></i>Test VIH</button>
                      </div>` : ''}
                    </div>
                  </div>`).join('')}
              </div>`}
            </div>
            <!-- Consultations Tab -->
            <div id="tab-consultations" style="display:none">
              ${dossier.consultations.length === 0 ? '<div class="empty-state"><i class="fas fa-stethoscope"></i><h3>Aucune consultation enregistrée</h3></div>' :
              `<div class="timeline">
                ${dossier.consultations.map(c => `
                  <div class="timeline-item">
                    <div class="timeline-dot blue"></div>
                    <div class="timeline-content">
                      <div style="display:flex;justify-content:space-between;margin-bottom:0.5rem">
                        <span style="font-weight:600;font-size:0.875rem">${Utils.escape(c.motif)}</span>
                        <span style="font-size:0.75rem;color:#6b7280">${Utils.formatDateTime(c.date_consultation)}</span>
                      </div>
                      ${c.diagnostic ? `<div style="font-size:0.8rem;margin-bottom:0.25rem"><strong>Diagnostic:</strong> ${Utils.escape(c.diagnostic)}</div>` : ''}
                      ${c.prescriptions ? `<div style="font-size:0.8rem;color:#374151"><strong>Prescriptions:</strong> ${Utils.escape(c.prescriptions)}</div>` : ''}
                      ${c.arret_travail_jours > 0 ? `<span class="badge badge-orange mt-1"><i class="fas fa-bed"></i> Arrêt ${c.arret_travail_jours} jour(s)</span>` : ''}
                      <div style="font-size:0.75rem;color:#9ca3af;margin-top:0.3rem">${Utils.escape(c.praticien_prenom || '')} ${Utils.escape(c.praticien_nom || 'N/A')}</div>
                    </div>
                  </div>`).join('')}
              </div>`}
            </div>
            <!-- Constantes Tab -->
            <div id="tab-constantes" style="display:none">
              ${dossier.constantes.length === 0 ? '<div class="empty-state"><i class="fas fa-heartbeat"></i><h3>Aucune constante enregistrée</h3></div>' :
              `<div>
                ${dossier.constantes.slice(0, 3).map(c => `
                  <div class="card mb-3">
                    <div class="card-header"><h3 style="font-size:0.8rem"><i class="fas fa-clock mr-1"></i> ${Utils.formatDateTime(c.date_mesure)}</h3></div>
                    <div class="card-body">
                      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:0.75rem">
                        ${c.tension_systolique ? `<div class="vitals-item"><div class="vitals-value">${c.tension_systolique}/${c.tension_diastolique}</div><div class="vitals-unit">mmHg</div><div class="vitals-label">Tension</div>${Utils.tenionStatus(c.tension_systolique, c.tension_diastolique)}</div>` : ''}
                        ${c.frequence_cardiaque ? `<div class="vitals-item"><div class="vitals-value">${c.frequence_cardiaque}</div><div class="vitals-unit">bpm</div><div class="vitals-label">FC</div></div>` : ''}
                        ${c.poids ? `<div class="vitals-item"><div class="vitals-value">${c.poids}</div><div class="vitals-unit">kg</div><div class="vitals-label">Poids</div></div>` : ''}
                        ${c.taille ? `<div class="vitals-item"><div class="vitals-value">${c.taille}</div><div class="vitals-unit">cm</div><div class="vitals-label">Taille</div></div>` : ''}
                        ${c.imc ? `<div class="vitals-item"><div class="vitals-value">${c.imc}</div><div class="vitals-unit">kg/m²</div><div class="vitals-label">IMC</div>${Utils.imcStatus(c.imc)}</div>` : ''}
                        ${c.temperature ? `<div class="vitals-item"><div class="vitals-value">${c.temperature}</div><div class="vitals-unit">°C</div><div class="vitals-label">Température</div></div>` : ''}
                        ${c.saturation_oxygene ? `<div class="vitals-item"><div class="vitals-value">${c.saturation_oxygene}</div><div class="vitals-unit">%</div><div class="vitals-label">SpO2</div></div>` : ''}
                        ${c.glycemie ? `<div class="vitals-item"><div class="vitals-value">${c.glycemie}</div><div class="vitals-unit">g/L</div><div class="vitals-label">Glycémie</div></div>` : ''}
                      </div>
                    </div>
                  </div>`).join('')}
              </div>`}
            </div>
            <!-- Ordonnances Tab -->
            <div id="tab-ordonnances" style="display:none">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                <h4 style="margin:0"><i class="fas fa-prescription mr-1" style="color:#006B3C"></i> Ordonnances Médicales</h4>
                <button class="btn btn-primary btn-sm" onclick="Ordonnances.openModal(null,${id},null,null)">
                  <i class="fas fa-plus mr-1"></i>Nouvelle ordonnance
                </button>
              </div>
              <div id="ord-loading" class="empty-state"><div class="spinner" style="margin:0 auto"></div></div>
            </div>
            <!-- Examens Tab -->
            <div id="tab-examens" style="display:none">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                <h4 style="margin:0"><i class="fas fa-microscope mr-1" style="color:#3b82f6"></i> Examens Complémentaires</h4>
                <button class="btn btn-primary btn-sm" onclick="ExamensPrescrits.openModal(${id})">
                  <i class="fas fa-plus mr-1"></i>Prescrire des examens
                </button>
              </div>
              <div id="exam-loading" class="empty-state"><div class="spinner" style="margin:0 auto"></div></div>
            </div>
            <!-- Test VIH Tab -->
            <div id="tab-vih" style="display:none">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                <h4 style="margin:0"><i class="fas fa-ribbon mr-1" style="color:#dc2626"></i> Attestations de Dépistage VIH/SIDA</h4>
                <button class="btn btn-primary btn-sm" style="background:#dc2626;border-color:#dc2626" onclick="AttestationsVIH.openModal(${id})">
                  <i class="fas fa-plus mr-1"></i>Nouveau dépistage
                </button>
              </div>
              <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:6px;padding:8px 12px;margin-bottom:12px;font-size:0.78rem;color:#9a3412">
                <i class="fas fa-lock mr-1"></i>
                <strong>Confidentialité :</strong> Les résultats des tests ne sont jamais enregistrés. Seule la réalisation du dépistage est attestée.
              </div>
              <div id="vih-loading" class="empty-state"><div class="spinner" style="margin:0 auto"></div></div>
            </div>
          </div>
        </div>
      </div>
    `)
  },
  switchTab(tab, btn) {
    document.querySelectorAll('#dossier-tabs .tab-btn').forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
    document.querySelectorAll('[id^="tab-"]').forEach(el => el.style.display = 'none')
    document.getElementById(`tab-${tab}`).style.display = 'block'
  },
  openModal(id = null, prefillData = null) {
    const entreprises = State.data.entreprises
    let data = prefillData || { sexe: 'M', statut: 'actif' }
    
    const html = `
      <div class="modal-overlay" id="tw-modal">
        <div class="modal modal-lg">
          <div class="modal-header">
            <h3><i class="fas fa-${id ? 'edit' : 'user-plus'}" style="color:#006B3C"></i> ${id ? 'Modifier' : 'Nouveau'} Travailleur</h3>
            <button class="btn btn-outline btn-sm btn-icon" onclick="document.getElementById('tw-modal').remove()"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body">
            <div class="tabs mb-4">
              <button class="tab-btn active" onclick="this.parentElement.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));this.classList.add('active');document.getElementById('tw-tab1').style.display='block';document.getElementById('tw-tab2').style.display='none';document.getElementById('tw-tab3').style.display='none'"><i class="fas fa-user"></i> Identité</button>
              <button class="tab-btn" onclick="this.parentElement.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));this.classList.add('active');document.getElementById('tw-tab1').style.display='none';document.getElementById('tw-tab2').style.display='block';document.getElementById('tw-tab3').style.display='none'"><i class="fas fa-briefcase"></i> Emploi</button>
              <button class="tab-btn" onclick="this.parentElement.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));this.classList.add('active');document.getElementById('tw-tab1').style.display='none';document.getElementById('tw-tab2').style.display='none';document.getElementById('tw-tab3').style.display='block'"><i class="fas fa-heartbeat"></i> Médical</button>
            </div>
            <form id="tw-form">
              <div id="tw-tab1">
                <div class="grid-2">
                  <div class="form-group"><label class="form-label">Nom *</label><input class="form-input" name="nom" value="${Utils.escape(data.nom || '')}" required></div>
                  <div class="form-group"><label class="form-label">Prénom *</label><input class="form-input" name="prenom" value="${Utils.escape(data.prenom || '')}" required></div>
                  <div class="form-group"><label class="form-label">Date de naissance *</label><input type="date" class="form-input" name="date_naissance" value="${data.date_naissance || ''}" required></div>
                  <div class="form-group"><label class="form-label">Sexe</label><select class="form-input" name="sexe"><option value="M" ${data.sexe === 'M' ? 'selected' : ''}>Masculin</option><option value="F" ${data.sexe === 'F' ? 'selected' : ''}>Féminin</option></select></div>
                  <div class="form-group"><label class="form-label">Téléphone</label><input class="form-input" name="telephone" value="${Utils.escape(data.telephone || '')}" placeholder="+225 07..."></div>
                  <div class="form-group"><label class="form-label">Email</label><input type="email" class="form-input" name="email" value="${Utils.escape(data.email || '')}"></div>
                </div>
                <div class="form-group"><label class="form-label">Adresse</label><input class="form-input" name="adresse" value="${Utils.escape(data.adresse || '')}"></div>
              </div>
              <div id="tw-tab2" style="display:none">
                <div style="background:#f0fdf4;padding:0.5rem 0.75rem;border-radius:6px;margin-bottom:0.75rem;font-size:0.75rem;color:#166534">
                  <i class="fas fa-gavel mr-1"></i>Champs requis par le Décret N°2026-206 (Art. 2 — Définitions des types de travailleurs)
                </div>
                <div class="grid-2">
                  <div class="form-group"><label class="form-label">Matricule</label><input class="form-input" name="numero_matricule" value="${Utils.escape(data.numero_matricule || '')}" placeholder="EX: SAR-001"></div>
                  <div class="form-group"><label class="form-label">Poste</label><input class="form-input" name="poste" value="${Utils.escape(data.poste || '')}"></div>
                  <div class="form-group"><label class="form-label">Entreprise</label>
                    <select class="form-input" name="entreprise_id">
                      <option value="">-- Sélectionner --</option>
                      ${entreprises.map(e => `<option value="${e.id}" ${data.entreprise_id == e.id ? 'selected' : ''}>${Utils.escape(e.nom)}</option>`).join('')}
                    </select>
                  </div>
                  <div class="form-group"><label class="form-label">Date d'embauche</label><input type="date" class="form-input" name="date_embauche" value="${data.date_embauche || ''}"></div>
                  <div class="form-group"><label class="form-label">Type de contrat (Art. 2) *</label>
                    <select class="form-input" name="type_contrat">
                      <option value="cdi" ${data.type_contrat==='cdi'?'selected':''}>CDI — Durée Indéterminée</option>
                      <option value="cdd" ${data.type_contrat==='cdd'?'selected':''}>CDD — Durée Déterminée</option>
                      <option value="saisonnier" ${data.type_contrat==='saisonnier'?'selected':''}>Saisonnier</option>
                      <option value="temporaire" ${data.type_contrat==='temporaire'?'selected':''}>Temporaire / Intérimaire</option>
                      <option value="apprentissage" ${data.type_contrat==='apprentissage'?'selected':''}>Apprentissage</option>
                      <option value="stage" ${data.type_contrat==='stage'?'selected':''}>Stage</option>
                      <option value="independant" ${data.type_contrat==='independant'?'selected':''}>Indépendant</option>
                    </select>
                  </div>
                  <div class="form-group"><label class="form-label">Catégorie de risque</label>
                    <select class="form-input" name="categorie_risque">
                      <option value="standard" ${data.categorie_risque==='standard'?'selected':''}>Standard</option>
                      <option value="eleve" ${data.categorie_risque==='eleve'?'selected':''}>Élevé</option>
                      <option value="tres_eleve" ${data.categorie_risque==='tres_eleve'?'selected':''}>Très élevé</option>
                    </select>
                  </div>
                  <div class="form-group"><label class="form-label">Fréquence visite (mois)</label>
                    <select class="form-input" name="frequence_visite_mois">
                      <option value="3" ${data.frequence_visite_mois==3?'selected':''}>Tous les 3 mois</option>
                      <option value="6" ${data.frequence_visite_mois==6?'selected':''}>Tous les 6 mois</option>
                      <option value="12" ${!data.frequence_visite_mois||data.frequence_visite_mois==12?'selected':''}>Tous les 12 mois (annuel)</option>
                      <option value="24" ${data.frequence_visite_mois==24?'selected':''}>Tous les 24 mois</option>
                    </select>
                  </div>
                  <div class="form-group"><label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer"><input type="checkbox" name="loge_par_employeur" value="1" ${data.loge_par_employeur?'checked':''}> Logé par l'employeur</label></div>
                  <div class="form-group"><label class="form-label">Statut</label><select class="form-input" name="statut"><option value="actif" ${data.statut !== 'inactif' ? 'selected' : ''}>Actif</option><option value="suspendu" ${data.statut === 'suspendu' ? 'selected' : ''}>Suspendu</option><option value="inactif" ${data.statut === 'inactif' ? 'selected' : ''}>Inactif</option></select></div>
                </div>
              </div>
              <div id="tw-tab3" style="display:none">
                <div class="grid-2">
                  <div class="form-group"><label class="form-label">Groupe sanguin</label><select class="form-input" name="groupe_sanguin">
                    <option value="">-- Sélectionner --</option>
                    ${['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(g => `<option value="${g}" ${data.groupe_sanguin === g ? 'selected' : ''}>${g}</option>`).join('')}
                  </select></div>
                </div>
                <div class="form-group"><label class="form-label">Allergies connues</label><textarea class="form-input" name="allergies" placeholder="Ex: Pénicilline, poussières...">${Utils.escape(data.allergies || '')}</textarea></div>
                <div class="form-group"><label class="form-label">Antécédents personnels</label><textarea class="form-input" name="antecedents_personnels">${Utils.escape(data.antecedents_personnels || '')}</textarea></div>
                <div class="form-group"><label class="form-label">Antécédents familiaux</label><textarea class="form-input" name="antecedents_familiaux">${Utils.escape(data.antecedents_familiaux || '')}</textarea></div>
                <div class="form-group"><label class="form-label">Traitement en cours</label><textarea class="form-input" name="traitement_en_cours">${Utils.escape(data.traitement_en_cours || '')}</textarea></div>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="document.getElementById('tw-modal').remove()">Annuler</button>
            <button class="btn btn-primary" onclick="Travailleurs.save(${id})"><i class="fas fa-save"></i> Enregistrer</button>
          </div>
        </div>
      </div>
    `
    document.body.insertAdjacentHTML('beforeend', html)
    if (id) Travailleurs.loadForEdit(id)
  },
  async loadForEdit(id) {
    try {
      const t = await API.get(`/travailleurs/${id}`)
      const form = document.getElementById('tw-form')
      Object.entries(t).forEach(([k, v]) => {
        const el = form.querySelector(`[name="${k}"]`)
        if (el && v != null) {
          // Si le champ est un <input type="date">, forcer le format YYYY-MM-DD
          if (el.type === 'date') {
            el.value = Utils.formatDateInput(v)
          } else {
            el.value = v
          }
        }
      })
    } catch {}
  },
  async save(id) {
    const form = document.getElementById('tw-form')
    const formData = new FormData(form)
    const data = Object.fromEntries(formData)
    // Checkbox
    data.loge_par_employeur = form.querySelector('[name="loge_par_employeur"]')?.checked ? 1 : 0
    try {
      if (id) { await API.put(`/travailleurs/${id}`, data); Toast.show('Travailleur modifié avec succès') }
      else { await API.post('/travailleurs', data); Toast.show('Travailleur ajouté avec succès') }
      document.getElementById('tw-modal').remove()
      await Travailleurs.render()
    } catch (e) { Toast.show(e.response?.data?.error || 'Erreur lors de la sauvegarde', 'error') }
  },
  async delete(id, name) {
    if (!confirm(`Désactiver le dossier de ${name} ?`)) return
    try {
      await API.delete(`/travailleurs/${id}`)
      Toast.show('Dossier désactivé')
      await Travailleurs.render()
    } catch { Toast.show('Erreur', 'error') }
  }
}

// ============================================================
// VISITES MÉDICALES
// ============================================================
const Visites = {
  async render() {
    document.getElementById('page-content').innerHTML = `<div class="empty-state"><div class="spinner" style="margin:0 auto"></div></div>`
    const today = new Date()
    const mois = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
    const [visites, travailleurs, users] = await Promise.all([
      API.get(`/visites?mois=${mois}`),
      API.get('/travailleurs'),
      API.get('/users')
    ])
    State.data.travailleurs = travailleurs
    State.data.users = users
    document.getElementById('page-content').innerHTML = `
      <div class="page">
        <div class="section-header">
          <h2><i class="fas fa-calendar-check" style="color:#006B3C"></i> Visites Médicales</h2>
          <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
            <button class="btn btn-outline btn-sm" onclick="Export.visites({mois:document.getElementById('v-mois')?.value,statut:document.getElementById('v-statut')?.value,type:document.getElementById('v-type')?.value})" title="Exporter en Excel"><i class="fas fa-file-excel" style="color:#217346"></i> Excel</button>
            <button class="btn btn-primary" onclick="Visites.openModal()"><i class="fas fa-calendar-plus"></i> Planifier une Visite</button>
          </div>
        </div>
        <!-- Filtres -->
        <div class="card mb-4">
          <div class="card-body" style="padding:0.875rem">
            <div style="display:flex;gap:0.75rem;flex-wrap:wrap">
              <input type="month" class="form-input" style="width:180px" value="${mois}" onchange="Visites.filterMois(this.value)" id="v-mois">
              <select class="form-input" style="width:180px" onchange="Visites.filterStatut(this.value)" id="v-statut">
                <option value="">Tous les statuts</option>
                <option value="planifiee">Planifiée</option>
                <option value="realisee">Réalisée</option>
                <option value="annulee">Annulée</option>
                <option value="reportee">Reportée</option>
              </select>
              <select class="form-input" style="width:180px" onchange="Visites.filterType(this.value)" id="v-type">
                <option value="">Tous les types</option>
                <option value="embauche">Embauche</option>
                <option value="periodique">Périodique</option>
                <option value="reprise">Reprise</option>
                <option value="spontanee">Spontanée</option>
                <option value="pre_reprise">Pré-reprise</option>
              </select>
            </div>
          </div>
        </div>
        <div id="v-list">
          ${Visites.renderTable(visites)}
        </div>
      </div>
    `
  },
  renderTable(data) {
    if (data.length === 0) return '<div class="empty-state card"><i class="fas fa-calendar"></i><h3>Aucune visite trouvée</h3><p>Planifiez votre première visite médicale</p></div>'
    return `
      <div class="card">
        <table class="data-table">
          <thead><tr><th>Travailleur</th><th>Date & Heure</th><th>Type</th><th>Médecin</th><th>Aptitude</th><th>Statut</th><th>Actions</th></tr></thead>
          <tbody>
            ${data.map(v => `
              <tr>
                <td>
                  <div style="font-weight:600">${Utils.escape(v.prenom)} ${Utils.escape(v.nom)}</div>
                  <div style="font-size:0.75rem;color:#6b7280">${Utils.escape(v.poste || '')} | ${Utils.escape(v.entreprise || '')}</div>
                </td>
                <td>
                  <div style="font-weight:500">${Utils.formatDate(v.date_visite)}</div>
                  <div style="font-size:0.75rem;color:#6b7280">${v.heure_visite || ''}</div>
                </td>
                <td>${Utils.typeVisiteBadge(v.type_visite)}</td>
                <td style="font-size:0.875rem">${v.medecin_prenom ? 'Dr. ' + Utils.escape(v.medecin_prenom) + ' ' + Utils.escape(v.medecin_nom) : '-'}</td>
                <td>${Utils.aptitudeBadge(v.aptitude)}</td>
                <td>${Utils.statutVisiteBadge(v.statut)}</td>
                <td>
                  <div style="display:flex;gap:0.35rem">
                    <button class="btn btn-outline btn-sm btn-icon" onclick="Visites.viewVisite(${v.id})" title="Voir"><i class="fas fa-eye"></i></button>
                    <button class="btn btn-outline btn-sm btn-icon" onclick="Print.visite(${v.id})" title="Imprimer la fiche"><i class="fas fa-print"></i></button>
                    <button class="btn btn-outline btn-sm btn-icon" onclick="Visites.openModal(${v.id})" title="Modifier"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-danger btn-sm btn-icon" onclick="Visites.confirmDelete(${v.id}, '${Utils.escape(v.prenom)} ${Utils.escape(v.nom)}')" title="Supprimer"><i class="fas fa-trash"></i></button>
                  </div>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`
  },
  async filterMois(m) {
    const statut = document.getElementById('v-statut')?.value || ''
    const type = document.getElementById('v-type')?.value || ''
    let url = `/visites?mois=${m}${statut ? '&statut=' + statut : ''}${type ? '&type=' + type : ''}`
    const data = await API.get(url)
    document.getElementById('v-list').innerHTML = Visites.renderTable(data)
  },
  async filterStatut(s) {
    const mois = document.getElementById('v-mois')?.value || ''
    const type = document.getElementById('v-type')?.value || ''
    let url = `/visites?${mois ? 'mois=' + mois : ''}${s ? '&statut=' + s : ''}${type ? '&type=' + type : ''}`
    const data = await API.get(url)
    document.getElementById('v-list').innerHTML = Visites.renderTable(data)
  },
  async filterType(t) {
    const mois = document.getElementById('v-mois')?.value || ''
    const statut = document.getElementById('v-statut')?.value || ''
    let url = `/visites?${mois ? 'mois=' + mois : ''}${statut ? '&statut=' + statut : ''}${t ? '&type=' + t : ''}`
    const data = await API.get(url)
    document.getElementById('v-list').innerHTML = Visites.renderTable(data)
  },
  async viewVisite(id) {
    const v = await API.get(`/visites/${id}`)
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="vv-modal">
        <div class="modal modal-md">
          <div class="modal-header">
            <h3><i class="fas fa-clipboard-check" style="color:#006B3C"></i> Détails de la Visite</h3>
            <button class="btn btn-outline btn-sm btn-icon" onclick="document.getElementById('vv-modal').remove()"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body">
            <div style="background:#f0fdf4;border-radius:8px;padding:1rem;margin-bottom:1rem;border:1px solid #bbf7d0">
              <div style="font-size:1.1rem;font-weight:700">${Utils.escape(v.prenom)} ${Utils.escape(v.nom)}</div>
              <div style="font-size:0.8rem;color:#166534">${Utils.escape(v.poste || '')} | ${Utils.escape(v.entreprise || '')}</div>
            </div>
            <div class="info-row"><span class="info-label">Type de visite</span><span class="info-value">${Utils.typeVisiteBadge(v.type_visite)}</span></div>
            <div class="info-row"><span class="info-label">Date</span><span class="info-value">${Utils.formatDate(v.date_visite)} ${v.heure_visite || ''}</span></div>
            <div class="info-row"><span class="info-label">Statut</span><span class="info-value">${Utils.statutVisiteBadge(v.statut)}</span></div>
            <div class="info-row"><span class="info-label">Médecin</span><span class="info-value">${v.medecin_prenom ? 'Dr. ' + Utils.escape(v.medecin_prenom) + ' ' + Utils.escape(v.medecin_nom) : '-'}</span></div>
            ${v.aptitude ? `<div class="info-row"><span class="info-label">Aptitude</span><span class="info-value">${Utils.aptitudeBadge(v.aptitude)}</span></div>` : ''}
            ${v.restrictions ? `<div class="info-row"><span class="info-label">Restrictions</span><span class="info-value">${Utils.escape(v.restrictions)}</span></div>` : ''}
            ${v.motif ? `<div class="info-row"><span class="info-label">Motif</span><span class="info-value">${Utils.escape(v.motif)}</span></div>` : ''}
            ${v.conclusions ? `<div class="form-group mt-3"><label class="form-label">Conclusions</label><div style="background:#f9fafb;padding:0.75rem;border-radius:8px;font-size:0.875rem">${Utils.escape(v.conclusions)}</div></div>` : ''}
            ${v.prochaine_visite ? `<div class="info-row"><span class="info-label">Prochaine visite</span><span class="info-value" style="color:#006B3C;font-weight:600">${Utils.formatDate(v.prochaine_visite)}</span></div>` : ''}
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="document.getElementById('vv-modal').remove()">Fermer</button>
            <button class="btn btn-outline" onclick="Print.visite(${id})" title="Imprimer la fiche visite"><i class="fas fa-print"></i> Imprimer</button>
            <button class="btn btn-primary" onclick="document.getElementById('vv-modal').remove();Visites.openModal(${id})"><i class="fas fa-edit"></i> Modifier</button>
          </div>
        </div>
      </div>
    `)
  },
  openModal(id = null, travailleurId = null) {
    const travailleurs = State.data.travailleurs
    const users = State.data.users
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="vm-modal">
        <div class="modal modal-lg">
          <div class="modal-header">
            <h3><i class="fas fa-calendar-plus" style="color:#006B3C"></i> ${id ? 'Modifier la' : 'Planifier une'} Visite Médicale</h3>
            <button class="btn btn-outline btn-sm btn-icon" onclick="document.getElementById('vm-modal').remove()"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body">
            <form id="vm-form">
              <div class="grid-2">
                <div class="form-group"><label class="form-label">Travailleur *</label>
                  <select class="form-input" name="travailleur_id" required>
                    <option value="">-- Sélectionner un travailleur --</option>
                    ${travailleurs.map(t => `<option value="${t.id}" ${travailleurId == t.id ? 'selected' : ''}>${Utils.escape(t.prenom)} ${Utils.escape(t.nom)} - ${Utils.escape(t.numero_matricule || '')}</option>`).join('')}
                  </select>
                </div>
                <div class="form-group"><label class="form-label">Médecin *</label>
                  <select class="form-input" name="medecin_id">
                    <option value="">-- Sélectionner --</option>
                    ${users.filter(u => u.role === 'medecin' || u.role === 'admin').map(u => `<option value="${u.id}">Dr. ${Utils.escape(u.prenom)} ${Utils.escape(u.nom)}</option>`).join('')}
                  </select>
                </div>
                <div class="form-group"><label class="form-label">Type de visite *</label>
                  <select class="form-input" name="type_visite" required>
                    <option value="embauche">Embauche</option>
                    <option value="periodique" selected>Périodique</option>
                    <option value="reprise">Reprise</option>
                    <option value="spontanee">Spontanée</option>
                    <option value="pre_reprise">Pré-reprise</option>
                  </select>
                </div>
                <div class="form-group"><label class="form-label">Date de visite *</label><input type="date" class="form-input" name="date_visite" required></div>
                <div class="form-group"><label class="form-label">Heure</label><input type="time" class="form-input" name="heure_visite"></div>
                <div class="form-group"><label class="form-label">Statut</label>
                  <select class="form-input" name="statut">
                    <option value="planifiee">Planifiée</option>
                    <option value="realisee">Réalisée</option>
                    <option value="reportee">Reportée</option>
                    <option value="annulee">Annulée</option>
                  </select>
                </div>
                <div class="form-group"><label class="form-label">Aptitude</label>
                  <select class="form-input" name="aptitude">
                    <option value="">-- À définir --</option>
                    <option value="apte">Apte</option>
                    <option value="apte_amenagement">Apte avec aménagement</option>
                    <option value="apte_temporaire">Apte temporaire</option>
                    <option value="inapte_temporaire">Inapte temporaire</option>
                    <option value="inapte_definitif">Inapte définitif</option>
                  </select>
                </div>
                <div class="form-group"><label class="form-label">Prochaine visite</label><input type="date" class="form-input" name="prochaine_visite"></div>
              </div>
              <div class="form-group"><label class="form-label">Motif</label><input class="form-input" name="motif"></div>
              <div class="form-group"><label class="form-label">Conclusions</label><textarea class="form-input" name="conclusions" style="height:80px"></textarea></div>
              <div class="form-group"><label class="form-label">Restrictions</label><textarea class="form-input" name="restrictions" style="height:60px" placeholder="Ex: Éviter port de charges lourdes..."></textarea></div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="document.getElementById('vm-modal').remove()">Annuler</button>
            <button class="btn btn-primary" onclick="Visites.save(${id})"><i class="fas fa-save"></i> Enregistrer</button>
          </div>
        </div>
      </div>
    `)
    if (id) Visites.loadForEdit(id)
  },
  async loadForEdit(id) {
    const v = await API.get(`/visites/${id}`)
    const form = document.getElementById('vm-form')
    Object.entries(v).forEach(([k, val]) => {
      const el = form.querySelector(`[name="${k}"]`)
      if (el && val != null) el.value = val
    })
  },
  async save(id) {
    const form = document.getElementById('vm-form')
    const data = Object.fromEntries(new FormData(form))
    try {
      if (id) { await API.put(`/visites/${id}`, data); Toast.show('Visite modifiée') }
      else { await API.post('/visites', data); Toast.show('Visite planifiée avec succès') }
      document.getElementById('vm-modal').remove()
      if (State.currentPage === 'visites') await Visites.render()
      else if (State.currentPage === 'dashboard') await Dashboard.render()
    } catch (e) { Toast.show(e.response?.data?.error || 'Erreur', 'error') }
  },
  async confirmDelete(id, name) {
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="visite-delete-modal">
        <div class="modal modal-sm">
          <div class="modal-header">
            <h3><i class="fas fa-trash" style="color:#dc2626"></i> Supprimer la visite</h3>
            <button class="btn btn-outline btn-sm btn-icon" onclick="document.getElementById('visite-delete-modal').remove()"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body">
            <p>Voulez-vous vraiment supprimer la visite de <strong>${Utils.escape(name)}</strong> ?</p>
            <p style="color:#6b7280;font-size:0.9rem">Cette action est irréversible.</p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="document.getElementById('visite-delete-modal').remove()">Annuler</button>
            <button class="btn btn-danger" onclick="Visites.delete(${id})">Supprimer</button>
          </div>
        </div>
      </div>
    `)
  },
  async delete(id) {
    try {
      await API.delete(`/visites/${id}`)
      Toast.show('Visite supprimée')
      document.getElementById('visite-delete-modal')?.remove()
      if (State.currentPage === 'visites') await Visites.render()
      else if (State.currentPage === 'dashboard') await Dashboard.render()
    } catch (e) {
      Toast.show(e.response?.data?.error || 'Erreur', 'error')
    }
  }
}

// ============================================================
// CONSULTATIONS
// ============================================================
const Consultations = {
  async render() {
    document.getElementById('page-content').innerHTML = `<div class="empty-state"><div class="spinner" style="margin:0 auto"></div></div>`
    const [consultations, travailleurs, users] = await Promise.all([
      API.get('/consultations'),
      API.get('/travailleurs'),
      API.get('/users')
    ])
    State.data.travailleurs = travailleurs
    State.data.users = users
    document.getElementById('page-content').innerHTML = `
      <div class="page">
        <div class="section-header">
          <h2><i class="fas fa-stethoscope" style="color:#006B3C"></i> Consultations <span style="font-size:0.875rem;font-weight:400;color:#6b7280">(${consultations.length})</span></h2>
          <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
            <button class="btn btn-outline btn-sm" onclick="Export.consultations()" title="Exporter en Excel"><i class="fas fa-file-excel" style="color:#217346"></i> Excel</button>
            <button class="btn btn-primary" onclick="Consultations.openModal()"><i class="fas fa-plus"></i> Nouvelle Consultation</button>
          </div>
        </div>
        ${consultations.length === 0 ? '<div class="empty-state card"><i class="fas fa-stethoscope"></i><h3>Aucune consultation</h3></div>' : `
        <div class="card">
          <table class="data-table">
            <thead><tr><th>Travailleur</th><th>Date</th><th>Motif</th><th>Diagnostic</th><th>Praticien</th><th>Arrêt</th><th>Actions</th></tr></thead>
            <tbody>
              ${consultations.map(c => `
                <tr>
                  <td>
                    <div style="font-weight:600">${Utils.escape(c.prenom)} ${Utils.escape(c.nom)}</div>
                    <div style="font-size:0.75rem;color:#6b7280">${Utils.escape(c.entreprise || '')}</div>
                  </td>
                  <td style="font-size:0.875rem">${Utils.formatDateTime(c.date_consultation)}</td>
                  <td style="font-size:0.875rem;max-width:150px"><div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${Utils.escape(c.motif)}</div></td>
                  <td style="font-size:0.875rem;max-width:150px"><div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${Utils.escape(c.diagnostic || '-')}</div></td>
                  <td style="font-size:0.875rem">${Utils.escape(c.praticien_prenom || '')} ${Utils.escape(c.praticien_nom || '-')}</td>
                  <td>${c.arret_travail_jours > 0 ? `<span class="badge badge-orange">${c.arret_travail_jours}j</span>` : '-'}</td>
                  <td>
                    <div style="display:flex;gap:0.35rem">
                      <button class="btn btn-outline btn-sm btn-icon" onclick="Consultations.view(${c.id})" title="Voir"><i class="fas fa-eye"></i></button>
                      <button class="btn btn-outline btn-sm btn-icon" onclick="Print.consultation(${c.id})" title="Imprimer"><i class="fas fa-print"></i></button>
                      <button class="btn btn-outline btn-sm btn-icon" onclick="Consultations.openModal(${c.id})" title="Modifier"><i class="fas fa-edit"></i></button>
                      <button class="btn btn-danger btn-sm btn-icon" onclick="Consultations.confirmDelete(${c.id}, '${Utils.escape(c.prenom)} ${Utils.escape(c.nom)}')" title="Supprimer"><i class="fas fa-trash"></i></button>
                    </div>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`}
      </div>
    `
  },
  async view(id) {
    const c = await API.get(`/consultations/${id}`)
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="cv-modal">
        <div class="modal modal-lg">
          <div class="modal-header">
            <h3><i class="fas fa-stethoscope" style="color:#006B3C"></i> Détails Consultation</h3>
            <button class="btn btn-outline btn-sm btn-icon" onclick="document.getElementById('cv-modal').remove()"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body">
            <div style="background:#f0fdf4;padding:1rem;border-radius:8px;margin-bottom:1rem">
              <div style="font-weight:700">${Utils.escape(c.prenom)} ${Utils.escape(c.nom)}</div>
              <div style="font-size:0.8rem;color:#166534">${Utils.escape(c.poste || '')} | ${Utils.escape(c.entreprise || '')} | ${Utils.formatDateTime(c.date_consultation)}</div>
            </div>
            ${c.constantes ? `
            <div class="card mb-3">
              <div class="card-header"><h3 style="font-size:0.875rem"><i class="fas fa-heartbeat mr-1" style="color:#ef4444"></i> Constantes Vitales</h3></div>
              <div class="card-body">
                <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:0.75rem">
                  ${c.constantes.poids ? `<div class="vitals-item"><div class="vitals-value">${c.constantes.poids}</div><div class="vitals-unit">kg</div><div class="vitals-label">Poids</div></div>` : ''}
                  ${c.constantes.taille ? `<div class="vitals-item"><div class="vitals-value">${c.constantes.taille}</div><div class="vitals-unit">cm</div><div class="vitals-label">Taille</div></div>` : ''}
                  ${c.constantes.imc ? `<div class="vitals-item"><div class="vitals-value">${c.constantes.imc}</div><div class="vitals-unit">kg/m²</div><div class="vitals-label">IMC</div>${Utils.imcStatus(c.constantes.imc)}</div>` : ''}
                  ${c.constantes.tension_systolique ? `<div class="vitals-item"><div class="vitals-value">${c.constantes.tension_systolique}/${c.constantes.tension_diastolique}</div><div class="vitals-unit">mmHg</div><div class="vitals-label">Tension</div>${Utils.tenionStatus(c.constantes.tension_systolique, c.constantes.tension_diastolique)}</div>` : ''}
                  ${c.constantes.frequence_cardiaque ? `<div class="vitals-item"><div class="vitals-value">${c.constantes.frequence_cardiaque}</div><div class="vitals-unit">bpm</div><div class="vitals-label">FC</div></div>` : ''}
                  ${c.constantes.temperature ? `<div class="vitals-item"><div class="vitals-value">${c.constantes.temperature}</div><div class="vitals-unit">°C</div><div class="vitals-label">Temp.</div></div>` : ''}
                  ${c.constantes.saturation_oxygene ? `<div class="vitals-item"><div class="vitals-value">${c.constantes.saturation_oxygene}</div><div class="vitals-unit">%</div><div class="vitals-label">SpO2</div></div>` : ''}
                  ${c.constantes.glycemie ? `<div class="vitals-item"><div class="vitals-value">${c.constantes.glycemie}</div><div class="vitals-unit">g/L</div><div class="vitals-label">Glycémie</div></div>` : ''}
                </div>
              </div>
            </div>` : ''}
            <div class="grid-2">
              ${c.motif ? `<div class="form-group"><label class="form-label">Motif</label><div style="background:#f9fafb;padding:0.5rem 0.75rem;border-radius:6px;font-size:0.875rem">${Utils.escape(c.motif)}</div></div>` : ''}
              ${c.diagnostic ? `<div class="form-group"><label class="form-label">Diagnostic</label><div style="background:#f9fafb;padding:0.5rem 0.75rem;border-radius:6px;font-size:0.875rem;font-weight:600;color:#006B3C">${Utils.escape(c.diagnostic)}</div></div>` : ''}
            </div>
            ${c.symptomes ? `<div class="form-group"><label class="form-label">Symptômes</label><div style="background:#f9fafb;padding:0.5rem 0.75rem;border-radius:6px;font-size:0.875rem">${Utils.escape(c.symptomes)}</div></div>` : ''}
            ${c.traitement ? `<div class="form-group"><label class="form-label">Traitement</label><div style="background:#f9fafb;padding:0.5rem 0.75rem;border-radius:6px;font-size:0.875rem">${Utils.escape(c.traitement)}</div></div>` : ''}
            ${c.prescriptions ? `<div class="form-group"><label class="form-label"><i class="fas fa-prescription mr-1" style="color:#006B3C"></i> Prescriptions</label><div style="background:#e8f5ee;padding:0.75rem;border-radius:8px;font-size:0.875rem;border:1px solid #bbf7d0;font-weight:500">${Utils.escape(c.prescriptions)}</div></div>` : ''}
            ${c.arret_travail_jours > 0 ? `<div style="background:#ffedd5;border:1px solid #fed7aa;border-radius:8px;padding:0.75rem;text-align:center"><i class="fas fa-bed" style="color:#f97316;margin-right:0.5rem"></i><strong>Arrêt de travail: ${c.arret_travail_jours} jour(s)</strong>${c.certificat_travail ? ' - Certificat émis' : ''}</div>` : ''}
            ${c.observations ? `<div class="form-group mt-2"><label class="form-label">Observations</label><div style="background:#f9fafb;padding:0.5rem 0.75rem;border-radius:6px;font-size:0.875rem">${Utils.escape(c.observations)}</div></div>` : ''}
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="document.getElementById('cv-modal').remove()">Fermer</button>
            <button class="btn btn-outline" onclick="Print.consultation(${id})"><i class="fas fa-print"></i> Imprimer</button>
            <button class="btn btn-primary" onclick="document.getElementById('cv-modal').remove(); Consultations.openModal(${id})"><i class="fas fa-edit"></i> Modifier</button>
          </div>
        </div>
      </div>
    `)
  },
  openModal(id = null, travailleurId = null) {
    const travailleurs = State.data.travailleurs
    const users = State.data.users
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="cm-modal">
        <div class="modal modal-xl">
          <div class="modal-header">
            <h3><i class="fas fa-stethoscope" style="color:#006B3C"></i> ${id ? 'Modifier' : 'Nouvelle'} Consultation</h3>
            <button class="btn btn-outline btn-sm btn-icon" onclick="document.getElementById('cm-modal').remove()"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body">
            <form id="cm-form">
              <div class="grid-2 mb-3">
                <div class="form-group"><label class="form-label">Travailleur *</label>
                  <select class="form-input" name="travailleur_id" required>
                    <option value="">-- Sélectionner --</option>
                    ${travailleurs.map(t => `<option value="${t.id}" ${travailleurId == t.id ? 'selected' : ''}>${Utils.escape(t.prenom)} ${Utils.escape(t.nom)} - ${Utils.escape(t.numero_matricule || '')}</option>`).join('')}
                  </select>
                </div>
                <div class="form-group"><label class="form-label">Praticien</label>
                  <select class="form-input" name="praticien_id">
                    <option value="">-- Sélectionner --</option>
                    ${users.map(u => `<option value="${u.id}">${Utils.escape(u.prenom)} ${Utils.escape(u.nom)} (${u.role})</option>`).join('')}
                  </select>
                </div>
                <div class="form-group"><label class="form-label">Date et heure</label><input type="datetime-local" class="form-input" name="date_consultation" value="${new Date().toISOString().slice(0,16)}"></div>
              </div>
              <div class="form-group"><label class="form-label">Motif de consultation *</label><input class="form-input" name="motif" placeholder="Ex: Douleurs lombaires, fièvre..." required></div>
              <div class="grid-2">
                <div class="form-group"><label class="form-label">Symptômes</label><textarea class="form-input" name="symptomes" placeholder="Symptômes rapportés par le patient..."></textarea></div>
                <div class="form-group"><label class="form-label">Examen clinique</label><textarea class="form-input" name="examen_clinique" placeholder="Résultats de l'examen..."></textarea></div>
                <div class="form-group"><label class="form-label">Diagnostic</label><textarea class="form-input" name="diagnostic"></textarea></div>
                <div class="form-group"><label class="form-label">Traitement</label><textarea class="form-input" name="traitement"></textarea></div>
              </div>
              <div class="form-group"><label class="form-label"><i class="fas fa-prescription mr-1" style="color:#006B3C"></i> Prescriptions / Ordonnances</label><textarea class="form-input" name="prescriptions" style="height:80px" placeholder="Ex: Paracétamol 1g - 3 prises/jour pendant 5 jours&#10;Ibuprofène 400mg - 2 prises/jour avec les repas..."></textarea></div>
              <div class="form-group"><label class="form-label">Examens demandés</label><input class="form-input" name="examens_demandes" placeholder="Ex: NFS, Glycémie, Radio thorax..."></div>
              <div class="grid-2">
                <div class="form-group">
                  <label class="form-label">Arrêt de travail (jours)</label>
                  <input type="number" class="form-input" name="arret_travail_jours" value="0" min="0">
                </div>
                <div class="form-group" style="display:flex;align-items:flex-end;padding-bottom:0.25rem">
                  <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer">
                    <input type="checkbox" name="certificat_travail" value="1"> Émettre un certificat de travail
                  </label>
                </div>
              </div>
              <!-- Constantes vitales -->
              <div class="card mt-3">
                <div class="card-header"><h3 style="font-size:0.875rem"><i class="fas fa-heartbeat mr-1" style="color:#ef4444"></i> Constantes Vitales (optionnel)</h3></div>
                <div class="card-body">
                  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:0.75rem">
                    <div class="form-group" style="margin:0"><label class="form-label" style="font-size:0.75rem">Poids (kg)</label><input type="number" step="0.1" class="form-input" name="cv_poids"></div>
                    <div class="form-group" style="margin:0"><label class="form-label" style="font-size:0.75rem">Taille (cm)</label><input type="number" class="form-input" name="cv_taille"></div>
                    <div class="form-group" style="margin:0"><label class="form-label" style="font-size:0.75rem">TA Systolique</label><input type="number" class="form-input" name="cv_ta_sys" placeholder="120"></div>
                    <div class="form-group" style="margin:0"><label class="form-label" style="font-size:0.75rem">TA Diastolique</label><input type="number" class="form-input" name="cv_ta_dia" placeholder="80"></div>
                    <div class="form-group" style="margin:0"><label class="form-label" style="font-size:0.75rem">FC (bpm)</label><input type="number" class="form-input" name="cv_fc" placeholder="72"></div>
                    <div class="form-group" style="margin:0"><label class="form-label" style="font-size:0.75rem">Température (°C)</label><input type="number" step="0.1" class="form-input" name="cv_temp" placeholder="36.8"></div>
                    <div class="form-group" style="margin:0"><label class="form-label" style="font-size:0.75rem">SpO2 (%)</label><input type="number" step="0.1" class="form-input" name="cv_spo2" placeholder="98"></div>
                    <div class="form-group" style="margin:0"><label class="form-label" style="font-size:0.75rem">Glycémie (g/L)</label><input type="number" step="0.01" class="form-input" name="cv_glycemie"></div>
                  </div>
                </div>
              </div>
              <div class="form-group mt-3"><label class="form-label">Observations</label><textarea class="form-input" name="observations" style="height:60px"></textarea></div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="document.getElementById('cm-modal').remove()">Annuler</button>
            <button class="btn btn-primary" onclick="Consultations.save(${id})"><i class="fas fa-save"></i> Enregistrer</button>
            <button class="btn btn-primary" onclick="document.getElementById('cv-modal').remove(); Consultations.openModal(${id})"><i class="fas fa-edit"></i> Modifier</button>
          </div>
        </div>
      </div>
    `)
    if (id) Consultations.loadForEdit(id)
  },
  async loadForEdit(id) {
    const c = await API.get(`/consultations/${id}`)
    const form = document.getElementById('cm-form')
    Object.entries(c).forEach(([k, v]) => {
      const el = form.querySelector(`[name="${k}"]`)
      if (el && v != null) el.value = v
    })
  },
  async save(id) {
    const form = document.getElementById('cm-form')
    const fd = new FormData(form)
    const data = Object.fromEntries(fd)
    // Collect constantes
    const cv = {}
    if (data.cv_poids) cv.poids = data.cv_poids
    if (data.cv_taille) cv.taille = data.cv_taille
    if (data.cv_ta_sys) cv.tension_systolique = data.cv_ta_sys
    if (data.cv_ta_dia) cv.tension_diastolique = data.cv_ta_dia
    if (data.cv_fc) cv.frequence_cardiaque = data.cv_fc
    if (data.cv_temp) cv.temperature = data.cv_temp
    if (data.cv_spo2) cv.saturation_oxygene = data.cv_spo2
    if (data.cv_glycemie) cv.glycemie = data.cv_glycemie
    if (Object.keys(cv).length > 0) data.constantes = cv
    data.certificat_travail = data.certificat_travail === '1' ? 1 : 0
    // Remove cv_ fields
    Object.keys(data).filter(k => k.startsWith('cv_')).forEach(k => delete data[k])
    try {
      if (id) { await API.put(`/consultations/${id}`, data); Toast.show('Consultation modifiée') }
      else { await API.post('/consultations', data); Toast.show('Consultation enregistrée avec succès') }
      document.getElementById('cm-modal').remove()
      if (State.currentPage === 'consultations') await Consultations.render()
    } catch (e) { Toast.show(e.response?.data?.error || 'Erreur', 'error') }
  },
  async confirmDelete(id, name) {
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="consult-delete-modal">
        <div class="modal modal-sm">
          <div class="modal-header">
            <h3><i class="fas fa-trash" style="color:#dc2626"></i> Supprimer la consultation</h3>
            <button class="btn btn-outline btn-sm btn-icon" onclick="document.getElementById('consult-delete-modal').remove()"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body">
            <p>Voulez-vous vraiment supprimer la consultation de <strong>${Utils.escape(name)}</strong> ?</p>
            <p style="color:#6b7280;font-size:0.9rem">Cette action est irréversible.</p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="document.getElementById('consult-delete-modal').remove()">Annuler</button>
            <button class="btn btn-danger" onclick="Consultations.delete(${id})">Supprimer</button>
          </div>
        </div>
      </div>
    `)
  },
  async delete(id) {
    try {
      await API.delete(`/consultations/${id}`)
      Toast.show('Consultation supprimée')
      document.getElementById('consult-delete-modal')?.remove()
      await Consultations.render()
    } catch (e) {
      Toast.show(e.response?.data?.error || 'Erreur', 'error')
    }
  },
}

// ============================================================
// CALENDRIER
// ============================================================
const Calendrier = {
  currentDate: new Date(),
  visites: [],
  async render() {
    document.getElementById('page-content').innerHTML = `<div class="empty-state"><div class="spinner" style="margin:0 auto"></div></div>`
    const mois = `${this.currentDate.getFullYear()}-${String(this.currentDate.getMonth() + 1).padStart(2, '0')}`
    this.visites = await API.get(`/visites?mois=${mois}`)
    this.renderCalendar()
  },
  renderCalendar() {
    const year = this.currentDate.getFullYear()
    const month = this.currentDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const monthName = this.currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    
    const jours = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
    let firstDayIndex = firstDay.getDay() - 1
    if (firstDayIndex < 0) firstDayIndex = 6
    
    const visitesByDate = {}
    this.visites.forEach(v => {
      const d = v.date_visite
      if (!visitesByDate[d]) visitesByDate[d] = []
      visitesByDate[d].push(v)
    })
    
    let cells = []
    for (let i = 0; i < firstDayIndex; i++) {
      const prevDate = new Date(year, month, -firstDayIndex + i + 1)
      cells.push({ date: prevDate, current: false })
    }
    for (let d = 1; d <= lastDay.getDate(); d++) {
      cells.push({ date: new Date(year, month, d), current: true })
    }
    while (cells.length % 7 !== 0) {
      const nextDate = new Date(year, month + 1, cells.length - lastDay.getDate() - firstDayIndex + 1)
      cells.push({ date: nextDate, current: false })
    }
    
    const today = new Date()
    
    document.getElementById('page-content').innerHTML = `
      <div class="page">
        <div class="section-header">
          <h2><i class="fas fa-calendar-alt" style="color:#006B3C"></i> Calendrier Médical</h2>
          <button class="btn btn-primary" onclick="Visites.openModal()"><i class="fas fa-plus"></i> Planifier une visite</button>
        </div>
        <div class="card">
          <div class="card-header">
            <div style="display:flex;align-items:center;gap:1rem">
              <button class="btn btn-outline btn-sm btn-icon" onclick="Calendrier.prevMonth()"><i class="fas fa-chevron-left"></i></button>
              <h3 style="margin:0;text-transform:capitalize;font-size:1rem">${monthName}</h3>
              <button class="btn btn-outline btn-sm btn-icon" onclick="Calendrier.nextMonth()"><i class="fas fa-chevron-right"></i></button>
            </div>
            <div style="display:flex;gap:1rem;font-size:0.75rem">
              <span><span class="badge badge-blue">•</span> Planifiée</span>
              <span><span class="badge badge-green">•</span> Réalisée</span>
              <span><span class="badge badge-red">•</span> Annulée</span>
            </div>
          </div>
          <div class="card-body" style="padding:0.75rem">
            <div class="calendar-grid" style="grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:4px">
              ${jours.map(j => `<div style="text-align:center;font-size:0.75rem;font-weight:600;color:#6b7280;padding:0.5rem">${j}</div>`).join('')}
            </div>
            <div class="calendar-grid" style="grid-template-columns:repeat(7,1fr);gap:4px">
              ${cells.map(cell => {
                const dateStr = `${cell.date.getFullYear()}-${String(cell.date.getMonth() + 1).padStart(2, '0')}-${String(cell.date.getDate()).padStart(2, '0')}`
                const isToday = cell.date.toDateString() === today.toDateString()
                const dayVisites = visitesByDate[dateStr] || []
                return `
                  <div class="calendar-day ${!cell.current ? 'other-month' : ''} ${isToday ? 'today' : ''}">
                    <div class="calendar-day-num" style="${isToday ? 'color:#006B3C;font-weight:700' : ''}">${cell.date.getDate()}</div>
                    ${dayVisites.slice(0, 3).map(v => `
                      <div class="calendar-event" style="background:${v.statut === 'realisee' ? '#d1fae5;color:#065f46' : v.statut === 'annulee' ? '#fee2e2;color:#991b1b' : '#dbeafe;color:#1e40af'}" onclick="Visites.viewVisite(${v.id})" title="${Utils.escape(v.prenom)} ${Utils.escape(v.nom)}">
                        ${v.heure_visite ? v.heure_visite.slice(0,5) + ' ' : ''}${Utils.escape(v.nom)}
                      </div>`).join('')}
                    ${dayVisites.length > 3 ? `<div style="font-size:0.6rem;color:#6b7280;padding:1px 4px">+${dayVisites.length - 3} autres</div>` : ''}
                  </div>`
              }).join('')}
            </div>
          </div>
        </div>
        <!-- Liste du mois -->
        <div class="card mt-4">
          <div class="card-header"><h3><i class="fas fa-list mr-1"></i> Visites du mois (${this.visites.length})</h3></div>
          <div class="card-body" style="padding:0">
            ${this.visites.length === 0 ? '<div class="empty-state"><i class="fas fa-calendar"></i><h3>Aucune visite ce mois</h3></div>' :
            `<table class="data-table">
              <thead><tr><th>Date</th><th>Travailleur</th><th>Type</th><th>Statut</th><th>Actions</th></tr></thead>
              <tbody>${this.visites.map(v => `
                <tr>
                  <td>${Utils.formatDate(v.date_visite)} ${v.heure_visite || ''}</td>
                  <td>
                    <div style="font-weight:600">${Utils.escape(v.prenom)} ${Utils.escape(v.nom)}</div>
                    <div style="font-size:0.75rem;color:#6b7280">${Utils.escape(v.entreprise || '')}</div>
                  </td>
                  <td>${Utils.typeVisiteBadge(v.type_visite)}</td>
                  <td>${Utils.statutVisiteBadge(v.statut)}</td>
                  <td><button class="btn btn-outline btn-sm btn-icon" onclick="Visites.viewVisite(${v.id})"><i class="fas fa-eye"></i></button></td>
                </tr>`).join('')}
              </tbody>
            </table>`}
          </div>
        </div>
      </div>
    `
  },
  async prevMonth() {
    this.currentDate.setMonth(this.currentDate.getMonth() - 1)
    await this.render()
  },
  async nextMonth() {
    this.currentDate.setMonth(this.currentDate.getMonth() + 1)
    await this.render()
  }
}

// ============================================================
// ENTREPRISES
// ============================================================
const Entreprises = {
  async render() {
    document.getElementById('page-content').innerHTML = `<div class="empty-state"><div class="spinner" style="margin:0 auto"></div></div>`
    const entreprises = await API.get('/entreprises')
    State.data.entreprises = entreprises
    document.getElementById('page-content').innerHTML = `
      <div class="page">
        <div class="section-header">
          <h2><i class="fas fa-building" style="color:#006B3C"></i> Entreprises <span style="font-size:0.875rem;font-weight:400;color:#6b7280">(${entreprises.length})</span></h2>
          <button class="btn btn-primary" onclick="Entreprises.openModal()"><i class="fas fa-plus"></i> Nouvelle Entreprise</button>
        </div>
        <div class="grid-3">
          ${entreprises.map(e => `
            <div class="card" style="cursor:pointer;transition:transform 0.2s" onmouseenter="this.style.transform='translateY(-2px)'" onmouseleave="this.style.transform='none'" onclick="App.navigate('travailleurs')">
              <div class="card-body">
                <div style="display:flex;align-items:flex-start;gap:0.75rem;margin-bottom:0.75rem">
                  <div class="avatar avatar-green" style="width:44px;height:44px;font-size:1.1rem;flex-shrink:0"><i class="fas fa-building"></i></div>
                  <div style="flex:1;min-width:0">
                    <div style="font-weight:700;font-size:0.925rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${Utils.escape(e.nom)}</div>
                    <div style="font-size:0.75rem;color:#6b7280">${Utils.escape(e.secteur || '')}</div>
                  </div>
                  <span class="badge ${e.categorie==='A'?'badge-red':e.categorie==='B'?'badge-orange':e.categorie==='C'?'badge-yellow':e.categorie==='D'?'badge-blue':'badge-gray'}" style="font-size:0.7rem;flex-shrink:0" title="Catégorie Art.31">Cat.${e.categorie||'?'}</span>
                </div>
                <div style="font-size:0.8rem;color:#6b7280;margin-bottom:0.5rem">
                  ${e.ville ? `<div><i class="fas fa-map-marker-alt mr-1"></i>${Utils.escape(e.ville)}</div>` : ''}
                  ${e.telephone ? `<div><i class="fas fa-phone mr-1"></i>${Utils.escape(e.telephone)}</div>` : ''}
                  ${e.effectif ? `<div><i class="fas fa-users mr-1"></i>Effectif: <strong>${e.effectif}</strong></div>` : ''}
                  ${e.numero_agrement ? `<div><i class="fas fa-certificate mr-1"></i>Agr. N°${Utils.escape(e.numero_agrement)}</div>` : ''}
                </div>
                ${e.risques_professionnels ? `<div style="font-size:0.72rem;background:#fef3c7;padding:0.3rem 0.5rem;border-radius:4px;margin-bottom:0.4rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><i class="fas fa-exclamation-triangle mr-1" style="color:#f59e0b"></i>${Utils.escape(e.risques_professionnels)}</div>` : ''}
                <div style="display:flex;align-items:center;justify-content:space-between;padding-top:0.5rem;border-top:1px solid #f0f0f0">
                  <span class="badge badge-green"><i class="fas fa-users mr-1"></i>${e.nb_travailleurs} travailleur(s)</span>
                  <div style="display:flex;gap:0.3rem">
                    <button class="btn btn-outline btn-sm btn-icon" onclick="event.stopPropagation();Print.entreprise(${e.id})" title="Imprimer"><i class="fas fa-print"></i></button>
                    <button class="btn btn-outline btn-sm btn-icon" onclick="event.stopPropagation();FicheEntreprise.openFiche(${e.id})" title="Fiche risques"><i class="fas fa-industry"></i></button>
                    <button class="btn btn-outline btn-sm btn-icon" onclick="event.stopPropagation();Entreprises.openModal(${e.id})" title="Modifier"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-danger btn-sm btn-icon" ${e.nb_travailleurs > 0 ? 'style="opacity:0.5;cursor:not-allowed" title="Impossible de supprimer : l’entreprise a des travailleurs actifs" disabled' : `onclick="event.stopPropagation();Entreprises.confirmDelete(${e.id}, '${Utils.escape(e.nom)}')" title="Supprimer"`}><i class="fas fa-trash"></i></button>
                  </div>
                </div>
              </div>
            </div>`).join('')}
        </div>
      </div>
    `
  },
  openModal(id = null) {
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="em-modal">
        <div class="modal modal-md">
          <div class="modal-header">
            <h3><i class="fas fa-building" style="color:#006B3C"></i> ${id ? 'Modifier' : 'Nouvelle'} Entreprise</h3>
            <button class="btn btn-outline btn-sm btn-icon" onclick="document.getElementById('em-modal').remove()"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body">
            <form id="em-form">
              <div class="form-group"><label class="form-label">Nom de l'entreprise *</label><input class="form-input" name="nom" required></div>
              <div class="grid-2">
                <div class="form-group"><label class="form-label">Secteur d'activité</label><input class="form-input" name="secteur" placeholder="Ex: Industrie, Commerce..."></div>
                <div class="form-group"><label class="form-label">Ville</label><input class="form-input" name="ville" placeholder="Ex: Abidjan"></div>
                <div class="form-group"><label class="form-label">Téléphone</label><input class="form-input" name="telephone"></div>
                <div class="form-group"><label class="form-label">Email</label><input type="email" class="form-input" name="email"></div>
              </div>
              <div class="form-group"><label class="form-label">Adresse</label><textarea class="form-input" name="adresse" style="height:60px"></textarea></div>
              <div class="form-group"><label class="form-label">Contact RH</label><input class="form-input" name="contact_rh" placeholder="Nom du responsable RH"></div>
              <!-- Champs Décret 2026-206 -->
              <div style="border-top:2px solid #006B3C;margin:1rem 0 0.75rem;padding-top:0.75rem">
                <div style="font-size:0.78rem;font-weight:700;color:#006B3C;margin-bottom:0.75rem"><i class="fas fa-gavel mr-1"></i>Décret N°2026-206 — Classification &amp; Agrément</div>
                <div class="grid-2">
                  <div class="form-group"><label class="form-label">Effectif total (détermine catégorie Art.31)</label><input type="number" class="form-input" name="effectif" min="0" placeholder="0" onchange="Entreprises.autoCategorie(this.value)"></div>
                  <div class="form-group"><label class="form-label">Catégorie (Art. 31) — auto-calculée</label>
                    <select class="form-input" name="categorie" id="ent-categorie">
                      <option value="A">A (>5000 — service autonome obligatoire)</option>
                      <option value="B">B (1000-4999)</option>
                      <option value="C" selected>C (500-999)</option>
                      <option value="D">D (100-499)</option>
                      <option value="E">E (&lt;100)</option>
                    </select>
                  </div>
                  <div class="form-group"><label class="form-label">Type de service santé</label>
                    <select class="form-input" name="type_service_sante">
                      <option value="autonome">Service autonome</option>
                      <option value="interentreprises">Service interentreprises</option>
                      <option value="convention">Par convention</option>
                    </select>
                  </div>
                  <div class="form-group"><label class="form-label">Type équipement (Art.36-40)</label>
                    <select class="form-input" name="type_equipement">
                      <option value="fixe">Local fixe</option>
                      <option value="mobile">Unité mobile</option>
                      <option value="mixte">Mixte (fixe + mobile)</option>
                    </select>
                  </div>
                  <div class="form-group"><label class="form-label">N° d'agrément</label><input class="form-input" name="numero_agrement"></div>
                  <div class="form-group"><label class="form-label">Date d'agrément</label><input type="date" class="form-input" name="date_agrement"></div>
                </div>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="document.getElementById('em-modal').remove()">Annuler</button>
            <button class="btn btn-primary" onclick="Entreprises.save(${id})"><i class="fas fa-save"></i> Enregistrer</button>
          </div>
        </div>
      </div>
    `)
    if (id) {
      const ent = State.data.entreprises.find(e => e.id === id)
      if (ent) {
        const form = document.getElementById('em-form')
        Object.entries(ent).forEach(([k, v]) => {
          const el = form.querySelector(`[name="${k}"]`)
          if (el && v) el.value = v
        })
      }
    }
  },
  autoCategorie(effectif) {
    const eff = parseInt(effectif) || 0
    const cat = eff > 5000 ? 'A' : eff >= 1000 ? 'B' : eff >= 500 ? 'C' : eff >= 100 ? 'D' : 'E'
    const sel = document.getElementById('ent-categorie')
    if (sel) sel.value = cat
  },
  async save(id) {
    const form = document.getElementById('em-form')
    const data = Object.fromEntries(new FormData(form))
    // Auto-calcul catégorie
    const eff = parseInt(data.effectif) || 0
    if (!data.categorie || data.categorie === 'C') {
      data.categorie = eff > 5000 ? 'A' : eff >= 1000 ? 'B' : eff >= 500 ? 'C' : eff >= 100 ? 'D' : 'E'
    }
    try {
      if (id) { await API.put(`/entreprises/${id}`, data); Toast.show('Entreprise modifiée') }
      else { await API.post('/entreprises', data); Toast.show('Entreprise ajoutée') }
      document.getElementById('em-modal').remove()
      await Entreprises.render()
    } catch (e) { Toast.show('Erreur', 'error') }
  },
  async confirmDelete(id, name) {
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="ent-delete-modal">
        <div class="modal modal-sm">
          <div class="modal-header">
            <h3><i class="fas fa-trash" style="color:#dc2626"></i> Confirmer la suppression</h3>
            <button class="btn btn-outline btn-sm btn-icon" onclick="document.getElementById('ent-delete-modal').remove()"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body">
            <p>Voulez-vous vraiment supprimer l'entreprise <strong>${Utils.escape(name)}</strong> ?</p>
            <p style="color:#6b7280;font-size:0.9rem">Cette action est irréversible et supprimera l'entreprise du service médical.</p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="document.getElementById('ent-delete-modal').remove()">Annuler</button>
            <button class="btn btn-danger" onclick="Entreprises.delete(${id}, '${Utils.escape(name)}')">Supprimer</button>
          </div>
        </div>
      </div>
    `)
  },
  async delete(id, name) {
    try {
      await API.delete(`/entreprises/${id}`)
      Toast.show('Entreprise supprimée')
      document.getElementById('ent-delete-modal')?.remove()
      await Entreprises.render()
    } catch (e) {
      document.getElementById('ent-delete-modal')?.remove()
      Toast.show(e.response?.data?.error || 'Erreur', 'error')
    }
  }
}

// ============================================================
// ALERTES
// ============================================================
const Alertes = {
  async render() {
    document.getElementById('page-content').innerHTML = `<div class="empty-state"><div class="spinner" style="margin:0 auto"></div></div>`
    const alertes = await API.get('/alertes')
    State.data.alertes = alertes
    document.getElementById('page-content').innerHTML = `
      <div class="page">
        <div class="section-header">
          <h2><i class="fas fa-bell" style="color:#f59e0b"></i> Alertes Médicales <span style="font-size:0.875rem;font-weight:400;color:#6b7280">(${alertes.length} actives)</span></h2>
        </div>
        ${alertes.length === 0 ? `
          <div class="empty-state card">
            <i class="fas fa-check-circle" style="color:#10b981"></i>
            <h3>Aucune alerte active</h3>
            <p>Toutes les alertes ont été traitées. Bon travail !</p>
          </div>` : `
        <div id="alertes-list">
          ${alertes.map(a => `
            <div class="card mb-3 priority-${a.priorite}" style="border-radius:10px;overflow:hidden">
              <div class="card-body" style="padding:1rem 1.25rem">
                <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:1rem">
                  <div style="flex:1">
                    <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.4rem">
                      <i class="fas fa-${a.priorite === 'urgente' || a.priorite === 'haute' ? 'exclamation-circle' : 'info-circle'}" style="font-size:1.1rem"></i>
                      <span style="font-weight:700;font-size:0.925rem">${a.prenom ? Utils.escape(a.prenom) + ' ' + Utils.escape(a.nom) : 'Système'}</span>
                      <span class="badge badge-${a.priorite === 'urgente' ? 'red' : a.priorite === 'haute' ? 'orange' : a.priorite === 'normale' ? 'blue' : 'gray'}">${a.priorite}</span>
                    </div>
                    <div style="font-size:0.875rem;margin-bottom:0.3rem">${Utils.escape(a.message)}</div>
                    ${a.date_echeance ? `<div style="font-size:0.75rem;opacity:0.75"><i class="fas fa-clock mr-1"></i>Échéance: ${Utils.formatDate(a.date_echeance)}</div>` : ''}
                  </div>
                  <div style="display:flex;gap:0.5rem;flex-shrink:0">
                    ${a.travailleur_id ? `<button class="btn btn-outline btn-sm" onclick="Travailleurs.viewDossier(${a.travailleur_id})"><i class="fas fa-folder-open"></i> Dossier</button>` : ''}
                    <button class="btn btn-outline btn-sm btn-icon" onclick="Alertes.openModal(${a.id})" title="Modifier"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-outline btn-sm btn-icon" onclick="Alertes.confirmDelete(${a.id}, ${Utils.jsStringLiteral(a.message)})" title="Supprimer"><i class="fas fa-trash"></i></button>
                    <button class="btn btn-outline btn-sm btn-icon" onclick="Print.alerte(${a.id})" title="Imprimer"><i class="fas fa-print"></i></button>
                    <button class="btn btn-sm" style="background:rgba(0,0,0,0.1);border:none;cursor:pointer;padding:0.4rem 0.75rem;border-radius:6px" onclick="Alertes.traiter(${a.id})"><i class="fas fa-check mr-1"></i> Traiter</button>
                  </div>
                </div>
              </div>
            </div>`).join('')}
        </div>`}
      </div>
    `
  },
  async openModal(id) {
    const a = State.data.alertes?.find(alert => Number(alert.id) === Number(id))
    if (!a) { Toast.show('Alerte introuvable', 'error'); return }
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="alert-edit-modal">
        <div class="modal modal-md">
          <div class="modal-header">
            <h3><i class="fas fa-edit" style="color:#f59e0b"></i> Modifier l'alerte</h3>
            <button class="btn btn-outline btn-sm btn-icon" onclick="document.getElementById('alert-edit-modal').remove()"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body">
            <form id="alert-edit-form">
              <div class="form-group"><label class="form-label">Message</label><textarea class="form-input" name="message" rows="3" required>${Utils.escape(a.message)}</textarea></div>
              <div class="form-group"><label class="form-label">Priorité</label>
                <select class="form-input" name="priorite">
                  <option value="basse" ${a.priorite==='basse'?'selected':''}>Basse</option>
                  <option value="normale" ${a.priorite==='normale'?'selected':''}>Normale</option>
                  <option value="haute" ${a.priorite==='haute'?'selected':''}>Haute</option>
                  <option value="urgente" ${a.priorite==='urgente'?'selected':''}>Urgente</option>
                </select>
              </div>
              <div class="form-group"><label class="form-label">Échéance</label><input class="form-input" type="date" name="date_echeance" value="${a.date_echeance || ''}"></div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="document.getElementById('alert-edit-modal').remove()">Annuler</button>
            <button class="btn btn-primary" onclick="Alertes.save(${a.id})"><i class="fas fa-save"></i> Enregistrer</button>
          </div>
        </div>
      </div>
    `)
  },
  async save(id) {
    try {
      const data = Object.fromEntries(new FormData(document.getElementById('alert-edit-form')))
      await API.put(`/alertes/${id}`, data)
      Toast.show('Alerte modifiée')
      document.getElementById('alert-edit-modal')?.remove()
      await Alertes.render()
    } catch (e) {
      Toast.show(e.response?.data?.error || 'Erreur', 'error')
    }
  },
  async confirmDelete(id, message) {
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="alert-delete-modal">
        <div class="modal modal-sm">
          <div class="modal-header">
            <h3><i class="fas fa-trash" style="color:#dc2626"></i> Supprimer l'alerte</h3>
            <button class="btn btn-outline btn-sm btn-icon" onclick="document.getElementById('alert-delete-modal').remove()"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body">
            <p>Supprimer l'alerte suivante ?</p>
            <p style="color:#6b7280;font-size:0.9rem">${Utils.escape(message).slice(0, 120)}${message.length>120?'...':''}</p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="document.getElementById('alert-delete-modal').remove()">Annuler</button>
            <button class="btn btn-danger" onclick="Alertes.delete(${id})">Supprimer</button>
          </div>
        </div>
      </div>
    `)
  },
  async delete(id) {
    try {
      await API.delete(`/alertes/${id}`)
      Toast.show('Alerte supprimée')
      document.getElementById('alert-delete-modal')?.remove()
      await Alertes.render()
      App.loadAlertesCount()
    } catch (e) {
      document.getElementById('alert-delete-modal')?.remove()
      Toast.show(e.response?.data?.error || 'Erreur', 'error')
    }
  },
  async traiter(id) {
    try {
      await API.put(`/alertes/${id}/traiter`)
      Toast.show('Alerte marquée comme traitée', 'success')
      await Alertes.render()
      App.loadAlertesCount()
    } catch { Toast.show('Erreur', 'error') }
  }
}

// ============================================================
// UTILISATEURS
// ============================================================
const Utilisateurs = {
  async render() {
    if (State.user?.role !== 'admin') {
      document.getElementById('page-content').innerHTML = '<div class="empty-state card"><i class="fas fa-lock"></i><h3>Accès refusé</h3><p>Seuls les administrateurs peuvent accéder à cette section.</p></div>'
      return
    }
    document.getElementById('page-content').innerHTML = `<div class="empty-state"><div class="spinner" style="margin:0 auto"></div></div>`
    const users = await API.get('/users')
    State.data.users = users
    document.getElementById('page-content').innerHTML = `
      <div class="page">
        <div class="section-header">
          <h2><i class="fas fa-user-cog" style="color:#006B3C"></i> Gestion des Utilisateurs</h2>
          <button class="btn btn-primary" onclick="window.Utilisateurs.openModal()"><i class="fas fa-user-plus"></i> Nouvel Utilisateur</button>
        </div>
        <div class="card">
          <table class="data-table">
            <thead><tr><th>Utilisateur</th><th>Email</th><th>Rôle</th><th>Spécialité</th><th>Téléphone</th><th>Statut</th><th>Actions</th></tr></thead>
            <tbody>
              ${users.map(u => `
                <tr>
                  <td>
                    <div style="display:flex;align-items:center;gap:0.75rem">
                      <div class="avatar ${Utils.avatarColor(u.id)}">${Utils.getInitials(u.nom, u.prenom)}</div>
                      <div>
                        <div style="font-weight:600">${Utils.escape(u.prenom)} ${Utils.escape(u.nom)}</div>
                      </div>
                    </div>
                  </td>
                  <td style="font-size:0.875rem">${Utils.escape(u.email)}</td>
                  <td>${Utils.roleBadge(u.role)}</td>
                  <td style="font-size:0.875rem">${Utils.escape(u.specialite || '-')}</td>
                  <td style="font-size:0.875rem">${Utils.escape(u.telephone || '-')}</td>
                  <td>${u.actif ? '<span class="badge badge-green">Actif</span>' : '<span class="badge badge-gray">Inactif</span>'}</td>
                  <td style="display:flex;align-items:center;gap:0.35rem">
                    <button class="btn btn-outline btn-sm btn-icon" onclick="Print.utilisateur(${u.id})" title="Imprimer"><i class="fas fa-print"></i></button>
                    <button class="btn btn-outline btn-sm btn-icon" onclick="window.Utilisateurs.openModal(${u.id})" title="Modifier"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-danger btn-sm btn-icon" onclick="window.Utilisateurs.confirmDelete(${u.id}, ${Utils.jsStringLiteral(`${u.prenom || ''} ${u.nom || ''}`)})" title="Supprimer" ${u.id === State.user?.id ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}><i class="fas fa-trash"></i></button>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `
  },
  openModal(id = null) {
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="um-modal">
        <div class="modal modal-md">
          <div class="modal-header">
            <h3><i class="fas fa-user-${id ? 'edit' : 'plus'}" style="color:#006B3C"></i> ${id ? 'Modifier' : 'Nouvel'} Utilisateur</h3>
            <button class="btn btn-outline btn-sm btn-icon" onclick="document.getElementById('um-modal').remove()"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body">
            <form id="um-form">
              <div class="grid-2">
                <div class="form-group"><label class="form-label">Nom *</label><input class="form-input" name="nom" required></div>
                <div class="form-group"><label class="form-label">Prénom *</label><input class="form-input" name="prenom" required></div>
                <div class="form-group"><label class="form-label">Email *</label><input type="email" class="form-input" name="email" required></div>
                <div class="form-group"><label class="form-label">Rôle *</label>
                  <select class="form-input" name="role" required>
                    <option value="medecin">Médecin</option>
                    <option value="infirmier">Infirmier</option>
                    <option value="admin">Administrateur</option>
                  </select>
                </div>
                <div class="form-group"><label class="form-label">Spécialité</label><input class="form-input" name="specialite"></div>
                <div class="form-group"><label class="form-label">Téléphone</label><input class="form-input" name="telephone"></div>
              </div>
              ${!id ? `<div class="form-group"><label class="form-label">Mot de passe initial (défaut: Admin2026!)</label><input type="password" class="form-input" name="password" placeholder="Laisser vide pour utiliser le défaut"></div>` : ''}
              ${id ? `<div class="form-group"><label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer"><input type="checkbox" name="actif" value="1" checked> Utilisateur actif</label></div>` : ''}
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="document.getElementById('um-modal').remove()">Annuler</button>
            <button class="btn btn-primary" onclick="window.Utilisateurs.save(${id})"><i class="fas fa-save"></i> Enregistrer</button>
          </div>
        </div>
      </div>
    `)
    if (id) Utilisateurs.loadForEdit(id)
  },
  async save(id) {
    const data = Object.fromEntries(new FormData(document.getElementById('um-form')))
    data.actif = data.actif === '1' ? 1 : 0
    try {
      if (id) { await API.put(`/users/${id}`, data); Toast.show('Utilisateur modifié') }
      else { await API.post('/users', data); Toast.show('Utilisateur créé. MDP: Admin2026!') }
      document.getElementById('um-modal').remove()
      await Utilisateurs.render()
    } catch (e) { Toast.show(e.response?.data?.error || 'Erreur', 'error') }
  },
  async loadForEdit(id) {
    const u = State.data.users?.find(user => Number(user.id) === Number(id))
    if (!u) return
    const form = document.getElementById('um-form')
    if (!form) return
    Object.entries(u).forEach(([k, v]) => {
      const el = form.querySelector(`[name="${k}"]`)
      if (!el) return
      if (el.type === 'checkbox') {
        el.checked = Boolean(v)
      } else {
        el.value = v ?? ''
      }
    })
  },
  async confirmDelete(id, name) {
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="user-delete-modal">
        <div class="modal modal-sm">
          <div class="modal-header">
            <h3><i class="fas fa-trash" style="color:#dc2626"></i> Confirmer la suppression</h3>
            <button class="btn btn-outline btn-sm btn-icon" onclick="document.getElementById('user-delete-modal').remove()"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body">
            <p>Supprimer l'utilisateur <strong>${Utils.escape(name)}</strong> ?</p>
            <p style="color:#6b7280;font-size:0.9rem">Cette action supprimera définitivement le compte et est irréversible.</p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="document.getElementById('user-delete-modal').remove()">Annuler</button>
            <button class="btn btn-danger" onclick="window.Utilisateurs.delete(${id})">Supprimer</button>
          </div>
        </div>
      </div>
    `)
  },
  async delete(id) {
    try {
      await API.delete(`/users/${id}`)
      Toast.show('Utilisateur supprimé')
      document.getElementById('user-delete-modal')?.remove()
      await Utilisateurs.render()
    } catch (e) {
      document.getElementById('user-delete-modal')?.remove()
      Toast.show(e.response?.data?.error || 'Erreur', 'error')
    }
  }
}
window.Utilisateurs = Utilisateurs

// ============================================================
// MODULE 1 — REGISTRE JOURNALIER (Art. 7/29 Décret 2026-206)
// ============================================================
const RegistreJournalier = {
  async render(date = new Date().toISOString().split('T')[0]) {
    document.getElementById('page-content').innerHTML = `<div class="empty-state"><div class="spinner" style="margin:0 auto"></div></div>`
    const registre = await API.get(`/registre-journalier?date=${date}`)
    State.data.registreJournalier = registre
    const stats = await API.get(`/registre-journalier/stats/${date}`).catch(() => ({}))
    const today = new Date(date)
    document.getElementById('page-content').innerHTML = `
      <div class="page">
        <div class="section-header">
          <div>
            <h2><i class="fas fa-book-medical" style="color:#006B3C"></i> Registre Journalier</h2>
            <div style="font-size:0.78rem;color:#6b7280;margin-top:0.2rem"><i class="fas fa-gavel mr-1"></i>Art. 7 &amp; 29 — Décret N°2026-206 du 15 Avril 2026 (Annexe I)</div>
          </div>
          <div style="display:flex;gap:0.5rem;align-items:center">
            <input type="date" id="rj-date-filter" class="form-input" style="width:160px" value="${date}" onchange="RegistreJournalier.filterByDate(this.value)">
            <button class="btn btn-outline btn-sm" onclick="Print.registre(document.getElementById('rj-date-filter')?.value || '${date}')" title="Imprimer le registre du jour"><i class="fas fa-print"></i> Imprimer</button>
            <button class="btn btn-outline btn-sm" onclick="Export.registre(document.getElementById('rj-date-filter')?.value || '${date}')" title="Exporter en Excel"><i class="fas fa-file-excel" style="color:#217346"></i> Excel</button>
            <button class="btn btn-primary" onclick="RegistreJournalier.openModal()"><i class="fas fa-plus"></i> Enregistrer Visite</button>
          </div>
        </div>
        <!-- Stats du jour -->
        <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:0.75rem;margin-bottom:1rem">
          ${[
            {label:'Total visites',val:stats.total||0,color:'#006B3C',bg:'#d1fae5',icon:'fa-list'},
            {label:'Embauche',val:stats.embauche||0,color:'#3b82f6',bg:'#dbeafe',icon:'fa-door-open'},
            {label:'Périodique',val:stats.periodique||0,color:'#8b5cf6',bg:'#ede9fe',icon:'fa-redo'},
            {label:'Reprise',val:stats.reprise||0,color:'#f59e0b',bg:'#fef3c7',icon:'fa-arrow-right'},
            {label:'Spontanée',val:stats.spontanee||0,color:'#ef4444',bg:'#fee2e2',icon:'fa-walking'}
          ].map(s => `
            <div style="background:${s.bg};padding:0.75rem;border-radius:8px;text-align:center">
              <div style="font-size:1.5rem;font-weight:700;color:${s.color}">${s.val}</div>
              <div style="font-size:0.7rem;color:#4b5563"><i class="fas ${s.icon} mr-1"></i>${s.label}</div>
            </div>
          `).join('')}
        </div>
        <!-- Table registre -->
        <div class="card">
          <div class="card-header">
            <h3><i class="fas fa-list-ul" style="color:#006B3C"></i> Registre du ${Utils.formatDate(today)}</h3>
            <span style="font-size:0.78rem;color:#6b7280">${registre.length} entrée(s)</span>
          </div>
          ${registre.length === 0
            ? `<div class="empty-state"><i class="fas fa-book-open"></i><h3>Aucune visite enregistrée</h3><p>Cliquez sur "Enregistrer Visite" pour commencer</p></div>`
            : `<div class="card-body" style="padding:0">
              <table class="data-table">
                <thead><tr><th>Heure</th><th>Travailleur</th><th>Entreprise</th><th>Poste</th><th>Type</th><th>Aptitude</th><th>Médecin</th><th>Obs.</th><th>Actions</th></tr></thead>
                <tbody>
                  ${registre.map(r => `
                    <tr>
                      <td style="font-weight:600;color:#006B3C">${r.heure_arrivee||'-'}</td>
                      <td style="font-weight:600">${Utils.escape(r.nom_prenom)}</td>
                      <td>${Utils.escape(r.entreprise)||'-'}</td>
                      <td>${Utils.escape(r.poste_travail)||'-'}</td>
                      <td>${Utils.typeVisiteBadge(r.type_visite)}</td>
                      <td>${r.aptitude_conclue ? Utils.aptitudeBadge(r.aptitude_conclue) : '<span class="badge badge-gray">En cours</span>'}</td>
                      <td style="font-size:0.8rem">${Utils.escape(r.medecin_nom||'-')}</td>
                      <td style="font-size:0.78rem;max-width:120px;overflow:hidden;text-overflow:ellipsis">${Utils.escape(r.observations||'')}</td>
                      <td>
                        <div style="display:flex;gap:0.3rem">
                          <button class="btn btn-outline btn-sm" onclick="RegistreJournalier.openModal(${r.id})" title="Modifier"><i class="fas fa-edit"></i></button>
                          <button class="btn btn-outline btn-sm" onclick="Print.visite(${r.id})" title="Imprimer"><i class="fas fa-print"></i></button>
                          ${r.confirme_count && r.confirme_count > 0 ? `<button class="btn btn-outline btn-sm" disabled title="Confirmé"><i class="fas fa-check" style="color:#059669"></i></button>` : `<button class="btn btn-outline btn-sm" onclick="RegistreJournalier.confirm(${r.id})" title="Confirmer"><i class="fas fa-check"></i></button>`}
                          <button class="btn btn-danger btn-sm" onclick="RegistreJournalier.confirmDelete(${r.id}, ${Utils.jsStringLiteral(r.nom_prenom)})" title="Supprimer"><i class="fas fa-trash"></i></button>
                        </div>
                      </td>
                    </tr>`).join('')}
                </tbody>
              </table>
            </div>`}
        </div>
      </div>
    `
  },
  async filterByDate(date) {
    const registre = await API.get(`/registre-journalier?date=${date}`).catch(() => [])
    // Re-render with new date
    document.getElementById('rj-date-filter')?.setAttribute('value', date)
    await RegistreJournalier.render()
  },
  openModal(id) {
    const today = new Date().toISOString().split('T')[0]
    const entry = id ? (State.data.registreJournalier || []).find(r => Number(r.id) === Number(id)) : null
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="rj-modal">
        <div class="modal modal-md">
          <div class="modal-header">
            <h3><i class="fas fa-book-medical" style="color:#006B3C"></i> Enregistrement Registre Journalier</h3>
            <button class="btn btn-outline btn-sm btn-icon" onclick="document.getElementById('rj-modal').remove()"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body">
            <div style="background:#f0fdf4;padding:0.6rem 0.85rem;border-radius:6px;margin-bottom:1rem;font-size:0.78rem;color:#166534">
              <i class="fas fa-info-circle mr-1"></i> Art. 29 — Format Annexe I du décret. Chaque visite doit être inscrite dans le registre journalier.
            </div>
            <form id="rj-form">
              <input type="hidden" name="id" value="${entry ? entry.id : ''}">
              <div class="grid-2">
                <div class="form-group"><label class="form-label">Date *</label><input type="date" class="form-input" name="date_visite" value="${entry ? entry.date_visite : today}" required></div>
                <div class="form-group"><label class="form-label">Heure d'arrivée</label><input type="time" class="form-input" name="heure_arrivee" value="${entry ? entry.heure_arrivee || '' : ''}"></div>
                <div class="form-group" style="grid-column:1/-1"><label class="form-label">Nom &amp; Prénom du travailleur *</label><input class="form-input" name="nom_prenom" value="${entry ? Utils.escape(entry.nom_prenom) : ''}" required></div>
                <div class="form-group"><label class="form-label">Entreprise</label><input class="form-input" name="entreprise" value="${entry ? Utils.escape(entry.entreprise||'') : ''}"></div>
                <div class="form-group"><label class="form-label">Poste de travail</label><input class="form-input" name="poste_travail" value="${entry ? Utils.escape(entry.poste_travail||'') : ''}"></div>
                <div class="form-group"><label class="form-label">Type de visite *</label>
                  <select class="form-input" name="type_visite" required>
                    <option value="embauche" ${entry && entry.type_visite==='embauche' ? 'selected' : ''}>Embauche</option>
                    <option value="periodique" ${entry && entry.type_visite==='periodique' ? 'selected' : ''}>Périodique</option>
                    <option value="reprise" ${entry && entry.type_visite==='reprise' ? 'selected' : ''}>Reprise de travail</option>
                    <option value="spontanee" ${entry && entry.type_visite==='spontanee' ? 'selected' : ''}>Spontanée</option>
                    <option value="pre_reprise" ${entry && entry.type_visite==='pre_reprise' ? 'selected' : ''}>Pré-reprise</option>
                    <option value="tiers_temps" ${entry && entry.type_visite==='tiers_temps' ? 'selected' : ''}>Tiers-Temps</option>
                  </select>
                </div>
                <div class="form-group"><label class="form-label">Aptitude conclue</label>
                  <select class="form-input" name="aptitude_conclue">
                    <option value="" ${entry && !entry.aptitude_conclue ? 'selected' : ''}>En cours d'examen</option>
                    <option value="apte" ${entry && entry.aptitude_conclue==='apte' ? 'selected' : ''}>Apte</option>
                    <option value="apte_amenagement" ${entry && entry.aptitude_conclue==='apte_amenagement' ? 'selected' : ''}>Apte avec aménagement</option>
                    <option value="apte_temporaire" ${entry && entry.aptitude_conclue==='apte_temporaire' ? 'selected' : ''}>Apte temporaire</option>
                    <option value="inapte_temporaire" ${entry && entry.aptitude_conclue==='inapte_temporaire' ? 'selected' : ''}>Inapte temporaire</option>
                    <option value="inapte_definitif" ${entry && entry.aptitude_conclue==='inapte_definitif' ? 'selected' : ''}>Inapte définitif</option>
                  </select>
                </div>
                <div class="form-group"><label class="form-label">Motif</label><input class="form-input" name="motif"></div>
                <div class="form-group" style="grid-column:1/-1"><label class="form-label">Observations</label><textarea class="form-input" name="observations" rows="2">${entry ? Utils.escape(entry.observations||'') : ''}</textarea></div>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="document.getElementById('rj-modal').remove()">Annuler</button>
            <button class="btn btn-primary" onclick="RegistreJournalier.save()"><i class="fas fa-save"></i> ${entry ? 'Mettre à jour' : 'Enregistrer'}</button>
          </div>
        </div>
      </div>
    `)
  },
  async save() {
    const data = Object.fromEntries(new FormData(document.getElementById('rj-form')))
    data.medecin_id = State.user?.id
    const modal = document.getElementById('rj-modal')
    const submitBtn = modal?.querySelector('.modal-footer .btn.btn-primary')
    const originalBtnHtml = submitBtn?.innerHTML
    try {
      // Prevent double submission
      if (submitBtn) {
        submitBtn.setAttribute('disabled', 'disabled')
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enregistrement...'
      }

      if (data.id) {
        await API.put(`/registre-journalier/${data.id}`, data)
        Toast.show('Visite mise à jour dans le registre journalier')
      } else {
        await API.post('/registre-journalier', data)
        Toast.show('Visite enregistrée dans le registre journalier')
      }

      // Close modal immediately after successful save to avoid duplicate clicks
      modal?.remove()

      // Re-render but catch internal errors so we don't show a misleading error toast
      try { await RegistreJournalier.render() } catch(err) { console.error('Registre re-render failed', err) }
    } catch(e) {
      Toast.show(e.response?.data?.error || 'Erreur', 'error')
    } finally {
      if (submitBtn) {
        submitBtn.removeAttribute('disabled')
        if (originalBtnHtml) submitBtn.innerHTML = originalBtnHtml
      }
    }
  },
  async confirmDelete(id, label) {
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="rj-delete-modal">
        <div class="modal modal-sm">
          <div class="modal-header">
            <h3><i class="fas fa-trash" style="color:#dc2626"></i> Supprimer l'entrée</h3>
            <button class="btn btn-outline btn-sm btn-icon" onclick="document.getElementById('rj-delete-modal').remove()"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body">
            <p>Voulez-vous vraiment supprimer l'entrée du registre de <strong>${Utils.escape(label)}</strong> ?</p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="document.getElementById('rj-delete-modal').remove()">Annuler</button>
            <button class="btn btn-danger" onclick="RegistreJournalier.delete(${id})">Supprimer</button>
          </div>
        </div>
      </div>
    `)
  },
  async delete(id) {
    try {
      await API.delete(`/registre-journalier/${id}`)
      Toast.show('Entrée du registre supprimée')
      document.getElementById('rj-delete-modal')?.remove()
      await RegistreJournalier.render()
    } catch(e) { Toast.show(e.response?.data?.error || 'Erreur', 'error') }
  }
  ,
  async confirm(id) {
    if (!confirm('Confirmer cette entrée dans le registre ?')) return
    try {
      await API.post(`/registre-journalier/${id}/confirmer`, {})
      Toast.show('Entrée du registre confirmée')
      await RegistreJournalier.render()
    } catch(e) { Toast.show(e.response?.data?.error || 'Erreur', 'error') }
  }
}

// ============================================================
// MODULE 2 — CERTIFICATS D'APTITUDE (Art. 25-28 Décret 2026-206)
// ============================================================
const Certificats = {
  async render() {
    document.getElementById('page-content').innerHTML = `<div class="empty-state"><div class="spinner" style="margin:0 auto"></div></div>`
    const certs = await API.get('/certificats')
    State.data.certificats = certs
    const typeBadge = (t) => {
      const m = {aptitude:'badge-green',inaptitude_temporaire:'badge-orange',inaptitude_definitive:'badge-red',aptitude_amenagement:'badge-blue',aptitude_restriction:'badge-yellow'}
      const l = {aptitude:'Apte',inaptitude_temporaire:'Inapte Temp.',inaptitude_definitive:'Inapte Déf.',aptitude_amenagement:'Apte Amén.',aptitude_restriction:'Apte Restr.'}
      return `<span class="badge ${m[t]||'badge-gray'}">${l[t]||t}</span>`
    }
    const statutBadge = (s) => {
      const m = {valide:'badge-green',conteste:'badge-orange',annule:'badge-red',expire:'badge-gray'}
      return `<span class="badge ${m[s]||'badge-gray'}">${s}</span>`
    }
    document.getElementById('page-content').innerHTML = `
      <div class="page">
        <div class="section-header">
          <div>
            <h2><i class="fas fa-file-medical-alt" style="color:#006B3C"></i> Certificats d'Aptitude / Inaptitude</h2>
            <div style="font-size:0.78rem;color:#6b7280;margin-top:0.2rem"><i class="fas fa-gavel mr-1"></i>Art. 25-28 — Décret N°2026-206 — Inaptitude : 2 examens + étude poste obligatoires</div>
          </div>
          <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
            <button class="btn btn-outline btn-sm" onclick="Export.certificats()" title="Exporter en Excel"><i class="fas fa-file-excel" style="color:#217346"></i> Excel</button>
            <button class="btn btn-primary" onclick="Certificats.openModal()"><i class="fas fa-plus"></i> Émettre Certificat</button>
          </div>
        </div>
        <!-- Résumé légal -->
        <div style="background:#fffbeb;border:1px solid #f59e0b;border-radius:8px;padding:0.75rem 1rem;margin-bottom:1rem;font-size:0.8rem;color:#92400e">
          <i class="fas fa-balance-scale mr-1"></i>
          <strong>Art. 26</strong> : Toute inaptitude nécessite 2 examens médicaux espacés de 2 semaines + étude du poste.
          <strong style="margin-left:1rem">Art. 28</strong> : Contestation possible dans un délai de <strong>2 mois</strong> après notification.
        </div>
        <div class="card">
          ${certs.length === 0
            ? `<div class="empty-state"><i class="fas fa-file-medical-alt"></i><h3>Aucun certificat émis</h3></div>`
            : `<table class="data-table">
              <thead><tr><th>Travailleur</th><th>Date</th><th>Type</th><th>Validité</th><th>Statut</th><th>Étude poste</th><th>2 Examens</th><th>Contesté</th><th>Actions</th></tr></thead>
              <tbody>
                ${certs.map(c => `
                  <tr>
                    <td>
                      <div style="font-weight:600">${Utils.escape(c.prenom||'')} ${Utils.escape(c.nom||'')}</div>
                      <div style="font-size:0.72rem;color:#6b7280">${Utils.escape(c.entreprise||'-')}</div>
                    </td>
                    <td>${Utils.formatDate(c.date_emission)}</td>
                    <td>${typeBadge(c.type_certificat)}</td>
                    <td style="font-size:0.8rem">${c.date_expiration ? Utils.formatDate(c.date_expiration) : c.validite_jours+'j'}</td>
                    <td>${statutBadge(c.statut)}</td>
                    <td style="text-align:center">${c.etude_poste_realisee ? '<i class="fas fa-check-circle" style="color:#10b981"></i>' : '<i class="fas fa-times-circle" style="color:#d1d5db"></i>'}</td>
                    <td style="text-align:center">${c.deux_examens_realises ? '<i class="fas fa-check-circle" style="color:#10b981"></i>' : '<i class="fas fa-times-circle" style="color:#d1d5db"></i>'}</td>
                    <td style="text-align:center">${c.conteste ? `<span class="badge badge-orange" style="font-size:0.68rem">Oui<br><small>${Utils.formatDate(c.date_contestation)}</small></span>` : '<span class="badge badge-green" style="font-size:0.68rem">Non</span>'}</td>
                    <td>
                      <div style="display:flex;gap:0.3rem">
                        <button class="btn btn-outline btn-sm" onclick="Certificats.view(${c.id})" title="Voir"><i class="fas fa-eye"></i></button>
                        <button class="btn btn-outline btn-sm" onclick="Print.certificat(${c.id})" title="Imprimer le certificat"><i class="fas fa-print"></i></button>
                        <button class="btn btn-outline btn-sm" onclick="Certificats.openModal(${c.id})" title="Modifier"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-danger btn-sm" onclick="Certificats.confirmDelete(${c.id}, ${Utils.jsStringLiteral(c.prenom+' '+c.nom)})" title="Supprimer"><i class="fas fa-trash"></i></button>
                        <button class="btn btn-outline btn-sm" onclick="Certificats.envoyerEmail(${c.id})" title="Envoyer par email">Email</button>
                        ${!c.conteste && c.statut==='valide' ? `<button class="btn btn-outline btn-sm" style="color:#f59e0b;border-color:#f59e0b" onclick="Certificats.contester(${c.id})" title="Contester (Art.28)"><i class="fas fa-gavel"></i></button>` : ''}
                      </div>
                    </td>
                  </tr>`).join('')}
              </tbody>
            </table>`}
        </div>
      </div>
    `
  },
  async view(id) {
    const c = await API.get(`/certificats/${id}`).catch(() => null)
    if (!c) return
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="cert-view-modal">
        <div class="modal modal-md">
          <div class="modal-header">
            <h3><i class="fas fa-file-medical-alt" style="color:#006B3C"></i> Certificat N°${c.id}</h3>
            <button class="btn btn-outline btn-sm btn-icon" onclick="document.getElementById('cert-view-modal').remove()"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;font-size:0.85rem">
              <div><strong>Travailleur :</strong> ${Utils.escape(c.prenom||'')} ${Utils.escape(c.nom||'')}</div>
              <div><strong>Date émission :</strong> ${Utils.formatDate(c.date_emission)}</div>
              <div><strong>Type :</strong> ${Utils.escape(c.type_certificat)}</div>
              <div><strong>Aptitude :</strong> ${Utils.aptitudeBadge(c.aptitude)}</div>
              ${c.restrictions ? `<div style="grid-column:1/-1"><strong>Restrictions :</strong> ${Utils.escape(c.restrictions)}</div>` : ''}
              ${c.amenagements ? `<div style="grid-column:1/-1"><strong>Aménagements :</strong> ${Utils.escape(c.amenagements)}</div>` : ''}
              ${c.motif_inaptitude ? `<div style="grid-column:1/-1"><strong>Motif inaptitude :</strong> ${Utils.escape(c.motif_inaptitude)}</div>` : ''}
              <div><strong>Étude poste (Art.26) :</strong> ${c.etude_poste_realisee ? '✅ Réalisée' : '❌ Non réalisée'}</div>
              <div><strong>2 Examens (Art.26) :</strong> ${c.deux_examens_realises ? '✅ Réalisés' : '❌ Non réalisés'}</div>
              ${c.date_premier_examen ? `<div><strong>1er examen :</strong> ${Utils.formatDate(c.date_premier_examen)}</div>` : ''}
              ${c.date_second_examen ? `<div><strong>2ème examen :</strong> ${Utils.formatDate(c.date_second_examen)}</div>` : ''}
              <div><strong>Validité :</strong> ${c.date_expiration ? Utils.formatDate(c.date_expiration) : c.validite_jours+' jours'}</div>
              <div><strong>Statut :</strong> ${c.statut}</div>
              ${c.conteste ? `<div style="grid-column:1/-1;background:#fff7ed;padding:0.6rem;border-radius:6px;border:1px solid #f59e0b"><strong><i class="fas fa-gavel mr-1"></i>Contestation (Art.28) :</strong> Le ${Utils.formatDate(c.date_contestation)}<br>${Utils.escape(c.motif_contestation||'')}</div>` : ''}
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="document.getElementById('cert-view-modal').remove()">Fermer</button>
            <button class="btn btn-outline" onclick="Print.certificat(${c.id})" title="Imprimer le certificat"><i class="fas fa-print"></i> Imprimer</button>
            <button class="btn btn-primary" onclick="document.getElementById('vv-modal').remove();Visites.openModal(${id})"><i class="fas fa-edit"></i> Modifier</button>
          </div>
        </div>
      </div>
    `)
  },
  async contester(id) {
    const motif = prompt('Motif de la contestation (Art. 28 — délai max 2 mois après notification) :')
    if (!motif) return
    try {
      await API.post(`/certificats/${id}/contester`, { motif_contestation: motif })
      Toast.show('Contestation enregistrée (Art. 28)')
      await Certificats.render()
    } catch(e) { Toast.show(e.response?.data?.error || 'Erreur', 'error') }
  },
  async envoyerEmail(id) {
    const email = prompt("Adresse email du travailleur (laissez vide pour utiliser celle enregistrée dans son dossier) :")
    if (email === null) return
    try {
      await API.post(`/certificats/${id}/envoyer-email`, email ? { email } : {})
      Toast.show('Certificat envoyé par email')
    } catch(e) { Toast.show(e.response?.data?.error || "Échec de l'envoi", 'error') }
  },
  onTypeChange(val) {
    const sec = document.getElementById('art26-section')
    if (val && val.includes('inaptitude')) { sec.style.display = 'block' }
    else { sec.style.display = 'none' }
  },
  async openModal(id = null) {
    const existing = id ? (State.data.certificats || []).find(c => Number(c.id) === Number(id)) : null
    const cert = existing ? await API.get(`/certificats/${id}`).catch(() => existing) : null
    const values = cert || {}
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="cert-modal">
        <div class="modal modal-lg">
          <div class="modal-header">
            <h3><i class="fas fa-file-medical-alt" style="color:#006B3C"></i> ${id ? "Modifier le Certificat d'Aptitude" : "Émettre un Certificat d'Aptitude"}</h3>
            <button class="btn btn-outline btn-sm btn-icon" onclick="document.getElementById('cert-modal').remove()"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body">
            <div style="background:#fffbeb;border:1px solid #f59e0b;border-radius:6px;padding:0.6rem 0.85rem;margin-bottom:1rem;font-size:0.78rem;color:#92400e">
              <i class="fas fa-gavel mr-1"></i><strong>Art. 26 :</strong> Pour toute conclusion d'inaptitude (temporaire ou définitive), l'étude du poste ET deux examens médicaux espacés de 2 semaines sont OBLIGATOIRES.
            </div>
            <form id="cert-form">
              <input type="hidden" name="id" value="${values.id || ''}">
              <div class="grid-2">
                <div class="form-group" style="grid-column:1/-1"><label class="form-label">Travailleur (ID) *</label>
                  <input type="number" class="form-input" name="travailleur_id" placeholder="ID du travailleur" value="${values.travailleur_id || ''}" required>
                </div>
                <div class="form-group"><label class="form-label">Date d'émission *</label><input type="date" class="form-input" name="date_emission" value="${values.date_emission || new Date().toISOString().split('T')[0]}" required></div>
                <div class="form-group"><label class="form-label">Type de certificat *</label>
                  <select class="form-input" name="type_certificat" id="cert-type-select" required onchange="Certificats.onTypeChange(this.value)">
                    <option value="aptitude" ${values.type_certificat==='aptitude'?'selected':''}>Aptitude</option>
                    <option value="aptitude_amenagement" ${values.type_certificat==='aptitude_amenagement'?'selected':''}>Aptitude avec aménagement</option>
                    <option value="aptitude_restriction" ${values.type_certificat==='aptitude_restriction'?'selected':''}>Aptitude avec restriction</option>
                    <option value="inaptitude_temporaire" ${values.type_certificat==='inaptitude_temporaire'?'selected':''}>Inaptitude temporaire</option>
                    <option value="inaptitude_definitive" ${values.type_certificat==='inaptitude_definitive'?'selected':''}>Inaptitude définitive</option>
                  </select>
                </div>
                <div class="form-group" style="grid-column:1/-1"><label class="form-label">Conclusion d'aptitude *</label>
                  <select class="form-input" name="aptitude" required>
                    <option value="apte" ${values.aptitude==='apte'?'selected':''}>Apte</option>
                    <option value="apte_amenagement" ${values.aptitude==='apte_amenagement'?'selected':''}>Apte avec aménagement</option>
                    <option value="apte_temporaire" ${values.aptitude==='apte_temporaire'?'selected':''}>Apte temporaire</option>
                    <option value="inapte_temporaire" ${values.aptitude==='inapte_temporaire'?'selected':''}>Inapte temporaire</option>
                    <option value="inapte_definitif" ${values.aptitude==='inapte_definitif'?'selected':''}>Inapte définitif</option>
                  </select>
                </div>
                <div class="form-group" style="grid-column:1/-1"><label class="form-label">Restrictions</label><textarea class="form-input" name="restrictions" rows="2">${Utils.escape(values.restrictions||'')}</textarea></div>
                <div class="form-group" style="grid-column:1/-1"><label class="form-label">Aménagements de poste</label><textarea class="form-input" name="amenagements" rows="2">${Utils.escape(values.amenagements||'')}</textarea></div>
              </div>
              <div id="art26-section" style="display:${values.type_certificat && values.type_certificat.includes('inaptitude') ? 'block' : 'none'};border:2px solid #f59e0b;border-radius:8px;padding:1rem;margin-top:0.75rem">
                <div style="font-size:0.85rem;font-weight:700;color:#92400e;margin-bottom:0.75rem"><i class="fas fa-exclamation-triangle mr-1"></i>Obligations Art. 26 — Constat d'Inaptitude</div>
                <div class="grid-2">
                  <div class="form-group"><label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer"><input type="checkbox" name="etude_poste_realisee" value="1" ${values.etude_poste_realisee ? 'checked' : ''}> Étude du poste réalisée *</label></div>
                  <div class="form-group"><label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer"><input type="checkbox" name="deux_examens_realises" value="1" ${values.deux_examens_realises ? 'checked' : ''}> Deux examens médicaux réalisés *</label></div>
                  <div class="form-group"><label class="form-label">Date 1er examen</label><input type="date" class="form-input" name="date_premier_examen" value="${values.date_premier_examen||''}"></div>
                  <div class="form-group"><label class="form-label">Date 2ème examen (min +2 sem.)</label><input type="date" class="form-input" name="date_second_examen" value="${values.date_second_examen||''}"></div>
                  <div class="form-group" style="grid-column:1/-1"><label class="form-label">Motif d'inaptitude</label><textarea class="form-input" name="motif_inaptitude" rows="2">${Utils.escape(values.motif_inaptitude||'')}</textarea></div>
                  <div class="form-group" style="grid-column:1/-1"><label class="form-label">Suggestion de reclassement</label><input class="form-input" name="reclassement_suggere" value="${Utils.escape(values.reclassement_suggere||'')}"></div>
                </div>
              </div>
              <div class="grid-2 mt-3">
                <div class="form-group"><label class="form-label">Validité (jours)</label><input type="number" class="form-input" name="validite_jours" value="${values.validite_jours||365}"></div>
                <div class="form-group"><label class="form-label">Date d'expiration</label><input type="date" class="form-input" name="date_expiration" value="${values.date_expiration||''}"></div>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="document.getElementById('cert-modal').remove()">Annuler</button>
            <button class="btn btn-primary" onclick="Certificats.save(${id ? id : 'null'})"><i class="fas fa-save"></i> ${id ? 'Mettre à jour' : 'Émettre le Certificat'}</button>
          </div>
        </div>
      </div>
    `)
  },
  async save(id = null) {
    const form = document.getElementById('cert-form')
    const data = Object.fromEntries(new FormData(form))
    data.etude_poste_realisee = form.querySelector('[name="etude_poste_realisee"]')?.checked ? 1 : 0
    data.deux_examens_realises = form.querySelector('[name="deux_examens_realises"]')?.checked ? 1 : 0
    data.medecin_id = State.user?.id
    try {
      if (id) {
        await API.put(`/certificats/${id}`, data)
        Toast.show('Certificat mis à jour avec succès')
      } else {
        await API.post('/certificats', data)
        Toast.show('Certificat émis avec succès')
      }
      document.getElementById('cert-modal').remove()
      await Certificats.render()
    } catch(e) { Toast.show(e.response?.data?.error || e.message || 'Erreur', 'error') }
  },
  async confirmDelete(id, label) {
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="cert-delete-modal">
        <div class="modal modal-sm">
          <div class="modal-header">
            <h3><i class="fas fa-trash" style="color:#dc2626"></i> Supprimer le certificat</h3>
            <button class="btn btn-outline btn-sm btn-icon" onclick="document.getElementById('cert-delete-modal').remove()"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body">
            <p>Voulez-vous vraiment supprimer le certificat de <strong>${Utils.escape(label)}</strong> ?</p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="document.getElementById('cert-delete-modal').remove()">Annuler</button>
            <button class="btn btn-danger" onclick="Certificats.delete(${id})">Supprimer</button>
          </div>
        </div>
      </div>
    `)
  },
  async delete(id) {
    try {
      await API.delete(`/certificats/${id}`)
      Toast.show('Certificat supprimé')
      document.getElementById('cert-delete-modal')?.remove()
      await Certificats.render()
    } catch(e) { Toast.show(e.response?.data?.error || 'Erreur', 'error') }
  }
}

// ============================================================
// MODULE 3 — TIERS-TEMPS TECHNIQUE (Art. 6/14 Décret 2026-206)
// ============================================================
const TiersTemps = {
  TYPES: {
    visite_poste: 'Visite de poste',
    etude_ergonomique: 'Étude ergonomique',
    analyse_risques: 'Analyse des risques',
    formation_sst: 'Formation SST',
    enquete_accident: 'Enquête accident',
    investigation_maladie: 'Investigation maladie prof.',
    reunion_chsct: 'Réunion CHSCT',
    campagne_sensibilisation: 'Campagne sensibilisation',
    vaccination: 'Vaccination',
    bilan_collectif: 'Bilan collectif de santé',
    rapport_inspection: 'Rapport inspection',
    consultation_externe: 'Consultation externe',
    autre: 'Autre'
  },
  async render() {
    document.getElementById('page-content').innerHTML = `<div class="empty-state"><div class="spinner" style="margin:0 auto"></div></div>`
    const annee = new Date().getFullYear()
    const [missions, stats, entreprises] = await Promise.all([
      API.get('/tiers-temps'),
      API.get('/tiers-temps/stats'),
      API.get('/entreprises')
    ])
    State.data.tiersTemps = missions
    document.getElementById('page-content').innerHTML = `
      <div class="page">
        <div class="section-header">
          <div>
            <h2><i class="fas fa-hard-hat" style="color:#006B3C"></i> Tiers-Temps Technique</h2>
            <div style="font-size:0.78rem;color:#6b7280;margin-top:0.2rem"><i class="fas fa-gavel mr-1"></i>Art. 6 &amp; 14 — Décret N°2026-206 — 13 types de missions en entreprise</div>
          </div>
          <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
            <button class="btn btn-outline btn-sm" onclick="Export.tiersTemps()" title="Exporter en Excel"><i class="fas fa-file-excel" style="color:#217346"></i> Excel</button>
            <button class="btn btn-primary" onclick="TiersTemps.openModal()"><i class="fas fa-plus"></i> Saisir Mission</button>
          </div>
        </div>
        <!-- Stats annuelles -->
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1rem;margin-bottom:1rem">
          <div class="card" style="padding:1rem;text-align:center">
            <div style="font-size:2rem;font-weight:700;color:#006B3C">${stats.total_heures ? parseFloat(stats.total_heures).toFixed(1) : '0'}</div>
            <div style="font-size:0.8rem;color:#6b7280">Heures tiers-temps (${annee})</div>
          </div>
          <div class="card" style="padding:1rem;text-align:center">
            <div style="font-size:2rem;font-weight:700;color:#FF8C00">${stats.nb_missions||0}</div>
            <div style="font-size:0.8rem;color:#6b7280">Missions réalisées</div>
          </div>
          <div class="card" style="padding:1rem;text-align:center">
            <div style="font-size:2rem;font-weight:700;color:#3b82f6">${stats.nb_entreprises||0}</div>
            <div style="font-size:0.8rem;color:#6b7280">Entreprises visitées</div>
          </div>
        </div>
        <!-- Liste missions -->
        <div class="card">
          <div class="card-header"><h3><i class="fas fa-list" style="color:#006B3C"></i> Missions de terrain</h3></div>
          ${missions.length === 0
            ? `<div class="empty-state"><i class="fas fa-hard-hat"></i><h3>Aucune mission enregistrée</h3></div>`
            : `<table class="data-table">
              <thead><tr><th>Date</th><th>Entreprise</th><th>Type de mission</th><th>Durée</th><th>Participants</th><th>Résultats</th><th>Actions</th></tr></thead>
              <tbody>
                ${missions.map(m => `
                  <tr>
                    <td>${Utils.formatDate(m.date_mission)}</td>
                    <td style="font-weight:600">${Utils.escape(m.entreprise_nom||'-')}</td>
                    <td><span class="badge badge-blue" style="font-size:0.75rem">${TiersTemps.TYPES[m.type_mission]||m.type_mission}</span></td>
                    <td style="font-weight:600;color:#006B3C">${m.duree_heures}h</td>
                    <td style="font-size:0.8rem">${Utils.escape(m.participants||'-')}</td>
                    <td style="font-size:0.8rem;max-width:150px;overflow:hidden;text-overflow:ellipsis">${Utils.escape(m.resultats||'')}</td>
                    <td><div style="display:flex;gap:0.3rem"><button class="btn btn-outline btn-sm" onclick="TiersTemps.openModal(${m.id})" title="Modifier"><i class="fas fa-edit"></i></button><button class="btn btn-danger btn-sm" onclick="TiersTemps.confirmDelete(${m.id}, ${Utils.jsStringLiteral(m.entreprise_nom||m.type_mission)})" title="Supprimer"><i class="fas fa-trash"></i></button></div></td>
                  </tr>`).join('')}
              </tbody>
            </table>`}
        </div>
      </div>
    `
  },
  openModal(id) {
    const existing = id ? (State.data.tiersTemps || []).find(m => Number(m.id) === Number(id)) : null
    API.get('/entreprises').then(entreprises => {
      document.body.insertAdjacentHTML('beforeend', `
        <div class="modal-overlay" id="tt-modal">
          <div class="modal modal-lg">
            <div class="modal-header">
              <h3><i class="fas fa-hard-hat" style="color:#006B3C"></i> ${existing ? 'Modifier une Mission de Tiers-Temps' : 'Saisir une Mission de Tiers-Temps'}</h3>
              <button class="btn btn-outline btn-sm btn-icon" onclick="document.getElementById('tt-modal').remove()"><i class="fas fa-times"></i></button>
            </div>
            <div class="modal-body">
              <div style="background:#f0fdf4;padding:0.6rem 0.85rem;border-radius:6px;margin-bottom:1rem;font-size:0.78rem;color:#166534">
                <i class="fas fa-info-circle mr-1"></i> Art. 14 — Le médecin du travail consacre le tiers de son temps à des actions en milieu de travail.
              </div>
              <form id="tt-form">
                <input type="hidden" name="id" value="${existing ? existing.id : ''}">
                <div class="grid-2">
                  <div class="form-group"><label class="form-label">Entreprise *</label>
                    <select class="form-input" name="entreprise_id" required>
                      <option value="">Sélectionner</option>
                      ${entreprises.map(e => `<option value="${e.id}" ${existing && existing.entreprise_id === e.id ? 'selected' : ''}>${Utils.escape(e.nom)}</option>`).join('')}
                    </select>
                  </div>
                  <div class="form-group"><label class="form-label">Date de mission *</label><input type="date" class="form-input" name="date_mission" value="${existing ? existing.date_mission : new Date().toISOString().split('T')[0]}" required></div>
                  <div class="form-group"><label class="form-label">Type de mission *</label>
                    <select class="form-input" name="type_mission" required>
                      ${Object.entries(TiersTemps.TYPES).map(([k,v]) => `<option value="${k}" ${existing && existing.type_mission === k ? 'selected' : ''}>${v}</option>`).join('')}
                    </select>
                  </div>
                  <div class="form-group"><label class="form-label">Durée (heures) *</label><input type="number" step="0.5" class="form-input" name="duree_heures" min="0.5" value="${existing ? existing.duree_heures : 2}" required></div>
                  <div class="form-group" style="grid-column:1/-1"><label class="form-label">Description</label><textarea class="form-input" name="description" rows="2">${existing ? Utils.escape(existing.description||'') : ''}</textarea></div>
                  <div class="form-group"><label class="form-label">Participants</label><input class="form-input" name="participants" value="${existing ? Utils.escape(existing.participants||'') : ''}"></div>
                  <div class="form-group"><label class="form-label">Résultats obtenus</label><input class="form-input" name="resultats" value="${existing ? Utils.escape(existing.resultats||'') : ''}"></div>
                  <div class="form-group" style="grid-column:1/-1"><label class="form-label">Recommandations</label><textarea class="form-input" name="recommandations" rows="2">${existing ? Utils.escape(existing.recommandations||'') : ''}</textarea></div>
                </div>
              </form>
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline" onclick="document.getElementById('tt-modal').remove()">Annuler</button>
              <button class="btn btn-primary" onclick="TiersTemps.save(${existing ? existing.id : 'null'})"><i class="fas fa-save"></i> ${existing ? 'Mettre à jour' : 'Enregistrer'}</button>
            </div>
          </div>
        </div>
      `)
    })
  },
  async save(id) {
    const data = Object.fromEntries(new FormData(document.getElementById('tt-form')))
    data.medecin_id = State.user?.id
    try {
      if (id) {
        await API.put(`/tiers-temps/${id}`, data)
        Toast.show('Mission de tiers-temps mise à jour')
      } else {
        await API.post('/tiers-temps', data)
        Toast.show('Mission de tiers-temps enregistrée')
      }
      document.getElementById('tt-modal').remove()
      await TiersTemps.render()
    } catch(e) { Toast.show(e.response?.data?.error || 'Erreur', 'error') }
  },
  async confirmDelete(id, label) {
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="tt-delete-modal">
        <div class="modal modal-sm">
          <div class="modal-header">
            <h3><i class="fas fa-trash" style="color:#dc2626"></i> Supprimer la mission</h3>
            <button class="btn btn-outline btn-sm btn-icon" onclick="document.getElementById('tt-delete-modal').remove()"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body">
            <p>Supprimer la mission de <strong>${Utils.escape(label)}</strong> ?</p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="document.getElementById('tt-delete-modal').remove()">Annuler</button>
            <button class="btn btn-danger" onclick="TiersTemps.delete(${id})">Supprimer</button>
          </div>
        </div>
      </div>`)
  },
  async delete(id) {
    try {
      await API.delete(`/tiers-temps/${id}`)
      Toast.show('Mission de tiers-temps supprimée')
      document.getElementById('tt-delete-modal')?.remove()
      await TiersTemps.render()
    } catch(e) { Toast.show(e.response?.data?.error || 'Erreur', 'error') }
  }
}

// ============================================================
// MODULE 4 — MALADIES PROFESSIONNELLES & ACCIDENTS (Art. 11/30)
// ============================================================
const MaladiesAccidents = {
  async render() {
    document.getElementById('page-content').innerHTML = `<div class="empty-state"><div class="spinner" style="margin:0 auto"></div></div>`
    const events = await API.get('/maladies-accidents')
    State.data.maladiesAccidents = events
    const typeBadge = (t) => {
      const m = {maladie_professionnelle:'badge-red',accident_travail:'badge-orange',accident_trajet:'badge-yellow',maladie_non_professionnelle:'badge-gray'}
      const l = {maladie_professionnelle:'Maladie Pro.',accident_travail:'Accident Travail',accident_trajet:'Accident Trajet',maladie_non_professionnelle:'Maladie Non-Pro.'}
      return `<span class="badge ${m[t]||'badge-gray'}">${l[t]||t}</span>`
    }
    const statutBadge = (s) => {
      const m = {declare:'badge-blue',en_instruction:'badge-yellow',clos:'badge-gray',reconnu:'badge-green',rejete:'badge-red'}
      return `<span class="badge ${m[s]||'badge-gray'}">${s}</span>`
    }
    document.getElementById('page-content').innerHTML = `
      <div class="page">
        <div class="section-header">
          <div>
            <h2><i class="fas fa-virus" style="color:#006B3C"></i> Maladies Professionnelles &amp; Accidents du Travail</h2>
            <div style="font-size:0.78rem;color:#6b7280;margin-top:0.2rem"><i class="fas fa-gavel mr-1"></i>Art. 11, 14 &amp; 30 — Décret N°2026-206 — Déclaration obligatoire sous 24h</div>
          </div>
          <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
            <button class="btn btn-outline btn-sm" onclick="Export.maladies()" title="Exporter en Excel"><i class="fas fa-file-excel" style="color:#217346"></i> Excel</button>
            <button class="btn btn-primary" onclick="MaladiesAccidents.openModal()"><i class="fas fa-plus"></i> Nouvelle Déclaration</button>
          </div>
        </div>
        <!-- Alerte légale -->
        <div style="background:#fef2f2;border:1px solid #ef4444;border-radius:8px;padding:0.75rem 1rem;margin-bottom:1rem;font-size:0.8rem;color:#991b1b">
          <i class="fas fa-exclamation-triangle mr-1"></i>
          <strong>Art. 30 :</strong> Tout accident du travail ou maladie professionnelle doit être déclaré <strong>dans les 24 heures</strong> au médecin-chef et à l'inspection du travail.
        </div>
        <div class="card">
          ${events.length === 0
            ? `<div class="empty-state"><i class="fas fa-clipboard-check"></i><h3>Aucun événement déclaré</h3></div>`
            : `<table class="data-table">
              <thead><tr><th>Travailleur</th><th>Événement</th><th>Date</th><th>Déclaré 24h</th><th>Arrêt</th><th>Statut</th><th>Chef notifié</th><th>Actions</th></tr></thead>
              <tbody>
                ${events.map(e => `
                  <tr>
                    <td>
                      <div style="font-weight:600">${Utils.escape(e.prenom||'')} ${Utils.escape(e.nom||'')}</div>
                      <div style="font-size:0.72rem;color:#6b7280">${Utils.escape(e.entreprise||'-')}</div>
                    </td>
                    <td>${typeBadge(e.type_evenement)}</td>
                    <td>${Utils.formatDate(e.date_evenement)}</td>
                    <td style="text-align:center">${e.declare_24h ? '<span class="badge badge-green" style="font-size:0.7rem">✓ Oui</span>' : '<span class="badge badge-red" style="font-size:0.7rem">⚠ Non</span>'}</td>
                    <td>${e.arret_travail ? `<span class="badge badge-orange" style="font-size:0.7rem">${e.duree_arret_jours}j</span>` : '<span class="badge badge-green" style="font-size:0.7rem">Non</span>'}</td>
                    <td>${statutBadge(e.statut)}</td>
                    <td style="text-align:center">${e.medecin_chef_notifie ? '<i class="fas fa-check-circle" style="color:#10b981"></i>' : '<i class="fas fa-times-circle" style="color:#ef4444"></i>'}</td>
                    <td><div style="display:flex;gap:0.3rem"><button class="btn btn-outline btn-sm" onclick="MaladiesAccidents.openModal(${e.id})" title="Modifier"><i class="fas fa-edit"></i></button><button class="btn btn-danger btn-sm" onclick="MaladiesAccidents.confirmDelete(${e.id}, ${Utils.jsStringLiteral(e.prenom+' '+e.nom)})" title="Supprimer"><i class="fas fa-trash"></i></button></div></td>
                  </tr>`).join('')}
              </tbody>
            </table>`}
        </div>
      </div>
    `
  },
  openModal(id = null) {
    const existing = id ? (State.data.maladiesAccidents || []).find(e => Number(e.id) === Number(id)) : null
    API.get('/travailleurs').then(travailleurs => {
      const values = existing || {}
      document.body.insertAdjacentHTML('beforeend', `
        <div class="modal-overlay" id="ma-modal">
          <div class="modal modal-lg">
            <div class="modal-header">
              <h3><i class="fas fa-virus" style="color:#ef4444"></i> ${id ? 'Modifier la Déclaration' : 'Déclaration Maladie / Accident'}</h3>
              <button class="btn btn-outline btn-sm btn-icon" onclick="document.getElementById('ma-modal').remove()"><i class="fas fa-times"></i></button>
            </div>
            <div class="modal-body">
              <div style="background:#fef2f2;border:1px solid #ef4444;border-radius:6px;padding:0.6rem;margin-bottom:1rem;font-size:0.78rem;color:#991b1b">
                <i class="fas fa-clock mr-1"></i><strong>Délai légal 24h (Art. 30) :</strong> Cette déclaration doit être effectuée dans les 24 heures suivant la connaissance de l'événement.
              </div>
              <form id="ma-form">
                <input type="hidden" name="id" value="${values.id || ''}">
                <div class="grid-2">
                  <div class="form-group"><label class="form-label">Travailleur *</label>
                    <select class="form-input" name="travailleur_id" required>
                      <option value="">Sélectionner</option>
                      ${travailleurs.map(t => `<option value="${t.id}" ${values.travailleur_id === t.id ? 'selected' : ''}>${Utils.escape(t.prenom)} ${Utils.escape(t.nom)} (${Utils.escape(t.entreprise||'')})</option>`).join('')}
                    </select>
                  </div>
                  <div class="form-group"><label class="form-label">Type d'événement *</label>
                    <select class="form-input" name="type_evenement" required>
                      <option value="accident_travail" ${values.type_evenement==='accident_travail'?'selected':''}>Accident du travail</option>
                      <option value="maladie_professionnelle" ${values.type_evenement==='maladie_professionnelle'?'selected':''}>Maladie professionnelle</option>
                      <option value="accident_trajet" ${values.type_evenement==='accident_trajet'?'selected':''}>Accident de trajet</option>
                      <option value="maladie_non_professionnelle" ${values.type_evenement==='maladie_non_professionnelle'?'selected':''}>Maladie non professionnelle</option>
                    </select>
                  </div>
                  <div class="form-group"><label class="form-label">Date de l'événement *</label><input type="date" class="form-input" name="date_evenement" value="${values.date_evenement||''}" required></div>
                  <div class="form-group"><label class="form-label">Date de déclaration *</label><input type="date" class="form-input" name="date_declaration" value="${values.date_declaration||new Date().toISOString().split('T')[0]}" required></div>
                  <div class="form-group" style="grid-column:1/-1"><label class="form-label">Description *</label><textarea class="form-input" name="description" rows="3" required>${Utils.escape(values.description||'')}</textarea></div>
                  <div class="form-group"><label class="form-label">Siège de la lésion</label><input class="form-input" name="siege_lesion" value="${Utils.escape(values.siege_lesion||'')}"></div>
                  <div class="form-group"><label class="form-label">Nature de la lésion</label><input class="form-input" name="nature_lesion" value="${Utils.escape(values.nature_lesion||'')}"></div>
                  <div class="form-group"><label class="form-label">Circonstances</label><textarea class="form-input" name="circonstances" rows="2">${Utils.escape(values.circonstances||'')}</textarea></div>
                  <div class="form-group"><label class="form-label">Agent causal</label><input class="form-input" name="agent_causal" value="${Utils.escape(values.agent_causal||'')}"></div>
                  <div class="form-group"><label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer"><input type="checkbox" name="arret_travail" value="1" ${values.arret_travail ? 'checked' : ''}> Arrêt de travail prescrit</label></div>
                  <div class="form-group"><label class="form-label">Durée arrêt (jours)</label><input type="number" class="form-input" name="duree_arret_jours" value="${values.duree_arret_jours||0}" min="0"></div>
                  <div class="form-group"><label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer"><input type="checkbox" name="medecin_chef_notifie" value="1" ${values.medecin_chef_notifie ? 'checked' : ''}> Médecin-chef notifié ✓</label></div>
                  <div class="form-group"><label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer"><input type="checkbox" name="inspection_notifiee" value="1" ${values.inspection_notifiee ? 'checked' : ''}> Inspection du travail notifiée ✓</label></div>
                  <div class="form-group"><label class="form-label">Organisme Sécurité Sociale</label><input class="form-input" name="organisme_securite_sociale" value="${Utils.escape(values.organisme_securite_sociale||'')}"></div>
                  <div class="form-group"><label class="form-label">Numéro de déclaration</label><input class="form-input" name="numero_declaration" value="${Utils.escape(values.numero_declaration||'')}"></div>
                </div>
              </form>
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline" onclick="document.getElementById('ma-modal').remove()">Annuler</button>
              <button class="btn btn-primary" onclick="MaladiesAccidents.save(${id ? id : 'null'})"><i class="fas fa-save"></i> ${id ? 'Mettre à jour' : 'Déclarer'}</button>
            </div>
          </div>
        </div>
      `)
    })
  },
  async save(id = null) {
    const form = document.getElementById('ma-form')
    const data = Object.fromEntries(new FormData(form))
    data.arret_travail = form.querySelector('[name="arret_travail"]')?.checked ? 1 : 0
    data.medecin_chef_notifie = form.querySelector('[name="medecin_chef_notifie"]')?.checked ? 1 : 0
    data.inspection_notifiee = form.querySelector('[name="inspection_notifiee"]')?.checked ? 1 : 0
    data.medecin_id = State.user?.id
    try {
      if (id) {
        await API.put(`/maladies-accidents/${id}`, data)
        Toast.show('Déclaration mise à jour')
      } else {
        await API.post('/maladies-accidents', data)
        Toast.show('Déclaration enregistrée', 'success')
      }
      document.getElementById('ma-modal').remove()
      await MaladiesAccidents.render()
    } catch(e) { Toast.show(e.response?.data?.error || 'Erreur', 'error') }
  },
  async confirmDelete(id, label) {
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="ma-delete-modal">
        <div class="modal modal-sm">
          <div class="modal-header">
            <h3><i class="fas fa-trash" style="color:#dc2626"></i> Confirmer la suppression</h3>
            <button class="btn btn-outline btn-sm btn-icon" onclick="document.getElementById('ma-delete-modal').remove()"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body">
            <p>Supprimer la déclaration de <strong>${Utils.escape(label)}</strong> ?</p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="document.getElementById('ma-delete-modal').remove()">Annuler</button>
            <button class="btn btn-danger" onclick="MaladiesAccidents.delete(${id})">Supprimer</button>
          </div>
        </div>
      </div>`)
  },
  async delete(id) {
    try {
      await API.delete(`/maladies-accidents/${id}`)
      Toast.show('Déclaration supprimée')
      document.getElementById('ma-delete-modal')?.remove()
      await MaladiesAccidents.render()
    } catch(e) { Toast.show(e.response?.data?.error || 'Erreur', 'error') }
  }
}

// ============================================================
// MODULE 5 — FICHE D'ENTREPRISE / RISQUES PRO. (Art. 12/14/36)
// ============================================================
const FicheEntreprise = {
  CATEGORIES: { A:'A (>5000 - service autonome obligatoire)', B:'B (1000-5000)', C:'C (500-999)', D:'D (100-499)', E:'E (<100)' },
  async render() {
    document.getElementById('page-content').innerHTML = `<div class="empty-state"><div class="spinner" style="margin:0 auto"></div></div>`
    const entreprises = await API.get('/entreprises')
    document.getElementById('page-content').innerHTML = `
      <div class="page">
        <div class="section-header">
          <div>
            <h2><i class="fas fa-industry" style="color:#006B3C"></i> Fiches Risques Professionnels par Entreprise</h2>
            <div style="font-size:0.78rem;color:#6b7280;margin-top:0.2rem"><i class="fas fa-gavel mr-1"></i>Art. 12, 14 &amp; 36-40 — Décret N°2026-206 — Classification Art. 31</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:1rem">
          ${entreprises.map(e => `
            <div class="card" style="cursor:pointer;transition:transform 0.2s" onmouseenter="this.style.transform='translateY(-2px)'" onmouseleave="this.style.transform='none'">
              <div class="card-body">
                <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:0.75rem">
                  <div>
                    <div style="font-weight:700;font-size:1rem">${Utils.escape(e.nom)}</div>
                    <div style="font-size:0.8rem;color:#6b7280">${Utils.escape(e.secteur||'-')} · ${Utils.escape(e.ville||'-')}</div>
                  </div>
                  <div style="text-align:right">
                    <span class="badge ${e.categorie==='A'?'badge-red':e.categorie==='B'?'badge-orange':e.categorie==='C'?'badge-yellow':e.categorie==='D'?'badge-blue':'badge-gray'}" style="font-size:0.8rem">Cat. ${e.categorie||'C'}</span>
                    ${e.numero_agrement ? `<div style="font-size:0.68rem;color:#6b7280;margin-top:0.2rem">Agr. ${Utils.escape(e.numero_agrement)}</div>` : ''}
                  </div>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;font-size:0.78rem;margin-bottom:0.75rem">
                  <div><i class="fas fa-users mr-1" style="color:#6b7280"></i>Effectif: <strong>${e.effectif||'?'}</strong></div>
                  <div><i class="fas fa-tools mr-1" style="color:#6b7280"></i>Équip.: <strong>${e.type_equipement||'fixe'}</strong></div>
                  <div><i class="fas fa-network-wired mr-1" style="color:#6b7280"></i>Service: <strong>${e.type_service_sante||'autonome'}</strong></div>
                </div>
                ${e.risques_professionnels ? `<div style="font-size:0.75rem;background:#fef3c7;padding:0.4rem 0.6rem;border-radius:6px;margin-bottom:0.5rem"><i class="fas fa-exclamation-triangle mr-1" style="color:#f59e0b"></i>${Utils.escape(e.risques_professionnels)}</div>` : ''}
                <div style="display:flex;gap:0.5rem">
                  <button class="btn btn-primary btn-sm" onclick="FicheEntreprise.openFiche(${e.id})" style="flex:1"><i class="fas fa-edit"></i> Fiche Risques</button>
                  <button class="btn btn-outline btn-sm" onclick="FicheEntreprise.editCategorie(${e.id},'${e.categorie||'C'}')" title="Catégorie Art.31"><i class="fas fa-tag"></i></button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `
  },
  async editCategorie(id, current) {
    const e = await API.get(`/entreprises/${id}`)
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="cat-modal">
        <div class="modal modal-sm">
          <div class="modal-header">
            <h3><i class="fas fa-tag" style="color:#006B3C"></i> Classification Art. 31</h3>
            <button class="btn btn-outline btn-sm btn-icon" onclick="document.getElementById('cat-modal').remove()"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body">
            <div style="background:#f0fdf4;padding:0.6rem;border-radius:6px;margin-bottom:1rem;font-size:0.78rem;color:#166534">
              Art. 31 — Classification automatique selon l'effectif :<br>
              <strong>A</strong> &gt;5000 · <strong>B</strong> 1000-5000 · <strong>C</strong> 500-999 · <strong>D</strong> 100-499 · <strong>E</strong> &lt;100
            </div>
            <form id="cat-form">
              <div class="form-group"><label class="form-label">Effectif total</label><input type="number" class="form-input" name="effectif" value="${e.effectif||0}"></div>
              <div class="form-group"><label class="form-label">Type de service santé</label>
                <select class="form-input" name="type_service_sante">
                  <option value="autonome" ${e.type_service_sante==='autonome'?'selected':''}>Service autonome</option>
                  <option value="interentreprises" ${e.type_service_sante==='interentreprises'?'selected':''}>Service interentreprises</option>
                  <option value="convention" ${e.type_service_sante==='convention'?'selected':''}>Par convention</option>
                </select>
              </div>
              <div class="form-group"><label class="form-label">Type d'équipement (Art.36-40)</label>
                <select class="form-input" name="type_equipement">
                  <option value="fixe" ${e.type_equipement==='fixe'?'selected':''}>Local fixe</option>
                  <option value="mobile" ${e.type_equipement==='mobile'?'selected':''}>Unité mobile</option>
                  <option value="mixte" ${e.type_equipement==='mixte'?'selected':''}>Mixte</option>
                </select>
              </div>
              <div class="form-group"><label class="form-label">Numéro d'agrément</label><input class="form-input" name="numero_agrement" value="${Utils.escape(e.numero_agrement||'')}"></div>
              <div class="form-group"><label class="form-label">Risques professionnels principaux</label><textarea class="form-input" name="risques_professionnels" rows="3">${Utils.escape(e.risques_professionnels||'')}</textarea></div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="document.getElementById('cat-modal').remove()">Annuler</button>
            <button class="btn btn-primary" onclick="FicheEntreprise.saveCat(${id})"><i class="fas fa-save"></i> Enregistrer</button>
          </div>
        </div>
      </div>
    `)
  },
  async saveCat(id) {
    const data = Object.fromEntries(new FormData(document.getElementById('cat-form')))
    // Calcul catégorie automatique Art. 31
    const eff = parseInt(data.effectif)||0
    data.categorie = eff > 5000 ? 'A' : eff >= 1000 ? 'B' : eff >= 500 ? 'C' : eff >= 100 ? 'D' : 'E'
    try {
      await API.put(`/entreprises/${id}`, data)
      Toast.show(`Entreprise mise à jour — Catégorie ${data.categorie} (Art.31)`)
      document.getElementById('cat-modal').remove()
      await FicheEntreprise.render()
    } catch(e) { Toast.show(e.response?.data?.error || 'Erreur', 'error') }
  },
  async openFiche(id) {
    const [fiche, hist] = await Promise.all([
      API.get(`/fiche-entreprise/${id}`).catch(() => ({})),
      API.get(`/entreprises/${id}`).catch(() => ({}))
    ])
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="fiche-modal">
        <div class="modal modal-lg">
          <div class="modal-header">
            <h3><i class="fas fa-industry" style="color:#006B3C"></i> Fiche Risques Professionnels — ${Utils.escape(hist.nom||'Entreprise')}</h3>
            <button class="btn btn-outline btn-sm btn-icon" onclick="document.getElementById('fiche-modal').remove()"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body">
            <form id="fiche-form">
              <div class="grid-2">
                <div class="form-group"><label class="form-label">Date de mise à jour</label><input type="date" class="form-input" name="date_mise_a_jour" value="${(fiche.date_mise_a_jour||new Date().toISOString().split('T')[0])}" required></div>
                <div class="form-group"><label class="form-label">Effectif total</label><input type="number" class="form-input" name="effectif_total" value="${fiche.effectif_total||0}"></div>
                <div class="form-group"><label class="form-label">Effectif femmes</label><input type="number" class="form-input" name="effectif_femmes" value="${fiche.effectif_femmes||0}"></div>
                <div class="form-group"><label class="form-label">Effectif jeunes (&lt;25 ans)</label><input type="number" class="form-input" name="effectif_jeunes" value="${fiche.effectif_jeunes||0}"></div>
                <div class="form-group"><label class="form-label">Effectif handicapés</label><input type="number" class="form-input" name="effectif_handicapes" value="${fiche.effectif_handicapes||0}"></div>
                <div class="form-group"><label class="form-label">Postes à risque</label><input class="form-input" name="postes_risque" value="${Utils.escape(fiche.postes_risque||'')}"></div>
              </div>
              <div style="font-size:0.85rem;font-weight:600;margin:1rem 0 0.5rem">Identification des risques professionnels</div>
              <div class="grid-2">
                <div class="form-group"><label class="form-label"><i class="fas fa-flask mr-1" style="color:#ef4444"></i>Risques chimiques</label><textarea class="form-input" name="risques_chimiques" rows="2">${Utils.escape(fiche.risques_chimiques||'')}</textarea></div>
                <div class="form-group"><label class="form-label"><i class="fas fa-bolt mr-1" style="color:#f59e0b"></i>Risques physiques</label><textarea class="form-input" name="risques_physiques" rows="2">${Utils.escape(fiche.risques_physiques||'')}</textarea></div>
                <div class="form-group"><label class="form-label"><i class="fas fa-bug mr-1" style="color:#8b5cf6"></i>Risques biologiques</label><textarea class="form-input" name="risques_biologiques" rows="2">${Utils.escape(fiche.risques_biologiques||'')}</textarea></div>
                <div class="form-group"><label class="form-label"><i class="fas fa-chair mr-1" style="color:#3b82f6"></i>Risques ergonomiques</label><textarea class="form-input" name="risques_ergonomiques" rows="2">${Utils.escape(fiche.risques_ergonomiques||'')}</textarea></div>
                <div class="form-group"><label class="form-label"><i class="fas fa-brain mr-1" style="color:#ec4899"></i>Risques psychosociaux</label><textarea class="form-input" name="risques_psychosociaux" rows="2">${Utils.escape(fiche.risques_psychosociaux||'')}</textarea></div>
                <div class="form-group"><label class="form-label"><i class="fas fa-hard-hat mr-1" style="color:#006B3C"></i>EPI fournis</label><textarea class="form-input" name="epi_fournis" rows="2">${Utils.escape(fiche.epi_fournis||'')}</textarea></div>
              </div>
              <div class="form-group"><label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer"><input type="checkbox" name="formation_securite" value="1" ${fiche.formation_securite ? 'checked' : ''}> Formation sécurité réalisée</label></div>
              <div class="form-group"><label class="form-label">Plan de prévention</label><textarea class="form-input" name="plan_prevention" rows="3">${Utils.escape(fiche.plan_prevention||'')}</textarea></div>
              <div class="form-group"><label class="form-label">Observations</label><textarea class="form-input" name="observations" rows="2">${Utils.escape(fiche.observations||'')}</textarea></div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="document.getElementById('fiche-modal').remove()">Annuler</button>
            <button class="btn btn-primary" onclick="FicheEntreprise.saveFiche(${id})"><i class="fas fa-save"></i> Enregistrer la Fiche</button>
          </div>
        </div>
      </div>
    `)
  },
  async saveFiche(id) {
    const form = document.getElementById('fiche-form')
    const data = Object.fromEntries(new FormData(form))
    data.formation_securite = form.querySelector('[name="formation_securite"]')?.checked ? 1 : 0
    data.medecin_id = State.user?.id
    try {
      await API.post(`/fiche-entreprise/${id}`, data)
      Toast.show('Fiche risques enregistrée')
      document.getElementById('fiche-modal').remove()
    } catch(e) { Toast.show(e.response?.data?.error || 'Erreur', 'error') }
  }
}

// ============================================================
// MODULE 6 — RAPPORTS ANNUELS (Art. 30.1 Décret 2026-206)
// ============================================================
const RapportsAnnuels = {
  async render() {
    document.getElementById('page-content').innerHTML = `<div class="empty-state"><div class="spinner" style="margin:0 auto"></div></div>`
    const rapports = await API.get('/rapports-annuels')
    State.data.rapportsAnnuels = rapports
    const statutBadge = (s) => {
      const m = {brouillon:'badge-gray',finalise:'badge-blue',transmis:'badge-green'}
      const l = {brouillon:'Brouillon',finalise:'Finalisé',transmis:'Transmis'}
      return `<span class="badge ${m[s]||'badge-gray'}">${l[s]||s}</span>`
    }
    document.getElementById('page-content').innerHTML = `
      <div class="page">
        <div class="section-header">
          <div>
            <h2><i class="fas fa-chart-bar" style="color:#006B3C"></i> Rapports Annuels d'Activité</h2>
            <div style="font-size:0.78rem;color:#6b7280;margin-top:0.2rem"><i class="fas fa-gavel mr-1"></i>Art. 30.1 — Décret N°2026-206 — Obligation annuelle de rapport à l'inspecteur du travail</div>
          </div>
          <div style="display:flex;gap:0.5rem">
            <button class="btn btn-outline" onclick="RapportsAnnuels.generer()"><i class="fas fa-magic"></i> Générer Auto.</button>
            <button class="btn btn-primary" onclick="RapportsAnnuels.openModal()"><i class="fas fa-plus"></i> Nouveau Rapport</button>
          </div>
        </div>
        <!-- Info légale -->
        <div style="background:#f0fdf4;border:1px solid #006B3C;border-radius:8px;padding:0.75rem 1rem;margin-bottom:1rem;font-size:0.8rem;color:#166534">
          <i class="fas fa-info-circle mr-1"></i>
          <strong>Art. 30.1</strong> : Le rapport annuel doit être rédigé par le médecin-chef et transmis à l'inspecteur du travail du ressort avant le 31 mars de l'année suivante.
        </div>
        <div class="card">
          ${rapports.length === 0
            ? `<div class="empty-state"><i class="fas fa-chart-bar"></i><h3>Aucun rapport disponible</h3><p>Cliquez sur "Générer Auto." pour créer automatiquement un rapport basé sur les données existantes</p></div>`
            : `<table class="data-table">
              <thead><tr><th>Année</th><th>Travailleurs</th><th>Visites</th><th>Aptes</th><th>Inaptes</th><th>Acc./Mal. Pro.</th><th>Statut</th><th>Transmis le</th><th>Actions</th></tr></thead>
              <tbody>
                ${rapports.map(r => `
                  <tr>
                    <td style="font-weight:700;font-size:1.1rem;color:#006B3C">${r.annee}</td>
                    <td>${r.nb_travailleurs_suivis}</td>
                    <td>${r.nb_visites_total}</td>
                    <td><span class="badge badge-green" style="font-size:0.72rem">${r.nb_aptes}</span></td>
                    <td><span class="badge badge-red" style="font-size:0.72rem">${(r.nb_inaptes_temporaires||0)+(r.nb_inaptes_definitifs||0)}</span></td>
                    <td>${r.nb_accidents_travail||0} acc. / ${r.nb_maladies_pro||0} mal.</td>
                    <td>${statutBadge(r.statut)}</td>
                    <td>${r.date_transmission ? Utils.formatDate(r.date_transmission) : '-'}</td>
                    <td>
                      <div style="display:flex;gap:0.3rem">
                        <button class="btn btn-outline btn-sm" onclick="RapportsAnnuels.openEdit(${r.id})" title="Éditer"><i class="fas fa-edit"></i></button>
                        ${r.statut !== 'transmis' ? `<button class="btn btn-outline btn-sm" style="color:#006B3C;border-color:#006B3C" onclick="RapportsAnnuels.transmettre(${r.id})" title="Marquer transmis"><i class="fas fa-paper-plane"></i></button>` : ''}
                        ${r.statut !== 'transmis' ? `<button class="btn btn-danger btn-sm" onclick="RapportsAnnuels.confirmDelete(${r.id}, ${Utils.jsStringLiteral('Rapport '+r.annee)})" title="Supprimer"><i class="fas fa-trash"></i></button>` : ''}
                      </div>
                    </td>
                  </tr>`).join('')}
              </tbody>
            </table>`}
        </div>
      </div>
    `
  },
  async generer() {
    const annee = prompt('Année du rapport à générer :', new Date().getFullYear())
    if (!annee) return
    try {
      const res = await API.post('/rapports-annuels/generer', { annee: parseInt(annee) })
      Toast.show(`Rapport ${annee} généré automatiquement`)
      await RapportsAnnuels.render()
    } catch(e) { Toast.show(e.response?.data?.error || 'Erreur', 'error') }
  },
  async transmettre(id) {
    if (!confirm('Confirmer la transmission de ce rapport à l\'Inspecteur du Travail (Art. 30.1) ?')) return
    try {
      await API.post(`/rapports-annuels/${id}/transmettre`, {})
      Toast.show('Rapport marqué comme transmis à l\'Inspecteur du Travail')
      await RapportsAnnuels.render()
    } catch(e) { Toast.show(e.response?.data?.error || 'Erreur', 'error') }
  },
  async confirmDelete(id, label) {
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="ra-delete-modal">
        <div class="modal modal-sm">
          <div class="modal-header">
            <h3><i class="fas fa-trash" style="color:#dc2626"></i> Supprimer le rapport</h3>
            <button class="btn btn-outline btn-sm btn-icon" onclick="document.getElementById('ra-delete-modal').remove()"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body">
            <p>Supprimer le rapport <strong>${Utils.escape(label)}</strong> ?</p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="document.getElementById('ra-delete-modal').remove()">Annuler</button>
            <button class="btn btn-danger" onclick="RapportsAnnuels.delete(${id})">Supprimer</button>
          </div>
        </div>
      </div>`)
  },
  async delete(id) {
    try {
      await API.delete(`/rapports-annuels/${id}`)
      Toast.show('Rapport annuel supprimé')
      document.getElementById('ra-delete-modal')?.remove()
      await RapportsAnnuels.render()
    } catch(e) { Toast.show(e.response?.data?.error || 'Erreur', 'error') }
  },
  openModal() {
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="ra-modal">
        <div class="modal modal-lg">
          <div class="modal-header">
            <h3><i class="fas fa-chart-bar" style="color:#006B3C"></i> Nouveau Rapport Annuel</h3>
            <button class="btn btn-outline btn-sm btn-icon" onclick="document.getElementById('ra-modal').remove()"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body">
            <form id="ra-form">
              <div class="grid-2">
                <div class="form-group"><label class="form-label">Année *</label><input type="number" class="form-input" name="annee" value="${new Date().getFullYear()}" required></div>
                <div class="form-group"><label class="form-label">Statut</label>
                  <select class="form-input" name="statut">
                    <option value="brouillon">Brouillon</option>
                    <option value="finalise">Finalisé</option>
                  </select>
                </div>
                <div class="form-group"><label class="form-label">Nb travailleurs suivis</label><input type="number" class="form-input" name="nb_travailleurs_suivis" value="0"></div>
                <div class="form-group"><label class="form-label">Nb visites total</label><input type="number" class="form-input" name="nb_visites_total" value="0"></div>
                <div class="form-group"><label class="form-label">Nb visites embauche</label><input type="number" class="form-input" name="nb_visites_embauche" value="0"></div>
                <div class="form-group"><label class="form-label">Nb visites périodiques</label><input type="number" class="form-input" name="nb_visites_periodiques" value="0"></div>
                <div class="form-group"><label class="form-label">Nb aptes</label><input type="number" class="form-input" name="nb_aptes" value="0"></div>
                <div class="form-group"><label class="form-label">Nb inaptes (total)</label><input type="number" class="form-input" name="nb_inaptes_definitifs" value="0"></div>
                <div class="form-group"><label class="form-label">Nb maladies pro.</label><input type="number" class="form-input" name="nb_maladies_pro" value="0"></div>
                <div class="form-group"><label class="form-label">Nb accidents travail</label><input type="number" class="form-input" name="nb_accidents_travail" value="0"></div>
                <div class="form-group" style="grid-column:1/-1"><label class="form-label">Principaux risques identifiés</label><textarea class="form-input" name="principaux_risques" rows="3"></textarea></div>
                <div class="form-group" style="grid-column:1/-1"><label class="form-label">Actions de prévention menées</label><textarea class="form-input" name="actions_prevention" rows="3"></textarea></div>
                <div class="form-group" style="grid-column:1/-1"><label class="form-label">Observations générales</label><textarea class="form-input" name="observations_generales" rows="3"></textarea></div>
                <div class="form-group" style="grid-column:1/-1"><label class="form-label">Recommandations</label><textarea class="form-input" name="recommandations" rows="3"></textarea></div>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="document.getElementById('ra-modal').remove()">Annuler</button>
            <button class="btn btn-primary" onclick="RapportsAnnuels.save()"><i class="fas fa-save"></i> Enregistrer</button>
          </div>
        </div>
      </div>
    `)
  },
  async openEdit(id) {
    const r = await API.get('/rapports-annuels').then(list => list.find(x => x.id === id))
    if (!r) return
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="ra-edit-modal">
        <div class="modal modal-lg">
          <div class="modal-header">
            <h3><i class="fas fa-edit" style="color:#006B3C"></i> Rapport ${r.annee}</h3>
            <button class="btn btn-outline btn-sm btn-icon" onclick="document.getElementById('ra-edit-modal').remove()"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body">
            <form id="ra-edit-form">
              <div class="form-group"><label class="form-label">Principaux risques</label><textarea class="form-input" name="principaux_risques" rows="3">${Utils.escape(r.principaux_risques||'')}</textarea></div>
              <div class="form-group"><label class="form-label">Actions de prévention</label><textarea class="form-input" name="actions_prevention" rows="3">${Utils.escape(r.actions_prevention||'')}</textarea></div>
              <div class="form-group"><label class="form-label">Bilan examens complémentaires</label><textarea class="form-input" name="bilan_examens_compl" rows="2">${Utils.escape(r.bilan_examens_compl||'')}</textarea></div>
              <div class="form-group"><label class="form-label">Observations générales</label><textarea class="form-input" name="observations_generales" rows="3">${Utils.escape(r.observations_generales||'')}</textarea></div>
              <div class="form-group"><label class="form-label">Recommandations</label><textarea class="form-input" name="recommandations" rows="3">${Utils.escape(r.recommandations||'')}</textarea></div>
              <div class="form-group"><label class="form-label">Statut</label>
                <select class="form-input" name="statut">
                  <option value="brouillon" ${r.statut==='brouillon'?'selected':''}>Brouillon</option>
                  <option value="finalise" ${r.statut==='finalise'?'selected':''}>Finalisé</option>
                </select>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="document.getElementById('ra-edit-modal').remove()">Annuler</button>
            <button class="btn btn-primary" onclick="RapportsAnnuels.update(${id})"><i class="fas fa-save"></i> Mettre à jour</button>
          </div>
        </div>
      </div>
    `)
  },
  async save() {
    const data = Object.fromEntries(new FormData(document.getElementById('ra-form')))
    data.medecin_chef_id = State.user?.id
    try {
      await API.post('/rapports-annuels', data)
      Toast.show('Rapport annuel créé')
      document.getElementById('ra-modal').remove()
      await RapportsAnnuels.render()
    } catch(e) { Toast.show(e.response?.data?.error || 'Erreur', 'error') }
  },
  async update(id) {
    const data = Object.fromEntries(new FormData(document.getElementById('ra-edit-form')))
    try {
      await API.put(`/rapports-annuels/${id}`, data)
      Toast.show('Rapport mis à jour')
      document.getElementById('ra-edit-modal').remove()
      await RapportsAnnuels.render()
    } catch(e) { Toast.show(e.response?.data?.error || 'Erreur', 'error') }
  }
}

// ============================================================
// MODULE 7 — COMPTES-RENDUS TRIMESTRIELS (Art. 30.2 Décret 2026-206)
// ============================================================
const ComptesRendus = {
  trimLabel(t) {
    return ['','1er trimestre','2ème trimestre','3ème trimestre','4ème trimestre'][t] || t
  },
  async render() {
    document.getElementById('page-content').innerHTML = `<div class="empty-state"><div class="spinner" style="margin:0 auto"></div></div>`
    const crs = await API.get('/comptes-rendus')
    State.data.compteRendus = crs
    const statutBadge = (s) => {
      const m = {brouillon:'badge-gray',finalise:'badge-blue',transmis:'badge-green'}
      const l = {brouillon:'Brouillon',finalise:'Finalisé',transmis:'Transmis'}
      return `<span class="badge ${m[s]||'badge-gray'}">${l[s]||s}</span>`
    }
    document.getElementById('page-content').innerHTML = `
      <div class="page">
        <div class="section-header">
          <div>
            <h2><i class="fas fa-clipboard-list" style="color:#006B3C"></i> Comptes-Rendus Trimestriels</h2>
            <div style="font-size:0.78rem;color:#6b7280;margin-top:0.2rem"><i class="fas fa-gavel mr-1"></i>Art. 30.2 — Décret N°2026-206 — 4 comptes-rendus par an, remis à la direction</div>
          </div>
          <button class="btn btn-primary" onclick="ComptesRendus.openModal()"><i class="fas fa-plus"></i> Nouveau Compte-Rendu</button>
        </div>
        <div style="background:#eff6ff;border:1px solid #3b82f6;border-radius:8px;padding:0.75rem 1rem;margin-bottom:1rem;font-size:0.8rem;color:#1e40af">
          <i class="fas fa-calendar-alt mr-1"></i>
          <strong>Art. 30.2</strong> : Le médecin du travail remet chaque trimestre un compte-rendu de son activité à la direction de l'entreprise.
        </div>
        <div class="card">
          ${crs.length === 0
            ? `<div class="empty-state"><i class="fas fa-clipboard"></i><h3>Aucun compte-rendu disponible</h3></div>`
            : `<table class="data-table">
              <thead><tr><th>Période</th><th>Entreprise</th><th>Visites</th><th>Tiers-Temps</th><th>Pathologies</th><th>Faits Marquants</th><th>Statut</th><th>Actions</th></tr></thead>
              <tbody>
                ${crs.map(c => `
                  <tr>
                    <td>
                      <div style="font-weight:700;color:#3b82f6">${this.trimLabel(c.trimestre)} ${c.annee}</div>
                    </td>
                    <td>${Utils.escape(c.entreprise_nom||'Tous')}</td>
                    <td>${c.nb_visites}</td>
                    <td>${c.nb_tiers_temps_heures}h</td>
                    <td>${c.nb_pathologies_detectees}</td>
                    <td style="font-size:0.8rem;max-width:180px;overflow:hidden;text-overflow:ellipsis">${Utils.escape(c.faits_marquants||'-')}</td>
                    <td>${statutBadge(c.statut)}</td>
                    <td>
                      <div style="display:flex;gap:0.3rem">
                        <button class="btn btn-outline btn-sm" onclick="ComptesRendus.view(${c.id})" title="Voir"><i class="fas fa-eye"></i></button>
                        <button class="btn btn-outline btn-sm" onclick="ComptesRendus.openEdit(${c.id})" title="Modifier"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-danger btn-sm" onclick="ComptesRendus.confirmDelete(${c.id}, ${Utils.jsStringLiteral(`CR ${c.annee} T${c.trimestre}`)})" title="Supprimer"><i class="fas fa-trash"></i></button>
                      </div>
                    </td>
                  </tr>`).join('')}
              </tbody>
            </table>`}
        </div>
      </div>
    `
  },
  async view(id) {
    const crs = await API.get('/comptes-rendus').then(list => list.find(x => x.id === id))
    if (!crs) return
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="cr-view">
        <div class="modal modal-md">
          <div class="modal-header">
            <h3><i class="fas fa-clipboard-list" style="color:#006B3C"></i> CR Trim. — ${this.trimLabel(crs.trimestre)} ${crs.annee}</h3>
            <button class="btn btn-outline btn-sm btn-icon" onclick="document.getElementById('cr-view').remove()"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body" style="font-size:0.85rem">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:1rem">
              <div><strong>Visites réalisées :</strong> ${crs.nb_visites}</div>
              <div><strong>Tiers-Temps :</strong> ${crs.nb_tiers_temps_heures}h</div>
              <div><strong>Pathologies détectées :</strong> ${crs.nb_pathologies_detectees}</div>
              <div><strong>Statut :</strong> ${crs.statut}</div>
            </div>
            ${crs.faits_marquants ? `<div class="mb-3"><strong>Faits marquants :</strong><p style="margin-top:0.3rem;color:#374151">${Utils.escape(crs.faits_marquants)}</p></div>` : ''}
            ${crs.actions_menees ? `<div class="mb-3"><strong>Actions menées :</strong><p style="margin-top:0.3rem;color:#374151">${Utils.escape(crs.actions_menees)}</p></div>` : ''}
            ${crs.points_vigilance ? `<div class="mb-3"><strong>Points de vigilance :</strong><p style="margin-top:0.3rem;color:#374151">${Utils.escape(crs.points_vigilance)}</p></div>` : ''}
          </div>
          <div class="modal-footer"><button class="btn btn-outline" onclick="document.getElementById('cr-view').remove()">Fermer</button></div>
        </div>
      </div>
    `)
  },
  openModal() {
    API.get('/entreprises').then(entreprises => {
      document.body.insertAdjacentHTML('beforeend', `
        <div class="modal-overlay" id="cr-modal">
          <div class="modal modal-lg">
            <div class="modal-header">
              <h3><i class="fas fa-clipboard-list" style="color:#006B3C"></i> Nouveau Compte-Rendu Trimestriel</h3>
              <button class="btn btn-outline btn-sm btn-icon" onclick="document.getElementById('cr-modal').remove()"><i class="fas fa-times"></i></button>
            </div>
            <div class="modal-body">
              <form id="cr-form">
                <div class="grid-2">
                  <div class="form-group"><label class="form-label">Année *</label><input type="number" class="form-input" name="annee" value="${new Date().getFullYear()}" required></div>
                  <div class="form-group"><label class="form-label">Trimestre *</label>
                    <select class="form-input" name="trimestre" required>
                      <option value="1">1er trimestre (Jan-Mar)</option>
                      <option value="2">2ème trimestre (Avr-Jun)</option>
                      <option value="3">3ème trimestre (Jul-Sep)</option>
                      <option value="4">4ème trimestre (Oct-Déc)</option>
                    </select>
                  </div>
                  <div class="form-group"><label class="form-label">Entreprise (optionnel)</label>
                    <select class="form-input" name="entreprise_id">
                      <option value="">Toutes les entreprises</option>
                      ${entreprises.map(e => `<option value="${e.id}">${Utils.escape(e.nom)}</option>`).join('')}
                    </select>
                  </div>
                  <div class="form-group"><label class="form-label">Nb visites réalisées</label><input type="number" class="form-input" name="nb_visites" value="0"></div>
                  <div class="form-group"><label class="form-label">Heures tiers-temps</label><input type="number" step="0.5" class="form-input" name="nb_tiers_temps_heures" value="0"></div>
                  <div class="form-group"><label class="form-label">Nb pathologies détectées</label><input type="number" class="form-input" name="nb_pathologies_detectees" value="0"></div>
                  <div class="form-group" style="grid-column:1/-1"><label class="form-label">Faits marquants du trimestre</label><textarea class="form-input" name="faits_marquants" rows="3"></textarea></div>
                  <div class="form-group" style="grid-column:1/-1"><label class="form-label">Actions menées</label><textarea class="form-input" name="actions_menees" rows="3"></textarea></div>
                  <div class="form-group" style="grid-column:1/-1"><label class="form-label">Points de vigilance</label><textarea class="form-input" name="points_vigilance" rows="2"></textarea></div>
                  <div class="form-group"><label class="form-label">Statut</label>
                    <select class="form-input" name="statut">
                      <option value="brouillon">Brouillon</option>
                      <option value="finalise">Finalisé</option>
                      <option value="transmis">Transmis à la direction</option>
                    </select>
                  </div>
                </div>
              </form>
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline" onclick="document.getElementById('cr-modal').remove()">Annuler</button>
              <button class="btn btn-primary" onclick="ComptesRendus.save()"><i class="fas fa-save"></i> Enregistrer</button>
            </div>
          </div>
        </div>
      `)
    })
  },
  async save() {
    const data = Object.fromEntries(new FormData(document.getElementById('cr-form')))
    data.medecin_id = State.user?.id
    try {
      await API.post('/comptes-rendus', data)
      Toast.show('Compte-rendu trimestriel créé')
      document.getElementById('cr-modal').remove()
      await ComptesRendus.render()
    } catch(e) { Toast.show(e.response?.data?.error || 'Erreur', 'error') }
  },
  async openEdit(id) {
    const crs = await API.get('/comptes-rendus').then(list => list.find(x => x.id === id))
    if (!crs) return
    const entreprises = await API.get('/entreprises')
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="cr-edit-modal">
        <div class="modal modal-lg">
          <div class="modal-header">
            <h3><i class="fas fa-edit" style="color:#006B3C"></i> Modifier Compte-Rendu — ${this.trimLabel(crs.trimestre)} ${crs.annee}</h3>
            <button class="btn btn-outline btn-sm btn-icon" onclick="document.getElementById('cr-edit-modal').remove()"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body">
            <form id="cr-edit-form">
              <div class="grid-2">
                <div class="form-group"><label class="form-label">Année *</label><input type="number" class="form-input" name="annee" value="${crs.annee}" required></div>
                <div class="form-group"><label class="form-label">Trimestre *</label>
                  <select class="form-input" name="trimestre" required>
                    <option value="1" ${crs.trimestre===1?'selected':''}>1er trimestre (Jan-Mar)</option>
                    <option value="2" ${crs.trimestre===2?'selected':''}>2ème trimestre (Avr-Jun)</option>
                    <option value="3" ${crs.trimestre===3?'selected':''}>3ème trimestre (Jul-Sep)</option>
                    <option value="4" ${crs.trimestre===4?'selected':''}>4ème trimestre (Oct-Déc)</option>
                  </select>
                </div>
                <div class="form-group"><label class="form-label">Entreprise (optionnel)</label>
                  <select class="form-input" name="entreprise_id">
                    <option value="">Toutes les entreprises</option>
                    ${entreprises.map(e => `<option value="${e.id}" ${crs.entreprise_id === e.id ? 'selected' : ''}>${Utils.escape(e.nom)}</option>`).join('')}
                  </select>
                </div>
                <div class="form-group"><label class="form-label">Nb visites réalisées</label><input type="number" class="form-input" name="nb_visites" value="${crs.nb_visites||0}"></div>
                <div class="form-group"><label class="form-label">Heures tiers-temps</label><input type="number" step="0.5" class="form-input" name="nb_tiers_temps_heures" value="${crs.nb_tiers_temps_heures||0}"></div>
                <div class="form-group"><label class="form-label">Nb pathologies détectées</label><input type="number" class="form-input" name="nb_pathologies_detectees" value="${crs.nb_pathologies_detectees||0}"></div>
                <div class="form-group" style="grid-column:1/-1"><label class="form-label">Faits marquants du trimestre</label><textarea class="form-input" name="faits_marquants" rows="3">${Utils.escape(crs.faits_marquants||'')}</textarea></div>
                <div class="form-group" style="grid-column:1/-1"><label class="form-label">Actions menées</label><textarea class="form-input" name="actions_menees" rows="3">${Utils.escape(crs.actions_menees||'')}</textarea></div>
                <div class="form-group" style="grid-column:1/-1"><label class="form-label">Points de vigilance</label><textarea class="form-input" name="points_vigilance" rows="2">${Utils.escape(crs.points_vigilance||'')}</textarea></div>
                <div class="form-group"><label class="form-label">Statut</label>
                  <select class="form-input" name="statut">
                    <option value="brouillon" ${crs.statut==='brouillon'?'selected':''}>Brouillon</option>
                    <option value="finalise" ${crs.statut==='finalise'?'selected':''}>Finalisé</option>
                    <option value="transmis" ${crs.statut==='transmis'?'selected':''}>Transmis</option>
                  </select>
                </div>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="document.getElementById('cr-edit-modal').remove()">Annuler</button>
            <button class="btn btn-primary" onclick="ComptesRendus.update(${id})"><i class="fas fa-save"></i> Mettre à jour</button>
          </div>
        </div>
      </div>`)
  },
  async confirmDelete(id, label) {
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="cr-delete-modal">
        <div class="modal modal-sm">
          <div class="modal-header">
            <h3><i class="fas fa-trash" style="color:#dc2626"></i> Supprimer le compte-rendu</h3>
            <button class="btn btn-outline btn-sm btn-icon" onclick="document.getElementById('cr-delete-modal').remove()"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body">
            <p>Supprimer le compte-rendu <strong>${Utils.escape(label)}</strong> ?</p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="document.getElementById('cr-delete-modal').remove()">Annuler</button>
            <button class="btn btn-danger" onclick="ComptesRendus.delete(${id})">Supprimer</button>
          </div>
        </div>
      </div>`)
  },
  async delete(id) {
    try {
      await API.delete(`/comptes-rendus/${id}`)
      Toast.show('Compte-rendu supprimé')
      document.getElementById('cr-delete-modal')?.remove()
      await ComptesRendus.render()
    } catch(e) { Toast.show(e.response?.data?.error || 'Erreur', 'error') }
  },
}

// ============================================================
// ORDONNANCES — Prescriptions structurées par médicament
// ============================================================
const Ordonnances = {
  async envoyerEmail(id) {
    const email = prompt("Adresse email du travailleur (laissez vide pour utiliser celle enregistrée dans son dossier) :")
    if (email === null) return
    try {
      await API.post(`/prescriptions/${id}/envoyer-email`, email ? { email } : {})
      Toast.show('Ordonnance envoyée par email')
    } catch(e) { Toast.show(e.response?.data?.error || "Échec de l'envoi", 'error') }
  },
  async renderForDossier(travailleurId, containerId) {
    const container = document.getElementById(containerId)
    if (!container) return
    container.innerHTML = '<div class="empty-state"><div class="spinner" style="margin:0 auto"></div></div>'
    try {
      const presc = await API.get(`/prescriptions?travailleur_id=${travailleurId}`)
      if (presc.length === 0) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-prescription-bottle"></i><h3>Aucune ordonnance</h3><p>Cliquez sur "Nouvelle ordonnance" pour prescrire</p></div>`
        return
      }
      container.innerHTML = `
        <div class="timeline">
          ${presc.map(p => `
            <div class="timeline-item">
              <div class="timeline-dot ${p.statut === 'dispensee' ? 'green' : p.statut === 'annulee' ? 'red' : 'blue'}"></div>
              <div class="timeline-content">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:0.4rem">
                  <div>
                    <span style="font-weight:600;font-size:0.875rem"><i class="fas fa-prescription mr-1"></i>
                    ${Utils.escape(p.numero_ordonnance||'Ordonnance')}</span>
                    <span class="badge ${p.statut==='dispensee'?'badge-green':p.statut==='annulee'?'badge-red':'badge-blue'} ml-2" style="font-size:0.7rem">
                      ${p.statut==='dispensee'?'Dispensée':p.statut==='annulee'?'Annulée':'Active'}</span>
                    ${p.renouvellement ? '<span class="badge badge-orange ml-1" style="font-size:0.7rem">Renouvellement</span>' : ''}
                  </div>
                  <span style="font-size:0.75rem;color:#6b7280">${Utils.formatDate(p.date_prescription)}</span>
                </div>
                <div style="font-size:0.8rem;color:#374151">${Utils.escape(p.medicaments||'')}</div>
                <div style="display:flex;gap:0.5rem;margin-top:0.5rem;flex-wrap:wrap">
                  <button class="btn btn-outline btn-sm" onclick="Print.ordonnance(${p.id})"><i class="fas fa-print mr-1"></i>Imprimer</button>
                  <button class="btn btn-outline btn-sm" onclick="Ordonnances.openModal(null,${travailleurId},null,${p.id})"><i class="fas fa-eye mr-1"></i>Détail</button>
                  <button class="btn btn-outline btn-sm" onclick="Ordonnances.envoyerEmail(${p.id})">Email</button>
                </div>
              </div>
            </div>`).join('')}
        </div>`
    } catch(e) {
      container.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-circle"></i><h3>Erreur de chargement</h3></div>'
    }
  },

  async openModal(visiteId = null, travailleurId, consultationId = null, editId = null) {
    let existingData = null
    let lignes = [{ medicament:'', forme:'comprimé', dosage:'', posologie:'', duree:'', quantite:'', voie:'orale', instructions:'' }]
    if (editId) {
      existingData = await API.get(`/prescriptions/${editId}`)
      if (existingData.lignes?.length) lignes = existingData.lignes
    }
    const renderLignes = () => lignes.map((l, i) => `
      <div class="medicament-ligne" id="ligne-${i}" style="border:1px solid #e5e7eb;border-radius:6px;padding:10px;margin-bottom:8px;background:#f9fafb">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px">
          <span style="font-size:0.8rem;font-weight:600;color:#006B3C"><i class="fas fa-pills mr-1"></i>Médicament ${i+1}</span>
          ${lignes.length > 1 ? `<button type="button" onclick="Ordonnances._removeLigne(${i})" style="background:none;border:none;color:#ef4444;cursor:pointer"><i class="fas fa-trash"></i></button>` : ''}
        </div>
        <div class="grid-2">
          <div class="form-group"><label class="form-label">Médicament *</label>
            <input class="form-input" name="med_${i}_medicament" value="${Utils.escape(l.medicament)}" placeholder="Ex: Paracétamol" required></div>
          <div class="form-group"><label class="form-label">Dosage</label>
            <input class="form-input" name="med_${i}_dosage" value="${Utils.escape(l.dosage||'')}" placeholder="Ex: 500mg"></div>
          <div class="form-group"><label class="form-label">Forme</label>
            <select class="form-input" name="med_${i}_forme">
              ${['comprimé','gélule','sirop','injectable','pommade','collyre','suppositoire','patch','autre'].map(f=>`<option value="${f}" ${l.forme===f?'selected':''}>${f}</option>`).join('')}
            </select></div>
          <div class="form-group"><label class="form-label">Voie</label>
            <select class="form-input" name="med_${i}_voie">
              ${['orale','injectable','topique','inhalation','autre'].map(v=>`<option value="${v}" ${l.voie===v?'selected':''}>${v}</option>`).join('')}
            </select></div>
          <div class="form-group"><label class="form-label">Posologie *</label>
            <input class="form-input" name="med_${i}_posologie" value="${Utils.escape(l.posologie)}" placeholder="Ex: 1 cp matin et soir" required></div>
          <div class="form-group"><label class="form-label">Durée</label>
            <input class="form-input" name="med_${i}_duree" value="${Utils.escape(l.duree||'')}" placeholder="Ex: 7 jours"></div>
          <div class="form-group"><label class="form-label">Quantité</label>
            <input class="form-input" name="med_${i}_quantite" value="${Utils.escape(l.quantite||'')}" placeholder="Ex: 2 boîtes"></div>
          <div class="form-group"><label class="form-label">Instructions</label>
            <input class="form-input" name="med_${i}_instructions" value="${Utils.escape(l.instructions||'')}" placeholder="Ex: Pendant les repas"></div>
        </div>
      </div>`).join('')
    const existingModal = document.getElementById('ord-modal')
    if (existingModal) existingModal.remove()
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="ord-modal">
        <div class="modal modal-lg">
          <div class="modal-header">
            <h3><i class="fas fa-prescription" style="color:#006B3C"></i> ${editId ? 'Ordonnance' : 'Nouvelle Ordonnance'}</h3>
            <button class="btn btn-outline btn-sm btn-icon" onclick="document.getElementById('ord-modal').remove()"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body">
            <form id="ord-form">
              <div id="lignes-container">${renderLignes()}</div>
              <button type="button" class="btn btn-outline btn-sm" onclick="Ordonnances._addLigne(${travailleurId},${visiteId},${consultationId},${editId})" style="margin-bottom:12px">
                <i class="fas fa-plus mr-1"></i>Ajouter un médicament
              </button>
              <div class="form-group"><label class="form-label">Notes / Instructions générales</label>
                <textarea class="form-input" name="notes" rows="2" placeholder="Instructions supplémentaires...">${Utils.escape(existingData?.notes||'')}</textarea></div>
              <label style="display:flex;align-items:center;gap:0.5rem;font-size:0.875rem;cursor:pointer;margin-bottom:8px">
                <input type="checkbox" name="renouvellement" ${existingData?.renouvellement?'checked':''}> Ordonnance de renouvellement
              </label>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="document.getElementById('ord-modal').remove()">Annuler</button>
            ${editId ? `<button class="btn btn-outline" onclick="Print.ordonnance(${editId})"><i class="fas fa-print mr-1"></i>Imprimer</button>` : ''}
            <button class="btn btn-primary" onclick="Ordonnances.save(${travailleurId},${visiteId},${consultationId},${editId})">
              <i class="fas fa-save mr-1"></i>${editId ? 'Enregistrer' : 'Créer & Imprimer'}
            </button>
          </div>
        </div>
      </div>`)
    // Stocker lignes dans window pour accès depuis onclick
    window._ordLignes = lignes
  },

  _addLigne(travailleurId, visiteId, consultationId, editId) {
    window._ordLignes = window._ordLignes || []
    window._ordLignes.push({ medicament:'', forme:'comprimé', dosage:'', posologie:'', duree:'', quantite:'', voie:'orale', instructions:'' })
    Ordonnances.openModal(visiteId, travailleurId, consultationId, editId)
  },
  _removeLigne(i) {
    window._ordLignes.splice(i, 1)
    // Re-render lignes container
    document.getElementById('lignes-container').innerHTML = (window._ordLignes||[]).map((l, idx) => {
      const lignes = window._ordLignes
      return `<div class="medicament-ligne" id="ligne-${idx}" style="border:1px solid #e5e7eb;border-radius:6px;padding:10px;margin-bottom:8px;background:#f9fafb">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px">
          <span style="font-size:0.8rem;font-weight:600;color:#006B3C">Médicament ${idx+1}</span>
          ${lignes.length > 1 ? `<button type="button" onclick="Ordonnances._removeLigne(${idx})" style="background:none;border:none;color:#ef4444;cursor:pointer"><i class="fas fa-trash"></i></button>` : ''}
        </div>
        <div class="grid-2">
          <div class="form-group"><label class="form-label">Médicament *</label><input class="form-input" name="med_${idx}_medicament" value="${Utils.escape(l.medicament)}" required></div>
          <div class="form-group"><label class="form-label">Dosage</label><input class="form-input" name="med_${idx}_dosage" value="${Utils.escape(l.dosage||'')}"></div>
          <div class="form-group"><label class="form-label">Posologie *</label><input class="form-input" name="med_${idx}_posologie" value="${Utils.escape(l.posologie)}" required></div>
          <div class="form-group"><label class="form-label">Durée</label><input class="form-input" name="med_${idx}_duree" value="${Utils.escape(l.duree||'')}"></div>
          <div class="form-group"><label class="form-label">Quantité</label><input class="form-input" name="med_${idx}_quantite" value="${Utils.escape(l.quantite||'')}"></div>
          <div class="form-group"><label class="form-label">Instructions</label><input class="form-input" name="med_${idx}_instructions" value="${Utils.escape(l.instructions||'')}"></div>
        </div></div>`
    }).join('')
  },

  async save(travailleurId, visiteId, consultationId, editId) {
    const form = document.getElementById('ord-form')
    const fd = new FormData(form)
    const lignes = []
    let i = 0
    while (fd.get(`med_${i}_medicament`) !== null) {
      const med = (fd.get(`med_${i}_medicament`) || '').toString().trim()
      if (med) lignes.push({
        medicament: med,
        dosage: fd.get(`med_${i}_dosage`)||'',
        forme: fd.get(`med_${i}_forme`)||'comprimé',
        posologie: fd.get(`med_${i}_posologie`)||'',
        duree: fd.get(`med_${i}_duree`)||'',
        quantite: fd.get(`med_${i}_quantite`)||'',
        voie: fd.get(`med_${i}_voie`)||'orale',
        instructions: fd.get(`med_${i}_instructions`)||''
      })
      i++
    }
    if (lignes.length === 0) { Toast.show('Ajoutez au moins un médicament', 'error'); return }
    try {
      const payload = {
        travailleur_id: travailleurId,
        visite_id: visiteId,
        consultation_id: consultationId,
        lignes,
        notes: fd.get('notes')||'',
        renouvellement: fd.get('renouvellement') === 'on'
      }
      const res = await API.post('/prescriptions', payload)
      document.getElementById('ord-modal').remove()
      Toast.show('Ordonnance créée')
      // Imprimer automatiquement
      setTimeout(() => Print.ordonnance(res.id), 500)
      // Recharger onglet si dossier ouvert
      const tab = document.getElementById('tab-ordonnances')
      if (tab) Ordonnances.renderForDossier(travailleurId, 'tab-ordonnances')
    } catch(e) {
      Toast.show(e.response?.data?.error || 'Erreur', 'error')
    }
  }
}

// ============================================================
// EXAMENS PRESCRITS — Bons d'examens complémentaires
// ============================================================
const ExamensPrescrits = {
  async renderForDossier(travailleurId, containerId) {
    const container = document.getElementById(containerId)
    if (!container) return
    container.innerHTML = '<div class="empty-state"><div class="spinner" style="margin:0 auto"></div></div>'
    try {
      const exams = await API.get(`/examens?travailleur_id=${travailleurId}`)
      if (exams.length === 0) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-microscope"></i><h3>Aucun examen prescrit</h3><p>Cliquez sur "Prescrire examens" pour ajouter</p></div>`
        return
      }
      const statutBadge = { prescrit:'badge-blue', en_cours:'badge-orange', resultat_recu:'badge-green', annule:'badge-red' }
      const statutLabel = { prescrit:'Prescrit', en_cours:'En cours', resultat_recu:'Résultat reçu', annule:'Annulé' }
      const typeLabel = { biologie:'Biologie', imagerie:'Imagerie', audiometrie:'Audiométrie', spirometrie:'Spirométrie', autre:'Autre' }
      container.innerHTML = `
        <div class="timeline">
          ${exams.map(e => `
            <div class="timeline-item">
              <div class="timeline-dot ${e.statut==='resultat_recu'?'green':e.statut==='annule'?'red':'blue'}"></div>
              <div class="timeline-content">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:0.3rem">
                  <div>
                    <span style="font-weight:600;font-size:0.875rem">${Utils.escape(e.nom_examen)}</span>
                    <span class="badge ${statutBadge[e.statut]||'badge-gray'} ml-2" style="font-size:0.7rem">${statutLabel[e.statut]||e.statut}</span>
                    ${e.urgent ? '<span class="badge badge-red ml-1" style="font-size:0.7rem">⚡ Urgent</span>' : ''}
                  </div>
                  <span style="font-size:0.75rem;color:#6b7280">${Utils.formatDate(e.date_demande)}</span>
                </div>
                <div style="font-size:0.8rem;color:#6b7280">
                  ${typeLabel[e.type_examen]||e.type_examen}
                  ${e.laboratoire ? ` — ${Utils.escape(e.laboratoire)}` : ''}
                  ${e.numero_bon ? ` — Bon: ${Utils.escape(e.numero_bon)}` : ''}
                </div>
                ${e.resultat ? `<div style="font-size:0.8rem;margin-top:0.3rem;padding:4px 8px;background:#f0fdf4;border-radius:4px"><strong>Résultat:</strong> ${Utils.escape(e.resultat)}</div>` : ''}
                <div style="display:flex;gap:0.5rem;margin-top:0.5rem;flex-wrap:wrap">
                  ${e.statut === 'prescrit' ? `<button class="btn btn-outline btn-sm" onclick="ExamensPrescrits.saisirResultat(${e.id},${travailleurId})"><i class="fas fa-edit mr-1"></i>Saisir résultat</button>` : ''}
                </div>
              </div>
            </div>`).join('')}
        </div>
        <div style="margin-top:12px">
          <button class="btn btn-outline btn-sm" onclick="Print.bonExamens(${travailleurId})">
            <i class="fas fa-print mr-1"></i>Imprimer bons prescrits
          </button>
        </div>`
    } catch(e) {
      container.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-circle"></i><h3>Erreur de chargement</h3></div>'
    }
  },

  async openModal(travailleurId, visiteId = null, consultationId = null) {
    const existingModal = document.getElementById('exam-modal')
    if (existingModal) existingModal.remove()
    const renderExamLigne = (i, ex = {}) => `
      <div class="examen-ligne" id="exligne-${i}" style="border:1px solid #e5e7eb;border-radius:6px;padding:10px;margin-bottom:8px;background:#f9fafb">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px">
          <span style="font-size:0.8rem;font-weight:600;color:#006B3C">Examen ${i+1}</span>
          ${i > 0 ? `<button type="button" onclick="document.getElementById('exligne-${i}').remove()" style="background:none;border:none;color:#ef4444;cursor:pointer"><i class="fas fa-trash"></i></button>` : ''}
        </div>
        <div class="grid-2">
          <div class="form-group"><label class="form-label">Type *</label>
            <select class="form-input" name="ex_${i}_type" required>
              <option value="biologie" selected>Biologie</option>
              <option value="imagerie">Imagerie</option>
              <option value="audiometrie">Audiométrie</option>
              <option value="spirometrie">Spirométrie</option>
              <option value="autre">Autre</option>
            </select></div>
          <div class="form-group"><label class="form-label">Nom de l'examen *</label>
            <input class="form-input" name="ex_${i}_nom" placeholder="Ex: NFS, Glycémie, Radio thorax..." required></div>
          <div class="form-group"><label class="form-label">Laboratoire / Service</label>
            <input class="form-input" name="ex_${i}_labo" placeholder="Ex: Laboratoire Pasteur"></div>
          <div class="form-group">
            <label style="display:flex;align-items:center;gap:0.5rem;font-size:0.875rem;cursor:pointer;margin-top:1.5rem">
              <input type="checkbox" name="ex_${i}_urgent"> <span class="text-red-600 font-bold">⚡ Examen urgent</span>
            </label>
          </div>
        </div>
        <div class="form-group"><label class="form-label">Instructions / Renseignements cliniques</label>
          <input class="form-input" name="ex_${i}_instructions" placeholder="Ex: A jeun, Contexte clinique..."></div>
      </div>`
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="exam-modal">
        <div class="modal modal-lg">
          <div class="modal-header">
            <h3><i class="fas fa-microscope" style="color:#006B3C"></i> Prescrire des Examens</h3>
            <button class="btn btn-outline btn-sm btn-icon" onclick="document.getElementById('exam-modal').remove()"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body">
            <form id="exam-form">
              <div id="exam-lignes-container">${renderExamLigne(0)}</div>
              <button type="button" class="btn btn-outline btn-sm" onclick="ExamensPrescrits._addExamLigne()" style="margin-bottom:12px">
                <i class="fas fa-plus mr-1"></i>Ajouter un examen
              </button>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="document.getElementById('exam-modal').remove()">Annuler</button>
            <button class="btn btn-primary" onclick="ExamensPrescrits.save(${travailleurId},${visiteId||'null'},${consultationId||'null'})">
              <i class="fas fa-save mr-1"></i>Créer & Imprimer le bon
            </button>
          </div>
        </div>
      </div>`)
    window._examLigneCount = 1
  },

  _addExamLigne() {
    const c = window._examLigneCount || 1
    const container = document.getElementById('exam-lignes-container')
    container.insertAdjacentHTML('beforeend', `
      <div class="examen-ligne" id="exligne-${c}" style="border:1px solid #e5e7eb;border-radius:6px;padding:10px;margin-bottom:8px;background:#f9fafb">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px">
          <span style="font-size:0.8rem;font-weight:600;color:#006B3C">Examen ${c+1}</span>
          <button type="button" onclick="document.getElementById('exligne-${c}').remove()" style="background:none;border:none;color:#ef4444;cursor:pointer"><i class="fas fa-trash"></i></button>
        </div>
        <div class="grid-2">
          <div class="form-group"><label class="form-label">Type *</label>
            <select class="form-input" name="ex_${c}_type" required>
              <option value="biologie" selected>Biologie</option>
              <option value="imagerie">Imagerie</option>
              <option value="audiometrie">Audiométrie</option>
              <option value="spirometrie">Spirométrie</option>
              <option value="autre">Autre</option>
            </select></div>
          <div class="form-group"><label class="form-label">Nom de l'examen *</label>
            <input class="form-input" name="ex_${c}_nom" placeholder="Ex: NFS, Glycémie..." required></div>
          <div class="form-group"><label class="form-label">Laboratoire</label>
            <input class="form-input" name="ex_${c}_labo" placeholder="Laboratoire..."></div>
          <div class="form-group">
            <label style="display:flex;align-items:center;gap:0.5rem;font-size:0.875rem;cursor:pointer;margin-top:1.5rem">
              <input type="checkbox" name="ex_${c}_urgent"> <span style="color:#dc2626;font-weight:600">⚡ Urgent</span>
            </label>
          </div>
        </div>
        <div class="form-group"><label class="form-label">Instructions</label>
          <input class="form-input" name="ex_${c}_instructions" placeholder="Instructions..."></div>
      </div>`)
    window._examLigneCount = c + 1
  },

  async save(travailleurId, visiteId, consultationId) {
    const form = document.getElementById('exam-form')
    const fd = new FormData(form)
    const examens = []
    for (let i = 0; i <= (window._examLigneCount || 20); i++) {
      const nom = (fd.get(`ex_${i}_nom`) || '').toString().trim()
      if (nom) examens.push({
        travailleur_id: travailleurId,
        visite_id: visiteId,
        consultation_id: consultationId,
        type_examen: fd.get(`ex_${i}_type`) || 'biologie',
        nom_examen: nom,
        laboratoire: fd.get(`ex_${i}_labo`) || '',
        urgent: fd.get(`ex_${i}_urgent`) === 'on' ? 1 : 0,
        interpretation: fd.get(`ex_${i}_instructions`) || ''
      })
    }
    if (examens.length === 0) { Toast.show('Ajoutez au moins un examen', 'error'); return }
    try {
      await API.post('/examens', examens)
      document.getElementById('exam-modal').remove()
      Toast.show(`${examens.length} examen(s) prescrit(s)`)
      setTimeout(() => Print.bonExamens(travailleurId, visiteId), 500)
      const tab = document.getElementById('tab-examens')
      if (tab) ExamensPrescrits.renderForDossier(travailleurId, 'tab-examens')
    } catch(e) {
      Toast.show(e.response?.data?.error || 'Erreur', 'error')
    }
  },

  async saisirResultat(examId, travailleurId) {
    const ex = await API.get(`/examens/${examId}`)
    const existingModal = document.getElementById('res-exam-modal')
    if (existingModal) existingModal.remove()
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="res-exam-modal">
        <div class="modal modal-md">
          <div class="modal-header">
            <h3><i class="fas fa-flask" style="color:#006B3C"></i> Résultat — ${Utils.escape(ex.nom_examen)}</h3>
            <button class="btn btn-outline btn-sm btn-icon" onclick="document.getElementById('res-exam-modal').remove()"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body">
            <div class="form-group"><label class="form-label">Date du résultat</label>
              <input type="date" class="form-input" id="res-date" value="${new Date().toISOString().split('T')[0]}"></div>
            <div class="form-group"><label class="form-label">Résultat *</label>
              <textarea class="form-input" id="res-resultat" rows="3" placeholder="Saisir le résultat...">${Utils.escape(ex.resultat||'')}</textarea></div>
            <div class="form-group"><label class="form-label">Interprétation / Commentaire</label>
              <textarea class="form-input" id="res-interpretation" rows="2" placeholder="Interprétation médicale...">${Utils.escape(ex.interpretation||'')}</textarea></div>
            <div class="form-group"><label class="form-label">Statut</label>
              <select class="form-input" id="res-statut">
                <option value="resultat_recu" selected>Résultat reçu</option>
                <option value="en_cours">En cours</option>
                <option value="annule">Annulé</option>
              </select></div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="document.getElementById('res-exam-modal').remove()">Annuler</button>
            <button class="btn btn-primary" onclick="ExamensPrescrits.saveResultat(${examId},${travailleurId})">
              <i class="fas fa-save mr-1"></i>Enregistrer
            </button>
          </div>
        </div>
      </div>`)
  },

  async saveResultat(examId, travailleurId) {
    try {
      await API.put(`/examens/${examId}`, {
        statut: document.getElementById('res-statut').value,
        resultat: document.getElementById('res-resultat').value,
        interpretation: document.getElementById('res-interpretation').value,
        date_resultat: document.getElementById('res-date').value
      })
      document.getElementById('res-exam-modal').remove()
      Toast.show('Résultat enregistré')
      const tab = document.getElementById('tab-examens')
      if (tab) ExamensPrescrits.renderForDossier(travailleurId, 'tab-examens')
    } catch(e) {
      Toast.show(e.response?.data?.error || 'Erreur', 'error')
    }
  }
}

// ============================================================
// ATTESTATIONS VIH — Dépistage VIH/SIDA
// ============================================================
const AttestationsVIH = {
  async renderForDossier(travailleurId, containerId) {
    const container = document.getElementById(containerId)
    if (!container) return
    container.innerHTML = '<div class="empty-state"><div class="spinner" style="margin:0 auto"></div></div>'
    try {
      const attests = await API.get(`/attestations-vih?travailleur_id=${travailleurId}`)
      if (attests.length === 0) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-vial"></i><h3>Aucune attestation VIH</h3><p>Cliquez sur "Nouveau dépistage" pour créer</p></div>`
        return
      }
      container.innerHTML = `
        <div class="timeline">
          ${attests.map(av => `
            <div class="timeline-item">
              <div class="timeline-dot blue"></div>
              <div class="timeline-content">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:0.3rem">
                  <div>
                    <span style="font-weight:600;font-size:0.875rem"><i class="fas fa-ribbon mr-1" style="color:#dc2626"></i>Test de dépistage VIH</span>
                    <span class="badge badge-blue ml-2" style="font-size:0.7rem">${Utils.escape(av.numero_attestation)}</span>
                  </div>
                  <span style="font-size:0.75rem;color:#6b7280">${Utils.formatDate(av.date_test)}</span>
                </div>
                <div style="font-size:0.8rem;color:#6b7280;margin-bottom:0.4rem">
                  Médecin : Dr. ${Utils.escape(av.medecin_prenom||'')} ${Utils.escape(av.medecin_nom||'')}
                  ${av.counseling_pre_realise ? ' — Counseling pré-test ✅' : ''}
                  ${av.consentement_eclaire ? ' — Consentement ✅' : ''}
                </div>
                ${av.observations ? `<div style="font-size:0.8rem;color:#374151;margin-bottom:0.4rem">${Utils.escape(av.observations)}</div>` : ''}
                <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
                  <button class="btn btn-outline btn-sm" onclick="Print.attestationVIH(${av.id})"><i class="fas fa-print mr-1"></i>Imprimer</button>
                  <button class="btn btn-outline btn-sm btn-danger" onclick="AttestationsVIH.delete(${av.id},${travailleurId})"><i class="fas fa-trash mr-1"></i>Supprimer</button>
                </div>
              </div>
            </div>`).join('')}
        </div>`
    } catch(e) {
      container.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-circle"></i><h3>Erreur de chargement</h3></div>'
    }
  },

  async openModal(travailleurId, visiteId = null, consultationId = null) {
    const existingModal = document.getElementById('vih-modal')
    if (existingModal) existingModal.remove()
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="vih-modal">
        <div class="modal modal-md">
          <div class="modal-header">
            <h3><i class="fas fa-ribbon" style="color:#dc2626"></i> Nouveau Dépistage VIH/SIDA</h3>
            <button class="btn btn-outline btn-sm btn-icon" onclick="document.getElementById('vih-modal').remove()"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body">
            <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:10px 14px;margin-bottom:12px;font-size:0.8rem;color:#991b1b">
              <i class="fas fa-shield-alt mr-1"></i>
              <strong>Confidentialité :</strong> Le résultat du test ne sera jamais consigné dans cette attestation.
              Seule la réalisation du test est attestée, conformément au protocole national de dépistage.
            </div>
            <form id="vih-form">
              <div class="form-group"><label class="form-label">Date du test *</label>
                <input type="date" class="form-input" name="date_test" value="${new Date().toISOString().split('T')[0]}" required></div>
              <label style="display:flex;align-items:center;gap:0.5rem;font-size:0.875rem;cursor:pointer;margin-bottom:8px">
                <input type="checkbox" name="counseling_pre_realise" checked>
                <span>Counseling pré-test réalisé</span>
              </label>
              <label style="display:flex;align-items:center;gap:0.5rem;font-size:0.875rem;cursor:pointer;margin-bottom:12px">
                <input type="checkbox" name="consentement_eclaire" checked>
                <span>Consentement éclairé du patient obtenu</span>
              </label>
              <div class="form-group"><label class="form-label">Observations (facultatif)</label>
                <textarea class="form-input" name="observations" rows="2" placeholder="Orientations, recommandations..."></textarea></div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="document.getElementById('vih-modal').remove()">Annuler</button>
            <button class="btn btn-primary" onclick="AttestationsVIH.save(${travailleurId},${visiteId||'null'},${consultationId||'null'})">
              <i class="fas fa-save mr-1"></i>Créer & Imprimer l'attestation
            </button>
          </div>
        </div>
      </div>`)
  },

  async save(travailleurId, visiteId, consultationId) {
    const form = document.getElementById('vih-form')
    const fd = new FormData(form)
    try {
      const res = await API.post('/attestations-vih', {
        travailleur_id: travailleurId,
        visite_id: visiteId,
        consultation_id: consultationId,
        date_test: fd.get('date_test'),
        counseling_pre_realise: fd.get('counseling_pre_realise') === 'on',
        consentement_eclaire: fd.get('consentement_eclaire') === 'on',
        observations: fd.get('observations') || ''
      })
      document.getElementById('vih-modal').remove()
      Toast.show('Attestation VIH créée')
      setTimeout(() => Print.attestationVIH(res.id), 500)
      const tab = document.getElementById('tab-vih')
      if (tab) AttestationsVIH.renderForDossier(travailleurId, 'tab-vih')
    } catch(e) {
      Toast.show(e.response?.data?.error || 'Erreur', 'error')
    }
  },

  async delete(id, travailleurId) {
    if (!confirm('Supprimer cette attestation ?')) return
    try {
      await API.delete(`/attestations-vih/${id}`)
      Toast.show('Attestation supprimée')
      AttestationsVIH.renderForDossier(travailleurId, 'tab-vih')
    } catch(e) { Toast.show('Erreur', 'error') }
  }
}

// ============================================================
// INITIALISATION
// ============================================================
async function init() {
  // Vérifier session stockée
  const stored = localStorage.getItem('st_user')
  if (stored) {
    try {
      State.user = JSON.parse(stored)
    } catch { localStorage.removeItem('st_user') }
  }
  // Vérifier que le token est encore valide côté serveur
  if (State.user) {
    const token = localStorage.getItem('st_token')
    if (token) {
      try {
        await API.get('/auth/verify')
        App.render()
      } catch {
        // Token expiré — déconnexion silencieuse
        State.user = null
        localStorage.removeItem('st_user')
        localStorage.removeItem('st_token')
        Auth.render()
      }
    } else {
      // Pas de token (ancienne session) — déconnexion
      State.user = null
      localStorage.removeItem('st_user')
      Auth.render()
    }
  } else {
    Auth.render()
  }
}

// Fermer la recherche en cliquant ailleurs
document.addEventListener('click', e => {
  const sr = document.getElementById('search-results')
  if (sr && !e.target.closest('#global-search') && !e.target.closest('#search-results')) {
    sr.style.display = 'none'
  }
})

init()
