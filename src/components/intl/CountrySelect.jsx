// ── Selector de país (internacionalización, aditivo) ─────────────────────
// Dropdown con bandera + nombre, construido sobre react-select y COUNTRIES.
// Controlado por código ISO alpha-2 ('PE', 'US', ...). Perú aparece primero.
//
// API del contrato:
//   <CountrySelect value={code} onChange={(code) => ...} />
//
// 'value' = código del país. 'onChange' recibe el nuevo código (string).

import React, { useMemo } from 'react';
import Select from 'react-select';
import { COUNTRIES, countryByCode } from '../../constants/countries';

// Convierte un país del catálogo en una opción de react-select.
const toOption = (c) => ({
  value: c.code,
  label: `${c.flag} ${c.name}`,
  country: c,
});

// Estilos sobrios y neutrales, coherentes con inputs simples de la app.
const baseStyles = {
  control: (base) => ({
    ...base,
    minHeight: 42,
    borderRadius: 8,
    borderColor: '#d1d5db',
    boxShadow: 'none',
    ':hover': { borderColor: '#0a0a0a' },
  }),
  menu: (base) => ({ ...base, zIndex: 30 }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected
      ? '#0a0a0a'
      : state.isFocused
      ? '#f3f4f6'
      : '#fff',
    color: state.isSelected ? '#fff' : '#0a0a0a',
    cursor: 'pointer',
  }),
};

export default function CountrySelect({
  value,
  onChange,
  placeholder = 'Selecciona tu país',
  isDisabled = false,
  id,
  name = 'country',
}) {
  const options = useMemo(() => COUNTRIES.map(toOption), []);

  const selected = useMemo(() => {
    const c = countryByCode(value);
    return c ? toOption(c) : null;
  }, [value]);

  return (
    <Select
      inputId={id}
      name={name}
      classNamePrefix="wala-country-select"
      options={options}
      value={selected}
      onChange={(opt) => onChange && onChange(opt ? opt.value : null)}
      placeholder={placeholder}
      isDisabled={isDisabled}
      isSearchable
      styles={baseStyles}
      menuPlacement="auto"
      noOptionsMessage={() => 'Sin resultados'}
    />
  );
}
