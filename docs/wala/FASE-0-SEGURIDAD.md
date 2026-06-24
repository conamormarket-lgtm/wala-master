# FASE 0 — Runbook de Seguridad (WALA / Portal Clientes)

> Estado: BORRADOR ACCIONABLE. Severidad de la fase: **BLOQUEANTE**. No desplegar nuevas features hasta cerrar los hallazgos CRITICOS.
>
> Proyecto PROD (Portal): `pruebas-cd728` (es produccion real pese al nombre).
> Proyecto ERP: separado, via env `REACT_APP_ERP_FIREBASE_*` -> en este doc se referencia como `<ERP_PROJECT_ID>`.
>
> Todos los hallazgos fueron verificados releyendo el codigo real. Cada uno cita `archivo:linea`.

---

## Como leer este runbook

Para cada hallazgo:
- **Titulo / Severidad / Ubicacion** (`archivo:linea`).
- **Codigo actual** (fragmento real).
- **Por que es explotable** (vector concreto, paso a paso).
- **Fix recomendado** (enfoque tecnico, NO el parche completo).
- **Desplegar** (comando exacto, en PowerShell).
- **Verificar** (como confirmar que el agujero se cerro).

> Prerrequisito de tooling: el usuario NO tiene instalados `firebase-tools` ni `gcloud`. Para todos los despliegues de reglas/functions instalar primero:
> ```powershell
> npm install -g firebase-tools
> firebase login
> firebase use pruebas-cd728
> ```
> Los scripts `npm run deploy:firestore-rules` / `deploy:storage-rules` invocan `node scripts/deploy-*.js`; `npm run deploy:functions` = `firebase deploy --only functions`. Todos requieren `firebase-tools` y sesion iniciada.

---

## H-01 — Backdoor de administrador hardcodeado en el login (CRITICO)

**Ubicacion:** `src/pages/LoginPage.jsx:38-43` (+ propagacion en `src/contexts/AuthContext.jsx:308-312`).

**Codigo actual:**
```jsx
// src/pages/LoginPage.jsx:38-43
if (email === 'AdminWalaPro' && password === 'LaClaveDeWala2020') {
  localStorage.setItem('adminWalaPro', 'true');
  // Forzar recarga completa para que el AuthContext lea el localStorage y actualice isAdmin
  window.location.href = '/admin';
  return;
}
```
```jsx
// src/contexts/AuthContext.jsx:308
const isLegacyAdmin = userProfile?.role === 'admin'
  || user?.email === 'yorh001@gmail.com'
  || user?.email === 'heyeru24@gmail.com'
  || localStorage.getItem('adminWalaPro') === 'true';
// :312
const isAdmin = isLegacyAdmin || effectiveAdminPermissions.length > 0;
```

**Por que es explotable (vector concreto):**
1. La cadena literal `'LaClaveDeWala2020'` se compila dentro del bundle JS publico (`build/static/js/*.js`). Cualquiera que abra DevTools -> Sources -> busque `AdminWalaPro` la lee en segundos.
2. Con esa clave, el atacante setea `localStorage.adminWalaPro = 'true'` (incluso a mano desde la consola, sin login real) y `AuthContext` lo trata como **superadmin** (`AuthContext.jsx:310` asigna `['superadmin']`).
3. El "admin" resultante NO esta autenticado en Firebase Auth: es un flag client-side. Todo gate que dependa de `isAdmin` (ej. `AdminRoute.jsx:21-25`, `AdminBar`, editor de tienda) queda abierto. Las reglas de Firestore/Storage que usan `request.auth` lo frenaran para escrituras, pero la UI de admin y cualquier accion que NO pase por reglas (llamadas a Functions sin verificacion, edicion visual) queda comprometida.

**Fix recomendado (tecnico):**
- Eliminar por completo el bloque `LoginPage.jsx:38-43`.
- Eliminar la lectura de `localStorage.getItem('adminWalaPro')` en `AuthContext.jsx:308` y la lista de emails hardcodeados (`AuthContext.jsx:71`, `AuthContext.jsx:308`).
- Migrar el rol admin a **Firebase custom claims**: una Cloud Function `setAdminClaim` (callable, protegida: solo ejecutable por un superadmin ya existente o por script de operador con cuenta de servicio) hace `admin.auth().setCustomUserClaims(uid, { admin: true, role: 'superadmin' })`.
- En el cliente, derivar `isAdmin` del token: `const token = await user.getIdTokenResult(); isAdmin = token.claims.admin === true;`. Nunca de `localStorage`.
- Bootstrap inicial de los superadmins reales: ejecutar una vez un script Node con cuenta de servicio que asigne el claim a los UIDs de `yorh001@gmail.com` y `heyeru24@gmail.com` (no por email en runtime).

**Desplegar:**
```powershell
# tras editar LoginPage.jsx y AuthContext.jsx
npm run build
npm run deploy:vercel:prod   # o npx vercel --prod
# si se anade la function setAdminClaim:
npm run deploy:functions
```

**Verificar:**
- `grep -ri "LaClaveDeWala2020\|adminWalaPro" src/ build/` -> 0 resultados tras `npm run build`.
- En el navegador: `localStorage.setItem('adminWalaPro','true')` + recarga -> NO debe dar acceso a `/admin`.
- Un usuario sin claim `admin` recibe redirect en `AdminRoute`.

---

## H-02 — `secureClaimMonedas`: validacion de propiedad y estado del pedido COMENTADA (CRITICO)

**Ubicacion:** `functions/index.js:170-268` (validacion deshabilitada en `:188` y `:202-220`).

**Codigo actual:**
```js
// functions/index.js:186-188
const uid = context.auth.uid;
const userRef = db.collection(PORTAL_USERS_COLLECTION).doc(uid);
// const orderRef = db.collection("orders").doc(pedidoId);   // <-- deshabilitado
```
```js
// functions/index.js:202-220  (TODO el bloque de verificacion esta comentado)
/*
const orderDoc = await transaction.get(orderRef);
...
if (orderData.userId !== uid && orderData.dni !== userData.dni) {
  throw new functions.https.HttpsError("permission-denied", "Este pedido no le pertenece.");
}
... if (!["finalizado","entregado","completado"].includes(estado)) { ... }
*/
```

**Por que es explotable (vector concreto):**
1. La funcion es callable y solo exige estar autenticado (`:171`).
2. El unico control real que queda es el anti-doble-reclamo (`:223-225`: `reclamadas.includes(pedidoId)`).
3. Un usuario autenticado puede llamar la funcion con **cualquier `pedidoId` inventado** (ej. `claim-1`, `claim-2`, ...) y recibir `amount` monedas (default 10) por cada string distinto. No se valida que el pedido exista, ni que sea suyo, ni que este finalizado. Es acunacion de moneda infinita.

**Fix recomendado (tecnico):**
- Inicializar un segundo Admin SDK app apuntando al **Firebase del ERP** (cuenta de servicio del ERP en secret manager / env), porque los pedidos viven en `<ERP_PROJECT_ID>`, colecciones `pedidos` / `pedidos_web`.
- Dentro de la transaccion, leer el pedido del ERP y reactivar las tres validaciones: existe, pertenece al usuario (`userId === uid || dni === userData.dni`), y estado en {finalizado, entregado, completado} (normalizado).
- Mantener `monedasReclamadas` como `arrayUnion(pedidoId)` para idempotencia (ya esta bien en `:259`).
- Si el monto debe depender del pedido (no del cliente), calcular `amount` server-side desde el total del pedido, ignorando el `amount` enviado por el cliente (`:178` actualmente confia en `data.amount`).

**Desplegar:**
```powershell
# configurar credenciales del ERP como secret (ejemplo):
firebase functions:secrets:set ERP_SERVICE_ACCOUNT
npm run deploy:functions
```

**Verificar:**
- Llamar `secureClaimMonedas({ pedidoId: 'noexiste-123' })` autenticado -> debe responder `not-found`.
- Llamar con un `pedidoId` real de OTRO usuario -> `permission-denied`.
- Llamar con un pedido propio NO finalizado -> `failed-precondition`.
- Reclamar dos veces el mismo pedido valido -> segundo intento `already-exists`.

---

## H-03 — `ensureAccountFromOrder`: webhook sin autenticacion, CORS abierto y password = DNI (CRITICO)

**Ubicacion:** `functions/index.js:89-164` (CORS `:90-96`, password `:72-77` + `:132-136`).

**Codigo actual:**
```js
// functions/index.js:89-96
exports.ensureAccountFromOrder = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, X-Webhook-Secret"); // <-- anuncia el header pero NUNCA lo valida
    res.status(204).end();
    return;
  }
```
```js
// functions/index.js:72-77  (contrasena inicial = DNI)
function buildPassword(dni) {
  if (dni == null || String(dni).trim() === "") return null;
  const n = String(dni).trim().replace(/\s/g, "");
  if (n.length >= MIN_PASSWORD_LENGTH) return n;
  return n.padStart(MIN_PASSWORD_LENGTH, "0");
}
// :132-136 -> auth.createUser({ email, password, displayName })
```

**Por que es explotable (vector concreto):**
1. Es `https.onRequest` **sin ninguna verificacion de secreto**. El header `X-Webhook-Secret` se declara en CORS (`:93`) pero nunca se lee/compara en el handler. Cualquiera que conozca la URL (`https://<region>-pruebas-cd728.cloudfunctions.net/ensureAccountFromOrder`) puede crear cuentas.
2. CORS `*` (`:90`) permite invocarla desde cualquier origen via navegador -> creacion masiva de cuentas (spam, agotar cuotas de Auth, envenenar `portal_clientes_users`).
3. La contrasena inicial es el **DNI** del cliente (`buildPassword`). El DNI peruano es semipublico (figura en boletas, redes, brechas). Un atacante que conozca email + DNI de una victima inicia sesion como ella. Peor: el atacante puede *crear* la cuenta el mismo con datos de la victima y luego entrar con el DNI que el mismo envio.

**Fix recomendado (tecnico):**
- **Autenticar el webhook con HMAC**: el ERP firma el body con un secreto compartido (`HMAC-SHA256(body, ERP_WEBHOOK_SECRET)`) y lo envia en `X-Webhook-Signature`. La function recalcula y compara con `crypto.timingSafeEqual`. Rechazar 401 si no coincide. Guardar el secreto en `functions.secrets` (no en codigo).
- **Restringir CORS**: quitar `*`; permitir solo el origen del ERP (o, si es server-to-server, eliminar CORS por completo, un webhook backend no necesita preflight de navegador).
- **Eliminar `password = DNI`**: crear la cuenta con `auth.createUser({ email, displayName })` SIN password, y luego `auth.generatePasswordResetLink(email)` o un magic link (Firebase email-link sign-in) que se envia al correo del cliente para que defina su propia contrasena. Borrar `buildPassword` y la rama `NO_DNI` que aborta si falta DNI (`:111-115`).
- Opcional: rate-limit por IP/firma para mitigar abuso.

**Desplegar:**
```powershell
firebase functions:secrets:set ERP_WEBHOOK_SECRET
npm run deploy:functions
# Coordinar con el equipo del ERP para que empiece a firmar el payload.
```

**Verificar:**
- `POST` sin firma o con firma invalida -> `401`.
- `POST` con firma valida y email nuevo -> crea cuenta SIN password y dispara email de set-password.
- Intentar login de la nueva cuenta usando el DNI como contrasena -> debe FALLAR.
- `curl` con `Origin` arbitrario -> sin `Access-Control-Allow-Origin: *` en la respuesta.

---

## H-04 — `sendManualPromoNotification` no valida que el llamante sea admin (CRITICO)

**Ubicacion:** `functions/notificationsEngine.js:154-164`.

**Codigo actual:**
```js
// functions/notificationsEngine.js:154-164
exports.sendManualPromoNotification = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Debe estar autenticado.");
  }

  // Opcional: Validar si context.auth.uid es admin consultando portal_clientes_users   <-- nunca se hace

  const { title, body, segment } = data;
  if (!title || !body) { ... }
```

**Por que es explotable (vector concreto):**
1. Solo exige autenticacion; el chequeo de admin esta como **comentario** (`:159`).
2. Cualquier usuario registrado puede llamar `sendManualPromoNotification({ title, body, segment })` y enviar push masivos (FCM) + notificaciones in-app a **toda la base de `portal_clientes_users`** (`:167-208`). Vector de phishing/spam a escala, dano reputacional y posible bloqueo de la app en FCM por abuso.

**Fix recomendado (tecnico):**
- Al inicio, tras el chequeo de `context.auth`, exigir el **custom claim** `admin`: `if (context.auth.token.admin !== true) throw new HttpsError("permission-denied", ...)`. (Depende de H-01 para tener claims.)
- Mientras se migra a claims, como puente: leer `adminUsers/{uid}` y exigir `role === 'admin'`. Pero el objetivo final es el claim.

**Desplegar:**
```powershell
npm run deploy:functions
```

**Verificar:**
- Usuario normal autenticado llama la funcion -> `permission-denied`.
- Admin con claim -> envia y retorna `{ success: true, count }`.

---

## H-05 — `referrals.js` escribe a coleccion inexistente `portal_users` y acredita monedas desde el cliente (ALTO)

**Ubicacion:** `src/services/referrals.js:186` (claim), `:205` y `:211` (updateReferralCode).

**Codigo actual:**
```js
// src/services/referrals.js:186  (dentro de claimReferralCoins)
await setDocument('portal_users', uid, {
  monedas: currentMonedas + earnedCoins,
  updatedAt: serverTimestamp()
});
```
```js
// src/services/referrals.js:205 / :211 (updateReferralCode)
const q = query(collection(db, 'portal_users'), where('referralCode', '==', cleanCode));
...
await setDocument('portal_users', uid, { referralCode: cleanCode, referralCodeEdited: true, ... });
```

**Por que es explotable / por que falla (vector concreto):**
1. La coleccion real de usuarios es **`portal_clientes_users`** (ver `functions/index.js:13`, `AuthContext` `PORTAL_USERS_COLLECTION`). `portal_users` NO existe -> estas escrituras crean una coleccion huerfana o fallan silenciosamente. El check de unicidad de `referralCode` (`:205`) consulta la coleccion equivocada, asi que **nunca detecta colisiones** -> codigos de referido duplicables.
2. `claimReferralCoins` acredita `monedas` **desde el cliente** confiando en `earnedCoins` y `currentMonedas` pasados por el front. Aun apuntando a la coleccion correcta, esto seria falsificable (el usuario controla el monto). Es economia escrita por el cliente (ver tambien H-06).

**Fix recomendado (tecnico):**
- Corregir el nombre de coleccion en `:186`, `:205`, `:211` a `portal_clientes_users`.
- Mover `claimReferralCoins` a una **Cloud Function callable idempotente**: valida que el `referralId` este en estado `completed`, que `referrerCode` pertenezca al `uid`, marca `claimed` y acredita el monto **calculado en backend** (no el enviado por el cliente), todo en una transaccion. El cliente solo pasa `referralId`.
- Endurecer reglas para que `monedas`/`referralCode` no sean escribibles por el propio usuario (ya estan parcialmente bloqueadas en `firestore.rules:108-111`, ver H-06/H-07).

**Desplegar:**
```powershell
npm run build
npm run deploy:vercel:prod
npm run deploy:functions   # si se anade la function claimReferral
npm run deploy:firestore-rules
```

**Verificar:**
- Tras el fix, `claimReferralCoins` desde el cliente directo a Firestore debe ser rechazado por reglas; solo la function acredita.
- Crear dos referidos con el mismo `referralCode` -> la unicidad ahora se detecta.
- Confirmar que ya no se crea la coleccion `portal_users` (revisar consola Firestore).

---

## H-06 — Economia de puntos escrita directamente desde el cliente (CRITICO)

**Ubicacion:** `src/contexts/AuthContext.jsx:132`, `:165`, `:181`, `:278` (via `updateUserProfile` -> `setDocument(PORTAL_USERS_COLLECTION, ...)`, `AuthContext.jsx:103-116`).

**Codigo actual:**
```js
// AuthContext.jsx:127-133 (earnMainCoins)
const currentGlobal = userProfile.monedas || 0;
await updateUserProfile({ monedas: currentGlobal + amount });
// :165 spendMonedas -> monedas: Math.max(0, currentMonedas - amount)
// :181 freeze -> monedasEnEspera: monedasEnEspera + amount
// :278 feedKapi -> kapiCoins: currentKapiCoins + coinsToAdd
```
```js
// AuthContext.jsx:106  (como se escribe)
const { error } = await setDocument(PORTAL_USERS_COLLECTION, user.uid, updates);
```

**Por que es explotable (vector concreto):**
1. Toda la economia (`monedas`, `monedasActivas`, `kapiCoins`, `monedasEnEspera`) se calcula en el navegador y se persiste con `setDocument` directo a `portal_clientes_users`. Un usuario con DevTools puede llamar estas funciones (o escribir directo a Firestore con el SDK) y fijarse el saldo que quiera.
2. **Interaccion importante con las reglas:** `firestore.rules:108-111` bloquea, para el propio usuario, los campos `['monedas','monedasReclamadas','monedasEnEspera','historialMonedasEspera','role']`. Esto significa que estas escrituras-cliente o bien **fallan silenciosamente** (rompiendo la feature de puntos para usuarios legitimos) o bien tienen exito por una via privilegiada (el backdoor admin de H-01, o porque la app corre con un perfil que evade la regla). En cualquier caso hay incoherencia entre codigo y reglas que debe resolverse de raiz. `kapiCoins` y `monedasActivas` NO estan en la lista bloqueada -> esos si son escribibles por el cliente hoy.

**Fix recomendado (tecnico):**
- Mover **todo** earn/spend/freeze a Cloud Functions callable **idempotentes y transaccionales** (como ya es `secureClaimMonedas`). El cliente nunca escribe campos de saldo.
- Anadir `monedasActivas`, `kapiCoins`, `activeMultiplier`, `multiplierExpiresAt`, `antiSpamLog`, `referralCode`, `referralCodeEdited` a la lista de campos prohibidos en reglas para escritura por el usuario (complementa H-07).
- En `AuthContext`, reemplazar las escrituras locales por llamadas a las functions; `userProfile` se refresca leyendo el doc tras la operacion.

**Desplegar:**
```powershell
npm run deploy:functions
npm run deploy:firestore-rules
npm run build && npm run deploy:vercel:prod
```

**Verificar:**
- Desde la consola del navegador, intentar `setDoc(doc(db,'portal_clientes_users',miUid), { monedas: 999999 })` -> rechazado por reglas (permission-denied).
- Lo mismo con `kapiCoins` y `monedasActivas` -> rechazado.
- Las features de puntos siguen funcionando via las functions.

---

## H-07 — Reglas Firestore: colecciones mal nombradas (`products`/`categories`) y campos de monedas (CRITICO)

**Ubicacion:** `firebase/firestore.rules:19-29` (colecciones fantasma), `:94-113` (lista de campos sensibles incompleta).

**Codigo actual:**
```
// firebase/firestore.rules:20-29
match /products/{productId}   { allow read: if true; allow write: if isAdmin(); }
match /categories/{categoryId}{ allow read: if true; allow write: if isAdmin(); }
```
**Colecciones reales que la app usa (verificado):**
- `src/services/products.js:6` -> `const COLLECTION = 'productos_wala';`
- `src/services/categories.js:3` -> `const COLLECTION = 'tienda_categories';`

**Por que es explotable / por que falla (vector concreto):**
1. Las reglas protegen `products`/`categories`, colecciones que **nadie usa**. Las colecciones reales `productos_wala` y `tienda_categories` **no tienen ninguna regla**. En `rules_version='2'` sin match -> **deny by default**: el admin no puede escribir productos/categorias por reglas (probablemente "funciona" hoy solo gracias a vias que evaden reglas o porque el panel admin usa otra ruta). Si en algun punto existiera un match catch-all permisivo, seria exposicion total. En ambos extremos es un fallo de control de acceso.
2. La lista de campos sensibles (`:99-100` y `:109-111`) cubre `monedas`/`monedasReclamadas`/`monedasEnEspera`/`historialMonedasEspera`/`role` pero NO `monedasActivas`, `kapiCoins`, `activeMultiplier`, `multiplierExpiresAt`, `referralCode`. Esos son auto-modificables por el usuario (ver H-06).

**Fix recomendado (tecnico):**
- Renombrar los match a las colecciones reales:
  - `match /productos_wala/{id}` -> `allow read: if true; allow write: if isAdmin();`
  - `match /tienda_categories/{id}` -> idem.
  - Eliminar (o dejar comentados como deprecados) los match de `products`/`categories`.
- Auditar el resto de colecciones reales que la app toca (`referrals`, `wishlists`, `challengeEvidences`, `weeklyChallenges`, `globals`, `notification_settings`, `analytics_kapi`, subcoleccion `users/{uid}/notifications`) y asegurarse de que cada una tenga regla explicita; las que no aparezcan en las reglas hoy estan en deny-all o expuestas segun haya o no catch-all.
- Ampliar la lista de campos bloqueados en `portal_clientes_users` (y `users`) segun H-06.
- Unificar `isAdmin()` con custom claims: `function isAdmin() { return request.auth.token.admin == true; }` (ver H-09), evitando el `get()` por documento que cuesta lecturas y depende de `adminUsers`.

**Desplegar:**
```powershell
npm run deploy:firestore-rules
```

**Verificar:**
- Admin escribe en `productos_wala` -> permitido. Usuario normal -> denegado.
- Usuario intenta escribir `monedasActivas`/`kapiCoins` en su perfil -> denegado.
- Usar el **Rules Playground** de la consola Firebase para simular cada caso antes de confiar en produccion.

---

## H-08 — `enlaces_pago` con `update`/`delete: if true` (CRITICO)

**Ubicacion:** `firebase/firestore.rules:128-132`.

**Codigo actual:**
```
// firebase/firestore.rules:128-132
match /enlaces_pago/{enlaceId} {
  allow read: if true;            // Publico para el que tiene el link
  allow create: if isAdmin();     // Solo admin puede generarlos
  allow update, delete: if true;  // <-- cualquiera puede modificar o borrar
}
```

**Por que es explotable (vector concreto):**
1. `update: if true` -> cualquiera (incluso sin autenticar) puede marcar un enlace de pago como `pagado`, o cambiar el monto/estado de cualquier enlace cuyo ID conozca o adivine. Un cliente puede "pagar" sin pagar.
2. `delete: if true` -> cualquiera puede borrar enlaces de pago (denegacion de servicio, perdida de registros de cobro).

**Fix recomendado (tecnico):**
- El estado de pago NO debe poder fijarlo el cliente. Marcar como pagado debe hacerse desde una **Cloud Function que verifique el webhook/IPN de PayPal** (firma/verificacion del proveedor), no desde reglas abiertas.
- Reglas: `allow update, delete: if isAdmin();` y, si se necesita que el cliente confirme algo, restringir `update` a campos no sensibles con `diff().affectedKeys()` o eliminarlo.
- `read: if true` puede mantenerse solo si el ID es un token no adivinable (UUID v4); si no, restringir.

**Desplegar:**
```powershell
npm run deploy:firestore-rules
npm run deploy:functions   # si se anade webhook PayPal
```

**Verificar:**
- Cliente no admin intenta `update`/`delete` un `enlaces_pago` -> permission-denied.
- El estado `pagado` solo cambia tras webhook verificado de PayPal.

---

## H-09 — `isAdmin()` basado en documento Firestore en lugar de custom claims (ALTO)

**Ubicacion:** `firebase/firestore.rules:13-17`, `firebase/storage.rules:9-12`.

**Codigo actual:**
```
// firestore.rules:13-17
function isAdmin() {
  return isAuthenticated() &&
    exists(/databases/$(database)/documents/adminUsers/$(request.auth.uid)) &&
    get(/databases/$(database)/documents/adminUsers/$(request.auth.uid)).data.role == 'admin';
}
```

**Por que es problematico (vector concreto):**
1. Depende de la coleccion `adminUsers/{uid}` con `role=='admin'`, pero el codigo de la app gestiona admins por **email** (`AuthContext.jsx:71`), por `localStorage` (H-01) y por `adminPermissions`/`setAdminRole` — fuentes inconsistentes. Resultado: el "admin" de la UI puede NO ser admin para las reglas, y viceversa. Esa brecha es la que hace que features como productos (H-07) parezcan funcionar por caminos que evaden reglas.
2. Cada evaluacion hace 1-2 lecturas (`exists`+`get`), encareciendo y ralentizando cada operacion admin.

**Fix recomendado (tecnico):**
- Unificar TODO el modelo de admin en **custom claims** (`request.auth.token.admin == true`), seteados por la function de H-01.
- Reescribir `isAdmin()` en `firestore.rules` y `storage.rules` para leer el claim. Elimina las lecturas extra y cierra la inconsistencia.
- Deprecar `adminUsers` como fuente de verdad de autorizacion (puede quedar como metadato de UI).

**Desplegar:**
```powershell
npm run deploy:firestore-rules
npm run deploy:storage-rules
```

**Verificar:**
- Usuario con claim `admin` escribe en colecciones admin -> OK; sin claim -> denegado, sin importar `adminUsers`.

---

## H-10 — Uso de API FCM deprecada `messaging.sendToDevice()` (MEDIO)

**Ubicacion:** `functions/notificationsEngine.js:35` y `:196`.

**Codigo actual:**
```js
// notificationsEngine.js:35
const response = await messaging.sendToDevice(tokens, payload);
// :196 (en sendManualPromoNotification) identico
```

**Por que importa:** `sendToDevice` es API legacy de FCM, en camino de retiro. Su descontinuacion dejaria sin push toda la logica de retencion/carrito/promos. No es explotable por un atacante, pero es deuda critica de disponibilidad.

**Fix recomendado:** migrar a `messaging.sendEachForMulticast({ tokens, notification, data })` (o `sendEach`), manejar `response.responses[i].success` y limpiar tokens invalidos (`messaging/registration-token-not-registered`) de `fcmTokens`.

**Desplegar:** `npm run deploy:functions`.

**Verificar:** enviar una notificacion de prueba a un token valido y otro invalido; confirmar entrega al valido y limpieza del invalido.

---

## H-11 — `processCulqiPayment`: secret key con fallback dummy y sin validacion del monto (MEDIO)

**Ubicacion:** `functions/index.js:536-580` (`:544`).

**Codigo actual:**
```js
// functions/index.js:544
const secretKey = process.env.CULQI_SECRET_KEY
  || process.env.REACT_APP_CULQI_SECRET_KEY
  || "sk_test_dummy_key";
// :537 amount, email, tokenId vienen del cliente; se cobran tal cual (:554 amount)
```

**Por que importa (vector concreto):**
1. El fallback `"sk_test_dummy_key"` puede provocar cobros en modo test silenciosos si la env no esta configurada (pagos que parecen exitosos pero no lo son).
2. `REACT_APP_*` es un prefijo de variables que se exponen en el bundle del cliente: si esa key se usara, estaria filtrada. La key privada de Culqi NUNCA debe llevar prefijo `REACT_APP_`.
3. El `amount` lo fija el cliente (`:537`, `:554`) sin validacion server-side contra el carrito/pedido -> un cliente podria pagar menos de lo debido.

**Fix recomendado (tecnico):**
- Exigir `CULQI_SECRET_KEY` (secret de Functions); si falta, **fallar** (`throw`), no usar dummy.
- Eliminar la lectura de `REACT_APP_CULQI_SECRET_KEY`.
- Recalcular/validar `amount` en backend contra el total real del pedido/carrito antes de cobrar.

**Desplegar:**
```powershell
firebase functions:secrets:set CULQI_SECRET_KEY
npm run deploy:functions
```

**Verificar:** sin `CULQI_SECRET_KEY` configurada -> la function aborta. Intentar pagar un monto manipulado menor al total -> rechazado.

---

# Checklist ordenado de la Fase 0

Ejecutar de arriba hacia abajo. Los bloques se agrupan por dependencia (claims primero, luego reglas, luego functions, luego front).

**Bloque A — Identidad y roles (habilita el resto)**
- [ ] A1. Implementar Cloud Function `setAdminClaim` (custom claims) y script de bootstrap para los superadmins reales. (H-01, H-09)
- [ ] A2. Eliminar backdoor `LoginPage.jsx:38-43` y la lectura de `localStorage.adminWalaPro` + emails hardcodeados en `AuthContext.jsx:71,308`. (H-01)
- [ ] A3. Derivar `isAdmin` del token (`getIdTokenResult().claims.admin`). (H-01)

**Bloque B — Reglas (deny-by-default correcto)**
- [ ] B1. Renombrar match `products`->`productos_wala` y `categories`->`tienda_categories`. (H-07)
- [ ] B2. Reescribir `isAdmin()` en firestore.rules y storage.rules para usar `request.auth.token.admin`. (H-09)
- [ ] B3. Ampliar campos bloqueados en `portal_clientes_users`/`users`: anadir `monedasActivas`, `kapiCoins`, `activeMultiplier`, `multiplierExpiresAt`, `referralCode`, `referralCodeEdited`. (H-06)
- [ ] B4. `enlaces_pago`: `update, delete: if isAdmin();` (H-08)
- [ ] B5. Auditar colecciones sin regla (referrals, wishlists, challengeEvidences, weeklyChallenges, globals, notification_settings, analytics_kapi, users/{uid}/notifications) y anadir reglas explicitas.
- [ ] B6. Desplegar: `npm run deploy:firestore-rules` + `npm run deploy:storage-rules`. Validar en Rules Playground.

**Bloque C — Cloud Functions**
- [ ] C1. `sendManualPromoNotification`: exigir claim admin al inicio. (H-04)
- [ ] C2. `secureClaimMonedas`: reactivar validacion de propiedad/estado leyendo el pedido del ERP; calcular `amount` server-side. (H-02)
- [ ] C3. `ensureAccountFromOrder`: HMAC del webhook, CORS restringido, quitar password=DNI -> magic link / reset link. (H-03)
- [ ] C4. Mover earn/spend/freeze y `claimReferralCoins` a Functions idempotentes. (H-05, H-06)
- [ ] C5. `processCulqiPayment`: exigir secret real (sin dummy ni `REACT_APP_`), validar monto. (H-11)
- [ ] C6. Migrar `sendToDevice` -> `sendEachForMulticast` + limpieza de tokens. (H-10)
- [ ] C7. Desplegar: `npm run deploy:functions`.

**Bloque D — Front / correccion de bugs**
- [ ] D1. Corregir `portal_users`->`portal_clientes_users` en `referrals.js:186,205,211`. (H-05)
- [ ] D2. Reemplazar escrituras de saldo en `AuthContext` por llamadas a las Functions. (H-06)
- [ ] D3. `npm run build` + `npm run deploy:vercel:prod`.

**Bloque E — Verificacion end-to-end**
- [ ] E1. Confirmar que el bundle ya no contiene `LaClaveDeWala2020` ni `adminWalaPro`.
- [ ] E2. Smoke test de economia (no se puede acunar moneda desde cliente ni con pedido falso).
- [ ] E3. Smoke test de webhook (sin firma -> 401; con firma -> cuenta sin password + email de set-password).
- [ ] E4. Smoke test de notificaciones (usuario normal no puede enviar masivos).

---

# Matriz de riesgo (Impacto x Facilidad de explotacion)

Facilidad: **Trivial** = clave/URL en el bundle o regla `if true`; **Facil** = requiere cuenta autenticada + DevTools; **Media** = requiere datos parcialmente publicos (DNI/email) o conocer IDs.

| ID | Hallazgo | Impacto | Facilidad | Prioridad |
|----|----------|---------|-----------|-----------|
| H-01 | Backdoor admin hardcodeado (clave en bundle) | Critico (control total UI admin) | Trivial | **P0** |
| H-08 | `enlaces_pago` update/delete: if true | Critico (fraude de pago / DoS) | Trivial | **P0** |
| H-02 | secureClaimMonedas sin validacion de pedido | Critico (acunacion infinita de monedas) | Facil | **P0** |
| H-04 | sendManualPromoNotification sin admin | Critico (spam/phishing a toda la base) | Facil | **P0** |
| H-06 | Economia escrita desde el cliente | Critico (saldos falsificables) | Facil | **P0** |
| H-03 | Webhook sin auth + password=DNI + CORS * | Critico (toma de cuentas / creacion masiva) | Media | **P0** |
| H-07 | Reglas con colecciones fantasma + campos sensibles incompletos | Alto (control de acceso roto) | Media | **P1** |
| H-05 | referrals -> `portal_users` + acreditacion cliente | Alto (monedas falsificables / codigos duplicados) | Facil | **P1** |
| H-09 | isAdmin por doc Firestore, no claims | Alto (autorizacion inconsistente) | Media | **P1** |
| H-11 | Culqi: dummy key + monto del cliente | Medio (cobros incorrectos / pago menor) | Media | **P2** |
| H-10 | FCM sendToDevice deprecado | Medio (perdida futura de push) | N/A (deuda) | **P2** |

> Orden de ataque recomendado para un cierre rapido de superficie: **P0 primero** (H-01, H-08, H-02, H-04, H-06, H-03), porque cada uno es explotable hoy por un atacante poco sofisticado. H-01 y H-09 deben resolverse juntos porque el resto de gates de admin dependen de un modelo de roles confiable (custom claims).

---

## Apendice — Mapa rapido archivo -> hallazgo

| Archivo | Lineas | Hallazgos |
|---------|--------|-----------|
| `src/pages/LoginPage.jsx` | 38-43 | H-01 |
| `src/contexts/AuthContext.jsx` | 71, 103-116, 132/165/181/278, 308-312 | H-01, H-06 |
| `functions/index.js` | 72-77, 89-164, 170-268, 536-580 | H-02, H-03, H-11 |
| `functions/notificationsEngine.js` | 35, 154-164, 196 | H-04, H-10 |
| `src/services/referrals.js` | 186, 205, 211 | H-05 |
| `firebase/firestore.rules` | 13-17, 20-29, 94-113, 128-132 | H-06, H-07, H-08, H-09 |
| `firebase/storage.rules` | 9-12 | H-09 |
| `src/services/products.js` | 6 (`productos_wala`) | evidencia H-07 |
| `src/services/categories.js` | 3 (`tienda_categories`) | evidencia H-07 |
