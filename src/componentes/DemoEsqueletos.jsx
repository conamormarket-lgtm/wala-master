import React from 'react';
import {
  Hueso, EsqueletoTexto, EsqueletoCabeza, EsqueletoProducto, EsqueletoFila, EsqueletoPedido, EsqueletoTarjeta,
  EsqueletoFormulario, EsqueletoSeccion, EsqueletoPagina, Cargando, CapaCargando, MODULOS_ESQUELETO_CUENTA,
} from './kit';
import { Ficha } from './DemoPiezas';
import s from './DemoPiezas.module.css';

/*
 * Carga y esqueletos, sueltos: la pieza (Hueso), los esqueletos por
 * componente, uno por forma de sección del builder y por página. En la
 * Tienda de prueba, "Ver la carga" muestra el de la página que se está viendo.
 */
const FORMAS_SECCION = [
  ['banner', 'hero_carousel, hero_banner'],
  ['fila', 'carruseles de productos, flash_sales, bestsellers_row'],
  ['grilla', 'product_grid, featured_products'],
  ['catalogo', 'sidebar_catalog (filtros al costado en ancho)'],
  ['categorias', 'category_grid, categories_nav'],
  ['beneficios', 'trust_badges, feature_list'],
  ['testimonios', 'testimonials'],
  ['preguntas', 'faq_accordion'],
  ['marcas', 'marquee'],
  ['mosaico', 'banner_grid'],
  ['texto', 'header, text'],
  ['medio', 'image, video'],
  ['ubicacion', 'map_location'],
];
const FORMAS_PAGINA = [
  ['busqueda', 'Buscar: el buscador, chips, orden y resultados'],
  ['producto', 'La ficha de un producto: galería e información'],
  ['carrito', 'El carrito: líneas y resumen'],
  ['minijuegos', 'Zona Arcade: el encabezado y las tarjetas de juego'],
  ['encuesta', 'La encuesta: el avance y su tarjeta'],
  ['acceso', 'Login, registro, recuperar, completar perfil: los dos paneles'],
  ['lista', 'Una lista de pedidos suelta'],
  ['formulario', 'Un formulario suelto'],
];

export default function DemoEsqueletos() {
  return (
    <div className={s.rejilla}>
      <Ficha nombre="Hueso" usadaEn="La pieza de todos los esqueletos: linea, bloque, circulo, pildora (y claro sobre otro hueso)">
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <Hueso alto={12} ancho="70%" />
          <Hueso forma="bloque" alto={70} />
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <Hueso forma="circulo" ancho={44} alto={44} />
            <Hueso forma="pildora" alto={40} ancho={130} />
          </div>
        </div>
      </Ficha>
      <Ficha nombre="EsqueletoCabeza · EsqueletoTexto" usadaEn="Títulos de página y sección, párrafos">
        <div style={{ display: 'grid', gap: '1rem' }}>
          <EsqueletoCabeza />
          <EsqueletoTexto lineas={4} />
        </div>
      </Ficha>
      <Ficha nombre="CapaCargando" usadaEn="Esperar una acción: un pago, verificar un documento, subir un diseño, una landing que aún no se sabe cómo es">
        <div style={{ position: 'relative', minHeight: 200, borderRadius: 16, overflow: 'hidden', background: 'var(--color-hover)' }}>
          <CapaCargando texto="Procesando tu pago" detalle="No cierres esta página." />
        </div>
      </Ficha>
      <Ficha nombre="Cargando" usadaEn="La pieza de CapaCargando; también suelta en zonas chicas (un menú, un panel)">
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <Cargando tamano="sm" />
          <Cargando />
          <Cargando tamano="lg" texto="Cargando la tienda" />
        </div>
      </Ficha>
      <Ficha nombre="EsqueletoProducto" usadaEn="TarjetaProductoEsqueleto: grillas, carruseles, catálogo, creaciones, deseos">
        <div style={{ maxWidth: 220 }}><EsqueletoProducto /></div>
      </Ficha>
      <Ficha nombre="EsqueletoFila" usadaEn="Misiones, ranking de referidos, listas">
        <div style={{ display: 'grid', gap: '0.6rem' }}>
          <EsqueletoFila />
          <EsqueletoFila foto="circulo" />
        </div>
      </Ficha>
      <Ficha nombre="EsqueletoPedido" usadaEn="Mis pedidos y el detalle de una compra">
        <EsqueletoPedido />
      </Ficha>
      <Ficha nombre="EsqueletoTarjeta" usadaEn="Direcciones, cupones, personas de Fechas importantes">
        <EsqueletoTarjeta lineas={3} />
      </Ficha>
      <Ficha nombre="EsqueletoFormulario" usadaEn="Completar perfil, encuesta">
        <EsqueletoFormulario campos={3} />
      </Ficha>
      {FORMAS_SECCION.map(([forma, tipos]) => (
        <Ficha key={forma} nombre={`EsqueletoSeccion tipo="${forma}"`} usadaEn={tipos} ancho="1 / -1">
          <EsqueletoSeccion tipo={forma} />
        </Ficha>
      ))}
      {FORMAS_PAGINA.map(([forma, texto]) => (
        <Ficha key={forma} nombre={`EsqueletoPagina forma="${forma}"`} usadaEn={texto} ancho="1 / -1">
          <EsqueletoPagina forma={forma} />
        </Ficha>
      ))}
      <Ficha nombre={'EsqueletoPagina forma="cuenta" sesion={false}'} usadaEn="Mi cuenta y la encuesta sin sesión: la invitación a entrar" ancho="1 / -1">
        <EsqueletoPagina forma="cuenta" sesion={false} />
      </Ficha>
      <Ficha nombre={'EsqueletoPagina forma="minijuegos" sesion={false}'} usadaEn="Zona Arcade sin sesión: el aviso para entrar en vez del progreso" ancho="1 / -1">
        <EsqueletoPagina forma="minijuegos" sesion={false} />
      </Ficha>
      {MODULOS_ESQUELETO_CUENTA.map((modulo) => (
        <Ficha key={modulo} nombre={`EsqueletoPagina forma="cuenta" modulo="${modulo}"`} usadaEn="Mi cuenta: el menú al costado (en ancho) y lo de ese módulo" ancho="1 / -1">
          <EsqueletoPagina forma="cuenta" modulo={modulo} />
        </Ficha>
      ))}
    </div>
  );
}
