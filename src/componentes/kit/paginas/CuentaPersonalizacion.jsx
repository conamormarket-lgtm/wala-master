import React, { useState } from 'react';
import { Sparkles, Plus, RotateCcw, Heart, ShoppingCart, CalendarHeart, Share2, Gift, Trash2, Lightbulb } from 'lucide-react';
import Boton from '../Boton';
import { Aviso, EstadoVacio } from '../Feedback';
import TarjetaProducto from '../TarjetaProducto';
import Carrusel from '../Carrusel';
import { CabezaCuenta } from '../piezas/Cuenta';
import { TarjetaCreacion } from '../piezas/Creaciones';
import { TarjetaPersonaRegalo, AvisoFestiva, AgendaFechas, faltanDias } from '../piezas/Regalos';
import { HojaPersona, RELACIONES } from '../piezas/FormularioPersona';
import { EsqueletoProducto, EsqueletoFila, EsqueletoTarjeta } from '../Esqueletos';
import { CARAS_KAPI } from '../piezas/Flotantes';
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
 * Mis creaciones: los diseños guardados (comprar o seguir editando) y, si
 * hay, los borradores en un carrusel.
 *  - creaciones: props de TarjetaCreacion con `id` (creacionDesdeDiseno)
 *  - borradores: ídem, sin precio (useBorradoresCrear)
 *  - cargando · error · onReintentar
 *  - onEliminar(id), onRenombrar(id, nombre): promesas · urlCrear
 *  - comunidadPara(creacion): la prop `comunidad` de cada tarjeta (publicar,
 *    actualizar, retirar; solo para quien puede publicar) o nada
 */
export function PaginaCreaciones({ creaciones = [], borradores = [], cargando = false, error = false, onReintentar, onEliminar, onRenombrar, comunidadPara, urlCrear = '/personalizar' }) {
  const n = creaciones.length;
  let subtitulo = 'Tus diseños guardados, listos para comprar o seguir editando.';
  if (!cargando && n) subtitulo = `${n} ${n === 1 ? 'diseño guardado' : 'diseños guardados'} · cómpralos o sigue editándolos cuando quieras.`;
  if (!cargando && !n) subtitulo = 'Aquí se guardan los diseños que creas.';
  return (
    <>
      <CabezaCuenta
        icono={<Sparkles />}
        tono="rosa"
        titulo="Mis creaciones"
        subtitulo={subtitulo}
        accion={(cargando || n > 0) && <Boton to={urlCrear} icono={<Plus aria-hidden="true" />}>Crear nuevo diseño</Boton>}
      />
      {error ? (
        <Aviso tipo="error" titulo="No pudimos cargar tus creaciones" accion={onReintentar && <Boton tamano="sm" variante="contorno" icono={<RotateCcw aria-hidden="true" />} onClick={onReintentar}>Reintentar</Boton>}>
          Revisa tu conexión e inténtalo de nuevo.
        </Aviso>
      ) : cargando ? (
        <ul className={s.rejilla} aria-busy="true"><Esqueletos n={3} forma="producto" /></ul>
      ) : n === 0 && borradores.length === 0 ? (
        <EstadoVacio imagen={CARAS_KAPI.feliz} titulo="Aún no tienes creaciones" texto="Elige una prenda, ponle tu imagen o tu frase y guárdala: aquí la tendrás lista para comprar o seguir editando.">
          <Boton to={urlCrear} icono={<Sparkles aria-hidden="true" />}>Empezar a crear</Boton>
        </EstadoVacio>
      ) : (
        <>
          {borradores.length > 0 && n > 0 && <CabezaCuenta nivel={2} titulo="Guardadas" subtitulo="Listas para comprar o seguir editando." />}
          {n > 0 && (
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
          )}
          {borradores.length > 0 && (
            <section className={s.borradores}>
              <CabezaCuenta nivel={2} titulo="Tus borradores" subtitulo="Diseños sin terminar. Sigue donde lo dejaste." />
              <Carrusel visibles={{ escritorio: 4.3, tablet: 3.3, movil: 1.8 }} etiqueta="Tus borradores">
                {borradores.map((b) => (
                  <TarjetaCreacion key={b.id} {...b} borrador onEliminar={onEliminar && (() => onEliminar(b.id))} />
                ))}
              </Carrusel>
            </section>
          )}
        </>
      )}
    </>
  );
}

/* ── Lista de deseos (/cuenta/wishlist) ─────────────────── */

/**
 * Lista de deseos: lo guardado con el corazón, "Agregar todo al carrito" y
 * compartir la lista.
 *  - items: [{ id, producto: props de TarjetaProducto, guardado: "hace 3 días",
 *    regalado, disponible }] (tarjetaDesdeProducto + WishlistContext)
 *  - cargando · sinCumpleanos: muestra el consejo de registrar el cumpleaños
 *  - onQuitar(id) · onAgregar(item) · onAgregarTodo(): promesa → texto del resultado
 *  - onCompartir(): promesa (copia /wishlist/{código}) · onFechasEspeciales()
 *  - urlPerfil, urlTienda
 */
export function PaginaListaDeseos({
  items = [], cargando = false, sinCumpleanos = false, onQuitar, onAgregar, onAgregarTodo, onCompartir, onFechasEspeciales,
  urlPerfil = '/cuenta/perfil', urlTienda = '/tienda',
}) {
  const [agregando, setAgregando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const agregarTodo = async () => {
    setAgregando(true);
    try { setResultado(await onAgregarTodo?.()); } finally { setAgregando(false); }
  };
  const compartir = async () => {
    try { await onCompartir?.(); setCopiado(true); window.setTimeout(() => setCopiado(false), 2000); } catch { /* la página avisa */ }
  };
  const hay = items.length > 0;
  return (
    <>
      <CabezaCuenta
        icono={<Heart />}
        tono="rosa"
        titulo="Mi lista de deseos"
        subtitulo={hay ? `${items.length} ${items.length === 1 ? 'producto guardado' : 'productos guardados'}. Compártela para que te regalen justo lo que quieres.` : 'Guarda con el corazón lo que te encantaría recibir.'}
      />
      {hay && (
        <div className={s.accionesLista}>
          {onAgregarTodo && <Boton icono={<ShoppingCart aria-hidden="true" />} cargando={agregando} onClick={agregarTodo}>Agregar todo al carrito</Boton>}
          {onCompartir && <Boton variante="contorno" icono={<Share2 aria-hidden="true" />} onClick={compartir}>{copiado ? '¡Link copiado!' : 'Compartir mi lista'}</Boton>}
          {onFechasEspeciales && <Boton variante="fantasma" icono={<CalendarHeart aria-hidden="true" />} onClick={onFechasEspeciales}>Mis fechas especiales</Boton>}
        </div>
      )}
      {resultado && <Aviso tipo="exito" onCerrar={() => setResultado(null)}>{resultado}</Aviso>}
      {sinCumpleanos && !cargando && hay && (
        <Aviso tipo="info" icono={<Lightbulb aria-hidden="true" />} accion={<Boton to={urlPerfil} tamano="sm" variante="contorno">Ir a mi perfil</Boton>}>
          Registra tu cumpleaños en tu perfil y te recordamos compartir esta lista antes de tu gran día.
        </Aviso>
      )}
      {cargando ? (
        <ul className={s.rejillaProductos} aria-busy="true"><Esqueletos n={4} forma="producto" /></ul>
      ) : !hay ? (
        <EstadoVacio imagen={CARAS_KAPI.feliz} titulo="Tu lista de deseos está vacía" texto="Explora la tienda y guarda los productos que te encantaría recibir o comprar después.">
          <Boton to={urlTienda}>Explorar la tienda</Boton>
        </EstadoVacio>
      ) : (
        <ul className={s.rejillaProductos}>
          {items.map((it) => (
            <li key={it.id} className={s.deseo}>
              {it.disponible === false ? (
                <div className={s.noDisponible}>
                  <img src={it.producto?.imagen} alt="" loading="lazy" />
                  <p><strong>{it.producto?.nombre}</strong></p>
                  <p>Este producto ya no está en la tienda.</p>
                  {onQuitar && <Boton variante="contorno" tamano="sm" icono={<Trash2 aria-hidden="true" />} onClick={() => onQuitar(it.id)}>Quitar de mi lista</Boton>}
                </div>
              ) : (
                <TarjetaProducto {...it.producto} deseado onDeseo={(v) => { if (!v) onQuitar?.(it.id); }} onAgregar={onAgregar && (() => onAgregar(it))} />
              )}
              <p className={s.guardado}>
                {it.regalado ? <><Gift aria-hidden="true" /> ¡Ya te lo regalaron!</> : <><Heart aria-hidden="true" /> Guardado {it.guardado}</>}
              </p>
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
 *    gustos, eventos: [{ id, tipo, nombre, fecha }], festivas, paquete, ideas,
 *    ideasGenerales, sinIdeas }] (personaDesdeRecipient + useGiftCatalog)
 *  - festivas: fechas que se acercan, props de AvisoFestiva
 *  - encuesta: { monedas, url } banner del perfil de regalos (sin encuesta hecha)
 *  - ganadas: monedas que acaba de ganar (aviso) · conjuntos: gustos que se pueden marcar
 *  - onGuardar(persona): promesa (nueva sin id) · onEliminar(id) · onSubirFoto(archivo) → url
 *  - onAgregarIdea(idea) · onAgregarPaquete(id) · onAgregarIdeas(id) · urlTienda · hoy
 */
export function PaginaFechas({
  personas = [], festivas = [], encuesta, ganadas = 0, conjuntos = [], cargando = false,
  onGuardar, onEliminar, onSubirFoto, onAgregarIdea, onAgregarPaquete, onAgregarIdeas, urlTienda = '/tienda', hoy,
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
        titulo="Fechas importantes"
        subtitulo="Guarda a quién quieres regalarle y cuándo. Te avisamos una semana y un día antes, con ideas que le pegan. Ganas 5 monedas por cada fecha nueva (hasta 50)."
        accion={onGuardar && personas.length > 0 && <Boton icono={<Plus aria-hidden="true" />} onClick={() => abrir()}>Añadir persona</Boton>}
      />
      {ganadas > 0 && <Aviso tipo="exito" titulo={`¡Ganaste ${ganadas} monedas!`}>Úsalas como descuento en tu próxima compra.</Aviso>}
      {encuesta && (
        <Aviso tipo="info" icono={<Gift aria-hidden="true" />} titulo={`Completa tu perfil de regalos y gana ${encuesta.monedas || 15} monedas`}
          accion={<Boton to={encuesta.url || '/encuesta-suscripcion'} tamano="sm">Completar la encuesta</Boton>}>
          Cuéntanos qué le gusta a cada persona y te recomendamos mejor.
        </Aviso>
      )}
      {!cargando && <AgendaFechas items={agenda} />}
      {festivas.map((f) => (
        <AvisoFestiva key={f.nombre} {...f} hoy={hoy} urlTienda={urlTienda} onAgregarIdea={onAgregarIdea} onAgregarPersona={onGuardar && (() => abrir())} />
      ))}
      {cargando ? (
        <ul className={s.personas} aria-busy="true"><Esqueletos n={2} alto={360} /></ul>
      ) : personas.length === 0 ? (
        <EstadoVacio imagen={CARAS_KAPI.feliz} titulo="Todavía no agregaste a nadie" texto="Empieza por la persona a la que más le regalas: con su cumpleaños alcanza.">
          {onGuardar && <Boton icono={<Plus aria-hidden="true" />} onClick={() => abrir()}>Añadir persona</Boton>}
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
                onAgregarPaquete={onAgregarPaquete && (() => onAgregarPaquete(p.id))}
                onAgregarIdeas={onAgregarIdeas && (() => onAgregarIdeas(p.id))}
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
          onSubirFoto={onSubirFoto}
          onGuardar={onGuardar}
          onCerrar={() => setHoja((h) => ({ ...h, abierta: false }))}
        />
      )}
    </>
  );
}
