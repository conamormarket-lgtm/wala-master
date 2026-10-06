// Respuestas de la encuesta de suscripción: resumen para el admin y filas para
// descargar en Excel (CSV). Puro: recibe los perfiles y la configuración de la
// encuesta y devuelve datos listos para pintar. Sin Firebase.
//
// Dónde vive cada respuesta en portal_clientes_users/{uid}:
//   surveyBasicData  { idPregunta: respuesta }   (preguntas de "Datos básicos")
//   giftRoles        { pareja: true, hijos: false, … }   (a quiénes regala)
//   giftRecipients[] personas: nombre, relación, género, presupuesto, fechas,
//                    selectedCategories (conjuntos) y categoryAnswers (gustos)
//   birthDate        cumpleaños propio
//   surveyCompletedAt        cuándo la completó por primera vez (epoch ms). Solo
//                            fechas reales: 'servidor' (desde el 2026-10-06) o
//                            'monedas' (del premio, desde el 2026-06-29; ver
//                            scripts/backfill-fecha-encuesta.js). Sin el campo
//                            = fecha desconocida (la llenó antes y no se guardó).

import { textoFechaEvento } from '../utils/fechaEvento.mjs';

export const ROLES = {
  pareja: 'Pareja', hijos: 'Hijos', padres: 'Padres', hermanos: 'Hermanos',
  sobrinos: 'Sobrinos', primos: 'Primos', amigos: 'Amigos', otros: 'Otros',
};
export const PRESUPUESTOS = {
  hasta50: 'Hasta S/ 50', '50a100': 'S/ 50 – 100', '100a200': 'S/ 100 – 200', mas200: 'Más de S/ 200',
};

// ── Fecha en que completó la encuesta ───────────────────────────────────────
export const fechaEncuesta = (u) => Number(u && u.surveyCompletedAt) || 0;
export const FECHA_DESCONOCIDA = 'Fecha desconocida';

const dos = (n) => String(n).padStart(2, '0');
// Día local YYYY-MM-DD (la tienda opera en Lima, igual que el navegador del admin).
export const diaLocal = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
};

// "06/10/2026 14:05", o "Fecha desconocida" si no se guardó.
export function textoFechaEncuesta(u) {
  const t = fechaEncuesta(u);
  if (!t) return FECHA_DESCONOCIDA;
  const d = new Date(t);
  return `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()} ${dos(d.getHours())}:${dos(d.getMinutes())}`;
}

/**
 * Clientes que completaron la encuesta entre `desde` y `hasta` (YYYY-MM-DD,
 * ambos inclusive; vacío = sin límite). Sin ningún límite devuelve a todos,
 * incluso a los que no tienen fecha.
 */
export function filtrarPorFecha(usuarios, desde, hasta) {
  const lista = usuarios || [];
  if (!desde && !hasta) return lista;
  return lista.filter((u) => {
    const t = fechaEncuesta(u);
    if (!t) return false;
    const dia = diaLocal(t);
    return (!desde || dia >= desde) && (!hasta || dia <= hasta);
  });
}

// Encuestas completadas por día ('dia') o por mes ('mes'), en orden cronológico.
export function porPeriodo(usuarios, unidad = 'mes') {
  const conteo = new Map();
  (usuarios || []).forEach((u) => {
    const t = fechaEncuesta(u);
    if (!t) return;
    const dia = diaLocal(t);
    const k = unidad === 'dia' ? dia : dia.slice(0, 7);
    conteo.set(k, (conteo.get(k) || 0) + 1);
  });
  return [...conteo.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([valor, total]) => ({ valor, total }));
}

// Clave para agrupar respuestas escritas: sin tildes, mayúsculas ni artículos
// al inicio ("El fútbol" = "Fútbol").
const clave = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9& ]+/g, ' ').replace(/\s+/g, ' ').trim()
  .replace(/^(el|la|los|las|un|una) /, '');

// Agrupa respuestas escritas a mano ("Alianza lima", "alianza Lima ") en una
// sola fila y muestra la forma más usada.
function contarTexto(valores) {
  const grupos = new Map();
  valores.forEach((v) => {
    const original = String(v || '').trim();
    const k = clave(original);
    if (!k) return;
    if (!grupos.has(k)) grupos.set(k, { total: 0, formas: new Map() });
    const g = grupos.get(k);
    g.total += 1;
    g.formas.set(original, (g.formas.get(original) || 0) + 1);
  });
  return [...grupos.values()]
    .map((g) => ({
      valor: [...g.formas.entries()].sort((a, b) => b[1] - a[1])[0][0],
      total: g.total,
    }))
    .sort((a, b) => b.total - a.total || a.valor.localeCompare(b.valor, 'es'));
}

function contarOpciones(valores, opciones = []) {
  const conteo = new Map(opciones.map((o) => [o, 0]));
  valores.forEach((v) => {
    const t = String(v || '').trim();
    if (t) conteo.set(t, (conteo.get(t) || 0) + 1);
  });
  return [...conteo.entries()].map(([valor, total]) => ({ valor, total }))
    .sort((a, b) => b.total - a.total);
}

/**
 * @param {Array} usuarios  perfiles con hasCompletedSurvey (o con personas)
 * @param {object} config   tienda_encuesta_config/global
 */
export function resumenEncuesta(usuarios, config) {
  const completas = (usuarios || []).filter((u) => u.hasCompletedSurvey);
  const camposBasicos = (config && config.basicDataPanel && config.basicDataPanel.fields) || [];
  const conjuntos = (config && config.brandsPanel && config.brandsPanel.categories) || [];
  const personas = completas.flatMap((u) => (Array.isArray(u.giftRecipients) ? u.giftRecipients : []));

  // Datos básicos: las de opción se cuentan por opción; las escritas (como el
  // nombre) no tienen sentido en un resumen y se omiten.
  const basicos = camposBasicos
    .filter((f) => f.type === 'select')
    .map((f) => {
      const valores = completas.map((u) => u.surveyBasicData && u.surveyBasicData[f.id]).filter(Boolean);
      return { id: f.id, label: f.label, respondieron: valores.length, opciones: contarOpciones(valores, f.options) };
    });

  const aQuien = Object.entries(ROLES).map(([k, label]) => ({
    valor: label,
    total: completas.filter((u) => u.giftRoles && u.giftRoles[k]).length,
  })).sort((a, b) => b.total - a.total);

  const gustos = conjuntos.map((c) => {
    const conConjunto = personas.filter((p) => (p.selectedCategories || []).includes(c.id));
    return {
      id: c.id,
      nombre: c.name,
      personas: conConjunto.length,
      preguntas: (c.fields || []).map((f) => {
        const valores = conConjunto.map((p) => p.categoryAnswers && p.categoryAnswers[c.id] && p.categoryAnswers[c.id][f.id]).filter(Boolean);
        return {
          id: f.id,
          label: f.label,
          respondieron: valores.length,
          top: f.type === 'select' ? contarOpciones(valores, f.options).filter((x) => x.total > 0) : contarTexto(valores),
        };
      }),
    };
  });

  const presupuesto = contarOpciones(
    personas.map((p) => PRESUPUESTOS[p.budget]).filter(Boolean),
    Object.values(PRESUPUESTOS),
  );

  return {
    clientes: completas.length,
    personas: personas.length,
    conCumpleanos: completas.filter((u) => u.birthDate).length,
    conPresupuesto: personas.filter((p) => p.budget).length,
    basicos,
    aQuien,
    gustos,
    presupuesto,
  };
}

/** Ficha legible de un cliente (para el detalle). */
export function fichaCliente(u, config) {
  const camposBasicos = (config && config.basicDataPanel && config.basicDataPanel.fields) || [];
  const conjuntos = (config && config.brandsPanel && config.brandsPanel.categories) || [];
  return {
    uid: u.id || u.uid,
    nombre: u.displayName || (u.surveyBasicData && u.surveyBasicData.nombres) || 'Sin nombre',
    email: u.email || '',
    telefono: u.phone || '',
    cumpleanos: u.birthDate || '',
    completa: !!u.hasCompletedSurvey,
    basicos: camposBasicos
      .map((f) => ({ label: f.label, valor: (u.surveyBasicData && u.surveyBasicData[f.id]) || '' }))
      .filter((x) => x.valor),
    aQuien: Object.entries(ROLES).filter(([k]) => u.giftRoles && u.giftRoles[k]).map(([, l]) => l),
    personas: (u.giftRecipients || []).map((p) => ({
      nombre: p.name || 'Sin nombre',
      relacion: p.roleDisplay || ROLES[p.roleKey] || '',
      genero: p.gender || '',
      presupuesto: PRESUPUESTOS[p.budget] || '',
      fechas: (p.events || []).filter((e) => e.date)
        .map((e) => `${e.type === 'Fecha Especial' ? (e.customName || 'Fecha especial') : e.type}: ${textoFechaEvento(e.date) || e.date}`),
      gustos: conjuntos
        .filter((c) => (p.selectedCategories || []).includes(c.id))
        .map((c) => ({
          conjunto: c.name,
          respuestas: (c.fields || [])
            .map((f) => ({ label: f.label, valor: (p.categoryAnswers && p.categoryAnswers[c.id] && p.categoryAnswers[c.id][f.id]) || '' }))
            .filter((x) => String(x.valor).trim()),
        })),
    })),
  };
}

const celda = (v) => {
  const t = String(v == null ? '' : v);
  return /[",;\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};

/**
 * CSV con UNA fila por persona cargada (y una fila por cliente sin personas).
 * Separador ";" y BOM para que Excel en español lo abra con tildes y columnas.
 */
export function csvRespuestas(usuarios, config) {
  const camposBasicos = (config && config.basicDataPanel && config.basicDataPanel.fields) || [];
  const conjuntos = (config && config.brandsPanel && config.brandsPanel.categories) || [];
  const columnasGustos = conjuntos.flatMap((c) => (c.fields || []).map((f) => ({ c, f })));
  const cabecera = [
    'Cliente', 'Correo', 'Teléfono', 'Completó la encuesta', 'Cumpleaños del cliente',
    ...camposBasicos.map((f) => f.label),
    'Regala a',
    'Persona', 'Relación', 'Género', 'Presupuesto', 'Fechas', 'Conjuntos',
    ...columnasGustos.map(({ c, f }) => `${c.name}: ${f.label}`),
  ];
  const filas = [cabecera];
  (usuarios || []).forEach((u) => {
    const base = [
      u.displayName || (u.surveyBasicData && u.surveyBasicData.nombres) || '',
      u.email || '', u.phone || '', textoFechaEncuesta(u), u.birthDate || '',
      ...camposBasicos.map((f) => (u.surveyBasicData && u.surveyBasicData[f.id]) || ''),
      Object.entries(ROLES).filter(([k]) => u.giftRoles && u.giftRoles[k]).map(([, l]) => l).join(', '),
    ];
    const personas = Array.isArray(u.giftRecipients) && u.giftRecipients.length ? u.giftRecipients : [null];
    personas.forEach((p) => {
      if (!p) {
        filas.push([...base, '', '', '', '', '', '', ...columnasGustos.map(() => '')]);
        return;
      }
      filas.push([
        ...base,
        p.name || '', p.roleDisplay || ROLES[p.roleKey] || '', p.gender || '', PRESUPUESTOS[p.budget] || '',
        (p.events || []).filter((e) => e.date).map((e) => `${e.type === 'Fecha Especial' ? (e.customName || 'Fecha especial') : e.type} ${textoFechaEvento(e.date) || e.date}`).join(' | '),
        conjuntos.filter((c) => (p.selectedCategories || []).includes(c.id)).map((c) => c.name).join(', '),
        ...columnasGustos.map(({ c, f }) => (p.categoryAnswers && p.categoryAnswers[c.id] && p.categoryAnswers[c.id][f.id]) || ''),
      ]);
    });
  });
  return `﻿${filas.map((r) => r.map(celda).join(';')).join('\r\n')}`;
}
