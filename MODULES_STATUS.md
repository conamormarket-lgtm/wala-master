# Estado de los Módulos del Landing Page Builder (Wala)

El sistema de la tienda cuenta actualmente con **19 tipos de módulos** (`SECTION_TYPES`) que se pueden insertar en las landing pages. A continuación se detalla cuáles están completamente integrados con opciones de personalización avanzada en el panel de administrador, cuáles son funcionales en su versión básica, y cuáles requieren desarrollo adicional para darles total libertad.

## 🟢 Completados con Funcionalidades Avanzadas (Libertad Total)
Estos módulos tienen componentes dedicados y un formulario de edición visual que permite cambiar textos, colores, alineaciones y/o espaciados directamente desde el panel sin tocar código.

1. **Banner Principal (`hero_banner`)**: Completo. Permite cambiar imagen/video, opacidad del fondo oscuro, textos, enlaces, y todos los colores (textos y botones), además de la altura.
2. **Encabezado (`header`)**: Completo. Permite título, subtítulo, alineación, color de fondo, colores de texto y márgenes (paddings).
3. **Texto (`text`)**: Completo. Editor completo de estilos (fondo, color texto/título, alineación, ancho máximo, padding).
4. **Imagen (`image`)**: Completo. Soporta URL, alt, enlace, radio de borde (circular/redondeado), alineación y ancho máximo.
5. **Barra de Anuncios (`announcement_bar`)**: Completo. Soporta colores, velocidad de animación, múltiples mensajes con opciones de tipografía, tamaño, negrita y cursiva.
6. **Testimonios / Opiniones (`testimonials`)**: Completo. Permite añadir dinámicamente testimonios, autor, texto y calificación de estrellas.
7. **Pie de Página (`footer_columns`)**: Completo. Permite configurar columnas de texto libre o listas de enlaces personalizados con colores.
8. **Ubicación / Mapa (`map_location`)**: Completo. Permite pegar el código embebido de Google Maps y ajustar títulos y descripciones.
9. **Video (`video`)**: Completo. Adapta automáticamente YouTube o MP4 nativo en formatos 16:9, 9:16 y 1:1. Ahora incluye opciones para ajustar el color de fondo y el padding superior/inferior.
10. **Carrusel de Logos / Marcas (`marquee`)**: Completo. Tiene editor para las imágenes, velocidad de animación, y soporte de diseño dinámico (fondo y separación/paddings).
11. **Lo Más Vendido (`bestsellers_row`)**: Completo. Tiene editor para cambiar las tarjetas mostradas y opciones visuales generales del contenedor (fondo y paddings).
12. **Productos Destacados (`featured_products`)**: Completo. Permite cambiar el título, el color de fondo y el padding superior e inferior.
13. **Grid de Productos Simple (`product_grid`)**: Completo. Permite cambiar el título, el color de fondo y el padding superior e inferior.
14. **Catálogo con Sidebar (`sidebar_catalog`)**: Completo. Permite cambiar el título, el color de fondo y el padding superior e inferior.
15. **Carrusel de Colección (`collection_carousel`)**: Completo. Ahora permite elegir dinámicamente la categoría/colección desde la interfaz visual y soporta fondos/paddings.
16. **Carrusel Principal / Slider (`hero_carousel`)**: Completo. Formulario dinámico avanzado habilitado para añadir slides, enlaces y cambiar velocidad.
17. **Ofertas Flash (`flash_sales`)**: Completo. Incluye selector visual de fecha de término, selector de colección y estilos dinámicos.
18. **Íconos de Confianza (`trust_badges`)**: Completo. Cuenta con un editor específico para añadir, editar o eliminar íconos con sus textos y estilos visuales.

## 🟡 Funcionales pero Básicos (Pueden mejorarse)
Estos módulos tienen su propio formulario en el editor, pero sus opciones se centran más en la funcionalidad (URLs, configuraciones básicas) y no tanto en el diseño avanzado (paddings, colores de fondo o bordes).
*(Actualmente no hay módulos en este estado. Los anteriores han sido promovidos a Completados).*

## 🔴 Pendientes / Solo Título (TODO)
*(Actualmente no hay módulos en este estado. Todos los módulos genéricos han sido promovidos a Completados).*

## ⚫ Obsoletos / Estructurales
19. **Navegación por Categorías (`categories_nav`)**: Este módulo ha sido movido a la cabecera global (`LegacyTiendaPage`) y ya no se usa como una sección dinámica libre.

---
*Documento generado para mapear el progreso de refactorización de la UI del Admin.*
