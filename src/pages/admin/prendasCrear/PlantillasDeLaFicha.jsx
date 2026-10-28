import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import CreatableSelect from 'react-select/creatable';
import { Plus, Pencil, X, Download, Loader2, LayoutTemplate } from 'lucide-react';
import { getDocument } from '../../../services/firebase/firestore';
import { getPrendasBaseAdmin } from '../../../services/prendasBase';
import { useGlobalToast } from '../../../contexts/ToastContext';
import { leerPrendaBase, leerPlantillas } from '../../../utils/prendaBase';
import {
  cambiarPlantillaDelProducto, quitarPlantillaDelProducto, traerPlantillas,
} from '../../Crear/plantillasProducto';
import styles from './PlantillasDeLaFicha.module.css';

const GRUPOS_BASE = ['Parejas', 'Equipos'];

/**
 * La pestaña "Plantillas" de la ficha de un producto de Crear: los diseños
 * para empezar que el cliente ve en el estudio ("Empieza con un diseño"),
 * por grupo (Parejas, Equipos…). Todo se guarda al momento en el producto
 * (no espera a "Guardar cambios"), igual que "Guardar como plantilla" en el
 * estudio: así la ficha y el estudio nunca se pisan.
 *  - prendaId: el id del producto (también el de un borrador sin guardar)
 *  - guardado: el producto ya existe (sin eso no se puede abrir el estudio)
 *  - plantillas · onPlantillas(lista): la copia del formulario
 */
const PlantillasDeLaFicha = ({ prendaId, guardado, plantillas, onPlantillas }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useGlobalToast();
  const [grupo, setGrupo] = useState(null);
  const [ocupado, setOcupado] = useState(null);
  const [trayendo, setTrayendo] = useState(null); // { origenId, elegidas: Set }

  // Lo que está guardado en el producto (lo pudo cambiar el estudio). La
  // ficha pasa onPlantillas nueva en cada render: va por ref.
  const avisar = useRef(onPlantillas);
  avisar.current = onPlantillas;
  const refrescar = useCallback(async () => {
    if (!guardado || !prendaId) return;
    const { data } = await getDocument('productos_wala', prendaId);
    if (data) avisar.current(leerPlantillas(data.prendaBase?.plantillas));
  }, [guardado, prendaId]);
  useEffect(() => { refrescar(); }, [refrescar]);

  const grupos = useMemo(() => [...new Set(plantillas.map((p) => p.grupo).filter(Boolean))], [plantillas]);
  const opcionesGrupo = [...new Set([...GRUPOS_BASE, ...grupos])].map((g) => ({ value: g, label: g }));
  const visibles = grupo ? plantillas.filter((p) => p.grupo === grupo) : plantillas;
  // Para volver aquí desde el estudio.
  const desde = `${location.pathname}?pestana=plantillas`;

  const hacer = async (clave, accion, exito) => {
    setOcupado(clave);
    try {
      const lista = await accion();
      onPlantillas(leerPlantillas(lista));
      if (exito) toast.success(exito);
    } catch (e) {
      toast.error(e.message || 'No se pudo guardar.');
    } finally {
      setOcupado(null);
    }
  };
  const cambiar = (p, cambios) => {
    if (Object.entries(cambios).every(([k, v]) => p[k] === v)) return;
    onPlantillas(plantillas.map((x) => (x.id === p.id ? { ...x, ...cambios } : x)));
    hacer(p.id, () => cambiarPlantillaDelProducto(prendaId, p.id, cambios));
  };
  const quitar = (p) => {
    if (!window.confirm(`¿Quitar la plantilla «${p.nombre}»? Deja de aparecer en el estudio.`)) return;
    hacer(p.id, () => quitarPlantillaDelProducto(prendaId, p.id), 'Plantilla quitada.');
  };
  const abrirEstudio = (param) => navigate(`/crear/${prendaId}?${param}`, { state: { desde } });

  // ── Traer de otro producto ──
  const { data: productos = [] } = useQuery({
    queryKey: ['admin-prendas-crear', 'con-plantillas'],
    queryFn: async () => (await getPrendasBaseAdmin()).data,
    enabled: Boolean(trayendo),
    staleTime: 60_000,
  });
  const conPlantillas = productos
    .filter((p) => p.id !== prendaId)
    .map((p) => ({ ...p, lista: leerPlantillas(p.prendaBase?.plantillas) }))
    .filter((p) => p.lista.length);
  const origen = conPlantillas.find((p) => p.id === trayendo?.origenId);
  const traer = async () => {
    setOcupado('traer');
    try {
      const { data } = await getDocument('productos_wala', prendaId);
      if (!data) throw new Error('Guarda el producto antes de traer plantillas.');
      const cfg = leerPrendaBase(data);
      const elegidas = origen.lista.filter((p) => trayendo.elegidas.has(p.id));
      const { traidas, saltadas } = await traerPlantillas({
        destinoId: prendaId,
        destino: { vistas: cfg.vistas, colores: cfg.colores, laser: cfg.tecnica === 'laser' },
        plantillas: elegidas,
      });
      await refrescar();
      setTrayendo(null);
      if (traidas) toast.success(`${traidas === 1 ? 'Se trajo 1 plantilla' : `Se trajeron ${traidas} plantillas`}${saltadas ? ` (${saltadas} no encajan en sus zonas)` : ''}.`);
      else toast.error('Ninguna encaja en las zonas de este producto.');
    } catch (e) {
      toast.error(e.message || 'No se pudieron traer las plantillas.');
    } finally {
      setOcupado(null);
    }
  };

  return (
    <section className={styles.plantillas}>
      <div className={styles.cabecera}>
        <div>
          <h2 className={styles.titulo}>Plantillas ({plantillas.length})</h2>
          <p className={styles.ayuda}>
            Los diseños para empezar que el cliente ve en el estudio, agrupados en pestañas. Se guardan al momento.
          </p>
        </div>
        <div className={styles.acciones}>
          <button type="button" className={styles.principal} disabled={!guardado} onClick={() => abrirEstudio('nuevaPlantilla=1')}>
            <Plus size={16} aria-hidden="true" /> Nueva plantilla
          </button>
          <button type="button" className={styles.secundario} disabled={!guardado} onClick={() => setTrayendo((t) => (t ? null : { origenId: '', elegidas: new Set() }))}>
            <Download size={16} aria-hidden="true" /> Traer de otro producto
          </button>
        </div>
      </div>
      {!guardado && <p className={styles.aviso}>Guarda el producto (con sus vistas y zonas) para agregarle plantillas.</p>}

      {trayendo && (
        <div className={styles.traer}>
          <label className={styles.campo}>
            <span>Traer plantillas de</span>
            <select value={trayendo.origenId} onChange={(e) => setTrayendo({ origenId: e.target.value, elegidas: new Set() })}>
              <option value="">Elige un producto…</option>
              {conPlantillas.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.lista.length})</option>)}
            </select>
          </label>
          {origen && (
            <>
              <div className={styles.elegirTodas}>
                <button type="button" className={styles.texto} onClick={() => setTrayendo((t) => ({ ...t, elegidas: new Set(origen.lista.map((p) => p.id)) }))}>Elegir todas</button>
                <button type="button" className={styles.texto} onClick={() => setTrayendo((t) => ({ ...t, elegidas: new Set() }))}>Ninguna</button>
              </div>
              <ul className={styles.rejilla}>
                {origen.lista.map((p) => {
                  const elegida = trayendo.elegidas.has(p.id);
                  return (
                    <li key={p.id}>
                      <label className={`${styles.tarjeta} ${elegida ? styles.elegida : ''}`}>
                        <input
                          type="checkbox"
                          checked={elegida}
                          onChange={() => setTrayendo((t) => {
                            const elegidas = new Set(t.elegidas);
                            if (elegidas.has(p.id)) elegidas.delete(p.id); else elegidas.add(p.id);
                            return { ...t, elegidas };
                          })}
                        />
                        <span className={styles.foto}>{p.imagen ? <img src={p.imagen} alt="" /> : <LayoutTemplate aria-hidden="true" />}</span>
                        <span className={styles.nombre}>{p.nombre}</span>
                        {p.grupo && <span className={styles.grupo}>{p.grupo}</span>}
                      </label>
                    </li>
                  );
                })}
              </ul>
              <p className={styles.ayuda}>
                Cada diseño va a la misma zona o a la más parecida (pecho con pecho). Sus imágenes se copian a este producto.
              </p>
            </>
          )}
          <div className={styles.acciones}>
            <button type="button" className={styles.principal} disabled={!origen || !trayendo.elegidas.size || ocupado === 'traer'} onClick={traer}>
              {ocupado === 'traer' && <Loader2 size={15} className={styles.girando} aria-hidden="true" />}
              {trayendo.elegidas.size ? `Traer ${trayendo.elegidas.size}` : 'Traer'}
            </button>
            <button type="button" className={styles.texto} onClick={() => setTrayendo(null)}>Cancelar</button>
          </div>
        </div>
      )}

      {grupos.length > 0 && (
        <div className={styles.chips} role="tablist" aria-label="Grupos de plantillas">
          {[null, ...grupos].map((g) => (
            <button key={g || 'todas'} type="button" role="tab" aria-selected={grupo === g}
              className={`${styles.chip} ${grupo === g ? styles.chipActivo : ''}`} onClick={() => setGrupo(g)}>
              {g || 'Todas'} <small>{g ? plantillas.filter((p) => p.grupo === g).length : plantillas.length}</small>
            </button>
          ))}
        </div>
      )}

      {plantillas.length === 0 ? (
        <p className={styles.vacio}>
          Aún no tiene plantillas. Crea una con <strong>Nueva plantilla</strong> o trae las de otro producto parecido.
        </p>
      ) : (
        <ul className={styles.rejilla}>
          {visibles.map((p) => (
            <li key={p.id} className={styles.tarjeta}>
              <span className={styles.foto}>
                {p.imagen ? <img src={p.imagen} alt="" /> : <LayoutTemplate aria-hidden="true" />}
                {ocupado === p.id && <span className={styles.cargando}><Loader2 size={18} className={styles.girando} aria-hidden="true" /></span>}
              </span>
              <label className={styles.campo}>
                <span>Nombre</span>
                <input defaultValue={p.nombre} onBlur={(e) => cambiar(p, { nombre: e.target.value.trim() || p.nombre })} />
              </label>
              <div className={styles.campo}>
                <span>Grupo</span>
                <CreatableSelect
                  classNamePrefix="grupo"
                  isClearable
                  placeholder="Sin grupo"
                  formatCreateLabel={(v) => `Crear «${v}»`}
                  options={opcionesGrupo}
                  value={p.grupo ? { value: p.grupo, label: p.grupo } : null}
                  onChange={(op) => cambiar(p, { grupo: op?.value || '' })}
                  menuPlacement="auto"
                />
              </div>
              <div className={styles.accionesTarjeta}>
                <button type="button" className={styles.secundario} disabled={!guardado} onClick={() => abrirEstudio(`editarPlantilla=${encodeURIComponent(p.id)}`)}>
                  <Pencil size={14} aria-hidden="true" /> Editar
                </button>
                <button type="button" className={styles.peligro} onClick={() => quitar(p)} aria-label={`Quitar ${p.nombre}`}>
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default PlantillasDeLaFicha;
