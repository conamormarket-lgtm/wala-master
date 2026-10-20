import React, { useState } from 'react';
import { ArrowRight, Check, ChevronDown, Loader2, LogOut, RefreshCw, ShoppingBag, Heart, Sparkles, Coins, CalendarClock, Trophy } from 'lucide-react';
import { Enlace } from './Enlace';
import { Texto, useTexto } from './Traduccion';
import { TextoResaltado } from './piezas/TextoResaltado';
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
 *  - categorias: [{ id, nombre, url }] (los nombres pasan por la traducción)
 *  - activa: id de la categoría actual (se resalta)
 *  - cargando / error / onReintentar: estados mientras llegan de Firestore
 *  - destacado: { titulo, texto, url, imagen } tarjeta opcional a la derecha
 *  - titulo: el de arriba ("Categorías"); verTodo: { texto, url } o null
 * También sirve para un menú de enlaces cualquiera (los desplegables que arma
 * el admin): `categorias` son entonces sus enlaces.
 */
export function MenuTienda({
  categorias = [],
  activa,
  cargando = false,
  error = false,
  onReintentar,
  titulo = 'Categorías',
  verTodo = { texto: 'Ver todo el catálogo', url: '/tienda' },
  destacado,
  onNavegar,
}) {
  return (
    <div className={[s.tienda, destacado && s.tiendaConDestacado].filter(Boolean).join(' ')}>
      <section>
        <h4 className={s.titulo}><Texto>{titulo}</Texto></h4>
        {cargando || error ? (
          <p className={s.estado} role="status">
            {error ? (
              <button type="button" className={s.reintentar} onClick={onReintentar}>
                <RefreshCw aria-hidden="true" /> <Texto>Reintentar cargar categorías</Texto>
              </button>
            ) : (
              <><Loader2 className={s.girando} aria-hidden="true" /> <Texto>Cargando categorías…</Texto></>
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
                  <Texto>{c.nombre}</Texto>
                </Enlace>
              </li>
            ))}
          </ul>
        )}
        {verTodo?.url && (
          <Enlace to={verTodo.url} className={s.verTodo} onClick={onNavegar}>
            <Texto>{verTodo.texto}</Texto> <ArrowRight aria-hidden="true" />
          </Enlace>
        )}
      </section>

      {destacado && (
        <Enlace to={destacado.url} className={s.destacado} onClick={onNavegar}>
          <FotoProducto className={s.destacadoImg} src={destacado.imagen} />
          <strong><Texto>{destacado.titulo}</Texto></strong>
          <span><Texto>{destacado.texto}</Texto></span>
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
      <h4 className={s.titulo}><Texto>Universo Walá</Texto></h4>
      <ul className={s.listaLogos}>{primeras.map(fila)}</ul>
      {larga && todas && (
        <div className={s.masMarcas}>
          <h5 className={s.masMarcasTitulo}><Texto>Más marcas</Texto></h5>
          <ul className={s.listaLogos}>{resto.map(fila)}</ul>
        </div>
      )}
      {larga && (
        <button type="button" className={[s.verMasMarcas, todas && s.verMenosMarcas].filter(Boolean).join(' ')} aria-expanded={todas} onClick={() => setTodas((v) => !v)}>
          <Texto>{todas ? 'Ver menos' : `Ver ${resto.length} ${resto.length === 1 ? 'marca' : 'marcas'} más`}</Texto>
          <ChevronDown aria-hidden="true" />
        </button>
      )}
      {verTodas?.url && (
        <Enlace to={verTodas.url} className={s.verTodo} onClick={onNavegar}>
          <Texto>{verTodas.texto}</Texto> <ArrowRight aria-hidden="true" />
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
  const conSaldo = typeof saldo === 'number';
  return (
    <div className={s.monedas}>
      <div className={s.monedasSaldo}>
        <Moneda tamano={40} />
        <div>
          <span className={s.monedasEtiqueta}><Texto>Tus monedas</Texto></span>
          <strong>{conSaldo ? saldo.toLocaleString('es-PE') : '–'}</strong>
          {conSaldo && <span className={s.monedasValor}><Texto>{`= ${soles(saldo * valorMoneda)} en descuentos`}</Texto></span>}
        </div>
      </div>
      <ul className={s.monedasDatos}>
        <li><Coins aria-hidden="true" /><span><TextoResaltado resaltar={[`1 moneda = ${soles(valorMoneda)}`, soles(valorMoneda)]}>{`1 moneda = ${soles(valorMoneda)} de descuento en tus compras`}</TextoResaltado></span></li>
        <li><CalendarClock aria-hidden="true" /><span><TextoResaltado resaltar={[finDeMes()]}>{`Vencen a fin de mes, el ${finDeMes()}`}</TextoResaltado></span></li>
        <li><Trophy aria-hidden="true" /><span><Texto>Gana más con misiones, sorteos y referidos</Texto></span></li>
      </ul>
      <div className={s.monedasAcciones}>
        <Boton to={urlCanjear} variante="primario" bloque onClick={onNavegar}><Texto>Canjear</Texto></Boton>
        <Boton to={urlGanar} variante="contorno" bloque onClick={onNavegar}><Texto>Ganar más</Texto></Boton>
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
 *  - textos (sin sesión): { titulo, descripcion, login, registro, urlLogin,
 *    urlRegistro }; los edita el admin (storeConfig accountPopup). Se traducen.
 *  - estadoLogin: el state del router para "Iniciar sesión" (p. ej. { from })
 *  - idiomas: { opciones: [{ codigo, nombre }], actual, onCambiar } → elegir
 *    el idioma (la tienda lo pasa sin sesión: con sesión está en Ajustes)
 * Los grupos llegan ya traducidos (la tienda usa su diccionario).
 */
export function MenuCuenta({ usuario, grupos = [], promo, onCerrarSesion, onNavegar, urlLogin = '/login', urlRegistro = '/registro', lateral = false, activo, textos = {}, estadoLogin, idiomas }) {
  const esActual = (to) => Boolean(activo) && (activo === to || activo.startsWith(`${to}/`));
  const etiquetaAccesos = useTexto('Accesos de cuenta');
  if (!usuario) {
    return (
      <div className={s.cuentaInvitado}>
        <h3><Texto>{textos.titulo || 'Tu cuenta Walá'}</Texto></h3>
        <p><Texto>{textos.descripcion || 'Inicia sesión para ver tus pedidos, monedas y diseños guardados.'}</Texto></p>
        <div className={s.botones}>
          <Boton to={textos.urlLogin || urlLogin} state={estadoLogin} variante="primario" bloque onClick={onNavegar}><Texto>{textos.login || 'Iniciar sesión'}</Texto></Boton>
          <Boton to={textos.urlRegistro || urlRegistro} variante="contorno" bloque onClick={onNavegar}><Texto>{textos.registro || 'Crear cuenta'}</Texto></Boton>
        </div>
        {idiomas?.opciones?.length > 1 && <ElegirIdioma {...idiomas} />}
      </div>
    );
  }
  return (
    <div className={[s.cuenta, lateral && s.lateral].filter(Boolean).join(' ')}>
      <div className={s.identidad}>
        <Avatar className={s.avatar} nombre={usuario.nombre} imagen={usuario.avatar} />
        <div className={s.identidadTexto}>
          <strong>{lateral ? usuario.nombre : <><Texto>Hola,</Texto> {usuario.nombre}</>}</strong>
          <span>{usuario.email}</span>
        </div>
      </div>
      {promo && (
        <Enlace to={promo.url} className={s.promo} onClick={onNavegar}>
          {promo.titulo ? (
            <>
              <IconoWala nombre={promo.icono || 'regalo'} tamano={34} />
              <span className={s.promoTexto}>
                <strong><Texto>{promo.titulo}</Texto></strong>
                {promo.texto && <span><Texto>{promo.texto}</Texto></span>}
              </span>
              {promo.monedas ? <span className={s.promoMonedas}>+{promo.monedas}</span> : null}
            </>
          ) : (
            <><Sparkles aria-hidden="true" /> <Texto>{promo.texto}</Texto></>
          )}
        </Enlace>
      )}
      <nav aria-label={etiquetaAccesos}>
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
                  {/* data-texto: el ancho en negrita queda reservado (ver .itemTexto). */}
                  <span className={s.itemTexto} data-texto={typeof texto === 'string' ? texto : undefined}>{texto}</span>
                </Enlace>
              );
            })}
          </div>
        ))}
      </nav>
      {idiomas?.opciones?.length > 1 && <ElegirIdioma {...idiomas} />}
      <div className={s.cuentaPie}>
        {!lateral && <Enlace to="/cuenta" className={s.verTodo} onClick={onNavegar}><Texto>Ver toda mi cuenta</Texto> <ArrowRight aria-hidden="true" /></Enlace>}
        <button type="button" className={s.salir} onClick={() => { onCerrarSesion?.(); onNavegar?.(); }}>
          <LogOut aria-hidden="true" /> <Texto>Cerrar sesión</Texto>
        </button>
      </div>
    </div>
  );
}

/** Idioma de la tienda: un botón por idioma, el actual marcado. */
function ElegirIdioma({ opciones, actual, onCambiar }) {
  const etiqueta = useTexto('Idioma');
  return (
    <div className={s.idiomas} role="group" aria-label={etiqueta}>
      <p className={s.titulo}>{etiqueta}</p>
      <div className={s.idiomasLista}>
        {opciones.map((o) => (
          <button
            key={o.codigo}
            type="button"
            lang={o.codigo}
            aria-pressed={actual === o.codigo}
            className={[s.idioma, actual === o.codigo && s.idiomaActual].filter(Boolean).join(' ')}
            onClick={() => onCambiar?.(o.codigo)}
          >
            <span className={s.idiomaCodigo} aria-hidden="true">{o.codigo.slice(0, 2).toUpperCase()}</span>
            <span>{o.nombre}</span>
            {actual === o.codigo && <Check className={s.idiomaCheck} aria-hidden="true" />}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Favoritos ──────────────────────────────────────────── */

/**
 * Vista previa de favoritos.
 *  - items: [{ id, nombre, imagen }]; sesion: boolean
 *  - textos: los que edita el admin (storeConfig favoritesPopup):
 *    { tituloInvitado, textoInvitado, tituloVacio, textoVacio, boton, urlBoton }
 *  - estadoLogin: el state del router para "Iniciar sesión" (p. ej. { from })
 */
export function VistaFavoritos({ items = [], sesion = true, urlLista = '/cuenta/wishlist', onNavegar, textos = {}, estadoLogin }) {
  // El "+N" del abanico (cabe hasta 4 fotos).
  const verMas = useTexto(items.length > 4 ? `Ver ${items.length - 4} más` : undefined);
  if (!sesion) {
    return (
      <div className={s.vacio}>
        <Heart aria-hidden="true" />
        <h3><Texto>{textos.tituloInvitado || 'Tus favoritos'}</Texto></h3>
        <p><Texto>{textos.textoInvitado || 'Inicia sesión para guardar lo que te gusta y verlo desde cualquier lado.'}</Texto></p>
        <div className={s.botones}>
          <Boton to="/login" state={estadoLogin} variante="primario" bloque onClick={onNavegar}><Texto>Iniciar sesión</Texto></Boton>
          <Boton to="/tienda" variante="contorno" bloque onClick={onNavegar}><Texto>Explorar tienda</Texto></Boton>
        </div>
      </div>
    );
  }
  if (!items.length) {
    return (
      <div className={s.vacio}>
        <Heart aria-hidden="true" />
        <h3><Texto>{textos.tituloVacio || 'Aún no tienes favoritos'}</Texto></h3>
        <p><Texto>{textos.textoVacio || 'Toca el corazón de un producto y lo guardamos aquí.'}</Texto></p>
        <Boton to={textos.urlBoton || '/tienda'} variante="primario" bloque onClick={onNavegar}><Texto>{textos.boton || 'Mira lo que te puede interesar'}</Texto></Boton>
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
        <h3><Texto>Tu lista de deseos</Texto></h3>
        <span><Texto>{items.length === 1 ? '1 producto' : `${items.length} productos`}</Texto></span>
      </div>
      <p className={s.vistaTexto}>
        <Texto>{items.length === 1 ? 'Tienes 1 producto guardado en tu lista.' : `Tienes ${items.length} productos guardados en tu lista.`}</Texto>
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
            <Enlace to={urlLista} className={`${s.naipe} ${s.naipeMas}`} onClick={onNavegar} aria-label={verMas}>
              +{items.length - visibles.length}
            </Enlace>
          </li>
        )}
      </ul>
      <Boton to={urlLista} variante="primario" bloque onClick={onNavegar}><Texto>Ver mi lista</Texto></Boton>
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
 *  - urlPagar: adónde va "Pagar"; null = un solo botón, "Ir a pagar", que
 *    lleva al carrito (así la tienda: ahí se eligen los productos a pagar)
 */
/** "×2" sobre la foto ("2 unidades" para lectores de pantalla). */
function CantidadMini({ cantidad }) {
  return <span className={s.cantidadMini} aria-label={useTexto(`${cantidad} unidades`)}>×{cantidad}</span>;
}

export function VistaCarrito({ items = [], urlCarrito = '/carrito', urlPagar = '/checkout', metaEnvio, onNavegar }) {
  const totalReal = items.reduce((a, it) => a + it.precio * it.cantidad, 0);
  const total = useContador(totalReal, 0.45);
  if (!items.length) {
    return (
      <div className={s.vacio}>
        <ShoppingBag aria-hidden="true" />
        <h3><Texto>Tu carrito está vacío</Texto></h3>
        <p><Texto>Explora la tienda y agrega lo que te guste.</Texto></p>
        <Boton to="/tienda" variante="primario" bloque onClick={onNavegar}><Texto>Explorar tienda</Texto></Boton>
      </div>
    );
  }
  const visibles = items.slice(0, 3);
  const restantes = items.length - visibles.length;
  const unidades = items.reduce((a, it) => a + it.cantidad, 0);
  return (
    <div className={s.vista}>
      <div className={s.vistaCabeza}>
        <h3><Texto>Mi carrito</Texto></h3>
        <span><Texto>{unidades === 1 ? '1 producto' : `${unidades} productos`}</Texto></span>
      </div>
      <ul className={s.listaCarrito}>
        {visibles.map((it, i) => (
          <li key={it.id} style={{ '--i': i }}>
            <Enlace to={it.url || urlCarrito} className={s.lineaCarrito} onClick={onNavegar}>
              <span className={s.miniaturaCaja}>
                <FotoProducto className={s.miniatura} src={it.imagen} relleno="6%" />
                {it.cantidad > 1 && <CantidadMini cantidad={it.cantidad} />}
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
          <Texto>{`+${restantes} ${restantes === 1 ? 'artículo' : 'artículos'} más en tu carrito`}</Texto>
        </Enlace>
      )}
      {metaEnvio > 0 && <BarraEnvioGratis actual={totalReal} meta={metaEnvio} compacta estricto />}
      <div className={s.total}>
        <span><Texto>Total</Texto></span>
        <strong>{soles(total)}</strong>
      </div>
      <div className={s.botones}>
        {urlPagar ? (
          <>
            <Boton to={urlCarrito} variante="contorno" bloque onClick={onNavegar}><Texto>Ver carrito</Texto></Boton>
            <Boton to={urlPagar} variante="primario" bloque iconoFin={<ArrowRight aria-hidden="true" />} onClick={onNavegar}><Texto>Pagar</Texto></Boton>
          </>
        ) : (
          <Boton to={urlCarrito} variante="primario" bloque iconoFin={<ArrowRight aria-hidden="true" />} onClick={onNavegar}><Texto>Ir a pagar</Texto></Boton>
        )}
      </div>
    </div>
  );
}
