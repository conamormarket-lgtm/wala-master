import React from 'react';
import { Shirt } from 'lucide-react';
import { EstadoVacio } from '../Feedback';
import { Sello } from '../Marca';
import { BloqueSeccion } from '../Seccion';
import { Cargando } from '../Cargando';
import { CARAS_KAPI } from '../piezas/Flotantes';
import s from './VerDiseno.module.css';

/*
 * Ver diseño (/ver/:id): el diseño que pidió un cliente, para quien abre el
 * enlace del WhatsApp (el asesor, sin sesión). Cada prenda con su color, su
 * talla y sus lados; un lado sin diseño se dice ("va liso"), para que no
 * parezca que falta la foto. Va dentro de MarcoTienda.
 */

/**
 * La página.
 *  - titulo · piezas: [{ prenda, nombre, color, colorHex, talla, lados:
 *    [{ nombre, url }] }] (verDisenoCompartido; url vacía = lado liso)
 *  - cargando · noDisponible
 */
export function PaginaVerDiseno({ titulo, piezas = [], cargando = false, noDisponible = false }) {
  if (cargando) {
    return <BloqueSeccion><Cargando texto="Cargando el diseño" bloque tamano="lg" /></BloqueSeccion>;
  }
  if (noDisponible || !piezas.length) {
    return (
      <BloqueSeccion ajustes={{ paddingTop: '2rem', paddingBottom: '2.5rem' }}>
        <div className={s.vacio}>
          <EstadoVacio imagen={CARAS_KAPI.triste} titulo="Este diseño no está disponible" texto="Solo se pueden ver por enlace los diseños que ya están en un pedido o publicados." />
        </div>
      </BloqueSeccion>
    );
  }
  const combo = piezas.length > 1;
  return (
    <BloqueSeccion ajustes={{ paddingTop: '1.5rem', paddingBottom: '2.5rem' }}>
      <div className={s.pagina} data-componente="PaginaVerDiseno">
        <header className={s.cabeza}>
          <span className={s.rotulo}>{combo ? `Combo · ${piezas.length} prendas` : 'Diseño del pedido'}</span>
          <h1 className={s.titulo}>{titulo || (combo ? 'Diseño del pedido' : piezas[0].nombre) || 'Diseño del pedido'}</h1>
        </header>
        <ol className={s.piezas}>
          {piezas.map((p, i) => (
            <li key={i} className={s.pieza}>
              <div className={s.datos}>
                <Sello tamano={40} girar={i % 2 ? 6 : -8}>{combo ? <b className={s.numero}>{i + 1}</b> : <Shirt aria-hidden="true" />}</Sello>
                <div>
                  <h2 className={s.prenda}>{p.prenda || p.nombre || `Prenda ${i + 1}`}</h2>
                  <p className={s.detalle}>
                    {p.color && (
                      <span className={s.color}>
                        {p.colorHex && <span className={s.punto} style={{ background: p.colorHex }} aria-hidden="true" />}
                        {p.color}
                      </span>
                    )}
                    {p.talla && <span className={s.talla}>Talla {p.talla}</span>}
                    {p.prenda && p.nombre && <span className={s.nombre}>«{p.nombre}»</span>}
                  </p>
                </div>
              </div>
              <div className={s.fotos}>
                {(p.lados || []).map((lado, k) => (lado.url ? (
                  <a key={k} href={lado.url} target="_blank" rel="noopener noreferrer" className={s.foto}>
                    <img src={lado.url} alt={`${p.prenda || p.nombre || 'Prenda'}: ${lado.nombre || 'diseño'}`} loading="lazy" />
                    {lado.nombre && <span className={s.lado}>{lado.nombre}</span>}
                  </a>
                ) : (
                  <div key={k} className={`${s.foto} ${s.liso}`}>
                    <span className={s.lado}>{lado.nombre}</span>
                    <span className={s.lisoTexto}><strong>Sin diseño</strong>Este lado va liso{p.color ? `, en ${p.color}` : ''}.</span>
                  </div>
                )))}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </BloqueSeccion>
  );
}
