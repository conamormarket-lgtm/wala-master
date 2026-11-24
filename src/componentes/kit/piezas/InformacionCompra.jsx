import React from 'react';
import { Check, MessageCircle, Truck, ShieldCheck } from 'lucide-react';
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
  return <div className={s.compra} data-componente="InformacionCompra">
    {personalizable && c.personalizationNote && <p className={s.nota}><strong><Texto>Personalización</Texto></strong><Texto>{c.personalizationNote}</Texto></p>}
    {c.paymentNote && <p className={s.nota}><Texto>{c.paymentNote}</Texto></p>}
    {c.steps.length > 0 && <ol className={s.pasos}>{c.steps.map(x => <li key={x.id}><Texto>{x.text}</Texto></li>)}</ol>}
    {(c.delivery || c.showShippingRate) && <div className={s.condicion}><Truck size={20} aria-hidden="true" /><div><strong><Texto>Entrega</Texto></strong>
      {c.showShippingRate && <p><Texto>{`Envío estándar: ${costoEnvio(subtotal) === 0 ? 'gratis para este subtotal' : `S/ ${ENVIO_ESTANDAR.toFixed(2)}`}. Gratis en compras mayores a S/ ${ENVIO_GRATIS_DESDE}. Revisa cobertura y fecha final al pagar.`}</Texto></p>}
      {c.delivery && <p><Texto>{c.delivery}</Texto></p>}
    </div></div>}
    {c.warranty && <div className={s.condicion}><ShieldCheck size={20} aria-hidden="true" /><div><strong><Texto>Garantía y cambios</Texto></strong><p><Texto>{c.warranty}</Texto></p></div></div>}
    {c.policyUrl && <Enlace to={c.policyUrl} className={s.enlace}><Texto>Consultar condiciones</Texto></Enlace>}
    {c.showHelp && whatsapp?.numero && <a className={s.ayuda} onClick={onHelp} href={`https://wa.me/${whatsapp.numero}?text=${encodeURIComponent(whatsapp.mensaje || '')}`} target="_blank" rel="noopener noreferrer"><MessageCircle size={19} aria-hidden="true" /><Texto>{c.helpLabel}</Texto></a>}
  </div>;
}

export function EspecificacionesProducto({ config }) {
  const c = normalizeProductCommerce(config);
  if (!c.specifications.length) return null;
  return <section className={s.especificaciones}><h2><Texto>Características del producto</Texto></h2><dl>{c.specifications.map(x => <div key={x.id}><dt><Texto>{x.label}</Texto></dt><dd><Texto>{x.value}</Texto></dd></div>)}</dl></section>;
}

export function ColeccionDestacadaProducto({ config, resolverMedia }) {
  const c = normalizeProductCommerce(config, { allowLocal: Boolean(resolverMedia) }).collection;
  if (!c.enabled || !c.href || !c.title) return null;
  return <aside className={s.coleccion}>{c.image && <img src={resolverMedia ? resolverMedia(c.image) : c.image} alt="" loading="lazy" />}<div><h2><Texto>{c.title}</Texto></h2>{c.text && <p><Texto>{c.text}</Texto></p>}<Enlace to={c.href} className={s.ayuda}><Texto>{c.label}</Texto> →</Enlace></div></aside>;
}
