import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Pencil, Eye, Loader2, Sparkles, Upload, X } from 'lucide-react';
import { getCombosCrear, guardarComboCrear, archivarComboCrear, sugerirCombos, MIN_PIEZAS, MAX_PIEZAS } from '../../services/combosCrear';
import { getPrendasBase } from '../../services/prendasBase';
import { getBrands } from '../../services/brands';
import { getCategories, getProducts } from '../../services/products';
import { uploadFile } from '../../services/firebase/storage';
import { precioBase, leerPrendaBase } from '../../utils/prendaBase';
import { useGlobalToast } from '../../contexts/ToastContext';
import styles from './AdminCombosCrear.module.css';

const VACIO = {
  name: '', description: '', price: '', salePrice: '', publicado: false, tallas: 'auto', piezas: [{ prendaId: '' }, { prendaId: '' }],
  brandId: '', mainImage: '', enTienda: false, categories: [],
};

// La foto de una prenda para la tarjeta del combo en la tienda: la de la
// tienda de su color principal o, si no tiene, la de su primera vista.
const fotoDePrenda = (prenda) => {
  const principal = (prenda?.variants || []).find((v) => String(v.id) === String(prenda.defaultVariantId)) || prenda?.variants?.[0];
  return principal?.imageUrl || leerPrendaBase(prenda).vistas[0]?.imagen || '';
};

// Cómo elige la talla el cliente (comboCrear.tallas).
const OPCIONES_TALLA = [
  { valor: 'auto', titulo: 'Automático', ayuda: 'Prendas distintas (conjunto de una persona): una sola talla. La misma prenda repetida (pareja, trío): una por prenda.' },
  { valor: 'porPrenda', titulo: 'Una talla por prenda', ayuda: 'Cada prenda elige la suya: él y ella pueden ser de tallas distintas.' },
  { valor: 'una', titulo: 'Una sola talla para todas', ayuda: 'Una talla que se aplica a todas las prendas.' },
];
const soles = (n) => `S/ ${Number(n || 0).toFixed(2)}`;

// Un producto de la tienda que puede ir tal cual en un pack (pieza fija): con
// colores, ni prenda de Crear ni combo.
const sirveTalCual = (p) => p && p.deleted !== true && p.esPrendaBase !== true && !p.isComboProduct
  && p.esComboCrear !== true && (p.variants || []).length > 0;
const colorDeVariante = (v) => ({ id: String(v.id), nombre: v.name || '', hex: v.colorHex || '' });

/**
 * Packs (combos) de Crear: "Pareja", "Trío"… El admin elige las prendas de
 * cada combo (pueden ser iguales o distintas) y su precio de paquete. El
 * cliente los arma en /combo/:id diseñando cada pieza. Se muestra dentro de
 * Productos (chip "Packs de Crear"): `embebido` quita su título.
 */
const AdminCombosCrear = ({ embebido = false, nuevoInicial = false }) => {
  const queryClient = useQueryClient();
  const toast = useGlobalToast();
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(null);
  // Combos sugeridos (pareja y trío de cada prenda), para crearlos de una vez.
  const [sugeridos, setSugeridos] = useState(null);
  const [publicarSugeridos, setPublicarSugeridos] = useState(true);

  const { data: combos = [], isLoading } = useQuery({
    queryKey: ['admin-combos-crear'],
    queryFn: async () => (await getCombosCrear({ incluirBorradores: true })).data,
  });
  const { data: prendas = [] } = useQuery({
    queryKey: ['prendas-base', true],
    queryFn: async () => (await getPrendasBase({ incluirBorradores: true })).data,
  });
  const prendaPorId = new Map(prendas.map((p) => [p.id, p]));
  // Los productos de la tienda, para las piezas que van tal cual (misma lista que Productos).
  const { data: productosTienda = [] } = useQuery({
    queryKey: ['admin-products'],
    queryFn: async () => {
      const { data, error } = await getProducts([], null, null, { includeHidden: true });
      if (error) throw new Error(error);
      return data;
    },
  });
  const talCualPorId = new Map(productosTienda.filter(sirveTalCual).map((p) => [p.id, p]));
  // El producto de una pieza: la prenda de Crear o, si va tal cual, el de la tienda.
  const productoDe = (p) => (p.fija ? talCualPorId.get(p.prendaId) : prendaPorId.get(p.prendaId));
  const { data: marcas = [] } = useQuery({
    queryKey: ['brands'],
    queryFn: async () => (await getBrands()).data || [],
    staleTime: 300_000,
  });
  const { data: categorias = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => (await getCategories()).data || [],
    staleTime: 300_000,
  });
  const [subiendo, setSubiendo] = useState(false);

  // Cada pieza con el nombre y la foto de su prenda (la tarjeta de la tienda
  // los muestra sin leer las prendas).
  const conFotos = (datos) => ({
    ...datos,
    piezas: (datos.piezas || []).map((p) => {
      if (p.fija) {
        const producto = talCualPorId.get(p.prendaId);
        const v = (producto?.variants || []).find((x) => String(x.id) === String(p.color?.id));
        return producto && v
          ? { prendaId: p.prendaId, fija: true, color: colorDeVariante(v), nombre: producto.name, imagen: v.imageUrl || producto.mainImage || '' }
          : p;
      }
      const prenda = prendaPorId.get(p.prendaId);
      return prenda ? { prendaId: p.prendaId, nombre: prenda.name, imagen: fotoDePrenda(prenda), ...(p.color && { color: p.color }) } : p;
    }),
  });

  const refrescar = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-combos-crear'] });
    queryClient.invalidateQueries({ queryKey: ['combos-crear'] });
    queryClient.invalidateQueries({ queryKey: ['combo-crear'] });
  };

  const guardar = useMutation({
    mutationFn: () => guardarComboCrear(editandoId, conFotos(form)),
    onSuccess: () => {
      refrescar();
      toast.success('Combo guardado.');
      setForm(null);
      setEditandoId(null);
    },
    onError: (e) => toast.error(`No se pudo guardar: ${e.message}`),
  });

  const archivar = useMutation({
    mutationFn: (id) => archivarComboCrear(id),
    onSuccess: () => { refrescar(); toast.success('Combo archivado.'); },
    onError: (e) => toast.error(`No se pudo archivar: ${e.message}`),
  });

  const crearSugeridos = useMutation({
    mutationFn: async () => {
      const elegidos = sugeridos.filter((c) => c.elegido);
      for (const c of elegidos) {
        // Uno por uno: si uno falla, los anteriores ya quedaron creados.
        await guardarComboCrear(null, conFotos({ ...c, publicado: publicarSugeridos, brandId: prendaPorId.get(c.piezas[0]?.prendaId)?.brandId || '' }));
      }
      return elegidos.length;
    },
    onSuccess: (n) => {
      refrescar();
      toast.success(n === 1 ? 'Se creó 1 combo.' : `Se crearon ${n} combos.`);
      setSugeridos(null);
    },
    onError: (e) => { refrescar(); toast.error(`No se pudieron crear todos: ${e.message}`); },
  });

  const abrirSugeridos = () => {
    setForm(null);
    setSugeridos(sugerirCombos(prendas.filter((p) => p.visible !== false), combos, precioBase).map((c) => ({ ...c, elegido: true })));
  };
  const cambiarSugerido = (clave, cambios) => setSugeridos((lista) => lista.map((c) => (c.clave === clave ? { ...c, ...cambios } : c)));

  const abrir = (combo) => {
    setSugeridos(null);
    setEditandoId(combo?.id || null);
    setForm(combo ? {
      name: combo.name || '',
      description: combo.description || '',
      price: combo.price ?? '',
      salePrice: combo.salePrice ?? '',
      publicado: combo.publicado,
      tallas: combo.tallas || 'auto',
      piezas: combo.piezas.map((p) => ({ prendaId: p.prendaId, ...(p.fija && { fija: true }), ...(p.color && { color: p.color }) })),
      // Antes no se cargaban: guardar el combo borraba su portada.
      brandId: combo.brandId || '',
      mainImage: combo.mainImage || '',
      enTienda: combo.enTienda === true,
      categories: Array.isArray(combo.categories) ? combo.categories : [],
    } : { ...VACIO, piezas: VACIO.piezas.map((p) => ({ ...p })) });
  };

  // "Nuevo → Pack de Crear" en Productos abre el formulario de una vez.
  useEffect(() => { if (nuevoInicial) abrir(null); }, [nuevoInicial]);

  const cambiar = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));
  const subirPortada = async (archivo) => {
    if (!archivo) return;
    setSubiendo(true);
    const { url, error } = await uploadFile(archivo, `productos_v2/combos_crear/portada_${Date.now()}_${archivo.name.replace(/[^\w.-]/g, '_')}`);
    setSubiendo(false);
    if (error || !url) toast.error('No se pudo subir la portada.');
    else cambiar('mainImage', url);
  };
  const cambiarPieza = (i, cambios) => setForm((f) => ({ ...f, piezas: f.piezas.map((p, k) => (k === i ? cambios : p)) }));
  // Al elegir un producto tal cual se pone su primer color (siempre lleva uno).
  const elegirProducto = (i, p, prendaId) => {
    if (!p.fija) return cambiarPieza(i, { prendaId });
    const v = talCualPorId.get(prendaId)?.variants?.[0];
    return cambiarPieza(i, { prendaId, fija: true, ...(v && { color: colorDeVariante(v) }) });
  };
  // Los colores de la pieza: los de la prenda (el estudio abre en ese) o los del producto tal cual.
  const coloresDe = (p) => {
    const producto = productoDe(p);
    if (!producto) return [];
    return p.fija ? producto.variants.map(colorDeVariante) : leerPrendaBase(producto).colores.map((c) => ({ id: c.id, nombre: c.nombre, hex: c.hex || '' }));
  };
  const elegirColor = (i, p, colorId) => {
    const color = coloresDe(p).find((c) => c.id === colorId);
    const { color: _sinColor, ...resto } = p;
    cambiarPieza(i, color ? { ...resto, color } : resto);
  };

  const sueltas = form ? form.piezas.reduce((t, p) => t + (productoDe(p) ? precioBase(productoDe(p)) : 0), 0) : 0;
  const precioCombo = form ? precioBase({ price: form.price, salePrice: form.salePrice }) : 0;
  const completas = form ? form.piezas.filter((p) => p.prendaId && (!p.fija || p.color)).length : 0;
  const talCualOrdenados = [...talCualPorId.values()]
    // Primero los de la marca del pack.
    .sort((a, b) => (b.brandId === form?.brandId) - (a.brandId === form?.brandId) || String(a.name).localeCompare(String(b.name)));

  const enviar = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.info('Ponle un nombre al combo.');
    if (completas < MIN_PIEZAS || completas !== form.piezas.length) return toast.info(`Elige la prenda de cada pieza y el color de las que van tal cual (mínimo ${MIN_PIEZAS}).`);
    if (form.piezas.every((p) => p.fija)) return toast.info('Al menos una pieza tiene que diseñarse: si todo va tal cual, es un combo de la tienda.');
    if (!(Number(form.price) > 0)) return toast.info('Ponle un precio al combo.');
    return guardar.mutate();
  };

  return (
    <div className={styles.pagina}>
      <div className={styles.cabecera}>
        <div>
          {!embebido && <h1 className={styles.titulo}>Packs de Crear</h1>}
          <p className={styles.ayuda}>
            Prendas que se venden juntas a un precio de paquete (pareja, trío…). El cliente diseña cada una por separado.
            Se ofrecen en Crear cuando están publicados y, con "También en la tienda", también en la tienda y en su marca.
          </p>
        </div>
        {!form && !sugeridos && (
          <div className={styles.acciones}>
            <button type="button" className={styles.principal} onClick={abrirSugeridos} disabled={!prendas.length}>
              <Sparkles size={16} aria-hidden="true" /> Sugerir combos
            </button>
            <button type="button" className={styles.secundario} onClick={() => abrir(null)}>
              <Plus size={16} aria-hidden="true" /> Nuevo combo
            </button>
          </div>
        )}
      </div>

      {sugeridos && (
        <div className={styles.tarjeta}>
          <h2 className={styles.subtitulo}>Combos sugeridos</h2>
          {sugeridos.length === 0 ? (
            <p className={styles.ayuda}>Ya tienes una pareja y un trío de cada prenda publicada.</p>
          ) : (
            <>
              <p className={styles.ayuda}>
                Una pareja y un trío de cada prenda personalizable publicada. El precio sugerido es 10% menos en pareja
                y 15% menos en trío, redondeado. Cambia lo que quieras antes de crearlos.
              </p>
              <ul className={styles.sugeridos}>
                {sugeridos.map((c) => (
                  <li key={c.clave} className={`${styles.sugerido} ${c.elegido ? '' : styles.sugeridoApagado}`}>
                    <input
                      type="checkbox"
                      checked={c.elegido}
                      onChange={(e) => cambiarSugerido(c.clave, { elegido: e.target.checked })}
                      aria-label={`Crear ${c.name}`}
                    />
                    <input
                      className={styles.sugeridoNombre}
                      value={c.name}
                      onChange={(e) => cambiarSugerido(c.clave, { name: e.target.value })}
                      aria-label="Nombre del combo"
                      maxLength={80}
                    />
                    <span className={styles.sugeridoSueltas}>Sueltas {soles(c.sueltas)}</span>
                    <label className={styles.sugeridoPrecio}>
                      <span>S/</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={c.price}
                        onChange={(e) => cambiarSugerido(c.clave, { price: e.target.value })}
                        aria-label={`Precio de ${c.name}`}
                      />
                    </label>
                  </li>
                ))}
              </ul>
              <label className={styles.check}>
                <input type="checkbox" checked={publicarSugeridos} onChange={(e) => setPublicarSugeridos(e.target.checked)} />
                <span>Publicarlos de una vez (si no, quedan en borrador y solo los ves tú)</span>
              </label>
            </>
          )}
          <div className={styles.acciones}>
            {sugeridos.length > 0 && (
              <button
                type="button"
                className={styles.principal}
                disabled={crearSugeridos.isPending || !sugeridos.some((c) => c.elegido && Number(c.price) > 0 && c.name.trim())}
                onClick={() => crearSugeridos.mutate()}
              >
                {crearSugeridos.isPending && <Loader2 size={15} className={styles.girando} aria-hidden="true" />}
                {(() => { const n = sugeridos.filter((c) => c.elegido).length; return `Crear ${n} ${n === 1 ? 'combo' : 'combos'}`; })()}
              </button>
            )}
            <button type="button" className={styles.texto} onClick={() => setSugeridos(null)}>Cancelar</button>
          </div>
        </div>
      )}

      {form && (
        <form className={styles.tarjeta} onSubmit={enviar}>
          <h2 className={styles.subtitulo}>{editandoId ? 'Editar combo' : 'Nuevo combo'}</h2>
          <label className={styles.campo}>
            <span>Nombre</span>
            <input value={form.name} onChange={(e) => cambiar('name', e.target.value)} placeholder="Ej. Pareja de polos" maxLength={80} />
          </label>
          <label className={styles.campo}>
            <span>Descripción (opcional)</span>
            <textarea value={form.description} onChange={(e) => cambiar('description', e.target.value)} rows={2} maxLength={300} placeholder="Ej. Dos polos con el diseño que quieran, para ustedes dos." />
          </label>
          <label className={styles.campo}>
            <span>Marca (opcional)</span>
            <select value={form.brandId} onChange={(e) => cambiar('brandId', e.target.value)}>
              <option value="">Sin marca</option>
              {marcas.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
          <label className={styles.campo}>
            <span>Categoría (la página de la marca muestra un carrusel por categoría)</span>
            <select value={form.categories[0] || ''} onChange={(e) => cambiar('categories', e.target.value ? [e.target.value] : [])}>
              <option value="">Sin categoría</option>
              {categorias
                // Las de su marca (como la ficha de productos: brandIds de la categoría).
                .filter((c) => !form.brandId || (Array.isArray(c.brandIds) && c.brandIds.includes(form.brandId)) || c.id === form.categories[0])
                .map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <div className={styles.campo}>
            <span>Portada (opcional: sin ella se ven las prendas juntas)</span>
            <div className={styles.portada}>
              {form.mainImage && <img src={form.mainImage} alt="" />}
              <label className={styles.secundario}>
                {subiendo ? <Loader2 size={15} className={styles.girando} aria-hidden="true" /> : <Upload size={15} aria-hidden="true" />}
                {form.mainImage ? 'Cambiar portada' : 'Subir portada'}
                <input type="file" accept="image/*" hidden onChange={(e) => { subirPortada(e.target.files?.[0]); e.target.value = ''; }} />
              </label>
              {form.mainImage && (
                <button type="button" className={styles.texto} onClick={() => cambiar('mainImage', '')}>
                  <X size={14} aria-hidden="true" /> Quitar
                </button>
              )}
            </div>
          </div>

          <fieldset className={styles.piezas}>
            <legend>Prendas del combo</legend>
            <p className={styles.ayuda}>
              Cada pieza se diseña en Crear o va tal cual: un producto de la tienda en el color que elijas (el reloj de un pack
              con billetera y esclava grabadas). En una que se diseña, el color es con el que abre el estudio.
            </p>
            {form.piezas.map((p, i) => (
              <div key={i} className={styles.fila}>
                <span className={styles.numero}>{i + 1}</span>
                <select className={styles.tipoPieza} value={p.fija ? 'fija' : 'disena'} aria-label={`Cómo va la pieza ${i + 1}`}
                  onChange={(e) => cambiarPieza(i, e.target.value === 'fija' ? { prendaId: '', fija: true } : { prendaId: '' })}>
                  <option value="disena">Se diseña</option>
                  <option value="fija">Va tal cual</option>
                </select>
                <select value={p.prendaId} onChange={(e) => elegirProducto(i, p, e.target.value)} aria-label={`Producto de la pieza ${i + 1}`}>
                  <option value="">{p.fija ? 'Elige un producto de la tienda…' : 'Elige una prenda…'}</option>
                  {(p.fija ? talCualOrdenados : prendas).map((pr) => (
                    <option key={pr.id} value={pr.id}>
                      {pr.name} · {soles(precioBase(pr))}{pr.visible === false ? (p.fija ? ' (oculto)' : ' (borrador)') : ''}
                    </option>
                  ))}
                </select>
                {p.prendaId && coloresDe(p).length > 0 && (
                  <select value={p.color?.id || ''} onChange={(e) => elegirColor(i, p, e.target.value)} aria-label={`Color de la pieza ${i + 1}`}>
                    {!p.fija && <option value="">El que elija el cliente</option>}
                    {coloresDe(p).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                )}
                {form.piezas.length > MIN_PIEZAS && (
                  <button type="button" className={styles.icono} aria-label={`Quitar la prenda ${i + 1}`}
                    onClick={() => setForm((f) => ({ ...f, piezas: f.piezas.filter((_, k) => k !== i) }))}>
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                )}
              </div>
            ))}
            {form.piezas.length < MAX_PIEZAS && (
              <button type="button" className={styles.secundario}
                onClick={() => setForm((f) => {
                  const ultima = f.piezas[f.piezas.length - 1];
                  return { ...f, piezas: [...f.piezas, ultima?.fija ? { prendaId: '' } : { prendaId: ultima?.prendaId || '' }] };
                })}>
                <Plus size={15} aria-hidden="true" /> Agregar prenda
              </button>
            )}
          </fieldset>

          <fieldset className={styles.piezas}>
            <legend>Tallas</legend>
            {OPCIONES_TALLA.map((o) => (
              <label key={o.valor} className={styles.check}>
                <input type="radio" name="tallas" checked={form.tallas === o.valor} onChange={() => cambiar('tallas', o.valor)} />
                <span><strong>{o.titulo}</strong> · {o.ayuda}</span>
              </label>
            ))}
          </fieldset>

          <div className={styles.precios}>
            <label className={styles.campo}>
              <span>Precio del combo (S/)</span>
              <input type="number" min="0" step="0.01" value={form.price} onChange={(e) => cambiar('price', e.target.value)} />
            </label>
            <label className={styles.campo}>
              <span>Precio de oferta (opcional)</span>
              <input type="number" min="0" step="0.01" value={form.salePrice} onChange={(e) => cambiar('salePrice', e.target.value)} />
            </label>
          </div>
          {completas > 0 && (
            <p className={styles.ayuda}>
              Por separado: {soles(sueltas)} · El cliente paga {soles(precioCombo)}
              {sueltas > precioCombo ? ` · Ahorra ${soles(sueltas - precioCombo)}` : ''}
            </p>
          )}

          <label className={styles.check}>
            <input type="checkbox" checked={form.publicado} onChange={(e) => cambiar('publicado', e.target.checked)} />
            <span>Publicado (se ve en Crear y se puede comprar)</span>
          </label>
          <label className={styles.check}>
            <input type="checkbox" checked={form.enTienda} onChange={(e) => cambiar('enTienda', e.target.checked)} />
            <span>También en la tienda (y en la página de su marca), para armarlo{form.publicado ? '' : ' · se verá cuando esté publicado'}</span>
          </label>

          <div className={styles.acciones}>
            <button type="submit" className={styles.principal} disabled={guardar.isPending}>
              {guardar.isPending && <Loader2 size={15} className={styles.girando} aria-hidden="true" />} Guardar combo
            </button>
            <button type="button" className={styles.texto} onClick={() => { setForm(null); setEditandoId(null); }}>Cancelar</button>
          </div>
        </form>
      )}

      {isLoading ? (
        <p className={styles.ayuda}>Cargando…</p>
      ) : combos.length === 0 ? (
        !form && <p className={styles.ayuda}>Aún no hay combos. Crea el primero, por ejemplo "Pareja de polos".</p>
      ) : (
        <ul className={styles.lista}>
          {combos.map((c) => (
            <li key={c.id} className={styles.item}>
              <div className={styles.itemInfo}>
                <strong>{c.name}</strong>
                <span className={styles.ayuda}>
                  {c.piezas.map((p) => (p.fija
                    ? `${talCualPorId.get(p.prendaId)?.name || p.nombre || 'Producto no encontrado'}${p.color?.nombre ? ` · ${p.color.nombre}` : ''} (tal cual)`
                    : prendaPorId.get(p.prendaId)?.name || 'Prenda no encontrada')).join(' + ')}
                </span>
                <span className={styles.ayuda}>
                  {soles(precioBase(c))}
                  {c.tallas !== 'auto' && ` · ${OPCIONES_TALLA.find((o) => o.valor === c.tallas)?.titulo}`}
                </span>
              </div>
              <span className={styles.estados}>
                <span className={c.publicado ? styles.publicado : styles.borrador}>{c.publicado ? 'Publicado' : 'Borrador'}</span>
                {c.enTienda && c.publicado && <span className={styles.publicado}>En la tienda</span>}
              </span>
              <div className={styles.itemAcciones}>
                <Link to={`/combo/${c.id}`} className={styles.icono} aria-label="Ver" title="Ver"><Eye size={16} aria-hidden="true" /></Link>
                <button type="button" className={styles.icono} aria-label="Editar" title="Editar" onClick={() => abrir(c)}><Pencil size={16} aria-hidden="true" /></button>
                <button type="button" className={styles.icono} aria-label="Archivar" title="Archivar"
                  onClick={() => { if (window.confirm(`¿Archivar "${c.name}"? Deja de ofrecerse; los pedidos que ya lo tienen no cambian.`)) archivar.mutate(c.id); }}>
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AdminCombosCrear;
