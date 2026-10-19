import React, { useEffect, useRef, useState } from 'react';
import { Copy, Share2, Check, Package, AlertCircle, Trophy } from 'lucide-react';
import Boton from '../Boton';
import { Etiqueta, GananciaMonedas, Moneda } from '../Etiquetas';
import { Sello } from '../Marca';
import { TarjetaCuenta } from './Cuenta';
import { IconoWala } from '../IconosWala';
import { Avatar } from './Avatar';
import { FotoProducto } from './FotoProducto';
import { EsqueletoFila } from '../Esqueletos';
import { Texto } from '../Traduccion';
import s from './Referidos.module.css';

/*
 * Piezas de "Mis referidos": cómo se gana, el link de invitación, cada
 * persona que entró por un link y el detalle de su pedido. Datos por props.
 */

/**
 * Una forma de ganar monedas: ícono de Walá, título y explicación.
 *  - icono: nombre de IconoWala · titulo · children: el texto (con <strong>)
 *  - premio: lo que suma, en un sello a la derecha ("+1", "+1 por amigo")
 */
export function FormaGanar({ icono = 'regalo', titulo, premio, children }) {
  return (
    <div className={s.forma} data-componente="FormaGanar">
      <IconoWala nombre={icono} tamano={50} girar={-6} />
      <div className={s.formaTextos}>
        <h3 className={s.formaTitulo}><Texto>{titulo}</Texto></h3>
        <p className={s.formaTexto}>{children}</p>
      </div>
      {premio && <span className={s.formaPremio}>{premio}</span>}
    </div>
  );
}

/**
 * El link de invitación: el link a la vista, "Compartir invitación" (abre
 * el menú de compartir del teléfono) y "Copiar link".
 *  - url · onCompartir() · onCopiar(): promesas o nada
 */
export function EnlaceInvitacion({ url, onCompartir, onCopiar }) {
  const [copiado, setCopiado] = useState(false);
  const reloj = useRef(null);
  useEffect(() => () => window.clearTimeout(reloj.current), []);
  const copiar = async () => {
    try {
      await onCopiar?.(url);
      setCopiado(true);
      window.clearTimeout(reloj.current);
      reloj.current = window.setTimeout(() => setCopiado(false), 2000);
    } catch { /* la página avisa */ }
  };
  return (
    <div className={s.enlace} data-componente="EnlaceInvitacion">
      <p className={s.enlaceUrl}>{url || '—'}</p>
      <div className={s.enlaceBotones}>
        {onCompartir && <Boton icono={<Share2 aria-hidden="true" />} onClick={onCompartir} disabled={!url}><Texto>Compartir invitación</Texto></Boton>}
        {onCopiar && (
          <Boton variante="contorno" icono={copiado ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />} onClick={copiar} disabled={!url}>
            <Texto>{copiado ? 'Copiado' : 'Copiar link'}</Texto>
          </Boton>
        )}
      </div>
    </div>
  );
}

/**
 * Una persona que entró por un link.
 *  - nombre (sin nombre: "Visitante") · anonima: sin nombre propio ("Visitante
 *    3"): el avatar lleva "?" y no la inicial
 *  - chips: [{ texto, tono, icono }] (tonos de Etiqueta: exito, violeta,
 *    aviso, neutro, peligro)
 *  - detalle: "Entró el 12 oct · le quedan 5 h para comprar"
 *  - ganancia: monedas · confirmada: "Ganas" (si no, "Ganarías")
 *  - acciones: nodo (Ver pedido, Reclamar) · children: lo que se abre debajo
 */
export function FilaReferido({ nombre, anonima = false, chips = [], detalle, ganancia, confirmada = false, acciones, children }) {
  return (
    <li className={s.persona} data-componente="FilaReferido">
      <Avatar className={s.personaAvatar} nombre={anonima ? undefined : nombre} letras={1}>?</Avatar>
      <div className={s.personaCuerpo}>
        <div className={s.personaFila}>
          <strong className={s.personaNombre}>{nombre || <Texto>Visitante</Texto>}</strong>
          {chips.map((c) => <Etiqueta key={c.texto} tono={c.tono || 'neutro'} icono={c.icono}><Texto>{c.texto}</Texto></Etiqueta>)}
        </div>
        {detalle && <p className={s.personaDetalle}><Texto>{detalle}</Texto></p>}
        {acciones && <div className={s.personaAcciones}>{acciones}</div>}
        {children}
      </div>
      {ganancia > 0 && (
        <div className={s.personaGanancia}>
          <small><Texto>{confirmada ? 'Ganas' : 'Ganarías'}</Texto></small>
          <GananciaMonedas monto={ganancia} />
        </div>
      )}
    </li>
  );
}

/**
 * El pedido de un referido (detalleReferidoSecure): etapa, fecha, productos
 * y total.
 *  - etapa: { texto, tono } · paso: la fase del taller ("En Estampado…"),
 *    junto a la etapa · nota · fecha ("12 de octubre de 2026")
 *  - productos: [{ nombre, imagen, extra, cantidad }] · total ("S/ 120.00")
 *  - cargando · error: true o el mensaje del servidor
 */
export function DetallePedidoReferido({ etapa, paso, nota, fecha, productos = [], total, cargando = false, error = false }) {
  if (cargando) return <p className={s.detalleEstado} role="status"><Texto>Cargando el pedido…</Texto></p>;
  if (error) {
    return (
      <p className={s.detalleEstado} role="alert">
        <AlertCircle aria-hidden="true" /> <Texto>{typeof error === 'string' ? error : 'No pudimos cargar este pedido.'}</Texto>
      </p>
    );
  }
  return (
    <div className={s.detalle} data-componente="DetallePedidoReferido">
      <div className={s.detalleCabeza}>
        {etapa && <Etiqueta tono={etapa.tono || 'violeta'} punto><Texto>{etapa.texto}</Texto></Etiqueta>}
        {paso && <strong className={s.detallePaso}>{paso}</strong>}
      </div>
      {(nota || fecha) && (
        <p className={s.detalleFecha}>
          {nota && <Texto>{nota}</Texto>}
          {nota && fecha && ' '}
          {fecha && <><Texto>Comprado el</Texto> {fecha}.</>}
        </p>
      )}
      <ul className={s.detalleLista}>
        {productos.map((p, i) => (
          <li key={`${p.nombre}-${i}`}>
            <FotoProducto className={s.detalleFoto} src={p.imagen} respaldo={<Package aria-hidden="true" />} />
            <span className={s.detalleNombre}>
              {p.nombre}
              {p.extra && <small>{p.extra}</small>}
            </span>
            <span className={s.detalleCantidad}>×{p.cantidad || 1}</span>
          </li>
        ))}
      </ul>
      {total && <p className={s.detalleTotal}><Texto>Total del pedido:</Texto> <strong>{total}</strong></p>}
    </div>
  );
}

const TONO_PUESTO = ['oro', 'plata', 'bronce'];

/**
 * Los que más regalaron este mes (ReferralRanking): el puesto en un sello
 * (oro, plata y bronce para los tres primeros; sin emojis), el código, las
 * compras y las monedas.
 *  - items: [{ codigo, compras, monedas }] · cargando · tuCodigo: se resalta
 */
export function RankingReferidos({ items = [], cargando = false, tuCodigo }) {
  return (
    <TarjetaCuenta icono={<Trophy />} tono="oro" titulo={<Texto>Top regaleros del mes</Texto>} subtitulo={<Texto>Quiénes tuvieron más referidos que completaron su compra este mes.</Texto>}>
      {cargando ? (
        <ul className={s.ranking} aria-busy="true">{[0, 1, 2].map((k) => <li key={k}><EsqueletoFila foto="circulo" /></li>)}</ul>
      ) : !items.length ? (
        <p className={s.rankingVacio}><Texto>Aún no hay compras de referidos este mes. ¡Sé el primero!</Texto></p>
      ) : (
        <ol className={s.ranking}>
          {items.map((it, i) => (
            <li key={it.codigo} className={[s.puesto, it.codigo === tuCodigo && s.tuPuesto].filter(Boolean).join(' ')}>
              {i < 3 ? (
                <Sello tamano={34} tono={TONO_PUESTO[i]} girar={i === 1 ? 6 : -8}><span className={s.numeroPuesto}>{i + 1}</span></Sello>
              ) : <span className={s.puestoN}>{i + 1}</span>}
              <span className={s.codigoPuesto}>{it.codigo}{it.codigo === tuCodigo && <small><Texto>Tú</Texto></small>}</span>
              <span className={s.comprasPuesto}>{it.compras} <Texto>{it.compras === 1 ? 'compra' : 'compras'}</Texto></span>
              <span className={s.monedasPuesto}><Moneda /> {Number(it.monedas || 0).toLocaleString('es-PE')}</span>
            </li>
          ))}
        </ol>
      )}
    </TarjetaCuenta>
  );
}
