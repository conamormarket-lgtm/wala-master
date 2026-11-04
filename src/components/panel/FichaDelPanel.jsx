import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { useAuth } from '../../contexts/AuthContext';
import { createProduct, updateProduct, getProduct, getProducts, generateProductId } from '../../services/products';
import { getBrands } from '../../services/brands';
import { getCategories, createCategory } from '../../services/categories';
import { getCollections, createCollection } from '../../services/collections';
import { getTags, createTag } from '../../services/tags';
import { getCharacters, createCharacter } from '../../services/characters';
import { getProductTypes, createProductType } from '../../services/productTypes';
import { getPrendasBase, getPrendasBaseAdmin } from '../../services/prendasBase';
import { getCombosCrear } from '../../services/combosCrear';
import { uploadFile } from '../../services/firebase/storage';
import { getDocument } from '../../services/firebase/firestore';
import { leerPlantillas, leerPrendaBase, prendaBaseParaGuardar } from '../../utils/prendaBase';
import {
  cambiarPlantillaDelProducto, quitarPlantillaDelProducto, traerPlantillas, fotoDeTiendaConPlantilla,
} from '../../pages/Crear/plantillasProducto';
import GenerarFrenteEspalda from '../../pages/Tienda/admin/GenerarFrenteEspalda';
import { PaginaFichaProducto } from '../../componentes/kit/paginas/admin/Ficha';
import { fichaDesdeProducto, fichaAProducto, productoAdminDesde, puedeVer } from '../../componentes/kit/adaptadoresAdmin';
import { SinPermiso } from '../../componentes/kit/piezas/admin/Marco';
import { logInventoryChange } from '../../services/inventoryLogs';
import { sinError, useInvalidar } from './comun';

/*
 * El editor de la descripción: solo lo que se ve igual en la web y en la app
 * de Android (rich-text.ts: párrafos, títulos, listas, negrita y cursiva).
 * Fuente, tamaño, color, subrayado y enlaces salieron el 2026-11-04: la app
 * no los muestra, la web los pintaba sin respetar el diseño ni el modo noche,
 * y ninguna descripción los usaba. `formats` también los quita al pegar.
 */
const MODULOS_QUILL = {
  toolbar: [
    [{ header: [2, 3, false] }],
    ['bold', 'italic'],
    [{ list: 'bullet' }, { list: 'ordered' }],
    ['clean'],
  ],
};
const FORMATOS_QUILL = ['header', 'bold', 'italic', 'list'];

// Cómo empieza el nombre del archivo según dónde se sube (los de siempre:
// la página de un combo busca "_frente-espalda." y el taller, "crear_").
const PREFIJOS = { principal: 'main', galeria: 'gallery', combo: 'combo_preview', crear: 'crear', tienda: 'tienda' };
const limpio = (n) => String(n || 'imagen').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9.-]+/g, '-');

/* Los borradores de un producto nuevo (localStorage wala_drafts), con la forma de
   siempre ({ draftId, form, updatedAt }) para que la lista de antes también los lea. */
const leerBorradores = () => { try { return JSON.parse(localStorage.getItem('wala_drafts') || '[]'); } catch { return []; } };
const escribirBorradores = (lista) => { try { localStorage.setItem('wala_drafts', JSON.stringify(lista)); } catch { /* sin localStorage */ } };
/** El `form` de un borrador (de esta ficha o de la de antes) → un producto para fichaDesdeProducto. */
const productoDeBorrador = (form = {}) => ({
  ...form,
  categories: Array.isArray(form.categories) ? form.categories : form.category ? [form.category] : [],
});

const conMarcas = (lista = []) => lista.map((x) => ({ id: x.id, nombre: x.name || x.id, marcas: Array.isArray(x.brandIds) ? x.brandIds : [] }));
const leer = (servicio) => async () => sinError(servicio());

/*
 * La ficha de un producto (D2b) o de un personalizable de Crear (D2c), lo
 * que hacía AdminProductoFormV2 (modo="prenda" para las de Crear):
 *  - Redirige como antes: una prenda abierta como producto va a su ficha de
 *    Crear, un pack de Crear a la lista de packs, y al revés.
 *  - Uno nuevo lleva su draftId en la dirección (?draftId=) y se guarda como
 *    borrador en el aparato mientras se escribe; al guardar, el borrador se va.
 *  - Las fotos van a productos_v2/{draftId}/ con el nombre de siempre y sus
 *    copias chicas (imagesVariantes); nunca se borra de Storage una foto.
 *  - Un personalizable relee sus plantillas al guardar (se cambian al
 *    momento desde su pestaña y desde el estudio: guardar no las pisa).
 * "Pasarla a Crear" no está todavía: pasar un producto de la tienda a Crear
 * lo saca de la app de Android (no muestra prendas de Crear); queda en la
 * ficha de antes hasta decidir cómo (guia/ADMIN.md, D2).
 */
export default function FichaDelPanel({ modo = 'producto' }) {
  const prenda = modo === 'prenda';
  const rutaLista = prenda ? '/admin/productos?ver=crear' : '/admin/productos';
  const { id } = useParams();
  const nuevo = !id || id === 'nueva' || id === 'nuevo';
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const invalidar = useInvalidar();
  const { user, adminPermissions } = useAuth();
  const params = new URLSearchParams(location.search);
  const urlDraftId = params.get('draftId');
  const urlBrandId = params.get('brandId') || '';
  const [draftId] = useState(() => urlDraftId || (nuevo ? generateProductId() : id));

  // Uno nuevo lleva su draftId en la dirección: al recargar sigue el mismo borrador.
  useEffect(() => {
    if (nuevo && !urlDraftId) {
      const q = new URLSearchParams(location.search);
      q.set('draftId', draftId);
      navigate({ search: q.toString() }, { replace: true });
    }
  }, [nuevo, urlDraftId, draftId]); // eslint-disable-line react-hooks/exhaustive-deps

  const productoQ = useQuery({ queryKey: ['admin-product', id], queryFn: leer(() => getProduct(id)), enabled: !nuevo });
  const producto = productoQ.data;
  const marcasQ = useQuery({ queryKey: ['admin-brands'], queryFn: leer(getBrands) });
  const categoriasQ = useQuery({ queryKey: ['admin-categories'], queryFn: leer(getCategories) });
  const coleccionesQ = useQuery({ queryKey: ['admin-collections'], queryFn: leer(getCollections) });
  const etiquetasQ = useQuery({ queryKey: ['admin-tags'], queryFn: leer(getTags) });
  const personajesQ = useQuery({ queryKey: ['admin-characters'], queryFn: leer(getCharacters) });
  const tiposQ = useQuery({ queryKey: ['admin-product-types'], queryFn: leer(getProductTypes) });
  const productosQ = useQuery({ queryKey: ['admin-products'], queryFn: leer(() => getProducts([], null, null, { includeHidden: true })), enabled: !prenda });
  const destinosQ = useQuery({
    queryKey: ['admin-personalizar-en'],
    enabled: !prenda,
    queryFn: async () => {
      const [prendas, combos] = await Promise.all([getPrendasBase({ incluirBorradores: true }), getCombosCrear({ incluirBorradores: true })]);
      return [
        ...(prendas.data || []).map((p) => ({ valor: `/crear/${p.id}`, texto: `${p.name || p.id} · Crear${p.visible === false ? ' (borrador)' : ''}` })),
        ...(combos.data || []).map((c) => ({ valor: `/combo/${c.id}`, texto: `${c.name || c.id} · pack de Crear${c.publicado ? '' : ' (borrador)'}` })),
      ];
    },
  });

  // Cada cosa en su ficha (como antes).
  useEffect(() => {
    if (!producto) return;
    if (!prenda && producto.esPrendaBase === true) navigate(`/admin/prendas-crear/${id}`, { replace: true });
    else if (!prenda && producto.esComboCrear === true) navigate('/admin/productos?ver=packs', { replace: true });
    else if (prenda && producto.esPrendaBase !== true) navigate(`/admin/productos/${id}`, { replace: true });
  }, [producto, prenda, id, navigate]);

  // Los datos de partida, una sola vez por producto (si cambiaran en cada
  // dibujo, la ficha volvería a empezar).
  const [inicial, setInicial] = useState(null);
  useEffect(() => {
    if (nuevo) {
      const borrador = urlDraftId && leerBorradores().find((d) => d.draftId === urlDraftId);
      setInicial(fichaDesdeProducto(borrador ? productoDeBorrador(borrador.form) : null, { prenda, marcaId: urlBrandId }));
    } else if (producto && !inicial) {
      setInicial(fichaDesdeProducto(producto, { prenda }));
    }
  }, [nuevo, producto]); // eslint-disable-line react-hooks/exhaustive-deps

  // Las copias chicas que dejó cada subida, por url: se guardan con la variante.
  const copias = useRef({});
  const subirImagen = async (blob, { alAvanzar, carpeta } = {}) => {
    alAvanzar?.(10);
    const nombre = limpio(blob?.name || `${carpeta || 'foto'}.${(blob?.type || 'image/png').split('/')[1] || 'png'}`);
    const archivo = blob instanceof File ? blob : new File([blob], nombre, { type: blob?.type || 'image/png' });
    const { url, variantes, error } = await uploadFile(archivo, `productos_v2/${draftId}/${PREFIJOS[carpeta] || 'gallery'}_${Date.now()}_${nombre}`);
    if (error || !url) throw new Error(typeof error === 'string' ? error : 'No se pudo subir la imagen.');
    if (variantes && Object.keys(variantes).length) copias.current[url] = variantes;
    alAvanzar?.(100);
    return url;
  };

  // Las plantillas del personalizable, como están en Firestore (se cambian al momento).
  const plantillasQ = useQuery({
    queryKey: ['admin-plantillas-prenda', id],
    enabled: prenda && !nuevo,
    queryFn: async () => leerPlantillas((await sinError(getDocument('productos_wala', id)))?.prendaBase?.plantillas),
  });
  const otrasQ = useQuery({
    queryKey: ['admin-prendas-crear', 'con-plantillas'],
    enabled: prenda && !nuevo,
    staleTime: 60_000,
    queryFn: leer(getPrendasBaseAdmin),
  });
  const refrescarPlantillas = () => invalidar(['admin-plantillas-prenda', id], ['prenda-base', id], ['prenda-base'], ['admin-prendas-crear']);
  const conPlantillas = (fn) => async (...args) => { await fn(...args); await refrescarPlantillas(); };

  const crudosPorId = useMemo(() => new Map((productosQ.data || []).map((p) => [p.id, p])), [productosQ.data]);
  const listas = [marcasQ, categoriasQ, coleccionesQ, etiquetasQ, personajesQ, tiposQ];
  const errorCarga = productoQ.error || listas.find((q) => q.error)?.error;

  // Crear una categoría (o colección, tipo…) desde la ficha, en la marca elegida.
  const CREAR = {
    categoria: { crear: createCategory, claves: [['admin-categories'], ['categories']], conMarca: true },
    coleccion: { crear: createCollection, claves: [['admin-collections'], ['collections']], conMarca: true },
    tipo: { crear: createProductType, claves: [['admin-product-types'], ['productTypes']], conMarca: false },
    personaje: { crear: createCharacter, claves: [['admin-characters'], ['characters']], conMarca: true },
    etiqueta: { crear: createTag, claves: [['admin-tags'], ['tags']], conMarca: true },
  };

  const guardar = async (datos) => {
    // Las copias de lo que se subió en esta sesión viajan con su variante.
    const conCopias = {
      ...datos,
      variantes: datos.variantes.map((v) => ({
        ...v,
        copias: Object.fromEntries([v.foto, ...v.galeria].filter((u) => copias.current[u]).map((u) => [u, copias.current[u]])),
      })),
    };
    // Las plantillas: las de Firestore, no las de cuando se abrió la ficha.
    if (prenda && !nuevo) {
      const actual = await sinError(getDocument('productos_wala', id));
      conCopias.prenda = { ...conCopias.prenda, plantillas: actual?.prendaBase?.plantillas || [] };
    }
    const doc = fichaAProducto(conCopias, nuevo ? {} : producto || {}, { prendaBaseParaGuardar });
    await sinError(nuevo ? createProduct(doc, draftId) : updateProduct(id, doc));
    // El stock cambiado aquí también queda en el historial (como en la lista).
    const stockDe = (v) => (v === undefined || v === null || v === '' ? null : Number(v));
    if (!nuevo && producto && stockDe(producto.inStock) !== stockDe(doc.inStock)) {
      await logInventoryChange(id, doc.name || producto.name || id, stockDe(producto.inStock), stockDe(doc.inStock), user?.email || 'Admin');
    }
    escribirBorradores(leerBorradores().filter((d) => d.draftId !== draftId));
    await Promise.all([
      queryClient.refetchQueries({ queryKey: ['admin-products'] }),
      !nuevo && queryClient.refetchQueries({ queryKey: ['admin-product', id] }),
      invalidar(['products'], ['products-infinite'], ['product', id], ['featured-products'], ['collection-products']),
      queryClient.invalidateQueries({ queryKey: ['admin-prendas-crear'], refetchType: 'all' }),
      queryClient.invalidateQueries({ queryKey: ['prendas-base'], refetchType: 'all' }),
      queryClient.invalidateQueries({ queryKey: ['prenda-base'], refetchType: 'all' }),
    ].filter(Boolean));
    navigate(rutaLista);
  };

  const marcaDe = (marcaId) => (marcasQ.data || []).find((m) => m.id === marcaId) || null;
  const desde = `${location.pathname}?pestana=plantillas`;

  // La ficha es de quien edita productos: quien solo tiene inventario cambia
  // el stock en la lista (/admin/productos ya le abre por eso).
  if (!puedeVer({ permiso: ['manage_products'] }, adminPermissions || [])) return <SinPermiso permiso="Catálogo" />;

  return (
    <PaginaFichaProducto
      inicial={inicial}
      nuevo={nuevo}
      cargando={!inicial && !errorCarga}
      error={errorCarga ? errorCarga.message || 'No se pudo cargar el producto.' : undefined}
      onReintentar={() => { productoQ.refetch(); listas.forEach((q) => q.refetch()); }}
      marcas={(marcasQ.data || []).map((m) => ({ id: m.id, nombre: m.name || m.id, logo: m.logoUrl || '', whatsapp: m.whatsappNumber || '' }))}
      categorias={conMarcas(categoriasQ.data)}
      colecciones={conMarcas(coleccionesQ.data)}
      tipos={conMarcas(tiposQ.data)}
      personajes={conMarcas(personajesQ.data)}
      etiquetas={conMarcas(etiquetasQ.data)}
      onCrear={async (lista, { nombre, marcaId }) => {
        const c = CREAR[lista];
        const r = await c.crear({ name: String(nombre || '').trim(), ...(c.conMarca && { brandIds: marcaId ? [marcaId] : [] }) });
        if (r?.error) throw new Error(r.error);
        await invalidar(...c.claves);
        return { id: r.data?.id || r.id, nombre: String(nombre || '').trim() };
      }}
      productos={(productosQ.data || []).filter((p) => p.id !== id).map(productoAdminDesde).filter(Boolean)}
      equipos={[...new Set((productosQ.data || []).filter((p) => p.deleted !== true).map((p) => String(p.equipo || '').trim()).filter(Boolean))]}
      coloresDe={(productoId) => (crudosPorId.get(productoId)?.variants || []).map((v) => ({ nombre: v.name, foto: v.imageUrl }))}
      destinosCrear={destinosQ.data || []}
      subirImagen={subirImagen}
      onGuardar={guardar}
      onVolver={() => navigate(rutaLista)}
      onBorrador={nuevo ? (datos) => {
        const form = { ...fichaAProducto(datos), category: datos.categoria || '' };
        escribirBorradores([...leerBorradores().filter((d) => d.draftId !== draftId), { draftId, form, updatedAt: new Date().toISOString() }]);
      } : undefined}
      // Solo lo que escribe una persona: al abrir, Quill pasa un texto plano a su
      // formato (<p>…</p>) y avisaba "Cambios sin guardar" sin haber tocado nada.
      descripcion={(valor, onCambiar) => <ReactQuill theme="snow" value={valor || ''} onChange={(html, _cambio, origen) => { if (origen === 'user') onCambiar(html); }} modules={MODULOS_QUILL} formats={FORMATOS_QUILL} placeholder="Cuenta qué es, de qué está hecho y para quién es." />}
      extraGaleria={prenda ? undefined : (variante, agregar) => (
        <GenerarFrenteEspalda
          variante={{ id: variante.id, imageUrl: variante.foto, images: variante.galeria, thumbnailCrop: variante.encuadre, imagesCrops: variante.encuadres }}
          marca={marcaDe(inicial?.marcaId)}
          nombreProducto={inicial?.nombre || ''}
          onGuardar={async (blob) => agregar(await subirImagen(new File([blob], 'frente-espalda.png', { type: 'image/png' }), { carpeta: 'galeria' }))}
        />
      )}
      pestanaInicial={params.get('pestana') || 'general'}
      onPestana={(p) => { const q = new URLSearchParams(window.location.search); q.set('pestana', p); navigate({ search: q.toString() }, { replace: true }); }}
      fotoConPlantilla={prenda ? (color, plantilla, { vistas, laser } = {}) => fotoDeTiendaConPlantilla({ prendaId: draftId, cfg: { vistas, laser }, color, plantilla }) : undefined}
      plantillas={prenda && !nuevo ? plantillasQ.data : undefined}
      accionesPlantillas={prenda && !nuevo && user ? {
        onRenombrar: conPlantillas((pid, nombre) => cambiarPlantillaDelProducto(id, pid, { nombre })),
        onGrupo: conPlantillas((pid, grupo) => cambiarPlantillaDelProducto(id, pid, { grupo })),
        onQuitar: conPlantillas((pid) => quitarPlantillaDelProducto(id, pid)),
        otras: (otrasQ.data || []).filter((p) => p.id !== id)
          .map((p) => ({ id: p.id, nombre: p.name || p.id, plantillas: leerPlantillas(p.prendaBase?.plantillas) }))
          .filter((p) => p.plantillas.length),
        onTraer: conPlantillas(async (origenId, ids) => {
          const actual = await sinError(getDocument('productos_wala', id));
          if (!actual) throw new Error('Guarda el producto antes de traer plantillas.');
          const cfg = leerPrendaBase(actual);
          const origen = (otrasQ.data || []).find((p) => p.id === origenId);
          const { traidas } = await traerPlantillas({
            destinoId: id,
            destino: { vistas: cfg.vistas, colores: cfg.colores, laser: cfg.tecnica === 'laser' },
            plantillas: leerPlantillas(origen?.prendaBase?.plantillas).filter((p) => ids.includes(p.id)),
          });
          if (!traidas) throw new Error('Ninguna encaja en las zonas de este producto.');
        }),
        urlNueva: `/crear/${id}?nuevaPlantilla=1`,
        urlEditar: (pid) => `/crear/${id}?editarPlantilla=${encodeURIComponent(pid)}`,
        estadoEnlace: { desde },
      } : {}}
    />
  );
}
