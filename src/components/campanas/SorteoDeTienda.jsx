import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useGlobalToast } from '../../contexts/ToastContext';
import {
  getSorteoActivo, getSorteoBySlug, getMiParticipacion, getContadorSorteo,
  participarGratis, comprarTicketSorteo, sumarChanceCompartir, claimRaffleReferral,
} from '../../services/sorteos';
import { getClientType } from '../../services/analytics/tracker';
import { origenPublico } from '../../services/referrals';
import { getFx, penToUsd } from '../../services/fx';
import { COUNTRIES } from '../../constants/countries';
import { tieneCuenta, urlLogin } from '../../utils/rutaPrivada';
import CulqiCustomCheckout from '../CulqiCustomCheckout';
import { PaginaSorteo } from '../../componentes/kit/paginas/Sorteo';
import { PagoTarjeta } from '../../componentes/kit/piezas/Pago';
import { useTexto } from '../../componentes/kit/Traduccion';

// Los botones de PayPal (su SDK) bajan solo al elegir cómo pagar.
const PaypalTicketSorteo = lazy(() => import('../PaypalCheckout/PaypalTicketSorteo'));

/*
 * El sorteo (/sorteos y /sorteos/:slug) con el kit (paso 6, CAMPANAS.md). La
 * misma lógica que SorteosPage:
 *  - el sorteo por slug o el activo más reciente; mi participación (un doc)
 *    y el contador (la suma de los shards, cada 20 s)
 *  - gratis: participarSorteoGratis con los datos; pagado:
 *    comprarTicketSorteoSecure crea el ticket (el monto lo fija el servidor)
 *    y se paga con Culqi (processCulqiPayment, la misma ventana del checkout)
 *    o con PayPal (create/capturePaypalTicketSorteoSecure)
 *  - compartir suma 1 chance una vez (sumarChanceCompartir); con ?ref= y ya
 *    participando, se acredita el referido (claimRaffleReferralSecure)
 *  - solo desde la app: getClientType() (el servidor lo confirma con el
 *    origen de la llamada)
 * Diferente: compartir, el link de invitación y "Inicia sesión" llevan el
 * slug (antes, siempre /sorteos) y el login conserva el ?ref; el sorteo
 * termina al final del día de Lima (antes, a las 7 p. m. del día anterior);
 * un borrador abierto por su slug se ve como "no hay sorteo"; "ganaste" solo
 * con el sorteo cerrado; quien no es del Perú elige su país; la sesión
 * anónima no cuenta como cuenta; sin emojis y todo traducido.
 * Lo de antes: pages/SorteosViejo.jsx (interruptor campanasViejo).
 */

const PAISES = COUNTRIES.map((c) => ({ valor: c.code, texto: c.name, prefijo: c.dialCode }));

// fechaFin: 'AAAA-MM-DD' (el admin) → el final de ese día en Lima; un Timestamp, tal cual.
const finDelSorteo = (fechaFin) => {
  if (!fechaFin) return undefined;
  if (typeof fechaFin === 'string') return /^\d{4}-\d{2}-\d{2}$/.test(fechaFin) ? `${fechaFin}T23:59:59-05:00` : fechaFin;
  const ms = typeof fechaFin.toMillis === 'function' ? fechaFin.toMillis() : Number(fechaFin.seconds) * 1000;
  return Number.isFinite(ms) ? new Date(ms).toISOString() : undefined;
};

// Los datos del kit → los que guarda el servidor (sanitizarDatosSorteo).
const datosParaServidor = (d) => {
  const partes = String(d.nombre || '').trim().split(/\s+/).filter(Boolean);
  const pais = d.pais || 'PE';
  const prefijo = PAISES.find((p) => p.valor === pais)?.prefijo || '';
  const telefono = String(d.telefono || '').trim();
  return {
    nombres: partes[0] || '',
    apellidos: partes.slice(1).join(' '),
    tipoDocumento: d.tipoDocumento || 'DNI',
    numeroDocumento: String(d.documento || '').trim(),
    telefono: pais === 'PE' ? telefono.replace(/\D/g, '') : `${prefijo} ${telefono}`.trim(),
    correo: String(d.correo || '').trim(),
    pais,
  };
};

export default function SorteoDeTienda() {
  const { slug } = useParams();
  const { search } = useLocation();
  const [params] = useSearchParams();
  const { user, userProfile, loading } = useAuth();
  const toast = useGlobalToast();
  const queryClient = useQueryClient();
  const sesion = tieneCuenta(user);
  const enApp = useMemo(() => getClientType() === 'APP', []);
  const [pagado, setPagado] = useState(0);
  const [paypal, setPaypal] = useState({ procesando: false, error: '' });
  const cobros = useRef({});
  const referidoIntentado = useRef(false);

  const { data: sorteo, isLoading, error } = useQuery({
    queryKey: ['sorteo', slug || '__activo__'],
    queryFn: async () => {
      const r = slug ? await getSorteoBySlug(slug) : await getSorteoActivo();
      if (r.error) throw new Error(r.error);
      return r.data || null;
    },
    staleTime: 30000,
  });
  const sorteoId = sorteo?.estado === 'borrador' ? null : sorteo?.id || null;
  const uid = sesion ? user.uid : null;

  const { data: miParticipacion } = useQuery({
    queryKey: ['mi-participacion', sorteoId, uid],
    queryFn: async () => {
      const r = await getMiParticipacion(sorteoId, uid);
      if (r.error) throw new Error(r.error);
      return r.data || null;
    },
    enabled: Boolean(sorteoId && uid),
    staleTime: 30000,
  });
  const { data: contador } = useQuery({
    queryKey: ['contador-sorteo', sorteoId],
    queryFn: async () => (await getContadorSorteo(sorteoId)).data,
    enabled: Boolean(sorteoId),
    staleTime: 20000,
    refetchInterval: 20000,
  });
  const { data: fx } = useQuery({ queryKey: ['fx'], queryFn: getFx, enabled: sorteo?.tipo === 'pagado', staleTime: 600_000 });

  const refrescar = () => {
    queryClient.invalidateQueries({ queryKey: ['mi-participacion', sorteoId, uid] });
    queryClient.invalidateQueries({ queryKey: ['contador-sorteo', sorteoId] });
  };

  // ?ref=CÓDIGO y ya participa: +1 chance para quien compartió (una vez).
  const refCode = (params.get('ref') || '').trim();
  const miCodigo = userProfile?.referralCode || '';
  useEffect(() => {
    if (!sorteoId || !uid || !miParticipacion || !refCode || referidoIntentado.current) return;
    referidoIntentado.current = true;
    if (miCodigo && refCode.toUpperCase() === miCodigo.toUpperCase()) return;
    claimRaffleReferral(sorteoId, refCode).then(({ data }) => { if (data?.ok && data?.acreditado) refrescar(); });
  }, [sorteoId, uid, miParticipacion, refCode, miCodigo]); // eslint-disable-line react-hooks/exhaustive-deps

  const slugReal = sorteo?.slug || slug || '';
  const urlSorteo = `${origenPublico()}/sorteos${slugReal ? `/${slugReal}` : ''}`;
  const urlInvitacion = miCodigo ? `${urlSorteo}?ref=${encodeURIComponent(miCodigo)}` : undefined;
  // Lo que se comparte, en el idioma de quien comparte (la frase entera, con el premio).
  const premioCompartido = sorteo?.premio?.nombre || sorteo?.titulo || 'este sorteo';
  const tituloCompartido = useTexto('Sorteo Walá');
  const textoCompartido = useTexto(`¡Estoy participando para ganar ${premioCompartido} en Walá! Participa tú también:`);

  const datosIniciales = useMemo(() => ({
    nombre: userProfile?.displayName || user?.displayName || '',
    pais: userProfile?.country || 'PE',
    tipoDocumento: userProfile?.documentType || 'DNI',
    documento: userProfile?.dni || '',
    telefono: userProfile?.phone || '',
    correo: userProfile?.email || user?.email || '',
  }), [userProfile, user]);

  const listoPago = () => {
    setPagado((n) => n + 1);
    refrescar();
    toast.success('¡Tus tickets ya están registrados!');
  };

  const participar = async (datos) => {
    const { data, error: e } = await participarGratis(sorteoId, enApp, datosParaServidor(datos));
    if (e) throw new Error(e);
    if (data?.ok) {
      refrescar();
      toast.success('¡Ya estás participando!');
    }
  };

  const comprar = async ({ datos, cantidad }) => {
    const servidor = datosParaServidor(datos);
    const { data, error: e } = await comprarTicketSorteo({ sorteoId, cantidad, datos: servidor });
    if (e) throw new Error(e);
    if (!data?.ok || !data?.ticketId || !data?.metadata) throw new Error('No se pudo preparar la compra. Inténtalo de nuevo.');
    const monto = Number(data.monto ?? (data.montoCentimos || 0) / 100);
    setPaypal({ procesando: false, error: '' });
    return {
      monto,
      moneda: data.moneda || 'PEN',
      montoUsd: fx ? penToUsd(monto, fx) : undefined,
      ticketId: data.ticketId,
      metadata: data.metadata,
      email: servidor.correo || user?.email || '',
    };
  };

  // El cobro de Culqi de cada ticket, siempre el mismo objeto (si cambiara,
  // CulqiCustomCheckout volvería a armar su ventana).
  const cobroDe = (compra) => {
    if (!cobros.current[compra.ticketId]) {
      cobros.current[compra.ticketId] = {
        id: compra.ticketId,
        monto: compra.monto,
        moneda: compra.moneda,
        email: compra.email,
        titulo: 'Ticket de Sorteo - Walá',
        descripcion: 'Ticket(s) de sorteo Walá',
        metadata: compra.metadata,
      };
    }
    return cobros.current[compra.ticketId];
  };

  const compartir = async () => {
    const url = urlInvitacion || urlSorteo;
    try {
      if (navigator.share) await navigator.share({ title: tituloCompartido, text: textoCompartido, url });
      else if (navigator.clipboard) { await navigator.clipboard.writeText(url); toast.success('Enlace copiado. ¡Compártelo!'); }
    } catch (e) {
      // Cerrar el menú de compartir no es un error: la chance se pide igual.
      if (e?.name !== 'AbortError') {
        try { await navigator.clipboard?.writeText(url); toast.success('Enlace copiado. ¡Compártelo!'); } catch { /* sin portapapeles */ }
      }
    }
    const { data, error: e } = await sumarChanceCompartir(sorteoId);
    if (e) throw new Error(e);
    if (data?.ok) {
      if (!data.yaReclamado) toast.success('¡+1 chance por compartir!');
      refrescar();
    }
  };

  let estado;
  if (isLoading || loading) estado = 'cargando';
  else if (error) estado = 'error';
  else if (!sorteo || sorteo.estado === 'borrador') estado = 'vacio';

  const vista = sorteo ? {
    premio: sorteo.premio?.nombre || sorteo.titulo,
    imagen: sorteo.heroImagenUrl || sorteo.premio?.imagenUrl || undefined,
    descripcion: sorteo.descripcion,
    tipo: sorteo.tipo === 'pagado' ? 'pagado' : 'gratis',
    precioTicket: Number(sorteo.precioTicket || 0),
    moneda: sorteo.moneda || 'PEN',
    numGanadores: Number(sorteo.numGanadores) || 1,
    hasta: finDelSorteo(sorteo.fechaFin),
    cerrado: sorteo.estado === 'cerrado',
    participantes: typeof contador === 'number' ? contador : sorteo.contadorParticipantes || 0,
    reglas: {
      compartir: Boolean(sorteo.chanceExtraCompartir),
      referido: Boolean(sorteo.chanceExtraReferido),
      appExtra: sorteo.requisitoApp === 'chanceExtra',
      appObligatorio: sorteo.requisitoApp === 'obligatorio',
    },
    ganadores: (sorteo.ganadores || []).map((g) => ({ id: g.uid, nombre: g.nombre })),
  } : undefined;

  const participacion = miParticipacion ? {
    tickets: miParticipacion.ticketsPagados || 1,
    chances: miParticipacion.chancesTotal || 1,
    compartio: Boolean(miParticipacion.compartioClaim),
  } : null;

  return (
    <PaginaSorteo
      key={`${sorteoId || 'sin'}-${uid || 'invitado'}-${userProfile ? 'perfil' : ''}`}
      estado={estado}
      sorteo={vista}
      participacion={participacion}
      sesion={sesion}
      yo={uid || undefined}
      enApp={enApp}
      urlLogin={urlLogin(`/sorteos${slug ? `/${slug}` : ''}${search}`)}
      urlApp="/descargar"
      urlInvitacion={urlInvitacion}
      datosIniciales={datosIniciales}
      paises={PAISES}
      onParticipar={participar}
      onComprar={comprar}
      botonTarjeta={(compra) => (
        <CulqiCustomCheckout
          cobro={cobroDe(compra)}
          onSuccess={listoPago}
          renderBoton={({ abrir, procesando }) => (
            <PagoTarjeta monto={compra.monto} moneda={compra.moneda} onPagar={abrir} procesando={procesando} />
          )}
        />
      )}
      botonesPaypal={(compra) => (
        <Suspense fallback={null}>
          <PaypalTicketSorteo
            sorteoId={sorteoId}
            ticketId={compra.ticketId}
            onPagado={listoPago}
            onProcesando={(v) => setPaypal((p) => ({ ...p, procesando: v }))}
            onError={(texto) => setPaypal((p) => ({ ...p, error: texto }))}
          />
        </Suspense>
      )}
      paypal={paypal}
      pagado={pagado}
      onCompartir={compartir}
    />
  );
}
