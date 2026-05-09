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

## 🟡 Funcionales pero Básicos (Pueden mejorarse)
Estos módulos tienen su propio formulario en el editor, pero sus opciones se centran más en la funcionalidad (URLs, configuraciones básicas) y no tanto en el diseño avanzado (paddings, colores de fondo o bordes).

9. **Video (`video`)**: Funcional. Adapta automáticamente YouTube o MP4 nativo, permite elegir formato (16:9, 9:16, 1:1). *Podría pulirse añadiendo opciones de padding y color de fondo.*
10. **Carrusel de Logos / Marcas (`marquee`)**: Funcional. Tiene editor para las imágenes, pero no para estilos de fondo o separación.
11. **Lo Más Vendido (`bestsellers_row`)**: Funcional. Tiene editor para cambiar las tarjetas mostradas, pero no opciones visuales generales del contenedor.

## 🔴 Pendientes / Solo Título (TODO)
Estos módulos actualmente caen en el **editor genérico** del panel de administración. Solo te permiten cambiar el "Título" general de la sección, y el resto de su contenido depende puramente de la base de datos (productos reales) o configuraciones internas. Para darles "total libertad" requerirían formularios de edición específicos.

12. **Productos Destacados (`featured_products`)**: Editor genérico.
13. **Grid de Productos Simple (`product_grid`)**: Editor genérico.
14. **Catálogo con Sidebar (`sidebar_catalog`)**: Editor genérico.
15. **Carrusel de Colección (`collection_carousel`)**: Editor genérico. No permite elegir dinámicamente la categoría/colección desde la interfaz visual todavía.
16. **Carrusel Principal / Slider (`hero_carousel`)**: Editor genérico. (Aunque existe el componente, no vi su formulario dinámico avanzado habilitado).
17. **Ofertas Flash (`flash_sales`)**: Editor genérico. Falta selector visual de fecha de término y colores de temporizador.
18. **Íconos de Confianza (`trust_badges`)**: Editor genérico.

## ⚫ Obsoletos / Estructurales
19. **Navegación por Categorías (`categories_nav`)**: Este módulo ha sido movido a la cabecera global (`LegacyTiendaPage`) y ya no se usa como una sección dinámica libre.

---
*Documento generado para mapear el progreso de refactorización de la UI del Admin.*
