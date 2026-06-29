# Modo Noche — tema claro / oscuro / sistema

> Tema visual claro/oscuro para **toda la web pública y el admin** de WALA, con un
> **interruptor luna/sol** en el Header. Desplegado el **2026-06-29** (commit `a442251`),
> **frontend por Vercel**; **NO requiere backend** (es solo CSS + estado de cliente).
>
> Fuente: lectura directa del código (`src/contexts/ThemeContext.jsx`,
> `src/components/common/ThemeToggle/`, `src/components/common/Header/Header.jsx`,
> `index.html`, `src/styles/globals.css` + los `.module.css` con overrides).
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

- **Variables de tema:** `:root` (claro) y `[data-theme="dark"]` (oscuro) en
  `src/styles/globals.css`, con una **red global** que **remapea** los tokens existentes
  (`--gris-*`, `--blanco`, `--color-*`) bajo `dark` — así gran parte de la UI cambia sin tocar
  cada archivo.
- **Overrides finos por componente:** reglas `:global([data-theme='dark'])` en ~40 `.module.css`
  (storefront, cuenta, header/footer/nav, componentes UI Glass* y admin) para los casos que la
  red global no cubre.
- **Sin `!important`:** los `backgroundColor` que el admin configura inline en sus secciones
  **ganan** sobre el tema (se respeta el diseño del dueño).
- **Contraste:** fondo oscuro → texto claro en toda la página.

---

## 3. Referencias de archivos

| Archivo | Rol |
|---|---|
| `src/contexts/ThemeContext.jsx` | `ThemeProvider` + `useTheme()`: modos `light/dark/system`, persistencia `wala-theme`, aplica `data-theme`. |
| `src/components/common/ThemeToggle/` | Interruptor luna/sol (botón accesible) que llama `toggle()`. |
| `src/components/common/Header/Header.jsx` | Monta el `ThemeToggle` en la cabecera. |
| `index.html` | Script anti-FOUC: fija `data-theme` antes de React/CSS. |
| `src/styles/globals.css` | Variables `:root` / `[data-theme="dark"]` + red global que remapea tokens. |
| `*.module.css` (~40) | Overrides `:global([data-theme='dark'])` por componente. |

---

## 4. Commit

- `a442251` — feat(ui): Modo Noche global (light/dark/system) — `ThemeProvider` + `ThemeToggle`
  luna/sol en el Header + script anti-FOUC + paleta de variables y overrides por componente.
  Respeta los `backgroundColor` inline del admin; garantiza contraste. Frontend por Vercel, sin
  backend.
