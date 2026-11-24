import React, { useEffect, useMemo, useRef } from 'react';
import EditorDetallesProducto from '../../../componentes/kit/piezas/EditorDetallesProducto';
import { initialDetailComposition } from '../../../utils/productDetails.mjs';

export default function ProductSalesEditor({ form, productId, onChange, onBusyChange, onMount, onSubir, local = false, resolverMedia }) {
  const mount = useRef(onMount);
  useEffect(() => { mount.current?.(); }, []);
  const biblioteca = useMemo(() => {
    const urls = [...new Set((form.variants || []).flatMap(v => [v.imageUrl, ...(v.images || [])]).filter(Boolean))];
    return [...urls.map(url => ({ id: url, type: 'image', url, alt: form.name, caption: '' })), ...(form.videos || []).map(v => ({ type: 'video', url: v.url, alt: v.name || '', caption: '' }))];
  }, [form.variants, form.videos, form.name]);
  return <EditorDetallesProducto embedded local={local} resolverMedia={resolverMedia} productoId={productId} inicial={form.detailComposition || initialDetailComposition({ descripcion: form.description, imagenes: biblioteca.filter(m => m.type === 'image'), videos: (form.videos || []).map(v => ({ ...v, nombre: v.name })) })} biblioteca={biblioteca} onDraftChange={onChange} onBusyChange={onBusyChange} onSubir={onSubir || (async (file, options) => { const { uploadProductDetailMedia } = await import('../../../services/productDetailUpload'); return uploadProductDetailMedia(file, productId, options); })} />;
}
