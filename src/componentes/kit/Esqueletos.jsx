import React from 'react';
import s from './Esqueletos.module.css';

/*
 * Esqueletos: la forma de lo que viene mientras llegan los datos. Se arman
 * en cadena, como el resto del kit:
 *   Hueso (la pieza) → componentes (producto, fila, tarjeta, formulario…)
 *   → EsqueletoSeccion (uno por tipo del builder) → EsqueletoPagina.
 * Todos comparten el mismo brillo (un barrido suave de izquierda a derecha,
 * en violeta muy claro; con poco movimiento, quieto). Las piezas sueltas van
 * aria-hidden; EsqueletoSeccion y EsqueletoPagina avisan "Cargando".
 */

const cx = (...c) => c.filter(Boolean).join(' ');
const repetir = (n, f) => Array.from({ length: n }, (_, k) => f(k));

/**
 * Un hueso: el bloque que brilla.
 *  - forma: 'linea' (texto) | 'bloque' (foto, banner) | 'circulo' | 'pildora' (botón, chip)
 *  - ancho, alto: número (px) o texto CSS · proporcion: '1 / 1', '16 / 9'…
 *  - claro: sobre otro hueso (texto dentro de un banner)
 */
export function Hueso({ forma = 'linea', ancho, alto, proporcion, claro = false, className, style }) {
  return (
    <span
      className={cx(s.hueso, s[forma], claro && s.claro, className)}
      style={{ width: ancho, height: alto, aspectRatio: proporcion, ...style }}
      aria-hidden="true"
    />
  );
}

/** Líneas de texto; la última más corta. */
export function EsqueletoTexto({ lineas = 3, alto = 11, ultima = '60%' }) {
  return (
    <span className={s.texto} aria-hidden="true">
      {repetir(lineas, (k) => <Hueso key={k} alto={alto} ancho={k === lineas - 1 && lineas > 1 ? ultima : '100%'} />)}
    </span>
  );
}

/** Título y su línea de ayuda (el título con la altura de la letra de marca). */
export function EsqueletoCabeza({ centrado = false, subtitulo = true }) {
  return (
    <span className={cx(s.cabeza, centrado && s.centrado)} aria-hidden="true">
      <Hueso alto={24} ancho="min(46%, 300px)" />
      {subtitulo && <Hueso alto={11} ancho="min(70%, 420px)" />}
    </span>
  );
}

/** La silueta de TarjetaProducto: foto 4:5, marca, nombre en dos líneas, precio. */
export function EsqueletoProducto() {
  return (
    <span className={s.producto} aria-hidden="true">
      <Hueso forma="bloque" proporcion="4 / 5" className={s.productoFoto} />
      <span className={s.productoCuerpo}>
        <Hueso alto={9} ancho="38%" />
        <Hueso alto={13} ancho="92%" />
        <Hueso alto={13} ancho="64%" />
        <span className={s.productoPie}>
          <Hueso alto={18} ancho="40%" />
          <Hueso forma="circulo" ancho={34} alto={34} />
        </span>
      </span>
    </span>
  );
}

/** Una fila de lista: foto o avatar, dos líneas y algo a la derecha (pedido, cupón, persona). */
export function EsqueletoFila({ foto = 'bloque', derecha = true }) {
  return (
    <span className={s.fila} aria-hidden="true">
      <Hueso forma={foto === 'circulo' ? 'circulo' : 'bloque'} ancho={52} alto={52} />
      <span className={s.filaTextos}>
        <Hueso alto={13} ancho="70%" />
        <Hueso alto={10} ancho="45%" />
      </span>
      {derecha && <Hueso alto={16} ancho={64} />}
    </span>
  );
}

/** Un pedido (Mis pedidos): código y estado, la barra del avance y sus prendas. */
export function EsqueletoPedido() {
  return (
    <span className={s.tarjeta} aria-hidden="true">
      <span className={s.parLinea}><Hueso alto={15} ancho="34%" /><Hueso forma="pildora" alto={26} ancho={90} /></span>
      <Hueso alto={10} ancho="50%" />
      <Hueso forma="pildora" alto={8} />
      <span className={s.parLinea}>
        <span className={s.chips}>{repetir(3, (j) => <Hueso key={j} forma="bloque" ancho={56} alto={56} />)}</span>
        <Hueso alto={18} ancho={80} />
      </span>
    </span>
  );
}

/** Una tarjeta de contenido: sello, título, texto y botón. */
export function EsqueletoTarjeta({ lineas = 2, boton = true, alto }) {
  return (
    <span className={s.tarjeta} style={{ minHeight: alto }} aria-hidden="true">
      <span className={s.tarjetaCabeza}>
        <Hueso forma="circulo" ancho={40} alto={40} />
        <Hueso alto={15} ancho="50%" />
      </span>
      <EsqueletoTexto lineas={lineas} />
      {boton && <Hueso forma="pildora" alto={40} ancho="44%" className={s.alFinal} />}
    </span>
  );
}

/** Un formulario: etiqueta + campo, n veces, y el botón. */
export function EsqueletoFormulario({ campos = 4, titulo = true }) {
  return (
    <span className={s.formulario} aria-hidden="true">
      {titulo && <EsqueletoCabeza />}
      {repetir(campos, (k) => (
        <span key={k} className={s.campo}>
          <Hueso alto={10} ancho={k % 2 ? '28%' : '36%'} />
          <Hueso forma="bloque" alto={50} />
        </span>
      ))}
      <Hueso forma="pildora" alto={50} />
    </span>
  );
}

/* ── Secciones del builder ──────────────────────────────── */

const productos = (n) => repetir(n, (k) => <EsqueletoProducto key={k} />);

function Banner() {
  return (
    <span className={s.banner}>
      <span className={s.bannerTextos}>
        <Hueso claro forma="pildora" alto={22} ancho={110} />
        <Hueso claro alto={30} ancho="80%" />
        <Hueso claro alto={30} ancho="55%" />
        <Hueso claro alto={12} ancho="70%" />
        <Hueso claro forma="pildora" alto={46} ancho={170} />
      </span>
      <span className={s.puntos}>{repetir(3, (k) => <Hueso key={k} claro forma="pildora" alto={8} ancho={k ? 8 : 24} />)}</span>
    </span>
  );
}

const SECCIONES = {
  anuncio: () => <Hueso forma="bloque" alto={36} className={s.anuncio} />,
  banner: () => <Banner />,
  fila: () => (
    <>
      <EsqueletoCabeza />
      <span className={s.filaProductos}>{productos(6)}</span>
    </>
  ),
  grilla: () => (
    <>
      <EsqueletoCabeza />
      <span className={s.grilla}>{productos(8)}</span>
    </>
  ),
  catalogo: () => (
    <span className={s.catalogo}>
      <span className={s.filtros}>
        {repetir(4, (k) => (
          <span key={k} className={s.filtro}>
            <Hueso alto={12} ancho="50%" />
            {repetir(3, (j) => <Hueso key={j} alto={10} ancho={`${80 - j * 15}%`} />)}
          </span>
        ))}
      </span>
      <span className={s.catalogoLado}>
        <span className={s.chips}>{repetir(5, (k) => <Hueso key={k} forma="pildora" alto={36} ancho={k ? 92 : 120} />)}</span>
        <span className={s.grilla}>{productos(9)}</span>
      </span>
    </span>
  ),
  categorias: () => (
    <>
      <EsqueletoCabeza centrado />
      <span className={s.burbujas}>
        {repetir(6, (k) => (
          <span key={k} className={s.burbuja}>
            <Hueso forma="circulo" ancho={72} alto={72} />
            <Hueso alto={10} ancho={60} />
          </span>
        ))}
      </span>
    </>
  ),
  beneficios: () => (
    <span className={s.beneficios}>
      {repetir(4, (k) => (
        <span key={k} className={s.beneficio}>
          <Hueso forma="circulo" ancho={48} alto={48} />
          <span className={s.filaTextos}>
            <Hueso alto={13} ancho="70%" />
            <Hueso alto={10} ancho="90%" />
          </span>
        </span>
      ))}
    </span>
  ),
  testimonios: () => (
    <>
      <EsqueletoCabeza centrado />
      <span className={s.tres}>
        {repetir(3, (k) => (
          <span key={k} className={s.tarjeta}>
            <span className={s.tarjetaCabeza}>
              <Hueso forma="circulo" ancho={44} alto={44} />
              <span className={s.filaTextos}><Hueso alto={13} ancho="60%" /><Hueso alto={10} ancho="40%" /></span>
            </span>
            <EsqueletoTexto lineas={4} />
          </span>
        ))}
      </span>
    </>
  ),
  preguntas: () => (
    <>
      <EsqueletoCabeza centrado />
      <span className={s.preguntas}>{repetir(5, (k) => <Hueso key={k} forma="bloque" alto={58} />)}</span>
    </>
  ),
  marcas: () => (
    <span className={s.marcas}>{repetir(8, (k) => <Hueso key={k} forma="pildora" alto={52} ancho={140} />)}</span>
  ),
  mosaico: () => (
    <span className={s.mosaico}>
      <Hueso forma="bloque" className={s.mosaicoGrande} />
      <Hueso forma="bloque" />
      <Hueso forma="bloque" />
    </span>
  ),
  texto: () => (
    <span className={s.textoSeccion}>
      <EsqueletoCabeza />
      <EsqueletoTexto lineas={4} />
    </span>
  ),
  medio: () => <Hueso forma="bloque" proporcion="16 / 9" ancho="100%" />,
  ubicacion: () => (
    <span className={s.ubicacion}>
      <span className={s.textoSeccion}><EsqueletoCabeza /><EsqueletoTexto lineas={3} /><Hueso forma="pildora" alto={44} ancho={160} /></span>
      <Hueso forma="bloque" proporcion="4 / 3" ancho="100%" />
    </span>
  ),
};

/** Tipo del builder (REGISTRO_SECCIONES) → forma de su esqueleto. */
export const FORMA_DE_SECCION = {
  announcement_bar: 'anuncio',
  hero_carousel: 'banner',
  hero_banner: 'banner',
  trust_badges: 'beneficios',
  feature_list: 'beneficios',
  featured_carousel: 'fila',
  new_arrivals_carousel: 'fila',
  sale_carousel: 'fila',
  category_carousel: 'fila',
  collection_carousel: 'fila',
  flash_sales: 'fila',
  bestsellers_row: 'fila',
  featured_products: 'grilla',
  product_grid: 'grilla',
  sidebar_catalog: 'catalogo',
  category_grid: 'categorias',
  categories_nav: 'categorias',
  testimonials: 'testimonios',
  faq_accordion: 'preguntas',
  marquee: 'marcas',
  banner_grid: 'mosaico',
  header: 'texto',
  text: 'texto',
  image: 'medio',
  video: 'medio',
  map_location: 'ubicacion',
  footer_columns: null,
};

/**
 * El esqueleto de una sección del builder, con su forma (un banner no carga
 * igual que una fila de productos).
 *  - tipo: el `type` de la sección (hero_carousel…) o una forma directa
 *    ('banner', 'fila', 'grilla', 'catalogo', 'categorias', 'beneficios',
 *    'testimonios', 'preguntas', 'marcas', 'mosaico', 'texto', 'medio', 'ubicacion', 'anuncio')
 *  - etiqueta: lo que oye un lector de pantalla
 */
export function EsqueletoSeccion({ tipo, etiqueta = 'Cargando' }) {
  const forma = SECCIONES[tipo] ? tipo : FORMA_DE_SECCION[tipo] === undefined ? 'texto' : FORMA_DE_SECCION[tipo];
  if (!forma) return null;
  const Forma = SECCIONES[forma];
  return (
    <div className={cx(s.seccion, s[`s_${forma}`])} role="status" aria-busy="true" aria-label={etiqueta} data-componente="EsqueletoSeccion">
      <Forma />
    </div>
  );
}

/* ── Páginas ────────────────────────────────────────────── */

/** Lo de adentro de cada módulo de /cuenta (el menú y la cabeza los pone 'cuenta'). */
const estadistica = (k) => (
  <span key={k} className={s.tarjeta}>
    <Hueso forma="circulo" ancho={44} alto={44} />
    <Hueso alto={9} ancho="40%" />
    <Hueso alto={30} ancho="55%" />
  </span>
);
export const MODULOS_ESQUELETO_CUENTA = ['resumen', 'perfil', 'pedidos', 'direcciones', 'ajustes', 'catalogo', 'cupones', 'misiones', 'referidos', 'creaciones', 'deseos', 'fechas'];
const MODULOS_CUENTA = {
  resumen: () => (
    <>
      <EsqueletoCabeza />
      {estadistica(0)}
      <span className={s.accesos}>{repetir(6, (k) => (
        <span key={k} className={s.tarjeta}>
          <Hueso forma="circulo" ancho={40} alto={40} />
          <Hueso alto={13} ancho="70%" />
          <Hueso alto={10} ancho="90%" />
        </span>
      ))}</span>
    </>
  ),
  perfil: () => (
    <>
      <span className={cx(s.tarjeta, s.identidad)}>
        <Hueso forma="circulo" ancho={96} alto={96} />
        <span className={s.filaTextos}><Hueso alto={26} ancho="60%" /><Hueso alto={11} ancho="45%" /><Hueso alto={11} ancho="30%" /></span>
      </span>
      <span className={s.perfil}>
        {estadistica(0)}
        <span className={s.tarjeta}><EsqueletoFormulario campos={4} titulo={false} /></span>
      </span>
    </>
  ),
  pedidos: () => (
    <>
      <span className={s.chips}>{repetir(2, (k) => <Hueso key={k} forma="pildora" alto={40} ancho={120} />)}</span>
      {repetir(2, (k) => <EsqueletoPedido key={k} />)}
    </>
  ),
  direcciones: () => <span className={s.dos}>{repetir(2, (k) => <EsqueletoTarjeta key={k} lineas={3} alto={190} />)}</span>,
  ajustes: () => repetir(2, (k) => (
    <span key={k} className={s.tarjeta}>
      <span className={s.tarjetaCabeza}><Hueso forma="circulo" ancho={40} alto={40} /><Hueso alto={15} ancho="40%" /></span>
      {repetir(2, (j) => (
        <span key={j} className={s.parLinea}>
          <span className={s.filaTextos}><Hueso alto={13} ancho="50%" /><Hueso alto={10} ancho="70%" /></span>
          <Hueso forma="pildora" alto={28} ancho={50} />
        </span>
      ))}
    </span>
  )),
  catalogo: () => (
    <>
      {estadistica(0)}
      <span className={s.grilla}>{productos(6)}</span>
    </>
  ),
  cupones: () => (
    <span className={s.lista}>{repetir(3, (k) => (
      <span key={k} className={s.cupon}>
        <span className={s.cuponCuerpo}>
          <Hueso alto={24} ancho="40%" />
          <Hueso alto={12} ancho="70%" />
          <Hueso forma="pildora" alto={34} ancho={130} />
        </span>
        <span className={s.cuponTalon}><Hueso alto={20} ancho="70%" /></span>
      </span>
    ))}</span>
  ),
  misiones: () => (
    <>
      <span className={s.tres}>{repetir(3, (k) => estadistica(k))}</span>
      <span className={s.lista}>{repetir(4, (k) => <EsqueletoFila key={k} />)}</span>
    </>
  ),
  referidos: () => (
    <>
      <span className={s.tarjeta}>
        <Hueso alto={15} ancho="40%" />
        <span className={s.parLinea}><Hueso forma="bloque" alto={50} ancho="100%" /><Hueso forma="pildora" alto={50} ancho={120} /></span>
      </span>
      <span className={s.lista}>{repetir(3, (k) => <EsqueletoFila key={k} foto="circulo" />)}</span>
    </>
  ),
  creaciones: () => <span className={s.grilla}>{productos(6)}</span>,
  deseos: () => <span className={s.grilla}>{productos(6)}</span>,
  fechas: () => (
    <>
      <span className={s.filaProductos}>{repetir(4, (k) => (
        <span key={k} className={s.tarjeta}>
          <Hueso forma="bloque" ancho={56} alto={62} />
          <Hueso alto={13} ancho="70%" />
          <Hueso alto={10} ancho="50%" />
        </span>
      ))}</span>
      <span className={s.dos}>{repetir(2, (k) => <EsqueletoTarjeta key={k} lineas={4} alto={300} />)}</span>
    </>
  ),
  otro: () => <span className={s.dos}><EsqueletoTarjeta lineas={3} alto={220} /><EsqueletoTarjeta lineas={4} alto={220} /></span>,
};

/** Las secciones del inicio por defecto (si no se pasan las del builder). */
const INICIO = ['hero_carousel', 'category_grid', 'featured_carousel', 'feature_list', 'product_grid'];

const PAGINAS = {
  productos: () => (
    <>
      <EsqueletoCabeza />
      <span className={s.grilla}>{productos(8)}</span>
    </>
  ),
  tienda: () => (
    <>
      <EsqueletoCabeza />
      {SECCIONES.catalogo()}
    </>
  ),
  producto: () => (
    <span className={s.ficha}>
      <span className={s.galeria}>
        <Hueso forma="bloque" proporcion="1 / 1" ancho="100%" />
        <span className={s.miniaturas}>{repetir(4, (k) => <Hueso key={k} forma="bloque" proporcion="1 / 1" ancho="100%" />)}</span>
      </span>
      <span className={s.fichaInfo}>
        <Hueso alto={11} ancho="30%" />
        <Hueso alto={28} ancho="90%" />
        <Hueso alto={28} ancho="60%" />
        <Hueso alto={32} ancho="36%" />
        <Hueso alto={11} ancho="20%" />
        <span className={s.chips}>{repetir(5, (k) => <Hueso key={k} forma="pildora" alto={42} ancho={52} />)}</span>
        <span className={s.chips}>{repetir(4, (k) => <Hueso key={k} forma="circulo" ancho={34} alto={34} />)}</span>
        <Hueso forma="pildora" alto={54} />
        <EsqueletoTexto lineas={4} />
      </span>
    </span>
  ),
  carrito: () => (
    <>
      <EsqueletoCabeza />
      <span className={s.carrito}>
        <span className={s.lista}>
          {repetir(3, (k) => (
            <span key={k} className={s.lineaCarrito}>
              <Hueso forma="bloque" ancho={84} alto={84} />
              <span className={s.filaTextos}>
                <Hueso alto={14} ancho="75%" />
                <Hueso alto={10} ancho="35%" />
                <Hueso forma="pildora" alto={36} ancho={110} />
              </span>
              <Hueso alto={16} ancho={70} />
            </span>
          ))}
        </span>
        <span className={s.tarjeta}>
          <Hueso alto={18} ancho="50%" />
          {repetir(3, (k) => <span key={k} className={s.parLinea}><Hueso alto={11} ancho="35%" /><Hueso alto={11} ancho="20%" /></span>)}
          <Hueso forma="bloque" alto={48} />
          <span className={s.parLinea}><Hueso alto={18} ancho="30%" /><Hueso alto={22} ancho="34%" /></span>
          <Hueso forma="pildora" alto={52} />
        </span>
      </span>
    </>
  ),
  cuenta: ({ modulo }) => (
    <span className={s.cuenta}>
      <span className={cx(s.tarjeta, s.menuCuenta)}>
        <span className={s.tarjetaCabeza}>
          <Hueso forma="circulo" ancho={44} alto={44} />
          <span className={s.filaTextos}><Hueso alto={13} ancho="70%" /><Hueso alto={10} ancho="85%" /></span>
        </span>
        {repetir(12, (k) => (k === 0 || k === 5 || k === 10
          ? <Hueso key={k} alto={9} ancho="34%" className={s.grupoMenu} />
          : <span key={k} className={s.itemMenu}><Hueso forma="circulo" ancho={22} alto={22} /><Hueso alto={12} ancho={`${50 + ((k * 13) % 35)}%`} /></span>))}
      </span>
      <span className={s.cuentaLado}>
        {modulo !== 'resumen' && (
          <span className={s.tarjetaCabeza}>
            <Hueso forma="circulo" ancho={44} alto={44} />
            <span className={s.filaTextos}><Hueso alto={24} ancho="min(46%, 280px)" /><Hueso alto={11} ancho="min(70%, 380px)" /></span>
          </span>
        )}
        {(MODULOS_CUENTA[modulo] || MODULOS_CUENTA.otro)()}
      </span>
    </span>
  ),
  lista: () => (
    <>
      <EsqueletoCabeza />
      <span className={s.chips}>{repetir(2, (k) => <Hueso key={k} forma="pildora" alto={40} ancho={120} />)}</span>
      <span className={s.lista}>{repetir(3, (k) => <EsqueletoPedido key={k} />)}</span>
    </>
  ),
  formulario: () => (
    <span className={s.formularioPagina}>
      <span className={s.tarjeta}><EsqueletoFormulario /></span>
    </span>
  ),
  minijuegos: () => (
    <>
      <span className={cx(s.cabeza, s.centrado)}>
        <Hueso alto={34} ancho="min(60%, 360px)" />
        <Hueso alto={12} ancho="min(80%, 460px)" />
        <Hueso forma="pildora" alto={30} ancho={200} />
      </span>
      <span className={s.juegos}>{repetir(4, (k) => (
        <span key={k} className={s.tarjeta}>
          <Hueso forma="bloque" proporcion="16 / 10" ancho="100%" />
          <Hueso alto={16} ancho="60%" />
          <EsqueletoTexto lineas={2} alto={10} />
          <span className={s.parLinea}><Hueso forma="pildora" alto={26} ancho={90} /><Hueso forma="pildora" alto={42} ancho={110} /></span>
        </span>
      ))}</span>
    </>
  ),
  busqueda: () => (
    <>
      <Hueso forma="pildora" alto={54} ancho="min(100%, 680px)" className={s.buscador} />
      <span className={s.chips}>{repetir(5, (k) => <Hueso key={k} forma="pildora" alto={34} ancho={84 + (k % 3) * 18} />)}</span>
      <span className={s.parLinea}><Hueso alto={12} ancho={160} /><Hueso forma="pildora" alto={38} ancho={150} /></span>
      <span className={s.grilla}>{productos(8)}</span>
    </>
  ),
  encuesta: () => (
    <span className={s.encuesta}>
      <Hueso alto={9} ancho={90} />
      <Hueso forma="pildora" alto={8} />
      <span className={s.tarjeta}>
        <span className={cx(s.cabeza, s.centrado)}>
          <Hueso forma="circulo" ancho={52} alto={52} />
          <Hueso alto={26} ancho="60%" />
          <Hueso alto={11} ancho="75%" />
        </span>
        <span className={s.opciones}>{repetir(8, (k) => <Hueso key={k} forma="bloque" alto={108} />)}</span>
        <span className={s.parLinea}><Hueso forma="pildora" alto={44} ancho={100} /><Hueso forma="pildora" alto={44} ancho={160} /></span>
      </span>
    </span>
  ),
  acceso: () => (
    <span className={s.acceso}>
      <span className={s.accesoPanel}>
        <Hueso claro alto={22} ancho={100} />
        <Hueso claro alto={30} ancho="80%" />
        <Hueso claro alto={12} ancho="70%" />
        {repetir(3, (k) => <span key={k} className={s.itemMenu}><Hueso claro forma="circulo" ancho={30} alto={30} /><Hueso claro alto={12} ancho="55%" /></span>)}
      </span>
      <span className={s.accesoLado}><EsqueletoFormulario campos={2} /></span>
    </span>
  ),
};

/**
 * Lo que se ve mientras llega una página (Suspense): su forma, no un círculo.
 * Para cambiar de página siempre es esto (CapaCargando es para esperar una acción).
 *  - forma: 'productos' (la grilla, por defecto) | 'inicio' | 'tienda' |
 *    'busqueda' | 'producto' | 'carrito' | 'minijuegos' | 'encuesta' |
 *    'acceso' | 'cuenta' | 'lista' | 'formulario'
 *  - modulo (con forma 'cuenta'): uno de MODULOS_ESQUELETO_CUENTA (resumen,
 *    perfil, pedidos, direcciones, ajustes, catalogo, cupones, misiones,
 *    referidos, creaciones, deseos, fechas)
 *  - secciones: [tipo] las del builder (la tienda ya conoce la estructura de
 *    la página antes de que lleguen los productos): una EsqueletoSeccion por cada una
 *  - tarjetas, titulo: compatibilidad con la versión anterior (forma 'productos')
 */
export function EsqueletoPagina({ forma = 'productos', modulo, secciones, tarjetas, titulo = true }) {
  const lista = secciones || (forma === 'inicio' ? INICIO : null);
  return (
    <div className={s.pagina} role="status" aria-busy="true" aria-label="Cargando página" data-componente="EsqueletoPagina">
      {lista ? lista.map((tipo, k) => {
        const f = SECCIONES[tipo] ? tipo : FORMA_DE_SECCION[tipo];
        if (!f) return null;
        const Forma = SECCIONES[f];
        return <div key={`${tipo}-${k}`} className={cx(s.seccion, s[`s_${f}`])} aria-hidden="true"><Forma /></div>;
      }) : forma === 'productos' && tarjetas ? (
        <>
          {titulo && <EsqueletoCabeza />}
          <span className={s.grilla}>{productos(tarjetas)}</span>
        </>
      ) : (PAGINAS[forma] || PAGINAS.productos)({ modulo })}
    </div>
  );
}
