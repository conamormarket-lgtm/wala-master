# Plan para publicar las reglas de Firestore (2026-10-22)

Base `(default)` del proyecto `sistema-gestion-3b225`, la que comparten la tienda Walá,
el ERP (aimunayerp.com), el visor de pedidos y su servidor de impresión.
**Nada de esto se publicó.** Publicar necesita el ok explícito del dueño.

## 1. Cómo está producción hoy

- La base principal corre las **reglas fusionadas Walá + ERP** (34 872 caracteres,
  ruleset `bb38fe5e-2819-4f47-a524-5bf6eaf120fb`), publicadas el **2026-10-20 a las 12:42
  (Lima)** desde el repo del ERP, junto con las de `lumi`, `mussa`, `wala` y
  `negocio-cliente-1` en el mismo segundo.
- **No está abierta.** El "baseline de 2 700 caracteres" que se vio el 2026-10-21 era
  el de la base `lumi`: se tomó la primera publicación que empezaba por
  `cloud.firestore` en vez de la que termina exacto en `/releases/cloud.firestore`.
  `scripts/leer-reglas-vivas.cjs` ya elige la correcta.
- **Las monedas de los clientes ya están protegidas.** Viven en `portal_clientes_users`,
  que está en `esSoloWala` y no deja al dueño tocar los campos de saldo
  (`camposSaldo`). Probado: un cliente no puede subirse las monedas y una sesión
  anónima no toca las de otro.
- Lo vivo es una versión intermedia, sin commit en ningún repo: tiene `notSupervision()`
  en la regla general y en las reglas de varias líneas, pero no en las de una línea, y
  todavía no tiene el cierre de pedidos del 2026-10-16.

## 2. Qué cambia el archivo de este PR frente a lo vivo

El archivo es el del ERP (`conamormarket-lgtm/sistema`, `origin/main`, `firestore.rules`)
más lo de Las Bolitas de Kapi. Hoy las copias **no son iguales**: al ERP le faltan las
bolitas y a Walá le faltaban dos protecciones del ERP.

| Cambio | Qué cierra | A quién afecta |
|---|---|---|
| `bolitasConfig`, `bolitasJugadores`, `bolitasPatrocinios`, `bolitasPremios`, `bolitasProgreso`, `bolitasRetos`, `bolitasSemanas`, `bolitasStats` y `loyaltyConfig` en `esSoloWala`, con su regla | Hoy **cualquier sesión, incluso una anónima que abre cualquiera**, las escribe: puede cambiar el premio del reto, el ranking, los premios entregados o poner `loyaltyConfig/global.bolitasExigirPrueba = false` | Nadie más las usa. El juego pasa a leer los mundos y el patrocinio **sin sesión** (hoy eso falla) |
| `readModels_*` y `financeMetrics_*` sin escritura desde el navegador | Hoy cualquier sesión puede alterar los resúmenes de Finanzas y del panel del ERP | ERP: su navegador **solo los lee** (`lib/history-sync.ts`, `lib/finance-summary-client.ts`); los escribe su servidor |
| `pedidos_web`: crear `false`, cambiar solo admin (específica) | Hoy **sin cuenta** se crea o se cambia cualquier pedido web con solo mandar un campo `dni` | Ver §3: app Android 1.3.22 o anterior |
| `wala_pedidos`: crear `false` | Hoy cualquiera crea copias "sin pagar" | App Android 1.3.22 o anterior (la copia era "best-effort": el pedido sigue) |
| `cuestionarios_templates` sin regla | Lectura pública de plantillas retiradas | Nadie (se retiró el 2026-10-16) |
| `notSupervision()` en las reglas de una línea | Una cuenta de supervisión (`metricsOnly`) ya no lee el catálogo directo | Solo la supervisión del ERP, que va por endpoints del servidor |

Todo lo demás es idéntico a lo que corre hoy: login, carrito, checkout, cuenta, monedas
por Cloud Functions, ERP, visor e impresión siguen exactamente igual porque sus reglas no
cambian.

## 3. Qué se rompería

| Sistema | Qué deja de funcionar |
|---|---|
| ERP (aimunayerp.com) | Nada. Sigue entrando con sesión anónima y la regla general le deja todo lo que no es de Walá, igual que hoy. |
| Visor de pedidos (tablets) | Nada. Usa `pedidos`, `configuracion` y `print_queue` con sesión anónima: sin cambios. |
| Servidor de impresión | Nada que cambie hoy. Ojo: **sin sesión ya no funciona desde el 2026-10-12**; si Kevin no lo actualizó, ya está fallando ahora, no por este cambio. |
| Tienda web (wala.pe) | Nada. Ya no crea pedidos desde el navegador desde el 2026-10-16. |
| App Android 1.3.22 o anterior | Un **invitado sin cuenta** no podría mandar el pedido por WhatsApp (`pedidos_web` sin sesión). Con cuenta sí puede (la regla general lo permite), pero no se guarda la copia en `wala_pedidos`. La 1.3.23 (14 oct) ya usa el servidor. |

## 4. Riesgos

1. **Dos copias que se separan.** Los dos repos publican reglas: el ERP lo hizo el 20-10
   con una versión sin commit. Si el ERP vuelve a publicar su `firestore.rules` sin las
   bolitas, las vuelve a abrir; si alguien publica el `master` viejo de Walá, quita las
   protecciones de Finanzas del ERP. Antes de publicar, copiar este archivo **idéntico**
   al repo del ERP.
2. **Publicar desde el ERP toca cinco bases.** Su `firebase.json` publica el mismo archivo
   a `(default)`, `aimunay`, `negocio-cliente-1`, `mussa` y `lumi`, y `lumi` hoy corre
   otras reglas. Publicar **solo desde `wala-master`**: su `firebase.json` toca nada más
   `(default)`.
3. **Lo que este cambio NO arregla.** Con la sesión anónima activada, cualquier persona
   puede leer y escribir `pedidos`, `pedidos_web`, Finanzas (`fp_*`), `print_queue` y
   `users` (con las contraseñas del ERP en texto plano). Es la regla general del ERP y
   solo se cierra con la Etapa 3b (login del ERP con Firebase Auth y claim de personal,
   cuentas de dispositivo para el visor y la impresora).
4. **Código de las bolitas fuera de `master`.** El PR #2 se fusionó antes de los commits
   de las fases 1 a 3 (`cc9c1213`, `1bb7975a`, `cc897eb7`), que siguen solo en
   `feat/bolitas-niveles`. Publicar las reglas antes que ese código no rompe nada.

## 5. Cómo se probó

- `node scripts/probar-reglas-api.cjs --contra <reglas vivas>`: 51 casos (tienda, ERP,
  visor, impresión, bolitas, pedidos, supervisión) contra el servicio de pruebas de
  reglas de Google, **sin publicar**. Resultado: **51/51**, y **18 casos** dan distinto
  que lo vivo, exactamente los de §2.
- No se usó el emulador (necesita Java 21). El servicio de pruebas usa el mismo motor de
  reglas que producción; los flujos que no cambian ya corren en producción con estas
  mismas reglas desde el 20-10.
- Detalle del probador: un caso "sin sesión" debe llevar `auth: null`. Si se omite,
  `request.auth` queda indefinido y `notSupervision()` da error (en producción es `null`).

## 6. Publicación por pasos

0. **Decide el dueño:**
   - **A (recomendada):** todo junto. Antes, revisar en Play Console cuántos usan la app
     1.3.22 o anterior.
   - **B:** primero todo menos lo de `pedidos_web`, `wala_pedidos` y
     `cuestionarios_templates` (se dejan como hoy), y lo de pedidos cuando la 1.3.23 esté
     adoptada.
1. Copiar `firebase/firestore.rules` idéntico a `firestore.rules` del ERP y hacer commit
   allí. Avisar a quien publica desde el ERP.
2. Justo antes de publicar: `node scripts/leer-reglas-vivas.cjs vivas.rules`. Si lo vivo
   ya no es el ruleset del 20-10, comparar de nuevo.
3. `node scripts/probar-reglas-api.cjs --contra vivas.rules`: tiene que dar 51/51 y los
   mismos 18 cambios.
4. Avisar al equipo del ERP y a Kevin (visor y servidor de impresión). Elegir una hora
   tranquila y no publicar una versión del ERP en Vercel a la vez (el 10-10 coincidió).
5. Publicar desde `wala-master`: `npm run deploy:firestore-rules -- --fusionado-con-erp`
   (solo `(default)`).
6. Vigilar 30 minutos: `node scripts/metricas-reglas.cjs` (escuchas abiertas y rechazos),
   abrir el ERP y Finanzas, mover un pedido en el visor, imprimir un ticket, comprar en la
   tienda y jugar a Las Bolitas.
7. **Reversión:** Firebase Console > Firestore > Reglas > historial > el ruleset del
   2026-10-20 12:42 (`bb38fe5e…`) > Publicar. Se puede hacer en un clic y vuelve a lo de
   hoy, **no** a `if true`.
