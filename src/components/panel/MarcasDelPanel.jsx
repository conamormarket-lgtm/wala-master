import React, { useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getBrands, createBrand, updateBrand, deleteBrand, ensureAllBrandLandings, dedupeBrandLandings } from '../../services/brands';
import { getMessage } from '../../services/messages';
import { getProducts, getProductsByBrand, setProductBrand } from '../../services/products';
import { tarjetaDesdeProducto } from '../../componentes/kit/adaptadores';
import { PaginaMarcas, PaginaProductosMarca } from '../../componentes/kit/paginas/admin/Marcas';
import { marcaDesdeFirestore, marcaAFirestore, marcaAdminDesdeFirestore, productoAdminDesde, WHATSAPP_PEDIDOS_FABRICA as WHATSAPP_FABRICA } from '../../componentes/kit/adaptadoresAdmin';
import { sinError, useLectura, useInvalidar, subirA } from './comun';


// CampoImagen pide la carpeta: el logo y la textura van donde iban.
const CARPETAS = { logos: subirA('brands/logos', 'logo'), fondos: subirA('brands/backgrounds', 'fondo') };
const subirImagen = (blob, opciones = {}) => (CARPETAS[opciones.carpeta] || CARPETAS.logos)(blob, opciones);

/** El texto del resultado de ensureAllBrandLandings (como lo decía AdminMarcas). */
function textoPlantilla(res) {
  const partes = [];
  if (res.creadas) partes.push(`${res.creadas} creada(s)`);
  if (res.actualizadas) partes.push(`${res.actualizadas} actualizada(s)`);
  if (res.conservadas) partes.push(`${res.conservadas} conservada(s) por estar editada(s) a mano: ${(res.conservadasNombres || []).join(', ')}`);
  if (res.alDia) partes.push(`${res.alDia} ya estaba(n) al día`);
  if (res.sinSlug) partes.push(`${res.sinSlug} sin slug`);
  if (res.portadas) partes.push(`${res.portadas} portada(s) pasada(s) al editor`);
  return `${res.total} marca(s). ${partes.join(' · ') || 'Todo ya estaba al día.'}`;
}

const productosConOcultos = () => getProducts([], null, null, { includeHidden: true });

/*
 * /admin/marcas (D1): PaginaMarcas con los servicios de AdminMarcas. La
 * vista previa de la tarjeta usa un producto de la marca que se edita
 * (getProductsByBrand, al abrir la hoja). "Sus productos" ahora tiene su
 * ruta: /admin/marcas/:id/productos.
 */
export default function MarcasDelPanel() {
  const navigate = useNavigate();
  const marcas = useLectura(['admin-brands'], getBrands);
  const invalidar = useInvalidar();
  const refrescar = () => invalidar(['admin-brands'], ['brands']);

  const whatsapp = useQuery({
    queryKey: ['admin-whatsapp-marcas-config'],
    queryFn: async () => {
      const [principal, multimarca] = await Promise.all([getMessage('whatsapp_number_principal'), getMessage('whatsapp_multimarca')]);
      return { principal: principal.data?.trim() || '', multimarca: multimarca.data === 'true', fabrica: WHATSAPP_FABRICA };
    },
  });

  // La muestra se pide al abrir una marca; muestraDe se llama al dibujar la
  // hoja, así que el pedido se anota después de ese dibujo.
  const [pedida, setPedida] = useState(null);
  const muestra = useQuery({
    queryKey: ['admin-marca-muestra', pedida],
    enabled: Boolean(pedida),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await getProductsByBrand(pedida);
      return (data || []).find((p) => p.mainImage || p.images?.length) || null;
    },
  });
  const muestraDe = (id) => {
    if (id !== pedida) { window.setTimeout(() => setPedida(id), 0); return null; }
    return muestra.data ? tarjetaDesdeProducto(muestra.data) : null;
  };

  return (
    <PaginaMarcas
      marcas={(marcas.datos || []).map(marcaDesdeFirestore)}
      cargando={marcas.cargando}
      error={marcas.error}
      onReintentar={marcas.onReintentar}
      onGuardar={async (datos, id) => {
        const doc = marcaAFirestore(datos);
        await sinError(id ? updateBrand(id, doc) : createBrand(doc));
        await refrescar();
      }}
      onEliminar={async (id) => { await sinError(deleteBrand(id)); await refrescar(); }}
      // Ordenar: se numeran 1, 2, 3… y solo se escriben las que cambian (updateBrand solo con order no toca la dirección).
      onGuardarOrden={async (ids) => {
        const antes = new Map((marcas.datos || []).map((m) => [m.id, m.order]));
        const cambian = ids.map((id, i) => [id, i + 1]).filter(([id, n]) => antes.get(id) !== n);
        await Promise.all(cambian.map(([id, order]) => sinError(updateBrand(id, { order }))));
        await refrescar();
      }}
      subirImagen={subirImagen}
      muestraDe={muestraDe}
      whatsapp={whatsapp.data || { principal: '', multimarca: false, fabrica: WHATSAPP_FABRICA }}
      cargandoWhatsapp={whatsapp.isLoading}
      urlWhatsapp="/admin/whatsapp"
      onProductos={(m) => navigate(`/admin/marcas/${m.id}/productos`)}
      onDisenar={(m) => navigate(`/${m.slug}?editar`)}
      onAplicarPlantilla={async () => {
        const res = await ensureAllBrandLandings({ force: false });
        if (res?.error) throw new Error(res.error);
        await refrescar();
        return textoPlantilla(res);
      }}
      onQuitarRepetidas={async () => {
        const res = await dedupeBrandLandings();
        if (res?.error) throw new Error(res.error);
        return res.eliminadas > 0 ? `Se eliminaron ${res.eliminadas} página(s) repetida(s).` : 'No había páginas repetidas.';
      }}
    />
  );
}

/*
 * /admin/marcas/:id/productos (D1): asignar o quitar productos de una marca.
 * Solo cambia brandId (setProductBrand, uno por uno, contando los que fallan),
 * como AdminMarcaProductos. Con adminCatalogoViejo, esta ruta vuelve a Marcas.
 */
export function ProductosDeMarcaDelPanel() {
  const { id } = useParams();
  const navigate = useNavigate();
  const marcas = useLectura(['admin-brands'], getBrands);
  const productos = useLectura(['admin-all-products-min'], productosConOcultos);
  const invalidar = useInvalidar();

  const marca = useMemo(() => (marcas.datos || []).map(marcaDesdeFirestore).find((m) => m.id === id), [marcas.datos, id]);
  if (!marcas.cargando && !marcas.error && !marca) return <Navigate to="/admin/marcas" replace />;

  const cambiar = async (ids, brandId) => {
    let ok = 0;
    let fallaron = 0;
    for (const productoId of ids) {
      const r = await setProductBrand(productoId, brandId);
      if (r?.error) fallaron += 1; else ok += 1;
    }
    await invalidar(['admin-brand-products', id], ['admin-all-products-min'], ['admin-products'], ['products']);
    return { ok, fallaron };
  };

  return (
    <PaginaProductosMarca
      marca={marca || { id, nombre: '', slug: '' }}
      marcas={(marcas.datos || []).map(marcaAdminDesdeFirestore)}
      productos={(productos.datos || []).map(productoAdminDesde).filter(Boolean)}
      cargando={marcas.cargando || productos.cargando}
      error={marcas.error || productos.error}
      onReintentar={() => { marcas.onReintentar(); productos.onReintentar(); }}
      onAsignar={(ids) => cambiar(ids, id)}
      onQuitar={(ids) => cambiar(ids, '')}
      urlCrear={`/admin/productos/nuevo?brandId=${id}`}
      onDisenar={(m) => navigate(`/${m.slug}?editar`)}
    />
  );
}
