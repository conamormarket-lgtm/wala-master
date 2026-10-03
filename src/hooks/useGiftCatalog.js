import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useProducts } from './useProducts';
import { getTags } from '../services/tags';
import { getCharacters } from '../services/characters';
import { getCollections } from '../services/collections';
import { getSurveyConfig } from '../services/encuestaConfig';
import { recomendarRegalos, sugerenciasRespuestas } from '../utils/giftRecommender.mjs';

const aMapa = (lista) => Object.fromEntries((lista || []).map((x) => [x.id, x.name || '']));

/**
 * Todo lo que necesita el buscador de regalos: catálogo público, nombres de
 * etiquetas/personajes/colecciones (los productos guardan solo sus IDs) y la
 * relación conjunto de la encuesta → categorías de la tienda (la define el
 * admin en "Encuesta de Suscripción → Conjuntos").
 *
 * Devuelve `recomendar(recipient, { ocasion, limite })` listo para usar y las
 * `sugerencias` para autocompletar respuestas en la encuesta.
 */
export function useGiftCatalog() {
  const { data: productos, isLoading: cargandoProductos } = useProducts();

  const { data: extra, isLoading: cargandoExtra } = useQuery({
    queryKey: ['gift-catalog-dicts'],
    queryFn: async () => {
      const [tags, characters, collections, config] = await Promise.all([
        getTags(), getCharacters(), getCollections(), getSurveyConfig(),
      ]);
      const conjuntoCategorias = {};
      ((config.data && config.data.brandsPanel && config.data.brandsPanel.categories) || []).forEach((c) => {
        if (c && c.id && Array.isArray(c.tiendaCategorias)) conjuntoCategorias[c.id] = c.tiendaCategorias;
      });
      return {
        dicts: {
          tags: aMapa(tags.data),
          characters: aMapa(characters.data),
          collections: aMapa(collections.data),
        },
        conjuntoCategorias,
      };
    },
    staleTime: 1000 * 60 * 10,
  });

  const dicts = extra?.dicts;
  const conjuntoCategorias = extra?.conjuntoCategorias;

  const recomendar = useMemo(() => (recipient, opciones = {}) => recomendarRegalos({
    recipient,
    productos: productos || [],
    dicts: dicts || {},
    conjuntoCategorias: conjuntoCategorias || {},
    ...opciones,
  }), [productos, dicts, conjuntoCategorias]);

  const sugerencias = useMemo(() => sugerenciasRespuestas(dicts || {}), [dicts]);

  return {
    recomendar,
    sugerencias,
    cargando: cargandoProductos || cargandoExtra,
  };
}
