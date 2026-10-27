const hex = (valor, defecto) => /^#[0-9a-f]{6}$/i.test(valor) ? valor : defecto;
const numero = (v, min, max, defecto = 0) => Number.isFinite(Number(v)) ? Math.max(min, Math.min(max, Number(v))) : defecto;

export function estiloTextoYoryo(a) {
  return { contornoColor: hex(a.contornoColor, '#14294A'), contornoAncho: numero(a.contornoAncho, 0, 12),
    sombraColor: hex(a.sombraColor, '#000000'), sombraOpacidad: numero(a.sombraOpacidad, 0, 1),
    sombraX: numero(a.sombraX, -30, 30), sombraY: numero(a.sombraY, -30, 30), sombraBlur: numero(a.sombraBlur, 0, 20),
    espaciado: numero(a.espaciado, -50, 300), tamanoLetra: numero(a.tamanoLetra, 0, 400) };
}

export function estilosEquipoYoryo(equipo) {
  const base = { sombraOpacidad: .7, sombraX: 1.2, sombraY: 1.8, sombraBlur: .8, sombraColor: '#09203E' };
  const blanco = { ...base, color: '#FFFFFF' };
  const dedicatoria = { color: equipo === 'Universitario' ? '#76262C' : '#14294A' };
  if (equipo === 'Real Madrid') return { nombre: { color: '#12223F', sombraColor: '#C7A55F', sombraOpacidad: .35, sombraX: .8, sombraY: 1, sombraBlur: .5 }, frase: { color: '#956516' }, dedicatoria };
  if (equipo === 'Barcelona') return { nombre: { ...base, color: '#F5D24D', sombraColor: '#320D20', contornoAncho: .6, contornoColor: '#65142E' }, frase: { ...base, color: '#F5D24D' }, dedicatoria };
  if (equipo === 'Sport Boys') return { nombre: { ...blanco, sombraColor: '#4D142D', contornoAncho: .5, contornoColor: '#65213D' }, frase: { ...blanco, sombraColor: '#4D142D' }, dedicatoria };
  if (equipo === 'Universitario') return { nombre: { ...blanco, sombraColor: '#4B0B13' }, frase: { ...blanco, sombraColor: '#4B0B13' }, dedicatoria };
  return { nombre: blanco, frase: blanco, dedicatoria };
}
