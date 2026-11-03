import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getBrands } from '../../services/brands';
import {
  adminBolitas, listarPatrociniosBolitas, leerMundosBolitas, leerPremiosBolitas,
} from '../../services/firebase/ballSort';
import { limaTodayStr } from '../../utils/fechaLima';
import styles from './AdminBolitasPage.module.css';

/*
 * /admin/bolitas — Las Bolitas de Kapi con las marcas (fase 3, JUEGOS.md):
 *  - Patrocinios: qué marca auspicia el reto de cada día, el cupón (de esa
 *    marca: solo descuenta sus productos) y cuántos se entregan como máximo.
 *  - Mundos: las marcas de los mundos de 20 niveles, en orden (se repiten).
 *  - Premios del ranking semanal: cupones para los primeros puestos (los
 *    entrega el servidor cada lunes, premiarRankingBolitas).
 *  - Métricas: partidas, retos, niveles donde se traban, si vuelven y los
 *    toques hacia la tienda.
 * Todo se guarda con adminBolitasSecure (el servidor comprueba que seas admin
 * y pone topes: 50 % o S/ 100 por cupón, 1000 cupones por día).
 */

const CUPON_VACIO = { tipo: 'descuento', descuentoPct: 10, descuentoMonto: 0, topeDescuento: 0, vigenciaDias: 15 };

const textoCupon = (c) => {
  if (!c) return '—';
  if (c.tipo === 'envio_gratis') return `Envío gratis · ${c.vigenciaDias} días`;
  const valor = c.descuentoPct > 0 ? `${c.descuentoPct} %${c.topeDescuento ? ` (tope S/ ${c.topeDescuento})` : ''}` : `S/ ${c.descuentoMonto}`;
  return `${valor} · ${c.vigenciaDias} días`;
};

/** Los campos de un cupón: tipo, valor (porcentaje o monto), tope y vigencia. */
function CamposCupon({ valor, onChange }) {
  const c = valor || CUPON_VACIO;
  const enPct = c.tipo === 'descuento' && !(c.descuentoMonto > 0 && !c.descuentoPct);
  const cambiar = (cambios) => onChange({ ...c, ...cambios });
  return (
    <div className={styles.filaCampos}>
      <label className={styles.campo}>
        <span>Cupón</span>
        <select
          value={c.tipo === 'envio_gratis' ? 'envio' : enPct ? 'pct' : 'monto'}
          onChange={(e) => {
            const v = e.target.value;
            if (v === 'envio') cambiar({ tipo: 'envio_gratis' });
            else if (v === 'pct') cambiar({ tipo: 'descuento', descuentoPct: c.descuentoPct || 10, descuentoMonto: 0 });
            else cambiar({ tipo: 'descuento', descuentoPct: 0, descuentoMonto: c.descuentoMonto || 10 });
          }}
        >
          <option value="pct">% de descuento</option>
          <option value="monto">S/ de descuento</option>
          <option value="envio">Envío gratis</option>
        </select>
      </label>
      {c.tipo === 'descuento' && enPct && (
        <>
          <label className={styles.campo}>
            <span>%</span>
            <input type="number" min="1" max="50" value={c.descuentoPct} onChange={(e) => cambiar({ descuentoPct: Number(e.target.value) })} />
          </label>
          <label className={styles.campo}>
            <span>Tope S/ (0 = sin tope)</span>
            <input type="number" min="0" value={c.topeDescuento} onChange={(e) => cambiar({ topeDescuento: Number(e.target.value) })} />
          </label>
        </>
      )}
      {c.tipo === 'descuento' && !enPct && (
        <label className={styles.campo}>
          <span>S/</span>
          <input type="number" min="1" max="100" value={c.descuentoMonto} onChange={(e) => cambiar({ descuentoMonto: Number(e.target.value) })} />
        </label>
      )}
      <label className={styles.campo}>
        <span>Vence en (días)</span>
        <input type="number" min="1" max="90" value={c.vigenciaDias} onChange={(e) => cambiar({ vigenciaDias: Number(e.target.value) })} />
      </label>
    </div>
  );
}

function SelectorMarca({ marcas, valor, onChange, vacio = 'Elige una marca' }) {
  return (
    <select value={valor || ''} onChange={(e) => onChange(e.target.value)}>
      <option value="">{vacio}</option>
      {marcas.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
    </select>
  );
}

/* ── Patrocinios ── */
function Patrocinios({ marcas }) {
  const hoy = limaTodayStr();
  const qc = useQueryClient();
  const [form, setForm] = useState({ fecha: hoy, marcaId: '', cupo: 50, activo: true, cupon: CUPON_VACIO });
  const lista = useQuery({ queryKey: ['admin-bolitas-patrocinios', hoy], queryFn: () => listarPatrociniosBolitas(hoy) });
  const guardar = useMutation({
    mutationFn: () => {
      const marca = marcas.find((m) => m.id === form.marcaId);
      if (!marca) throw new Error('Elige la marca.');
      return adminBolitas('guardarPatrocinio', {
        fecha: form.fecha,
        patrocinio: { marcaId: marca.id, marcaNombre: marca.name, cupo: form.cupo, activo: form.activo, cupon: form.cupon },
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-bolitas-patrocinios'] }); alert('Patrocinio guardado.'); },
    onError: (e) => alert(e.message),
  });
  const borrar = useMutation({
    mutationFn: (fecha) => adminBolitas('borrarPatrocinio', { fecha }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-bolitas-patrocinios'] }),
    onError: (e) => alert(e.message),
  });
  const editar = (p) => setForm({ fecha: p.fecha, marcaId: p.marcaId, cupo: p.cupo, activo: p.activo !== false, cupon: p.cupon });

  return (
    <section className={styles.card}>
      <h2>Reto patrocinado</h2>
      <p className={styles.nota}>
        La marca aparece en el reto de ese día y quien lo completa (con sesión) recibe su cupón, hasta llenar el cupo. El
        cupón solo descuenta productos de esa marca. Los días sin patrocinio, el reto sale normal.
      </p>
      <form className={styles.form} onSubmit={(e) => { e.preventDefault(); guardar.mutate(); }}>
        <div className={styles.filaCampos}>
          <label className={styles.campo}>
            <span>Fecha</span>
            <input type="date" min={hoy} value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} required />
          </label>
          <label className={styles.campo}>
            <span>Marca</span>
            <SelectorMarca marcas={marcas} valor={form.marcaId} onChange={(marcaId) => setForm({ ...form, marcaId })} />
          </label>
          <label className={styles.campo}>
            <span>Cupo (cupones)</span>
            <input type="number" min="1" max="1000" value={form.cupo} onChange={(e) => setForm({ ...form, cupo: Number(e.target.value) })} />
          </label>
          <label className={styles.casilla}>
            <input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} />
            <span>Activo</span>
          </label>
        </div>
        <CamposCupon valor={form.cupon} onChange={(cupon) => setForm({ ...form, cupon })} />
        <button type="submit" className={styles.boton} disabled={guardar.isPending}>{guardar.isPending ? 'Guardando…' : 'Guardar patrocinio'}</button>
      </form>

      {lista.isLoading && <p>Cargando…</p>}
      {lista.data?.length === 0 && <p className={styles.nota}>No hay patrocinios desde hoy.</p>}
      {lista.data?.length > 0 && (
        <table className={styles.tabla}>
          <thead><tr><th>Fecha</th><th>Marca</th><th>Cupón</th><th>Entregados</th><th /></tr></thead>
          <tbody>
            {lista.data.map((p) => (
              <tr key={p.fecha} className={p.activo === false ? styles.apagado : undefined}>
                <td><strong>{p.fecha}</strong>{p.fecha === hoy && <span className={styles.chip}>hoy</span>}</td>
                <td>{p.marcaNombre}</td>
                <td>{textoCupon(p.cupon)}</td>
                <td>{p.entregados || 0} / {p.cupo}</td>
                <td className={styles.acciones}>
                  <button type="button" className={styles.botonChico} onClick={() => editar(p)}>Editar</button>
                  <button type="button" className={styles.botonBorrar} onClick={() => { if (window.confirm(`¿Quitar el patrocinio del ${p.fecha}?`)) borrar.mutate(p.fecha); }}>Quitar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

/* ── Marcas de los mundos ── */
function Mundos({ marcas }) {
  const qc = useQueryClient();
  const actual = useQuery({ queryKey: ['admin-bolitas-mundos'], queryFn: leerMundosBolitas });
  const [orden, setOrden] = useState(null);
  const [agregar, setAgregar] = useState('');
  useEffect(() => { if (actual.data !== undefined && orden === null) setOrden(actual.data?.marcas || []); }, [actual.data, orden]);
  const guardar = useMutation({
    mutationFn: () => adminBolitas('guardarMundos', { marcas: orden }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-bolitas-mundos'] }); alert('Mundos guardados.'); },
    onError: (e) => alert(e.message),
  });
  const lista = orden || [];
  const mover = (k, d) => {
    const n = [...lista];
    [n[k], n[k + d]] = [n[k + d], n[k]];
    setOrden(n);
  };
  const libres = marcas.filter((m) => !lista.some((x) => x.id === m.id));

  return (
    <section className={styles.card}>
      <h2>Marcas de los mundos</h2>
      <p className={styles.nota}>
        Cada mundo de 20 niveles toma los colores y el logo de una marca, en este orden (cuando se acaban, se repiten). Al
        vencer al jefe del mundo se muestran productos de la marca. Sin marcas, los mundos usan sus nombres de siempre.
      </p>
      <ol className={styles.listaMundos}>
        {lista.map((m, k) => (
          <li key={m.id}>
            <span>Mundo {k + 1}{lista.length ? `, ${k + 1 + lista.length}…` : ''}: <strong>{m.nombre}</strong></span>
            <span className={styles.acciones}>
              <button type="button" className={styles.botonChico} disabled={k === 0} onClick={() => mover(k, -1)} aria-label="Subir">↑</button>
              <button type="button" className={styles.botonChico} disabled={k === lista.length - 1} onClick={() => mover(k, 1)} aria-label="Bajar">↓</button>
              <button type="button" className={styles.botonBorrar} onClick={() => setOrden(lista.filter((x) => x.id !== m.id))}>Quitar</button>
            </span>
          </li>
        ))}
      </ol>
      <div className={styles.filaCampos}>
        <label className={styles.campo}>
          <span>Agregar marca</span>
          <SelectorMarca marcas={libres} valor={agregar} onChange={setAgregar} />
        </label>
        <button
          type="button"
          className={styles.botonChico}
          disabled={!agregar}
          onClick={() => {
            const m = marcas.find((x) => x.id === agregar);
            if (m) setOrden([...lista, { id: m.id, nombre: m.name }]);
            setAgregar('');
          }}
        >
          Agregar
        </button>
      </div>
      <button type="button" className={styles.boton} disabled={guardar.isPending || orden === null} onClick={() => guardar.mutate()}>
        {guardar.isPending ? 'Guardando…' : 'Guardar el orden'}
      </button>
    </section>
  );
}

/* ── Premios del ranking semanal ── */
function Premios({ marcas }) {
  const qc = useQueryClient();
  const actual = useQuery({ queryKey: ['admin-bolitas-premios'], queryFn: leerPremiosBolitas });
  const [form, setForm] = useState(null);
  useEffect(() => {
    if (actual.data !== undefined && form === null) {
      setForm({ activo: actual.data?.activo !== false && Boolean(actual.data), puestos: actual.data?.puestos || [] });
    }
  }, [actual.data, form]);
  const guardar = useMutation({
    mutationFn: () => adminBolitas('guardarPremios', {
      activo: form.activo,
      puestos: form.puestos.map((p) => ({ ...p, marcaNombre: marcas.find((m) => m.id === p.marcaId)?.name || null })),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-bolitas-premios'] }); alert('Premios guardados.'); },
    onError: (e) => alert(e.message),
  });
  const [semana, setSemana] = useState('');
  const premiar = useMutation({
    mutationFn: () => adminBolitas('premiarSemana', { semana }),
    onSuccess: (r) => alert(r.ya ? 'Esa semana ya estaba premiada.' : r.sinPremios ? 'No hay premios configurados (o están apagados).' : `Listo: ${r.entregados} cupones entregados.`),
    onError: (e) => alert(e.message),
  });
  if (!form) return <section className={styles.card}><h2>Premios del ranking semanal</h2><p>Cargando…</p></section>;
  const cambiar = (k, cambios) => setForm({ ...form, puestos: form.puestos.map((p, i) => (i === k ? { ...p, ...cambios } : p)) });

  return (
    <section className={styles.card}>
      <h2>Premios del ranking semanal</h2>
      <p className={styles.nota}>
        Cada lunes a las 00:15 se premia la semana que terminó (ranking del reto del día: más retos hechos; empate, menos
        movimientos). Si eliges una marca, el cupón solo descuenta sus productos.
      </p>
      <label className={styles.casilla}>
        <input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} />
        <span>Entregar premios cada lunes</span>
      </label>
      {form.puestos.map((p, k) => (
        <div key={k} className={styles.premio}>
          <div className={styles.filaCampos}>
            <label className={styles.campo}>
              <span>Desde el puesto</span>
              <input type="number" min="1" value={p.desde} onChange={(e) => cambiar(k, { desde: Number(e.target.value) })} />
            </label>
            <label className={styles.campo}>
              <span>Hasta el puesto</span>
              <input type="number" min="1" value={p.hasta} onChange={(e) => cambiar(k, { hasta: Number(e.target.value) })} />
            </label>
            <label className={styles.campo}>
              <span>Marca (opcional)</span>
              <SelectorMarca marcas={marcas} valor={p.marcaId} onChange={(marcaId) => cambiar(k, { marcaId: marcaId || null })} vacio="Toda la tienda" />
            </label>
            <button type="button" className={styles.botonBorrar} onClick={() => setForm({ ...form, puestos: form.puestos.filter((_, i) => i !== k) })}>Quitar</button>
          </div>
          <CamposCupon valor={p.cupon} onChange={(cupon) => cambiar(k, { cupon })} />
        </div>
      ))}
      <button
        type="button"
        className={styles.botonChico}
        onClick={() => {
          const ultimo = form.puestos[form.puestos.length - 1];
          const desde = ultimo ? Number(ultimo.hasta) + 1 : 1;
          setForm({ ...form, puestos: [...form.puestos, { desde, hasta: desde, cupon: CUPON_VACIO, marcaId: null }] });
        }}
      >
        Agregar un premio
      </button>
      <button type="button" className={styles.boton} disabled={guardar.isPending} onClick={() => guardar.mutate()}>
        {guardar.isPending ? 'Guardando…' : 'Guardar premios'}
      </button>
      <div className={styles.filaCampos}>
        <label className={styles.campo}>
          <span>Premiar a mano una semana (su lunes)</span>
          <input type="date" value={semana} onChange={(e) => setSemana(e.target.value)} />
        </label>
        <button type="button" className={styles.botonChico} disabled={!semana || premiar.isPending} onClick={() => premiar.mutate()}>Premiar</button>
      </div>
    </section>
  );
}

/* ── Métricas ── */
const pct = (x) => (x.base ? `${Math.round((x.cantidad / x.base) * 100)} %` : '—');

function Metricas({ marcas }) {
  const [dias, setDias] = useState(14);
  const m = useQuery({ queryKey: ['admin-bolitas-metricas', dias], queryFn: () => adminBolitas('metricas', { dias }) });
  const totales = useMemo(() => {
    const porDia = m.data?.porDia || [];
    const niveles = {};
    const clicsMarca = {};
    let partidas = 0;
    let retos = 0;
    let clics = 0;
    for (const d of porDia) {
      partidas += d.partidas || 0;
      retos += d.retos || 0;
      clics += d.clics || 0;
      for (const [n, c] of Object.entries(d.niveles || {})) niveles[n] = (niveles[n] || 0) + c;
      for (const [id, c] of Object.entries(d.clicsPorMarca || {})) clicsMarca[id] = (clicsMarca[id] || 0) + c;
    }
    return { partidas, retos, clics, niveles, clicsMarca };
  }, [m.data]);
  const j = m.data?.jugadores;
  const trabados = Object.entries(j?.trabados || {}).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const nombreMarca = (id) => marcas.find((x) => x.id === id)?.name || id;

  return (
    <section className={styles.card}>
      <h2>Métricas</h2>
      <div className={styles.filaCampos}>
        <label className={styles.campo}>
          <span>Período</span>
          <select value={dias} onChange={(e) => setDias(Number(e.target.value))}>
            <option value={7}>Últimos 7 días</option>
            <option value={14}>Últimos 14 días</option>
            <option value={30}>Últimos 30 días</option>
          </select>
        </label>
      </div>
      {m.isLoading && <p>Cargando…</p>}
      {m.isError && <p className={styles.error}>No se pudieron cargar las métricas.</p>}
      {m.data && (
        <>
          <p className={styles.nota}>Solo cuenta a quienes juegan con sesión (las partidas que comprueba el servidor). Los toques hacia la tienda cuentan a todos.</p>
          <div className={styles.cifras}>
            <div><strong>{totales.partidas}</strong><span>partidas ganadas</span></div>
            <div><strong>{totales.retos}</strong><span>retos hechos</span></div>
            <div><strong>{totales.clics}</strong><span>toques hacia la tienda</span></div>
            <div><strong>{j?.jugadores ?? 0}</strong><span>jugadores (90 días)</span></div>
            <div><strong>{pct(j?.vuelven || {})}</strong><span>volvieron otro día</span></div>
            <div><strong>{pct(j?.siguen7 || {})}</strong><span>siguen 7 días después</span></div>
          </div>
          <div className={styles.columnas}>
            <div>
              <h3>Dónde se traban</h3>
              <p className={styles.nota}>Nivel más alto de quienes no juegan hace 3 días o más.</p>
              {trabados.length ? (
                <table className={styles.tabla}>
                  <thead><tr><th>Nivel</th><th>Jugadores</th></tr></thead>
                  <tbody>{trabados.map(([n, c]) => <tr key={n}><td>{n}</td><td>{c}</td></tr>)}</tbody>
                </table>
              ) : <p className={styles.nota}>Todavía no hay datos.</p>}
            </div>
            <div>
              <h3>Hacia la tienda, por marca</h3>
              {Object.keys(totales.clicsMarca).length ? (
                <table className={styles.tabla}>
                  <thead><tr><th>Marca</th><th>Toques</th></tr></thead>
                  <tbody>
                    {Object.entries(totales.clicsMarca).sort((a, b) => b[1] - a[1]).map(([id, c]) => <tr key={id}><td>{nombreMarca(id)}</td><td>{c}</td></tr>)}
                  </tbody>
                </table>
              ) : <p className={styles.nota}>Todavía no hay datos.</p>}
            </div>
          </div>
          <h3>Por día</h3>
          <table className={styles.tabla}>
            <thead><tr><th>Día</th><th>Partidas</th><th>Retos</th><th>Toques tienda</th></tr></thead>
            <tbody>
              {(m.data.porDia || []).map((d) => (
                <tr key={d.fecha}><td>{d.fecha}</td><td>{d.partidas || 0}</td><td>{d.retos || 0}</td><td>{d.clics || 0}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}

export default function AdminBolitasPage() {
  const marcasQ = useQuery({ queryKey: ['admin-bolitas-marcas'], queryFn: () => getBrands().then((r) => r?.data || []) });
  const marcas = (marcasQ.data || []).filter((m) => m.active !== false && m.visible !== false);
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>Las Bolitas de Kapi</h1>
        <p>Las marcas en el juego: el reto patrocinado, los mundos, los premios del ranking y cómo va el juego.</p>
      </header>
      {marcasQ.isLoading ? <p>Cargando marcas…</p> : (
        <div className={styles.secciones}>
          <Patrocinios marcas={marcas} />
          <Mundos marcas={marcas} />
          <Premios marcas={marcas} />
          <Metricas marcas={marcas} />
        </div>
      )}
    </div>
  );
}
