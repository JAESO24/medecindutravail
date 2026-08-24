# SanteTravail.CI 🏥

## Présentation
Application web de gestion des dossiers médicaux pour la médecine du travail en Côte d'Ivoire. Développée en s'inspirant de la plateforme YesDr de E-Santé.

## Fonctionnalités Implémentées ✅

### 1. Authentification & Sécurité
- Login sécurisé avec email/mot de passe (hash SHA-256)
- Gestion des rôles : Admin, Médecin, Infirmier
- Sessions persistantes via localStorage

### 2. Tableau de Bord
- Statistiques en temps réel (travailleurs, visites, alertes)
- Prochaines visites médicales planifiées
- Alertes prioritaires actives
- Actions rapides (nouveau travailleur, planifier visite, consultation)

### 3. Gestion des Dossiers Médicaux
- Fiche complète par travailleur (identité, emploi, antécédents)
- Historique des visites médicales par timeline
- Historique des consultations
- Suivi des constantes vitales avec indicateurs (IMC, tension, SpO2...)
- Recherche globale par nom, matricule, poste

### 4. Visites Médicales
- Types : Embauche, Périodique, Reprise, Spontanée, Pré-reprise
- Gestion du statut (Planifiée, Réalisée, Annulée, Reportée)
- Avis d'aptitude (5 niveaux)
- Planification de la prochaine visite avec alerte automatique
- Filtres par mois, statut, type

### 5. Consultations Médicales
- Enregistrement complet (motif, symptômes, examen, diagnostic, traitement)
- Prescriptions / ordonnances
- Constantes vitales intégrées au formulaire
- Gestion arrêts de travail et certificats
- Examens demandés (biologie, imagerie, etc.)

### 6. Calendrier Médical
- Vue mensuelle des visites avec navigation
- Code couleur par statut
- Liste détaillée des visites du mois

### 7. Entreprises
- Gestion des entreprises clientes
- Statistiques par entreprise (nb travailleurs)

### 8. Alertes Médicales
- 4 niveaux de priorité (urgente, haute, normale, basse)
- Alertes automatiques sur prochaines visites
- Marquage "traité" avec mise à jour en temps réel

### 9. Gestion des Utilisateurs (Admin)
- Création/modification des comptes
- Attribution des rôles

## Comptes par Défaut
Créés automatiquement par `POST /api/setup` lors de l'initialisation de la base :

| Email | Mot de passe | Rôle |
|-------|-------------|------|
| superadmin@santetravail.ci | SuperAdmin2026! | Super Admin |
| admin@santetravail.ci | Admin2026! | Administrateur |
| medecin@santetravail.ci | Admin2026! | Médecin |
| infirmier@santetravail.ci | Admin2026! | Infirmier |

⚠️ À changer immédiatement après la première connexion en production.

## Architecture Technique

### Stack
- **Backend** : Hono (TypeScript) sur Cloudflare Workers/Pages
- **Base de données** : Cloudflare D1 (SQLite)
- **Frontend** : HTML/CSS/JS vanilla avec TailwindCSS CDN
- **Charts** : Chart.js CDN
- **HTTP** : Axios CDN

### Modèle de données
- `users` - Utilisateurs de l'application
- `entreprises` - Entreprises clientes
- `travailleurs` - Dossiers travailleurs/patients
- `visites_medicales` - Visites médicales planifiées/réalisées
- `consultations` - Consultations médicales détaillées
- `constantes` - Constantes vitales
- `prescriptions` - Ordonnances médicales
- `examens` - Examens complémentaires
- `alertes` - Alertes médicales

## Déploiement

### Développement (Sandbox)
```bash
npm run build
pm2 start ecosystem.config.cjs
```

### Production (Cloudflare Pages) — Backend API + base D1
```bash
# 1. Créer la DB D1
npx wrangler d1 create santetravail-production
# 2. Mettre à jour database_id dans wrangler.jsonc
# 3. Déployer
npm run deploy
```

### Frontend sur Vercel (stratégie hybride)
Le frontend (fichiers statiques) peut être déployé séparément sur **Vercel**
pendant que l'API reste sur Cloudflare. Cf. `VERCEL_SETUP.md`.

```bash
# Générer le build statique Vercel (copie public/ + crée index.html)
node build-vercel.mjs
```

La variable d'environnement `SANTETRAVAIL_API_BASE` (URL de l'API Cloudflare)
doit être définie dans le projet Vercel pour que le frontend appelle la bonne API.

## URL Application
- **Local** : http://localhost:3000
- **Plateforme backend/API** : Cloudflare Pages
- **Plateforme frontend (optionnel)** : Vercel (`.vercel.app` ou domaine perso)

## Prochaines Améliorations
- [ ] Export PDF des dossiers médicaux et ordonnances
- [ ] Statistiques avancées avec graphiques
- [ ] Notifications email automatiques
- [ ] Module de gestion des risques professionnels
- [ ] Import/Export Excel des données
- [ ] Signature électronique des documents
- [ ] Application mobile PWA
