import { useQueries } from '@tanstack/react-query';
import { leerPrendaBase, tallasDeColor, fotoDeVista, fondoDeVista, cargarImagen } from '../../utils/prendaBase';
import { fotosDeFija } from './comboCrear';

/*
 * Las fotos y las tallas de las prendas de un combo de Crear (/combo/:id).
 * Las usan el combo con el kit (components/crear/ComboDeTienda) y el de antes
 * (ComboCrearViejo).
 */

/** Tallas de la prenda en el color de la creación. */
export const tallasPara = (prenda, creacion) => {
  if (!prenda) return [];
  const cfg = leerPrendaBase(prenda);
  const color = cfg.colores.find((c) => c.id === creacion?.color?.id || c.nombre === creacion?.color?.nombre);
  return color ? tallasDeColor(color, cfg) : cfg.tallas;
};

/**
 * Fotos de una pieza y de dónde salen:
 *  - 'render': sus lados con diseño, ya renderizados con el fondo y el margen
 *    del estudio (vistas previas de la creación o de la plantilla o, en un
 *    borrador, sus miniaturas). Los lados sin diseño se completan con la
 *    prenda lisa en su color (useLadosLisos), renderizada igual.
 *  - 'prenda': la prenda en blanco (sin diseño todavía), foto de catálogo.
 *  - 'fija': una pieza que va tal cual (el reloj de un pack): las fotos de la
 *    tienda de su color.
 * Así la tarjeta las muestra al mismo tamaño y sobre el mismo fondo.
 */
export const ladosDePieza = (p) => {
  if (p.fija) return { origen: 'fija', lados: fotosDeFija(p.prenda, p.color).map((url) => ({ url, nombre: '' })), completa: true };
  const previas = (p.creacion?.vistasPrevias || p.plantilla?.vistasPrevias || []).filter((v) => v?.url);
  if (previas.length) return { origen: 'render', lados: previas.map((v) => ({ url: v.url, nombre: v.nombre, vista: v.vista })) };
  const conjunta = p.creacion?.imagenConjunta || p.plantilla?.imagenConjunta;
  if (conjunta) return { origen: 'render', lados: [{ url: conjunta, nombre: '' }], completa: true };
  // Un borrador todavía no tiene vistas previas: sus miniaturas (las que se
  // guardan solas mientras se diseña), una por lado; los de antes, una sola.
  const miniaturas = (p.creacion?.miniaturas || []).filter((m) => m?.url);
  if (miniaturas.length) return { origen: 'render', lados: miniaturas.map((m) => ({ url: m.url, nombre: m.nombre, vista: m.vista })) };
  if (p.creacion?.miniatura) return { origen: 'render', lados: [{ url: p.creacion.miniatura, nombre: '' }], completa: true };
  // Mientras carga la prenda: las fotos que guardó "Mi combo".
  if (!p.creacion && p.respaldo?.frente) {
    return { origen: 'render', lados: [p.respaldo.frente, p.respaldo.espalda].filter(Boolean).map((url) => ({ url, nombre: '' })), completa: true };
  }
  if (!p.prenda) return { origen: 'prenda', lados: [] };
  return {
    origen: 'prenda',
    lados: leerPrendaBase(p.prenda).vistas.filter((v) => v.imagen).map((v) => ({ url: v.imagen, nombre: v.nombre })),
  };
};

/** El color guardado de la pieza, en la configuración de su prenda (o null). */
export const colorDePieza = (p, cfg) => {
  const guardado = p.creacion?.color || p.plantilla?.color || null;
  return cfg?.colores.find((c) => c.id === guardado?.id)
    || cfg?.colores.find((c) => c.nombre === guardado?.nombre) || null;
};

/**
 * Las fotos de todas las piezas: sus lados con diseño y, a continuación, la
 * prenda lisa en su color para cada lado SIN diseño (renderizada como las
 * vistas previas: mismo fondo y margen). Así una prenda con diseño solo
 * adelante también muestra su espalda. Una consulta por prenda, color y lado
 * (queda en memoria). Devuelve, por pieza: { origen, lados, conDiseno }.
 */
export const useFotosDePiezas = (piezas) => {
  const base = piezas.map((p) => {
    const fotos = ladosDePieza(p);
    const cfg = p.prenda ? leerPrendaBase(p.prenda) : null;
    const color = colorDePieza(p, cfg);
    // Solo si se sabe qué lados tienen diseño (una imagen única no lo dice).
    const conVista = new Set(fotos.lados.map((l) => l.vista).filter(Boolean));
    const faltan = fotos.origen === 'render' && !fotos.completa && color && conVista.size
      ? cfg.vistas.filter((v) => !conVista.has(v.id) && fotoDeVista(v, color))
      : [];
    return { p, fotos, color, faltan };
  });
  const pedidos = base.flatMap((b, k) => b.faltan.map((v) => ({ k, b, v })));
  const consultas = useQueries({
    queries: pedidos.map(({ b, v }) => ({
      queryKey: ['prenda-lisa', b.p.prenda.id, b.color.id, v.id],
      staleTime: Infinity,
      queryFn: async () => {
        const { renderizarVistaPrevia } = await import('./renderDiseno');
        const img = await cargarImagen(fotoDeVista(v, b.color));
        const blob = await renderizarVistaPrevia({
          fuente: fondoDeVista(img, v, b.color), anchoImg: img.naturalWidth, altoImg: img.naturalHeight,
          vista: v, capasPorZona: {}, srcDe: (c) => c.src, ancho: 600,
        });
        return URL.createObjectURL(blob);
      },
    })),
  });
  return base.map((b, k) => {
    const lisos = pedidos
      .map((x, n) => (x.k === k ? { url: consultas[n]?.data || '', nombre: x.v.nombre, vista: x.v.id, lisa: true } : null))
      .filter((l) => l && l.url);
    return {
      origen: b.fotos.origen,
      lados: [...b.fotos.lados, ...lisos],
      // La etiqueta nombra solo los lados con diseño (no los lisos ni la prenda en blanco).
      conDiseno: b.fotos.origen === 'render' ? b.fotos.lados.map((l) => l.nombre).filter(Boolean) : [],
    };
  });
};

/** ¿La pieza todavía no tiene diseño? (su foto es la prenda en blanco, atenuada). */
export const piezaVacia = (p) => !p.fija && !p.creacion && !p.plantilla && !p.respaldo?.frente;
