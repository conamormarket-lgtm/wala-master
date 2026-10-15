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
  catalogo: () => catalogo(),
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
/*
 * Las medidas salen de las páginas reales del kit a 1366px (el contenido de
 * la cuenta mide 918px junto al menú de 264px; la tarjeta de producto, 418px
 * de alto): así, al llegar los datos, nada salta.
 */

/** Una tarjeta del alto de la real. */
const Caja = ({ alto, className, children }) => (
  <span className={cx(s.tarjeta, className)} style={{ minHeight: alto }}>{children}</span>
);

/** La cabeza de una página de la tienda (Encabezado): título grande centrado y subtítulo. */
const EncabezadoCentrado = ({ extra = false }) => (
  <span className={s.encabezado}>
    <Hueso alto={46} ancho="min(70%, 420px)" />
    <Hueso alto={14} ancho="min(85%, 520px)" />
    {extra && <Hueso forma="pildora" alto={28} ancho={200} />}
  </span>
);

/** Una cifra de la cuenta (Estadistica): sello, etiqueta y número. */
const Cifra = ({ alto = 105 }) => (
  <Caja alto={alto} className={s.cifra}>
    <Hueso forma="circulo" ancho={48} alto={48} />
    <span className={s.filaTextos}><Hueso alto={9} ancho="40%" /><Hueso alto={28} ancho="50%" /></span>
  </Caja>
);

/** Sin sesión: la invitación a entrar (Mi cuenta, la encuesta): Kapi, título, texto y dos botones. */
const invitado = () => (
  <span className={s.invitado}>
    <span className={cx(s.tarjeta, s.invitadoTarjeta)}>
      <Hueso forma="circulo" ancho={112} alto={112} />
      <Hueso alto={22} ancho="60%" />
      <Hueso alto={11} ancho="85%" />
      <Hueso alto={11} ancho="65%" />
      <span className={s.invitadoBotones}>
        <Hueso forma="pildora" alto={46} ancho={150} />
        <Hueso forma="pildora" alto={46} ancho={130} />
      </span>
    </span>
  </span>
);

export const MODULOS_ESQUELETO_CUENTA = ['resumen', 'perfil', 'pedidos', 'direcciones', 'ajustes', 'catalogo', 'cupones', 'misiones', 'referidos', 'creaciones', 'deseos', 'fechas'];

/** Lo de adentro de cada módulo de /cuenta (el menú y la cabeza los pone 'cuenta'). */
const MODULOS_CUENTA = {
  resumen: () => (
    <>
      <Cifra />
      {[4, 4, 3].map((n, g) => (
        <span key={g} className={s.grupoAccesos}>
          <Hueso alto={9} ancho={110} />
          <span className={s.cuatro}>{repetir(n, (k) => (
            <Caja key={k} alto={82} className={s.acceso}>
              <Hueso forma="circulo" ancho={36} alto={36} />
              <span className={s.filaTextos}><Hueso alto={12} ancho="75%" /><Hueso alto={9} ancho="55%" /></span>
            </Caja>
          ))}</span>
        </span>
      ))}
    </>
  ),
  perfil: () => (
    <>
      <Caja alto={160} className={s.identidad}>
        <Hueso forma="circulo" ancho={100} alto={100} />
        <span className={s.filaTextos}><Hueso alto={30} ancho="45%" /><Hueso alto={11} ancho="35%" /><Hueso alto={11} ancho="22%" /></span>
      </Caja>
      <span className={s.perfil}>
        <Caja alto={335} className={s.cifraGrande}>
          <Hueso forma="circulo" ancho={56} alto={56} />
          <Hueso alto={9} ancho="45%" />
          <Hueso alto={40} ancho="55%" />
          <Hueso alto={10} ancho="80%" />
          <Hueso forma="pildora" alto={44} ancho="100%" className={s.alFinal} />
          <Hueso forma="pildora" alto={36} ancho="70%" />
        </Caja>
        <Caja alto={446}><EsqueletoFormulario campos={4} titulo={false} /></Caja>
      </span>
    </>
  ),
  pedidos: () => (
    <>
      <Hueso forma="pildora" alto={48} ancho={268} />
      <span className={s.dos}>{repetir(4, (k) => <EsqueletoPedido key={k} />)}</span>
    </>
  ),
  direcciones: () => <span className={s.dos}>{repetir(2, (k) => <EsqueletoTarjeta key={k} lineas={3} alto={223} />)}</span>,
  ajustes: () => (
    <span className={s.dos}>
      <Caja alto={204}>
        <span className={s.tarjetaCabeza}><Hueso forma="circulo" ancho={40} alto={40} /><Hueso alto={15} ancho="45%" /></span>
        <span className={s.parLinea}>
          <span className={s.filaTextos}><Hueso alto={13} ancho="45%" /><Hueso alto={10} ancho="85%" /></span>
          <Hueso forma="pildora" alto={28} ancho={50} />
        </span>
      </Caja>
      <Caja alto={329}>
        <span className={s.tarjetaCabeza}><Hueso forma="circulo" ancho={40} alto={40} /><Hueso alto={15} ancho="35%" /></span>
        {repetir(3, (j) => <Hueso key={j} forma="bloque" alto={58} />)}
      </Caja>
    </span>
  ),
  catalogo: () => (
    <span className={s.tresCol}>{repetir(6, (k) => (
      <Caja key={k} alto={340} className={s.recompensa}>
        <Hueso forma="bloque" proporcion="16 / 10" ancho="100%" />
        <Hueso alto={15} ancho="70%" />
        <Hueso alto={10} ancho="90%" />
        <span className={cx(s.parLinea, s.alFinal)}><Hueso alto={20} ancho="40%" /><Hueso forma="pildora" alto={40} ancho={110} /></span>
      </Caja>
    ))}</span>
  ),
  cupones: () => (
    <>
      <Hueso alto={12} ancho={220} />
      <span className={s.dos}>{repetir(4, (k) => (
        <span key={k} className={s.cupon} style={{ minHeight: 160 }}>
          <span className={s.cuponTalon}><Hueso forma="circulo" ancho={30} alto={30} /></span>
          <span className={s.cuponCuerpo}>
            <Hueso alto={10} ancho="45%" />
            <Hueso alto={15} ancho="70%" />
            <Hueso forma="bloque" alto={40} ancho="100%" />
            <Hueso alto={9} ancho="45%" />
          </span>
        </span>
      ))}</span>
    </>
  ),
  misiones: () => (
    <>
      <span className={s.tresCol}>{repetir(3, (k) => <Cifra key={k} />)}</span>
      <Caja alto={219}>
        <span className={s.tarjetaCabeza}><Hueso forma="circulo" ancho={56} alto={56} /><span className={s.filaTextos}><Hueso alto={18} ancho="35%" /><Hueso alto={10} ancho="50%" /></span></span>
        <Hueso forma="pildora" alto={10} ancho="50%" />
        <span className={s.cuatroFijo}>{repetir(4, (k) => <Hueso key={k} forma="bloque" alto={48} />)}</span>
      </Caja>
      <EsqueletoCabeza />
      <span className={s.lista}>{repetir(4, (k) => (
        <Caja key={k} alto={k ? 100 : 85} className={s.mision}>
          <Hueso forma="circulo" ancho={44} alto={44} />
          <span className={s.filaTextos}><Hueso alto={13} ancho="55%" /><Hueso forma="pildora" alto={8} ancho="80%" /></span>
          <Hueso forma="pildora" alto={36} ancho={100} />
        </Caja>
      ))}</span>
    </>
  ),
  referidos: () => (
    <>
      <span className={s.dos}>{repetir(2, (k) => (
        <Caja key={k} alto={126}>
          <Hueso forma="circulo" ancho={40} alto={40} />
          <Hueso alto={13} ancho="70%" />
          <Hueso alto={10} ancho="50%" />
        </Caja>
      ))}</span>
      <Caja alto={271}>
        <Hueso alto={15} ancho="40%" />
        <Hueso alto={10} ancho="70%" />
        <span className={s.parLinea}><Hueso forma="bloque" alto={50} ancho="100%" /><Hueso forma="pildora" alto={50} ancho={120} /></span>
        <span className={s.chips}>{repetir(3, (k) => <Hueso key={k} forma="pildora" alto={40} ancho={110} />)}</span>
      </Caja>
      <span className={s.tresCol}>{repetir(3, (k) => <Cifra key={k} alto={123} />)}</span>
      <span className={s.lista}>{repetir(3, (k) => <EsqueletoFila key={k} foto="circulo" />)}</span>
    </>
  ),
  creaciones: () => (
    <>
    <EsqueletoCabeza />
    <span className={s.dos}>{repetir(4, (k) => (
      <Caja key={k} alto={200} className={s.creacion}>
        <Hueso forma="bloque" ancho="42%" alto="auto" className={s.creacionFoto} />
        <span className={s.filaTextos}>
          <Hueso alto={15} ancho="80%" />
          <Hueso alto={10} ancho="50%" />
          <Hueso alto={18} ancho="40%" />
          <span className={s.parLinea}><Hueso forma="circulo" ancho={30} alto={30} /><Hueso forma="pildora" alto={34} ancho="70%" /></span>
        </span>
      </Caja>
    ))}</span>
    </>
  ),
  deseos: () => (
    <>
      <span className={s.chips}><Hueso forma="pildora" alto={44} ancho={170} /><Hueso forma="pildora" alto={44} ancho={150} /></span>
      <Caja alto={99} />
      <span className={s.grilla}>{productos(4)}</span>
    </>
  ),
  fechas: () => (
    <>
      <Caja alto={121} />
      <Hueso alto={14} ancho={130} />
      <span className={s.filaProductos}>{repetir(4, (k) => (
        <Caja key={k} alto={128} className={s.agenda}>
          <Hueso forma="bloque" ancho={56} alto={62} />
          <span className={s.filaTextos}><Hueso alto={13} ancho="80%" /><Hueso alto={10} ancho="55%" /></span>
        </Caja>
      ))}</span>
      <Caja alto={272}>
        <span className={s.tarjetaCabeza}><Hueso forma="circulo" ancho={56} alto={56} /><span className={s.filaTextos}><Hueso alto={18} ancho="40%" /><Hueso alto={10} ancho="60%" /></span></span>
        <Hueso forma="pildora" alto={8} />
        <EsqueletoFila />
      </Caja>
      <span className={s.dos}>{[520, 520].map((alto, k) => <EsqueletoTarjeta key={k} lineas={5} alto={alto} />)}</span>
    </>
  ),
  otro: () => <span className={s.dos}><EsqueletoTarjeta lineas={3} alto={220} /><EsqueletoTarjeta lineas={4} alto={220} /></span>,
};

/** Las secciones del inicio por defecto (si no se pasan las del builder). */
const INICIO = ['hero_carousel', 'category_grid', 'featured_carousel', 'feature_list', 'product_grid'];

/** El catálogo de /tienda y de la búsqueda: filtros (264px), cuenta de productos y grilla. */
const catalogo = () => (
  <span className={s.catalogo}>
    <span className={s.filtros}>
      <Hueso alto={18} ancho="45%" />
      {repetir(4, (k) => (
        <span key={k} className={s.filtro}>
          <Hueso alto={12} ancho="50%" />
          <span className={s.chips}>{repetir(k ? 3 : 7, (j) => <Hueso key={j} forma="pildora" alto={28} ancho={60 + ((j * 23) % 40)} />)}</span>
        </span>
      ))}
    </span>
    <span className={s.catalogoLado}>
      <span className={s.parLinea}><Hueso alto={14} ancho={110} /><Hueso forma="pildora" alto={42} ancho={110} className={s.soloAngostoCatalogo} /></span>
      <span className={s.grilla}>{productos(8)}</span>
    </span>
  </span>
);

const PAGINAS = {
  productos: () => (
    <>
      <EsqueletoCabeza />
      <span className={s.grilla}>{productos(8)}</span>
    </>
  ),
  tienda: () => (
    <>
      <EncabezadoCentrado />
      <Hueso alto={26} ancho={260} />
      {catalogo()}
    </>
  ),
  busqueda: () => (
    <>
      <Caja alto={309} className={s.busquedaCabeza}>
        <Hueso alto={30} ancho="min(50%, 420px)" />
        <Hueso alto={14} ancho="min(40%, 320px)" />
        <Hueso forma="pildora" alto={56} ancho="100%" />
        <span className={s.chips}>{repetir(6, (k) => <Hueso key={k} forma="pildora" alto={34} ancho={84 + (k % 3) * 18} />)}</span>
      </Caja>
      {catalogo()}
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
      <span className={s.parLinea}>
        <span className={s.cabeza}><Hueso alto={32} ancho={200} /><Hueso alto={11} ancho={90} /></span>
        <Hueso alto={13} ancho={140} />
      </span>
      <span className={s.carrito}>
        <span className={s.tarjeta}>
          <Hueso forma="bloque" alto={75} />
          {repetir(2, (k) => (
            <span key={k} className={s.lineaCarrito}>
              <Hueso forma="bloque" ancho={84} alto={96} />
              <span className={s.filaTextos}>
                <Hueso alto={14} ancho="65%" />
                <Hueso alto={10} ancho="25%" />
                <Hueso forma="pildora" alto={36} ancho={120} />
              </span>
              <span className={s.cabeza}><Hueso alto={16} ancho={70} /><Hueso alto={10} ancho={50} /></span>
            </span>
          ))}
        </span>
        <Caja alto={425}>
          <Hueso alto={16} ancho="35%" />
          {repetir(3, (k) => <span key={k} className={s.parLinea}><Hueso alto={11} ancho="30%" /><Hueso alto={11} ancho="22%" /></span>)}
          <Hueso forma="bloque" alto={44} />
          <span className={s.parLinea}><Hueso alto={16} ancho="25%" /><Hueso alto={26} ancho="38%" /></span>
          <Hueso alto={10} ancho="70%" />
          <Hueso forma="pildora" alto={50} />
          <Hueso alto={9} ancho="80%" className={s.centradoSolo} />
        </Caja>
      </span>
      <span className={s.seccionDebajo}>
        <Hueso forma="pildora" alto={20} ancho={170} />
        <Hueso alto={24} ancho={260} />
        <span className={s.filaProductos}>{productos(5)}</span>
      </span>
    </>
  ),
  cuenta: ({ modulo, sesion }) => (sesion === false ? invitado() : (
    <span className={s.cuenta}>
      <span className={cx(s.tarjeta, s.menuCuenta)}>
        <span className={s.tarjetaCabeza}>
          <Hueso forma="circulo" ancho={44} alto={44} />
          <span className={s.filaTextos}><Hueso alto={13} ancho="70%" /><Hueso alto={10} ancho="85%" /></span>
        </span>
        {[4, 4, 3].map((n, g) => (
          <span key={g} className={s.grupoMenu}>
            <Hueso alto={9} ancho="40%" />
            {repetir(n, (k) => <span key={k} className={s.itemMenu}><Hueso forma="circulo" ancho={22} alto={22} /><Hueso alto={12} ancho={`${50 + (((g * 4 + k) * 13) % 35)}%`} /></span>)}
          </span>
        ))}
        <Hueso alto={12} ancho="45%" className={s.alFinal} />
      </span>
      <span className={s.cuentaLado}>
        {/* En el celular cada módulo es su pantalla, con "← Mi cuenta" arriba. */}
        {modulo !== 'resumen' && <Hueso forma="pildora" alto={40} ancho={130} className={s.soloAngosto} />}
        {/* Mi perfil no tiene cabeza: la identidad hace de título. */}
        {modulo !== 'perfil' && (
          <span className={s.tarjetaCabeza}>
            {modulo !== 'resumen' && <Hueso forma="circulo" ancho={44} alto={44} />}
            {/* Con la medida de CabezaCuenta: 57px (el saludo del resumen, con su subrayado, 67px). */}
            <span className={s.filaTextos}>
              <Hueso alto={34} ancho="min(46%, 280px)" />
              {modulo === 'resumen' && <Hueso forma="pildora" alto={6} ancho={120} />}
              <Hueso alto={12} ancho="min(70%, 380px)" />
            </span>
            {['creaciones', 'fechas', 'direcciones'].includes(modulo) && <Hueso forma="pildora" alto={40} ancho={170} />}
          </span>
        )}
        {(MODULOS_CUENTA[modulo] || MODULOS_CUENTA.otro)()}
      </span>
    </span>
  )),
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
  crear: ({ sesion }) => (
    // La portada (el arte de Kapi, 2172 × 724), lo del cliente y las prendas.
    <>
      <span className={s.portadaCrear}>
        <span className={s.portadaCrearTexto}>
          <Hueso claro alto={40} ancho="70%" />
          <Hueso claro alto={12} ancho="90%" />
          {repetir(3, (k) => <span key={k} className={s.itemMenu}><Hueso claro forma="circulo" ancho={42} alto={42} /><Hueso claro alto={12} ancho="55%" /></span>)}
        </span>
      </span>
      {sesion !== false && (
        <span className={s.seccionDebajo}>
          <EsqueletoCabeza />
          <span className={cx(s.filaProductos, s.filaCuatro)}>{productos(5)}</span>
        </span>
      )}
      <span className={s.seccionDebajo}>
        <EsqueletoCabeza />
        <span className={s.chips}>{repetir(3, (k) => <Hueso key={k} forma="pildora" alto={44} ancho={k ? 150 : 100} />)}</span>
        <span className={s.grillaCrear}>{productos(4)}</span>
      </span>
    </>
  ),
  comunidad: () => (
    <>
      <span className={s.tarjetaCabeza}>
        <Hueso forma="circulo" ancho={44} alto={44} />
        <span className={s.filaTextos}><Hueso alto={30} ancho="min(46%, 340px)" /><Hueso alto={11} ancho="min(70%, 420px)" /></span>
        <Hueso forma="pildora" alto={44} ancho={190} />
      </span>
      <span className={s.chips}>{repetir(4, (k) => <Hueso key={k} forma="pildora" alto={36} ancho={k ? 120 : 80} />)}</span>
      <span className={s.grillaCrear}>{productos(8)}</span>
    </>
  ),
  minijuegos: ({ sesion }) => (
    <>
      <EncabezadoCentrado extra={sesion !== false} />
      {sesion === false && (
        <span className={cx(s.tarjeta, s.avisoEntrar)}>
          <span className={s.filaTextos}><Hueso alto={14} ancho="40%" /><Hueso alto={10} ancho="70%" /></span>
          <Hueso forma="pildora" alto={42} ancho={140} />
        </span>
      )}
      <span className={s.juegos}>{repetir(4, (k) => (
        <Caja key={k} alto={k < 2 ? 478 : 594} className={s.juego}>
          <Hueso forma="bloque" proporcion="16 / 8" ancho="100%" className={s.juegoFoto} />
          <span className={s.juegoCuerpo}>
            <Hueso alto={18} ancho="45%" />
            <EsqueletoTexto lineas={2} alto={10} />
            <Hueso forma="pildora" alto={24} ancho={150} />
            <Hueso forma="pildora" alto={44} ancho="100%" className={s.alFinal} />
          </span>
        </Caja>
      ))}</span>
    </>
  ),
  encuesta: ({ sesion }) => (sesion === false ? invitado() : (
    // Se abre en la portada: Kapi, el título con su trazo, el premio y los dos botones.
    <span className={s.encuesta}>
      <Caja alto={518} className={s.encuestaTarjeta}>
        <Hueso forma="circulo" ancho={120} alto={120} />
        <Hueso alto={32} ancho="70%" />
        <Hueso alto={10} ancho="40%" />
        <Hueso alto={12} ancho="60%" />
        <Hueso forma="bloque" alto={71} ancho="100%" />
        <Hueso alto={11} ancho="85%" />
        <Hueso alto={11} ancho="55%" />
        <span className={s.chips}><Hueso forma="pildora" alto={46} ancho={110} /><Hueso forma="pildora" alto={46} ancho={180} /></span>
      </Caja>
    </span>
  )),
  estudio: ({ sesion }) => (
    // El estudio (/crear/:id): la prenda con sus lados y su barra; al lado, los
    // tres pasos y la compra. Sin sesión, arriba va el aviso de que guardar pide entrar.
    <span className={s.estudio}>
      <span className={s.estudioCabeza}>
        <Hueso forma="circulo" ancho={36} alto={36} />
        <span className={s.filaTextos}><Hueso alto={20} ancho="min(55%, 260px)" /><Hueso alto={10} ancho="min(35%, 160px)" /></span>
        <Hueso alto={22} ancho={64} />
      </span>
      {sesion === false && <Hueso forma="bloque" alto={40} ancho="100%" />}
      <span className={s.estudioCuerpo}>
        <span className={s.estudioEscena}>
          <Hueso forma="pildora" alto={40} ancho={200} />
          <Hueso forma="bloque" proporcion="1100 / 1289" className={s.estudioLienzo} />
          <Hueso forma="pildora" alto={46} ancho="min(100%, 520px)" />
        </span>
        <span className={cx(s.tarjeta, s.estudioPanel)}>
          {repetir(3, (k) => (
            <span key={k} className={s.estudioPaso}>
              <span className={s.itemMenu}><Hueso forma="circulo" ancho={30} alto={30} /><Hueso alto={14} ancho="50%" /></span>
              {k === 0 && <span className={s.chips}>{repetir(6, (j) => <Hueso key={j} forma="circulo" ancho={36} alto={36} />)}</span>}
              {k === 1 && <span className={s.chips}>{repetir(4, (j) => <Hueso key={j} forma="pildora" alto={32} ancho={j % 2 ? 110 : 80} />)}</span>}
              {k === 2 && <span className={s.estudioAgregar}><Hueso forma="bloque" alto={112} /><Hueso forma="bloque" alto={112} /></span>}
            </span>
          ))}
          <span className={s.estudioCompra}>
            <Hueso alto={18} ancho="100%" />
            <Hueso forma="pildora" alto={48} ancho="100%" />
          </span>
        </span>
      </span>
    </span>
  ),
  checkout: ({ sesion }) => (
    // El checkout: el título con los pasos; el formulario de envío y, al lado
    // (arriba y plegado en el celular), el resumen.
    <span className={s.checkout}>
      <span className={s.checkoutCabeza}>
        <Hueso alto={32} ancho="min(60%, 300px)" />
        <span className={s.chips}><Hueso forma="circulo" ancho={28} alto={28} /><Hueso alto={12} ancho={50} /><Hueso forma="circulo" ancho={28} alto={28} /><Hueso alto={12} ancho={44} /></span>
      </span>
      <span className={s.checkoutCuerpo}>
        <span className={cx(s.tarjeta, s.checkoutResumen)}>
          <span className={s.checkoutPlegado}><Hueso alto={14} ancho="45%" /><Hueso alto={18} ancho={80} /></span>
          <span className={s.checkoutAbierto}>
            <Hueso alto={20} ancho="60%" />
            {repetir(2, (k) => <span key={k} className={s.itemMenu}><Hueso forma="bloque" ancho={52} alto={52} /><Hueso alto={12} ancho="60%" /></span>)}
            <Hueso forma="bloque" alto={64} ancho="100%" />
            <Hueso forma="pildora" alto={46} ancho="100%" />
            <EsqueletoTexto lineas={3} alto={12} ultima="100%" />
            <Hueso alto={28} ancho="100%" />
          </span>
        </span>
        <span className={cx(s.tarjeta, s.checkoutForm)}>
          <Hueso alto={20} ancho="35%" />
          {sesion !== false ? (
            <Hueso forma="bloque" alto={170} ancho="100%" />
          ) : (
            <EsqueletoFormulario campos={5} titulo={false} />
          )}
          <Hueso forma="bloque" alto={74} ancho="100%" />
          <span className={s.checkoutBotones}><Hueso forma="pildora" alto={44} ancho={160} /><Hueso forma="pildora" alto={52} ancho={210} /></span>
        </span>
      </span>
    </span>
  ),
  ofertas: () => (
    // /ofertas: el encabezado, el cofre diario y las ofertas (foto, sello y textos).
    <>
      <EncabezadoCentrado />
      <Caja alto={112} className={s.cofreEsq}>
        <Hueso forma="circulo" ancho={68} alto={68} />
        <span className={s.filaTextos}><Hueso alto={20} ancho="40%" /><Hueso alto={11} ancho="75%" /><Hueso alto={11} ancho="45%" /></span>
        <Hueso forma="pildora" alto={44} ancho={190} className={s.cofreEsqBoton} />
      </Caja>
      <span className={s.ofertasEsq}>{repetir(4, (k) => (
        <Caja key={k} className={s.ofertaEsq}>
          <Hueso forma="bloque" proporcion="4 / 3" ancho="100%" />
          <span className={s.ofertaEsqCuerpo}>
            <Hueso alto={16} ancho="70%" />
            <Hueso alto={10} ancho="50%" />
            <Hueso alto={10} ancho="60%" />
            <Hueso forma="pildora" alto={36} ancho={130} />
          </span>
        </Caja>
      ))}</span>
    </>
  ),
  nichos: () => (
    // /nichos: el encabezado y los cuadros (foto y nombre con su tipo).
    <>
      <EncabezadoCentrado />
      <span className={s.nichosEsq}>{repetir(4, (k) => (
        <span key={k} className={s.nichoEsq}>
          <Hueso forma="bloque" proporcion="1 / 1" ancho="100%" />
          <Hueso alto={14} ancho="60%" />
          <Hueso alto={10} ancho="40%" />
        </span>
      ))}</span>
      {/* "Buscar productos" y "Volver a la tienda". */}
      <span className={cx(s.chips, s.pieNavegarEsq)}><Hueso forma="pildora" alto={44} ancho={180} /><Hueso forma="pildora" alto={44} ancho={170} /></span>
    </>
  ),
  coleccion: () => (
    // Un nicho o un vendedor: migas, el logo con el nombre y la grilla.
    <>
      <span className={s.coleccionCabeza}>
        <Hueso alto={11} ancho={190} />
        <span className={s.itemMenu}>
          <Hueso forma="circulo" ancho={64} alto={64} />
          <span className={s.filaTextos}><Hueso alto={34} ancho="min(60%, 300px)" /><Hueso alto={12} ancho="min(45%, 200px)" /></span>
        </span>
      </span>
      <span className={s.grilla}>{productos(8)}</span>
    </>
  ),
  legal: () => (
    // Privacidad o términos: la cabeza con el sello, el índice al costado y la hoja.
    <span className={s.legalEsq}>
      <span className={s.itemMenu}>
        <Hueso forma="circulo" ancho={52} alto={52} />
        <span className={s.filaTextos}><Hueso alto={34} ancho="min(70%, 380px)" className={s.tituloLegalEsq} /><Hueso alto={11} ancho="min(50%, 240px)" /></span>
      </span>
      <span className={s.legalCuerpo}>
        <span className={s.legalIndice}>
          <Hueso alto={9} ancho="45%" />
          {repetir(8, (k) => <Hueso key={k} alto={13} ancho={`${55 + ((k * 17) % 40)}%`} />)}
        </span>
        <Caja alto={640} className={s.legalHoja}>
          {repetir(3, (k) => (
            <span key={k} className={s.legalSeccion}>
              <span className={s.itemMenu}><Hueso forma="circulo" ancho={30} alto={30} /><Hueso alto={17} ancho="45%" /></span>
              <EsqueletoTexto lineas={k === 1 ? 5 : 4} alto={11} />
            </span>
          ))}
        </Caja>
      </span>
    </span>
  ),
  reclamaciones: () => (
    // El libro de reclamaciones: la cabeza, los datos del proveedor y la hoja con sus tres pasos.
    <span className={s.reclamosEsq}>
      <span className={s.itemMenu}>
        <Hueso forma="circulo" ancho={52} alto={52} />
        <span className={s.filaTextos}><Hueso alto={34} ancho="min(70%, 380px)" className={s.tituloLegalEsq} /><Hueso alto={11} ancho="min(85%, 460px)" /></span>
      </span>
      <Hueso alto={12} ancho="80%" />
      <Hueso forma="bloque" alto={128} ancho="100%" className={s.proveedorEsq} />
      <Caja alto={720}>
        {repetir(3, (k) => (
          <span key={k} className={s.legalSeccion}>
            <span className={s.itemMenu}><Hueso forma="circulo" ancho={30} alto={30} /><Hueso alto={16} ancho="35%" /></span>
            <EsqueletoFormulario campos={k === 0 ? 4 : 2} titulo={false} />
          </span>
        ))}
      </Caja>
      <Hueso forma="pildora" alto={54} ancho="100%" />
    </span>
  ),
  acceso: () => (
    <span className={s.accesoPagina}>
      <span className={s.accesoPanel}>
        <Hueso claro alto={22} ancho={100} />
        <Hueso claro alto={34} ancho="80%" />
        <Hueso claro alto={12} ancho="70%" />
        {repetir(3, (k) => <span key={k} className={s.itemMenu}><Hueso claro forma="circulo" ancho={32} alto={32} /><Hueso claro alto={12} ancho="55%" /></span>)}
      </span>
      <span className={s.accesoLado}><EsqueletoFormulario campos={2} /></span>
    </span>
  ),
};

/**
 * Lo que se ve mientras llega una página (Suspense): su forma, no un círculo.
 * Para cambiar de página siempre es esto (CapaCargando es para esperar una acción).
 *  - forma: 'productos' (la grilla, por defecto) | 'inicio' | 'tienda' |
 *    'busqueda' | 'producto' | 'carrito' | 'checkout' | 'crear' | 'estudio' | 'comunidad' | 'minijuegos' | 'encuesta' |
 *    'acceso' | 'cuenta' | 'lista' | 'formulario' | 'ofertas' | 'nichos' | 'coleccion' (un nicho o un vendedor) |
 *    'legal' (privacidad, términos) | 'reclamaciones'
 *  - sesion: false para quien no entró (la cuenta y la encuesta muestran la
 *    invitación a entrar; Minijuegos, su aviso en vez del progreso)
 *  - modulo (con forma 'cuenta'): uno de MODULOS_ESQUELETO_CUENTA (resumen,
 *    perfil, pedidos, direcciones, ajustes, catalogo, cupones, misiones,
 *    referidos, creaciones, deseos, fechas)
 *  - secciones: [tipo] las del builder (la tienda ya conoce la estructura de
 *    la página antes de que lleguen los productos): una EsqueletoSeccion por cada una
 *  - tarjetas, titulo: compatibilidad con la versión anterior (forma 'productos')
 */
export function EsqueletoPagina({ forma = 'productos', modulo, sesion = true, secciones, tarjetas, titulo = true }) {
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
      ) : (PAGINAS[forma] || PAGINAS.productos)({ modulo, sesion })}
    </div>
  );
}
