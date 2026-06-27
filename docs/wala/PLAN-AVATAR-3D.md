# PLAN — Avatar Studio 3D (estilo "PACDORA"): selfie → avatar 3D → probador de ropa

> Documento de arquitectura de producto/técnico. **No es código.** Aterriza la visión
> del dueño en el codebase real de WALA (React + Vite + Firebase, `wala-master`).
> Regla heredada del proyecto: **donde el código actual contradice lo aspiracional,
> gana el código.** Y donde la visión choca con la realidad técnica/legal/de costos,
> este documento lo dice con honestidad antes de prometer nada.

---

## 0. TL;DR para el dueño (léelo aunque no leas el resto)

1. **La visión es real y se puede construir, pero por partes y con servicios de pago
   externos.** Generar un avatar 3D desde una selfie **no se hace dentro de wala**: se
   delega a un servicio de IA de terceros. No existe una librería gratis que lo haga bien
   en el navegador.

2. **Hay un incendio que apagar primero.** Wala **ya tiene Ready Player Me integrado**
   (`src/components/profile/AvatarStudio.jsx`, dependencia
   `@readyplayerme/react-avatar-creator`). Pero **Ready Player Me fue comprado por Netflix
   en diciembre 2025 y está cerrando su servicio el 31 de enero de 2026.** Es decir: la
   pieza sobre la que ya construimos **va a dejar de funcionar.** La primera tarea de este
   plan no es "agregar 3D", es **migrar el Avatar Studio actual a un proveedor vivo** antes
   de que se rompa en producción. Ver §1.1 y §7 (Riesgos).

3. **Las 3 versiones pedidas (anime / estilo Meta-cartoon / realista) NO las da un solo
   proveedor.** Cada estilo es un mundo técnico distinto. La recomendación realista es:
   - **Estilo Meta/cartoon (Bitmoji-like):** un creador de avatares estilizados
     configurable (Avaturn en modo estilizado, o un creador propio). **MVP recomendado.**
   - **Anime:** pipeline VRoid/VRM (formato `.vrm`), normalmente **no** generado 1:1 desde
     foto; el usuario ajusta rasgos. Es el más "de nicho".
   - **Realista:** reconstrucción 3D desde foto (Avaturn realista, in3D, Union Avatars) o
     image-to-3D (Meshy/Tripo/Rodin). Es el más caro y el de peor "parecido garantizado".

4. **El "probador estilo Pacdora" es lo más caro de todo, y no por el visor.** El visor 3D
   interactivo (rotar/zoom) es la parte fácil (react-three-fiber o `<model-viewer>`). Lo
   caro es **tener un modelo 3D de cada prenda que se vista bien sobre el avatar.** Hoy wala
   no tiene ni un solo modelo 3D de producto. Sin eso, el try-on no existe. Ver §2.

5. **Selfies = datos personales sensibles (rostro = biometría).** Subir fotos de cara
   dispara obligaciones legales (Ley N.º 29733 de Protección de Datos Personales del Perú,
   y GDPR si hay usuarios europeos). Hace falta consentimiento explícito, política de
   retención y borrado, y dejar claro que un **tercero** procesa la imagen. Ver §4. Esto
   **no es opcional.**

6. **Recomendación de arranque (lo barato y realista):** Fase 1 = **arreglar/migrar el
   Avatar Studio a un proveedor estilizado vivo, con UN solo estilo (cartoon)**, guardar el
   `.glb` en Storage y mostrarlo en un visor 3D en el perfil. Sin try-on de prendas todavía.
   Coste ~0–decenas de USD/mes en escala chica. El try-on y los 3 estilos vienen después,
   solo si el primer paso genera tracción.

---

## 1. La realidad técnica: generar un avatar 3D desde una foto no es trivial

### 1.1 Qué hay HOY en wala (punto de partida real)

| Pieza | Estado en el código |
|---|---|
| `src/components/profile/AvatarStudio.jsx` | Componente funcional. Abre un **iframe de Ready Player Me** (subdominio `demo`, sandbox), escucha el evento `v1.avatar.exported` por `postMessage`, y guarda `glbUrl` (el `.glb`) + `avatarUrl` (un render `.png` 2D). |
| `package.json` | Dependencia `@readyplayerme/react-avatar-creator` `^0.5.0` ya instalada. |
| `src/pages/cuenta/PerfilPage.jsx` | Renderiza `<AvatarStudio>`, mantiene `avatarConfig` en estado y lo persiste vía `updateUserProfile({ avatarConfig })` (campo `avatarConfig` del doc de usuario en Firestore). El `avatarConfig` actual es un objeto 2D casero (`skinTone`, `hairStyle`, `weight`, `height`, `activeItemId`…). |
| Visor 3D | **No existe.** Hoy solo se muestra el render **PNG 2D** que devuelve RPM (`config.avatarUrl`), dentro de un `<img>`. No hay three.js, ni react-three-fiber, ni `<model-viewer>` en las dependencias. |
| Try-on de prendas | **No existe** como 3D. En `PerfilPage` hay un `clothingItems` que filtra productos por nombre ("polo", "ropa"), pero es para el muñeco 2D, no para vestir un GLB. |
| Modelos 3D de productos | **Cero.** El catálogo (`productos_wala`) tiene imágenes 2D (Cloudinary/Storage), no mallas GLB. |

**Traducción:** el "Avatar Studio" ya está esbozado y el dueño ya eligió bien el camino
(RPM, avatar 3D real, formato GLB). Pero (a) está en modo `demo`/sandbox, (b) **solo
muestra un PNG plano, no un visor 3D**, y (c) **el proveedor se está apagando** (ver
siguiente punto).

### 1.2 El problema urgente: Ready Player Me cierra

En **diciembre de 2025 Netflix adquirió Ready Player Me** y anunció el **cierre de sus
servicios el 31 de enero de 2026** (incluida la herramienta de creación de avatares). El
equipo se integra a Netflix para usar la tech en su propio ecosistema de juegos. Para
desarrolladores externos como wala **no hay continuidad pública garantizada** del SDK/API.

Consecuencia directa para wala:

- El iframe `demo.readyplayer.me` que usa `AvatarStudio.jsx` **puede dejar de responder en
  cualquier momento.**
- Los `.glb` ya generados que apunten a CDN de RPM **podrían dejar de servirse.** (Por eso
  este plan insiste en **copiar el GLB a Firebase Storage propio**, §3.)
- **Acción inmediata recomendada (independiente de todo lo demás):** decidir proveedor de
  reemplazo y migrar el Avatar Studio. Mientras tanto, **descargar y re-alojar** cualquier
  GLB de usuario que ya exista. No depender del CDN de un servicio en cierre.

> Este es el hallazgo más importante del documento. Cambia el orden de prioridades: antes
> de "agregar las 3 versiones", hay que **no quedarnos sin avatar.**

### 1.3 Cómo se genera realmente un avatar 3D desde foto (las 4 familias de técnica)

Hay cuatro enfoques tecnológicos distintos, y **cada estilo pedido cae en uno diferente.**
Mezclarlos en la cabeza es la causa #1 de subestimar el esfuerzo.

1. **Creador de avatares estilizados ("avatar-from-photo" tipo RPM / Avaturn / Meta).**
   La foto se usa para **estimar rasgos** (forma de cara, tono de piel, peinado aproximado)
   y se arma un avatar **paramétrico** sobre una malla base humana. El resultado es un
   personaje limpio, riggeado (con esqueleto), listo para animar y **vestir**. Formato:
   **GLB** (a veces VRM). **No busca foto-realismo**; busca un "tú reconocible y estilizado".
   → Este es el camino de **Meta/cartoon** y, en su variante realista, también de "realista
   suave".

2. **Reconstrucción 3D realista de persona (SMPL-X / Gaussian Splatting / fotogrametría).**
   Reconstruye geometría real del cuerpo/cara a partir de una o varias fotos. Da el
   "parecido" más alto, pero: pesa más, suele venir **sin rig** o con rig limitado (cuesta
   animar/vestir), y la calidad depende muchísimo de la foto. Servicios: in3D, Union
   Avatars, Avatar SDK (avatarsdk.com). Gaussian Splatting da fotos espectaculares pero
   produce "nubes de puntos" difíciles de vestir con ropa rígida.
   → Camino de **realista de verdad**, el más caro y el de UX más frágil.

3. **Image-to-3D genérico (Meshy / Tripo / Rodin / Hunyuan3D).**
   Convierte **cualquier imagen** en una malla 3D. Sirve genial para **objetos** (¡y para
   convertir la foto de un producto en su modelo 3D!), pero para **personas** da resultados
   irregulares y sin rig humano estándar. **No** es el camino para el avatar de la persona;
   **sí** es un camino interesante para generar el **modelo 3D de las prendas** (§2).

4. **Anime / VTuber (VRoid → VRM).**
   El estándar anime es **VRoid Studio** (gratis, de Pixiv) que produce **`.vrm`**. Lo
   normal **no** es "anime exacto de tu foto" sino un personaje anime que el usuario
   personaliza (y opcionalmente se inspira en su foto). Hay herramientas que estiman un
   avatar VRM desde foto, pero el "parecido" es laxo por diseño (el anime estiliza fuerte).
   → Camino de **anime**.

**Conclusión de §1:** las 3 versiones pedidas no son "tres botones del mismo servicio". Son
**tres pipelines distintos**. Lo honesto es construir **uno bien** (el cartoon/Meta, que es
el más maduro y barato) y ofrecer los otros dos como fases posteriores.

---

## 2. Comparativa de servicios reales (qué genera, formato, try-on, precio, encaje)

> Precios aproximados a fecha de redacción (mediados 2026); **cambian seguido** y hay que
> reconfirmar con cada proveedor antes de comprometer presupuesto. Tómalos como orden de
> magnitud, no como cotización.

### 2.1 Tabla comparativa

| Servicio | Qué genera | Formato | ¿Try-on de ropa? | Precio aprox. | Encaje con versión pedida |
|---|---|---|---|---|---|
| **Ready Player Me** | Avatar estilizado medio-realista de cuerpo completo, riggeado. Desde foto o editor. | **GLB** (+ render PNG) | Sí, ecosistema de "assets"/outfits propios; vestir prenda externa = trabajo manual. | Era gratis para devs. **⚠️ EN CIERRE (Netflix, ene-2026). No apostar a futuro.** | Cubría *Meta/cartoon* y *realista suave*. **Hay que reemplazarlo.** |
| **Avaturn** | Avatar **realista** desde 1 selfie, cuerpo completo, riggeado, con sistema de **prendas intercambiables**. Tiene estilos. | **GLB** (export FBX/VRM) | **Sí, nativo:** su API tiene endpoints para activar/desactivar prendas y **subir tus propias prendas**. Es de lo mejor para try-on. | Free generoso para probar. **Pro $800/mes** (~6.000 avatares/mes, $0.15 por avatar extra, branding, API/SDK, prendas propias). Enterprise a medida. | **Mejor candidato para *realista* y para el *try-on*** (subes tus prendas). Caro al escalar. |
| **Meta Avatars SDK** | Avatar cartoon estilo Meta/Bitmoji. | Propietario Meta | Dentro del ecosistema Meta (Quest/Horizon), no para una web e-commerce arbitraria. | — | **No encaja** para una web React independiente. Es para apps del ecosistema Meta. Sirve solo como *referencia de estilo*. |
| **Union Avatars** | Avatar **full-body realista desde 1 selfie**, "en segundos". SDK para integrar. | GLB / VRM | Soporta outfits; try-on de prenda arbitraria = trabajo. | A medida / planes de desarrollador (reconfirmar). | Candidato para *realista*. Alternativa a Avaturn. |
| **in3D** | Avatar **fotorealista full-body** desde cámara de teléfono. SDK. | GLB | Limitado; foco en parecido, no en moda. | A medida / enterprise. | *Realista* de alto parecido, pero más orientado a apps móviles nativas/metaverso. |
| **Avatar SDK (avatarsdk.com)** | Selfie → avatar **fotorealista o cartoon**, cara y cuerpo. | GLB / FBX | Algunos planes con ropa. | Planes dev + enterprise (reconfirmar). | Puede cubrir *realista* **y** *cartoon* con un solo proveedor. A evaluar. |
| **VRoid Studio (+ VRM)** | Avatar **anime** que el usuario personaliza. Gratis. | **VRM** | Ropa anime propia del ecosistema VRoid; vestir prenda de catálogo real = no directo. | **Gratis** (escritorio). Integración web = construir el visor uno mismo. | **Único camino realista para *anime*.** Pero es "crear", no "desde tu foto" 1:1. |
| **Meshy / Tripo / Rodin** | **Image-to-3D de objetos.** | GLB | N/A para avatar. | Meshy Pro ~$20/mes (~1.000 créditos, ~$0.02/crédito). Tripo ~$0.01/crédito (2.000 gratis). Rodin = premium (mejor calidad, más caro). | **No para el avatar de la persona.** **Sí** como vía para generar el **modelo 3D de las prendas** del catálogo (§2.3). |

### 2.2 Recomendación POR versión

- **Versión Meta/cartoon (la del MVP):** un creador de avatares estilizados configurable.
  Con RPM en cierre, los candidatos vivos son **Avaturn (modo estilizado)** o **Avatar SDK
  (cartoon)**. Es el avatar más fácil de vestir y el más barato de mantener. **Empezar por
  aquí.**
- **Versión realista:** **Avaturn** (porque además trae try-on nativo) o **Union Avatars /
  in3D** si se busca máximo parecido. Asumir mayor costo y mallas más pesadas.
- **Versión anime:** **VRoid/VRM**. Aceptar que es "personaliza tu anime" más que "anime de
  tu foto exacta". Es la que menos retorno comercial tiene para un marketplace de ropa real,
  así que **última en la cola.**

> **Decisión de consolidación recomendada:** si se pudiera elegir **un solo proveedor** que
> dé *cartoon* + *realista* + *try-on de prendas propias*, **Avaturn** es el más completo
> hoy (su API permite subir tus prendas y conmutarlas). El anime quedaría como track aparte
> (VRoid). Esto reduce la complejidad de 3 integraciones a 2.

### 2.3 El modelo 3D de la PRENDA: el costo oculto

Para "probarse la ropa" hacen falta **prendas en 3D**. Tres caminos, de menos a más esfuerzo
realista:

1. **Usar el guardarropa del propio proveedor (Avaturn/RPM).** Eliges entre prendas
   genéricas (polo, jean…) que el avatar ya sabe vestir. **Pro:** cero modelado. **Contra:**
   son prendas genéricas, **no la prenda real del catálogo de wala** (no es "tu producto").
2. **Subir tus propias prendas al proveedor** (Avaturn lo permite). Requiere tener cada
   prenda modelada en 3D y riggeada para su sistema. Esfuerzo medio-alto **por prenda**.
3. **Generar el 3D de cada producto con image-to-3D** (Meshy/Tripo) a partir de la foto del
   producto. **Pro:** automatizable. **Contra:** la malla resultante de una prenda suelta no
   "se viste" sola sobre un cuerpo (no tiene rig ni cae con física); sirve más como objeto
   girable que como prenda puesta. **Calidad inconsistente.**

**Conclusión honesta:** el try-on "de verdad" (tu avatar con **la prenda exacta que
compras**) implica **trabajo de modelado 3D por producto** o un pipeline semi-automático con
revisión. Es la parte más costosa y la que más conviene **diferir** hasta validar demanda.
El MVP de try-on debería usar el **guardarropa genérico del proveedor** o un set chico de
prendas "estrella" modeladas a mano.

---

## 3. El probador de ropa 3D "estilo Pacdora": qué es y qué se necesita

### 3.1 Aclaración: qué es "estilo Pacdora"

**Pacdora** es una herramienta de **mockups de packaging**: muestra cajas/empaques en un
**visor 3D interactivo** que el usuario **rota, hace zoom y gira** en el navegador, y sobre
el que se "pega" un diseño 2D. **"Estilo Pacdora" para wala = ese visor 3D interactivo**:
un canvas donde se ve un modelo 3D, se puede orbitar con el mouse/dedo, y aquí lo que se
muestra es **el avatar del usuario vistiendo la prenda.**

Pacdora **no** genera avatares ni hace try-on de ropa; lo que el dueño admira de Pacdora es
**la experiencia de visor 3D rotable y pulida.** Esa parte es la **fácil y barata** de
replicar. Lo difícil es el contenido 3D que se mete dentro (avatar + prenda), no el visor.

### 3.2 El visor (la parte fácil): dos opciones

| Opción | Qué es | Cuándo usarla |
|---|---|---|
| **`<model-viewer>`** (Google) | Web component que carga un GLB y da órbita/zoom/AR "gratis" con casi cero código. | **MVP.** Mostrar el avatar (y luego avatar+prenda ya combinados en un GLB) girable. Rápido de integrar. |
| **react-three-fiber + drei** (three.js) | Control total: cargar GLB/VRM, animaciones, cambiar prendas en vivo, iluminación, poses, post-proceso. Para VRM: `@pixiv/three-vrm`. | Cuando haga falta **componer avatar + prenda en tiempo real**, animar, o cambiar de outfit sin regenerar el GLB. Es el camino "completo". |

Recomendación: **empezar con `<model-viewer>`** para el visor del perfil (gira tu avatar) y
**migrar a react-three-fiber** cuando se quiera ensamblar avatar+prenda dinámicamente.

### 3.3 Cómo "viste" el avatar la prenda (las dos arquitecturas)

1. **Composición en el cliente (react-three-fiber):** se carga la malla del avatar y, por
   encima, la malla de la prenda (riggeada al mismo esqueleto), y three.js las renderiza
   juntas. Es lo que permite "cámbiate el polo" sin volver a llamar al servicio. Requiere que
   **avatar y prendas compartan esqueleto/estándar** (por eso conviene un solo proveedor de
   avatar, como Avaturn, y prendas hechas para ese sistema).
2. **Render en el proveedor (API):** se le pide al proveedor (p. ej. Avaturn) "este avatar
   con esta prenda activada" y devuelve un GLB/imagen ya combinado. Más simple de integrar,
   menos interactivo (cada cambio = una llamada).

**Asociación prenda↔avatar (modelo de datos):** cada producto del catálogo que tenga try-on
necesita un campo nuevo, p. ej. `producto.modelo3d = { glbUrl, proveedorAssetId, estilo }`.
El avatar del usuario vive en `usuario.avatar3d` (§3.4). El botón "Probármelo" cruza ambos.

### 3.4 Nivel de realismo vs. esfuerzo (sé honesto con el dueño)

| Nivel | Qué se ve | Esfuerzo | Recomendado para |
|---|---|---|---|
| **A. Visor del avatar solo** | Tu avatar 3D girable en el perfil. Sin prendas del catálogo. | Bajo | **MVP.** Engancha sin prometer try-on. |
| **B. Try-on con guardarropa genérico** | Tu avatar con prendas genéricas del proveedor (un polo, un jean). No es tu producto exacto. | Medio | Demo de "probador". |
| **C. Try-on con prendas reales (set chico)** | Tu avatar con 5–20 productos estrella modelados a mano en 3D. | Alto (modelado por prenda) | Validación seria. |
| **D. Try-on de TODO el catálogo** | Cualquier producto se prueba en 3D. | Muy alto / continuo | Solo con tracción probada y presupuesto. |

> El "wow" de Pacdora se logra **ya en el nivel A**. No hace falta llegar a D para impresionar.

---

## 4. Arquitectura en wala (flujo completo y dónde encaja)

### 4.1 Flujo objetivo

```
[Perfil → Avatar Studio]
   1. Usuario acepta consentimiento (PII) y sube SELFIE
        │
        ▼
   2. Front llama a una Cloud Function  (NO se exponen API keys del proveedor)
        │   p.ej.  callable  generarAvatar3D({ imagenBase64, estilo })
        ▼
   3. Cloud Function → API del proveedor (Avaturn / etc.) con la API key (secret)
        │   recibe { glbUrl }  (en el CDN del proveedor)
        ▼
   4. Cloud Function DESCARGA el GLB y lo RE-ALOJA en Firebase Storage:
        users/{uid}/avatar3d/{estilo}.glb        ← propiedad de wala, no del CDN ajeno
        (borra/no persiste la selfie original salvo consentimiento explícito)
        │
        ▼
   5. Guarda en Firestore:  usuario.avatar3d = { glbUrlStorage, estilo, proveedor, fecha }
        │
        ▼
   6. Perfil muestra VISOR 3D (<model-viewer> o r3f) cargando el GLB de Storage
        │
        ▼
   7. En cada producto con modelo3d → botón "Probármelo":
        carga avatar.glb + producto.modelo3d.glb en el visor y los compone
```

### 4.2 Dónde encaja en el código existente

| Pieza del flujo | Archivo / lugar | Acción |
|---|---|---|
| UI de subir selfie + consentimiento | `src/components/profile/AvatarStudio.jsx` | **Reescribir** el iframe RPM por: uploader de selfie + checkbox de consentimiento + llamada a la Cloud Function. Reusar `react-easy-crop` (ya en deps) para encuadrar la cara. |
| Estado y guardado del avatar | `src/pages/cuenta/PerfilPage.jsx` | Ya persiste `avatarConfig`; **añadir** `avatar3d` (campos nuevos). Reusar `updateUserProfile`. |
| Cloud Function de generación | `functions/index.js` (+ posible `functions/avatar.js`) | **Nueva** function `onCall` que mete la API key como `process.env` secret. **Mismo patrón ya usado** por `processCulqiPayment` (que lee `process.env.CULQI_SECRET_KEY`). |
| Almacenamiento del GLB | Firebase Storage, regla `users/{userId}/{allPaths=**}` ya existe en `firebase/storage.rules` (write solo el dueño). | Reusar. Crear subcarpeta `avatar3d/`. **Confirmar** que GLB se sirve con CORS correcto (`cors.json` ya existe en el repo). |
| Visor 3D en perfil | nuevo `src/components/profile/Avatar3DViewer.jsx` | **Nuevo.** `<model-viewer>` (MVP) o r3f. |
| Botón "Probármelo" | `src/pages/Tienda/components/ProductDetail/ProductDetail.jsx` | **Nuevo** botón que abre un modal con el visor 3D cargando `avatar3d` + `producto.modelo3d`. Solo visible si ambos existen. |
| Modelo 3D del producto | admin de productos (`AdminProductoFormV2.jsx`) + doc `productos_wala` | **Nuevo** campo `modelo3d.glbUrl`. Subida manual por admin al principio. |

### 4.3 Por qué Cloud Function obligatoria

- **No exponer API keys.** Las claves de Avaturn/proveedor no pueden ir en el bundle de Vite
  (todo lo `VITE_*` es público). Van como **secret de Functions** (mismo mecanismo que
  `CULQI_SECRET_KEY`, `ERP_WEBHOOK_SECRET`, etc.).
- **Control de costo.** La function es el punto único donde aplicar **rate-limit por usuario**
  (p. ej. máx N generaciones/día), igual que ya se hace con la economía de monedas
  server-side. Sin esto, un bucle de generaciones puede disparar la factura del proveedor.
- **Re-alojar el GLB.** No depender del CDN del proveedor (lección directa del cierre de RPM).

---

## 5. Privacidad y aspectos legales (NO opcional)

Subir una **selfie de la cara** es tratar **datos personales**, y el rostro tiende a
clasificarse como **dato sensible/biométrico**. Implicaciones:

- **Marco aplicable:** en Perú, **Ley N.º 29733 de Protección de Datos Personales** y su
  reglamento (titular: la persona; wala debe tener base legal = **consentimiento previo,
  libre, expreso e informado**). Si hay usuarios de la UE (y este plan va de la mano del de
  i18n para extranjeros), aplica **GDPR**, donde la imagen facial usada para identificar es
  **categoría especial** (Art. 9) con requisitos más estrictos.
- **Consentimiento explícito** antes de subir la foto: checkbox no premarcado, con texto
  claro de "tu selfie será **enviada a un proveedor externo (X)** para generar tu avatar".
- **Minimización y retención:** **no guardar la selfie** salvo que sea imprescindible; lo que
  se conserva es el **GLB resultante**, no la foto. Si se guarda la foto, definir **plazo de
  borrado** y borrarla.
- **Transferencia internacional a un tercero:** el proveedor (Avaturn, etc.) está fuera de
  Perú → hay **transferencia internacional de datos**; debe declararse en la política de
  privacidad y, idealmente, cubrirse en el contrato/DPA con el proveedor.
- **Derecho de borrado:** el usuario debe poder **eliminar su avatar** (borrar
  `users/{uid}/avatar3d/*` en Storage + campo en Firestore + pedir borrado al proveedor si
  guarda algo).
- **Menores:** si hay usuarios menores de edad, sube el nivel de exigencia (consentimiento de
  representante). Definir política.
- **Documentación:** actualizar la **Política de Privacidad** y los **Términos** de wala
  para incluir el tratamiento de imágenes y el procesamiento por terceros. Coordinar con el
  responsable legal de CATAS GROUP S.A.C.

> Recomendación concreta: la primera versión del Avatar Studio **no debe almacenar la selfie
> en absoluto**: la imagen viaja a la Cloud Function, esta la reenvía al proveedor, recibe el
> GLB, y la imagen se descarta. Así se reduce drásticamente la superficie legal.

---

## 6. Fases incrementales (de lo más barato/realista a lo completo)

> Esfuerzo en una escala relativa (S=días, M=1–2 semanas, L=3–6 semanas, XL=meses), no en
> horas exactas. Coste/usuario/mes es **orden de magnitud** y depende del proveedor final.

### Fase 0 — Apagar el incendio RPM (BLOQUEANTE) · Esfuerzo S–M
- Decidir proveedor de reemplazo (recomendado: **Avaturn**).
- **Re-alojar** en Storage cualquier GLB de usuario que hoy apunte al CDN de RPM.
- Si no hay usuarios reales con avatar todavía, simplemente **deshabilitar/ocultar** el
  Avatar Studio actual para que no genere avatares que morirán el 31-ene-2026.
- **Coste:** ~$0.

### Fase 1 — MVP: un solo estilo, avatar girable en el perfil · Esfuerzo M
- Avatar Studio reescrito: subir selfie + consentimiento → Cloud Function → proveedor →
  GLB en Storage → **visor `<model-viewer>` en el perfil**.
- **Un solo estilo** (cartoon/Meta o realista del proveedor elegido).
- **Sin try-on.** Solo "mírate en 3D".
- Rate-limit por usuario en la function.
- **Coste/usuario/mes:** prácticamente **$0–bajo** (un GLB se genera una vez y se reusa;
  el costo es por *generación*, no por *visualización*). En un proveedor tipo Avaturn,
  cada avatar generado entra en el cupo del plan; visualizar el GLB ya alojado es gratis.

### Fase 2 — Try-on básico con guardarropa genérico · Esfuerzo L
- Botón "Probármelo" en `ProductDetail`, modal con visor.
- Usa **prendas genéricas del proveedor** (no productos reales aún) **o** migra el visor a
  **react-three-fiber** para componer avatar + prenda.
- **Coste:** sigue siendo por-generación; el try-on en sí no multiplica costo si se
  compone en cliente.

### Fase 3 — Try-on con set chico de productos reales (5–20) · Esfuerzo L–XL
- Modelar/subir 3D de los productos "estrella". Campo `producto.modelo3d`.
- Admin sube el GLB de la prenda en `AdminProductoFormV2`.
- **Coste:** **modelado 3D por prenda** (trabajo humano o pipeline image-to-3D + revisión).
  Este es el verdadero gasto recurrente del proyecto.

### Fase 4 — Multi-estilo (anime + realista) · Esfuerzo XL
- Añadir 2.º pipeline (VRoid/VRM para anime; segundo proveedor para realista si no lo cubre
  el primero). Visor pasa a soportar VRM (`@pixiv/three-vrm`).
- **Coste:** suma del segundo proveedor + complejidad de mantener dos formatos (GLB y VRM).

### Fase 5 — Try-on de catálogo amplio / física de tela / AR · Esfuerzo XL+
- Pipeline semiautomático de 3D por producto, posiblemente física de tela, vista AR
  (`<model-viewer>` ya trae AR en móvil).
- Solo con tracción y presupuesto probados.

---

## 7. Riesgos y decisiones abiertas (lo que el dueño debe confirmar)

### Riesgos
| Riesgo | Impacto | Mitigación |
|---|---|---|
| **RPM en cierre (ene-2026)** | La integración actual muere. | **Fase 0 ya.** Migrar proveedor + re-alojar GLB. |
| **Costo del try-on real (modelado por prenda)** | Puede ser el mayor gasto recurrente. | Empezar con guardarropa genérico / set chico; diferir catálogo completo. |
| **Costo por generación se dispara** | Factura del proveedor sin control. | Rate-limit en Cloud Function; cachear GLB; regenerar solo si el usuario lo pide. |
| **Parecido decepcionante (sobre todo "realista")** | Usuario frustrado ("no soy yo"). | Gestionar expectativa (UI: "avatar estilizado"); permitir ajustar rasgos. |
| **Legal/PII (rostro)** | Sanción/daño reputacional. | No almacenar selfie; consentimiento; política de retención/borrado; DPA con proveedor. |
| **Peso de los GLB en móvil** | Carga lenta en gama baja (público peruano). | Comprimir GLB (Draco), lazy-load del visor, fallback a render PNG 2D. |
| **Dependencia de un único proveedor vivo** | Si cierra (como RPM), se repite el problema. | Abstraer el proveedor detrás de la Cloud Function (cambiar de proveedor = cambiar la function, no el front). |

### Decisiones que necesita tomar el dueño
1. **¿Qué proveedor?** Recomendación: **Avaturn** (cubre realista + cartoon + try-on de
   prendas propias en una sola API). ¿Presupuesto para su Pro ($800/mes) si se escala, o
   arrancar en su Free?
2. **¿Cuántos estilos en v1?** Recomendación fuerte: **uno** (cartoon o realista). Anime al
   final o nunca (poco retorno para ropa real).
3. **¿Try-on con prenda genérica o con producto real?** Recomendación: genérico primero;
   producto real solo para un set chico estrella.
4. **¿Se almacena la selfie?** Recomendación: **no**. Confirmar con legal.
5. **¿Quién actualiza Política de Privacidad/Términos?** (responsable legal de CATAS GROUP).
6. **¿Presupuesto de modelado 3D por prenda?** Es el costo real de "probarse la ropa".
7. **Orden vs. otras prioridades:** este feature compite con Fase 0 de seguridad y el resto
   del roadmap (PLAN-MAESTRO). ¿Es un "wow de marketing" prioritario o un nice-to-have?

---

## 8. Recomendación final (una frase)

**Primero migra el Avatar Studio fuera de Ready Player Me (que cierra) a Avaturn con UN solo
estilo y un visor 3D girable en el perfil (Fases 0–1, barato). Demuestra el "wow". Solo si
engancha, invierte en el try-on con prendas reales (Fase 3), que es la parte cara.** Las tres
versiones (anime/Meta/realista) y el catálogo completo en 3D son metas de largo plazo, no del
MVP.

---

### Fuentes consultadas (precios/servicios; reconfirmar antes de comprometer presupuesto)
- Netflix adquiere Ready Player Me y cierre del servicio (ene-2026): TechCrunch, 19-dic-2025.
- Avaturn pricing/API (Pro $800/mes, prendas propias, GLB): avaturn.me/pricing, docs.avaturn.me/api.
- Meshy / Tripo / Rodin (image-to-3D, créditos): meshy.ai, tripo3d.ai, comparativas 2026.
- Union Avatars / in3D / Avatar SDK (realista desde selfie): unionavatars.com, in3d.io, avatarsdk.com.
- VRoid Studio / VRM (anime): vroid.com.
- Visor web: react-three-fiber (r3f.docs.pmnd.rs), `@pixiv/three-vrm`, Google `<model-viewer>`.
