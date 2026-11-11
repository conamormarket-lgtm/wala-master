import React from 'react';
import { Gift, Lock, Share2, ShoppingBag, Clock, Check, Hourglass, X, Undo2 } from 'lucide-react';
import Boton from '../Boton';
import { Enlace } from '../Enlace';
import { Interruptor } from '../Formulario';
import { Sello } from '../Marca';
import { Texto } from '../Traduccion';
import { soles } from '../TarjetaProducto';
import CuentaRegresiva from '../CuentaRegresiva';
import s from './Bienvenida.module.css';

/*
 * La semana de bienvenida (promo "Tu primera compra puede salir gratis"): cada
 * cuenta nueva tiene 7 días; por cada amigo nuevo que compra con su invitación
 * gana S/ 10 de saldo, que paga productos en su primera compra. Mientras tanto
 * sus monedas y cupones quedan en pausa. Las cuentas las hace el servidor
 * (functions/primeraCompra.js): estas piezas solo muestran lo que reciben.
 */

const isoDe = (ms) => (ms ? new Date(ms).toISOString() : undefined);

/**
 * La franja de la semana de bienvenida (arriba de la tienda y en Mi cuenta):
 * cuánto tiempo queda, el saldo y qué hacer.
 *  - venceMs · saldo · pendiente · premio (S/ por amigo, 10) · minimo (50)
 *  - urlInvitar · urlTienda · urlCondiciones · onCerrar (sin él, no se cierra)
 *  - compacta: una sola línea (la franja de la tienda)
 */
export function BannerBienvenida({
  venceMs, saldo = 0, pendiente = 0, premio = 10, minimo = 50,
  urlInvitar = '/cuenta/referidos', urlTienda = '/tienda', urlCondiciones = '/bienvenida', onCerrar, compacta = false,
}) {
  const conSaldo = saldo > 0;
  return (
    <section className={[s.banner, compacta && s.compacta].filter(Boolean).join(' ')} data-componente="BannerBienvenida">
      <Sello tamano={compacta ? 30 : 44} girar={-8}><Gift aria-hidden="true" /></Sello>
      <div className={s.bannerTexto}>
        <strong className={s.bannerTitulo}>
          <Texto>{conSaldo ? `Tienes ${soles(saldo)} para tu primera compra` : 'Tu primera compra puede salir gratis'}</Texto>
        </strong>
        {!compacta && (
          <p>
            <Texto>{`Gana ${soles(premio)} por cada amigo nuevo que compre ${soles(minimo)} o más con tu invitación. Tu saldo paga los productos; el envío va aparte.`}</Texto>
            {pendiente > 0 && <> <Texto>{`${soles(pendiente)} más esperan que se confirme el pago.`}</Texto></>}
          </p>
        )}
        {venceMs && (
          <span className={s.reloj}>
            <Clock aria-hidden="true" />
            <CuentaRegresiva hasta={isoDe(venceMs)} variante="frase" etiqueta="Vence en" textoFin="Tu plazo terminó" />
          </span>
        )}
      </div>
      <div className={s.bannerAcciones}>
        {conSaldo
          ? <Boton to={urlTienda} tamano="sm" icono={<ShoppingBag aria-hidden="true" />}><Texto>Usar mi saldo</Texto></Boton>
          : <Boton to={urlInvitar} tamano="sm" icono={<Share2 aria-hidden="true" />}><Texto>Invitar amigos</Texto></Boton>}
        {!compacta && <Enlace to={urlCondiciones} className={s.condiciones}><Texto>Ver condiciones</Texto></Enlace>}
      </div>
      {onCerrar && (
        <button type="button" className={s.cerrar} onClick={onCerrar} aria-label="Cerrar">
          <X aria-hidden="true" />
        </button>
      )}
    </section>
  );
}

/**
 * En el checkout: usar el saldo de bienvenida. Paga solo productos (hasta el %
 * de cada marca) y deja al menos S/ 1 por pagar.
 *  - saldo (lo que tiene) · maximo (lo que se puede usar en esta compra) ·
 *    usar · onUsar(bool) · bloqueado (mientras se procesa) · venceMs
 */
export function FilaSaldoBienvenida({ saldo = 0, maximo = 0, usar = false, onUsar, bloqueado = false, venceMs }) {
  if (!saldo) return null;
  const usable = Math.min(saldo, maximo);
  let descripcion;
  if (usable <= 0) descripcion = 'Estos productos no se pueden pagar con tu saldo. Prueba con otros de la tienda.';
  else if (usable < saldo) descripcion = `Tienes ${soles(saldo)}; en esta compra puedes usar ${soles(usable)}. Lo que no uses vence con tu primera compra.`;
  else descripcion = `Paga tus productos con tu saldo. El envío va aparte.`;
  return (
    <div className={[s.fila, bloqueado && s.bloqueado].filter(Boolean).join(' ')} data-componente="FilaSaldoBienvenida" aria-disabled={bloqueado || undefined}>
      <Sello tamano={30} girar={-8}><Gift aria-hidden="true" /></Sello>
      {usable > 0 ? (
        <span className={s.filaInterruptor}>
          <Interruptor
            activo={usar}
            onChange={(v) => !bloqueado && onUsar?.(v)}
            etiqueta={<><Texto>Usar mi saldo de bienvenida</Texto> <b className={s.menos}>−{soles(usable)}</b></>}
            descripcion={<Texto>{descripcion}</Texto>}
          />
        </span>
      ) : (
        <span className={s.filaTexto}>
          <strong><Texto>{`Saldo de bienvenida: ${soles(saldo)}`}</Texto></strong>
          <small><Texto>{descripcion}</Texto></small>
        </span>
      )}
      {venceMs && usable > 0 && (
        <span className={s.filaVence}>
          <CuentaRegresiva hasta={isoDe(venceMs)} variante="frase" etiqueta="Vence en" textoFin="Venció" />
        </span>
      )}
    </div>
  );
}

/** La razón de que monedas o cupones no se puedan usar ahora (semana de bienvenida). */
export function PausaBienvenida({ que = 'monedas' }) {
  return (
    <p className={s.pausa} data-componente="PausaBienvenida">
      <Lock aria-hidden="true" />
      <Texto>{que === 'cupones'
        ? 'Tus cupones están en pausa durante tu semana de bienvenida. Se liberan con tu primera compra.'
        : 'Tus monedas están en pausa durante tu semana de bienvenida. Se liberan con tu primera compra.'}</Texto>
    </p>
  );
}

/**
 * Para quien compra con una invitación: si su compra le da el premio a quien
 * lo invitó, o cuánto le falta. Se ve antes de pagar.
 *  - nombre · premio (S/) · genera · motivo ('minimo' | 'margen' | 'con_saldo' |
 *    'no_invitacion') · falta (S/ aprox. en productos)
 */
export function AvisoInvitador({ nombre, premio = 10, genera = false, motivo, falta }) {
  const quien = nombre || 'quien te invitó';
  let texto;
  if (genera) texto = `Esta compra le da ${soles(premio)} de saldo a ${quien}, que te invitó. A ti no te cuesta nada.`;
  else if (motivo === 'con_saldo') texto = `Como usas tu saldo de bienvenida, esta compra no le da premio a ${quien}.`;
  else if (falta > 0) texto = `Agrega ${soles(falta)} más en productos y ${quien} gana ${soles(premio)} de saldo por invitarte.`;
  else texto = `Esta compra no le da premio a ${quien}. A ti no te cambia nada.`;
  return (
    <p className={[s.invitador, genera && s.invitadorGenera].filter(Boolean).join(' ')} data-componente="AvisoInvitador">
      <Gift aria-hidden="true" /> <Texto>{texto}</Texto>
    </p>
  );
}

const ESTADOS_PREMIO = {
  disponible: { texto: 'Sumado', icono: Check, tono: 'ok' },
  pendiente: { texto: 'Esperando su pago', icono: Hourglass, tono: 'espera' },
  no_elegible: { texto: 'No suma', icono: X, tono: 'no' },
  revertido: { texto: 'Se canceló', icono: Undo2, tono: 'no' },
  vencido: { texto: 'Llegó tarde', icono: Clock, tono: 'no' },
};

/**
 * En Mi cuenta → Referidos: el saldo, el reloj y cada amigo con su estado.
 *  - fase: { estado: 'activa' | 'vencida' | 'usada', venceMs, usado } ·
 *    saldo · pendiente · premio · minimo
 *  - premios: [{ id, nombre, estado, monto, motivo }]
 *  - enPausa · urlTienda · urlCondiciones · onInvitar
 */
export function TarjetaBienvenida({
  fase, saldo = 0, pendiente = 0, premio = 10, minimo = 50, premios = [], enPausa = false,
  urlTienda = '/tienda', urlCondiciones = '/bienvenida', onInvitar,
}) {
  if (!fase) return null;
  const activa = fase.estado === 'activa';
  let titulo;
  if (activa) titulo = 'Tu semana de bienvenida';
  else if (fase.estado === 'usada') titulo = fase.usado > 0 ? `Usaste ${soles(fase.usado)} de saldo en tu primera compra` : 'Ya hiciste tu primera compra';
  else titulo = 'Tu semana de bienvenida terminó';
  return (
    <section className={s.tarjeta} data-componente="TarjetaBienvenida">
      <header className={s.tarjetaCabeza}>
        <Sello tamano={44} girar={-8} tono={activa ? 'degradado' : 'suave'}><Gift aria-hidden="true" /></Sello>
        <div>
          <h2 className={s.tarjetaTitulo}><Texto>{titulo}</Texto></h2>
          {activa && fase.venceMs && (
            <span className={s.reloj}>
              <Clock aria-hidden="true" />
              <CuentaRegresiva hasta={isoDe(fase.venceMs)} variante="frase" etiqueta="Vence en" textoFin="Tu plazo terminó" />
            </span>
          )}
        </div>
      </header>

      {activa && (
        <>
          <dl className={s.saldos}>
            <div><dt><Texto>Disponible</Texto></dt><dd>{soles(saldo)}</dd></div>
            <div><dt><Texto>Por confirmar</Texto></dt><dd>{soles(pendiente)}</dd></div>
          </dl>
          <p className={s.tarjetaTexto}>
            <Texto>{`Gana ${soles(premio)} por cada amigo nuevo que se registre con tu invitación y compre ${soles(minimo)} o más en productos. Tu saldo paga los productos de tu primera compra (el envío va aparte) y lo que no uses vence.`}</Texto>
          </p>
          {enPausa && <PausaBienvenida que="monedas" />}
          <div className={s.tarjetaAcciones}>
            {onInvitar && <Boton onClick={onInvitar} tamano="sm" icono={<Share2 aria-hidden="true" />}><Texto>Invitar amigos</Texto></Boton>}
            {saldo > 0 && <Boton to={urlTienda} tamano="sm" variante="contorno" icono={<ShoppingBag aria-hidden="true" />}><Texto>Usar mi saldo</Texto></Boton>}
            <Enlace to={urlCondiciones} className={s.condiciones}><Texto>Ver condiciones</Texto></Enlace>
          </div>
        </>
      )}

      {premios.length > 0 && (
        <ul className={s.premios} aria-label="Tus amigos">
          {premios.map((p) => {
            const e = ESTADOS_PREMIO[p.estado] || ESTADOS_PREMIO.no_elegible;
            const Icono = e.icono;
            return (
              <li key={p.id} className={s.premio}>
                <span className={s.premioNombre}>
                  <strong>{p.nombre}</strong>
                  {p.motivo && p.estado !== 'disponible' && <small><Texto>{p.motivo}</Texto></small>}
                </span>
                <span className={[s.premioEstado, s[`estado_${e.tono}`]].join(' ')}>
                  <Icono aria-hidden="true" /> <Texto>{e.texto}</Texto>
                  {p.monto > 0 && <b>{soles(p.monto)}</b>}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
