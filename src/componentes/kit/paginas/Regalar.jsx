import React, { useState } from 'react';
import { Gift, CalendarHeart, Store, Download } from 'lucide-react';
import Boton from '../Boton';
import { Aviso, EstadoVacio } from '../Feedback';
import { Sello, Trazo } from '../Marca';
import { BloqueSeccion } from '../Seccion';
import { EsqueletoPagina } from '../Esqueletos';
import { CARAS_KAPI } from '../piezas/Flotantes';
import { PasoEstudio } from '../piezas/PasoEstudio';
import { TarjetaRegalo, FechaEntrega, SobreRegalo } from '../piezas/Regalar';
import { TextoResaltado } from '../piezas/TextoResaltado';
import { Texto, useTexto } from '../Traduccion';
import s from './Regalar.module.css';

/*
 * Regalarle a alguien desde su lista de deseos. Son páginas públicas: se
 * abren con el código de la persona (el de sus invitaciones), con o sin
 * sesión.
 *  - /wishlist/:código → PaginaListaPublica: su lista, "Regalar" en cada uno
 *  - /regalar/:código → PaginaRegalar: primero la fecha de entrega (sus
 *    fechas especiales) y después el regalo
 *  - /regalo/:pedido → PaginaRegaloSorpresa: quien lo recibe abre el sobre
 * Los textos fijos pasan por la traducción (<Texto>); el nombre de la
 * persona va tal cual.
 */

/** El encabezado de las dos páginas: sello del regalo, el título con su trazo y la bajada (traducidos aquí). */
function CabezaRegalo({ titulo, texto, accion }) {
  return (
    <header className={s.cabeza}>
      <Sello tamano={56} girar={-8}><Gift aria-hidden="true" /></Sello>
      <h1 className={s.titulo}><Texto>{titulo}</Texto><Trazo className={s.trazo} /></h1>
      {texto && <p className={s.texto}><Texto>{texto}</Texto></p>}
      {accion}
    </header>
  );
}

// Sin la cara de Kapi: en la tienda ya está el flotante (un solo Kapi a la vista).
function NoEncontrada({ urlTienda, titulo = 'No encontramos esta lista' }) {
  return (
    <BloqueSeccion ajustes={{ paddingTop: '2rem', paddingBottom: '2.5rem' }}>
      <div className={s.estado}>
        <EstadoVacio imagen={null} titulo={<Texto>{titulo}</Texto>} texto={<Texto>El enlace no es válido o la lista ya no existe. Revisa que esté completo.</Texto>}>
          <Boton to={urlTienda} icono={<Store aria-hidden="true" />}><Texto>Ir a la tienda</Texto></Boton>
        </EstadoVacio>
      </div>
    </BloqueSeccion>
  );
}

/**
 * La lista de deseos de alguien (/wishlist/:código).
 *  - dueno: { nombre } · items: [{ id, producto: props de TarjetaProducto,
 *    regalado, disponible, cargando }] (itemRegaloDesde) · onRegalar(item)
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
            <Boton to={urlFechas} variante="contorno" icono={<CalendarHeart aria-hidden="true" />}><Texto>Elegir el día de entrega</Texto></Boton>
          )}
        />
        {items.length === 0 ? (
          <EstadoVacio imagen={null} icono={<Gift />} titulo={<Texto>Su lista está vacía por ahora</Texto>} texto={<Texto>Vuelve más tarde o mira la tienda.</Texto>}>
            <Boton to={urlTienda} icono={<Store aria-hidden="true" />}><Texto>Ir a la tienda</Texto></Boton>
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
 * Viene elegida la primera fecha, también si las fechas llegan después de montar.
 */
export function PaginaRegalar({ dueno = {}, fechas = [], items = [], onRegalar, estado, urlTienda = '/tienda' }) {
  const [tocada, setElegida] = useState(null);
  const etiquetaFechas = useTexto('Fechas especiales');
  if (estado === 'cargando') return <EsqueletoPagina forma="productos" />;
  if (estado === 'noEncontrada') return <NoEncontrada urlTienda={urlTienda} titulo="No encontramos sus fechas" />;
  const nombre = dueno.nombre || 'Alguien';
  const elegida = fechas.some((f) => f.id === tocada) ? tocada : fechas[0]?.id;
  const fecha = fechas.find((f) => f.id === elegida);
  return (
    <BloqueSeccion ajustes={{ paddingTop: '1.75rem', paddingBottom: '2.5rem' }}>
      <div className={s.pagina} data-componente="PaginaRegalar">
        <CabezaRegalo
          titulo={`Regálale a ${nombre}`}
          texto="Elige una de sus fechas especiales y lo que quieras de su lista: llega ese día."
        />

        <PasoEstudio numero={1} titulo={<Texto>Elige el día de entrega</Texto>} detalle={fecha?.ocasion && <Texto>{fecha.ocasion}</Texto>}>
          {fechas.length ? (
            <div className={s.fechas} role="radiogroup" aria-label={etiquetaFechas}>
              {fechas.map((f) => <FechaEntrega key={f.id} {...f} elegida={f.id === elegida} onElegir={() => setElegida(f.id)} />)}
            </div>
          ) : (
            <Aviso tipo="info" compacto>{`${nombre} todavía no registró fechas especiales. Igual puedes regalarle algo de su lista.`}</Aviso>
          )}
        </PasoEstudio>

        <PasoEstudio numero={2} titulo={<Texto>Elige el regalo</Texto>}>
          {items.length === 0 ? (
            <p className={s.vacia}><Texto>Su lista está vacía por ahora. Vuelve más tarde.</Texto></p>
          ) : (
            <>
              <ul className={s.rejilla}>
                {items.map((it) => (
                  <li key={it.id}><TarjetaRegalo {...it} onRegalar={() => onRegalar?.({ item: it, fecha: fecha || null })} /></li>
                ))}
              </ul>
              {fecha && (
                <p className={s.entrega}>
                  <TextoResaltado resaltar={[fecha.fechaTexto, nombre]}>
                    {`Se entrega el ${fecha.fechaTexto} (${fecha.ocasion}${fecha.nombre && fecha.nombre !== dueno.nombre ? ` de ${fecha.nombre}` : ''}) a ${nombre}.`}
                  </TextoResaltado>
                </p>
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
          <EstadoVacio imagen={CARAS_KAPI.triste} titulo={<Texto>No encontramos este regalo</Texto>} texto={<Texto>Puede que el enlace esté incompleto. Pídele a quien te lo mandó que lo copie otra vez.</Texto>}>
            <Boton to={urlTienda} icono={<Store aria-hidden="true" />}><Texto>Ir a la tienda</Texto></Boton>
          </EstadoVacio>
        </div>
      </BloqueSeccion>
    );
  }
  return (
    <BloqueSeccion ajustes={{ paddingTop: '2rem', paddingBottom: '3rem' }}>
      <div className={s.sorpresa} data-componente="PaginaRegaloSorpresa">
        <p className={s.antetitulo}><Texto>{abierto ? 'Te mandaron un regalo' : 'Tienes un regalo'}</Texto></p>
        <SobreRegalo {...regalo} abierto={abierto} onAbrir={() => setAbierto(true)}>
          {enApp ? (
            <>
              <p className={s.invitacion}><Texto>¡Bienvenido a Walá! Mira la tienda y regala tú también.</Texto></p>
              <Boton to={urlTienda} icono={<Store aria-hidden="true" />}><Texto>Ver la tienda</Texto></Boton>
            </>
          ) : (
            <>
              <p className={s.invitacion}><Texto>Alguien pensó en ti. Descarga Walá para ver más y regalar tú también.</Texto></p>
              <Boton to={urlDescargar} icono={<Download aria-hidden="true" />}><Texto>Descargar Walá</Texto></Boton>
            </>
          )}
        </SobreRegalo>
      </div>
    </BloqueSeccion>
  );
}
