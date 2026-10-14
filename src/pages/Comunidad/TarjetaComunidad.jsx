import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ImageOff, Paintbrush, Users } from 'lucide-react';
import { listarComunidad } from '../../services/comunidad';
import { fondoColorGuardado } from '../../utils/prendaBase';
import { useAlternarFotos } from '../../hooks/useAlternarFotos';
import { useAlVerUnaVez } from '../../hooks/useAlVerUnaVez';
import styles from '../cuenta/MisCreacionesPage.module.css';
import duo from '../Crear/TarjetaMiCombo.module.css';
import propios from './Comunidad.module.css';
import PuntosColor from '../Crear/PuntosColor';

/**
 * La galería (pública, sin sesión). Se vuelve a pedir cada vez que se muestra
 * (mientras, la de caché): con refetchOnMount: false global, una publicación
 * actualizada no se veía hasta recargar. El servidor ya la tiene en caché.
 */
export const useComunidad = () => useQuery({
  queryKey: ['comunidad'],
  queryFn: listarComunidad,
  staleTime: 60 * 1000,
  refetchOnMount: 'always',
});

/**
 * Abre el estudio con este diseño de punto de partida. Un combo abre su
 * página con todas sus prendas ya diseñadas, para personalizarlas.
 */
export const urlUsarDiseno = (d) => (d.tipo === 'combo'
  ? `/combo/${d.comboId}?plantilla=${d.id}`
  : `/crear/${d.productId}?plantilla=${d.id}`);

/**
 * Tarjeta de un diseño de la comunidad: el mismo lenguaje que las de Mis
 * creaciones (frente y espalda que alternan, prenda y color), con "Usar
 * diseño" en vez de comprar.
 */
const TarjetaComunidad = ({ diseno }) => {
  const mediaRef = useRef(null);
  const previas = (diseno.vistasPrevias || []).filter((p) => p?.url);
  const frente = previas[0]?.url || diseno.imagenConjunta || diseno.previewUrl || '';
  const espalda = previas[1]?.url || '';
  const esCombo = diseno.tipo === 'combo';
  // Un combo: cada prenda con su frente y su espalda (la espalda al pasar el
  // mouse, como en "Mi combo"). Cada pieza trae sus vistas previas.
  const fotosCombo = esCombo
    ? (diseno.piezas || []).map((p) => {
      const suyas = (p.vistasPrevias || []).filter((v) => v?.url);
      return { src: suyas[0]?.url || p.imagenConjunta || p.previewUrl || '', espalda: suyas[1]?.url || '' };
    }).filter((f) => f.src)
    : [];
  const hayEspalda = esCombo ? fotosCombo.some((f) => f.espalda) : Boolean(frente && espalda);
  // En el celular (sin mouse) frente y espalda alternan solas.
  const verEspalda = useAlternarFotos(mediaRef, hayEspalda);
  const visto = useAlVerUnaVez(mediaRef);
  const lados = previas.map((p) => p.nombre).filter(Boolean);
  const color = diseno.color?.nombre ? diseno.color : null;
  const url = urlUsarDiseno(diseno);

  return (
    <li className={styles.card}>
      <div ref={mediaRef} className={`${styles.media} ${verEspalda && !esCombo ? styles.mediaEspalda : ''}`}>
        <Link to={url} className={styles.foto} aria-label={`Usar el diseño ${diseno.nombre}`}>
          {esCombo && fotosCombo.length ? (
            <span className={`${duo.prendas} ${visto ? duo.saludo : ''} ${verEspalda ? duo.verDetras : ''}`} style={{ '--n': fotosCombo.length }}>
              {fotosCombo.map((f, i) => (
                <span key={`${f.src}-${i}`} className={duo.prenda}>
                  <img src={f.src} alt="" loading="lazy" />
                  {f.espalda && <img src={f.espalda} alt="" loading="lazy" className={duo.detras} />}
                </span>
              ))}
            </span>
          ) : frente ? (
            <>
              <img src={frente} alt={diseno.nombre} className={styles.fotoFrente} loading="lazy" />
              {espalda && <img src={espalda} alt="" aria-hidden="true" className={styles.fotoEspalda} loading="lazy" />}
            </>
          ) : (
            <span className={styles.fotoVacia}><ImageOff size={34} aria-hidden="true" /></span>
          )}
        </Link>
        {esCombo && (
          <div className={styles.insignias}>
            <span className={duo.insignia}>
              <Users size={12} strokeWidth={2.5} aria-hidden="true" /> Combo · {(diseno.piezas || []).length} prendas
            </span>
          </div>
        )}
        {!esCombo && frente && espalda && (
          <span className={styles.puntosFoto} aria-hidden="true">
            <span className={`${styles.puntoFoto} ${!verEspalda ? styles.puntoFotoActivo : ''}`} />
            <span className={`${styles.puntoFoto} ${verEspalda ? styles.puntoFotoActivo : ''}`} />
          </span>
        )}
        {!esCombo && lados.length > 0 && (
          <span className={styles.lados} title="Lados con diseño">{lados.join(' + ')}</span>
        )}
      </div>

      <div className={styles.info}>
        <h3 className={styles.nombre}>{diseno.nombre}</h3>
        <p className={styles.prenda}>
          {/* Un combo: el color de cada prenda (no solo el de la primera). */}
          {esCombo ? (
            <PuntosColor colores={(diseno.piezas || []).map((p) => p.color)} />
          ) : color?.hex && (
            <span className={styles.puntoColor} style={{ background: fondoColorGuardado(color) }} aria-hidden="true" />
          )}
          <span className={styles.prendaTexto}>
            {esCombo ? diseno.comboNombre || diseno.productName : [diseno.productName, color?.nombre].filter(Boolean).join(' · ')}
          </span>
        </p>
        {diseno.usos > 0 && (
          <p className={styles.fecha}>
            <Users size={12} aria-hidden="true" />
            {diseno.usos === 1 ? '1 persona lo usó' : `${diseno.usos} personas lo usaron`}
          </p>
        )}
        <div className={styles.pie}>
          <span className={propios.autor}>Por {diseno.autorNombre || 'Walá'}</span>
          <Link to={url} className={styles.botonPrincipal}>
            <Paintbrush size={15} aria-hidden="true" /> Usar diseño
          </Link>
        </div>
      </div>
    </li>
  );
};

export default TarjetaComunidad;
