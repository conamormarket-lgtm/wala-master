# Roadmap: encuesta, personalización, seguimientos y recomendaciones

Lista de trabajo a partir de las notas del 06/10/2026. Se marca `[x]` al terminar cada punto.

**Orden sugerido:** 1 → 4 → 3 → 2. Las recomendaciones (4) van antes que WhatsApp (3) porque los mensajes automáticos van a incluir productos sugeridos. Si la sugerencia es mala, por WhatsApp hace más daño que dentro de la web. El panel (2) depende de información que todavía falta.

---

## 1. PRIORIDAD: popup para llenar la encuesta

**Lo que ya existe:**
- La encuesta está en `/encuesta-suscripcion`, en `SubscriptionSurveyPage.jsx`.
- El header tiene un botón flotante de encuesta y una promo de "Perfil de Regalos".
- `src/utils/surveyHelper.js` tiene `shouldPromptSurvey` (cada 14 días), pero parece que nadie lo usa.
- Hay un `Modal` genérico.
- **No existe** un sistema de popups o anuncios.

> ✅ Hecho el 06/10/2026: `src/services/popupsLogic.mjs` (reglas + tests), `src/components/common/CampaignPopup/`, `/admin/popups`.

### 1.1 Sistema de popups/anuncios reutilizable
Así sirve para la encuesta y luego para promos, descuentos y referidos.
- [x] Documento `storeConfig/popups` en Firestore (no una colección nueva: las reglas vivas son del ERP). Cada popup tiene:
  - Contenido: título, texto, imagen, texto del botón y destino (link).
  - Estado: activo o no, con fechas de inicio y fin.
- [x] Reglas de a quién mostrarlo (targeting):
  - Si el usuario está logueado o no.
  - `hasCompletedSurvey == false`.
  - En qué páginas aparece (inicio, producto, después de comprar…).
  - Si es dispositivo móvil o web.
- [x] Reglas de cuándo mostrarlo:
  - Disparador: a los X segundos, al hacer X% de scroll o al intentar salir (solo en desktop).
  - Límite de frecuencia: no más de 1 popup por sesión y cooldown de N días si lo cierra.
- [x] Componente `CampaignPopup` montado en el layout de la tienda. Reutiliza `Modal` y tiene que funcionar bien en móvil y en Capacitor.
- [x] Que no choque con los popups que ya existen: `LanguagePopup`, `CuentaLoginPrompt`, `AppDownloadBanner` y `PackageBubble`. Hay que definir prioridades para que no salgan dos a la vez.

### 1.2 Popup específico de la encuesta
- [x] Texto que deje claro qué se gana: recompensa de encuesta y de fechas (`grantSurveyReward` / `claimDatesReward`).
- [x] Si el usuario no está logueado: primero login o registro y luego volver a la encuesta.
- [ ] Opcional: dejar la encuesta a medias y retomarla (guardar el avance).

### 1.3 Administración y medición
- [x] Página `/admin/popups` para crear, editar, activar y previsualizar popups. Agregarla en `App.jsx` y en el `NavLink` de `AdminLayout`.
- [x] Eventos de analytics: `popup_view`, `popup_click`, `popup_close` y conversión (encuesta completada después del popup).
- [x] Mostrar en el admin cuántos lo vieron, cuántos hicieron clic y cuántos completaron la encuesta.

---

## 2. Panel de personalización para Alanny y Live (integración)

**Bloqueado:** falta información para poder planificarlo.
- [ ] ¿Cuál es el "otro proyecto"? Ruta o repo, stack, y si comparte Firebase con este.
- [ ] ¿Qué hace el panel? Por ejemplo: editar diseños, armar pedidos personalizados en vivo, gestionar los productos del Live.
- [ ] ¿Quién lo usa? ¿Alanny como admin u operadora? ¿Hace falta un rol nuevo con permisos limitados, que no sea admin completo?
- [ ] ¿"Live" es el live de TikTok? Hoy solo existe como línea de cobro de Kenta (`KENTA_TIKTOK_LINE_KEYS`).

**Cuando tengamos esa información:**
- [ ] Decidir cómo integrarlo: copiar el módulo dentro de este repo, cargarlo en un iframe o hacerlo una app aparte con el mismo Firebase.
- [ ] Ver si conviene reutilizar el editor actual (`EditorPage`, `src/components/editor/*`, `/personalizar`).
- [ ] Crear el rol, la ruta y el acceso para Alanny.

---

## 3. Seguimientos automatizados

**Lo que ya existe:**
- `notificationEngine` (cada hora) manda **solo push (FCM)** y bandeja in-app para tres casos:
  - Carrito abandonado: 1 h, 24 h y 48 h.
  - Productos vistos: 3 o más visitas, o más de 2 minutos.
  - Retención: a los 7 y 14 días.
- `datesReminderEngine` avisa 7 días y 1 día antes de una fecha importante, con ideas de regalo.
- El teléfono se guarda en los campos `phone` / `whatsapp`.
- **No hay** envío real por WhatsApp ni por SMS, solo links `wa.me`.

### 3.0 Base común (hacerla antes de cualquier canal)
- [ ] Normalizar teléfonos a formato E.164 (+51…) y detectar números inválidos.
- [ ] Consentimiento (opt-in) para WhatsApp y SMS. Es obligatorio para mensajes de marketing por WhatsApp. Se puede pedir en el registro, el perfil, el checkout o la encuesta.
- [ ] Que cada usuario pueda darse de baja (opt-out) por canal.
- [ ] Límite de frecuencia **entre todos los canales**, para que una persona no reciba push, WhatsApp y SMS por lo mismo.
- [ ] Registro de cada envío (`outbound_messages`): canal, plantilla, estado y si convirtió.

### 3.1 Notificar (push) ✓ ya funciona
- [ ] Revisar que los textos usen la recomendación mejorada (ver sección 4).

### 3.2 WhatsApp vía Kenta (plantillas de marketing)
- [ ] Averiguar si Kenta tiene una API para enviar plantillas de WhatsApp: endpoint, autenticación, límites y costo por mensaje.
- [ ] Crear y hacer aprobar en Meta las plantillas que vamos a necesitar:
  - Carrito abandonado.
  - Producto que vio o le interesó.
  - Fecha especial que se acerca (con ideas de regalo).
  - Recuperación de clientes inactivos.
- [ ] Agregar un "canal WhatsApp" al `notificationEngine` y al `datesReminderEngine`, reutilizando los disparadores que ya existen.
- [ ] Panel admin: activar o desactivar cada flujo, ver los envíos y probar con un número propio.

### 3.3 SMS
- [ ] Elegir proveedor (Twilio u otro local de Perú) y comparar costos.
- [ ] Usarlo solo como respaldo cuando no hay WhatsApp u opt-in, o para mensajes transaccionales.

### 3.4 Llamadas (carrito / posibles clientes)
No necesita API: es una lista de trabajo para el equipo.
- [ ] Página `/admin/seguimiento-llamadas` que liste:
  - Carritos abandonados con teléfono, ordenados por monto.
  - Personas con mucho interés (muchas vistas o wishlist) que todavía no compraron.
- [ ] Botón de llamar o abrir WhatsApp, y marcar el resultado: contestó, no contestó, compró, no le interesa.
- [ ] Asignar cada caso a una persona del equipo y que no se repitan llamadas.

---

## 4. Mejorar las recomendaciones de productos

**Lo que ya existe:**
- `src/utils/giftRecommender.mjs`, duplicado en `functions/giftLogic.js`.
- Funciona con palabras clave más categorías, género (`publico`) y presupuesto.

**Problemas detectados:**
- Coincidencia por texto literal. Por ejemplo, "gato" puede traer cualquier producto que lo mencione.
- Rellena con productos "destacados" que no tienen nada que ver con la persona.
- No usa el comportamiento del usuario: lo que vio, su wishlist ni sus compras.
- Depende de que los productos estén bien etiquetados.

> ✅ 06/10/2026: diagnóstico con las 386 personas reales de la encuesta y reglas nuevas en `src/utils/giftRecommender.mjs` (copia generada en `functions/giftLogic.js`, `datesReminderEngine` desplegada).
> Resultado: ideas por gusto 110 → 133 (+21 %), relojes/conjuntos genéricos repetidos 1.092 → 395, niños con algo de adulto (relojes, parejas, humor…) 57 de 96 → 0.

### 4.1 Diagnóstico
- [x] Set de casos reales (Alianza/U/Goku/Zenitzu/"De la u"/niños…) convertido en tests (`giftRecommender.test.mjs`).
- [x] Calidad de datos: de 159 productos visibles, solo **19 tienen `publico`** (para quién es); 139 quedan sin saber. Marcarlo en `/admin/publico-productos` mejora mucho las ideas genéricas.
- [x] Demanda sin producto: solo el **44 %** de los gustos pedidos tiene producto. Sin producto: Messi (12), Barcelona (6), Cristiano Ronaldo (8), Real Madrid (6), Yamal (4), vóley (3)…

### 4.2 Arreglos de reglas
- [x] Sin relleno: primero lo que le gusta; las ideas genéricas solo rellenan (máx. 2 si contó sus gustos). El autogenerador de paquetes ya no rellena con "destacados".
- [x] Reglas de contexto:
  - Productos de un club solo para hinchas de ese club (y su ídolo cuenta: Guerrero → Alianza).
  - Pareja solo para su pareja o en ocasión romántica; un conjunto de pareja en un cumpleaños solo si además es "para regalar".
  - Niños (por edad del cumpleaños, o hijos/sobrinos sin edad): nada de relojes, billeteras, lentes, joyas, parejas ni humor.
  - La descripción del producto casi no suma (evita "Lentes" → polo de humor).
- [x] Sinónimos y errores de tipeo: "La U"→Universitario, "Barza"→Barcelona, "Zenitzu"→Zenitsu, "Stich"→Stitch… (`SINONIMOS` en el código).
- [ ] Sinónimos editables desde el admin (hoy están en el código).
- [ ] Penalizar lo que la persona ya recibió (el parámetro `excluir` existe, falta pasarle las compras previas).

### 4.3 Señales de comportamiento
- [ ] Sumar lo que el comprador vio / puso en wishlist / agregó al carrito. Ojo: eso dice qué le gusta al COMPRADOR, no a la persona a quien le regala; sirve más para los seguimientos del punto 3 que para "ideas de regalo".

### 4.4 Mantenimiento
- [x] Una sola fuente: `functions/giftLogic.js` se genera con `npm run gen:gift-logic` y un test verifica que den lo mismo.
- [ ] Opcional, más adelante: embeddings o IA para entender respuestas abiertas.

---

## Uso y promoción (cómo se aprovecha todo lo anterior)

| Palanca | Qué ya existe | Cómo se conecta |
|---|---|---|
| **Live** | Línea de cobro TikTok en Kenta | Popup o anuncio "estamos en vivo" (sistema 1.1), y WhatsApp a quienes tienen opt-in |
| **Plantillas** | Textos push con A/B y textos `wa.me` | Plantillas de WhatsApp aprobadas en Meta (3.2) |
| **Descuentos** | Cupones, flash offers | Cupón como premio de la encuesta o en el WhatsApp de carrito abandonado |
| **Referidos** | Sistema de referidos completo | Popup de referidos después de comprar, y WhatsApp para invitar |
