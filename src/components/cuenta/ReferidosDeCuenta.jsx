import React, { useEffect, useMemo, useState } from 'react';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Clock, AlertCircle, UserPlus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useGlobalToast } from '../../contexts/ToastContext';
import {
  getReferralsByReferrer,
  claimReferralCoins,
  getReferralOrderDetail,
  getTopReferrersOfMonth,
  estimateReferralReward,
  linkInvitacion,
  VENTANA_REFERIDO_MS,
  VENTANA_INVITACION_MS,
  BONO_BIENVENIDA_INVITACION,
  PREMIO_INVITACION,
} from '../../services/referrals';
import { getProduct } from '../../services/products';
import { volarMonedasGanadas } from '../../utils/animations';
import { PaginaReferidos } from '../../componentes/kit/paginas/CuentaRecompensas';
import { useTexto } from '../../componentes/kit/Traduccion';

/*
 * Mis referidos (/cuenta/referidos), paso 6 de la migración: PaginaReferidos
 * del kit. Lo de antes, en pages/cuenta/CuentaReferidosViejo.jsx (interruptor
 * cuentaVieja).
 *
 * Cada doc de `referrals` es UNA persona que abrió un link; se agrupan por
 * link (tu invitación, cada producto, la tienda, los links anteriores), con
 * los mismos estados, plazos y avisos de antes. El pedido de cada persona
 * (detalleReferidoSecure) se pide solo para las compras por reclamar (para
 * saber si ya se entregó) y, para las demás, al abrir "Ver pedido". El
 * ranking del mes, al acercarse.
 */

// Grupo de cada persona (por el link que abrió).
const grupoDe = (r) => {
  if (r.tipo === 'invitacion') return 'invitacion';
  if (r.productId) return `producto:${r.productId}`;
  if (r.linkId || !r.tipo) return 'anteriores';
  return 'tienda';
};

const ms = (t) => t?.toMillis?.() || 0;
const actividad = (r) => Math.max(ms(r.claimedAt), ms(r.purchasedAt), ms(r.aceptadaAt), ms(r.clickedAt), ms(r.createdAt));
const fechaCorta = (t) => {
  const v = ms(t);
  return v ? new Date(v).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' }) : '';
};
const fechaLarga = (iso) => {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
};

// "12 h 30 min" / "45 min" / "menos de 1 min". null si ya venció.
const restanteLegible = (resta) => {
  if (!(resta > 0)) return null;
  const totalMin = Math.floor(resta / 60000);
  const horas = Math.floor(totalMin / 60);
  if (horas >= 48) return `${Math.floor(horas / 24)} días`;
  if (horas > 0) return `${horas} h ${totalMin % 60} min`;
  if (totalMin > 0) return `${totalMin} min`;
  return 'menos de 1 min';
};

// Etapa del pedido (detalleReferidoSecure → referidosLogic.estadoPedidoReferido).
const ETAPAS = {
  por_confirmar: { texto: 'Por confirmar', tono: 'neutro', nota: 'Walá todavía está confirmando este pedido.' },
  confirmado: { texto: 'Confirmado', tono: 'violeta', nota: 'El pedido ya está confirmado.' },
  produccion: { texto: 'En producción', tono: 'violeta', nota: 'Lo estamos preparando.' },
  enviado: { texto: 'En camino', tono: 'violeta', nota: 'Ya salió a reparto.' },
  entregado: { texto: 'Entregado', tono: 'exito', nota: 'Ya se entregó: puedes reclamar tus monedas.' },
  anulado: { texto: 'Anulado', tono: 'neutro', nota: 'Este pedido se anuló, así que no genera monedas.' },
};

/** Estado de una persona, en palabras (como antes). */
function estadoDe(r, ahora) {
  const conCompra = ['purchased', 'completed', 'claimed'].includes(r.status);
  if (r.status === 'claimed') return { clave: 'reclamado', conCompra };
  if (r.status === 'ineligible') return { clave: 'no_califico', conCompra: false };
  if (conCompra) return { clave: 'compro', conCompra };
  if (r.status === 'registered') {
    const resta = ms(r.aceptadaAt) + VENTANA_INVITACION_MS - ahora;
    return { clave: resta > 0 ? 'cuenta_nueva' : 'vencido', resta };
  }
  const resta = ms(r.clickedAt) + VENTANA_REFERIDO_MS - ahora;
  return { clave: resta > 0 ? 'entro' : 'vencido', resta };
}

/** El pedido (respuesta de detalleReferidoSecure) → props de DetallePedidoReferido. */
const pedidoDesde = (consulta) => {
  if (!consulta || consulta.isPending) return { cargando: true };
  if (consulta.isError || !consulta.data) return { error: consulta.error?.message || true };
  const d = consulta.data;
  const etapa = ETAPAS[d.etapa] || ETAPAS.confirmado;
  return {
    etapa: { texto: etapa.texto, tono: etapa.tono },
    paso: d.etapa === 'produccion' || d.etapa === 'confirmado' ? d.estadoErp || undefined : undefined,
    nota: etapa.nota,
    fecha: fechaLarga(d.fecha),
    productos: (d.productos || []).map((p) => ({
      nombre: p.nombre,
      imagen: p.imagen || undefined,
      extra: [p.talla && `Talla ${p.talla}`, p.color, p.personalizado && 'Personalizado'].filter(Boolean).join(' · ') || undefined,
      cantidad: p.cantidad,
    })),
    total: `S/ ${Number(d.montoTotal || 0).toFixed(2)}`,
  };
};

/** Una persona → props de FilaReferido (+ lo que necesita el grupo). */
function personaDesde(r, numero, ahora, consulta) {
  const e = estadoDe(r, ahora);
  const puedeReclamar = r.status === 'purchased' || r.status === 'completed';
  const anulado = consulta?.data?.etapa === 'anulado';
  const confirmada = e.clave === 'reclamado' || r.status === 'completed';
  const restante = restanteLegible(e.resta);
  const chips = [];
  if (e.clave === 'reclamado') chips.push({ texto: 'Reclamado', tono: 'exito', icono: <Check aria-hidden="true" /> });
  if (e.clave === 'cuenta_nueva') chips.push({ texto: 'Cuenta nueva', tono: 'violeta', icono: <UserPlus aria-hidden="true" /> });
  if (e.clave === 'entro') chips.push({ texto: restante, tono: 'aviso', icono: <Clock aria-hidden="true" /> });
  if (e.clave === 'vencido') chips.push({ texto: 'Plazo vencido', tono: 'neutro' });
  if (puedeReclamar && consulta?.data) {
    const etapa = ETAPAS[consulta.data.etapa];
    if (etapa) chips.push({ texto: etapa.texto, tono: etapa.tono });
  }
  if (e.clave === 'no_califico') chips.push({ texto: 'No calificó', tono: 'neutro', icono: <AlertCircle aria-hidden="true" /> });

  let detalle;
  if (e.clave === 'entro') detalle = `Entró el ${fechaCorta(r.clickedAt)} · le quedan ${restante} para comprar`;
  else if (e.clave === 'cuenta_nueva') detalle = `Creó su cuenta y recibió ${BONO_BIENVENIDA_INVITACION} monedas · tiene ${restante} para su primera compra`;
  else if (e.clave === 'vencido') detalle = `Entró el ${fechaCorta(r.clickedAt)} · no compró a tiempo`;
  else if (e.clave === 'no_califico') detalle = 'Esta compra no calificó para el premio';
  else {
    // Lo que compró de verdad (el link puede ser de otro producto).
    const lista = r.productosComprados || [];
    const que = lista.length ? `Compró ${lista.slice(0, 2).join(', ')}${lista.length > 2 ? ` y ${lista.length - 2} más` : ''}` : 'Compró';
    detalle = `${que} · S/ ${Number(r.orderTotal || 0).toFixed(2)} · ${fechaCorta(r.purchasedAt || r.clickedAt)}`;
  }

  let reclamo;
  if (puedeReclamar) {
    if (anulado) reclamo = 'anulado';
    else if (consulta?.data?.finalizado) reclamo = 'listo';
    else if (!consulta || consulta.isPending) reclamo = 'revisando';
    else reclamo = 'alEntregarse';
  }

  return {
    id: r.id,
    nombre: r.visitanteNombre || `Visitante ${numero}`,
    anonima: !r.visitanteNombre,
    chips,
    detalle,
    // El estimado no es lo que se paga: el monto real lo da el servidor al reclamar.
    ganancia: e.conCompra && !anulado ? (confirmada ? r.earnedCoins || 0 : estimateReferralReward(r.orderTotal, r)) : 0,
    confirmada,
    cuentaNueva: Boolean(r.invitadoUid),
    compro: e.conCompra,
    reclamo,
    pedido: r.orderId ? pedidoDesde(consulta) : undefined,
  };
}

export default function ReferidosDeCuenta() {
  const { userProfile, reloadProfile } = useAuth();
  const toast = useGlobalToast();
  // Lo que se comparte, en el idioma de quien invita (la frase entera).
  const textoInvitacion = useTexto(`Te invito a Walá: crea tu cuenta con mi link y recibe ${BONO_BIENVENIDA_INVITACION} monedas para tu primera compra.`);
  const queryClient = useQueryClient();
  const [ahora, setAhora] = useState(() => Date.now());
  const [abiertos, setAbiertos] = useState([]);
  const [verRanking, setVerRanking] = useState(false);

  const codigo = userProfile?.referralCode || '';
  const url = codigo ? linkInvitacion(codigo) : '';

  const consulta = useQuery({
    queryKey: ['myReferrals', codigo],
    queryFn: async () => {
      const res = await getReferralsByReferrer(codigo);
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    enabled: Boolean(codigo),
  });
  const referrals = consulta.data;

  // Personas = los que abrieron algún link ('sent' son links viejos sin abrir: solo se cuentan).
  const personas = useMemo(() => (referrals || []).filter((r) => r.status !== 'sent'), [referrals]);
  const sinAbrir = (referrals || []).length - personas.length;

  const mapa = useMemo(() => {
    const m = new Map();
    personas.forEach((r) => {
      const k = grupoDe(r);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(r);
    });
    m.forEach((lista) => lista.sort((a, b) => actividad(b) - actividad(a)));
    return m;
  }, [personas]);

  // Nombre y foto de cada producto compartido.
  const productIds = useMemo(() => [...mapa.keys()].filter((k) => k.startsWith('producto:')).map((k) => k.slice(9)).sort(), [mapa]);
  const { data: productos } = useQuery({
    queryKey: ['referidosProductos', productIds],
    queryFn: async () => Object.fromEntries(await Promise.all(productIds.map(async (id) => [id, (await getProduct(id)).data || null]))),
    enabled: productIds.length > 0,
    staleTime: 10 * 60 * 1000,
  });

  // Pedidos: los por reclamar (para saber si ya se entregó) y los que se abrieron.
  const idsPedido = useMemo(() => {
    const pendientes = personas.filter((r) => r.status === 'purchased' || r.status === 'completed').map((r) => r.id);
    return [...new Set([...pendientes, ...abiertos])];
  }, [personas, abiertos]);
  const pedidos = useQueries({
    queries: idsPedido.map((id) => ({
      queryKey: ['referralOrder', id],
      queryFn: () => getReferralOrderDetail(id),
      staleTime: 60 * 1000,
      retry: false,
    })),
  });
  const pedidoDe = Object.fromEntries(idsPedido.map((id, k) => [id, pedidos[k]]));

  const ranking = useQuery({
    queryKey: ['topReferrersThisMonth'],
    queryFn: async () => {
      const res = await getTopReferrersOfMonth();
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    enabled: verRanking,
  });

  // Avisos al entrar: lo que pasó con tus links en los últimos 3 días (sin repetir).
  useEffect(() => {
    if (!personas.length) return;
    const clave = `notified_referrals_${codigo}`;
    let avisados = [];
    try { avisados = JSON.parse(localStorage.getItem(clave) || '[]'); } catch { /* vacío */ }
    const nuevos = [];
    personas
      .filter((r) => Date.now() - actividad(r) <= 3 * 24 * 60 * 60 * 1000)
      .forEach((r) => {
        const marca = `${r.id}_${r.status}`;
        if (avisados.includes(marca)) return;
        const quien = r.visitanteNombre || 'Alguien';
        if (r.status === 'clicked') toast.info(`${quien} entró a tu link.`);
        else if (r.status === 'registered') toast.success(`${quien} creó su cuenta con tu invitación.`);
        else if (r.status === 'purchased') toast.success(`¡${quien} compró con tu link!`);
        nuevos.push(marca);
      });
    if (nuevos.length) {
      try { localStorage.setItem(clave, JSON.stringify([...avisados, ...nuevos].slice(-300))); } catch { /* lleno */ }
    }
  }, [personas, codigo, toast]);

  // Reloj vivo solo mientras alguien tenga un plazo de 36 h corriendo.
  const hayCuentaRegresiva = personas.some((r) => r.status === 'clicked' && ms(r.clickedAt) + VENTANA_REFERIDO_MS > ahora);
  useEffect(() => {
    if (!hayCuentaRegresiva) return undefined;
    const id = setInterval(() => setAhora(Date.now()), 60000);
    return () => clearInterval(id);
  }, [hayCuentaRegresiva]);

  const copiar = async (texto, ok) => {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success(ok);
    } catch (e) {
      toast.error('No se pudo copiar');
      throw e;
    }
  };

  const compartir = async () => {
    const texto = textoInvitacion;
    if (navigator.share) {
      try { await navigator.share({ title: 'Walá', text: texto, url }); return; } catch { /* cancelado */ }
    }
    copiar(`${texto} ${url}`, '¡Mensaje con tu link copiado!').catch(() => {});
  };

  // El monto real (y si ya se puede) lo decide claimReferralSecure contra el ERP.
  const reclamar = async (id, boton) => {
    const { earned, error } = await claimReferralCoins(id);
    if (error) {
      toast.error(error || 'Error al reclamar monedas');
      throw new Error(error);
    }
    await reloadProfile?.();
    volarMonedasGanadas(boton, Number(earned) || 0);
    toast.success(`¡Has reclamado ${earned ?? ''} monedas con éxito!`);
    queryClient.invalidateQueries({ queryKey: ['myReferrals', codigo] });
    queryClient.invalidateQueries({ queryKey: ['referralOrder', id] });
  };

  const grupos = useMemo(() => {
    const armar = (clave, lista) => {
      // Número de visitante por orden de llegada (el más antiguo es el 1).
      const orden = [...lista].sort((a, b) => ms(a.clickedAt || a.createdAt) - ms(b.clickedAt || b.createdAt));
      const numero = new Map(orden.map((r, i) => [r.id, i + 1]));
      const productId = clave.startsWith('producto:') ? clave.slice(9) : null;
      const producto = productId ? productos?.[productId] : null;
      const tipo = productId ? 'producto' : clave;
      let titulo = 'Tu invitación';
      if (productId) titulo = producto?.name || 'Producto compartido';
      else if (clave === 'tienda') titulo = 'Links a la tienda y sorteos';
      else if (clave === 'anteriores') titulo = 'Links anteriores';
      let descripcion;
      if (productId) descripcion = 'Cuenta cualquier compra que hagan en 36 h, no solo este producto.';
      else if (clave === 'anteriores') descripcion = 'Los links que se generaban uno por persona. Siguen funcionando.';
      return {
        id: clave,
        tipo,
        titulo,
        antetitulo: productId ? 'Link del producto' : undefined,
        imagen: producto?.mainImage || producto?.images?.[0] || undefined,
        descripcion,
        sinAbrir: clave === 'anteriores' ? sinAbrir : 0,
        personas: lista.map((r) => personaDesde(r, numero.get(r.id), ahora, pedidoDe[r.id])),
      };
    };
    // La invitación siempre (aunque esté vacía); los demás, por la actividad más reciente.
    const otros = [...mapa.entries()]
      .filter(([k]) => k !== 'invitacion')
      .sort(([, a], [, b]) => actividad(b[0]) - actividad(a[0]));
    return [armar('invitacion', mapa.get('invitacion') || []), ...otros.map(([k, lista]) => armar(k, lista))];
  }, [mapa, productos, sinAbrir, ahora, pedidoDe]);

  const resumen = {
    entraron: personas.length,
    cuentasNuevas: personas.filter((r) => r.invitadoUid).length,
    compras: personas.filter((r) => ['purchased', 'completed', 'claimed'].includes(r.status)).length,
    porReclamar: personas.filter((r) => ['purchased', 'completed'].includes(r.status)).length,
    ganadas: personas.reduce((acc, r) => acc + (r.status === 'claimed' ? r.earnedCoins || 0 : 0), 0),
  };

  return (
    <PaginaReferidos
      url={url}
      codigo={codigo}
      monedas={Number(userProfile?.monedas) || 0}
      resumen={resumen}
      grupos={grupos}
      cargando={Boolean(codigo) && consulta.isPending}
      bono={BONO_BIENVENIDA_INVITACION}
      premio={PREMIO_INVITACION}
      onCompartir={compartir}
      onCopiar={(u) => copiar(u, '¡Link copiado!')}
      onReclamar={reclamar}
      onVerPedido={(id) => setAbiertos((a) => (a.includes(id) ? a : [...a, id]))}
      onVerAbajo={() => setVerRanking(true)}
      ranking={verRanking ? {
        items: (ranking.data || []).map((t) => ({ codigo: t.referrerCode, compras: t.count, monedas: t.coins })),
        cargando: ranking.isPending,
      } : undefined}
    />
  );
}
