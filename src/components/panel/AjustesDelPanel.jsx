import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navigate, useSearchParams } from 'react-router-dom';
import { getMessage, setMessage } from '../../services/messages';
import { createDocument, getCollection, setDocument } from '../../services/firebase/firestore';
import { getInventoryLogs } from '../../services/inventoryLogs';
import { getBrands, updateBrand } from '../../services/brands';
import { empresa } from '../../config/empresa';
import { getLandingPages } from '../../pages/Tienda/services/landingPages';
import { getLockedPages } from '../../services/lockedPages';
import { saveStorefrontConfig } from '../../pages/Tienda/services/storefront';
import { PaginaWhatsAppAdmin, PaginaHistorialAdmin } from '../../componentes/kit/paginas/admin/Ajustes';
import {
  whatsappDesdeMensajes, whatsappAMensajes, asesoresCambiados, cambioDisenoDesde, conVersionActual, movimientoInventarioDesde, puedeVer,
} from '../../componentes/kit/adaptadoresAdmin';
import { useAuth } from '../../contexts/AuthContext';
import { SinPermiso } from '../../componentes/kit/piezas/admin/Marco';
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
// El de los pedidos y multimarca se cambiaban en Marcas: ahora, aquí.
const CLAVES_WHATSAPP = [
  'whatsapp_number_principal', 'whatsapp_multimarca',
  'whatsapp_number_tienda', 'whatsapp_number_crear', 'whatsapp_number_cuenta',
  'whatsapp_text_tienda', 'whatsapp_mostrar_en_acceso', 'whatsapp_number',
  // Desde 2026-11-05 también los de Gestión de pagos y el teléfono del pie.
  'whatsapp_number_pagos', 'whatsapp_text_pagos', 'yape_number', 'yape_name', 'plin_number', 'plin_name',
  'contacto_telefono',
];
// Las marcas (la misma lista que el botón y el checkout, ['brands']).
const leerMarcas = async () => (await getBrands()).data || [];

/**
 * /admin/whatsapp: los mensajes (messages) en ['admin-whatsapp-numbers'] →
 * whatsappDesdeMensajes. Guardar con setMessage de cada clave de
 * whatsappAMensajes e invalidar también lo que lee la tienda: el botón
 * flotante, el checkout, "¿Problemas para pagar?" de Mi cuenta y la tarjeta
 * de Marcas. Las marcas con el WhatsApp de su asesor salen en «Así queda».
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
  const marcasQ = useQuery({ queryKey: ['brands'], queryFn: leerMarcas, staleTime: 15 * 60 * 1000 });
  // El asesor de cada marca se edita aquí también (se guarda en la marca).
  const asesores = useMemo(() => (marcasQ.data || [])
    .filter((b) => b?.id)
    .map((b) => ({ id: b.id, nombre: b.name || b.slug || b.id, numero: String(b.whatsappNumber || '').trim() })), [marcasQ.data]);
  // Un objeto estable entre dibujos: la página no pierde lo que se escribe.
  const config = useMemo(() => (lectura.datos && marcasQ.data ? { ...lectura.datos, asesores } : null), [lectura.datos, marcasQ.data, asesores]);
  return (
    <PaginaWhatsAppAdmin
      config={config}
      urlMarcas="/admin/marcas"
      contactoPorDefecto={empresa.telefono}
      // El de respaldo de los pedidos sale de config/empresa (un solo lugar en el código).
      fabrica={`+${empresa.whatsapp}`}
      cargando={lectura.cargando || marcasQ.isLoading}
      error={lectura.error}
      onReintentar={lectura.onReintentar}
      onGuardar={async (c) => {
        const { asesores: nuevos, ...resto } = c;
        await Promise.all(Object.entries(whatsappAMensajes(resto)).map(([k, v]) => sinError(setMessage(k, v))));
        await Promise.all(asesoresCambiados(asesores, nuevos).map((a) => sinError(updateBrand(a.id, { whatsappNumber: a.numero }))));
        // Todo lo que lee la tienda y el resto del panel: el botón, el checkout,
        // la hoja de pagar el saldo, Pago rápido, el pie y las marcas.
        await invalidar(
          WHATSAPP, ['whatsapp-numbers-config'], ['whatsapp-config-checkout'], ['whatsapp_number_cuenta'], ['admin-whatsapp-marcas-config'],
          ['pagos-saldo-config'], ['admin-pagos-config'], ['user-pagos-config'], ['whatsapp-principal'], ['whatsapp-pagos'], ['contacto-telefono'],
          ['brands'], ['admin-brands'], ['whatsapp-general'],
        );
      }}
    />
  );
}

/* ── El historial ──────────────────────────────────────── */

const COPIAS = ['admin-store-config-logs'];
const MOVIMIENTOS = ['admin-inventory-logs'];

/**
 * Restaura una copia como la guarda el editor: las secciones en
 * storeConfig/homePage (también lo lee la app) y en la página con
 * saveStorefrontConfig, sin tocar el menú, la cuenta ni el buscador de hoy;
 * después anota su propia copia en storeConfigLogs, así la más nueva sigue
 * siendo la puesta.
 */
async function restaurarCopia(x, correo) {
  if (!x?.config) throw new Error('Esta copia no tiene diseño guardado.');
  // Como el editor: una página bloqueada no se guarda.
  const bloqueadas = await getLockedPages();
  if (bloqueadas.includes(x.pagina)) throw new Error(`Esta página (${x.pagina}) está bloqueada por un administrador: no se puede restaurar.`);
  if (Array.isArray(x.config.sections)) {
    // Solo la página: la copia trae también lo global de ese día (el menú, la
    // cuenta, el buscador) y escribirla entera devolvía TODA la tienda a esa
    // fecha. homePage se mezcla (setDocument con merge) y solo cambia
    // `sections`, como al guardar en el editor.
    await sinError(setDocument('storeConfig', 'homePage', { sections: x.config.sections }));
    await sinError(saveStorefrontConfig(x.config.sections, x.pagina));
  } else {
    // Las copias de antes de `pages` no traen la lista: todo el diseño vivía en
    // homePage, así que se restaura entero (sin ella, se vaciaría la página).
    await sinError(setDocument('storeConfig', 'homePage', x.config));
  }
  // La misma forma que la del editor (timestamp en texto ISO y pageId).
  await sinError(createDocument('storeConfigLogs', {
    pageId: x.pagina,
    config: x.config,
    timestamp: new Date().toISOString(),
    user: 'Admin',
    userEmail: correo || '',
    description: `Restaurada desde el historial (Página: ${x.pagina})`,
  }));
}

/**
 * /admin/backups (Historial del diseño, en Páginas de la tienda):
 * storeConfigLogs por timestamp (de la más nueva), las 50 → cambioDisenoDesde
 * y conVersionActual. ?ver=inventario (el enlace de antes) lleva al de stock.
 */
export function HistorialDelPanel() {
  const invalidar = useInvalidar();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  const copiasQ = useQuery({
    queryKey: COPIAS,
    queryFn: () => sinError(getCollection('storeConfigLogs', [], { field: 'timestamp', direction: 'desc' }, 50)),
  });

  const cambios = useMemo(() => conVersionActual((copiasQ.data || []).map(cambioDisenoDesde)), [copiasQ.data]);
  // Los nombres de las páginas de marca y de las landings (si no, sale /slug).
  const marcasQ = useQuery({ queryKey: ['brands'], queryFn: leerMarcas, staleTime: 15 * 60 * 1000 });
  const landingsQ = useQuery({ queryKey: ['admin-landing-pages'], queryFn: getLandingPages, staleTime: 5 * 60 * 1000 });
  const nombresPaginas = useMemo(() => {
    const n = {};
    (landingsQ.data || []).forEach((p) => { const t = p.title || p.nombre; if (t) { n[p.id] = t; if (p.slug) n[p.slug] = t; } });
    (marcasQ.data || []).forEach((b) => { if (b?.slug && b.name) n[b.slug] = b.name; });
    return n;
  }, [marcasQ.data, landingsQ.data]);

  if (searchParams.get('ver') === 'inventario') return <Navigate to="/admin/historial-stock" replace />;
  return (
    <PaginaHistorialAdmin
      pestana="diseno"
      conPestanas={false}
      cambios={cambios}
      nombresPaginas={nombresPaginas}
      cargando={copiasQ.isLoading}
      error={errorDe(copiasQ, 'No se pudieron cargar las copias.')}
      onReintentar={() => copiasQ.refetch()}
      onRestaurar={async (x) => {
        await restaurarCopia(x, user?.email);
        // La config de esa página (home incluida) y lo de storeConfig/homePage (cabecera, cuenta, buscador).
        await invalidar(COPIAS, ['storefront-config', x.pagina], ['store-config-custom']);
      }}
    />
  );
}

/**
 * /admin/historial-stock (desde Productos; no está en el menú): getInventoryLogs
 * → movimientoInventarioDesde. Lo abren Catálogo e Inventario.
 */
export function HistorialStockDelPanel() {
  const { adminPermissions } = useAuth();
  const puede = puedeVer({ permiso: ['catalogo', 'inventario'] }, adminPermissions || []);
  // getInventoryLogs no devuelve { data, error }: la lista (o [] si falla), como antes.
  const movimientosQ = useQuery({ queryKey: MOVIMIENTOS, queryFn: getInventoryLogs, enabled: puede });
  const movimientos = useMemo(() => (movimientosQ.data || []).map(movimientoInventarioDesde), [movimientosQ.data]);
  if (!puede) return <SinPermiso permiso="Catálogo o Inventario" />;
  return (
    <PaginaHistorialAdmin
      pestana="inventario"
      conPestanas={false}
      movimientos={movimientos}
      cargandoMovimientos={movimientosQ.isLoading}
    />
  );
}
