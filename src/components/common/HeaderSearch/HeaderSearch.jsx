import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
// eslint-disable-next-line no-unused-vars
import { AnimatePresence, motion } from 'framer-motion';
import { Search, X, Clock, ArrowRight } from 'lucide-react';
import {
  fadeIn,
  scaleIn,
  fadeUpCustom,
  staggerContainer,
  neutralVariants,
  useReducedMotionSafe,
} from '../../../theme/motion';
import { getSearchSuggestions } from '../../../services/search';
import { getCategories } from '../../../services/products';
import { getBrands } from '../../../services/brands';
import { trackSearchQuery } from '../../../services/analytics/tracker';
import { useAuth } from '../../../contexts/AuthContext';
import { T } from '../../../i18n/useTranslatedText';
import styles from './HeaderSearch.module.css';

/**
 * Buscador de la cabecera.
 *
 * Antes la lupa era un enlace pelado a /buscar: llegabas a una página con el
 * campo vacío y tenías que volver a empezar allí. Ahora se escribe donde se
 * pulsa, y mientras escribes se ve qué hay.
 *
 * Qué enseña:
 *   · Con el campo vacío -> lo que buscaste antes (guardado en ESTE navegador).
 *   · Escribiendo        -> productos que casan, y las marcas y categorías que
 *                           aparecen EN ESOS resultados, como atajos para acotar.
 *
 * Todo sale del catálogo que ya está en memoria: no se pide nada a la red por
 * cada tecla. Y si algo falla, Enter sigue llevando a /buscar de siempre.
 */

const CLAVE_RECIENTES = 'wala_busquedas_recientes';
const MAX_RECIENTES = 6;
const MS_ESPERA = 180; // margen para no recalcular en cada tecla

const leerRecientes = () => {
  try {
    const bruto = localStorage.getItem(CLAVE_RECIENTES);
    const lista = bruto ? JSON.parse(bruto) : [];
    return Array.isArray(lista) ? lista.filter((t) => typeof t === 'string') : [];
  } catch {
    return []; // modo privado o dato corrupto: sin recientes, sin drama
  }
};

const guardarReciente = (termino) => {
  const limpio = String(termino || '').trim();
  if (!limpio) return;
  try {
    const previas = leerRecientes().filter((t) => t.toLowerCase() !== limpio.toLowerCase());
    localStorage.setItem(CLAVE_RECIENTES, JSON.stringify([limpio, ...previas].slice(0, MAX_RECIENTES)));
  } catch { /* modo privado */ }
};

const ANCHO_MOVIL = 768;

// Movimiento: todo sale del sistema (src/theme/motion), no se redeclaran curvas
// ni duraciones aquí. El panel es un popover, así que usa `scaleIn` —el preset
// que el propio sistema reserva para tarjetas y popovers— y crece desde la
// esquina de la lupa (transform-origin en el CSS).
//
// Las filas entran en cascada con un desplazamiento CORTO (8px): las listas de
// un desplegable están a centímetros del ojo y los 24px del preset estándar,
// pensados para secciones de página, aquí se ven como un salto.
const filaVariants = fadeUpCustom({ y: 8, duration: 0.22 });
const listaVariants = staggerContainer({ stagger: 0.035, delayChildren: 0.02 });

const HeaderSearch = ({ brandId = null, botonClassName = '' }) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Quien pide menos movimiento en su sistema recibe solo fundidos: sin
  // desplazamientos ni escalados.
  const sinMovimiento = useReducedMotionSafe();
  const vPanel = sinMovimiento ? neutralVariants : scaleIn;
  const vFila = sinMovimiento ? neutralVariants : filaVariants;
  const vLista = sinMovimiento ? neutralVariants : listaVariants;

  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState('');
  const [recientes, setRecientes] = useState([]);
  const [sugerencias, setSugerencias] = useState({ productos: [], marcas: [], categorias: [], total: 0 });

  const lupaRef = useRef(null);
  const panelRef = useRef(null);
  const campoRef = useRef(null);

  // Dónde cae el panel. Se MIDE, no se calcula con números escritos a mano: la
  // cabecera cambia de alto con la barra de administrador y entre móvil y
  // escritorio, y cualquier constante se quedaría desfasada.
  const [pos, setPos] = useState({ top: 0, right: 0 });

  // Nombres de marcas y categorías: mismas claves de caché que usan la tarjeta
  // de producto y el catálogo, así que normalmente ya están traídas.
  const { data: marcasData } = useQuery({
    queryKey: ['brands'],
    queryFn: async () => (await getBrands()).data,
    staleTime: 5 * 60 * 1000,
  });
  const { data: categoriasData } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => (await getCategories()).data,
    staleTime: 5 * 60 * 1000,
  });

  const nombreMarca = useCallback(
    (id) => (marcasData || []).find((m) => m.id === id)?.name || id,
    [marcasData]
  );
  const nombreCategoria = useCallback(
    (id) => (categoriasData || []).find((c) => c.id === id)?.name || id,
    [categoriasData]
  );

  const abrir = () => {
    setRecientes(leerRecientes());
    setAbierto(true);
  };

  const cerrar = useCallback(() => {
    setAbierto(false);
  }, []);

  // Sugerencias con un pequeño respiro entre teclas.
  useEffect(() => {
    if (!abierto) return;
    const t = setTimeout(() => {
      getSearchSuggestions(texto).then(setSugerencias);
    }, MS_ESPERA);
    return () => clearTimeout(t);
  }, [texto, abierto]);

  // Cerrar al pulsar fuera o con Escape.
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e) => {
      const enPanel = panelRef.current?.contains(e.target);
      const enLupa = lupaRef.current?.contains(e.target);
      if (!enPanel && !enLupa) cerrar();
    };
    const tecla = (e) => { if (e.key === 'Escape') cerrar(); };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [abierto, cerrar]);

  useEffect(() => {
    if (abierto) campoRef.current?.focus();
  }, [abierto]);

  const medir = useCallback(() => {
    const r = lupaRef.current?.getBoundingClientRect();
    if (!r) return;
    // Debajo de la lupa, pero alineado al borde de la CABECERA, no al del
    // botón: colgándolo de la lupa quedaba un hueco muerto de 200px bajo los
    // iconos de cuenta, favoritos y carrito, y parecía descolocado.
    const cabecera = lupaRef.current.closest('header')?.getBoundingClientRect();
    const borde = cabecera ? cabecera.right : r.right;
    setPos({ top: r.bottom + 12, right: Math.max(8, window.innerWidth - borde + 16) });
  }, []);

  useEffect(() => {
    if (!abierto) return;
    medir();
    window.addEventListener('resize', medir);
    // `true` = fase de captura: así también se entera del scroll de contenedores
    // internos, no solo del de la página.
    window.addEventListener('scroll', medir, true);
    return () => {
      window.removeEventListener('resize', medir);
      window.removeEventListener('scroll', medir, true);
    };
  }, [abierto, medir]);

  // Ir a la página de resultados. Conserva la marca si la búsqueda sale de una
  // página de marca, para no expulsar al usuario de su tienda.
  const irABuscar = useCallback((termino) => {
    const limpio = String(termino || '').trim();
    const params = new URLSearchParams();
    if (limpio) params.set('q', limpio);
    if (brandId) params.set('brand', brandId);
    if (limpio) {
      guardarReciente(limpio);
      // Analítica, fuego y olvido: nunca debe romper una búsqueda.
      try { trackSearchQuery(limpio, user).catch(() => {}); } catch { /* nada */ }
    }
    cerrar();
    setTexto('');
    navigate(`/buscar${params.toString() ? `?${params}` : ''}`);
  }, [brandId, cerrar, navigate, user]);

  const enviar = (e) => {
    e.preventDefault();
    irABuscar(texto);
  };

  const limpiarRecientes = () => {
    try { localStorage.removeItem(CLAVE_RECIENTES); } catch { /* modo privado */ }
    setRecientes([]);
  };

  const escribiendo = texto.trim().length >= 2;
  const hayAlgoQueEnsenar = useMemo(() => (
    escribiendo
      ? sugerencias.productos.length > 0
      : recientes.length > 0
  ), [escribiendo, sugerencias.productos.length, recientes.length]);

  const esMovil = typeof window !== 'undefined' && window.innerWidth <= ANCHO_MOVIL;

  return (
    <>
      <button
        type="button"
        ref={lupaRef}
        className={`${styles.lupaBtn} ${botonClassName}`}
        onClick={() => (abierto ? cerrar() : abrir())}
        aria-expanded={abierto}
        aria-label="Buscar"
      >
        <Search strokeWidth={1.5} className={styles.lupaIcono} />
      </button>

      {/* En un PORTAL a <body>, y no dentro de la cabecera, por una razón muy
          concreta: la cabecera lleva backdrop-filter, y un elemento con
          backdrop-filter se convierte en el marco de referencia de todo lo que
          tenga position:fixed dentro. El velo, que debía cubrir la pantalla,
          medía 44x44 — exactamente el botón de la lupa. */}
      {createPortal(
        // AnimatePresence para que también se vaya con gracia: sin esto, al
        // cerrar el panel desaparecía de golpe mientras el velo se quedaba un
        // instante, y el corte se notaba más que la entrada.
        // Los dos cuelgan de AnimatePresence como hijos DIRECTOS y con clave.
        // Envueltos en un fragmento, AnimatePresence ve un solo hijo que no sabe
        // animar y la salida no llega a ocurrir.
        <AnimatePresence>
          {abierto && (
          /* Velo: esto es un desplegable, no una ventana modal, así que
             oscurece poco — lo justo para que la página deje de competir. */
          <motion.div
            key="velo"
            className={styles.velo}
            onClick={cerrar}
            role="presentation"
            variants={fadeIn}
            initial="hidden"
            animate="show"
            exit="hidden"
          />
          )}

          {abierto && (
          <motion.div
            key="panel"
            ref={panelRef}
            className={styles.panel}
            role="dialog"
            aria-label="Buscar productos"
            style={{ top: pos.top, ...(esMovil ? {} : { right: pos.right }) }}
            variants={vPanel}
            initial="hidden"
            animate="show"
            exit="hidden"
          >
            <form onSubmit={enviar} className={styles.formulario} role="search">
              <Search size={18} className={styles.lupaCampo} aria-hidden="true" />
              <input
                ref={campoRef}
                className={styles.campo}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="¿Qué buscas? (polo, taza, gorro...)"
                aria-label="Qué buscas"
              />
              {texto && (
                <button
                  type="button"
                  className={styles.limpiarCampo}
                  onClick={() => { setTexto(''); campoRef.current?.focus(); }}
                  aria-label="Limpiar"
                >
                  <X size={18} />
                </button>
              )}
              <button type="submit" className={styles.botonIr}><T>Buscar</T></button>
            </form>

            {/* ── Sin escribir: lo que buscaste antes ───────────────────── */}
            {!escribiendo && recientes.length > 0 && (
              <div className={styles.bloque}>
                <div className={styles.bloqueCabecera}>
                  <h3 className={styles.bloqueTitulo}><T>Buscaste recientemente</T></h3>
                  <button type="button" className={styles.limpiarEnlace} onClick={limpiarRecientes}>
                    <T>Limpiar</T>
                  </button>
                </div>
                <motion.ul className={styles.lista} variants={vLista} initial="hidden" animate="show">
                  {recientes.map((r) => (
                    <motion.li key={r} variants={vFila}>
                      <button type="button" className={styles.fila} onClick={() => irABuscar(r)}>
                        <Clock size={15} aria-hidden="true" className={styles.filaIcono} />
                        {r}
                      </button>
                    </motion.li>
                  ))}
                </motion.ul>
              </div>
            )}

            {/* ── Escribiendo: productos, marcas y categorías ───────────── */}
            {escribiendo && (
              <div className={styles.columnas}>
                <div className={styles.columna}>
                  <h3 className={styles.bloqueTitulo}><T>Productos</T></h3>
                  {sugerencias.productos.length === 0 ? (
                    <p className={styles.nada}><T>Nada con ese nombre.</T></p>
                  ) : (
                    <motion.ul
                      className={styles.lista}
                      variants={vLista}
                      initial="hidden"
                      animate="show"
                      /* La clave cambia con el término: así la cascada se repite
                         al escribir y se ve que la lista es NUEVA, en vez de que
                         las líneas se sustituyan en silencio. */
                      key={texto.trim().toLowerCase()}
                    >
                      {sugerencias.productos.map((p) => (
                        <motion.li key={p.id} variants={vFila}>
                          <button
                            type="button"
                            className={styles.fila}
                            onClick={() => { cerrar(); setTexto(''); navigate(`/producto/${p.id}`); }}
                          >
                            {p.name}
                          </button>
                        </motion.li>
                      ))}
                    </motion.ul>
                  )}
                </div>

                {sugerencias.marcas.length > 0 && (
                  <div className={styles.columna}>
                    <h3 className={styles.bloqueTitulo}><T>Marcas relacionadas</T></h3>
                    <motion.ul className={styles.lista} variants={vLista} initial="hidden" animate="show">
                      {sugerencias.marcas.map((m) => (
                        <motion.li key={m.id} variants={vFila}>
                          <button
                            type="button"
                            className={styles.fila}
                            onClick={() => {
                              const params = new URLSearchParams({ q: texto.trim(), brand: m.id });
                              guardarReciente(texto);
                              cerrar();
                              setTexto('');
                              navigate(`/buscar?${params}`);
                            }}
                          >
                            {/* Sin <T>: el nombre de una marca es nombre propio. */}
                            {nombreMarca(m.id)}
                            <span className={styles.cuenta}>{m.total}</span>
                          </button>
                        </motion.li>
                      ))}
                    </motion.ul>
                  </div>
                )}

                {sugerencias.categorias.length > 0 && (
                  <div className={styles.columna}>
                    <h3 className={styles.bloqueTitulo}><T>Categorías relacionadas</T></h3>
                    <motion.ul className={styles.lista} variants={vLista} initial="hidden" animate="show">
                      {sugerencias.categorias.map((c) => (
                        <motion.li key={c.id} variants={vFila}>
                          <button
                            type="button"
                            className={styles.fila}
                            onClick={() => {
                              cerrar();
                              setTexto('');
                              navigate(`/tienda?categoria=${encodeURIComponent(c.id)}`);
                            }}
                          >
                            <T>{nombreCategoria(c.id)}</T>
                            <span className={styles.cuenta}>{c.total}</span>
                          </button>
                        </motion.li>
                      ))}
                    </motion.ul>
                  </div>
                )}
              </div>
            )}

            {/* Salida siempre disponible a la página de resultados. */}
            {escribiendo && (
              <button type="button" className={styles.verTodo} onClick={() => irABuscar(texto)}>
                <T>Ver todos los resultados de</T> «{texto.trim()}»
                {sugerencias.total > 0 && <span className={styles.cuenta}>{sugerencias.total}</span>}
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            )}

            {!escribiendo && !hayAlgoQueEnsenar && (
              <p className={styles.nada}><T>Escribe para ver productos, marcas y categorías.</T></p>
            )}
          </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
};

export default HeaderSearch;
