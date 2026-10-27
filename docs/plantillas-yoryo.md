# Plantillas de cuadros y mousepads

En **Admin → Catálogo → Plantillas de cuadros y mousepads** (`/admin/plantillas-yoryo`):

1. Elegir producto, plantilla y equipo.
2. Arrastrar elementos en el lienzo o editar centro, ancho/alto máximos, escala y orden. Las coordenadas se guardan entre 0 y 1. Las imágenes mantienen su proporción.
3. Configurar fuente, color, alineación y tamaño del área de cada texto. La letra se reduce automáticamente para caber.
4. Sustituir los recursos PNG cuando sea necesario. Escudo y pincelada requieren transparencia real; se conservan originales y versiones normalizadas en Storage. El escudo usa un lienzo de 1000 × 1400. Solo se recorta alfa cero, sin eliminar blancos ni crema.
5. Usar una foto transparente de prueba y exportar el PNG para revisar el resultado. Los textos y la foto de muestra no se guardan en el preset.
6. Pulsar **Guardar plantilla** para aplicarlo a nuevas personalizaciones. Los borradores guardan una copia de la configuración para reproducir su composición al reabrirlos. Para aplicar el preset actualizado a un borrador, volver a elegir su plantilla.

Cada producto/equipo tiene su propia configuración. El documento `templates/yoryo-composiciones-v4` usa la colección existente con lectura pública y escritura de administradores; no requiere cambiar reglas. No se guardan fotografías de clientes en ese documento.

La plantilla deportiva utiliza siete elementos: fondo, foto, escudo, nombre, frase, pincelada y dedicatoria. Su orden inicial coincide con esa lista. Las otras tres plantillas también permiten mover su decoración y sus ventanas de fotos/textos.

El cuadro exporta 3661 × 2953 px (31 × 25 cm); el mousepad, 2776 × 2303 px (23.5 × 19.5 cm). El PNG incorpora metadatos de 300 ppp y excluye marco, soporte y sombras del mockup. Las medidas confirmadas de la ficha de producto siguen siendo necesarias para que el checkout marque los archivos como listos para producción; para la plantilla deportiva deben coincidir con estas medidas.

Los fondos proporcionados tienen aproximadamente 114 ppp efectivos en el cuadro y 146 ppp en el mousepad. Se informa en el editor: exportar más píxeles no agrega detalle al original.

Los 18 originales proporcionados se conservan en `assets/yoryo-plantillas/originales/`; los normalizados se sirven desde `public/yoryo/capas/equipos/`. El manifiesto registra dimensiones, alfa, procedencia y límites visibles. Para repetir la preparación con Pillow:

```powershell
python scripts/preparar-capas-yoryo.py 'CARPETA_ORIGEN'
```

Verificación: `npm run test:yoryo`, ESLint de los archivos modificados y `npm run build`.
