import React from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Eye, EyeOff, Trash2, Loader2 } from 'lucide-react';
import { getPrendasBaseAdmin } from '../../services/prendasBase';
import { getCombosCrear } from '../../services/combosCrear';
import { deleteProduct, updateProductField } from '../../services/products';
import { useGlobalToast } from '../../contexts/ToastContext';
import combos from './AdminCombosCrear.module.css';
import s from './AdminPrendasCrear.module.css';

/**
 * Prendas de Crear: las que el cliente diseña en /personalizar y /crear/:id
 * (polo, polera, casaca…). Antes se editaban en Productos, mezcladas con el
 * catálogo y con el interruptor "Producto personalizable". Aquí la lista con
 * lo que hace falta para que se vean en Crear (vistas y zonas), en qué combos
 * va cada una, y su ficha (/admin/prendas-crear/:id: la de productos en modo
 * prenda).
 */
const AdminPrendasCrear = () => {
  const queryClient = useQueryClient();
  const toast = useGlobalToast();

  const { data: prendas = [], isLoading } = useQuery({
    queryKey: ['admin-prendas-crear'],
    // Al día cada vez que se abre (la caché de la app no vuelve a pedir sola).
    refetchOnMount: 'always',
    queryFn: async () => {
      const { data, error } = await getPrendasBaseAdmin();
      if (error) throw new Error(error);
      return data;
    },
  });
  const { data: listaCombos = [] } = useQuery({
    queryKey: ['admin-combos-crear'],
    refetchOnMount: 'always',
    queryFn: async () => (await getCombosCrear({ incluirBorradores: true })).data,
  });
  const combosDe = (id) => listaCombos.filter((c) => (c.piezas || []).some((p) => p.prendaId === id));

  const refrescar = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-prendas-crear'] });
    queryClient.invalidateQueries({ queryKey: ['prendas-base'], refetchType: 'all' });
    queryClient.invalidateQueries({ queryKey: ['prenda-base'], refetchType: 'all' });
  };

  const publicar = useMutation({
    mutationFn: ({ id, visible }) => updateProductField(id, { visible }),
    onSuccess: (_, { visible }) => { refrescar(); toast.success(visible ? 'Publicada en Crear.' : 'Pasó a borrador.'); },
    onError: (e) => toast.error(`No se pudo cambiar: ${e.message}`),
  });
  const archivar = useMutation({
    mutationFn: (id) => deleteProduct(id),
    onSuccess: () => { refrescar(); toast.success('Prenda archivada.'); },
    onError: (e) => toast.error(`No se pudo archivar: ${e.message}`),
  });

  const pedirArchivar = (p) => {
    const usada = combosDe(p.id).filter((c) => c.publicado);
    const aviso = usada.length
      ? `\n\nLa usan ${usada.length === 1 ? 'el combo' : 'los combos'} ${usada.map((c) => `"${c.name}"`).join(', ')}: dejarán de ofrecerse mientras falte la prenda.`
      : '';
    if (window.confirm(`¿Archivar "${p.name}"? Deja de verse en Crear; las creaciones y los pedidos que ya la tienen no cambian.${aviso}`)) {
      archivar.mutate(p.id);
    }
  };

  return (
    <div className={combos.pagina}>
      <div className={combos.cabecera}>
        <div>
          <h1 className={combos.titulo}>Prendas de Crear</h1>
          <p className={combos.ayuda}>
            Las prendas que el cliente diseña en Crear: sus colores y tallas, sus vistas y las zonas donde se imprime.
            En borrador solo las ven los admins (para probarlas). Los combos que las usan están en Combos de Crear.
          </p>
        </div>
        <div className={combos.acciones}>
          <Link to="/admin/prendas-crear/nueva" className={combos.principal}>
            <Plus size={16} aria-hidden="true" /> Nueva prenda
          </Link>
        </div>
      </div>

      {isLoading ? (
        <p className={combos.ayuda}>Cargando…</p>
      ) : prendas.length === 0 ? (
        <p className={combos.ayuda}>Aún no hay prendas. Crea la primera, por ejemplo "Polo clásico".</p>
      ) : (
        <ul className={combos.lista}>
          {prendas.map((p) => {
            const vistas = p.prendaBase?.vistas || [];
            const zonas = vistas.reduce((n, v) => n + (v.zonas || []).length, 0);
            const colores = (p.variants || []).length;
            const publicada = p.visible !== false;
            const lista = vistas.length > 0 && zonas > 0;
            const usada = combosDe(p.id);
            const foto = vistas[0]?.imagen || p.mainImage || '';
            return (
              <li key={p.id} className={combos.item}>
                <span className={s.foto}>{foto ? <img src={foto} alt="" loading="lazy" /> : null}</span>
                <div className={combos.itemInfo}>
                  <strong>{p.name}</strong>
                  <span className={combos.ayuda}>
                    {colores} {colores === 1 ? 'color' : 'colores'} · {vistas.length} {vistas.length === 1 ? 'vista' : 'vistas'} · {zonas} {zonas === 1 ? 'zona' : 'zonas'}
                  </span>
                  {!lista && <span className={s.falta}>Le faltan vistas con zonas: no aparece en Crear.</span>}
                  {usada.length > 0 && (
                    <span className={combos.ayuda}>En {usada.map((c) => c.name).join(', ')}</span>
                  )}
                </div>
                <span className={publicada ? combos.publicado : combos.borrador}>{publicada ? 'Publicada' : 'Borrador'}</span>
                <div className={combos.itemAcciones}>
                  <Link to={`/crear/${p.id}`} className={combos.icono} aria-label="Ver en Crear" title="Ver en Crear">
                    <Eye size={16} aria-hidden="true" />
                  </Link>
                  <Link to={`/admin/prendas-crear/${p.id}`} className={combos.icono} aria-label="Editar" title="Editar">
                    <Pencil size={16} aria-hidden="true" />
                  </Link>
                  <button
                    type="button"
                    className={combos.icono}
                    aria-label={publicada ? 'Pasar a borrador' : 'Publicar en Crear'}
                    title={publicada ? 'Pasar a borrador' : 'Publicar en Crear'}
                    disabled={publicar.isPending}
                    onClick={() => publicar.mutate({ id: p.id, visible: !publicada })}
                  >
                    {publicar.isPending && publicar.variables?.id === p.id
                      ? <Loader2 size={16} className={combos.girando} aria-hidden="true" />
                      : publicada ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                  </button>
                  <button type="button" className={combos.icono} aria-label="Archivar" title="Archivar" onClick={() => pedirArchivar(p)}>
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default AdminPrendasCrear;
