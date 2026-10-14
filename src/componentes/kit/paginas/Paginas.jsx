import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ShoppingBag, LogIn, Sparkles, Store, Package } from 'lucide-react';
import Boton from '../Boton';
import { Cabecera, BarraInferior, Pestanas } from '../Navegacion';
import { ItemCarrito, BarraEnvioGratis, ResumenPedido, SeguimientoPedido } from '../Pedido';
import { EstadoVacio, Aviso } from '../Feedback';
import { Encabezado } from '../SeccionesContenido';
import { CabezaCuenta } from '../piezas/Cuenta';
import { TarjetaJuego } from '../piezas/TarjetaJuego';
import { ChipsBusqueda, InvitacionBusqueda } from '../piezas/PanelBusqueda';
import { Destello } from '../Marca';
import { EASE } from '../Efectos';
import { BloqueSeccion, TituloSeccion } from '../Seccion';
import { RenderSecciones, CarruselProductos } from '../Secciones';
import { PiePagina, CatalogoConFiltros } from '../SeccionesExtra';
import { Buscador } from '../Formulario';
import { PilaFlotante } from '../piezas/Flotantes';
import { PieLegal } from '../piezas/Marco';
import s from './Paginas.module.css';

/*
 * Páginas: el último eslabón de la cadena piezas → secciones → páginas.
 * Cada página se arma solo con secciones y piezas del kit; los datos entran
 * por props (en la tienda: CartContext, pedidos de Firestore, la config del
 * builder…).
 */

/**
 * Marco de cualquier página de la tienda: avisos arriba, cabecera, contenido
 * y pie de página; en el celular, la barra inferior; y lo que flota encima.
 *  - arriba: nodos sobre la cabecera (AvisoSistema, BannerApp, BarraAdmin)
 *  - cabecera: props de <Cabecera> (o null para landings sin menú)
 *  - pie: ajustes de footer_columns (o null)  · pieLegal: props de <PieLegal>
 *  - kapiEnPie: Kapi asomado por el pie (false si la página ya termina con uno)
 *  - barraInferior: props de <BarraInferior> (o null)
 *  - flotantes: { derecha, izquierda } → <PilaFlotante> (WhatsApp, Kapi…)
 *  - contenida: el marco vive dentro de algo con su propio scroll (demo,
 *    editor): los flotantes se pegan al marco y no a la ventana.
 * Cada parte lleva data-componente (Cabecera, PiePagina, BarraInferior) para
 * ubicarla en la guía (kit/guia) y en "Ver componentes".
 */
export function MarcoTienda({ arriba, cabecera, pie, pieLegal, kapiEnPie = true, barraInferior, flotantes, contenida = false, children }) {
  return (
    <div className={s.marco}>
      {arriba && <div className={s.arriba}>{arriba}</div>}
      {cabecera && <div className={s.cabecera} data-componente="Cabecera"><Cabecera {...cabecera} /></div>}
      <main className={s.contenido}>{children}</main>
      {(pie || pieLegal) && (
        <div data-componente="PiePagina">
          <BloqueSeccion ajustes={{ paddingTop: '1rem', paddingBottom: '1.5rem' }}>
            <PiePagina ajustes={pie || {}} pieLegal={pieLegal && <PieLegal {...pieLegal} />} kapi={kapiEnPie} />
          </BloqueSeccion>
        </div>
      )}
      {flotantes && (
        <div className={s.flotantes}>
          <PilaFlotante contenida={contenida} izquierda={flotantes.izquierda}>{flotantes.derecha}</PilaFlotante>
        </div>
      )}
      {barraInferior && <div className={s.barraInferior} data-componente="BarraInferior"><BarraInferior {...barraInferior} /></div>}
    </div>
  );
}

/**
 * Qué lista de productos va en cada tipo de sección, igual que en
 * TiendaPage: destacados (featured), más nuevos (new_arrivals), con
 * salePrice (sale y flash_sales), por categoría o colección, o todos. Un
 * catálogo o grilla fijado a una marca (settings.brandId) toma solo los de esa
 * marca.
 */
export function productosDeSeccion(productos = {}, sec) {
  const st = sec?.settings || {};
  switch (sec?.type) {
    case 'featured_carousel':
    case 'featured_products': return productos.destacados || [];
    case 'new_arrivals_carousel': return productos.nuevos || [];
    case 'sale_carousel':
    case 'flash_sales': return productos.ofertas || [];
    case 'category_carousel': return productos.porCategoria?.[st.categoryId] || [];
    case 'collection_carousel': return productos.porColeccion?.[st.collection] || [];
    case 'sidebar_catalog':
    case 'product_grid': return st.brandId ? (productos.todos || []).filter((p) => p.brandId === st.brandId) : productos.todos || [];
    default: return productos.todos || [];
  }
}

/**
 * Página del builder (inicio, tienda, landings): el marco + las secciones
 * guardadas en Firestore (`pages/{id}`).
 *  - productos: { destacados, nuevos, ofertas, porCategoria, porColeccion,
 *    todos } → cada sección toma la suya (productosDeSeccion). O, para
 *    decidir a mano, productosPara(seccion) como en <RenderSecciones>.
 *  - categorias: [{ categoryId, name, imageUrl, imagenProducto, cuenta }]
 *    con productos, en el orden del admin (category_grid automático, que
 *    aplica su orden, límite y foto; categories_nav). imagenProducto = foto
 *    de un producto de la categoría (imageSource 'product').
 *  - marcas: tienda_brands (banner_grid de marcas, sello en las tarjetas).
 *  - marcaActual: id de la marca de la página (landing de marca).
 *  - El resto: props del marco (cabecera, pie, flotantes…) y de
 *    <RenderSecciones> (onAgregar, propsPara, respaldo, envolver).
 */
export function PaginaTienda({
  arriba, cabecera, pie, pieLegal, barraInferior, flotantes, contenida,
  productos, productosPara, categorias = [], marcas = [], marcaActual = null, ...secciones
}) {
  const catalogo = useMemo(() => ({ marcas, categorias, marcaActual }), [marcas, categorias, marcaActual]);
  // Un solo Kapi a la vista: si la página termina con Preguntas frecuentes
  // (su tarjeta de ayuda trae a Kapi), el pie no lo repite.
  const orden = [...(secciones.secciones || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const kapiEnPie = orden[orden.length - 1]?.type !== 'faq_accordion';
  return (
    <MarcoTienda {...{ arriba, cabecera, pie, pieLegal, kapiEnPie, barraInferior, flotantes, contenida }}>
      <RenderSecciones
        productosPara={productosPara || ((sec) => productosDeSeccion(productos, sec))}
        // Con items puestos a mano en el editor mandan esos; si no, las
        // categorías automáticas.
        categoriasPara={(sec) => (sec.settings?.items?.length && sec.settings.dataSource !== 'products' ? undefined : categorias)}
        marcasPara={() => marcas}
        catalogo={catalogo}
        {...secciones}
      />
    </MarcoTienda>
  );
}

const sumar = (items, f) => items.reduce((a, it) => a + f(it), 0);

/**
 * Carrito: barra de envío gratis, productos, resumen con cupón y, debajo,
 * el carrusel de productos (la misma sección del builder) para completar.
 *  - items: [{ id, imagen, nombre, variante, precio, precioAntes, cantidad, personalizado }]
 *  - onCantidad(id, n), onQuitar(id), onPagar, onSeguirComprando
 *  - metaEnvio, costoEnvio, cupones
 *  - recomendados: productos_wala para "También te puede gustar"; onAgregar(producto)
 */
export function PaginaCarrito({
  items = [], onCantidad, onQuitar, onPagar, onSeguirComprando,
  metaEnvio = 150, costoEnvio = 12, cupones, recomendados = [], onAgregar, vacio,
}) {
  const cuentas = useMemo(() => {
    const bruto = sumar(items, (it) => (it.precioAntes ?? it.precio) * it.cantidad);
    const neto = sumar(items, (it) => it.precio * it.cantidad);
    return { bruto, neto, descuento: bruto - neto, envio: neto >= metaEnvio || neto === 0 ? 0 : costoEnvio, unidades: sumar(items, (it) => it.cantidad) };
  }, [items, metaEnvio, costoEnvio]);

  return (
    <>
      <BloqueSeccion ajustes={{ paddingTop: '1.5rem', paddingBottom: '1rem' }}>
        <div className={s.cabezaPagina}>
          {/* Cuántos productos: un dato de la página, en texto (no en etiqueta). */}
          <TituloSeccion
            nivel={1}
            titulo="Tu carrito"
            subtitulo={cuentas.unidades ? `${cuentas.unidades} ${cuentas.unidades === 1 ? 'producto' : 'productos'}` : undefined}
          />
          {onSeguirComprando && <Boton variante="fantasma" icono={<ArrowLeft aria-hidden="true" />} onClick={onSeguirComprando}>Seguir comprando</Boton>}
        </div>
        {items.length === 0 ? (
          <EstadoVacio titulo={vacio?.titulo || 'Tu carrito está vacío'} texto={vacio?.texto || 'Toca "Agregar" en lo que te guste y aparece aquí.'}>
            {vacio?.accion || (onSeguirComprando && <Boton icono={<ShoppingBag aria-hidden="true" />} onClick={onSeguirComprando}>Ver la tienda</Boton>)}
          </EstadoVacio>
        ) : (
          <div className={s.carrito}>
            <div className={s.carritoLista}>
              <BarraEnvioGratis actual={cuentas.neto} meta={metaEnvio} />
              <AnimatePresence initial={false}>
                {items.map((it) => (
                  <motion.div
                    key={it.id}
                    layout
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0, x: -40 }}
                    transition={{ duration: 0.4, ease: EASE }}
                    style={{ overflow: 'hidden' }}
                  >
                    <ItemCarrito {...it} onCantidad={(n) => onCantidad?.(it.id, n)} onQuitar={() => onQuitar?.(it.id)} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            <div className={s.carritoResumen}>
              <ResumenPedido
                subtotal={cuentas.bruto}
                descuento={cuentas.descuento}
                envio={cuentas.envio}
                monedas={Math.round(cuentas.neto)}
                cupones={cupones}
                onPagar={onPagar}
              />
            </div>
          </div>
        )}
      </BloqueSeccion>
      {recomendados.length > 0 && (
        <BloqueSeccion ajustes={{ paddingTop: '1rem', paddingBottom: '2rem' }}>
          <CarruselProductos
            ajustes={{ eyebrow: 'Para completar tu pedido', title: 'También te puede gustar', visibleItems: 4 }}
            productos={recomendados}
            onAgregar={onAgregar}
          />
        </BloqueSeccion>
      )}
    </>
  );
}

/**
 * Mis pedidos: pestañas Activos / Entregados con cuántos hay, cada pedido con
 * su seguimiento y, si una pestaña está vacía, Kapi. Va dentro de MarcoCuenta
 * (su cabecera es la de las páginas de la cuenta).
 *  - pedidos: [{ codigo, fecha, paso (0-4), total, items, pagoPendiente, entregaEstimada }]
 *  - onIrATienda
 */
export function PaginaPedidos({ pedidos = [], onIrATienda }) {
  const entregados = pedidos.filter((p) => p.paso >= 4);
  const activos = pedidos.filter((p) => p.paso < 4);
  const [pestana, setPestana] = useState(activos.length ? 'activos' : 'entregados');
  const lista = pestana === 'activos' ? activos : entregados;

  return (
    <>
      <CabezaCuenta icono={<Package />} titulo="Mis pedidos" subtitulo="Por dónde va cada uno, del pago a tu puerta." />
      <div className={s.pestanas}>
        <Pestanas
          etiqueta="Filtrar pedidos"
          valor={pestana}
          onChange={setPestana}
          opciones={[
            { id: 'activos', texto: 'En curso', cuenta: activos.length },
            { id: 'entregados', texto: 'Entregados', cuenta: entregados.length },
          ]}
        />
      </div>
      {lista.length ? (
        <div className={s.pedidos}>
          {lista.map((p) => <SeguimientoPedido key={p.codigo} {...p} />)}
        </div>
      ) : (
        <EstadoVacio
          imagen={pestana === 'activos' ? '/assets/kapi/kapi-happy.webp' : undefined}
          titulo={pestana === 'activos' ? 'No tienes pedidos en curso' : 'Aún no recibes pedidos'}
          texto={pestana === 'activos' ? 'Cuando compres algo, aquí verás por dónde va.' : 'Tus pedidos entregados aparecerán aquí.'}
        >
          {onIrATienda && <Boton icono={<ShoppingBag aria-hidden="true" />} onClick={onIrATienda}>Ir a la tienda</Boton>}
        </EstadoVacio>
      )}
    </>
  );
}

/* ── Zona Arcade (/minijuegos) ─────────────────────────── */

/**
 * Zona Arcade: el encabezado con el estado del día y las tarjetas de los
 * juegos. Va dentro de MarcoTienda, como el carrito.
 *  - juegos: props de TarjetaJuego (juegosDelArcade los arma desde el perfil)
 *  - listos: cuántos juegos quedan hoy
 *  - sesion, cargando: sin sesión, una invitación a entrar; cargando, "Cargando
 *    tu progreso…" (no se anuncia nada hasta saberlo)
 *  - titulo, subtitulo, urlLogin
 */
export function PaginaMinijuegos({
  juegos = [], listos = 0, sesion = false, cargando = false, urlLogin = '/login',
  titulo = 'Zona Arcade', subtitulo = 'Cuatro juegos, una rutina diaria y premios que sí se canjean en tus compras.',
}) {
  // Cuántos juegos quedan: dato de la página, en texto (no en etiqueta).
  let estado;
  if (cargando) {
    estado = <p className={s.arcadeListos} role="status"><Sparkles aria-hidden="true" />Cargando tu progreso…</p>;
  } else if (sesion) {
    estado = (
      <p className={s.arcadeListos} role="status">
        <Sparkles aria-hidden="true" />
        {listos === 0 ? 'Ya hiciste todo por hoy. Vuelve mañana.' : <span><strong>{listos}</strong> {listos === 1 ? 'juego listo para hoy' : 'juegos listos para hoy'}</span>}
      </p>
    );
  } else {
    estado = (
      <div className={s.arcadeEntrar}>
        <Aviso titulo="Entra con tu cuenta" accion={<Boton to={urlLogin} icono={<LogIn aria-hidden="true" />}>Iniciar sesión</Boton>}>
          Para reclamar monedas, guardar tu racha y girar la ruleta.
        </Aviso>
      </div>
    );
  }
  return (
    <>
      <BloqueSeccion ajustes={{ paddingTop: '1.75rem', paddingBottom: '0.5rem' }}>
        <Encabezado ajustes={{ title: titulo, subtitle: subtitulo }}>{estado}</Encabezado>
      </BloqueSeccion>
      <BloqueSeccion ajustes={{ paddingTop: '1rem', paddingBottom: '2.5rem' }}>
        <ul className={s.juegos}>
          {juegos.map((j) => <li key={j.id || j.titulo}><TarjetaJuego {...j} /></li>)}
        </ul>
      </BloqueSeccion>
    </>
  );
}

/* ── Búsqueda (/buscar) ─────────────────────────────────── */

/**
 * Página de resultados: el término, un buscador grande con su botón y los
 * resultados en el MISMO catálogo con filtros de /tienda (con "Ordenar por" y
 * el grupo Modalidad). Sin resultados y sin filtros, Kapi lo dice; con
 * filtros, el catálogo sigue a la vista para poder quitarlos.
 *
 *  - termino, onBuscar(texto)
 *  - productos: resultados ya ordenados (ordenarProductos) · cargando · hayMas,
 *    onCargarMas, cargandoMas (cursor de searchProductsFirestore)
 *  - grupos: grupos de filtros (grupoModalidad + gruposDeCatalogo de los
 *    resultados) · seleccion / onFiltrar (filtran aquí, sobre los resultados)
 *  - orden, onOrden · ordenes (ORDENES_BUSQUEDA)
 *  - marcaFiltro: { nombre, urlTodo } si la búsqueda está acotada a una marca
 *  - ideas: términos para empezar ("Lo más buscado", sin término) y para
 *    probar cuando no hay resultados
 *  - catalogo, onAgregar: para las tarjetas
 *  - textos: { titulo, subtitulo, marcador, boton, vacioTitulo, vacioTexto,
 *    vacioConFiltros } (los edita el admin en storeConfig/homePage.searchPage).
 *    Sin `titulo` del admin, el encabezado pregunta "¿Qué se te antoja hoy?".
 */
export function PaginaBusqueda({
  termino = '', onBuscar, productos = [], cargando = false, hayMas, onCargarMas, cargandoMas,
  grupos = [], seleccion, onFiltrar, orden = 'newest', onOrden, ordenes = [], marcaFiltro, catalogo, onAgregar, textos = {},
  ideas = [],
}) {
  // En pantallas angostas la frase con ejemplos se cortaba ("…(pol"): ahí
  // va la pregunta corta, como el buscador de la tienda en el celular.
  const angosta = useAngosta(560);
  const t = {
    titulo: 'Buscar productos',
    subtitulo: 'Escribe qué buscas y afina con los filtros.',
    marcador: angosta ? '¿Qué buscas?' : '¿Qué buscas? (polo, taza, gorro…)',
    boton: 'Buscar',
    vacioTitulo: 'Sin resultados',
    vacioTexto: 'Prueba con otra palabra: una más corta o más general suele encontrar más.',
    vacioConFiltros: 'Prueba a quitar algún filtro o a buscar otra palabra.',
    ...textos,
  };
  const hayFiltros = Object.values(seleccion || {}).some((v) => v != null);
  // Con término: las categorías de los resultados como atajos para afinar (el
  // mismo filtro de la columna). Sin término: lo más buscado.
  const categorias = grupos.find((g) => g.id === 'categoria');
  const conResultados = (categorias?.opciones || []).filter((o) => o.cuenta == null || o.cuenta > 0);
  const afinar = termino && productos.length > 0 && conResultados.length > 1
    ? conResultados.slice(0, 6).map((o) => ({
      id: o.valor,
      texto: o.nombre,
      cuenta: o.cuenta,
      imagen: catalogo?.categorias?.find((c) => (c.categoryId || c.id) === o.valor)?.imageUrl,
      activo: seleccion?.categoria === o.valor,
      onClick: () => onFiltrar?.('categoria', seleccion?.categoria === o.valor ? null : o.valor),
    }))
    : [];
  const sugeridas = ideas.map((idea) => ({ texto: idea, onClick: () => onBuscar?.(idea) }));
  return (
    <>
      <BloqueSeccion ajustes={{ paddingTop: '1.5rem', paddingBottom: '0.75rem' }}>
        {/* El "mostrador" de la búsqueda: lo buscado en grande con la voz de
            Walá, el buscador y los atajos, en una tarjeta propia. */}
        <div className={s.busquedaCabeza}>
          <Destello className={s.busquedaDestello1} />
          <Destello className={s.busquedaDestello2} />
          <div className={s.busquedaTitulo}>
            <InvitacionBusqueda grande como="h1" termino={termino} titulo={textos.titulo} texto={t.subtitulo} />
          </div>
          {marcaFiltro && (
            <Aviso compacto icono={<Store aria-hidden="true" />} accion={marcaFiltro.urlTodo && <Boton to={marcaFiltro.urlTodo} variante="fantasma" tamano="sm">Buscar en todo el catálogo</Boton>}>
              Buscando solo en <strong>{marcaFiltro.nombre}</strong>
            </Aviso>
          )}
          <Buscador
            key={termino}
            grande
            atajo={null}
            boton={t.boton}
            placeholder={t.marcador}
            defaultValue={termino}
            onBuscar={onBuscar}
          />
          {afinar.length > 0 && (
            <div className={s.busquedaAtajos}>
              <span className={s.busquedaAtajosTitulo}>Afina por categoría</span>
              <ChipsBusqueda tipo="afinar" items={afinar} />
            </div>
          )}
          {!termino && sugeridas.length > 0 && (
            <div className={s.busquedaAtajos}>
              <span className={s.busquedaAtajosTitulo}>Lo más buscado</span>
              <ChipsBusqueda tipo="idea" items={sugeridas} />
            </div>
          )}
        </div>
      </BloqueSeccion>
      <BloqueSeccion ajustes={{ paddingTop: '0.75rem', paddingBottom: '2.5rem' }}>
        {!cargando && productos.length === 0 && !hayFiltros ? (
          <EstadoVacio imagen="/assets/kapi/kapi-sad.webp" titulo={t.vacioTitulo} texto={termino ? t.vacioTexto : t.subtitulo}>
            {sugeridas.length > 0 && (
              <div className={s.busquedaProbar}>
                <span className={s.busquedaAtajosTitulo}>Prueba con</span>
                <ChipsBusqueda tipo="idea" items={sugeridas} />
              </div>
            )}
          </EstadoVacio>
        ) : (
          <CatalogoConFiltros
            key={termino}
            productos={productos}
            grupos={grupos}
            seleccion={seleccion}
            onFiltrar={onFiltrar}
            filtrarAqui
            conBuscador={false}
            unidad={['resultado', 'resultados']}
            orden={{ opciones: ordenes, valor: orden, onCambiar: onOrden }}
            cargando={cargando}
            hayMas={hayMas}
            onCargarMas={onCargarMas}
            cargandoMas={cargandoMas}
            catalogo={catalogo}
            onAgregar={onAgregar}
            vacio={{ titulo: t.vacioTitulo, texto: t.vacioConFiltros }}
          />
        )}
      </BloqueSeccion>
    </>
  );
}

/** ¿La ventana mide `px` o menos? Se actualiza al girar o redimensionar. */
function useAngosta(px) {
  const consulta = `(max-width: ${px}px)`;
  const [angosta, setAngosta] = useState(() => typeof window !== 'undefined' && window.matchMedia(consulta).matches);
  useEffect(() => {
    const mq = window.matchMedia(consulta);
    const cambio = () => setAngosta(mq.matches);
    mq.addEventListener('change', cambio);
    return () => mq.removeEventListener('change', cambio);
  }, [consulta]);
  return angosta;
}
