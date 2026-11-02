import React, { useMemo, useState } from 'react';
import { ExternalLink, Gift, Plus, RefreshCw, Sparkles, Trash2, Users } from 'lucide-react';
import Boton from '../../Boton';
import { Aviso } from '../../Feedback';
import { Campo, Interruptor } from '../../Formulario';
import { Pestanas } from '../../Navegacion';
import { CabezaAdmin } from '../../piezas/admin/Marco';
import { TablaAdmin, BarraFiltros, InsigniaEstado } from '../../piezas/admin/Datos';
import { GrupoCampos, CampoImagen, CampoDinero, CampoColor, ElegirUno, CampoLista } from '../../piezas/admin/Formularios';
import { Cifra, FilaCifras, BloqueMetrica, ColumnasMetricas } from '../../piezas/admin/Metricas';
import { PaginaListaAdmin } from './Lista';
import { FotoCelda, porOrden } from './celdas';
import { GanadoresSorteo, AjusteSorteo, datosDeAjuste } from './Sorteos';
import {
  slugDeSorteo, ESTADOS_SORTEO, INTERVALOS_PLAN, planNuevo, planConIntervalo, erroresDeCampanaSuscripcion, textoDePlanes,
  ESTADOS_SUSCRIPTOR, normalizarBusqueda,
} from '../../adaptadoresAdmin';
import l from './Lista.module.css';
import s from './Sorteos.module.css';
import u from './Suscripciones.module.css';

/*
 * D6b · Sorteos por suscripción (/admin/sorteos-suscripcion y su detalle):
 * campañas con planes de pago automático (Culqi/PayPal); solo los
 * suscriptores al día participan y a más meses, más chances. En el detalle,
 * los suscriptores y los ganadores, y lo que muestra la página: los
 * beneficios y la galería de ganadores de antes.
 */

const entero = (n) => new Intl.NumberFormat('es-PE').format(Math.round(Number(n) || 0));
const soles = (n) => `S/ ${(Number(n) || 0).toFixed(2)}`;
const fecha = (ms) => (ms ? new Date(ms).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const COLORES = [['primario', 'Títulos'], ['acento', 'Lo destacado'], ['fondo', 'Fondo'], ['texto', 'Texto']];
const VACIA = { nombre: '', slug: '', descripcion: '', estado: 'borrador', numGanadores: 1, portada: '', logo: '', colores: { primario: '#111111', fondo: '#ffffff', texto: '#111111', acento: '#e60023' }, premios: [], planes: [] };

/** Cómo se ve la página de la campaña, con sus colores y planes. */
function MuestraCampana({ d }) {
  return (
    <div className={u.muestra} style={{ '--c-fondo': d.colores.fondo, '--c-texto': d.colores.texto, '--c-primario': d.colores.primario, '--c-acento': d.colores.acento }} aria-label="Vista previa de la campaña">
      {d.portada ? <img src={d.portada} alt="" className={s.muestraPortada} /> : <span className={s.muestraSinPortada}>Sin imagen principal</span>}
      <span className={u.muestraCuerpo}>
        {d.logo && <img src={d.logo} alt="" className={u.muestraLogo} />}
        <strong className={u.muestraTitulo}>{d.nombre || 'El título de la campaña'}</strong>
        <span>{d.descripcion || 'Aquí va la descripción.'}</span>
        {d.planes.length > 0 && (
          <span className={u.muestraPlanes}>
            {d.planes.map((p) => (
              <span key={p.id} className={[u.muestraPlan, p.destacado && u.muestraDestacado].filter(Boolean).join(' ')}>
                <strong>{p.nombre || 'Plan'}</strong>
                <span>{soles(p.precio)}</span>
                <span className={u.muestraChances}>{p.chances} {Number(p.chances) === 1 ? 'chance' : 'chances'} por ciclo</span>
              </span>
            ))}
          </span>
        )}
      </span>
    </div>
  );
}

/** Un plan en la hoja: nombre, ciclo, chances, precios, beneficios y si va destacado. */
function EditorPlan({ plan: p, numero, onCambiar, onQuitar }) {
  const cambiar = (k, v) => onCambiar({ ...p, [k]: v });
  return (
    <article className={u.plan}>
      <header className={u.planCabeza}>
        <strong>Plan {numero}</strong>
        <Boton tamano="sm" variante="fantasma" icono={<Trash2 aria-hidden="true" />} onClick={onQuitar}>Quitar</Boton>
      </header>
      <Campo etiqueta="Nombre" placeholder="Ej. Plan mensual" value={p.nombre} onChange={(e) => cambiar('nombre', e.target.value)} />
      <div className={s.dos}>
        <Campo etiqueta="Se cobra" opciones={INTERVALOS_PLAN} value={p.intervalo} onChange={(e) => onCambiar(planConIntervalo(p, e.target.value))} />
        <Campo etiqueta="Chances por cobro" ayuda={`Lo normal: una por mes (${p.meses}).`} type="number" inputMode="numeric" min={0} value={p.chances} onChange={(e) => cambiar('chances', e.target.value)} />
      </div>
      <div className={s.dos}>
        <CampoDinero etiqueta="Precio (Culqi)" value={p.precio} onChange={(e) => cambiar('precio', e.target.value)} />
        <CampoDinero etiqueta="Precio en dólares (PayPal)" moneda="$" value={p.precioUsd} onChange={(e) => cambiar('precioUsd', e.target.value)} />
      </div>
      <CampoLista etiqueta="Beneficios" valores={p.beneficios} onCambiar={(v) => cambiar('beneficios', v)} textoCampo="Agregar un beneficio" placeholder="Ej. Envío gratis" />
      <Interruptor etiqueta="Destacado" descripcion="Sale resaltado en la página (el plan recomendado)." activo={p.destacado} onChange={(v) => cambiar('destacado', v)} />
    </article>
  );
}

/**
 * Sorteos por suscripción (/admin/sorteos-suscripcion).
 *  - campanas: [campanaSuscripcionDesde] · cargando · error · onReintentar
 *  - onGuardar(datos, id?) · onEliminar(id) · subirImagen(blob, { alAvanzar }) → url
 *  - onDetalle(campana, pestana?) ('suscriptores' | 'beneficios' | 'galeria') · urlPublica(campana) · dominio
 */
export function PaginaSuscripcionesAdmin({ campanas = [], cargando, error, onReintentar, onGuardar, onEliminar, subirImagen, onDetalle, urlPublica = (c) => `/suscrito-sorteo/${c.slug}`, dominio = 'wala.pe' }) {
  return (
    <PaginaListaAdmin
      cabeza={{ icono: 'sorteos', tono: 'rosa', titulo: 'Sorteos por suscripción', subtitulo: 'Campañas con pago automático: solo los suscriptores al día participan y a más meses, más chances.' }}
      registros={campanas}
      cargando={cargando}
      error={error}
      onReintentar={onReintentar}
      femenino
      unidad={['campaña', 'campañas']}
      buscarEn={(c) => `${c.nombre} ${c.slug}`}
      placeholder="Buscar una campaña"
      filtros={[{ id: 'estado', etiqueta: 'Estado', todos: 'Todas', opciones: [{ valor: 'activo', texto: 'Activas' }, { valor: 'borrador', texto: 'Borradores' }, { valor: 'cerrado', texto: 'Cerradas' }], filtrar: (c, v) => c.estado === v }]}
      columnas={[
        { id: 'foto', titulo: 'Foto', ancho: 72, tarjeta: 'foto', celda: (c) => <FotoCelda src={c.portada || c.logo} /> },
        { id: 'nombre', titulo: 'Campaña', tarjeta: 'titulo', celda: (c) => <>{c.nombre}<span className={l.sub}>{c.premios.length ? `Premios: ${c.premios.map((x) => x.nombre).filter(Boolean).join(', ')}` : `${dominio}/suscrito-sorteo/${c.slug}`}</span></> },
        { id: 'planes', titulo: 'Planes', ancho: 190, tarjeta: 'detalle', celda: (c) => textoDePlanes(c.planes) },
        { id: 'suscriptores', titulo: 'Suscriptores', ancho: 120, alinear: 'fin', tarjeta: 'detalle', celda: (c) => <span className={l.numero}>{c.suscriptores == null ? '—' : entero(c.suscriptores)}<span className={l.sub}>{c.numGanadores} {c.numGanadores === 1 ? 'ganador' : 'ganadores'}</span></span> },
        { id: 'estado', titulo: 'Estado', ancho: 110, tarjeta: 'estado', celda: (c) => <InsigniaEstado estado={c.estado} estados={ESTADOS_SORTEO}>{c.estado === 'activo' ? 'Activa' : c.estado === 'cerrado' ? 'Cerrada' : 'Borrador'}</InsigniaEstado> },
      ]}
      vacio={{ titulo: 'Todavía no hay campañas', texto: 'Crea la primera: sus planes, sus premios y sus colores.' }}
      textos={{ creado: 'Campaña creada', guardado: 'Campaña guardada', eliminado: 'Campaña eliminada' }}
      eliminar={{
        texto: (c) => `Se borra «${c.nombre}» y su página deja de existir. No se puede deshacer.`,
        bloqueado: (c) => (c.estado === 'activo' && c.suscriptores ? 'Tiene suscriptores y está activa: ciérrala primero (los cobros automáticos siguen hasta que cada uno cancele).' : null),
      }}
      masAcciones={(c) => [
        ...(onDetalle ? [
          { id: 'suscriptores', etiqueta: 'Suscriptores y ganadores', Icono: Users, accion: () => onDetalle(c, 'suscriptores') },
          { id: 'beneficios', etiqueta: 'Beneficios y galería', Icono: Gift, accion: () => onDetalle(c, 'beneficios') },
        ] : []),
        ...(c.slug ? [{ id: 'publica', etiqueta: 'Ver la página', Icono: ExternalLink, accion: () => window.open(urlPublica(c), '_blank', 'noopener') }] : []),
      ]}
      onGuardar={onGuardar}
      onEliminar={onEliminar}
      formulario={{
        nuevo: 'Nueva campaña',
        titulos: { nuevo: 'Nueva campaña', editar: 'Editar campaña' },
        textoGuardar: { nuevo: 'Crear campaña' },
        vacio: () => ({ ...VACIA, colores: { ...VACIA.colores }, planes: [{ ...planNuevo(), nombre: 'Mensual' }] }),
        desde: (c) => ({ ...VACIA, ...c, id: undefined }),
        validar: (d) => erroresDeCampanaSuscripcion(d),
        campos: ({ datos: d, cambiar, errores, idDe }) => (
          <>
            <GrupoCampos titulo="La campaña">
              <Campo id={idDe('nombre')} etiqueta="Título" placeholder="Ej. No hay sin suerte" value={d.nombre} error={errores.nombre} onChange={(e) => cambiar('nombre', e.target.value)} />
              <Campo etiqueta="Enlace" ayuda={`${dominio}/suscrito-sorteo/${slugDeSorteo(d.slug || d.nombre) || 'tu-campana'} · sale del título; puedes cambiarlo.`} placeholder={slugDeSorteo(d.nombre) || 'sale-del-titulo'} value={d.slug} onChange={(e) => cambiar('slug', e.target.value)} />
              <Campo etiqueta="Descripción" multilinea={3} placeholder="Cómo funciona la suscripción y el sorteo" value={d.descripcion} onChange={(e) => cambiar('descripcion', e.target.value)} />
              <div className={s.dos}>
                <Campo id={idDe('numGanadores')} etiqueta="Ganadores por sorteo" type="number" inputMode="numeric" min={1} value={d.numGanadores} error={errores.numGanadores} onChange={(e) => cambiar('numGanadores', e.target.value)} />
              </div>
              <ElegirUno etiqueta="Estado" opciones={[{ valor: 'borrador', texto: 'Borrador' }, { valor: 'activo', texto: 'Activa' }, { valor: 'cerrado', texto: 'Cerrada' }]} valor={d.estado} onElegir={(v) => v && cambiar('estado', v)} />
            </GrupoCampos>
            <GrupoCampos titulo="Los planes" ayuda="El precio lo cobra el servidor del plan; quien se suscribe elige uno.">
              <span id={idDe('planes')} tabIndex={-1} className={u.ancla} />
              {errores.planes && <Aviso tipo="error" compacto>{errores.planes}</Aviso>}
              {d.planes.map((p, i) => (
                <EditorPlan key={p.id} plan={p} numero={i + 1} onCambiar={(x) => cambiar('planes', d.planes.map((y, j) => (j === i ? x : y)))} onQuitar={() => cambiar('planes', d.planes.filter((_, j) => j !== i))} />
              ))}
              <Boton variante="secundario" icono={<Plus aria-hidden="true" />} onClick={() => cambiar('planes', [...d.planes, planNuevo()])}>Agregar un plan</Boton>
            </GrupoCampos>
            <GrupoCampos titulo="Los premios">
              {d.premios.map((x, i) => (
                <div key={i} className={u.premio}>
                  <Campo etiqueta={`Premio ${i + 1}`} placeholder="Ej. Casaca de tu anime favorito" value={x.nombre} onChange={(e) => cambiar('premios', d.premios.map((y, j) => (j === i ? { ...y, nombre: e.target.value } : y)))} />
                  <CampoImagen etiqueta="Su foto" valor={x.imagen} onCambiar={(url) => cambiar('premios', d.premios.map((y, j) => (j === i ? { ...y, imagen: url } : y)))} subir={subirImagen} recorte="cuadrado" forma="cuadro" />
                  <Boton tamano="sm" variante="fantasma" icono={<Trash2 aria-hidden="true" />} onClick={() => cambiar('premios', d.premios.filter((_, j) => j !== i))}>Quitar el premio</Boton>
                </div>
              ))}
              <Boton variante="secundario" icono={<Plus aria-hidden="true" />} onClick={() => cambiar('premios', [...d.premios, { nombre: '', imagen: '' }])}>Agregar un premio</Boton>
            </GrupoCampos>
            <GrupoCampos titulo="Cómo se ve">
              <CampoImagen etiqueta="Imagen principal" valor={d.portada} onCambiar={(url) => cambiar('portada', url)} subir={subirImagen} forma="ancho" />
              <CampoImagen etiqueta="Logo" valor={d.logo} onCambiar={(url) => cambiar('logo', url)} subir={subirImagen} forma="cuadro" contener />
              <div className={s.dos}>
                {COLORES.map(([k, t]) => <CampoColor key={k} etiqueta={t} valor={d.colores[k]} onCambiar={(v) => cambiar('colores', { ...d.colores, [k]: v })} />)}
              </div>
              <MuestraCampana d={d} />
            </GrupoCampos>
          </>
        ),
      }}
    />
  );
}

/* ── El detalle de una campaña ─────────────────────────── */

const PESTANAS = [
  { id: 'suscriptores', texto: 'Sorteo' },
  { id: 'beneficios', texto: 'Beneficios' },
  { id: 'galeria', texto: 'Galería' },
];

/**
 * Una campaña (/admin/sorteos-suscripcion/:id).
 *  - campana: campanaSuscripcionDesde · contador (los suscriptores, de los shards) · cargando · error · onReintentar
 *  - pestana + onPestana · urlLista · urlPublica
 *  - suscriptores: [suscriptorDesde] (los primeros 200) · onDarChances({ …, chances, motivo }) → { chancesTotal }
 *  - onDecidirGanadores({ numGanadores?, excluirUids? }) → { ganadores, drawId, seed, poolHash, totalElegibles }
 *  - beneficios: [beneficioDesde] · onGuardarBeneficio(datos, id?) · onEliminarBeneficio(id)
 *  - galeria: [ganadorGaleriaDesde] · onGuardarGanador(datos, id?) · onEliminarGanador(id)
 *  - subirImagen(blob, { alAvanzar }) → url
 */
export function PaginaSuscripcionAdmin({
  campana, contador, cargando = false, error, onReintentar, pestana: pestanaFuera, onPestana, urlLista = '/admin/sorteos-suscripcion', urlPublica,
  suscriptores = [], onDarChances, onDecidirGanadores,
  beneficios = [], onGuardarBeneficio, onEliminarBeneficio, galeria = [], onGuardarGanador, onEliminarGanador, subirImagen,
}) {
  const [pestanaDentro, setPestanaDentro] = useState('suscriptores');
  const pestana = pestanaFuera || pestanaDentro;
  const ir = (p) => (onPestana ? onPestana(p) : setPestanaDentro(p));
  const [busqueda, setBusqueda] = useState('');
  const [ajuste, setAjuste] = useState({ n: 0, inicial: null });
  const total = contador ?? campana?.suscriptores ?? suscriptores.length;
  const filtrados = useMemo(() => {
    const q = normalizarBusqueda(busqueda);
    return suscriptores.filter((x) => !q || normalizarBusqueda(`${x.nombre} ${x.correo} ${x.telefono} ${x.plan}`).includes(q));
  }, [suscriptores, busqueda]);
  const vigentes = suscriptores.filter((x) => x.estado === 'activo').length;
  const chances = suscriptores.reduce((t, x) => t + (x.estado === 'activo' ? x.chances : 0), 0);
  const alMes = suscriptores.filter((x) => x.estado === 'activo').reduce((t, x) => t + x.precio, 0);

  const cabeza = {
    icono: 'sorteos',
    tono: 'rosa',
    titulo: campana?.nombre || 'Campaña de suscripción',
    subtitulo: campana ? `${textoDePlanes(campana.planes)} · ${campana.estado === 'activo' ? 'Activa' : campana.estado === 'cerrado' ? 'Cerrada' : 'Borrador'}` : undefined,
    migas: [{ texto: 'Sorteos por suscripción', to: urlLista }, { texto: campana?.nombre || 'Campaña' }],
    acciones: campana?.slug && urlPublica ? <Boton tamano="sm" variante="secundario" icono={<ExternalLink aria-hidden="true" />} onClick={() => window.open(urlPublica(campana), '_blank', 'noopener')}>Ver la página</Boton> : undefined,
  };
  const secciones = (
    <div className={u.pestanas}>
      <Pestanas etiqueta="Partes de la campaña" opciones={PESTANAS} valor={pestana} onChange={ir} />
    </div>
  );
  if (error) {
    return (
      <div className={s.pagina} data-componente="PaginaSuscripcionAdmin">
        <CabezaAdmin {...cabeza} />
        <Aviso tipo="error" titulo="No pudimos cargar la campaña" accion={onReintentar && <Boton tamano="sm" variante="contorno" icono={<RefreshCw aria-hidden="true" />} onClick={onReintentar}>Reintentar</Boton>}>{error}</Aviso>
      </div>
    );
  }

  if (pestana === 'beneficios') {
    return (
      <PaginaListaAdmin
        cabeza={cabeza}
        antes={<>{secciones}<p className={s.nota}>Las marcas y descuentos que la página muestra como beneficio de suscribirse.</p></>}
        registros={beneficios}
        cargando={cargando}
        nombreDe={(b) => b.marca || b.nombre}
        unidad={['beneficio', 'beneficios']}
        columnas={[
          { id: 'foto', titulo: 'Foto', ancho: 72, tarjeta: 'foto', celda: (b) => <FotoCelda src={b.imagen} contener /> },
          { id: 'nombre', titulo: 'Beneficio', tarjeta: 'titulo', celda: (b) => <>{b.marca || b.nombre}{b.marca && b.nombre && <span className={l.sub}>{b.nombre}</span>}</> },
          { id: 'descuento', titulo: 'Descuento', ancho: 120, tarjeta: 'detalle', celda: (b) => b.descuento || <span className={l.sub}>—</span> },
          { id: 'donde', titulo: 'Rubro · dónde', tarjeta: 'detalle', celda: (b) => [b.categoria, b.ubicacion].filter(Boolean).join(' · ') || <span className={l.sub}>—</span> },
          { id: 'orden', titulo: 'Orden', ancho: 80, alinear: 'fin', ordenable: true, celda: (b) => b.orden },
        ]}
        ordenes={{ orden: porOrden }}
        ordenInicial={{ por: 'orden', dir: 'asc' }}
        vacio={{ titulo: 'Todavía no hay beneficios', texto: 'Agrega las marcas aliadas y sus descuentos para suscriptores.' }}
        textos={{ creado: 'Beneficio agregado', guardado: 'Beneficio guardado', eliminado: 'Beneficio eliminado' }}
        eliminar={{ texto: (b) => `Se quita «${b.marca || b.nombre}» de la página.` }}
        onGuardar={onGuardarBeneficio}
        onEliminar={onEliminarBeneficio}
        formulario={{
          nuevo: 'Nuevo beneficio',
          titulos: { nuevo: 'Nuevo beneficio', editar: 'Editar beneficio' },
          textoGuardar: { nuevo: 'Agregar beneficio' },
          vacio: ({ registros }) => ({ marca: '', nombre: '', descuento: '', imagen: '', categoria: '', ubicacion: '', url: '', orden: registros.length }),
          desde: (b) => ({ ...b, id: undefined }),
          validar: (d) => ({ marca: String(d.marca).trim() || String(d.nombre).trim() ? undefined : 'Escribe la marca o el título.' }),
          campos: ({ datos: d, cambiar, errores, idDe }) => (
            <>
              <GrupoCampos titulo="El beneficio" columnas={2}>
                <Campo id={idDe('marca')} etiqueta="Marca" placeholder="Ej. Kapi Café" value={d.marca} error={errores.marca} onChange={(e) => cambiar('marca', e.target.value)} />
                <Campo etiqueta="Descuento" placeholder="Ej. 20 %" value={d.descuento} onChange={(e) => cambiar('descuento', e.target.value)} />
              </GrupoCampos>
              <GrupoCampos>
                <Campo etiqueta="Título" placeholder="Ej. En todas las bebidas" value={d.nombre} onChange={(e) => cambiar('nombre', e.target.value)} />
                <div className={s.dos}>
                  <Campo etiqueta="Rubro" placeholder="Ej. Cafetería" value={d.categoria} onChange={(e) => cambiar('categoria', e.target.value)} />
                  <Campo etiqueta="Dónde" placeholder="Ej. Miraflores" value={d.ubicacion} onChange={(e) => cambiar('ubicacion', e.target.value)} />
                </div>
                <Campo etiqueta="Enlace (opcional)" type="url" placeholder="https://…" value={d.url} onChange={(e) => cambiar('url', e.target.value)} />
                <CampoImagen etiqueta="Logo o foto" valor={d.imagen} onCambiar={(url) => cambiar('imagen', url)} subir={subirImagen} forma="cuadro" contener />
                <Campo etiqueta="Orden" type="number" inputMode="numeric" min={0} value={d.orden} onChange={(e) => cambiar('orden', e.target.value)} />
              </GrupoCampos>
            </>
          ),
        }}
      />
    );
  }

  if (pestana === 'galeria') {
    return (
      <PaginaListaAdmin
        cabeza={cabeza}
        antes={<>{secciones}<p className={s.nota}>Los ganadores de antes que la página muestra para dar confianza (se cargan a mano).</p></>}
        registros={galeria}
        cargando={cargando}
        unidad={['ganador', 'ganadores']}
        columnas={[
          { id: 'foto', titulo: 'Foto', ancho: 72, tarjeta: 'foto', celda: (g) => <FotoCelda src={g.foto} forma="circulo" /> },
          { id: 'nombre', titulo: 'Ganador', tarjeta: 'titulo', celda: (g) => <>{g.nombre}{g.premio && <span className={l.sub}>{g.premio}</span>}</> },
          { id: 'fecha', titulo: 'Cuándo', ancho: 140, tarjeta: 'detalle', celda: (g) => g.fecha || <span className={l.sub}>—</span> },
          { id: 'orden', titulo: 'Orden', ancho: 80, alinear: 'fin', ordenable: true, celda: (g) => g.orden },
        ]}
        ordenes={{ orden: porOrden }}
        ordenInicial={{ por: 'orden', dir: 'asc' }}
        vacio={{ titulo: 'La galería está vacía', texto: 'Sube a los ganadores de antes con su premio y una foto.' }}
        textos={{ creado: 'Ganador agregado', guardado: 'Ganador guardado', eliminado: 'Ganador quitado' }}
        eliminar={{ texto: (g) => `Se quita a ${g.nombre} de la galería.` }}
        onGuardar={onGuardarGanador}
        onEliminar={onEliminarGanador}
        formulario={{
          nuevo: 'Agregar ganador',
          titulos: { nuevo: 'Ganador de antes', editar: 'Editar ganador' },
          textoGuardar: { nuevo: 'Agregar a la galería' },
          vacio: ({ registros }) => ({ nombre: '', premio: '', foto: '', fecha: '', orden: registros.length }),
          desde: (g) => ({ ...g, id: undefined }),
          validar: (d) => ({ nombre: String(d.nombre).trim() ? undefined : 'Escribe el nombre del ganador.' }),
          campos: ({ datos: d, cambiar, errores, idDe }) => (
            <GrupoCampos titulo="El ganador">
              <div className={s.dos}>
                <Campo id={idDe('nombre')} etiqueta="Nombre" placeholder="Ej. Rosa D." value={d.nombre} error={errores.nombre} onChange={(e) => cambiar('nombre', e.target.value)} />
                <Campo etiqueta="Cuándo" placeholder="Ej. Junio 2026" value={d.fecha} onChange={(e) => cambiar('fecha', e.target.value)} />
              </div>
              <Campo etiqueta="Qué ganó" placeholder="Ej. Casaca One Piece" value={d.premio} onChange={(e) => cambiar('premio', e.target.value)} />
              <CampoImagen etiqueta="Foto" valor={d.foto} onCambiar={(url) => cambiar('foto', url)} subir={subirImagen} recorte="circulo" forma="circulo" />
              <Campo etiqueta="Orden" type="number" inputMode="numeric" min={0} value={d.orden} onChange={(e) => cambiar('orden', e.target.value)} />
            </GrupoCampos>
          ),
        }}
      />
    );
  }

  return (
    <div className={s.pagina} data-componente="PaginaSuscripcionAdmin">
      <CabezaAdmin {...cabeza} />
      {secciones}
      <FilaCifras etiqueta="Resumen de la campaña">
        <Cifra nombre="Suscriptores" valor={entero(total)} cargando={cargando} />
        <Cifra nombre="Al día" valor={entero(vigentes)} ayuda={total > suscriptores.length ? `Entre los ${entero(suscriptores.length)} que se ven` : 'Los que entran al sorteo'} tono="exito" cargando={cargando} />
        <Cifra nombre="Chances en juego" valor={entero(chances)} tono="aviso" cargando={cargando} />
        <Cifra nombre="Cobros por ciclo" valor={soles(alMes)} ayuda="Lo que suman sus planes" tono="cielo" cargando={cargando} />
      </FilaCifras>
      <ColumnasMetricas>
        <GanadoresSorteo ganadores={campana?.ganadores} numGanadores={campana?.numGanadores} onDecidir={onDecidirGanadores} cargando={cargando} quienes="los suscriptores al día" />
        <BloqueMetrica titulo="Dar o quitar chances" ayuda="Busca al suscriptor por correo, teléfono o DNI. Negativo resta. Lo aplica el servidor.">
          <AjusteSorteo key={ajuste.n} tipo="chances" inicial={ajuste.inicial} onEnviar={onDarChances} />
        </BloqueMetrica>
      </ColumnasMetricas>
      <BloqueMetrica titulo="Suscriptores" ayuda={total > suscriptores.length ? `Se ven los primeros ${entero(suscriptores.length)} de ${entero(total)}. Al elegir ganadores, el servidor cuenta a todos los que están al día.` : undefined}>
        <BarraFiltros busqueda={busqueda} onBusqueda={setBusqueda} placeholder="Buscar por nombre, correo, teléfono o plan" total={cargando ? undefined : filtrados.length} unidad={['suscriptor', 'suscriptores']} />
        <TablaAdmin
          etiqueta="Suscriptores"
          filas={filtrados}
          nombreDe={(x) => x.nombre || x.correo}
          cargando={cargando}
          vacio={suscriptores.length ? { titulo: 'Nadie coincide', texto: 'Busca otra cosa.' } : { titulo: 'Todavía nadie se suscribió', texto: 'Cuando alguien se suscriba, aparece aquí.' }}
          acciones={onDarChances ? (x) => [{ id: 'chances', etiqueta: 'Darle o quitarle chances', Icono: Sparkles, accion: () => setAjuste((a) => ({ n: a.n + 1, inicial: datosDeAjuste(x) })) }] : undefined}
          columnas={[
            { id: 'nombre', titulo: 'Suscriptor', tarjeta: 'titulo', celda: (x) => <>{x.nombre || 'Sin nombre'}<span className={l.sub}>{x.correo || x.telefono || 'Sin contacto'}</span></> },
            { id: 'plan', titulo: 'Plan', tarjeta: 'detalle', celda: (x) => <>{x.plan || '—'}{x.precio > 0 && <span className={l.sub}>{soles(x.precio)}{x.pago ? ` · ${x.pago}` : ''}</span>}</> },
            { id: 'vigencia', titulo: 'Al día hasta', ancho: 130, tarjeta: 'detalle', celda: (x) => fecha(x.vigenciaMs) },
            { id: 'chances', titulo: 'Chances', ancho: 90, alinear: 'fin', tarjeta: 'detalle', celda: (x) => <span className={l.numero}>{entero(x.chances)}</span> },
            { id: 'estado', titulo: 'Estado', ancho: 140, tarjeta: 'estado', celda: (x) => <InsigniaEstado estado={x.estado} estados={ESTADOS_SUSCRIPTOR} /> },
          ]}
        />
      </BloqueMetrica>
    </div>
  );
}
