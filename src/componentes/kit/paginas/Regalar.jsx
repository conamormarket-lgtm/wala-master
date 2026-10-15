import React, { useState } from 'react';
import { Gift, CalendarHeart, Store, Download } from 'lucide-react';
import Boton from '../Boton';
import { Aviso, EstadoVacio } from '../Feedback';
import { Sello, Trazo } from '../Marca';
import { BloqueSeccion } from '../Seccion';
import { EsqueletoPagina } from '../Esqueletos';
import { CARAS_KAPI } from '../piezas/Flotantes';
import { PasoEstudio } from '../piezas/Estudio';
import { TarjetaRegalo, FechaEntrega, SobreRegalo } from '../piezas/Regalar';
import s from './Regalar.module.css';

/*
 * Regalarle a alguien desde su lista de deseos. Son páginas públicas: se
 * abren con el código de la persona (el de sus invitaciones), con o sin
 * sesión.
 *  - /wishlist/:código → PaginaListaPublica: su lista, "Regalar" en cada uno
 *  - /regalar/:código → PaginaRegalar: primero la fecha de entrega (sus
 *    fechas especiales) y después el regalo
 *  - /regalo/:pedido → PaginaRegaloSorpresa: quien lo recibe abre el sobre
 */

/** El encabezado de las dos páginas: sello del regalo, el título con su trazo y la bajada. */
function CabezaRegalo({ titulo, texto, accion }) {
  return (
    <header className={s.cabeza}>
      <Sello tamano={56} girar={-8}><Gift aria-hidden="true" /></Sello>
      <h1 className={s.titulo}>{titulo}<Trazo className={s.trazo} /></h1>
      {texto && <p className={s.texto}>{texto}</p>}
      {accion}
    </header>
  );
}

function NoEncontrada({ urlTienda, titulo = 'No encontramos esta lista' }) {
  return (
    <BloqueSeccion ajustes={{ paddingTop: '2rem', paddingBottom: '2.5rem' }}>
      <div className={s.estado}>
        <EstadoVacio imagen={CARAS_KAPI.triste} titulo={titulo} texto="El enlace no es válido o la lista ya no existe. Revisa que esté completo.">
          <Boton to={urlTienda} icono={<Store aria-hidden="true" />}>Ir a la tienda</Boton>
        </EstadoVacio>
      </div>
    </BloqueSeccion>
  );
}

/**
 * La lista de deseos de alguien (/wishlist/:código).
 *  - dueno: { nombre } · items: [{ id, producto: props de TarjetaProducto,
 *    regalado, disponible }] · onRegalar(item)
 *  - urlFechas: "Elegir el día de entrega" (/regalar/:código)
 *  - estado: 'cargando' | 'noEncontrada' · urlTienda
 */
export function PaginaListaPublica({ dueno = {}, items = [], onRegalar, urlFechas, estado, urlTienda = '/tienda' }) {
  if (estado === 'cargando') return <EsqueletoPagina forma="productos" />;
  if (estado === 'noEncontrada') return <NoEncontrada urlTienda={urlTienda} />;
  const nombre = dueno.nombre || 'Alguien';
  return (
    <BloqueSeccion ajustes={{ paddingTop: '1.75rem', paddingBottom: '2.5rem' }}>
      <div className={s.pagina} data-componente="PaginaListaPublica">
        <CabezaRegalo
          titulo={`La lista de deseos de ${nombre}`}
          texto="Elige algo de su lista y sorpréndele: tú pagas y nosotros se lo llevamos."
          accion={urlFechas && items.length > 0 && (
            <Boton to={urlFechas} variante="contorno" icono={<CalendarHeart aria-hidden="true" />}>Elegir el día de entrega</Boton>
          )}
        />
        {items.length === 0 ? (
          <EstadoVacio imagen={CARAS_KAPI.feliz} titulo="Su lista está vacía por ahora" texto="Vuelve más tarde o mira la tienda.">
            <Boton to={urlTienda} icono={<Store aria-hidden="true" />}>Ir a la tienda</Boton>
          </EstadoVacio>
        ) : (
          <ul className={s.rejilla}>
            {items.map((it) => (
              <li key={it.id}><TarjetaRegalo {...it} onRegalar={() => onRegalar?.(it)} /></li>
            ))}
          </ul>
        )}
      </div>
    </BloqueSeccion>
  );
}

/**
 * Regalar para una fecha (/regalar/:código): sus fechas especiales y su lista.
 *  - dueno: { nombre } · fechas: [{ id, ...props de FechaEntrega, fechaTexto
 *    ("24 de octubre") }] · items (como PaginaListaPublica)
 *  - onRegalar({ item, fecha }): fecha es null si no registró ninguna
 *  - estado: 'cargando' | 'noEncontrada' · urlTienda
 */
export function PaginaRegalar({ dueno = {}, fechas = [], items = [], onRegalar, estado, urlTienda = '/tienda' }) {
  const [elegida, setElegida] = useState(fechas[0]?.id);
  if (estado === 'cargando') return <EsqueletoPagina forma="productos" />;
  if (estado === 'noEncontrada') return <NoEncontrada urlTienda={urlTienda} titulo="No encontramos sus fechas" />;
  const nombre = dueno.nombre || 'Alguien';
  const fecha = fechas.find((f) => f.id === elegida);
  return (
    <BloqueSeccion ajustes={{ paddingTop: '1.75rem', paddingBottom: '2.5rem' }}>
      <div className={s.pagina} data-componente="PaginaRegalar">
        <CabezaRegalo
          titulo={`Regálale a ${nombre}`}
          texto="Elige una de sus fechas especiales y lo que quieras de su lista: llega ese día."
        />

        <PasoEstudio numero={1} titulo="Elige el día de entrega" detalle={fecha?.ocasion}>
          {fechas.length ? (
            <div className={s.fechas} role="radiogroup" aria-label="Fechas especiales">
              {fechas.map((f) => <FechaEntrega key={f.id} {...f} elegida={f.id === elegida} onElegir={() => setElegida(f.id)} />)}
            </div>
          ) : (
            <Aviso tipo="info" compacto>{nombre} todavía no registró fechas especiales. Igual puedes regalarle algo de su lista.</Aviso>
          )}
        </PasoEstudio>

        <PasoEstudio numero={2} titulo="Elige el regalo">
          {items.length === 0 ? (
            <p className={s.vacia}>Su lista está vacía por ahora. Vuelve más tarde.</p>
          ) : (
            <>
              <ul className={s.rejilla}>
                {items.map((it) => (
                  <li key={it.id}><TarjetaRegalo {...it} onRegalar={() => onRegalar?.({ item: it, fecha: fecha || null })} /></li>
                ))}
              </ul>
              {fecha && (
                <p className={s.entrega}>Se entrega el <strong>{fecha.fechaTexto}</strong> ({fecha.ocasion}) a <strong>{nombre}</strong>.</p>
              )}
            </>
          )}
        </PasoEstudio>
      </div>
    </BloqueSeccion>
  );
}

/**
 * Abrir un regalo (/regalo/:pedido): el sobre con Kapi y el mensaje; al
 * abrirlo, invita a la app (o a la tienda, si ya está en la app).
 *  - regalo: { para, mensaje, sticker } · enApp · urlDescargar · urlTienda
 *  - estado: 'cargando' | 'noEncontrado'
 */
export function PaginaRegaloSorpresa({ regalo = {}, enApp = false, urlDescargar = '/descargar', urlTienda = '/tienda', estado }) {
  const [abierto, setAbierto] = useState(false);
  if (estado === 'cargando') return <EsqueletoPagina forma="formulario" />;
  if (estado === 'noEncontrado') {
    return (
      <BloqueSeccion ajustes={{ paddingTop: '2rem', paddingBottom: '2.5rem' }}>
        <div className={s.estado}>
          <EstadoVacio imagen={CARAS_KAPI.triste} titulo="No encontramos este regalo" texto="Puede que el enlace esté incompleto. Pídele a quien te lo mandó que lo copie otra vez.">
            <Boton to={urlTienda} icono={<Store aria-hidden="true" />}>Ir a la tienda</Boton>
          </EstadoVacio>
        </div>
      </BloqueSeccion>
    );
  }
  return (
    <BloqueSeccion ajustes={{ paddingTop: '2rem', paddingBottom: '3rem' }}>
      <div className={s.sorpresa} data-componente="PaginaRegaloSorpresa">
        <p className={s.antetitulo}>{abierto ? 'Te mandaron un regalo' : 'Tienes un regalo'}</p>
        <SobreRegalo {...regalo} abierto={abierto} onAbrir={() => setAbierto(true)}>
          {enApp ? (
            <>
              <p className={s.invitacion}>¡Bienvenido a Walá! Mira la tienda y regala tú también.</p>
              <Boton to={urlTienda} icono={<Store aria-hidden="true" />}>Ver la tienda</Boton>
            </>
          ) : (
            <>
              <p className={s.invitacion}>Alguien pensó en ti. Descarga Walá para ver más y regalar tú también.</p>
              <Boton to={urlDescargar} icono={<Download aria-hidden="true" />}>Descargar Walá</Boton>
            </>
          )}
        </SobreRegalo>
      </div>
    </BloqueSeccion>
  );
}
