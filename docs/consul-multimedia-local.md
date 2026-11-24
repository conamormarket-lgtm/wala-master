# Yoryo Cónsul: propuesta multimedia local

Rama: `codex/consul-multimedia-local`. La vista previa sigue aislada de Firestore y Storage; la publicación se realiza con el procedimiento explícito del final.

## Abrir

Desde este checkout:

```powershell
npm run dev -- --host 127.0.0.1 --port 5188 --strictPort
```

Vista: `http://127.0.0.1:5188/producto-preview.html?producto=yoryo-crear-billetera`.

La entrada de desarrollo usa la ficha de la tienda y los editores de Walá. El carrito y la navegación al personalizador son simulados; esta página no genera pedidos ni pagos.

## Contenido y edición

La propuesta inicial vive en `src/componentes/demo/consulLanding.mjs`, con el mismo esquema de producto y `detailComposition` que guarda Walá.

- Galería: 44 fotos distribuidas en Deep Blue (15), Marrón Coñac (15) y Negro Azabache (14); cinco vídeos, asignados por color (2/2/1), intercalados entre las fotos.
- Detalles: nueve clips cortos, mosaico de tres fotos, presentación para regalo y dos imágenes para explicar la personalización. Son seis imágenes compartidas y tres alternativas verticales para móvil: 53 imágenes en total, más 14 vídeos y sus portadas.
- El vídeo flotante reutiliza un clip del carrusel.
- El concepto de personalización generado con IA está identificado como referencial. No es una muestra de grabado fabricado.

En **Probar formulario de producto**, las pestañas permiten editar fotos por color, vídeos de galería y ficha de venta. Los vídeos tienen color, posición entre fotos, portada y opciones de reproducción. Cada medio de los bloques conserva sus controles de proporción, ajuste, tamaño y orden; las imágenes admiten una alternativa móvil hasta 620 px. La vista móvil del editor también muestra esa alternativa.

Los cambios se guardan en IndexedDB del navegador bajo `yoryo-crear-billetera-multimedia-v1`. Este borrador está separado del anterior. El editor de composición integrado en la página guarda en el mismo borrador. Las rutas locales solo se aceptan con `allowLocal: true` y no pasan la validación de producción.

## Archivos

Originales y manifiestos: `output/imagegen/yoryo-consul-20261123/lote-completo`.

Preparados: `output/product-media/consul`. Son archivos locales ignorados por Git, fuera de `public/`, por lo que no entran en el build de publicación. El script `python scripts/prepare-consul-media.py` usa Pillow e imageio-ffmpeg para preparar WebP y MP4 H.264 sin audio, con inicio rápido. El lote preparado pesa aproximadamente 47,5 MB, sin contar las portadas. Las imágenes usan carga diferida y los vídeos automáticos se pausan fuera de pantalla.

## Validación

```powershell
node --test scripts/test/productVideos.test.mjs scripts/test/productDetails.test.mjs scripts/test/productMosaic.test.mjs scripts/test/detailVideoPreview.test.mjs scripts/test/detailVideoPlayback.test.mjs scripts/test/consulLanding.test.mjs src/componentes/kit/adaptadoresAdmin.test.mjs
npx vite build --mode preview
```

Verificado en escritorio de 1440 × 1000 y móvil de 390 × 844: cambio de color, posición y portada del vídeo, proporción por archivo, alternativas móviles, guardado tras recargar y ausencia de desbordamiento horizontal. Los 14 MP4 preparados se decodificaron completos sin errores.

## Información y garantía

Junto a la compra aparecen tres desplegables: características, garantía y cambios, y tiempo de entrega. Sus títulos, texto, características y enlace se editan en **Ficha de venta → Información de venta**. Una sección sin contenido se oculta. La configuración existente se conserva y las características dejan de repetirse debajo de la galería.

La billetera usa la política vigente de Walá: avisar dentro de los 7 días si llega defectuosa, dañada o con estampado claramente distinto del aprobado, para gestionar reemplazo o reembolso. No se copian los 90 días ni los plazos de Novaris. Los tiempos se consultan al comprar. Fuente: `src/config/legales/terminos.js`.

## Publicación autorizada

`node scripts/publish-consul-landing.mjs` prepara un informe y respaldo sin escribir en la nube. `--apply` sube 81 archivos (53 fotos, 14 vídeos y 14 portadas), verifica sus URLs públicas y publica solo los campos de contenido de `productos_wala/yoryo-crear-billetera`.

Los medios quedan bajo `products/yoryo-crear-billetera/landing/<hash>/` en el bucket del proyecto `sistema-gestion-3b225`. El script usa la sesión existente de Firebase CLI, conserva los tipos de los campos originales de variantes y exige que el documento no haya cambiado durante la subida. No cambia precios, stock, plantillas, reglas ni funciones. Los respaldos y el manifiesto se guardan en `output/product-media/consul-release/`, ignorado por Git.

El frontend se publica con la integración GitHub → Vercel de `conamormarket-lgtm/wala-master`, rama de producción `master`. La asociación local de `.vercel` apunta a un proyecto anterior: no se utiliza para este despliegue.
