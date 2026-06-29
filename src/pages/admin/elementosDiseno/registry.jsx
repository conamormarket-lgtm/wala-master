import React from 'react';
import { LayoutGrid } from 'lucide-react';
import NavegacionCategoriasEditor from './editores/NavegacionCategoriasEditor';

/**
 * REGISTRO DE "ELEMENTOS CON DISEÑO".
 *
 * Catálogo extensible de los elementos visuales editables de la tienda. Cada
 * entrada se pinta como una TARJETA en la landing /admin/elementos-diseno y
 * tiene su propia página /admin/elementos-diseno/{slug} que renderiza su Editor.
 *
 * Para AÑADIR un nuevo elemento en el futuro (p. ej. 'destacados', 'banners'…)
 * basta con agregar otra entrada a este array:
 *
 *   {
 *     slug: 'destacados',
 *     nombre: 'Productos destacados',
 *     descripcion: '…',
 *     icon: <AlgunIcono size={28} />,
 *     Editor: DestacadosEditor,
 *   }
 *
 * Forma de cada entrada:
 *  @property {string} slug         identificador en la URL (/.../:elementSlug).
 *  @property {string} nombre       título visible (tarjeta + encabezado).
 *  @property {string} descripcion  texto corto explicativo (tarjeta).
 *  @property {React.ReactNode} icon  icono ya instanciado para la tarjeta.
 *  @property {React.ComponentType} Editor  componente editor del elemento.
 */
export const ELEMENTOS_DISENO = [
  {
    slug: 'navegacion-categorias',
    nombre: 'Navegación por categorías',
    descripcion: 'Las burbujas de categorías con miniatura por marca.',
    icon: <LayoutGrid size={28} />,
    Editor: NavegacionCategoriasEditor,
  },
];

/** Busca un elemento del registro por su slug. */
export const getElementoBySlug = (slug) =>
  ELEMENTOS_DISENO.find((el) => el.slug === slug) || null;

export default ELEMENTOS_DISENO;
