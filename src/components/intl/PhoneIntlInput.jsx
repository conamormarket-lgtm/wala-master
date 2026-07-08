// ── Input telefónico internacional (internacionalización, aditivo) ───────
// Combina un dropdown de código de país (dialCode, desde COUNTRIES) con un
// input para el número local. El padre controla 'countryCode' y el número.
//
// API del contrato:
//   <PhoneIntlInput
//     countryCode={code}                 // ISO alpha-2 ('PE', 'US', ...)
//     value={localNumber}                // número local (string)
//     onChange={({ localNumber, dialCode, full }) => ...}
//   />
//
//   'full' = dialCode + localNumber (sin espacios, p.ej. '+51987654321').
//
// El dropdown de código y el de país pueden moverse de forma independiente:
// si el usuario cambia el código aquí, se refleja en 'dialCode'/'full'; el
// 'countryCode' externo sólo fija el valor inicial del selector de código.

import React, { useMemo, useState, useEffect } from 'react';
import { COUNTRIES, dialCodeByCountry } from '../../constants/countries';

// Quita todo lo que no sea dígito del número local.
const onlyDigits = (s) => (s || '').replace(/[^\d]/g, '');

export default function PhoneIntlInput({
  countryCode = 'PE',
  value = '',
  onChange,
  placeholder = 'Número de teléfono',
  disabled = false,
  id,
  name = 'phone',
}) {
  // dialCode efectivo del selector. Se inicializa desde countryCode y puede
  // cambiar localmente sin depender del país elegido arriba.
  const [dialCode, setDialCode] = useState(() => dialCodeByCountry(countryCode));

  // Si cambia el país externo, sincroniza el dialCode mostrado.
  useEffect(() => {
    setDialCode(dialCodeByCountry(countryCode));
  }, [countryCode]);

  // Opciones del dropdown de código: flag + dialCode. De-duplicadas por
  // (dialCode) para no repetir '+1' visualmente, pero conservando todas.
  const dialOptions = useMemo(
    () =>
      COUNTRIES.map((c) => ({
        key: c.code,
        dialCode: c.dialCode,
        label: `${c.flag} ${c.dialCode}`,
      })),
    []
  );

  const emit = (nextDial, nextLocal) => {
    const localNumber = onlyDigits(nextLocal);
    const full = `${nextDial}${localNumber}`;
    if (onChange) onChange({ localNumber, dialCode: nextDial, full });
  };

  const handleDialChange = (e) => {
    const next = e.target.value;
    setDialCode(next);
    emit(next, value);
  };

  // Perú (+51): los celulares tienen 9 dígitos → capamos a 9. Otros países:
  // sin límite (cada país tiene su propio largo).
  const maxDigits = dialCode === '+51' ? 9 : null;

  const handleNumberChange = (e) => {
    let digits = onlyDigits(e.target.value);
    if (maxDigits) digits = digits.slice(0, maxDigits);
    emit(dialCode, digits);
  };

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'stretch', width: '100%' }}>
      <select
        aria-label="Código de país"
        value={dialCode}
        onChange={handleDialChange}
        disabled={disabled}
        style={{
          flex: '0 0 auto',
          minWidth: 110,
          padding: '0 10px',
          height: 42,
          borderRadius: 8,
          border: '1px solid #d1d5db',
          background: '#fff',
          color: '#0a0a0a',
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        {dialOptions.map((opt) => (
          <option key={opt.key} value={opt.dialCode}>
            {opt.label}
          </option>
        ))}
      </select>

      <input
        id={id}
        name={name}
        type="tel"
        inputMode="numeric"
        autoComplete="tel"
        value={value}
        onChange={handleNumberChange}
        placeholder={placeholder}
        disabled={disabled}
        {...(maxDigits ? { maxLength: maxDigits } : {})}
        style={{
          flex: '1 1 auto',
          minWidth: 0,
          padding: '0 12px',
          height: 42,
          borderRadius: 8,
          border: '1px solid #d1d5db',
          color: '#0a0a0a',
        }}
      />
    </div>
  );
}
