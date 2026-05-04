# Despliegue en Vercel – Pasos finales

**Tu app ya está en producción:**  
https://portal-clientes-regala-con-amor.vercel.app

## 1. Variables de entorno en Vercel

En [vercel.com](https://vercel.com) → tu proyecto **portal-clientes-regala-con-amor** → **Settings** → **Environment Variables**, añade las mismas que en tu `.env` (para Production, Preview y Development):

- `REACT_APP_FIREBASE_API_KEY`
- `REACT_APP_FIREBASE_AUTH_DOMAIN`
- `REACT_APP_FIREBASE_PROJECT_ID`
- `REACT_APP_FIREBASE_STORAGE_BUCKET`
- `REACT_APP_FIREBASE_MESSAGING_SENDER_ID`
- `REACT_APP_FIREBASE_APP_ID`
- `REACT_APP_FIREBASE_MEASUREMENT_ID` (opcional)
- Las de ERP si las usas: `REACT_APP_ERP_FIREBASE_*`
- `REACT_APP_API_URL` si usas API externa

Después de guardar, haz un **Redeploy** (Deployments → ⋮ en el último deploy → Redeploy) para que tome las variables.

## 2. Firebase – Dominio autorizado

En [Firebase Console](https://console.firebase.google.com) → tu proyecto → **Authentication** → **Configuración** (o **Settings**) → **Dominios autorizados**, añade:

- `portal-clientes-regala-con-amor.vercel.app`

Así el inicio de sesión (Email/Google) funcionará en producción.

## 3. Siguientes despliegues

- **Desde Git:** conecta el repo en Vercel y cada push a la rama principal desplegará solo.
- **Desde la PC:** `npx vercel --prod` en la carpeta del proyecto.
