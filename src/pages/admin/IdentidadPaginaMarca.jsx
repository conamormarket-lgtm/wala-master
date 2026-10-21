import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, Monitor, Smartphone, Sun, Moon, AlertTriangle, ExternalLink } from 'lucide-react';
import { getProductsByBrand } from '../../services/products';
import { TemaMarca, temaDeMarca } from '../../componentes/kit/piezas/TemaMarca';
import { PortadaMarca } from '../../componentes/kit/piezas/PortadaMarca';
import { identidadDeMarca, BLOQUES_MARCA } from '../../componentes/kit/adaptadores';
import s from './IdentidadPaginaMarca.module.css';

/*
 * "Colores de la marca": su color y el segundo color, los de su portada y el
 * trazo bajo los títulos. Se guardan en tienda_brands/{id}.identidad y la
 * vista previa es la misma PortadaMarca de la tienda, de día y de noche.
 * La portada en sí (estilo foto/color/collage, la foto y la frase) es una
 * sección de la página de la marca, "Portada de marca", y se edita con el
 * editor: aquí ya no (antes había dos portadas y la tienda solo mostraba la
 * del editor). Lo que quedó guardado de entonces (estilo, imagen, frase,
 * bloques) no se borra: "Aplicar plantilla de página" lo pasa a esa sección.
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

/** Avisos de los colores: mal escritos y su contraste de día y de noche. */
const avisosDe = ({ valor, resuelta, vars, bgColor }) => {
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
 *  - valor: { color, color2, … } (lo demás de la identidad se conserva tal cual) · onChange(valor)
 *  - marca: lo que ya tiene el formulario ({ id, name, slug, logoUrl, bgColor })
 */
export default function IdentidadPaginaMarca({ valor, onChange, marca = {} }) {
  const [ancho, setAncho] = useState('computadora');
  const cambiar = (cambios) => onChange({ ...valor, ...cambios });

  // Los productos de la marca: la cuenta de la portada.
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

  // Lo que verá la tienda: identidadDeMarca con los colores válidos.
  const resuelta = identidadDeMarca({
    name: marca.name,
    bgColor: marca.bgColor,
    identidad: { ...valor, color: esHex(valor.color) ? valor.color : '', color2: esHex(valor.color2) ? valor.color2 : '' },
  });
  const vars = temaDeMarca(resuelta);
  const avisos = avisosDe({ valor, resuelta, vars, bgColor: marca.bgColor });
  const pagina = marca.slug ? `/${marca.slug}` : '';

  // La vista previa con el estilo de color (el que muestra los dos colores) y
  // sin frase: la de la portada se elige en el editor.
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
            estilo="color"
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
        Colores de la marca
      </h3>
      <p className={s.intro}>
        Van en la portada de su página y en el trazo bajo los títulos (los botones de compra siguen violeta).
        La portada en sí (foto, color o collage, y su frase) se edita en la página de la marca con el editor: es la sección "Portada de marca".
        {pagina && (
          <>
            {' '}
            <a className={s.enlace} href={pagina} target="_blank" rel="noreferrer">
              Abrir {pagina} <ExternalLink size={13} aria-hidden="true" />
            </a>
          </>
        )}
      </p>

      <div className={s.rejilla}>
        <div className={s.columna}>
          <CampoColor
            etiqueta="Color de la marca"
            ayuda="La portada, sus sellos y el trazo bajo los títulos."
            valor={valor.color}
            porDefecto={VIOLETA_WALA}
            onChange={(color) => cambiar({ color })}
          />
        </div>
        <div className={s.columna}>
          <CampoColor
            etiqueta="Segundo color"
            ayuda="El final del degradado. De noche, el acento si el primero no se ve. Vacío: el primero oscurecido."
            valor={valor.color2}
            porDefecto={esHex(resuelta.color) ? resuelta.color : VIOLETA_WALA}
            onChange={(color2) => cambiar({ color2 })}
          />
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
        <h4 className={s.subtitulo}>Vista previa de los colores</h4>
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
