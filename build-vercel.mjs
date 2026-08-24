// ============================================================
// build-vercel.mjs
// Build statique pour Vercel (stratégie hybride) :
//   - Copie le dossier public/ (assets SPA) vers .vercel-output/
//   - Génère index.html en injectant l'URL de l'API Cloudflare
//     (variable d'environnement SANTETRAVAIL_API_BASE).
//
// Usage :  node build-vercel.mjs
// Sur Vercel ce script est lancé via le "buildCommand" de vercel.json.
// ============================================================
import {
  readdirSync,
  copyFileSync,
  mkdirSync,
  existsSync,
  rmSync,
  writeFileSync,
  statSync,
} from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const SRC = join(ROOT, 'public')
const OUT = join(ROOT, '.vercel-output')

// --- 1. Vider le dossier de sortie puis copier les assets statiques ---
if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true })

function copyDir(src, dest) {
  mkdirSync(dest, { recursive: true })
  for (const name of readdirSync(src)) {
    const s = join(src, name)
    const d = join(dest, name)
    if (statSync(s).isDirectory()) copyDir(s, d)
    else copyFileSync(s, d)
  }
}
copyDir(SRC, OUT)

// --- 2. URL racine de l'API Cloudflare (vide => même origine /api) ---
const apiBase = process.env.SANTETRAVAIL_API_BASE || ''

// --- 3. Générer index.html (coquille SPA) ---
// Fidèle à la page servie par le worker Hono (src/index.tsx), avec en plus
// l'injection de window.SANTETRAVAIL_API_BASE pour pointer vers l'API Cloudflare.
const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="color-scheme" content="light">
  <title>SanteTravail.CI — Médecine du Travail</title>
  <link href="/static/style.css" rel="stylesheet">
  <link href="/static/fontawesome.min.css" rel="stylesheet">
  <style>
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
  <div id="app-loading">
    <div class="logo-icon">&#9829;</div>
    <h1>SanteTravail<span style="color:#FF8C00">.CI</span></h1>
    <p>Médecine du Travail — Côte d'Ivoire</p>
    <div class="spinner"></div>
  </div>
  <div id="app"></div>
  <script>
    // URL racine de l'API Cloudflare, injectée au build (SANTETRAVAIL_API_BASE).
    window.SANTETRAVAIL_API_BASE = __API_BASE__;
  </script>
  <script>
    (function() {
      var loaded = 0;
      var scripts = ['/static/axios.min.js'];
      function loadNext(i) {
        if (i >= scripts.length) {
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
        s.onerror = function() { loadNext(i + 1); };
        document.body.appendChild(s);
      }
      loadNext(0);
    })();
  </script>
</body>
</html>`.replace('__API_BASE__', JSON.stringify(apiBase))

writeFileSync(join(OUT, 'index.html'), html)

console.log('[build-vercel] OK -> ' + OUT)
console.log('[build-vercel] SANTETRAVAIL_API_BASE=' + (apiBase || '(vide: même origine /api)'))