import React, { useEffect, useMemo, useState } from 'react';
import { Save, Undo2 } from 'lucide-react';
import Boton from '../../Boton';
import { Aviso, Confirmar, useToast } from '../../Feedback';
import { Campo, Interruptor } from '../../Formulario';
import { Pestanas } from '../../Navegacion';
import { CabezaAdmin } from '../../piezas/admin/Marco';
import { TablaAdmin, BarraFiltros, InsigniaEstado } from '../../piezas/admin/Datos';
import { GrupoCampos, CampoDinero } from '../../piezas/admin/Formularios';
import { Cifra, FilaCifras } from '../../piezas/admin/Metricas';
import { normalizarBusqueda } from '../../adaptadoresAdmin';
import { tiempoRestante } from '../../../../utils/primeraCompra';
import l from './Lista.module.css';
import s from './Fidelidad.module.css';

/*
 * Primera compra gratis (/admin/primera-compra): la semana de bienvenida de
 * las cuentas nuevas. Cada amigo nuevo que compra con la invitación de alguien
 * en su semana le suma saldo (S/ 10) para su primera compra; mientras tanto sus
 * monedas y cupones quedan en pausa. Todo lo decide el servidor
 * (functions/primeraCompra.js); aquí se prende, se ajusta y se revisa.
 */

const entero = (n) => new Intl.NumberFormat('es-PE').format(Math.round(Number(n) || 0));
const soles = (n) => `S/ ${(Number(n) || 0).toFixed(2)}`;
const fechaHora = (ms) => (ms ? new Date(ms).toLocaleString('es-PE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');

export const ESTADOS_PREMIO_BIENVENIDA = {
  disponible: { texto: 'Sumado', tono: 'exito' },
  pendiente: { texto: 'Por confirmar', tono: 'aviso' },
  no_elegible: { texto: 'No suma', tono: 'neutro' },
  revertido: { texto: 'Revertido', tono: 'peligro' },
  vencido: { texto: 'Llegó tarde', tono: 'neutro' },
};

export const ESTADOS_FASE_BIENVENIDA = {
  activa: { texto: 'En su semana', tono: 'violeta' },
  usada: { texto: 'Ya compró', tono: 'exito' },
  vencida: { texto: 'Se le venció', tono: 'neutro' },
  no_aplica: { texto: 'No participa', tono: 'neutro' },
};

const MOTIVOS = {
  no_invitacion: 'No llegó con una invitación como cuenta nueva',
  minimo: 'No llegó al mínimo en productos',
  margen: 'Sus productos no dejan margen suficiente',
  con_saldo: 'Pagó con su saldo de bienvenida',
  revertido: 'Canceló o devolvió',
  vencido: 'Su pago se confirmó después del plazo',
  cuenta_anterior: 'Se registró antes de prender la promo',
  cliente_previo: 'Ya compraba antes',
};

const PESTANAS = [
  { id: 'premios', texto: 'Premios' },
  { id: 'cuentas', texto: 'Cuentas' },
  { id: 'ajustes', texto: 'Ajustes' },
];

const NUMEROS = [
  { id: 'premio', etiqueta: 'Premio por amigo', dinero: true, ayuda: 'Lo que suma al saldo cada amigo que cumple.' },
  { id: 'minimoNeto', etiqueta: 'Compra mínima del amigo', dinero: true, ayuda: 'En productos pagados con dinero (sin envío, monedas, cupones ni saldo).' },
  { id: 'margenMinimo', etiqueta: 'Margen mínimo de su canasta', dinero: true, ayuda: 'Después de costos, comisión y la provisión de monedas.' },
  { id: 'horas', etiqueta: 'Duración de la semana', sufijo: 'horas', ayuda: '168 = 7 días. Cuenta desde que se crea la cuenta.' },
  { id: 'comisionPct', etiqueta: 'Comisión de la pasarela', sufijo: '%', ayuda: 'Para calcular el margen del amigo.' },
  { id: 'provisionMonedas', etiqueta: 'Provisión de monedas', dinero: true, ayuda: 'Lo que se reserva por las monedas que se regalan.' },
  { id: 'margenPorDefecto', etiqueta: 'Margen de una marca sin configurar', sufijo: '%' },
  { id: 'saldoPctPorDefecto', etiqueta: 'Parte pagable con saldo (por defecto)', sufijo: '%' },
  { id: 'diasProteccionMonedas', etiqueta: 'Días sin reinicio de monedas', sufijo: 'días', ayuda: 'Después de la semana, sus monedas no se borran a fin de mes durante estos días.' },
];

/**
 * La página.
 *  - config: la de primeraCompraConfigSecure ({ activa, desdeMs, horas, premio,
 *    minimoNeto, margenMinimo, comisionPct, provisionMonedas, margenPorDefecto,
 *    saldoPctPorDefecto, diasProteccionMonedas, marcas: { id: { margenPct,
 *    saldoPct } }, cantidadCostos })
 *  - marcas: [{ id, nombre }] · premios · fases: los de primeraCompraListaSecure
 *  - cargando · error · onReintentar · onGuardar(cambios): promesa ·
 *    onRevertir(premio): promesa
 */
export function PaginaPrimeraCompraAdmin({
  config, marcas = [], premios = [], fases = [], cargando = false, error, onReintentar, onGuardar, onRevertir,
}) {
  const [pestana, setPestana] = useState('premios');
  const [busqueda, setBusqueda] = useState('');
  const [estado, setEstado] = useState('');
  const [revertir, setRevertir] = useState(null);
  const toast = useToast();

  const resumen = useMemo(() => {
    const activas = fases.filter((f) => f.estado === 'activa').length;
    const compraron = fases.filter((f) => f.estado === 'usada');
    const usado = compraron.reduce((t, f) => t + (Number(f.usado) || 0), 0);
    const amigos = premios.filter((p) => ['disponible', 'pendiente'].includes(p.estado) || (p.estado === 'revertido'));
    const sumados = premios.filter((p) => p.estado === 'disponible');
    const pendientes = premios.filter((p) => p.estado === 'pendiente');
    return {
      activas,
      compraron: compraron.length,
      conSaldo: compraron.filter((f) => f.usado > 0).length,
      usado,
      amigos: amigos.length,
      ganado: sumados.reduce((t, p) => t + p.monto, 0),
      pendiente: pendientes.reduce((t, p) => t + p.monto, 0),
      porAmigo: amigos.length ? usado / amigos.length : 0,
    };
  }, [premios, fases]);

  const filtrados = useMemo(() => {
    const q = normalizarBusqueda(busqueda);
    return premios.filter((p) => (!estado || p.estado === estado) && (!q || normalizarBusqueda(
      `${p.invitadorNombre || ''} ${p.compradorNombre || ''} ${p.orderId || ''}`,
    ).includes(q)));
  }, [premios, busqueda, estado]);

  return (
    <div className={s.pagina} data-componente="PaginaPrimeraCompraAdmin">
      <CabezaAdmin
        icono="recompensas"
        tono="rosa"
        titulo="Primera compra gratis"
        subtitulo="La semana de bienvenida: saldo por invitar amigos para la primera compra."
      />
      {config && !config.activa && (
        <Aviso tipo="aviso" compacto>
          La promo está apagada: ninguna cuenta nueva empieza su semana. Préndela en Ajustes.
        </Aviso>
      )}
      <FilaCifras etiqueta="Resumen de la promo">
        <Cifra nombre="En su semana" valor={entero(resumen.activas)} ayuda={resumen.activas === 1 ? 'cuenta' : 'cuentas'} tono="violeta" cargando={cargando} />
        <Cifra nombre="Primeras compras" valor={entero(resumen.compraron)} ayuda={`${entero(resumen.conSaldo)} con saldo`} tono="exito" cargando={cargando} />
        <Cifra nombre="Amigos que compraron" valor={entero(resumen.amigos)} ayuda={resumen.pendiente ? `${soles(resumen.pendiente)} por confirmar` : 'Nada por confirmar'} tono="rosa" cargando={cargando} />
        <Cifra
          nombre="Saldo usado"
          valor={soles(resumen.usado)}
          ayuda={resumen.amigos ? `${soles(resumen.porAmigo)} por amigo que compró` : 'Sin compras todavía'}
          explicacion="El saldo de bienvenida que se usó en primeras compras (a precio de venta), dividido entre los amigos nuevos que compraron. Compáralo con lo que cuesta conseguir una compra con publicidad."
          tono="aviso"
          cargando={cargando}
        />
      </FilaCifras>

      <div className={s.pestanas}><Pestanas etiqueta="Partes de la promo" opciones={PESTANAS} valor={pestana} onChange={setPestana} /></div>

      {pestana === 'premios' && (
        <>
          <BarraFiltros
            busqueda={busqueda}
            onBusqueda={setBusqueda}
            placeholder="Buscar por quién invitó, el amigo o el pedido"
            filtros={[{ id: 'estado', etiqueta: 'Estado', todos: 'Todos', opciones: Object.entries(ESTADOS_PREMIO_BIENVENIDA).map(([valor, e]) => ({ valor, texto: e.texto })), valor: estado }]}
            onFiltro={(_, v) => setEstado(v)}
            total={cargando || error ? undefined : filtrados.length}
            unidad={['premio', 'premios']}
          />
          <TablaAdmin
            etiqueta="Premios por amigos"
            filas={filtrados}
            idDe={(p) => `${p.invitadorUid}/${p.id}`}
            nombreDe={(p) => p.compradorNombre || p.orderId}
            cargando={cargando}
            error={error}
            onReintentar={onReintentar}
            acciones={onRevertir ? (p) => (['disponible', 'pendiente'].includes(p.estado)
              ? [{ id: 'revertir', etiqueta: 'Revertir el premio', Icono: Undo2, peligro: true, accion: () => setRevertir(p) }]
              : []) : undefined}
            vacio={premios.length ? { titulo: 'Nada coincide', texto: 'Prueba con otro estado o busca otra cosa.' } : { titulo: 'Todavía no hay premios', texto: 'Cuando un amigo compre con la invitación de alguien en su semana, aparece aquí.' }}
            columnas={[
              { id: 'invito', titulo: 'Quién invitó', tarjeta: 'titulo', celda: (p) => <>{p.invitadorNombre || 'Sin nombre'}<span className={l.sub}>{fechaHora(p.fechaMs)}</span></> },
              { id: 'amigo', titulo: 'Amigo', tarjeta: 'detalle', celda: (p) => <>{p.compradorNombre || '—'}<span className={l.sub}>Pedido {p.orderId || '—'}</span></> },
              { id: 'compra', titulo: 'Su compra', alinear: 'fin', ancho: 140, tarjeta: 'detalle', celda: (p) => <span className={l.numero}>{soles(p.neto)}<span className={l.sub}>Margen {soles(p.contribucion)}</span></span> },
              { id: 'premio', titulo: 'Premio', alinear: 'fin', ancho: 110, tarjeta: 'detalle', celda: (p) => <span className={l.numero}>{p.monto ? soles(p.monto) : '—'}{p.motivo && <span className={l.sub}>{MOTIVOS[p.motivo] || p.motivo}</span>}</span> },
              { id: 'estado', titulo: 'Estado', ancho: 140, tarjeta: 'estado', celda: (p) => <InsigniaEstado estado={p.estado} estados={ESTADOS_PREMIO_BIENVENIDA} /> },
            ]}
          />
        </>
      )}

      {pestana === 'cuentas' && (
        <CuentasPrimeraCompra fases={fases} horas={config?.horas} cargando={cargando} error={error} onReintentar={onReintentar} />
      )}

      {pestana === 'ajustes' && config && (
        <AjustesPrimeraCompra config={config} marcas={marcas} onGuardar={async (cambios) => {
          await onGuardar?.(cambios);
          toast?.({ tipo: 'exito', titulo: 'Ajustes guardados', texto: 'La promo usa los valores nuevos desde ahora.' });
        }} />
      )}

      <Confirmar
        abierta={Boolean(revertir)}
        titulo={revertir ? `¿Revertir el premio de ${revertir.invitadorNombre || 'esta persona'}?` : ''}
        texto={revertir ? `Se quita ${soles(revertir.monto)} de su saldo (si ya lo usó en su primera compra, el costo queda). Úsalo para cuentas falsas o pedidos anulados que el sistema no vio.` : ''}
        confirmar="Revertir"
        peligro
        onConfirmar={async () => {
          await onRevertir?.(revertir);
          setRevertir(null);
          toast?.({ tipo: 'exito', titulo: 'Premio revertido', texto: 'Se le avisó a quien invitó.' });
        }}
        onCancelar={() => setRevertir(null)}
      />
    </div>
  );
}

const fechaCorta = (ms) => (ms ? new Date(ms).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' }) : '—');
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

/** Cómo va la semana de una cuenta, en palabras. */
function textoSemana(f, ahora) {
  if (f.estado === 'activa') return { texto: `Le quedan ${tiempoRestante(f.venceMs, ahora)}`, sub: `Vence el ${fechaHora(f.venceMs)}` };
  if (f.estado === 'usada') return { texto: `Compró el ${fechaCorta(f.cerradaMs || f.venceMs)}`, sub: f.orderId ? `Pedido ${f.orderId}` : '' };
  if (f.estado === 'vencida') return { texto: `Venció el ${fechaCorta(f.venceMs)}`, sub: 'Sin comprar' };
  return { texto: MOTIVOS[f.motivo] || 'No participa', sub: '' };
}

/**
 * Cuentas: quién está en su semana de bienvenida, cuánto le queda, cuántos
 * amigos compraron con su invitación y su saldo. Las que no participan (cuentas
 * de antes, clientes que ya compraban) quedan fuera salvo que se pidan.
 */
function CuentasPrimeraCompra({ fases, horas = 168, cargando, error, onReintentar }) {
  const [busqueda, setBusqueda] = useState('');
  const [estado, setEstado] = useState('');
  const ahora = Date.now();
  const noParticipan = fases.filter((f) => f.estado === 'no_aplica').length;
  const filas = useMemo(() => {
    const q = normalizarBusqueda(busqueda);
    const orden = { activa: 0, usada: 1, vencida: 2, no_aplica: 3 };
    return fases
      .filter((f) => (estado ? f.estado === estado : f.estado !== 'no_aplica'))
      .filter((f) => !q || normalizarBusqueda(`${f.nombre || ''} ${f.email || ''} ${f.telefono || ''}`).includes(q))
      .sort((a, b) => (orden[a.estado] - orden[b.estado]) || ((b.inicioMs || 0) - (a.inicioMs || 0)));
  }, [fases, busqueda, estado]);
  return (
    <>
      <Aviso tipo="info" compacto>
        {`Cada cuenta nueva tiene ${Math.round(horas / 24)} días para invitar amigos y usar su saldo en su primera compra. `}
        {noParticipan > 0 && !estado && `${noParticipan === 1 ? 'No se muestra 1 cuenta que no participa' : `No se muestran ${noParticipan} cuentas que no participan`} (creadas antes de prender la promo o que ya compraban): para verlas, elige «No participa» en Estado.`}
      </Aviso>
      <BarraFiltros
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        placeholder="Buscar por nombre, correo o teléfono"
        filtros={[{
          id: 'estado', etiqueta: 'Estado', todos: 'Las que participan',
          opciones: Object.entries(ESTADOS_FASE_BIENVENIDA).map(([valor, e]) => ({ valor, texto: e.texto })), valor: estado,
        }]}
        onFiltro={(_, v) => setEstado(v)}
        total={cargando || error ? undefined : filas.length}
        unidad={['cuenta', 'cuentas']}
      />
      <TablaAdmin
        etiqueta="Cuentas con semana de bienvenida"
        filas={filas}
        idDe={(f) => f.uid}
        nombreDe={(f) => f.nombre || f.email || 'Cuenta sin nombre'}
        cargando={cargando}
        error={error}
        onReintentar={onReintentar}
        vacio={fases.length
          ? { titulo: 'Nada coincide', texto: 'Prueba con otro estado o busca otra cosa.' }
          : { titulo: 'Todavía no hay cuentas', texto: 'Cada cuenta nueva aparece aquí cuando entra a la tienda por primera vez.' }}
        columnas={[
          {
            id: 'cliente', titulo: 'Cliente', tarjeta: 'titulo',
            celda: (f) => <>{f.nombre || f.email || 'Cuenta sin nombre'}<span className={l.sub}>{[f.nombre && f.email, f.telefono].filter(Boolean).join(' · ') || `Se registró el ${fechaCorta(f.inicioMs)}`}</span></>,
          },
          {
            id: 'semana', titulo: 'Su semana', ancho: 190, tarjeta: 'detalle',
            celda: (f) => { const t = textoSemana(f, ahora); return <>{t.texto}{t.sub && <span className={l.sub}>{t.sub}</span>}</>; },
          },
          {
            id: 'amigos', titulo: 'Amigos que compraron', alinear: 'fin', ancho: 170, tarjeta: 'detalle',
            celda: (f) => (f.amigos?.compraron
              ? <span className={l.numero}><span className={l.soloTarjeta}>Amigos que compraron </span>{entero(f.amigos.compraron)}<span className={l.sub}>{plural(f.amigos.suman, 'suma saldo', 'suman saldo')}</span></span>
              : <span className={l.sub}><span className={l.soloTarjeta}>Amigos que compraron </span>Ninguno todavía</span>),
          },
          {
            id: 'saldo', titulo: 'Saldo', alinear: 'fin', ancho: 150, tarjeta: 'detalle',
            celda: (f) => {
              if (f.estado === 'usada') return <span className={l.numero}><span className={l.soloTarjeta}>Saldo </span>{f.usado ? `Usó ${soles(f.usado)}` : 'No usó saldo'}</span>;
              if (f.estado === 'activa') {
                const a = f.amigos || {};
                return <span className={l.numero}><span className={l.soloTarjeta}>Saldo </span>{soles(a.saldo)}<span className={l.sub}>{a.pendiente ? `${soles(a.pendiente)} por confirmar` : 'disponible'}</span></span>;
              }
              return <span className={l.sub}>—</span>;
            },
          },
          { id: 'estado', titulo: 'Estado', ancho: 150, tarjeta: 'estado', celda: (f) => <InsigniaEstado estado={f.estado} estados={ESTADOS_FASE_BIENVENIDA} /> },
        ]}
      />
    </>
  );
}

/** Ajustes: el interruptor, los montos y lo de cada marca. */
function AjustesPrimeraCompra({ config, marcas, onGuardar }) {
  const desde = (c) => ({
    activa: Boolean(c.activa),
    ...Object.fromEntries(NUMEROS.map((n) => [n.id, c[n.id] ?? ''])),
    marcas: Object.fromEntries(marcas.map((m) => [m.id, {
      margenPct: c.marcas?.[m.id]?.margenPct ?? '',
      saldoPct: c.marcas?.[m.id]?.saldoPct ?? '',
    }])),
  });
  const [datos, setDatos] = useState(() => desde(config));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [confirmarPrender, setConfirmarPrender] = useState(false);
  useEffect(() => { setDatos(desde(config)); }, [config, marcas]); // eslint-disable-line react-hooks/exhaustive-deps

  const cambiar = (id, v) => setDatos((d) => ({ ...d, [id]: v }));
  const cambiarMarca = (id, campo, v) => setDatos((d) => ({ ...d, marcas: { ...d.marcas, [id]: { ...d.marcas[id], [campo]: v } } }));
  const guardar = async () => {
    setGuardando(true);
    setError('');
    try {
      const cambios = { activa: datos.activa, marcas: datos.marcas };
      NUMEROS.forEach((n) => { if (datos[n.id] !== '') cambios[n.id] = Number(datos[n.id]); });
      await onGuardar(cambios);
    } catch (e) {
      setError(e?.message || 'No se pudieron guardar los ajustes.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <>
      <GrupoCampos titulo="La promo" ayuda={config.desdeMs ? `Participan las cuentas creadas desde el ${fechaHora(config.desdeMs)}` : 'Al prenderla por primera vez, participan las cuentas que se creen desde ese momento.'}>
        <Interruptor
          activo={datos.activa}
          onChange={(v) => (v && !config.activa ? setConfirmarPrender(true) : cambiar('activa', v))}
          etiqueta="Promo prendida"
          descripcion="Apagarla no quita el saldo a quien ya está en su semana; solo deja de empezar semanas nuevas."
        />
      </GrupoCampos>
      <GrupoCampos titulo="Montos y reglas" columnas={2}>
        {NUMEROS.map((n) => (n.dinero
          ? <CampoDinero key={n.id} etiqueta={n.etiqueta} ayuda={n.ayuda} value={datos[n.id]} onChange={(e) => cambiar(n.id, e.target.value)} />
          : <Campo key={n.id} etiqueta={n.etiqueta} ayuda={n.ayuda} type="number" inputMode="decimal" min={0} sufijo={n.sufijo} value={datos[n.id]} onChange={(e) => cambiar(n.id, e.target.value)} />))}
      </GrupoCampos>
      <GrupoCampos
        titulo="Por marca"
        ayuda={`Margen: cuánto deja cada sol vendido, para saber si la compra de un amigo da premio. Parte pagable: qué % del precio se paga con saldo. Vacío = el de por defecto. Los productos con costo cargado (${entero(config.cantidadCostos)}, de Lumi) usan su costo real.`}
      >
        <TablaAdmin
          etiqueta="Ajustes por marca"
          filas={marcas}
          nombreDe={(m) => m.nombre}
          vacio={{ titulo: 'No hay marcas', texto: 'Las marcas salen de Catálogo → Marcas.' }}
          columnas={[
            { id: 'marca', titulo: 'Marca', tarjeta: 'titulo', celda: (m) => m.nombre },
            { id: 'margen', titulo: 'Margen', ancho: 150, tarjeta: 'detalle', celda: (m) => <Campo etiqueta={`Margen de ${m.nombre}`} type="number" inputMode="decimal" min={0} max={100} sufijo="%" placeholder={String(datos.margenPorDefecto || '')} value={datos.marcas[m.id]?.margenPct ?? ''} onChange={(e) => cambiarMarca(m.id, 'margenPct', e.target.value)} /> },
            { id: 'saldo', titulo: 'Pagable con saldo', ancho: 170, tarjeta: 'detalle', celda: (m) => <Campo etiqueta={`Pagable con saldo en ${m.nombre}`} type="number" inputMode="decimal" min={0} max={100} sufijo="%" placeholder={String(datos.saldoPctPorDefecto || '')} value={datos.marcas[m.id]?.saldoPct ?? ''} onChange={(e) => cambiarMarca(m.id, 'saldoPct', e.target.value)} /> },
          ]}
        />
      </GrupoCampos>
      {error && <Aviso tipo="error" compacto>{error}</Aviso>}
      <div>
        <Boton onClick={guardar} cargando={guardando} icono={<Save aria-hidden="true" />}>Guardar ajustes</Boton>
      </div>
      <Confirmar
        abierta={confirmarPrender}
        titulo="¿Prender la promo?"
        texto="Desde que guardes, cada cuenta nueva empieza su semana de bienvenida: sus monedas y cupones quedan en pausa y gana saldo por invitar. Antes, publica la versión nueva de la app para que web y app muestren lo mismo."
        confirmar="Prender"
        onConfirmar={() => { cambiar('activa', true); setConfirmarPrender(false); }}
        onCancelar={() => setConfirmarPrender(false)}
      />
    </>
  );
}
