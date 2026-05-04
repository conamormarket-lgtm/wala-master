# Portal Clientes – Regala Con Amor

Portal de clientes: tienda, personalización de productos, pedidos, Mi cuenta (perfil, pedidos, creaciones) y checkout. Conectado a Firebase (auth, Firestore, Storage) y opcionalmente a un ERP vía Firestore.

## Requisitos

- Node.js 18+
- Cuenta en [Firebase](https://console.firebase.google.com) (mismo proyecto para auth y Firestore del portal)

## Configuración

1. **Variables de entorno**
   - Copia `.env.example` a `.env`.
   - En `.env` rellena las variables de Firebase (Portal) con los datos de tu proyecto en Firebase Console > Project Settings > General.
   - Opcional: configura las variables ERP si usas la segunda instancia de Firebase para pedidos.

2. **Firebase**
   - En la consola de Firebase, activa **Authentication** (métodos que uses: Email/contraseña, Google, etc.).
   - Despliega las reglas de Firestore: en la raíz del proyecto está `firebase/firestore.rules`; súbelas desde la consola o con Firebase CLI.

3. **Admin (opcional)**
   - Para acceder al panel Admin, crea en Firestore la colección `adminUsers` y un documento con ID = UID del usuario y campo `role: "admin"`.

## Scripts

```bash
npm install
npm start
```

- **npm start** – Desarrollo en `http://localhost:3000`
- **npm run build** – Build de producción en `/build`

## Estructura breve

- **Rutas:** `/` (tienda), `/personalizar`, `/editor/:id`, `/carrito`, `/checkout`, `/cuenta` (Mi cuenta con Perfil, Mis Pedidos, Mis Creaciones), `/login`, `/registro`, `/admin`.
- **Firebase (portal):** auth, Firestore (users, products, categories, designs, orders, etc.), Storage.
- **ERP:** segunda app Firebase para pedidos; configuración en `src/services/erp/` y variables `REACT_APP_ERP_FIREBASE_*`.

El archivo `.env` no se sube al repositorio; usa `.env.example` como plantilla.

## Despliegue en Vercel

1. **Sube el proyecto** a GitHub (o conecta tu repo en [vercel.com](https://vercel.com)).
2. **Importa el proyecto** en Vercel (New Project → Import Git Repository). Vercel detecta Create React App.
3. **Variables de entorno:** en el proyecto de Vercel → Settings → Environment Variables, añade las mismas que en tu `.env` (todas las `REACT_APP_*` que uses: Firebase, ERP, etc.).
4. **Firebase:** en Firebase Console → Authentication → Configuración → Dominios autorizados, añade tu dominio de Vercel (p. ej. `tu-proyecto.vercel.app`).
5. **Deploy:** cada push a la rama principal despliega automáticamente.

Para desplegar desde la terminal sin Git: `npx vercel` (te pedirá login la primera vez).
