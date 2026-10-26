import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, Plus, RotateCcw, Heart, ShoppingCart, CalendarHeart, Share2, Gift, Trash2, Lightbulb } from 'lucide-react';
import Boton from '../Boton';
import { Aviso, EstadoVacio } from '../Feedback';
import TarjetaProducto from '../TarjetaProducto';
import Carrusel from '../Carrusel';
import { CabezaCuenta } from '../piezas/Cuenta';
import { TarjetaCreacion, VersionesAnteriores } from '../piezas/Creaciones';
import { TarjetaPersonaRegalo, AvisoFestiva, AgendaFechas, faltanDias } from '../piezas/Regalos';
import { HojaPersona, RELACIONES } from '../piezas/FormularioPersona';
import { EsqueletoProducto, EsqueletoFila, EsqueletoTarjeta, EsqueletoCreacion } from '../Esqueletos';
import { Texto } from '../Traduccion';
import s from './CuentaPersonalizacion.module.css';

/*
 * Páginas del grupo Personalización de la cuenta: Mis creaciones, Lista de
 * deseos y Fechas importantes. Van dentro de MarcoCuenta.
 */

/** Esqueletos con la forma de lo que viene: 'producto', 'fila' o una tarjeta de ese alto. */
function Esqueletos({ n = 3, alto = 300, forma = 'tarjeta' }) {
  return Array.from({ length: n }, (_, k) => (
    <li key={k}>
      {forma === 'producto' ? <EsqueletoProducto /> : forma === 'fila' ? <EsqueletoFila /> : <EsqueletoTarjeta lineas={3} alto={alto} />}
    </li>
  ));
}

/* ── Mis creaciones (/cuenta/creaciones) ────────────────── */

/**
 * Mis creaciones: los diseños guardados (comprar o seguir editando), las
 * versiones anteriores de los combos y, si hay, los borradores en un carrusel.
 *  - creaciones: props de TarjetaCreacion con `id` (creacionDesdeDiseno)
 *  - borradores: ídem (los combos sin terminar también se renombran)
 *  - cargando · error · onReintentar (los borradores se ven igual)
 *  - onEliminar(id), onRenombrar(id, nombre): promesas · urlCrear
 *  - comunidadPara(creacion): la prop `comunidad` de cada tarjeta (publicar,
 *    actualizar, retirar; solo para quien puede publicar) o nada
 *  - versiones, diasVersion, onRecuperarVersion(id), onEliminarVersion(id):
 *    las de VersionesAnteriores
 */
export function PaginaCreaciones({
  creaciones = [], borradores = [], cargando = false, error = false, onReintentar, onEliminar, onRenombrar, comunidadPara, urlCrear = '/personalizar',
  versiones = [], diasVersion = 7, onRecuperarVersion, onEliminarVersion,
}) {
  const n = creaciones.length;
  let subtitulo = 'Tus diseños guardados, listos para comprar o seguir editando.';
  if (!cargando && n) subtitulo = `${n} ${n === 1 ? 'diseño guardado' : 'diseños guardados'} · cómpralos o sigue editándolos cuando quieras.`;
  if (!cargando && !n) subtitulo = 'Aquí se guardan los diseños que creas.';
  return (
    <>
      <CabezaCuenta
        icono={<Sparkles />}
        tono="rosa"
        titulo={<Texto>Mis creaciones</Texto>}
        subtitulo={<Texto>{subtitulo}</Texto>}
        accion={(cargando || n > 0) && <Boton to={urlCrear} icono={<Plus aria-hidden="true" />}><Texto>Crear nuevo diseño</Texto></Boton>}
      />
      {error ? (
        <Aviso tipo="error" titulo={<Texto>No pudimos cargar tus creaciones</Texto>} accion={onReintentar && <Boton tamano="sm" variante="contorno" icono={<RotateCcw aria-hidden="true" />} onClick={onReintentar}><Texto>Reintentar</Texto></Boton>}>
          <Texto>Revisa tu conexión e inténtalo de nuevo.</Texto>
        </Aviso>
      ) : cargando ? (
        <ul className={s.rejilla} aria-busy="true">
          {Array.from({ length: 6 }, (_, k) => <li key={k}><EsqueletoCreacion /></li>)}
        </ul>
      ) : n === 0 ? (
        // Sin la cara de Kapi: en la tienda ya está el flotante (un solo Kapi a la vista).
        <EstadoVacio
          imagen={null}
          icono={<Sparkles />}
          titulo={<Texto>Aún no tienes creaciones</Texto>}
          texto={<Texto>Elige una prenda, ponle tu imagen o tu frase y guárdala: aquí la tendrás lista para comprar o seguir editando.</Texto>}
        >
          <Boton to={urlCrear} icono={<Plus aria-hidden="true" />}><Texto>Empezar a crear</Texto></Boton>
        </EstadoVacio>
      ) : (
        <>
          {borradores.length > 0 && <CabezaCuenta nivel={2} titulo={<Texto>Guardadas</Texto>} subtitulo={<Texto>Listas para comprar o seguir editando.</Texto>} />}
          <ul className={s.rejilla}>
            {creaciones.map((c) => (
              <li key={c.id}>
                <TarjetaCreacion
                  {...c}
                  onEliminar={onEliminar && (() => onEliminar(c.id))}
                  onRenombrar={onRenombrar && ((nombre) => onRenombrar(c.id, nombre))}
                  comunidad={comunidadPara?.(c)}
                />
              </li>
            ))}
          </ul>
        </>
      )}
      {!cargando && (
        <VersionesAnteriores versiones={versiones} diasTotal={diasVersion} onRecuperar={onRecuperarVersion} onEliminar={onEliminarVersion} />
      )}
      {!cargando && borradores.length > 0 && (
        <section className={s.borradores}>
          <CabezaCuenta nivel={2} titulo={<Texto>Tus borradores</Texto>} subtitulo={<Texto>Diseños sin terminar. Continúa donde lo dejaste.</Texto>} />
          <Carrusel visibles={{ escritorio: 4.3, tablet: 3.3, movil: 1.8 }} etiqueta="Tus borradores">
            {borradores.map((b) => (
              <TarjetaCreacion
                key={b.id}
                {...b}
                borrador
                onEliminar={onEliminar && (() => onEliminar(b.id))}
                // Un combo sin terminar también se renombra (como antes).
                onRenombrar={onRenombrar && b.imagenes?.length > 1 ? ((nombre) => onRenombrar(b.id, nombre)) : undefined}
              />
            ))}
          </Carrusel>
        </section>
      )}
    </>
  );
}

/* ── Lista de deseos (/cuenta/wishlist) ─────────────────── */

/** La foto de un producto que ya no está: apagada y, si tampoco carga, una caja vacía. */
function FotoApagada({ src }) {
  const [rota, setRota] = useState(false);
  if (!src || rota) return <span className={s.noDisponibleFoto} aria-hidden="true"><Heart /></span>;
  return <img src={src} alt="" loading="lazy" onError={() => setRota(true)} />;
}

/**
 * Lista de deseos: lo guardado con el corazón, "Agregar todo al carrito" y
 * compartir la lista.
 *  - items: [{ id, producto: props de TarjetaProducto, guardado: "hace 3 días",
 *    regalado, disponible, cargando }] (tarjetaDesdeProducto + WishlistContext);
 *    `cargando`: su producto todavía no llega (esqueleto en su lugar)
 *  - tarjeta: otra tarjeta (la de la tienda) → <Tarjeta item={it} indice={i} />;
 *    sin ella, TarjetaProducto con `deseado`
 *  - cargando · sinCumpleanos: el consejo de registrar el cumpleaños (también
 *    con la lista vacía)
 *  - onQuitar(id) · onAgregar(item) · onAgregarTodo(): promesa → el resultado:
 *    un texto (aviso de éxito) o { texto, tipo } ('info' si no se agregó nada)
 *  - onCompartir(): promesa (copia /wishlist/{código}) · onFechasEspeciales()
 *  - urlPerfil, urlTienda
 */
export function PaginaListaDeseos({
  items = [], cargando = false, sinCumpleanos = false, tarjeta: Tarjeta, onQuitar, onAgregar, onAgregarTodo, onCompartir, onFechasEspeciales,
  urlPerfil = '/cuenta/perfil', urlTienda = '/tienda',
}) {
  const [agregando, setAgregando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const reloj = useRef(null);
  useEffect(() => () => window.clearTimeout(reloj.current), []);
  const agregarTodo = async () => {
    setAgregando(true);
    setResultado(null);
    try {
      const r = await onAgregarTodo?.();
      if (r) setResultado(typeof r === 'string' ? { texto: r, tipo: 'exito' } : r);
    } finally { setAgregando(false); }
  };
  const compartir = async () => {
    try {
      await onCompartir?.();
      setCopiado(true);
      window.clearTimeout(reloj.current);
      reloj.current = window.setTimeout(() => setCopiado(false), 2000);
    } catch { /* la página avisa */ }
  };
  const hay = items.length > 0;
  return (
    <>
      <CabezaCuenta
        icono={<Heart />}
        tono="rosa"
        titulo={<Texto>Mi lista de deseos</Texto>}
        subtitulo={hay
          ? <><Texto>{`${items.length} ${items.length === 1 ? 'producto guardado' : 'productos guardados'}.`}</Texto> <Texto>Compártela para que te regalen justo lo que quieres.</Texto></>
          : <Texto>Guarda con el corazón lo que te encantaría recibir.</Texto>}
      />
      {hay && !cargando && (
        <div className={s.accionesLista}>
          {onAgregarTodo && <Boton icono={<ShoppingCart aria-hidden="true" />} cargando={agregando} onClick={agregarTodo}><Texto>{agregando ? 'Agregando…' : 'Agregar todo al carrito'}</Texto></Boton>}
          {onCompartir && <Boton variante="contorno" icono={<Share2 aria-hidden="true" />} onClick={compartir}><Texto>{copiado ? '¡Link copiado!' : 'Compartir mi lista'}</Texto></Boton>}
          {onFechasEspeciales && <Boton variante="fantasma" icono={<CalendarHeart aria-hidden="true" />} onClick={onFechasEspeciales}><Texto>Mis fechas especiales</Texto></Boton>}
        </div>
      )}
      {resultado && <Aviso tipo={resultado.tipo || 'exito'} onCerrar={() => setResultado(null)}><Texto>{resultado.texto}</Texto></Aviso>}
      {sinCumpleanos && (
        <Aviso tipo="info" icono={<Lightbulb aria-hidden="true" />} accion={<Boton to={urlPerfil} tamano="sm" variante="contorno"><Texto>Ir a mi perfil</Texto></Boton>}>
          <Texto>Registra tu cumpleaños en tu perfil y te recordamos compartir esta lista antes de tu gran día.</Texto>
        </Aviso>
      )}
      {cargando ? (
        <ul className={s.rejillaProductos} aria-busy="true"><Esqueletos n={4} forma="producto" /></ul>
      ) : !hay ? (
        // Sin la cara de Kapi: en la tienda ya está el flotante (un solo Kapi a la vista).
        <EstadoVacio
          imagen={null}
          icono={<Heart />}
          titulo={<Texto>Tu lista de deseos está vacía</Texto>}
          texto={<Texto>Explora la tienda y guarda los productos que te encantaría recibir o comprar después.</Texto>}
        >
          <Boton to={urlTienda}><Texto>Explorar la tienda</Texto></Boton>
        </EstadoVacio>
      ) : (
        <ul className={s.rejillaProductos}>
          {items.map((it, i) => (
            <li key={it.id} className={s.deseo}>
              {it.cargando ? (
                <EsqueletoProducto />
              ) : it.disponible === false ? (
                <div className={s.noDisponible}>
                  <FotoApagada src={it.producto?.imagen} />
                  <p><strong>{it.producto?.nombre || <Texto>Producto</Texto>}</strong></p>
                  <p><Texto>Este producto ya no está en la tienda.</Texto></p>
                  {onQuitar && <Boton variante="contorno" tamano="sm" icono={<Trash2 aria-hidden="true" />} onClick={() => onQuitar(it.id)}><Texto>Quitar de mi lista</Texto></Boton>}
                </div>
              ) : Tarjeta ? (
                <Tarjeta item={it} indice={i} />
              ) : (
                <TarjetaProducto {...it.producto} deseado onDeseo={(v) => { if (!v) onQuitar?.(it.id); }} onAgregar={onAgregar && (() => onAgregar(it))} />
              )}
              {it.regalado && <p className={s.guardado}><Gift aria-hidden="true" /> <Texto>¡Ya te lo regalaron!</Texto></p>}
              {it.guardado && <p className={s.guardado}><Heart aria-hidden="true" /> <Texto>{`Guardado ${it.guardado}`}</Texto></p>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/* ── Fechas importantes (/cuenta/fechas-importantes) ────── */

/**
 * Fechas importantes: a quién le regalas y cuándo, con ideas a su medida.
 *  - personas: [{ id, nombre, relacion, relacionTexto, genero, foto, presupuesto,
 *    gustos, eventos: [{ id, tipo, nombre, fecha }], festivas, paquetes, ideas,
 *    ideasGenerales }] (personaDesdeRecipient + useGiftCatalog)
 *  - festivas: fechas que se acercan, props de AvisoFestiva
 *  - encuesta: { monedas, url } banner del perfil de regalos (sin encuesta hecha)
 *  - ganadas: monedas que acaba de ganar (aviso) · conjuntos: gustos que se pueden marcar
 *  - presupuesto: con la pregunta del presupuesto en el formulario (casilla del admin de Encuestas)
 *  - aviso: cuándo avisamos ("una semana antes y un día antes", del admin)
 *  - onGuardar(persona): promesa (nueva sin id) · onEliminar(id) · onSubirFoto(archivo) → url
 *  - onAgregarIdea(idea) · onAgregarPaquete(idPersona, idPaquete) · onAgregarIdeas(id)
 *  - onElegir(idea o producto): lo que pide talla o color (sin él, va al producto)
 *  - urlTienda · hoy
 */
export function PaginaFechas({
  personas = [], festivas = [], encuesta, ganadas = 0, conjuntos = [], presupuesto = true, cargando = false, aviso = 'una semana antes y un día antes',
  onGuardar, onEliminar, onSubirFoto, onAgregarIdea, onAgregarPaquete, onAgregarIdeas, onElegir, urlTienda = '/tienda', hoy,
}) {
  // La hoja se queda montada al cerrarse (para que baje animada); cada vez
  // que se abre, `clave` nueva = formulario desde cero.
  const [hoja, setHoja] = useState({ abierta: false, persona: null, clave: 0 });
  const abrir = (persona = {}) => setHoja((h) => ({ abierta: true, persona, clave: h.clave + 1 }));
  // "Lo que se viene": las próximas fechas de todos (y las festivas que les
  // tocan), de la más cercana a la más lejana; cada una lleva a su persona.
  const agenda = personas.flatMap((p) => [
    ...(p.eventos || []).map((e) => ({
      id: `${p.id}-${e.id}`,
      fecha: e.fecha,
      titulo: e.tipo === 'Fecha Especial' ? (e.nombre || 'Fecha especial') : e.tipo === 'Cumpleaños' ? `Cumpleaños de ${p.nombre}` : `${e.tipo} con ${p.nombre}`,
      persona: e.tipo === 'Cumpleaños' ? p.relacionTexto : p.nombre,
      dias: faltanDias(e.fecha, hoy),
      url: `#persona-${p.id}`,
    })),
    ...(p.festivas || []).map((f) => ({ id: `${p.id}-${f.nombre}`, fecha: f.fecha, titulo: f.nombre, persona: `Para ${p.nombre}`, dias: faltanDias(f.fecha, hoy), url: `#persona-${p.id}` })),
  ]).filter((x) => x.dias != null).sort((a, b) => a.dias - b.dias).slice(0, 8);
  return (
    <>
      <CabezaCuenta
        icono={<CalendarHeart />}
        tono="rosa"
        titulo={<Texto>Fechas importantes</Texto>}
        subtitulo={<Texto>{`Guarda a quién quieres regalarle y cuándo. Te avisamos ${aviso || 'antes de cada fecha'}, con ideas que le pegan. Ganas 5 monedas por cada fecha nueva (hasta 50).`}</Texto>}
        accion={onGuardar && personas.length > 0 && <Boton icono={<Plus aria-hidden="true" />} onClick={() => abrir()}><Texto>Añadir persona</Texto></Boton>}
      />
      {ganadas > 0 && <Aviso tipo="exito" titulo={<Texto>{`¡Ganaste ${ganadas} monedas!`}</Texto>}><Texto>Úsalas como descuento en tu próxima compra.</Texto></Aviso>}
      {encuesta && (
        <Aviso tipo="info" icono={<Gift aria-hidden="true" />} titulo={<Texto>{`Completa tu perfil de regalos y gana ${encuesta.monedas || 15} monedas`}</Texto>}
          accion={<Boton to={encuesta.url || '/encuesta-suscripcion'} tamano="sm"><Texto>Completar la encuesta</Texto></Boton>}>
          <Texto>Cuéntanos qué le gusta a cada persona y te recomendamos mejor.</Texto>
        </Aviso>
      )}
      {!cargando && <AgendaFechas items={agenda} />}
      {festivas.map((f) => (
        <AvisoFestiva key={f.id || f.nombre} {...f} hoy={hoy} urlTienda={urlTienda} onAgregarIdea={onAgregarIdea} onElegir={onElegir} onAgregarPersona={onGuardar && (() => abrir())} />
      ))}
      {cargando ? (
        <ul className={s.personas} aria-busy="true"><Esqueletos n={2} alto={360} /></ul>
      ) : personas.length === 0 ? (
        // Sin la cara de Kapi: en la tienda ya está el flotante (un solo Kapi a la vista).
        <EstadoVacio
          imagen={null}
          icono={<CalendarHeart />}
          titulo={<Texto>Todavía no agregaste a nadie</Texto>}
          texto={<Texto>Empieza por la persona a la que más le regalas: con su cumpleaños alcanza.</Texto>}
        >
          {onGuardar && <Boton icono={<Plus aria-hidden="true" />} onClick={() => abrir()}><Texto>Añadir persona</Texto></Boton>}
        </EstadoVacio>
      ) : (
        <ul className={s.personas}>
          {personas.map((p) => (
            <li key={p.id}>
              <TarjetaPersonaRegalo
                {...p}
                relacion={p.relacionTexto || RELACIONES.find((r) => r.valor === p.relacion)?.texto}
                hoy={hoy}
                urlTienda={urlTienda}
                onEditar={onGuardar && (() => abrir(p))}
                onEliminar={onEliminar && (() => onEliminar(p.id))}
                onAgregarIdea={onAgregarIdea}
                onAgregarPaquete={onAgregarPaquete && ((idPaquete) => onAgregarPaquete(p.id, idPaquete))}
                onAgregarIdeas={onAgregarIdeas && (() => onAgregarIdeas(p.id))}
                onElegir={onElegir}
              />
            </li>
          ))}
        </ul>
      )}
      {hoja.clave > 0 && (
        <HojaPersona
          key={hoja.clave}
          abierta={hoja.abierta}
          persona={hoja.persona}
          conjuntos={conjuntos}
          presupuesto={presupuesto}
          onSubirFoto={onSubirFoto}
          onGuardar={onGuardar}
          onCerrar={() => setHoja((h) => ({ ...h, abierta: false }))}
        />
      )}
    </>
  );
}
