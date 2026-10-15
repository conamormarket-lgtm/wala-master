# Legales: libro de reclamaciones, privacidad y términos

Cómo verlo en vivo: `npm run dev` → http://localhost:3000/componentes.html →
**Páginas** → **Tienda de prueba** → **Legales**, con "Cómo se abre":

- **Libro de reclamaciones** (`/libro-de-reclamaciones`). Estados: el envío
  falla y cargando. "Con sesión" llega con los datos de la cuenta ya puestos.
  Enviar arma el código como la tienda, pero la demo no guarda nada.
- **Política de privacidad** (`/politicas-privacidad`) y **Términos y
  condiciones** (`/terminos-y-condiciones`). Estado: cargando.

El pie de la Tienda de prueba también lleva aquí. Su enlace a privacidad
apuntaba a `/politicas-de-privacidad`, que no existe, y se corrigió.

| El libro (escritorio) | El libro (celular, noche) | Registrada (celular, noche) |
|---|---|---|
| ![El libro de reclamaciones](reclamaciones-escritorio.webp) | ![El libro en el celular](reclamaciones-celular.webp) | ![La reclamación registrada con su código](reclamacion-registrada.webp) |

| Privacidad (escritorio) | Privacidad (celular, noche, índice abierto) |
|---|---|
| ![La política de privacidad con su índice](privacidad-escritorio.webp) | ![La política en el celular](privacidad-celular.webp) |

Revisado el 2026-10-15 contra estos archivos:

| Página | Archivo | Líneas |
|---|---|---|
| Libro de reclamaciones | `pages/LibroReclamacionesPage.jsx` (+ `LibroReclamaciones.module.css`) | 284 (+244) |
| Política de privacidad | `pages/PoliticasPrivacidadPage.jsx` | 122 |
| Términos y condiciones | `pages/TerminosCondicionesPage.jsx` | 107 |
| Estilos de las dos | `pages/PoliticasPrivacidad.module.css` | 285 |
| Datos de la empresa | `config/empresa.js` | — |

**Los textos de la demo son los reales.** Están copiados tal cual de las dos
páginas en `demo/legales.js`, como datos. La empresa (razón social, RUC,
domicilio, correo, WhatsApp, plazo de 15 días hábiles) sale de
`config/empresa.js`. En la reclamación, el DNI y el celular "con sesión" son
de ejemplo.

## Partes

| Parte | Componente | Piezas que usa | Datos (en la tienda) |
|---|---|---|---|
| P19 Libro de reclamaciones | `PaginaReclamaciones` (`paginas/Legales.jsx`) | `CabezaLegal`, `DatosProveedor` y `CodigoReclamacion` (nuevas, `piezas/Legales.jsx`); `PasoEstudio` (los 3 pasos con su costura), `CamposDatosPersonales` (nombre, documento y celular, con las reglas de Mi perfil), `Campo` (con `multilinea`, nuevo), `ListaEleccion`, `Casilla`, `Aviso`, `Boton` | `empresa`; al enviar, `createDocument('libro_reclamaciones', …)` |
| P19 Privacidad y términos | `PaginaLegal` | `CabezaLegal`, `IndiceLegal`, `SeccionLegal` (nuevas), `TarjetaAyuda` (Kapi, el correo y WhatsApp), `Boton` | hoy los textos están escritos en el JSX de cada página (ver abajo) |

Validación: `validarReclamacion(datos)` (exportada) usa `validarPerfil` para
el nombre, el documento y el celular, y suma domicilio, correo, apoderado si
es menor, monto, qué compraste, qué pasó, qué solución esperas y la casilla.

Esqueletos: `EsqueletoPagina forma="legal"` y `forma="reclamaciones"`
(nuevas, con la medida real en escritorio y en el celular).

**Pieza nueva compartida: `Campo multilinea`.** El kit no tenía un campo de
texto largo, y había dos `<textarea>` hechos a mano (Opiniones y el
estudio). Ahora `Campo` tiene `multilinea` (true = 3 líneas, o el número que
se pase). Con `maxLength` cuenta lo escrito ("120/800"). Opiniones ya lo usa.
`CampoTelefono` y `CamposDatosPersonales` aceptan `id` / `ids`, para llevar
el foco al primer error.

### Lo que hace

- **Libro de reclamaciones:**
  - El libro en su sello, "Libro de Reclamaciones" con su trazo y la ley.
    Debajo, en una línea, qué es y en cuánto se responde.
  - **Datos del proveedor**, como pide INDECOPI: razón social, RUC,
    domicilio, "Hoja de reclamación: se genera al enviar" y la fecha de hoy.
  - **1. Tus datos:** nombre completo, tipo y número de documento, celular
    (+51), domicilio, correo ("Aquí te llega la respuesta.") y "La persona que
    reclama es menor de edad". Si se marca, aparece el nombre del padre, madre o
    apoderado.
  - **2. Lo que compraste:** Producto o Servicio, el monto (opcional, con
    "S/") y "¿Qué compraste?" (con el pedido como ejemplo).
  - **3. Tu reclamo:** Reclamo o Queja, cada uno con lo que significa;
    "¿Qué pasó?" y "¿Qué solución esperas?", con su cuenta de letras.
  - La casilla de veracidad enlaza a la Política de Privacidad. Abajo,
    "Enviar reclamación" ("Registrando…" mientras guarda) y la nota legal de
    INDECOPI.
  - Si falta algo, cada campo dice qué le falta y el foco va al primero.
  - Si falla el envío, el aviso de error encima del botón, y lo escrito se
    queda.
  - **Registrada:** el sello con el visto, "¡Reclamación registrada!", el
    código grande con "Copiar código" y la fecha, a qué correo y en cuántos
    días hábiles se responde, "Registrar otra reclamación" y "Volver a la
    tienda".
- **Privacidad y términos:**
  - El escudo o la hoja en su sello, el título con su trazo y "Última
    actualización: 8 de septiembre de 2026".
  - El índice: en escritorio va fijo al costado mientras se lee; en el
    celular, plegado arriba ("En esta página · 8 secciones"). Cada entrada
    lleva a su sección.
  - Las secciones numeradas en sellos, con párrafos y listas con un punto con
    el degradado del logo. La excepción de devoluciones (7 días) va destacada.
  - "Contacto" termina con la tarjeta de ayuda: Kapi, el correo y "Escribir
    por WhatsApp". Como Kapi ya asoma ahí, el pie no lo repite.
  - Abajo, el enlace al otro documento ("¿Buscabas cómo tratamos tus datos?").

## Llevar a la tienda (a futuro: TODAVÍA NO se hace)

### Reemplazos

| Hoy | Pasa a (kit) |
|---|---|
| `LibroReclamacionesPage` (inputs nativos, 📕, ✅, un solo error arriba) | `PaginaReclamaciones` |
| `PoliticasPrivacidadPage` y `TerminosCondicionesPage` (texto en el JSX, `PoliticasPrivacidad.module.css`) | `PaginaLegal` con su `documento` |

**Lo que no cambia:** el documento que se guarda en `libro_reclamaciones`
(mismos campos, y el admin lo sigue viendo en `/admin/libro-reclamaciones`) y
las rutas, incluida la redirección de `/terminos-condiciones`.

### De dónde sale cada dato

- **`empresa`:** `config/empresa.js` (`razonSocial`, `ruc`,
  `domicilioFiscal`, `email`, `plazoRespuestaDiasHabiles`).
- **`hoy`:** la fecha de Lima en palabras (`limaTodayStr`).
- **`inicial`** (con sesión): `userProfile` → `{ nombre: displayName,
  tipoDocumento, documento: dni, telefono, email }`, con los mismos campos que
  Mi perfil (`perfilDesdeUsuario`). Sin sesión, vacío: la página es pública.
- **`onEnviar(datos)`:** arma el mismo documento de hoy:
  - `codigo` (`WALA-AAAAMMDD-NNNN`), `estado: 'pendiente'` y `proveedor`
    (copia de `empresa`);
  - `consumidor`: `nombre`, `tipoDocumento`, `numeroDocumento: documento`,
    `domicilio`, `telefono`, `email`, `esMenor` y `apoderado`;
  - `bien`: `tipo: tipoBien`, `montoReclamado: monto` y `descripcion`;
  - `reclamo`: `tipo: tipoReclamo`, `detalle` y `pedido`.

  Llama a `createDocument('libro_reclamaciones', …)` y devuelve `{ codigo,
  fecha }`. Si `createDocument` devuelve `error`, lanza un `Error` con un
  mensaje para el cliente, no el de Firebase.
- **`documento`** de privacidad y términos: sacar el texto del JSX a un
  archivo de datos con la forma de `demo/legales.js`: `{ titulo, actualizado,
  secciones: [{ id, titulo, parrafos, lista: [{ etiqueta, texto }],
  destacado, contacto }] }`. Por ejemplo, `src/config/legales.js`, para que
  la tienda y el kit lean el mismo. Así un cambio legal se hace en un solo
  lugar.

### Comportamiento que no se puede perder

- La reclamación se puede presentar sin cuenta. Es la ley, y no cambia con
  "pagar pide cuenta".
- Los datos del proveedor van copiados en cada hoja.
- La nota de INDECOPI y el plazo de respuesta a la vista.
- La traducción: cada párrafo pasa entero por `Texto` (hoy algunos títulos y
  la cláusula partida por el `<strong>` no se traducían).

### Diferencias a propósito (no "corregirlas" al migrar)

- **Errores por campo, todos a la vez**, y el foco en el primero. Hoy sale un
  solo mensaje arriba y hay que adivinar cuál campo es.
- **El documento y el celular se validan** con las reglas de Mi perfil (DNI
  de 8, celular de 9 que empieza con 9). Hoy se acepta cualquier cosa.
- La hoja muestra la fecha. El código se puede copiar.
- "Carnet de extranjería" (como en Mi perfil) en vez de "Carné de
  Extranjería".
- Sin emojis (📕, ✅).
- Privacidad y términos: índice, secciones con ancla, la excepción de
  devoluciones destacada, y el contacto con WhatsApp además del correo, desde
  `empresa` y no escrito a mano. Una sola `<main>`: hoy hay dos anidadas (la
  del marco y la de la página).

### Lo que se encontró de paso (para decidir aparte)

- El código de la hoja (`WALA-AAAAMMDD-NNNN` al azar) se arma en el
  navegador, sin revisar que no se repita. Dos reclamaciones el mismo día
  pueden chocar (1 entre 9000). Si importa, que lo asigne una función con un
  contador.
- No se manda correo: ni al cliente (copia de su hoja) ni a Walá (aviso de una
  reclamación nueva), y la respuesta del admin tampoco le llega al cliente.
- `respuestaProveedor: null`, `apoderado: null` y `montoReclamado: null` no
  se guardan: `createDocument` quita los `null`. El admin ya los trata como
  ausentes.
- El admin no ve el domicilio, si es menor ni el apoderado.

### Pasos

1. Sacar los textos de privacidad y términos a `src/config/legales.js` (sin
   cambiar una palabra) y usar `PaginaLegal` en las dos páginas.
2. `PaginaReclamaciones` en `LibroReclamacionesPage`, con el mismo
   `createDocument`. Comparar en el admin una hoja vieja y una nueva.
3. Decidir aparte el correo de copia y el código con contador.
