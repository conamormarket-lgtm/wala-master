import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useVisualEditor } from '../../pages/Tienda/contexts/VisualEditorContext';
import EditableSection from '../admin/EditableSection';
import { searchProductsFirestore } from '../../services/search';
import { getDocument } from '../../services/firebase/firestore';
import { getCategories } from '../../services/products';
import { getBrand, getBrands } from '../../services/brands';
import { getCollections } from '../../services/collections';
import { getTags } from '../../services/tags';
import { getCharacters } from '../../services/characters';
import { getProductTypes } from '../../services/productTypes';
import { trackSearchQuery } from '../../services/analytics/tracker';
import { useTranslatedText } from '../../i18n/useTranslatedText';
import TarjetaDeProducto from '../producto/TarjetaDeProducto';
import { PaginaBusqueda } from '../../componentes/kit/paginas/Busqueda';
import {
  gruposDeCatalogo, grupoModalidad, grillaDesdeConfiguracion, ordenarProductos, ORDENES_BUSQUEDA,
} from '../../componentes/kit/adaptadores';

/*
 * /buscar con el kit (paso 6 de la migración, BUSCAR.md): `PaginaBusqueda`
 * con la misma búsqueda de siempre (searchProductsFirestore por cursor, de a
 * 24, ignorando respuestas viejas), los mismos textos del admin
 * (storeConfig/homePage.searchPage, con el borrador del editor) y ?brand=
 * para buscar solo en una marca. Los filtros y el orden se aplican aquí, sobre
 * lo encontrado.
 *
 * A diferencia de antes, los filtros salen de los resultados (también con
 * marca: ya no se baja el catálogo entero de la marca), las listas de nombres
 * se piden solo cuando hay resultados y las categorías vienen de la caché que
 * ya llenó la cabecera. Buscar desde esta página también se registra en la
 * analítica (antes solo desde la cabecera).
 */
const POR_PAGINA = 24;

const lista = (fn) => async () => (await fn()).data || [];

export default function BusquedaDeTienda() {
  const { user, userProfile } = useAuth();
  const [params, setParams] = useSearchParams();
  const termino = params.get('q') || '';
  // ?brand=<id de tienda_brands>: lo pone la cabecera al buscar desde una
  // página de marca. Sin él, la búsqueda es global.
  const marcaId = params.get('brand') || '';

  // Textos editables: el borrador del editor mientras está abierto; si no, lo guardado.
  const { storeConfigDraft } = useVisualEditor();
  const { data: storeConfig } = useQuery({
    queryKey: ['store-config-custom'],
    queryFn: async () => {
      const { data, error } = await getDocument('storeConfig', 'homePage');
      if (error) return null;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
  const config = storeConfigDraft || storeConfig || {};

  // ── Resultados acumulados por cursor. reqRef: si cambia el término, la
  // respuesta que llegue tarde del anterior se descarta.
  const [busqueda, setBusqueda] = useState({ items: [], cursor: null, hayMas: false, cargando: true });
  const reqRef = useRef(0);
  useEffect(() => {
    const mia = ++reqRef.current;
    setBusqueda({ items: [], cursor: null, hayMas: false, cargando: true });
    searchProductsFirestore({ term: termino, cursor: null, pageSize: POR_PAGINA }).then((r) => {
      if (mia !== reqRef.current) return;
      setBusqueda({ items: r.items || [], cursor: r.lastDoc || null, hayMas: Boolean(r.hasMore), cargando: false });
    });
  }, [termino]);
  const cargarMas = useCallback(() => {
    if (!busqueda.hayMas || busqueda.cargando) return;
    const mia = reqRef.current;
    setBusqueda((b) => ({ ...b, cargando: true }));
    searchProductsFirestore({ term: termino, cursor: busqueda.cursor, pageSize: POR_PAGINA }).then((r) => {
      if (mia !== reqRef.current) return;
      setBusqueda((b) => ({ items: b.items.concat(r.items || []), cursor: r.lastDoc || null, hayMas: Boolean(r.hasMore), cargando: false }));
    });
  }, [termino, busqueda.hayMas, busqueda.cargando, busqueda.cursor]);

  // Lo que se muestra: sin los ocultos y, con ?brand=, solo esa marca.
  const encontrados = useMemo(() => busqueda.items.filter((p) => (
    p.visible !== false && (!marcaId || p.brandId === marcaId)
  )), [busqueda.items, marcaId]);
  const hayResultados = encontrados.length > 0;

  // ── Listas de la tienda (mismas claves de caché que la cabecera y /tienda).
  const { data: categorias } = useQuery({ queryKey: ['categories'], queryFn: lista(getCategories), staleTime: 15 * 60 * 1000 });
  const { data: marcas } = useQuery({ queryKey: ['brands'], queryFn: lista(getBrands), staleTime: 15 * 60 * 1000 });
  const { data: colecciones } = useQuery({ queryKey: ['collections'], queryFn: lista(getCollections), enabled: hayResultados });
  const { data: etiquetas } = useQuery({ queryKey: ['tags'], queryFn: lista(getTags), enabled: hayResultados });
  const { data: personajes } = useQuery({ queryKey: ['characters'], queryFn: lista(getCharacters), enabled: hayResultados });
  const { data: tipos } = useQuery({ queryKey: ['productTypes'], queryFn: lista(getProductTypes), enabled: hayResultados });

  // El nombre de la marca del filtro: de la lista en caché; si no está ahí, su documento.
  const marcaEnLista = marcaId ? (marcas || []).find((m) => m.id === marcaId) : null;
  const { data: marcaSuelta } = useQuery({
    queryKey: ['brand', marcaId],
    queryFn: async () => (await getBrand(marcaId))?.data || null,
    enabled: Boolean(marcaId) && Array.isArray(marcas) && !marcaEnLista,
    staleTime: 15 * 60 * 1000,
  });
  const tuTienda = useTranslatedText('tu tienda');
  const nombreMarca = (marcaEnLista || marcaSuelta)?.name || tuTienda;

  // ── Filtros y orden, sobre lo encontrado. Se vacían al cambiar el término
  // o la marca (antes el catálogo se volvía a montar).
  const clave = `${termino}|${marcaId}`;
  const [filtros, setFiltros] = useState({ clave, sel: {} });
  const seleccion = filtros.clave === clave ? filtros.sel : {};
  const filtrar = (grupo, valor) => setFiltros({ clave, sel: { ...seleccion, [grupo]: valor } });
  const [orden, setOrden] = useState('newest');

  const resultados = useMemo(() => ordenarProductos(encontrados, orden), [encontrados, orden]);
  const grupos = useMemo(() => (hayResultados ? [
    grupoModalidad(encontrados),
    ...gruposDeCatalogo({
      categorias: categorias || [],
      colecciones: colecciones || [],
      marcas: marcas || [],
      tipos: tipos || [],
      etiquetas: etiquetas || [],
      personajes: personajes || [],
      productos: encontrados,
      marcaActual: marcaId || undefined,
    }),
  ].filter(Boolean) : []), [hayResultados, encontrados, categorias, colecciones, marcas, tipos, etiquetas, personajes, marcaId]);

  // ── Buscar otra vez (el campo grande o una idea): conserva la marca y se
  // registra en la analítica, como desde la cabecera.
  const buscar = (texto) => {
    const limpio = String(texto || '').trim();
    const siguiente = {};
    if (limpio) {
      siguiente.q = limpio;
      try { trackSearchQuery(limpio, user).catch(() => {}); } catch { /* sin analítica */ }
    }
    if (marcaId) siguiente.brand = marcaId;
    setParams(siguiente);
  };

  // La tarjeta de la tienda; las 4 primeras cargan ya y la segunda foto sigue al admin.
  const TarjetaDeTienda = useMemo(() => function TarjetaDeTienda({ producto, indice, segundaFoto }) {
    return (
      <TarjetaDeProducto
        product={producto}
        categories={categorias || []}
        currentBrandId={marcaId || null}
        isAboveFold={indice != null && indice < 4}
        {...(segundaFoto != null ? { showHoverSecondaryMedia: segundaFoto } : {})}
      />
    );
  }, [categorias, marcaId]);
  const grilla = grillaDesdeConfiguracion(config.layout);

  const urlTodo = termino ? `/buscar?q=${encodeURIComponent(termino)}` : '/buscar';
  const catalogo = useMemo(() => ({ marcas: marcas || [], categorias: categorias || [], marcaActual: marcaId || null }), [marcas, categorias, marcaId]);

  return (
    <PaginaBusqueda
      termino={termino}
      onBuscar={buscar}
      productos={resultados}
      cargando={busqueda.cargando && busqueda.items.length === 0}
      hayMas={busqueda.hayMas}
      onCargarMas={cargarMas}
      cargandoMas={busqueda.cargando && busqueda.items.length > 0}
      grupos={grupos}
      seleccion={seleccion}
      onFiltrar={filtrar}
      orden={orden}
      onOrden={setOrden}
      ordenes={ORDENES_BUSQUEDA}
      marcaFiltro={marcaId ? { nombre: nombreMarca, urlTodo } : undefined}
      catalogo={catalogo}
      textos={config.searchPage || {}}
      ideas={(categorias || []).slice(0, 5).map((c) => c.name).filter(Boolean)}
      tarjeta={TarjetaDeTienda}
      columnas={grilla.columnas}
      segundaFoto={grilla.segundaFoto}
      // Un solo Kapi a la vista: con sesión ya está el flotante.
      sinKapi={Boolean(userProfile)}
      envolverMostrador={(nodo) => (
        <EditableSection sectionId="searchPage" currentConfig={config} label="Buscador">{nodo}</EditableSection>
      )}
    />
  );
}
