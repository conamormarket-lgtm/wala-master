import React, { useEffect, useRef, useState } from 'react';
import { Layers, Check, RotateCcw, X, Pencil } from 'lucide-react';
import Boton from '../../../componentes/kit/Boton';
import { Sello } from '../../../componentes/kit/Marca';
import { Chip } from '../../../componentes/kit/Etiquetas';
import { Campo } from '../../../componentes/kit/Formulario';
import { componerFrenteEspalda, fondoDeMarca } from './frenteEspalda';
import s from './GenerarFrenteEspalda.module.css';

/** La muestra de un fondo en su chip: el degradado de la marca o su imagen. */
const muestraDe = (fondo) => (fondo?.imagen
  ? { backgroundImage: `url(${fondo.imagen})`, backgroundColor: fondo.color }
  : { background: `linear-gradient(135deg, ${fondo.color}, ${fondo.color2 || fondo.color})` });

/**
 * Los nombres de las dos fotos (principal, segunda). Hay productos con las
 * fotos al revés (la principal es la espalda), prendas de abajo, que no
 * tienen espalda (un jogger: delante y atrás), y lo que no encaje se escribe
 * a mano ("Escribir"; un nombre vacío deja esa foto sin etiqueta).
 */
const NOMBRES = [
  { id: 'frente', texto: 'Frente / Espalda', etiquetas: ['FRENTE', 'ESPALDA'] },
  { id: 'invertido', texto: 'Espalda / Frente', etiquetas: ['ESPALDA', 'FRENTE'] },
  { id: 'delante', texto: 'Delante / Atrás', etiquetas: ['DELANTE', 'ATRÁS'] },
  { id: 'escribir', texto: 'Escribir' },
];

const LARGO_NOMBRE = 16;

/** Prendas de abajo: su segunda foto es "atrás", no "espalda". */
const esDeAbajo = (nombre) => /jogger|pantal[oó]n|buzo|short|bermuda|legging|falda/i.test(String(nombre || ''));

/**
 * "Generar frente y espalda": junta la foto principal y la segunda (la
 * primera de la galería) en una tercera imagen cuadrada con el sello de Walá.
 * La principal va a la izquierda; sus nombres son FRENTE y ESPALDA, al revés
 * o ninguno. El fondo es el de Walá o, si se elige, el de la marca (los
 * colores de su portada). Primero se ve la vista previa; al guardarla se
 * sube como una foto más de la galería, sin tocar las dos originales.
 *  - variante: la variante activa (imageUrl, images, thumbnailCrop, imagesCrops)
 *  - marca: el doc de tienda_brands del producto, o null
 *  - nombreProducto: para empezar en "Delante / Atrás" si es un jogger o pantalón
 *  - onGuardar(blob): sube la imagen y la agrega a la galería (async)
 *  - ocupado: otra subida en curso
 */
export default function GenerarFrenteEspalda({ variante, marca, nombreProducto = '', onGuardar, ocupado = false }) {
  const [vista, setVista] = useState(null); // { blob, url }
  const [generando, setGenerando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  // El fondo de la marca (null si no tiene colores propios) y el elegido.
  const [fondoMarca, setFondoMarca] = useState(null);
  const [conFondoMarca, setConFondoMarca] = useState(false);
  const deAbajo = esDeAbajo(nombreProducto);
  const [nombres, setNombres] = useState(deAbajo ? 'delante' : 'frente');
  const [escritos, setEscritos] = useState(['', '']);
  useEffect(() => { setNombres(deAbajo ? 'delante' : 'frente'); }, [deAbajo]);

  const etiquetasDe = (id, textos = escritos) => (id === 'escribir'
    ? textos.map((t) => t.trim().toUpperCase() || null)
    : NOMBRES.find((n) => n.id === id).etiquetas);

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

  // Cada vista previa sabe con qué nombres y fondo se hizo (`hecha`); solo la
  // última pedida se muestra, así una que termina tarde no pisa a otra.
  const ultima = useRef(0);
  const espera = useRef(null);
  const pedidoDe = ({ usarMarca = conFondoMarca, conNombres = nombres, conEscritos = escritos } = {}) => ({
    usarMarca,
    etiquetas: etiquetasDe(conNombres, conEscritos),
  });
  const hechaCon = (pedido) => JSON.stringify(pedido);

  // Con la vista previa abierta, cambiar el fondo o los nombres la rehace.
  const generar = async (opciones) => {
    const pedido = pedidoDe(opciones);
    const numero = ++ultima.current;
    setGenerando(true);
    setError('');
    try {
      const blob = await componerFrenteEspalda({
        principal: { url: principal, recorte: variante.thumbnailCrop?.percentages },
        segunda: { url: segunda, recorte: variante.imagesCrops?.[segunda]?.percentages },
        etiquetas: pedido.etiquetas,
        marca,
        fondo: pedido.usarMarca ? fondoMarca : null,
      });
      if (numero === ultima.current) setVista({ blob, url: URL.createObjectURL(blob), hecha: hechaCon(pedido) });
      return blob;
    } catch (e) {
      setError(e?.message || 'No se pudo generar la imagen.');
      return null;
    } finally {
      if (numero === ultima.current) setGenerando(false);
    }
  };

  // Lo escrito se ve en la vista previa al dejar de teclear un momento.
  const escribir = (k, texto) => {
    const nuevos = escritos.map((v, i) => (i === k ? texto : v));
    setEscritos(nuevos);
    window.clearTimeout(espera.current);
    if (vista) espera.current = window.setTimeout(() => generar({ conEscritos: nuevos }), 600);
  };
  useEffect(() => () => window.clearTimeout(espera.current), []);

  const guardar = async () => {
    if (!vista) return;
    setGuardando(true);
    setError('');
    try {
      // Si la vista previa quedó atrás de lo elegido (se guardó mientras se
      // escribía), se rehace antes de subirla: se guarda lo que se eligió.
      window.clearTimeout(espera.current);
      const blob = vista.hecha === hechaCon(pedidoDe()) ? vista.blob : await generar();
      if (!blob) return;
      await onGuardar(blob);
      ultima.current += 1;
      setVista(null);
      setGenerando(false);
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
              icono={n.id === 'escribir' ? <Pencil size={14} /> : undefined}
              onClick={() => {
                // Al pasar a escribir, se parte de los nombres que había.
                if (n.id === 'escribir' && nombres !== 'escribir') setEscritos(etiquetasDe(nombres).map((t) => t || ''));
                setNombres(n.id);
                if (vista && n.id !== 'escribir') generar({ conNombres: n.id });
              }}
            >
              {n.texto}
            </Chip>
          ))}
          <span className={s.ayuda}>La principal va a la izquierda.</span>
        </div>
      )}

      {!falta && nombres === 'escribir' && (
        <div className={s.escritos}>
          {['Foto de la izquierda (principal)', 'Foto de la derecha'].map((etiqueta, k) => (
            <Campo
              key={etiqueta}
              etiqueta={etiqueta}
              value={escritos[k]}
              maxLength={LARGO_NOMBRE}
              placeholder="Vacío: sin nombre"
              onChange={(e) => escribir(k, e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); window.clearTimeout(espera.current); generar(); } }}
            />
          ))}
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
