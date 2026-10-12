# Estado de pagos y reglas — traspaso (2026-10-12)

Documento para retomar el trabajo en otra conversación. Resume qué se hizo para que la
tienda cobre bien y de forma segura, qué falló con las reglas de Firestore y qué falta.

## 0. Contexto mínimo

| Cosa | Dónde |
|---|---|
| Tienda Walá (React + Vite, Vercel) | `C:\Users\Isaac\Desktop\wala-master` → GitHub `master` (auto-deploy Vercel, wala.pe) |
| Cloud Functions de Walá | `wala-master/functions/` (codebase `default`, proyecto `sistema-gestion-3b225`) |
| ERP "Aimunay" (Next.js, aimunayerp.com) | `C:\Users\Isaac\Downloads\Sistema Antiguo Firebase\sistema` → GitHub `conamormarket-lgtm/sistema`, rama `main` |
| Base de datos | **Un solo Firestore compartido** por Walá y el ERP: proyecto `sistema-gestion-3b225`, base `(default)`. El ERP tiene además bases de otros negocios (`aimunay`, `negocio-cliente-1`, `mussa`) que no se tocaron. |
| Clave de servicio (admin) | `...\Sistema Antiguo Firebase\sistema\serviceAccountKey.json` (no está en git). El usuario autorizó usarla para scripts. |
| Config de functions | `wala-master/functions/.env.sistema-gestion-3b225` (en .gitignore): credenciales PayPal **live** (verificadas), Kenta, `ADMIN_BRIDGE_EMAILS=conamormarket@gmail.com`. Culqi: secret `CULQI_SECRET_KEY` en Secret Manager. |
| Admin de Walá | `conamormarket@gmail.com` tiene el claim `admin: true`. `adminUsers` está vacía. `adminRoles` tiene 4 cuentas (h***@gmail ×2, m***@sistema.com, y***@gmail) — verificar con el dueño si son de su equipo. |

Reglas de trabajo del dueño: desplegar uno mismo las functions que cambian y después hacer push a
`master`; **reglas de Firestore solo con ok explícito del usuario**. Comunicación en español, simple.

## 1. Lo que ya está hecho y desplegado

### Fase 0-1 — huecos de pago (Walá, commit `f2304f7`)
- `processCulqiPayment`: el monto lo pone SIEMPRE el servidor (intención de checkout, saldo de un
  pedido validado, enlace o ticket). Si la ventana de Culqi muestra otro monto, no cobra. Solo PEN.
- El token de Culqi queda atado a usuario + objetivo (`culqiCharges/{tokenId}.objetivo`): ya no se
  reusa un pago viejo para otro pedido.
- Un cobro a la vez por pedido: intención `prepared → cobrando → paid_order_created`
  (`cobros_en_curso` para lo que no es intención). Respuesta perdida → queda "cobrando" 10 min.
- Landings pasan por `prepareCheckoutPayment`; el adelanto sale de `pages/{slug}` (antes Culqi cobraba
  el saldo en vez del adelanto).
- `culqiWebhook`: toma solo el id del aviso y consulta el cargo a la API de Culqi (un aviso inventado
  se ignora; Culqi responde 401 "Ruta inválida" para un id inexistente → `pagos.cargoNoExiste`).
  Webhook registrado en el panel de Culqi (comercio "Wala", `charge.creation.succeeded`, v2.0).
- El navegador ya no crea ni marca pedidos pagados (se quitó el respaldo de `CheckoutPage` y el modo
  cliente de PayPal). PayPal siempre por servidor; monto USD fijado al crear (`paypal_ordenes`).
- Admin en functions: solo el claim (o `adminUsers` para `ADMIN_BRIDGE_EMAILS`). `confirmPaymentSecure`
  (demo Mercado Pago) solo admin. Problemas de cobro → colección `pagos_anomalias`.
- Lógica pura y tests: `functions/pagosLogic.js`, `functions/test/pagosLogic.test.js`.

### Fase 2 — pagos online dentro del ERP (Walá `95f3786`, `ef38122`; ERP `b3e2b747`)
- Pagar saldo desde "Mis pedidos" queda como un pago de cobranza del ERP: entrada en
  `cobranza.historialPagos` + movimiento en `fp_transactions` (pendiente de validar; cuenta "Culqi" /
  "PayPal" de Finanzas si existe — el usuario ya las creó; N° de operación = id del cobro).
  Reglas del ERP copiadas en `functions/erpCobranzaLogic.js` (saldo con añadidos, complementos,
  delivery del restante, castigado; auto-habilitado con flag `cobranzaLimaSinAutoHabilitar`).
  **Si el ERP cambia esas reglas, hay que cambiarlas aquí.**
- Pedido web pagado online: `montoAdelanto` = lo cobrado + bloque `pagoOnline` + movimiento de adelanto
  en Finanzas. En el ERP: etiqueta "Pagado online / Adelanto online", adelanto bloqueado al validar, y al
  aprobar el movimiento pasa al número de pedido nuevo (`lib/pago-online-web.ts`, `ventas-tab.tsx`).
- WhatsApp: `crearSolicitudWhatsappSecure` crea la solicitud desde la intención validada.
- "Mis pedidos" muestra el saldo real y no repite el pedido web aprobado.
- El ERP dejó de guardar el DNI como contraseña en `portal_clientes_users`; los 3 834 docs viejos se
  borraron (respaldo en `C:\Users\Isaac\Documents\respaldo-portal-legacy-2026-10-10*.json`).

### Fase 3a (parcial) — Walá `a940e5c`, ERP `3168fda6`
- Página de regalo → `obtenerRegaloSecure` (solo datos del regalo). Enlaces en dólares →
  `createPaypalEnlaceOrderSecure` / `capturePaypalEnlaceOrderSecure`. **Desplegado y vigente.**
- Reglas fusionadas Walá+ERP en `firebase/firestore.rules` (Walá) y `firestore.rules` (ERP), idénticas.
  **NO vigentes: se revirtieron** (ver §2).

## 2. Qué pasó con las reglas (incidente 2026-10-10)

- Desde el 2026-10-02 las reglas vivas son `allow read, write: if true`: **cualquiera en internet puede
  leer/escribir/borrar toda la base sin sesión** (pedidos, clientes, DNIs, Finanzas, `users` con las
  contraseñas del ERP en texto plano). Ocurrió porque un despliegue de reglas solo-Walá rompió el ERP y
  alguien publicó `if true` para recuperarlo.
- El 2026-10-10 se desplegaron las reglas fusionadas (probadas 44/44 en emulador). **El ERP se cayó** y se
  revirtió a `if true` el mismo día a pedido del dueño. Estado actual: **`if true`** (ruleset igual al
  anterior).
- Diseño de las reglas fusionadas: colecciones "solo Walá" (función `esSoloWala`, ~104) con sus reglas
  propias; todo lo demás con la regla del ERP (`request.auth != null`); sin sesión solo lo público.
- **Causa probable (sin confirmar):** el ERP no usa Firebase Auth de verdad. Su login compara la
  contraseña contra la colección `users` en el navegador, y para Firestore inicia una **sesión anónima
  "sin esperar"** (`lib/firebase.ts:167-186`, `ensureFirestoreAuth`). Sus listeners (`onSnapshot` en
  `contexts/auth-context.tsx`, `orders-context`, etc.) arrancan al cargar, ANTES de tener token →
  `permission-denied` → Firebase cancela el listener y no lo reintenta → pantallas sin datos.
  También revisar FinanzaPro (`finanzapro/src`), que solo inicia sesión anónima en
  `utils/conciliarComprobantes.js`. Las pruebas del emulador simulaban al ERP con la sesión ya iniciada,
  por eso no lo detectaron.

### Diagnóstico del 2026-10-12: las métricas no muestran que las reglas le cortaran los datos al ERP
Con Cloud Monitoring (`node scripts/metricas-reglas.cjs <clave> <inicio> <fin>`), comparando las dos caídas:

| | 02-10 (reglas solo Walá) | 10-10 (reglas fusionadas, 17:20–17:30 UTC) |
|---|---|---|
| Listeners abiertos | de ~430 a **~60** | se mantuvieron en ~440-500 |
| Rechazos/errores de reglas | ~30 000 cada 5 min | **~50 en total** |
| Lecturas rechazadas por la API | ~27 000 `RunAggregationQuery` cada 5 min | 5 `ListDocuments` |

- La sesión anónima del ERP sí funciona: Anonymous está activado, y el ERP crea usuarios anónimos desde el
  28-07 (`a4c549d1`); 19 se renovaron en las últimas 24 h. Firestore espera a que Auth cargue la sesión
  guardada, así que la carrera de `ensureFirestoreAuth` solo afecta a un navegador **sin** sesión guardada
  (primera vez, incógnito, datos borrados). Es un bug real y hay que arreglarlo, pero no explica una caída general.
- Ninguna colección "solo Walá" la usa el ERP (solo un comentario menciona `portal_clientes_users`).
- **Coincidencia:** Vercel publicó una versión nueva del ERP (`3168fda6`) a las **17:21:44 UTC**, 80 s después
  de las reglas (17:20:25). `b3e2b747` había salido a las 16:45. Las pestañas abiertas con la versión
  anterior pueden fallar al cargar partes nuevas, y recargar lo arregla.
- No hay acceso a los logs (la clave de servicio no puede leer Cloud Logging), así que no se sabe qué fueron
  los ~50 rechazos: pueden ser 2-3 navegadores sin sesión, o visitas de la tienda.
- Antes del 02-10 la base `(default)` tenía las reglas del ERP con `allow read: if true` y escritura sin
  sesión (rulesets del 21-09 y 29-09). El ERP **nunca** había corrido en `(default)` con reglas que exijan sesión.
- Lo que vio el equipo: "no dejaba moverse y no cargaba", a todos los que estaban en el ERP; Kevin lo atribuye
  al login. Para el próximo intento: no publicar el ERP a la vez, con el equipo atento y
  `scripts/metricas-reglas.cjs` corriendo.

### Arreglo del ERP (2026-10-12, ERP `8cad6b7e`, en producción)
- Reproducido en local y en un navegador sin sesión guardada: con el código anterior, Firestore abría el
  Listen a los 5,2 s y la sesión anónima recién terminaba a los 5,8 s.
- `lib/firebase.ts`: `ensureFirestoreAuth()` ahora espera `authStateReady()` (antes `currentUser` siempre era
  null al cargar el módulo) y devuelve una promesa; nueva `waitForFirestoreAuth(8000)`.
- `app-wrapper.tsx`: AppWrapper muestra "Cargando..." hasta `waitForFirestoreAuth()` y recién monta
  AuthProvider/OrdersProvider (todo lo que lee Firestore, incluida FinanzaPro, está debajo). Si la sesión
  falla o tarda más de 8 s, sigue como antes.
- Verificado en aimunayerp.com con un navegador limpio: sesión lista a 1,1 s, Firestore a 1,7 s.

### Reglas fusionadas VIVAS desde 2026-10-12 09:14 (Lima)
- Desplegadas desde `wala-master`. El ERP siguió normal (listeners ~420, sin rechazos propios).
- Se rompió el **visor de pedidos** (repo `conamormarket-lgtm/visordepedidos`, tablets, visordepedidos.vercel.app):
  no iniciaba ninguna sesión. Arreglado en `5119f99` (sesión anónima antes de montar la app), publicado en Vercel.
  Las tablets con la versión vieja deben recargar.
- Su **servidor de impresión** (`servidor-impresion-nube.js`, en una PC del local junto a la Zebra 192.168.18.71,
  se abre con `iniciar-servidor-impresion.bat`) escucha `print_queue`; arreglado en el mismo commit, pero hay que
  actualizarlo y reiniciarlo EN ESA PC (lo ve Kevin). Hasta entonces los tickets quedan `pending` y salen al reiniciar.
- Lección: hay otros sistemas que usan la base sin sesión. Antes de cerrar algo más, buscarlos (dominios
  autorizados en Auth: conamor.pe, yox-tau.vercel.app, portal-clientes-regala-con-amor.vercel.app).
- Reversión: `firestore.rules` con `allow read, write: if true` + `firebase deploy --only firestore:rules`
  (con `--config` a una carpeta aparte). Claude Code no la puede correr (el clasificador la bloquea): la corre el dueño.

## 3. Lo que falta (en orden)

### P0 — Reglas (la base sigue abierta a todo internet)
1. Preguntar al equipo qué vieron cuando se cayó (pantalla, error, captura).
2. Reproducir con el ERP real: correr el ERP en local contra el emulador con las reglas fusionadas,
   entrar con un usuario del ERP y ver qué se rechaza (consola del navegador).
3. Corregir el ERP para que **espere la sesión anónima antes de abrir listeners** (p. ej. una promesa
   `authReady` en `lib/firebase.ts` que esperen `mockFirestore`/los contexts), y lo mismo en FinanzaPro.
4. Repetir las pruebas (`firebase/test/reglas.test.mjs`, agregar casos que fallaron) y redesplegar en un
   horario acordado con el equipo del ERP, con reversión lista
   (`firestore.rules` = `allow read, write: if true` en una carpeta aparte + `firebase deploy --only firestore:rules`).
   Desplegar desde `wala-master` (`--only firestore:rules` solo toca la base `(default)`).
   El emulador necesita **Java 21** (en esta PC hay Java 8; se usó un JDK 21 portable de adoptium.net).
5. **Etapa 3b (proyecto grande):** migrar el login del ERP a Firebase Auth real (cuentas con claim
   `staff`), sacar las contraseñas en texto plano de `users`, y recién ahí cerrar pedidos/Finanzas/users
   a `staff`. Mientras tanto, lo del ERP queda abierto a cualquier sesión anónima.

### P1 — Probar con pagos reales (no se ha probado ninguno)
Checklist con montos chicos (luego devolver en Culqi/PayPal y anular en el ERP sin validar en Finanzas):
WhatsApp sin pago · compra con tarjeta (ver etiqueta en el ERP, adelanto bloqueado, movimiento en Finanzas,
aprobar, webhook 200 en Culqi) · landing con adelanto S/10 · saldo de S/3 desde "Mis pedidos" (pedido de
prueba en el ERP con el correo del dueño) · enlace USD 1 con PayPal · checkout en otro país con PayPal.
Revisar `pagos_anomalias` y los logs de `processCulqiPayment` / `culqiWebhook`.

### P2 — Menores
- `ProductCuestionarioModal` todavía crea `pedidos_web` desde el navegador (sin pago; lo valida el ERP).
- `ensureAccountFromOrder` (crear cuenta Walá al registrar pedido en el ERP) no lo llama nadie y no tiene
  `ERP_WEBHOOK_SECRET`: cualquiera puede crear cuentas con correos ajenos. Opcional: activarlo + correo
  de bienvenida.
- El ERP, al aprobar un pedido web SIN pago online, no registra el adelanto en Finanzas (hueco previo).
- `getWalaMirrorOrders` (cliente) consulta copias por DNI: con reglas cerradas falla en silencio; ya no
  hace falta (Mis pedidos va por `misPedidosSecure`).
- Reglas de Storage (`firebase/storage.rules`) no se revisaron.

## 4. Comandos útiles
```bash
# tests de functions
cd functions && node --test test/*.test.js
# desplegar functions (nunca sin --only functions:...)
firebase deploy --only functions:processCulqiPayment,functions:culqiWebhook --project sistema-gestion-3b225
# logs
firebase functions:log --only culqiWebhook --lines 50
```
Leer las reglas vivas (con la clave de servicio):
`admin.securityRules().getFirestoreRuleset()` (firebase-admin desde `functions/node_modules`).
