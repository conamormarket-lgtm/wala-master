import React, { useState } from 'react';
import {
  TarjetaCategoria, TarjetaTestimonio, TarjetaMarca, LogoMarca, TarjetaDestacado, Beneficio, StockBajo, Chip, tarjetaDesdeMarca, acento,
  FotoProducto, Avatar, Moneda, EtiquetaColgante, OpcionesFiltro, Acordeon, TarjetaJuego, Etiqueta, GananciaMonedas,
  Aviso, CuentaRegresiva, IconoWala, BarraProgreso,
} from './kit';
import { Lock } from 'lucide-react';
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

/* Opciones de ejemplo para los filtros (nombres reales de personajes). */
const PERSONAJES = ['Akaza', 'Asta', 'Eren Yeager', 'Gohan', 'Goku', 'Inosuke', 'Itachi Uchiha', 'Kakashi', 'Luffy', 'Nezuko', 'Rengoku', 'Zoro', 'Sanji', 'Tanjiro']
  .map((nombre, k) => ({ valor: nombre, nombre, cuenta: (k % 4) + 1 }));

export default function DemoPiezas({ categorias, marcas, imagenes }) {
  const [activa, setActiva] = useState(null);
  const [personaje, setPersonaje] = useState('Goku');
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

      <Ficha nombre={'LogoMarca variante="sello"'} usadaEn="Sello de la marca en TarjetaProducto, menú Marcas de la cabecera">
        <div className={s.filaCentrada}>
          {[0, 4, 5].map((k) => <LogoMarca key={k} variante="sello" nombre={marcas[k].name} imagen={marcas[k].logoUrl} />)}
          <LogoMarca variante="sello" nombre="Marca sin logo" />
        </div>
      </Ficha>

      <Ficha nombre="FotoProducto" usadaEn="Miniaturas del carrito, pedidos, toasts, notificaciones, menús, Agregar rápido, piezas de un combo, TarjetaDestacado, burbujas de categoría">
        <div className={s.filaCentrada}>
          <FotoProducto className={s.fotoGrande} src={imagenes.frente} relleno="6%">
            <EtiquetaColgante tono="violeta" tamano="sm" className={s.fotoEtiqueta}>#1</EtiquetaColgante>
          </FotoProducto>
          <FotoProducto className={s.fotoMini} src={imagenes.taza} relleno="4px" />
          <FotoProducto className={s.fotoMini} src={imagenes.frente} relleno="3px" />
          <FotoProducto className={s.fotoMini} respaldo="P" />
        </div>
      </Ficha>

      <Ficha nombre="Avatar" usadaEn="Cabecera, barra inferior, menú de la cuenta, testimonios">
        <div className={s.filaCentrada}>
          <Avatar className={s.avatarGrande} nombre="Isaac Castro" />
          <Avatar className={s.avatarMini} nombre="Andrea P." letras={1} />
          <Avatar className={s.avatarMini} />
        </div>
      </Ficha>

      <Ficha nombre="OpcionesFiltro" usadaEn="Catálogo con filtros (cada grupo), búsqueda">
        <OpcionesFiltro opciones={PERSONAJES} elegida={personaje} onElegir={setPersonaje} limite={6} />
      </Ficha>

      <Ficha nombre={'Acordeon variante="lista"'} usadaEn="Grupos de filtros del catálogo (las preguntas frecuentes usan la variante de tarjetas)">
        <Acordeon
          variante="lista"
          multiple
          abiertoInicial={['personajes']}
          items={[
            { id: 'categorias', question: 'Categorías', answer: <OpcionesFiltro opciones={[{ valor: 'casacas', nombre: 'Casacas', cuenta: 21 }, { valor: 'relojes', nombre: 'Relojes', cuenta: 1 }]} /> },
            { id: 'personajes', question: 'Personajes', extra: personaje && <small className={s.elegido}>{personaje}</small>, answer: <OpcionesFiltro opciones={PERSONAJES} elegida={personaje} onElegir={setPersonaje} limite={4} /> },
            { id: 'nota', question: 'Con texto', answer: 'Una respuesta de texto se ve como párrafo, igual que en preguntas frecuentes.' },
          ]}
        />
      </Ficha>

      <Ficha nombre="TarjetaJuego" usadaEn="Zona Arcade (/minijuegos)" ancho="1 / -1">
        <div className={s.juegos}>
          <TarjetaJuego
            imagen="/assets/kapi/banners/bolitas.webp"
            titulo="Las Bolitas de Kapi"
            descripcion="Ordena los colores en los tubos para ganar 2 monedas al día."
            estado={{ texto: 'Disponible hoy', tono: 'violeta', punto: true }}
            recompensa={{ texto: '+2 monedas al día' }}
            accion={{ tipo: 'jugar', texto: 'Jugar ahora', url: '/ball-sort' }}
          />
          <TarjetaJuego
            imagen="/assets/kapi/banners/ruleta.webp"
            titulo="Ruleta Semanal"
            descripcion="Reclama tu moneda los 7 días para girar la ruleta."
            estado={{ texto: 'Bloqueada', tono: 'neutro' }}
            recompensa={{ texto: 'Premio semanal', icono: 'regalo' }}
            racha={{ dias: 4 }}
            nota={{ tipo: 'bloqueo', texto: 'Reclama 7 días seguidos para desbloquearla.' }}
            accion={{ tipo: 'bloqueado', texto: 'Bloqueada' }}
            espera="Te faltan 3 días de racha"
            atenuada
            bloqueada
          />
        </div>
      </Ficha>

      <Ficha nombre="Para la Zona Arcade (mejoras)" usadaEn="Etiqueta punto · sobreFoto, GananciaMonedas con texto, BarraProgreso pasos, Aviso compacto, CuentaRegresiva frase">
        <div className={s.columna}>
          <div className={s.filaCentrada}>
            <Etiqueta tono="aviso" punto>Disponible hoy</Etiqueta>
            <Etiqueta tono="exito" sobreFoto>Hecho hoy</Etiqueta>
            <GananciaMonedas>Hasta +4 monedas al acertar</GananciaMonedas>
            <GananciaMonedas icono={<IconoWala nombre="regalo" tamano={18} />}>Premio semanal</GananciaMonedas>
          </div>
          <BarraProgreso pasos valor={4} max={7} texto={<><span>Días reclamados</span><strong>4/7</strong></>} />
          <Aviso compacto icono={<Lock aria-hidden="true" />}>Reclama 7 días seguidos para desbloquearla.</Aviso>
          <CuentaRegresiva variante="frase" hasta={new Date(Date.now() + 7.8 * 3600 * 1000).toISOString()} etiqueta="Disponible de nuevo en" />
        </div>
      </Ficha>

      <Ficha nombre="Moneda" usadaEn="Saldo, costo y ganancia en monedas, Mis monedas, resumen del pedido">
        <div className={s.filaCentrada}>
          <Moneda />
          <Moneda tamano={20} />
          <Moneda tamano={40} />
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
