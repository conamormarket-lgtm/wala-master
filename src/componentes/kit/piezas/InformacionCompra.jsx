import React from 'react';
import { Check, Truck, ShieldCheck, ClipboardList } from 'lucide-react';
import Boton from '../Boton';
import Acordeon from '../Acordeon';
import { Texto } from '../Traduccion';
import { Enlace } from '../Enlace';
import { ENVIO_ESTANDAR, ENVIO_GRATIS_DESDE, costoEnvio } from '../../../constants/envio';
import { normalizeProductCommerce } from '../../../utils/productCommerce.mjs';
import s from './InformacionCompra.module.css';

export function BeneficiosProducto({ config }) {
  const c = normalizeProductCommerce(config);
  return <>{c.subtitle && <p className={s.subtitulo}><Texto>{c.subtitle}</Texto></p>}
    {c.highlights.length > 0 && <ul className={s.beneficios}>{c.highlights.filter(x => x.text.trim()).map(x => <li key={x.id}><Check size={17} aria-hidden="true" /><Texto>{x.text}</Texto></li>)}</ul>}</>;
}

export function InformacionCompra({ config, subtotal = 0, personalizable, whatsapp, onHelp }) {
  const c = normalizeProductCommerce(config);
  const title = (Icon, label) => <span className={s.tituloInformacion}><Icon size={20} aria-hidden="true" /><Texto>{label}</Texto></span>;
  const condiciones = [
    ...(c.information || c.specifications.length ? [{ id: 'caracteristicas', question: title(ClipboardList, c.informationTitle), answer: <>
      {c.information && <p className={s.textoInformacion}><Texto>{c.information}</Texto></p>}
      {c.specifications.length > 0 && <dl className={s.fichaTecnica}>{c.specifications.map(x => <div key={x.id}><dt><Texto>{x.label}</Texto></dt><dd><Texto>{x.value}</Texto></dd></div>)}</dl>}
    </> }] : []),
    ...(c.warranty || c.policyUrl ? [{ id: 'garantia', question: title(ShieldCheck, c.warrantyTitle), answer: <>
      {c.warranty && <p className={s.textoInformacion}><Texto>{c.warranty}</Texto></p>}
      {c.policyUrl && <Enlace to={c.policyUrl} className={s.enlace}><Texto>Consultar condiciones</Texto></Enlace>}
    </> }] : []),
    ...(c.delivery || c.showShippingRate ? [{ id: 'entrega', question: title(Truck, c.deliveryTitle), answer: <>
      {c.delivery && <p className={s.textoInformacion}><Texto>{c.delivery}</Texto></p>}
      {c.showShippingRate && <p className={s.textoInformacion}><Texto>{`Envío estándar: ${costoEnvio(subtotal) === 0 ? 'gratis para este subtotal' : `S/ ${ENVIO_ESTANDAR.toFixed(2)}`}. Gratis en compras mayores a S/ ${ENVIO_GRATIS_DESDE}. Revisa cobertura y fecha final al pagar.`}</Texto></p>}
    </> }] : []),
  ];
  return <div className={s.compra} data-componente="InformacionCompra">
    {personalizable && c.personalizationNote && <p className={s.nota}><strong><Texto>Personalización</Texto></strong><Texto>{c.personalizationNote}</Texto></p>}
    {c.paymentNote && <p className={s.nota}><Texto>{c.paymentNote}</Texto></p>}
    {c.steps.length > 0 && <ol className={s.pasos}>{c.steps.map(x => <li key={x.id}><Texto>{x.text}</Texto></li>)}</ol>}
    {condiciones.length > 0 && <div className={s.informacion} aria-label="Información del producto"><Acordeon variante="lista" multiple items={condiciones} /></div>}
    {c.showHelp && whatsapp?.numero && <Boton accion="whatsapp" variante="contorno" bloque onClick={onHelp} to={`https://wa.me/${whatsapp.numero}?text=${encodeURIComponent(whatsapp.mensaje || '')}`}><Texto>{c.helpLabel}</Texto></Boton>}
  </div>;
}

export function ColeccionDestacadaProducto({ config, resolverMedia }) {
  const c = normalizeProductCommerce(config, { allowLocal: Boolean(resolverMedia) }).collection;
  if (!c.enabled || !c.href || !c.title) return null;
  return <aside className={s.coleccion}>{c.image && <img src={resolverMedia ? resolverMedia(c.image) : c.image} alt="" loading="lazy" />}<div><h2><Texto>{c.title}</Texto></h2>{c.text && <p><Texto>{c.text}</Texto></p>}<Enlace to={c.href} className={s.ayuda}><Texto>{c.label}</Texto> →</Enlace></div></aside>;
}
