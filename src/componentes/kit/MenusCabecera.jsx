import React, { useState } from 'react';
import { ArrowRight, ChevronDown, Loader2, LogOut, RefreshCw, ShoppingBag, Heart, Sparkles, Coins, CalendarClock, Trophy } from 'lucide-react';
import { Enlace } from './Enlace';
import { Texto } from './Traduccion';
import Boton from './Boton';
import { soles } from './TarjetaProducto';
import { IconoWala } from './IconosWala';
import { Moneda } from './Etiquetas';
import { Sello } from './Marca';
import { useContador } from './Efectos';
import { BarraEnvioGratis } from './Pedido';
import { FotoProducto } from './piezas/FotoProducto';
import { LogoMarca } from './piezas/LogoMarca';
import { Avatar } from './piezas/Avatar';
import s from './MenusCabecera.module.css';

/*
 * Contenido de los menús de la cabecera. Son piezas "tontas": reciben los
 * datos por props y avisan con onNavegar cuando el usuario elige algo (para
 * cerrar el menú). Funcionan igual dentro de un Desplegable (escritorio) que
 * dentro de una hoja inferior (celular / app).
 */

/* ── Tienda: categorías ─────────────────────────────────── */

/**
 * Menú grande de "Tienda": solo categorías, como en la tienda real. Las
 * marcas tienen su propia pestaña con su menú (MenuMarcas); no se repiten aquí.
 *  - categorias: [{ id, nombre, url }]
 *  - activa: id de la categoría actual (se resalta)
 *  - cargando / error / onReintentar: estados mientras llegan de Firestore
 *  - destacado: { titulo, texto, url, imagen } tarjeta opcional a la derecha
 */
export function MenuTienda({
  categorias = [],
  activa,
  cargando = false,
  error = false,
  onReintentar,
  verTodo = { texto: 'Ver todo el catálogo', url: '/tienda' },
  destacado,
  onNavegar,
}) {
  return (
    <div className={[s.tienda, destacado && s.tiendaConDestacado].filter(Boolean).join(' ')}>
      <section>
        <h4 className={s.titulo}>Categorías</h4>
        {cargando || error ? (
          <p className={s.estado} role="status">
            {error ? (
              <button type="button" className={s.reintentar} onClick={onReintentar}>
                <RefreshCw aria-hidden="true" /> Reintentar cargar categorías
              </button>
            ) : (
              <><Loader2 className={s.girando} aria-hidden="true" /> Cargando categorías…</>
            )}
          </p>
        ) : (
          <ul className={s.listaCategorias}>
            {categorias.map((c) => (
              <li key={c.id}>
                <Enlace
                  to={c.url}
                  className={[s.enlace, activa === c.id && s.enlaceActivo].filter(Boolean).join(' ')}
                  aria-current={activa === c.id ? 'page' : undefined}
                  onClick={onNavegar}
                >
                  {c.nombre}
                </Enlace>
              </li>
            ))}
          </ul>
        )}
        <Enlace to={verTodo.url} className={s.verTodo} onClick={onNavegar}>
          {verTodo.texto} <ArrowRight aria-hidden="true" />
        </Enlace>
      </section>

      {destacado && (
        <Enlace to={destacado.url} className={s.destacado} onClick={onNavegar}>
          <FotoProducto className={s.destacadoImg} src={destacado.imagen} />
          <strong>{destacado.titulo}</strong>
          <span>{destacado.texto}</span>
        </Enlace>
      )}
    </div>
  );
}

/* ── Monedas ────────────────────────────────────────────── */

const finDeMes = () => {
  const hoy = new Date();
  const fin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
  return fin.toLocaleDateString('es-PE', { day: 'numeric', month: 'long' });
};

/**
 * Menú de "Marcas": cada marca con su logo, en dos columnas.
 *  - marcas: [{ id, nombre, url, logo }]
 *  - limite: cuántas se ven de entrada (0 = todas). Las demás se abren en el
 *    mismo menú con "Ver N marcas más" (en la tienda: 6)
 *  - activa: id de la marca de la página (resaltada; nunca queda escondida)
 *  - verTodas: { texto, url } enlace al final, solo si hay una página de
 *    marcas (hoy la tienda no tiene /marcas pública: no se pasa)
 */
export function MenuMarcas({ marcas = [], limite = 0, activa, verTodas, onNavegar }) {
  // Las que no entran se abren AQUÍ MISMO con "Ver N marcas más" (la tienda
  // usaba un panel al costado que solo salía al pasar el ratón: en el celular
  // y con teclado no se podía). La marca en la que estás nunca queda escondida.
  const larga = limite > 0 && marcas.length > limite + 1;
  const indiceActiva = marcas.findIndex((m) => m.id === activa);
  const [todas, setTodas] = useState(indiceActiva >= limite);
  const primeras = larga ? marcas.slice(0, limite) : marcas;
  const resto = larga ? marcas.slice(limite) : [];

  const fila = (m) => (
    <li key={m.id}>
      <Enlace
        to={m.url}
        className={[s.marcaFila, m.id === activa && s.marcaActiva].filter(Boolean).join(' ')}
        aria-current={m.id === activa ? 'page' : undefined}
        onClick={onNavegar}
      >
        <LogoMarca variante="sello" className={s.marcaLogo} nombre={m.nombre} imagen={m.logo} alt="" giro={-6} />
        <span className={s.marcaNombre}>{m.nombre}</span>
      </Enlace>
    </li>
  );

  return (
    <div className={s.marcas}>
      <h4 className={s.titulo}>Universo Walá</h4>
      <ul className={s.listaLogos}>{primeras.map(fila)}</ul>
      {larga && todas && (
        <div className={s.masMarcas}>
          <h5 className={s.masMarcasTitulo}>Más marcas</h5>
          <ul className={s.listaLogos}>{resto.map(fila)}</ul>
        </div>
      )}
      {larga && (
        <button type="button" className={[s.verMasMarcas, todas && s.verMenosMarcas].filter(Boolean).join(' ')} aria-expanded={todas} onClick={() => setTodas((v) => !v)}>
          {todas ? 'Ver menos' : `Ver ${resto.length} ${resto.length === 1 ? 'marca' : 'marcas'} más`}
          <ChevronDown aria-hidden="true" />
        </button>
      )}
      {verTodas?.url && (
        <Enlace to={verTodas.url} className={s.verTodo} onClick={onNavegar}>
          {verTodas.texto} <ArrowRight aria-hidden="true" />
        </Enlace>
      )}
    </div>
  );
}

/**
 * Explicación de las monedas (lo que hoy dice el tooltip del header):
 * saldo grande, cuánto vale, cuándo vencen y dónde canjearlas o ganar más.
 */
export function AyudaMonedas({
  saldo = 0,
  valorMoneda = 1,
  urlCanjear = '/cuenta/catalogo',
  urlGanar = '/cuenta/misiones',
  onNavegar,
}) {
  return (
    <div className={s.monedas}>
      <div className={s.monedasSaldo}>
        <Moneda tamano={40} />
        <div>
          <span className={s.monedasEtiqueta}>Tus monedas</span>
          <strong>{saldo.toLocaleString('es-PE')}</strong>
          <span className={s.monedasValor}>= {soles(saldo * valorMoneda)} en descuentos</span>
        </div>
      </div>
      <ul className={s.monedasDatos}>
        <li><Coins aria-hidden="true" /><span><strong>1 moneda = {soles(valorMoneda)}</strong> de descuento en tus compras</span></li>
        <li><CalendarClock aria-hidden="true" /><span>Vencen a fin de mes, el <strong>{finDeMes()}</strong></span></li>
        <li><Trophy aria-hidden="true" /><span>Gana más con misiones, sorteos y referidos</span></li>
      </ul>
      <div className={s.monedasAcciones}>
        <Boton to={urlCanjear} variante="primario" bloque onClick={onNavegar}>Canjear</Boton>
        <Boton to={urlGanar} variante="contorno" bloque onClick={onNavegar}>Ganar más</Boton>
      </div>
    </div>
  );
}

/* ── Cuenta ─────────────────────────────────────────────── */

/**
 * Menú de cuenta.
 *  - usuario: { nombre, email, avatar } o null (sin sesión)
 *  - grupos: [{ titulo, items: [{ to, texto, Icono }] }]
 *  - promo: { texto, url } enlace destacado opcional, o con título:
 *    { titulo, texto, url, monedas, icono } (p. ej. la encuesta: "Perfil de
 *    regalos · Gana 15 monedas")
 *  - lateral: el menú fijo al costado de las páginas de /cuenta (MarcoCuenta):
 *    tarjeta propia, el nombre sin "Hola", sin "Ver toda mi cuenta"
 *  - activo: ruta actual; su acceso se enciende con el sello del logo
 *    (también una subruta: /cuenta/pedidos/123 enciende Mis pedidos)
 */
export function MenuCuenta({ usuario, grupos = [], promo, onCerrarSesion, onNavegar, urlLogin = '/login', urlRegistro = '/registro', lateral = false, activo }) {
  const esActual = (to) => Boolean(activo) && (activo === to || activo.startsWith(`${to}/`));
  if (!usuario) {
    return (
      <div className={s.cuentaInvitado}>
        <h3>Tu cuenta Walá</h3>
        <p>Inicia sesión para ver tus pedidos, monedas y diseños guardados.</p>
        <div className={s.botones}>
          <Boton to={urlLogin} variante="primario" bloque onClick={onNavegar}>Iniciar sesión</Boton>
          <Boton to={urlRegistro} variante="contorno" bloque onClick={onNavegar}>Crear cuenta</Boton>
        </div>
      </div>
    );
  }
  return (
    <div className={[s.cuenta, lateral && s.lateral].filter(Boolean).join(' ')}>
      <div className={s.identidad}>
        <Avatar className={s.avatar} nombre={usuario.nombre} imagen={usuario.avatar} />
        <div className={s.identidadTexto}>
          <strong>{lateral ? usuario.nombre : `Hola, ${usuario.nombre}`}</strong>
          <span>{usuario.email}</span>
        </div>
      </div>
      {promo && (
        <Enlace to={promo.url} className={s.promo} onClick={onNavegar}>
          {promo.titulo ? (
            <>
              <IconoWala nombre={promo.icono || 'regalo'} tamano={34} />
              <span className={s.promoTexto}>
                <strong>{promo.titulo}</strong>
                {promo.texto && <span>{promo.texto}</span>}
              </span>
              {promo.monedas ? <span className={s.promoMonedas}>+{promo.monedas}</span> : null}
            </>
          ) : (
            <><Sparkles aria-hidden="true" /> {promo.texto}</>
          )}
        </Enlace>
      )}
      <nav aria-label="Accesos de cuenta">
        {grupos.map((g) => (
          <div key={g.titulo} className={s.grupo}>
            <p className={s.titulo}>{g.titulo}</p>
            {g.items.map(({ to, texto, Icono }) => {
              const actual = esActual(to);
              let icono = Icono && <Icono aria-hidden="true" />;
              if (lateral && Icono) {
                icono = actual
                  ? <Sello tamano={30} className={s.selloActual}>{icono}</Sello>
                  : <span className={s.itemHueco}>{icono}</span>;
              }
              return (
                <Enlace
                  key={to}
                  to={to}
                  className={[s.item, actual && s.itemActual].filter(Boolean).join(' ')}
                  aria-current={actual ? 'page' : undefined}
                  onClick={onNavegar}
                >
                  {icono}
                  <span>{texto}</span>
                </Enlace>
              );
            })}
          </div>
        ))}
      </nav>
      <div className={s.cuentaPie}>
        {!lateral && <Enlace to="/cuenta" className={s.verTodo} onClick={onNavegar}>Ver toda mi cuenta <ArrowRight aria-hidden="true" /></Enlace>}
        <button type="button" className={s.salir} onClick={() => { onCerrarSesion?.(); onNavegar?.(); }}>
          <LogOut aria-hidden="true" /> Cerrar sesión
        </button>
      </div>
    </div>
  );
}

/* ── Favoritos ──────────────────────────────────────────── */

/**
 * Vista previa de favoritos.
 *  - items: [{ id, nombre, imagen }]; sesion: boolean
 */
export function VistaFavoritos({ items = [], sesion = true, urlLista = '/cuenta/wishlist', onNavegar }) {
  if (!sesion) {
    return (
      <div className={s.vacio}>
        <Heart aria-hidden="true" />
        <h3>Tus favoritos</h3>
        <p>Inicia sesión para guardar lo que te gusta y verlo desde cualquier lado.</p>
        <div className={s.botones}>
          <Boton to="/login" variante="primario" bloque onClick={onNavegar}>Iniciar sesión</Boton>
          <Boton to="/tienda" variante="contorno" bloque onClick={onNavegar}>Explorar tienda</Boton>
        </div>
      </div>
    );
  }
  if (!items.length) {
    return (
      <div className={s.vacio}>
        <Heart aria-hidden="true" />
        <h3>Aún no tienes favoritos</h3>
        <p>Toca el corazón de un producto y lo guardamos aquí.</p>
        <Boton to="/tienda" variante="primario" bloque onClick={onNavegar}>Mira lo que te puede interesar</Boton>
      </div>
    );
  }
  // Abanico como en el header actual: hasta 4 fotos + "+N", giradas desde el
  // centro (sirve para 1, 2, 3… sin depender de nth-child fijos).
  const visibles = items.slice(0, 4);
  const hayMas = items.length > visibles.length;
  const total = visibles.length + (hayMas ? 1 : 0);
  const centro = (total - 1) / 2;
  const naipe = (i) => {
    const d = i - centro;
    return { '--giro': `${d * 9}deg`, '--alza': `${-Math.abs(d) * 5}px`, zIndex: total - Math.abs(d) };
  };
  return (
    <div className={s.vista}>
      <div className={s.vistaCabeza}>
        <h3>Tu lista de deseos</h3>
        <span>{items.length} {items.length === 1 ? 'producto' : 'productos'}</span>
      </div>
      <p className={s.vistaTexto}>
        {items.length === 1 ? 'Tienes 1 producto guardado en tu lista.' : `Tienes ${items.length} productos guardados en tu lista.`}
      </p>
      <ul className={s.abanico}>
        {visibles.map((it, i) => (
          <li key={it.id} style={naipe(i)}>
            <Enlace to={urlLista} title={it.nombre} className={s.naipe} onClick={onNavegar}>
              <FotoProducto className={s.naipeFoto} src={it.imagen} alt={it.nombre} relleno="4px" />
            </Enlace>
          </li>
        ))}
        {hayMas && (
          <li style={naipe(visibles.length)}>
            <Enlace to={urlLista} className={`${s.naipe} ${s.naipeMas}`} onClick={onNavegar} aria-label={`Ver ${items.length - visibles.length} más`}>
              +{items.length - visibles.length}
            </Enlace>
          </li>
        )}
      </ul>
      <Boton to={urlLista} variante="primario" bloque onClick={onNavegar}>Ver mi lista</Boton>
    </div>
  );
}

/* ── Carrito ────────────────────────────────────────────── */

/**
 * Vista previa del carrito: los 3 primeros (entran uno tras otro al abrir;
 * al pasar el ratón la foto se ladea y el nombre se pinta), "+N más", cuánto
 * falta para el envío gratis, el total que corre al cambiar y los botones.
 *  - items: [{ id, nombre, imagen, precio, cantidad, variante, url }]
 *    (sin `url`, la fila lleva al carrito)
 *  - metaEnvio: monto del envío gratis (sin él, no hay barra)
 */
export function VistaCarrito({ items = [], urlCarrito = '/carrito', urlPagar = '/checkout', metaEnvio, onNavegar }) {
  const totalReal = items.reduce((a, it) => a + it.precio * it.cantidad, 0);
  const total = useContador(totalReal, 0.45);
  if (!items.length) {
    return (
      <div className={s.vacio}>
        <ShoppingBag aria-hidden="true" />
        <h3>Tu carrito está vacío</h3>
        <p>Explora la tienda y agrega lo que te guste.</p>
        <Boton to="/tienda" variante="primario" bloque onClick={onNavegar}>Explorar tienda</Boton>
      </div>
    );
  }
  const visibles = items.slice(0, 3);
  const restantes = items.length - visibles.length;
  const unidades = items.reduce((a, it) => a + it.cantidad, 0);
  return (
    <div className={s.vista}>
      <div className={s.vistaCabeza}>
        <h3>Mi carrito</h3>
        <span>{unidades} {unidades === 1 ? 'producto' : 'productos'}</span>
      </div>
      <ul className={s.listaCarrito}>
        {visibles.map((it, i) => (
          <li key={it.id} style={{ '--i': i }}>
            <Enlace to={it.url || urlCarrito} className={s.lineaCarrito} onClick={onNavegar}>
              <span className={s.miniaturaCaja}>
                <FotoProducto className={s.miniatura} src={it.imagen} relleno="6%" />
                {it.cantidad > 1 && <span className={s.cantidadMini} aria-label={`${it.cantidad} unidades`}>×{it.cantidad}</span>}
              </span>
              <span className={s.lineaTexto}>
                <strong><Texto>{it.nombre}</Texto></strong>
                {it.variante && <small>{it.variante}</small>}
              </span>
              <span className={s.lineaPrecio}>
                <strong>{soles(it.precio * it.cantidad)}</strong>
                {it.cantidad > 1 && <small>{soles(it.precio)} c/u</small>}
              </span>
            </Enlace>
          </li>
        ))}
      </ul>
      {restantes > 0 && (
        <Enlace to={urlCarrito} className={s.masItems} onClick={onNavegar}>
          +{restantes} {restantes === 1 ? 'artículo' : 'artículos'} más en tu carrito
        </Enlace>
      )}
      {metaEnvio > 0 && <BarraEnvioGratis actual={totalReal} meta={metaEnvio} compacta estricto />}
      <div className={s.total}>
        <span>Total</span>
        <strong>{soles(total)}</strong>
      </div>
      <div className={s.botones}>
        <Boton to={urlCarrito} variante="contorno" bloque onClick={onNavegar}>Ver carrito</Boton>
        <Boton to={urlPagar} variante="primario" bloque iconoFin={<ArrowRight aria-hidden="true" />} onClick={onNavegar}>Pagar</Boton>
      </div>
    </div>
  );
}
