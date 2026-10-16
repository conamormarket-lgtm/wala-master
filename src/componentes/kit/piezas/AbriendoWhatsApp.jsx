import React from 'react';
import s from './AbriendoWhatsApp.module.css';

/*
 * La pestaña que se abre al pedir por WhatsApp (el checkout: "Continuar por
 * WhatsApp" o "Enviar a {marca}"). La tienda la abre en el clic con
 * window.open('') y le escribe este HTML mientras el servidor crea el pedido;
 * luego la lleva a wa.me. Por eso es HTML suelto (sin React ni CSS Modules):
 * la pestaña nueva no tiene la app cargada.
 *
 * Es la pantalla de carga de Walá (PantallaCarga: el degradado, la etiqueta
 * que se mece, WALÁ y la barra que va y viene) con lo que pasa ahora: qué
 * hacemos, los tres pasos y quién te atiende.
 */

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapar = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);

/**
 * El HTML de la pestaña "Abriendo WhatsApp".
 *  - origen: el de la tienda (window.location.origin), para las imágenes de la
 *    marca (la pestaña nueva no siempre resuelve rutas relativas)
 *  - marca: con varias marcas, la que recibe esta parte ("Con Amor Geeks")
 */
export function htmlAbriendoWhatsApp({ origen = '', marca } = {}) {
  const img = (nombre) => `${escapar(origen)}/assets/marca/${nombre}`;
  const asesor = marca ? `el asesor de ${escapar(marca)}` : 'un asesor';
  const Asesor = marca ? `El asesor de ${escapar(marca)}` : 'Un asesor';
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Abriendo WhatsApp… · Walá</title>
<style>
  *{box-sizing:border-box}
  html,body{height:100%;margin:0}
  body{display:flex;align-items:center;justify-content:center;padding:28px 20px;overflow-x:hidden;
    font-family:Poppins,system-ui,-apple-system,"Segoe UI",sans-serif;color:#fff;text-align:center;
    background:linear-gradient(135deg,#8b5cf6 0%,#5b21b6 100%)}
  /* Adornos quietos: puntos de medio tono y dos destellos. */
  .puntos{position:fixed;top:24px;right:20px;width:120px;height:80px;opacity:.22;pointer-events:none;
    background:radial-gradient(circle,#fff 2.2px,transparent 2.6px) 0 0/16px 16px}
  .destello{position:fixed;fill:#fff;pointer-events:none}
  .d1{top:13%;left:12%;width:22px;opacity:.75}.d2{top:20%;left:19%;width:12px;fill:#fcd34d}
  .caja{position:relative;display:flex;flex-direction:column;align-items:center;gap:16px;max-width:380px;width:100%}
  .etiqueta{width:80px;height:auto;transform-origin:75% 4%;animation:vaiven 2.4s ease-in-out infinite;
    filter:drop-shadow(0 5px 12px rgba(76,29,149,.28))}
  .palabra{width:116px;height:auto}
  .pista{position:relative;width:132px;height:4px;overflow:hidden;border-radius:999px;background:rgba(255,255,255,.22)}
  .barra{position:absolute;inset:0 auto 0 0;width:40%;border-radius:inherit;background:#fff;animation:vayviene 1.4s ease-in-out infinite}
  h1{margin:10px 0 0;font-family:Montserrat,Poppins,system-ui,sans-serif;font-size:26px;font-weight:900;letter-spacing:-.03em;line-height:1.1}
  .trazo{display:block;width:150px;height:10px;margin:6px auto 0;stroke:rgba(255,255,255,.7);fill:none;stroke-width:3;stroke-linecap:round}
  p{margin:0;font-size:15px;line-height:1.55;opacity:.9}
  ol{display:grid;gap:10px;width:100%;margin:6px 0 0;padding:16px;list-style:none;text-align:left;
    border:1px solid rgba(255,255,255,.22);border-radius:6px 22px 22px 22px;background:rgba(255,255,255,.1)}
  li{display:flex;align-items:center;gap:12px;font-size:14px;font-weight:600}
  li b{display:grid;place-items:center;flex-shrink:0;width:28px;height:28px;border-radius:50%;background:#fff;
    color:#5b21b6;font-family:Montserrat,Poppins,system-ui,sans-serif;font-weight:900;transform:rotate(-8deg)}
  li:nth-child(2) b{transform:rotate(6deg)}
  .wa{display:inline-flex;align-items:center;gap:8px;padding:8px 14px;border-radius:999px;background:rgba(255,255,255,.16);
    font-size:13px;font-weight:700}
  .punto{width:9px;height:9px;border-radius:50%;background:#25d366;box-shadow:0 0 0 3px rgba(37,211,102,.25)}
  small{max-width:300px;font-size:12px;line-height:1.5;opacity:.75}
  @keyframes vaiven{0%,100%{transform:rotate(-6deg)}50%{transform:rotate(6deg)}}
  @keyframes vayviene{0%{transform:translateX(-100%)}100%{transform:translateX(250%)}}
  @media (prefers-reduced-motion:reduce){.etiqueta,.barra{animation:none}.barra{width:100%;opacity:.6}}
</style></head>
<body>
  <span class="puntos" aria-hidden="true"></span>
  <svg class="destello d1" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 0c.8 6.4 4.6 10.6 12 12-7.4 1.4-11.2 5.6-12 12-.8-6.4-4.6-10.6-12-12C7.4 10.6 11.2 6.4 12 0z"/></svg>
  <svg class="destello d2" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 0c.8 6.4 4.6 10.6 12 12-7.4 1.4-11.2 5.6-12 12-.8-6.4-4.6-10.6-12-12C7.4 10.6 11.2 6.4 12 0z"/></svg>
  <main class="caja" role="status">
    <img class="etiqueta" src="${img('splash-etiqueta.webp')}" width="246" height="330" alt="" aria-hidden="true">
    <img class="palabra" src="${img('splash-wala.webp')}" alt="Walá">
    <span class="pista" aria-hidden="true"><span class="barra"></span></span>
    <h1>Creando tu pedido…<svg class="trazo" viewBox="0 0 150 10" aria-hidden="true"><path d="M3 7c30-5 70-6 144-3"/></svg></h1>
    <p>En un momento te llevamos a WhatsApp con tu pedido listo para enviar.</p>
    <ol aria-label="Lo que pasa ahora">
      <li><b>1</b>Guardamos tu pedido con su número</li>
      <li><b>2</b>Se abre WhatsApp con el detalle</li>
      <li><b>3</b>Envías el mensaje y ${asesor} te dice cómo pagar</li>
    </ol>
    <span class="wa"><span class="punto" aria-hidden="true"></span>${Asesor} te atenderá por WhatsApp</span>
    <small>Si WhatsApp no se abre, vuelve a la pestaña de Walá y toca el botón otra vez (no se crea un pedido repetido).</small>
  </main>
</body></html>`;
}

/**
 * La misma pestaña para verla dentro de la página (la demo y la guía): el
 * HTML de htmlAbriendoWhatsApp en un marco del tamaño de un teléfono.
 *  - marca · origen (por defecto, el de esta página) · alto (px)
 */
export function PantallaAbriendoWhatsApp({ marca, origen, alto = 720 }) {
  const html = htmlAbriendoWhatsApp({ origen: origen ?? (typeof window !== 'undefined' ? window.location.origin : ''), marca });
  return (
    <div className={s.telefono} data-componente="PantallaAbriendoWhatsApp">
      <iframe title="La pestaña de WhatsApp" srcDoc={html} className={s.marco} style={{ height: alto }} />
    </div>
  );
}
