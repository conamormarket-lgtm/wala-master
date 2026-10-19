import React, { useState } from 'react';
import { ShoppingBag, Sparkles, Paintbrush, CheckCircle2, Users, EyeOff, RotateCcw, RefreshCw } from 'lucide-react';
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
import { TextoResaltado } from '../piezas/TextoResaltado';
import { Texto, useTexto } from '../Traduccion';
import s from './Combo.module.css';

/*
 * Un combo de Crear (/combo/:id): pareja, trío o conjunto. Cada prenda con su
 * propio diseño, color y talla, a precio de combo. Se arma aquí: se diseña
 * cada prenda (en el estudio), se copia de otra, se toma de Mis creaciones o
 * se parte de un diseño de la comunidad. Va dentro de MarcoTienda; usa el
 * mismo marco de ficha que una creación (piezas/Ficha). Los textos pasan por
 * la traducción (los nombres de los diseños y del combo del cliente, no).
 */

const CONFIRMAR = {
  publicar: { titulo: '¿Publicar en la comunidad?', texto: 'Cualquiera podrá usar este combo como punto de partida. Tu combo no cambia.', boton: 'Publicar' },
  actualizar: { titulo: '¿Actualizar la publicación?', texto: 'La comunidad verá la versión de ahora. Lo que otros ya hicieron con ella no cambia.', boton: 'Actualizar' },
  retirar: { titulo: '¿Retirar de la comunidad?', texto: 'Deja de verse en la galería. Puedes volver a publicarlo cuando quieras.', boton: 'Retirar' },
};

/**
 * La página del combo.
 *  - combo: { nombre, descripcion, publicado } · mio: { nombre, estado:
 *    'borrador' | 'guardado', onRenombrar } si es "Mi combo" (guardado)
 *  - piezas: [props de FilaPiezaCombo] (una por prenda, con i)
 *  - galeria: [{ url, nombre, pieza }] (todas las prendas, cada lado; pieza:
 *    su i, para que "ver la prenda" vaya a su foto). Puede empezar con "Todo
 *    el combo": { nombre, juntas: [{ url }] } (GaleriaProducto)
 *  - precio, sueltas (lo que cuestan por separado)
 *  - unaTalla: el conjunto lleva una sola talla para todas · tallas, talla,
 *    onTalla(t) (la del conjunto)
 *  - plantilla: { nombre, urlPersonalizar } si se parte de un diseño de la comunidad
 *  - misCreaciones(i) → [{ id, nombre, imagen }] · onElegirCreacion(i, id)
 *  - onAgregar(tallas): promesa; si faltan tallas se piden antes en una hoja ·
 *    preparando: lo que está haciendo mientras tanto ("Preparando tu combo
 *    (prenda 1 de 2)…"), va en el botón
 *  - estadoEnlaces: el state con que el estudio vuelve aquí
 *  - comunidad: { estado: 'publicada' | null, onPublicar, onActualizar,
 *    onRetirar } (admin, en "Mi combo"; si falla, el aviso sigue abierto)
 *  - estado: 'cargando' | 'error' | 'noDisponible' · onReintentar · urlCrear
 */
export function PaginaCombo({
  combo = {}, mio, piezas = [], galeria = [], precio = 0, sueltas = 0,
  unaTalla = false, tallas = [], talla, onTalla, plantilla,
  misCreaciones, onElegirCreacion, onAgregar, preparando, estadoEnlaces, comunidad,
  estado, onReintentar, urlCrear = '/personalizar',
}) {
  const [eligiendo, setEligiendo] = useState(null);
  const [pidiendoTallas, setPidiendoTallas] = useState(false);
  const [tallasHoja, setTallasHoja] = useState({});
  const [agregando, setAgregando] = useState(false);
  const [salto, setSalto] = useState(null);
  const [pregunta, setPregunta] = useState(null);
  const [confirmando, setConfirmando] = useState(false);
  const n = piezas.length;
  const ahorro = sueltas > precio ? sueltas - precio : 0;
  const t = {
    nota: useTexto('Incluye la impresión de todos tus diseños.'),
    ahorro: useTexto(`Ahorras ${soles(ahorro)} frente a comprarlas por separado.`),
    detalles: useTexto('Detalles del combo'),
    sobre: useTexto('Sobre el combo'),
    descripcion: useTexto(combo.descripcion || ''),
  };

  if (estado === 'cargando') return <EsqueletoPagina forma="producto" />;
  if (estado === 'error' || estado === 'noDisponible') {
    const error = estado === 'error';
    return (
      <BloqueSeccion ajustes={{ paddingTop: '2rem', paddingBottom: '2.5rem' }}>
        <div className={s.estado}>
          <EstadoVacio
            imagen={CARAS_KAPI.triste}
            titulo={<Texto>{error ? 'No pudimos cargar el combo' : 'Este combo ya no está disponible'}</Texto>}
            texto={<Texto>{error ? 'Revisa tu conexión e inténtalo de nuevo.' : 'Mira los otros combos y prendas que puedes diseñar.'}</Texto>}
          >
            {error
              ? <Boton icono={<RotateCcw aria-hidden="true" />} onClick={onReintentar}><Texto>Reintentar</Texto></Boton>
              : <Boton to={urlCrear}><Texto>Ir a Crear</Texto></Boton>}
          </EstadoVacio>
        </div>
      </BloqueSeccion>
    );
  }

  const listas = piezas.filter((p) => p.lista).length;
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
    // SelectorTalla traduce la etiqueta.
    : piezas.filter((p) => p.tallas?.length).map((p) => ({ clave: p.i, titulo: [`Prenda ${p.i + 1}`, p.nombre, p.color?.nombre].filter(Boolean).join(' · '), tallas: p.tallas }));
  const tallasCompletas = filasTalla.every((f) => tallasHoja[f.clave]);
  // Ver una prenda en la galería: la primera foto de esa prenda (se desliza hasta ella).
  const verPieza = (k) => {
    const prendaN = `Prenda ${k + 1}`;
    const idx = galeria.findIndex((g) => (g.pieza !== undefined ? g.pieza === piezas[k]?.i : g.nombre?.startsWith(prendaN)));
    if (idx < 0) return;
    setSalto((x) => ({ indice: idx, vez: (x?.vez || 0) + 1 }));
    // En el celular la galería queda arriba: se sube a verla.
    if (window.matchMedia('(max-width: 900px)').matches) {
      document.querySelector('[data-componente="PaginaCombo"] [data-componente="GaleriaProducto"]')
        ?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    }
  };
  const confirmar = async () => {
    setConfirmando(true);
    // Si falla, quien la pasa avisa; el aviso sigue abierto para reintentar.
    try {
      await pregunta.accion?.();
      setPregunta(null);
    } catch {
      /* sigue abierto */
    } finally {
      setConfirmando(false);
    }
  };
  const enComunidad = comunidad?.estado === 'publicada';
  const opciones = eligiendo === null ? [] : (misCreaciones?.(eligiendo) || []);
  const prendaEligiendo = piezas.find((p) => p.i === eligiendo)?.prenda;

  return (
    <MarcoFicha componente="PaginaCombo" galeria={<GaleriaProducto imagenes={galeria} nombre={nombre} salto={salto} />}>
      <Migas items={[{ texto: 'Crear', url: urlCrear }, mio ? { texto: 'Mis creaciones', url: '/cuenta/creaciones' } : { texto: 'Combos' }]} />

      <div className={s.cabeza}>
        <EtiquetaColgante tono="violeta" tamano="sm" icono={<Users aria-hidden="true" />}><Texto>{`${mio ? 'Mi combo' : 'Combo'} · ${n} prendas`}</Texto></EtiquetaColgante>
        <TituloEditable nombre={nombre} onRenombrar={mio?.onRenombrar} />
        <p className={s.base}>
          {mio ? <TextoResaltado resaltar={[combo.nombre]} envolver={(x) => x}>{`Hecho sobre ${combo.nombre}`}</TextoResaltado> : t.descripcion}
        </p>
        {combo.publicado === false && <span className={s.borrador}><Texto>Borrador: solo lo ves tú</Texto></span>}
      </div>

      <PrecioFicha precio={precio} precioAntes={ahorro > 0 ? sueltas : undefined} nota={ahorro > 0 ? `${t.ahorro} ${t.nota}` : t.nota} />

      {plantilla && (
        <Aviso
          tipo="info"
          icono={<Sparkles aria-hidden="true" />}
          accion={<Boton to={plantilla.urlPersonalizar} state={estadoEnlaces} tamano="sm" icono={<Paintbrush aria-hidden="true" />}><Texto>Personalizar</Texto></Boton>}
        >
          <TextoResaltado resaltar={[plantilla.nombre]}>{`Partes de ${plantilla.nombre}. Elige la talla y agrégalo al carrito tal cual, o personaliza cada prenda.`}</TextoResaltado>
        </Aviso>
      )}

      {mio && (
        <div className={s.mio}>
          <span><CheckCircle2 aria-hidden="true" /> <Texto>{mio.estado === 'borrador' ? 'Borrador guardado: lo encuentras en Crear para continuarlo.' : 'Guardado en Mis creaciones.'}</Texto></span>
          {comunidad && !pregunta && (
            <span className={s.botonesAviso}>
              {enComunidad && comunidad.onActualizar && (
                <Boton variante="fantasma" tamano="sm" icono={<RefreshCw aria-hidden="true" />} onClick={() => setPregunta({ ...CONFIRMAR.actualizar, accion: comunidad.onActualizar })}><Texto>Actualizar publicación</Texto></Boton>
              )}
              {enComunidad
                ? <Boton variante="fantasma" tamano="sm" icono={<EyeOff aria-hidden="true" />} onClick={() => setPregunta({ ...CONFIRMAR.retirar, accion: comunidad.onRetirar })}><Texto>Retirar de la comunidad</Texto></Boton>
                : <Boton variante="fantasma" tamano="sm" icono={<Users aria-hidden="true" />} onClick={() => setPregunta({ ...CONFIRMAR.publicar, accion: comunidad.onPublicar })}><Texto>Publicar en la comunidad</Texto></Boton>}
            </span>
          )}
        </div>
      )}
      {pregunta && (
        <Aviso
          tipo="info"
          titulo={<Texto>{pregunta.titulo}</Texto>}
          accion={(
            <span className={s.botonesAviso}>
              <Boton tamano="sm" variante="fantasma" disabled={confirmando} onClick={() => setPregunta(null)}><Texto>Cancelar</Texto></Boton>
              <Boton tamano="sm" cargando={confirmando} onClick={confirmar}><Texto>{pregunta.boton}</Texto></Boton>
            </span>
          )}
        >
          <Texto>{pregunta.texto}</Texto>
        </Aviso>
      )}

      <div className={s.grupo}>
        <span className={s.rotulo}><Texto>{`Este combo incluye (${n})`}</Texto> <em>· <Texto>{`${listas} de ${n} listas`}</Texto></em></span>
        <span className={s.avance} aria-hidden="true">{piezas.map((p) => <i key={p.i} className={p.lista ? s.avanceLista : undefined} />)}</span>
        <ol className={s.piezas}>
          {piezas.map((p, k) => (
            <FilaPiezaCombo
              key={p.i}
              {...p}
              estadoEnlaces={estadoEnlaces}
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
          <span className={s.pista}><Texto>{`Se aplica a las ${n} prendas.`}</Texto></span>
        </div>
      )}

      <Boton bloque tamano="lg" icono={<ShoppingBag aria-hidden="true" />} disabled={!completo} cargando={agregando || Boolean(preparando)} onClick={pulsarAgregar}>
        {preparando ? <Texto>{preparando}</Texto> : <><Texto>Agregar al carrito</Texto> · {soles(precio)}</>}
      </Boton>
      <p className={s.estadoCompra} aria-live="polite"><strong><Texto>{`${listas} de ${n} listas.`}</Texto></strong> <Texto>{faltaTexto}</Texto></p>

      <ConfianzaCompra />

      <Acordeon
        multiple
        variante="lista"
        abiertoInicial="detalles"
        items={[
          {
            id: 'detalles',
            question: t.detalles,
            answer: (
              <div className={s.detalles}>
                <dl>
                  {piezas.map((p) => (
                    <React.Fragment key={p.i}>
                      <dt><Texto>{`Prenda ${p.i + 1}`}</Texto></dt>
                      <dd><Texto>{[p.prenda, p.color?.nombre, (unaTalla ? talla : p.talla) && `Talla ${unaTalla ? talla : p.talla}`].filter(Boolean).join(' · ') || '—'}</Texto></dd>
                    </React.Fragment>
                  ))}
                  {ahorro > 0 && <><dt><Texto>Por separado</Texto></dt><dd>{soles(sueltas)}</dd></>}
                </dl>
                <p className={s.nota}><Texto>Cada prenda se imprime con su propio diseño, color y talla.</Texto></p>
              </div>
            ),
          },
          mio && combo.descripcion && { id: 'sobre', question: t.sobre, answer: <p className={s.nota}>{t.descripcion}</p> },
        ].filter(Boolean)}
      />

      {/* Tomar una creación propia de esa prenda. */}
      <HojaInferior
        abierta={eligiendo !== null}
        onCerrar={() => setEligiendo(null)}
        titulo={eligiendo !== null ? `Tus creaciones de ${prendaEligiendo || 'esta prenda'}` : ''}
      >
        {opciones.length ? (
          <ul className={s.opciones}>
            {opciones.map((c) => (
              <li key={c.id}>
                <button type="button" className={s.opcion} onClick={() => { onElegirCreacion?.(eligiendo, c.id); setEligiendo(null); }}>
                  <FotoProducto className={s.opcionFoto} src={c.imagen} relleno="4%" />
                  <span>{c.nombre || <Texto>Mi creación</Texto>}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className={s.nota}><Texto>Aún no tienes creaciones de esta prenda. Diséñala desde cero.</Texto></p>
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
            <Texto>Agregar al carrito</Texto> · {soles(precio)}
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
              onChange={(x) => setTallasHoja((h) => (f.clave === 'todas' ? { todas: x } : { ...h, [f.clave]: x }))}
            />
          ))}
          <p className={s.nota}><Texto>Incluye la impresión de todos los diseños de tu combo.</Texto></p>
        </div>
      </HojaInferior>
    </MarcoFicha>
  );
}
