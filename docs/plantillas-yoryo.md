# Plantillas de cuadros y mousepads

En **Admin → Catálogo → Plantillas de cuadros y mousepads** (`/admin/plantillas-yoryo`):

1. Elegir producto, plantilla y equipo.
2. Arrastrar elementos en el lienzo o editar centro, ancho/alto máximos, escala y orden. Las coordenadas son proporciones del lienzo; admiten valores negativos y mayores que 1 para colocar elementos fuera. El área exterior se muestra con una cuadrícula y el archivo exportado se recorta al lienzo. Las imágenes mantienen su proporción.
3. Configurar fuente, color, alineación, mayúsculas, tamaño máximo, espaciado, contorno y sombra de cada texto. La sombra permite editar color, opacidad, desplazamiento y difuminado. La letra se reduce automáticamente para caber. Cada equipo incluye una referencia visual y un botón para aplicar su estilo aproximado con las fuentes disponibles.
4. Sustituir los recursos PNG cuando sea necesario. Escudo y pincelada requieren transparencia real; se conservan originales y versiones normalizadas en Storage. El escudo usa un lienzo de 1000 × 1400. Solo se recorta alfa cero, sin eliminar blancos ni crema.
5. Usar una foto transparente de prueba y exportar el PNG para revisar el resultado. Los textos y la foto de muestra no se guardan en el preset.
6. Pulsar **Guardar plantilla** para aplicarlo a nuevas personalizaciones. Los borradores guardan una copia de la configuración para reproducir su composición al reabrirlos. Para aplicar el preset actualizado a un borrador, volver a elegir su plantilla.

Cada producto/equipo tiene su propia configuración. El documento `templates/yoryo-composiciones-v4` usa la colección existente con lectura pública y escritura de administradores; no requiere cambiar reglas. No se guardan fotografías de clientes en ese documento.

La edición de estructura y de estilo pertenece exclusivamente a esta pantalla administrativa. El cliente no ve controles del fondo, escudo, pincelada ni decoración, y no puede cambiar la posición o el estilo de los textos. Se ignoran también ajustes antiguos de esas capas en el motor de composición. El cliente edita el contenido y carga/recorta sus fotos; en deportivos puede mover y escalar su foto. En parejas las ventanas fotográficas mantienen la ubicación definida por el administrador.

La plantilla deportiva utiliza siete elementos: fondo, foto, escudo, nombre, frase, pincelada y dedicatoria. Su orden inicial coincide con esa lista. Las otras tres plantillas también permiten mover su decoración y sus ventanas de fotos/textos.

El cuadro exporta 3661 × 2953 px (31 × 25 cm); el mousepad, 2776 × 2303 px (23.5 × 19.5 cm). El PNG incorpora metadatos de 300 ppp y excluye marco, soporte y sombras del mockup. Las medidas confirmadas de la ficha de producto siguen siendo necesarias para que el checkout marque los archivos como listos para producción; para la plantilla deportiva deben coincidir con estas medidas.

Los fondos proporcionados tienen aproximadamente 114 ppp efectivos en el cuadro y 146 ppp en el mousepad. Se informa en el editor: exportar más píxeles no agrega detalle al original.

Los 18 originales proporcionados se conservan en `assets/yoryo-plantillas/originales/`; los normalizados se sirven desde `public/yoryo/capas/equipos/`. El manifiesto registra dimensiones, alfa, procedencia y límites visibles. Para repetir la preparación con Pillow:

```powershell
python scripts/preparar-capas-yoryo.py 'CARPETA_ORIGEN'
```

Las tres decoraciones nuevas de parejas mantienen sus originales en `assets/yoryo-plantillas/parejas-originales/` y sus PNG de uso en `public/yoryo/capas/parejas/`. Las seis portadas deportivas se utilizan exclusivamente como referencias del admin en `public/yoryo/referencias/`; nunca se incluyen en la impresión. Para importar la carpeta que las contiene:

```powershell
python scripts/preparar-parejas-yoryo.py 'CARPETA_OTROS'
```

Verificación: `npm run test:yoryo`, ESLint de los archivos modificados y `npm run build`.
