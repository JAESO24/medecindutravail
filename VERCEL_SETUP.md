# Configuration Vercel — Stratégie Hybride ✅

Cette stratégie a été **mise en place** dans le projet (choix : Option A Hybride).

## Architecture
```
Navigateur ──▶  Vercel (frontend statique)      ──▶  Cloudflare Workers (API + D1)
                    ▲  index.html + /static/*            ▲
                    └── window.SANTETRAVAIL_API_BASE = https://…  (injecté au build)
```

- **Frontend** : hébergé sur **Vercel** (fichiers statiques, SPA vanilla).
- **Backend API + base D1** : **inchangés** sur **Cloudflare Workers/Pages**.
- Le frontend pointe vers l'API Cloudflare via `SANTETRAVAIL_API_BASE`.
- Le CORS est déjà ouvert côté Cloudflare (`app.use('/api/*', cors())`).

## Fichiers ajoutés / modifiés
| Fichier | Rôle |
|---|---|
| `vercel.json` | Config du build Vercel (buildCommand + outputDirectory `.vercel-output`) |
| `build-vercel.mjs` | Build statique : copie `public/` → `.vercel-output/` + génère `index.html` avec l'URL API injectée |
| `public/static/app.js` | Les appels API utilisent `window.SANTETRAVAIL_API_BASE` (fallback `/api` même origine) |
| `.gitignore` | `.vercel-output/` ignoré (généré) |
| `package.json` | Script `build:vercel` ajouté |

## Déploiement pas-à-pas

### 1. Obtenir l'URL de l'API Cloudflare (celle déjà en production)
Ton domaine (confirmé fonctionnel) : **`https://santetravail.pages.dev`**
(visible aussi dans `cron-worker/wrangler.jsonc` → `TARGET_URL`, et testable via
`https://santetravail.pages.dev/api/health`).

### 2. Importer le dépôt Git sur Vercel
- Le projet est déjà un dépôt Git (`git status` fonctionne).
- Dashboard Vercel → **Add New → Project → Import**.
- Vercel détecte `vercel.json` (pas de framework Next.js → déploiement statique).

### 3. Définir la variable `SANTETRAVAIL_API_BASE`
Project → **Settings → Environment Variables**, ajouter :
```
SANTETRAVAIL_API_BASE = https://santetravail.pages.dev
```
Cette variable est lue **au moment du build** par `build-vercel.mjs` et injectée
dans `index.html` (`window.SANTETRAVAIL_API_BASE`).

> ⚠️ Sans cette variable, l'URL API reste `/api` (même origine) : correct uniquement
> si le frontend et l'API sont sur le **même** domaine (cas Cloudflare).

### 4. Déployer
Sur **chaque push** sur la branche liée, Vercel :
1. Installe les dépendances (`npm install`).
2. Exécute le `buildCommand` (`node build-vercel.mjs`).
3. Publie le contenu de `outputDirectory` (`.vercel-output/`).

Ou avec le CLI :
```bash
npx vercel
```

## Test en local
```bash
node build-vercel.mjs
# puis servir le dossier .vercel-output (ex. : npx serve, lancement d'un server statique)
```

## ⚠️ Points d'attention
1. **CORS** : l'API Cloudflare permet déjà le cross-origin (`app.use('/api/*', cors())`).
   Si vous ajoutez un domaine personnalisé Vercel, vérifiez qu'il n'est pas bloqué.
2. **`npm run build`** (vite → worker CF) reste le build du **Cloudflare** et n'est plus
   utilisé par Vercel.
3. Les fichiers **`.vercel-output/`** sont régénérés à chaque build (jamais committer manuellement).
4. Backend Cloudflare et frontend Vercel doivent être **déployés indépendamment**.

---

## Rappel des autres options (non retenues)
- **Option B** : tout sur Vercel (migrer D1 → PostgreSQL) — gros chantier.
- **Option C** : Vercel seulement en frontend, typique de l'Option A.
