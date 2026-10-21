import React, { useEffect, useState } from 'react';
import { Layers, Check, RotateCcw, X } from 'lucide-react';
import Boton from '../../../componentes/kit/Boton';
import { Sello } from '../../../componentes/kit/Marca';
import { Chip } from '../../../componentes/kit/Etiquetas';
import { componerFrenteEspalda, fondoDeMarca } from './frenteEspalda';
import s from './GenerarFrenteEspalda.module.css';

/** La muestra de un fondo en su chip: el degradado de la marca o su imagen. */
const muestraDe = (fondo) => (fondo?.imagen
  ? { backgroundImage: `url(${fondo.imagen})`, backgroundColor: fondo.color }
  : { background: `linear-gradient(135deg, ${fondo.color}, ${fondo.color2 || fondo.color})` });

/**
 * "Generar frente y espalda": junta la foto principal (frente) y la segunda
 * (la primera de la galería, la espalda) en una tercera imagen cuadrada con
 * el sello de Walá. El fondo es el de Walá o, si se elige, el de la marca
 * (los colores de su portada). Primero se ve la vista previa; al guardarla se
 * sube como una foto más de la galería, sin tocar las dos originales.
 *  - variante: la variante activa (imageUrl, images, thumbnailCrop, imagesCrops)
 *  - marca: el doc de tienda_brands del producto, o null
 *  - onGuardar(blob): sube la imagen y la agrega a la galería (async)
 *  - ocupado: otra subida en curso
 */
export default function GenerarFrenteEspalda({ variante, marca, onGuardar, ocupado = false }) {
  const [vista, setVista] = useState(null); // { blob, url }
  const [generando, setGenerando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  // El fondo de la marca (null si no tiene colores propios) y el elegido.
  const [fondoMarca, setFondoMarca] = useState(null);
  const [conFondoMarca, setConFondoMarca] = useState(false);

  useEffect(() => {
    let vigente = true;
    setFondoMarca(null);
    setConFondoMarca(false);
    fondoDeMarca(marca).then((f) => { if (vigente) setFondoMarca(f); }).catch(() => {});
    return () => { vigente = false; };
  }, [marca]);

  const frente = variante?.imageUrl || '';
  const espalda = variante?.images?.[0] || '';
  const falta = !frente && !espalda
    ? 'Faltan las dos fotos: sube la imagen principal (el frente) y una foto en la galería (la espalda).'
    : !frente
      ? 'Falta la imagen principal (el frente).'
      : !espalda
        ? 'Falta la segunda imagen (la espalda): súbela como primera foto de la galería.'
        : '';

  // La vista previa es de un par de fotos y una marca: si cambian, ya no vale.
  const clave = `${frente}|${espalda}|${marca?.id || ''}|${variante?.id || ''}`;
  useEffect(() => { setVista(null); setError(''); }, [clave]);
  useEffect(() => () => { if (vista) URL.revokeObjectURL(vista.url); }, [vista]);

  const generar = async (usarMarca = conFondoMarca) => {
    setGenerando(true);
    setError('');
    try {
      const blob = await componerFrenteEspalda({
        frente: { url: frente, recorte: variante.thumbnailCrop?.percentages },
        espalda: { url: espalda, recorte: variante.imagesCrops?.[espalda]?.percentages },
        marca,
        fondo: usarMarca ? fondoMarca : null,
      });
      setVista({ blob, url: URL.createObjectURL(blob) });
    } catch (e) {
      setError(e?.message || 'No se pudo generar la imagen.');
    } finally {
      setGenerando(false);
    }
  };

  const guardar = async () => {
    if (!vista) return;
    setGuardando(true);
    setError('');
    try {
      await onGuardar(vista.blob);
      setVista(null);
    } catch (e) {
      setError(e?.message || 'No se pudo guardar la imagen.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className={s.caja}>
      <div className={s.cabeza}>
        <Sello tamano={36}><Layers /></Sello>
        <div>
          <p className={s.titulo}>Imagen frente y espalda</p>
          <p className={s.texto}>
            Junta la imagen principal y la segunda en una sola imagen cuadrada, como la foto de la ficha, con el sello de Walá{marca?.name ? <> y <b>{marca.name}</b></> : ''}. Se agrega a la galería; las originales no cambian.
          </p>
        </div>
      </div>

      {!falta && fondoMarca && (
        <div className={s.fondos} role="group" aria-label="Fondo">
          <span className={s.fondosTitulo}>Fondo</span>
          <Chip
            tamano="sm"
            activo={!conFondoMarca}
            icono={<i className={`${s.muestra} ${s.muestraWala}`} />}
            onClick={() => { setConFondoMarca(false); if (vista) generar(false); }}
          >
            Walá
          </Chip>
          <Chip
            tamano="sm"
            activo={conFondoMarca}
            icono={<i className={s.muestra} style={muestraDe(fondoMarca)} />}
            onClick={() => { setConFondoMarca(true); if (vista) generar(true); }}
          >
            {marca.name || 'La marca'}
          </Chip>
        </div>
      )}

      {falta ? (
        <p className={s.falta}>{falta}</p>
      ) : !vista ? (
        <Boton icono={<Layers size={16} />} onClick={() => generar()} cargando={generando} disabled={ocupado}>
          {generando ? 'Generando…' : 'Generar frente y espalda'}
        </Boton>
      ) : (
        <div className={s.previa}>
          <img src={vista.url} alt="Vista previa de la imagen frente y espalda" className={s.imagen} />
          <div className={s.acciones}>
            <Boton icono={<Check size={16} />} onClick={guardar} cargando={guardando} disabled={ocupado}>
              Guardar en la galería
            </Boton>
            <Boton variante="secundario" icono={<RotateCcw size={16} />} onClick={() => generar()} disabled={guardando || generando}>
              Volver a generar
            </Boton>
            <Boton variante="fantasma" icono={<X size={16} />} onClick={() => setVista(null)} disabled={guardando}>
              Descartar
            </Boton>
          </div>
        </div>
      )}

      {error && <p className={s.error} role="alert">{error}</p>}
    </div>
  );
}
