import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getBrand } from '../../services/brands';
import { ControlOpciones, ControlLista } from '../../componentes/kit/editor/CamposEditor';
import s from '../../componentes/kit/editor/Editor.module.css';

/*
 * Las burbujas de "Botones de categorías" con las piezas del editor (antes,
 * CategoryNavEditor: el diseño viejo del admin y su propio "Guardar nav").
 * Son de la MARCA (tienda_brands: categoryNav y categoryNavStyle) y salen en
 * todas sus páginas. Mientras se editan viven en el borrador de la sección
 * (settings._burbujas): la página las muestra al momento, deshacer funciona
 * y se guardan en la marca al pulsar "Publicar" (EditorDeTienda, preparar).
 *  - modo: 'auto' (todas las categorías con productos de la marca) o 'mano'
 *    (las elegidas, en su orden, con su nombre y su foto)
 *  - alinear: left | center | right | justify · animar: static | slider
 */

const ALINEAR = [
  { valor: 'left', texto: 'Izquierda' },
  { valor: 'center', texto: 'Centro' },
  { valor: 'right', texto: 'Derecha' },
  { valor: 'justify', texto: 'Repartidas' },
];

/** Lo guardado en la marca, como lo edita el panel. */
export const burbujasDeLaMarca = (marca = {}) => {
  const lista = Array.isArray(marca.categoryNav) ? [...marca.categoryNav].sort((a, b) => (a?.order ?? 0) - (b?.order ?? 0)) : [];
  const estilo = marca.categoryNavStyle || {};
  return {
    modo: lista.length ? 'mano' : 'auto',
    items: lista.map((it) => ({ categoryId: it.categoryId || '', name: it.name || '', imageUrl: it.imageUrl || '' })),
    alinear: ['left', 'center', 'right', 'justify'].includes(estilo.align) ? estilo.align : 'center',
    animar: estilo.animation === 'slider' ? 'slider' : 'static',
  };
};

/** Lo del borrador, como lo guarda la marca (updateBrand). */
export const burbujasParaLaMarca = (b) => ({
  categoryNav: b.modo === 'mano' ? (b.items || []).filter((it) => it.categoryId).map((it, order) => ({ ...it, order })) : [],
  categoryNavStyle: { align: b.alinear, animation: b.animar },
});

/**
 *  - ajustes, cambiar: los de la sección (los pasa el editor)
 *  - categorias: las de la marca ({ id, name, imageUrl }) para elegir y para
 *    empezar la lista a mano con las de siempre
 */
export default function BurbujasDeMarca({ ajustes, cambiar, categorias = [] }) {
  const brandId = ajustes.brandId;
  const { data: marca, isLoading } = useQuery({
    queryKey: ['admin-brand-doc', brandId],
    queryFn: async () => (await getBrand(brandId)).data || null,
    enabled: Boolean(brandId),
  });
  if (!ajustes._burbujas && isLoading) return <p className={s.nota}>Cargando las burbujas de la marca…</p>;
  const v = ajustes._burbujas || burbujasDeLaMarca(marca || {});
  const poner = (parche) => cambiar({ _burbujas: { ...v, ...parche } });
  const delAuto = () => categorias.map((c) => ({ categoryId: c.id, name: c.name || '', imageUrl: c.imageUrl || '' }));

  return (
    <>
      <ControlOpciones
        etiqueta="Qué burbujas salen"
        ayuda={v.modo === 'auto'
          ? 'Todas las categorías que tienen productos de la marca, con su nombre y su foto.'
          : 'Solo las que elijas, en tu orden. Una categoría nueva de la marca se suma sola al final.'}
        valor={v.modo}
        opciones={[{ valor: 'auto', texto: 'Automáticas' }, { valor: 'mano', texto: 'Elegidas a mano' }]}
        onCambiar={(modo) => poner({ modo, items: modo === 'mano' && !v.items.length ? delAuto() : v.items })}
      />
      {v.modo === 'mano' && (
        <ControlLista
          campo={{
            etiqueta: 'Burbujas',
            soloDesde: true,
            titulo: (it) => it.name || 'Sin nombre',
            miniatura: (it) => it.imageUrl,
            desde: {
              datos: 'categorias',
              etiqueta: 'Añadir una categoría',
              clave: 'categoryId',
              crear: (c) => ({ categoryId: c.id, name: c.name || '', imageUrl: c.imageUrl || '' }),
            },
            campos: [
              { tipo: 'fuente', campo: 'categoryId', etiqueta: 'Qué categoría filtra', datos: 'categorias', vacio: 'Elige una categoría' },
              { tipo: 'texto', campo: 'name', etiqueta: 'Nombre que se muestra' },
              { tipo: 'imagen', campo: 'imageUrl', etiqueta: 'Foto de la burbuja', carpeta: 'brands/burbujas' },
            ],
          }}
          valor={v.items}
          onCambiar={(items) => poner({ items })}
        />
      )}
      <ControlOpciones etiqueta="Alineación" valor={v.alinear} opciones={ALINEAR} onCambiar={(alinear) => poner({ alinear })} />
      <ControlOpciones
        etiqueta="Cómo se ven"
        valor={v.animar}
        opciones={[{ valor: 'static', texto: 'Quietas' }, { valor: 'slider', texto: 'Se deslizan' }]}
        onCambiar={(animar) => poner({ animar })}
      />
      <p className={s.nota}>Las burbujas son de la marca: cambian en todas sus páginas. Se guardan al pulsar Publicar.</p>
    </>
  );
}
