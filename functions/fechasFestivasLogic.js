// Fechas festivas del año (Día de la Madre, del Padre, San Valentín, Navidad…):
// cuándo caen, a quién de "Fechas importantes" le tocan y qué avisos salen hoy.
// Puro: sin Firebase. La configuración vive en storeConfig/fechasFestivas y se
// edita en /admin/fechas-importantes → "Fechas festivas".
//
// ⚠️ COPIA GENERADA de src/utils/fechasFestivas.mjs (la fuente es ese archivo).
// No la edites a mano: corre  npm run gen:gift-logic  después de cambiar el original.
//
// Muchas fechas no caen el mismo día cada año: el Día de la Madre es el 2.º
// domingo de mayo (10 de mayo en 2026, 9 en 2027). Por eso cada fecha guarda
// una REGLA, no un día:
//   { tipo: 'fija',  mes: 12, dia: 25 }                    → 25 de diciembre
//   { tipo: 'movil', mes: 5, diaSemana: 0, ordinal: 2 }    → 2.º domingo de mayo
//   ordinal -1 = el último de ese día en el mes (último domingo de agosto).
// Las fechas son "YYYY-MM-DD" y se calcula en UTC para que no dependa de la
// zona horaria del navegador o del servidor.

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const ORDINALES = [
  { id: 1, label: '1.º' },
  { id: 2, label: '2.º' },
  { id: 3, label: '3.º' },
  { id: 4, label: '4.º' },
  { id: -1, label: 'Último' },
];
// Mismos roles que "Fechas importantes" (roleKey de cada persona).
const ROLES = [
  { id: 'pareja', label: 'Pareja' },
  { id: 'padres', label: 'Padres' },
  { id: 'hijos', label: 'Hijos' },
  { id: 'hermanos', label: 'Hermanos' },
  { id: 'sobrinos', label: 'Sobrinos' },
  { id: 'primos', label: 'Primos' },
  { id: 'amigos', label: 'Amigos' },
  { id: 'otros', label: 'Otros' },
];

// Fechas de PERÚ. Se usan mientras el admin no guarde las suyas.
//   para.roles vacío = cualquier persona; para.genero '' = cualquiera.
//   avisarDias: cuántos días antes se avisa.
//   avisarATodos: también a quien no tiene a nadie anotado al que le toque.
const FESTIVAS_DEFAULT = [
  { id: 'san_valentin', nombre: 'San Valentín', emoji: '💘', activo: true, regla: { tipo: 'fija', mes: 2, dia: 14 }, para: { roles: ['pareja'], genero: '' }, avisarDias: [14, 3], avisarATodos: true },
  { id: 'dia_mujer', nombre: 'Día de la Mujer', emoji: '🌷', activo: true, regla: { tipo: 'fija', mes: 3, dia: 8 }, para: { roles: [], genero: 'Femenino' }, avisarDias: [7, 1], avisarATodos: false },
  { id: 'dia_nino', nombre: 'Día del Niño', emoji: '🧸', activo: true, regla: { tipo: 'movil', mes: 4, diaSemana: 0, ordinal: 2 }, para: { roles: ['hijos', 'sobrinos'], genero: '' }, avisarDias: [10, 3], avisarATodos: false },
  { id: 'dia_madre', nombre: 'Día de la Madre', emoji: '💐', activo: true, regla: { tipo: 'movil', mes: 5, diaSemana: 0, ordinal: 2 }, para: { roles: ['padres'], genero: 'Femenino' }, avisarDias: [14, 7, 2], avisarATodos: true },
  { id: 'dia_padre', nombre: 'Día del Padre', emoji: '👔', activo: true, regla: { tipo: 'movil', mes: 6, diaSemana: 0, ordinal: 3 }, para: { roles: ['padres'], genero: 'Masculino' }, avisarDias: [14, 7, 2], avisarATodos: true },
  { id: 'dia_amistad', nombre: 'Día de la Amistad', emoji: '🤝', activo: true, regla: { tipo: 'movil', mes: 7, diaSemana: 6, ordinal: 1 }, para: { roles: ['amigos'], genero: '' }, avisarDias: [7, 2], avisarATodos: false },
  { id: 'navidad', nombre: 'Navidad', emoji: '🎄', activo: true, regla: { tipo: 'fija', mes: 12, dia: 25 }, para: { roles: [], genero: '' }, avisarDias: [21, 10, 3], avisarATodos: true },
];

// En la web, una fecha festiva solo se muestra cuando faltan estos días o
// menos: con meses de anticipación es ruido (Navidad "en 80 días").
const DIAS_ANTICIPACION = 30;

const DIA_MS = 24 * 60 * 60 * 1000;
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const dos = (n) => String(n).padStart(2, '0');
const aIso = (t) => {
  const d = new Date(t);
  return `${d.getUTCFullYear()}-${dos(d.getUTCMonth() + 1)}-${dos(d.getUTCDate())}`;
};
const deIso = (s) => {
  const m = ISO.exec(String(s || ''));
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};

// "YYYY-MM-DD" de hoy en la hora local del que llama (navegador del cliente).
function hoyLocal(ahora = new Date()) {
  return `${ahora.getFullYear()}-${dos(ahora.getMonth() + 1)}-${dos(ahora.getDate())}`;
}

const entero = (v, def, min, max) => {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) && n >= min && n <= max ? n : def;
};

function normalizarRegla(regla = {}) {
  const mes = entero(regla.mes, 1, 1, 12);
  if (regla.tipo === 'movil') {
    const ordinal = entero(regla.ordinal, 1, -1, 4);
    return { tipo: 'movil', mes, diaSemana: entero(regla.diaSemana, 0, 0, 6), ordinal: ordinal === 0 ? 1 : ordinal };
  }
  return { tipo: 'fija', mes, dia: entero(regla.dia, 1, 1, 31) };
}

function normalizarFestiva(raw = {}) {
  const f = raw || {};
  const roles = Array.isArray(f.para && f.para.roles) ? f.para.roles.filter((r) => ROLES.some((x) => x.id === r)) : [];
  const genero = ['Femenino', 'Masculino'].includes(f.para && f.para.genero) ? f.para.genero : '';
  const avisarDias = [...new Set((Array.isArray(f.avisarDias) ? f.avisarDias : [])
    .map((d) => entero(d, -1, 1, 60)).filter((d) => d > 0))].sort((a, b) => b - a);
  return {
    id: String(f.id || '').trim(),
    nombre: String(f.nombre || '').trim(),
    emoji: String(f.emoji || '').trim().slice(0, 4),
    activo: f.activo !== false,
    regla: normalizarRegla(f.regla),
    para: { roles, genero },
    avisarDias,
    avisarATodos: f.avisarATodos === true,
  };
}

// Avisos de las fechas de cada persona (cumpleaños, aniversario…): cuántos
// días antes. Mismo documento, campo `recordatorioPersonalDias`.
const RECORDATORIO_PERSONAL_DEFAULT = [7, 1];

function normalizarDiasAviso(dias) {
  return [...new Set((Array.isArray(dias) ? dias : [])
    .map((d) => entero(d, -1, 0, 60)).filter((d) => d >= 0))].sort((a, b) => b - a);
}

function recordatorioPersonalDesdeDoc(data) {
  if (!data || !Array.isArray(data.recordatorioPersonalDias)) return [...RECORDATORIO_PERSONAL_DEFAULT];
  return normalizarDiasAviso(data.recordatorioPersonalDias);
}

// "una semana antes y un día antes" (para el texto que ve el cliente).
function textoDiasAviso(dias) {
  const partes = normalizarDiasAviso(dias).map((d) => {
    if (d === 0) return 'el mismo día';
    if (d === 1) return 'un día antes';
    if (d === 7) return 'una semana antes';
    if (d === 14) return 'dos semanas antes';
    return `${d} días antes`;
  });
  if (partes.length <= 1) return partes[0] || '';
  return `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`;
}

// Documento de Firestore → lista. Sin documento, las de Perú por defecto.
function festivasDesdeDoc(data) {
  if (!data || !Array.isArray(data.fechas)) return FESTIVAS_DEFAULT.map(normalizarFestiva);
  return data.fechas.map(normalizarFestiva).filter((f) => f.id && f.nombre);
}

// Día en que cae la regla ese año ("YYYY-MM-DD").
function fechaDelAnio(regla, anio) {
  const r = normalizarRegla(regla);
  if (r.tipo === 'fija') {
    const ultimo = new Date(Date.UTC(anio, r.mes, 0)).getUTCDate();
    return aIso(Date.UTC(anio, r.mes - 1, Math.min(r.dia, ultimo)));
  }
  if (r.ordinal === -1) {
    const ultimo = Date.UTC(anio, r.mes, 0);
    const atras = (new Date(ultimo).getUTCDay() - r.diaSemana + 7) % 7;
    return aIso(ultimo - atras * DIA_MS);
  }
  const primero = Date.UTC(anio, r.mes - 1, 1);
  const adelante = (r.diaSemana - new Date(primero).getUTCDay() + 7) % 7;
  return aIso(primero + (adelante + (r.ordinal - 1) * 7) * DIA_MS);
}

// Próxima vez que se celebra (hoy cuenta): { fecha: 'YYYY-MM-DD', dias }.
function proximaFecha(regla, hoy) {
  const base = deIso(hoy);
  if (base == null) return null;
  const anio = new Date(base).getUTCFullYear();
  let fecha = fechaDelAnio(regla, anio);
  if (deIso(fecha) < base) fecha = fechaDelAnio(regla, anio + 1);
  return { fecha, dias: Math.round((deIso(fecha) - base) / DIA_MS) };
}

// "2.º domingo de mayo" / "25 de diciembre".
function textoRegla(regla) {
  const r = normalizarRegla(regla);
  if (r.tipo === 'fija') return `${r.dia} de ${MESES[r.mes - 1]}`;
  const ord = r.ordinal === -1 ? 'Último' : `${r.ordinal}.º`;
  return `${ord} ${DIAS_SEMANA[r.diaSemana]} de ${MESES[r.mes - 1]}`;
}

// "10 de mayo".
function textoFecha(iso) {
  const t = deIso(iso);
  if (t == null) return '';
  const d = new Date(t);
  return `${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`;
}

// ¿Esta fecha es para esta persona (por su relación y género)?
function aplicaA(festiva, recipient) {
  const f = normalizarFestiva(festiva);
  if (!recipient) return false;
  if (f.para.roles.length && !f.para.roles.includes(recipient.roleKey)) return false;
  if (f.para.genero && recipient.gender !== f.para.genero) return false;
  return true;
}

// Próximas fechas activas, la más cercana primero, con a quién le tocan.
function proximasFestivas(festivas, recipients, hoy) {
  return (festivas || [])
    .map(normalizarFestiva)
    .filter((f) => f.activo)
    .map((f) => ({
      ...f,
      ...proximaFecha(f.regla, hoy),
      personas: (recipients || []).filter((r) => r && r.name && aplicaA(f, r)),
    }))
    .filter((f) => f.fecha)
    .sort((a, b) => a.dias - b.dias);
}

const cuandoTexto = (dias) => {
  if (dias === 0) return 'hoy';
  if (dias === 1) return 'mañana';
  return `en ${dias} días`;
};

const nombresTexto = (personas) => {
  const n = personas.map((p) => String(p.name).trim()).filter(Boolean);
  if (n.length <= 1) return n[0] || '';
  if (n.length === 2) return `${n[0]} y ${n[1]}`;
  return `${n.slice(0, -1).join(', ')} y ${n[n.length - 1]}`;
};

/**
 * Avisos de fechas festivas que tocan HOY para un usuario.
 * `log` = { "fest|<id>|<año del evento>|<dias>": true } de los ya enviados.
 * - Si tiene anotada a alguien a quien le toca: aviso personal con sus nombres.
 * - Si no, y la fecha tiene `avisarATodos`: aviso general.
 * @returns {Array<{key, festiva, dias, fecha, personas, personal, titulo, cuerpo}>}
 */
function avisosFestivosDeHoy(festivas, recipients, hoy, log) {
  const enviados = log || {};
  const out = [];
  for (const f of proximasFestivas(festivas, recipients, hoy)) {
    if (!f.avisarDias.includes(f.dias)) continue;
    const aviso = armarAvisoFestivo(f, recipients, f.fecha, f.dias);
    if (enviados[aviso.key]) continue;
    if (!aviso.personal && !f.avisarATodos) continue;
    out.push(aviso);
  }
  return out;
}

/**
 * Texto de UN aviso festivo, faltando `dias` para `fecha`. Lo usan el motor
 * diario (vía avisosFestivosDeHoy) y la prueba del admin, que lo arma para
 * cualquier fecha aunque hoy no sea día de aviso.
 */
function armarAvisoFestivo(festiva, recipients, fecha, dias) {
  const f = normalizarFestiva(festiva);
  const personas = (recipients || []).filter((r) => r && r.name && aplicaA(f, r));
  const personal = personas.length > 0;
  return {
    key: `fest|${f.id}|${String(fecha).slice(0, 4)}|${dias}`,
    festiva: f,
    dias,
    fecha,
    personas,
    personal,
    titulo: `${f.emoji ? `${f.emoji} ` : ''}${f.nombre} ${cuandoTexto(dias)}`,
    cuerpo: personal
      ? `Te armamos ideas de regalo para ${nombresTexto(personas)}. Pide con tiempo y llega perfecto.`
      : `Es el ${textoFecha(fecha)}. Encuentra el regalo perfecto en Walá y pide con tiempo.`,
  };
}

module.exports = { MESES, DIAS_SEMANA, ORDINALES, ROLES, FESTIVAS_DEFAULT, DIAS_ANTICIPACION, hoyLocal, normalizarRegla, normalizarFestiva, RECORDATORIO_PERSONAL_DEFAULT, normalizarDiasAviso, recordatorioPersonalDesdeDoc, textoDiasAviso, festivasDesdeDoc, fechaDelAnio, proximaFecha, textoRegla, textoFecha, aplicaA, proximasFestivas, avisosFestivosDeHoy, armarAvisoFestivo };
