import React, { useEffect, useMemo, useState } from 'react';
import { Lock, LockOpen, RefreshCw, Languages, ImageDown } from 'lucide-react';
import Boton from '../../Boton';
import { Aviso, Confirmar, EstadoVacio, useToast } from '../../Feedback';
import { Campo, Casilla } from '../../Formulario';
import { Etiqueta } from '../../Etiquetas';
import { Pestanas } from '../../Navegacion';
import { BarraProgreso } from '../../piezas/BarraProgreso';
import { CabezaAdmin } from '../../piezas/admin/Marco';
import { TablaAdmin, BarraFiltros, InsigniaEstado } from '../../piezas/admin/Datos';
import { GrupoCampos, ElegirUno } from '../../piezas/admin/Formularios';
import { Cifra, FilaCifras } from '../../piezas/admin/Metricas';
import { PaginaListaAdmin } from './Lista';
import {
  PERMISOS_ADMIN, erroresDeAdmin, textoPermisos, menuAdminPara, normalizarBusqueda,
  textoConteoImagenes, textoResultadoImagenes, traduccionesPorIdioma,
} from '../../adaptadoresAdmin';
import l from './Lista.module.css';
import s from './Configuracion.module.css';
import { EsqueletoTexto } from '../../Esqueletos';

/*
 * D8a · Configuración (/admin/configuracion, solo Super Admin): quién del
 * equipo entra al panel y con qué permisos (y qué ve con ellos), qué
 * páginas no se pueden guardar desde el editor, y dos tareas de
 * mantenimiento: pasar las imágenes viejas a WebP y publicar las
 * traducciones que se juntaron navegando.
 */

const entero = (n) => new Intl.NumberFormat('es-PE').format(Math.round(Number(n) || 0));
const errorDe = (err) => err?.message || 'Vuelve a intentar.';
// Las imágenes y los idiomas van juntos (como antes): con cuatro pestañas, la última no cabía en el celular (ni «Mantenimiento»).
const PESTANAS = [{ id: 'equipo', texto: 'Equipo' }, { id: 'bloqueos', texto: 'Bloqueos' }, { id: 'optimizar', texto: 'Optimizar' }];
/** Cuántas opciones del menú abre (sin contar el inicio, que lo ve cualquiera). */
const seccionesQueVe = (permisos) => menuAdminPara(permisos).reduce((t, g) => t + g.items.length, 0) - 1;
const ESTADOS_BLOQUEO = { si: { texto: 'Bloqueada', tono: 'aviso' }, no: { texto: 'Abierta', tono: 'exito' } };
const AMBITOS = [
  { valor: 'diseno', texto: 'Diseño de tienda', nota: 'Los banners, los slides del hero y los logos y fondos de marca: se ven en todas las páginas, pero son pocos.' },
  { valor: 'productos', texto: 'Productos', nota: 'Las fotos del catálogo: las descarga cualquiera que entre a la tienda, así que es donde más se nota. Son muchas: puede tardar bastante.' },
];

/** Qué secciones del menú abre alguien con estos permisos. */
function LoQueVe({ permisos = [] }) {
  const grupos = menuAdminPara(permisos).filter((g) => g.id !== 'inicio');
  if (permisos.includes('superadmin')) return <p className={s.ve}><strong>Ve todo el panel</strong>, también esta página.</p>;
  if (!grupos.length) return <p className={s.ve}>Con ningún permiso, solo ve el inicio.</p>;
  return (
    <div className={s.ve}>
      <strong>Con estos permisos ve:</strong>
      <ul>
        {grupos.map((g) => <li key={g.id}><span>{g.titulo}</span> {g.items.map((it) => it.texto).join(', ')}</li>)}
      </ul>
    </div>
  );
}

/** Las páginas fijas y las landing pages, con su candado. */
function Bloqueos({ paginas = [], cargando, error, onReintentar, onBloquear }) {
  const toast = useToast();
  const [busqueda, setBusqueda] = useState('');
  const [cambiando, setCambiando] = useState(null);
  const filas = useMemo(() => {
    const q = normalizarBusqueda(busqueda);
    return paginas.filter((p) => !q || normalizarBusqueda(`${p.nombre} ${p.ruta}`).includes(q));
  }, [paginas, busqueda]);
  const bloqueadas = paginas.filter((p) => p.bloqueada).length;
  const alternar = async (p) => {
    setCambiando(p.id);
    try {
      await onBloquear?.(p.id, !p.bloqueada);
      toast({ tipo: 'exito', titulo: p.bloqueada ? 'Página abierta' : 'Página bloqueada', texto: p.bloqueada ? `«${p.nombre}» se puede volver a guardar.` : `Nadie puede guardar «${p.nombre}» desde el editor.` });
    } catch (err) {
      toast({ tipo: 'error', titulo: 'No se pudo cambiar', texto: errorDe(err) });
    } finally {
      setCambiando(null);
    }
  };
  return (
    <>
      <Aviso tipo="aviso" icono={<Lock aria-hidden="true" />} titulo="Una página bloqueada no se puede guardar desde el editor, ni siquiera por ti.">
        Sirve para que nadie la cambie sin querer. Para editarla, ábrela aquí primero.
      </Aviso>
      <BarraFiltros busqueda={busqueda} onBusqueda={setBusqueda} placeholder="Buscar una página" total={cargando || error ? undefined : filas.length} unidad={['página', 'páginas']}>
        {!cargando && !error && <span className={s.nota}>{bloqueadas ? `${bloqueadas} bloqueada${bloqueadas === 1 ? '' : 's'}` : 'Ninguna bloqueada'}</span>}
      </BarraFiltros>
      <TablaAdmin
        etiqueta="Páginas"
        filas={filas}
        nombreDe={(p) => p.nombre}
        cargando={cargando}
        error={error}
        onReintentar={onReintentar}
        vacio={{ titulo: 'Ninguna página se llama así' }}
        columnas={[
          { id: 'nombre', titulo: 'Página', tarjeta: 'titulo', celda: (p) => <>{p.nombre}<span className={l.sub}>{p.ruta}</span></> },
          { id: 'tipo', titulo: 'Tipo', ancho: 150, tarjeta: 'detalle', celda: (p) => (p.tipo === 'landing' ? 'Landing page' : 'Fija') },
          { id: 'estado', titulo: 'Estado', ancho: 150, tarjeta: 'estado', celda: (p) => <InsigniaEstado estado={p.bloqueada ? 'si' : 'no'} estados={ESTADOS_BLOQUEO} /> },
          { id: 'accion', titulo: '', ancho: 150, tarjeta: 'control', celda: (p) => (
            <Boton tamano="sm" variante="secundario" icono={p.bloqueada ? <LockOpen aria-hidden="true" /> : <Lock aria-hidden="true" />} cargando={cambiando === p.id} onClick={() => alternar(p)}>
              {p.bloqueada ? 'Abrir' : 'Bloquear'}
            </Boton>
          ) },
        ]}
      />
    </>
  );
}

/** Pasar a WebP lo que se subió antes (PNG, JPG o más de 2000 px). */
function Imagenes({ onRevisar, onConvertir }) {
  const [ambito, setAmbito] = useState('diseno');
  const [conteo, setConteo] = useState(null); // null · 'cargando' · { error } · { imagenes, documentos, apariciones, ambito }
  const [progreso, setProgreso] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [preguntar, setPreguntar] = useState(false);
  const trabajando = Boolean(progreso);

  // Al terminar de convertir se revisa de nuevo sin borrar el resultado.
  const revisar = async (cual = ambito, { conservar = false } = {}) => {
    setConteo('cargando');
    if (!conservar) setResultado(null);
    try {
      setConteo({ ...(await onRevisar?.(cual)), ambito: cual });
    } catch (err) {
      setConteo({ error: errorDe(err) });
    }
  };
  useEffect(() => { revisar('diseno'); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const elegir = (v) => {
    if (!v || trabajando || v === ambito) return;
    setAmbito(v);
    revisar(v);
  };
  const convertir = async () => {
    setPreguntar(false);
    setResultado(null);
    setProgreso({ hechas: 0, total: conteo.apariciones || conteo.imagenes, actual: '' });
    try {
      setResultado(await onConvertir?.(ambito, { alAvanzar: setProgreso }));
    } catch (err) {
      setResultado({ convertidas: 0, documentos: 0, saltadas: 0, errores: [errorDe(err)] });
    } finally {
      setProgreso(null);
    }
    revisar(ambito, { conservar: true });
  };
  const listo = conteo && typeof conteo.imagenes === 'number' && conteo.ambito === ambito;
  const nota = AMBITOS.find((a) => a.valor === ambito)?.nota;

  return (
    <div className={s.tarea}>
      <GrupoCampos titulo="Optimizar imágenes antiguas" ayuda="Lo que subes ahora ya se guarda en WebP y con 2000 px de lado como máximo. Esto es para lo de antes: las que siguen en PNG o JPG y las WebP más grandes de 2000 px.">
        <ElegirUno etiqueta="Qué revisar" opciones={AMBITOS} valor={ambito} onElegir={elegir} disabled={trabajando} />
        <p className={s.nota}>{nota} Los originales <strong>no se borran</strong>; las imágenes de fuera (Drive y demás), los SVG y los GIF se dejan como están.</p>
        {conteo === 'cargando' && <EsqueletoTexto lineas={1} />}
        {conteo?.error && <Aviso tipo="error" compacto titulo="No se pudo revisar">{conteo.error}</Aviso>}
        {listo && (
          <>
            {conteo.imagenes > 0 && (
              <FilaCifras etiqueta="Por revisar">
                <Cifra nombre="Imágenes" valor={entero(conteo.imagenes)} />
                <Cifra nombre="Documentos" valor={entero(conteo.documentos)} tono="cielo" />
              </FilaCifras>
            )}
            <p className={s.nota}>{textoConteoImagenes(conteo)}</p>
          </>
        )}
        {progreso && <BarraProgreso valor={progreso.hechas} max={progreso.total || 1} minimo={2} texto={<><strong>{entero(progreso.hechas)}</strong> de {entero(progreso.total)}{progreso.actual ? ` · ${progreso.actual}` : ''}</>} />}
        {progreso && <p className={s.nota}>No cierres esta pestaña mientras corre.</p>}
        {resultado && (
          <Aviso tipo={resultado.errores?.length ? 'aviso' : 'exito'} titulo="Listo" compacto>
            {textoResultadoImagenes(resultado)}
            {resultado.errores?.length > 0 && (
              <details className={s.errores}>
                <summary>{resultado.errores.length === 1 ? '1 no se pudo convertir' : `${resultado.errores.length} no se pudieron convertir`}</summary>
                <ul>{resultado.errores.map((e, i) => <li key={i}>{e}</li>)}</ul>
              </details>
            )}
          </Aviso>
        )}
        <div className={s.botones}>
          <Boton variante="secundario" icono={<RefreshCw aria-hidden="true" />} disabled={trabajando || conteo === 'cargando'} onClick={() => revisar()}>Volver a revisar</Boton>
          <Boton icono={<ImageDown aria-hidden="true" />} disabled={!listo || !conteo.imagenes} cargando={trabajando} onClick={() => setPreguntar(true)}>{trabajando ? 'Convirtiendo…' : 'Convertir a WebP'}</Boton>
        </div>
      </GrupoCampos>
      <Confirmar
        abierta={preguntar}
        titulo={listo ? `¿Pasar a WebP ${conteo.imagenes === 1 ? 'la imagen' : `las ${entero(conteo.imagenes)} imágenes`}?` : ''}
        texto="Las que lo necesiten se vuelven a subir en WebP y se cambia su enlace en cada documento. Los originales no se borran. Puede tardar un rato: no cierres la pestaña."
        confirmar="Convertir"
        onConfirmar={convertir}
        onCancelar={() => setPreguntar(false)}
      />
    </div>
  );
}

/** Publicar las traducciones que el traductor fue juntando en este navegador. */
function Idiomas({ onRevisar, onPublicar }) {
  const toast = useToast();
  const [pendientes, setPendientes] = useState(null);
  const [publicando, setPublicando] = useState(false);
  const revisar = async () => {
    try { setPendientes(traduccionesPorIdioma(await onRevisar?.())); } catch { setPendientes([]); }
  };
  useEffect(() => { revisar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const total = (pendientes || []).reduce((t, x) => t + x.cuantas, 0);
  const publicar = async () => {
    setPublicando(true);
    try {
      const r = await onPublicar?.();
      if (r?.error) throw new Error(r.error);
      toast({ tipo: 'exito', titulo: r?.guardadas ? `${entero(r.guardadas)} traducci${r.guardadas === 1 ? 'ón publicada' : 'ones publicadas'}` : 'No había nada nuevo', texto: 'Los visitantes las reciben ya hechas.' });
      await revisar();
    } catch (err) {
      toast({ tipo: 'error', titulo: 'No se pudieron publicar', texto: errorDe(err) });
    } finally {
      setPublicando(false);
    }
  };
  return (
    <div className={s.tarea}>
      <GrupoCampos titulo="Publicar las traducciones" ayuda="Los nombres de producto y los textos del editor se traducen al vuelo cuando alguien navega en inglés o portugués. Publicadas, el resto de visitantes las recibe ya hechas.">
        {pendientes === null && <EsqueletoTexto lineas={1} />}
        {pendientes && (total
          ? (
            <FilaCifras etiqueta="Sin publicar">
              {pendientes.map((x) => <Cifra key={x.idioma} nombre={`${x.nombre}, sin publicar`} valor={entero(x.cuantas)} />)}
            </FilaCifras>
          )
          : <p className={s.nota}>No hay traducciones nuevas sin publicar.</p>)}
        <p className={s.nota}>Se juntan en este navegador: para llenar la lista, cambia el idioma y recorre la tienda; después vuelve aquí. Solo un administrador puede publicarlas.</p>
        <div className={s.botones}>
          <Boton variante="secundario" icono={<RefreshCw aria-hidden="true" />} disabled={publicando} onClick={revisar}>Volver a revisar</Boton>
          <Boton icono={<Languages aria-hidden="true" />} disabled={!total} cargando={publicando} onClick={publicar}>Publicar traducciones</Boton>
        </div>
      </GrupoCampos>
    </div>
  );
}

/**
 * Configuración (/admin/configuracion).
 *  - esSuperadmin (si no, solo un aviso) · yo (el correo de quien mira) · pestana + onPestana
 *  - admins: [adminDesdeFirestore] · cargando · error · onReintentar
 *    onGuardarAdmin(datos, id?) (adminAFirestore) · onEliminarAdmin(id)
 *  - paginas: [paginasBloqueables] · cargandoPaginas · errorPaginas · onReintentarPaginas · onBloquear(id, bloquear)
 *  - onRevisarImagenes(ambito: 'diseno' | 'productos') → { imagenes, documentos, apariciones }
 *    onConvertirImagenes(ambito, { alAvanzar({ hechas, total, actual }) }) → { convertidas, documentos, saltadas, errores }
 *  - onRevisarTraducciones() → { en: n, pt: n } · onPublicarTraducciones() → { guardadas, error }
 */
export function PaginaConfiguracionAdmin({
  esSuperadmin = true, yo = '', pestana: pestanaFuera, onPestana,
  admins = [], cargando = false, error, onReintentar, onGuardarAdmin, onEliminarAdmin,
  paginas = [], cargandoPaginas = false, errorPaginas, onReintentarPaginas, onBloquear,
  onRevisarImagenes, onConvertirImagenes, onRevisarTraducciones, onPublicarTraducciones,
}) {
  const [pestanaDentro, setPestanaDentro] = useState('equipo');
  const pestana = pestanaFuera || pestanaDentro;
  const ir = (p) => (onPestana ? onPestana(p) : setPestanaDentro(p));
  const cabeza = { icono: 'admins', tono: 'plata', titulo: 'Configuración', subtitulo: 'Quién del equipo entra al panel, qué páginas no se tocan y el mantenimiento de la tienda.' };
  const secciones = <div className={s.pestanas}><Pestanas etiqueta="Partes de la configuración" opciones={PESTANAS} valor={pestana} onChange={ir} /></div>;
  const esYo = (r) => Boolean(yo) && r.correo === yo.trim().toLowerCase();

  if (!esSuperadmin) {
    return (
      <div className={s.pagina} data-componente="PaginaConfiguracionAdmin">
        <CabezaAdmin {...cabeza} />
        <EstadoVacio imagen={null} icono={<Lock aria-hidden="true" />} titulo="Solo para Super Admin" texto="Pídele a un Super Admin del equipo que te dé acceso, o que haga el cambio por ti." />
      </div>
    );
  }

  if (pestana === 'equipo') {
    return (
      <PaginaListaAdmin
        cabeza={cabeza}
        antes={(
          <>
            {secciones}
            <p className={s.nota}>Cada persona entra con su cuenta de Google; los permisos deciden qué ve en el menú.</p>
          </>
        )}
        registros={admins}
        cargando={cargando}
        error={error}
        onReintentar={onReintentar}
        unidad={['persona', 'personas']}
        femenino
        buscarEn={(r) => `${r.nombre} ${r.correo}`}
        placeholder="Buscar por nombre o correo"
        filtros={[{ id: 'permiso', etiqueta: 'Permiso', todos: 'Todos', opciones: PERMISOS_ADMIN, filtrar: (r, v) => r.permisos.includes(v) }]}
        columnas={[
          { id: 'nombre', titulo: 'Persona', tarjeta: 'titulo', celda: (r) => <span className={s.persona}><span>{r.nombre}<span className={l.sub}>{r.correo}</span></span>{esYo(r) && <Etiqueta tono="violeta">Tú</Etiqueta>}</span> },
          { id: 'permisos', titulo: 'Permisos', tarjeta: 'detalle', celda: (r) => textoPermisos(r.permisos) },
          { id: 've', titulo: 'Ve', ancho: 140, alinear: 'fin', tarjeta: 'detalle', celda: (r) => (r.permisos.includes('superadmin')
            ? 'Todo'
            : <span className={l.numero}>{seccionesQueVe(r.permisos) === 1 ? '1 sección' : `${seccionesQueVe(r.permisos)} secciones`}</span>) },
        ]}
        vacio={{ titulo: 'Todavía no hay nadie en el equipo', texto: 'Agrega a alguien con su correo de Google.' }}
        textos={{ creado: 'Persona agregada', guardado: 'Permisos guardados', eliminado: 'Ya no entra al panel' }}
        eliminar={{
          texto: (r) => `${r.nombre} deja de entrar al panel. Su cuenta de cliente sigue igual.`,
          bloqueado: (r) => (esYo(r) ? 'No puedes quitarte a ti mismo: pídeselo a otro Super Admin.' : null),
        }}
        onGuardar={onGuardarAdmin}
        onEliminar={onEliminarAdmin}
        formulario={{
          nuevo: 'Agregar persona',
          titulos: { nuevo: 'Agregar al equipo', editar: 'Editar permisos' },
          textoGuardar: { nuevo: 'Agregar', editar: 'Guardar permisos' },
          vacio: () => ({ correo: '', nombre: '', permisos: [] }),
          desde: (r) => ({ correo: r.correo, nombre: r.nombre, permisos: r.permisos }),
          validar: (d, { id, registros }) => erroresDeAdmin(d, { id, registros, yo }),
          campos: ({ datos: d, cambiar, errores, idDe, id }) => {
            const superadmin = d.permisos.includes('superadmin');
            const marcar = (v, si) => cambiar('permisos', si ? [...d.permisos, v] : d.permisos.filter((x) => x !== v));
            return (
              <>
                <GrupoCampos titulo="La persona">
                  <Campo
                    id={idDe('correo')}
                    etiqueta="Correo de Google"
                    type="email"
                    inputMode="email"
                    autoComplete="off"
                    placeholder="nombre@gmail.com"
                    disabled={Boolean(id)}
                    ayuda={id ? 'El correo es su llave: para cambiarlo, agrégala de nuevo y quita esta.' : 'El mismo con el que entra a Walá.'}
                    value={d.correo}
                    error={errores.correo}
                    onChange={(e) => cambiar('correo', e.target.value)}
                  />
                  <Campo etiqueta="Nombre" placeholder={d.correo ? d.correo.split('@')[0] : 'Ej. Juan Pérez'} ayuda="Para reconocerla en la lista." value={d.nombre} onChange={(e) => cambiar('nombre', e.target.value)} />
                </GrupoCampos>
                <GrupoCampos titulo="Permisos">
                  <div className={s.permisos} id={idDe('permisos')} tabIndex={-1}>
                    {PERMISOS_ADMIN.map((p) => (
                      <Casilla
                        key={p.valor}
                        etiqueta={p.texto}
                        descripcion={superadmin && p.valor !== 'superadmin' ? 'Ya va incluido en Super Admin.' : p.detalle}
                        activo={superadmin || d.permisos.includes(p.valor)}
                        disabled={superadmin && p.valor !== 'superadmin'}
                        onChange={(si) => marcar(p.valor, si)}
                      />
                    ))}
                  </div>
                  {errores.permisos && <p className={s.error}>{errores.permisos}</p>}
                  <LoQueVe permisos={d.permisos} />
                </GrupoCampos>
              </>
            );
          },
        }}
      />
    );
  }

  return (
    <div className={s.pagina} data-componente="PaginaConfiguracionAdmin">
      <CabezaAdmin {...cabeza} />
      {secciones}
      {pestana === 'bloqueos' && <Bloqueos paginas={paginas} cargando={cargandoPaginas} error={errorPaginas} onReintentar={onReintentarPaginas} onBloquear={onBloquear} />}
      {pestana === 'optimizar' && (
        <>
          <Imagenes onRevisar={onRevisarImagenes} onConvertir={onConvertirImagenes} />
          <Idiomas onRevisar={onRevisarTraducciones} onPublicar={onPublicarTraducciones} />
        </>
      )}
    </div>
  );
}
