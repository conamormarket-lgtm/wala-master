# Refactor: División de `VisualEditorPanel.jsx`

**Estado:** Pendiente · **Rama objetivo:** `dev`  
**Archivo actual:** `src/pages/Tienda/admin/VisualEditorPanel.jsx`  
**Tamaño:** 2,654 líneas · 139 KB  

---

## El problema

`VisualEditorPanel.jsx` es un componente monolítico que contiene **todo el sistema de edición visual in-page**:
- La lógica de arrastre (drag) del panel flotante
- El overview del page builder (lista de secciones)
- Los **18 formularios de edición** de cada tipo de módulo (uno por cada `section.type`)
- Los componentes de control reutilizables (`TextStylesControl`, `BackgroundStylesControl`)

Esto hace que el archivo sea prácticamente imposible de navegar, muy lento de cargar en el IDE, y difícil de depurar cuando falla un módulo específico.

---

## Estructura propuesta

```
src/pages/Tienda/admin/
├── VisualEditorPanel.jsx          ← Orquestador (< 200 líneas)
├── VisualEditorPanel.module.css   ← Sin cambios
│
├── controls/                      ← Controles UI reutilizables
│   ├── TextStylesControl.jsx
│   ├── BackgroundStylesControl.jsx
│   └── index.js
│
└── section-editors/               ← Un archivo por tipo de módulo
    ├── HeroBannerEditor.jsx
    ├── HeaderEditor.jsx
    ├── TextEditor.jsx
    ├── ImageEditor.jsx
    ├── AnnouncementBarEditor.jsx
    ├── TestimonialsEditor.jsx
    ├── FooterColumnsEditor.jsx
    ├── MapLocationEditor.jsx
    ├── VideoEditor.jsx
    ├── MarqueeEditor.jsx
    ├── BestSellersRowEditor.jsx
    ├── FeaturedProductsEditor.jsx
    ├── ProductGridEditor.jsx
    ├── SidebarCatalogEditor.jsx
    ├── CollectionCarouselEditor.jsx
    ├── HeroCarouselEditor.jsx
    ├── FlashSalesEditor.jsx
    ├── TrustBadgesEditor.jsx
    └── index.js                   ← Re-exporta todos como mapa { type: Component }
```

---

## Cómo funcionará el orquestador

El `VisualEditorPanel.jsx` reducido simplemente importa el mapa de editores y despacha por tipo:

```jsx
// section-editors/index.js
import HeroBannerEditor from './HeroBannerEditor';
import AnnouncementBarEditor from './AnnouncementBarEditor';
// ... etc

export const SECTION_EDITORS = {
  hero_banner: HeroBannerEditor,
  announcement_bar: AnnouncementBarEditor,
  testimonials: TestimonialsEditor,
  footer_columns: FooterColumnsEditor,
  // ... todos los tipos
};
```

```jsx
// En VisualEditorPanel.jsx — renderForm()
const renderForm = () => {
  if (!activeSection) return <PageBuilderOverview />;

  const section = storeConfigDraft?.sections?.find(s => s.id === activeSection);
  if (!section) return null;

  const Editor = SECTION_EDITORS[section.type];
  if (!Editor) return <div>Tipo de módulo no reconocido: {section.type}</div>;

  return (
    <Editor
      section={section}
      sectionIndex={dynamicSectionIndex}
      storeConfigDraft={storeConfigDraft}
      updateSectionsDraft={updateSectionsDraft}
      onBack={closeEditor}
    />
  );
};
```

---

## Props estándar de cada Editor

Todos los `section-editors` recibirán la misma interfaz:

```ts
interface SectionEditorProps {
  section: Section;           // La sección activa completa
  sectionIndex: number;       // Índice en el array storeConfigDraft.sections
  storeConfigDraft: StoreConfig;
  updateSectionsDraft: (sections: Section[]) => void;
  onBack: () => void;         // Cierra el editor y vuelve al overview
}
```

---

## Helper para actualizar settings (evitar repetición)

Actualmente cada campo hace:
```js
const newSections = [...storeConfigDraft.sections];
newSections[dynamicSectionIndex].settings.X = value;
updateSectionsDraft(newSections);
```

Crear un hook `useSectionUpdater` para simplificarlo:

```js
// controls/useSectionUpdater.js
export const useSectionUpdater = (sectionIndex, storeConfigDraft, updateSectionsDraft) => {
  const updateField = useCallback((field, value) => {
    const newSections = [...storeConfigDraft.sections];
    newSections[sectionIndex].settings[field] = value;
    updateSectionsDraft(newSections);
  }, [sectionIndex, storeConfigDraft, updateSectionsDraft]);

  return { updateField };
};
```

Uso en cada editor:
```jsx
const { updateField } = useSectionUpdater(sectionIndex, storeConfigDraft, updateSectionsDraft);

<input value={s.title} onChange={e => updateField('title', e.target.value)} />
```

---

## Componentes a extraer a `controls/`

| Componente | Descripción | Líneas aprox. actuales |
|---|---|---|
| `TextStylesControl` | Tipografía, tamaño, alineación, transformación | ~50 |
| `BackgroundStylesControl` | Color sólido, imagen, gradiente, overlay, blur | ~70 |
| `ColorField` | Input color + label reutilizable | ~15 |
| `PaddingControl` | Padding top/bottom | ~25 |

---

## Orden de extracción recomendado

Hacer el refactor en PRs pequeños para no romper nada:

1. **PR 1** — Extraer `controls/` (`TextStylesControl`, `BackgroundStylesControl`) sin cambiar la lógica del panel
2. **PR 2** — Crear `section-editors/` y migrar los 3 módulos más simples: `header`, `text`, `image`
3. **PR 3** — Migrar módulos con listas dinámicas: `announcement_bar`, `testimonials`, `footer_columns`, `marquee`, `trust_badges`, `hero_carousel`
4. **PR 4** — Migrar módulos de productos: `bestsellers_row`, `featured_products`, `product_grid`, `sidebar_catalog`, `collection_carousel`, `flash_sales`
5. **PR 5** — Migrar módulos restantes: `hero_banner`, `video`, `map_location` + reducir orquestador
6. **PR 6** — Extraer `PageBuilderOverview` a su propio componente

---

## Beneficios esperados

| Métrica | Antes | Después |
|---|---|---|
| Líneas en el archivo principal | 2,654 | ~200 |
| Tiempo de búsqueda de un módulo | ~2 min | ~5 seg |
| Riesgo de romper otro módulo al editar uno | Alto | Ninguno |
| Posibilidad de lazy-load por editor | ❌ | ✅ |
| Testabilidad | Muy baja | Alta |
