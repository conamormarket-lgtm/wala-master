import React, { useRef, useState } from 'react';
import { Brush, ExternalLink, Upload } from 'lucide-react';
import Boton from '../../Boton';
import { useToast } from '../../Feedback';
import { Campo } from '../../Formulario';
import { Etiqueta } from '../../Etiquetas';
import { PaginaListaAdmin } from './Lista';
import { slugDeLanding, erroresDeLanding, pesoTexto } from '../../adaptadoresAdmin';
import l from './Lista.module.css';
import s from './Paginas.module.css';

/*
 * D6d · Las páginas que se arman con el editor (/admin/landing-pages): el
 * inicio, la tienda, las de cada marca y las de campaña. Aquí solo se crean,
 * se nombran, se les pone dirección y marca, y se borran; lo de adentro se
 * diseña en la página misma. Y los temas (/admin/temas): CSS propio o
 * importado de WordPress para esas páginas.
 */

const PAGINAS_DE_LA_TIENDA = [
  { id: 'home', nombre: 'Inicio', ruta: '/' },
  { id: 'tienda', nombre: 'Tienda', ruta: '/tienda' },
];
const errorDe = (err) => err?.message || 'Vuelve a intentar.';

/**
 * Las páginas (/admin/landing-pages).
 *  - paginas: [landingDesde] · marcas: [{ valor, texto }] · cargando · error · onReintentar
 *  - onGuardar(datos, id?) (el conector mueve el diseño si cambia la dirección) · onEliminar(id)
 *  - onDisenar(ruta) (abre la página con el editor) · dominio ('wala.pe')
 *  - nuevaDireccion: abre una nueva con esa dirección (el atajo de "Enlaces rotos")
 */
export function PaginaLandingsAdmin({ paginas = [], marcas = [], cargando, error, onReintentar, onGuardar, onEliminar, onDisenar, dominio = 'wala.pe', nuevaDireccion }) {
  const abrirPagina = (ruta) => window.open(ruta, '_blank', 'noopener');
  return (
    <PaginaListaAdmin
      cabeza={{ icono: 'landings', tono: 'rosa', titulo: 'Páginas', subtitulo: 'Las páginas que se arman con el editor. Lo de adentro (secciones, portada, tema) se diseña en la página misma.' }}
      antes={(
        <div className={s.deTienda} aria-label="Páginas de la tienda">
          {PAGINAS_DE_LA_TIENDA.map((p) => (
            <div key={p.id} className={s.fija}>
              <span className={s.fijaTexto}><strong>{p.nombre}</strong><span className={l.sub}>{dominio}{p.ruta === '/' ? '' : p.ruta} · siempre está</span></span>
              {onDisenar && <Boton tamano="sm" variante="secundario" icono={<Brush aria-hidden="true" />} onClick={() => onDisenar(p.ruta)}>Diseñar</Boton>}
            </div>
          ))}
        </div>
      )}
      registros={paginas}
      cargando={cargando}
      error={error}
      onReintentar={onReintentar}
      femenino
      unidad={['página', 'páginas']}
      buscarEn={(p) => `${p.nombre} ${p.slug} ${p.marcaNombre}`}
      placeholder="Buscar una página o su dirección"
      filtros={marcas.length ? [{ id: 'marca', etiqueta: 'Marca', todos: 'Todas', opciones: [{ valor: '-', texto: 'Sin marca' }, ...marcas], filtrar: (p, v) => (v === '-' ? !p.marcaId : p.marcaId === v) }] : []}
      columnas={[
        { id: 'nombre', titulo: 'Página', tarjeta: 'titulo', celda: (p) => <>{p.nombre}<span className={l.sub}>/{p.slug}{p.deMarca ? ' · la de la marca' : ''}</span></> },
        { id: 'slug', titulo: 'Antes estaba en', celda: (p) => (p.slugsAnteriores.length ? p.slugsAnteriores.map((x) => `/${x}`).join(', ') : <span className={l.sub}>—</span>) },
        { id: 'marca', titulo: 'Marca', ancho: 170, tarjeta: 'detalle', celda: (p) => p.marcaNombre || <span className={l.sub}>Toda la tienda</span> },
        { id: 'tipo', titulo: 'Tipo', ancho: 140, tarjeta: 'estado', celda: (p) => <Etiqueta tono={p.deMarca ? 'violeta' : 'neutro'}>{p.deMarca ? 'De marca' : 'De campaña'}</Etiqueta> },
      ]}
      vacio={{ titulo: 'Todavía no hay páginas de marca ni de campaña', texto: 'Crea una para una promo o un lanzamiento.' }}
      textos={{ creado: 'Página creada', guardado: 'Página guardada', eliminado: 'Página eliminada' }}
      eliminar={{
        texto: (p) => `Se borran /${p.slug} y su diseño. Los enlaces a esa dirección dejan de funcionar.`,
        bloqueado: (p) => (p.deMarca ? 'Es la página de una marca: se borra con la marca, en Marcas.' : null),
      }}
      masAcciones={(p) => [
        ...(onDisenar ? [{ id: 'disenar', etiqueta: 'Diseñar la página', Icono: Brush, accion: () => onDisenar(`/${p.slug}`) }] : []),
        { id: 'ver', etiqueta: 'Ver la página', Icono: ExternalLink, accion: () => abrirPagina(`/${p.slug}`) },
      ]}
      onGuardar={onGuardar}
      onEliminar={onEliminar}
      nuevoCon={nuevaDireccion ? { slug: nuevaDireccion } : undefined}
      formulario={{
        nuevo: 'Nueva página',
        titulos: { nuevo: 'Nueva página', editar: 'Nombre, dirección y marca' },
        textoGuardar: { nuevo: 'Crear página' },
        vacio: () => ({ nombre: '', slug: '', marcaId: '', deMarca: false }),
        desde: (p) => ({ ...p }),
        validar: (d, { id }) => erroresDeLanding({ ...d, id }, paginas),
        campos: ({ datos: d, cambiar, errores, idDe }) => (
          <>
            <Campo id={idDe('nombre')} etiqueta="Nombre" ayuda="Solo lo ves tú." placeholder="Ej. Promo Navidad 2026" value={d.nombre} error={errores.nombre} onChange={(e) => cambiar('nombre', e.target.value)} />
            <Campo
              id={idDe('slug')}
              etiqueta="Dirección"
              ayuda={d.deMarca ? 'Es la página de la marca: su dirección y su marca se cambian en Marcas.' : `${dominio}/${slugDeLanding(d.slug) || 'promo-navidad'}${d.id ? ' · si la cambias, la vieja lleva a la nueva.' : ''}`}
              placeholder="promo-navidad"
              value={d.slug}
              disabled={d.deMarca}
              error={errores.slug}
              onChange={(e) => cambiar('slug', e.target.value)}
            />
            <Campo etiqueta="Marca (opcional)" ayuda="Con marca, sus productos, ofertas y categorías son solo de esa marca." opciones={[{ valor: '', texto: 'Sin marca: toda la tienda' }, ...marcas]} value={d.marcaId} disabled={d.deMarca} onChange={(e) => cambiar('marcaId', e.target.value)} />
            <p className={s.nota}>El tema y ocultar la cabecera o el pie se eligen en la página con el editor (pestaña «Página»).</p>
          </>
        ),
      }}
    />
  );
}

/**
 * Los temas (/admin/temas): CSS que se aplica dentro de una página del editor.
 *  - temas: [temaDesde] · cargando · error · onReintentar · onGuardar(datos, id?) · onEliminar(id)
 *  - onImportarZip(archivo) → promesa con el tema creado (el conector lee el .zip y usa temaDesdeCss)
 */
export function PaginaTemasAdmin({ temas = [], cargando, error, onReintentar, onGuardar, onEliminar, onImportarZip }) {
  const toast = useToast();
  const entrada = useRef(null);
  const [importando, setImportando] = useState(false);
  const importar = async (e) => {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    if (!/\.zip$/i.test(archivo.name)) { toast({ tipo: 'error', titulo: 'Tiene que ser un .zip', texto: 'El tema de WordPress, tal cual se descarga.' }); return; }
    setImportando(true);
    try {
      const t = await onImportarZip?.(archivo);
      toast({ tipo: 'exito', titulo: 'Tema importado', texto: t?.nombre });
    } catch (err) {
      toast({ tipo: 'error', titulo: 'No se pudo importar', texto: errorDe(err) });
    } finally {
      setImportando(false);
    }
  };
  return (
    <PaginaListaAdmin
      cabeza={{
        icono: 'temas',
        tono: 'rosa',
        titulo: 'Temas',
        subtitulo: 'Estilos (CSS) para las páginas del editor: escritos aquí o sacados de un tema de WordPress.',
        acciones: onImportarZip ? (
          <>
            <input ref={entrada} type="file" accept=".zip" hidden onChange={importar} />
            <Boton tamano="sm" variante="secundario" icono={<Upload aria-hidden="true" />} cargando={importando} onClick={() => entrada.current?.click()}>Importar de WordPress (.zip)</Boton>
          </>
        ) : undefined,
      }}
      registros={temas}
      cargando={cargando}
      error={error}
      onReintentar={onReintentar}
      unidad={['tema', 'temas']}
      buscarEn={(t) => `${t.nombre} ${t.autor}`}
      placeholder="Buscar un tema"
      columnas={[
        { id: 'nombre', titulo: 'Tema', tarjeta: 'titulo', celda: (t) => <>{t.nombre}<span className={l.sub}>{t.autor || 'Sin autor'} · versión {t.version}</span></> },
        { id: 'peso', titulo: 'CSS', ancho: 110, alinear: 'fin', tarjeta: 'detalle', celda: (t) => <span className={l.numero}>{pesoTexto(t.css)}</span> },
        { id: 'tipo', titulo: 'De dónde', ancho: 160, tarjeta: 'estado', celda: (t) => <Etiqueta tono={t.tipo === 'wordpress_import' ? 'violeta' : 'neutro'}>{t.tipo === 'wordpress_import' ? 'De WordPress' : 'Escrito aquí'}</Etiqueta> },
      ]}
      vacio={{ titulo: 'Todavía no hay temas', texto: 'Escribe uno o impórtalo de un tema de WordPress.' }}
      textos={{ creado: 'Tema creado', guardado: 'Tema guardado', eliminado: 'Tema eliminado' }}
      eliminar={{ texto: (t) => `Se borra «${t.nombre}». Las páginas que lo usen pierden su estilo.` }}
      onGuardar={onGuardar}
      onEliminar={onEliminar}
      formulario={{
        nuevo: 'Nuevo tema',
        titulos: { nuevo: 'Nuevo tema', editar: 'Editar tema' },
        textoGuardar: { nuevo: 'Crear tema' },
        vacio: () => ({ nombre: '', autor: '', version: '1.0', tipo: 'custom_css', css: '' }),
        desde: (t) => ({ ...t }),
        validar: (d) => ({ nombre: String(d.nombre).trim() ? undefined : 'Escribe el nombre del tema.', css: String(d.css).trim() ? undefined : 'Escribe el CSS.' }),
        campos: ({ datos: d, cambiar, errores, idDe }) => (
          <>
            <div className={s.dos}>
              <Campo id={idDe('nombre')} etiqueta="Nombre" placeholder="Ej. Oscuro" value={d.nombre} error={errores.nombre} onChange={(e) => cambiar('nombre', e.target.value)} />
              <Campo etiqueta="Autor (opcional)" value={d.autor} onChange={(e) => cambiar('autor', e.target.value)} />
            </div>
            <div className={s.codigo}>
            <Campo
              id={idDe('css')}
              etiqueta="El CSS"
              ayuda={`Se aplica solo dentro de la página que use el tema. ${pesoTexto(d.css)}.`}
              multilinea={14}
              spellCheck={false}
              placeholder="/* Tu CSS aquí */"
              value={d.css}
              error={errores.css}
              onChange={(e) => cambiar('css', e.target.value)}
            />
            </div>
          </>
        ),
      }}
    />
  );
}
