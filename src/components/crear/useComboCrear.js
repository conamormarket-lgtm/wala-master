import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { useGlobalToast } from '../../contexts/ToastContext';
import { trackEditorOpen } from '../../services/analytics/tracker';
import { getComboCrear } from '../../services/combosCrear';
import { getPrendaBase } from '../../services/prendasBase';
import { getDesignById, getDesignsByUser } from '../../services/designs';
import { guardarMiCombo, copiarCreacionParaCombo, esComboVigente } from '../../services/misCombos';
import { obtenerDisenoComunidad, registrarUsoComunidad } from '../../services/comunidad';
import { creacionLista } from '../../pages/Crear/creacionCarrito';
import { leerArmado, guardarArmado, olvidarArmado, preciosDeCombo, itemDeCombo, leerMetaArmado, guardarMetaArmado, esPiezaFija, varianteDeFija } from '../../pages/Crear/comboCrear';
import { esperarGuardados } from '../../pages/Crear/borradoresCache';

// Lo que devuelve getDocument cuando el documento no existe.
const NO_ENCONTRADO = 'Documento no encontrado';
import { tallasPara, useFotosDePiezas } from '../../pages/Crear/fotosCombo';

/*
 * Lo que hace un combo de Crear (/combo/:id), sin su dibujo: lo usa
 * ComboDeTienda (el kit). Es la lógica de ComboCrearViejo, igual:
 *  - el armado (qué creación y qué talla lleva cada prenda) vive en el
 *    navegador (comboCrear.js); ?nuevo=1 empieza limpio, ?plantilla= parte de
 *    un combo de la comunidad y ?mio= abre un "Mi combo" de la cuenta
 *  - en cuanto una prenda tiene diseño, el combo se guarda en la cuenta como
 *    "Mi combo" y su id queda en la dirección
 *  - un conjunto (prendas distintas) lleva una talla para todas; una pareja o
 *    un trío, una por prenda (salvo que el admin elija otra cosa: combo.tallas)
 *  - comprar: las prendas de la comunidad se guardan antes en la cuenta
 *    (crearDesdePlantilla), el combo entra al carrito como una sola línea
 *    (itemDeCombo) y se va al carrito
 *  - una pieza fija (el reloj de un pack de Yoryo) va tal cual en el color
 *    del admin: siempre está lista, sin diseño ni talla
 */

// Combos ya registrados como abiertos en esta pestaña: se vuelve al combo
// después de diseñar cada prenda y eso no es otra apertura.
const combosRegistrados = new Set();

export default function useComboCrear() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAdmin } = useAuth();
  const { addToCart } = useCart();
  const toast = useGlobalToast();
  const queryClient = useQueryClient();
  // ?mio=X abre un "Mi combo" de la cuenta; ?plantilla=Y, un combo de la comunidad.
  const [params, setParams] = useSearchParams();
  const mioParam = params.get('mio');
  const plantillaParam = params.get('plantilla');
  // ?nuevo=1 ("Armar" en Crear): empieza un combo limpio. Lo que tenía a medias
  // sigue en su cuenta como borrador.
  const nuevoParam = params.get('nuevo');

  const comboQ = useQuery({
    queryKey: ['combo-crear', id],
    queryFn: async () => {
      const { data, error, noEncontrado } = await getComboCrear(id);
      if (error && !noEncontrado) throw new Error(error);
      return data;
    },
  });
  const combo = comboQ.data;
  const piezasCombo = combo?.piezas || [];

  useEffect(() => {
    if (!combo || combosRegistrados.has(id)) return;
    combosRegistrados.add(id);
    trackEditorOpen({ productId: id, editorType: 'combo', comboId: id, plantilla: plantillaParam || null }, user || {}).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combo, id]);

  const prendasQ = useQueries({
    queries: piezasCombo.map((p) => ({
      queryKey: ['prenda-base', p.prendaId],
      queryFn: async () => {
        const { data, error } = await getPrendaBase(p.prendaId);
        if (error) throw new Error(error);
        return data;
      },
      // Al día al abrir el combo (colores nuevos de la prenda).
      refetchOnMount: 'always',
    })),
  });
  const prendas = prendasQ.map((q) => q.data || null);

  const [armado, setArmado] = useState([]);
  const [meta, setMeta] = useState({ miComboId: '', plantilla: '' });
  useEffect(() => {
    if (!piezasCombo.length) return;
    if (nuevoParam) {
      olvidarArmado(id);
      const sin = new URLSearchParams(params);
      sin.delete('nuevo');
      setParams(sin, { replace: true });
    }
    // Un combo de la comunidad nuevo empieza limpio (las creaciones que ya
    // hizo siguen en su cuenta).
    if (plantillaParam && plantillaParam !== leerMetaArmado(id).plantilla) {
      olvidarArmado(id);
      guardarMetaArmado(id, { plantilla: plantillaParam });
    }
    // La dirección es de OTRO combo que lo del navegador (otra pestaña): se
    // espera a cargarlo de la cuenta (efecto de abajo) en vez de mostrar este.
    if (mioParam && !nuevoParam && leerMetaArmado(id).miComboId !== mioParam) return;
    setArmado(leerArmado(id, piezasCombo.length));
    setMeta(leerMetaArmado(id));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, piezasCombo.length, plantillaParam, nuevoParam]);
  const cambiarArmado = (siguiente) => {
    setArmado(siguiente);
    guardarArmado(id, siguiente);
  };

  // ?mio=X es la dirección de UN combo del cliente ("Mi combo"): al abrirla
  // (o recargarla) sus piezas y tallas salen de su cuenta, no del navegador.
  // Así cada combo tiene su enlace y dos pestañas no se pisan. Si no es suyo
  // (un enlace ajeno), empieza uno limpio.
  const mioPropioRef = useRef('');
  // Se pide en paralelo con el combo y sus prendas y queda en caché: es el
  // mismo "Mi combo" de más abajo. Sus fotos y nombres guardados se ven
  // mientras cargan las prendas.
  const mioQ = useQuery({
    queryKey: ['creacion', mioParam, user?.uid],
    enabled: Boolean(user && mioParam),
    refetchOnMount: 'always',
    queryFn: async () => {
      await esperarGuardados();
      const { data } = await getDesignById(mioParam);
      return data ? { id: mioParam, ...data } : null;
    },
  });
  useEffect(() => {
    // Con lo traído DESPUÉS de abrir la página: lo de la caché es de antes de
    // ir al estudio y pisaba lo que el estudio acababa de guardar (la otra
    // prenda de "Ponerlo también en la prenda 2" volvía a quedar vacía).
    if (!mioParam || !user || !piezasCombo.length || !mioQ.isFetchedAfterMount) return;
    // Lo puso esta misma página al crear el combo: ya está al día.
    if (mioParam === mioPropioRef.current) return;
    const data = mioQ.data;
    olvidarArmado(id);
    if (esComboVigente(data) && data.userId === user.uid && data.comboId === id) {
      const siguiente = Array.from({ length: piezasCombo.length }, (_, i) => ({
        designId: data.piezas?.[i]?.designId || '',
        talla: data.piezas?.[i]?.talla || '',
      }));
      const conMeta = { miComboId: mioParam, plantilla: plantillaParam || '' };
      guardarArmado(id, siguiente);
      guardarMetaArmado(id, conMeta);
      setArmado(siguiente);
      setMeta(conMeta);
      return;
    }
    setArmado(leerArmado(id, piezasCombo.length));
    setMeta(leerMetaArmado(id));
    const sin = new URLSearchParams(params);
    sin.delete('mio');
    setParams(sin, { replace: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mioParam, user?.uid, id, piezasCombo.length, mioQ.data, mioQ.isFetchedAfterMount]);

  /** Al crear "Mi combo", su id queda en la dirección (?mio=). */
  const ponerMioEnDireccion = (miComboId) => {
    mioPropioRef.current = miComboId;
    const con = new URLSearchParams(window.location.search);
    con.set('mio', miComboId);
    con.delete('nuevo');
    setParams(con, { replace: true });
  };

  // El combo de la comunidad del que partió: cada pieza sin diseño propio
  // muestra el suyo y se personaliza desde ahí. Mientras despierta la función
  // del servidor se usa lo que ya trajo la galería de la comunidad.
  const plantillaId = meta.plantilla || plantillaParam || '';
  const plantillaQ = useQuery({
    queryKey: ['comunidad-diseno', plantillaId],
    refetchOnMount: 'always',
    enabled: Boolean(plantillaId),
    placeholderData: () => (queryClient.getQueryData(['comunidad']) || [])
      .find((d) => d.id === plantillaId && d.tipo === 'combo' && d.comboId === id),
    queryFn: async () => {
      const d = await obtenerDisenoComunidad(plantillaId);
      return d && d.tipo === 'combo' && d.comboId === id ? d : null;
    },
  });
  const plantillaCombo = plantillaQ.data;
  // Sin nada que mostrar todavía: las prendas dicen "Cargando…", no "Diseñar".
  const esperandoPlantilla = Boolean(plantillaId) && !plantillaCombo && plantillaQ.isFetching;

  const creacionesQ = useQueries({
    queries: armado.map((a) => ({
      queryKey: ['creacion', a.designId, user?.uid],
      enabled: Boolean(user && a.designId),
      // Al volver del estudio, cada prenda se ve con lo último que se editó.
      refetchOnMount: 'always',
      queryFn: async () => {
        // Si se vuelve del estudio con un autoguardado en curso, se espera.
        await esperarGuardados();
        const { data } = await getDesignById(a.designId);
        return data ? { id: a.designId, ...data } : null;
      },
    })),
  });
  // Solo las creaciones propias de la prenda de esa pieza.
  const creaciones = armado.map((a, i) => {
    const c = creacionesQ[i]?.data;
    return c && c.userId === user?.uid && c.productId === piezasCombo[i]?.prendaId ? c : null;
  });

  const { data: misCreaciones = [] } = useQuery({
    queryKey: ['mis-creaciones-crear', user?.uid],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data } = await getDesignsByUser(user.uid);
      // Igual que Crear (misma clave de caché): creaciones y "Mis combos".
      return (data || []).filter((d) => d.tipo === 'crear' || d.tipo === 'comboCrear');
    },
  });

  const { precio, sueltas, ahorro } = combo ? preciosDeCombo(combo, prendas) : { precio: 0, sueltas: 0, ahorro: 0 };

  // En cuanto una pieza tiene diseño, el combo se guarda en la cuenta como UNA
  // creación ("Mi combo"): borrador mientras falte algo, terminado cuando
  // todas sus piezas estén guardadas. Se mantiene al día con cada cambio.
  const todasConDiseno = Boolean(user && combo && (armado.some((a) => a.designId) || meta.miComboId)
    && armado.every((a, i) => !a.designId || creaciones[i]));
  const firmaArmado = armado.map((a, i) => [
    a.designId, a.talla, creaciones[i]?.estado || '', (creaciones[i]?.archivosImpresion || []).length,
  ].join(':')).join('|');
  const firmaGuardadaRef = useRef('');
  const guardandoComboRef = useRef(false);
  useEffect(() => {
    if (!todasConDiseno || guardandoComboRef.current || firmaArmado === firmaGuardadaRef.current) return;
    // Con ?mio=, nada se guarda hasta tener el combo de la cuenta al día (lo
    // del navegador puede ser de antes o de otro dispositivo).
    if (mioParam && !mioQ.isFetchedAfterMount) return;
    guardandoComboRef.current = true;
    firmaGuardadaRef.current = firmaArmado;
    guardarMiCombo(user.uid, { id: meta.miComboId || undefined, combo, piezas: armado, creaciones })
      .then(({ id: guardadoId, error }) => {
        if (error) { firmaGuardadaRef.current = ''; return; }
        if (guardadoId && guardadoId !== meta.miComboId) {
          guardarMetaArmado(id, { miComboId: guardadoId });
          setMeta((m) => ({ ...m, miComboId: guardadoId }));
        }
        if (guardadoId && guardadoId !== new URLSearchParams(window.location.search).get('mio')) ponerMioEnDireccion(guardadoId);
        queryClient.invalidateQueries({ queryKey: ['mis-creaciones-crear'], refetchType: 'all' });
        queryClient.invalidateQueries({ queryKey: ['mis-borradores-crear'], refetchType: 'all' });
        queryClient.invalidateQueries({ queryKey: ['creacion', guardadoId] });
      })
      .finally(() => { guardandoComboRef.current = false; });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todasConDiseno, firmaArmado, mioQ.isFetchedAfterMount]);

  const miComboQ = useQuery({
    queryKey: ['creacion', meta.miComboId, user?.uid],
    enabled: Boolean(user && meta.miComboId),
    queryFn: async () => {
      const { data, error } = await getDesignById(meta.miComboId);
      // Sin red no es lo mismo que "ya no existe": eso solo con la respuesta.
      if (error && error !== NO_ENCONTRADO) throw new Error(error);
      return data ? { id: meta.miComboId, ...data } : null;
    },
  });
  const miCombo = miComboQ.data;
  // El combo que recordaba el navegador ya no está (se eliminó, quizá en otro
  // dispositivo): se olvida y se empieza limpio. Antes se seguía guardando en
  // él, fallaba siempre y lo diseñado quedaba sin combo.
  useEffect(() => {
    if (!meta.miComboId || !miComboQ.isFetchedAfterMount) return;
    if (miComboQ.data !== null && esComboVigente(miComboQ.data)) return;
    olvidarArmado(id);
    firmaGuardadaRef.current = '';
    setArmado(leerArmado(id, piezasCombo.length));
    setMeta({ miComboId: '', plantilla: '' });
    if (new URLSearchParams(window.location.search).get('mio')) {
      const sin = new URLSearchParams(window.location.search);
      sin.delete('mio');
      setParams(sin, { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta.miComboId, miComboQ.isFetchedAfterMount, miComboQ.data]);

  const miComboDoc = miCombo || mioQ.data || null;
  // Un conjunto (prendas distintas para una persona) lleva UNA talla para
  // todas. En una pareja o un trío de la misma prenda cada una lleva la suya.
  const esConjunto = new Set(piezasCombo.filter((p) => !esPiezaFija(p)).map((p) => p.prendaId)).size > 1;
  // La pieza de la comunidad que lleva cada prenda sin diseño propio.
  const plantillaDe = (i) => {
    const dePlantilla = plantillaCombo?.piezas?.[i];
    return !esPiezaFija(piezasCombo[i]) && !armado[i]?.designId && dePlantilla?.productId === piezasCombo[i]?.prendaId ? dePlantilla : null;
  };
  // Una prenda de la comunidad tiene las tallas del color de su diseño.
  const tallasPorPieza = armado.map((a, i) => (esPiezaFija(piezasCombo[i]) ? [] : tallasPara(prendas[i], creaciones[i] || plantillaDe(i))));
  const tallasComunes = (() => {
    const listas = tallasPorPieza.filter((t) => t.length);
    if (!listas.length) return [];
    const [primera, ...resto] = listas;
    return primera.filter((t) => resto.every((l) => l.includes(t)));
  })();
  // El admin puede fijar una talla para todas o una por prenda (combo.tallas);
  // sin elegir, un conjunto lleva una. Si las prendas no comparten ninguna
  // talla, cada prenda lleva la suya igual.
  const pideUna = combo?.tallas === 'una' || (combo?.tallas !== 'porPrenda' && esConjunto);
  const unaTalla = pideUna && (tallasComunes.length > 0 || tallasPorPieza.every((t) => !t.length));
  // La del conjunto: la que eligió el cliente (va en todas las piezas).
  const tallaConjunto = unaTalla ? (armado.find((a) => a.talla)?.talla || '') : '';
  const piezas = armado.map((a, i) => {
    if (esPiezaFija(piezasCombo[i])) {
      return {
        designId: '', talla: '', i, prenda: prendas[i], creacion: null, plantilla: null, tallas: [],
        cargando: false, respaldo: null, esperando: false, lista: Boolean(prendas[i]), fija: true, color: piezasCombo[i].color,
      };
    }
    const creacion = creaciones[i];
    const plantilla = plantillaDe(i);
    const tallas = tallasPorPieza[i];
    const talla = unaTalla
      ? (tallas.includes(tallaConjunto) ? tallaConjunto : '')
      : tallas.includes(a.talla) ? a.talla
        : tallas.includes(creacion?.variant?.size) ? creacion.variant.size : '';
    const cargando = Boolean(a.designId && creacionesQ[i]?.isLoading);
    // Mientras carga: la foto y el nombre que guardó "Mi combo" de esta prenda.
    const guardada = (miComboDoc?.piezas || [])[i];
    const respaldo = cargando && guardada?.designId === a.designId ? guardada : null;
    const esperando = !a.designId && esperandoPlantilla;
    // Una prenda de la comunidad sin tocar también está lista: al agregar al
    // carrito se guarda tal cual en la cuenta (crearDesdePlantilla).
    const lista = Boolean(creacion ? creacionLista(creacion) : plantilla);
    return { ...a, i, prenda: prendas[i], creacion, plantilla, tallas, talla, cargando, respaldo, esperando, lista };
  });
  const fotosPiezas = useFotosDePiezas(piezas);
  // "Preparando tu combo…": las prendas de la comunidad se guardan en la cuenta.
  const [preparando, setPreparando] = useState('');

  const cargando = comboQ.isLoading || prendasQ.some((q) => q.isLoading);
  const error = comboQ.isError || prendasQ.some((q) => q.isError);
  const disponible = Boolean(combo && combo.deleted !== true && (combo.publicado || isAdmin)
    && piezasCombo.length > 0 && prendas.every((p) => p && p.deleted !== true && (p.visible !== false || isAdmin))
    // La pieza fija necesita su color: si el admin lo quitó del producto, el combo no se arma.
    && piezasCombo.every((p, i) => !esPiezaFija(p) || varianteDeFija(prendas[i], p.color)));

  const agotada = (p) => typeof p?.inStock === 'number' && p.inStock <= 0;
  // El estudio recibe también este combo (?mio=) para guardar y volver a él.
  // Una pieza sin diseño abre en el color que eligió el admin (Ónix: la billetera negra).
  const urlEstudio = (i, extra = '') => `/crear/${piezasCombo[i].prendaId}?combo=${id}&pieza=${i}`
    + `${meta.miComboId ? `&mio=${meta.miComboId}` : ''}`
    + `${piezasCombo[i].color?.id && !armado[i]?.designId ? `&color=${encodeURIComponent(piezasCombo[i].color.id)}` : ''}${extra}`;
  const estadoEstudio = { desde: `/combo/${id}${meta.miComboId ? `?mio=${meta.miComboId}` : ''}` };
  const urlPlantilla = (i) => urlEstudio(i, `&plantilla=${meta.plantilla}&plantillaPieza=${i}`);
  const sinTallaTodavia = (p) => !p.creacion && p.plantilla;

  const elegirTallaConjunto = (t) => cambiarArmado(armado.map((a) => ({ ...a, talla: t })));
  const ponerEn = (i, cambios) => cambiarArmado(armado.map((a, k) => (k === i ? { ...a, ...cambios } : a)));
  const quitar = (i) => ponerEn(i, { designId: '', talla: '' });

  /**
   * Una copia de la creación para la prenda i (cada prenda del combo tiene la
   * suya: cambiar o borrar una no toca la otra, y una creación suelta elegida
   * de "Mis creaciones" sigue igual). Las imágenes son las mismas: no se sube nada.
   */
  const copiaPara = async (creacion, i) => {
    const { id: copia, error: e } = await copiarCreacionParaCombo(user.uid, creacion, combo, i);
    if (e || !copia) throw new Error(e || 'No pudimos copiar el diseño.');
    return copia;
  };

  /** El mismo diseño (una copia en cada una) en las piezas vacías de la misma prenda. */
  const usarEnLasDemas = async (i) => {
    const pieza = piezas[i];
    const destinos = piezas.filter((p) => p.i !== i && !p.designId && piezasCombo[p.i].prendaId === piezasCombo[i].prendaId);
    if (!destinos.length || !pieza.creacion || !user || preparando) return;
    setPreparando('Copiando el diseño…');
    try {
      const copias = {};
      for (const d of destinos) copias[d.i] = await copiaPara(pieza.creacion, d.i);
      cambiarArmado(armado.map((a, k) => (copias[k] ? { ...a, designId: copias[k] } : a)));
      toast.success(destinos.length === 1 ? 'Listo: la otra prenda lleva el mismo diseño.' : 'Listo: las demás prendas llevan el mismo diseño.');
    } catch (e) {
      toast.error(e?.message || 'No pudimos copiar el diseño.');
    } finally {
      setPreparando('');
    }
  };

  /** Una creación de "Mis creaciones" en la prenda i: va una copia suya. */
  const elegirCreacion = async (i, designId) => {
    const elegida = misCreaciones.find((c) => c.id === designId);
    if (!elegida || !user || preparando) return;
    setPreparando('Copiando tu creación…');
    try {
      ponerEn(i, { designId: await copiaPara(elegida, i), talla: '' });
    } catch (e) {
      toast.error(e?.message || 'No pudimos usar esa creación.');
    } finally {
      setPreparando('');
    }
  };

  /** Agregar al carrito con las tallas elegidas ({ todas } o { [i]: talla }). */
  const agregar = async (elegidas = {}) => {
    if (preparando) return;
    const sinDiseno = piezas.find((p) => !p.lista);
    if (sinDiseno) {
      toast.info(!sinDiseno.creacion ? `Falta el diseño de la prenda ${sinDiseno.i + 1}.`
        : `Abre y guarda otra vez el diseño de la prenda ${sinDiseno.i + 1}.`);
      return;
    }
    const tallaDe = (p) => {
      const t = elegidas.todas ?? elegidas[p.i];
      return t && p.tallas.includes(t) ? t : p.talla;
    };
    const piezasCompra = piezas.map((p) => ({ ...p, talla: tallaDe(p) }));
    // Quedan en el armado: si antes hay que iniciar sesión, al volver siguen elegidas.
    if (piezasCompra.some((p, i) => p.talla !== piezas[i].talla)) {
      cambiarArmado(armado.map((a, i) => ({ ...a, talla: piezasCompra[i].talla || a.talla })));
    }
    await comprar(piezasCompra);
  };

  const comprar = async (piezasCompra) => {
    const falta = piezasCompra.find((p) => !p.lista || (p.tallas.length && !p.talla));
    if (falta) {
      toast.info(!falta.creacion && !falta.plantilla ? `Falta el diseño de la prenda ${falta.i + 1}.`
        : !falta.lista ? `Abre y guarda otra vez el diseño de la prenda ${falta.i + 1}.`
          : unaTalla ? 'Elige la talla del conjunto.' : `Elige la talla de la prenda ${falta.i + 1}.`);
      return;
    }
    if (piezasCompra.some((p) => agotada(p.prenda))) {
      toast.info('Una de las prendas está agotada por ahora.');
      return;
    }
    if (!combo.publicado) {
      toast.info('Este combo está en borrador: publícalo para poder venderlo.');
      return;
    }
    const deComunidad = piezasCompra.filter(sinTallaTodavia);
    if (deComunidad.length && !user) {
      toast.info('Inicia sesión para agregar tu combo al carrito.');
      navigate('/login', { state: { from: location.pathname + location.search } });
      return;
    }
    const finales = piezasCompra.map((p) => p.creacion);
    let miComboId = meta.miComboId;
    if (deComunidad.length) {
      // Como un diseño individual de la comunidad: cada prenda se guarda tal
      // cual en la cuenta (con sus archivos de impresión) y el combo queda
      // en "Mi combo".
      guardandoComboRef.current = true;
      try {
        for (const [k, p] of deComunidad.entries()) {
          setPreparando(`Preparando tu combo (prenda ${k + 1} de ${deComunidad.length})…`);
          const { crearDesdePlantilla } = await import('../../pages/Crear/crearDesdePlantilla');
          finales[p.i] = await crearDesdePlantilla({
            uid: user.uid, prenda: p.prenda, pieza: p.plantilla, talla: p.talla, basadoEn: plantillaId,
            combo: { id, nombre: combo.name || '', pieza: p.i },
          });
        }
        const nuevoArmado = armado.map((a, i) => ({ ...a, designId: finales[i]?.id || a.designId, talla: piezasCompra[i].talla }));
        cambiarArmado(nuevoArmado);
        setPreparando('Guardando tu combo…');
        const { id: guardadoId } = await guardarMiCombo(user.uid, { id: miComboId || undefined, combo, piezas: nuevoArmado, creaciones: finales });
        if (guardadoId) {
          miComboId = guardadoId;
          guardarMetaArmado(id, { miComboId: guardadoId });
          // También en el estado: si el guardado automático de "Mi combo" corre
          // antes de salir, actualiza este en vez de crear otro igual.
          setMeta((m) => ({ ...m, miComboId: guardadoId }));
        }
        registrarUsoComunidad(plantillaId);
        queryClient.invalidateQueries({ queryKey: ['mis-creaciones-crear'], refetchType: 'all' });
      } catch (e) {
        toast.error(`No pudimos preparar tu combo: ${e?.message || e}`);
        return;
      } finally {
        guardandoComboRef.current = false;
        setPreparando('');
      }
    }
    addToCart(...itemDeCombo({
      combo,
      piezas: piezasCompra.map((p) => ({ prenda: p.prenda, creacion: finales[p.i], talla: p.talla })),
      miComboId,
    }));
    olvidarArmado(id);
    navigate('/carrito');
  };

  /** Las creaciones terminadas de la cuenta que puede llevar la prenda i. */
  const opcionesMias = (i) => misCreaciones.filter(
    (c) => c.tipo === 'crear' && !c.combo?.id && c.productId === piezasCombo[i]?.prendaId && c.estado !== 'borrador' && creacionLista(c)
  );

  return {
    id, user, cargando, error, disponible, combo, piezasCombo, piezas, fotosPiezas, meta, miCombo,
    plantillaCombo, precio, sueltas, ahorro, unaTalla, tallasConjunto: unaTalla ? tallasComunes : [], tallaConjunto,
    preparando, agotada, urlEstudio, urlPlantilla, estadoEstudio,
    elegirTallaConjunto, ponerEn, quitar, usarEnLasDemas, elegirCreacion, agregar, opcionesMias,
    reintentar: () => { comboQ.refetch(); prendasQ.forEach((q) => q.isError && q.refetch()); },
  };
}
