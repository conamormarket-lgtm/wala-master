// =========================================================================
// Administrar la Ruleta Semanal
// -------------------------------------------------------------------------
// Antes esta pantalla eran 154 líneas con los estilos escritos a mano dentro
// del JSX y un formulario de cuatro campos. Se podía elegir "Descuento" o
// "Producto" como tipo de premio, pero el servidor solo sabía acreditar
// monedas: el resto se guardaba en `ruletaWins` y no había ninguna pantalla que
// lo leyera, así que el premio se perdía.
//
// Ahora hay tres pestañas:
//   · Premios     — qué se puede ganar, con qué probabilidad y QUÉ DÍAS.
//   · Apariencia  — colores y reglas, con la rueda real de vista previa.
//   · Entregas    — quién ganó qué, y marcar lo que se entrega a mano.
// =========================================================================

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Edit2, Trash2, RotateCcw, Check, Plus } from 'lucide-react';
import {
  getRuletaPrizes, saveRuletaPrize, deleteRuletaPrize, resetStockPremio,
  getRuletaConfig, saveRuletaConfig, getRuletaWins, marcarPremioEntregado,
} from '../../services/firebase/ruleta';
import { getProducts } from '../../services/products';
import {
  TIPOS_PREMIO, PRESETS_TEMA, MODOS_DESBLOQUEO,
  normalizarPremio, premiosDeHoy, sumaProbabilidades, textoPremio,
} from '../../utils/ruletaModel';
import { limaTodayStr, limaDayOfWeek } from '../../utils/fechaLima';
import RuedaRuleta from '../../components/ruleta/RuedaRuleta';
import { useGlobalToast } from '../../contexts/ToastContext';
import styles from './AdminRuletaPage.module.css';

const DIAS = [
  { valor: 1, corto: 'L', largo: 'Lunes' },
  { valor: 2, corto: 'M', largo: 'Martes' },
  { valor: 3, corto: 'X', largo: 'Miércoles' },
  { valor: 4, corto: 'J', largo: 'Jueves' },
  { valor: 5, corto: 'V', largo: 'Viernes' },
  { valor: 6, corto: 'S', largo: 'Sábado' },
  { valor: 0, corto: 'D', largo: 'Domingo' },
];

const ETIQUETA_TIPO = {
  monedas: 'Monedas (se acreditan solas)',
  descuento: 'Descuento en el pedido (cupón)',
  producto_descuento: 'Descuento en un producto (cupón)',
  producto_gratis: 'Producto gratis (cupón)',
  envio_gratis: 'Envío gratis (cupón)',
  manual: 'Premio que entregas a mano',
  nada: 'Sin premio ("sigue intentando")',
};

// Tipos que necesitan que se elija un producto del catálogo.
const NECESITA_PRODUCTO = ['producto_descuento', 'producto_gratis'];

const FORM_VACIO = {
  nombre: '',
  etiqueta: '',
  tipo: 'monedas',
  probabilidad: 0,
  monedas: 0,
  descuentoPct: 0,
  descuentoMonto: 0,
  topeDescuento: 0,
  productId: '',
  productName: '',
  vigenciaDias: 30,
  color: '',
  icono: '',
  activo: true,
  dias: [],
  desde: '',
  hasta: '',
  stockTotal: '',
  maxPorUsuario: '',
};

// ── Buscador de productos ────────────────────────────────────────────────────
// Ofertas Flash pide el productId escrito a mano, que obliga a ir a buscarlo a
// otra pestaña y a pegarlo sin saber si es el correcto. Aquí se busca por nombre.
const BuscadorProducto = ({ productId, productName, onElegir }) => {
  const [termino, setTermino] = useState('');
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    // Una sola lectura del catálogo y se filtra en memoria: buscar contra
    // Firestore en cada tecla sería una lectura completa por pulsación.
    getProducts().then(({ data }) => {
      if (!vivo) return;
      setProductos(data || []);
      setCargando(false);
    });
    return () => { vivo = false; };
  }, []);

  const resultados = useMemo(() => {
    const t = termino.trim().toLowerCase();
    if (t.length < 2) return [];
    return productos
      .filter((p) => String(p.name || '').toLowerCase().includes(t))
      .slice(0, 8);
  }, [termino, productos]);

  if (productId) {
    return (
      <div className={styles.productoElegido}>
        <span className={styles.productoNombre}>{productName || productId}</span>
        <button
          type="button"
          className={styles.enlaceBoton}
          onClick={() => onElegir({ id: '', name: '' })}
        >
          Cambiar
        </button>
      </div>
    );
  }

  return (
    <div className={styles.buscador}>
      <input
        type="text"
        className={styles.input}
        value={termino}
        onChange={(e) => setTermino(e.target.value)}
        placeholder={cargando ? 'Cargando catálogo...' : 'Escribe el nombre del producto'}
        disabled={cargando}
      />
      {resultados.length > 0 && (
        <ul className={styles.resultados}>
          {resultados.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className={styles.resultado}
                onClick={() => { onElegir(p); setTermino(''); }}
              >
                <span>{p.name}</span>
                <span className={styles.resultadoPrecio}>S/ {Number(p.salePrice || p.price || 0).toFixed(2)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {termino.trim().length >= 2 && resultados.length === 0 && !cargando && (
        <p className={styles.ayuda}>Ningún producto coincide con «{termino}».</p>
      )}
    </div>
  );
};

const AdminRuletaPage = () => {
  const { addToast } = useGlobalToast();
  const [pestana, setPestana] = useState('premios');

  const [premios, setPremios] = useState([]);
  const [config, setConfig] = useState(null);
  const [ganados, setGanados] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [soloPendientes, setSoloPendientes] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    const [p, c] = await Promise.all([getRuletaPrizes(), getRuletaConfig()]);
    setPremios(p);
    setConfig(c);
    setCargando(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // Las entregas solo se leen al abrir su pestaña: es la consulta más pesada y
  // la mayoría de las visitas al panel son para tocar los premios.
  useEffect(() => {
    if (pestana !== 'entregas') return;
    getRuletaWins(200).then(setGanados);
  }, [pestana]);

  const sumaProb = sumaProbabilidades(premios);
  const sumaOk = Math.abs(sumaProb - 100) < 0.01;

  // Lo que un usuario vería HOY: mismo filtro que aplica el servidor al sortear.
  const premiosHoy = useMemo(
    () => premiosDeHoy(premios, { hoy: limaTodayStr(), diaSemana: limaDayOfWeek(), ganados: {} }),
    [premios]
  );

  const editar = (premio) => {
    setEditando(premio);
    setForm({
      ...FORM_VACIO,
      ...premio,
      // Los nulos del modelo vuelven a cadena vacía: un input controlado con
      // value={null} se convierte en no controlado y React protesta.
      color: premio.color || '',
      desde: premio.desde || '',
      hasta: premio.hasta || '',
      stockTotal: premio.stockTotal ?? '',
      maxPorUsuario: premio.maxPorUsuario ?? '',
      productId: premio.productId || '',
    });
    setPestana('premios');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelar = () => {
    setEditando(null);
    setForm(FORM_VACIO);
  };

  const enviar = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim()) {
      addToast('El premio necesita un nombre', 'error');
      return;
    }
    if (Number(form.probabilidad) <= 0) {
      addToast('La probabilidad debe ser mayor que cero', 'error');
      return;
    }
    if (NECESITA_PRODUCTO.includes(form.tipo) && !form.productId) {
      addToast('Elige el producto del premio', 'error');
      return;
    }
    // Un porcentaje sin techo se aplica sobre el subtotal que calcula el
    // carrito, y ahí caben productos personalizados cuyo precio no está en el
    // catálogo: sin tope, el cupón es un cheque en blanco.
    if (form.tipo === 'descuento' && Number(form.descuentoPct) > 0 && Number(form.topeDescuento) <= 0) {
      addToast('Pon un tope en soles para el descuento por porcentaje', 'error');
      return;
    }

    setGuardando(true);
    const res = await saveRuletaPrize({
      ...form,
      stockTotal: form.stockTotal === '' ? null : Number(form.stockTotal),
      maxPorUsuario: form.maxPorUsuario === '' ? null : Number(form.maxPorUsuario),
      desde: form.desde || null,
      hasta: form.hasta || null,
      color: form.color || null,
    }, editando?.id);
    setGuardando(false);

    if (res.success) {
      addToast('Premio guardado', 'success');
      cancelar();
      cargar();
    } else {
      addToast('No se pudo guardar: ' + (res.error?.message || ''), 'error');
    }
  };

  const borrar = async (id) => {
    if (!window.confirm('¿Seguro que deseas eliminar este premio?')) return;
    const res = await deleteRuletaPrize(id);
    if (res.success) {
      addToast('Premio eliminado', 'success');
      cargar();
    }
  };

  const reabrir = async (id) => {
    const res = await resetStockPremio(id);
    if (res.success) {
      addToast('Contador reiniciado', 'success');
      cargar();
    }
  };

  const guardarConfig = async (siguiente) => {
    setConfig(siguiente);
    const res = await saveRuletaConfig(siguiente);
    if (!res.success) addToast('No se pudo guardar la configuración', 'error');
  };

  const alternarEntregado = async (win) => {
    const res = await marcarPremioEntregado(win.id, !win.entregado);
    if (res.success) {
      setGanados((lista) => lista.map((g) => (
        g.id === win.id ? { ...g, entregado: !win.entregado } : g
      )));
    } else {
      addToast('No se pudo actualizar', 'error');
    }
  };

  const alternarDia = (dia) => {
    setForm((f) => ({
      ...f,
      dias: f.dias.includes(dia) ? f.dias.filter((d) => d !== dia) : [...f.dias, dia].sort(),
    }));
  };

  if (cargando || !config) {
    return <div className={styles.wrapper}><p className={styles.estado}>Cargando la ruleta...</p></div>;
  }

  const vistaPrevia = premiosHoy.length > 0 ? premiosHoy : premios.map(normalizarPremio);

  return (
    <div className={styles.wrapper}>
      <header className={styles.header}>
        <h1 className={styles.title}>Ruleta Semanal</h1>
        <p className={styles.subtitle}>
          Qué se puede ganar, qué días sale cada premio y cómo se ve la rueda.
        </p>
      </header>

      <nav className={styles.pestanas} aria-label="Secciones de la ruleta">
        {[
          ['premios', 'Premios'],
          ['apariencia', 'Apariencia y reglas'],
          ['entregas', 'Entregas'],
        ].map(([id, texto]) => (
          <button
            key={id}
            type="button"
            className={`${styles.pestana} ${pestana === id ? styles.pestanaActiva : ''}`}
            onClick={() => setPestana(id)}
            aria-current={pestana === id ? 'page' : undefined}
          >
            {texto}
          </button>
        ))}
      </nav>

      {/* ══════════════════ PREMIOS ══════════════════ */}
      {pestana === 'premios' && (
        <>
          <div className={`${styles.aviso} ${sumaOk ? styles.avisoOk : styles.avisoMal}`}>
            <strong>Las probabilidades suman {sumaProb.toFixed(1)}%.</strong>
            {sumaOk
              ? ' Perfecto.'
              : ' Deberían sumar 100%. Mientras no lo hagan, el sorteo reparte proporcionalmente entre lo que haya, así que las probabilidades reales no son las que ves.'}
          </div>

          <div className={styles.contentGrid}>
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>{editando ? 'Editar premio' : 'Nuevo premio'}</h2>
              <form onSubmit={enviar} className={styles.form}>
                <label className={styles.field}>
                  <span className={styles.label}>Nombre</span>
                  <input
                    type="text"
                    className={styles.input}
                    value={form.nombre}
                    onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                    placeholder="10 monedas"
                    required
                  />
                </label>

                <label className={styles.field}>
                  <span className={styles.label}>Texto del gajo</span>
                  <input
                    type="text"
                    className={styles.input}
                    value={form.etiqueta}
                    onChange={(e) => setForm({ ...form, etiqueta: e.target.value })}
                    placeholder={form.nombre || 'Se usa el nombre si lo dejas vacío'}
                    maxLength={16}
                  />
                  <span className={styles.ayuda}>
                    En el gajo caben pocas letras: lo largo se recorta.
                  </span>
                </label>

                <label className={styles.field}>
                  <span className={styles.label}>Tipo de premio</span>
                  <select
                    className={styles.input}
                    value={form.tipo}
                    onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                  >
                    {TIPOS_PREMIO.map((t) => (
                      <option key={t} value={t}>{ETIQUETA_TIPO[t]}</option>
                    ))}
                  </select>
                </label>

                {form.tipo === 'monedas' && (
                  <label className={styles.field}>
                    <span className={styles.label}>Cantidad de monedas</span>
                    <input
                      type="number" min="0" className={styles.input}
                      value={form.monedas}
                      onChange={(e) => setForm({ ...form, monedas: Number(e.target.value) })}
                    />
                  </label>
                )}

                {NECESITA_PRODUCTO.includes(form.tipo) && (
                  <div className={styles.field}>
                    <span className={styles.label}>Producto</span>
                    <BuscadorProducto
                      productId={form.productId}
                      productName={form.productName}
                      onElegir={(p) => setForm({ ...form, productId: p.id, productName: p.name })}
                    />
                  </div>
                )}

                {(form.tipo === 'descuento' || form.tipo === 'producto_descuento') && (
                  <div className={styles.fieldRow}>
                    <label className={styles.field}>
                      <span className={styles.label}>Descuento (%)</span>
                      <input
                        type="number" min="0" max="100" className={styles.input}
                        value={form.descuentoPct}
                        onChange={(e) => setForm({ ...form, descuentoPct: Number(e.target.value) })}
                      />
                    </label>
                    {form.tipo === 'descuento' && (
                      <label className={styles.field}>
                        <span className={styles.label}>
                          {Number(form.descuentoPct) > 0 ? 'Tope en soles' : 'O monto fijo (S/)'}
                        </span>
                        <input
                          type="number" min="0" step="0.5" className={styles.input}
                          value={Number(form.descuentoPct) > 0 ? form.topeDescuento : form.descuentoMonto}
                          onChange={(e) => setForm(Number(form.descuentoPct) > 0
                            ? { ...form, topeDescuento: Number(e.target.value) }
                            : { ...form, descuentoMonto: Number(e.target.value) })}
                        />
                      </label>
                    )}
                  </div>
                )}

                {['descuento', 'producto_descuento', 'producto_gratis', 'envio_gratis'].includes(form.tipo) && (
                  <label className={styles.field}>
                    <span className={styles.label}>El cupón caduca en (días)</span>
                    <input
                      type="number" min="1" className={styles.input}
                      value={form.vigenciaDias}
                      onChange={(e) => setForm({ ...form, vigenciaDias: Number(e.target.value) })}
                    />
                  </label>
                )}

                <div className={styles.fieldRow}>
                  <label className={styles.field}>
                    <span className={styles.label}>Probabilidad (%)</span>
                    <input
                      type="number" step="0.1" min="0" className={styles.input}
                      value={form.probabilidad}
                      onChange={(e) => setForm({ ...form, probabilidad: Number(e.target.value) })}
                      required
                    />
                  </label>
                  <label className={styles.field}>
                    <span className={styles.label}>Emoji del gajo</span>
                    <input
                      type="text" className={styles.input} maxLength={2}
                      value={form.icono}
                      onChange={(e) => setForm({ ...form, icono: e.target.value })}
                      placeholder="🪙"
                    />
                  </label>
                </div>

                <div className={styles.field}>
                  <span className={styles.label}>Días en que puede salir</span>
                  <div className={styles.dias}>
                    {DIAS.map((d) => (
                      <button
                        key={d.valor}
                        type="button"
                        className={`${styles.dia} ${form.dias.includes(d.valor) ? styles.diaOn : ''}`}
                        onClick={() => alternarDia(d.valor)}
                        aria-pressed={form.dias.includes(d.valor)}
                        aria-label={d.largo}
                        title={d.largo}
                      >
                        {d.corto}
                      </button>
                    ))}
                  </div>
                  <span className={styles.ayuda}>
                    {form.dias.length === 0
                      ? 'Sin marcar ninguno, el premio puede salir todos los días.'
                      : `Solo ${form.dias.length === 7 ? 'todos los días' : DIAS.filter((d) => form.dias.includes(d.valor)).map((d) => d.largo).join(', ')}.`}
                  </span>
                </div>

                <div className={styles.fieldRow}>
                  <label className={styles.field}>
                    <span className={styles.label}>Desde (opcional)</span>
                    <input
                      type="date" className={styles.input}
                      value={form.desde}
                      onChange={(e) => setForm({ ...form, desde: e.target.value })}
                    />
                  </label>
                  <label className={styles.field}>
                    <span className={styles.label}>Hasta (opcional)</span>
                    <input
                      type="date" className={styles.input}
                      value={form.hasta}
                      onChange={(e) => setForm({ ...form, hasta: e.target.value })}
                    />
                  </label>
                </div>

                <div className={styles.fieldRow}>
                  <label className={styles.field}>
                    <span className={styles.label}>Stock total</span>
                    <input
                      type="number" min="0" className={styles.input}
                      value={form.stockTotal}
                      onChange={(e) => setForm({ ...form, stockTotal: e.target.value })}
                      placeholder="Sin límite"
                    />
                  </label>
                  <label className={styles.field}>
                    <span className={styles.label}>Máximo por usuario</span>
                    <input
                      type="number" min="0" className={styles.input}
                      value={form.maxPorUsuario}
                      onChange={(e) => setForm({ ...form, maxPorUsuario: e.target.value })}
                      placeholder="Sin límite"
                    />
                  </label>
                </div>

                <div className={styles.fieldRow}>
                  <label className={styles.field}>
                    <span className={styles.label}>Color del gajo</span>
                    <div className={styles.colorFila}>
                      <input
                        type="color"
                        className={styles.colorInput}
                        value={form.color || '#6D28D9'}
                        onChange={(e) => setForm({ ...form, color: e.target.value })}
                      />
                      {form.color && (
                        <button
                          type="button"
                          className={styles.enlaceBoton}
                          onClick={() => setForm({ ...form, color: '' })}
                        >
                          Usar la paleta
                        </button>
                      )}
                    </div>
                  </label>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      checked={form.activo}
                      onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                    />
                    Activo
                  </label>
                </div>

                <div className={styles.formActions}>
                  <button type="submit" className={styles.btnPrimario} disabled={guardando}>
                    {guardando ? 'Guardando...' : (editando ? 'Guardar cambios' : 'Crear premio')}
                  </button>
                  {editando && (
                    <button type="button" className={styles.btnSecundario} onClick={cancelar}>
                      Cancelar
                    </button>
                  )}
                </div>
              </form>
            </section>

            <section className={styles.card}>
              <h2 className={styles.cardTitle}>
                Premios ({premios.length})
                <span className={styles.cardTitleNota}>{premiosHoy.length} pueden salir hoy</span>
              </h2>

              {premios.length === 0 ? (
                <div className={styles.vacio}>
                  <Plus size={28} aria-hidden="true" />
                  <p>Todavía no hay premios. Mientras no haya ninguno, la ruleta le dice al usuario que está en preparación.</p>
                </div>
              ) : (
                <ul className={styles.listaPremios}>
                  {premios.map((p) => {
                    const saleHoy = premiosHoy.some((h) => h.id === p.id);
                    const agotado = p.stockTotal !== null && p.stockUsado >= p.stockTotal;
                    return (
                      <li key={p.id} className={`${styles.premio} ${saleHoy ? '' : styles.premioApagado}`}>
                        <span
                          className={styles.muestraColor}
                          style={{ background: p.color || 'var(--primary-color)' }}
                          aria-hidden="true"
                        />
                        <div className={styles.premioInfo}>
                          <span className={styles.premioNombre}>
                            {p.icono && <span aria-hidden="true">{p.icono} </span>}
                            {p.nombre}
                          </span>
                          <span className={styles.premioTexto}>{textoPremio(p)}</span>
                          <div className={styles.premioEtiquetas}>
                            <span className={styles.chip}>{p.probabilidad}%</span>
                            {p.dias.length > 0 && (
                              <span className={styles.chip}>
                                {DIAS.filter((d) => p.dias.includes(d.valor)).map((d) => d.corto).join(' ')}
                              </span>
                            )}
                            {p.stockTotal !== null && (
                              <span className={`${styles.chip} ${agotado ? styles.chipMal : ''}`}>
                                {p.stockUsado}/{p.stockTotal}
                              </span>
                            )}
                            {p.stockTotal === null && p.stockUsado > 0 && (
                              <span className={styles.chip}>ganado {p.stockUsado}×</span>
                            )}
                            {p.maxPorUsuario !== null && (
                              <span className={styles.chip}>máx {p.maxPorUsuario}/usuario</span>
                            )}
                            {!p.activo && <span className={`${styles.chip} ${styles.chipMal}`}>apagado</span>}
                            {(p.desde || p.hasta) && (
                              <span className={styles.chip}>
                                {p.desde || '...'} → {p.hasta || '...'}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className={styles.premioAcciones}>
                          <button
                            type="button" className={styles.iconBtn}
                            onClick={() => editar(p)} aria-label={`Editar ${p.nombre}`}
                          >
                            <Edit2 size={16} aria-hidden="true" />
                          </button>
                          {p.stockUsado > 0 && (
                            <button
                              type="button" className={styles.iconBtn}
                              onClick={() => reabrir(p.id)}
                              aria-label={`Reiniciar el contador de ${p.nombre}`}
                              title="Reiniciar el contador de veces ganado"
                            >
                              <RotateCcw size={16} aria-hidden="true" />
                            </button>
                          )}
                          <button
                            type="button" className={`${styles.iconBtn} ${styles.iconBtnBorrar}`}
                            onClick={() => borrar(p.id)} aria-label={`Eliminar ${p.nombre}`}
                          >
                            <Trash2 size={16} aria-hidden="true" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        </>
      )}

      {/* ══════════════════ APARIENCIA ══════════════════ */}
      {pestana === 'apariencia' && (
        <div className={styles.contentGrid}>
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Colores</h2>

            <div className={styles.field}>
              <span className={styles.label}>Paleta</span>
              <div className={styles.presets}>
                {Object.entries(PRESETS_TEMA).map(([id, preset]) => (
                  <button
                    key={id}
                    type="button"
                    className={`${styles.preset} ${config.tema.preset === id ? styles.presetActivo : ''}`}
                    onClick={() => guardarConfig({
                      ...config,
                      tema: { ...config.tema, preset: id, colores: preset.colores, colorAro: preset.colorAro, colorPuntero: preset.colorPuntero },
                    })}
                  >
                    <span className={styles.presetMuestras} aria-hidden="true">
                      {preset.colores.map((c) => (
                        <span key={c} style={{ background: c }} className={styles.presetMuestra} />
                      ))}
                    </span>
                    {preset.nombre}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.field}>
              <span className={styles.label}>Colores de los gajos</span>
              <div className={styles.colorLista}>
                {config.tema.colores.map((color, i) => (
                  <div key={`${color}-${i}`} className={styles.colorItem}>
                    {/* Se guarda al soltar, no en cada movimiento: un selector
                        de color dispara onChange sin parar mientras se arrastra,
                        y eso era una escritura a Firestore por píxel. */}
                    <input
                      type="color"
                      className={styles.colorInput}
                      value={color}
                      onChange={(e) => {
                        const colores = [...config.tema.colores];
                        colores[i] = e.target.value;
                        setConfig({ ...config, tema: { ...config.tema, preset: 'personalizado', colores } });
                      }}
                      onBlur={() => guardarConfig(config)}
                    />
                    {config.tema.colores.length > 2 && (
                      <button
                        type="button"
                        className={styles.quitarColor}
                        onClick={() => guardarConfig({
                          ...config,
                          tema: {
                            ...config.tema,
                            preset: 'personalizado',
                            colores: config.tema.colores.filter((_, j) => j !== i),
                          },
                        })}
                        aria-label={`Quitar el color ${i + 1}`}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                {config.tema.colores.length < 8 && (
                  <button
                    type="button"
                    className={styles.anadirColor}
                    onClick={() => guardarConfig({
                      ...config,
                      tema: {
                        ...config.tema,
                        preset: 'personalizado',
                        colores: [...config.tema.colores, '#6D28D9'],
                      },
                    })}
                    aria-label="Añadir un color"
                  >
                    <Plus size={16} aria-hidden="true" />
                  </button>
                )}
              </div>
              <span className={styles.ayuda}>
                Los colores se van repartiendo entre los gajos. El texto se pone claro
                u oscuro solo, según el color de cada gajo.
              </span>
            </div>

            <div className={styles.fieldRow}>
              <label className={styles.field}>
                <span className={styles.label}>Aro y separadores</span>
                <input
                  type="color" className={styles.colorInput}
                  value={config.tema.colorAro}
                  onChange={(e) => setConfig({ ...config, tema: { ...config.tema, colorAro: e.target.value } })}
                  onBlur={() => guardarConfig(config)}
                />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Puntero y centro</span>
                <input
                  type="color" className={styles.colorInput}
                  value={config.tema.colorPuntero}
                  onChange={(e) => setConfig({ ...config, tema: { ...config.tema, colorPuntero: e.target.value } })}
                  onBlur={() => guardarConfig(config)}
                />
              </label>
            </div>

            <label className={styles.field}>
              <span className={styles.label}>Imagen del centro (URL, opcional)</span>
              <input
                type="url" className={styles.input}
                value={config.tema.imagenCentro}
                onChange={(e) => setConfig({ ...config, tema: { ...config.tema, imagenCentro: e.target.value } })}
                onBlur={() => guardarConfig(config)}
                placeholder="/assets/kapi/kapi-happy.png"
              />
            </label>

            <h2 className={styles.cardTitle}>Reglas</h2>

            <label className={styles.field}>
              <span className={styles.label}>Cómo se desbloquea el giro</span>
              <select
                className={styles.input}
                value={config.reglas.modoDesbloqueo}
                onChange={(e) => guardarConfig({ ...config, reglas: { ...config.reglas, modoDesbloqueo: e.target.value } })}
              >
                <option value="racha7">Completando los 7 días de racha con Kapi</option>
                <option value="siempre">Un giro por semana, sin condiciones (campaña)</option>
              </select>
              {!MODOS_DESBLOQUEO.includes(config.reglas.modoDesbloqueo) && (
                <span className={styles.ayuda}>Modo desconocido: se usará el de racha.</span>
              )}
            </label>

            <label className={styles.checkboxLabel}>
              <input
                type="checkbox" className={styles.checkbox}
                checked={config.reglas.semanaDeGracia}
                onChange={(e) => guardarConfig({ ...config, reglas: { ...config.reglas, semanaDeGracia: e.target.checked } })}
              />
              El giro ganado sigue disponible la semana siguiente
            </label>

            <div className={styles.fieldRow}>
              <label className={styles.field}>
                <span className={styles.label}>Vueltas ({config.reglas.vueltas})</span>
                <input
                  type="range" min="2" max="12"
                  value={config.reglas.vueltas}
                  onChange={(e) => setConfig({ ...config, reglas: { ...config.reglas, vueltas: Number(e.target.value) } })}
                  onMouseUp={() => guardarConfig(config)}
                  onTouchEnd={() => guardarConfig(config)}
                />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Duración ({(config.reglas.duracionGiroMs / 1000).toFixed(1)}s)</span>
                <input
                  type="range" min="1500" max="10000" step="500"
                  value={config.reglas.duracionGiroMs}
                  onChange={(e) => setConfig({ ...config, reglas: { ...config.reglas, duracionGiroMs: Number(e.target.value) } })}
                  onMouseUp={() => guardarConfig(config)}
                  onTouchEnd={() => guardarConfig(config)}
                />
              </label>
            </div>

            <label className={styles.checkboxLabel}>
              <input
                type="checkbox" className={styles.checkbox}
                checked={config.activa}
                onChange={(e) => guardarConfig({ ...config, activa: e.target.checked })}
              />
              La ruleta está abierta
            </label>
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>
              Vista previa
              <span className={styles.cardTitleNota}>tal y como se ve hoy</span>
            </h2>
            <div className={styles.previa}>
              <RuedaRuleta
                premios={vistaPrevia}
                colores={config.tema.colores}
                colorAro={config.tema.colorAro}
                colorPuntero={config.tema.colorPuntero}
                imagenCentro={config.tema.imagenCentro}
              />
            </div>
            {premiosHoy.length === 0 && premios.length > 0 && (
              <p className={styles.ayuda}>
                Hoy no puede salir ningún premio (todos están apagados, fuera de
                fecha o agotados). Se muestra el catálogo completo.
              </p>
            )}
          </section>
        </div>
      )}

      {/* ══════════════════ ENTREGAS ══════════════════ */}
      {pestana === 'entregas' && (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>
            Premios ganados
            <label className={styles.filtro}>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={soloPendientes}
                onChange={(e) => setSoloPendientes(e.target.checked)}
              />
              Solo lo que falta entregar
            </label>
          </h2>

          {(() => {
            const lista = soloPendientes ? ganados.filter((g) => !g.entregado) : ganados;
            if (lista.length === 0) {
              return (
                <div className={styles.vacio}>
                  <Check size={28} aria-hidden="true" />
                  <p>{soloPendientes ? 'No hay nada pendiente de entregar.' : 'Todavía nadie ha girado la ruleta.'}</p>
                </div>
              );
            }
            return (
              <div className={styles.tablaScroll}>
                <table className={styles.tabla}>
                  <thead>
                    <tr>
                      <th>Usuario</th>
                      <th>Premio</th>
                      <th>Cupón</th>
                      <th>Semana</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lista.map((g) => (
                      <tr key={g.id}>
                        <td>
                          <span className={styles.celdaFuerte}>{g.displayName || '—'}</span>
                          <span className={styles.celdaSuave}>{g.email || g.uid}</span>
                        </td>
                        <td>
                          <span className={styles.celdaFuerte}>{g.texto || g.name}</span>
                          <span className={styles.celdaSuave}>{g.tipo || g.type}</span>
                        </td>
                        <td>
                          {g.cuponCode
                            ? <code className={styles.codigo}>{g.cuponCode}</code>
                            : <span className={styles.celdaSuave}>—</span>}
                        </td>
                        <td className={styles.celdaSuave}>{g.weekStart}</td>
                        <td>
                          {/* Monedas y cupones se entregan solos; solo los
                              premios manuales necesitan que alguien actúe. */}
                          {g.tipo === 'manual' || g.type === 'manual' ? (
                            <button
                              type="button"
                              className={g.entregado ? styles.btnEntregado : styles.btnPendiente}
                              onClick={() => alternarEntregado(g)}
                            >
                              {g.entregado ? 'Entregado' : 'Marcar entregado'}
                            </button>
                          ) : (
                            <span className={styles.celdaSuave}>Automático</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </section>
      )}
    </div>
  );
};

export default AdminRuletaPage;
