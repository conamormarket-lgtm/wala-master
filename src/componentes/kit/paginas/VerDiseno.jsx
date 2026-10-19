import React, { useState } from 'react';
import { Shirt, ZoomIn, Copy, Check, ExternalLink } from 'lucide-react';
import Boton from '../Boton';
import { EstadoVacio, HojaInferior } from '../Feedback';
import { Sello, Trazo } from '../Marca';
import { BloqueSeccion } from '../Seccion';
import { EsqueletoPagina } from '../Esqueletos';
import { CARAS_KAPI } from '../piezas/Flotantes';
import { FotoProducto } from '../piezas/FotoProducto';
import { Texto, useTexto } from '../Traduccion';
import s from './VerDiseno.module.css';

/*
 * Ver diseño (/ver/:id): el diseño que pidió un cliente, para quien abre el
 * enlace del WhatsApp (el asesor, sin sesión). Cada prenda con su color, su
 * talla y sus lados; un lado sin diseño se dice ("va liso", con su color),
 * para que no parezca que falta la foto. Una foto se ve en grande al tocarla
 * y "Copiar resumen" deja el pedido en texto (para el ERP o el WhatsApp).
 * Va dentro de MarcoTienda. Los textos de la página pasan por la
 * traducción; el resumen que se copia queda en español (es para el ERP).
 */

/** El pedido en texto: una línea por prenda (prenda · color · talla · nombre · lados). */
export const resumenDeDiseno = (titulo, piezas = []) => {
  const lineas = piezas.map((p, i) => {
    const conDiseno = (p.lados || []).filter((l) => l.url).map((l) => l.nombre).filter(Boolean);
    const lisos = (p.lados || []).filter((l) => !l.url).map((l) => `${l.nombre || 'Un lado'} sin diseño`);
    return [
      `${piezas.length > 1 ? `${i + 1}. ` : ''}${p.prenda || p.nombre || `Prenda ${i + 1}`}`,
      p.color,
      p.talla && `Talla ${p.talla}`,
      p.prenda && p.nombre && `«${p.nombre}»`,
      [conDiseno.join(' y '), ...lisos].filter(Boolean).join(', '),
    ].filter(Boolean).join(' · ');
  });
  const cabeza = piezas.length > 1 ? `${titulo || 'Diseño del pedido'} (combo de ${piezas.length})` : titulo || 'Diseño del pedido';
  return [cabeza, ...lineas].join('\n');
};

/**
 * La página.
 *  - titulo · piezas: [{ prenda, nombre, color, colorHex, talla, lados:
 *    [{ nombre, url }] }] (verDisenoCompartido; url vacía = lado liso)
 *  - cargando · noDisponible
 */
export function PaginaVerDiseno({ titulo, piezas = [], cargando = false, noDisponible = false }) {
  const [ver, setVer] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const t = {
    rotulo: useTexto(piezas.length > 1 ? `Combo · ${piezas.length} prendas` : 'Diseño del pedido'),
    verGrande: useTexto('Ver en grande'),
    diseno: useTexto('diseño'),
  };

  if (cargando) {
    return <EsqueletoPagina forma="verDiseno" />;
  }
  if (noDisponible || !piezas.length) {
    return (
      <BloqueSeccion ajustes={{ paddingTop: '2rem', paddingBottom: '2.5rem' }}>
        <div className={s.vacio}>
          <EstadoVacio imagen={CARAS_KAPI.triste} titulo={<Texto>Este diseño no está disponible</Texto>} texto={<Texto>Solo se pueden ver por enlace los diseños que ya están en un pedido o publicados.</Texto>} />
        </div>
      </BloqueSeccion>
    );
  }
  const combo = piezas.length > 1;
  const nombre = titulo || (combo ? 'Diseño del pedido' : piezas[0].nombre) || 'Diseño del pedido';
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(resumenDeDiseno(nombre, piezas));
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 1800);
    } catch { /* sin portapapeles: los datos quedan a la vista */ }
  };

  return (
    <BloqueSeccion ajustes={{ paddingTop: '1.5rem', paddingBottom: '2.5rem' }}>
      <div className={s.pagina} data-componente="PaginaVerDiseno">
        <header className={s.cabeza}>
          <div>
            <span className={s.rotulo}>{t.rotulo}</span>
            <h1 className={s.titulo}>{nombre}<Trazo className={s.trazo} /></h1>
          </div>
          <Boton variante="contorno" tamano="sm" icono={copiado ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />} onClick={copiar}>
            <Texto>{copiado ? 'Copiado' : 'Copiar resumen'}</Texto>
          </Boton>
        </header>

        <ol className={[s.piezas, combo && s.piezasCombo].filter(Boolean).join(' ')}>
          {piezas.map((p, i) => {
            const prenda = p.prenda || p.nombre || `Prenda ${i + 1}`;
            // Una sola prenda, o la última de un número impar (3, 5…): a lo
            // ancho, con sus datos a un lado y los lados al otro (sin medio vacío).
            const ancha = !combo || (piezas.length % 2 === 1 && i === piezas.length - 1);
            return (
              <li key={i} className={[s.pieza, ancha && s.piezaAncha].filter(Boolean).join(' ')}>
                <div className={s.datos}>
                  <Sello tamano={40} girar={i % 2 ? 6 : -8}>{combo ? <b className={s.numero}>{i + 1}</b> : <Shirt aria-hidden="true" />}</Sello>
                  <div className={s.datosTexto}>
                    <h2 className={s.prenda}>{prenda}</h2>
                    <p className={s.detalle}>
                      {p.color && (
                        <span className={s.color}>
                          {p.colorHex && <span className={s.punto} style={{ background: p.colorHex }} aria-hidden="true" />}
                          <Texto>{p.color}</Texto>
                        </span>
                      )}
                      {p.talla && <span className={s.talla}><Texto>Talla</Texto> {p.talla}</span>}
                    </p>
                    {p.prenda && p.nombre && <p className={s.nombre}>«{p.nombre}»</p>}
                  </div>
                </div>
                <div className={s.fotos}>
                  {(p.lados || []).map((lado, k) => (lado.url ? (
                    <button key={k} type="button" className={s.foto} onClick={() => setVer({ prenda, lado })} aria-label={`${t.verGrande}: ${prenda}, ${lado.nombre || t.diseno}`}>
                      <FotoProducto className={s.fotoImagen} src={lado.url} alt={`${prenda}: ${lado.nombre || 'diseño'}`} />
                      {lado.nombre && <span className={s.lado}>{lado.nombre}</span>}
                      <span className={s.lupa} aria-hidden="true"><ZoomIn /></span>
                    </button>
                  ) : (
                    <div key={k} className={`${s.foto} ${s.liso}`}>
                      {lado.nombre && <span className={s.lado}>{lado.nombre}</span>}
                      <span className={s.lisoTexto}>
                        {p.colorHex && <span className={s.muestraLiso} style={{ background: p.colorHex }} aria-hidden="true" />}
                        <strong><Texto>Sin diseño</Texto></strong>
                        <Texto>{p.color ? `Este lado va liso, en ${p.color}.` : 'Este lado va liso.'}</Texto>
                      </span>
                    </div>
                  )))}
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Una foto en grande, sin salir de la página; el original, aparte. */}
      <HojaInferior
        abierta={Boolean(ver)}
        onCerrar={() => setVer(null)}
        titulo={ver ? `${ver.prenda} · ${ver.lado.nombre || 'Diseño'}` : ''}
        pie={ver && <Boton bloque variante="contorno" to={ver.lado.url} icono={<ExternalLink aria-hidden="true" />}><Texto>Abrir la imagen original</Texto></Boton>}
      >
        {ver && <FotoProducto className={s.fotoGrande} src={ver.lado.url} alt={`${ver.prenda}: ${ver.lado.nombre || 'diseño'}`} />}
      </HojaInferior>
    </BloqueSeccion>
  );
}
