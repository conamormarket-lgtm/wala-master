import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../contexts/AuthContext';
import { getPrendasBase } from '../../../services/prendasBase';
import { getDocument } from '../../../services/firebase/firestore';
import { subirImagenCliente } from '../../../services/crearArchivos';
import { publicarEnComunidad } from '../../../services/comunidad';
import { crearDesdePlantilla } from '../../Crear/crearDesdePlantilla';
import { leerPrendaBase, colorDisponible, UNIDADES_ZONA } from '../../../utils/prendaBase';
import { capasDePlantilla } from './plantillasACapas.mjs';
import { crearProductosYoryo, IDS_CREAR_YORYO } from './crearProductosYoryo';
import { plantillaCapasBaseYoryo } from './presetsEquipos.mjs';
import { plantillaParejasBaseYoryo } from './presetsParejas.mjs';
import Boton from '../../../componentes/kit/Boton';
import { Aviso } from '../../../componentes/kit/Feedback';
import s from './ImportarPlantillasYoryo.module.css';

/*
 * Una sola vez: las plantillas del personalizador anterior de cuadros y
 * mousepads (6 equipos y 3 de parejas) se vuelven diseños de la comunidad de
 * las prendas de Crear que se elijan aquí. Cada una se guarda como creación
 * del admin (con sus archivos y vistas previas) y se publica; el cliente la
 * ve en "Empieza con un diseño" del estudio y la cambia a su gusto.
 *
 * Las ediciones que se hicieron en la pantalla anterior (templates/
 * yoryo-composiciones-v4) mandan sobre las de fábrica.
 */

// Los textos de muestra son los de las portadas de referencia de cada plantilla.
const DEDICATORIA = 'Para el mejor papá. Con amor, Sofía.';
const EQUIPOS = [
  ['Alianza Lima', 'Blanquiazul de corazón'], ['Universitario', 'Crema de corazón'], ['Sporting Cristal', 'Celeste de corazón'],
  ['Sport Boys', 'Rosado de corazón'], ['Barcelona', 'Culé de corazón'], ['Real Madrid', 'Madridista de corazón'],
];
const PAREJAS = [
  ['dorado', 'Banda dorada', { nombre: 'Andrea & Luis', frase: 'Gracias por caminar a mi lado.' }],
  ['floral', 'Mi lugar favorito', { titulo: 'Mi lugar favorito es', acento: 'contigo.', nombre: 'Diego & Valeria', fecha: '14.02.2022', frase: 'Gracias por hacerme sentir en casa.' }],
  ['botanico', 'Nuestra historia', { nombre: 'Camila & Andrés', fecha: '09.06.2023', frase: 'Por todos los recuerdos que nos faltan.' }],
];

const PRODUCTOS = [['cuadro', 'Cuadro'], ['mousepad', 'Mousepad']];

const plantillasDe = (producto) => [
  ...EQUIPOS.map(([equipo, frase]) => ({
    id: `${producto}-${equipo}`, producto, nombre: equipo, preset: () => plantillaCapasBaseYoryo(equipo, producto),
    textos: { nombre: 'Daniel', frase, dedicatoria: DEDICATORIA },
  })),
  ...PAREJAS.map(([modelo, nombre, textos]) => ({ id: `${producto}-${modelo}`, producto, nombre, preset: () => plantillaParejasBaseYoryo(modelo, producto), textos })),
];

const aBlob = (canvas) => new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo crear la foto de muestra.'))), 'image/png'));

/** "Tu foto": la foto de muestra que el cliente cambia con "Cambiar foto". */
async function fotoDeMuestra() {
  const c = document.createElement('canvas');
  c.width = 1200;
  c.height = 1200;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#EDE7FB';
  ctx.fillRect(0, 0, 1200, 1200);
  ctx.fillStyle = '#C4B5FD';
  ctx.beginPath();
  ctx.arc(600, 470, 210, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(600, 1130, 420, 380, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = '#6D28D9';
  ctx.font = '900 110px Montserrat, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('TU FOTO', 600, 830);
  return { blob: await aBlob(c), ancho: 1200, alto: 1200 };
}

/** Sube a Storage una imagen de public/ (los recursos de la plantilla). */
async function subirRecurso(uid, url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se encontró ${url}`);
  const blob = await res.blob();
  const bitmap = await createImageBitmap(blob);
  const medidas = { ancho: bitmap.width, alto: bitmap.height };
  bitmap.close?.();
  return { src: await subirImagenCliente(uid, blob), ...medidas };
}

export default function ImportarPlantillasYoryo() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const prendas = useQuery({ queryKey: ['admin-prendas-crear-importar'], queryFn: async () => (await getPrendasBase({ incluirBorradores: true })).data });
  const editadas = useQuery({
    queryKey: ['plantillas-yoryo-editadas'],
    queryFn: async () => {
      const r = await getDocument('templates', 'yoryo-composiciones-v4');
      return r.data?.presets || {};
    },
  });
  const [destinoElegido, setDestino] = useState({});
  // Si ya existen el cuadro y el mousepad de Crear, se eligen solos.
  const destino = useMemo(() => Object.fromEntries(PRODUCTOS.map(([p]) => [p,
    destinoElegido[p] ?? ((prendas.data || []).some((x) => x.id === IDS_CREAR_YORYO[p]) ? IDS_CREAR_YORYO[p] : '')])), [destinoElegido, prendas.data]);
  const [pasoProductos, setPasoProductos] = useState('');
  const [creandoProductos, setCreandoProductos] = useState(false);
  const crearProductos = async () => {
    setCreandoProductos(true);
    try {
      await crearProductosYoryo({ onPaso: setPasoProductos });
      await prendas.refetch();
      queryClient.invalidateQueries({ queryKey: ['prendas-base'] });
    } catch (e) {
      setPasoProductos(`Error: ${e.message}`);
    } finally {
      setCreandoProductos(false);
    }
  };
  const [elegidas, setElegidas] = useState(() => new Set(PRODUCTOS.flatMap(([p]) => plantillasDe(p).map((x) => x.id))));
  const [estado, setEstado] = useState({});
  const [trabajando, setTrabajando] = useState(false);
  const todas = useMemo(() => PRODUCTOS.flatMap(([p]) => plantillasDe(p)), []);

  const importar = async () => {
    setTrabajando(true);
    const subidas = new Map();
    const recurso = (url) => {
      if (!subidas.has(url)) subidas.set(url, subirRecurso(user.uid, url));
      return subidas.get(url);
    };
    let foto = null;
    try {
      const muestra = await fotoDeMuestra();
      foto = { src: await subirImagenCliente(user.uid, muestra.blob), ancho: muestra.ancho, alto: muestra.alto };
    } catch (e) {
      setEstado({ general: `No se pudo preparar la foto de muestra: ${e.message}` });
      setTrabajando(false);
      return;
    }
    for (const plantilla of todas.filter((x) => elegidas.has(x.id) && destino[x.producto])) {
      const marcar = (texto) => setEstado((m) => ({ ...m, [plantilla.id]: texto }));
      try {
        const prenda = prendas.data.find((p) => p.id === destino[plantilla.producto]);
        const leida = leerPrendaBase(prenda);
        const vista = leida.vistas[0];
        const zona = vista?.zonas[0];
        if (!zona) throw new Error('La prenda no tiene una zona.');
        const color = leida.colores.find((c) => c.id === prenda.defaultVariantId && colorDisponible(c, leida.vistas)) || leida.colores[0];
        const base = plantilla.preset();
        const preset = editadas.data?.[base.clave] || base;
        marcar('Subiendo imágenes…');
        const recursos = {};
        for (const [clave, r] of Object.entries(preset.recursos || {})) recursos[clave] = await recurso(r.url);
        const capas = capasDePlantilla({ preset, proporcion: zona.proporcion, recursos, foto, textos: plantilla.textos, unidades: UNIDADES_ZONA });
        const creacion = await crearDesdePlantilla({
          uid: user.uid, prenda, talla: '',
          pieza: { nombre: plantilla.nombre, color: { id: color.id, nombre: color.nombre }, layersByView: { [zona.id]: capas } },
          onPaso: marcar,
        });
        marcar('Publicando…');
        const { error } = await publicarEnComunidad(creacion.id);
        if (error) throw new Error(error);
        marcar('Listo');
      } catch (e) {
        marcar(`Error: ${e.message}`);
      }
    }
    queryClient.invalidateQueries({ queryKey: ['comunidad'] });
    setTrabajando(false);
  };

  const opciones = (prendas.data || []).filter((p) => p.prendaBase?.vistas?.length);
  const listas = PRODUCTOS.some(([p]) => destino[p]);
  return (
    <div className={s.pagina}>
      <h1>Importar plantillas de cuadros y mousepads</h1>
      <p>
        Convierte las plantillas del personalizador anterior (6 equipos y 3 de parejas) en <strong>diseños de la
        comunidad</strong> de tus prendas de Crear. El cliente las ve en el estudio, en <em>Empieza con un diseño</em>, y
        cambia la foto, los textos o lo que quiera. Se guardan en Mis creaciones de tu cuenta y se pueden retirar desde ahí.
      </p>
      <section className={s.grupo}>
        <h2>1. Los productos en Crear</h2>
        <p>
          Crea el cuadro (31 × 25 cm), el mousepad (23.5 × 19.5 cm) y el tomatodo grabado como productos de Crear, con la foto
          de la tienda sin fondo, y el Pack de oficina como combo. También hace que <em>Personalizar</em> de esos productos de la
          tienda lleve a ellos. Lo que ya exista no se repite. Luego se ajustan en Admin → Prendas de Crear.
        </p>
        <Boton variante="contorno" onClick={crearProductos} cargando={creandoProductos} disabled={!user || trabajando}>Crear productos y pack</Boton>
        {pasoProductos && <small className={pasoProductos.startsWith('Error') ? s.error : undefined}>{pasoProductos}</small>}
      </section>

      <h2 className={s.subtitulo}>2. Las plantillas</h2>
      <Aviso tipo="info" compacto>
        Importa una sola vez: cada vez que se importa se publican diseños nuevos.
      </Aviso>

      <div className={s.destinos}>
        {PRODUCTOS.map(([producto, nombre]) => (
          <label key={producto}>
            <span>{nombre} de Crear</span>
            <select value={destino[producto]} disabled={trabajando} onChange={(e) => setDestino((d) => ({ ...d, [producto]: e.target.value }))}>
              <option value="">No importar</option>
              {opciones.map((p) => <option key={p.id} value={p.id}>{p.name}{p.visible === false ? ' (borrador)' : ''}</option>)}
            </select>
          </label>
        ))}
      </div>

      {PRODUCTOS.filter(([p]) => destino[p]).map(([producto, nombre]) => (
        <section key={producto} className={s.grupo}>
          <h2>{nombre}</h2>
          <ul>
            {plantillasDe(producto).map((x) => (
              <li key={x.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={elegidas.has(x.id)}
                    disabled={trabajando}
                    onChange={(e) => setElegidas((prev) => {
                      const sig = new Set(prev);
                      if (e.target.checked) sig.add(x.id); else sig.delete(x.id);
                      return sig;
                    })}
                  />
                  {x.nombre}
                </label>
                {estado[x.id] && <small className={estado[x.id].startsWith('Error') ? s.error : undefined}>{estado[x.id]}</small>}
              </li>
            ))}
          </ul>
        </section>
      ))}

      {estado.general && <Aviso tipo="error" compacto>{estado.general}</Aviso>}
      <Boton onClick={importar} cargando={trabajando} disabled={!listas || !user || prendas.isLoading || editadas.isLoading}>
        Importar y publicar
      </Boton>
    </div>
  );
}
