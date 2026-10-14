import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Paintbrush, Images, Copy, Pencil, X, ShoppingBag, Loader2, CheckCircle2, Users, Sparkles } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { useGlobalToast } from '../../contexts/ToastContext';
import { getComboCrear } from '../../services/combosCrear';
import { getPrendaBase } from '../../services/prendasBase';
import { getDesignById, getDesignsByUser } from '../../services/designs';
import { leerPrendaBase, tallasDeColor } from '../../utils/prendaBase';
import { useAlternarFotos } from '../../hooks/useAlternarFotos';
import { creacionLista } from './creacionCarrito';
import { leerArmado, guardarArmado, olvidarArmado, preciosDeCombo, itemDeCombo, leerMetaArmado, guardarMetaArmado } from './comboCrear';
import { guardarMiCombo } from '../../services/misCombos';
import { obtenerDisenoComunidad } from '../../services/comunidad';
import AccionesComunidad from '../Comunidad/AccionesComunidad';
import CapaModal from './CapaModal';
import { EtiquetaColgante } from '../../componentes/kit/Marca';
import styles from './ComboCrearPage.module.css';

const soles = (n) => `S/ ${Number(n || 0).toFixed(2)}`;

/** Tallas de la prenda en el color de la creación. */
const tallasPara = (prenda, creacion) => {
  if (!prenda) return [];
  const cfg = leerPrendaBase(prenda);
  const color = cfg.colores.find((c) => c.id === creacion?.color?.id || c.nombre === creacion?.color?.nombre);
  return color ? tallasDeColor(color, cfg) : cfg.tallas;
};

/** Frente y espalda de una pieza: su diseño, el de la comunidad o la prenda en blanco. */
const ladosDePieza = (p) => {
  const previas = (p.creacion?.vistasPrevias || p.plantilla?.vistasPrevias || []).filter((v) => v?.url);
  if (previas.length) return previas.map((v) => ({ url: v.url, nombre: v.nombre }));
  const conjunta = p.creacion?.imagenConjunta || p.plantilla?.imagenConjunta;
  if (conjunta) return [{ url: conjunta, nombre: '' }];
  return leerPrendaBase(p.prenda).vistas.filter((v) => v.imagen).map((v) => ({ url: v.imagen, nombre: v.nombre }));
};

/**
 * Foto de una pieza, como las tarjetas de Mis creaciones: al pasar el mouse
 * se ve la espalda y en el celular alternan solas (con dos puntos de qué
 * lado se ve). Lleva el número de la pieza y el check cuando está lista.
 */
const FotoPieza = ({ lados, alt, vacia, children }) => {
  const ref = useRef(null);
  const frente = lados[0]?.url;
  const espalda = lados[1]?.url;
  const verEspalda = useAlternarFotos(ref, Boolean(frente && espalda));
  const nombres = lados.map((l) => l.nombre).filter(Boolean);
  return (
    <div ref={ref} className={`${styles.piezaFoto} ${verEspalda ? styles.conEspalda : ''} ${vacia ? styles.fotoVacia : ''}`}>
      {frente && <img src={frente} alt={alt} className={styles.fotoFrente} loading="lazy" />}
      {espalda && <img src={espalda} alt="" aria-hidden="true" className={styles.fotoEspalda} loading="lazy" />}
      {frente && espalda && (
        <span className={styles.puntosFoto} aria-hidden="true">
          <span className={`${styles.puntoFoto} ${!verEspalda ? styles.puntoFotoActivo : ''}`} />
          <span className={`${styles.puntoFoto} ${verEspalda ? styles.puntoFotoActivo : ''}`} />
        </span>
      )}
      {nombres.length > 1 && <span className={styles.lados}>{nombres.join(' + ')}</span>}
      {children}
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
  useEffect(() => {
    if (!mioParam || !user || !piezasCombo.length) return;
    // Lo puso esta misma página al crear el combo: ya está al día.
    if (mioParam === mioPropioRef.current) return;
    let cancelado = false;
    (async () => {
      const { data } = await getDesignById(mioParam);
      if (cancelado) return;
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
    return () => { cancelado = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mioParam, user?.uid, id, piezasCombo.length]);

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
  const { data: plantillaCombo } = useQuery({
    queryKey: ['comunidad-diseno', meta.plantilla],
    enabled: Boolean(meta.plantilla),
    queryFn: async () => {
      const d = await obtenerDisenoComunidad(meta.plantilla);
      return d && d.tipo === 'combo' && d.comboId === id ? d : null;
    },
  });

  const creacionesQ = useQueries({
    queries: armado.map((a) => ({
      queryKey: ['creacion', a.designId, user?.uid],
      enabled: Boolean(user && a.designId),
      queryFn: async () => {
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

  const piezas = armado.map((a, i) => {
    const creacion = creaciones[i];
    // Diseño de la comunidad para esta pieza (si todavía no tiene uno propio).
    const dePlantilla = plantillaCombo?.piezas?.[i];
    const plantilla = !a.designId && dePlantilla?.productId === piezasCombo[i]?.prendaId ? dePlantilla : null;
    const tallas = tallasPara(prendas[i], creacion);
    const talla = tallas.includes(a.talla) ? a.talla
      : tallas.includes(creacion?.variant?.size) ? creacion.variant.size : '';
    const cargando = Boolean(a.designId && creacionesQ[i]?.isLoading);
    return { ...a, i, prenda: prendas[i], creacion, plantilla, tallas, talla, cargando, lista: Boolean(creacion && creacionLista(creacion)) };
  });
  const urlPlantilla = (i) => urlEstudio(i, `&plantilla=${meta.plantilla}&plantillaPieza=${i}`);
  const pendientePlantilla = piezas.find((p) => p.plantilla);
  const listas = piezas.filter((p) => p.lista && (!p.tallas.length || p.talla)).length;
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

  const agregar = () => {
    const falta = piezas.find((p) => !p.lista || (p.tallas.length && !p.talla));
    if (falta) {
      toast.info(!falta.creacion ? `Falta el diseño de la prenda ${falta.i + 1}.`
        : !falta.lista ? `Abre y guarda otra vez el diseño de la prenda ${falta.i + 1}.`
          : `Elige la talla de la prenda ${falta.i + 1}.`);
      return;
    }
    if (piezas.some((p) => agotada(p.prenda))) {
      toast.info('Una de las prendas está agotada por ahora.');
      return;
    }
    if (!combo.publicado) {
      toast.info('Este combo está en borrador: publícalo para poder venderlo.');
      return;
    }
    addToCart(...itemDeCombo({
      combo,
      piezas: piezas.map((p) => ({ prenda: p.prenda, creacion: p.creacion, talla: p.talla })),
    }));
    olvidarArmado(id);
    navigate('/carrito');
  };

  const opcionesMias = eligiendo === null ? [] : misCreaciones.filter(
    (c) => c.tipo === 'crear' && c.productId === piezasCombo[eligiendo]?.prendaId && c.estado !== 'borrador' && creacionLista(c)
  );

  return (
    <div className={styles.container}>
      <Link to="/personalizar" className={styles.volver}>
        <ArrowLeft size={18} aria-hidden="true" /> Volver a Crear
      </Link>

      <header className={styles.cabecera}>
        <div>
          <span className={styles.etiqueta}><Users size={14} aria-hidden="true" /> Combo de {piezasCombo.length} prendas</span>
          <h1 className={styles.titulo}>{combo.name}</h1>
          {combo.description && <p className={styles.descripcion}>{combo.description}</p>}
          {!combo.publicado && <span className={styles.borrador}>Borrador: solo lo ves tú</span>}
          {pendientePlantilla && (
            <div className={styles.plantillaAviso}>
              <Sparkles size={16} aria-hidden="true" />
              <span>Partes de <strong>{plantillaCombo.nombre}</strong>. Personaliza cada prenda (puedes dejarla tal cual) y elige su talla.</span>
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
                  ? 'Borrador guardado: lo encuentras en Crear para continuarlo después.'
                  : 'Guardado en Mis creaciones como un combo.'}
              </span>
              <AccionesComunidad
                design={miCombo}
                onCambio={() => queryClient.invalidateQueries({ queryKey: ['creacion', meta.miComboId] })}
              />
            </div>
          )}
        </div>
        <div className={styles.precioCaja}>
          <span className={styles.precio}>{soles(precio)}</span>
          {ahorro > 0 && (
            <>
              <span className={styles.sueltas}>Por separado <span className={styles.tachado}>{soles(sueltas)}</span></span>
              <EtiquetaColgante tono="magenta" tamano="sm">Ahorras {soles(ahorro)}</EtiquetaColgante>
            </>
          )}
        </div>
      </header>

      <ol className={styles.piezas}>
        {piezas.map((p) => {
          const otraConDiseno = piezas.find((o) => o.i !== p.i && o.creacion && creacionLista(o.creacion));
          const vaciasIguales = piezas.filter((o) => o.i !== p.i && !o.designId
            && piezasCombo[o.i].prendaId === piezasCombo[p.i].prendaId).length;
          return (
            <li key={p.i} className={`${styles.pieza} ${p.lista ? styles.piezaLista : ''}`}>
              <FotoPieza lados={ladosDePieza(p)} alt={p.prenda?.name || ''} vacia={!p.creacion && !p.plantilla}>
                <span className={styles.numero}>{p.i + 1}</span>
                {p.lista && <CheckCircle2 className={styles.check} size={22} aria-label="Lista" />}
              </FotoPieza>
              <div className={styles.piezaInfo}>
                <span className={styles.piezaPrenda}>Prenda {p.i + 1} · {p.prenda?.name}</span>
                {p.cargando ? (
                  <p className={styles.ayuda}>Cargando el diseño…</p>
                ) : p.creacion ? (
                  <>
                    <strong className={styles.piezaNombre}>{p.creacion.name || 'Mi creación'}</strong>
                    {p.creacion.color?.nombre && <span className={styles.ayuda}>{p.creacion.color.nombre}</span>}
                    {!p.lista && (
                      <p className={styles.aviso}>
                        {p.creacion.estado === 'borrador'
                          ? 'Sin terminar: continúa y guárdala para tenerla lista.'
                          : 'Ábrelo y guárdalo otra vez para prepararlo para imprimir.'}
                      </p>
                    )}
                    {p.tallas.length > 0 && (
                      <div className={styles.tallas} role="radiogroup" aria-label={`Talla de la prenda ${p.i + 1}`}>
                        {p.tallas.map((t) => (
                          <button
                            key={t}
                            type="button"
                            role="radio"
                            aria-checked={t === p.talla}
                            className={`${styles.talla} ${t === p.talla ? styles.tallaActiva : ''}`}
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
                    <p className={styles.ayuda}>Cámbiale el nombre, la foto o lo que quieras.</p>
                    <div className={styles.acciones}>
                      <Link to={urlPlantilla(p.i)} state={estadoEstudio} className={styles.principal}>
                        <Paintbrush size={15} aria-hidden="true" /> Personalizar
                      </Link>
                    </div>
                  </>
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

      <div className={styles.barra}>
        <div className={styles.barraTexto}>
          <strong>{listas} de {piezas.length} listas</strong>
          <span>{completo ? 'Todo listo para agregar.'
            : pendientePlantilla ? 'Personaliza cada prenda y elige su talla.' : 'Diseña cada prenda y elige su talla.'}</span>
        </div>
        <button type="button" className={styles.botonCarrito} onClick={agregar} disabled={!completo}>
          <ShoppingBag size={18} aria-hidden="true" /> Agregar al carrito · {soles(precio)}
        </button>
      </div>

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
    </div>
  );
};

export default ComboCrearPage;
