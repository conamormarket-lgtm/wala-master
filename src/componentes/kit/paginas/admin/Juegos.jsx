import React, { useEffect, useState } from 'react';
import { Gift, Plus, RefreshCw, Trash2 } from 'lucide-react';
import Boton from '../../Boton';
import { Aviso, Confirmar, useToast } from '../../Feedback';
import { Campo, Interruptor } from '../../Formulario';
import { CampoFecha } from '../../Fecha';
import { Pestanas } from '../../Navegacion';
import { CabezaAdmin } from '../../piezas/admin/Marco';
import { InsigniaEstado, ListaOrdenable } from '../../piezas/admin/Datos';
import { GrupoCampos, CampoDinero, ElegirUno, BarraGuardar } from '../../piezas/admin/Formularios';
import { Cifra, FilaCifras, BloqueMetrica, ColumnasMetricas, ListaBarras } from '../../piezas/admin/Metricas';
import { GraficoTendencia } from '../../piezas/admin/Grafico';
import { PaginaListaAdmin } from './Lista';
import {
  palabraLimpia, erroresDePalabra, CUPON_JUEGO_VACIO, modoDeCupon, cuponConModo, textoCuponJuego, erroresDePatrocinio,
  nuevoPuesto, erroresDePremios, metricasBolitas,
} from '../../adaptadoresAdmin';
import l from './Lista.module.css';
import s from './Juegos.module.css';
import { EsqueletoFormulario } from '../../Esqueletos';

/*
 * D7a · Los juegos: La Palabra del día (/admin/wordle) y Las Bolitas de
 * Kapi con las marcas
 * (/admin/bolitas). Lo que se guarda de las Bolitas lo comprueba el servidor
 * (adminBolitasSecure), que pone los topes de los cupones.
 */

const entero = (n) => new Intl.NumberFormat('es-PE').format(Math.round(Number(n) || 0));
const errorDe = (err) => err?.message || 'Vuelve a intentar.';
const fechaLarga = (dia) => (/^\d{4}-\d{2}-\d{2}/.test(dia || '') ? new Date(`${dia}T12:00:00`).toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' }) : dia);
const mismo = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* ── La Palabra del día ────────────────────────────────── */

const ESTADOS_PALABRA = { hoy: { texto: 'Hoy', tono: 'exito' }, programada: { texto: 'Programada', tono: 'violeta' }, paso: { texto: 'Ya pasó', tono: 'neutro' } };
const ORIGEN_PALABRA = { mano: { texto: 'Puesta a mano', tono: 'violeta' }, auto: { texto: 'Automática', tono: 'neutro' } };

/** La palabra como en el juego: una letra por casilla. */
const Casillas = ({ palabra = '' }) => (
  <span className={s.casillas} aria-label={palabra}>
    {palabra.split('').map((c, i) => <span key={i} aria-hidden="true">{c}</span>)}
  </span>
);

/**
 * La Palabra del día (/admin/wordle): lo que sale en el juego. Las puestas a
 * mano y, para los próximos 14 días sin una, la que elige el juego solo
 * (palabrasConAutomaticas). Editar una automática la pone a mano.
 *  - palabras: [palabrasConAutomaticas] · cargando · error · onReintentar · hoy ('YYYY-MM-DD', Lima)
 *  - onGuardar({ fecha, palabra }, id?) → promesa (id solo si era puesta a mano) · onEliminar(id)
 *  - partidas: { hoy, mes } (cuántas se jugaron) · cargandoPartidas
 *  - existe(PALABRA): ¿está en el diccionario del juego? (sin él, no se revisa)
 */
export function PaginaPalabraAdmin({ palabras = [], cargando, error, onReintentar, onGuardar, onEliminar, hoy, partidas, cargandoPartidas = false, existe }) {
  const aMano = palabras.filter((x) => !x.automatica);
  const idReal = (id) => (String(id || '').startsWith('auto-') ? undefined : id);
  return (
    <PaginaListaAdmin
      cabeza={{ icono: 'palabra', tono: 'rosa', titulo: 'La Palabra del día', subtitulo: 'Qué palabra sale cada día. Si no pones una, el juego elige una sola de su lista; puedes cambiarla por la tuya.' }}
      antes={(
        <FilaCifras>
          <Cifra nombre="Partidas de hoy" valor={entero(partidas?.hoy)} cargando={cargandoPartidas || !partidas} />
          <Cifra nombre="Partidas en 30 días" valor={entero(partidas?.mes)} tono="cielo" cargando={cargandoPartidas || !partidas} />
        </FilaCifras>
      )}
      registros={palabras}
      cargando={cargando}
      error={error}
      onReintentar={onReintentar}
      femenino
      unidad={['palabra', 'palabras']}
      nombreDe={(x) => x.palabra}
      buscarEn={(x) => `${x.palabra} ${x.fecha}`}
      placeholder="Buscar una palabra o un día"
      filtros={[
        { id: 'estado', etiqueta: 'Cuándo', todos: 'Todas', opciones: [{ valor: 'proximas', texto: 'Hoy y las que vienen' }, { valor: 'paso', texto: 'Las que ya pasaron' }], filtrar: (x, v) => (v === 'paso' ? x.estado === 'paso' : x.estado !== 'paso') },
        { id: 'origen', etiqueta: 'Quién la eligió', todos: 'A mano y automáticas', opciones: [{ valor: 'mano', texto: 'Puestas a mano' }, { valor: 'auto', texto: 'Automáticas' }], filtrar: (x, v) => (v === 'auto' ? x.automatica : !x.automatica) },
      ]}
      columnas={[
        { id: 'fecha', titulo: 'Día', ordenable: true, tarjeta: 'titulo', celda: (x) => <>{fechaLarga(x.fecha)}<span className={l.sub}>{x.fecha}</span></> },
        { id: 'palabra', titulo: 'Palabra', tarjeta: 'detalle', celda: (x) => <Casillas palabra={x.palabra} /> },
        { id: 'origen', titulo: 'Quién la eligió', ancho: 150, tarjeta: 'detalle', celda: (x) => <InsigniaEstado estado={x.automatica ? 'auto' : 'mano'} estados={ORIGEN_PALABRA} /> },
        { id: 'estado', titulo: 'Estado', ancho: 130, tarjeta: 'estado', celda: (x) => <InsigniaEstado estado={x.estado} estados={ESTADOS_PALABRA} /> },
      ]}
      ordenes={{ fecha: (a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0) }}
      ordenInicial={{ por: 'fecha', dir: 'asc' }}
      vacio={{ titulo: 'No hay palabras', texto: 'El juego elige una cada día.' }}
      textos={{ creado: 'Palabra programada', guardado: 'Palabra guardada', eliminado: 'Palabra quitada' }}
      eliminar={{
        texto: (x) => `Se quita «${x.palabra}» del ${fechaLarga(x.fecha)}. Ese día el juego elige una sola.`,
        bloqueado: (x) => (x.automatica ? 'Es la que elige el juego: no hay nada que quitar. Para cambiarla, edítala y pon la tuya.' : null),
      }}
      onGuardar={(d, id) => onGuardar?.({ fecha: d.fecha, palabra: palabraLimpia(d.palabra) }, idReal(id))}
      onEliminar={onEliminar}
      formulario={{
        nuevo: 'Nueva palabra',
        titulos: { nuevo: 'Nueva palabra', editar: 'Editar la palabra' },
        textoGuardar: { nuevo: 'Programar' },
        vacio: () => ({ fecha: hoy || '', palabra: '' }),
        desde: (x) => ({ fecha: x.fecha, palabra: x.palabra }),
        validar: (d, { id }) => erroresDePalabra(d, aMano, idReal(id), existe),
        campos: ({ datos: d, cambiar, errores, idDe }) => (
          <GrupoCampos titulo="La palabra">
            <CampoFecha id={idDe('fecha')} etiqueta="Día" valor={d.fecha} min={hoy} error={errores.fecha} onCambiar={(v) => cambiar('fecha', v)} />
            <Campo id={idDe('palabra')} etiqueta="Palabra" ayuda="5 letras, de las que conoce el juego. Las tildes se quitan." placeholder="Ej. FELIZ" maxLength={5} value={d.palabra} error={errores.palabra} onChange={(e) => cambiar('palabra', e.target.value.toUpperCase())} />
            {d.palabra && <Casillas palabra={palabraLimpia(d.palabra)} />}
          </GrupoCampos>
        ),
      }}
    />
  );
}

/* ── Las Bolitas de Kapi ───────────────────────────────── */

/** Un cupón: % o S/ de descuento o envío gratis, su tope y en cuántos días vence. */
function CamposCupon({ valor, onCambiar, errores = {} }) {
  const c = valor || CUPON_JUEGO_VACIO;
  const modo = modoDeCupon(c);
  const cambiar = (x) => onCambiar({ ...c, ...x });
  return (
    <div className={s.cupon}>
      <ElegirUno etiqueta="El cupón" opciones={[{ valor: 'pct', texto: '% de descuento' }, { valor: 'monto', texto: 'S/ de descuento' }, { valor: 'envio', texto: 'Envío gratis' }]} valor={modo} onElegir={(v) => v && onCambiar(cuponConModo(c, v))} />
      <div className={s.dos}>
        {modo === 'pct' && <Campo etiqueta="Descuento" type="number" inputMode="numeric" min={1} max={50} sufijo="%" value={c.descuentoPct} error={errores.valor} onChange={(e) => cambiar({ descuentoPct: Number(e.target.value) })} />}
        {modo === 'pct' && <CampoDinero etiqueta="Hasta (tope)" ayuda="0: sin tope." value={c.topeDescuento} onChange={(e) => cambiar({ topeDescuento: Number(e.target.value) })} />}
        {modo === 'monto' && <CampoDinero etiqueta="Descuento" value={c.descuentoMonto} error={errores.valor} onChange={(e) => cambiar({ descuentoMonto: Number(e.target.value) })} />}
        <Campo etiqueta="Vence en" type="number" inputMode="numeric" min={1} max={90} sufijo="días" value={c.vigenciaDias} error={errores.vigencia} onChange={(e) => cambiar({ vigenciaDias: Number(e.target.value) })} />
      </div>
      <p className={s.muestra}><span>El cliente recibe:</span> {textoCuponJuego(c)}</p>
    </div>
  );
}

const PESTANAS_BOLITAS = [
  { id: 'patrocinios', texto: 'Retos' },
  { id: 'mundos', texto: 'Mundos' },
  { id: 'premios', texto: 'Premios' },
  { id: 'resultados', texto: 'Cifras' },
];
const ESTADOS_PATROCINIO = { si: { texto: 'Activo', tono: 'exito' }, no: { texto: 'Apagado', tono: 'neutro' } };

/** El orden de los mundos: las marcas en fila, se repiten al acabarse. */
function Mundos({ guardados = [], marcas = [], onGuardar }) {
  const toast = useToast();
  const [orden, setOrden] = useState(guardados);
  const [agregar, setAgregar] = useState('');
  const [guardando, setGuardando] = useState(false);
  useEffect(() => { setOrden(guardados); }, [guardados]);
  const libres = marcas.filter((m) => !orden.some((x) => x.id === m.valor));
  const guardar = async () => {
    setGuardando(true);
    try {
      await onGuardar?.(orden);
      toast({ tipo: 'exito', titulo: 'Mundos guardados' });
    } catch (err) {
      toast({ tipo: 'error', titulo: 'No se pudo guardar', texto: errorDe(err) });
    } finally {
      setGuardando(false);
    }
  };
  return (
    <>
      <GrupoCampos titulo="Las marcas de los mundos" ayuda="Cada mundo de 20 niveles toma los colores y el logo de una marca, en este orden (al acabarse, se repiten). Al vencer al jefe del mundo salen productos de la marca. Sin marcas, los mundos tienen sus nombres de siempre.">
        {orden.length > 0 && (
          <ListaOrdenable
            etiqueta="Orden de los mundos"
            items={orden}
            nombreDe={(m) => m.nombre}
            onCambiar={setOrden}
            render={(m, i) => (
              <span className={s.mundo}>
                <span><strong>Mundo {i + 1}</strong>{orden.length > 0 && <span className={l.sub}>y {i + 1 + orden.length}, {i + 1 + 2 * orden.length}…</span>}</span>
                <span className={s.mundoMarca}>{m.nombre}</span>
                <Boton soloIcono tamano="sm" variante="fantasma" icono={<Trash2 aria-hidden="true" />} aria-label={`Quitar ${m.nombre}`} onClick={() => setOrden(orden.filter((x) => x.id !== m.id))} />
              </span>
            )}
          />
        )}
        <div className={s.agregar}>
          <Campo etiqueta="Agregar una marca" opciones={[{ valor: '', texto: 'Elige una marca' }, ...libres]} value={agregar} onChange={(e) => setAgregar(e.target.value)} />
          <Boton variante="secundario" icono={<Plus aria-hidden="true" />} disabled={!agregar} onClick={() => { const m = marcas.find((x) => x.valor === agregar); if (m) setOrden([...orden, { id: m.valor, nombre: m.texto }]); setAgregar(''); }}>Agregar</Boton>
        </div>
      </GrupoCampos>
      <BarraGuardar visible={!mismo(orden, guardados)} texto="Cambiaste el orden de los mundos." onDescartar={() => setOrden(guardados)} onGuardar={guardar} guardando={guardando} />
    </>
  );
}

/** Los premios del ranking semanal y premiar una semana a mano. */
function Premios({ guardados, marcas = [], onGuardar, onPremiarSemana }) {
  const toast = useToast();
  const [p, setP] = useState(guardados);
  const [guardando, setGuardando] = useState(false);
  const [semana, setSemana] = useState('');
  const [preguntar, setPreguntar] = useState(false);
  useEffect(() => { setP(guardados); }, [guardados]);
  const problema = erroresDePremios(p);
  const puesto = (i, x) => setP((v) => ({ ...v, puestos: v.puestos.map((y, j) => (j === i ? { ...y, ...x } : y)) }));
  const guardar = async () => {
    setGuardando(true);
    try {
      await onGuardar?.(p);
      toast({ tipo: 'exito', titulo: 'Premios guardados' });
    } catch (err) {
      toast({ tipo: 'error', titulo: 'No se pudo guardar', texto: errorDe(err) });
    } finally {
      setGuardando(false);
    }
  };
  return (
    <>
      <GrupoCampos titulo="Los premios del ranking semanal" ayuda="Cada lunes a las 00:15 se premia la semana que terminó (más retos del día hechos; si empatan, menos movimientos). Con marca, el cupón solo descuenta sus productos.">
        <Interruptor etiqueta="Entregar premios cada lunes" activo={p.activo} onChange={(v) => setP((x) => ({ ...x, activo: v }))} />
        {p.puestos.map((x, i) => (
          <article key={i} className={s.premio}>
            <header className={s.premioCabeza}>
              <strong>{x.desde === x.hasta ? `Puesto ${x.desde}` : `Puestos ${x.desde} a ${x.hasta}`}</strong>
              <Boton tamano="sm" variante="fantasma" icono={<Trash2 aria-hidden="true" />} onClick={() => setP((v) => ({ ...v, puestos: v.puestos.filter((_, j) => j !== i) }))}>Quitar</Boton>
            </header>
            <div className={s.dos}>
              <Campo etiqueta="Desde el puesto" type="number" inputMode="numeric" min={1} value={x.desde} onChange={(e) => puesto(i, { desde: Number(e.target.value) })} />
              <Campo etiqueta="Hasta el puesto" type="number" inputMode="numeric" min={1} value={x.hasta} onChange={(e) => puesto(i, { hasta: Number(e.target.value) })} />
            </div>
            <Campo etiqueta="Marca (opcional)" opciones={[{ valor: '', texto: 'Toda la tienda' }, ...marcas]} value={x.marcaId || ''} onChange={(e) => puesto(i, { marcaId: e.target.value })} />
            <CamposCupon valor={x.cupon} onCambiar={(cupon) => puesto(i, { cupon })} />
          </article>
        ))}
        <Boton variante="secundario" icono={<Plus aria-hidden="true" />} onClick={() => setP((v) => ({ ...v, puestos: [...v.puestos, nuevoPuesto(v.puestos)] }))}>Agregar un premio</Boton>
      </GrupoCampos>
      {onPremiarSemana && (
        <GrupoCampos titulo="Premiar una semana a mano" ayuda="Si el lunes no se entregó (o para probar). Elige el lunes de esa semana; si ya estaba premiada, no se repite.">
          <div className={s.agregar}>
            <CampoFecha etiqueta="El lunes de la semana" valor={semana} onCambiar={setSemana} />
            <Boton variante="secundario" icono={<Gift aria-hidden="true" />} disabled={!semana} onClick={() => setPreguntar(true)}>Premiar</Boton>
          </div>
        </GrupoCampos>
      )}
      <BarraGuardar visible={!mismo(p, guardados)} texto={problema || undefined} puedeGuardar={!problema} onDescartar={() => setP(guardados)} onGuardar={guardar} guardando={guardando} />
      <Confirmar
        abierta={preguntar}
        titulo="¿Premiar esa semana?"
        texto={`Se entregan los cupones del ranking de la semana del ${fechaLarga(semana)}, con los premios guardados.`}
        confirmar="Premiar"
        onCancelar={() => setPreguntar(false)}
        onConfirmar={async () => {
          try {
            const r = await onPremiarSemana(semana);
            toast(r?.ya ? { tipo: 'aviso', titulo: 'Esa semana ya estaba premiada' } : r?.sinPremios ? { tipo: 'aviso', titulo: 'No hay premios', texto: 'No hay premios guardados o están apagados.' } : { tipo: 'exito', titulo: 'Semana premiada', texto: `${entero(r?.entregados)} cupones entregados.` });
          } catch (err) {
            toast({ tipo: 'error', titulo: 'No se pudo premiar', texto: errorDe(err) });
          } finally {
            setPreguntar(false);
          }
        }}
      />
    </>
  );
}

/**
 * Las Bolitas de Kapi con las marcas (/admin/bolitas).
 *  - pestana + onPestana · marcas: [{ valor, texto }] · hoy · cargando · error · onReintentar
 *    (los de la pestaña abierta; en Cifras, `cargando` no tapa: usa cargandoMetricas)
 *  - patrocinios: [patrocinioDesde] (desde hoy) · onGuardarPatrocinio(datos, id?) · onQuitarPatrocinio(id)
 *  - mundos: [{ id, nombre }] · onGuardarMundos(lista)
 *  - premios: premiosBolitasDesde · onGuardarPremios(premios) · onPremiarSemana(lunes) → { ya, sinPremios, entregados }
 *  - metricas: lo de adminBolitas('metricas') · dias + onDias · cargandoMetricas
 */
export function PaginaBolitasAdmin({
  pestana: pestanaFuera, onPestana, marcas = [], hoy = '', cargando, error, onReintentar,
  patrocinios = [], onGuardarPatrocinio, onQuitarPatrocinio, mundos = [], onGuardarMundos,
  premios = { activo: false, puestos: [] }, onGuardarPremios, onPremiarSemana,
  metricas, dias = 14, onDias, cargandoMetricas = false,
}) {
  const [pestanaDentro, setPestanaDentro] = useState('patrocinios');
  const pestana = pestanaFuera || pestanaDentro;
  const ir = (p) => (onPestana ? onPestana(p) : setPestanaDentro(p));
  const cabeza = { icono: 'bolitas', tono: 'rosa', titulo: 'Las Bolitas de Kapi', subtitulo: 'Las marcas en el juego: el reto patrocinado, los mundos, los premios del ranking y cómo va.' };
  const secciones = <div className={s.pestanas}><Pestanas etiqueta="Partes de las Bolitas" opciones={PESTANAS_BOLITAS} valor={pestana} onChange={ir} /></div>;
  const nombreMarca = (id) => marcas.find((m) => m.valor === id)?.texto || id;

  if (pestana === 'patrocinios') {
    return (
      <PaginaListaAdmin
        cabeza={cabeza}
        antes={<>{secciones}<p className={s.nota}>La marca sale en el reto de ese día y quien lo completa (con sesión) recibe su cupón, hasta llenar el cupo; el cupón solo descuenta productos de esa marca. Los días sin patrocinio, el reto sale normal.</p></>}
        registros={patrocinios}
        cargando={cargando}
        error={error}
        onReintentar={onReintentar}
        nombreDe={(p) => `${p.marcaNombre} · ${p.fecha}`}
        unidad={['reto', 'retos']}
        columnas={[
          { id: 'fecha', titulo: 'Día', tarjeta: 'titulo', celda: (p) => <>{fechaLarga(p.fecha)}<span className={l.sub}>{p.hoy ? 'Hoy' : p.fecha}</span></> },
          { id: 'marca', titulo: 'Marca', tarjeta: 'detalle', celda: (p) => p.marcaNombre },
          { id: 'cupon', titulo: 'Cupón', tarjeta: 'detalle', celda: (p) => textoCuponJuego(p.cupon) },
          { id: 'cupo', titulo: 'Entregados', ancho: 140, alinear: 'fin', tarjeta: 'detalle', celda: (p) => <span className={l.numero}>{entero(p.entregados)} de {entero(p.cupo)}<span className={s.barrita} aria-hidden="true"><span style={{ width: `${Math.min(100, Math.round((p.entregados / (p.cupo || 1)) * 100))}%` }} /></span></span> },
          { id: 'estado', titulo: 'Estado', ancho: 110, tarjeta: 'estado', celda: (p) => <InsigniaEstado estado={p.activo ? 'si' : 'no'} estados={ESTADOS_PATROCINIO} /> },
        ]}
        vacio={{ titulo: 'No hay retos patrocinados desde hoy', texto: 'Elige un día y una marca para que auspicie el reto.' }}
        textos={{ creado: 'Reto patrocinado', guardado: 'Patrocinio guardado', eliminado: 'Patrocinio quitado' }}
        eliminar={{ texto: (p) => `Se quita el patrocinio de ${p.marcaNombre} del ${fechaLarga(p.fecha)}: ese día el reto sale normal.` }}
        onGuardar={(d, id) => onGuardarPatrocinio?.({ ...d, marcaNombre: nombreMarca(d.marcaId) }, id)}
        onEliminar={onQuitarPatrocinio}
        formulario={{
          nuevo: 'Patrocinar un reto',
          titulos: { nuevo: 'Reto patrocinado', editar: 'Editar el patrocinio' },
          textoGuardar: { nuevo: 'Guardar patrocinio' },
          vacio: () => ({ fecha: hoy, marcaId: '', cupo: 50, activo: true, cupon: { ...CUPON_JUEGO_VACIO } }),
          desde: (p) => ({ fecha: p.fecha, marcaId: p.marcaId, cupo: p.cupo, activo: p.activo, cupon: p.cupon }),
          validar: (d, { id }) => erroresDePatrocinio(d, patrocinios, id, hoy),
          campos: ({ datos: d, cambiar, errores, idDe }) => (
            <>
              <GrupoCampos titulo="El reto">
                <div className={s.dos}>
                  <CampoFecha id={idDe('fecha')} etiqueta="Día" valor={d.fecha} min={hoy} error={errores.fecha} onCambiar={(v) => cambiar('fecha', v)} />
                  <Campo id={idDe('cupo')} etiqueta="Cupo" ayuda="Cuántos cupones como máximo." type="number" inputMode="numeric" min={1} max={1000} sufijo="cupones" value={d.cupo} error={errores.cupo} onChange={(e) => cambiar('cupo', Number(e.target.value))} />
                </div>
                <Campo id={idDe('marcaId')} etiqueta="Marca" opciones={[{ valor: '', texto: 'Elige una marca' }, ...marcas]} value={d.marcaId} error={errores.marcaId} onChange={(e) => cambiar('marcaId', e.target.value)} />
                <Interruptor etiqueta="Activo" descripcion="Apagado, ese día el reto sale normal (no se borra)." activo={d.activo} onChange={(v) => cambiar('activo', v)} />
              </GrupoCampos>
              <GrupoCampos titulo="El cupón">
                <CamposCupon valor={d.cupon} errores={{ valor: errores.cuponValor, vigencia: errores.cuponVigencia }} onCambiar={(v) => cambiar('cupon', v)} />
              </GrupoCampos>
            </>
          ),
        }}
      />
    );
  }

  const m = metricas ? metricasBolitas(metricas) : null;
  return (
    <div className={s.pagina} data-componente="PaginaBolitasAdmin">
      <CabezaAdmin {...cabeza} />
      {secciones}
      {error ? (
        <Aviso tipo="error" titulo="No pudimos cargar las Bolitas" accion={onReintentar && <Boton tamano="sm" variante="contorno" icono={<RefreshCw aria-hidden="true" />} onClick={onReintentar}>Reintentar</Boton>}>{error}</Aviso>
      ) : cargando && pestana !== 'resultados' ? (
        // Mundos y Premios copian lo guardado al llegar: sin esto, lo editado mientras carga se pierde.
        <EsqueletoFormulario campos={3} />
      ) : pestana === 'mundos' ? (
        <Mundos guardados={mundos} marcas={marcas} onGuardar={onGuardarMundos} />
      ) : pestana === 'premios' ? (
        <Premios guardados={premios} marcas={marcas} onGuardar={onGuardarPremios} onPremiarSemana={onPremiarSemana} />
      ) : (
        <>
          <div className={s.periodo}>
            <ElegirUno etiqueta="Periodo" opciones={[{ valor: 7, texto: '7 días' }, { valor: 14, texto: '14 días' }, { valor: 30, texto: '30 días' }]} valor={dias} onElegir={(v) => v && onDias?.(v)} />
          </div>
          <p className={s.nota}>Solo cuenta a quienes juegan con sesión (las partidas que comprueba el servidor); los toques hacia la tienda cuentan a todos.</p>
          <FilaCifras etiqueta="Resultados de las Bolitas">
            <Cifra nombre="Partidas ganadas" valor={entero(m?.partidas)} cargando={cargandoMetricas || !m} />
            <Cifra nombre="Retos hechos" valor={entero(m?.retos)} tono="exito" cargando={cargandoMetricas || !m} />
            <Cifra nombre="Toques hacia la tienda" valor={entero(m?.clics)} tono="aviso" cargando={cargandoMetricas || !m} />
            <Cifra nombre="Jugadores" valor={entero(m?.jugadores)} ayuda="En 90 días" tono="cielo" cargando={cargandoMetricas || !m} />
            <Cifra nombre="Volvieron otro día" valor={m?.vuelven == null ? '—' : `${m.vuelven} %`} tono="violeta" cargando={cargandoMetricas || !m} />
            <Cifra nombre="Siguen a los 7 días" valor={m?.siguen7 == null ? '—' : `${m.siguen7} %`} tono="neutro" cargando={cargandoMetricas || !m} />
          </FilaCifras>
          {m && (
            <>
              <GraficoTendencia
                titulo="Por día"
                forma="barras"
                datos={m.porDia.map((d) => ({ etiqueta: d.fecha.slice(8, 10) + '/' + d.fecha.slice(5, 7), valores: { partidas: d.partidas, retos: d.retos } }))}
                series={[{ id: 'partidas', nombre: 'Partidas', tono: 'violeta' }, { id: 'retos', nombre: 'Retos', tono: 'menta' }]}
              />
              <ColumnasMetricas>
                <BloqueMetrica titulo="Dónde se traban" ayuda="El nivel más alto de quienes no juegan hace 3 días o más.">
                  <ListaBarras filas={m.trabados.map((t) => ({ id: t.nivel, nombre: `Nivel ${t.nivel}`, valor: t.n, texto: `${entero(t.n)} ${t.n === 1 ? 'jugador' : 'jugadores'}` }))} vacio="Todavía no hay datos." />
                </BloqueMetrica>
                <BloqueMetrica titulo="Hacia la tienda, por marca">
                  <ListaBarras filas={Object.entries(m.clicsMarca).sort((a, b) => b[1] - a[1]).map(([id, n]) => ({ id, nombre: nombreMarca(id), valor: n, texto: entero(n) }))} tono="menta" vacio="Todavía no hay datos." />
                </BloqueMetrica>
              </ColumnasMetricas>
            </>
          )}
        </>
      )}
    </div>
  );
}
