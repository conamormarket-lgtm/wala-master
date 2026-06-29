# Modo Noche — tema claro / oscuro / sistema

> Tema visual claro/oscuro para **toda la web pública y el admin** de WALA, con un
> **interruptor luna/sol** en el Header. Desplegado el **2026-06-29** (commit base `a442251`
> + 2º pase de contraste y arrastre sin parpadeo `649a42e`), **frontend por Vercel**;
> **NO requiere backend** (es solo CSS + estado de cliente).
>
> Fuente: lectura directa del código (`src/contexts/ThemeContext.jsx`,
> `src/components/common/ThemeToggle/ThemeToggle.jsx`, `src/components/common/Header/Header.jsx`,
> `index.html`, `src/styles/variables.css` + `src/styles/globals.css` + los `.module.css` con overrides).
>
> **No toca** carrito, precios, cobro ni datos: es puramente presentación.

---

## 1. Qué hace (de un vistazo)

- El visitante elige entre **tres modos de intención**: **claro**, **oscuro** o **seguir al
  sistema** (`system`, el **default**).
- En modo `system` el tema sigue el `prefers-color-scheme` del navegador/SO y **se re-evalúa
  en vivo** si el visitante cambia el modo de su sistema operativo.
- La elección se **recuerda** entre visitas (`localStorage`, clave **`wala-theme`**).
- Se aplica a **toda la página** (tienda, cuenta, header/footer/nav y admin) fijando
  `data-theme="dark"`/`"light"` en `<html>`.
- **Sin parpadeo** al cargar (anti-FOUC): un script en `index.html` fija el tema **antes** de
  React/CSS.
- **Respeta los `backgroundColor` inline** que el admin haya configurado en cada sección (no
  usa `!important`) y garantiza **contraste**: fondo oscuro → texto claro.

---

## 2. Cómo funciona

### 2.1 Motor del tema — `ThemeProvider`

`src/contexts/ThemeContext.jsx` distingue dos cosas:

```
  mode  = "system" | "light" | "dark"   ← lo que ELIGE el visitante (se persiste)
  theme = "light"  | "dark"             ← lo que se APLICA realmente
```

- `mode = "system"` ⇒ `theme` se resuelve con `prefers-color-scheme` y se actualiza en vivo
  (escucha `matchMedia('(prefers-color-scheme: dark)')`).
- `mode = "light" | "dark"` ⇒ elección fija; ignora el sistema.
- Persistencia: `localStorage["wala-theme"]` (= `mode`). Si nunca eligió nada, queda `system`.
- Aplicación: `document.documentElement.setAttribute('data-theme', theme)`.
- Hook de consumo: `useTheme()` → `{ theme, mode, toggle(), setMode() }` (con fallback
  defensivo si se usa fuera del Provider, para no romper la app).

### 2.2 Interruptor luna/sol — `ThemeToggle`

`src/components/common/ThemeToggle/` es un **botón accesible** (`aria-label`, `aria-pressed`)
montado en el **Header** (`src/components/common/Header/Header.jsx`, mismo nodo sirve para
desktop y móvil):

- En tema **claro** muestra la **luna** (acción: ir a oscuro); en **oscuro**, el **sol**.
- El primer clic siempre **invierte lo que el visitante ve** (aunque venga de `system`) y fija
  una elección (`toggle()`).

### 2.3 Anti-FOUC — script en `index.html`

Un script inline en `index.html` fija `data-theme` en `<html>` **antes** de cargar React/CSS,
leyendo la misma clave `wala-theme` (si es `system`/ausente, usa `prefers-color-scheme`). Así la
página **no parpadea** del claro al oscuro al cargar. **Debe coincidir** con `ThemeContext`
(misma clave, misma lógica de resolución).

### 2.4 Paleta y overrides por componente

La paleta vive en **dos archivos** que trabajan juntos (orden lógico: tokens → red de legibilidad):

- **Tokens de tema + red de re-mapeo — `src/styles/variables.css`:**
  - En `:root` se definen **tokens semánticos de tema** (`--color-bg`, `--color-surface`,
    `--color-surface-2`, `--color-text`, `--color-text-muted`, `--color-border`, `--color-hover`,
    `--color-shadow`) que en claro valen **lo mismo** que el aspecto actual (no cambia nada hoy).
  - En `[data-theme="dark"]` esos tokens se **redefinen** a la paleta oscura de Walá (un
    **slate-violeta profundo**, coherente con `--surface-dark` de `src/theme/tokens.css` y el footer:
    `--color-bg:#14121C`, `--color-surface:#1E1B2E`, texto `#F1EEF9`…), **no** gris carbón.
  - Bajo `dark` se **remapea la paleta HEREDADA** (`--gris-fondo`, `--gris-texto-principal`,
    `--gris-borde`, `--blanco`, acento `--primary-*`/`--rojo-*`, sombras) a esos tokens oscuros. Como
    **casi toda la app** ya consume esas variables, al voltearlas aquí la UI se oscurece **automáticamente**
    sin tocar componente por componente. Esta es la **red de oscurecimiento por variables**.
- **Red global de legibilidad — `src/styles/globals.css`:** bajo `[data-theme="dark"]`, da un **fondo
  oscuro por defecto** al lienzo (`body`, `#root`, `.App`, `#main-content-area`) y a los patrones de
  superficie más comunes (`[class*="card"]`, `panel`, `modal`, `popup`, `dropdown`, `container`…, que
  matchean también los hashes de CSS Modules) y baja el color de texto para garantizar contraste.
  Funciona **junto** al re-mapeo de variables.
- **Overrides finos por componente:** reglas `:global([data-theme='dark'])` en **~95 `.module.css`**
  (storefront, cuenta, header/footer/nav, componentes UI Glass* y todo el admin) para los casos que las
  redes globales no cubren.
- **Sin `!important`:** los `backgroundColor` que el admin configura **inline** (`style={{ backgroundColor }}`)
  en sus secciones **ganan** sobre el tema (el inline siempre vence a una clase sin `!important`), así se
  respeta el diseño del dueño; solo se da fondo oscuro **donde NO hay uno inline**.
- **Contraste:** fondo oscuro → texto claro en toda la página.

### 2.5 Dos pases de contraste

El modo noche se afinó en **dos rondas**:

1. **1er pase (`a442251`):** redes globales (variables + legibilidad) + los overrides iniciales por
   componente.
2. **2º pase (`649a42e`):** ronda **extra** de overrides `[data-theme="dark"]` sobre los componentes que
   aún quedaban con **bajo contraste** tras el primero, para garantizar **fondo oscuro → texto claro**
   legible en toda la página.

### 2.6 Arrastre del registro de regalos reescrito (compatible con el tema)

En el mismo commit del 2º pase (`649a42e`) se **reescribió el arrastre** de las tarjetas del registro de
regalos (`/regalar`) sobre **Pointer Events** (hook `useGiftDrag` **dentro** de
`src/pages/GiftRegistry/GiftRegistryPage.jsx`) con un **clon visual (ghost)** anclado al puntero; la `<img>`
lleva `draggable={false}` + `-webkit-user-drag:none` para **matar el drag nativo** del navegador (la imagen
fantasma con URL / cursor "denegado"). La tarjeta origen **nunca se desmonta ni cambia de key**, así no hay
parpadeo del `transform`. No es estrictamente "modo noche", pero entró en la misma tanda de pulido visual;
detalle funcional en [FUNCIONES-CLIENTE.md §7.4-bis](./FUNCIONES-CLIENTE.md) y
[PLAN-FECHAS-ESPECIALES.md](./PLAN-FECHAS-ESPECIALES.md).

---

## 3. Referencias de archivos

| Archivo | Rol |
|---|---|
| `src/contexts/ThemeContext.jsx` | `ThemeProvider` + `useTheme()`: modos `light/dark/system`, persistencia `wala-theme`, aplica `data-theme`. |
| `src/components/common/ThemeToggle/ThemeToggle.jsx` | Interruptor luna/sol (botón accesible, iconos `lucide-react` Moon/Sun) que llama `toggle()`. |
| `src/components/common/Header/Header.jsx` | Monta el `ThemeToggle` en la cabecera (un solo nodo sirve desktop y móvil). |
| `index.html` | Script anti-FOUC: fija `data-theme` antes de React/CSS. |
| `src/styles/variables.css` | Tokens semánticos de tema (`:root`) + redefinición `[data-theme="dark"]` + red de re-mapeo de la paleta heredada (`--gris-*`/`--blanco`/`--primary-*`/sombras). |
| `src/styles/globals.css` | Red global de legibilidad bajo `[data-theme="dark"]` (lienzo + patrones de superficie), sin `!important`. |
| `src/theme/tokens.css` | Tokens `--surface-dark` (violeta) de referencia para la paleta oscura. |
| `*.module.css` (~95) | Overrides `:global([data-theme='dark'])` por componente (storefront, cuenta, header/footer/nav, UI Glass*, admin). |

---

## 4. Commits

- `a442251` — feat(ui): Modo Noche global (light/dark/system) — `ThemeProvider` + `ThemeToggle`
  luna/sol en el Header + script anti-FOUC + paleta de variables y overrides por componente
  (1er pase). Respeta los `backgroundColor` inline del admin; garantiza contraste. Frontend por
  Vercel, sin backend.
- `649a42e` — fix(modo-noche): **2º pase de contraste** (ronda extra de overrides
  `[data-theme="dark"]`) + **arrastre del registro de regalos sin parpadeo** (`useGiftDrag` por
  Pointer Events en `/regalar`). Frontend por Vercel, sin backend.
