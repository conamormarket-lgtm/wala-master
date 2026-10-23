import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useProducts } from './useProducts';
import { getTags } from '../services/tags';
import { getCharacters } from '../services/characters';
import { getCollections } from '../services/collections';
import { leerSurveyConfig } from '../services/encuestaConfig';
import { recomendarRegalos, sugerenciasRespuestas, sugerenciasPorCampo } from '../utils/giftRecommender.mjs';

const aMapa = (lista) => Object.fromEntries((lista || []).map((x) => [x.id, x.name || '']));

/**
 * Todo lo que necesita el buscador de regalos: catálogo público, nombres de
 * etiquetas/personajes/colecciones (los productos guardan solo sus IDs) y la
 * relación conjunto de la encuesta → categorías de la tienda (la define el
 * admin en "Encuesta de Suscripción → Conjuntos").
 *
 * Devuelve `recomendar(recipient, { ocasion, limite })` listo para usar y las
 * `sugerencias` para autocompletar respuestas en la encuesta.
 *  - activo: false para no pedir nada todavía (la encuesta lo enciende al
 *    empezar: en la portada no hace falta el catálogo entero)
 */
export function useGiftCatalog({ activo = true } = {}) {
  const { data: productos, isLoading: cargandoProductos } = useProducts([], null, { enabled: activo });

  const { data: extra, isLoading: cargandoExtra } = useQuery({
    queryKey: ['gift-catalog-dicts'],
    queryFn: async () => {
      const [tags, characters, collections, config] = await Promise.all([
        getTags(), getCharacters(), getCollections(), leerSurveyConfig(),
      ]);
      const conjuntoCategorias = {};
      const conjuntos = (config.data && config.data.brandsPanel && config.data.brandsPanel.categories) || [];
      // Preguntas que "solo ordenan" (admin de Encuestas): { cat_deportes: ['dep_q4'] }.
      const camposRefinan = {};
      conjuntos.forEach((c) => {
        if (c && c.id && Array.isArray(c.tiendaCategorias)) conjuntoCategorias[c.id] = c.tiendaCategorias;
        const refinan = (c && c.id && Array.isArray(c.fields) ? c.fields : []).filter((f) => f && f.refina).map((f) => f.id);
        if (refinan.length) camposRefinan[c.id] = refinan;
      });
      return {
        dicts: {
          tags: aMapa(tags.data),
          characters: aMapa(characters.data),
          collections: aMapa(collections.data),
        },
        conjuntoCategorias,
        camposRefinan,
        conjuntos,
        // Casilla del admin de Encuestas: el presupuesto de cada persona.
        pedirPresupuesto: Boolean(config.data && config.data.personPanel && config.data.personPanel.budget),
      };
    },
    staleTime: 1000 * 60 * 10,
    enabled: activo,
  });

  const dicts = extra?.dicts;
  const conjuntoCategorias = extra?.conjuntoCategorias;
  const camposRefinan = extra?.camposRefinan;

  const recomendar = useMemo(() => (recipient, opciones = {}) => recomendarRegalos({
    recipient,
    productos: productos || [],
    dicts: dicts || {},
    conjuntoCategorias: conjuntoCategorias || {},
    camposRefinan: camposRefinan || {},
    ...opciones,
  }), [productos, dicts, conjuntoCategorias, camposRefinan]);

  const sugerencias = useMemo(() => sugerenciasRespuestas(dicts || {}), [dicts]);

  // Sugerencias para UNA pregunta (equipos, jugadores, animes…), sacadas de
  // los productos de ese conjunto. Se memorizan por pregunta.
  const sugerenciasCampo = useMemo(() => {
    const cache = new Map();
    return (conjunto, field) => {
      const clave = `${conjunto?.id}|${field?.id}`;
      if (!cache.has(clave)) {
        cache.set(clave, sugerenciasPorCampo({
          conjunto, field, productos: productos || [], dicts: dicts || {}, conjuntoCategorias: conjuntoCategorias || {},
        }));
      }
      return cache.get(clave);
    };
  }, [productos, dicts, conjuntoCategorias]);

  return {
    recomendar,
    sugerencias,
    sugerenciasCampo,
    // Conjuntos de la encuesta (Deportes, Geek…) con sus preguntas, para
    // preguntar gustos también desde "Fechas importantes".
    conjuntos: extra?.conjuntos || [],
    pedirPresupuesto: Boolean(extra?.pedirPresupuesto),
    cargando: cargandoProductos || cargandoExtra,
  };
}
