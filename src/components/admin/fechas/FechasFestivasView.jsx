// Admin → Fechas importantes → "Fechas festivas": el calendario de fechas que
// se celebran cada año (Día de la Madre, Navidad…). Cada una tiene una REGLA
// (día fijo o "2.º domingo de mayo"), a quién de "Fechas importantes" le toca,
// cuántos días antes se avisa y si se avisa también a quien no tiene a nadie
// anotado. Se guarda todo en storeConfig/fechasFestivas.
import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRing, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import {
  getFechasFestivas, saveFechasFestivas, FESTIVAS_QUERY_KEY,
  getRecordatorioPersonal, saveRecordatorioPersonal, RECORDATORIO_QUERY_KEY, probarAvisoFechas,
} from '../../../services/fechasFestivas';
import {
  FESTIVAS_DEFAULT, MESES, DIAS_SEMANA, ORDINALES, ROLES,
  normalizarFestiva, fechaDelAnio, proximaFecha, textoRegla, textoFecha, hoyLocal,
  normalizarDiasAviso, textoDiasAviso,
} from '../../../utils/fechasFestivas.mjs';
import styles from './FechasFestivasView.module.css';

const NUEVA = {
  id: '', nombre: '', emoji: '🎁', activo: true,
  regla: { tipo: 'fija', mes: 1, dia: 1 },
  para: { roles: [], genero: '' },
  avisarDias: [7, 2],
  avisarATodos: false,
};

const idDesde = (nombre, usados) => {
  const base = String(nombre || 'fecha').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30) || 'fecha';
  let id = base;
  let i = 2;
  while (usados.includes(id)) id = `${base}_${i++}`;
  return id;
};

const textoPara = (f) => {
  const roles = f.para.roles.map((r) => ROLES.find((x) => x.id === r)?.label).filter(Boolean);
  const genero = f.para.genero === 'Femenino' ? 'mujeres' : f.para.genero === 'Masculino' ? 'hombres' : '';
  if (!roles.length && !genero) return 'Todas las personas';
  if (!roles.length) return genero === 'mujeres' ? 'Todas las mujeres' : 'Todos los hombres';
  return `${roles.join(', ')}${genero ? ` (${genero})` : ''}`;
};

const Editor = ({ inicial, usados, onGuardar, onCancelar, guardando }) => {
  const [f, setF] = useState(inicial);
  const [diasTexto, setDiasTexto] = useState((inicial.avisarDias || []).join(', '));
  const set = (campo, valor) => setF((x) => ({ ...x, [campo]: valor }));
  const setRegla = (campo, valor) => setF((x) => ({ ...x, regla: { ...x.regla, [campo]: valor } }));
  const toggleRol = (rol) => setF((x) => {
    const roles = x.para.roles.includes(rol) ? x.para.roles.filter((r) => r !== rol) : [...x.para.roles, rol];
    return { ...x, para: { ...x.para, roles } };
  });

  const anio = new Date().getFullYear();
  const enviar = (e) => {
    e.preventDefault();
    const avisarDias = diasTexto.split(/[,\s]+/).map(Number).filter((n) => n > 0);
    onGuardar(normalizarFestiva({ ...f, id: f.id || idDesde(f.nombre, usados), avisarDias }));
  };

  return (
    <form className={styles.editor} onSubmit={enviar}>
      <h3>{inicial.id ? `Editar: ${inicial.nombre}` : 'Nueva fecha festiva'}</h3>
      <div className={styles.fila}>
        <label className={styles.campo} style={{ flex: '0 0 80px' }}>
          <span>Emoji</span>
          <input value={f.emoji} onChange={(e) => set('emoji', e.target.value)} maxLength={4} />
        </label>
        <label className={styles.campo}>
          <span>Nombre</span>
          <input value={f.nombre} onChange={(e) => set('nombre', e.target.value)} required placeholder="Ej. Día del Abuelo" />
        </label>
      </div>

      <fieldset className={styles.grupo}>
        <legend>¿Cuándo cae?</legend>
        <div className={styles.fila}>
          <label className={styles.opcionRadio}>
            <input type="radio" checked={f.regla.tipo === 'fija'} onChange={() => set('regla', { tipo: 'fija', mes: f.regla.mes, dia: 1 })} />
            Siempre el mismo día
          </label>
          <label className={styles.opcionRadio}>
            <input type="radio" checked={f.regla.tipo === 'movil'} onChange={() => set('regla', { tipo: 'movil', mes: f.regla.mes, diaSemana: 0, ordinal: 2 })} />
            Cambia cada año (ej. 2.º domingo de mayo)
          </label>
        </div>
        <div className={styles.fila}>
          {f.regla.tipo === 'fija' ? (
            <label className={styles.campo}>
              <span>Día</span>
              <input type="number" min={1} max={31} value={f.regla.dia} onChange={(e) => setRegla('dia', Number(e.target.value))} />
            </label>
          ) : (
            <>
              <label className={styles.campo}>
                <span>Cuál</span>
                <select value={f.regla.ordinal} onChange={(e) => setRegla('ordinal', Number(e.target.value))}>
                  {ORDINALES.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              </label>
              <label className={styles.campo}>
                <span>Día de la semana</span>
                <select value={f.regla.diaSemana} onChange={(e) => setRegla('diaSemana', Number(e.target.value))}>
                  {DIAS_SEMANA.map((d, i) => <option key={d} value={i}>{d}</option>)}
                </select>
              </label>
            </>
          )}
          <label className={styles.campo}>
            <span>Mes</span>
            <select value={f.regla.mes} onChange={(e) => setRegla('mes', Number(e.target.value))}>
              {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </label>
        </div>
        <p className={styles.nota}>
          {textoRegla(f.regla)}: cae el <strong>{textoFecha(fechaDelAnio(f.regla, anio))} de {anio}</strong> y el{' '}
          <strong>{textoFecha(fechaDelAnio(f.regla, anio + 1))} de {anio + 1}</strong>.
        </p>
      </fieldset>

      <fieldset className={styles.grupo}>
        <legend>¿A quién le toca?</legend>
        <p className={styles.nota}>Las personas de “Fechas importantes” con esta relación (ninguna marcada = todas).</p>
        <div className={styles.chips}>
          {ROLES.map((r) => (
            <button
              key={r.id}
              type="button"
              className={f.para.roles.includes(r.id) ? styles.chipActivo : styles.chip}
              aria-pressed={f.para.roles.includes(r.id)}
              onClick={() => toggleRol(r.id)}
            >
              {r.label}
            </button>
          ))}
        </div>
        <label className={styles.campo} style={{ maxWidth: 260 }}>
          <span>Género</span>
          <select value={f.para.genero} onChange={(e) => set('para', { ...f.para, genero: e.target.value })}>
            <option value="">Cualquiera</option>
            <option value="Femenino">Solo mujeres</option>
            <option value="Masculino">Solo hombres</option>
          </select>
        </label>
      </fieldset>

      <fieldset className={styles.grupo}>
        <legend>Avisos</legend>
        <label className={styles.campo} style={{ maxWidth: 320 }}>
          <span>¿Cuántos días antes avisar?</span>
          <input value={diasTexto} onChange={(e) => setDiasTexto(e.target.value)} placeholder="14, 7, 2" />
        </label>
        <p className={styles.nota}>
          Quien tenga anotada a alguien a quien le toca recibe un aviso con su nombre e ideas de regalo.
        </p>
        <label className={styles.check}>
          <input type="checkbox" checked={f.avisarATodos} onChange={(e) => set('avisarATodos', e.target.checked)} />
          Avisar también a quien no tiene a nadie anotado (“Se acerca el {f.nombre || '…'}”)
        </label>
        <label className={styles.check}>
          <input type="checkbox" checked={f.activo} onChange={(e) => set('activo', e.target.checked)} />
          Activa (se muestra a los clientes y se avisa)
        </label>
      </fieldset>

      <div className={styles.acciones}>
        <button type="button" className={styles.btnSecundario} onClick={onCancelar}>Cancelar</button>
        <button type="submit" className={styles.btnPrimario} disabled={guardando || !f.nombre.trim()}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  );
};

// Resultado de una prueba: cómo se ve la notificación y adónde llegó.
const VistaPrevia = ({ prueba, onCerrar }) => {
  if (!prueba) return null;
  if (prueba.error) {
    return (
      <div className={styles.prueba} role="alert">
        <p className={styles.error}>{prueba.error}</p>
        <button type="button" className={styles.btnSecundario} onClick={onCerrar}>Cerrar</button>
      </div>
    );
  }
  const r = prueba.data;
  return (
    <div className={styles.prueba} role="status">
      <div className={styles.notif}>
        <div className={styles.notifApp}>
          <img src="/logo-wala-192.png" alt="" />
          <span>Walá · ahora</span>
        </div>
        <div className={styles.notifCuerpo}>
          <div>
            <strong>{r.titulo}</strong>
            <p>{r.cuerpo}</p>
          </div>
          {r.image && <img src={r.image} alt="" className={styles.notifImg} />}
        </div>
      </div>
      <p className={styles.nota}>
        ✅ Te llegó a la <strong>campanita</strong> de la web
        {r.tieneApp
          ? (r.push > 0 ? ' y como notificación push a tu celular.' : '. La push a tu celular no salió (revisa los permisos de la app).')
          : '. Para verla como push, inicia sesión con esta cuenta en la app del celular.'}
      </p>
      <button type="button" className={styles.btnSecundario} onClick={onCerrar}>Cerrar</button>
    </div>
  );
};

// Avisos de las fechas que cada cliente anotó (cumpleaños, aniversario…).
const AvisosPersonales = ({ onProbar, probando }) => {
  const queryClient = useQueryClient();
  const { data: dias, isLoading, error } = useQuery({
    queryKey: ['admin-recordatorio-personal'],
    queryFn: async () => {
      const { data, error: err } = await getRecordatorioPersonal();
      if (err) throw new Error(err);
      return data;
    },
    staleTime: 0,
  });
  const [texto, setTexto] = useState(null);
  const valor = texto ?? (dias || []).join(', ');
  const nuevos = normalizarDiasAviso(valor.split(/[,\s]+/).filter(Boolean).map(Number));
  const guardar = useMutation({
    mutationFn: async () => {
      const { error: err } = await saveRecordatorioPersonal(nuevos);
      if (err) throw new Error(err);
      return nuevos;
    },
    onSuccess: (lista) => {
      queryClient.setQueryData(['admin-recordatorio-personal'], lista);
      queryClient.invalidateQueries({ queryKey: RECORDATORIO_QUERY_KEY });
      setTexto(null);
    },
  });
  const cambio = texto !== null && nuevos.join(',') !== (dias || []).join(',');

  return (
    <section className={styles.avisos} aria-labelledby="avisos-personales">
      <h3 id="avisos-personales">🔔 Avisos de las fechas de cada persona</h3>
      <p className={styles.nota}>
        Cumpleaños, aniversarios y fechas que cada cliente anotó en “Fechas importantes”. Se revisa todos los
        días a las <strong>10:00 a. m. (hora de Lima)</strong> y se avisa por la campanita de la web y por push a
        quien tiene la app, con una idea de regalo y su foto.
      </p>
      {error && <p className={styles.error}>No se pudo cargar: {error.message}</p>}
      <div className={styles.fila}>
        <label className={styles.campo} style={{ maxWidth: 260 }}>
          <span>¿Cuántos días antes avisar?</span>
          <input
            value={valor}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="7, 1"
            disabled={isLoading || !!error}
          />
        </label>
        <button
          type="button"
          className={styles.btnPrimario}
          style={{ alignSelf: 'end' }}
          onClick={() => guardar.mutate()}
          disabled={!cambio || guardar.isPending}
        >
          {guardar.isPending ? 'Guardando…' : 'Guardar'}
        </button>
        <button
          type="button"
          className={styles.btnSecundario}
          style={{ alignSelf: 'end' }}
          onClick={() => onProbar(null)}
          disabled={!!probando}
          title="Te manda a ti el aviso de la fecha más cercana de las personas que anotaste con tu cuenta"
        >
          <BellRing size={15} /> {probando === 'personal' ? 'Enviando…' : 'Enviarme un aviso de prueba'}
        </button>
      </div>
      <p className={styles.nota}>
        {nuevos.length
          ? <>El cliente verá: “Te avisamos {textoDiasAviso(nuevos)}”. 0 = el mismo día.</>
          : <>Sin días: estos avisos quedan <strong>apagados</strong>.</>}
        {' '}Si alguien anota una fecha cuando ya pasó un día de aviso, recibe el siguiente.
      </p>
      {guardar.error && <p className={styles.error}>No se pudo guardar: {guardar.error.message}</p>}
    </section>
  );
};

const FechasFestivasView = () => {
  const queryClient = useQueryClient();
  const [editando, setEditando] = useState(null);
  // Prueba de aviso: { data } o { error }; probando = 'personal' | id de festiva.
  const [prueba, setPrueba] = useState(null);
  const [probando, setProbando] = useState(null);
  const probar = async (festivaId) => {
    setProbando(festivaId || 'personal');
    setPrueba(null);
    const r = await probarAvisoFechas(festivaId);
    setProbando(null);
    setPrueba(r.error ? { error: r.error } : { data: r.data });
  };
  const hoy = hoyLocal();

  const { data: fechas = [], isLoading, error } = useQuery({
    queryKey: ['admin-fechas-festivas'],
    queryFn: async () => {
      const { data, error: err } = await getFechasFestivas();
      // Si no se pudo leer, no se deja editar: guardar pisaría lo que haya.
      if (err) throw new Error(err);
      return data;
    },
    staleTime: 0,
  });

  const guardar = useMutation({
    mutationFn: async (lista) => {
      const { error: err } = await saveFechasFestivas(lista);
      if (err) throw new Error(err);
      return lista.map(normalizarFestiva);
    },
    onSuccess: (lista) => {
      queryClient.setQueryData(['admin-fechas-festivas'], lista);
      queryClient.invalidateQueries({ queryKey: FESTIVAS_QUERY_KEY });
      setEditando(null);
    },
  });

  const guardarUna = (f) => {
    const existe = fechas.some((x) => x.id === f.id);
    guardar.mutate(existe ? fechas.map((x) => (x.id === f.id ? f : x)) : [...fechas, f]);
  };
  const eliminar = (f) => {
    if (!window.confirm(`¿Eliminar "${f.nombre}" del calendario?`)) return;
    guardar.mutate(fechas.filter((x) => x.id !== f.id));
  };
  const alternar = (f) => guardar.mutate(fechas.map((x) => (x.id === f.id ? { ...x, activo: !x.activo } : x)));
  const restaurar = () => {
    if (!window.confirm('¿Volver a las fechas de Perú por defecto? Se pierden los cambios hechos acá.')) return;
    guardar.mutate(FESTIVAS_DEFAULT);
  };

  const ordenadas = fechas
    .map((f) => ({ ...f, ...(proximaFecha(f.regla, hoy) || {}) }))
    .sort((a, b) => Number(b.activo) - Number(a.activo) || a.dias - b.dias);

  return (
    <div className={styles.vista}>
      <div className={styles.encabezado}>
        <div>
          <h2>Avisos y fechas festivas</h2>
          <p>
            Cuándo avisamos de las fechas de cada persona y el calendario de fechas que se celebran cada año. En
            “Fechas importantes” el cliente ve la fecha festiva que se acerca (30 días antes) con ideas de regalo para
            sus personas. Las que cambian de día (Día de la Madre: 2.º domingo de mayo) se calculan solas.
          </p>
        </div>
        <div className={styles.acciones}>
          <button type="button" className={styles.btnSecundario} onClick={restaurar} disabled={guardar.isPending || isLoading || !!error}>
            <RotateCcw size={15} /> Fechas de Perú
          </button>
          <button type="button" className={styles.btnPrimario} onClick={() => setEditando({ ...NUEVA })} disabled={isLoading || !!error}>
            <Plus size={15} /> Nueva fecha
          </button>
        </div>
      </div>

      <AvisosPersonales onProbar={probar} probando={probando} />
      <VistaPrevia prueba={prueba} onCerrar={() => setPrueba(null)} />

      <h3 className={styles.subtitulo}>📅 Fechas festivas del año</h3>

      {error && <p className={styles.error}>No se pudo cargar el calendario: {error.message}</p>}
      {guardar.error && <p className={styles.error}>No se pudo guardar: {guardar.error.message}</p>}
      {isLoading && <p className={styles.nota}>Cargando…</p>}

      {editando && (
        <Editor
          key={editando.id || 'nueva'}
          inicial={normalizarFestiva(editando)}
          usados={fechas.map((f) => f.id)}
          guardando={guardar.isPending}
          onGuardar={guardarUna}
          onCancelar={() => setEditando(null)}
        />
      )}

      <ul className={styles.lista}>
        {ordenadas.map((f) => (
          <li key={f.id} className={`${styles.item} ${f.activo ? '' : styles.apagada}`}>
            <span className={styles.emoji} aria-hidden="true">{f.emoji || '🎁'}</span>
            <div className={styles.info}>
              <strong>{f.nombre}</strong>
              <span className={styles.nota}>
                {textoRegla(f.regla)} · próxima: <strong>{textoFecha(f.fecha)}</strong>
                {f.activo && ` (${f.dias === 0 ? 'hoy' : `en ${f.dias} días`})`}
              </span>
              <span className={styles.nota}>
                Para: {textoPara(f)} · Aviso {f.avisarDias.length ? `${f.avisarDias.join(', ')} días antes` : 'desactivado'}
                {f.avisarATodos ? ' · a todos los clientes' : ''}
              </span>
            </div>
            <label className={styles.switch} title={f.activo ? 'Apagar' : 'Encender'}>
              <input type="checkbox" checked={f.activo} onChange={() => alternar(f)} disabled={guardar.isPending} />
              <span className={styles.srOnly}>Activa</span>
            </label>
            <button
              type="button"
              className={styles.icono}
              onClick={() => probar(f.id)}
              disabled={!!probando}
              aria-label={`Enviarme un aviso de prueba de ${f.nombre}`}
              title="Enviarme un aviso de prueba"
            >
              <BellRing size={16} />
            </button>
            <button type="button" className={styles.icono} onClick={() => setEditando(f)} aria-label={`Editar ${f.nombre}`}>
              <Pencil size={16} />
            </button>
            <button type="button" className={styles.icono} onClick={() => eliminar(f)} aria-label={`Eliminar ${f.nombre}`} disabled={guardar.isPending}>
              <Trash2 size={16} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default FechasFestivasView;
