// Segundo paso de `npm run build`: compila la página del kit de componentes
// (/componentes) con vite.componentes.config.js.
//
// Solo corre en Vercel (que define VERCEL=1) o si se pide con
// CON_COMPONENTES=1. Así el build que usa Capacitor (webDir: 'build') no
// mete esta página de prueba dentro del APK.
import { build } from 'vite';

if (!process.env.VERCEL && !process.env.CON_COMPONENTES) {
  console.log('[componentes] Omitido (solo se publica en Vercel; usa CON_COMPONENTES=1 para forzarlo).');
  process.exit(0);
}

await build({ configFile: 'vite.componentes.config.js' });
