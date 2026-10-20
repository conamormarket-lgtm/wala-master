import React, { useEffect, useState } from 'react';
import { Store } from 'lucide-react';
import Boton from '../Boton';
import { EstadoVacio, Aviso } from '../Feedback';
import { ChipsBusqueda, InvitacionBusqueda } from '../piezas/PanelBusqueda';
import { Destello } from '../Marca';
import { BloqueSeccion } from '../Seccion';
import { CatalogoConFiltros } from '../SeccionesExtra';
import { Buscador } from '../Formulario';
import { CARAS_KAPI } from '../piezas/Flotantes';
import { TextoResaltado } from '../piezas/TextoResaltado';
import { useTexto } from '../Traduccion';
import s from './Busqueda.module.css';

/* ── Búsqueda (/buscar) ─────────────────────────────────── */

const TEXTOS = {
  titulo: 'Buscar productos',
  subtitulo: 'Escribe qué buscas y afina con los filtros.',
  marcador: '¿Qué buscas? (polo, taza, gorro…)',
  marcadorCorto: '¿Qué buscas?',
  boton: 'Buscar',
  vacioTitulo: 'Sin resultados',
  vacioTexto: 'Prueba con otra palabra: una más corta o más general suele encontrar más.',
  vacioConFiltros: 'Prueba a quitar algún filtro o a buscar otra palabra.',
};

const sinCambio = (nodo) => nodo;

/**
 * Página de resultados: el término, un buscador grande con su botón y los
 * resultados en el MISMO catálogo con filtros de /tienda (con "Ordenar por" y
 * el grupo Modalidad). Sin resultados y sin filtros, Kapi lo dice; con
 * filtros, el catálogo sigue a la vista para poder quitarlos.
 *
 *  - termino, onBuscar(texto)
 *  - productos: resultados ya ordenados (ordenarProductos) · cargando · hayMas,
 *    onCargarMas, cargandoMas (cursor de searchProductsFirestore)
 *  - grupos: grupos de filtros (grupoModalidad + gruposDeCatalogo de los
 *    resultados) · seleccion / onFiltrar (filtran aquí, sobre los resultados)
 *  - orden, onOrden · ordenes (ORDENES_BUSQUEDA)
 *  - marcaFiltro: { nombre, urlTodo } si la búsqueda está acotada a una marca
 *  - ideas: términos para empezar ("Lo más buscado", sin término) y para
 *    probar cuando no hay resultados
 *  - catalogo, onAgregar: para las tarjetas · tarjeta, columnas, segundaFoto:
 *    como GrillaProductos (en la tienda, la tarjeta de la tienda)
 *  - sinKapi: el vacío lleva un sello y no a Kapi (con sesión ya está el
 *    flotante: uno solo a la vista)
 *  - envolverMostrador(nodo): envuelve el mostrador (en la tienda, el marco
 *    del editor visual: `EditableSection` de "Buscador")
 *  - textos: { titulo, subtitulo, marcador, boton, vacioTitulo, vacioTexto,
 *    vacioConFiltros } (los edita el admin en storeConfig/homePage.searchPage).
 *    Sin `titulo` del admin, el encabezado pregunta "¿Qué se te antoja hoy?".
 */
export function PaginaBusqueda({
  termino = '', onBuscar, productos = [], cargando = false, hayMas, onCargarMas, cargandoMas,
  grupos = [], seleccion, onFiltrar, orden = 'newest', onOrden, ordenes = [], marcaFiltro, catalogo, onAgregar, textos = {},
  ideas = [], tarjeta, columnas, segundaFoto, sinKapi = false, envolverMostrador = sinCambio,
}) {
  // En pantallas angostas la frase con ejemplos se cortaba ("…(pol"): ahí
  // va la pregunta corta, como el buscador de la tienda en el celular.
  const angosta = useAngosta(560);
  const propios = { ...TEXTOS, ...(angosta ? { marcador: TEXTOS.marcadorCorto } : {}), ...textos };
  // El vacío (EstadoVacio), los botones (Boton, también el del Buscador) y el marcador del Buscador traducen lo suyo: van sin traducir.
  const t = {
    afinar: useTexto('Afina por categoría'),
    masBuscado: useTexto('Lo más buscado'),
    probar: useTexto('Prueba con'),
  };
  const hayFiltros = Object.values(seleccion || {}).some((v) => v != null);
  // Con término: las categorías de los resultados como atajos para afinar (el
  // mismo filtro de la columna). Sin término: lo más buscado.
  const categorias = grupos.find((g) => g.id === 'categoria');
  const conResultados = (categorias?.opciones || []).filter((o) => o.cuenta == null || o.cuenta > 0);
  const afinar = termino && productos.length > 0 && conResultados.length > 1
    ? conResultados.slice(0, 6).map((o) => ({
      id: o.valor,
      texto: o.nombre,
      cuenta: o.cuenta,
      imagen: catalogo?.categorias?.find((c) => (c.categoryId || c.id) === o.valor)?.imageUrl,
      activo: seleccion?.categoria === o.valor,
      onClick: () => onFiltrar?.('categoria', seleccion?.categoria === o.valor ? null : o.valor),
    }))
    : [];
  const sugeridas = ideas.map((idea) => ({ texto: idea, onClick: () => onBuscar?.(idea) }));
  return (
    <>
      <BloqueSeccion ajustes={{ paddingTop: '1.5rem', paddingBottom: '0.75rem' }}>
        {/* El "mostrador" de la búsqueda: lo buscado en grande con la voz de
            Walá, el buscador y los atajos, en una tarjeta propia. */}
        {envolverMostrador(
          <div className={s.busquedaCabeza}>
            <Destello className={s.busquedaDestello1} />
            <Destello className={s.busquedaDestello2} />
            <div className={s.busquedaTitulo}>
              <InvitacionBusqueda grande como="h1" termino={termino} titulo={textos.titulo} texto={propios.subtitulo} />
            </div>
            {marcaFiltro && (
              <Aviso compacto icono={<Store aria-hidden="true" />} accion={marcaFiltro.urlTodo && <Boton to={marcaFiltro.urlTodo} variante="fantasma" tamano="sm">Buscar en todo el catálogo</Boton>}>
                <TextoResaltado resaltar={[marcaFiltro.nombre]}>{`Buscando solo en ${marcaFiltro.nombre}`}</TextoResaltado>
              </Aviso>
            )}
            <Buscador
              key={termino}
              grande
              atajo={null}
              boton={propios.boton}
              placeholder={propios.marcador}
              defaultValue={termino}
              onBuscar={onBuscar}
            />
            {afinar.length > 0 && (
              <div className={s.busquedaAtajos}>
                <span className={s.busquedaAtajosTitulo}>{t.afinar}</span>
                <ChipsBusqueda tipo="afinar" items={afinar} />
              </div>
            )}
            {!termino && sugeridas.length > 0 && (
              <div className={s.busquedaAtajos}>
                <span className={s.busquedaAtajosTitulo}>{t.masBuscado}</span>
                <ChipsBusqueda tipo="idea" items={sugeridas} />
              </div>
            )}
          </div>,
        )}
      </BloqueSeccion>
      <BloqueSeccion ajustes={{ paddingTop: '0.75rem', paddingBottom: '2.5rem' }}>
        {!cargando && productos.length === 0 && !hayFiltros ? (
          <EstadoVacio imagen={sinKapi ? null : CARAS_KAPI.triste} titulo={propios.vacioTitulo} texto={termino ? propios.vacioTexto : propios.subtitulo}>
            {sugeridas.length > 0 && (
              <div className={s.busquedaProbar}>
                <span className={s.busquedaAtajosTitulo}>{t.probar}</span>
                <ChipsBusqueda tipo="idea" items={sugeridas} />
              </div>
            )}
          </EstadoVacio>
        ) : (
          <CatalogoConFiltros
            // Con los filtros ya llegados, de nuevo: así abre el primer grupo
            // (Modalidad), que al montarse todavía no existía.
            key={`${termino}|${grupos.length > 0}`}
            productos={productos}
            grupos={grupos}
            seleccion={seleccion}
            onFiltrar={onFiltrar}
            filtrarAqui
            conBuscador={false}
            unidad={['resultado', 'resultados']}
            orden={{ opciones: ordenes, valor: orden, onCambiar: onOrden }}
            cargando={cargando}
            hayMas={hayMas}
            onCargarMas={onCargarMas}
            cargandoMas={cargandoMas}
            catalogo={catalogo}
            onAgregar={onAgregar}
            tarjeta={tarjeta}
            columnas={columnas}
            segundaFoto={segundaFoto}
            sinKapi={sinKapi}
            vacio={{ titulo: propios.vacioTitulo, texto: propios.vacioConFiltros }}
          />
        )}
      </BloqueSeccion>
    </>
  );
}

/** ¿La ventana mide `px` o menos? Se actualiza al girar o redimensionar. */
function useAngosta(px) {
  const consulta = `(max-width: ${px}px)`;
  const [angosta, setAngosta] = useState(() => typeof window !== 'undefined' && window.matchMedia(consulta).matches);
  useEffect(() => {
    const mq = window.matchMedia(consulta);
    const cambio = () => setAngosta(mq.matches);
    mq.addEventListener('change', cambio);
    return () => mq.removeEventListener('change', cambio);
  }, [consulta]);
  return angosta;
}
