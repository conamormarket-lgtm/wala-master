import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { getMessage, setMessage } from '../../services/messages';
import { createDocument, getCollection, setDocument } from '../../services/firebase/firestore';
import { getInventoryLogs } from '../../services/inventoryLogs';
import { getLockedPages } from '../../services/lockedPages';
import { saveStorefrontConfig } from '../../pages/Tienda/services/storefront';
import { PaginaWhatsAppAdmin, PaginaHistorialAdmin } from '../../componentes/kit/paginas/admin/Ajustes';
import {
  whatsappDesdeMensajes, whatsappAMensajes, cambioDisenoDesde, conVersionActual, movimientoInventarioDesde,
} from '../../componentes/kit/adaptadoresAdmin';
import { sinError, useLectura, useInvalidar } from './comun';

/*
 * WhatsApp y el historial (D8b): a qué número escribe el cliente según dónde
 * esté, y las copias del diseño de la tienda y los cambios de stock. Los
 * mismos servicios, claves e invalidaciones que AdminWhatsApp y AdminBackups.
 *
 * Restaurar una copia ahora hace lo mismo que guardar en el editor
 * (VisualEditorContext): antes solo escribía storeConfig/homePage y la página
 * de hoy (pages/{id}) no cambiaba (guia/ADMIN.md, "Cómo se une D8b").
 */

const errorDe = (q, texto) => (q.error ? q.error.message || texto : undefined);

/* ── WhatsApp ──────────────────────────────────────────── */

const WHATSAPP = ['admin-whatsapp-numbers'];
// Las que lee whatsappDesdeMensajes (los mensajes de Crear y Mi cuenta ya no los lee nadie).
const CLAVES_WHATSAPP = [
  'whatsapp_number_tienda', 'whatsapp_number_crear', 'whatsapp_number_cuenta',
  'whatsapp_text_tienda', 'whatsapp_mostrar_en_acceso', 'whatsapp_number',
];

/**
 * /admin/whatsapp: los mensajes (messages) en ['admin-whatsapp-numbers'] →
 * whatsappDesdeMensajes. Guardar con setMessage de cada clave de
 * whatsappAMensajes e invalidar también lo que lee la tienda: el botón
 * flotante, el checkout y "¿Problemas para pagar?" de Mi cuenta.
 */
export function WhatsAppDelPanel() {
  const invalidar = useInvalidar();
  const lectura = useLectura(WHATSAPP, async () => {
    const valores = await Promise.all(CLAVES_WHATSAPP.map((k) => getMessage(k)));
    // Si una lectura falla se dice (antes salían los de por defecto y se guardaban encima).
    const fallo = valores.find((r) => r?.error);
    if (fallo) return fallo;
    return { data: whatsappDesdeMensajes(Object.fromEntries(CLAVES_WHATSAPP.map((k, i) => [k, valores[i]?.data ?? '']))) };
  });
  return (
    <PaginaWhatsAppAdmin
      // useQuery da el mismo objeto entre render y render: la página no pierde lo que se escribe.
      config={lectura.datos}
      cargando={lectura.cargando}
      error={lectura.error}
      onReintentar={lectura.onReintentar}
      onGuardar={async (c) => {
        await Promise.all(Object.entries(whatsappAMensajes(c)).map(([k, v]) => sinError(setMessage(k, v))));
        await invalidar(WHATSAPP, ['whatsapp-numbers-config'], ['whatsapp-config-checkout'], ['whatsapp_number_cuenta']);
      }}
    />
  );
}

/* ── El historial ──────────────────────────────────────── */

const COPIAS = ['admin-store-config-logs'];
const MOVIMIENTOS = ['admin-inventory-logs'];

/**
 * Restaura una copia como la guarda el editor: storeConfig/homePage (el menú,
 * la cuenta, el buscador; también lo lee la app) y la página con
 * saveStorefrontConfig; después anota su propia copia en storeConfigLogs, así
 * la más nueva sigue siendo la puesta.
 */
async function restaurarCopia(x) {
  if (!x?.config) throw new Error('Esta copia no tiene diseño guardado.');
  // Como el editor: una página bloqueada no se guarda.
  const bloqueadas = await getLockedPages();
  if (bloqueadas.includes(x.pagina)) throw new Error(`Esta página (${x.pagina}) está bloqueada por un administrador: no se puede restaurar.`);
  await sinError(setDocument('storeConfig', 'homePage', x.config));
  // Las copias de antes de `pages` no traen la lista: sin ella, se vaciaría la página.
  if (Array.isArray(x.config.sections)) await sinError(saveStorefrontConfig(x.config.sections, x.pagina));
  // La misma forma que la del editor (timestamp en texto ISO y pageId).
  await sinError(createDocument('storeConfigLogs', {
    pageId: x.pagina,
    config: x.config,
    timestamp: new Date().toISOString(),
    user: 'Admin',
    description: `Restaurada desde el historial (Página: ${x.pagina})`,
  }));
}

/**
 * /admin/backups: storeConfigLogs por timestamp (de la más nueva), las 50 →
 * cambioDisenoDesde y conVersionActual; getInventoryLogs →
 * movimientoInventarioDesde (se lee al abrir la pestaña).
 */
export function HistorialDelPanel() {
  const invalidar = useInvalidar();
  // ?ver=inventario abre los cambios de stock (el botón de Productos lleva ahí).
  const [searchParams] = useSearchParams();
  const [pestana, setPestana] = useState(() => (searchParams.get('ver') === 'inventario' ? 'inventario' : 'diseno'));

  const copiasQ = useQuery({
    queryKey: COPIAS,
    queryFn: () => sinError(getCollection('storeConfigLogs', [], { field: 'timestamp', direction: 'desc' }, 50)),
  });
  // getInventoryLogs no devuelve { data, error }: la lista (o [] si falla), como antes.
  const movimientosQ = useQuery({ queryKey: MOVIMIENTOS, queryFn: getInventoryLogs, enabled: pestana === 'inventario' });

  const cambios = useMemo(() => conVersionActual((copiasQ.data || []).map(cambioDisenoDesde)), [copiasQ.data]);
  const movimientos = useMemo(() => (movimientosQ.data || []).map(movimientoInventarioDesde), [movimientosQ.data]);

  return (
    <PaginaHistorialAdmin
      pestana={pestana}
      onPestana={setPestana}
      cambios={cambios}
      cargando={copiasQ.isLoading}
      error={errorDe(copiasQ, 'No se pudieron cargar las copias.')}
      onReintentar={() => copiasQ.refetch()}
      onRestaurar={async (x) => {
        await restaurarCopia(x);
        // La config de esa página (home incluida) y lo de storeConfig/homePage (cabecera, cuenta, buscador).
        await invalidar(COPIAS, ['storefront-config', x.pagina], ['store-config-custom']);
      }}
      movimientos={movimientos}
      cargandoMovimientos={movimientosQ.isLoading}
    />
  );
}
