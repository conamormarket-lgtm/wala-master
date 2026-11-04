import React, { useMemo, useState } from 'react';
import { BellRing, Cake, ChevronLeft, ChevronRight, Copy, Pencil, Plus, Power, RotateCcw, Sparkles, Star, Trash2, X } from 'lucide-react';
import Boton from '../../Boton';
import { Aviso, Confirmar, EstadoVacio, useToast } from '../../Feedback';
import { Campo, Interruptor } from '../../Formulario';
import { Chip } from '../../Etiquetas';
import { Pestanas } from '../../Navegacion';
import { CabezaAdmin } from '../../piezas/admin/Marco';
import { TablaAdmin, BarraFiltros, CargarMas, InsigniaEstado, SelectorProductos } from '../../piezas/admin/Datos';
import { HojaEdicion, GrupoCampos, ElegirUno } from '../../piezas/admin/Formularios';
import { Cifra, FilaCifras } from '../../piezas/admin/Metricas';
import { PaginaListaAdmin } from './Lista';
import { FotoCelda } from './celdas';
import {
  MESES, DIAS_SEMANA, ORDINALES, ROLES, FESTIVAS_DEFAULT,
  normalizarFestiva, fechaDelAnio, proximaFecha, textoRegla, textoFecha, textoDiasAviso, hoyLocal,
} from '../../../../utils/fechasFestivas.mjs';
import {
  semanasDelMes, mesVecino, cuandoFecha, FILTROS_FECHAS_CLIENTES, fechaEnVentana, paquetesDeFecha,
  estadoDePaquetes, diasDesdeTexto, idDeFestiva, normalizarBusqueda,
} from '../../adaptadoresAdmin';
import l from './Lista.module.css';
import { IsoWala } from '../../Marca';
import s from './Fechas.module.css';

/*
 * D5c · Fechas importantes (/admin/fechas-importantes): el calendario del
 * mes, las fechas festivas con sus avisos y las fechas que anotaron los
 * clientes con sus paquetes de regalo. Las reglas de cuándo cae cada fecha
 * son las de utils/fechasFestivas.mjs (las mismas del servidor).
 */

const PESTANAS = [
  { id: 'calendario', texto: 'Calendario' },
  { id: 'festivas', texto: 'Festivas' },
  { id: 'clientes', texto: 'Clientes' },
];
const CABEZA = { icono: 'fechas', tono: 'rosa', titulo: 'Fechas importantes', subtitulo: 'Las fechas festivas del año, sus avisos y las fechas que anotaron tus clientes.' };
const DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const PASO = 50;
const entero = (n) => new Intl.NumberFormat('es-PE').format(Math.round(Number(n) || 0));
const soles = (n) => `S/ ${(Number(n) || 0).toFixed(2)}`;
const conEmoji = (f) => `${f.emoji ? `${f.emoji} ` : ''}${f.nombre}`;
/** "Cumple 36" en un cumpleaños, "7 años" en un aniversario ('' sin año). */
const aniosTexto = (f) => (f.cumple ? (/cumple/i.test(f.evento) ? `Cumple ${f.cumple}` : `${f.cumple} años`) : '');
const listaTexto = (n) => (n.length <= 1 ? n[0] || '' : `${n.slice(0, -1).join(', ')} y ${n[n.length - 1]}`);

/** "Pareja (mujeres)" · "Todas las personas". */
function textoPara(f) {
  const roles = f.para.roles.map((r) => ROLES.find((x) => x.id === r)?.label).filter(Boolean);
  const genero = f.para.genero === 'Femenino' ? 'mujeres' : f.para.genero === 'Masculino' ? 'hombres' : '';
  if (!roles.length && !genero) return 'Todas las personas';
  if (!roles.length) return genero === 'mujeres' ? 'Todas las mujeres' : 'Todos los hombres';
  return `${roles.join(', ')}${genero ? ` (${genero})` : ''}`;
}

function Secciones({ valor, onCambiar }) {
  return (
    <div className={s.pestanas}>
      <Pestanas etiqueta="Secciones de fechas importantes" opciones={PESTANAS} valor={valor} onChange={onCambiar} />
    </div>
  );
}

/**
 * Fechas importantes.
 *  - pestana + onPestana ('calendario' | 'festivas' | 'clientes') · hoy ('YYYY-MM-DD')
 *  - festivas: [normalizarFestiva] (festivasDesdeDoc) · cargandoFestivas · errorFestivas ·
 *    onReintentarFestivas · onGuardarFestivas(lista) → promesa (la lista entera, como se guarda)
 *  - diasAviso: [7, 1] (los avisos de las fechas de cada persona) · onGuardarDiasAviso(dias)
 *  - onProbarAviso(festivaId | null) → promesa { titulo, cuerpo, imagen, tieneApp, push }
 *  - fechas: [fechaClienteDesde] · paquetes: [paqueteDesdeFirestore] · cargandoFechas ·
 *    errorFechas · onReintentarFechas
 *  - productos: [productoAdminDesde] · sugerirProductos(fecha) → productos (sus gustos)
 *  - onGuardarPaquete(productos, fecha, id?) · onElegirPaquete(paquete, fecha) ·
 *    onEliminarPaquete(paquete, fecha) → promesas
 */
export function PaginaFechasAdmin({
  pestana: pestanaFuera, onPestana, hoy = hoyLocal(),
  festivas = [], cargandoFestivas = false, errorFestivas, onReintentarFestivas, onGuardarFestivas,
  diasAviso = [], cargandoDiasAviso = false, onGuardarDiasAviso, onProbarAviso,
  fechas = [], paquetes = [], cargandoFechas = false, errorFechas, onReintentarFechas,
  productos = [], sugerirProductos, onGuardarPaquete, onElegirPaquete, onEliminarPaquete,
}) {
  const [pestanaDentro, setPestanaDentro] = useState('calendario');
  const pestana = pestanaFuera || pestanaDentro;
  const ir = (p) => (onPestana ? onPestana(p) : setPestanaDentro(p));
  const secciones = <Secciones valor={pestana} onCambiar={ir} />;

  if (pestana === 'festivas') {
    return (
      <FechasFestivas
        secciones={secciones}
        hoy={hoy}
        festivas={festivas}
        cargando={cargandoFestivas}
        error={errorFestivas}
        onReintentar={onReintentarFestivas}
        onGuardar={onGuardarFestivas}
        diasAviso={diasAviso}
        cargandoDiasAviso={cargandoDiasAviso}
        onGuardarDiasAviso={onGuardarDiasAviso}
        onProbar={onProbarAviso}
      />
    );
  }
  return (
    <div className={s.pagina} data-componente="PaginaFechasAdmin">
      <CabezaAdmin {...CABEZA} />
      {secciones}
      {pestana === 'calendario' && <Calendario hoy={hoy} festivas={festivas} fechas={fechas} cargando={cargandoFestivas || cargandoFechas} onIr={ir} />}
      {pestana === 'clientes' && (
        <FechasDeClientes
          fechas={fechas}
          paquetes={paquetes}
          cargando={cargandoFechas}
          error={errorFechas}
          onReintentar={onReintentarFechas}
          productos={productos}
          sugerirProductos={sugerirProductos}
          onGuardarPaquete={onGuardarPaquete}
          onElegirPaquete={onElegirPaquete}
          onEliminarPaquete={onEliminarPaquete}
        />
      )}
    </div>
  );
}

/* ── Calendario ────────────────────────────────────────── */

function Calendario({ hoy, festivas, fechas, cargando, onIr }) {
  const [mes, setMes] = useState(() => ({ anio: Number(hoy.slice(0, 4)), mes: Number(hoy.slice(5, 7)) }));
  const { titulo, semanas } = useMemo(() => semanasDelMes(mes.anio, mes.mes, hoy), [mes, hoy]);
  const dias = useMemo(() => {
    const anios = [...new Set(semanas.flat().map((d) => Number(d.iso.slice(0, 4))))];
    const activas = festivas.filter((f) => f.activo);
    const porDia = {};
    semanas.flat().forEach((d) => { porDia[d.iso] = { festivas: [], clientes: [] }; });
    anios.forEach((a) => activas.forEach((f) => { const iso = fechaDelAnio(f.regla, a); if (porDia[iso]) porDia[iso].festivas.push(f); }));
    semanas.flat().forEach((d) => { porDia[d.iso].clientes = fechas.filter((x) => x.mesDia === d.iso.slice(5)); });
    return porDia;
  }, [semanas, festivas, fechas]);
  const agenda = semanas.flat().filter((d) => d.delMes && (dias[d.iso].festivas.length || dias[d.iso].clientes.length));
  const mover = (paso) => setMes((m) => mesVecino(m.anio, m.mes, paso));
  const esteMes = mes.anio === Number(hoy.slice(0, 4)) && mes.mes === Number(hoy.slice(5, 7));
  const nombresDe = (lista) => listaTexto(lista.slice(0, 3).map((x) => `${x.persona} (${x.evento.toLowerCase()})`).concat(lista.length > 3 ? [`${lista.length - 3} más`] : []));

  return (
    <section className={s.calendario} aria-label={`Calendario de ${titulo}`} aria-busy={cargando || undefined}>
      <div className={s.mesBarra}>
        <Boton soloIcono tamano="sm" variante="secundario" icono={<ChevronLeft aria-hidden="true" />} onClick={() => mover(-1)} aria-label="Mes anterior" />
        <h2 className={s.mesTitulo} aria-live="polite">{titulo[0].toUpperCase() + titulo.slice(1)}</h2>
        <Boton soloIcono tamano="sm" variante="secundario" icono={<ChevronRight aria-hidden="true" />} onClick={() => mover(1)} aria-label="Mes siguiente" />
        {!esteMes && <Boton tamano="sm" variante="fantasma" onClick={() => setMes({ anio: Number(hoy.slice(0, 4)), mes: Number(hoy.slice(5, 7)) })}>Hoy</Boton>}
        <span className={s.leyenda}>
          <span className={s.leyendaFestiva}>Fecha festiva</span>
          <span className={s.leyendaCliente}><Cake aria-hidden="true" /> De clientes</span>
        </span>
      </div>

      <div className={s.rejilla} role="table" aria-label={titulo}>
        <div className={s.semana} role="row">
          {DIAS_CORTOS.map((d) => <span key={d} className={s.diaNombre} role="columnheader">{d}</span>)}
        </div>
        {semanas.map((semana) => (
          <div key={semana[0].iso} className={s.semana} role="row">
            {semana.map((d) => {
              const { festivas: fs, clientes: cs } = dias[d.iso];
              return (
                <div key={d.iso} role="cell" className={[s.dia, !d.delMes && s.fuera, d.hoy && s.hoy].filter(Boolean).join(' ')}>
                  <span className={s.numero}>{d.dia}{d.hoy && <span className={s.hoyTexto}> · hoy</span>}</span>
                  {fs.map((f) => (
                    <button key={f.id} type="button" className={s.festiva} onClick={() => onIr('festivas')} title={`${textoRegla(f.regla)} · ${textoPara(f)}`}>
                      {conEmoji(f)}
                    </button>
                  ))}
                  {cs.length > 0 && (
                    <button type="button" className={s.cliente} onClick={() => onIr('clientes')} title={nombresDe(cs)}>
                      <Cake aria-hidden="true" /> {cs.length === 1 ? cs[0].persona : `${cs.length} personas`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <ol className={s.agenda} aria-label={`Lo que hay en ${titulo}`}>
        {agenda.map((d) => {
          const { festivas: fs, clientes: cs } = dias[d.iso];
          const semana = DIAS_SEMANA[new Date(`${d.iso}T12:00:00`).getDay()];
          return (
            <li key={d.iso} className={[s.agendaDia, d.hoy && s.hoy].filter(Boolean).join(' ')}>
              <span className={s.agendaFecha}><strong>{d.dia}</strong>{d.hoy ? 'hoy' : semana.slice(0, 3)}</span>
              <span className={s.agendaCosas}>
                {fs.map((f) => <button key={f.id} type="button" className={s.festiva} onClick={() => onIr('festivas')}>{conEmoji(f)}</button>)}
                {cs.length > 0 && (
                  <button type="button" className={s.cliente} onClick={() => onIr('clientes')}>
                    <Cake aria-hidden="true" /> {nombresDe(cs)}
                  </button>
                )}
              </span>
            </li>
          );
        })}
        {!agenda.length && !cargando && <li className={s.agendaVacia}>Nada este mes: ni fechas festivas ni fechas de clientes.</li>}
      </ol>
    </section>
  );
}

/* ── Fechas festivas y avisos ──────────────────────────── */

const NUEVA = {
  nombre: '', emoji: '🎁', activo: true,
  regla: { tipo: 'fija', mes: 1, dia: 1 },
  para: { roles: [], genero: '' },
  diasTexto: '7, 2',
  avisarATodos: false,
};
const GENEROS = [{ valor: '', texto: 'Cualquiera' }, { valor: 'Femenino', texto: 'Solo mujeres' }, { valor: 'Masculino', texto: 'Solo hombres' }];
const opcionesMes = MESES.map((m, i) => ({ valor: String(i + 1), texto: m[0].toUpperCase() + m.slice(1) }));

function FechasFestivas({ secciones, hoy, festivas, cargando, error, onReintentar, onGuardar, diasAviso, cargandoDiasAviso, onGuardarDiasAviso, onProbar }) {
  const toast = useToast();
  const [restaurar, setRestaurar] = useState(false);
  const [prueba, setPrueba] = useState(null);
  const [probando, setProbando] = useState(null);
  const anio = Number(hoy.slice(0, 4));

  const registros = useMemo(() => festivas
    .map((f) => ({ ...f, ...(proximaFecha(f.regla, hoy) || {}) }))
    .sort((a, b) => Number(b.activo) - Number(a.activo) || a.dias - b.dias), [festivas, hoy]);

  const guardarLista = (lista) => onGuardar?.(lista.map(normalizarFestiva));
  const probar = async (id) => {
    setProbando(id || 'personal');
    setPrueba(null);
    try {
      setPrueba(await onProbar?.(id));
    } catch (err) {
      toast({ tipo: 'error', titulo: 'No se pudo enviar la prueba', texto: err?.message || 'Vuelve a intentar.' });
    } finally {
      setProbando(null);
    }
  };
  const alternar = async (f) => {
    try {
      await guardarLista(festivas.map((x) => (x.id === f.id ? { ...x, activo: !x.activo } : x)));
      toast({ tipo: 'exito', titulo: f.activo ? 'Fecha apagada' : 'Fecha encendida', texto: f.nombre });
    } catch (err) {
      toast({ tipo: 'error', titulo: 'No se pudo guardar', texto: err?.message || 'Vuelve a intentar.' });
    }
  };

  return (
    <>
      <PaginaListaAdmin
        cabeza={{
          ...CABEZA,
          acciones: <Boton tamano="sm" variante="secundario" icono={<RotateCcw aria-hidden="true" />} disabled={cargando || Boolean(error)} onClick={() => setRestaurar(true)}>Fechas de Perú</Boton>,
        }}
        antes={(
          <>
            {secciones}
            <AvisosPersonales dias={diasAviso} cargando={cargandoDiasAviso} onGuardar={onGuardarDiasAviso} onProbar={onProbar && (() => probar(null))} probando={probando === 'personal'} />
            {prueba && <VistaPrevia prueba={prueba} onCerrar={() => setPrueba(null)} />}
            <h2 className={s.subtitulo}>Fechas festivas del año</h2>
            <p className={s.nota}>En «Fechas importantes» el cliente ve la que se acerca (30 días antes) con ideas de regalo para sus personas. Las que cambian de día cada año se calculan solas.</p>
          </>
        )}
        registros={registros}
        cargando={cargando}
        error={error}
        onReintentar={onReintentar}
        femenino
        unidad={['fecha', 'fechas']}
        columnas={[
          { id: 'nombre', titulo: 'Fecha', tarjeta: 'titulo', celda: (f) => <>{conEmoji(f)}<span className={l.sub}>{textoRegla(f.regla)}</span></> },
          { id: 'proxima', titulo: 'Próxima', ancho: 150, tarjeta: 'detalle', celda: (f) => <>{textoFecha(f.fecha)}{f.activo && <span className={l.sub}>{f.dias === 0 ? 'Hoy' : `En ${f.dias} días`}</span>}</> },
          { id: 'para', titulo: 'A quién le toca', tarjeta: 'detalle', celda: (f) => textoPara(f) },
          { id: 'avisos', titulo: 'Avisos', tarjeta: 'detalle', celda: (f) => <>{f.avisarDias.length ? `${listaTexto(f.avisarDias.map(String))} días antes` : 'Sin aviso'}{f.avisarATodos && <span className={l.sub}>También a todos los clientes</span>}</> },
          { id: 'estado', titulo: 'Estado', ancho: 110, tarjeta: 'estado', celda: (f) => <InsigniaEstado estado={f.activo ? 'activo' : 'oculto'}>{f.activo ? 'Activa' : 'Apagada'}</InsigniaEstado> },
        ]}
        vacio={{ titulo: 'No hay fechas festivas', texto: 'Crea una o vuelve a las fechas de Perú.' }}
        textos={{ creado: 'Fecha creada', guardado: 'Fecha guardada', eliminado: 'Fecha eliminada' }}
        masAcciones={(f) => [
          ...(onProbar ? [{ id: 'probar', etiqueta: 'Enviarme un aviso de prueba', Icono: BellRing, accion: () => probar(f.id) }] : []),
          { id: 'activa', etiqueta: f.activo ? 'Apagar' : 'Encender', Icono: Power, accion: () => alternar(f) },
        ]}
        eliminar={{ texto: (f) => `Se borra «${f.nombre}» del calendario. Los clientes dejan de verla y de recibir sus avisos.` }}
        onEliminar={(id) => guardarLista(festivas.filter((x) => x.id !== id))}
        onGuardar={(d, id) => {
          const f = normalizarFestiva({ ...d, id: id || idDeFestiva(d.nombre, festivas.map((x) => x.id)), avisarDias: diasDesdeTexto(d.diasTexto) });
          return guardarLista(id ? festivas.map((x) => (x.id === id ? f : x)) : [...festivas, f]);
        }}
        formulario={{
          nuevo: 'Nueva fecha',
          titulos: { nuevo: 'Nueva fecha festiva', editar: 'Editar fecha festiva' },
          textoGuardar: { nuevo: 'Crear fecha' },
          vacio: () => ({ ...NUEVA, regla: { ...NUEVA.regla }, para: { roles: [], genero: '' } }),
          desde: (f) => ({ nombre: f.nombre, emoji: f.emoji, activo: f.activo, regla: f.regla, para: f.para, diasTexto: f.avisarDias.join(', '), avisarATodos: f.avisarATodos }),
          validar: (d) => ({ nombre: String(d.nombre).trim() ? undefined : 'Escribe el nombre de la fecha.' }),
          campos: ({ datos, cambiar, errores, idDe }) => {
            const r = datos.regla;
            const regla = (campo, valor) => cambiar('regla', { ...r, [campo]: Number(valor) });
            const avisos = diasDesdeTexto(datos.diasTexto);
            const rol = (id) => cambiar('para', { ...datos.para, roles: datos.para.roles.includes(id) ? datos.para.roles.filter((x) => x !== id) : [...datos.para.roles, id] });
            return (
              <>
                <GrupoCampos titulo="La fecha">
                  <div className={s.emojiNombre}>
                    <Campo etiqueta="Emoji" value={datos.emoji} maxLength={4} onChange={(e) => cambiar('emoji', e.target.value)} />
                    <Campo id={idDe('nombre')} etiqueta="Nombre" placeholder="Ej. Día del Abuelo" value={datos.nombre} error={errores.nombre} onChange={(e) => cambiar('nombre', e.target.value)} />
                  </div>
                </GrupoCampos>
                <GrupoCampos titulo="¿Cuándo cae?">
                  <ElegirUno
                    etiqueta="Cómo cae"
                    opciones={[{ valor: 'fija', texto: 'Siempre el mismo día' }, { valor: 'movil', texto: 'Cambia cada año' }]}
                    valor={r.tipo}
                    onElegir={(v) => v && v !== r.tipo && cambiar('regla', v === 'fija' ? { tipo: 'fija', mes: r.mes, dia: 1 } : { tipo: 'movil', mes: r.mes, diaSemana: 0, ordinal: 2 })}
                  />
                  <div className={s.dos}>
                    {r.tipo === 'fija' ? (
                      <Campo etiqueta="Día" type="number" inputMode="numeric" min={1} max={31} value={r.dia} onChange={(e) => regla('dia', e.target.value)} />
                    ) : (
                      <>
                        <Campo etiqueta="Cuál" opciones={ORDINALES.map((o) => ({ valor: String(o.id), texto: o.label }))} value={String(r.ordinal)} onChange={(e) => regla('ordinal', e.target.value)} />
                        <Campo etiqueta="Día de la semana" opciones={DIAS_SEMANA.map((d, i) => ({ valor: String(i), texto: d[0].toUpperCase() + d.slice(1) }))} value={String(r.diaSemana)} onChange={(e) => regla('diaSemana', e.target.value)} />
                      </>
                    )}
                    <Campo etiqueta="Mes" opciones={opcionesMes} value={String(r.mes)} onChange={(e) => regla('mes', e.target.value)} />
                  </div>
                  <p className={s.muestra}>
                    <span>{textoRegla(r)}:</span> cae el {textoFecha(fechaDelAnio(r, anio))} de {anio} y el {textoFecha(fechaDelAnio(r, anio + 1))} de {anio + 1}.
                  </p>
                </GrupoCampos>
                <GrupoCampos titulo="¿A quién le toca?" ayuda="Las personas de «Fechas importantes» con esta relación. Ninguna marcada: todas.">
                  <div className={s.chips} role="group" aria-label="Relación">
                    {ROLES.map((x) => <Chip key={x.id} tamano="sm" activo={datos.para.roles.includes(x.id)} onClick={() => rol(x.id)}>{x.label}</Chip>)}
                  </div>
                  <Campo etiqueta="Género" opciones={GENEROS} value={datos.para.genero} onChange={(e) => cambiar('para', { ...datos.para, genero: e.target.value })} />
                </GrupoCampos>
                <GrupoCampos titulo="Avisos" ayuda="Quien tenga anotada a alguien a quien le toca recibe un aviso con su nombre e ideas de regalo.">
                  <Campo etiqueta="¿Cuántos días antes avisar?" ayuda="Separados por coma (de 1 a 60)." placeholder="14, 7, 2" value={datos.diasTexto} onChange={(e) => cambiar('diasTexto', e.target.value)} />
                  <p className={s.muestra}>
                    {avisos.length ? <><span>Se avisa:</span> {textoDiasAviso(avisos)}.</> : <><span>Sin días:</span> esta fecha no manda avisos.</>}
                  </p>
                  <Interruptor etiqueta="Avisar también a quien no tiene a nadie anotado" descripcion={`«Se acerca el ${datos.nombre || '…'}»`} activo={datos.avisarATodos} onChange={(v) => cambiar('avisarATodos', v)} />
                  <Interruptor etiqueta="Activa" descripcion="Apagada no se muestra a los clientes ni se avisa (no se borra)." activo={datos.activo} onChange={(v) => cambiar('activo', v)} />
                </GrupoCampos>
              </>
            );
          },
        }}
      />
      <Confirmar
        abierta={restaurar}
        titulo="¿Volver a las fechas de Perú?"
        texto="Se reemplazan todas las fechas festivas por las de siempre (San Valentín, Día de la Madre, Navidad…). Se pierden los cambios hechos aquí."
        confirmar="Volver a las de Perú"
        peligro
        onCancelar={() => setRestaurar(false)}
        onConfirmar={async () => {
          try {
            await guardarLista(FESTIVAS_DEFAULT);
            toast({ tipo: 'exito', titulo: 'Volviste a las fechas de Perú' });
          } catch (err) {
            toast({ tipo: 'error', titulo: 'No se pudo guardar', texto: err?.message || 'Vuelve a intentar.' });
          } finally {
            setRestaurar(false);
          }
        }}
      />
    </>
  );
}

/* Los avisos de las fechas que cada cliente anotó (cumpleaños, aniversario…). */
function AvisosPersonales({ dias = [], cargando, onGuardar, onProbar, probando }) {
  const toast = useToast();
  const [texto, setTexto] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const valor = texto ?? dias.join(', ');
  const nuevos = diasDesdeTexto(valor, 0);
  const cambio = texto !== null && nuevos.join(',') !== dias.join(',');
  const guardar = async () => {
    setGuardando(true);
    try {
      await onGuardar?.(nuevos);
      setTexto(null);
      toast({ tipo: 'exito', titulo: 'Avisos guardados', texto: nuevos.length ? `Se avisa ${textoDiasAviso(nuevos)}.` : 'Quedaron apagados.' });
    } catch (err) {
      toast({ tipo: 'error', titulo: 'No se pudo guardar', texto: err?.message || 'Vuelve a intentar.' });
    } finally {
      setGuardando(false);
    }
  };
  return (
    <section className={s.tarjeta} aria-labelledby="avisos-personales">
      <h2 id="avisos-personales" className={s.subtitulo}><BellRing aria-hidden="true" /> Avisos de las fechas de cada persona</h2>
      <p className={s.nota}>
        Cumpleaños, aniversarios y lo que cada cliente anotó. Se revisa todos los días a las 10:00 a. m. (hora de Lima) y se avisa por la campanita de la web y por push a quien tiene la app, con una idea de regalo.
      </p>
      <div className={s.filaAviso}>
        <Campo etiqueta="¿Cuántos días antes avisar?" ayuda="0 = el mismo día." placeholder="7, 1" value={valor} disabled={cargando} onChange={(e) => setTexto(e.target.value)} />
        <Boton tamano="sm" onClick={guardar} cargando={guardando} disabled={!cambio}>Guardar</Boton>
        {onProbar && <Boton tamano="sm" variante="secundario" icono={<BellRing aria-hidden="true" />} cargando={probando} onClick={onProbar}>Enviarme una prueba</Boton>}
      </div>
      {nuevos.length
        ? <p className={s.muestra}><span>El cliente verá:</span> «Te avisamos {textoDiasAviso(nuevos)}».</p>
        : <Aviso tipo="aviso" compacto>Sin días: estos avisos quedan apagados.</Aviso>}
    </section>
  );
}

/* Cómo se ve la notificación de prueba y adónde llegó. */
function VistaPrevia({ prueba: r, onCerrar }) {
  return (
    <section className={s.tarjeta} role="status" aria-label="Aviso de prueba enviado">
      <div className={s.notif}>
        <span className={s.notifApp}><IsoWala tamano={16} /> Walá · ahora</span>
        <span className={s.notifCuerpo}>
          <span><strong>{r.titulo}</strong>{r.cuerpo}</span>
          {r.imagen && <img src={r.imagen} alt="" />}
        </span>
      </div>
      <p className={s.nota}>
        Te llegó a la campanita de la web
        {r.tieneApp
          ? (r.push > 0 ? ' y como push a tu celular.' : '. La push a tu celular no salió: revisa los permisos de la app.')
          : '. Para verla como push, entra con esta cuenta en la app del celular.'}
      </p>
      <Boton tamano="sm" variante="fantasma" icono={<X aria-hidden="true" />} onClick={onCerrar}>Cerrar</Boton>
    </section>
  );
}

/* ── Fechas de los clientes y sus paquetes ─────────────── */

const ESTADOS_PAQUETE = {
  elegido: { texto: 'Paquete elegido', tono: 'exito' },
  borrador: { texto: 'Borrador', tono: 'neutro' },
  sin: { texto: 'Sin paquete', tono: 'aviso' },
};

function FechasDeClientes({ fechas, paquetes, cargando, error, onReintentar, productos, sugerirProductos, onGuardarPaquete, onElegirPaquete, onEliminarPaquete }) {
  const [busqueda, setBusqueda] = useState('');
  const [ventana, setVentana] = useState('');
  const [paquete, setPaquete] = useState('');
  const [visibles, setVisibles] = useState(PASO);
  const [abierta, setAbierta] = useState(null);

  const conPaquetes = useMemo(() => fechas
    .map((f) => { const ps = paquetesDeFecha(paquetes, f); return { ...f, paquetes: ps, ...estadoDePaquetes(ps) }; })
    .sort((a, b) => (a.dias ?? 999) - (b.dias ?? 999) || a.persona.localeCompare(b.persona, 'es')), [fechas, paquetes]);
  const filtradas = useMemo(() => {
    const q = normalizarBusqueda(busqueda);
    return conPaquetes.filter((f) => fechaEnVentana(f, ventana) && (!paquete || f.estado === paquete)
      && (!q || normalizarBusqueda(`${f.persona} ${f.cliente} ${f.evento} ${f.relacion}`).includes(q)));
  }, [conPaquetes, busqueda, ventana, paquete]);
  const semana = conPaquetes.filter((f) => fechaEnVentana(f, '7')).length;
  const sinPaquete = conPaquetes.filter((f) => fechaEnVentana(f, '30') && f.estado === 'sin').length;
  const filtrar = (v, p = '') => { setVentana(v); setPaquete(p); setVisibles(PASO); };
  const elegida = abierta && conPaquetes.find((f) => f.id === abierta);

  return (
    <>
      <FilaCifras etiqueta="Resumen de las fechas de clientes">
        <Cifra nombre="Fechas anotadas" valor={entero(conPaquetes.length)} ayuda={`de ${entero(new Set(fechas.map((f) => f.clienteId)).size)} clientes`} cargando={cargando} activo={!ventana && !paquete} onClick={() => filtrar('')} />
        <Cifra nombre="Próximos 7 días" valor={entero(semana)} tono="violeta" cargando={cargando} activo={ventana === '7' && !paquete} onClick={() => filtrar('7')} />
        <Cifra nombre="En 30 días sin paquete" valor={entero(sinPaquete)} ayuda="Para armarles uno" tono="aviso" cargando={cargando} activo={ventana === '30' && paquete === 'sin'} onClick={() => filtrar('30', 'sin')} />
      </FilaCifras>
      <BarraFiltros
        busqueda={busqueda}
        onBusqueda={(t) => { setBusqueda(t); setVisibles(PASO); }}
        placeholder="Buscar por persona, cliente o fecha"
        filtros={[
          { id: 'ventana', etiqueta: 'Cuándo', todos: 'Todas', opciones: FILTROS_FECHAS_CLIENTES, valor: ventana },
          { id: 'paquete', etiqueta: 'Paquete', todos: 'Con y sin paquete', opciones: Object.entries(ESTADOS_PAQUETE).map(([valor, e]) => ({ valor, texto: e.texto })), valor: paquete },
        ]}
        onFiltro={(id, v) => { if (id === 'ventana') setVentana(v); else setPaquete(v); setVisibles(PASO); }}
        total={cargando || error ? undefined : filtradas.length}
        unidad={['fecha', 'fechas']}
      />
      <TablaAdmin
        etiqueta="Fechas de los clientes"
        filas={filtradas.slice(0, visibles)}
        nombreDe={(f) => `${f.persona} · ${f.evento}`}
        cargando={cargando}
        error={error}
        onReintentar={onReintentar}
        onFila={(f) => setAbierta(f.id)}
        vacio={fechas.length
          ? { titulo: 'Ninguna fecha coincide', texto: 'Prueba con otra ventana o busca otra cosa.' }
          : { titulo: 'Todavía nadie anotó fechas', texto: 'Cuando un cliente anote a alguien en «Fechas importantes», aparece aquí.' }}
        columnas={[
          { id: 'persona', titulo: 'Persona', tarjeta: 'titulo', celda: (f) => <>{f.persona}<span className={l.sub}>{f.relacion}</span></> },
          { id: 'fecha', titulo: 'Fecha', tarjeta: 'detalle', celda: (f) => <>{f.evento}<span className={l.sub}>{f.fecha}</span></> },
          { id: 'cuando', titulo: 'Cuándo', ancho: 130, tarjeta: 'detalle', celda: (f) => <>{cuandoFecha(f.dias) || '—'}{f.cumple ? <span className={l.sub}>{aniosTexto(f)}</span> : null}</> },
          { id: 'cliente', titulo: 'Cliente', tarjeta: 'detalle', celda: (f) => <span className={s.correo}>{f.cliente}</span> },
          { id: 'paquete', titulo: 'Paquete', ancho: 160, tarjeta: 'estado', celda: (f) => <InsigniaEstado estado={f.estado} estados={ESTADOS_PAQUETE}>{f.texto}</InsigniaEstado> },
        ]}
      />
      <CargarMas visibles={Math.min(visibles, filtradas.length)} total={filtradas.length} paso={PASO} onMas={() => setVisibles((v) => v + PASO)} unidad={['fecha', 'fechas']} />
      <HojaEdicion
        abierta={Boolean(elegida)}
        titulo={elegida ? `${elegida.persona} · ${elegida.evento}` : ''}
        subtitulo={elegida ? `${elegida.fecha}${elegida.dias != null ? ` · ${cuandoFecha(elegida.dias)}` : ''}` : undefined}
        onCerrar={() => setAbierta(null)}
      >
        {elegida && (
          <FichaFecha
            key={elegida.id}
            fecha={elegida}
            productos={productos}
            sugerirProductos={sugerirProductos}
            onGuardarPaquete={onGuardarPaquete}
            onElegirPaquete={onElegirPaquete}
            onEliminarPaquete={onEliminarPaquete}
          />
        )}
      </HojaEdicion>
    </>
  );
}

/* La persona, sus gustos y sus paquetes; el paquete se arma aquí mismo. */
function FichaFecha({ fecha: f, productos, sugerirProductos, onGuardarPaquete, onElegirPaquete, onEliminarPaquete }) {
  const toast = useToast();
  const [armando, setArmando] = useState(null); // { id?, productos, sinIdeas }
  const [guardando, setGuardando] = useState(false);
  const [borrar, setBorrar] = useState(null);
  const intentar = async (fn, exito) => {
    try {
      await fn();
      if (exito) toast({ tipo: 'exito', titulo: exito });
      return true;
    } catch (err) {
      toast({ tipo: 'error', titulo: 'No se pudo guardar', texto: err?.message || 'Vuelve a intentar.' });
      return false;
    }
  };
  const sugerir = async () => {
    const ideas = (await sugerirProductos?.(f)) || [];
    setArmando((a) => ({ ...a, productos: ideas.length ? ideas : a.productos, sinIdeas: ideas.length === 0 }));
  };
  const guardar = async () => {
    setGuardando(true);
    const ok = await intentar(() => onGuardarPaquete?.(armando.productos, f, armando.id), armando.id ? 'Paquete guardado' : 'Paquete creado');
    setGuardando(false);
    if (ok) setArmando(null);
  };

  if (armando) {
    const total = armando.productos.reduce((t, p) => t + (Number(p.precio) || 0), 0);
    return (
      <div className={s.ficha}>
        <GrupoCampos titulo={`Productos del paquete (${armando.productos.length})`} ayuda={f.gustos.length ? `Le gusta: ${listaTexto(f.gustos)}.` : 'No contó sus gustos.'}>
          {sugerirProductos && <Boton tamano="sm" variante="secundario" icono={<Sparkles aria-hidden="true" />} onClick={sugerir}>Sugerir con sus gustos</Boton>}
          {armando.sinIdeas && <Aviso tipo="aviso" compacto>No encontramos productos que vayan con lo que le gusta. Búscalos abajo.</Aviso>}
          {armando.productos.length ? (
            <ul className={s.productos}>
              {armando.productos.map((p) => (
                <li key={p.id}>
                  <FotoCelda src={p.imagen} tamano={40} />
                  <span className={s.productoTexto}><strong>{p.nombre}</strong>{soles(p.precio)}</span>
                  <Boton soloIcono tamano="sm" variante="fantasma" icono={<X aria-hidden="true" />} aria-label={`Quitar ${p.nombre}`} onClick={() => setArmando((a) => ({ ...a, productos: a.productos.filter((x) => x.id !== p.id) }))} />
                </li>
              ))}
              <li className={s.total}>Total: <strong>{soles(total)}</strong></li>
            </ul>
          ) : <p className={s.nota}>Todavía no tiene productos.</p>}
          <SelectorProductos
            productos={productos}
            yaEstan={armando.productos.map((p) => p.id)}
            accion="Agregar"
            accionHecha="Ya está"
            limite={6}
            onElegir={async (p) => setArmando((a) => ({ ...a, productos: [...a.productos, p], sinIdeas: false }))}
          />
        </GrupoCampos>
        <div className={s.acciones}>
          <Boton variante="fantasma" onClick={() => setArmando(null)}>Cancelar</Boton>
          <Boton onClick={guardar} cargando={guardando} disabled={!armando.productos.length}>{armando.id ? 'Guardar paquete' : 'Crear paquete'}</Boton>
        </div>
      </div>
    );
  }

  return (
    <div className={s.ficha}>
      <dl className={s.datos}>
        <div><dt>Cliente</dt><dd className={s.correo}>{f.cliente}</dd></div>
        <div><dt>Relación</dt><dd>{f.relacion}{f.genero ? ` · ${f.genero === 'Femenino' ? 'mujer' : f.genero === 'Masculino' ? 'hombre' : f.genero}` : ''}</dd></div>
        <div><dt>Fecha</dt><dd>{f.evento}: {f.fecha}{f.cumple ? ` (${aniosTexto(f).toLowerCase()})` : ''}</dd></div>
        {f.presupuesto && <div><dt>Presupuesto</dt><dd>{f.presupuesto}</dd></div>}
        <div><dt>Le gusta</dt><dd>{f.gustos.length ? <span className={s.chips}>{f.gustos.map((g) => <Chip key={g} tamano="sm">{g}</Chip>)}</span> : 'No contó sus gustos.'}</dd></div>
      </dl>

      <div className={s.paquetesCabeza}>
        <h3 className={s.subtitulo}>Paquetes de regalo</h3>
        <Boton tamano="sm" icono={<Plus aria-hidden="true" />} onClick={() => setArmando({ productos: [] })}>Crear paquete</Boton>
      </div>
      <p className={s.nota}>El elegido es el que se le ofrece al cliente cuando se acerca la fecha. Si es el primero de la fecha, sale elegido.</p>
      {f.paquetes.length ? (
        <ul className={s.paquetes}>
          {f.paquetes.map((p, i) => (
            <li key={p.id} className={[s.paquete, p.elegido && s.paqueteElegido].filter(Boolean).join(' ')}>
              <span className={s.paqueteCabeza}>
                <strong>Paquete {i + 1}</strong>
                <InsigniaEstado estado={p.elegido ? 'elegido' : 'borrador'} estados={ESTADOS_PAQUETE}>{p.elegido ? 'Elegido' : 'Borrador'}</InsigniaEstado>
                <span className={s.paqueteTotal}>{soles(p.productos.reduce((t, x) => t + x.precio, 0))}</span>
              </span>
              <ul className={s.miniaturas}>
                {p.productos.map((x) => <li key={x.id}><FotoCelda src={x.imagen} tamano={36} /><span>{x.nombre}</span></li>)}
              </ul>
              <span className={s.paqueteAcciones}>
                {!p.elegido && <Boton tamano="sm" variante="secundario" icono={<Star aria-hidden="true" />} onClick={() => intentar(() => onElegirPaquete?.(p, f), 'Paquete elegido')}>Elegir este</Boton>}
                <Boton tamano="sm" variante="fantasma" icono={<Pencil aria-hidden="true" />} onClick={() => setArmando({ id: p.id, productos: p.productos })}>Editar</Boton>
                <Boton tamano="sm" variante="fantasma" icono={<Copy aria-hidden="true" />} onClick={() => setArmando({ productos: [...p.productos] })}>Usar de base</Boton>
                <Boton soloIcono tamano="sm" variante="fantasma" icono={<Trash2 aria-hidden="true" />} aria-label={`Eliminar el paquete ${i + 1}`} onClick={() => setBorrar(p)} />
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <EstadoVacio titulo="Sin paquetes todavía" texto="Arma uno con sus gustos o eligiendo productos de la tienda." />
      )}
      <Confirmar
        abierta={Boolean(borrar)}
        titulo="¿Eliminar este paquete?"
        texto={borrar?.elegido ? 'Era el elegido: el siguiente de esta fecha pasa a ser el elegido.' : 'No se puede deshacer.'}
        confirmar="Eliminar"
        peligro
        contenida
        onCancelar={() => setBorrar(null)}
        onConfirmar={async () => { await intentar(() => onEliminarPaquete?.(borrar, f), 'Paquete eliminado'); setBorrar(null); }}
      />
    </div>
  );
}
