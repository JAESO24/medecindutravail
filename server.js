import { serve } from '@hono/node-server';
import worker from './dist/index.js'; // Chemin vers votre worker compilé

console.log('Démarrage du serveur API sur le port 8787...');

serve({
  fetch: worker.fetch,
  port: 8787
});

console.log('Serveur API démarré et à l\'écoute sur http://localhost:8787');
