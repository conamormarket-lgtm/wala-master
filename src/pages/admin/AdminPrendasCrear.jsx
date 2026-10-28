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
 * Los personalizables (prendas y productos de Crear): los que el cliente
 * diseña en /personalizar y /crear/:id (polo, polera, cuadro…). La lista con
 * lo que hace falta para que se vean en Crear (vistas y zonas), si también
 * salen en la tienda, en qué packs va cada uno, y su ficha
 * (/admin/prendas-crear/:id: la de productos en modo prenda). Se muestra
 * dentro de Productos (chip "Personalizables"): `embebido` quita su título.
 */
const AdminPrendasCrear = ({ embebido = false }) => {
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
          {!embebido && <h1 className={combos.titulo}>Personalizables</h1>}
          <p className={combos.ayuda}>
            Lo que el cliente diseña en Crear (prendas y productos): sus colores, sus vistas, las zonas donde se imprime
            y sus plantillas. En borrador solo lo ven los admins (para probarlo). Con "También en la tienda" sale además
            en la tienda, siempre para personalizarlo.
          </p>
        </div>
        <div className={combos.acciones}>
          <Link to="/admin/prendas-crear/nueva" className={combos.principal}>
            <Plus size={16} aria-hidden="true" /> Nuevo personalizable
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
            const plantillas = (p.prendaBase?.plantillas || []).length;
            // La foto de tienda del color principal; si no tiene, la de su primera vista.
            const principal = (p.variants || []).find((v) => v.id === p.defaultVariantId) || p.variants?.[0];
            const foto = principal?.imageUrl || vistas[0]?.imagen || p.mainImage || '';
            return (
              <li key={p.id} className={combos.item}>
                <span className={s.foto}>{foto ? <img src={foto} alt="" loading="lazy" /> : null}</span>
                <div className={combos.itemInfo}>
                  <strong>{p.name}</strong>
                  <span className={combos.ayuda}>
                    {colores} {colores === 1 ? 'color' : 'colores'} · {vistas.length} {vistas.length === 1 ? 'vista' : 'vistas'} · {zonas} {zonas === 1 ? 'zona' : 'zonas'}
                    {plantillas > 0 && ` · ${plantillas} ${plantillas === 1 ? 'plantilla' : 'plantillas'}`}
                  </span>
                  {!lista && <span className={s.falta}>Le faltan vistas con zonas: no aparece en Crear.</span>}
                  {usada.length > 0 && (
                    <span className={combos.ayuda}>En {usada.map((c) => c.name).join(', ')}</span>
                  )}
                </div>
                <span className={combos.estados}>
                  <span className={publicada ? combos.publicado : combos.borrador}>{publicada ? 'Publicada' : 'Borrador'}</span>
                  {publicada && p.enTienda && <span className={combos.publicado}>En la tienda</span>}
                </span>
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
