import React, { useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Trash2, Paintbrush, ShoppingBag, Clock, Users } from 'lucide-react';
import { getComboCrear } from '../../services/combosCrear';
import { useAlVerUnaVez } from '../../hooks/useAlVerUnaVez';
import { precioBase } from '../../utils/prendaBase';
import NombreEditable from './NombreEditable';
import AccionesComunidad, { InsigniaPublicada } from '../Comunidad/AccionesComunidad';
import { fechaDeCreacion, guardadaHace } from '../cuenta/components/MiCreacionCard';
import styles from '../cuenta/MisCreacionesPage.module.css';
import estilosEliminar from './EliminarCreacion.module.css';
import propios from './TarjetaMiCombo.module.css';

const soles = (n) => `S/ ${Number(n || 0).toFixed(2)}`;

/**
 * "Mi combo" en Mis creaciones: UNA tarjeta con todas sus prendas juntas
 * (en vez de una por prenda). Abre el combo con lo suyo ya puesto para
 * comprarlo o seguir editándolo; el admin lo publica entero en la comunidad.
 */
const TarjetaMiCombo = ({ design, onEliminar, onRenombrado, onComunidad }) => {
  const { pathname } = useLocation();
  const fotoRef = useRef(null);
  const visto = useAlVerUnaVez(fotoRef);
  const { data: combo } = useQuery({
    queryKey: ['combo-crear', design.comboId],
    enabled: Boolean(design.comboId),
    queryFn: async () => (await getComboCrear(design.comboId)).data,
  });
  const previas = (design.previas || []).filter(Boolean);
  const url = `/combo/${design.comboId}?mio=${design.id}`;
  const disponible = Boolean(combo) && combo.publicado && combo.deleted !== true;
  const fecha = fechaDeCreacion(design);

  return (
    <li className={styles.card}>
      <div className={styles.media}>
        <Link to={url} className={styles.foto} aria-label={`Abrir el combo ${design.name || ''}`}>
          <span ref={fotoRef} className={`${propios.prendas} ${visto ? propios.saludo : ''}`} style={{ '--n': Math.max(previas.length, 1) }}>
            {previas.map((src, i) => <img key={`${src}-${i}`} src={src} alt="" loading="lazy" />)}
          </span>
        </Link>
        <div className={styles.insignias}>
          <span className={propios.insignia}>
            <Users size={12} strokeWidth={2.5} aria-hidden="true" /> Combo · {(design.piezas || []).length} prendas
          </span>
          <InsigniaPublicada design={design} />
        </div>
        {onEliminar && (
          <button
            type="button"
            className={estilosEliminar.botonTarjeta}
            onClick={() => onEliminar(design)}
            aria-label={`Quitar el combo ${design.name || ''}`}
            title="Quitar el combo"
          >
            <Trash2 size={16} aria-hidden="true" />
          </button>
        )}
      </div>

      <div className={styles.info}>
        <NombreEditable
          designId={design.id}
          nombre={design.name || 'Mi combo'}
          como="h3"
          className={styles.nombre}
          onCambiado={(nuevo) => onRenombrado?.(design.id, nuevo)}
        />
        <p className={styles.prenda}>
          <span className={styles.prendaTexto}>{design.comboNombre || 'Combo'}</span>
        </p>
        {fecha && (
          <p className={styles.fecha}>
            <Clock size={12} aria-hidden="true" /> {guardadaHace(fecha)}
          </p>
        )}
        <div className={styles.pie}>
          <div className={styles.precios}>
            {combo && <span className={styles.precio}>{soles(precioBase(combo))}</span>}
          </div>
          {disponible && (
            <div className={styles.acciones}>
              <Link to={url} state={{ desde: pathname }} className={styles.botonEditar} aria-label="Editar el combo" title="Editar el combo">
                <Paintbrush size={16} aria-hidden="true" />
              </Link>
              <Link to={url} className={styles.botonPrincipal}>
                <ShoppingBag size={15} aria-hidden="true" /> Comprar
              </Link>
            </div>
          )}
        </div>
        {!disponible && combo !== undefined && (
          <p className={styles.fecha}>Este combo ya no se vende. Sus prendas siguen en tus creaciones.</p>
        )}
        <AccionesComunidad design={design} onCambio={(estado) => onComunidad?.(design.id, estado)} />
      </div>
    </li>
  );
};

export default TarjetaMiCombo;
