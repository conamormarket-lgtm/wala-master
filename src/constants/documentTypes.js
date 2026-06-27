// ── Tipos de documento de identidad por país (registro + checkout, aditivo) ──
// Permite elegir el tipo de documento al registrarse y en el checkout.
//
// Reglas:
//   - Perú (PE): se ofrece una lista cerrada (DNI, CE, Pasaporte).
//   - Extranjero: no hay lista; se usa un único campo abierto rotulado con
//     FOREIGN_DOC_LABEL ("Documento de identidad nacional").
//
// Contrato del módulo (puro, sin React ni dependencias):
//   isPeru(countryCode): boolean
//   getDocTypesForCountry(countryCode): Array<{value,label}> | null
//     → null significa "extranjero": campo abierto único.
//
// 'countryCode' = ISO 3166-1 alpha-2 (case-insensitive) o nombre del país.

// Lista cerrada de tipos de documento para Perú.
export const DOC_TYPES_PE = [
  { value: 'DNI', label: 'DNI' },
  { value: 'CE', label: 'Carnet de Extranjería (CE)' },
  { value: 'Pasaporte', label: 'Pasaporte' },
];

// Etiqueta del campo abierto único para compradores extranjeros.
export const FOREIGN_DOC_LABEL = 'Documento de identidad nacional';

// Determina si el país es Perú. Sin país => se asume Perú (mercado base).
export const isPeru = (countryCode) =>
  !countryCode ||
  String(countryCode).toUpperCase() === 'PE' ||
  /per[uú]/i.test(String(countryCode));

// Devuelve la lista de tipos de documento para el país, o null si es extranjero.
// null = extranjero: usar un único campo abierto rotulado con FOREIGN_DOC_LABEL.
export const getDocTypesForCountry = (countryCode) =>
  isPeru(countryCode) ? DOC_TYPES_PE : null;
