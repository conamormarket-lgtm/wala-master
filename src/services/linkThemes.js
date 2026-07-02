// ── Temas, gradientes y patrones para "Enlaces útiles" (link-in-bio) ─────────
// Módulo COMPARTIDO por el editor admin (AdminEnlaceEditor) y la página pública
// (LinkInBioPage) para que la vista previa y el resultado real sean IDÉNTICOS.
// Contiene:
//   - GRADIENTES: presets de degradados CSS listos para el fondo.
//   - PATRONES: fondos con textura (puntos/grid/rayas…) que se derivan del color.
//   - TEMAS: diseños predefinidos con BUEN CONTRASTE (título/texto/botón/fondo)
//     que el dueño puede aplicar de un clic y luego ajustar.
//   - Helpers construirFondoStyle() y estiloBotonStyle() usados por ambas UIs.

// ── Utilidades de color ──────────────────────────────────────────────────────

// Convierte un hex (#rrggbb) a {r,g,b}. Tolerante: null si no es válido.
const hexToRgb = (hex) => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex || ''));
  if (!m) return null;
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
};

// rgba(...) a partir de un hex + alpha (fallback a blanco translúcido).
export const hexToRgba = (hex, alpha) => {
  const c = hexToRgb(hex);
  if (!c) return `rgba(255, 255, 255, ${alpha})`;
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})`;
};

// ¿El color es oscuro? (luminancia relativa). Sirve para decidir si el patrón /
// texto de contraste debe ir en claro u oscuro.
export const esColorOscuro = (hex) => {
  const c = hexToRgb(hex);
  if (!c) return false;
  const lum = (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255;
  return lum < 0.55;
};

// ── Degradados predefinidos (valor CSS listo para background) ─────────────────
export const GRADIENTES = [
  { id: 'atardecer', nombre: 'Atardecer', value: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)' },
  { id: 'purpura', nombre: 'Púrpura', value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  { id: 'rosa', nombre: 'Rosa', value: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
  { id: 'oceano', nombre: 'Océano', value: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
  { id: 'menta', nombre: 'Menta', value: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' },
  { id: 'noche', nombre: 'Noche', value: 'linear-gradient(160deg, #0f2027 0%, #203a43 50%, #2c5364 100%)' },
  { id: 'fuego', nombre: 'Fuego', value: 'linear-gradient(135deg, #ff512f 0%, #dd2476 100%)' },
  { id: 'lila', nombre: 'Lila suave', value: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)' },
  { id: 'esmeralda', nombre: 'Esmeralda', value: 'linear-gradient(160deg, #0b3d2e 0%, #1e6f5c 100%)' },
  { id: 'vino', nombre: 'Vino', value: 'linear-gradient(160deg, #2d0a1f 0%, #6a1b3a 100%)' },
];

// ── Patrones (textura sobre un color base) ────────────────────────────────────
// Cada patrón se dibuja con una capa translúcida (clara u oscura según el color
// base) para que combine con cualquier fondo. `build(base)` devuelve el objeto de
// estilo { backgroundColor, backgroundImage, backgroundSize }.
const lineaContraste = (base) => (esColorOscuro(base) ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.09)');

export const PATRONES = [
  {
    id: 'puntos',
    nombre: 'Puntos',
    build: (base) => ({
      backgroundColor: base,
      backgroundImage: `radial-gradient(${lineaContraste(base)} 1.6px, transparent 1.6px)`,
      backgroundSize: '18px 18px',
    }),
  },
  {
    id: 'cuadricula',
    nombre: 'Cuadrícula',
    build: (base) => {
      const l = lineaContraste(base);
      return {
        backgroundColor: base,
        backgroundImage: `linear-gradient(${l} 1px, transparent 1px), linear-gradient(90deg, ${l} 1px, transparent 1px)`,
        backgroundSize: '24px 24px',
      };
    },
  },
  {
    id: 'diagonal',
    nombre: 'Diagonales',
    build: (base) => ({
      backgroundColor: base,
      backgroundImage: `repeating-linear-gradient(45deg, ${lineaContraste(base)} 0, ${lineaContraste(base)} 2px, transparent 2px, transparent 12px)`,
      backgroundSize: 'auto',
    }),
  },
  {
    id: 'rayas',
    nombre: 'Rayas',
    build: (base) => ({
      backgroundColor: base,
      backgroundImage: `repeating-linear-gradient(90deg, ${lineaContraste(base)} 0, ${lineaContraste(base)} 2px, transparent 2px, transparent 16px)`,
      backgroundSize: 'auto',
    }),
  },
  {
    id: 'trama',
    nombre: 'Trama',
    build: (base) => {
      const l = lineaContraste(base);
      return {
        backgroundColor: base,
        backgroundImage: `repeating-linear-gradient(45deg, ${l} 0 1px, transparent 1px 11px), repeating-linear-gradient(-45deg, ${l} 0 1px, transparent 1px 11px)`,
        backgroundSize: 'auto',
      };
    },
  },
];

export const getPatron = (id) => PATRONES.find((p) => p.id === id) || PATRONES[0];

// ── Helper de FONDO (color / degradado / patrón / imagen) ─────────────────────
// Devuelve un objeto de estilo React listo para aplicar en el contenedor.
export function construirFondoStyle(background) {
  const bg = background || {};
  const value = bg.value || '';
  if (bg.type === 'image' && value) {
    return {
      backgroundImage: `url("${value}")`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    };
  }
  if (bg.type === 'gradient' && value) {
    return { background: value };
  }
  if (bg.type === 'pattern') {
    // Los patrones DEBEN teselar (repeat) para cubrir toda la página.
    return { ...getPatron(value).build(bg.color || '#4B0055'), backgroundRepeat: 'repeat' };
  }
  // color plano (o cualquier otro caso)
  return { background: value || '#f3f4f6' };
}

// ── Sombra de botón (none | soft | strong | hard) ─────────────────────────────
export function sombraBotonCss(shadow) {
  if (shadow === 'soft') return '0 4px 14px rgba(0,0,0,0.12)';
  if (shadow === 'strong') return '0 10px 28px rgba(0,0,0,0.28)';
  if (shadow === 'hard') return '4px 4px 0 rgba(0,0,0,0.85)';
  return 'none';
}

// ── Estilo de un botón según el diseño (mismo cálculo en editor y página) ─────
export function estiloBotonStyle(diseno) {
  const d = diseno || {};
  const base = {
    borderRadius: `${d.cornerRoundness ?? 12}px`,
    boxShadow: sombraBotonCss(d.buttonShadow),
    color: d.buttonTextColor || '#ffffff',
  };
  if (d.buttonStyle === 'glass') {
    return {
      ...base,
      background: hexToRgba(d.buttonColor || '#111827', 0.22),
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      border: `1px solid ${hexToRgba(d.buttonTextColor || '#ffffff', 0.35)}`,
    };
  }
  if (d.buttonStyle === 'outline') {
    return {
      ...base,
      background: 'transparent',
      border: `2px solid ${d.buttonColor || '#111827'}`,
      color: d.buttonColor || '#111827',
    };
  }
  return { ...base, background: d.buttonColor || '#111827', border: 'none' };
}

// ── TEMAS PREDEFINIDOS (buen contraste, listos para aplicar) ──────────────────
// Cada tema es un objeto `diseno` COMPLETO. El editor los pinta como tarjetas;
// al hacer clic se copian al formulario (y luego se pueden ajustar los colores).
export const TEMAS = [
  {
    id: 'noche',
    nombre: 'Noche',
    diseno: {
      buttonStyle: 'solid', cornerRoundness: 14, buttonShadow: 'soft',
      buttonColor: '#ffffff', buttonTextColor: '#0f1020',
      titleColor: '#ffffff', textColor: '#c7c9e0',
      background: { type: 'gradient', value: 'linear-gradient(160deg, #0f1020 0%, #232544 100%)' },
      fontFamily: "'Poppins', sans-serif",
    },
  },
  {
    id: 'aurora',
    nombre: 'Aurora',
    diseno: {
      buttonStyle: 'glass', cornerRoundness: 18, buttonShadow: 'soft',
      buttonColor: '#ffffff', buttonTextColor: '#ffffff',
      titleColor: '#ffffff', textColor: '#f0e9ff',
      background: { type: 'gradient', value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
      fontFamily: "'Poppins', sans-serif",
    },
  },
  {
    id: 'menta',
    nombre: 'Menta',
    diseno: {
      buttonStyle: 'solid', cornerRoundness: 12, buttonShadow: 'soft',
      buttonColor: '#0b3d2e', buttonTextColor: '#ffffff',
      titleColor: '#0b3d2e', textColor: '#2f5d4f',
      background: { type: 'color', value: '#e8f7f0' },
      fontFamily: '',
    },
  },
  {
    id: 'coral',
    nombre: 'Coral',
    diseno: {
      buttonStyle: 'solid', cornerRoundness: 24, buttonShadow: 'strong',
      buttonColor: '#ffffff', buttonTextColor: '#c0392b',
      titleColor: '#ffffff', textColor: '#fff0ec',
      background: { type: 'gradient', value: 'linear-gradient(135deg, #ff512f 0%, #dd2476 100%)' },
      fontFamily: "'Montserrat', sans-serif",
    },
  },
  {
    id: 'minimal',
    nombre: 'Minimal',
    diseno: {
      buttonStyle: 'outline', cornerRoundness: 10, buttonShadow: 'none',
      buttonColor: '#111111', buttonTextColor: '#111111',
      titleColor: '#111111', textColor: '#555555',
      background: { type: 'color', value: '#ffffff' },
      fontFamily: '',
    },
  },
  {
    id: 'neon',
    nombre: 'Neón',
    diseno: {
      buttonStyle: 'solid', cornerRoundness: 8, buttonShadow: 'hard',
      buttonColor: '#c6ff00', buttonTextColor: '#0a0a0a',
      titleColor: '#c6ff00', textColor: '#e6e6e6',
      background: { type: 'pattern', value: 'cuadricula', color: '#0a0a0a' },
      fontFamily: "'Courier New', monospace",
    },
  },
  {
    id: 'arena',
    nombre: 'Arena',
    diseno: {
      buttonStyle: 'solid', cornerRoundness: 16, buttonShadow: 'soft',
      buttonColor: '#6b4f3a', buttonTextColor: '#fff7ee',
      titleColor: '#4a3527', textColor: '#6b5a4a',
      background: { type: 'color', value: '#f5ede1' },
      fontFamily: "'Georgia', serif",
    },
  },
  {
    id: 'oceano',
    nombre: 'Océano',
    diseno: {
      buttonStyle: 'glass', cornerRoundness: 20, buttonShadow: 'soft',
      buttonColor: '#ffffff', buttonTextColor: '#ffffff',
      titleColor: '#ffffff', textColor: '#e6faff',
      background: { type: 'gradient', value: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
      fontFamily: "'Poppins', sans-serif",
    },
  },
  {
    id: 'lavanda',
    nombre: 'Lavanda',
    diseno: {
      buttonStyle: 'solid', cornerRoundness: 22, buttonShadow: 'soft',
      buttonColor: '#5b3fa0', buttonTextColor: '#ffffff',
      titleColor: '#3d2a6b', textColor: '#6a5a90',
      background: { type: 'pattern', value: 'puntos', color: '#efe9fb' },
      fontFamily: "'Poppins', sans-serif",
    },
  },
  {
    id: 'wala',
    nombre: 'Walá',
    diseno: {
      buttonStyle: 'solid', cornerRoundness: 14, buttonShadow: 'soft',
      buttonColor: '#6D28D9', buttonTextColor: '#ffffff',
      titleColor: '#ffffff', textColor: '#eadcff',
      background: { type: 'gradient', value: 'linear-gradient(160deg, #4B0055 0%, #6D28D9 100%)' },
      fontFamily: "'Poppins', sans-serif",
    },
  },
];
