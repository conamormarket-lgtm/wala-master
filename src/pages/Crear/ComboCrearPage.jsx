import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { Paintbrush, Images, Copy, Pencil, X, ShoppingBag, Loader2, CheckCircle2, Sparkles, Truck, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { useGlobalToast } from '../../contexts/ToastContext';
import { getComboCrear } from '../../services/combosCrear';
import { getPrendaBase } from '../../services/prendasBase';
import { getDesignById, getDesignsByUser } from '../../services/designs';
import { leerPrendaBase, tallasDeColor, fotoDeVista, fondoDeVista, cargarImagen } from '../../utils/prendaBase';
import { renderizarVistaPrevia } from './renderDiseno';
import { creacionLista } from './creacionCarrito';
import { leerArmado, guardarArmado, olvidarArmado, preciosDeCombo, itemDeCombo, leerMetaArmado, guardarMetaArmado } from './comboCrear';
import { guardarMiCombo } from '../../services/misCombos';
import { obtenerDisenoComunidad, registrarUsoComunidad } from '../../services/comunidad';
import { crearDesdePlantilla } from './crearDesdePlantilla';
import AccionesComunidad from '../Comunidad/AccionesComunidad';
import CapaModal from './CapaModal';
import { esperarGuardados } from './borradoresCache';
import NombreEditable from './NombreEditable';
import PuntosColor from './PuntosColor';
import styles from './ComboCrearPage.module.css';
// La misma ficha que una creación (y que el producto de la tienda).
import ficha from './CreacionPage.module.css';
// La ventana "¿Qué talla quieres?" del estudio (diseño individual).
import estudio from './CrearStudioPage.module.css';
// Las prendas juntas, lado a lado (como la tarjeta de Mi combo).
import duo from './TarjetaMiCombo.module.css';

const soles = (n) => `S/ ${Number(n || 0).toFixed(2)}`;

/** Tallas de la prenda en el color de la creación. */
const tallasPara = (prenda, creacion) => {
  if (!prenda) return [];
  const cfg = leerPrendaBase(prenda);
  const color = cfg.colores.find((c) => c.id === creacion?.color?.id || c.nombre === creacion?.color?.nombre);
  return color ? tallasDeColor(color, cfg) : cfg.tallas;
};

/** Frente y espalda de una pieza: su diseño, el de la comunidad o la prenda en blanco. */
/**
 * Fotos de una pieza y de dónde salen:
 *  - 'render': sus lados con diseño, ya renderizados con el fondo y el margen
 *    del estudio (vistas previas de la creación o de la plantilla o, en un
 *    borrador, sus miniaturas). Los lados sin diseño se completan con la
 *    prenda lisa en su color (useLadosLisos), renderizada igual.
 *  - 'prenda': la prenda en blanco (sin diseño todavía), foto de catálogo.
 * Así la tarjeta las muestra al mismo tamaño y sobre el mismo fondo.
 */
const ladosDePieza = (p) => {
  const previas = (p.creacion?.vistasPrevias || p.plantilla?.vistasPrevias || []).filter((v) => v?.url);
  if (previas.length) return { origen: 'render', lados: previas.map((v) => ({ url: v.url, nombre: v.nombre, vista: v.vista })) };
  const conjunta = p.creacion?.imagenConjunta || p.plantilla?.imagenConjunta;
  if (conjunta) return { origen: 'render', lados: [{ url: conjunta, nombre: '' }], completa: true };
  // Un borrador todavía no tiene vistas previas: sus miniaturas (las que se
  // guardan solas mientras se diseña), una por lado; los de antes, una sola.
  const miniaturas = (p.creacion?.miniaturas || []).filter((m) => m?.url);
  if (miniaturas.length) return { origen: 'render', lados: miniaturas.map((m) => ({ url: m.url, nombre: m.nombre, vista: m.vista })) };
  if (p.creacion?.miniatura) return { origen: 'render', lados: [{ url: p.creacion.miniatura, nombre: '' }], completa: true };
  // Mientras carga la prenda: las fotos que guardó "Mi combo".
  if (!p.creacion && p.respaldo?.frente) {
    return { origen: 'render', lados: [p.respaldo.frente, p.respaldo.espalda].filter(Boolean).map((url) => ({ url, nombre: '' })), completa: true };
  }
  if (!p.prenda) return { origen: 'prenda', lados: [] };
  return {
    origen: 'prenda',
    lados: leerPrendaBase(p.prenda).vistas.filter((v) => v.imagen).map((v) => ({ url: v.imagen, nombre: v.nombre })),
  };
};

/** El color guardado de la pieza, en la configuración de su prenda (o null). */
const colorDePieza = (p, cfg) => {
  const guardado = p.creacion?.color || p.plantilla?.color || null;
  return cfg?.colores.find((c) => c.id === guardado?.id)
    || cfg?.colores.find((c) => c.nombre === guardado?.nombre) || null;
};

/**
 * Las fotos de todas las piezas: sus lados con diseño y, a continuación, la
 * prenda lisa en su color para cada lado SIN diseño (renderizada como las
 * vistas previas: mismo fondo y margen). Así una prenda con diseño solo
 * adelante también muestra su espalda. Una consulta por prenda, color y lado
 * (queda en memoria). Devuelve, por pieza: { origen, lados, conDiseno }.
 */
const useFotosDePiezas = (piezas) => {
  const base = piezas.map((p) => {
    const fotos = ladosDePieza(p);
    const cfg = p.prenda ? leerPrendaBase(p.prenda) : null;
    const color = colorDePieza(p, cfg);
    // Solo si se sabe qué lados tienen diseño (una imagen única no lo dice).
    const conVista = new Set(fotos.lados.map((l) => l.vista).filter(Boolean));
    const faltan = fotos.origen === 'render' && !fotos.completa && color && conVista.size
      ? cfg.vistas.filter((v) => !conVista.has(v.id) && fotoDeVista(v, color))
      : [];
    return { p, fotos, color, faltan };
  });
  const pedidos = base.flatMap((b, k) => b.faltan.map((v) => ({ k, b, v })));
  const consultas = useQueries({
    queries: pedidos.map(({ b, v }) => ({
      queryKey: ['prenda-lisa', b.p.prenda.id, b.color.id, v.id],
      staleTime: Infinity,
      queryFn: async () => {
        const img = await cargarImagen(fotoDeVista(v, b.color));
        const blob = await renderizarVistaPrevia({
          fuente: fondoDeVista(img, v, b.color), anchoImg: img.naturalWidth, altoImg: img.naturalHeight,
          vista: v, capasPorZona: {}, srcDe: (c) => c.src, ancho: 600,
        });
        return URL.createObjectURL(blob);
      },
    })),
  });
  return base.map((b, k) => {
    const lisos = pedidos
      .map((x, n) => (x.k === k ? { url: consultas[n]?.data || '', nombre: x.v.nombre, vista: x.v.id, lisa: true } : null))
      .filter((l) => l && l.url);
    return {
      origen: b.fotos.origen,
      lados: [...b.fotos.lados, ...lisos],
      // La etiqueta nombra solo los lados con diseño (no los lisos ni la prenda en blanco).
      conDiseno: b.fotos.origen === 'render' ? b.fotos.lados.map((l) => l.nombre).filter(Boolean) : [],
    };
  });
};

/** ¿La pieza todavía no tiene diseño? (su foto es la prenda en blanco, atenuada). */
const piezaVacia = (p) => !p.creacion && !p.plantilla && !p.respaldo?.frente;

/**
 * Galería del combo, como la de una creación (miniaturas en columna, zoom que
 * sigue al cursor, deslizar con el dedo). La primera imagen es todo el combo
 * (las prendas juntas); después, los lados de cada prenda.
 */
const GaleriaCombo = ({ piezas, fotos, sel, setSel, nombre }) => {
  const [zoom, setZoom] = useState(false);
  const [pos, setPos] = useState({ x: 50, y: 50 });
  const toqueX = useRef(null);
  const frentes = piezas.map((p, k) => ({ p, url: fotos[k]?.lados[0]?.url || '', origen: fotos[k]?.origen }))
    .filter((f) => f.url);
  const vistas = [
    { tipo: 'conjunto', nombre: 'Todo el combo' },
    ...piezas.flatMap((p, k) => (fotos[k]?.lados || []).map((l) => ({
      url: l.url,
      nombre: `Prenda ${p.i + 1}${l.nombre ? ` · ${l.nombre}` : ''}`,
      origen: fotos[k].origen,
      vacia: piezaVacia(p),
    }))),
  ];
  const actual = vistas[Math.min(sel, vistas.length - 1)];
  const conZoom = zoom && actual.tipo !== 'conjunto';

  const mover = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    setPos({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
  };
  const soltarDedo = (e) => {
    if (toqueX.current === null) return;
    const inicio = toqueX.current;
    toqueX.current = null;
    const finX = e.changedTouches[0]?.clientX;
    if (vistas.length < 2 || typeof finX !== 'number' || Math.abs(finX - inicio) < 44) return;
    setSel((i) => (finX < inicio ? Math.min(i + 1, vistas.length - 1) : Math.max(i - 1, 0)));
  };
  // Las prendas juntas: en grande y en su miniatura.
  const juntas = (chico = false) => (
    <span className={`${duo.prendas} ${chico ? styles.juntasChico : ''}`} style={{ '--n': Math.max(frentes.length, 1) }}>
      {frentes.map((f) => (
        <span key={`${f.p.i}-${f.url}`} className={duo.prenda}>
          <img src={f.url} alt="" loading="lazy" className={`${f.origen === 'prenda' ? styles.conMargen : ''} ${piezaVacia(f.p) ? styles.atenuada : ''}`} />
        </span>
      ))}
    </span>
  );

  return (
    <div className={ficha.galeria}>
      {vistas.length > 1 && (
        <div className={ficha.miniaturas}>
          {vistas.map((v, i) => (
            <button
              key={`${v.nombre}-${v.url || 'juntas'}`}
              type="button"
              className={`${ficha.miniatura} ${i === sel ? ficha.miniaturaActiva : ''}`}
              onClick={() => setSel(i)}
              onMouseEnter={() => setSel(i)}
              aria-label={v.nombre}
              aria-pressed={i === sel}
            >
              {v.tipo === 'conjunto'
                ? <span className={`${styles.miniaturaJuntas} ${i === sel ? styles.miniaturaJuntasActiva : ''}`}>{juntas(true)}</span>
                : <img src={v.url} alt="" loading="lazy" className={v.origen === 'prenda' ? styles.conMargen : ''} />}
              <span>{v.nombre}</span>
            </button>
          ))}
        </div>
      )}
      <div
        className={`${ficha.marco} ${actual.tipo === 'conjunto' ? styles.marcoJuntas : ''}`}
        onMouseEnter={() => setZoom(true)}
        onMouseLeave={() => setZoom(false)}
        onMouseMove={mover}
        onTouchStart={(e) => { toqueX.current = e.touches[0]?.clientX ?? null; setZoom(false); }}
        onTouchEnd={soltarDedo}
        onTouchCancel={() => { toqueX.current = null; }}
      >
        {actual.tipo === 'conjunto' ? juntas() : (
          <img
            src={actual.url}
            alt={`${nombre} · ${actual.nombre}`}
            className={`${ficha.marcoImg} ${actual.origen === 'prenda' ? styles.conMargen : ''} ${actual.vacia ? styles.atenuada : ''}`}
            style={conZoom ? { transform: 'scale(2.2)', transformOrigin: `${pos.x}% ${pos.y}%` } : undefined}
          />
        )}
        <span className={ficha.ladoActual}>{actual.nombre}</span>
        {!conZoom && actual.tipo !== 'conjunto' && <span className={ficha.pistaZoom}>Pasa el cursor para ver de cerca</span>}
      </div>
    </div>
  );
};

/**
 * Armar un combo de Crear: una tarjeta por pieza. Cada pieza se diseña en el
 * estudio de siempre (o se elige una creación ya hecha, o se copia el diseño
 * de otra pieza) y lleva su talla. Al final todo entra al carrito como una
 * sola línea, al precio del combo.
 */
const ComboCrearPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAdmin } = useAuth();
  const { addToCart } = useCart();
  const toast = useGlobalToast();
  const queryClient = useQueryClient();
  const [eligiendo, setEligiendo] = useState(null);
  // ?mio=X abre un "Mi combo" de la cuenta; ?plantilla=Y, un combo de la comunidad.
  const [params, setParams] = useSearchParams();
  const mioParam = params.get('mio');
  const plantillaParam = params.get('plantilla');
  // ?nuevo=1 ("Armar" en Crear): empieza un combo limpio. Lo que tenía a medias
  // sigue en su cuenta como borrador.
  const nuevoParam = params.get('nuevo');

  const { data: combo, isLoading, isError: errorCombo } = useQuery({
    queryKey: ['combo-crear', id],
    queryFn: async () => {
      const { data, error, noEncontrado } = await getComboCrear(id);
      if (error && !noEncontrado) throw new Error(error);
      return data;
    },
  });
  const piezasCombo = combo?.piezas || [];

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
  // Se pide en paralelo con el combo y sus prendas (antes esperaba a que
  // terminaran) y queda en caché: es el mismo "Mi combo" de más abajo. Sus
  // fotos y nombres guardados se ven mientras cargan las prendas.
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
    if (!mioParam || !user || !piezasCombo.length || !mioQ.isFetched) return;
    // Lo puso esta misma página al crear el combo: ya está al día.
    if (mioParam === mioPropioRef.current) return;
    (() => {
      const data = mioQ.data;
      olvidarArmado(id);
      if (data && data.tipo === 'comboCrear' && data.userId === user.uid && data.comboId === id) {
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
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mioParam, user?.uid, id, piezasCombo.length, mioQ.data, mioQ.isFetched]);

  /** Al crear "Mi combo", su id queda en la dirección (?mio=). */
  const ponerMioEnDireccion = (miComboId) => {
    mioPropioRef.current = miComboId;
    const con = new URLSearchParams(window.location.search);
    con.set('mio', miComboId);
    con.delete('nuevo');
    setParams(con, { replace: true });
  };

  // El combo de la comunidad del que partió: cada pieza sin diseño propio
  // muestra el suyo y se personaliza desde ahí.
  // Se pide apenas se abre (con ?plantilla=, sin esperar a lo guardado). La
  // función del servidor puede tardar en despertar: mientras, se usa lo que
  // ya trajo la galería de la comunidad (fotos y nombres de cada prenda), de
  // donde se viene al tocar "Usar diseño". Las capas las pide el estudio.
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
      // Al volver del estudio, cada prenda se ve con lo último que se editó
      // (la app guarda en memoria una hora y no recarga sola).
      refetchOnMount: 'always',
      queryFn: async () => {
        // Si se vuelve del estudio con un autoguardado en curso, se espera:
        // si no, se leía la versión de antes.
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
  // (Con "Mi combo" ya creado también se guarda si quita todas sus piezas.)
  const todasConDiseno = Boolean(user && combo && (armado.some((a) => a.designId) || meta.miComboId)
    && armado.every((a, i) => !a.designId || creaciones[i]));
  const firmaArmado = armado.map((a, i) => [
    a.designId, a.talla, creaciones[i]?.estado || '', (creaciones[i]?.archivosImpresion || []).length,
  ].join(':')).join('|');
  const firmaGuardadaRef = useRef('');
  const guardandoComboRef = useRef(false);
  useEffect(() => {
    if (!todasConDiseno || guardandoComboRef.current || firmaArmado === firmaGuardadaRef.current) return;
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
  }, [todasConDiseno, firmaArmado]);

  const { data: miCombo } = useQuery({
    queryKey: ['creacion', meta.miComboId, user?.uid],
    enabled: Boolean(user && meta.miComboId),
    queryFn: async () => {
      const { data } = await getDesignById(meta.miComboId);
      return data ? { id: meta.miComboId, ...data } : null;
    },
  });

  const miComboDoc = miCombo || mioQ.data || null;
  // Un conjunto (prendas distintas para una persona: casaca, polo y jogger)
  // lleva UNA talla para todas, como el conjunto de la tienda. En una pareja
  // o un trío de la misma prenda (varias personas) cada una lleva la suya.
  const esConjunto = new Set(piezasCombo.map((p) => p.prendaId)).size > 1;
  // La pieza de la comunidad que lleva cada prenda sin diseño propio.
  const plantillaDe = (i) => {
    const dePlantilla = plantillaCombo?.piezas?.[i];
    return !armado[i]?.designId && dePlantilla?.productId === piezasCombo[i]?.prendaId ? dePlantilla : null;
  };
  // Una prenda de la comunidad tiene las tallas del color de su diseño.
  const tallasPorPieza = armado.map((a, i) => tallasPara(prendas[i], creaciones[i] || plantillaDe(i)));
  const tallasComunes = (() => {
    const listas = tallasPorPieza.filter((t) => t.length);
    if (!listas.length) return [];
    const [primera, ...resto] = listas;
    return primera.filter((t) => resto.every((l) => l.includes(t)));
  })();
  // Si las prendas no comparten ninguna talla (una casaca de S a L y un jogger
  // de 28 a 34), una talla común no se podría elegir: cada prenda lleva la suya.
  const unaTalla = esConjunto && (tallasComunes.length > 0 || tallasPorPieza.every((t) => !t.length));
  // La del conjunto: la que eligió el cliente (va en todas las piezas). Sin
  // marcar hasta que la elija.
  const tallaConjunto = unaTalla ? (armado.find((a) => a.talla)?.talla || '') : '';
  const piezas = armado.map((a, i) => {
    const creacion = creaciones[i];
    // Diseño de la comunidad para esta pieza (si todavía no tiene uno propio).
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
  // Qué se ve en la galería (0 = todo el combo).
  const [verFoto, setVerFoto] = useState(0);
  const galeriaRef = useRef(null);
  // "Preparando tu combo…": las prendas de la comunidad se guardan en la cuenta.
  const [preparando, setPreparando] = useState('');
  const [pidiendoTallas, setPidiendoTallas] = useState(false);
  const [tallasElegidas, setTallasElegidas] = useState({});
  // Otro combo (o volver a este): la galería empieza en "Todo el combo".
  useEffect(() => { setVerFoto(0); }, [id, mioParam, plantillaParam]);

  if (isLoading || prendasQ.some((q) => q.isLoading)) {
    return (
      <div className={styles.estado}>
        <Loader2 className={styles.girando} size={28} aria-hidden="true" />
        <p>Cargando el combo…</p>
      </div>
    );
  }

  if (errorCombo || prendasQ.some((q) => q.isError)) {
    return (
      <div className={styles.estado}>
        <h1 className={styles.estadoTitulo}>No pudimos cargar el combo</h1>
        <p>Revisa tu conexión e inténtalo otra vez.</p>
        <button type="button" className={styles.principal} onClick={() => window.location.reload()}>Reintentar</button>
      </div>
    );
  }

  const disponible = combo && combo.deleted !== true && (combo.publicado || isAdmin)
    && piezasCombo.length > 0 && prendas.every((p) => p && p.deleted !== true && (p.visible !== false || isAdmin));
  if (!disponible) {
    return (
      <div className={styles.estado}>
        <h1 className={styles.estadoTitulo}>Este combo ya no está disponible</h1>
        <p>Puedes diseñar tus prendas por separado.</p>
        <Link to="/personalizar" className={styles.principal}>Ver las prendas</Link>
      </div>
    );
  }

  const agotada = (p) => typeof p?.inStock === 'number' && p.inStock <= 0;
  // El estudio recibe también este combo (?mio=) para guardar y volver a él.
  const urlEstudio = (i, extra = '') => `/crear/${piezasCombo[i].prendaId}?combo=${id}&pieza=${i}`
    + `${meta.miComboId ? `&mio=${meta.miComboId}` : ''}${extra}`;
  const estadoEstudio = { desde: `/combo/${id}${meta.miComboId ? `?mio=${meta.miComboId}` : ''}` };

  const tallasConjunto = unaTalla ? tallasComunes : [];
  const elegirTallaConjunto = (t) => cambiarArmado(armado.map((a) => ({ ...a, talla: t })));

  const urlPlantilla = (i) => urlEstudio(i, `&plantilla=${meta.plantilla}&plantillaPieza=${i}`);
  const pendientePlantilla = piezas.find((p) => p.plantilla);
  const sinTallaTodavia = (p) => !p.creacion && p.plantilla;
  const listas = piezas.filter((p) => p.lista && (!p.tallas.length || p.talla || sinTallaTodavia(p))).length;
  const completo = piezas.length > 0 && listas === piezas.length;

  const ponerEn = (i, cambios) => cambiarArmado(armado.map((a, k) => (k === i ? { ...a, ...cambios } : a)));
  const quitar = (i) => ponerEn(i, { designId: '', talla: '' });

  /** El mismo diseño en las piezas vacías de la misma prenda (con su color). */
  const usarEnLasDemas = (i) => {
    const pieza = piezas[i];
    const destinos = piezas.filter((p) => p.i !== i && !p.designId && piezasCombo[p.i].prendaId === piezasCombo[i].prendaId);
    if (!destinos.length) return;
    cambiarArmado(armado.map((a, k) => (destinos.some((d) => d.i === k) ? { ...a, designId: pieza.designId } : a)));
    toast.success(destinos.length === 1 ? 'Listo: la otra prenda lleva el mismo diseño.' : 'Listo: las demás prendas llevan el mismo diseño.');
  };

  // Con prendas de la comunidad, "Agregar al carrito" pregunta la talla en una
  // ventana, como un diseño individual de la comunidad.
  const agregar = () => {
    if (preparando) return;
    const sinDiseno = piezas.find((p) => !p.lista);
    if (sinDiseno) {
      toast.info(!sinDiseno.creacion ? `Falta el diseño de la prenda ${sinDiseno.i + 1}.`
        : `Abre y guarda otra vez el diseño de la prenda ${sinDiseno.i + 1}.`);
      return;
    }
    if (piezas.some(sinTallaTodavia)) {
      setTallasElegidas(Object.fromEntries(piezas.map((p) => [p.i, p.talla || ''])));
      setPidiendoTallas(true);
      return;
    }
    comprar(piezas);
  };

  const comprar = async (piezasCompra) => {
    if (preparando) return;
    const falta = piezasCompra.find((p) => !p.lista || (p.tallas.length && !p.talla));
    if (falta) {
      toast.info(!falta.creacion ? `Falta el diseño de la prenda ${falta.i + 1}.`
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

  const opcionesMias = eligiendo === null ? [] : misCreaciones.filter(
    (c) => c.tipo === 'crear' && c.productId === piezasCombo[eligiendo]?.prendaId && c.estado !== 'borrador' && creacionLista(c)
  );

  // Ver una prenda en la galería (su primer lado) desde su fila.
  const verPieza = (i) => {
    let indice = 1;
    for (let k = 0; k < i; k += 1) indice += fotosPiezas[k]?.lados.length || 0;
    setVerFoto(fotosPiezas[i]?.lados.length ? indice : 0);
    if (window.innerWidth <= 768) galeriaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const nombreCombo = miCombo?.name || combo.name;
  const descuento = sueltas > 0 && ahorro > 0 ? Math.round((ahorro / sueltas) * 100) : 0;
  const faltaTexto = completo ? 'Todo listo para agregar al carrito.'
    : unaTalla ? (pendientePlantilla ? 'Elige la talla (y personaliza las prendas si quieres).' : 'Diseña cada prenda y elige la talla.')
      : pendientePlantilla ? 'Elige la talla de cada prenda (y personalízalas si quieres).' : 'Diseña cada prenda y elige su talla.';

  return (
    // product-detail-page: como la ficha y la creación (en el celular, la
    // compra queda fija abajo y se esconden los botones flotantes).
    <div className={`${ficha.pagina} product-detail-page`}>
      <div ref={galeriaRef} className={ficha.columnaGaleria}>
        <GaleriaCombo piezas={piezas} fotos={fotosPiezas} sel={verFoto} setSel={setVerFoto} nombre={nombreCombo} />
      </div>

      <section className={ficha.info}>
        <nav className={ficha.migas} aria-label="Ruta">
          <Link to="/personalizar">Crear</Link>
          <span aria-hidden="true">/</span>
          {miCombo ? <Link to="/cuenta/creaciones">Mis creaciones</Link> : <span>Combos</span>}
          <span aria-hidden="true" className={ficha.migaFinal}>/</span>
          <span className={ficha.migaFinal}>{nombreCombo}</span>
        </nav>

        <div className={ficha.cabecera}>
          <span className={ficha.etiqueta}>{miCombo ? 'Mi combo' : 'Combo'} · {piezasCombo.length} prendas</span>
          {miCombo
            ? <NombreEditable designId={miCombo.id} nombre={nombreCombo} como="h1" className={ficha.titulo} />
            : <h1 className={ficha.titulo}>{combo.name}</h1>}
          <p className={ficha.base}>{miCombo ? `Hecho sobre ${combo.name}` : combo.description}</p>
          {!combo.publicado && <span className={styles.borrador}>Borrador: solo lo ves tú</span>}
        </div>

        <div className={ficha.filaPrecio}>
          <span className={ficha.precio}>{soles(precio)}</span>
          {ahorro > 0 && <span className={ficha.precioAntes}>{soles(sueltas)}</span>}
          {descuento > 0 && <span className={ficha.descuento}>-{descuento}%</span>}
        </div>
        <p className={ficha.incluye}>
          {ahorro > 0 ? `Ahorras ${soles(ahorro)} frente a comprarlas por separado. ` : ''}
          Incluye la impresión de todos tus diseños.
        </p>

        {pendientePlantilla && (
          <div className={styles.plantillaAviso}>
            <Sparkles size={16} aria-hidden="true" />
            <span>Partes de <strong>{plantillaCombo.nombre}</strong>. Elige la talla y agrégalo al carrito tal cual, o personaliza cada prenda.</span>
            <Link to={urlPlantilla(pendientePlantilla.i)} state={estadoEstudio} className={styles.principal}>
              <Paintbrush size={15} aria-hidden="true" /> Personalizar
            </Link>
          </div>
        )}
        {miCombo && (
          <div className={styles.miCombo}>
            <span>
              <CheckCircle2 size={15} aria-hidden="true" />
              {miCombo.estado === 'borrador'
                ? 'Borrador guardado: lo encuentras en Crear para continuarlo.'
                : 'Guardado en Mis creaciones.'}
            </span>
            <AccionesComunidad
              design={miCombo}
              onCambio={() => queryClient.invalidateQueries({ queryKey: ['creacion', meta.miComboId] })}
            />
          </div>
        )}

        <hr className={ficha.divisor} />

        <div className={ficha.grupo}>
          <span className={ficha.rotulo}>
            Este combo incluye ({piezas.length}) <em>· {listas} de {piezas.length} listas</em>
          </span>
          <ol className={styles.filas}>
            {piezas.map((p, k) => {
              const otraConDiseno = piezas.find((o) => o.i !== p.i && o.creacion && creacionLista(o.creacion));
              const vaciasIguales = piezas.filter((o) => o.i !== p.i && !o.designId
                && piezasCombo[o.i].prendaId === piezasCombo[p.i].prendaId).length;
              const fotoFila = fotosPiezas[k]?.lados[0];
              const conDiseno = fotosPiezas[k]?.conDiseno || [];
              const color = p.creacion?.color || p.plantilla?.color || null;
              return (
                <li key={p.i} className={`${styles.fila} ${p.lista ? styles.filaLista : ''}`}>
                  <button type="button" className={styles.filaFoto} onClick={() => verPieza(k)} aria-label={`Ver la prenda ${p.i + 1}`}>
                    {fotoFila && (
                      <img
                        src={fotoFila.url}
                        alt=""
                        loading="lazy"
                        className={`${fotosPiezas[k].origen === 'prenda' ? styles.conMargen : ''} ${piezaVacia(p) ? styles.atenuada : ''}`}
                      />
                    )}
                    <span className={styles.filaNumero}>{p.i + 1}</span>
                    {p.lista && <CheckCircle2 className={styles.filaCheck} size={18} aria-label="Lista" />}
                  </button>
                  <div className={styles.filaInfo}>
                    <span className={styles.piezaPrenda}>Prenda {p.i + 1} · {p.prenda?.name}</span>
                    {p.cargando ? (
                      p.respaldo?.nombre
                        ? <strong className={styles.piezaNombre}>{p.respaldo.nombre}</strong>
                        : <p className={styles.ayuda}>Cargando el diseño…</p>
                    ) : p.creacion ? (
                      <>
                        <NombreEditable designId={p.creacion.id} nombre={p.creacion.name || 'Mi creación'} como="strong" className={styles.piezaNombre} />
                        {(color?.nombre || conDiseno.length > 0) && (
                          <span className={styles.filaDatos}>
                            {color?.nombre && <><PuntosColor colores={[color]} /> {color.nombre}</>}
                            {color?.nombre && conDiseno.length > 0 && <span aria-hidden="true">·</span>}
                            {conDiseno.length > 0 && conDiseno.join(' + ')}
                          </span>
                        )}
                        {!p.lista && (
                          <p className={styles.aviso}>
                            {p.creacion.estado === 'borrador'
                              ? 'Sin terminar: continúa y guárdala para tenerla lista.'
                              : 'Ábrelo y guárdalo otra vez para prepararlo para imprimir.'}
                          </p>
                        )}
                        {!unaTalla && p.tallas.length > 0 && (
                          <div className={`${ficha.tallas} ${styles.tallasFila}`} role="radiogroup" aria-label={`Talla de la prenda ${p.i + 1}`}>
                            {p.tallas.map((t) => (
                              <button
                                key={t}
                                type="button"
                                role="radio"
                                aria-checked={t === p.talla}
                                className={`${ficha.talla} ${t === p.talla ? ficha.tallaActiva : ''}`}
                                onClick={() => ponerEn(p.i, { talla: t })}
                              >
                                {t}
                              </button>
                            ))}
                          </div>
                        )}
                        <div className={styles.acciones}>
                          {/* Si otra pieza lleva este mismo diseño, se edita una copia:
                              cambiarlo aquí no debe cambiar la otra prenda. */}
                          <Link
                            to={urlEstudio(p.i, piezas.some((o) => o.i !== p.i && o.designId === p.designId)
                              ? `&copiar=${p.designId}` : `&designId=${p.designId}`)}
                            state={estadoEstudio}
                            className={styles.secundario}
                          >
                            <Pencil size={15} aria-hidden="true" /> {p.creacion.estado === 'borrador' ? 'Continuar' : 'Editar'}
                          </Link>
                          {vaciasIguales > 0 && p.lista && (
                            <button type="button" className={styles.secundario} onClick={() => usarEnLasDemas(p.i)}>
                              <Copy size={15} aria-hidden="true" /> Usar en {vaciasIguales === 1 ? 'la otra' : 'las demás'}
                            </button>
                          )}
                          <button type="button" className={styles.texto} onClick={() => quitar(p.i)}>
                            <X size={15} aria-hidden="true" /> Quitar
                          </button>
                        </div>
                      </>
                    ) : p.plantilla ? (
                      <>
                        <strong className={styles.piezaNombre}>{p.plantilla.nombre || 'Diseño de la comunidad'}</strong>
                        {color?.nombre && <span className={styles.filaDatos}><PuntosColor colores={[color]} /> {color.nombre}</span>}
                        <p className={styles.ayuda}>Llévala tal cual o cámbiale el nombre, la foto o lo que quieras.</p>
                        <div className={styles.acciones}>
                          <Link to={urlPlantilla(p.i)} state={estadoEstudio} className={styles.principal}>
                            <Paintbrush size={15} aria-hidden="true" /> Personalizar
                          </Link>
                        </div>
                      </>
                    ) : p.esperando ? (
                      <p className={styles.ayuda}>Cargando el diseño…</p>
                    ) : (
                      <>
                        <p className={styles.ayuda}>Ponle tu imagen o tu frase.</p>
                        <div className={styles.acciones}>
                          <Link to={urlEstudio(p.i)} state={estadoEstudio} className={styles.principal}>
                            <Paintbrush size={15} aria-hidden="true" /> Diseñar
                          </Link>
                          {otraConDiseno && (
                            <Link to={urlEstudio(p.i, `&copiar=${otraConDiseno.designId}`)} state={estadoEstudio} className={styles.secundario}>
                              <Copy size={15} aria-hidden="true" /> Copiar de la prenda {otraConDiseno.i + 1}
                            </Link>
                          )}
                          {user && (
                            <button type="button" className={styles.secundario} onClick={() => setEligiendo(p.i)}>
                              <Images size={15} aria-hidden="true" /> Mis creaciones
                            </button>
                          )}
                        </div>
                      </>
                    )}
                    {agotada(p.prenda) && <p className={styles.aviso}>Agotada por ahora.</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        {unaTalla && tallasConjunto.length > 0 && !pendientePlantilla && (
          <div className={ficha.grupo}>
            <span className={styles.tallaConjuntoFila}>
              <span className={ficha.rotulo}>Talla{tallaConjunto && <>: <em>{tallaConjunto}</em></>}</span>
              <span className={styles.tallaConjuntoPista}>Se aplica a las {piezas.length} prendas</span>
            </span>
            <div className={ficha.tallas} role="radiogroup" aria-label="Talla del conjunto">
              {tallasConjunto.map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={t === tallaConjunto}
                  className={`${ficha.talla} ${t === tallaConjunto ? ficha.tallaActiva : ''}`}
                  onClick={() => elegirTallaConjunto(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className={ficha.botones}>
          <button type="button" className={ficha.principal} onClick={agregar} disabled={!completo || Boolean(preparando)}>
            {preparando
              ? <><Loader2 size={17} className={styles.girando} aria-hidden="true" /> {preparando}</>
              : <><ShoppingBag size={17} aria-hidden="true" /> Agregar al carrito · {soles(precio)}</>}
          </button>
        </div>
        <p className={`${ficha.ayuda} ${styles.estadoCompra}`}>
          <strong>{listas} de {piezas.length} listas.</strong> {faltaTexto}
        </p>

        <div className={ficha.confianza}>
          <span><Truck size={14} aria-hidden="true" /> Envío a todo el país</span>
          <span><RefreshCw size={14} aria-hidden="true" /> Cambios y devoluciones</span>
          <span><ShieldCheck size={14} aria-hidden="true" /> Pago seguro</span>
        </div>

        <details className={ficha.desplegable} open>
          <summary>Detalles del combo</summary>
          <dl className={ficha.detalles}>
            {piezas.map((p) => {
              const color = p.creacion?.color?.nombre || p.plantilla?.color?.nombre || '';
              return (
                <React.Fragment key={p.i}>
                  <dt>Prenda {p.i + 1}</dt>
                  <dd>{[p.prenda?.name, color, p.talla && `Talla ${p.talla}`].filter(Boolean).join(' · ') || '—'}</dd>
                </React.Fragment>
              );
            })}
            {ahorro > 0 && (
              <>
                <dt>Por separado</dt>
                <dd>{soles(sueltas)}</dd>
              </>
            )}
          </dl>
          <p className={ficha.nota}>Cada prenda se imprime con su propio diseño, color y talla.</p>
        </details>

        {miCombo && combo.description && (
          <details className={ficha.desplegable}>
            <summary>Sobre el combo</summary>
            <p className={ficha.textoRico}>{combo.description}</p>
          </details>
        )}
      </section>

      {eligiendo !== null && (
        <CapaModal className={styles.capa} role="dialog" aria-modal="true" aria-labelledby="combo-elegir-titulo" onClick={() => setEligiendo(null)}>
          <div className={styles.caja} onClick={(e) => e.stopPropagation()}>
            <h2 id="combo-elegir-titulo" className={styles.estadoTitulo}>Tus creaciones de {piezasCombo[eligiendo] && prendas[eligiendo]?.name}</h2>
            {opcionesMias.length ? (
              <div className={styles.opciones}>
                {opcionesMias.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={styles.opcion}
                    onClick={() => { ponerEn(eligiendo, { designId: c.id, talla: '' }); setEligiendo(null); }}
                  >
                    <img src={c.vistasPrevias?.[0]?.url || c.imagenConjunta || c.previewUrl} alt="" loading="lazy" />
                    <span>{c.name || 'Mi creación'}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p>Aún no tienes creaciones de esta prenda. Diséñala desde cero.</p>
            )}
            <button type="button" className={styles.texto} onClick={() => setEligiendo(null)}>Cerrar</button>
          </div>
        </CapaModal>
      )}

      {pidiendoTallas && (() => {
        // Conjunto: una talla para todas. Pareja/trío: una por prenda.
        const filas = unaTalla
          ? [{ clave: 'todas', titulo: `Para las ${piezas.length} prendas`, tallas: tallasConjunto }]
          : piezas.filter((p) => p.tallas.length).map((p) => ({
            clave: p.i,
            titulo: [`Prenda ${p.i + 1}`, p.creacion?.name || p.plantilla?.nombre, (p.creacion?.color || p.plantilla?.color)?.nombre].filter(Boolean).join(' · '),
            tallas: p.tallas,
          }));
        const tallaDe = (clave) => (clave === 'todas' ? tallasElegidas[0] : tallasElegidas[clave]) || '';
        const elegir = (clave, t) => setTallasElegidas((prev) => (clave === 'todas'
          ? Object.fromEntries(piezas.map((p) => [p.i, t]))
          : { ...prev, [clave]: t }));
        const completas = filas.every((f) => tallaDe(f.clave));
        const cerrar = () => setPidiendoTallas(false);
        return (
          <CapaModal className={estudio.capaBloqueo} role="dialog" aria-modal="true" aria-labelledby="combo-talla-titulo" onClick={cerrar}>
            <form
              className={estudio.cajaBloqueo}
              onClick={(e) => e.stopPropagation()}
              onSubmit={(e) => {
                e.preventDefault();
                if (!completas) return;
                cerrar();
                // Quedan en el armado: si antes hay que iniciar sesión, al volver siguen elegidas.
                cambiarArmado(armado.map((a, i) => ({ ...a, talla: tallasElegidas[i] || a.talla })));
                comprar(piezas.map((p) => ({ ...p, talla: tallasElegidas[p.i] || p.talla })));
              }}
            >
              <h2 id="combo-talla-titulo" className={estudio.estadoTitulo}>¿Qué talla quieres?</h2>
              <p>{nombreCombo}</p>
              {filas.map((f) => (
                <div key={f.clave} className={styles.tallaVentana}>
                  {filas.length > 1 || unaTalla ? <span className={styles.tallaVentanaTitulo}>{f.titulo}</span> : null}
                  <div className={`${estudio.tallas} ${estudio.tallasDialogo}`} role="radiogroup" aria-label={`Talla · ${f.titulo}`}>
                    {f.tallas.map((t) => (
                      <button
                        key={t}
                        type="button"
                        role="radio"
                        aria-checked={t === tallaDe(f.clave)}
                        className={`${estudio.talla} ${t === tallaDe(f.clave) ? estudio.tallaActiva : ''}`}
                        onClick={() => elegir(f.clave, t)}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <p className={estudio.incluye}>Incluye la impresión de todos los diseños de tu combo.</p>
              <button type="submit" className={estudio.botonPrincipal} disabled={!completas}>
                <ShoppingBag size={18} aria-hidden="true" />
                Agregar al carrito · {soles(precio)}
              </button>
              <button type="button" className={estudio.botonTexto} onClick={cerrar}>Cancelar</button>
            </form>
          </CapaModal>
        );
      })()}
    </div>
  );
};

export default ComboCrearPage;
