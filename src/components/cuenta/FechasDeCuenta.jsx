import React, { lazy, Suspense, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { useGlobalToast } from '../../contexts/ToastContext';
import { useProducts } from '../../hooks/useProducts';
import { useGiftCatalog } from '../../hooks/useGiftCatalog';
import useLoViejo from '../../hooks/useLoViejo';
import { respuestasDe } from '../../utils/giftRecommender.mjs';
import { getUserSuggestedPackages } from '../../services/fechasImportantes';
import { useFechasFestivas, useRecordatorioPersonal } from '../../services/fechasFestivas';
import { proximasFestivas, hoyLocal, DIAS_ANTICIPACION, textoDiasAviso, RECORDATORIO_PERSONAL_DEFAULT } from '../../utils/fechasFestivas.mjs';
import { productNeedsVariantSelection } from '../../utils/comboProductUtils';
import { uploadFile } from '../../services/firebase/storage';
import { volarMonedasGanadas } from '../../utils/animations';
import { fotoDeTarjeta } from '../regalar/regaloDeLista';
import { PaginaFechas } from '../../componentes/kit/paginas/CuentaPersonalizacion';
import { faltanDias } from '../../componentes/kit/piezas/Regalos';
import { iconoDesde } from '../../componentes/kit/IconosWala';
import { personaDesdeRecipient, personaARecipient } from '../../componentes/kit/adaptadores';

// La hoja "Agregar rápido" baja aparte, la primera vez que alguien elige talla.
const AgregarRapidoDeProducto = lazy(() => import('../producto/AgregarRapidoDeProducto'));

/*
 * Fechas importantes (/cuenta/fechas-importantes), paso 6 de la migración:
 * PaginaFechas del kit. Lo de antes, en pages/cuenta/CuentaFechasImportantesViejo.jsx
 * (interruptor cuentaVieja).
 *
 * Las personas viven en userProfile.giftRecipients. Al guardar se conserva
 * todo lo que esta página no edita (lo de la encuesta, como el "Conjunto
 * familia"). Las ideas salen del buscador de regalos (useGiftCatalog) y los
 * paquetes, de los que armó el equipo (suggested_packages), cruzados con el
 * catálogo de hoy: lo retirado se cae y lo que sigue va con su precio de hoy.
 * Lo que pide talla o color abre "Agregar rápido" (con fichaVieja, su ficha).
 */

// Las festivas del admin traen un emoji; en el kit van con un ícono de Walá.
const ICONO_FESTIVA = {
  san_valentin: 'corazon', dia_madre: 'corazon', dia_mujer: 'destello', navidad: 'estrella', dia_amistad: 'mano',
};
const iconoDeFestiva = (f) => ICONO_FESTIVA[f.id] || (f.emoji && iconoDesde(f.emoji)) || 'regalo';

const nuevoId = () => Math.random().toString(36).substring(2, 9);
const precioDe = (p) => (Number(p.salePrice) > 0 ? Number(p.salePrice) : Number(p.price) || 0);

/** La foto chica de una idea: la miniatura de la tienda, con sus copias. */
const fotoChica = (producto) => {
  const { imagen, extra } = fotoDeTarjeta(producto);
  return { imagen, srcSet: extra?.srcSet, sizes: extra?.srcSet ? '56px' : undefined };
};

export default function FechasDeCuenta() {
  const { user, userProfile, updateUserProfile, claimDatesReward } = useAuth();
  const { addToCart } = useCart();
  const toast = useGlobalToast();
  const navigate = useNavigate();
  const fichaVieja = useLoViejo('ficha');
  const uid = user?.uid;

  const recipients = useMemo(() => userProfile?.giftRecipients || [], [userProfile?.giftRecipients]);
  const { data: festivasConfig } = useFechasFestivas();
  const { data: diasAviso } = useRecordatorioPersonal();
  const proximas = useMemo(() => proximasFestivas(festivasConfig || [], recipients, hoyLocal()), [festivasConfig, recipients]);

  // El catálogo público (sin ocultos ni borrados): el mismo que usa el
  // buscador de regalos, así que se lee una sola vez.
  const { data: catalogo, isLoading: cargandoCatalogo } = useProducts();
  const porId = useMemo(() => new Map((catalogo || []).map((p) => [String(p.id), p])), [catalogo]);
  const { recomendar, sugerenciasCampo, conjuntos, cargando: cargandoIdeas } = useGiftCatalog();

  const { data: paquetesGuardados = [] } = useQuery({
    queryKey: ['paquetes-sugeridos', uid],
    queryFn: () => getUserSuggestedPackages(uid),
    enabled: Boolean(uid),
    staleTime: 5 * 60 * 1000,
  });

  const [ideasAgregadas, setIdeasAgregadas] = useState(() => new Set());
  const [paquetesAgregados, setPaquetesAgregados] = useState(() => new Set());
  const [ganadas, setGanadas] = useState(0);
  // null: la hoja nunca se abrió (no baja su código).
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
  });

  // La ocasión que cuenta es la próxima fecha de la persona (las suyas o
  // una festiva que le toque, p. ej. el Día de la Madre).
  const ideasCrudas = (rec) => {
    const propias = (rec.events || [])
      .map((ev) => ({ dias: faltanDias(ev.date), ocasion: ev.type === 'Fecha Especial' ? ev.customName : ev.type }))
      .filter((x) => x.dias != null);
    const festivas = proximas.filter((f) => f.personas.includes(rec)).map((f) => ({ dias: f.dias, ocasion: f.nombre }));
    const proxima = [...propias, ...festivas].sort((a, b) => a.dias - b.dias)[0];
    return recomendar(rec, { ocasion: proxima ? proxima.ocasion : '', limite: 4 });
  };

  const paqueteDe = (pkg) => {
    const guardados = pkg.products || [];
    const productos = guardados.map((prod) => {
      const vivo = porId.get(String(prod.id));
      if (!vivo) return null;
      return {
        id: vivo.id,
        nombre: vivo.name || prod.name,
        ...fotoChica(vivo),
        precio: Number(vivo.salePrice || vivo.price) || 0,
        url: `/producto/${vivo.id}`,
        necesitaOpciones: productNeedsVariantSelection(vivo),
        producto: vivo,
      };
    }).filter(Boolean);
    return {
      id: pkg.id,
      total: productos.reduce((a, p) => a + p.precio, 0),
      productos,
      quitados: guardados.length - productos.length,
      agregado: paquetesAgregados.has(pkg.id),
    };
  };

  const personas = recipients.map((rec) => {
    const paquetesRec = paquetesGuardados.filter((pkg) => pkg.recipientId === rec.id);
    // Las ideas no repiten lo que ya trae un paquete del equipo.
    const enPaquetes = new Set(paquetesRec.flatMap((pkg) => (pkg.products || []).map((x) => String(x.id))));
    const crudas = cargandoIdeas ? [] : ideasCrudas(rec).filter(({ producto }) => !enPaquetes.has(String(producto.id)));
    return {
      ...personaDesdeRecipient(rec),
      // Las festivas solo cuando se acercan; sus propias fechas, siempre.
      festivas: proximas.filter((f) => f.personas.includes(rec) && f.dias <= DIAS_ANTICIPACION).map((f) => ({ nombre: f.nombre, fecha: f.fecha })),
      // Mientras carga el catálogo no se pinta el paquete: mostrar la foto
      // guardada y recortarla un segundo después se ve como un error.
      paquetes: cargandoCatalogo ? [] : paquetesRec.map(paqueteDe),
      ideas: crudas.map(ideaDe),
      ideasGenerales: crudas.length > 0 && crudas.every((i) => i.tipo === 'general'),
      sinIdeas: respuestasDe(rec).length > 0,
      buscando: cargandoIdeas,
    };
  });

  const festivas = proximas.filter((f) => f.dias <= DIAS_ANTICIPACION).map((f) => ({
    id: f.id,
    nombre: f.nombre,
    fecha: f.fecha,
    icono: iconoDeFestiva(f),
    personas: f.personas.slice(0, 3).map((rec) => ({
      id: rec.id,
      nombre: rec.name,
      buscando: cargandoIdeas,
      ideas: cargandoIdeas ? [] : recomendar(rec, { ocasion: f.nombre, limite: 3 }).map(ideaDe),
    })),
  }));

  const conjuntosKit = useMemo(() => conjuntos.map((cat) => ({
    id: cat.id,
    nombre: cat.name,
    campos: (cat.fields || []).map((f) => (f.type === 'select'
      ? { id: f.id, etiqueta: f.label, opciones: f.options || [] }
      : { id: f.id, etiqueta: f.label, sugerencias: sugerenciasCampo(cat, f) })),
  })), [conjuntos, sugerenciasCampo]);

  /* ── Carrito ── */

  // Lo que pide talla o color no entra a ciegas: se elige en la hoja.
  const elegir = (item) => {
    const producto = item.producto;
    if (!producto) return;
    if (fichaVieja) navigate(`/producto/${producto.id}`);
    else setHoja({ producto, abierta: true });
  };

  const agregarIdea = (idea) => {
    if (idea.necesitaOpciones) { elegir(idea); return; }
    addToCart(idea.producto, {}, null, 1);
    setIdeasAgregadas((prev) => new Set([...prev, idea.id]));
  };

  // Las ideas automáticas como un paquete armado solo: las que faltan y no
  // piden talla o color.
  const agregarIdeas = (idPersona) => {
    const persona = personas.find((p) => p.id === idPersona);
    const faltan = (persona?.ideas || []).filter((i) => !i.agregada && !i.necesitaOpciones);
    faltan.forEach((i) => addToCart(i.producto, {}, null, 1));
    setIdeasAgregadas((prev) => new Set([...prev, ...faltan.map((i) => i.id)]));
  };

  const agregarPaquete = (idPersona, idPaquete) => {
    const paquete = personas.find((p) => p.id === idPersona)?.paquetes.find((pq) => pq.id === idPaquete);
    if (!paquete || paquete.agregado) return;
    const directos = paquete.productos.filter((p) => !p.necesitaOpciones);
    const porElegir = paquete.productos.filter((p) => p.necesitaOpciones);
    directos.forEach((p) => addToCart(p.producto, {}, null, 1, null, { silent: porElegir.length > 0 }));
    setPaquetesAgregados((prev) => new Set([...prev, idPaquete]));
    if (porElegir.length > 0) {
      const nombres = porElegir.map((p) => p.nombre).join(', ');
      toast.info(`Agregamos ${directos.length} al carrito. ${nombres} ${porElegir.length === 1 ? 'pide' : 'piden'} elegir talla o color: toca «Elegir talla».`);
    }
  };

  /* ── Personas ── */

  const guardar = async (persona) => {
    const original = persona.id ? recipients.find((r) => r.id === persona.id) : null;
    const id = original?.id || nuevoId();
    // El "Conjunto familia" es de la encuesta: aquí no se edita, se conserva.
    const { familySet: _familia, familyAnswers: _respuestasFamilia, ...editado } = personaARecipient(persona, id);
    const nuevo = {
      ...(original || {}),
      ...editado,
      events: editado.events.map((e) => ({ ...(original?.events || []).find((o) => o.id === e.id), ...e })),
    };
    const lista = original ? recipients.map((r) => (r.id === id ? nuevo : r)) : [...recipients, nuevo];
    const { error } = await updateUserProfile({ giftRecipients: lista });
    if (error) throw new Error(error);
    // Monedas por fechas nuevas: las calcula y paga el servidor (5 c/u, con
    // tope). Si falla, la fecha igual quedó guardada; solo no hay premio.
    claimDatesReward().then((res) => {
      const n = res?.error ? 0 : res?.data?.reward || 0;
      if (n > 0) {
        setGanadas(n);
        volarMonedasGanadas(null, n);
      }
    }).catch(() => {});
  };

  const eliminar = async (id) => {
    const { error } = await updateUserProfile({ giftRecipients: recipients.filter((r) => r.id !== id) });
    if (error) toast.error('No pudimos eliminar a la persona. Intenta de nuevo.');
  };

  const subirFoto = async (blob) => {
    const { url, error } = await uploadFile(blob, `gift_recipients/${uid || 'anon'}/${Date.now()}.jpg`);
    if (error || !url) throw new Error(error || 'sin url');
    return url;
  };

  return (
    <>
      <PaginaFechas
        personas={personas}
        festivas={festivas}
        encuesta={userProfile && !userProfile.hasCompletedSurvey ? { monedas: 15, url: '/encuesta-suscripcion' } : undefined}
        ganadas={ganadas}
        conjuntos={conjuntosKit}
        cargando={!userProfile}
        aviso={textoDiasAviso(diasAviso || RECORDATORIO_PERSONAL_DEFAULT)}
        onGuardar={guardar}
        onEliminar={eliminar}
        onSubirFoto={subirFoto}
        onAgregarIdea={agregarIdea}
        onAgregarPaquete={agregarPaquete}
        onAgregarIdeas={agregarIdeas}
        onElegir={elegir}
      />
      {hoja && (
        <Suspense fallback={null}>
          <AgregarRapidoDeProducto product={hoja.producto} abierto={hoja.abierta} onCerrar={() => setHoja((h) => ({ ...h, abierta: false }))} />
        </Suspense>
      )}
    </>
  );
}
