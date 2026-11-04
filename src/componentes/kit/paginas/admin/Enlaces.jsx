import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Eye, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import Boton from '../../Boton';
import { Aviso, Confirmar, useToast } from '../../Feedback';
import { Campo, Deslizador } from '../../Formulario';
import { Pestanas } from '../../Navegacion';
import { CabezaAdmin } from '../../piezas/admin/Marco';
import { TablaAdmin, BarraFiltros, InsigniaEstado, ListaOrdenable } from '../../piezas/admin/Datos';
import { HojaEdicion, GrupoCampos, CampoImagen, CampoColor, ElegirUno, ElegirMuestra, BarraGuardar } from '../../piezas/admin/Formularios';
import { Cifra, FilaCifras, BloqueMetrica, ColumnasMetricas, ListaBarras } from '../../piezas/admin/Metricas';
import { FotoCelda } from './celdas';
import { PaginaEnlaces } from '../Enlaces';
import { IsoWala, Sello } from '../../Marca';
import { TEMAS, GRADIENTES, PATRONES, construirFondoStyle, estiloBotonStyle } from '../../../../services/linkThemes';
import {
  slugDeEnlace, TIPOS_RED, botonEnlaceNuevo, redNueva, erroresDeEnlaces, clicsDeEnlaces, normalizarBusqueda,
} from '../../adaptadoresAdmin';
import l from './Lista.module.css';
import s from './Enlaces.module.css';

/*
 * D6c · Enlaces (/admin/enlaces y /admin/enlaces/:id): las páginas de
 * enlaces tipo «link in bio» en /l/{slug}. El constructor edita la cabecera,
 * los botones, las redes y el diseño con la vista previa al lado; el diseño y
 * la vista previa usan services/linkThemes, igual que la página pública.
 */

const entero = (n) => new Intl.NumberFormat('es-PE').format(Math.round(Number(n) || 0));
const errorDe = (err) => err?.message || 'Vuelve a intentar.';
const mismo = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// ¿El diseño de ahora es este tema? (fondo y botones; la alineación no cuenta).
const mismoTema = (t, d) => JSON.stringify(t.background) === JSON.stringify(d.background)
  && t.buttonStyle === d.buttonStyle && t.buttonColor === d.buttonColor && t.buttonTextColor === d.buttonTextColor;
const ESTADOS = { activo: { texto: 'Activa', tono: 'exito' }, borrador: { texto: 'Borrador', tono: 'neutro' } };

/**
 * Las páginas de enlaces (/admin/enlaces).
 *  - paginas: [paginaEnlacesDesde] · cargando · error · onReintentar
 *  - onCrear({ titulo, slug }) → promesa con el id (y se abre) · onAbrir(pagina) · onEliminar(id)
 *  - urlPublica(slug) ('/l/{slug}')
 */
export function PaginaEnlacesAdmin({ paginas = [], cargando = false, error, onReintentar, onCrear, onAbrir, onEliminar, urlPublica = (slug) => `/l/${slug}` }) {
  const toast = useToast();
  const [busqueda, setBusqueda] = useState('');
  const [nueva, setNueva] = useState(null);
  const [errores, setErrores] = useState({});
  const [borrar, setBorrar] = useState(null);
  const filas = useMemo(() => {
    const q = normalizarBusqueda(busqueda);
    return paginas.filter((p) => !q || normalizarBusqueda(`${p.nombre} ${p.slug}`).includes(q));
  }, [paginas, busqueda]);
  const visitas = paginas.reduce((t, p) => t + p.visitas, 0);

  const crear = async () => {
    const e = erroresDeEnlaces(nueva, paginas);
    if (Object.values(e).some(Boolean)) { setErrores(e); throw new Error(e.nombre || e.slug); }
    const id = await onCrear?.({ titulo: nueva.nombre.trim(), slug: slugDeEnlace(nueva.slug || nueva.nombre) });
    toast({ tipo: 'exito', titulo: 'Página creada', texto: 'Ahora arma sus botones y su diseño.' });
    setNueva(null);
    if (id) onAbrir?.({ id });
  };

  return (
    <div className={s.pagina} data-componente="PaginaEnlacesAdmin">
      <CabezaAdmin
        icono="enlaces"
        tono="rosa"
        titulo="Enlaces"
        subtitulo="Páginas de enlaces para la bio de tus redes: cada una en wala.pe/l/… mide visitas y clics."
        principal={onCrear ? { texto: 'Nueva página', Icono: Plus, onClick: () => { setNueva({ nombre: '', slug: '' }); setErrores({}); } } : undefined}
      />
      <FilaCifras etiqueta="Resumen de los enlaces">
        <Cifra nombre="Páginas" valor={entero(paginas.length)} ayuda={`${entero(paginas.filter((p) => p.estado === 'activo').length)} activas`} cargando={cargando} />
        <Cifra nombre="Visitas" valor={entero(visitas)} ayuda="Desde que existen" tono="exito" cargando={cargando} />
      </FilaCifras>
      <BarraFiltros busqueda={busqueda} onBusqueda={setBusqueda} placeholder="Buscar una página o su enlace" total={cargando || error ? undefined : filas.length} unidad={['página', 'páginas']} />
      <TablaAdmin
        etiqueta="Páginas de enlaces"
        filas={filas}
        nombreDe={(p) => p.nombre || p.slug}
        cargando={cargando}
        error={error}
        onReintentar={onReintentar}
        onFila={onAbrir}
        vacio={paginas.length
          ? { titulo: 'Ninguna página coincide', texto: 'Busca otra cosa.' }
          : { titulo: 'Todavía no hay páginas de enlaces', texto: 'Crea la primera para la bio de Instagram o TikTok.', accion: onCrear && <Boton icono={<Plus aria-hidden="true" />} onClick={() => setNueva({ nombre: '', slug: '' })}>Nueva página</Boton> }}
        acciones={(p) => [
          ...(onAbrir ? [{ id: 'editar', etiqueta: 'Editar la página', Icono: Pencil, accion: () => onAbrir(p) }] : []),
          ...(p.slug ? [{ id: 'ver', etiqueta: 'Ver la página', Icono: ExternalLink, accion: () => window.open(urlPublica(p.slug), '_blank', 'noopener') }] : []),
          ...(onEliminar ? ['separador', { id: 'eliminar', etiqueta: 'Eliminar', Icono: Trash2, peligro: true, accion: () => setBorrar(p) }] : []),
        ]}
        columnas={[
          { id: 'foto', titulo: 'Foto', ancho: 64, tarjeta: 'foto', celda: (p) => (p.avatar ? <FotoCelda src={p.avatar} forma="circulo" /> : <Sello tamano={40} girar={-6}><IsoWala tamano={20} tono="blanco" /></Sello>) },
          { id: 'nombre', titulo: 'Página', tarjeta: 'titulo', celda: (p) => <>{p.nombre || 'Sin título'}<span className={l.sub}>/l/{p.slug}</span></> },
          { id: 'botones', titulo: 'Botones', ancho: 110, alinear: 'fin', tarjeta: 'detalle', celda: (p) => <span className={l.numero}>{entero(p.botones.length)}{p.redes.length > 0 && <span className={l.sub}>{p.redes.length} {p.redes.length === 1 ? 'red' : 'redes'}</span>}</span> },
          { id: 'visitas', titulo: 'Visitas', ancho: 100, alinear: 'fin', tarjeta: 'detalle', celda: (p) => <span className={l.numero}>{entero(p.visitas)}</span> },
          { id: 'estado', titulo: 'Estado', ancho: 110, tarjeta: 'estado', celda: (p) => <InsigniaEstado estado={p.estado} estados={ESTADOS} /> },
        ]}
      />
      <HojaEdicion abierta={Boolean(nueva)} titulo="Nueva página de enlaces" subtitulo="El resto se arma después" onCerrar={() => setNueva(null)} onGuardar={crear} textoGuardar="Crear y armarla" sucio={Boolean(nueva?.nombre || nueva?.slug)}>
        {nueva && (
          <GrupoCampos titulo="La página">
            <Campo etiqueta="Título" placeholder="Ej. Mis redes, Catálogo" value={nueva.nombre} error={errores.nombre} onChange={(e) => { setNueva((x) => ({ ...x, nombre: e.target.value })); setErrores({}); }} />
            <Campo etiqueta="Enlace" ayuda={`wala.pe/l/${slugDeEnlace(nueva.slug || nueva.nombre) || 'tu-enlace'} · sale del título; puedes cambiarlo.`} placeholder={slugDeEnlace(nueva.nombre) || 'sale-del-titulo'} value={nueva.slug} error={errores.slug} onChange={(e) => { setNueva((x) => ({ ...x, slug: e.target.value })); setErrores({}); }} />
          </GrupoCampos>
        )}
      </HojaEdicion>
      <Confirmar
        abierta={Boolean(borrar)}
        titulo="¿Eliminar esta página?"
        texto={borrar ? `Se borra «${borrar.nombre || borrar.slug}»: /l/${borrar.slug} deja de existir y se pierden sus visitas y clics. No se puede deshacer.` : ''}
        confirmar="Eliminar"
        peligro
        onCancelar={() => setBorrar(null)}
        onConfirmar={async () => {
          try {
            await onEliminar?.(borrar.id);
            toast({ tipo: 'exito', titulo: 'Página eliminada', texto: borrar.nombre });
          } catch (err) {
            toast({ tipo: 'error', titulo: 'No se pudo eliminar', texto: errorDe(err) });
          } finally {
            setBorrar(null);
          }
        }}
      />
    </div>
  );
}

/* ── El constructor ────────────────────────────────────── */

/**
 * El celular con la página como se verá: la misma PaginaEnlaces de /l/…
 * (vistaPrevia), con lo que se está escribiendo.
 */
function VistaEnlaces({ d }) {
  const pagina = {
    titulo: d.nombre || 'Tu título',
    descripcion: d.descripcion,
    avatar: d.avatar,
    redes: d.redes,
    botones: (d.botones.length ? d.botones : [{ id: 'x', titulo: 'Botón de ejemplo', url: '' }])
      .map((b) => ({ id: b.id, titulo: b.titulo || 'Botón', url: b.url, imagen: b.miniatura })),
    diseno: d.diseno,
  };
  return (
    <div className={s.telefono} aria-label="Vista previa de la página">
      <div className={s.pantalla}><PaginaEnlaces vistaPrevia pagina={pagina} /></div>
    </div>
  );
}

const PESTANAS = [{ id: 'contenido', texto: 'Contenido' }, { id: 'diseno', texto: 'Diseño' }, { id: 'resultados', texto: 'Resultados' }];
const FUENTES = [
  { valor: '', texto: 'La de la tienda' },
  { valor: "'Poppins', sans-serif", texto: 'Poppins' },
  { valor: "'Montserrat', sans-serif", texto: 'Montserrat' },
  { valor: "'Georgia', serif", texto: 'Georgia (con serifa)' },
  { valor: "'Courier New', monospace", texto: 'Máquina de escribir' },
];

/**
 * El constructor de una página de enlaces (/admin/enlaces/:id).
 *  - pagina: paginaEnlacesDesde · paginas: todas (para no repetir el enlace) · cargando · error · onReintentar
 *  - onGuardar(datos) → promesa (paginaEnlacesAFirestore lo arma el conector) · subirImagen(blob, { alAvanzar }) → url
 *  - clics: { [id de botón o red]: n } · analitica: { porPais, porDispositivo, porDia } (getAnaliticaEnlace)
 *  - pestana + onPestana · urlLista · urlPublica(slug)
 */
export function PaginaEnlaceAdmin({
  pagina, paginas = [], cargando = false, error, onReintentar, onGuardar, subirImagen, clics = {}, analitica,
  pestana: pestanaFuera, onPestana, urlLista = '/admin/enlaces', urlPublica = (slug) => `/l/${slug}`,
}) {
  const toast = useToast();
  const [pestanaDentro, setPestanaDentro] = useState('contenido');
  const pestana = pestanaFuera || pestanaDentro;
  const ir = (p) => (onPestana ? onPestana(p) : setPestanaDentro(p));
  const [d, setD] = useState(pagina);
  const [guardando, setGuardando] = useState(false);
  const [errores, setErrores] = useState({});
  const [verVista, setVerVista] = useState(false);
  useEffect(() => { setD(pagina); }, [pagina]);
  const sucio = Boolean(d && pagina) && !mismo(d, pagina);
  const cambiar = (k, v) => { setD((x) => ({ ...x, [k]: v })); setErrores({}); };
  const diseno = (parcial) => setD((x) => ({ ...x, diseno: { ...x.diseno, ...parcial } }));
  const fondo = (parcial) => setD((x) => ({ ...x, diseno: { ...x.diseno, background: { ...x.diseno.background, ...parcial } } }));
  const tipoFondo = (type) => setD((x) => {
    const bg = x.diseno.background || {};
    let value = bg.value;
    if (type === 'color') value = /^#/.test(value || '') ? value : '#f3f4f6';
    else if (type === 'gradient') value = /gradient/.test(value || '') ? value : GRADIENTES[0].value;
    else if (type === 'pattern') value = PATRONES.some((p) => p.id === value) ? value : PATRONES[0].id;
    else value = /^(https?:|\/|blob:)/.test(value || '') ? value : '';
    return { ...x, diseno: { ...x.diseno, background: { ...bg, type, value } } };
  });
  const guardar = async () => {
    const e = erroresDeEnlaces(d, paginas);
    if (Object.values(e).some(Boolean)) { setErrores(e); ir('contenido'); return; }
    setGuardando(true);
    try {
      await onGuardar?.({ ...d, slug: slugDeEnlace(d.slug || d.nombre) });
      toast({ tipo: 'exito', titulo: 'Página guardada', texto: `wala.pe/l/${slugDeEnlace(d.slug || d.nombre)}` });
    } catch (err) {
      toast({ tipo: 'error', titulo: 'No se pudo guardar', texto: errorDe(err) });
    } finally {
      setGuardando(false);
    }
  };
  const resultados = useMemo(() => (d ? clicsDeEnlaces(clics, d.botones, d.redes) : { filas: [], total: 0 }), [clics, d]);
  const desglose = (items = []) => items.slice(0, 7).map((x) => ({ id: x.key || x.dia, nombre: x.key || x.dia, valor: (x.visitas || 0) + (x.clics || 0), texto: `${entero(x.visitas)} visitas · ${entero(x.clics)} clics` }));

  const cabeza = (
    <CabezaAdmin
      icono="enlaces"
      tono="rosa"
      titulo={pagina?.nombre || 'Página de enlaces'}
      subtitulo={pagina ? `wala.pe/l/${pagina.slug}` : undefined}
      migas={[{ texto: 'Enlaces', to: urlLista }, { texto: pagina?.nombre || 'Página' }]}
      acciones={pagina?.slug ? <Boton tamano="sm" variante="secundario" icono={<ExternalLink aria-hidden="true" />} onClick={() => window.open(urlPublica(pagina.slug), '_blank', 'noopener')}>Ver la página</Boton> : undefined}
    />
  );
  if (error) {
    return (
      <div className={s.pagina} data-componente="PaginaEnlaceAdmin">
        {cabeza}
        <Aviso tipo="error" titulo="No pudimos cargar la página" accion={onReintentar && <Boton tamano="sm" variante="contorno" icono={<RefreshCw aria-hidden="true" />} onClick={onReintentar}>Reintentar</Boton>}>{error}</Aviso>
      </div>
    );
  }
  if (cargando || !d) return <div className={s.pagina}>{cabeza}<p className={s.nota} aria-busy="true">Cargando la página…</p></div>;

  return (
    <div className={s.pagina} data-componente="PaginaEnlaceAdmin">
      {cabeza}
      <div className={s.pestanas}>
        <Pestanas etiqueta="Partes de la página" opciones={PESTANAS} valor={pestana} onChange={ir} />
      </div>
      <div className={s.constructor}>
        <div className={s.editor}>
          {pestana === 'contenido' && (
            <>
              <GrupoCampos titulo="La cabecera">
                <CampoImagen etiqueta="Foto" valor={d.avatar} onCambiar={(url) => cambiar('avatar', url)} subir={subirImagen && ((b, o) => subirImagen(b, { ...o, carpeta: 'avatars' }))} recorte="circulo" forma="circulo" />
                <Campo etiqueta="Título" placeholder="Ej. Walá · Regalos personalizados" value={d.nombre} error={errores.nombre} onChange={(e) => cambiar('nombre', e.target.value)} />
                <Campo etiqueta="Enlace" ayuda={`wala.pe/l/${slugDeEnlace(d.slug || d.nombre) || 'tu-enlace'}`} value={d.slug} error={errores.slug} onChange={(e) => cambiar('slug', e.target.value)} />
                <Campo etiqueta="Descripción" multilinea={2} placeholder="Una frase corta sobre ti o tu marca" value={d.descripcion} onChange={(e) => cambiar('descripcion', e.target.value)} />
                <ElegirUno etiqueta="Estado" opciones={[{ valor: 'activo', texto: 'Activa' }, { valor: 'borrador', texto: 'Borrador' }]} valor={d.estado} onElegir={(v) => v && cambiar('estado', v)} />
              </GrupoCampos>
              <GrupoCampos titulo={`Los botones (${d.botones.length})`} ayuda="Arrastra desde el asa o usa las flechas para ordenarlos.">
                {d.botones.length > 0 && (
                  <ListaOrdenable
                    etiqueta="Orden de los botones"
                    items={d.botones}
                    nombreDe={(b) => b.titulo || 'el botón'}
                    onCambiar={(v) => cambiar('botones', v)}
                    render={(b, i) => (
                      <div className={s.item}>
                        <div className={s.dos}>
                          <Campo etiqueta="Texto del botón" placeholder="Ej. Escríbenos por WhatsApp" value={b.titulo} onChange={(e) => cambiar('botones', d.botones.map((x, j) => (j === i ? { ...x, titulo: e.target.value } : x)))} />
                          <Campo etiqueta="A dónde lleva" type="url" placeholder="https://…" value={b.url} onChange={(e) => cambiar('botones', d.botones.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
                        </div>
                        <details className={s.mas}>
                          <summary>{b.miniatura ? 'Con miniatura' : 'Agregar una miniatura'} · {entero(clics[b.id])} clics</summary>
                          <CampoImagen etiqueta="Miniatura" valor={b.miniatura} onCambiar={(url) => cambiar('botones', d.botones.map((x, j) => (j === i ? { ...x, miniatura: url } : x)))} subir={subirImagen && ((b, o) => subirImagen(b, { ...o, carpeta: 'thumbnails' }))} recorte="cuadrado" forma="cuadro" />
                        </details>
                        <Boton tamano="sm" variante="fantasma" icono={<Trash2 aria-hidden="true" />} onClick={() => cambiar('botones', d.botones.filter((_, j) => j !== i))}>Quitar el botón</Boton>
                      </div>
                    )}
                  />
                )}
                <Boton variante="secundario" icono={<Plus aria-hidden="true" />} onClick={() => cambiar('botones', [...d.botones, botonEnlaceNuevo()])}>Agregar un botón</Boton>
              </GrupoCampos>
              <GrupoCampos titulo={`Las redes (${d.redes.length})`} ayuda="Íconos pequeños en fila, debajo de la cabecera.">
                {d.redes.length > 0 && (
                  <ListaOrdenable
                    etiqueta="Orden de las redes"
                    items={d.redes}
                    nombreDe={(r) => r.nombre || TIPOS_RED.find((x) => x.valor === r.tipo)?.texto || 'la red'}
                    onCambiar={(v) => cambiar('redes', v)}
                    render={(r, i) => (
                      <div className={s.item}>
                        <div className={s.dos}>
                          <Campo etiqueta="Red" opciones={TIPOS_RED} value={r.tipo} onChange={(e) => cambiar('redes', d.redes.map((x, j) => (j === i ? { ...x, tipo: e.target.value } : x)))} />
                          <Campo etiqueta="Nombre" placeholder="Ej. @wala.pe" value={r.nombre} onChange={(e) => cambiar('redes', d.redes.map((x, j) => (j === i ? { ...x, nombre: e.target.value } : x)))} />
                        </div>
                        <Campo etiqueta="A dónde lleva" type="url" placeholder="https://…" value={r.url} onChange={(e) => cambiar('redes', d.redes.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
                        <details className={s.mas}>
                          <summary>{r.icono ? 'Con ícono propio' : 'Usar un ícono propio'} · {entero(clics[r.id])} clics</summary>
                          <CampoImagen etiqueta="Ícono" valor={r.icono} onCambiar={(url) => cambiar('redes', d.redes.map((x, j) => (j === i ? { ...x, icono: url } : x)))} subir={subirImagen && ((b, o) => subirImagen(b, { ...o, carpeta: 'redes' }))} recorte="cuadrado" forma="cuadro" contener />
                        </details>
                        <Boton tamano="sm" variante="fantasma" icono={<Trash2 aria-hidden="true" />} onClick={() => cambiar('redes', d.redes.filter((_, j) => j !== i))}>Quitar la red</Boton>
                      </div>
                    )}
                  />
                )}
                <Boton variante="secundario" icono={<Plus aria-hidden="true" />} onClick={() => cambiar('redes', [...d.redes, redNueva()])}>Agregar una red</Boton>
              </GrupoCampos>
            </>
          )}

          {pestana === 'diseno' && (
            <>
              <GrupoCampos titulo="Un tema" ayuda="Elige uno y después ajusta los colores a tu gusto.">
                <ElegirMuestra
                  etiqueta="Temas"
                  // El que coincide con el diseño de ahora sale elegido.
                  valor={TEMAS.find((t) => mismoTema(t.diseno, d.diseno))?.id}
                  onElegir={(id) => { const t = TEMAS.find((x) => x.id === id); if (t) cambiar('diseno', { ...d.diseno, ...t.diseno, textAlign: d.diseno.textAlign }); }}
                  opciones={TEMAS.map((t) => ({
                    valor: t.id,
                    nombre: t.nombre,
                    estilo: construirFondoStyle(t.diseno.background),
                    contenido: (
                      <>
                        <span className={s.temaPunto} style={{ background: t.diseno.titleColor }} />
                        <span className={s.temaBarra} style={estiloBotonStyle(t.diseno)} />
                      </>
                    ),
                  }))}
                />
              </GrupoCampos>
              <GrupoCampos titulo="Los botones">
                <ElegirUno etiqueta="Estilo" opciones={[{ valor: 'solid', texto: 'Lleno' }, { valor: 'glass', texto: 'Vidrio' }, { valor: 'outline', texto: 'Solo borde' }]} valor={d.diseno.buttonStyle} onElegir={(v) => v && diseno({ buttonStyle: v })} />
                <ElegirUno etiqueta="Sombra" opciones={[{ valor: 'none', texto: 'Sin sombra' }, { valor: 'soft', texto: 'Suave' }, { valor: 'strong', texto: 'Fuerte' }, { valor: 'hard', texto: 'Marcada' }]} valor={d.diseno.buttonShadow} onElegir={(v) => v && diseno({ buttonShadow: v })} />
                <Deslizador etiqueta="Esquinas redondeadas" valor={Number(d.diseno.cornerRoundness) || 0} min={0} max={40} formato={(v) => `${v} px`} onChange={(v) => diseno({ cornerRoundness: v })} />
                <div className={s.dos}>
                  <CampoColor etiqueta="Botón" valor={d.diseno.buttonColor} onCambiar={(v) => diseno({ buttonColor: v })} />
                  <CampoColor etiqueta="Texto del botón" valor={d.diseno.buttonTextColor} onCambiar={(v) => diseno({ buttonTextColor: v })} />
                </div>
              </GrupoCampos>
              <GrupoCampos titulo="Los textos">
                <div className={s.dos}>
                  <CampoColor etiqueta="Título" valor={d.diseno.titleColor} onCambiar={(v) => diseno({ titleColor: v })} />
                  <CampoColor etiqueta="Texto" valor={d.diseno.textColor} onCambiar={(v) => diseno({ textColor: v })} />
                </div>
                <ElegirUno etiqueta="Alineación" opciones={[{ valor: 'left', texto: 'Izquierda' }, { valor: 'center', texto: 'Centro' }, { valor: 'right', texto: 'Derecha' }, { valor: 'justify', texto: 'Justificado' }]} valor={d.diseno.textAlign} onElegir={(v) => v && diseno({ textAlign: v })} />
                <Campo etiqueta="Letra" opciones={FUENTES} value={d.diseno.fontFamily} onChange={(e) => diseno({ fontFamily: e.target.value })} />
              </GrupoCampos>
              <GrupoCampos titulo="El fondo">
                <ElegirUno etiqueta="Fondo" opciones={[{ valor: 'color', texto: 'Color' }, { valor: 'gradient', texto: 'Degradado' }, { valor: 'pattern', texto: 'Textura' }, { valor: 'image', texto: 'Imagen' }]} valor={d.diseno.background.type} onElegir={(v) => v && tipoFondo(v)} />
                {d.diseno.background.type === 'color' && <CampoColor etiqueta="Color de fondo" valor={d.diseno.background.value} onCambiar={(v) => fondo({ value: v })} />}
                {d.diseno.background.type === 'gradient' && (
                  <ElegirMuestra tamano="chica" etiqueta="Degradados" valor={GRADIENTES.find((g) => g.value === d.diseno.background.value)?.id} onElegir={(id) => fondo({ value: GRADIENTES.find((g) => g.id === id)?.value })} opciones={GRADIENTES.map((g) => ({ valor: g.id, nombre: g.nombre, estilo: { background: g.value } }))} />
                )}
                {d.diseno.background.type === 'pattern' && (
                  <>
                    <CampoColor etiqueta="Color de la textura" valor={d.diseno.background.color} onCambiar={(v) => fondo({ color: v })} />
                    <ElegirMuestra tamano="chica" etiqueta="Texturas" valor={d.diseno.background.value} onElegir={(id) => fondo({ value: id })} opciones={PATRONES.map((p) => ({ valor: p.id, nombre: p.nombre, estilo: p.build(d.diseno.background.color || '#4B0055') }))} />
                  </>
                )}
                {d.diseno.background.type === 'image' && <CampoImagen etiqueta="Imagen de fondo" valor={d.diseno.background.value} onCambiar={(url) => fondo({ value: url })} subir={subirImagen && ((b, o) => subirImagen(b, { ...o, carpeta: 'backgrounds' }))} forma="ancho" />}
              </GrupoCampos>
            </>
          )}

          {pestana === 'resultados' && (
            <>
              <FilaCifras etiqueta="Resultados de la página">
                <Cifra nombre="Visitas" valor={entero(d.visitas)} />
                <Cifra nombre="Clics" valor={entero(resultados.total)} ayuda={d.visitas ? `${Math.round((resultados.total / d.visitas) * 100)} % de las visitas` : undefined} tono="exito" />
              </FilaCifras>
              <BloqueMetrica titulo="Clics por botón y red" ayuda="Las redes se cuentan desde el 19/10/2026.">
                <ListaBarras filas={resultados.filas} max={resultados.filas.length || 1} conCeros vacio="Agrega botones para ver sus clics." />
              </BloqueMetrica>
              <ColumnasMetricas>
                <BloqueMetrica titulo="De qué país"><ListaBarras filas={desglose(analitica?.porPais)} vacio="Sin datos aún." /></BloqueMetrica>
                <BloqueMetrica titulo="Desde qué aparato"><ListaBarras filas={desglose(analitica?.porDispositivo)} tono="menta" vacio="Sin datos aún." /></BloqueMetrica>
              </ColumnasMetricas>
              <BloqueMetrica titulo="Los últimos días"><ListaBarras filas={desglose(analitica?.porDia)} vacio="Sin datos aún." /></BloqueMetrica>
            </>
          )}
        </div>
        <aside className={[s.lado, verVista && s.ladoAbierto].filter(Boolean).join(' ')} aria-label="Cómo se ve">
          <Boton tamano="sm" variante="secundario" icono={<Eye aria-hidden="true" />} className={s.verVista} onClick={() => setVerVista((v) => !v)} aria-expanded={verVista}>{verVista ? 'Ocultar la vista previa' : 'Ver cómo se ve'}</Boton>
          <div className={s.vista}><VistaEnlaces d={d} /></div>
        </aside>
      </div>
      <BarraGuardar visible={sucio} onDescartar={() => { setD(pagina); setErrores({}); }} onGuardar={guardar} guardando={guardando} />
    </div>
  );
}
