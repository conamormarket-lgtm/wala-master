import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Pencil, Eye, Loader2 } from 'lucide-react';
import { getCombosCrear, guardarComboCrear, archivarComboCrear, MIN_PIEZAS, MAX_PIEZAS } from '../../services/combosCrear';
import { getPrendasBase } from '../../services/prendasBase';
import { precioBase } from '../../utils/prendaBase';
import { useGlobalToast } from '../../contexts/ToastContext';
import styles from './AdminCombosCrear.module.css';

const VACIO = { name: '', description: '', price: '', salePrice: '', publicado: false, piezas: [{ prendaId: '' }, { prendaId: '' }] };
const soles = (n) => `S/ ${Number(n || 0).toFixed(2)}`;

/**
 * Combos de Crear: "Pareja", "Trío"… El admin elige las prendas de cada
 * combo (pueden ser iguales o distintas) y su precio de paquete. El cliente
 * los arma en /combo/:id diseñando cada pieza.
 */
const AdminCombosCrear = () => {
  const queryClient = useQueryClient();
  const toast = useGlobalToast();
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(null);

  const { data: combos = [], isLoading } = useQuery({
    queryKey: ['admin-combos-crear'],
    queryFn: async () => (await getCombosCrear({ incluirBorradores: true })).data,
  });
  const { data: prendas = [] } = useQuery({
    queryKey: ['prendas-base', true],
    queryFn: async () => (await getPrendasBase({ incluirBorradores: true })).data,
  });
  const prendaPorId = new Map(prendas.map((p) => [p.id, p]));

  const refrescar = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-combos-crear'] });
    queryClient.invalidateQueries({ queryKey: ['combos-crear'] });
    queryClient.invalidateQueries({ queryKey: ['combo-crear'] });
  };

  const guardar = useMutation({
    mutationFn: () => guardarComboCrear(editandoId, form),
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

  const abrir = (combo) => {
    setEditandoId(combo?.id || null);
    setForm(combo ? {
      name: combo.name || '',
      description: combo.description || '',
      price: combo.price ?? '',
      salePrice: combo.salePrice ?? '',
      publicado: combo.publicado,
      piezas: combo.piezas.map((p) => ({ prendaId: p.prendaId })),
    } : { ...VACIO, piezas: VACIO.piezas.map((p) => ({ ...p })) });
  };

  const cambiar = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));
  const cambiarPieza = (i, prendaId) => setForm((f) => ({ ...f, piezas: f.piezas.map((p, k) => (k === i ? { prendaId } : p)) }));

  const sueltas = form ? form.piezas.reduce((t, p) => t + (prendaPorId.get(p.prendaId) ? precioBase(prendaPorId.get(p.prendaId)) : 0), 0) : 0;
  const precioCombo = form ? precioBase({ price: form.price, salePrice: form.salePrice }) : 0;
  const completas = form ? form.piezas.filter((p) => p.prendaId).length : 0;

  const enviar = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.info('Ponle un nombre al combo.');
    if (completas < MIN_PIEZAS || completas !== form.piezas.length) return toast.info(`Elige la prenda de cada pieza (mínimo ${MIN_PIEZAS}).`);
    if (!(Number(form.price) > 0)) return toast.info('Ponle un precio al combo.');
    return guardar.mutate();
  };

  return (
    <div className={styles.pagina}>
      <div className={styles.cabecera}>
        <div>
          <h1 className={styles.titulo}>Combos de Crear</h1>
          <p className={styles.ayuda}>
            Prendas que se venden juntas a un precio de paquete (pareja, trío…). El cliente diseña cada una por separado.
            No aparecen en la tienda: se ofrecen en Crear cuando están publicados.
          </p>
        </div>
        {!form && (
          <button type="button" className={styles.principal} onClick={() => abrir(null)}>
            <Plus size={16} aria-hidden="true" /> Nuevo combo
          </button>
        )}
      </div>

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

          <fieldset className={styles.piezas}>
            <legend>Prendas del combo</legend>
            {form.piezas.map((p, i) => (
              <div key={i} className={styles.fila}>
                <span className={styles.numero}>{i + 1}</span>
                <select value={p.prendaId} onChange={(e) => cambiarPieza(i, e.target.value)}>
                  <option value="">Elige una prenda…</option>
                  {prendas.map((pr) => (
                    <option key={pr.id} value={pr.id}>
                      {pr.name} · {soles(precioBase(pr))}{pr.visible === false ? ' (borrador)' : ''}
                    </option>
                  ))}
                </select>
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
                onClick={() => setForm((f) => ({ ...f, piezas: [...f.piezas, { prendaId: f.piezas[f.piezas.length - 1]?.prendaId || '' }] }))}>
                <Plus size={15} aria-hidden="true" /> Agregar prenda
              </button>
            )}
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
                  {c.piezas.map((p) => prendaPorId.get(p.prendaId)?.name || 'Prenda no encontrada').join(' + ')}
                </span>
                <span className={styles.ayuda}>{soles(precioBase(c))}</span>
              </div>
              <span className={c.publicado ? styles.publicado : styles.borrador}>{c.publicado ? 'Publicado' : 'Borrador'}</span>
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
