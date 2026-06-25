// ── Catálogo de países (internacionalización, aditivo) ───────────────────
// Lista de países soportados para selección de país y código telefónico.
// PERÚ SIEMPRE PRIMERO: es el mercado por defecto y el fallback de seguridad.
// Incluye toda Latinoamérica + EEUU + España + Canadá + principales de Europa.
//
// API del contrato:
//   COUNTRIES: [{ code, name, dialCode, flag }, ...]   (Perú primero)
//   countryByCode(code): country | undefined
//   dialCodeByCountry(code): string                     (fallback '+51')
//
// 'code' = ISO 3166-1 alpha-2 (mayúsculas). 'dialCode' incluye el '+'.

export const COUNTRIES = [
  // Mercado por defecto / fallback de seguridad: Perú primero.
  { code: 'PE', name: 'Perú', dialCode: '+51', flag: '🇵🇪' },

  // ── Latinoamérica ──────────────────────────────────────────────────────
  { code: 'AR', name: 'Argentina', dialCode: '+54', flag: '🇦🇷' },
  { code: 'BO', name: 'Bolivia', dialCode: '+591', flag: '🇧🇴' },
  { code: 'BR', name: 'Brasil', dialCode: '+55', flag: '🇧🇷' },
  { code: 'CL', name: 'Chile', dialCode: '+56', flag: '🇨🇱' },
  { code: 'CO', name: 'Colombia', dialCode: '+57', flag: '🇨🇴' },
  { code: 'CR', name: 'Costa Rica', dialCode: '+506', flag: '🇨🇷' },
  { code: 'CU', name: 'Cuba', dialCode: '+53', flag: '🇨🇺' },
  { code: 'DO', name: 'República Dominicana', dialCode: '+1', flag: '🇩🇴' },
  { code: 'EC', name: 'Ecuador', dialCode: '+593', flag: '🇪🇨' },
  { code: 'SV', name: 'El Salvador', dialCode: '+503', flag: '🇸🇻' },
  { code: 'GT', name: 'Guatemala', dialCode: '+502', flag: '🇬🇹' },
  { code: 'HN', name: 'Honduras', dialCode: '+504', flag: '🇭🇳' },
  { code: 'MX', name: 'México', dialCode: '+52', flag: '🇲🇽' },
  { code: 'NI', name: 'Nicaragua', dialCode: '+505', flag: '🇳🇮' },
  { code: 'PA', name: 'Panamá', dialCode: '+507', flag: '🇵🇦' },
  { code: 'PY', name: 'Paraguay', dialCode: '+595', flag: '🇵🇾' },
  { code: 'PR', name: 'Puerto Rico', dialCode: '+1', flag: '🇵🇷' },
  { code: 'UY', name: 'Uruguay', dialCode: '+598', flag: '🇺🇾' },
  { code: 'VE', name: 'Venezuela', dialCode: '+58', flag: '🇻🇪' },

  // ── Norteamérica ───────────────────────────────────────────────────────
  { code: 'US', name: 'Estados Unidos', dialCode: '+1', flag: '🇺🇸' },
  { code: 'CA', name: 'Canadá', dialCode: '+1', flag: '🇨🇦' },

  // ── Europa (principales) ───────────────────────────────────────────────
  { code: 'ES', name: 'España', dialCode: '+34', flag: '🇪🇸' },
  { code: 'PT', name: 'Portugal', dialCode: '+351', flag: '🇵🇹' },
  { code: 'FR', name: 'Francia', dialCode: '+33', flag: '🇫🇷' },
  { code: 'DE', name: 'Alemania', dialCode: '+49', flag: '🇩🇪' },
  { code: 'IT', name: 'Italia', dialCode: '+39', flag: '🇮🇹' },
  { code: 'GB', name: 'Reino Unido', dialCode: '+44', flag: '🇬🇧' },
  { code: 'IE', name: 'Irlanda', dialCode: '+353', flag: '🇮🇪' },
  { code: 'NL', name: 'Países Bajos', dialCode: '+31', flag: '🇳🇱' },
  { code: 'BE', name: 'Bélgica', dialCode: '+32', flag: '🇧🇪' },
  { code: 'CH', name: 'Suiza', dialCode: '+41', flag: '🇨🇭' },
  { code: 'AT', name: 'Austria', dialCode: '+43', flag: '🇦🇹' },
  { code: 'SE', name: 'Suecia', dialCode: '+46', flag: '🇸🇪' },
  { code: 'NO', name: 'Noruega', dialCode: '+47', flag: '🇳🇴' },
  { code: 'DK', name: 'Dinamarca', dialCode: '+45', flag: '🇩🇰' },
  { code: 'FI', name: 'Finlandia', dialCode: '+358', flag: '🇫🇮' },
  { code: 'PL', name: 'Polonia', dialCode: '+48', flag: '🇵🇱' },

  // ── Otros relevantes ───────────────────────────────────────────────────
  { code: 'AU', name: 'Australia', dialCode: '+61', flag: '🇦🇺' },
  { code: 'NZ', name: 'Nueva Zelanda', dialCode: '+64', flag: '🇳🇿' },
  { code: 'JP', name: 'Japón', dialCode: '+81', flag: '🇯🇵' },
  { code: 'CN', name: 'China', dialCode: '+86', flag: '🇨🇳' },
];

// Índice por código para búsquedas O(1).
const BY_CODE = COUNTRIES.reduce((acc, c) => {
  acc[c.code] = c;
  return acc;
}, {});

// Devuelve el país por su código ISO alpha-2 (case-insensitive). undefined si no existe.
export function countryByCode(code) {
  if (!code) return undefined;
  return BY_CODE[String(code).toUpperCase()];
}

// Devuelve el código telefónico (dialCode) de un país. Fallback '+51' (Perú).
export function dialCodeByCountry(code) {
  const c = countryByCode(code);
  return c ? c.dialCode : '+51';
}

export default COUNTRIES;
