import React, { lazy, Suspense, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { useGiftCatalog } from '../../hooks/useGiftCatalog';
import useLoViejo from '../../hooks/useLoViejo';
import { leerSurveyConfig, DEFAULT_SURVEY_CONFIG } from '../../services/encuestaConfig';
import { getBrands } from '../../services/brands';
import { configConOrigenCompra } from '../../services/encuestaOrigen.mjs';
import { registrarConversionPopup } from '../../services/popups';
import { trackSurveyStep } from '../../services/analytics/tracker';
import { uploadFile } from '../../services/firebase/storage';
import { volarMonedasGanadas } from '../../utils/animations';
import { productNeedsVariantSelection } from '../../utils/comboProductUtils';
import { tieneCuenta } from '../../utils/rutaPrivada';
import { fotoDeTarjeta } from '../regalar/regaloDeLista';
import { PaginaEncuesta, GRUPOS_ENCUESTA } from '../../componentes/kit/paginas/Encuesta';
import { personaDesdeRecipient, personaARecipient } from '../../componentes/kit/adaptadores';
import { encuestaDesdeConfig } from '../../componentes/kit/adaptadoresEncuesta';

// La hoja "Agregar rápido" baja aparte, la primera vez que alguien elige talla.
const AgregarRapidoDeProducto = lazy(() => import('../producto/AgregarRapidoDeProducto'));

/*
 * La encuesta (/encuesta-suscripcion), paso 6 de la migración (ENCUESTA.md):
 * PaginaEncuesta del kit. Lo de antes, en pages/SubscriptionSurveyViejo.jsx
 * (interruptor encuestaVieja).
 *
 * Lo mismo que antes al terminar: surveyBasicData, giftRoles (los ocho
 * grupos, en true o false), giftRecipients FUSIONADO (las personas listas de
 * esta vez, encima de lo que ya tenían, más las del perfil que no se tocaron),
 * hasCompletedSurvey y el cumpleaños propio solo si hay fecha; la conversión
 * del pop-up "encuesta"; las monedas las paga el servidor (grantSurveyReward
 * y claimDatesReward) y vuelan solo si pagó. "No, gracias" deja la fecha del
 * aviso y va al inicio.
 *
 * Diferente: quitar a alguien lo quita de verdad (antes la fusión lo traía de
 * vuelta); el catálogo de regalos (sugerencias e ideas) se pide al empezar y
 * no en la portada; la config se lee sin intentar crearla.
 */

const nuevoId = () => Math.random().toString(36).substring(2, 9);
const precioDe = (p) => (Number(p.salePrice) > 0 ? Number(p.salePrice) : Number(p.price) || 0);
const fotoChica = (producto) => {
  const { imagen, extra } = fotoDeTarjeta(producto);
  return { imagen, srcSet: extra?.srcSet, sizes: extra?.srcSet ? '56px' : undefined };
};

/** Una persona del kit sobre la que ya estaba guardada (no se pierde lo que la encuesta no edita). */
function recipientFusionado(persona, original) {
  const id = original?.id || nuevoId();
  const editado = personaARecipient({ ...persona, id }, id);
  return {
    ...(original || {}),
    ...editado,
    events: editado.events.map((e) => ({ ...(original?.events || []).find((o) => o.id === e.id), ...e, id: e.id || nuevoId() })),
  };
}

export default function EncuestaDeTienda() {
  const { user, userProfile, loading, updateUserProfile, grantSurveyReward, claimDatesReward } = useAuth();
  const { addToCart } = useCart();
  const navigate = useNavigate();
  const fichaVieja = useLoViejo('ficha');

  const { data: configGuardada, isLoading: cargandoConfig } = useQuery({
    queryKey: ['encuesta-config'],
    queryFn: async () => (await leerSurveyConfig()).data || DEFAULT_SURVEY_CONFIG,
    staleTime: 10 * 60 * 1000,
  });
  // El catálogo de regalos (sugerencias de gustos e ideas al final) se pide al dejar la portada.
  const [empezo, setEmpezo] = useState(false);
  const { recomendar, sugerenciasCampo } = useGiftCatalog({ activo: empezo });

  const { data: marcas = [], isLoading: cargandoMarcas } = useQuery({
    queryKey: ['brands'],
    queryFn: async () => {
      const { data, error } = await getBrands();
      if (error) throw new Error(error);
      return data || [];
    },
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });

  const { config, conjuntos } = useMemo(
    () => encuestaDesdeConfig(configConOrigenCompra({ ...DEFAULT_SURVEY_CONFIG, ...(configGuardada || {}) }, marcas), sugerenciasCampo),
    [configGuardada, marcas, sugerenciasCampo],
  );

  const previos = useMemo(() => (Array.isArray(userProfile?.giftRecipients) ? userProfile.giftRecipients : []), [userProfile?.giftRecipients]);
  const perfilListo = Boolean(userProfile) && !userProfile._perfilNoCargado;
  const inicial = useMemo(() => (perfilListo ? {
    respuestas: userProfile.surveyBasicData || {},
    cumpleanos: userProfile.birthDate || '',
    grupos: Object.entries(userProfile.giftRoles || {}).filter(([, v]) => v === true).map(([k]) => k),
    personas: previos.map(personaDesdeRecipient),
  } : {}), [perfilListo]); // eslint-disable-line react-hooks/exhaustive-deps

  const [ideasAgregadas, setIdeasAgregadas] = useState(() => new Set());
  const [hoja, setHoja] = useState(null);

  const ideaDe = ({ producto: p, motivo }) => ({
    id: p.id,
    nombre: p.name,
    ...fotoChica(p),
    motivo,
    precio: precioDe(p),
    url: `/producto/${p.id}`,
    agregada: ideasAgregadas.has(p.id),
    necesitaOpciones: productNeedsVariantSelection(p),
    producto: p,
    // Lo que pide talla o color se elige en "Agregar rápido" (con fichaVieja, en su ficha).
    onElegir: () => elegir(p),
  });

  // Embudo de la encuesta ("Respuestas de la encuesta"). Sin analítica no se frena nada.
  const paso = (p) => {
    try { trackSurveyStep(p, user).catch(() => {}); } catch { /* sin analítica */ }
  };

  const omitir = async () => {
    paso('no_gracias');
    try {
      await updateUserProfile({ lastSurveyPromptedAt: Date.now() });
    } catch (e) {
      console.error('Error saving skip timestamp:', e);
    }
    navigate('/', { replace: true });
  };

  const terminar = async ({ respuestas, cumpleanos, grupos, personas, quitadas, whatsapp }) => {
    // Sin el perfil real no se guarda: la fusión pisaría a las personas que no se ven.
    if (!perfilListo) throw new Error('Tu perfil aún se está cargando. Inténtalo de nuevo en unos segundos.');
    const porId = new Map(previos.map((r) => [r.id, r]));
    const listas = personas.map((p) => recipientFusionado(p, porId.get(p.id)));
    const tocadas = new Set([...listas.map((r) => r.id), ...quitadas]);
    const giftRecipients = [...listas, ...previos.filter((r) => r?.id && !tocadas.has(r.id))];
    const cambios = {
      surveyBasicData: respuestas || {},
      giftRoles: Object.fromEntries(GRUPOS_ENCUESTA.map((g) => [g.valor, grupos.includes(g.valor)])),
      giftRecipients,
      hasCompletedSurvey: true,
    };
    // Opcional: solo si hay fecha, para no borrar una guardada.
    if (cumpleanos) cambios.birthDate = cumpleanos;
    // Ofertas por WhatsApp: el mismo campo que el interruptor de Mi perfil (con fecha y de dónde vino).
    if (typeof whatsapp === 'boolean') {
      cambios.marketingConsent = { ...(userProfile?.marketingConsent || {}), whatsapp, updatedAt: new Date().toISOString(), origen: 'encuesta' };
    }
    const { error } = await updateUserProfile(cambios);
    if (error) throw new Error(error);
    registrarConversionPopup('encuesta', { uid: user?.uid || null, email: user?.email || null });

    // Las monedas las calcula y paga el servidor: 15 una vez y 5 por fecha nueva (con tope).
    const [encuesta, fechas] = await Promise.all([grantSurveyReward(), claimDatesReward()]);
    const monedas = (encuesta.error ? 0 : encuesta.data?.reward || 0) + (fechas.error ? 0 : fechas.data?.reward || 0);
    if (monedas > 0) volarMonedasGanadas(null, monedas);

    // Las primeras ideas: solo las de sus gustos ("ya tenemos ideas" promete algo a su medida).
    const ideas = listas.map((r) => ({
      id: r.id,
      nombre: r.name,
      ideas: recomendar(r, { limite: 3 }).filter((x) => x.tipo === 'gusto').map(ideaDe),
    }));
    return { monedas, ideas };
  };

  const subirFoto = async (blob) => {
    const { url, error } = await uploadFile(blob, `gift_recipients/${user?.uid || 'anon'}/${Date.now()}.jpg`);
    if (error || !url) throw new Error(error || 'sin url');
    return url;
  };

  // Lo que pide talla o color no entra a ciegas: se elige en la hoja.
  const elegir = (producto) => {
    if (fichaVieja) navigate(`/producto/${producto.id}`);
    else setHoja({ producto, abierta: true });
  };
  const agregarIdea = (idea) => {
    if (!idea.producto) return;
    if (idea.necesitaOpciones) { elegir(idea.producto); return; }
    addToCart(idea.producto, {}, null, 1);
    setIdeasAgregadas((prev) => new Set([...prev, idea.id]));
  };

  const cargando = loading || cargandoConfig || cargandoMarcas || (tieneCuenta(user) && !perfilListo);

  return (
    <>
      <PaginaEncuesta
        // Al llegar el perfil, la página arranca con lo que ya tenía.
        key={perfilListo ? 'perfil' : 'sin-perfil'}
        config={config}
        conjuntos={conjuntos}
        inicial={inicial}
        nombreCuenta={userProfile?.displayName || user?.displayName || ''}
        // Solo a quien no lo tiene activado (y si el admin no lo apagó).
        pedirWhatsapp={config.whatsapp !== false && userProfile?.marketingConsent?.whatsapp !== true}
        recompensa={{ base: 15, porFecha: 5, tope: 50 }}
        sesion={tieneCuenta(user)}
        completada={Boolean(userProfile?.hasCompletedSurvey)}
        cargando={cargando}
        urlLogin="/login?redirect=%2Fencuesta-suscripcion"
        urlRegistro="/registro?redirect=%2Fencuesta-suscripcion"
        urlFechas="/cuenta/fechas-importantes"
        urlTienda="/"
        onEmpezar={() => setEmpezo(true)}
        onOmitir={omitir}
        onPaso={paso}
        onTerminar={terminar}
        onSubirFoto={subirFoto}
        onAgregarIdea={agregarIdea}
      />
      {hoja && (
        <Suspense fallback={null}>
          <AgregarRapidoDeProducto product={hoja.producto} abierto={hoja.abierta} onCerrar={() => setHoja((h) => ({ ...h, abierta: false }))} />
        </Suspense>
      )}
    </>
  );
}
