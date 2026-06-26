// ── Catálogo de monedas por país (internacionalización de cobro, aditivo) ──
// Mapea cada país de src/constants/countries.js a su moneda de DISPLAY local.
//
// IMPORTANTE (reglas de dinero):
//   - Esta tabla es SOLO para mostrar/formatear el monto en la moneda natural
//     del comprador. El cobro real se hace en USD (PayPal) o PEN (Culqi).
//   - 'paypalSupported' indica si PayPal puede cobrar DIRECTAMENTE en esa moneda.
//     Cuando es false (p. ej. COP, ARS, CLP), PayPal cobra en USD y la moneda
//     local queda solo como etiqueta informativa ("$ 98,000 Pesos Colombianos").
//
// Contrato del módulo (puro, sin React):
//   getCurrency(countryCode): { iso, symbol, naturalLabel, decimals, paypalSupported }
//   formatMoney(amount, cfg): string   → "S/ 150.00", "$ 98,000 Pesos Colombianos"
//
// 'countryCode' = ISO 3166-1 alpha-2 (case-insensitive).
// Los códigos están alineados 1:1 con COUNTRIES de src/constants/countries.js.

// Moneda por defecto para países no listados: USD (PayPal lo soporta siempre).
export const DEFAULT_CURRENCY = {
  iso: 'USD',
  symbol: '$',
  naturalLabel: 'Dólares',
  decimals: 2,
  paypalSupported: true,
};

// Tabla país → moneda. naturalLabel se muestra junto al monto cuando la moneda
// NO es la del checkout (p. ej. cobro en USD pero etiqueta "Pesos Colombianos").
const CURRENCY_BY_COUNTRY = {
  // ── Mercado por defecto: Perú ──────────────────────────────────────────
  PE: { iso: 'PEN', symbol: 'S/', naturalLabel: 'Soles Peruanos', decimals: 2, paypalSupported: true },

  // ── Latinoamérica ──────────────────────────────────────────────────────
  AR: { iso: 'ARS', symbol: '$', naturalLabel: 'Pesos Argentinos', decimals: 2, paypalSupported: false },
  BO: { iso: 'BOB', symbol: 'Bs', naturalLabel: 'Bolivianos', decimals: 2, paypalSupported: false },
  BR: { iso: 'BRL', symbol: 'R$', naturalLabel: 'Reales Brasileños', decimals: 2, paypalSupported: true },
  CL: { iso: 'CLP', symbol: '$', naturalLabel: 'Pesos Chilenos', decimals: 0, paypalSupported: false },
  CO: { iso: 'COP', symbol: '$', naturalLabel: 'Pesos Colombianos', decimals: 0, paypalSupported: false },
  CR: { iso: 'CRC', symbol: '₡', naturalLabel: 'Colones', decimals: 2, paypalSupported: false },
  CU: { iso: 'CUP', symbol: '$', naturalLabel: 'Pesos Cubanos', decimals: 2, paypalSupported: false },
  DO: { iso: 'DOP', symbol: 'RD$', naturalLabel: 'Pesos Dominicanos', decimals: 2, paypalSupported: false },
  EC: { iso: 'USD', symbol: '$', naturalLabel: 'Dólares', decimals: 2, paypalSupported: true }, // Ecuador usa USD
  SV: { iso: 'USD', symbol: '$', naturalLabel: 'Dólares', decimals: 2, paypalSupported: true }, // El Salvador usa USD
  GT: { iso: 'GTQ', symbol: 'Q', naturalLabel: 'Quetzales', decimals: 2, paypalSupported: false },
  HN: { iso: 'HNL', symbol: 'L', naturalLabel: 'Lempiras', decimals: 2, paypalSupported: false },
  MX: { iso: 'MXN', symbol: '$', naturalLabel: 'Pesos Mexicanos', decimals: 2, paypalSupported: true },
  NI: { iso: 'NIO', symbol: 'C$', naturalLabel: 'Córdobas', decimals: 2, paypalSupported: false },
  PA: { iso: 'USD', symbol: '$', naturalLabel: 'Dólares', decimals: 2, paypalSupported: true }, // Panamá usa USD (balboa a la par)
  PY: { iso: 'PYG', symbol: '₲', naturalLabel: 'Guaraníes', decimals: 0, paypalSupported: false },
  PR: { iso: 'USD', symbol: '$', naturalLabel: 'Dólares', decimals: 2, paypalSupported: true }, // Puerto Rico usa USD
  UY: { iso: 'UYU', symbol: '$U', naturalLabel: 'Pesos Uruguayos', decimals: 2, paypalSupported: false },
  VE: { iso: 'VES', symbol: 'Bs', naturalLabel: 'Bolívares', decimals: 2, paypalSupported: false },

  // ── Norteamérica ───────────────────────────────────────────────────────
  US: { iso: 'USD', symbol: '$', naturalLabel: 'Dólares', decimals: 2, paypalSupported: true },
  CA: { iso: 'CAD', symbol: '$', naturalLabel: 'Dólares Canadienses', decimals: 2, paypalSupported: true },

  // ── Europa (principales) ───────────────────────────────────────────────
  ES: { iso: 'EUR', symbol: '€', naturalLabel: 'Euros', decimals: 2, paypalSupported: true },
  PT: { iso: 'EUR', symbol: '€', naturalLabel: 'Euros', decimals: 2, paypalSupported: true },
  FR: { iso: 'EUR', symbol: '€', naturalLabel: 'Euros', decimals: 2, paypalSupported: true },
  DE: { iso: 'EUR', symbol: '€', naturalLabel: 'Euros', decimals: 2, paypalSupported: true },
  IT: { iso: 'EUR', symbol: '€', naturalLabel: 'Euros', decimals: 2, paypalSupported: true },
  GB: { iso: 'GBP', symbol: '£', naturalLabel: 'Libras Esterlinas', decimals: 2, paypalSupported: true },
  IE: { iso: 'EUR', symbol: '€', naturalLabel: 'Euros', decimals: 2, paypalSupported: true },
  NL: { iso: 'EUR', symbol: '€', naturalLabel: 'Euros', decimals: 2, paypalSupported: true },
  BE: { iso: 'EUR', symbol: '€', naturalLabel: 'Euros', decimals: 2, paypalSupported: true },
  CH: { iso: 'CHF', symbol: 'CHF', naturalLabel: 'Francos Suizos', decimals: 2, paypalSupported: true },
  AT: { iso: 'EUR', symbol: '€', naturalLabel: 'Euros', decimals: 2, paypalSupported: true },
  SE: { iso: 'SEK', symbol: 'kr', naturalLabel: 'Coronas Suecas', decimals: 2, paypalSupported: true },
  NO: { iso: 'NOK', symbol: 'kr', naturalLabel: 'Coronas Noruegas', decimals: 2, paypalSupported: true },
  DK: { iso: 'DKK', symbol: 'kr', naturalLabel: 'Coronas Danesas', decimals: 2, paypalSupported: true },
  FI: { iso: 'EUR', symbol: '€', naturalLabel: 'Euros', decimals: 2, paypalSupported: true },
  PL: { iso: 'PLN', symbol: 'zł', naturalLabel: 'Eslotis', decimals: 2, paypalSupported: true },

  // ── Otros relevantes ───────────────────────────────────────────────────
  AU: { iso: 'AUD', symbol: '$', naturalLabel: 'Dólares Australianos', decimals: 2, paypalSupported: true },
  NZ: { iso: 'NZD', symbol: '$', naturalLabel: 'Dólares Neozelandeses', decimals: 2, paypalSupported: true },
  JP: { iso: 'JPY', symbol: '¥', naturalLabel: 'Yenes', decimals: 0, paypalSupported: true },
  CN: { iso: 'CNY', symbol: '¥', naturalLabel: 'Yuanes', decimals: 2, paypalSupported: false },
};

// Devuelve la config de moneda de un país (case-insensitive).
// Fallback razonable a USD para cualquier país no listado o código vacío.
export function getCurrency(countryCode) {
  if (!countryCode) return DEFAULT_CURRENCY;
  return CURRENCY_BY_COUNTRY[String(countryCode).toUpperCase()] || DEFAULT_CURRENCY;
}

// Formatea un monto con separadores locales según la config de moneda.
//   formatMoney(150, { symbol:'S/', decimals:2, ... })          → "S/ 150.00"
//   formatMoney(98000, { symbol:'$', decimals:0, naturalLabel:'Pesos Colombianos' })
//                                                                → "$ 98,000 Pesos Colombianos"
// 'naturalLabel' se anexa SOLO cuando la moneda no es ni Soles ni Dólares "$"
// genéricos; se incluye siempre que cfg.naturalLabel exista y se pida explícito.
//
// Parámetros:
//   amount: número (si no es finito se trata como 0; tolerante a fallos).
//   cfg:    objeto devuelto por getCurrency (o compatible). Fallback a DEFAULT.
//   options.withLabel: si true (default), anexa naturalLabel cuando aplique.
export function formatMoney(amount, cfg, options = {}) {
  const c = cfg && cfg.symbol ? cfg : DEFAULT_CURRENCY;
  const { withLabel = true } = options;

  // Tolerante a fallos: nunca lanzar, nunca dejar el checkout sin precio.
  const n = Number.isFinite(Number(amount)) ? Number(amount) : 0;
  const decimals = Number.isInteger(c.decimals) ? c.decimals : 2;

  // Separadores: miles con coma, decimal con punto (formato es-PE/en-US).
  // No usamos Intl con locale dependiente del dispositivo para garantizar
  // un formato estable y predecible en todos los entornos.
  const fixed = n.toFixed(decimals);
  const [intPart, decPart] = fixed.split('.');
  const intWithSep = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const numberStr = decPart ? `${intWithSep}.${decPart}` : intWithSep;

  const base = `${c.symbol} ${numberStr}`;

  // Anexa la etiqueta natural ("Pesos Colombianos") cuando:
  //   - se pide (withLabel) y existe naturalLabel,
  //   - y la moneda NO es la del checkout primario (PEN/USD), para evitar
  //     redundancia como "S/ 150.00 Soles Peruanos" o "$ 10.00 Dólares".
  const isPrimaryCheckout = c.iso === 'PEN' || c.iso === 'USD';
  if (withLabel && c.naturalLabel && !isPrimaryCheckout) {
    return `${base} ${c.naturalLabel}`;
  }

  return base;
}

export default getCurrency;
