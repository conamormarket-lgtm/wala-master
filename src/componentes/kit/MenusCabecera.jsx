import React from 'react';
import { ArrowRight, Loader2, LogOut, RefreshCw, ShoppingBag, Heart, Sparkles } from 'lucide-react';
import { Enlace } from './Enlace';
import { soles } from './TarjetaProducto';
import s from './MenusCabecera.module.css';

/*
 * Contenido de los menús de la cabecera. Son piezas "tontas": reciben los
 * datos por props y avisan con onNavegar cuando el usuario elige algo (para
 * cerrar el menú). Funcionan igual dentro de un Desplegable (escritorio) que
 * dentro de una hoja inferior (celular / app).
 */

const MONEDA = '/assets/monedas/moneda-64.webp';

/* ── Tienda: categorías + marcas ────────────────────────── */

/**
 * Menú grande de "Tienda".
 *  - categorias: [{ id, nombre, url }]
 *  - marcas: [{ id, nombre, url }]  (se muestran 5 y "+N marcas")
 *  - activa: id de la categoría actual (se resalta)
 *  - cargando / error / onReintentar: estados mientras llegan de Firestore
 *  - destacado: { titulo, texto, url, imagen } tarjeta opcional a la derecha
 */
export function MenuTienda({
  categorias = [],
  marcas = [],
  activa,
  cargando = false,
  error = false,
  onReintentar,
  verTodo = { texto: 'Ver todo el catálogo', url: '/tienda' },
  urlMarcas = '/marcas',
  destacado,
  onNavegar,
}) {
  const visibles = marcas.slice(0, 5);
  const restantes = marcas.length - visibles.length;
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

      {marcas.length > 0 && (
        <section className={s.columnaMarcas}>
          <h4 className={s.titulo}>Universo Walá</h4>
          <ul className={s.listaMarcas}>
            {visibles.map((m) => (
              <li key={m.id}>
                <Enlace to={m.url} className={s.enlace} onClick={onNavegar}>{m.nombre}</Enlace>
              </li>
            ))}
          </ul>
          {restantes > 0 && (
            <Enlace to={urlMarcas} className={s.verTodo} onClick={onNavegar}>
              +{restantes} marcas más <ArrowRight aria-hidden="true" />
            </Enlace>
          )}
        </section>
      )}

      {destacado && (
        <Enlace to={destacado.url} className={s.destacado} onClick={onNavegar}>
          <span className={s.destacadoImg}><img src={destacado.imagen} alt="" loading="lazy" /></span>
          <strong>{destacado.titulo}</strong>
          <span>{destacado.texto}</span>
        </Enlace>
      )}
    </div>
  );
}

/* ── Monedas ────────────────────────────────────────────── */

/** Ayuda corta de las monedas (lo que hoy dice el tooltip del header). */
export function AyudaMonedas({ saldo, equivalencia = '1 moneda = S/1 de descuento', vencen = 'Vencen a fin de mes', url = '/cuenta/catalogo', onNavegar }) {
  return (
    <div className={s.monedas}>
      <div className={s.monedasCabeza}>
        <img src={MONEDA} alt="" width="28" height="28" />
        <div>
          <strong>Tus monedas</strong>
          {saldo != null && <span>{saldo.toLocaleString('es-PE')} disponibles</span>}
        </div>
      </div>
      <p>{equivalencia}</p>
      <p className={s.meta}>{vencen}</p>
      {url && (
        <Enlace to={url} className={s.verTodo} onClick={onNavegar}>
          Canjear monedas <ArrowRight aria-hidden="true" />
        </Enlace>
      )}
    </div>
  );
}

/* ── Cuenta ─────────────────────────────────────────────── */

const iniciales = (nombre) => String(nombre || '?').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

/**
 * Menú de cuenta.
 *  - usuario: { nombre, email, avatar } o null (sin sesión)
 *  - grupos: [{ titulo, items: [{ to, texto, Icono }] }]
 *  - promo: { texto, url } enlace destacado opcional (p. ej. la encuesta)
 */
export function MenuCuenta({ usuario, grupos = [], promo, onCerrarSesion, onNavegar, urlLogin = '/login', urlRegistro = '/registro' }) {
  if (!usuario) {
    return (
      <div className={s.cuentaInvitado}>
        <h3>Tu cuenta Walá</h3>
        <p>Inicia sesión para ver tus pedidos, monedas y diseños guardados.</p>
        <div className={s.botones}>
          <Enlace to={urlLogin} className={s.botonPrimario} onClick={onNavegar}>Iniciar sesión</Enlace>
          <Enlace to={urlRegistro} className={s.botonSecundario} onClick={onNavegar}>Crear cuenta</Enlace>
        </div>
      </div>
    );
  }
  return (
    <div className={s.cuenta}>
      <div className={s.identidad}>
        {usuario.avatar ? (
          <img src={usuario.avatar} alt="" className={s.avatar} referrerPolicy="no-referrer" />
        ) : (
          <span className={s.avatar} aria-hidden="true">{iniciales(usuario.nombre)}</span>
        )}
        <div className={s.identidadTexto}>
          <strong>Hola, {usuario.nombre}</strong>
          <span>{usuario.email}</span>
        </div>
      </div>
      {promo && (
        <Enlace to={promo.url} className={s.promo} onClick={onNavegar}>
          <Sparkles aria-hidden="true" /> {promo.texto}
        </Enlace>
      )}
      <nav aria-label="Accesos de cuenta">
        {grupos.map((g) => (
          <div key={g.titulo} className={s.grupo}>
            <p className={s.titulo}>{g.titulo}</p>
            {g.items.map(({ to, texto, Icono }) => (
              <Enlace key={to} to={to} className={s.item} onClick={onNavegar}>
                {Icono && <Icono aria-hidden="true" />}
                <span>{texto}</span>
              </Enlace>
            ))}
          </div>
        ))}
      </nav>
      <div className={s.cuentaPie}>
        <Enlace to="/cuenta" className={s.verTodo} onClick={onNavegar}>Ver toda mi cuenta <ArrowRight aria-hidden="true" /></Enlace>
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
          <Enlace to="/login" className={s.botonPrimario} onClick={onNavegar}>Iniciar sesión</Enlace>
          <Enlace to="/tienda" className={s.botonSecundario} onClick={onNavegar}>Explorar tienda</Enlace>
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
        <Enlace to="/tienda" className={s.botonPrimario} onClick={onNavegar}>Mira lo que te puede interesar</Enlace>
      </div>
    );
  }
  const visibles = items.slice(0, 6);
  return (
    <div className={s.vista}>
      <div className={s.vistaCabeza}>
        <h3>Tu lista de deseos</h3>
        <span>{items.length} {items.length === 1 ? 'producto' : 'productos'}</span>
      </div>
      <ul className={s.mosaico}>
        {visibles.map((it, i) => (
          <li key={it.id}>
            <Enlace to={urlLista} title={it.nombre} onClick={onNavegar}>
              <img src={it.imagen} alt={it.nombre} loading="lazy" />
              {i === visibles.length - 1 && items.length > visibles.length && (
                <span className={s.mas}>+{items.length - visibles.length}</span>
              )}
            </Enlace>
          </li>
        ))}
      </ul>
      <Enlace to={urlLista} className={s.botonPrimario} onClick={onNavegar}>Ver mi lista</Enlace>
    </div>
  );
}

/* ── Carrito ────────────────────────────────────────────── */

/**
 * Vista previa del carrito: los 3 primeros, "+N más", total y botones.
 *  - items: [{ id, nombre, imagen, precio, cantidad, variante }]
 */
export function VistaCarrito({ items = [], urlCarrito = '/carrito', urlPagar = '/checkout', onNavegar }) {
  if (!items.length) {
    return (
      <div className={s.vacio}>
        <ShoppingBag aria-hidden="true" />
        <h3>Tu carrito está vacío</h3>
        <p>Explora la tienda y agrega lo que te guste.</p>
        <Enlace to="/tienda" className={s.botonPrimario} onClick={onNavegar}>Explorar tienda</Enlace>
      </div>
    );
  }
  const visibles = items.slice(0, 3);
  const restantes = items.length - visibles.length;
  const total = items.reduce((a, it) => a + it.precio * it.cantidad, 0);
  const unidades = items.reduce((a, it) => a + it.cantidad, 0);
  return (
    <div className={s.vista}>
      <div className={s.vistaCabeza}>
        <h3>Mi carrito</h3>
        <span>{unidades} {unidades === 1 ? 'producto' : 'productos'}</span>
      </div>
      <ul className={s.listaCarrito}>
        {visibles.map((it) => (
          <li key={it.id}>
            <span className={s.miniatura}><img src={it.imagen} alt="" loading="lazy" /></span>
            <span className={s.lineaTexto}>
              <strong>{it.nombre}</strong>
              {it.variante && <small>{it.variante}</small>}
            </span>
            <span className={s.lineaPrecio}>{it.cantidad} × {soles(it.precio)}</span>
          </li>
        ))}
      </ul>
      {restantes > 0 && <p className={s.masItems}>+{restantes} {restantes === 1 ? 'artículo' : 'artículos'} más</p>}
      <div className={s.total}>
        <span>Total</span>
        <strong>{soles(total)}</strong>
      </div>
      <div className={s.botones}>
        <Enlace to={urlCarrito} className={s.botonSecundario} onClick={onNavegar}>Ver carrito</Enlace>
        <Enlace to={urlPagar} className={s.botonPrimario} onClick={onNavegar}>Pagar</Enlace>
      </div>
    </div>
  );
}
