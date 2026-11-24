import React from 'react';
import { Brush, ExternalLink } from 'lucide-react';
import Boton from '../../Boton';
import { Campo } from '../../Formulario';
import { Etiqueta } from '../../Etiquetas';
import { PaginaListaAdmin } from './Lista';
import { slugDeLanding, erroresDeLanding } from '../../adaptadoresAdmin';
import l from './Lista.module.css';
import s from './Paginas.module.css';

/*
 * D6d · Las páginas que se arman con el editor (/admin/landing-pages): el
 * inicio, la tienda, las de cada marca y las de campaña. Aquí solo se crean,
 * se nombran, se les pone dirección y marca, y se borran; lo de adentro se
 * diseña en la página misma.
 */

const PAGINAS_DE_LA_TIENDA = [
  { id: 'home', nombre: 'Inicio', ruta: '/' },
  { id: 'tienda', nombre: 'Tienda', ruta: '/tienda' },
];

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
            <p className={s.nota}>Ocultar la cabecera o el pie se elige en la página con el editor (pestaña «Página»).</p>
          </>
        ),
      }}
    />
  );
}
