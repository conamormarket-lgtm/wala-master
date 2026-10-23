import React, { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueries } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useGlobalToast } from '../../contexts/ToastContext';
import { usePedidos } from '../../hooks/usePedidos';
import { ETAPAS_TIMELINE, PASOS_GENERALES, estadoToKey, etapaDeTimeline, getQueueStage } from '../../utils/constants';
import { derivarEstadoCompra, getProductosPedido, getCodigoPedido, getNumeroProduccion, getBrandIdsDePedido } from '../../utils/estadoCompra';
import { normalizarPedidoParaVista } from '../../utils/pedidos';
import { showFlyingCoins } from '../../utils/animations';
import { getBrands } from '../../services/brands';
import { getMessage } from '../../services/messages';
import { getFeaturedProducts, getProductsByCategory, getCategories } from '../../services/products';
import { listFilesInFolder } from '../../services/firebase/storage';
import { precalentarFunciones } from '../../services/checkoutPayment';
import { getFx, penToUsd } from '../../services/fx';
import { leerSurveyConfig, configEntregaPanel } from '../../services/encuestaConfig';
import CulqiCustomCheckout from '../CulqiCustomCheckout';
import TarjetaDeProducto from '../producto/TarjetaDeProducto';
import { consultaProducto } from '../regalar/regaloDeLista';
import { imagenDeLinea } from './resumenPedido';
import { PaginaDetallePedido } from '../../componentes/kit/paginas/CuentaPedidos';
import { HojaPagarSaldo } from '../../componentes/kit/piezas/DetallePedido';
import { PagoTarjeta } from '../../componentes/kit/piezas/Pago';

// PayPal baja aparte, recién al abrir "Pagar el saldo".
const PaypalCheckout = lazy(() => import('../PaypalCheckout'));

/*
 * Detalle de una compra (/cuenta/pedidos/:id), paso 7 de la migración:
 * PaginaDetallePedido del kit. Lo de antes, en
 * pages/cuenta/CuentaCompraDetalleViejo.jsx (interruptores cuentaVieja o
 * pagosViejo).
 *
 * El pedido es el de la lista (usePedidos → misPedidosSecure): el servidor
 * manda el documento completo y la deuda que se cobra (conDeuda/montoDeuda);
 * solo se muestran los pedidos que confirmó que son de esta cuenta. Antes se
 * volvía a leer por id; ya no hace falta.
 *
 * El dinero sale igual que antes: Culqi cobra `pedido.montoDeuda` (el
 * servidor lo vuelve a calcular y rechaza otro monto) y PayPal muestra los
 * dólares que cobra el servidor (config/fx con su margen). Al pagar se
 * recarga el pedido: la deuda vieja no se queda en pantalla.
 */

const DEUDA_IMPRESION_MENSAJE = 'STOP... TIENES UNA DEUDA PENDIENTE, POR FAVOR REALIZA TU PAGO PARA QUE TU PEDIDO PUEDA CONTINUAR AVANZANDO';
const COMPLETADOS = ['finalizado', 'entregado', 'completado'];

/** Número de WhatsApp como en el resto de la tienda: sin signos y con 51 si tiene 9 dígitos o menos. */
const normalizarWhatsapp = (num) => {
  if (!num) return '';
  let limpio = String(num).replace(/[\s\-()+]/g, '');
  if (limpio && !limpio.startsWith('51') && limpio.length <= 9) limpio = `51${limpio}`;
  return limpio;
};
const enlaceConsulta = (numero, codigo, numeroProduccion) => {
  const n = normalizarWhatsapp(numero);
  if (!n) return null;
  const mensaje = `Hola, quiero consultar el estado de mi pedido #${codigo}${numeroProduccion ? ` (N.º de producción ${numeroProduccion})` : ''}`;
  return `https://wa.me/${n}?text=${encodeURIComponent(mensaje)}`;
};

const num = (v) => {
  if (v == null || v === '') return 0;
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
};
const aFecha = (v) => {
  if (!v) return null;
  const d = typeof v?.toDate === 'function' ? v.toDate() : v instanceof Date ? v : (typeof v === 'string' || typeof v === 'number') ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
};
const fechaLarga = (v) => {
  if (typeof v === 'string' && !/^\d{4}-\d{2}-\d{2}/.test(v)) return v;
  const d = aFecha(v);
  return d ? d.toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' }) : null;
};
/** "12 oct" para una fecha de etapa; un texto que no es fecha queda tal cual. */
const fechaCorta = (v) => {
  if (typeof v === 'string' && !/^\d{4}-\d{2}-\d{2}/.test(v)) return v;
  const d = aFecha(v);
  return d ? d.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' }) : null;
};
const tonoDe = (key) => ({ anulado: 'peligro', entregado: 'exito', por_confirmar_pago: 'aviso' }[key] || 'violeta');

/** Las piezas de un combo de la tienda con su talla y color (subProductos del ERP o piezas del espejo). */
const piezasDeCombo = (linea) => {
  if (Array.isArray(linea?.piezas)) return linea.piezas.filter(Boolean);
  const subs = linea?.subProductos && typeof linea.subProductos === 'object' ? Object.values(linea.subProductos).filter(Boolean) : [];
  return subs.map((s) => ({ nombre: s.producto || 'Prenda', talla: s.talla || '', color: s.color || '' }));
};

export default function DetallePedidoDeCuenta() {
  const { id } = useParams();
  const { user, userProfile, loading: cargandoSesion, claimMonedas } = useAuth();
  const toast = useGlobalToast();
  const dni = userProfile?.dni ? String(userProfile.dni).trim() : '';
  const uid = user?.uid || undefined;

  // La misma lista que Mis pedidos (y su copia en memoria).
  const { loading, data, buscar, recargar } = usePedidos(dni, uid);
  const [buscado, setBuscado] = useState(false);
  useEffect(() => {
    if (cargandoSesion || !uid || buscado) return;
    setBuscado(true);
    buscar(dni, uid);
  }, [cargandoSesion, dni, uid, buscado, buscar]);

  const normal = useMemo(() => (data?.pedidos || []).find((p) => p.id === id) || null, [data, id]);
  const crudo = normal?._raw || null;
  // El pedido de la página: el del servidor, con su deuda y el estado de Walá
  // (lo mismo que armaba la página de antes). Memorizado: Culqi depende de él.
  const pedido = useMemo(() => {
    if (!crudo) return null;
    const walaEstado = crudo.estadoWala ?? crudo._walaEstado ?? null;
    const walaPagado = crudo._walaPagado === true || crudo.pagado === true;
    return {
      ...crudo,
      ...(typeof crudo.conDeuda === 'boolean' ? { conDeuda: crudo.conDeuda, montoDeuda: crudo.montoDeuda ?? 0 } : {}),
      ...(walaEstado != null && { _walaEstado: walaEstado }),
      ...(walaPagado && { _walaPagado: true }),
    };
  }, [crudo]);

  // Los productos de las líneas (foto, marca y categoría): uno por uno, no el catálogo entero.
  const lineas = useMemo(() => getProductosPedido(pedido), [pedido]);
  const idsProducto = useMemo(() => [...new Set(lineas.map((l) => l?.productoId).filter((x) => x != null).map(String))], [lineas]);
  const productosQ = useQueries({ queries: idsProducto.map(consultaProducto) });
  const productoDe = (pid) => productosQ[idsProducto.indexOf(String(pid))]?.data || undefined;
  const productosDeLineas = productosQ.map((q) => q.data).filter(Boolean);

  const { data: marcas = [] } = useQuery({
    queryKey: ['brands'],
    queryFn: async () => (await getBrands()).data || [],
    staleTime: 10 * 60 * 1000,
    enabled: Boolean(pedido),
  });
  const { data: numeroGeneral } = useQuery({
    queryKey: ['whatsapp_number_cuenta'],
    queryFn: async () => {
      const cuenta = await getMessage('whatsapp_number_cuenta');
      if (cuenta.data && cuenta.data.trim()) return cuenta.data.trim();
      const general = await getMessage('whatsapp_number');
      return general.data?.trim() || '';
    },
    staleTime: 10 * 60 * 1000,
    enabled: Boolean(pedido),
  });

  /* ── Recomendados: al acercarse ── */
  const [abajo, setAbajo] = useState(false);
  const verAbajo = useCallback(() => setAbajo(true), []);
  const categoria = useMemo(() => {
    for (const l of lineas) {
      const p = productoDe(l?.productoId);
      const c = p?.categories?.[0] || p?.category || l?.categories?.[0] || l?.category;
      if (c) return String(c);
    }
    return null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineas, productosDeLineas.length]);
  const { data: categorias = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => (await getCategories()).data || [],
    staleTime: 15 * 60 * 1000,
    enabled: abajo,
  });
  const { data: reco = [] } = useQuery({
    queryKey: ['reco-detalle', categoria],
    queryFn: async () => {
      if (categoria) {
        const { data: porCategoria, error } = await getProductsByCategory(categoria);
        if (!error && Array.isArray(porCategoria) && porCategoria.length >= 2) return porCategoria;
      }
      const { data: destacados, error } = await getFeaturedProducts();
      if (error) throw new Error(error);
      return destacados || [];
    },
    staleTime: 5 * 60 * 1000,
    enabled: abajo && Boolean(pedido),
  });
  const Tarjeta = useMemo(() => function TarjetaRecomendada({ producto }) {
    return <TarjetaDeProducto product={producto} categories={categorias} />;
  }, [categorias]);

  /* ── Pagar el saldo ── */
  const [pagando, setPagando] = useState(false);
  const { data: configPagos } = useQuery({
    queryKey: ['user-pagos-config'],
    queryFn: async () => {
      const [yapeNum, yapeName, plinNum, plinName, waPagos, waRespaldo, waTexto] = await Promise.all([
        getMessage('yape_number'), getMessage('yape_name'), getMessage('plin_number'), getMessage('plin_name'),
        getMessage('whatsapp_number_pagos'), getMessage('whatsapp_number_cuenta'), getMessage('whatsapp_text_pagos'),
      ]);
      return {
        yape_number: yapeNum.data?.trim() || '',
        yape_name: yapeName.data?.trim() || '',
        plin_number: plinNum.data?.trim() || '',
        plin_name: plinName.data?.trim() || '',
        whatsapp_pagos: waPagos.data?.trim() || waRespaldo.data?.trim() || '',
        whatsapp_pagos_text: waTexto.data || 'Hola, quiero pagar mi saldo pendiente del pedido *#{id}*. Adjunto mi comprobante por S/ *{monto}*.',
      };
    },
    // Recién al abrir la hoja (antes, al entrar a cualquier pedido con deuda).
    enabled: pagando && Boolean(pedido?.conDeuda),
  });
  // "¿Cómo te fue con este pedido?": si el admin la tiene prendida y con cuántas monedas.
  const { data: encuestaEntrega } = useQuery({
    queryKey: ['encuesta-entrega-config'],
    queryFn: async () => configEntregaPanel((await leerSurveyConfig()).data?.entregaPanel),
    staleTime: 600_000,
  });
  const { data: fx } = useQuery({ queryKey: ['fx'], queryFn: getFx, enabled: pagando, staleTime: 600_000 });
  const abrirPago = useCallback(() => {
    setPagando(true);
    precalentarFunciones(['processCulqiPayment', 'createPaypalOrderSecure', 'capturePaypalOrderSecure']);
  }, []);
  // Pagado: se cierra la hoja y se recarga el pedido (con la deuda al día).
  const pagado = useCallback(() => {
    setPagando(false);
    recargar();
  }, [recargar]);

  const [monedasLocal, setMonedasLocal] = useState(false);

  /* ── Estados ── */
  const cargando = cargandoSesion || !buscado || (loading && !normal);
  if (cargando && !pedido) return <PaginaDetallePedido cargando />;
  if (!pedido) return <PaginaDetallePedido noEncontrado />;

  /* ── El pedido para el kit ── */
  const estado = derivarEstadoCompra(pedido);
  const codigo = getCodigoPedido(pedido);
  const numeroProduccion = getNumeroProduccion(pedido);
  const vista = normalizarPedidoParaVista(pedido) || {};
  const produccion = Object.keys(vista.fechas || {}).length > 0;
  const deuda = pedido.conDeuda ? num(pedido.montoDeuda) : 0;

  let pasos;
  let paso;
  let hechos;
  let fechasPasos = {};
  if (produccion) {
    // Como la línea del taller: hecha es la etapa que tiene fecha; la actual sale del estado.
    pasos = ETAPAS_TIMELINE.map((e) => e.nombre);
    const actual = pedido.estadoGeneral ? etapaDeTimeline(getQueueStage(pedido.estadoGeneral) || estadoToKey(pedido.estadoGeneral)) : null;
    paso = ETAPAS_TIMELINE.findIndex((e) => e.key === actual);
    const fechaDe = (e) => (e.key === 'compra' ? vista.fechaCompra : vista.fechas?.[e.key]);
    hechos = ETAPAS_TIMELINE.map((e) => Boolean(fechaDe(e)));
    ETAPAS_TIMELINE.forEach((e, i) => {
      const f = fechaCorta(fechaDe(e));
      if (f && (hechos[i] || i === paso)) fechasPasos[i] = f;
    });
  } else {
    pasos = PASOS_GENERALES;
    const mapa = { por_confirmar_pago: 0, pago_confirmado: 1, en_preparacion: 2, entregado: 4, anulado: -1 };
    paso = mapa[estado.key] ?? 0;
  }

  const productos = lineas.map((l, i) => {
    const producto = productoDe(l?.productoId);
    const piezas = piezasDeCombo(l);
    const crear = l?.comboCrear;
    const cantidad = num(l?.cantidad) || 1;
    const conPrecio = l?.subtotal != null || l?.precio != null;
    return {
      id: `${l?.productoId || 'item'}-${i}`,
      nombre: (piezas.length && l?.combo) || (crear && l?.prendaNombre) || l?.producto || l?.nombre || producto?.name || 'Producto',
      imagen: imagenDeLinea(l, producto) || undefined,
      talla: l?.talla || undefined,
      color: l?.color || l?.colorPrenda || undefined,
      personalizado: Boolean(l?.personalizado),
      cantidad,
      subtotal: conPrecio ? (l?.subtotal != null ? num(l.subtotal) : num(l?.precio) * cantidad) : undefined,
      combo: crear && l?.combo ? `Combo ${l.combo} · ${Number(crear.pieza || 0) + 1} de ${crear.de || 1}` : undefined,
      piezas: piezas.map((pz) => [pz.nombre, pz.color, pz.talla && `Talla ${pz.talla}`].filter(Boolean).join(' · ')),
    };
  });

  // Totales: solo se leen (no se recalcula ningún cobro). Un pedido hecho en el
  // taller no trae precios por línea: Productos = el total y sin fila de envío.
  const conSubtotales = lineas.some((l) => l?.subtotal != null || l?.precio != null);
  const totalLineas = lineas.reduce((a, l) => a + (l?.subtotal != null ? num(l.subtotal) : num(l?.precio) * num(l?.cantidad)), 0);
  const descuentoMonedas = num(pedido.descuentoMonedas);
  const total = num(pedido.montoTotal ?? pedido.total);
  const envioGuardado = pedido.costoEnvio ?? pedido.envioMonto ?? pedido.montoEnvio;
  const envio = !conSubtotales ? undefined : envioGuardado != null ? num(envioGuardado) : Math.max(0, total - (totalLineas - descuentoMonedas));

  const direccion = pedido.envioDireccion || pedido.direccion || pedido.clienteDireccion || '';
  const lugar = [pedido.envioDistrito || pedido.clienteDistrito || pedido.distrito, pedido.envioDepartamento || pedido.envioCiudad || pedido.clienteDepartamento || pedido.ciudad].filter(Boolean).join(', ');

  // WhatsApp: el de cada marca del pedido o el general; sin número, apagado.
  const conNumero = getBrandIdsDePedido(pedido, productosDeLineas)
    .map((bid) => {
      const m = (marcas || []).find((x) => x.id === bid);
      const enlace = m?.whatsappNumber ? enlaceConsulta(m.whatsappNumber, codigo, numeroProduccion) : null;
      return enlace ? { texto: `Consultar a ${m?.name || 'la marca'} por WhatsApp`, url: enlace } : null;
    })
    .filter(Boolean);
  const whatsapp = conNumero.length > 1
    ? conNumero
    : [{ texto: 'Consultar estado de mi pedido', url: conNumero[0]?.url || enlaceConsulta(numeroGeneral, codigo, numeroProduccion) || null }];

  /* ── Pagos y documentos ── */
  const historialCrudo = Array.isArray(vista.historialPagos) ? vista.historialPagos : [];
  const historial = [...historialCrudo].reverse().map((h) => ({
    monto: num(h?.monto),
    fecha: h?.fecha ? (fechaLarga(h.fecha) || String(h.fecha)) : null,
    hora: h?.hora || undefined,
    metodo: h?.metodo || h?.metodoPago || undefined,
  }));
  const estadoKey = estadoToKey(pedido.estadoGeneral);
  const completado = COMPLETADOS.includes(estadoKey);
  const idMonedas = String(pedido.id ?? '').trim();
  const reclamadas = (Array.isArray(userProfile?.monedasReclamadas) ? userProfile.monedasReclamadas : []).map((x) => String(x ?? '').trim());
  const pagos = {
    // Sin deuda y sin pagar: el estado del pedido, como antes ("Pendiente de pago"…).
    estadoPago: estado.label,
    historial,
    // Lo abonado: el total menos la deuda que calcula el servidor (incluye el adelanto).
    abonado: deuda > 0 || estado.paid ? Math.max(0, total - deuda) : undefined,
    onBoletas: async () => {
      const { urls, error } = await listFilesInFolder(`00${pedido.id}`);
      if (error) throw new Error(error);
      return urls || [];
    },
    onFotosEnvio: async () => {
      const guardadas = pedido.reparto?.boletasEnvio;
      if (Array.isArray(guardadas) && guardadas.length) return guardadas.map((b) => b.url || b);
      let { urls, error } = await listFilesInFolder(`boletas_envio/00${pedido.id}`);
      if (error || !urls?.length) ({ urls } = await listFilesInFolder(`boletas_envio/${pedido.id}`));
      return urls || [];
    },
    monedas: completado ? {
      cantidad: 10,
      reclamadas: reclamadas.includes(idMonedas) || monedasLocal,
      onReclamar: async (boton) => {
        const r = boton?.getBoundingClientRect?.();
        const res = await claimMonedas(idMonedas, 10);
        if (res?.error) {
          toast.error('No pudimos reclamar tus monedas. Inténtalo de nuevo.');
          return;
        }
        setMonedasLocal(true);
        if (r) showFlyingCoins(r.left + r.width / 2, r.top);
      },
    } : undefined,
  };

  // El comprobante por WhatsApp: el mismo mensaje de antes (con el id del pedido y el monto de la deuda).
  let urlComprobante = null;
  if (configPagos?.whatsapp_pagos) {
    const limpio = configPagos.whatsapp_pagos.replace(/[^\d+]/g, '');
    const numero = (limpio.startsWith('+') ? limpio : `+51${limpio}`).replace('+', '');
    const texto = configPagos.whatsapp_pagos_text.replace('{id}', pedido.id).replace('{monto}', pedido.montoDeuda ?? '0.00');
    urlComprobante = `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
  }

  return (
    <>
      <PaginaDetallePedido
        pedido={{
          codigo,
          numeroProduccion: numeroProduccion || undefined,
          fecha: fechaLarga(pedido.createdAt ?? pedido.fechaCompra),
          estado: { texto: estado.label, tono: tonoDe(estado.key) },
          pago: { texto: estado.paymentLabel, pagado: estado.paid !== false },
          produccion,
          pasos,
          paso,
          hechos,
          fechasPasos,
          anulado: estado.key === 'anulado',
          deuda,
          avisoDeuda: estadoKey === 'impresion' && pedido.conDeuda ? DEUDA_IMPRESION_MENSAJE : undefined,
          productos,
          direccion: direccion || lugar ? { linea: direccion || lugar, lugar: direccion ? lugar : undefined } : undefined,
          resumen: { productos: conSubtotales ? totalLineas : total, descuentoMonedas, envio, total, pago: estado.paymentLabel },
        }}
        pagos={pagos}
        onPagar={deuda > 0 ? abrirPago : undefined}
        whatsapp={whatsapp}
        opinar={completado && encuestaEntrega?.activo ? { url: `/opinar/${encodeURIComponent(codigo)}`, monedas: encuestaEntrega.monedas } : undefined}
        recomendados={(reco || []).filter((p) => p && p.visible !== false && !idsProducto.includes(String(p.id))).slice(0, 8)}
        tarjeta={Tarjeta}
        onVerAbajo={verAbajo}
      />
      {deuda > 0 && (
        <HojaPagarSaldo
          abierta={pagando}
          onCerrar={() => setPagando(false)}
          monto={deuda}
          cargando={!configPagos}
          yape={configPagos?.yape_number ? { numero: configPagos.yape_number, nombre: configPagos.yape_name } : undefined}
          plin={configPagos?.plin_number ? { numero: configPagos.plin_number, nombre: configPagos.plin_name } : undefined}
          urlComprobante={urlComprobante}
          tarjeta={pagando && (
            <>
              <CulqiCustomCheckout
                pedido={pedido}
                onSuccess={pagado}
                renderBoton={({ abrir, procesando }) => <PagoTarjeta monto={deuda} procesando={procesando} onPagar={abrir} />}
              />
              {/* Con el tipo de cambio ya leído: el monto que se ve es el que cobra el servidor. */}
              {fx && (
                <Suspense fallback={null}>
                  <PaypalCheckout pedido={pedido} amountUsd={penToUsd(deuda, fx)} onSuccess={pagado} />
                </Suspense>
              )}
            </>
          )}
        />
      )}
    </>
  );
}
