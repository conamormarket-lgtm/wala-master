import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, ImagePlus, Monitor, Smartphone, Sun, Moon, AlertTriangle } from 'lucide-react';
import { uploadFile } from '../../services/firebase/storage';
import { getProductsByBrand } from '../../services/products';
import { TemaMarca, temaDeMarca } from '../../componentes/kit/piezas/TemaMarca';
import { PortadaMarca } from '../../componentes/kit/piezas/PortadaMarca';
import { identidadDeMarca, tarjetaDesdeProducto, BLOQUES_MARCA } from '../../componentes/kit/adaptadores';
import s from './IdentidadPaginaMarca.module.css';

/*
 * "Identidad de la página": lo que la página de una marca toma para armarse
 * sola (PaginaMarca del kit): su color, el segundo color, el estilo de la
 * portada, su foto, una frase y qué bloques lleva. Se guarda en
 * tienda_brands/{id}.identidad y la vista previa es la misma PortadaMarca de
 * la tienda, de día y de noche.
 */

/** La identidad vacía: sin color propio, portada de color y todos los bloques. */
export const IDENTIDAD_VACIA = { color: '', color2: '', estilo: 'color', imagen: '', frase: '', bloques: BLOQUES_MARCA };

/** Del doc de la marca al formulario (lo que falta queda vacío: usa el valor por defecto). */
export const identidadDelDoc = (marca = {}) => {
  const i = marca.identidad || {};
  return {
    color: i.color || '',
    color2: i.color2 || '',
    estilo: ['foto', 'color', 'collage'].includes(i.estilo) ? i.estilo : (i.imagen ? 'foto' : 'color'),
    imagen: i.imagen || '',
    frase: i.frase || '',
    bloques: Array.isArray(i.bloques) && i.bloques.length ? BLOQUES_MARCA.filter((b) => i.bloques.includes(b)) : BLOQUES_MARCA,
  };
};

const ESTILOS = [
  { valor: 'foto', nombre: 'Foto', detalle: 'Su foto de portada con el color detrás del texto' },
  { valor: 'color', nombre: 'Color', detalle: 'El degradado de la marca con el logo grande' },
  { valor: 'collage', nombre: 'Collage', detalle: 'Tres de sus productos en cartas giradas' },
];

const NOMBRES_BLOQUES = {
  categorias: 'Burbujas de categorías',
  destacados: 'Lo más pedido',
  ofertas: 'En oferta',
  catalogo: 'Catálogo con filtros',
};

const VIOLETA_WALA = '#7c3aed';
const BLANCO = '#ffffff';
const NOCHE = '#14121c'; // --noche-wala

const esHex = (v) => /^#[0-9a-f]{6}$/i.test(String(v || '').trim());

/* El mismo contraste que usa TemaMarca para decidir el color de noche. */
const luz = (hex) => {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((k) => {
    const c = parseInt(h.slice(k, k + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contraste = (a, b) => {
  const [x, y] = [luz(a), luz(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
const razon = (n) => `${n.toFixed(1).replace('.', ',')}:1`;

/** Las variables de TemaMarca fijadas a un modo (día o noche), sin mirar el tema del admin. */
const VARIABLES = ['degradado', 'acento', 'sobre', 'trazo', 'suave', 'tinta'];
const fijarModo = (vars, modo) => {
  if (!vars) return undefined;
  return Object.fromEntries(VARIABLES.map((v) => [v === 'degradado' ? '--degradado-logo' : `--tema-${v}`, vars[`--tema-${v}-${modo}`]]));
};

/** Avisos de la identidad: colores mal escritos, contraste y estilos sin lo que necesitan. */
const avisosDe = ({ valor, resuelta, vars, hayFotos, bgColor }) => {
  const avisos = [];
  if (valor.color && !esHex(valor.color)) avisos.push({ tipo: 'error', texto: `"${valor.color}" no es un color: escríbelo como #RRGGBB. Así no se guarda.` });
  if (valor.color2 && !esHex(valor.color2)) avisos.push({ tipo: 'error', texto: `"${valor.color2}" no es un color: escríbelo como #RRGGBB. Así no se guarda.` });
  if (!esHex(valor.color)) {
    avisos.push({ tipo: 'nota', texto: resuelta.color ? `Sin color propio: usa el color base (${bgColor}).` : 'Sin color propio: la página queda con el violeta de Walá.' });
  }
  if (esHex(resuelta.color)) {
    const dia = contraste(resuelta.color, BLANCO);
    if (dia < 3) {
      avisos.push({ tipo: 'aviso', texto: `De día ${resuelta.color} casi no se ve sobre el blanco (contraste ${razon(dia)}, pide 3:1) y el texto blanco de la portada no se lee. Elige un tono más oscuro.` });
    }
    const noche = vars?.['--tema-acento-noche'];
    if (noche && noche !== resuelta.color.toLowerCase()) {
      const delSegundo = esHex(resuelta.color2) && noche === resuelta.color2.toLowerCase();
      avisos.push({
        tipo: 'nota',
        texto: `De noche ${resuelta.color} no se ve sobre el fondo oscuro (contraste ${razon(contraste(resuelta.color, NOCHE))}): se usa ${noche}${delSegundo ? ', el segundo color' : ', el mismo aclarado'}.`,
      });
    }
  }
  if (valor.estilo === 'foto' && !valor.imagen) avisos.push({ tipo: 'aviso', texto: 'Estilo foto sin foto: la portada sale con el color hasta que subas una.' });
  if (valor.estilo === 'collage' && !hayFotos) avisos.push({ tipo: 'aviso', texto: 'La marca no tiene productos con foto: el collage sale como portada de color.' });
  return avisos;
};

function CampoColor({ etiqueta, ayuda, valor, porDefecto, onChange }) {
  return (
    <div className={s.campo}>
      <span className={s.etiqueta}>{etiqueta}</span>
      <div className={s.filaColor}>
        <input
          type="color"
          className={s.muestra}
          value={esHex(valor) ? valor.toLowerCase() : porDefecto}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`${etiqueta}: elegir`}
        />
        <input
          type="text"
          className={s.entrada}
          value={valor}
          placeholder="Sin color"
          maxLength={7}
          spellCheck={false}
          onChange={(e) => onChange(e.target.value.trim())}
          aria-label={`${etiqueta}: hex`}
        />
        {valor && (
          <button type="button" className={s.quitar} onClick={() => onChange('')}>Quitar</button>
        )}
      </div>
      <small className={s.ayuda}>{ayuda}</small>
    </div>
  );
}

/**
 * El bloque del admin de marcas.
 *  - valor: { color, color2, estilo, imagen, frase, bloques } · onChange(valor)
 *  - marca: lo que ya tiene el formulario ({ id, name, logoUrl, bgColor })
 */
export default function IdentidadPaginaMarca({ valor, onChange, marca = {} }) {
  const [subiendo, setSubiendo] = useState(false);
  const [errorFoto, setErrorFoto] = useState('');
  const [ancho, setAncho] = useState('computadora');
  const cambiar = (cambios) => onChange({ ...valor, ...cambios });

  // Los productos de la marca: el collage y la cuenta de la portada.
  const { data: productos = [] } = useQuery({
    queryKey: ['admin-marca-portada', marca.id],
    enabled: Boolean(marca.id),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await getProductsByBrand(marca.id);
      if (error) throw new Error(error);
      return data || [];
    },
  });
  const fotos = [...new Set(productos.map((p) => tarjetaDesdeProducto(p).imagen).filter(Boolean))].slice(0, 3);

  // Lo que verá la tienda: identidadDeMarca con los colores válidos.
  const resuelta = identidadDeMarca({
    name: marca.name,
    bgColor: marca.bgColor,
    identidad: { ...valor, color: esHex(valor.color) ? valor.color : '', color2: esHex(valor.color2) ? valor.color2 : '' },
  });
  const vars = temaDeMarca(resuelta);
  const avisos = avisosDe({ valor, resuelta, vars, hayFotos: fotos.length > 0, bgColor: marca.bgColor });

  const subirFoto = async (e) => {
    const file = e?.target?.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    setSubiendo(true);
    setErrorFoto('');
    try {
      const limpio = file.name.replace(/[^a-z0-9._-]+/gi, '_');
      const { url, error } = await uploadFile(file, `brands/portadas/${Date.now()}_${limpio}`);
      if (url && !error) cambiar({ imagen: url, estilo: 'foto' });
      else setErrorFoto(error || 'No se pudo subir la foto.');
    } finally {
      setSubiendo(false);
    }
  };

  const alternarBloque = (b) => {
    const tiene = valor.bloques.includes(b);
    if (tiene && valor.bloques.length === 1) return; // al menos uno
    const bloques = tiene ? valor.bloques.filter((x) => x !== b) : BLOQUES_MARCA.filter((x) => x === b || valor.bloques.includes(x));
    cambiar({ bloques });
  };

  const portada = (modo) => (
    <figure className={[s.escenario, modo === 'dia' ? s.dia : s.noche].join(' ')} data-theme={modo === 'noche' ? 'dark' : undefined}>
      <figcaption className={s.modo}>
        {modo === 'dia' ? <Sun size={14} aria-hidden="true" /> : <Moon size={14} aria-hidden="true" />}
        {modo === 'dia' ? 'De día' : 'De noche'}
      </figcaption>
      <TemaMarca identidad={resuelta}>
        <div className={[s.lienzo, ancho === 'celular' && s.celular].filter(Boolean).join(' ')} style={fijarModo(vars, modo)}>
          <PortadaMarca
            nombre={marca.name || 'Tu marca'}
            logo={marca.logoUrl}
            frase={resuelta.frase}
            estilo={resuelta.estilo}
            imagen={resuelta.imagen}
            fotos={fotos}
            cuenta={productos.length}
            urlBoton="#vista-identidad"
          />
        </div>
      </TemaMarca>
    </figure>
  );

  return (
    <section className={s.bloque} aria-labelledby="titulo-identidad">
      <h3 className={s.titulo} id="titulo-identidad">
        <Sparkles size={18} aria-hidden="true" />
        Identidad de la página
      </h3>
      <p className={s.intro}>
        Con esto la página de la marca se arma sola: su color en los acentos (los botones de compra siguen violeta),
        la portada y qué secciones lleva. Lo que dejes vacío usa el valor de siempre.
      </p>

      <div className={s.rejilla}>
        <div className={s.columna}>
          <CampoColor
            etiqueta="Color de la marca"
            ayuda="Sellos, el trazo bajo los títulos, el aro de la burbuja elegida y la portada."
            valor={valor.color}
            porDefecto={VIOLETA_WALA}
            onChange={(color) => cambiar({ color })}
          />
          <CampoColor
            etiqueta="Segundo color"
            ayuda="El final del degradado. De noche, el acento si el primero no se ve. Vacío: el primero oscurecido."
            valor={valor.color2}
            porDefecto={esHex(resuelta.color) ? resuelta.color : VIOLETA_WALA}
            onChange={(color2) => cambiar({ color2 })}
          />

          <label className={s.campo}>
            <span className={s.etiqueta}>Frase</span>
            <input
              type="text"
              className={s.entrada}
              value={valor.frase}
              maxLength={90}
              placeholder={`Productos de ${marca.name || 'la marca'}`}
              onChange={(e) => cambiar({ frase: e.target.value })}
            />
            <small className={s.ayuda}>Una línea bajo el nombre. Vacía: "Productos de {marca.name || 'la marca'}".</small>
          </label>
        </div>

        <div className={s.columna}>
          <fieldset className={s.grupo}>
            <legend className={s.etiqueta}>Estilo de la portada</legend>
            <div className={s.estilos}>
              {ESTILOS.map((e) => (
                <label key={e.valor} className={[s.estilo, valor.estilo === e.valor && s.elegido].filter(Boolean).join(' ')}>
                  <input type="radio" name="identidad-estilo" value={e.valor} checked={valor.estilo === e.valor} onChange={() => cambiar({ estilo: e.valor })} />
                  <strong>{e.nombre}</strong>
                  <span>{e.detalle}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className={s.campo}>
            <span className={s.etiqueta}>Foto de la portada</span>
            {valor.imagen ? (
              <div className={s.foto}>
                <img src={valor.imagen} alt="Foto de la portada" />
                <button type="button" className={s.quitar} onClick={() => cambiar({ imagen: '' })}>Quitar foto</button>
              </div>
            ) : (
              <label className={[s.subir, subiendo && s.ocupado].filter(Boolean).join(' ')}>
                <ImagePlus size={18} aria-hidden="true" />
                <span>{subiendo ? 'Subiendo…' : 'Subir foto (horizontal)'}</span>
                <input type="file" accept="image/*" onChange={subirFoto} disabled={subiendo} hidden />
              </label>
            )}
            {errorFoto && <small className={s.errorFoto}>{errorFoto}</small>}
          </div>

          <fieldset className={s.grupo}>
            <legend className={s.etiqueta}>Bloques de la página</legend>
            <div className={s.bloques}>
              {BLOQUES_MARCA.map((b) => {
                const marcado = valor.bloques.includes(b);
                const ultimo = marcado && valor.bloques.length === 1;
                return (
                  <label key={b} className={s.casilla} title={ultimo ? 'La página necesita al menos un bloque' : undefined}>
                    <input type="checkbox" checked={marcado} disabled={ultimo} onChange={() => alternarBloque(b)} />
                    <span>{NOMBRES_BLOQUES[b]}</span>
                  </label>
                );
              })}
            </div>
            <small className={s.ayuda}>"Lo más pedido" y "En oferta" no salen si la marca no tiene esos productos.</small>
          </fieldset>
        </div>
      </div>

      {avisos.length > 0 && (
        <ul className={s.avisos} aria-live="polite">
          {avisos.map((a) => (
            <li key={a.texto} className={s[`a_${a.tipo}`]}>
              {a.tipo !== 'nota' && <AlertTriangle size={16} aria-hidden="true" />}
              <span>{a.texto}</span>
            </li>
          ))}
        </ul>
      )}

      <div className={s.cabeceraVista} id="vista-identidad">
        <h4 className={s.subtitulo}>Vista previa de la portada</h4>
        <div className={s.anchos} role="group" aria-label="Ancho de la vista previa">
          <button type="button" aria-pressed={ancho === 'computadora'} onClick={() => setAncho('computadora')}>
            <Monitor size={15} aria-hidden="true" /> Computadora
          </button>
          <button type="button" aria-pressed={ancho === 'celular'} onClick={() => setAncho('celular')}>
            <Smartphone size={15} aria-hidden="true" /> Celular
          </button>
        </div>
      </div>
      <div className={s.vistas}>
        {portada('dia')}
        {portada('noche')}
      </div>
    </section>
  );
}
