import React, { useEffect, useMemo, useState } from 'react';
import { Check, Plus, RefreshCw, RotateCcw, X } from 'lucide-react';
import Boton from '../../Boton';
import { Aviso, useToast } from '../../Feedback';
import { Campo, Interruptor } from '../../Formulario';
import { CampoFecha } from '../../Fecha';
import { Chip } from '../../Etiquetas';
import { Pestanas } from '../../Navegacion';
import { RuedaRuleta } from '../../piezas/Ruleta';
import { CabezaAdmin } from '../../piezas/admin/Marco';
import { TablaAdmin, BarraFiltros, InsigniaEstado, SelectorProductos } from '../../piezas/admin/Datos';
import { GrupoCampos, CampoImagen, CampoDinero, CampoColor, ElegirUno, BarraGuardar } from '../../piezas/admin/Formularios';
import { PaginaListaAdmin } from './Lista';
import { normalizarPremio, premiosDeHoy, sumaProbabilidades, textoPremio, PRESETS_TEMA } from '../../../../utils/ruletaModel';
import {
  DIAS_RULETA, textoDiasRuleta, TIPOS_PREMIO_RULETA, PREMIO_RULETA_CON_PRODUCTO, PREMIO_RULETA_CON_CUPON,
  premioRuletaAFormulario, erroresDePremioRuleta, motivoRuletaHoy, normalizarBusqueda, fechaDeDia,
} from '../../adaptadoresAdmin';
import l from './Lista.module.css';
import s from './Ruleta.module.css';

/*
 * D7b · La Ruleta semanal (/admin/ruleta): qué se puede ganar, con qué
 * probabilidad y qué días; los colores y las reglas con la rueda real de
 * vista previa; y quién ganó qué, para entregar lo que es a mano. Los premios
 * y la config usan utils/ruletaModel, el mismo modelo del servidor.
 */

const entero = (n) => new Intl.NumberFormat('es-PE').format(Math.round(Number(n) || 0));
const errorDe = (err) => err?.message || 'Vuelve a intentar.';
const mismo = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const PESTANAS = [{ id: 'premios', texto: 'Premios' }, { id: 'apariencia', texto: 'Cómo se ve' }, { id: 'entregas', texto: 'Entregas' }];
const VACIO = {
  nombre: '', etiqueta: '', tipo: 'monedas', probabilidad: 0, monedas: 0, descuentoPct: 0, descuentoMonto: 0, topeDescuento: 0,
  productId: '', productName: '', vigenciaDias: 30, color: '', icono: '', activo: true, dias: [], desde: '', hasta: '', stockTotal: '', maxPorUsuario: '',
};
const ESTADOS_HOY = { si: { texto: 'Sale hoy', tono: 'exito' }, no: { texto: 'No sale hoy', tono: 'neutro' } };

/** Los colores y las reglas, con la rueda de vista previa. Se guardan juntos. */
function Apariencia({ config, premiosHoy, premios, subirImagen, onGuardar }) {
  const toast = useToast();
  const [c, setC] = useState(config);
  const [guardando, setGuardando] = useState(false);
  useEffect(() => { setC(config); }, [config]);
  const tema = (x) => setC((v) => ({ ...v, tema: { ...v.tema, ...x } }));
  const reglas = (x) => setC((v) => ({ ...v, reglas: { ...v.reglas, ...x } }));
  const guardar = async () => {
    setGuardando(true);
    try {
      await onGuardar?.(c);
      toast({ tipo: 'exito', titulo: 'Ruleta guardada', texto: 'Así la ven desde ahora.' });
    } catch (err) {
      toast({ tipo: 'error', titulo: 'No se pudo guardar', texto: errorDe(err) });
    } finally {
      setGuardando(false);
    }
  };
  const vista = premiosHoy.length ? premiosHoy : premios;
  return (
    <div className={s.apariencia}>
      <div className={s.campos}>
        <GrupoCampos titulo="La ruleta">
          <Interruptor etiqueta="Abierta" descripcion={c.activa ? 'Los clientes pueden girar.' : 'Cerrada: nadie puede girar.'} activo={c.activa} onChange={(v) => setC((x) => ({ ...x, activa: v }))} />
          <ElegirUno etiqueta="Cómo se gana el giro" opciones={[{ valor: 'racha7', texto: 'Con los 7 días de racha de Kapi' }, { valor: 'siempre', texto: 'Uno por semana, sin condición' }]} valor={c.reglas.modoDesbloqueo} onElegir={(v) => v && reglas({ modoDesbloqueo: v })} />
          <Interruptor etiqueta="El giro ganado sigue la semana siguiente" activo={c.reglas.semanaDeGracia} onChange={(v) => reglas({ semanaDeGracia: v })} />
          <label className={s.rango}><span>Vueltas <strong>{c.reglas.vueltas}</strong></span><input type="range" min={2} max={12} value={c.reglas.vueltas} onChange={(e) => reglas({ vueltas: Number(e.target.value) })} /></label>
          <label className={s.rango}><span>Cuánto dura el giro <strong>{(c.reglas.duracionGiroMs / 1000).toFixed(1)} s</strong></span><input type="range" min={1500} max={10000} step={500} value={c.reglas.duracionGiroMs} onChange={(e) => reglas({ duracionGiroMs: Number(e.target.value) })} /></label>
        </GrupoCampos>
        <GrupoCampos titulo="Los colores" ayuda="Se reparten entre los gajos; el texto se pone claro u oscuro solo.">
          <span className={s.paletas} role="group" aria-label="Paletas">
            {Object.entries(PRESETS_TEMA).map(([id, p]) => (
              <button key={id} type="button" className={s.paleta} aria-pressed={c.tema.preset === id} onClick={() => tema({ preset: id, colores: p.colores, colorAro: p.colorAro, colorPuntero: p.colorPuntero })}>
                <span className={s.paletaMuestras} aria-hidden="true">{p.colores.map((x) => <span key={x} style={{ background: x }} />)}</span>
                {p.nombre}
              </button>
            ))}
          </span>
          <span className={s.etiqueta}>Los gajos</span>
          <span className={s.gajos}>
            {c.tema.colores.map((color, i) => (
              <span key={`${i}-${color}`} className={s.gajo}>
                <input type="color" value={color} aria-label={`Color ${i + 1}`} onChange={(e) => tema({ preset: 'personalizado', colores: c.tema.colores.map((x, j) => (j === i ? e.target.value : x)) })} />
                {c.tema.colores.length > 2 && <button type="button" aria-label={`Quitar el color ${i + 1}`} onClick={() => tema({ preset: 'personalizado', colores: c.tema.colores.filter((_, j) => j !== i) })}><X aria-hidden="true" /></button>}
              </span>
            ))}
            {c.tema.colores.length < 8 && <Boton soloIcono tamano="sm" variante="secundario" icono={<Plus aria-hidden="true" />} aria-label="Agregar un color" onClick={() => tema({ preset: 'personalizado', colores: [...c.tema.colores, '#6D28D9'] })} />}
          </span>
          <div className={s.dos}>
            <CampoColor etiqueta="Aro y separadores" valor={c.tema.colorAro} onCambiar={(v) => tema({ colorAro: v })} />
            <CampoColor etiqueta="Puntero y centro" valor={c.tema.colorPuntero} onCambiar={(v) => tema({ colorPuntero: v })} />
          </div>
          <CampoImagen etiqueta="Imagen del centro (opcional)" ayuda="Sin imagen, va la W de Walá." valor={c.tema.imagenCentro} onCambiar={(url) => tema({ imagenCentro: url })} subir={subirImagen} conEnlace recorte="circulo" forma="circulo" />
        </GrupoCampos>
      </div>
      <aside className={s.vista} aria-label="Vista previa de la rueda">
        <span className={s.etiqueta}>Así se ve hoy</span>
        <div className={s.rueda}>
          <RuedaRuleta premios={vista} colores={c.tema.colores} colorAro={c.tema.colorAro} colorPuntero={c.tema.colorPuntero} imagenCentro={c.tema.imagenCentro} />
        </div>
        {!premiosHoy.length && premios.length > 0 && <p className={s.nota}>Hoy no puede salir ningún premio (apagados, fuera de fecha o agotados): se ve el catálogo entero.</p>}
      </aside>
      <BarraGuardar visible={!mismo(c, config)} texto="Cambiaste cómo se ve la ruleta." onDescartar={() => setC(config)} onGuardar={guardar} guardando={guardando} />
    </div>
  );
}

/** Quién ganó qué; lo que es a mano se marca al entregarlo. */
function Entregas({ ganados = [], cargando, error, onReintentar, onMarcarEntregado }) {
  const toast = useToast();
  const [pendientes, setPendientes] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [marcando, setMarcando] = useState(null);
  const filas = useMemo(() => {
    const q = normalizarBusqueda(busqueda);
    return ganados.filter((g) => (!pendientes || (g.manual && !g.entregado)) && (!q || normalizarBusqueda(`${g.quien} ${g.correo} ${g.premio} ${g.cupon}`).includes(q)));
  }, [ganados, pendientes, busqueda]);
  const porEntregar = ganados.filter((g) => g.manual && !g.entregado).length;
  const marcar = async (g) => {
    setMarcando(g.id);
    try {
      await onMarcarEntregado?.(g.id, !g.entregado);
      toast({ tipo: 'exito', titulo: g.entregado ? 'Vuelve a «por entregar»' : 'Marcado como entregado', texto: `${g.premio} · ${g.quien || g.correo}` });
    } catch (err) {
      toast({ tipo: 'error', titulo: 'No se pudo marcar', texto: errorDe(err) });
    } finally {
      setMarcando(null);
    }
  };
  return (
    <>
      <p className={s.nota}>Las monedas y los cupones llegan solos; solo los premios a mano necesitan que alguien los entregue. {porEntregar ? porEntregar === 1 ? 'Falta 1.' : `Faltan ${porEntregar}.` : 'No falta entregar nada.'}</p>
      <BarraFiltros busqueda={busqueda} onBusqueda={setBusqueda} placeholder="Buscar por quién, premio o cupón" total={cargando || error ? undefined : filas.length} unidad={['premio', 'premios']}>
        <Interruptor etiqueta="Solo lo que falta entregar" activo={pendientes} onChange={setPendientes} />
      </BarraFiltros>
      <TablaAdmin
        etiqueta="Premios ganados"
        filas={filas}
        nombreDe={(g) => g.premio}
        cargando={cargando}
        error={error}
        onReintentar={onReintentar}
        vacio={pendientes ? { titulo: 'No falta entregar nada', texto: 'Los premios a mano que ganen aparecen aquí.', icono: <Check aria-hidden="true" /> } : { titulo: 'Todavía nadie giró la ruleta' }}
        columnas={[
          { id: 'quien', titulo: 'Quién', tarjeta: 'titulo', celda: (g) => <>{g.quien || 'Sin nombre'}<span className={l.sub}>{g.correo}</span></> },
          { id: 'premio', titulo: 'Premio', tarjeta: 'detalle', celda: (g) => <>{g.premio}<span className={l.sub}>{TIPOS_PREMIO_RULETA.find((t) => t.valor === g.tipo)?.texto || g.tipo}</span></> },
          { id: 'cupon', titulo: 'Cupón', ancho: 150, tarjeta: 'detalle', celda: (g) => (g.cupon ? <code className={s.codigo}>{g.cupon}</code> : <span className={l.sub}>—</span>) },
          { id: 'semana', titulo: 'Semana', ancho: 120, tarjeta: 'detalle', celda: (g) => (g.semana ? `Del ${fechaDeDia(g.semana)}` : '—') },
          { id: 'estado', titulo: 'Entrega', ancho: 190, tarjeta: 'control', celda: (g) => (g.manual
            ? <Boton tamano="sm" variante={g.entregado ? 'fantasma' : 'secundario'} icono={g.entregado ? <Check aria-hidden="true" /> : undefined} cargando={marcando === g.id} onClick={() => marcar(g)}>{g.entregado ? 'Entregado' : 'Marcar entregado'}</Boton>
            : <span className={l.sub}>Llega solo</span>) },
        ]}
      />
    </>
  );
}

/**
 * La Ruleta semanal (/admin/ruleta).
 *  - pestana + onPestana · hoy ('YYYY-MM-DD', Lima) · diaSemana (0-6, Lima) · cargando · error · onReintentar
 *  - premios: [normalizarPremio] · onGuardarPremio(datos, id?) (premioRuletaAFirestore) · onEliminarPremio(id) · onReiniciarContador(id)
 *  - productos: [productoAdminDesde] · subirImagen(blob, { alAvanzar }) → url
 *  - config: normalizarConfig · onGuardarConfig(config)
 *  - ganados: [ganadoRuletaDesde] · cargandoGanados · errorGanados · onReintentarGanados · onMarcarEntregado(id, entregado)
 */
export function PaginaRuletaAdmin({
  pestana: pestanaFuera, onPestana, hoy = '', diaSemana = 0, cargando = false, error, onReintentar,
  premios = [], onGuardarPremio, onEliminarPremio, onReiniciarContador, productos = [], subirImagen,
  config, onGuardarConfig, ganados = [], cargandoGanados = false, errorGanados, onReintentarGanados, onMarcarEntregado,
}) {
  const toast = useToast();
  const [pestanaDentro, setPestanaDentro] = useState('premios');
  const pestana = pestanaFuera || pestanaDentro;
  const ir = (p) => (onPestana ? onPestana(p) : setPestanaDentro(p));
  const suma = sumaProbabilidades(premios);
  const sumaOk = Math.abs(suma - 100) < 0.01;
  const hoyLista = useMemo(() => premiosDeHoy(premios, { hoy, diaSemana, ganados: {} }), [premios, hoy, diaSemana]);
  const cabeza = { icono: 'ruleta', tono: 'rosa', titulo: 'Ruleta semanal', subtitulo: 'Qué se puede ganar, qué días sale cada premio y cómo se ve la rueda.' };
  const secciones = <div className={s.pestanas}><Pestanas etiqueta="Partes de la ruleta" opciones={PESTANAS} valor={pestana} onChange={ir} /></div>;

  if (pestana === 'premios') {
    return (
      <PaginaListaAdmin
        cabeza={cabeza}
        antes={(
          <>
            {secciones}
            <Aviso tipo={sumaOk ? 'exito' : 'aviso'} compacto titulo={`Las probabilidades suman ${suma.toFixed(1)} %.`}>
              {sumaOk ? 'Perfecto.' : 'Deberían sumar 100 %: mientras no, el sorteo reparte en proporción entre lo que hay y las probabilidades de verdad no son las que ves.'}
            </Aviso>
            <p className={s.nota}>{premios.length ? `${hoyLista.length} de ${premios.length} pueden salir hoy.` : 'Mientras no haya premios, la ruleta dice que está en preparación.'}</p>
          </>
        )}
        registros={premios}
        cargando={cargando}
        error={error}
        onReintentar={onReintentar}
        unidad={['premio', 'premios']}
        buscarEn={(p) => `${p.nombre} ${p.etiqueta} ${p.productName}`}
        placeholder="Buscar un premio"
        filtros={[
          { id: 'hoy', etiqueta: 'Hoy', todos: 'Salgan o no hoy', opciones: [{ valor: 'si', texto: 'Salen hoy' }, { valor: 'no', texto: 'No salen hoy' }], filtrar: (p, v) => (v === 'si') === !motivoRuletaHoy(p, hoy, diaSemana) },
          { id: 'tipo', etiqueta: 'Tipo', todos: 'Todos', opciones: TIPOS_PREMIO_RULETA, filtrar: (p, v) => p.tipo === v },
        ]}
        columnas={[
          { id: 'nombre', titulo: 'Premio', tarjeta: 'titulo', celda: (p) => <span className={s.premio}><span className={s.color} style={{ background: p.color || 'var(--violet-600)' }} aria-hidden="true" /><span>{p.icono ? `${p.icono} ` : ''}{p.nombre}{textoPremio(p).toLowerCase() !== p.nombre.toLowerCase() && <span className={l.sub}>{textoPremio(p)}</span>}</span></span> },
          { id: 'prob', titulo: 'Probabilidad', ancho: 120, alinear: 'fin', ordenable: true, tarjeta: 'detalle', celda: (p) => <span className={l.numero}>{p.probabilidad} %</span> },
          { id: 'cuando', titulo: 'Cuándo', tarjeta: 'detalle', celda: (p) => <>{textoDiasRuleta(p.dias)}{(p.desde || p.hasta) && <span className={l.sub}>{p.desde || '…'} → {p.hasta || '…'}</span>}</> },
          { id: 'cupo', titulo: 'Ganado', ancho: 130, alinear: 'fin', tarjeta: 'detalle', celda: (p) => <span className={l.numero}>{p.stockTotal != null ? `${entero(p.stockUsado)} de ${entero(p.stockTotal)}` : `${entero(p.stockUsado)} veces`}{p.maxPorUsuario != null && <span className={l.sub}>Máx. {p.maxPorUsuario} por persona</span>}</span> },
          { id: 'hoy', titulo: 'Hoy', ancho: 160, tarjeta: 'estado', celda: (p) => { const m = motivoRuletaHoy(p, hoy, diaSemana); return <InsigniaEstado estado={m ? 'no' : 'si'} estados={ESTADOS_HOY}>{m || 'Sale hoy'}</InsigniaEstado>; } },
        ]}
        ordenes={{ prob: (a, b) => a.probabilidad - b.probabilidad }}
        vacio={{ titulo: 'Todavía no hay premios', texto: 'Mientras no haya ninguno, la ruleta dice que está en preparación.' }}
        textos={{ creado: 'Premio creado', guardado: 'Premio guardado', eliminado: 'Premio eliminado' }}
        eliminar={{ texto: (p) => `Se borra «${p.nombre}» de la ruleta. Lo que ya se ganó no cambia.` }}
        masAcciones={(p) => (p.stockUsado > 0 && onReiniciarContador ? [{ id: 'reiniciar', etiqueta: 'Reiniciar el contador', Icono: RotateCcw, accion: async () => {
          try { await onReiniciarContador(p.id); toast({ tipo: 'exito', titulo: 'Contador reiniciado', texto: p.nombre }); } catch (err) { toast({ tipo: 'error', titulo: 'No se pudo', texto: errorDe(err) }); }
        } }] : [])}
        onGuardar={onGuardarPremio}
        onEliminar={onEliminarPremio}
        formulario={{
          nuevo: 'Nuevo premio',
          titulos: { nuevo: 'Nuevo premio', editar: 'Editar premio' },
          textoGuardar: { nuevo: 'Crear premio' },
          vacio: () => ({ ...VACIO, dias: [] }),
          desde: (p) => ({ ...VACIO, ...premioRuletaAFormulario(p), id: undefined }),
          validar: (d) => erroresDePremioRuleta(d),
          campos: ({ datos: d, cambiar, errores, idDe, id }) => {
            const otras = premios.filter((p) => p.id !== id).reduce((t, p) => t + p.probabilidad, 0);
            const conPct = d.tipo === 'descuento' || d.tipo === 'producto_descuento';
            const muestra = textoPremio(normalizarPremio({ ...d, id: 'x' }));
            return (
              <>
                <GrupoCampos titulo="El premio">
                  <div className={s.nombreIcono}>
                    <Campo etiqueta="Emoji" placeholder="🪙" maxLength={2} value={d.icono} onChange={(e) => cambiar('icono', e.target.value)} />
                    <Campo id={idDe('nombre')} etiqueta="Nombre" placeholder="Ej. 10 monedas" value={d.nombre} error={errores.nombre} onChange={(e) => cambiar('nombre', e.target.value)} />
                  </div>
                  <Campo etiqueta="Texto del gajo" ayuda="En el gajo caben pocas letras: lo largo se recorta." placeholder={d.nombre || 'El nombre, si lo dejas vacío'} maxLength={16} value={d.etiqueta} onChange={(e) => cambiar('etiqueta', e.target.value)} />
                  <Campo etiqueta="Qué gana" opciones={TIPOS_PREMIO_RULETA} value={d.tipo} onChange={(e) => cambiar('tipo', e.target.value)} />
                  {d.tipo === 'monedas' && <Campo etiqueta="Cuántas monedas" type="number" inputMode="numeric" min={0} sufijo="monedas" value={d.monedas} onChange={(e) => cambiar('monedas', Number(e.target.value))} />}
                  {PREMIO_RULETA_CON_PRODUCTO.includes(d.tipo) && (
                    <div className={s.producto} id={idDe('productId')} tabIndex={-1}>
                      <span className={s.nota}>{d.productId ? <>Producto: <strong>{d.productName || d.productId}</strong></> : 'Todavía no elegiste el producto.'}</span>
                      {errores.productId && <p className={s.error}>{errores.productId}</p>}
                      <SelectorProductos productos={productos} yaEstan={d.productId ? [d.productId] : []} accion={d.productId ? 'Cambiar a este' : 'Elegir este'} accionHecha="Es este" limite={5} onElegir={async (p) => { cambiar('productId', p.id); cambiar('productName', p.nombre); }} />
                    </div>
                  )}
                  {conPct && (
                    <div className={s.dos}>
                      <Campo id={idDe('descuentoPct')} etiqueta="Descuento" type="number" inputMode="decimal" min={0} max={100} sufijo="%" value={d.descuentoPct} error={errores.descuentoPct} onChange={(e) => cambiar('descuentoPct', Number(e.target.value))} />
                      {d.tipo === 'descuento' && (Number(d.descuentoPct) > 0
                        ? <CampoDinero id={idDe('topeDescuento')} etiqueta="Hasta (tope)" value={d.topeDescuento} error={errores.topeDescuento} onChange={(e) => cambiar('topeDescuento', Number(e.target.value))} />
                        : <CampoDinero etiqueta="O un monto fijo" value={d.descuentoMonto} onChange={(e) => cambiar('descuentoMonto', Number(e.target.value))} />)}
                    </div>
                  )}
                  {PREMIO_RULETA_CON_CUPON.includes(d.tipo) && <Campo etiqueta="El cupón vence en" type="number" inputMode="numeric" min={1} sufijo="días" value={d.vigenciaDias} onChange={(e) => cambiar('vigenciaDias', Number(e.target.value))} />}
                  {muestra && <p className={s.muestra}><span>El cliente verá:</span> {muestra}</p>}
                </GrupoCampos>
                <GrupoCampos titulo="Cuándo sale">
                  <Campo id={idDe('probabilidad')} etiqueta="Probabilidad" type="number" inputMode="decimal" min={0} step={0.1} sufijo="%" ayuda={`Con este, suman ${(otras + (Number(d.probabilidad) || 0)).toFixed(1)} % (deberían ser 100).`} value={d.probabilidad} error={errores.probabilidad} onChange={(e) => cambiar('probabilidad', Number(e.target.value))} />
                  <span className={s.etiqueta}>Qué días</span>
                  <span className={s.dias} role="group" aria-label="Días">
                    {DIAS_RULETA.map((x) => <Chip key={x.valor} tamano="sm" activo={d.dias.includes(x.valor)} onClick={() => cambiar('dias', d.dias.includes(x.valor) ? d.dias.filter((v) => v !== x.valor) : [...d.dias, x.valor].sort())}>{x.largo[0].toUpperCase() + x.largo.slice(1, 3)}</Chip>)}
                  </span>
                  <p className={s.nota}>{textoDiasRuleta(d.dias)}{d.dias.length ? '' : ' (sin marcar ninguno, sale todos los días)'}.</p>
                  <div className={s.dos}>
                    <CampoFecha etiqueta="Desde (opcional)" valor={d.desde} max={d.hasta || undefined} onCambiar={(v) => cambiar('desde', v)} />
                    <CampoFecha id={idDe('hasta')} etiqueta="Hasta (opcional)" valor={d.hasta} min={d.desde || undefined} error={errores.hasta} onCambiar={(v) => cambiar('hasta', v)} />
                  </div>
                  <div className={s.dos}>
                    <Campo etiqueta="Cuántos en total" ayuda="Vacío: sin límite." type="number" inputMode="numeric" min={0} placeholder="Sin límite" value={d.stockTotal} onChange={(e) => cambiar('stockTotal', e.target.value)} />
                    <Campo etiqueta="Máximo por persona" ayuda="Vacío: sin límite." type="number" inputMode="numeric" min={0} placeholder="Sin límite" value={d.maxPorUsuario} onChange={(e) => cambiar('maxPorUsuario', e.target.value)} />
                  </div>
                  <Interruptor etiqueta="Activo" descripcion="Apagado no sale en la rueda (no se borra)." activo={d.activo} onChange={(v) => cambiar('activo', v)} />
                </GrupoCampos>
                <GrupoCampos titulo="El gajo">
                  <CampoColor etiqueta="Color" ayuda="Vacío: el que le toque de la paleta." valor={d.color} onCambiar={(v) => cambiar('color', v)} />
                  {d.color && <Boton tamano="sm" variante="fantasma" onClick={() => cambiar('color', '')}>Usar el de la paleta</Boton>}
                </GrupoCampos>
              </>
            );
          },
        }}
      />
    );
  }

  return (
    <div className={s.pagina} data-componente="PaginaRuletaAdmin">
      <CabezaAdmin {...cabeza} />
      {secciones}
      {pestana === 'apariencia' && (error
        ? <Aviso tipo="error" titulo="No pudimos cargar la ruleta" accion={onReintentar && <Boton tamano="sm" variante="contorno" icono={<RefreshCw aria-hidden="true" />} onClick={onReintentar}>Reintentar</Boton>}>{error}</Aviso>
        : config ? <Apariencia config={config} premios={premios} premiosHoy={hoyLista} subirImagen={subirImagen} onGuardar={onGuardarConfig} /> : <p className={s.nota} aria-busy="true">Cargando…</p>)}
      {pestana === 'entregas' && <Entregas ganados={ganados} cargando={cargandoGanados} error={errorGanados} onReintentar={onReintentarGanados} onMarcarEntregado={onMarcarEntregado} />}
    </div>
  );
}
