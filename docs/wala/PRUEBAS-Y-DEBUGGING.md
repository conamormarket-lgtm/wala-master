# Pruebas y Debugging — Guía de QA manual para wala.pe

> Guía pensada para **probar a mano** la tienda **wala.pe** y para **diagnosticar errores
> comunes** sin ser experto. Si algo no funciona, busca el síntoma en la sección
> **["Errores comunes"](#4-errores-comunes-y-cómo-diagnosticarlos)**.

**Antes de empezar, ten claro esto (es la causa de la mayoría de confusiones):**

- **Las "Temporadas" NO son un campo propio del producto.** Son **colecciones**
  (`tienda_collections`) cuyo **nombre** contiene una palabra estacional
  (Invierno, Verano, Navidad, Halloween, San Valentín, etc.). La tienda las **detecta
  automáticamente por el nombre** y las muestra bajo el título **"Temporadas"** en vez de
  bajo "Colecciones". No hay que marcar nada extra: basta con que la colección **se llame**
  así.
- Para que un producto aparezca en una "Temporada", el producto debe estar **asignado a esa
  colección**. El formulario de producto ahora permite **varias colecciones a la vez**
  (multi-colección): un producto SÍ puede estar en "Invierno" y en otra colección al mismo
  tiempo.
- **Producción = `sistema-gestion-3b225`** (el portal de la tienda y el ERP/CRM **comparten
  el mismo proyecto y base de datos**). La web la sirve **Vercel**. Ver
  [§6 Topología](#6-recordatorio-de-topología).

---

## 1. Cómo probar cada filtro de la tienda

Los filtros viven en la barra lateral de la tienda (en celular es el botón **"Filtrar y
Categorías"**). La lógica está en
`src/pages/Tienda/components/SidebarCatalogLayout.jsx`.

**Regla general de prueba para cualquier filtro:**
1. Abre la tienda (`wala.pe/tienda`).
2. En la barra lateral, haz clic en una opción del filtro.
3. Confirma que el listado de productos se **reduce** y solo muestra los que cumplen.
4. Vuelve a hacer clic en la misma opción (o en "Todas/Todos") para **quitar** el filtro y
   ver que reaparece todo. (Clic sobre la opción ya activa = se desactiva.)

> Importante: un filtro solo **aparece en la barra lateral si existe al menos un dato** de
> ese tipo. Si no ves "Marcas", probablemente es que aún no hay marcas creadas, no un error.

### 1.1 Categorías
- **Qué es:** la categoría principal del producto (campo `category`/`categoryId`).
- **Pasos:** clic en una categoría de la lista "Categorías".
- **Resultado esperado:** solo se ven productos de esa categoría. "Todas las categorías"
  muestra todo.

### 1.2 Temporadas
- **Qué es:** colecciones **estacionales**, detectadas por el **nombre**. El bloque
  "Temporadas" **solo aparece** si existe alguna colección cuyo nombre contenga una palabra
  estacional. Palabras que la activan (entre otras): *Verano, Invierno, Otoño, Primavera,
  Navidad, Navideña, Fiestas, Año Nuevo, Pascua, Halloween, San Valentín, Día de la Madre,
  Día del Padre, Temporada, Summer, Winter, Spring, Autumn/Fall, Holiday, Christmas, Xmas,
  Easter*.
- **Pasos:**
  1. Asegúrate de tener una colección llamada, por ejemplo, **"Invierno 2026"**.
  2. Asigna **uno o más productos** a esa colección desde el formulario de producto
     (campo "Colección", ver [§2](#2-cómo-probar-el-guardado-de-producto)).
  3. En la tienda, clic en **"Invierno 2026"** bajo el título **"Temporadas"**.
- **Resultado esperado:** solo se ven los productos asignados a esa colección. Si un
  producto **no aparece**, casi siempre es porque **no está asignado a esa colección**
  (no porque falte un campo "temporada", que no existe).
- **Truco de validación:** una colección llamada "Cápsula Urbana" (sin palabra estacional)
  saldrá bajo **"Colecciones"**, no bajo "Temporadas". Si renombras una colección de
  "Cápsula" a "Cápsula de Invierno", **pasará a "Temporadas"** sin tocar nada más.

### 1.3 Colecciones
- **Qué es:** colecciones **no estacionales** (las que no caen en una palabra de temporada).
  Internamente "Temporadas" y "Colecciones" son lo mismo (`tienda_collections`); solo se
  separan visualmente por el nombre.
- **Pasos:** clic en una colección bajo el título "Colecciones".
- **Resultado esperado:** solo productos asignados a esa colección.
- **Nota:** "Temporadas" y "Colecciones" comparten el mismo selector interno, así que al
  elegir una se **deselecciona** la otra (no se pueden tener dos colecciones activas como
  filtro a la vez en la tienda; eso es independiente de que un producto pueda **pertenecer**
  a varias).

### 1.4 Marcas
- **Qué es:** la marca del producto (campo `brandId`).
- **Pasos:** clic en una marca bajo "Marcas".
- **Resultado esperado:** solo productos de esa marca.

### 1.5 Tipo de Producto
- **Qué es:** el tipo (campo `productType`), p. ej. polo, taza, llavero.
- **Pasos:** clic en un tipo bajo "Tipo de Producto".
- **Resultado esperado:** solo productos de ese tipo.

### 1.6 Etiquetas (Tags)
- **Qué es:** etiquetas libres del producto (campo `tags`, lista).
- **Pasos:** clic en una etiqueta bajo "Etiquetas".
- **Resultado esperado:** solo productos que tengan esa etiqueta.

### 1.7 Personajes
- **Qué es:** personajes asociados (campo `characters`, lista), p. ej. Mickey, Goku.
- **Pasos:** clic en un personaje bajo "Personajes".
- **Resultado esperado:** solo productos que incluyan ese personaje.

### 1.8 Combinar filtros y enlaces directos del menú
- Los filtros se **combinan** (Categoría + Marca + Tag a la vez = intersección). Si combinas
  filtros y **no queda ningún producto**, verás el mensaje de "vacío": eso es correcto, no es
  un error.
- El **menú del header** puede enlazar directo a un filtro, por ejemplo
  `wala.pe/tienda?coleccion=ID&categoria=ID`. Para probarlo: abre el menú, entra por una
  categoría/colección del menú y confirma que la tienda llega **ya filtrada**.

---

## 2. Cómo probar el guardado de producto

Formulario: **Admin → Productos → editar/crear** (`AdminProductoFormV2.jsx`).
La prueba clave siempre es la misma: **guardar → salir → reabrir → comprobar que todo sigue
igual** (que **persiste**).

### Pasos generales
1. Entra al formulario de un producto (o crea uno nuevo).
2. Rellena/cambia los campos de abajo.
3. Pulsa **Guardar**.
4. **Sal del producto** (vuelve a la lista) y **vuélvelo a abrir**.
5. Verifica que **cada campo** quedó como lo dejaste.
6. Verifica también el efecto en la **tienda pública** (que aparezca donde debe).

### Qué revisar campo por campo
- **Categoría:** elige una. Al reabrir debe seguir seleccionada. En la tienda, el producto
  debe salir al filtrar por esa categoría.
- **Colección / Temporada (multi):** el campo **"Colección"** permite **elegir varias**
  (etiquetas múltiples). Asigna 2 colecciones (p. ej. "Invierno 2026" + "Básicos"). Al
  reabrir deben aparecer **ambas**. En la tienda, el producto debe salir tanto bajo
  **"Temporadas → Invierno 2026"** como bajo **"Colecciones → Básicos"**.
  - Para crear una colección nueva al vuelo: escribe el nombre en el campo y elige
    "Crear …". Quedará disponible para otros productos.
- **Personajes:** añade uno o varios. Deben persistir y servir de filtro en la tienda.
- **Etiquetas / Tags:** añade una o varias. Deben persistir y servir de filtro.
- **Stock (`inStock`):** pon un número, guarda, reabre y confirma. Comprueba que el stock se
  refleje en la ficha del producto.
- **Tallas / Tipo de medida:** dentro de cada **variante**, configura las tallas y su
  etiqueta (p. ej. "Talla", "Tamaño"). Deben persistir.
- **Variantes:** crea 2+ variantes (p. ej. colores), cada una con su foto principal y su
  galería. Marca la **variante principal** (`defaultVariantId`). Al reabrir, deben estar
  todas, con sus imágenes, y abrirse por defecto la principal.
  - Regla del sistema: **un producto no puede quedarse sin variantes** (mínimo 1). Si
    intentas borrar la única variante, te lo impedirá.

### Verificación de persistencia (lo más importante)
- Tras **reabrir**, si un campo aparece **vacío** o **distinto**, el guardado falló o el dato
  viejo no se migró. Revisa la consola (F12) por errores al guardar.
- Si en "Colección" ves un texto raro como **`[object Object]`**, es **dato antiguo** mal
  guardado: bórralo y **reasigna** la colección correcta (ver
  [§4.4](#44-object-object-en-la-colección-de-un-producto)).

---

## 3. Cómo probar editor personalizable, carrusel de marcas, banners y header

### 3.1 Editor "personalizable" (no debe crashear con/sin zonas de impresión)
El editor (`EditorCanvas.jsx`) usa **vistas de personalización** y **zonas de impresión**
(`printAreas`). El objetivo de la prueba es que **no se rompa** ni cuando hay zonas ni cuando
no las hay.

- **Caso A — con zonas:** abre un producto marcado como **personalizable** que tenga al menos
  una zona de impresión. Debe cargar el lienzo, mostrar la(s) zona(s) y dejarte añadir
  texto/imagen dentro.
- **Caso B — sin zonas:** abre un producto personalizable **sin zonas configuradas** (o con
  la lista de zonas vacía). **No debe pantalla en blanco ni error**: el editor debe abrir
  igual (internamente trata `printAreas` como lista vacía y usa un área por defecto). Si ves
  pantalla blanca o un error en consola, repórtalo.
- **Caso C — producto NO personalizable:** confirma que ni siquiera ofrece el editor (no
  debe intentar abrirlo).
- Prueba además: añadir texto, cambiar fuente/color, subir una imagen, mover/escalar, y
  **agregar al carrito**. Que la vista previa final corresponda a lo editado.

### 3.2 Carrusel de marcas (logos + enlaces)
Componente `BrandMarquee.jsx` ("Empresas con las que trabajamos").
- **Logos:** cada marca debe mostrar su **logo** (`imageUrl`). Si un logo no carga, revisa
  que la URL de la imagen sea válida (ver imágenes rotas en [§4.3](#43-ícono-pwa-roto-o-imágenes-rotas)).
- **Enlaces:** al hacer clic en una marca:
  - Si su enlace empieza con `/` (interno, p. ej. `/tienda`), navega **dentro** de la web.
  - Si es un enlace externo (`https://…`), abre en **pestaña nueva**.
  - Si no tiene enlace, simplemente no es clicable. (Todo esto es correcto.)
- Si **no hay marcas**, el carrusel **no se muestra** (no es un error).

### 3.3 Banners (Hero)
Componentes `HeroBanner.jsx` / `HeroCarousel`.
- El banner principal debe **cargar su imagen** y, si tiene botón/CTA, el botón debe llevar a
  su enlace.
- Si es un carrusel, debe **rotar** entre banners y los puntos/flechas deben funcionar.
- Imagen rota en el Hero = misma causa que cualquier imagen rota
  ([§4.3](#43-ícono-pwa-roto-o-imágenes-rotas)).

### 3.4 Botones del header
Componente `Header.jsx`.
- Prueba cada icono/botón: **logo** (vuelve al inicio), **Buscar** (`/buscar`),
  **Favoritos/Wishlist** (lleva a wishlist si hay sesión, o a login si no), **Mi cuenta**,
  **Administración** (solo admin), **Minijuegos**, y el menú de **categorías/colecciones**.
- En **celular**, abre el menú hamburguesa y comprueba que los desplegables de categorías y
  colecciones abren y enlazan bien.
- Un botón que lleva a `#` o no hace nada suele ser un enlace **sin URL configurada** en la
  config de la tienda, no un bug de código.

---

## 4. Errores comunes y cómo diagnosticarlos

### Cómo abrir la consola del navegador (F12) y qué mirar
1. Con la web abierta, pulsa **F12** (o clic derecho → **Inspeccionar**).
2. Pestaña **"Console" (Consola):** aquí salen los errores en **rojo**. Lee el primer error
   rojo: suele decir la causa (CORS, índice, permiso, etc.).
3. Pestaña **"Network" (Red):** muestra cada petición. Las que fallan salen en rojo; haz clic
   para ver el detalle (código 403, 404, CORS…).
4. Para reportar, **copia el texto del error** (no solo "no funciona").

### 4.1 Error **CORS** al llamar una función (Cloud Function)
- **Síntoma:** en consola, algo como *"blocked by CORS policy"* o *"…cloudfunctions.net… CORS"*
  al usar el Kapi, juegos, misiones, cofre, pagos o creación de pedido.
- **Causa real:** la función **no está desplegada en el proyecto correcto**
  (`sistema-gestion-3b225`), o se desplegó por error en otro proyecto (`pruebas-cd728`). El
  navegador lo reporta como CORS, pero el problema es de **despliegue/proyecto**, no de
  permisos del navegador.
- **Cómo confirmarlo:** en la pestaña **Network**, mira a qué URL apunta la llamada: debe ser
  `…-sistema-gestion-3b225.cloudfunctions.net/…`. Si apunta a otro proyecto o da 404, esa es
  la causa.
- **Solución:** desplegar la función al proyecto correcto
  (`firebase deploy --only functions --project sistema-gestion-3b225`). Ver
  [DESPLIEGUE-ESTADO.md](./DESPLIEGUE-ESTADO.md) y [DESPLIEGUE.md](./DESPLIEGUE.md).

### 4.2 **"The query requires an index"** (falta un índice de Firestore)
- **Síntoma:** en consola, *"The query requires an index"*, normalmente con un **enlace** que
  lleva a la consola de Firebase para crearlo.
- **Causa real:** una consulta combina filtros/orden que Firestore necesita **indexar** y ese
  índice **no está creado** en producción.
- **Solución:** abre el enlace del error y crea el índice (o añádelo a
  `firestore.indexes.json` y despliega los índices). **Tarda unos minutos en construirse**;
  mientras tanto la consulta seguirá fallando. Ver
  [DESPLIEGUE-ESTADO.md](./DESPLIEGUE-ESTADO.md) (caso del índice de Wordle).

### 4.3 **Ícono PWA roto** o imágenes rotas
- **Síntoma:** el ícono de la app (al instalar/añadir a inicio) sale roto o genérico, o se
  ven imágenes rotas/placeholder en la tienda.
- **Causa real:** falta **re-promover el frontend** más reciente en Vercel. La versión en
  vivo no incluye todavía los iconos PWA en `public/icons/` ni el placeholder local
  (`/images/placeholder.svg`).
- **Solución:** en Vercel, **promover/re-desplegar** el commit más reciente
  (p. ej. `35ba2a2`). Recuerda que cambiar variables de entorno también exige **Redeploy**
  porque Vite las hornea en el build. Ver [DESPLIEGUE-ESTADO.md](./DESPLIEGUE-ESTADO.md) §3.

### 4.4 **`[object Object]`** en la colección de un producto
- **Síntoma:** en el formulario o en la ficha, la colección/temporada aparece como el texto
  literal **`[object Object]`**.
- **Causa real:** **dato antiguo** guardado de forma incorrecta (se guardó un objeto donde
  debía ir un ID). El código nuevo ya **ignora/filtra** ese valor al cargar, pero el dato
  viejo sigue ahí.
- **Solución:** abre el producto, **quita** ese valor del campo "Colección" y **reasigna** la
  colección correcta de la lista. Guarda y reabre para confirmar.

### 4.5 Otros síntomas frecuentes
- **Pantalla blanca al abrir el editor:** revisa consola; suele ser datos de variante o vista
  incompletos. Confirma el [§3.1 Caso B](#31-editor-personalizable-no-debe-crashear-consin-zonas-de-impresión).
- **"Missing or insufficient permissions":** una **regla de Firestore** bloquea la lectura.
  En producción, esto pasa si las **reglas no incluyen** la colección nueva del portal. Hay
  que **fusionar** (no reemplazar) las reglas con las del ERP. Ver
  [DESPLIEGUE-ESTADO.md](./DESPLIEGUE-ESTADO.md) §2.
- **Un producto no aparece en una temporada/colección:** casi siempre **no está asignado** a
  esa colección. Reabre el producto y verifica el campo "Colección" ([§2](#2-cómo-probar-el-guardado-de-producto)).

---

## 4-bis. Checklist POR PROBAR — sesión 2026-06-29 (multimarca, modo noche, pedidos, regalos, compra directa)

> Lista de pruebas manuales para **todo lo construido en la tanda del 2026-06-29**. Marca cada
> punto en wala.pe (o en local). Donde algo dependa de un **redeploy de funciones** del dueño, se
> avisa con **[requiere deploy]** y se enlaza a [PENDIENTES.md](./PENDIENTES.md).

### A. Compra directa desde la ficha de producto
- [ ] **Botón "Comprar"** (este producto): en una ficha (`ProductDetail`), pulsa **"Comprar"**.
      Debe llevarte **directo a `/checkout`** con **solo ese producto** seleccionado para cobrar
      (si tenías otras cosas en el carrito, **no se borran**, solo quedan deseleccionadas).
- [ ] **Botón "Comprar todo el carrito"**: con 2+ items en el carrito, pulsa **"Comprar todo el
      carrito"**. Debe ir a `/checkout` con **todos** los items seleccionados.
- [ ] **Carrito vacío**: "Comprar todo el carrito" con el carrito vacío debe **avisar** (toast),
      no romper.
- [ ] **"Agregar al carrito" sigue igual**: el botón clásico no cambió de comportamiento.

### B. Los pedidos NO desaparecen + estado propio `estadoWala`
- [ ] **Persistencia tras pagar [requiere deploy]**: haz un pedido, **págalo** (Culqi/PayPal) y
      ve a **"Mis Compras"**. Debe aparecer como **"Pagado"** y **seguir "Pagado"** al recargar
      (no debe volver a "Por confirmar pago"). *Si sigue en "por confirmar" tras pagar, casi
      seguro falta el **redeploy de las 3 funciones de pago** — ver
      [PENDIENTES.md §1](./PENDIENTES.md).*
- [ ] **No se pierde si el ERP lo toca**: un pedido aprobado en el ERP debe **seguir visible** en
      "Mis Compras" y en **"Recepción"** (lo rescata el espejo `wala_pedidos`). Si un pedido
      "desaparece", revisa el diagnóstico de [FLUJO-PEDIDOS.md](./FLUJO-PEDIDOS.md) (el ERP borra
      `pedidos_web` al aprobar; **no es caché**).
- [ ] **Recepción (admin)** lista los pedidos del portal incluso los que el ERP ya movió.
- [ ] **Estado más avanzado**: si el ERP marca "Entregado", la compra **no** debe degradarse a
      "pagado" (se muestra el estado más avanzado entre ERP y `estadoWala`).

### C. "Recepción" (admin) legible
- [ ] La tabla/lista de **Recepción** se lee bien (columnas, estado, monto) y **no** queda con
      texto cortado o ilegible.

### D. Modo noche (claro / oscuro / sistema)
- [ ] **Interruptor luna/sol** en el **Header**: al primer clic **invierte lo que ves** y la
      elección **persiste** al recargar (clave `wala-theme`).
- [ ] **Sin parpadeo al cargar** (anti-FOUC): al recargar en modo oscuro, la página **no destella**
      de claro a oscuro.
- [ ] **Sigue al sistema**: con el tema en "sistema", cambia el modo claro/oscuro del SO y la web
      debe **reaccionar en vivo**.
- [ ] **Contraste en storefront**: tienda, ficha de producto, banners y carruseles → **fondo
      oscuro = texto claro**, sin texto que desaparezca.
- [ ] **Contraste en Cuenta**: tabs, pedidos, fechas importantes → legibles en oscuro.
- [ ] **Contraste en Admin**: paneles del admin legibles en oscuro; **respeta los colores de
      fondo que el admin haya configurado a mano** (no los pisa).

### E. Arrastre en `/regalar` (registro de regalos)
- [ ] El **arrastre** de las tarjetas es **fluido** (sin parpadeo): aparece un **clon que sigue al
      puntero** y la tarjeta original no "salta".
- [ ] **No** aparece la "imagen fantasma con URL" ni el cursor de **denegado** del navegador al
      arrastrar.
- [ ] La **selección** de fecha (elegir "Regalar este") sigue funcionando y es accesible por
      teclado.

### F. Foto de la persona (Fechas Importantes + `/regalar`)
- [ ] **Subir foto en la cuenta**: en **"Mis Fechas Importantes"**, sube una **foto** a una persona;
      debe **verse en su tarjeta** (círculo). Sin foto → **inicial** (placeholder).
- [ ] **Foto visible en `/regalar` [requiere deploy]**: la misma foto debe verse en la **tarjeta
      grande de persona** de `/regalar`. *Si no aparece, falta el **redeploy de
      `getPublicGiftRegistry`** — ver [PENDIENTES.md §1](./PENDIENTES.md).*
- [ ] Las **tarjetas grandes** de `/regalar` muestran nombre + chip de relación + chips de
      ocasiones + fecha del evento.

### G. Nav de categorías por marca (slider + alineación)
- [ ] El **nav de categorías** de una marca muestra las categorías **automáticamente** (derivadas
      de sus productos) con sus miniaturas.
- [ ] **Alineación**: desde `/admin/elementos-diseno → "navegacion-categorias"`, cambia la
      alineación (izq / centro / der / justificado) y confirma que el nav lo refleja.
- [ ] **Modo slider vs. estático**: alterna entre **slider** (se desliza) y **estático** y verifica
      el comportamiento en la tienda. (Estilo guardado en `tienda_brands.categoryNavStyle`.)
- [ ] Lo elegido en el editor de elementos coincide con lo que muestra el **editor visual**.

### H. Páginas de marca `/ConAmor`, `/MUSSA`, `/MUEBLERIA`
- [ ] Abre **`wala.pe/ConAmor`**, **`wala.pe/MUSSA`** y **`wala.pe/MUEBLERIA`**: cada una carga su
      **landing de marca** (vía `DynamicLandingPage`).
- [ ] **Slug case-insensitive**: `/conamor`, `/mussa`, `/muebleria` (minúsculas) deben llegar a la
      **misma** página.
- [ ] El **catálogo/sidebar** de cada página muestra **solo productos de esa marca**.
- [ ] *(Admin)* Comprueba que productos asignados a una marca (`brandId`) salen en su página y no
      en las otras. Si una marca sale vacía, casi seguro **faltan productos asignados** (ver
      [PLAN-MULTIMARCA.md](./PLAN-MULTIMARCA.md)).

### I. Cuenta: tabs en 2 líneas + tarjeta de compra clickeable
- [ ] **Desktop**: los **tabs de la Cuenta** se reparten en **dos líneas** (no se cortan ni
      saturan).
- [ ] **Móvil**: si los tabs no caben, al entrar hacen un **"asomo"** (auto-scroll suave) que
      sugiere que hay más; se pueden **deslizar**.
- [ ] **Tarjeta de compra clickeable**: en "Mis Compras", **toda** la tarjeta de un pedido es
      clickeable (no solo un enlace) y lleva al **detalle**. Funciona también con **teclado**
      (Tab + Enter).

### Cómo distinguir "falta deploy" de "bug de verdad"
- Si **B (pagar→Pagado)** o **F (foto en /regalar)** fallan pero **todo lo demás** funciona, el
  problema casi seguro es que **falta el redeploy de funciones** (no es un bug del front). Ver
  [PENDIENTES.md §1](./PENDIENTES.md).
- Para cualquier otro síntoma, abre la consola (F12) y revisa el **primer error rojo** (ver §4).

---

## 5. Checklist antes de publicar (Vercel promote / auto-deploy)

Marca cada punto **antes** de promover en Vercel o dejar que el auto-deploy salga a producción.

- [ ] **Build local OK:** `npm run build` termina sin errores.
- [ ] **Proyecto correcto:** todo lo de Firebase apunta a **`sistema-gestion-3b225`**
      (revisa `.firebaserc` y los scripts de `package.json`). **Nunca** `pruebas-cd728`.
- [ ] **Variables de entorno:** `REACT_APP_FIREBASE_PROJECT_ID = sistema-gestion-3b225` en
      Vercel. Si cambiaste alguna env → **Redeploy** (Vite las hornea en build-time).
- [ ] **Reglas Firestore:** **NO** desplegar las reglas del repo tal cual.
      **Fusionar** con las reglas vivas del ERP/CRM y validar en *Rules Playground*. (Ver §6.)
- [ ] **Funciones:** si tocaste funciones, desplegarlas con
      `--project sistema-gestion-3b225`. Si te pregunta **borrar** funciones/índices del ERP,
      responder **`N` (No)**.
- [ ] **Índices:** si añadiste consultas nuevas, crear los índices y esperar a que terminen
      de construirse.
- [ ] **Iconos PWA / imágenes:** confirmar que el commit a promover incluye los iconos y el
      placeholder local (evita el ícono roto del [§4.3](#43-ícono-pwa-roto-o-imágenes-rotas)).
- [ ] **Smoke test post-deploy:** en wala.pe — cargar tienda, aplicar 2–3 filtros, abrir un
      producto, probar el editor (con y sin zonas), Kapi/minijuego, y un flujo de carrito.
      Revisar consola (F12) sin errores rojos.
- [ ] **Respaldo hecho** antes de cualquier cambio que toque datos/reglas/funciones (regla de
      oro del proyecto).

---

## 6. Recordatorio de topología (NO te saltes esto)

- **Producción = `sistema-gestion-3b225`.** Es **un solo proyecto Firebase** donde
  **conviven el portal de la tienda y el ERP/CRM** (misma base Firestore). Por eso hay que
  tener cuidado: lo que rompa las reglas del ERP afecta a todo el negocio.
- La web **wala.pe** la sirve **Vercel** (proyecto `portal-clientes-regala-con-amor`).
  Cambiar variables de entorno → **Redeploy**.
- **NO desplegar reglas (`firestore:rules`) ni Storage sin FUSIONAR** primero con las reglas
  **vivas** del ERP/CRM. El repo no cubre las decenas de colecciones del ERP; desplegarlas
  tal cual las **bloquearía**.
- **Nunca** responder "sí" a borrar funciones/índices al desplegar: son del ERP. Siempre
  **`N`**.
- El antiguo proyecto **`pruebas-cd728` no se usa** (quedó con funciones huérfanas de un
  deploy equivocado). No desplegar ahí.

> Documentos relacionados: [DESPLIEGUE-ESTADO.md](./DESPLIEGUE-ESTADO.md) (qué está
> desplegado y qué falta), [DESPLIEGUE.md](./DESPLIEGUE.md) (procedimiento paso a paso),
> [README.md](./README.md) (índice general) y [MODELO-DATOS.md](./MODELO-DATOS.md)
> (colecciones de Firestore).
