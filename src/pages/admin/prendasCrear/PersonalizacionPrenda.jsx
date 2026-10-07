import React, { useEffect, useState } from 'react';
import { Plus, Upload, X, Sparkles, Palette, AlertTriangle } from 'lucide-react';
import { uploadFile } from '../../../services/firebase/storage';
import {
  leerPrendaBase, normalizarZona, normalizarVista, normalizarReferencia, medidaZona, zonaConMedida,
  nuevoIdZona, slug, cargarImagen, tintarImagen,
  colorDisponible, fondoMuestra, PATRONES_BICOLOR, vistasDeEjemplo, COLORES_POLERA, TALLAS_POLERA,
} from '../../../utils/prendaBase';
import ZonaEditor from './ZonaEditor';
import styles from './PersonalizacionPrenda.module.css';

const ZONAS_SUGERIDAS = ['Pecho', 'Pecho izquierdo (logo)', 'Espalda', 'Espalda alta', 'Manga derecha', 'Manga izquierda', 'Bolsillo', 'Capucha'];

/** Configuración inicial al activar la personalización. */
export const prendaBaseInicial = () => ({ vistas: [], colores: {} });

/** Lo que se guarda en el producto (descarta lo que no sirve). */
export const prendaBaseParaGuardar = (valor, variantes) => {
  const ids = new Set((variantes || []).map((v) => v.id));
  const colores = {};
  Object.entries(valor?.colores || {}).forEach(([id, c]) => {
    if (!ids.has(id)) return;
    const fotos = Object.fromEntries(Object.entries(c?.fotos || {}).filter(([, url]) => url));
    if (c?.hex2 || Object.keys(fotos).length) colores[id] = { ...(c.hex2 ? { hex2: c.hex2, patron: c.patron || 'mitades' } : {}), fotos };
  });
  return { vistas: (valor?.vistas || []).map(normalizarVista), colores };
};

/**
 * Campo de cm que se confirma al salir o con Enter: mientras se escribe
 * ("8." o vacío) no se recalcula la zona, así se pueden poner decimales.
 */
const CampoCm = ({ valor, onFijar, etiqueta }) => {
  const [texto, setTexto] = useState(String(valor));
  const [editando, setEditando] = useState(false);
  useEffect(() => { if (!editando) setTexto(String(valor)); }, [valor, editando]);
  // Lee el valor del propio campo: el estado del texto puede no estar al día
  // si se escribe y se sale del campo en el mismo instante.
  const confirmar = (actual) => {
    setEditando(false);
    const n = parseFloat(String(actual).replace(',', '.'));
    if (n > 0 && Math.abs(n - valor) >= 0.05) onFijar(n);
    else setTexto(String(valor));
  };
  return (
    <input
      type="text"
      inputMode="decimal"
      value={texto}
      aria-label={etiqueta}
      onFocus={() => setEditando(true)}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={(e) => confirmar(e.currentTarget.value)}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
    />
  );
};

/** Miniatura teñida para revisar cómo queda cada color sin salir del admin. */
const MiniaturaColor = ({ imagen, hex, nombre }) => {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let vigente = true;
    if (!imagen) return undefined;
    cargarImagen(imagen).then((img) => {
      if (!vigente) return;
      const tenida = tintarImagen(img, hex);
      const c = document.createElement('canvas');
      const escala = 160 / tenida.width;
      c.width = 160;
      c.height = Math.round(tenida.height * escala);
      c.getContext('2d').drawImage(tenida, 0, 0, c.width, c.height);
      try { setSrc(c.toDataURL('image/png')); } catch { setSrc(imagen); }
    }).catch(() => {});
    return () => { vigente = false; };
  }, [imagen, hex]);
  return (
    <figure className={styles.miniatura}>
      <div className={styles.miniaturaFoto}>{src && <img src={src} alt={`Vista previa en ${nombre}`} />}</div>
      <figcaption>{nombre}</figcaption>
    </figure>
  );
};

/**
 * Apartado "Producto personalizable" del formulario de productos.
 *
 * Los colores y tallas NO se cargan aquí: son las variantes del producto. Aquí
 * van las vistas (foto sin fondo + sus zonas de impresión de referencia) y,
 * por color, su foto propia o su segundo tono si es bicolor.
 */
const PersonalizacionPrenda = ({ valor, variantes, varianteDefecto, draftId, onChange, onAgregarVariantes }) => {
  const [subiendo, setSubiendo] = useState(null);
  const [colorPrevio, setColorPrevio] = useState(null);
  const [zonaElegida, setZonaElegida] = useState({});
  // Las zonas se editan tal como se escriben (un "-" a medio tipear no puede
  // volverse 0); se normalizan al dibujarlas y al guardar.
  const vistas = (valor?.vistas || []).map((v, i) => (Array.isArray(v?.zonas)
    ? { ...v, nombre: v.nombre ?? '', imagen: v.imagen || '' }
    : normalizarVista(v, i)));
  const extras = valor?.colores || {};
  const { colores } = leerPrendaBase({ variants: variantes, prendaBase: { vistas, colores: extras } });
  const colorInicial = colores.some((c) => c.id === varianteDefecto) ? varianteDefecto : colores[0]?.id;
  const hexPrevio = colores.find((c) => c.id === (colorPrevio || colorInicial))?.hex || '#FFFFFF';

  // Los cambios se aplican sobre el estado más reciente: dos fotos que terminan
  // de cargar casi a la vez (y avisan su tamaño) no se pisan entre sí.
  const cambiar = (cambios) => onChange((prev) => {
    const base = { vistas: prev?.vistas || [], colores: prev?.colores || {} };
    return { ...base, ...(typeof cambios === 'function' ? cambios(base) : cambios) };
  });
  const setVista = (i, cambios) => cambiar((prev) => ({
    vistas: prev.vistas.map((v, j) => (j === i ? { ...v, ...cambios } : v)),
  }));
  const setZona = (i, zi, zona) => cambiar((prev) => ({
    vistas: prev.vistas.map((v, j) => {
      if (j !== i) return v;
      const zonas = Array.isArray(v.zonas) ? v.zonas : normalizarVista(v, j).zonas;
      return { ...v, zonas: zonas.map((z, k) => (k === zi ? zona : z)) };
    }),
  }));
  const setExtra = (id, cambios) => cambiar((prev) => ({
    colores: { ...prev.colores, [id]: { fotos: {}, ...prev.colores[id], ...cambios } },
  }));
  const [cuadricula, setCuadricula] = useState({});

  const subir = async (archivo, clave) => {
    if (!archivo) return null;
    setSubiendo(clave);
    try {
      const nombre = slug(archivo.name.replace(/\.[^.]+$/, ''));
      const { url, error } = await uploadFile(archivo, `productos_v2/${draftId || 'crear'}/crear_${Date.now()}_${nombre}.png`);
      if (error || !url) throw new Error(error || 'Sin URL');
      return url;
    } catch (err) {
      alert(`No se pudo subir la foto: ${err.message}`);
      return null;
    } finally {
      setSubiendo(null);
    }
  };

  const agregarColoresPolera = () => {
    const existentes = new Set((variantes || []).map((v) => String(v.name || '').trim().toLowerCase()));
    const nuevos = COLORES_POLERA.filter((c) => !existentes.has(c.nombre.toLowerCase()));
    if (!nuevos.length) {
      alert('El producto ya tiene todos los colores de la polera.');
      return;
    }
    const creados = nuevos.map((c, i) => ({ ...c, id: `var_${Date.now()}_${i}` }));
    onAgregarVariantes(creados.map((c) => ({ id: c.id, nombre: c.nombre, hex: c.hex, tallas: TALLAS_POLERA })));
    const bicolores = Object.fromEntries(creados.filter((c) => c.hex2).map((c) => [c.id, { hex2: c.hex2, patron: c.patron || 'mitades', fotos: {} }]));
    if (Object.keys(bicolores).length) cambiar({ colores: { ...extras, ...bicolores } });
  };

  return (
    <div className={styles.contenedor}>
      <p className={styles.aviso}>
        Este producto se vende <strong>solo en Crear</strong>: no aparece en la tienda ni en el buscador. Su precio es el
        de la prenda personalizada e incluye todos los diseños que el cliente quiera poner.
      </p>

      <section className={styles.bloque}>
        <div className={styles.bloqueCabecera}>
          <h3 className={styles.bloqueTitulo}>Vistas y zonas de impresión</h3>
          {!vistas.length && (
            <button type="button" className={styles.botonSecundario} onClick={() => cambiar({ vistas: vistasDeEjemplo(window.location.origin) })}>
              <Sparkles size={16} aria-hidden="true" /> Usar fotos del hoodie de ejemplo
            </button>
          )}
        </div>
        <p className={styles.ayuda}>
          Sube cada foto en PNG con fondo transparente y la prenda en blanco: los colores se generan solos. Cada vista
          puede tener varias zonas (pecho, mangas, bolsillo...): tócalas para elegirlas, arrástralas para moverlas y
          estíralas desde sus bordes.
        </p>

        {colores.length > 1 && vistas.length > 0 && (
          <div className={styles.previoColor}>
            <span>Ver en:</span>
            {colores.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`${styles.punto} ${(colorPrevio || colorInicial) === c.id ? styles.puntoActivo : ''}`}
                style={{ background: fondoMuestra(c) }}
                title={c.nombre}
                aria-label={c.nombre}
                onClick={() => setColorPrevio(c.id)}
              />
            ))}
          </div>
        )}

        <div className={styles.vistas}>
          {vistas.map((v, i) => (
            <div key={i} className={styles.vista}>
              <div className={styles.vistaCabecera}>
                <input
                  className={styles.vistaNombre}
                  value={v.nombre}
                  onChange={(e) => setVista(i, { nombre: e.target.value })}
                  aria-label="Nombre de la vista"
                />
                <button type="button" className={styles.iconoPeligro} onClick={() => cambiar({ vistas: vistas.filter((_, j) => j !== i) })} aria-label={`Quitar vista ${v.nombre}`}>
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
              <div className={styles.vistaCuerpo}>
                <div className={styles.vistaFoto}>
                  <ZonaEditor
                    imagen={v.imagen}
                    zonas={v.zonas}
                    seleccionada={zonaElegida[v.id] ?? 0}
                    colorHex={hexPrevio}
                    onSeleccionar={(zi) => setZonaElegida((m) => ({ ...m, [v.id]: zi }))}
                    onChange={(zi, zona) => setZona(i, zi, zona)}
                    referencia={v.referencia}
                    onReferencia={(referencia) => setVista(i, { referencia })}
                    cuadricula={Boolean(cuadricula[v.id])}
                    onDims={(d) => {
                      if (v.anchoImg !== d.ancho || v.altoImg !== d.alto) setVista(i, { anchoImg: d.ancho, altoImg: d.alto });
                    }}
                  />
                  <label className={styles.botonSubir}>
                    <Upload size={16} aria-hidden="true" />
                    {subiendo === `vista-${i}` ? 'Subiendo…' : v.imagen ? 'Cambiar foto' : 'Subir foto'}
                    <input
                      type="file"
                      accept="image/png,image/webp"
                      hidden
                      onChange={async (e) => {
                        const url = await subir(e.target.files?.[0], `vista-${i}`);
                        e.target.value = '';
                        if (url) setVista(i, { imagen: url });
                      }}
                    />
                  </label>
                </div>

                <div className={styles.zonasLista}>
                  <div className={styles.escala}>
                    {v.referencia ? (
                      <>
                        <div className={styles.escalaFila}>
                          <span>La línea naranja mide</span>
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={v.referencia.cm ?? ''}
                            onChange={(e) => setVista(i, { referencia: { ...v.referencia, cm: e.target.value } })}
                            aria-label="Medida real de la línea de referencia en cm"
                          />
                          <span>cm</span>
                          <label>
                            <input
                              type="checkbox"
                              checked={Boolean(cuadricula[v.id])}
                              onChange={(e) => setCuadricula((m) => ({ ...m, [v.id]: e.target.checked }))}
                            />
                            Cuadrícula de 5 cm
                          </label>
                          <button type="button" className={styles.botonMini} onClick={() => setVista(i, { referencia: null })}>
                            Quitar
                          </button>
                        </div>
                        <small className={styles.ayuda}>
                          Arrastra sus extremos sobre algo que puedas medir en la prenda real (por ejemplo, de axila a axila) y
                          escribe cuánto mide. Mantén Shift para dejarla recta. Con eso las zonas se miden y se ajustan en cm.
                          Solo tú ves estas medidas.
                        </small>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className={styles.botonMini}
                          onClick={() => setVista(i, { referencia: { x1: 0.25, y1: 0.4, x2: 0.75, y2: 0.4, cm: '' } })}
                        >
                          Agregar medida de referencia
                        </button>
                        <small className={styles.ayuda}>Para ver y ajustar las zonas en centímetros exactos.</small>
                      </>
                    )}
                  </div>
                  <datalist id={`zonas-sugeridas-${i}`}>
                    {ZONAS_SUGERIDAS.map((n) => <option key={n} value={n} />)}
                  </datalist>
                  {v.zonas.map((z, zi) => {
                    const escalaV = { referencia: normalizarReferencia(v.referencia), anchoImg: v.anchoImg, altoImg: v.altoImg };
                    const zn = normalizarZona(z, zi);
                    const cm = medidaZona(zn, escalaV);
                    const fijarCm = (anchoCm, altoCm) => {
                      const nueva = zonaConMedida(zn, escalaV, anchoCm, altoCm);
                      setZona(i, zi, { ...z, w: nueva.w, proporcion: nueva.proporcion });
                    };
                    return (
                    <div
                      key={z.id}
                      className={`${styles.zonaFila} ${cm ? styles.zonaFilaCm : ''} ${(zonaElegida[v.id] ?? 0) === zi ? styles.zonaFilaActiva : ''}`}
                      onFocus={() => setZonaElegida((m) => ({ ...m, [v.id]: zi }))}
                    >
                      <label className={styles.campo}>
                        <span>Zona</span>
                        <input list={`zonas-sugeridas-${i}`} value={z.nombre} onChange={(e) => setZona(i, zi, { ...z, nombre: e.target.value })} />
                      </label>
                      {cm && (
                        <>
                          <label className={styles.campo}>
                            <span>Ancho cm</span>
                            <CampoCm valor={cm.anchoCm} onFijar={(n) => fijarCm(n, cm.altoCm)} etiqueta={`Ancho de ${z.nombre} en cm`} />
                          </label>
                          <label className={styles.campo}>
                            <span>Alto cm</span>
                            <CampoCm valor={cm.altoCm} onFijar={(n) => fijarCm(cm.anchoCm, n)} etiqueta={`Alto de ${z.nombre} en cm`} />
                          </label>
                        </>
                      )}
                      <label className={styles.campo}>
                        <span>Giro °</span>
                        <input type="number" min="-180" max="180" step="1" value={z.angulo} onChange={(e) => setZona(i, zi, { ...z, angulo: e.target.value })} />
                      </label>
                      <button
                        type="button"
                        className={styles.iconoPeligro}
                        onClick={() => {
                          setVista(i, { zonas: v.zonas.filter((_, k) => k !== zi) });
                          setZonaElegida((m) => ({ ...m, [v.id]: 0 }));
                        }}
                        aria-label={`Quitar zona ${z.nombre}`}
                      >
                        <X size={16} aria-hidden="true" />
                      </button>
                    </div>
                    );
                  })}
                  {!v.zonas.length && <p className={styles.ayuda}>Esta vista aún no tiene zonas.</p>}
                  <button
                    type="button"
                    className={styles.botonSecundario}
                    onClick={() => {
                      setVista(i, { zonas: [...v.zonas, normalizarZona({ id: nuevoIdZona(), nombre: `Zona ${v.zonas.length + 1}`, x: 0.4, y: 0.4, w: 0.2, proporcion: 1 })] });
                      setZonaElegida((m) => ({ ...m, [v.id]: v.zonas.length }));
                    }}
                  >
                    <Plus size={16} aria-hidden="true" /> Agregar zona
                  </button>
                  <small className={styles.ayuda}>
                    Las zonas son de referencia: arrástralas para ubicarlas y estíralas desde sus bordes (a lo ancho, a lo alto o desde la esquina). El cliente elige en cuál va cada imagen o texto.
                  </small>
                </div>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          className={styles.botonSecundario}
          onClick={() => cambiar({
            vistas: [...vistas, (() => {
              const nombre = vistas.length === 0 ? 'Frente' : vistas.length === 1 ? 'Espalda' : `Vista ${vistas.length + 1}`;
              return normalizarVista({
                id: vistas.some((v) => v.id === 'frente') ? `vista-${vistas.length + 1}` : 'frente',
                nombre,
                zonas: [{ id: nuevoIdZona(), nombre: vistas.length === 1 ? 'Espalda' : 'Pecho', x: 0.35, y: 0.3, w: 0.3, proporcion: 1 }],
              });
            })()],
          })}
        >
          <Plus size={16} aria-hidden="true" /> Agregar vista
        </button>
      </section>

      <section className={styles.bloque}>
        <div className={styles.bloqueCabecera}>
          <h3 className={styles.bloqueTitulo}>Colores y tallas</h3>
          <button type="button" className={styles.botonSecundario} onClick={agregarColoresPolera}>
            <Palette size={16} aria-hidden="true" /> Agregar colores de polera (S–XL)
          </button>
        </div>
        <p className={styles.ayuda}>
          Son las <strong>variantes</strong> del producto (arriba): su nombre, su color y sus tallas. Cada color se tiñe
          sobre la foto blanca. Si alguno no queda bien, súbele su propia foto. Los <strong>bicolores</strong> siempre
          necesitan su foto en cada vista; mientras no la tengan, no se ofrecen.
        </p>
        {colores.length === 0 || !variantes?.length ? (
          <p className={styles.ayuda}>Aún no hay variantes.</p>
        ) : (
          <div className={styles.colores}>
            {colores.map((c) => {
              const listo = colorDisponible(c, vistas);
              return (
                <div key={c.id} className={styles.color}>
                  <div className={styles.colorFila}>
                    <span
                      className={styles.muestra}
                      style={{ background: fondoMuestra(c) }}
                      aria-hidden="true"
                    />
                    <strong className={styles.nombreColor}>{c.nombre}</strong>
                    <span className={styles.tallasColor}>{c.tallas.length ? c.tallas.join(' · ') : 'Sin tallas'}</span>
                    <label className={styles.bicolor}>
                      <input
                        type="checkbox"
                        checked={Boolean(c.hex2)}
                        onChange={(e) => setExtra(c.id, { hex2: e.target.checked ? '#101010' : '' })}
                      />
                      Bicolor
                    </label>
                    {c.hex2 && (
                      <input
                        type="color"
                        value={c.hex2}
                        onChange={(e) => setExtra(c.id, { hex2: e.target.value.toUpperCase() })}
                        aria-label={`Segundo tono de ${c.nombre}`}
                        title="Segundo tono"
                      />
                    )}
                    {c.hex2 && (
                      <select
                        className={styles.patron}
                        value={c.patron}
                        onChange={(e) => setExtra(c.id, { patron: e.target.value })}
                        aria-label={`Cómo se reparte ${c.nombre}`}
                        title="Cómo se reparten los dos tonos (así se dibuja su círculo)"
                      >
                        {PATRONES_BICOLOR.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                      </select>
                    )}
                  </div>
                  {!listo && (
                    <p className={styles.alerta}>
                      <AlertTriangle size={14} aria-hidden="true" /> Falta su foto en alguna vista: no se mostrará en Crear hasta tenerla.
                    </p>
                  )}
                  {vistas.length > 0 && (
                    <div className={styles.miniaturas}>
                      {vistas.map((v) => (
                        <div key={v.id} className={styles.miniaturaVista}>
                          <MiniaturaColor imagen={c.fotos[v.id] || v.imagen} hex={c.fotos[v.id] ? '#FFFFFF' : c.hex} nombre={v.nombre} />
                          {c.fotos[v.id] ? (
                            <button
                              type="button"
                              className={styles.botonMini}
                              onClick={() => setExtra(c.id, { fotos: Object.fromEntries(Object.entries(c.fotos).filter(([k]) => k !== v.id)) })}
                            >
                              Quitar foto
                            </button>
                          ) : (
                            <label className={styles.botonMini}>
                              {subiendo === `color-${c.id}-${v.id}` ? 'Subiendo…' : 'Foto propia'}
                              <input
                                type="file"
                                accept="image/png,image/webp"
                                hidden
                                onChange={async (e) => {
                                  const url = await subir(e.target.files?.[0], `color-${c.id}-${v.id}`);
                                  e.target.value = '';
                                  if (url) setExtra(c.id, { fotos: { ...c.fotos, [v.id]: url } });
                                }}
                              />
                            </label>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default PersonalizacionPrenda;
