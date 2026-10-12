import React, { useState } from 'react';
import {
  TarjetaCategoria, TarjetaTestimonio, TarjetaMarca, LogoMarca, TarjetaDestacado, Beneficio, StockBajo, Chip, tarjetaDesdeMarca, acento,
} from './kit';
import s from './DemoPiezas.module.css';

/*
 * Piezas con las que se arman las secciones del builder. Cada una se puede
 * usar sola en cualquier pantalla (ficha de producto, cuenta, landing…).
 */

function Ficha({ nombre, usadaEn, children, ancho }) {
  return (
    <article className={s.ficha} style={ancho ? { gridColumn: ancho } : undefined}>
      <header>
        <code>{nombre}</code>
        <small>En: {usadaEn}</small>
      </header>
      <div className={s.lienzo}>{children}</div>
    </article>
  );
}

export default function DemoPiezas({ categorias, marcas, imagenes }) {
  const [activa, setActiva] = useState(null);
  const [filtro, setFiltro] = useState('Poleras');
  const marca = (k) => tarjetaDesdeMarca(marcas[k]);
  return (
    <div className={s.rejilla}>
      <Ficha nombre="TarjetaCategoria" usadaEn="Cuadrícula de categorías, Navegación por categorías" ancho="1 / -1">
        <div className={s.fila}>
          {categorias.slice(0, 3).map((c, k) => (
            <div key={c.categoryId} className={s.celda}><TarjetaCategoria forma={k === 1 ? 'circulo' : 'cuadro'} nombre={c.name} imagen={c.imageUrl} acento={acento(k)} url="/tienda" /></div>
          ))}
          <div className={s.burbujas}>
            <TarjetaCategoria forma="burbuja" todos nombre="Todos" activa={activa === null} onClick={() => setActiva(null)} />
            {categorias.slice(0, 4).map((c, k) => (
              <TarjetaCategoria key={c.categoryId} forma="burbuja" nombre={c.name} imagen={c.imageUrl} acento={acento(k)} activa={activa === c.categoryId} onClick={() => setActiva(c.categoryId)} />
            ))}
          </div>
        </div>
      </Ficha>

      <Ficha nombre="TarjetaMarca" usadaEn="Mosaico de marcas">
        <div className={s.marca}><TarjetaMarca marca={marca(3)} indice={0} /></div>
      </Ficha>

      <Ficha nombre="TarjetaTestimonio" usadaEn="Testimonios">
        <TarjetaTestimonio texto="La polera llegó igualita al diseño y la tela es súper suave." autor="Andrea P." ciudad="Lima" tema="Calidad" puntuacion={5} verificado giro={-0.8} />
      </Ficha>

      <Ficha nombre="LogoMarca" usadaEn="Logos en movimiento">
        <div className={s.fila}>
          {[0, 4, 5].map((k, i) => <LogoMarca key={k} nombre={marcas[k].name} imagen={marcas[k].logoUrl} forma={['square', 'circle', 'square'][i]} giro={i % 2 ? 4 : -4} url={`/${marcas[k].slug}`} />)}
        </div>
      </Ficha>

      <Ficha nombre="TarjetaDestacado" usadaEn="Lo más vendido">
        <div className={s.fila}>
          <div className={s.celda}><TarjetaDestacado titulo="Polera con tu foto" subtitulo="Estampado de alta duración" imagen={imagenes.frente} puesto={1} acento={acento(0)} url="/tienda" /></div>
          <div className={s.celda}><TarjetaDestacado titulo="Taza mágica" subtitulo="Aparece con el calor" imagen={imagenes.taza} puesto={2} acento={acento(1)} url="/tienda" /></div>
        </div>
      </Ficha>

      <Ficha nombre="Beneficio" usadaEn="Íconos de confianza (píldora), Lista de beneficios (fila)">
        <ul className={s.lista}>
          <Beneficio icono="camion" texto="Envío a todo el Perú" />
          <Beneficio variante="fila" icono="paleta" texto="Estampado que no se cuartea" numero={1} />
        </ul>
      </Ficha>

      <Ficha nombre="StockBajo / BarraProgreso" usadaEn="Ofertas relámpago">
        <div className={s.lista}>
          <StockBajo stock={14} />
          <StockBajo stock={3} />
        </div>
      </Ficha>

      <Ficha nombre="Chip" usadaEn="Catálogo con filtros">
        <div className={s.fila}>
          {['Poleras', 'Tazas'].map((f) => <Chip key={f} tamano="sm" cuenta={f === 'Poleras' ? 2 : 1} activo={filtro === f} onClick={() => setFiltro(f)}>{f}</Chip>)}
          <Chip tamano="sm" onQuitar={() => {}}>S/ 50 – 100</Chip>
        </div>
      </Ficha>
    </div>
  );
}
