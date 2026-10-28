import { RECURSOS_CAPAS_YORYO } from './recursosEquipos.mjs';

/*
 * Las plantillas de equipos del personalizador anterior, tal como venían de
 * fábrica: fondo, foto, escudo, nombre, frase, pincelada y dedicatoria, en
 * fracciones del lienzo (centro x, y y caja w, h).
 */
const ids = { 'Alianza Lima': 'alianza_lima', Universitario: 'u', 'Sporting Cristal': 'sporting_cristall', 'Sport Boys': 'sport_boys', Barcelona: 'barcelona', 'Real Madrid': 'real_madrid' };

function estilosEquipo(equipo) {
  const base = { sombraOpacidad: .7, sombraX: 1.2, sombraY: 1.8, sombraBlur: .8, sombraColor: '#09203E' };
  const blanco = { ...base, color: '#FFFFFF' };
  const dedicatoria = { color: equipo === 'Universitario' ? '#76262C' : '#14294A' };
  if (equipo === 'Real Madrid') return { nombre: { color: '#12223F', sombraColor: '#C7A55F', sombraOpacidad: .35, sombraX: .8, sombraY: 1, sombraBlur: .5 }, frase: { color: '#956516' }, dedicatoria };
  if (equipo === 'Barcelona') return { nombre: { ...base, color: '#F5D24D', sombraColor: '#320D20', contornoAncho: .6, contornoColor: '#65142E' }, frase: { ...base, color: '#F5D24D' }, dedicatoria };
  if (equipo === 'Sport Boys') return { nombre: { ...blanco, sombraColor: '#4D142D', contornoAncho: .5, contornoColor: '#65213D' }, frase: { ...blanco, sombraColor: '#4D142D' }, dedicatoria };
  if (equipo === 'Universitario') return { nombre: { ...blanco, sombraColor: '#4B0B13' }, frase: { ...blanco, sombraColor: '#4B0B13' }, dedicatoria };
  return { nombre: blanco, frase: blanco, dedicatoria };
}

export function plantillaCapasBaseYoryo(equipo = 'Alianza Lima', producto = 'cuadro') {
  const recursos = RECURSOS_CAPAS_YORYO[ids[equipo] || 'alianza_lima'];
  const mouse = producto === 'mousepad';
  const tinta = equipo === 'Real Madrid' ? '#14294A' : '#FFFFFF';
  const estilos = estilosEquipo(equipo);
  const texto = (id, nombre, x, y, w, h, orden, fuente, color) => ({ id, nombre, x, y, w, h, orden, fuente, color, alineacion: 'centro', mayusculas: false });
  return {
    clave: `${producto}__deportivo__${ids[equipo] || 'alianza_lima'}`, producto, equipo,
    recursos,
    elementos: [
      { id: 'fondo', nombre: 'Fondo', recurso: 'fondo', x: .5, y: .5, w: 1, h: 1, orden: 0, margen: 0, encaje: 'cubrir' },
      { id: 'foto', nombre: 'Foto del cliente', indiceFoto: 0, x: mouse ? .73 : .74, y: .46, w: mouse ? .49 : .48, h: .86, orden: 1, encaje: 'completa', margen: 0 },
      { id: 'escudo', nombre: 'Escudo', recurso: 'escudo', x: .265, y: mouse ? .265 : .26, w: .31, h: mouse ? .41 : .43, orden: 2 },
      { ...texto('nombre', 'Nombre', .275, mouse ? .555 : .56, .44, .12, 3, 'Elegante', tinta), ...estilos.nombre },
      { ...texto('frase', 'Frase', .275, .67, .44, .095, 4, 'Manuscrita', tinta), ...estilos.frase },
      { id: 'pincelada', nombre: 'Pincelada inferior', recurso: 'pincelada', x: .5, y: mouse ? .825 : .82, w: .94, h: .32, orden: 5, margen: .01 },
      { ...texto('dedicatoria', 'Dedicatoria', .5, mouse ? .825 : .82, .68, .055, 6, 'Manuscrita', '#14294A'), ...estilos.dedicatoria },
    ],
  };
}
