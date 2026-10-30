import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../contexts/AuthContext';
import { getPrendasBase } from '../../../services/prendasBase';
import { getDocument } from '../../../services/firebase/firestore';
import { getDesignsByUser, eliminarCreacion } from '../../../services/designs';
import { retirarDeComunidad } from '../../../services/comunidad';
import { subirAProducto, miniaturaDePlantilla, guardarPlantillasDelProducto } from '../../Crear/plantillasProducto';
import { leerPrendaBase, colorDisponible, UNIDADES_ZONA, slug } from '../../../utils/prendaBase';
import { capasDePlantilla } from './plantillasACapas.mjs';
import { crearProductosYoryo, pasarYoryoALaTienda, ajustarTomatodoAFotoNueva, IDS_CREAR_YORYO } from './crearProductosYoryo';
import { crearGrabadosYoryo } from './grabadosYoryo';
import { plantillaCapasBaseYoryo, plantillaTomatodoYoryo } from './presetsEquipos.mjs';
import { plantillaParejasBaseYoryo } from './presetsParejas.mjs';
import Boton from '../../../componentes/kit/Boton';
import { Aviso } from '../../../componentes/kit/Feedback';
import s from './ImportarPlantillasYoryo.module.css';

/*
 * Una sola vez: el cuadro, el mousepad y el tomatodo de Yoryo en Crear, y sus
 * plantillas (6 equipos y 3 de parejas; en el tomatodo, los 6 escudos para
 * grabar) guardadas en cada producto (prendaBase.plantillas). Son de ese
 * producto: no van a la comunidad ni a Mis creaciones. El cliente las ve en
 * "Empieza con un diseño" del estudio y las cambia a su gusto.
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

const PRODUCTOS = [['cuadro', 'Cuadro'], ['mousepad', 'Mousepad'], ['tomatodo', 'Tomatodo']];
const NOMBRES = new Set([...EQUIPOS.map(([e]) => e), ...PAREJAS.map(([, n]) => n)]);

const plantillasDe = (producto) => (producto === 'tomatodo'
  ? EQUIPOS.map(([equipo, frase]) => ({
    id: `yoryo-tomatodo-${slug(equipo)}`, producto, nombre: equipo, grupo: 'Equipos',
    preset: () => plantillaTomatodoYoryo(equipo), textos: { nombre: 'Daniel', frase },
  }))
  : [
    ...PAREJAS.map(([modelo, nombre, textos]) => ({
      id: `yoryo-${producto}-${modelo}`, producto, nombre, grupo: 'Parejas', preset: () => plantillaParejasBaseYoryo(modelo, producto), textos,
    })),
    ...EQUIPOS.map(([equipo, frase]) => ({
      id: `yoryo-${producto}-${slug(equipo)}`, producto, nombre: equipo, grupo: 'Equipos', preset: () => plantillaCapasBaseYoryo(equipo, producto),
      textos: { nombre: 'Daniel', frase, dedicatoria: DEDICATORIA },
    })),
  ]);

const aBlob = (canvas) => new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo crear la imagen.'))), 'image/png'));

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

/**
 * Un recurso de public/ como imagen de la plantilla. Un escudo para grabar
 * (SVG, `blanco`) se pinta en blanco a 1400 px de alto: así se ve plateado
 * sobre el tomatodo negro, como el grabado.
 */
async function prepararRecurso(r) {
  const res = await fetch(r.url);
  if (!res.ok) throw new Error(`No se encontró ${r.url}`);
  const blob = await res.blob();
  if (!r.blanco) {
    const bitmap = await createImageBitmap(blob);
    const medidas = { ancho: bitmap.width, alto: bitmap.height };
    bitmap.close?.();
    return { blob, ...medidas };
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error(`No se pudo leer ${r.url}`));
      i.src = url;
    });
    const alto = 1400;
    const ancho = Math.round((alto * (img.naturalWidth || 1)) / (img.naturalHeight || 1));
    const c = document.createElement('canvas');
    c.width = ancho;
    c.height = alto;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, ancho, alto);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, ancho, alto);
    return { blob: await aBlob(c), ancho, alto };
  } finally {
    URL.revokeObjectURL(url);
  }
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
  // Si ya existen los productos de Crear, se eligen solos.
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
  // 4. Pasar a la tienda: los de Crear salen en la tienda y los de antes se ocultan.
  const [pasoTienda, setPasoTienda] = useState('');
  const [pasandoATienda, setPasandoATienda] = useState(false);
  const pasarATienda = async () => {
    if (!window.confirm('¿Pasar el cuadro, el mousepad, el tomatodo y el Pack de oficina de Crear a la tienda? Sus productos de la tienda de antes se ocultan (sus enlaces llevan a los nuevos).')) return;
    setPasandoATienda(true);
    try {
      await pasarYoryoALaTienda({ onPaso: setPasoTienda });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['prendas-base'] });
    } catch (e) {
      setPasoTienda(`Error: ${e.message}`);
    } finally {
      setPasandoATienda(false);
    }
  };
  // 5. El tomatodo sobre la foto nueva (zona, referencia y miniaturas).
  const [pasoTomatodo, setPasoTomatodo] = useState('');
  const [ajustandoTomatodo, setAjustandoTomatodo] = useState(false);
  const ajustarTomatodo = async () => {
    setAjustandoTomatodo(true);
    try {
      await ajustarTomatodoAFotoNueva({ onPaso: setPasoTomatodo });
      queryClient.invalidateQueries({ queryKey: ['prenda-base'] });
      queryClient.invalidateQueries({ queryKey: ['prendas-base'] });
    } catch (e) {
      setPasoTomatodo(`Error: ${e.message}`);
    } finally {
      setAjustandoTomatodo(false);
    }
  };
  // 6. La billetera y la esclava grabadas, y los packs con el reloj tal cual.
  const [pasoGrabados, setPasoGrabados] = useState('');
  const [creandoGrabados, setCreandoGrabados] = useState(false);
  const crearGrabados = async () => {
    setCreandoGrabados(true);
    try {
      await crearGrabadosYoryo({ onPaso: setPasoGrabados });
      queryClient.invalidateQueries({ queryKey: ['prendas-base'] });
      queryClient.invalidateQueries({ queryKey: ['prenda-base'] });
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['admin-combos-crear'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    } catch (e) {
      setPasoGrabados(`Error: ${e.message}`);
    } finally {
      setCreandoGrabados(false);
    }
  };
  const [elegidas, setElegidas] = useState(() => new Set(PRODUCTOS.flatMap(([p]) => plantillasDe(p).map((x) => x.id))));
  const [estado, setEstado] = useState({});
  const [trabajando, setTrabajando] = useState(false);

  const importar = async () => {
    setTrabajando(true);
    setEstado({});
    const muestra = await fotoDeMuestra().catch(() => null);
    const marcar = (id, texto) => setEstado((m) => ({ ...m, [id]: texto }));
    for (const [producto] of PRODUCTOS) {
      const prendaId = destino[producto];
      const lista = plantillasDe(producto).filter((x) => elegidas.has(x.id));
      if (!prendaId || !lista.length) continue;
      try {
        const prenda = prendas.data.find((p) => p.id === prendaId);
        const leida = leerPrendaBase(prenda);
        const vista = leida.vistas[0];
        const zona = vista?.zonas[0];
        if (!zona) throw new Error('El producto no tiene una zona.');
        const color = leida.colores.find((c) => c.id === prenda.defaultVariantId && colorDisponible(c, leida.vistas)) || leida.colores[0];
        // Las imágenes se suben una vez por producto, a su carpeta de plantillas.
        const subidas = new Map();
        const recurso = (r) => {
          if (!subidas.has(r.url)) {
            subidas.set(r.url, prepararRecurso(r).then(async ({ blob, ancho, alto }) => ({ src: await subirAProducto(prendaId, blob, 'recurso'), ancho, alto })));
          }
          return subidas.get(r.url);
        };
        const foto = muestra && { src: await subirAProducto(prendaId, muestra.blob, 'tu-foto'), ancho: muestra.ancho, alto: muestra.alto };
        const hechas = [];
        for (const plantilla of lista) {
          try {
            marcar(plantilla.id, 'Preparando…');
            const base = plantilla.preset();
            const preset = editadas.data?.[base.clave] || base;
            const recursos = {};
            for (const [clave, r] of Object.entries(preset.recursos || {})) recursos[clave] = await recurso({ ...base.recursos?.[clave], ...r });
            const capas = { [zona.id]: capasDePlantilla({ preset, proporcion: zona.proporcion, recursos, foto, textos: plantilla.textos, unidades: UNIDADES_ZONA }) };
            const miniatura = await miniaturaDePlantilla({ vista, zona, color, capas, laser: leida.tecnica === 'laser' });
            hechas.push({ id: plantilla.id, nombre: plantilla.nombre, grupo: plantilla.grupo, imagen: await subirAProducto(prendaId, miniatura, 'miniatura'), capas });
            marcar(plantilla.id, 'Lista');
          } catch (e) {
            marcar(plantilla.id, `Error: ${e.message}`);
          }
        }
        if (hechas.length) {
          await guardarPlantillasDelProducto(prendaId, hechas);
          hechas.forEach((p) => marcar(p.id, 'Guardada en el producto'));
        }
      } catch (e) {
        lista.forEach((x) => marcar(x.id, `Error: ${e.message}`));
      }
    }
    queryClient.invalidateQueries({ queryKey: ['prendas-base'] });
    setTrabajando(false);
  };

  // Las copias que la versión anterior de esta pantalla publicó en la
  // comunidad (y guardó en Mis creaciones de tu cuenta): se retiran y se borran.
  const [limpieza, setLimpieza] = useState('');
  const limpiar = async () => {
    setLimpieza('Buscando…');
    try {
      const ids = new Set(Object.values(IDS_CREAR_YORYO));
      const { data } = await getDesignsByUser(user.uid);
      const copias = (data || []).filter((d) => ids.has(d.productId) && NOMBRES.has(String(d.name || '').trim()));
      let hechas = 0;
      for (const d of copias) {
        setLimpieza(`Quitando ${hechas + 1} de ${copias.length}…`);
        // Si no estaba publicada, retirar no hace nada.
        await retirarDeComunidad(d.id);
        const { error } = await eliminarCreacion(user.uid, d);
        if (!error) hechas += 1;
      }
      queryClient.invalidateQueries({ queryKey: ['comunidad'] });
      queryClient.invalidateQueries({ queryKey: ['mis-creaciones-crear'] });
      queryClient.invalidateQueries({ queryKey: ['mis-borradores-crear'] });
      setLimpieza(copias.length ? `Listo: se quitaron ${hechas} de ${copias.length}.` : 'No había copias.');
    } catch (e) {
      setLimpieza(`Error: ${e.message}`);
    }
  };

  const opciones = (prendas.data || []).filter((p) => p.prendaBase?.vistas?.length);
  const listas = PRODUCTOS.some(([p]) => destino[p]);
  return (
    <div className={s.pagina}>
      <h1>Cuadros, mousepads y tomatodos en Crear</h1>
      <p>
        Pone los productos de Yoryo en Crear con sus plantillas. Las plantillas son de cada producto: el cliente las ve en el
        estudio, en <em>Empieza con un diseño</em>, separadas en Parejas y Equipos, y cambia la foto, los textos o lo que quiera.
        No aparecen en la comunidad ni en Mis creaciones. Luego se renombran o quitan en Admin → Productos → Personalizables
        (pestaña Plantillas de cada uno).
      </p>
      <section className={s.grupo}>
        <h2>1. Los productos en Crear</h2>
        <p>
          Crea el cuadro (31 × 25 cm), el mousepad (23.5 × 19.5 cm) y el tomatodo grabado como productos de Crear, con la foto
          de la tienda sin fondo, y el Pack de oficina como combo. También hace que <em>Personalizar</em> de esos productos de la
          tienda lleve a ellos. Lo que ya exista no se repite.
        </p>
        <Boton variante="contorno" onClick={crearProductos} cargando={creandoProductos} disabled={!user || trabajando}>Crear productos y pack</Boton>
        {pasoProductos && <small className={pasoProductos.startsWith('Error') ? s.error : undefined}>{pasoProductos}</small>}
      </section>

      <h2 className={s.subtitulo}>2. Las plantillas</h2>
      <Aviso tipo="info" compacto>
        Volver a guardarlas reemplaza las mismas plantillas (no se duplican).
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
                  {x.grupo} · {x.nombre}
                </label>
                {estado[x.id] && <small className={estado[x.id].startsWith('Error') ? s.error : undefined}>{estado[x.id]}</small>}
              </li>
            ))}
          </ul>
        </section>
      ))}

      <Boton onClick={importar} cargando={trabajando} disabled={!listas || !user || prendas.isLoading || editadas.isLoading}>
        Guardar plantillas en los productos
      </Boton>

      <section className={s.grupo}>
        <h2>3. Quitar las copias de la comunidad</h2>
        <p>
          La versión anterior de esta pantalla publicó las plantillas en la comunidad y las guardó en tus creaciones. Esto las
          retira de la comunidad y las borra de Mis creaciones. Las plantillas de los productos no se tocan.
        </p>
        <Boton variante="contorno" onClick={limpiar} disabled={!user || trabajando || limpieza.startsWith('Quitando')}>Quitar copias</Boton>
        {limpieza && <small className={limpieza.startsWith('Error') ? s.error : undefined}>{limpieza}</small>}
      </section>

      <section className={s.grupo}>
        <h2>4. Pasarlos a la tienda</h2>
        <p>
          Desde ahora cada uno es un solo producto: el de Crear sale también en la tienda y en la página de Yoryo, con las
          fotos, la descripción, la categoría y las etiquetas del de la tienda, y su botón es <em>Personalízalo</em>. El Pack
          de oficina igual, con su portada. Los cuatro productos de la tienda de antes se ocultan; sus enlaces llevan a los
          nuevos. Hazlo después de los pasos 1 y 2.
        </p>
        <Boton variante="contorno" onClick={pasarATienda} cargando={pasandoATienda} disabled={!user || trabajando || creandoProductos}>Pasar a la tienda</Boton>
        {pasoTienda && <small className={pasoTienda.startsWith('Error') ? s.error : undefined}>{pasoTienda}</small>}
      </section>

      <section className={s.grupo}>
        <h2>5. El tomatodo con la foto nueva</h2>
        <p>
          Para el vaso negro con asa sin fondo (1086 × 1448) subido como foto propia del color: pone la zona de grabado
          centrada en el cuerpo (sin tocar el aro ni el asa), la línea de referencia de borde a borde y esa foto como base, y
          rehace las miniaturas de sus plantillas. Las plantillas siguen en su lugar.
        </p>
        <Boton variante="contorno" onClick={ajustarTomatodo} cargando={ajustandoTomatodo} disabled={!user || trabajando}>Ajustar el tomatodo</Boton>
        {pasoTomatodo && <small className={pasoTomatodo.startsWith('Error') ? s.error : undefined}>{pasoTomatodo}</small>}
      </section>

      <section className={s.grupo}>
        <h2>6. Billetera y esclava grabadas</h2>
        <p>
          Crea la billetera Cónsul y la esclava grabadas con láser como productos de Crear, con sus plantillas: iniciales o
          nombre con un símbolo (flecha, infinito, estrella, corazón, rayo o montaña), con fecha, solo el texto o en letra
          escrita. Después junta cada uno con su ficha de la tienda en <strong>una sola ficha</strong>: sale en la tienda con
          <em> Agregar al carrito</em> (tal cual, al mismo precio) y <em>Personalízalo</em>, con el nombre, la descripción, el
          precio, el stock y la categoría de la tienda. La ficha de tienda de antes queda como reemplazada: la web lleva a la
          nueva, y la app de Android y los combos la siguen usando. También arma los combos Ónix, Oro y Medianoche como packs de
          Crear con el reloj tal cual. Las medidas en cm son estimadas: corrígelas en la ficha (pestaña Diseño) cuando el taller
          las confirme. Lo que ya exista no se repite; las plantillas y las fotos se rehacen.
        </p>
        <Boton variante="contorno" onClick={crearGrabados} cargando={creandoGrabados} disabled={!user || trabajando}>Crear billetera, esclava y packs</Boton>
        {pasoGrabados && <small className={pasoGrabados.startsWith('Error') ? s.error : undefined}>{pasoGrabados}</small>}
      </section>
    </div>
  );
}
