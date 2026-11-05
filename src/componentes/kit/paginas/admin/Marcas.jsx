import React, { useEffect, useMemo, useState } from 'react';
import { Boxes, LayoutTemplate, MessageCircle, MessageSquareText, MoreHorizontal, PackageMinus, PackagePlus, Plus, Sparkles, Trash2 } from 'lucide-react';
import Boton from '../../Boton';
import { Confirmar, useToast } from '../../Feedback';
import { Campo, Deslizador } from '../../Formulario';
import { Pestanas } from '../../Navegacion';
import TarjetaProducto from '../../TarjetaProducto';
import { MenuContextual } from '../../piezas/MenuContextual';
import { Sello } from '../../Marca';
import { CabezaAdmin } from '../../piezas/admin/Marco';
import { TablaAdmin, BarraFiltros, AccionesLote, CargarMas, InsigniaEstado } from '../../piezas/admin/Datos';
import { GrupoCampos, CampoImagen, CampoColor, ElegirUno } from '../../piezas/admin/Formularios';
import { normalizarBusqueda, slugDeMarca, topeMonedasDe, monedasPorProductoDe, textoTopeMonedas, TOPE_MONEDAS_POR_DEFECTO, dosNumerosWhatsApp, NOTA_SIN_ELEGIR } from '../../adaptadoresAdmin';
import { PaginaListaAdmin } from './Lista';
import { FotoCelda, NumeroCelda, porNombre, porOrden } from './celdas';
import l from './Lista.module.css';
import s from './Marcas.module.css';
import { EsqueletoTexto } from '../../Esqueletos';

/*
 * Marcas (/admin/marcas, D1): los datos de cada marca que usa toda la tienda
 * (nombre, logo, dirección, WhatsApp de su asesor, tope de monedas y el fondo
 * de sus tarjetas), cómo se confirman los pedidos por WhatsApp y los
 * productos de cada marca. Su página (portada, secciones) se diseña en la
 * página con el editor ("Diseñar página").
 */

const soloTelefono = (t) => String(t || '').replace(/[^\d\s\-()+]/g, '');
/* +51924426791 → +51 924 426 791 (solo para leerlo). */
// "912881722", "51912881722" o "+51912881722" → "+51 912 881 722".
const telefonoLegible = (t) => {
  const d = String(t || '').replace(/\D/g, '');
  const conMas = d ? `+${d.length === 9 ? `51${d}` : d}` : String(t || '');
  return conMas.replace(/^\+51(\d{3})(\d{3})(\d{3})$/, '+51 $1 $2 $3');
};
const VACIA = { nombre: '', slug: '', logo: '', orden: 0, whatsapp: '', mensajeVacio: '', topeMonedas: TOPE_MONEDAS_POR_DEFECTO, tipoTope: 'pct', monedasPorProducto: '', fondo: '#ffffff', textura: '', opacidad: 100 };

/*
 * Pedidos por WhatsApp: a qué número llegan y si cada marca recibe los suyos.
 * Se cambia en Ajustes › WhatsApp (urlWhatsapp), con los demás números.
 */
function TarjetaWhatsApp({ config, cargando, url }) {
  const numero = config.principal || config.fabrica;
  // El botón verde va a otro número a propósito: se dice aquí para que no confunda.
  const dos = dosNumerosWhatsApp(config.principal, config.boton, config.fabrica);
  return (
    <div className={s.whatsapp}>
      <Sello tamano={40} tono="menta"><MessageCircle /></Sello>
      <div className={s.whatsappTextos}>
        <strong>Pedidos por WhatsApp</strong>
        {cargando ? <EsqueletoTexto lineas={1} /> : (
          <span>
            {config.multimarca
              ? 'Cada marca recibe los pedidos de sus productos en el WhatsApp de su asesor.'
              : `Los pedidos llegan a ${telefonoLegible(numero)}${config.principal ? '' : ` (${NOTA_SIN_ELEGIR})`}.`}
            {dos && ` El botón verde de la tienda lleva a otro número: ${telefonoLegible(dos.boton)}.`}
          </span>
        )}
      </div>
      <Boton tamano="sm" variante="secundario" to={url} disabled={cargando}>Cambiar en WhatsApp</Boton>
    </div>
  );
}

/**
 * El mensaje de toda la tienda (/tienda) cuando no hay productos: el que usa
 * una marca con su «Mensaje sin productos» vacío. Antes no se podía editar.
 *  - valor · cargando · onGuardar(texto) → promesa
 */
function TarjetaMensajeTienda({ valor = '', cargando, onGuardar }) {
  const toast = useToast();
  const [texto, setTexto] = useState(valor);
  const [guardando, setGuardando] = useState(false);
  useEffect(() => { setTexto(valor); }, [valor]);
  const cambio = texto.trim() !== String(valor || '').trim();
  const guardar = async () => {
    setGuardando(true);
    try {
      await onGuardar(texto.trim());
      toast({ tipo: 'exito', titulo: 'Mensaje guardado', texto: texto.trim() ? undefined : 'Sin texto: se ve el de siempre.' });
    } catch (err) {
      toast({ tipo: 'error', titulo: 'No se guardó', texto: err?.message || 'Vuelve a intentar.' });
    } finally {
      setGuardando(false);
    }
  };
  return (
    <div className={s.whatsapp}>
      <Sello tamano={40} tono="oro"><MessageSquareText /></Sello>
      <div className={s.whatsappTextos}>
        <strong>Mensaje si la tienda no tiene productos</strong>
        {cargando ? <EsqueletoTexto lineas={1} /> : (
          <Campo
            id="mensaje-tienda-vacia"
            etiqueta="Mensaje de toda la tienda"
            placeholder="Vacío: «Estamos preparando novedades. Revisa de nuevo en unos días.»"
            value={texto}
            ayuda="El de /tienda y el de cada marca que no tiene uno propio."
            onChange={(e) => setTexto(e.target.value)}
          />
        )}
      </div>
      <Boton tamano="sm" variante="secundario" onClick={guardar} cargando={guardando} disabled={cargando || !cambio}>Guardar</Boton>
    </div>
  );
}

/**
 * La lista de marcas con su hoja de edición.
 *  - marcas: [{ id, nombre, slug, logo, orden, whatsapp, mensajeVacio, topeMonedas, tipoTope, monedasPorProducto, fondo, textura, opacidad }] (marcaDesdeFirestore)
 *  - cargando · error · onReintentar · onGuardar(datos, id?) · onEliminar(id) · subirImagen
 *  - onGuardarOrden(ids) → promesa: todas, en el orden nuevo. Con él, la lista
 *    se arrastra (como Categorías) y una nueva va al final sola
 *  - muestraDe(marcaId) → props de TarjetaProducto de uno de sus productos (la vista previa) o null
 *  - whatsapp: { principal, multimarca, fabrica, boton } · cargandoWhatsapp · urlWhatsapp (ahí se cambia)
 *  - onProductos(marca) (sus productos) · onDisenar(marca) (su página con el editor)
 *  - onAplicarPlantilla() → promesa con el resultado en texto · onQuitarRepetidas() → igual
 *  - mensajeTienda · cargandoMensajeTienda · onGuardarMensajeTienda(texto) → promesa
 *    (el mensaje de toda la tienda sin productos; sin onGuardar… no sale)
 */
export function PaginaMarcas({
  marcas = [], cargando, error, onReintentar, onGuardar, onEliminar, subirImagen, muestraDe,
  whatsapp = { principal: '', multimarca: false, fabrica: '' }, cargandoWhatsapp, urlWhatsapp,
  onProductos, onDisenar, onAplicarPlantilla, onQuitarRepetidas, onGuardarOrden,
  mensajeTienda = '', cargandoMensajeTienda, onGuardarMensajeTienda,
}) {
  const toast = useToast();
  const [menu, setMenu] = useState(null);
  const [preguntaPlantilla, setPreguntaPlantilla] = useState(false);
  const [preguntaRepetidas, setPreguntaRepetidas] = useState(false);

  const correr = async (fn, titulo) => {
    try {
      const texto = await fn();
      toast({ tipo: 'exito', titulo, texto: texto || undefined, duracion: 7000 });
    } catch (err) {
      toast({ tipo: 'error', titulo: 'No se pudo', texto: err?.message || 'Vuelve a intentar.' });
    }
  };

  const masAcciones = [
    ...(onAplicarPlantilla ? [{ id: 'plantilla', etiqueta: 'Aplicar la plantilla de página', Icono: Sparkles, accion: () => setPreguntaPlantilla(true) }] : []),
    ...(onQuitarRepetidas ? [{ id: 'repetidas', etiqueta: 'Quitar páginas repetidas', Icono: Trash2, accion: () => setPreguntaRepetidas(true) }] : []),
  ];

  return (
    <>
      <PaginaListaAdmin
        cabeza={{
          icono: 'marcas',
          titulo: 'Marcas',
          subtitulo: onGuardarOrden
            ? 'Los datos de cada marca que usa toda la tienda, en el orden del menú de marcas: arrástralas para cambiarlo. Su página se arma con «Diseñar página».'
            : 'Los datos de cada marca que usa toda la tienda. Su página se arma con «Diseñar página».',
          acciones: masAcciones.length ? (
            <Boton
              variante="secundario"
              icono={<MoreHorizontal aria-hidden="true" />}
              onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setMenu({ x: r.left, y: r.bottom + 6 }); }}
              aria-haspopup="menu"
            >
              Páginas
            </Boton>
          ) : undefined,
        }}
        antes={urlWhatsapp || onGuardarMensajeTienda ? (
          <div className={s.tarjetasArriba}>
            {urlWhatsapp && <TarjetaWhatsApp config={whatsapp} cargando={cargandoWhatsapp} url={urlWhatsapp} />}
            {onGuardarMensajeTienda && <TarjetaMensajeTienda valor={mensajeTienda} cargando={cargandoMensajeTienda} onGuardar={onGuardarMensajeTienda} />}
          </div>
        ) : undefined}
        registros={marcas}
        cargando={cargando}
        error={error}
        onReintentar={onReintentar}
        unidad={['marca', 'marcas']}
        femenino
        buscarEn={(m) => `${m.nombre} ${m.slug}`}
        placeholder="Buscar una marca"
        columnas={[
          { id: 'logo', titulo: 'Logo', ancho: 72, tarjeta: 'foto', celda: (m) => <FotoCelda src={m.logo} forma="circulo" /> },
          { id: 'nombre', titulo: 'Marca', ordenable: true, tarjeta: 'titulo', celda: (m) => <>{m.nombre}<span className={l.sub}>wala.pe/{m.slug || slugDeMarca(m.nombre)}</span></> },
          { id: 'whatsapp', titulo: 'WhatsApp del asesor', tarjeta: 'detalle', celda: (m) => (m.whatsapp ? <span className={l.numero}>{m.whatsapp}</span> : <span className={l.sub}>El general</span>) },
          { id: 'monedas', titulo: 'Monedas', ancho: 140, alinear: 'fin', tarjeta: 'detalle', celda: (m) => <TopeMonedas marca={m} /> },
          ...(onGuardarOrden ? [] : [{ id: 'orden', titulo: 'Orden', ordenable: true, ancho: 90, alinear: 'fin', celda: (m) => <NumeroCelda nombre="Orden" valor={m.orden} /> }]),
        ]}
        ordenable={onGuardarOrden ? {
          etiqueta: 'Orden de las marcas',
          onGuardar: onGuardarOrden,
          // Las mismas columnas que la tabla (logo, marca, WhatsApp y monedas).
          cabecera: (
            <span className={s.fila}>
              <span>Logo</span>
              <span>Marca</span>
              <span className={s.filaWhatsapp}>WhatsApp del asesor</span>
              <span className={s.filaMonedas}>Monedas</span>
            </span>
          ),
          fila: (m) => (
            <span className={s.fila}>
              <FotoCelda src={m.logo} forma="circulo" tamano={40} />
              <span className={s.filaTextos}>
                <strong>{m.nombre}</strong>
                <span className={l.sub}>wala.pe/{m.slug || slugDeMarca(m.nombre)}</span>
              </span>
              <span className={s.filaWhatsapp}>{m.whatsapp ? <span className={l.numero}>{m.whatsapp}</span> : <span className={l.sub}>El general</span>}</span>
              <span className={s.filaMonedas}><TopeMonedas marca={m} /></span>
            </span>
          ),
        } : undefined}
        ordenes={{ nombre: porNombre, orden: porOrden }}
        ordenInicial={{ por: 'orden', dir: 'asc' }}
        vacio={{ texto: 'Crea la primera: su logo, su dirección y el fondo de sus productos.' }}
        textos={{ creado: 'Marca creada', guardado: 'Marca guardada', eliminado: 'Marca eliminada' }}
        eliminar={{ texto: (m) => `Se elimina también su página: wala.pe/${m.slug || slugDeMarca(m.nombre)} deja de existir y lleva al inicio. Sus productos no se borran (quedan sin marca).` }}
        masAcciones={(m) => [
          ...(onProductos ? [{ id: 'productos', etiqueta: 'Sus productos', Icono: Boxes, accion: () => onProductos(m) }] : []),
          ...(onDisenar && m.slug ? [{ id: 'disenar', etiqueta: 'Diseñar página', Icono: LayoutTemplate, accion: () => onDisenar(m) }] : []),
        ]}
        onGuardar={onGuardar}
        onEliminar={onEliminar}
        formulario={{
          nuevo: 'Nueva marca',
          titulos: { nuevo: 'Nueva marca', editar: 'Editar marca' },
          textoGuardar: { nuevo: 'Crear marca' },
          vacio: ({ registros }) => ({ ...VACIA, orden: registros.reduce((x, m) => Math.max(x, m.orden + 1), 0) }),
          desde: (m) => ({ ...VACIA, ...m, id: undefined }),
          validar: (d, { id, registros }) => {
            const slug = slugDeMarca(d.slug) || slugDeMarca(d.nombre);
            const duena = registros.find((m) => m.id !== id && (slugDeMarca(m.slug) || slugDeMarca(m.nombre)) === slug);
            return {
              nombre: !d.nombre.trim() ? 'Escribe el nombre de la marca.' : undefined,
              slug: slug && duena ? `wala.pe/${slug} ya es de «${duena.nombre}». Elige otra.` : undefined,
              monedasPorProducto: d.tipoTope === 'monedas' && monedasPorProductoDe(d.monedasPorProducto) === '' ? 'Escribe cuántas monedas por producto (0: ninguna).' : undefined,
            };
          },
          limpiar: ({ id: _id, ...d }) => ({
            ...d, nombre: d.nombre.trim(), slug: d.slug.trim(), orden: Number(d.orden) || 0, topeMonedas: topeMonedasDe(d.topeMonedas),
            tipoTope: d.tipoTope === 'monedas' ? 'monedas' : 'pct', monedasPorProducto: monedasPorProductoDe(d.monedasPorProducto),
          }),
          campos: (ctx) => <CamposMarca {...ctx} subirImagen={subirImagen} muestraDe={muestraDe} conOrden={!onGuardarOrden} />,
        }}
      />

      <MenuContextual abierto={Boolean(menu)} x={menu?.x} y={menu?.y} items={masAcciones} titulo="Páginas de marca" onCerrar={() => setMenu(null)} />
      <Confirmar
        abierta={preguntaPlantilla}
        titulo="¿Aplicar la plantilla de página?"
        texto="Las páginas de marca que siguen con la plantilla se rehacen: portada, burbujas de categorías, lo más pedido, ofertas, catálogo y marcas. Las que armaste a mano se conservan (solo su banner viejo pasa a portada, sus títulos se subrayan y sus filas de productos se juntan). No cambia marcas ni productos."
        confirmar="Aplicar"
        onConfirmar={async () => { setPreguntaPlantilla(false); await correr(onAplicarPlantilla, 'Plantilla aplicada'); }}
        onCancelar={() => setPreguntaPlantilla(false)}
      />
      {/* Borra páginas (no se deshace): pregunta antes, como AdminMarcas. */}
      <Confirmar
        abierta={preguntaRepetidas}
        titulo="¿Quitar las páginas repetidas?"
        texto="Son repetidas las de una misma marca con la misma dirección salvo mayúsculas o guiones (/ConAmor y /conamor). Se queda la que tiene el diseño editado y las otras direcciones llevan a ella. Las páginas de campaña con otra dirección no se tocan. No cambia marcas ni productos."
        confirmar="Quitar repetidas"
        peligro
        onConfirmar={async () => { setPreguntaRepetidas(false); await correr(onQuitarRepetidas, 'Páginas revisadas'); }}
        onCancelar={() => setPreguntaRepetidas(false)}
      />
    </>
  );
}

/** Cuánto se paga con monedas, en la lista: "Hasta 50 %", "10 por producto" o "Sin monedas". */
function TopeMonedas({ marca }) {
  const texto = textoTopeMonedas(marca);
  return texto ? <span className={l.numero}>{texto}</span> : <InsigniaEstado estado="oculto">Sin monedas</InsigniaEstado>;
}

/* Los campos de una marca, con la vista previa de su tarjeta. conOrden: el campo Orden (sin la lista para arrastrar). */
function CamposMarca({ datos, cambiar, errores, idDe, id, subirImagen, muestraDe, conOrden = true }) {
  const slug = slugDeMarca(datos.slug) || slugDeMarca(datos.nombre);
  const tope = topeMonedasDe(datos.topeMonedas);
  const cantidad = monedasPorProductoDe(datos.monedasPorProducto);
  const muestra = (id && muestraDe?.(id)) || null;
  return (
    <>
      <GrupoCampos titulo="Marca">
        <Campo id={idDe('nombre')} etiqueta="Nombre" placeholder="Ej. Con Amor Parejas" value={datos.nombre} error={errores.nombre} maxLength={60} onChange={(e) => cambiar('nombre', e.target.value)} />
        <Campo
          id={idDe('slug')}
          etiqueta="Dirección"
          icono={<span className={s.prefijo}>wala.pe/</span>}
          placeholder={slugDeMarca(datos.nombre) || 'se arma con el nombre'}
          value={datos.slug}
          error={errores.slug}
          ayuda={slug ? `Su página: wala.pe/${slug}. Vacío: se arma con el nombre.` : 'Vacío: se arma con el nombre.'}
          onChange={(e) => cambiar('slug', e.target.value)}
        />
        {conOrden && <Campo id={idDe('orden')} etiqueta="Orden" type="number" inputMode="numeric" min={0} value={datos.orden} ayuda="Las de número más bajo salen primero en el menú de marcas." onChange={(e) => cambiar('orden', e.target.value)} />}
      </GrupoCampos>

      <GrupoCampos titulo="Logo">
        <CampoImagen etiqueta="Logo de la marca" ayuda="PNG con fondo transparente. Se sube tal cual." valor={datos.logo} onCambiar={(url) => cambiar('logo', url)} subir={subirImagen && ((b, o) => subirImagen(b, { ...o, carpeta: 'logos' }))} forma="circulo" />
      </GrupoCampos>

      <GrupoCampos titulo="Atención">
        <Campo
          id={idDe('whatsapp')}
          etiqueta="WhatsApp del asesor"
          inputMode="tel"
          placeholder="Ej. +51 987 654 321"
          value={datos.whatsapp}
          ayuda="Las consultas y pedidos de sus productos van aquí. Vacío: el número general."
          onChange={(e) => cambiar('whatsapp', soloTelefono(e.target.value))}
        />
        <Campo
          id={idDe('mensajeVacio')}
          etiqueta="Mensaje sin productos"
          placeholder="Vacío: el de toda la tienda"
          value={datos.mensajeVacio}
          ayuda="Lo que ve el cliente en su página si no tiene productos."
          onChange={(e) => cambiar('mensajeVacio', e.target.value)}
        />
      </GrupoCampos>

      <GrupoCampos titulo="Monedas" ayuda="Cuánto del precio de sus productos se puede pagar con monedas.">
        <ElegirUno
          etiqueta="Cómo se cuenta"
          opciones={[{ valor: 'pct', texto: 'Un porcentaje' }, { valor: 'monedas', texto: 'Monedas por producto' }]}
          valor={datos.tipoTope}
          onElegir={(v) => v && cambiar('tipoTope', v)}
        />
        {datos.tipoTope === 'monedas' ? (
          <Campo
            id={idDe('monedasPorProducto')}
            etiqueta="Máximo por producto"
            type="number"
            inputMode="numeric"
            min={0}
            step="1"
            sufijo="monedas"
            value={datos.monedasPorProducto}
            error={errores.monedasPorProducto}
            ayuda={cantidad === 0
              ? 'Sus productos no se pueden pagar con monedas.'
              : `Por cada producto, hasta ${cantidad === '' ? 'esas' : cantidad} monedas (S/ 1 cada una): si lleva 3, el triple. Nunca más que su precio.`}
            onChange={(e) => cambiar('monedasPorProducto', e.target.value === '' ? '' : Math.max(0, Math.floor(Number(e.target.value) || 0)))}
          />
        ) : (
          <Campo
            id={idDe('topeMonedas')}
            etiqueta="Máximo a pagar con monedas"
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            step="1"
            sufijo="%"
            value={datos.topeMonedas}
            ayuda={tope === 0
              ? 'Sus productos no se pueden pagar con monedas.'
              : `En un producto de S/ 100, el cliente paga con monedas hasta ${tope} (S/ ${tope}). Vacío: ${TOPE_MONEDAS_POR_DEFECTO} %, la regla de siempre.`}
            onChange={(e) => cambiar('topeMonedas', e.target.value === '' ? '' : Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0))))}
          />
        )}
      </GrupoCampos>

      <GrupoCampos titulo="Tarjetas de producto" ayuda="El fondo detrás de la foto de sus productos y de su mosaico en el inicio (no la portada de su página).">
        <CampoColor id={idDe('fondo')} etiqueta="Color de fondo" valor={datos.fondo} onCambiar={(v) => cambiar('fondo', v)} />
        <CampoImagen etiqueta="Textura (opcional)" valor={datos.textura} onCambiar={(url) => cambiar('textura', url)} subir={subirImagen && ((b, o) => subirImagen(b, { ...o, carpeta: 'fondos' }))} />
        {datos.textura && (
          <Deslizador etiqueta="Cuánto se ve la textura" valor={Number(datos.opacidad) || 0} min={0} max={100} formato={(v) => `${v} %`} onChange={(v) => cambiar('opacidad', v)} />
        )}
        <div className={s.vista}>
          <span className={s.vistaTitulo}>Así se ven sus productos</span>
          <div className={s.vistaTarjeta}>
            <TarjetaProducto
              {...(muestra || { nombre: 'Tu producto', precio: 59.9 })}
              marca={datos.logo ? { nombre: datos.nombre, logo: datos.logo } : undefined}
              fondo={datos.fondo || datos.textura ? { color: datos.fondo, imagen: datos.textura, opacidad: Number(datos.opacidad) } : undefined}
              url="#"
              inclinar={false}
              sinDeseo
              sinAccion
            />
          </div>
        </div>
      </GrupoCampos>
    </>
  );
}

/* ── Los productos de una marca ────────────────────────── */

const PASO = 50;
const soles = (n) => `S/ ${Number(n || 0).toFixed(2)}`;

/**
 * Asignar o quitar productos de una marca (lo que antes se abría con
 * "Gestionar productos"). Solo cambia la marca del producto: el precio, el
 * stock y la forma de cobro no se tocan.
 *  - marca: { id, nombre, slug } · marcas (para decir de cuál es cada producto)
 *  - productos: todos ([{ id, nombre, imagen, precio, oculto, marcaId }], productoAdminDesde)
 *  - cargando · error · onReintentar
 *  - onAsignar(ids) / onQuitar(ids) → promesa con { ok, fallaron }
 *  - urlCrear (crear un producto ya en esta marca) · urlVolver · onDisenar
 */
export function PaginaProductosMarca({ marca, marcas = [], productos = [], cargando, error, onReintentar, onAsignar, onQuitar, urlCrear, urlVolver = '/admin/marcas', onDisenar }) {
  const toast = useToast();
  const [vista, setVista] = useState('en');
  const [buscar, setBuscar] = useState('');
  const [elegidos, setElegidos] = useState([]);
  const [visibles, setVisibles] = useState(PASO);
  const [trabajando, setTrabajando] = useState(false);
  const nombreDeMarca = useMemo(() => new Map(marcas.map((m) => [m.id, m.nombre])), [marcas]);

  const enMarca = productos.filter((p) => p.marcaId === marca.id);
  const otros = productos.filter((p) => p.marcaId !== marca.id);
  const q = normalizarBusqueda(buscar);
  const lista = (vista === 'en' ? enMarca : otros).filter((p) => !q || normalizarBusqueda(p.nombre).includes(q));

  const cambiarVista = (v) => { setVista(v); setElegidos([]); setVisibles(PASO); };
  const correr = async (fn, verbo) => {
    setTrabajando(true);
    try {
      const r = (await fn(elegidos)) || { ok: elegidos.length, fallaron: 0 };
      toast({
        tipo: r.fallaron ? 'aviso' : 'exito',
        titulo: `${r.ok} producto${r.ok === 1 ? '' : 's'} ${verbo}`,
        texto: r.fallaron ? `${r.fallaron} no se pudieron cambiar: vuelve a intentar con esos.` : undefined,
      });
      setElegidos([]);
    } catch (err) {
      toast({ tipo: 'error', titulo: 'No se guardó', texto: err?.message || 'Vuelve a intentar.' });
    } finally {
      setTrabajando(false);
    }
  };

  return (
    <div data-componente="PaginaProductosMarca">
      <CabezaAdmin
        icono="marcas"
        titulo={`Productos de ${marca.nombre}`}
        subtitulo="Solo cambia la marca del producto: el precio, el stock y la forma de cobro no se tocan. Las burbujas de categorías se arman en su página."
        migas={[{ texto: 'Marcas', to: urlVolver }, { texto: marca.nombre }]}
        acciones={onDisenar && marca.slug ? <Boton variante="secundario" icono={<LayoutTemplate aria-hidden="true" />} onClick={() => onDisenar(marca)}>Diseñar página</Boton> : undefined}
        principal={urlCrear ? { texto: `Crear producto en ${marca.nombre}`, Icono: Plus, to: urlCrear } : undefined}
      />
      <div className={`${s.pestanas} ${l.desliza}`}>
        <Pestanas
          opciones={[{ id: 'en', texto: `En la marca · ${enMarca.length}` }, { id: 'otros', texto: 'Agregar productos' }]}
          valor={vista}
          onChange={cambiarVista}
          etiqueta="Qué productos"
        />
      </div>
      <BarraFiltros
        busqueda={buscar}
        onBusqueda={(t) => { setBuscar(t); setVisibles(PASO); }}
        placeholder="Buscar un producto"
        total={cargando || error ? undefined : lista.length}
        unidad={['producto', 'productos']}
      />
      <TablaAdmin
        etiqueta={vista === 'en' ? `Productos de ${marca.nombre}` : 'Productos para agregar'}
        columnas={[
          { id: 'foto', titulo: 'Foto', ancho: 72, tarjeta: 'foto', celda: (p) => <FotoCelda src={p.imagen} /> },
          { id: 'nombre', titulo: 'Producto', tarjeta: 'titulo', celda: (p) => p.nombre },
          { id: 'precio', titulo: 'Precio', ancho: 110, alinear: 'fin', tarjeta: 'detalle', celda: (p) => <span className={l.numero}>{soles(p.precio)}</span> },
          ...(vista === 'otros' ? [{ id: 'marca', titulo: 'Marca ahora', tarjeta: 'detalle', celda: (p) => (p.marcaId ? nombreDeMarca.get(p.marcaId) || 'Otra marca' : <span className={l.sub}>Sin marca</span>) }] : []),
          { id: 'estado', titulo: 'En la tienda', ancho: 130, tarjeta: 'estado', celda: (p) => <InsigniaEstado estado={p.oculto ? 'oculto' : 'activo'}>{p.oculto ? 'Oculto' : 'Visible'}</InsigniaEstado> },
        ]}
        filas={lista.slice(0, visibles)}
        nombreDe={(p) => p.nombre}
        cargando={cargando}
        error={error}
        onReintentar={onReintentar}
        seleccion={elegidos}
        onSeleccion={setElegidos}
        vacio={q
          ? { titulo: 'Ningún producto se llama así', texto: 'Prueba con otra palabra.' }
          : vista === 'en'
            ? { titulo: 'Esta marca todavía no tiene productos', texto: 'Agrégale productos en la otra pestaña o crea uno nuevo.' }
            : { titulo: 'Todos los productos ya son de esta marca' }}
      />
      <CargarMas visibles={Math.min(visibles, lista.length)} total={lista.length} onMas={() => setVisibles((v) => v + PASO)} paso={PASO} unidad={['producto', 'productos']} />
      <AccionesLote
        cantidad={elegidos.length}
        unidad={['elegido', 'elegidos']}
        onLimpiar={() => setElegidos([])}
        acciones={vista === 'en'
          ? [{ id: 'quitar', texto: 'Quitar de la marca', Icono: PackageMinus, cargando: trabajando, onClick: () => correr(onQuitar, 'quitados de la marca') }]
          : [{ id: 'asignar', texto: `Pasar a ${marca.nombre}`, Icono: PackagePlus, cargando: trabajando, onClick: () => correr(onAsignar, `pasados a ${marca.nombre}`) }]}
      />
    </div>
  );
}
