import React, { useState } from 'react';
import { Sparkles, Plus, RotateCcw, Heart, ShoppingCart, CalendarHeart, Share2, Gift, Trash2, Lightbulb, Camera } from 'lucide-react';
import Boton from '../Boton';
import { Aviso, EstadoVacio, HojaInferior } from '../Feedback';
import { Campo, Interruptor } from '../Formulario';
import { CampoFecha } from '../Fecha';
import { RecortarFoto } from '../piezas/RecortarFoto';
import TarjetaProducto from '../TarjetaProducto';
import Carrusel from '../Carrusel';
import { Avatar } from '../piezas/Avatar';
import { CabezaCuenta } from '../piezas/Cuenta';
import { TarjetaCreacion } from '../piezas/Creaciones';
import { TarjetaPersonaRegalo, AvisoFestiva } from '../piezas/Regalos';
import s from './CuentaPersonalizacion.module.css';

/*
 * Páginas del grupo Personalización de la cuenta: Mis creaciones, Lista de
 * deseos y Fechas importantes. Van dentro de MarcoCuenta.
 */

function Esqueletos({ n = 3, alto = 300 }) {
  return Array.from({ length: n }, (_, k) => <li key={k} className={s.esqueleto} style={{ height: alto }} aria-hidden="true" />);
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
        <ul className={s.rejilla} aria-busy="true"><Esqueletos n={3} alto={380} /></ul>
      ) : n === 0 && borradores.length === 0 ? (
        <EstadoVacio imagen="/assets/kapi/kapi-happy.webp" titulo="Aún no tienes creaciones" texto="Elige una prenda, ponle tu imagen o tu frase y guárdala: aquí la tendrás lista para comprar o seguir editando.">
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
        <ul className={s.rejillaProductos} aria-busy="true"><Esqueletos n={4} alto={330} /></ul>
      ) : !hay ? (
        <EstadoVacio imagen="/assets/kapi/kapi-happy.webp" titulo="Tu lista de deseos está vacía" texto="Explora la tienda y guarda los productos que te encantaría recibir o comprar después.">
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

const RELACIONES = [
  { valor: 'pareja', texto: 'Pareja' }, { valor: 'hijos', texto: 'Hijo/a' }, { valor: 'padres', texto: 'Padre/Madre' },
  { valor: 'hermanos', texto: 'Hermano/a' }, { valor: 'sobrinos', texto: 'Sobrino/a' }, { valor: 'primos', texto: 'Primo/a' },
  { valor: 'amigos', texto: 'Amigo/a' }, { valor: 'otros', texto: 'Otra persona' },
];
const GENEROS = [{ valor: '', texto: 'Elige…', deshabilitada: true }, { valor: 'Femenino', texto: 'Femenino' }, { valor: 'Masculino', texto: 'Masculino' }, { valor: 'Otro', texto: 'Otro' }];
const PRESUPUESTOS = [
  { valor: '', texto: 'Sin preferencia' }, { valor: 'hasta50', texto: 'Hasta S/ 50' }, { valor: '50a100', texto: 'S/ 50 – 100' },
  { valor: '100a200', texto: 'S/ 100 – 200' }, { valor: 'mas200', texto: 'Más de S/ 200' },
];
const TIPOS_FECHA = [{ valor: 'Aniversario', texto: 'Aniversario' }, { valor: 'Fecha Especial', texto: 'Fecha especial' }];

let siguienteId = 0;
const nuevoId = () => { siguienteId += 1; return `f${Date.now().toString(36)}${siguienteId}`; };

/** Reglas de una persona (las de saveRecipient). Devuelve el primer error o ''. */
export function validarPersona(p) {
  if (!String(p.nombre || '').trim()) return 'Falta el nombre de la persona.';
  if (!p.genero) return 'Falta elegir el género.';
  for (let i = 0; i < p.eventos.length; i += 1) {
    const e = p.eventos[i];
    const cual = i === 0 ? 'Cumpleaños' : (e.tipo === 'Fecha Especial' ? (e.nombre || 'Fecha especial') : e.tipo);
    if (i > 0 && e.tipo === 'Fecha Especial' && !String(e.nombre || '').trim()) return 'Escribe qué se celebra en la fecha especial.';
    if (!e.fecha) return `Falta la fecha de "${cual}".`;
  }
  return '';
}

/** Estado y partes (cuerpo y pie) del formulario de una persona, para la hoja. */
function useFormularioPersona({ inicial, conjuntos = [], onGuardar, onCerrar, onSubirFoto }) {
  const [p, setP] = useState(() => ({
    nombre: '', genero: '', relacion: 'otros', presupuesto: '', foto: null, gustos: {},
    ...inicial,
    eventos: (inicial?.eventos?.length ? inicial.eventos : [{ id: nuevoId(), tipo: 'Cumpleaños', fecha: '' }]).map((e) => ({ ...e })),
  }));
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const poner = (campo) => (e) => setP((x) => ({ ...x, [campo]: e.target.value }));
  const ponerEvento = (i, campo, valor) => setP((x) => ({ ...x, eventos: x.eventos.map((e, k) => (k === i ? { ...e, [campo]: valor } : e)) }));
  const guardar = async () => {
    const msg = validarPersona(p);
    setError(msg);
    if (msg) return;
    setGuardando(true);
    try {
      await onGuardar({ ...p, eventos: p.eventos.map(({ id, tipo, nombre, fecha }, i) => ({ id, tipo: i === 0 ? 'Cumpleaños' : tipo, nombre, fecha })) });
      onCerrar();
    } catch {
      setError('No pudimos guardar los cambios. Intenta de nuevo.');
    } finally {
      setGuardando(false);
    }
  };
  // La foto pasa por el recorte (otra hoja encima de esta) antes de subirse.
  const [recorte, setRecorte] = useState(null);
  const elegirFoto = (archivo) => {
    if (!archivo?.type?.startsWith('image/')) { setError('El archivo debe ser una imagen.'); return; }
    setError('');
    setRecorte(URL.createObjectURL(archivo));
  };
  const subirFoto = async (blob) => {
    setSubiendo(true);
    try {
      const url = await onSubirFoto(blob);
      setP((x) => ({ ...x, foto: url }));
      setRecorte(null);
    } catch {
      setError('No se pudo subir la foto. Inténtalo de nuevo.');
    } finally {
      setSubiendo(false);
    }
  };
  return {
    pie: (
      <div className={s.pieForm}>
        {error && <Aviso tipo="error" compacto>{error}</Aviso>}
        <div className={s.botonesForm}>
          <Boton variante="fantasma" onClick={onCerrar} disabled={guardando || subiendo}>Cancelar</Boton>
          <Boton onClick={guardar} cargando={guardando} disabled={subiendo}>Guardar</Boton>
        </div>
      </div>
    ),
    cuerpo: (
      <div className={s.formulario}>
        {onSubirFoto && (
          <RecortarFoto
            abierta={Boolean(recorte)}
            src={recorte}
            titulo="Recorta su foto"
            onCancelar={() => setRecorte(null)}
            onListo={subirFoto}
          />
        )}
        {onSubirFoto && (
          <div className={s.fotoPersona}>
            <Avatar className={s.fotoAvatar} nombre={p.nombre} imagen={p.foto} letras={1}><Camera aria-hidden="true" /></Avatar>
            <div>
              <label className={s.subir}>
                <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; elegirFoto(f); }} />
                {subiendo ? 'Subiendo…' : p.foto ? 'Cambiar foto' : 'Subir foto'}
              </label>
              {p.foto && <button type="button" className={s.quitarFoto} onClick={() => setP((x) => ({ ...x, foto: null }))}>Quitar foto</button>}
              <small>Opcional. Ayuda a reconocerla de un vistazo.</small>
            </div>
          </div>
        )}
        <div className={s.fila}>
          <Campo etiqueta="Nombre de la persona" value={p.nombre} onChange={poner('nombre')} placeholder="Ej. Carlos" />
          <Campo etiqueta="Género" opciones={GENEROS} value={p.genero} onChange={poner('genero')} />
        </div>
        <Campo etiqueta="Relación" opciones={RELACIONES} value={p.relacion} onChange={poner('relacion')}
          ayuda="Con la relación y el género sumamos las fechas del calendario que le tocan (Día de la Madre, del Padre, de la Amistad…)." />
        <Campo etiqueta="¿Cuánto sueles gastar en su regalo?" opciones={PRESUPUESTOS} value={p.presupuesto} onChange={poner('presupuesto')}
          ayuda="Para que las ideas entren en tu presupuesto." />

        {conjuntos.length > 0 && (
          <fieldset className={s.grupoForm}>
            <legend>¿Qué le gusta a {p.nombre || 'esta persona'}?</legend>
            {conjuntos.map((c) => {
              const activo = Boolean(p.gustos[c.id]);
              return (
                <div key={c.id} className={s.gusto}>
                  <Interruptor
                    activo={activo}
                    etiqueta={c.nombre}
                    onChange={(v) => setP((x) => {
                      const gustos = { ...x.gustos };
                      if (v) gustos[c.id] = gustos[c.id] || {}; else delete gustos[c.id];
                      return { ...x, gustos };
                    })}
                  />
                  {activo && (c.campos || []).map((campo) => (
                    <Campo
                      key={campo.id}
                      etiqueta={campo.etiqueta}
                      opciones={campo.opciones
                        ? [{ valor: '', texto: 'Elige…', deshabilitada: true }, ...campo.opciones.map((o) => ({ valor: o, texto: o }))]
                        : (campo.sugerencias || []).map((o) => ({ valor: o, texto: o }))}
                      creable={!campo.opciones}
                      placeholder={campo.opciones ? undefined : 'Escribe o elige una sugerencia'}
                      value={p.gustos[c.id]?.[campo.id] || ''}
                      onChange={(e) => setP((x) => ({ ...x, gustos: { ...x.gustos, [c.id]: { ...x.gustos[c.id], [campo.id]: e.target.value } } }))}
                    />
                  ))}
                </div>
              );
            })}
          </fieldset>
        )}

        <fieldset className={s.grupoForm}>
          <legend>Fechas de esta persona</legend>
          {p.eventos.map((e, i) => (
            <div key={e.id} className={s.evento}>
              <div className={s.eventoCabeza}>
                {i === 0 ? <strong>Cumpleaños</strong> : (
                  <Campo etiqueta="Tipo" opciones={TIPOS_FECHA} value={e.tipo === 'Cumpleaños' ? 'Aniversario' : e.tipo} onChange={(ev) => ponerEvento(i, 'tipo', ev.target.value)} />
                )}
                {i > 0 && (
                  <Boton variante="fantasma" tamano="sm" soloIcono aria-label="Quitar esta fecha" icono={<Trash2 aria-hidden="true" />}
                    onClick={() => setP((x) => ({ ...x, eventos: x.eventos.filter((_, k) => k !== i) }))} />
                )}
              </div>
              {i > 0 && e.tipo === 'Fecha Especial' && (
                <Campo etiqueta="¿Qué se celebra?" value={e.nombre || ''} onChange={(ev) => ponerEvento(i, 'nombre', ev.target.value)} placeholder="Ej. Bautizo" />
              )}
              <CampoFecha
                etiqueta={i === 0 ? 'Fecha de su cumpleaños' : 'Fecha'}
                valor={e.fecha}
                onCambiar={(iso) => ponerEvento(i, 'fecha', iso)}
                anioOpcional
                vistaInicial={i === 0 ? 'anios' : 'dias'}
                max={i === 0 ? new Date().toISOString().slice(0, 10) : undefined}
                ayuda={i === 0 ? 'Si no sabes en qué año nació, marca «No sé el año».' : undefined}
              />
            </div>
          ))}
          <Boton variante="contorno" tamano="sm" icono={<Plus aria-hidden="true" />}
            onClick={() => setP((x) => ({ ...x, eventos: [...x.eventos, { id: nuevoId(), tipo: 'Aniversario', fecha: '' }] }))}>
            Agregar otra fecha
          </Boton>
        </fieldset>
      </div>
    ),
  };
}

function HojaPersona({ persona, abierta, onCerrar, ...resto }) {
  const formulario = useFormularioPersona({ inicial: persona, onCerrar, ...resto });
  return (
    <HojaInferior abierta={abierta} onCerrar={onCerrar} titulo={persona?.id ? `Editar a ${persona.nombre}` : 'Añadir persona'} pie={formulario.pie}>
      {formulario.cuerpo}
    </HojaInferior>
  );
}

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
      {festivas.map((f) => (
        <AvisoFestiva key={f.nombre} {...f} hoy={hoy} urlTienda={urlTienda} onAgregarIdea={onAgregarIdea} onAgregarPersona={onGuardar && (() => abrir())} />
      ))}
      {cargando ? (
        <ul className={s.personas} aria-busy="true"><Esqueletos n={2} alto={360} /></ul>
      ) : personas.length === 0 ? (
        <EstadoVacio imagen="/assets/kapi/kapi-happy.webp" titulo="Todavía no agregaste a nadie" texto="Empieza por la persona a la que más le regalas: con su cumpleaños alcanza.">
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
