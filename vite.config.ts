// Config Vite contenue ou restaurée pour le build Cloudflare Pages (Worker Hono).
// (La config Vercel depuis build-vercel.mjs serve toujours le frontend statique.)
//
// NOTE ANCIENNE (avant build-vercel.mjs) : config Vercel utilisait @vitejs/plugin-react.
// Conservée en référence ci-dessous si nécessaire un jour :
//   import react from '@vitejs/plugin-react'
//   export default defineConfig({ plugins: [react()], build: { outDir: 'dist', emptyOutDir: true, sourcemap: false } })

import build from '@hono/vite-build/cloudflare-pages'
import devServer from '@hono/vite-dev-server'
import adapter from '@hono/vite-dev-server/cloudflare'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    build(),
    devServer({
      adapter,
      entry: 'src/index.tsx'
    })
  ],
  build: {
    rollupOptions: {
      external: ['cloudflare:sockets']
    }
  }
})
