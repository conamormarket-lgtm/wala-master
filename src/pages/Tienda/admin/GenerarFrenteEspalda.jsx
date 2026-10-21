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
 * Los nombres de las dos fotos (principal, segunda). Hay productos con las
 * fotos al revés (la principal es la espalda) y otros cuya segunda foto no es
 * la espalda (un jogger de lado): para esos, sin nombres.
 */
const NOMBRES = [
  { id: 'frente', texto: 'Frente / Espalda', etiquetas: ['FRENTE', 'ESPALDA'] },
  { id: 'invertido', texto: 'Espalda / Frente', etiquetas: ['ESPALDA', 'FRENTE'] },
  { id: 'ninguno', texto: 'Sin nombres', etiquetas: [null, null] },
];

/**
 * "Generar frente y espalda": junta la foto principal y la segunda (la
 * primera de la galería) en una tercera imagen cuadrada con el sello de Walá.
 * La principal va a la izquierda; sus nombres son FRENTE y ESPALDA, al revés
 * o ninguno. El fondo es el de Walá o, si se elige, el de la marca (los
 * colores de su portada). Primero se ve la vista previa; al guardarla se
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
  const [nombres, setNombres] = useState('frente');

  useEffect(() => {
    let vigente = true;
    setFondoMarca(null);
    setConFondoMarca(false);
    fondoDeMarca(marca).then((f) => { if (vigente) setFondoMarca(f); }).catch(() => {});
    return () => { vigente = false; };
  }, [marca]);

  const principal = variante?.imageUrl || '';
  const segunda = variante?.images?.[0] || '';
  const falta = !principal && !segunda
    ? 'Faltan las dos fotos: sube la imagen principal y una foto en la galería.'
    : !principal
      ? 'Falta la imagen principal.'
      : !segunda
        ? 'Falta la segunda imagen: súbela como primera foto de la galería.'
        : '';

  // La vista previa es de un par de fotos y una marca: si cambian, ya no vale.
  const clave = `${principal}|${segunda}|${marca?.id || ''}|${variante?.id || ''}`;
  useEffect(() => { setVista(null); setError(''); }, [clave]);
  useEffect(() => () => { if (vista) URL.revokeObjectURL(vista.url); }, [vista]);

  // Con la vista previa abierta, cambiar el fondo o los nombres la rehace.
  const generar = async ({ usarMarca = conFondoMarca, conNombres = nombres } = {}) => {
    setGenerando(true);
    setError('');
    try {
      const blob = await componerFrenteEspalda({
        principal: { url: principal, recorte: variante.thumbnailCrop?.percentages },
        segunda: { url: segunda, recorte: variante.imagesCrops?.[segunda]?.percentages },
        etiquetas: NOMBRES.find((n) => n.id === conNombres).etiquetas,
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
            onClick={() => { setConFondoMarca(false); if (vista) generar({ usarMarca: false }); }}
          >
            Walá
          </Chip>
          <Chip
            tamano="sm"
            activo={conFondoMarca}
            icono={<i className={s.muestra} style={muestraDe(fondoMarca)} />}
            onClick={() => { setConFondoMarca(true); if (vista) generar({ usarMarca: true }); }}
          >
            {marca.name || 'La marca'}
          </Chip>
        </div>
      )}

      {!falta && (
        <div className={s.fondos} role="group" aria-label="Nombres">
          <span className={s.fondosTitulo}>Nombres</span>
          {NOMBRES.map((n) => (
            <Chip
              key={n.id}
              tamano="sm"
              activo={nombres === n.id}
              onClick={() => { setNombres(n.id); if (vista) generar({ conNombres: n.id }); }}
            >
              {n.texto}
            </Chip>
          ))}
          <span className={s.ayuda}>La principal va a la izquierda.</span>
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
          <img src={vista.url} alt="Vista previa de la imagen con las dos fotos" className={s.imagen} />
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
