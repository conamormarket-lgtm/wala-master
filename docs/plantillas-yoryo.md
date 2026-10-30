# Cuadros, mousepads y tomatodos en Crear

Desde el 28-10-2026 se diseñan en el mismo estudio que las prendas (`/crear/:id`). El personalizador aparte de octubre (plantillas por formulario, `/admin/plantillas-yoryo` como editor) se quitó.

## Un producto, una ficha (desde el 28-10-2026)

Todo se administra en **Admin → Productos**, con chips **Tienda · Personalizables · Packs de Crear · Todos**. **Nuevo** ofrece: producto de la tienda, personalizable o pack de Crear. Las direcciones viejas (`/admin/prendas-crear`, `/admin/combos-crear`) llevan ahí.

La ficha de un personalizable va en pestañas:

- **General:** nombre, precio, marca, categoría, etiquetas, destacado.
- **Colores y fotos:** las variantes (nombre, color, tallas, galería) y, por color, su **foto de tienda** (subida o hecha **Con una plantilla**) y sus **fotos para diseñar** (teñidas, propias, bicolor e invertido).
- **Diseño:** qué se personaliza, vistas, zonas, borde encima y zonas de los bicolores.
- **Plantillas:** se guardan al momento. **Nueva plantilla** abre el estudio y vuelve a la ficha al guardar; **Editar**; **Traer de otro producto** (copia sus imágenes y las pasa a la zona igual o parecida).
- **Dónde se ve:** **Publicada en Crear** y **También en la tienda** (`enTienda`).

Con **También en la tienda**, sale en la tienda y en la página de su marca con el botón **Personalízalo** (al estudio, en el color elegido). Nunca se vende en blanco: el servidor rechaza una prenda de Crear sin diseño (`functions/cartValidation.js`). Un pack de Crear tiene lo mismo en su formulario, más marca y portada.

Un producto de la tienda oculto que tenga **Personalizar en Crear** lleva a ese personalizable al abrir su enlace.

## Cómo se arma un producto

En **Admin → Productos → Nuevo → Personalizable**:

1. Crear la prenda: nombre, precio y sus colores (variantes, sin tallas).
2. En **Qué se personaliza** (pestaña Diseño):
   - **Tipo: Producto.** El estudio y la grilla dicen "producto" en vez de "prenda".
   - **Técnica: Grabado láser** solo para el tomatodo. El diseño se ve en un solo tono y el taller recibe el PNG en escala de grises.
3. Subir la foto de cada color en **Colores y tallas**. Un producto no se tiñe bien.
4. Marcar la zona y la línea de referencia con el ancho útil real en cm:
   - cuadro: 31 × 25 cm;
   - mousepad: 23.5 × 19.5 cm;
   - tomatodo: la medida del taller.

   Así el PNG sale a tamaño real a 300 ppp.

El **Pack de oficina** es un pack normal en **Admin → Productos → Packs de Crear**.

Para que un producto que se vende **tal cual** también lleve a Crear, se elige la prenda o el combo en **Personalizar en Crear** (pestaña Dónde se ve). Si solo se vende personalizado, no hace falta: el personalizable sale en la tienda con **También en la tienda**.

## Plantillas del producto

Cada producto de Crear puede traer sus plantillas en `prendaBase.plantillas` (`{ id, nombre, grupo, imagen, capas }`). El estudio las muestra en el paso **Empieza con un diseño**:

- son de ese producto: no van a la comunidad ni a Mis creaciones;
- si hay grupos (Parejas, Equipos), se muestran como pestañas;
- cada tarjeta muestra el diseño plano. En un producto láser se ve sobre el producto, recortado alrededor del grabado.

El cliente elige una y la cambia como quiera:

- **Cambiar foto** pone su foto en la ventana de la plantilla. La foto tiene una `ventana`: se mueve y agranda por dentro, pero no se sale del marco (`recorteDeCapa` en `renderDiseno.js`).
- Los textos se editan tocándolos.
- Las capas marcadas como **Parte fija de la plantilla** (fondo, marco) no se mueven sin querer. El cliente las suelta con **Editar el fondo y el marco**.

Las imágenes de las plantillas viven en `productos_v2/{id}/plantillas/`, así la limpieza de creaciones no las toca.

**Agregar una:** un admin la diseña en el estudio y usa **Guardar como plantilla**, debajo de los pasos.

**Solo con plantillas** (`prendaBase.soloPlantillas`, en el admin del producto; el tomatodo lo trae):

- un diseño nuevo empieza ya con la primera plantilla;
- el cliente cambia de plantilla y edita sus textos;
- no sube imágenes, no agrega textos ni mueve el diseño.

**El mismo diseño en otro producto:** en los productos impresos de una sola zona (cuadro y mousepad), con un diseño en el lienzo aparece **Llevarlo al …**. El diseño se abre en el otro producto, acomodado en su zona, como borrador de la pestaña. En un combo, primero se usa en esta pieza y después se abre la otra.

**Ida y vuelta:** al volver al producto del que vino el diseño, se abre esa misma creación con lo traído encima. No se crea otra.

**Esquinas redondeadas** (`zona.radio`, "Esquinas %" en las zonas del admin): lo que sale de la esquina no se ve. El mousepad trae 6.5 %.

**Foto de muestra** (`muestra` en la capa, o `_tu-foto` en el archivo): al tocarla, el panel ofrece **Pon tu foto aquí**.

**Textos de plantilla:** guardan su ancho (`anchoMax`). Si se escribe algo largo, la letra se achica; si después se acorta, vuelve a su tamaño (`escalaBase`).

**Borde encima** (`vista.encima`): un PNG con lo oscuro de la foto (el borde cosido del mousepad) que se dibuja sobre el diseño en el estudio y en las vistas previas. Así se nota la orilla aunque el diseño llegue hasta ella.

**Renombrar, cambiar de grupo o quitar:** en la pestaña Plantillas de su ficha.

**Cambiar una plantilla:** en esa pestaña, **Editar** la abre (`/crear/:id?editarPlantilla=…`) con el estudio completo, aun en productos "solo con plantillas". **Guardar cambios en esta plantilla** la reemplaza en su mismo lugar. También, si un admin parte de una plantilla en el estudio, puede guardar sus cambios en ella o guardarla como nueva.

## Crear los productos (una sola vez)

En **Admin → Catálogo → Importar plantillas de cuadros** (`/admin/plantillas-yoryo`), el botón **Crear productos y pack**:

- crea `yoryo-crear-cuadro`, `yoryo-crear-mousepad` y `yoryo-crear-tomatodo` con la foto de la tienda sin fondo y recortada;
- crea el Pack de oficina como combo de Crear;
- enlaza los productos de la tienda con "Personalizar en Crear".

Lo que ya exista no se repite. La única excepción es la zona del tomatodo, que se agranda si sigue como la dejó la primera versión. Las zonas se midieron sobre las fotos de la tienda del 28-10-2026. El tomatodo queda con unos 10 cm de cuerpo estimados: se confirma con el taller y se ajusta en Prendas de Crear.

## Guardar las plantillas anteriores (una sola vez)

**Guardar plantillas en los productos** convierte las plantillas de GPT:

- cuadro y mousepad: 3 de Parejas y 6 de Equipos;
- tomatodo: 6 de Equipos, con los escudos SVG de `public/yoryo/laser/` pintados en blanco.

Usa las ediciones de la pantalla anterior si las hay (`templates/yoryo-composiciones-v4`). Volver a guardarlas reemplaza las mismas, por id. El tamaño de las letras es aproximado.

**Quitar copias** retira de la comunidad y borra de Mis creaciones lo que publicó la primera versión de esta pantalla.

## Pasarlos a la tienda (una sola vez)

**Pasar a la tienda** (paso 4 de la misma pantalla, después de los pasos 1 y 2):

- el cuadro, el mousepad y el tomatodo de Crear quedan con **También en la tienda**, y copian del producto de la tienda sus fotos por color, su descripción, su categoría, sus colecciones y sus etiquetas;
- el Pack de oficina igual, con su portada y la foto de cada pieza;
- los cuatro productos de la tienda de antes se ocultan; sus enlaces llevan a los nuevos.

Después de guardar, `public/yoryo/` y `src/pages/admin/plantillasYoryo/` se pueden borrar. Los originales siguen en `assets/yoryo-plantillas/`.

## Lo ya guardado con el editor anterior

- **Carrito:** las líneas con `datosYoryo` piden volver a crearlas en Crear y no dejan pagar.
- **Pedidos hechos:** conservan sus archivos (`designs.js` → `urlsDeDiseno` los protege de la limpieza).

## Billetera y esclava grabadas (29-10-2026)

La billetera Cónsul y la esclava se venden **tal cual** en la tienda y también **grabadas con láser** en Crear, al mismo precio. El botón **Personalizar** del producto de la tienda lleva a la versión grabada, en el color elegido (los colores de las dos versiones usan los mismos ids).

En **Admin → Catálogo → Importar plantillas de cuadros**, paso 6, **Crear billetera, esclava y packs** (una vez; volver a correrlo rehace las plantillas y las fotos sin duplicar nada):

- crea `yoryo-crear-billetera` (cara lisa, grabado abajo a la derecha) y `yoryo-crear-esclava` (la placa), solo con plantillas: iniciales o nombre con flecha, infinito, estrella, corazón, rayo o montaña, con fecha, solo el texto o en letra escrita (Crimson Pro y Back to Black);
- pone en cada color la foto de la tarjeta ya grabada y la galería: el frente con cierre y las fotos de la tienda. El frente con cierre también se agrega a la billetera de la tienda;
- deja la esclava de la tienda a la vista (antes solo iba en los combos);
- arma los combos Ónix, Oro y Medianoche como packs de Crear: el reloj **tal cual** en su color (pieza fija) y la billetera y la esclava para grabar, al precio del combo. El botón **Personalizar** de cada combo de la tienda lleva a su pack.

La tarjeta de la billetera en Crear va de frente (con el cierre) gracias a **Portada en Crear: la foto de tienda** (pestaña Diseño, junto a *Solo con sus plantillas*); al pasar el mouse se ve la cara lisa. Volver a correr el paso pone las fotos para diseñar transparentes si el producto tenía las de antes (`prendaBase.versionFotos`), con sus zonas y sin tocar los cm.

Las fotos para diseñar y los símbolos están en `public/yoryo/grabados/` y se pueden borrar después de correrlo. **Las medidas en cm son estimadas** (cara de la billetera 9 cm, placa 4.5 cm): cuando el taller las confirme, se corrigen en la ficha de cada uno, pestaña Diseño, con la línea de referencia.

## Una sola ficha: tal cual y personalizado (30-10-2026)

Un personalizable puede venderse **también sin personalizar**: en su ficha, pestaña **Dónde se ve**, con **También en la tienda** prendido aparece **También se vende sin personalizar** (`seVendeTalCual`). La página de la tienda muestra entonces **Agregar al carrito** (tal cual, al precio y con el stock de la ficha) y **Personalízalo**. El servidor acepta la compra sin diseño solo con ese interruptor (`functions/cartValidation.js`).

La billetera Cónsul y la esclava son así desde el paso 6: una sola ficha (la de Crear) con el nombre, la descripción, el precio, el stock y la categoría de la tienda. La ficha de tienda de antes lleva `reemplazadoPor`: la web no la muestra y su enlace lleva a la nueva, pero sigue visible para la **app de Android** (que todavía no muestra personalizables) y para los combos de la tienda que la usan como pieza. Ojo: mientras tanto hay dos stocks, el de la ficha nueva (web) y el de la vieja (app y combos).

El tomatodo se vende tal cual prendiendo ese mismo interruptor en su ficha.
