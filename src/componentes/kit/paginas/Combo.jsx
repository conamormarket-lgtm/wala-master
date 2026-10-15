import React, { useState } from 'react';
import { ShoppingBag, Sparkles, Paintbrush, CheckCircle2, Users, EyeOff, RotateCcw } from 'lucide-react';
import Boton from '../Boton';
import Acordeon from '../Acordeon';
import { Aviso, EstadoVacio, HojaInferior } from '../Feedback';
import { SelectorTalla } from '../Formulario';
import { EtiquetaColgante } from '../Marca';
import { BloqueSeccion } from '../Seccion';
import { EsqueletoPagina } from '../Esqueletos';
import { soles } from '../TarjetaProducto';
import { GaleriaProducto } from '../piezas/GaleriaProducto';
import { FotoProducto } from '../piezas/FotoProducto';
import { CARAS_KAPI } from '../piezas/Flotantes';
import { MarcoFicha, Migas, PrecioFicha, ConfianzaCompra, TituloEditable } from '../piezas/Ficha';
import { FilaPiezaCombo } from '../piezas/Crear';
import s from './Combo.module.css';

/*
 * Un combo de Crear (/combo/:id): pareja, trío o conjunto. Cada prenda con su
 * propio diseño, color y talla, a precio de combo. Se arma aquí: se diseña
 * cada prenda (en el estudio), se copia de otra, se toma de Mis creaciones o
 * se parte de un diseño de la comunidad. Va dentro de MarcoTienda; usa el
 * mismo marco de ficha que una creación (piezas/Ficha).
 */

/**
 * La página del combo.
 *  - combo: { nombre, descripcion, publicado } · mio: { nombre, estado:
 *    'borrador' | 'guardado', onRenombrar } si es "Mi combo" (guardado)
 *  - piezas: [props de FilaPiezaCombo] (una por prenda, con i)
 *  - galeria: [{ url, nombre }] (todas las prendas, cada lado)
 *  - precio, sueltas (lo que cuestan por separado)
 *  - unaTalla: el conjunto lleva una sola talla para todas · tallas, talla,
 *    onTalla(t) (la del conjunto)
 *  - plantilla: { nombre, urlPersonalizar } si se parte de un diseño de la comunidad
 *  - misCreaciones(i) → [{ id, nombre, imagen }] · onElegirCreacion(i, id)
 *  - onAgregar(tallas): promesa; si faltan tallas se piden antes en una hoja
 *  - comunidad: { estado, onPublicar, onRetirar } (admin, en "Mi combo")
 *  - estado: 'cargando' | 'error' | 'noDisponible' · onReintentar · urlCrear
 */
export function PaginaCombo({
  combo = {}, mio, piezas = [], galeria = [], precio = 0, sueltas = 0,
  unaTalla = false, tallas = [], talla, onTalla, plantilla,
  misCreaciones, onElegirCreacion, onAgregar, comunidad,
  estado, onReintentar, urlCrear = '/personalizar',
}) {
  const [eligiendo, setEligiendo] = useState(null);
  const [pidiendoTallas, setPidiendoTallas] = useState(false);
  const [tallasHoja, setTallasHoja] = useState({});
  const [agregando, setAgregando] = useState(false);
  const [verFoto, setVerFoto] = useState(0);
  const [pregunta, setPregunta] = useState(null);

  if (estado === 'cargando') return <EsqueletoPagina forma="producto" />;
  if (estado === 'error' || estado === 'noDisponible') {
    const error = estado === 'error';
    return (
      <BloqueSeccion ajustes={{ paddingTop: '2rem', paddingBottom: '2.5rem' }}>
        <div className={s.estado}>
          <EstadoVacio
            imagen={CARAS_KAPI.triste}
            titulo={error ? 'No pudimos cargar el combo' : 'Este combo ya no está disponible'}
            texto={error ? 'Revisa tu conexión e inténtalo de nuevo.' : 'Mira los otros combos y prendas que puedes diseñar.'}
          >
            {error
              ? <Boton icono={<RotateCcw aria-hidden="true" />} onClick={onReintentar}>Reintentar</Boton>
              : <Boton to={urlCrear}>Ir a Crear</Boton>}
          </EstadoVacio>
        </div>
      </BloqueSeccion>
    );
  }

  const n = piezas.length;
  const listas = piezas.filter((p) => p.lista).length;
  const ahorro = sueltas > precio ? sueltas - precio : 0;
  const nombre = mio?.nombre || combo.nombre;
  const faltanTallas = unaTalla
    ? tallas.length > 0 && !talla
    : piezas.some((p) => p.tallas?.length && !p.talla);
  const completo = listas === n;
  const faltaTexto = completo
    ? (faltanTallas ? 'Solo falta la talla.' : 'Todo listo para agregar al carrito.')
    : plantilla ? 'Elige la talla y agrégalo tal cual, o personaliza cada prenda.'
      : unaTalla ? 'Diseña cada prenda y elige la talla.' : 'Diseña cada prenda y elige su talla.';

  const agregar = async (elegidas) => {
    setAgregando(true);
    try { await onAgregar?.(elegidas); } finally { setAgregando(false); }
  };
  const pulsarAgregar = () => {
    if (faltanTallas) {
      setTallasHoja(unaTalla ? { todas: talla || '' } : Object.fromEntries(piezas.map((p) => [p.i, p.talla || ''])));
      setPidiendoTallas(true);
      return;
    }
    agregar(unaTalla ? { todas: talla } : Object.fromEntries(piezas.map((p) => [p.i, p.talla])));
  };
  // Las filas de la hoja de tallas: una (el conjunto) o una por prenda.
  const filasTalla = unaTalla
    ? [{ clave: 'todas', titulo: `Para las ${n} prendas`, tallas }]
    : piezas.filter((p) => p.tallas?.length).map((p) => ({ clave: p.i, titulo: [`Prenda ${p.i + 1}`, p.nombre, p.color?.nombre].filter(Boolean).join(' · '), tallas: p.tallas }));
  const tallasCompletas = filasTalla.every((f) => tallasHoja[f.clave]);
  // Ver una prenda en la galería: la primera foto de esa prenda.
  const verPieza = (k) => {
    const prendaN = `Prenda ${k + 1}`;
    const idx = galeria.findIndex((g) => g.nombre?.startsWith(prendaN));
    if (idx >= 0) setVerFoto(idx);
  };
  const opciones = eligiendo === null ? [] : (misCreaciones?.(eligiendo) || []);

  return (
    <MarcoFicha componente="PaginaCombo" galeria={<GaleriaProducto key={verFoto} imagenes={galeria} nombre={nombre} inicial={verFoto} />}>
      <Migas items={[{ texto: 'Crear', url: urlCrear }, mio ? { texto: 'Mis creaciones', url: '/cuenta/creaciones' } : { texto: 'Combos' }]} />

      <div className={s.cabeza}>
        <EtiquetaColgante tono="violeta" tamano="sm" icono={<Users aria-hidden="true" />}>{mio ? 'Mi combo' : 'Combo'} · {n} prendas</EtiquetaColgante>
        <TituloEditable nombre={nombre} onRenombrar={mio?.onRenombrar} />
        <p className={s.base}>{mio ? `Hecho sobre ${combo.nombre}` : combo.descripcion}</p>
        {combo.publicado === false && <span className={s.borrador}>Borrador: solo lo ves tú</span>}
      </div>

      <PrecioFicha
        precio={precio}
        precioAntes={ahorro > 0 ? sueltas : undefined}
        nota={`${ahorro > 0 ? `Ahorras ${soles(ahorro)} frente a comprarlas por separado. ` : ''}Incluye la impresión de todos tus diseños.`}
      />

      {plantilla && (
        <Aviso
          tipo="info"
          icono={<Sparkles aria-hidden="true" />}
          accion={<Boton to={plantilla.urlPersonalizar} tamano="sm" icono={<Paintbrush aria-hidden="true" />}>Personalizar</Boton>}
        >
          Partes de <strong>{plantilla.nombre}</strong>. Elige la talla y agrégalo al carrito tal cual, o personaliza cada prenda.
        </Aviso>
      )}

      {mio && (
        <div className={s.mio}>
          <span><CheckCircle2 aria-hidden="true" /> {mio.estado === 'borrador' ? 'Borrador guardado: lo encuentras en Crear para continuarlo.' : 'Guardado en Mis creaciones.'}</span>
          {comunidad && !pregunta && (comunidad.estado === 'publicada'
            ? <Boton variante="fantasma" tamano="sm" icono={<EyeOff aria-hidden="true" />} onClick={() => setPregunta({ titulo: '¿Retirar de la comunidad?', texto: 'Deja de verse en la galería.', boton: 'Retirar', accion: comunidad.onRetirar })}>Retirar de la comunidad</Boton>
            : <Boton variante="fantasma" tamano="sm" icono={<Users aria-hidden="true" />} onClick={() => setPregunta({ titulo: '¿Publicar en la comunidad?', texto: 'Cualquiera podrá usar este combo como punto de partida. Tu combo no cambia.', boton: 'Publicar', accion: comunidad.onPublicar })}>Publicar en la comunidad</Boton>)}
        </div>
      )}
      {pregunta && (
        <Aviso
          tipo="info"
          titulo={pregunta.titulo}
          accion={(
            <span className={s.botonesAviso}>
              <Boton tamano="sm" variante="fantasma" onClick={() => setPregunta(null)}>Cancelar</Boton>
              <Boton tamano="sm" onClick={async () => { await pregunta.accion?.(); setPregunta(null); }}>{pregunta.boton}</Boton>
            </span>
          )}
        >
          {pregunta.texto}
        </Aviso>
      )}

      <div className={s.grupo}>
        <span className={s.rotulo}>Este combo incluye ({n}) <em>· {listas} de {n} listas</em></span>
        <span className={s.avance} aria-hidden="true">{piezas.map((p) => <i key={p.i} className={p.lista ? s.avanceLista : undefined} />)}</span>
        <ol className={s.piezas}>
          {piezas.map((p, k) => (
            <FilaPiezaCombo
              key={p.i}
              {...p}
              onTalla={unaTalla ? undefined : p.onTalla}
              onMisCreaciones={misCreaciones && p.estado === 'vacia' ? () => setEligiendo(p.i) : undefined}
              onVer={() => verPieza(k)}
            />
          ))}
        </ol>
      </div>

      {unaTalla && tallas.length > 0 && !plantilla && (
        <div className={s.grupo}>
          <SelectorTalla tallas={tallas} valor={talla} onChange={onTalla} etiqueta="Talla" />
          <span className={s.pista}>Se aplica a las {n} prendas.</span>
        </div>
      )}

      <Boton bloque tamano="lg" icono={<ShoppingBag aria-hidden="true" />} disabled={!completo} cargando={agregando} onClick={pulsarAgregar}>
        Agregar al carrito · {soles(precio)}
      </Boton>
      <p className={s.estadoCompra}><strong>{listas} de {n} listas.</strong> {faltaTexto}</p>

      <ConfianzaCompra />

      <Acordeon
        multiple
        variante="lista"
        abiertoInicial="detalles"
        items={[
          {
            id: 'detalles',
            question: 'Detalles del combo',
            answer: (
              <div className={s.detalles}>
                <dl>
                  {piezas.map((p) => (
                    <React.Fragment key={p.i}>
                      <dt>Prenda {p.i + 1}</dt>
                      <dd>{[p.prenda, p.color?.nombre, (unaTalla ? talla : p.talla) && `Talla ${unaTalla ? talla : p.talla}`].filter(Boolean).join(' · ') || '—'}</dd>
                    </React.Fragment>
                  ))}
                  {ahorro > 0 && <><dt>Por separado</dt><dd>{soles(sueltas)}</dd></>}
                </dl>
                <p className={s.nota}>Cada prenda se imprime con su propio diseño, color y talla.</p>
              </div>
            ),
          },
          mio && combo.descripcion && { id: 'sobre', question: 'Sobre el combo', answer: <p className={s.nota}>{combo.descripcion}</p> },
        ].filter(Boolean)}
      />

      {/* Tomar una creación propia de esa prenda. */}
      <HojaInferior
        abierta={eligiendo !== null}
        onCerrar={() => setEligiendo(null)}
        titulo={eligiendo !== null ? `Tus creaciones de ${piezas.find((p) => p.i === eligiendo)?.prenda || 'esta prenda'}` : ''}
      >
        {opciones.length ? (
          <ul className={s.opciones}>
            {opciones.map((c) => (
              <li key={c.id}>
                <button type="button" className={s.opcion} onClick={() => { onElegirCreacion?.(eligiendo, c.id); setEligiendo(null); }}>
                  <FotoProducto className={s.opcionFoto} src={c.imagen} relleno="4%" />
                  <span>{c.nombre || 'Mi creación'}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className={s.nota}>Aún no tienes creaciones de esta prenda. Diséñala desde cero.</p>
        )}
      </HojaInferior>

      {/* Faltan tallas: se piden antes de agregar. */}
      <HojaInferior
        abierta={pidiendoTallas}
        onCerrar={() => setPidiendoTallas(false)}
        titulo="¿Qué talla quieres?"
        pie={(
          <Boton
            bloque
            icono={<ShoppingBag aria-hidden="true" />}
            disabled={!tallasCompletas}
            cargando={agregando}
            onClick={async () => { setPidiendoTallas(false); await agregar(tallasHoja); }}
          >
            Agregar al carrito · {soles(precio)}
          </Boton>
        )}
      >
        <div className={s.hojaTallas}>
          <p className={s.nota}>{nombre}</p>
          {filasTalla.map((f) => (
            <SelectorTalla
              key={f.clave}
              etiqueta={f.titulo}
              tallas={f.tallas}
              valor={tallasHoja[f.clave]}
              onChange={(t) => setTallasHoja((x) => (f.clave === 'todas' ? { todas: t } : { ...x, [f.clave]: t }))}
            />
          ))}
          <p className={s.nota}>Incluye la impresión de todos los diseños de tu combo.</p>
        </div>
      </HojaInferior>
    </MarcoFicha>
  );
}
