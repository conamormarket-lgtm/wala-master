# Plan de Blindaje de Reglas Firestore — `sistema-gestion-3b225` (default)

> **Severidad: CRÍTICA.** Creado 2026-06-25 tras descubrir que las reglas vivas de producción son
> totalmente abiertas. Este documento es el plan para cerrar el agujero **sin romper el CRM/ERP**.

## 1. El problema (qué está pasando hoy)

Las reglas vivas de la base `(default)` de `sistema-gestion-3b225` son:

```
match /{document=**} { allow read, write: if true; }
```

**Cualquier persona en internet, sin estar logueada, puede LEER, MODIFICAR y BORRAR todos los datos:**
clientes, pedidos, pagos, perfiles, y toda la base del CRM/ERP. Es el riesgo #1 del sistema.

Consecuencia positiva (la única): por eso el portal nuevo, la analítica, el heatmap y el dashboard
**funcionan** sin tocar reglas. El blindaje es por **seguridad**, no por funcionalidad.

## 2. Por qué NO se puede cerrar "de golpe"

- La base `(default)` es **compartida**: portal de la tienda **+** CRM/ERP multi-tenant (decenas de
  colecciones `clientes`, `chats_atc`, `mb_*`, `pedidos`, `catalogo_ofertas`, `embudos_funnels`, etc.).
- Firestore es **deny-by-default**: al quitar el `if true`, **toda colección sin regla explícita queda
  bloqueada** → se rompería el CRM/ERP.
- **No se puede proteger "solo una parte"**: mientras exista el catch-all `allow ... : if true`, gana
  siempre (semántica OR). Para proteger algo hay que listar y cubrir **todas** las colecciones.
- Hay **flujos anónimos legítimos** que DEBEN seguir permitidos (si no, se rompe la web):
  - Checkout sin sesión → `pedidos_web` (create con DNI/documento).
  - Analítica → `analytics_events` (create), `analytics_sessions` (create/update).
  - Heatmap → `heatmap_events` (create).
- **Incógnita clave:** el CRM/ERP ("Sistema gestión") es **otra aplicación** cuyo código no está en este
  repo. No sabemos cómo autentica (¿usuarios con claims? ¿admin SDK server-side? ¿por `tenant_id`?).
  Escribir reglas para sus colecciones sin saberlo es peligroso.

## 3. Plan por fases (de menor a mayor riesgo)

### Fase A — Inventario completo (sin riesgo)
Listar TODAS las colecciones de primer nivel de `(default)` para no dejar ninguna fuera.
En Cloud Shell, con la cuenta de servicio ya descargada:
```bash
cd ~/wala-master
export GOOGLE_APPLICATION_CREDENTIALS=~/sistema-gestion-3b225-firebase-adminsdk-*.json
node -e "
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
initializeApp({ credential: applicationDefault() });
getFirestore().listCollections().then(cols => {
  console.log(cols.map(c => c.id).sort().join('\n'));
  process.exit(0);
});
"
```
Resultado → la lista exacta de colecciones (portal + CRM). Se clasifican en el paso siguiente.

### Fase B — Blindaje rápido (alto impacto, riesgo medio) — **RECOMENDADO primero**
Objetivo: **detener la escritura/borrado ANÓNIMO de todo** (lo catastrófico) sin necesidad de inventariar
cada lectura. Reglas:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Por defecto: lectura abierta (transición), escritura SOLO autenticado.
    match /{document=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    // Excepciones: flujos anónimos legítimos del portal (deben seguir funcionando).
    match /analytics_events/{id}   { allow create: if true; }
    match /analytics_sessions/{id} { allow create, update: if true; }
    match /heatmap_events/{id}     { allow create: if true; }
    match /pedidos_web/{id}        { allow create: if true; } // checkout anónimo (DNI/documento)
    match /orders/{id}             { allow create: if true; } // pedido marketplace anónimo
  }
}
```
- **Gana en seguridad:** nadie sin login puede modificar/borrar clientes, pedidos, CRM, etc.
- **Sigue abierto:** la **lectura** (transición). PII todavía visible → se cierra en Fase C.
- **Riesgo a validar:** si el CRM tuviera algún write anónimo (poco probable), se afectaría → probar en
  Playground y verificar el CRM tras publicar.

### Fase C — Blindaje completo (máxima seguridad, mayor trabajo)
Con el inventario (Fase A): regla **por colección**, cerrando también las **lecturas** de datos sensibles.
- **Portal — catálogo (lectura pública, escritura admin):** `productos_wala`, `tienda_*`, `niches`,
  `vendors`, `blueprints`, `flashOffers`, `rewardsCatalog`, `productTypes`, `tags`, `characters`, etc.
- **Portal — usuario/economía (dueño lee, servidor escribe):** `portal_clientes_users` (con bloqueo de
  campos de saldo), `loyaltyLedger`, `userMissions`, `userCoupons`. (Ya están en `firebase/firestore.rules` del repo.)
- **Portal — pedidos (create anónimo con documento; lee dueño/admin):** `pedidos`, `pedidos_web`,
  `orders`, `subOrders`, `payouts`.
- **Analítica (create anónimo, lee admin):** `analytics_events/sessions/user_summary/global_summary`, `heatmap_events`.
- **CRM/ERP (`clientes`, `chats_atc`, `mb_*`, `catalogo_ofertas`, …):** requiere conocer **cómo autentica el
  CRM**. Opciones: (a) si el CRM usa **Admin SDK** server-side → ignora reglas, y podemos exigir `isAdmin()`/
  auth para el acceso desde cliente; (b) si usa **usuarios autenticados** con algún claim/rol → replicar
  ese check. **Coordinar con quien mantiene el CRM antes de cerrar estas.**

## 4. Casos a probar en el Rules Playground (antes de publicar, cada fase)
Simular (Firestore → Reglas → "Simulador"):
1. **Lectura anónima** de `productos_wala` → permitido.
2. **Create anónimo** de `pedidos_web` con `dni` → permitido (checkout).
3. **Create anónimo** de `analytics_events` → permitido.
4. **Write anónimo** de `clientes` / `portal_clientes_users` → **DENEGADO** (Fase B+).
5. **Delete anónimo** de cualquier doc → **DENEGADO** (Fase B+).
6. **Lectura/escritura del CRM** con su mecanismo real → permitido (verificar in vivo tras publicar).
7. **Admin** (`request.auth.token.admin == true`) → acceso total a paneles.

## 5. Antes de publicar (obligatorio)
- [ ] **Respaldar las reglas actuales** (copiar el texto vivo a un archivo con fecha).
- [ ] Confirmar **backups diarios** activos (la base `(default)` los tiene).
- [ ] Publicar en **horario de bajo tráfico**.
- [ ] Tener el **rollback** listo: volver a pegar las reglas respaldadas y Publicar.
- [ ] Tras publicar: **verificar en vivo** el portal (checkout, login, analítica) **y el CRM** (que siga
      leyendo/escribiendo sus pedidos/clientes).

## 6. Recomendación
Ejecutar **Fase A** (inventario) ahora, luego **Fase B** (corta el daño anónimo grave, bajo riesgo) y, con
calma y coordinando el CRM, **Fase C** (cierre completo, protege también las lecturas/PII). No publicar las
reglas del repo (`firebase/firestore.rules`) tal cual: cubren el portal pero **no** el CRM → romperían "Sistema gestión".
