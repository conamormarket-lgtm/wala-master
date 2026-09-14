export const LOGO_URL = "/logo-wala.png";
export const WHATSAPP_NUMBER = "51912881722";
export const WHATSAPP_MESSAGE = "Hola, quiero hacer un nuevo pedido";

export const ETAPAS_TIMELINE = [
  { nombre: 'Compra', key: 'compra' },
  { nombre: 'Diseño', key: 'diseno' },
  { nombre: 'Impresión', key: 'impresion' },
  { nombre: 'Preparación', key: 'preparacion' },
  { nombre: 'Estampado', key: 'estampado' },
  { nombre: 'Empaquetado', key: 'empaquetado' },
  { nombre: 'Reparto', key: 'reparto' },
  { nombre: 'Finalizado', key: 'finalizado' }
];

export const ESTADOS_COLORS = {
  'finalizado': 'var(--verde-exito)',
  'reparto': '#17a2b8',
  'preparación': '#ffc107',
  'preparacion': '#ffc107',
  'estampado': '#fd7e14',
  'pendiente': '#6f42c1',
  'anulado': 'var(--rojo-principal)',
  'diseño': '#6f42c1',
  'diseno': '#6f42c1',
  'impresion': '#17a2b8',
  'empaquetado': '#20c997'
};

/** Mapeo estado (normalizado a key) → texto para badge. "Finalizado" se mantiene; el resto "En X". */
const ESTADO_BADGE_LABEL = {
  diseno: 'En Diseño',
  diseño: 'En Diseño',
  impresion: 'En Impresión',
  preparacion: 'En Preparación',
  'preparación': 'En Preparación',
  estampado: 'En Estampado',
  empaquetado: 'En Empaquetado',
  reparto: 'En Reparto',
  finalizado: 'Finalizado',
  pendiente: 'Pendiente',
  anulado: 'Anulado'
};

/**
 * Normaliza el estado del pedido a una key (ej. "impresion", "diseno") para comparaciones.
 * "En Impresión" -> "impresion", "En Diseño" -> "diseno", etc., para que coincida con ETAPAS_TIMELINE.
 */
export function estadoToKey(estado) {
  if (estado == null || estado === '') return null;
  let key = String(estado)
    .toLowerCase()
    .replace(/\s/g, '')
    .replace(/ó/g, 'o')
    .replace(/í/g, 'i')
    .replace(/ñ/g, 'n');
  if (key.startsWith('en') && key.length > 2) key = key.slice(2);
  return key;
}

/**
 * Normaliza el estado para detectar en qué cola se encuentra (para casos como "LISTO PARA ...").
 *
 * "Pausa por stock" cuenta como parte de la etapa de preparación (el pedido
 * sigue ahí, solo detenido esperando insumos) — pedido a mano: que se lea
 * "En Preparación" en vez de exponer el motivo interno del taller.
 */
export function getQueueStage(estado) {
  if (estado == null || estado === '') return null;
  const str = String(estado).toLowerCase();
  if (str.includes('diseno') || str.includes('diseño') || str.includes('diseñar')) return 'diseno';
  if (str.includes('impresion') || str.includes('impresión') || str.includes('imprimir')) return 'impresion';
  if (str.includes('preparacion') || str.includes('preparación') || str.includes('preparar') || str.includes('stock')) return 'preparacion';
  if (str.includes('estampado') || str.includes('estampar')) return 'estampado';
  if (str.includes('empaquetado') || str.includes('empaquetar')) return 'empaquetado';
  return null;
}
/**
 * Devuelve el texto a mostrar en el badge de etapa. Si no está en el mapeo, devuelve el estado tal cual (capitalizado).
 *
 * Antes solo probaba estadoToKey (normaliza espacios/tildes, sin más) — un
 * estado como "Listo para preparar" no calzaba con ninguna key del mapeo y
 * el badge terminaba mostrando el texto crudo del ERP tal cual. getQueueStage
 * SÍ reconoce esas variantes por substring (mismo criterio que ya usa el
 * stepper de Timeline.jsx para elegir el paso "actual"); probarlo primero
 * acá evita que el badge y el stepper cuenten una historia distinta para el
 * mismo pedido.
 */
export function getEtapaBadgeLabel(estado) {
  if (estado == null || estado === '') return 'Pendiente';
  const key = getQueueStage(estado) || estadoToKey(estado) || '';
  return ESTADO_BADGE_LABEL[key] ?? ESTADO_BADGE_LABEL[key.replace(/[íi]/g, 'i')] ?? (estado || 'Pendiente');
}

export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
