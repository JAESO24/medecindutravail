# Configuration Vercel

## ⚠️ Limitation importante : Base de données D1

Votre projet utilise **Cloudflare D1**, qui n'est pas compatible avec Vercel. Vous avez 3 options :

### Option A : Hybrid (Recommandé pour maintenant)
- **Frontend** : Déployer sur Vercel ✅
- **Backend/API** : Rester sur Cloudflare Workers ✅
- **Database** : Rester sur Cloudflare D1 ✅

**Avantages** : Pas de changement, tout fonctionne
**Inconvénients** : Dois configurer les 2 déploiements

### Option B : Vercel + Base de données externe
- Migrer de D1 vers PostgreSQL/MySQL
- Déployer tout sur Vercel
- Les variables d'env pour DB à ajouter

### Option C : Vercel seulement (Frontend)
- Déployer juste le frontend sur Vercel
- Garder l'API sur Cloudflare

## Setup actuel

✅ `vercel.json` créé
✅ `vite.config.ts` adapté pour Vercel
✅ `api/health.ts` créé (test endpoint)

## Prochaines étapes

### 1. Configurer les variables d'environnement sur Vercel
Allez sur : https://vercel.com/dashboard → Sélectionnez le projet → Settings → Environment Variables

Ajoutez :
```
GMAIL_USER = santetravail1@gmail.com
GMAIL_APP_PASSWORD = wzkciwsxkeyumjlz
CRON_SECRET = a7ee5835ae71fe9e8671fe9afd4ab8e75979314e15801c78
```

### 2. Déployer sur Vercel
```bash
npm install -g vercel
vercel
```

### 3. Pour l'API complète
Si vous choisissez l'Option A (Hybrid) :
- Gardez le déploiement Cloudflare comme avant
- Le frontend sera sur Vercel
- À configurer : proxy les appels /api/* vers Cloudflare

## Commandes utiles

```bash
# Test build local
npm run build

# Preview local
npm run preview
```

## Configuration CORS

Le frontend Vercel aura une URL différente (ex: `monsite.vercel.app`). 
À mettre à jour sur Cloudflare ou dans `.env`.

---

**Quelle option choisissez-vous ?**
