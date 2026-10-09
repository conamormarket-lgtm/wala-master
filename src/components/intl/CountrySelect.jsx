// ── Selector de país (internacionalización, aditivo) ─────────────────────
// <select> NATIVO con bandera + nombre, sobre COUNTRIES. Controlado por código
// ISO alpha-2 ('PE', 'US', ...). Perú aparece primero.
//
// API del contrato (sin cambios):
//   <CountrySelect value={code} onChange={(code) => ...} />
//
// 'value' = código del país. 'onChange' recibe el nuevo código (string).
//
// Antes usaba react-select: ~79 KB de JavaScript que se descargaban en el
// checkout, el registro, completar perfil y el pago de las landings solo para
// elegir entre 42 países. El nativo pesa nada, en el celular abre el selector
// del sistema (más cómodo que un menú con buscador) y se puede buscar tecleando
// la primera letra. Además respeta el modo noche (react-select quedaba blanco).

import React from 'react';
import { COUNTRIES } from '../../constants/countries';
import styles from './CountrySelect.module.css';

export default function CountrySelect({
  value,
  onChange,
  placeholder = 'Selecciona tu país',
  isDisabled = false,
  // Alias: LandingPaymentBlock lo pasaba como `disabled` y react-select lo
  // ignoraba (el país seguía editable con el formulario bloqueado).
  disabled = false,
  id,
  name = 'country',
}) {
  const conocido = COUNTRIES.some((c) => c.code === value);
  return (
    <select
      id={id}
      name={name}
      className={styles.select}
      value={conocido ? value : ''}
      onChange={(e) => onChange && onChange(e.target.value || null)}
      disabled={isDisabled || disabled}
      autoComplete="country"
    >
      {!conocido && <option value="" disabled>{placeholder}</option>}
      {COUNTRIES.map((c) => (
        <option key={c.code} value={c.code}>{`${c.flag} ${c.name}`}</option>
      ))}
    </select>
  );
}
