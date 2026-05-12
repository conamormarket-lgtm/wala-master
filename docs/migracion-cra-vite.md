# Migración CRA → Vite

**Estado:** Pendiente · **Rama objetivo:** `dev`  
**Esfuerzo estimado:** ~30 min  
**Prioridad:** Alta — `react-scripts` está oficialmente deprecado por el equipo de React.

---

## ¿Por qué migrar?

| | CRA (`react-scripts`) | Vite |
|---|---|---|
| HMR (hot reload) | ~2-5 s | ~80 ms |
| Build prod | ~60-90 s | ~15-25 s |
| Mantenimiento | **Abandonado** | Activo |
| Soporte ESM nativo | ❌ | ✅ |
| Config flexible | ❌ (eject) | ✅ vite.config.js |

---

## Paso 1 — Instalar dependencias

```bash
npm remove react-scripts cross-env
npm install -D vite @vitejs/plugin-react
```

---

## Paso 2 — Crear `vite.config.js` en la raíz

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: 'build', // mantener carpeta 'build' igual que CRA (Vercel ya la detecta)
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    // Compatibilidad con libs que asumen window.global (algunas de Firebase)
    global: 'globalThis',
  },
});
```

---

## Paso 3 — Mover `public/index.html` → `index.html` (raíz)

Vite espera el HTML en la raíz. Eliminar `%PUBLIC_URL%` y añadir el script de entrada:

```diff
- <link rel="manifest" href="%PUBLIC_URL%/manifest.json" />
- <link rel="icon" type="image/png" href="%PUBLIC_URL%/logo-wala.png" />
- <link rel="apple-touch-icon" href="%PUBLIC_URL%/logo-wala.png" />
- <link href="%PUBLIC_URL%/fonts/fonts.css" rel="stylesheet" media="print" onload="this.media='all'" />
+ <link rel="manifest" href="/manifest.json" />
+ <link rel="icon" type="image/png" href="/logo-wala.png" />
+ <link rel="apple-touch-icon" href="/logo-wala.png" />
+ <link href="/fonts/fonts.css" rel="stylesheet" media="print" onload="this.media='all'" />

  <!-- Antes de </body> añadir: -->
+ <script type="module" src="/src/index.jsx"></script>
```

```bash
mv public/index.html ./index.html
```

---

## Paso 4 — Actualizar `package.json`

```diff
  "scripts": {
-   "start": "react-scripts start",
-   "dev": "react-scripts start",
-   "dev:3001": "set PORT=3001&& react-scripts start",
-   "build": "cross-env CI=false react-scripts build",
-   "test": "react-scripts test",
-   "eject": "react-scripts eject",
+   "start": "vite",
+   "dev": "vite",
+   "dev:3001": "vite --port 3001",
+   "build": "vite build",
+   "preview": "vite preview",
    "deploy:firestore-rules": "node scripts/deploy-firestore-rules.js",
    "deploy:storage-rules": "node scripts/deploy-storage-rules.js",
    "deploy:functions": "firebase deploy --only functions",
    "deploy:vercel": "npx vercel",
    "deploy:vercel:prod": "npx vercel --prod"
  }
```

También eliminar los campos que ya no aplican:
```diff
- "homepage": "/",
- "browserslist": { ... },
- "eslintConfig": { "extends": ["react-app"] }
```

---

## Paso 5 — Renombrar variables de entorno: `REACT_APP_*` → `VITE_*`

### 5a. Reemplazo en código fuente

Regla global: `process.env.REACT_APP_` → `import.meta.env.VITE_`

**Archivos afectados:**

| Archivo | Ocurrencias |
|---|---|
| `src/services/firebase/config.js` | 11 |
| `src/services/erp/firebase.js` | 7 |
| `src/config/erp.js` | 5 |
| `src/utils/constants.js` | 1 |
| `src/components/common/FirebaseWarning/FirebaseWarning.jsx` | 1 (string de texto) |

Comando rápido para verificar que no queda ninguno:
```bash
grep -r "REACT_APP_" src/ --include="*.js" --include="*.jsx"
```

### 5b. Actualizar `.env.example`

```diff
- REACT_APP_FIREBASE_API_KEY=your-api-key-here
- REACT_APP_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
- REACT_APP_FIREBASE_PROJECT_ID=your-project-id
- REACT_APP_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
- REACT_APP_FIREBASE_MESSAGING_SENDER_ID=123456789
- REACT_APP_FIREBASE_APP_ID=1:123456789:web:abcdef
- REACT_APP_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
+ VITE_FIREBASE_API_KEY=your-api-key-here
+ VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
+ VITE_FIREBASE_PROJECT_ID=your-project-id
+ VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
+ VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
+ VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
+ VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```

### 5c. ⚠️ Acción manual (no automatizable)

> Renombrar las variables en el **`.env` local** y en el **dashboard de Vercel**  
> (Settings → Environment Variables → renombrar cada `REACT_APP_*` a `VITE_*`)

---

## Paso 6 — Corregir `require()` de CommonJS en `src/services/firebase/config.js`

**Vite es ESM-only en el bundle.** El `require()` en el catch block de línea 54 causará error:

```js
// ❌ Actual (línea 54)
const { getFirestore } = require('firebase/firestore');
db = getFirestore(app);
```

**Solución:** Eliminar el try/catch interno. Firebase maneja internamente el caso de doble inicialización:

```js
// ✅ Reemplazar el bloque try/catch interno de Firestore por:
db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});
```

---

## Verificación final

```bash
npm install
npm run dev    # debe levantar en localhost:3000 sin errores
npm run build  # debe generar /build sin errores
```

Checklist en el navegador:
- [ ] No aparece `FirebaseWarning` (variables de entorno OK)
- [ ] Login / registro funciona
- [ ] Imágenes de la tienda cargan
- [ ] Editor (Fabric.js) abre sin errores de consola
- [ ] Rutas de React Router funcionan al recargar (configurar redirect en Vercel si aplica)
