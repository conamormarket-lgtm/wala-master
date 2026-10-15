import React, { useRef, useState } from 'react';
import { Gift, LogIn, ArrowRight, CalendarClock } from 'lucide-react';
import Boton from '../Boton';
import { Aviso } from '../Feedback';
import { Moneda } from '../Etiquetas';
import { IconoWala } from '../IconosWala';
import { Estallido } from '../Efectos';
import { Destello } from '../Marca';
import { Texto } from '../Traduccion';
import CuentaRegresiva from '../CuentaRegresiva';
import { FotoProducto } from './FotoProducto';
import s from './Ofertas.module.css';

/*
 * Piezas de /ofertas: el cofre que se abre una vez al día y una oferta flash.
 */

/**
 * El cofre diario: se abre una vez por día (hora de Lima) y da monedas
 * sorpresa (el servidor decide cuántas: openDailyChestSecure).
 *  - sesion: sin cuenta, "Inicia sesión para abrir el cofre" (urlLogin)
 *  - onAbrir(boton): promesa → { premio, saldo } o { yaAbierto: true, saldo };
 *    si falla, lanza un Error con el mensaje. `boton` es el botón tocado
 *    (para que las monedas vuelen desde ahí: volarMonedasGanadas).
 *  - abiertoHoy: si la página ya sabe que hoy se abrió (lastChestDate)
 *  - hasta: ISO de la próxima apertura (medianoche de Lima) para "Se abre de
 *    nuevo en 7 h 56 min"
 *  - premio: lo que puede salir, en texto ("Entre 5 y 20 monedas")
 */
export function CofreDiario({ sesion = true, urlLogin = '/login', onAbrir, abiertoHoy = false, hasta, premio = 'Entre 5 y 20 monedas' }) {
  const [estado, setEstado] = useState(abiertoHoy ? 'abierto' : 'listo');
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');
  const [disparo, setDisparo] = useState(0);
  const boton = useRef(null);

  const abrir = async () => {
    setEstado('abriendo');
    setError('');
    try {
      const r = (await onAbrir?.(boton.current)) || {};
      setResultado(r);
      if (r.yaAbierto) setEstado('abierto');
      else {
        setEstado('ganado');
        setDisparo(Date.now());
      }
    } catch (e) {
      setError(e?.message || 'No pudimos abrir el cofre. Inténtalo otra vez.');
      setEstado('listo');
    }
  };

  const ganado = estado === 'ganado';
  const abierto = estado === 'abierto';
  return (
    <section className={[s.cofre, (ganado || abierto) && s.cofreAbierto].filter(Boolean).join(' ')} aria-labelledby="cofre-titulo" data-componente="CofreDiario">
      <span className={[s.cofreIcono, ganado && s.cofreIconoGanado].filter(Boolean).join(' ')}>
        <IconoWala nombre="regalo" tamano={68} girar={-8} />
        <Estallido disparo={disparo} forma="confeti" cantidad={12} distancia={46} />
      </span>
      <div className={s.cofreTexto}>
        <h2 id="cofre-titulo" className={s.cofreTitulo}>Cofre diario</h2>
        {ganado ? (
          <p className={s.cofreGanado} role="status">
            ¡Ganaste <Moneda tamano={18} /> <strong>{resultado?.premio}</strong> monedas!
            {resultado?.saldo != null && <span className={s.cofreSaldo}>Tu saldo: {resultado.saldo}</span>}
          </p>
        ) : abierto ? (
          <p role="status">
            Ya abriste tu cofre hoy.{' '}
            {hasta ? <CuentaRegresiva hasta={hasta} variante="frase" etiqueta="Se abre de nuevo en" textoFin="¡Ya puedes abrirlo otra vez!" /> : '¡Vuelve mañana!'}
          </p>
        ) : (
          <>
            <p>Ábrelo una vez al día y gana monedas sorpresa.</p>
            <p className={s.cofrePremio}><Moneda tamano={16} /> {premio}</p>
          </>
        )}
      </div>
      <div className={s.cofreAccion}>
        {!sesion ? (
          <Boton to={urlLogin} icono={<LogIn aria-hidden="true" />}>Inicia sesión para abrir el cofre</Boton>
        ) : ganado ? (
          <p className={s.cofreVuelve}>Mañana hay otro.</p>
        ) : !abierto && (
          <Boton ref={boton} icono={<Gift aria-hidden="true" />} cargando={estado === 'abriendo'} onClick={abrir}>
            {estado === 'abriendo' ? 'Abriendo…' : 'Abrir cofre diario'}
          </Boton>
        )}
      </div>
      {error && <div className={s.cofreError}><Aviso tipo="error" compacto>{error}</Aviso></div>}
    </section>
  );
}

/**
 * Una oferta flash (ofertaDesdeFirestore arma las props).
 *  - titulo, descuento (%), fechas ("Hasta el 24 de octubre"), quedan
 *    ("Quedan 3 días"), estado: 'activa' | 'proxima'
 *  - producto: { nombre, imagen } si la oferta apunta a uno; url: su ficha
 */
export function TarjetaOferta({ titulo, descuento = 0, fechas, quedan, estado = 'activa', producto, url }) {
  const proxima = estado === 'proxima';
  return (
    <article className={[s.oferta, proxima && s.ofertaProxima].filter(Boolean).join(' ')} data-componente="TarjetaOferta">
      {producto?.imagen ? (
        <>
          <FotoProducto className={s.ofertaFoto} src={producto.imagen} relleno="8%" />
          <span className={s.ofertaDescuento} aria-label={`${descuento}% de descuento`}>-{descuento}%</span>
        </>
      ) : (
        // Sin producto, el descuento es la foto: grande, con la letra del logo.
        <span className={s.ofertaPortada} aria-label={`${descuento}% de descuento`}>
          <Destello className={s.ofertaChispa} />
          <span className={s.ofertaGrande}>-{descuento}%</span>
        </span>
      )}
      <div className={s.ofertaCuerpo}>
        <h3 className={s.ofertaTitulo}><Texto>{titulo}</Texto></h3>
        {producto?.nombre && <p className={s.ofertaProducto}><Texto>{producto.nombre}</Texto></p>}
        {(fechas || quedan) && (
          <p className={s.ofertaFechas}>
            <CalendarClock aria-hidden="true" />
            <span>{fechas}{quedan && <strong> · {quedan}</strong>}</span>
          </p>
        )}
        {url && !proxima && (
          <Boton to={url} variante="secundario" tamano="sm" iconoFin={<ArrowRight aria-hidden="true" />} className={s.ofertaBoton}>Ver producto</Boton>
        )}
      </div>
    </article>
  );
}
