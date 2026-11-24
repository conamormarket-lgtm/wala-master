import { useEffect, useRef, useState } from 'react';
import { readLocalProductDetails, saveLocalProductDetails, uploadLocalDetailMedia } from './productDetailsLocal.mjs';

export function useLocalProductDetails(productId) {
  const [state, setState] = useState({ productId: null, composition: null, ready: false, error: '' });
  const urls = useRef(new Map());
  const generation = useRef(0);
  useEffect(() => {
    const current = ++generation.current;
    let cancelled = false;
    const liveUrls = urls.current;
    setState({ productId, composition: null, ready: false, error: '' });
    readLocalProductDetails(productId).then(({ composition, assets }) => {
      if (cancelled || current !== generation.current) return;
      assets.forEach(asset => liveUrls.set(`local:${asset.id}`, URL.createObjectURL(asset.blob)));
      setState({ productId, composition, ready: true, error: '' });
    }).catch(e => { if (!cancelled && current === generation.current) setState({ productId, composition: null, ready: false, error: e.message }); });
    return () => { cancelled = true; generation.current += 1; liveUrls.forEach(url => URL.revokeObjectURL(url)); liveUrls.clear(); };
  }, [productId]);
  const guardar = async value => {
    const composition = await saveLocalProductDetails(productId, value);
    setState(old => old.productId === productId ? { ...old, composition } : old);
  };
  const subir = async (file, options) => {
    const current = generation.current;
    const media = await uploadLocalDetailMedia(productId, file, options);
    if (current !== generation.current) throw new Error('Se cambió de producto durante la subida.');
    urls.current.set(media.url, URL.createObjectURL(file));
    setState(old => ({ ...old }));
    return media;
  };
  return {
    composicion: state.productId === productId ? state.composition : null,
    error: state.error,
    editor: state.ready && state.productId === productId ? { local: true, guardar, subir, resolverMedia: url => url.startsWith('local:') ? urls.current.get(url) : url } : undefined,
  };
}
