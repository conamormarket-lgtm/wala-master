import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Paintbrush, Images, Copy, Pencil, X, ShoppingBag, Loader2, CheckCircle2, Users } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { useGlobalToast } from '../../contexts/ToastContext';
import { getComboCrear } from '../../services/combosCrear';
import { getPrendaBase } from '../../services/prendasBase';
import { getDesignById, getDesignsByUser } from '../../services/designs';
import { leerPrendaBase, tallasDeColor } from '../../utils/prendaBase';
import { creacionLista } from './creacionCarrito';
import { leerArmado, guardarArmado, olvidarArmado, preciosDeCombo, itemDeCombo } from './comboCrear';
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
  const [eligiendo, setEligiendo] = useState(null);

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
    })),
  });
  const prendas = prendasQ.map((q) => q.data || null);

  const [armado, setArmado] = useState([]);
  useEffect(() => {
    if (piezasCombo.length) setArmado(leerArmado(id, piezasCombo.length));
  }, [id, piezasCombo.length]);
  const cambiarArmado = (siguiente) => {
    setArmado(siguiente);
    guardarArmado(id, siguiente);
  };

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
      return (data || []).filter((d) => d.tipo === 'crear');
    },
  });

  const { precio, sueltas, ahorro } = combo ? preciosDeCombo(combo, prendas) : { precio: 0, sueltas: 0, ahorro: 0 };

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
  const urlEstudio = (i, extra = '') => `/crear/${piezasCombo[i].prendaId}?combo=${id}&pieza=${i}${extra}`;
  const estadoEstudio = { desde: `/combo/${id}` };

  const piezas = armado.map((a, i) => {
    const creacion = creaciones[i];
    const tallas = tallasPara(prendas[i], creacion);
    const talla = tallas.includes(a.talla) ? a.talla
      : tallas.includes(creacion?.variant?.size) ? creacion.variant.size : '';
    const cargando = Boolean(a.designId && creacionesQ[i]?.isLoading);
    return { ...a, i, prenda: prendas[i], creacion, tallas, talla, cargando, lista: Boolean(creacion && creacionLista(creacion)) };
  });
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
    (c) => c.productId === piezasCombo[eligiendo]?.prendaId && c.estado !== 'borrador' && creacionLista(c)
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
          const foto = p.creacion?.vistasPrevias?.[0]?.url || p.creacion?.imagenConjunta
            || leerPrendaBase(p.prenda).vistas[0]?.imagen || p.prenda?.mainImage;
          const otraConDiseno = piezas.find((o) => o.i !== p.i && o.creacion && creacionLista(o.creacion));
          const vaciasIguales = piezas.filter((o) => o.i !== p.i && !o.designId
            && piezasCombo[o.i].prendaId === piezasCombo[p.i].prendaId).length;
          return (
            <li key={p.i} className={`${styles.pieza} ${p.lista ? styles.piezaLista : ''}`}>
              <div className={styles.piezaFoto}>
                {foto && <img src={foto} alt={p.prenda?.name || ''} className={p.creacion ? '' : styles.fotoVacia} loading="lazy" />}
                <span className={styles.numero}>{p.i + 1}</span>
                {p.lista && <CheckCircle2 className={styles.check} size={22} aria-label="Lista" />}
              </div>
              <div className={styles.piezaInfo}>
                <span className={styles.piezaPrenda}>Prenda {p.i + 1} · {p.prenda?.name}</span>
                {p.cargando ? (
                  <p className={styles.ayuda}>Cargando el diseño…</p>
                ) : p.creacion ? (
                  <>
                    <strong className={styles.piezaNombre}>{p.creacion.name || 'Mi creación'}</strong>
                    {p.creacion.color?.nombre && <span className={styles.ayuda}>{p.creacion.color.nombre}</span>}
                    {!p.lista && <p className={styles.aviso}>Ábrelo y guárdalo otra vez para prepararlo para imprimir.</p>}
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
                        <Pencil size={15} aria-hidden="true" /> Editar
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
          <span>{completo ? 'Todo listo para agregar.' : 'Diseña cada prenda y elige su talla.'}</span>
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
