# Guía de Implementación y Prompt para el Editor

Esta carpeta contiene el núcleo de personalización gráfica (Canvas y áreas de impresión) extraído del proyecto original.

## Estructura Exportada
- `/components/editor`: Lógica principal del canvas (Fabric.js), barra de herramientas, selector de texto, imágenes y propiedades.
- `/components/admin`: Herramientas de administrador para delimitar las áreas de impresión (PrintAreasEditor) y definir las vistas del producto.
- `/contexts`: `EditorContext` (estado del diseño y la variante del producto) y `DesignClipboardContext` (copiar/pegar capas).
- `/utils`: Funciones auxiliares para trabajar con formas (`shapeUtils.js`), colores y recorte de imágenes de fondo.
- `/fabricPatch.js`: Parches vitales para que `fabric.js` maneje correctamente las interacciones modernas.

---

## 🤖 PROMPT PARA LA IA EN EL NUEVO PROYECTO

Puedes copiar el texto que está a continuación y dárselo a tu IA (ChatGPT, Claude, etc.) en tu nuevo proyecto:

> **Rol**: Eres un desarrollador Experto en React y Fabric.js.  
> **Tarea**: Acabo de importar una carpeta llamada `WALA_Editor_Export` a mi nuevo proyecto. Esta carpeta contiene toda la lógica de un editor de personalización de productos basado en Fabric.js (`EditorCanvas`, `AdminViewEditor`, `PrintAreasEditor`) usando contextos globales (`EditorContext`).
> 
> Necesito que me ayudes a integrar estos componentes en este nuevo proyecto siguiendo estas instrucciones:
> 
> 1. **Resolver Dependencias Faltantes**: Revisa los archivos dentro de `components/editor` y `components/admin`. Notarás que intentan importar componentes genéricos desde `../../common/` (como `Button`, `Modal`, `Toggle`, íconos SVG, etc.). Crea un plan para que o bien adaptemos esas rutas a mis propios componentes de UI, o me generes versiones sencillas de esos componentes comunes para que el proyecto compile.
> 
> 2. **Instalar Librerías Externas**: Indícame el comando npm/yarn para instalar las dependencias clave de este editor: `fabric` (versión ^5.3.0), `react-easy-crop`, `react-beautiful-dnd`, `html2canvas`.
> 
> 3. **Montar el Proveedor de Contexto**: Ayúdame a crear una página de prueba (ej. `TestEditor.jsx`) donde envuelvas todo el renderizado con `<EditorProvider>` y `<DesignClipboardProvider>`.
> 
> 4. **Instanciar el Editor**: Dentro de esa página de prueba, renderiza el componente principal de edición y pásale un mock (datos falsos) de un producto que tenga al menos una "vista" y una `printArea` (área de impresión) válida para que el `EditorCanvas` se pueda inicializar correctamente.
> 
> 5. **Reescritura Funcional (Opcional)**: Si notas que la lógica dentro de `EditorContext` está muy acoplada a mi backend anterior (Firebase o manejo de carritos específico), guíame para limpiarla y hacer que el contexto simplemente mantenga el estado de las capas de diseño en memoria de forma agnóstica.

---

## 🛠️ Pasos Manuales de Configuración

Si vas a hacerlo tú mismo, asegúrate de:
1. Copiar esta carpeta en tu nuevo proyecto (ej. dentro de `src/modules/editor` o similar).
2. Ejecutar `npm install fabric@5.3.0 react-easy-crop html2canvas react-beautiful-dnd` en tu nuevo proyecto.
3. Arreglar las rutas de los imports de aquellos componentes compartidos (como `<Button>` y `<Modal>`) que no fueron exportados en esta carpeta pura.
4. Asegurarte de importar `fabricPatch.js` en tu `index.js` o `App.jsx` raíz para que se apliquen los ajustes al canvas.
