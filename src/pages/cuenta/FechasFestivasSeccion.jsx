// Fechas festivas en "Fechas importantes": aparecen SOLO cuando se acercan
// (DIAS_ANTICIPACION), con ideas de regalo para cada persona a la que le tocan.
// El resto del año no se muestra nada. Las fechas y a quién le tocan salen de
// utils/fechasFestivas (configurables en el admin); las ideas, del buscador.
import React from 'react';
import { Link } from 'react-router-dom';
import { Check, Plus, ShoppingCart } from 'lucide-react';
import { GlassCard, Reveal } from '../../components/ui';
import { PLACEHOLDER_IMG } from '../../constants/placeholder';
import { textoFecha, DIAS_ANTICIPACION } from '../../utils/fechasFestivas.mjs';
import styles from './CuentaFechasImportantesPage.module.css';


const cuando = (dias) => {
  if (dias === 0) return '¡Es hoy!';
  if (dias === 1) return 'Mañana';
  return `En ${dias} días`;
};

const IdeaFila = ({ producto: p, motivo, agregado, onAgregar }) => {
  const precio = Number(p.salePrice) > 0 ? p.salePrice : p.price;
  return (
    <li className={styles.ideaItem}>
      <img
        src={p.images?.[0] || p.mainImage || PLACEHOLDER_IMG}
        alt=""
        className={styles.ideaImg}
        loading="lazy"
        onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMG; }}
      />
      <div className={styles.ideaTexto}>
        <Link to={`/producto/${p.id}`} className={styles.ideaNombre}>{p.name}</Link>
        <span className={styles.ideaMotivo}>{motivo}</span>
        <span className={styles.ideaPrecio}>S/ {precio}</span>
      </div>
      <button
        type="button"
        className={`${styles.ideaBtn} ${agregado ? styles.ideaBtnHecho : ''}`}
        onClick={() => !agregado && onAgregar(p)}
        disabled={agregado}
        aria-label={agregado ? 'Agregado al carrito' : `Agregar ${p.name} al carrito`}
      >
        {agregado ? <Check size={16} aria-hidden="true" /> : <ShoppingCart size={16} aria-hidden="true" />}
      </button>
    </li>
  );
};

const FechasFestivasSeccion = ({ proximas, recomendar, cargandoIdeas, onAddNew, ideasAgregadas, onAgregar }) => {
  const cercanas = (proximas || []).filter((f) => f.dias <= DIAS_ANTICIPACION);
  if (cercanas.length === 0) return null;

  return cercanas.map((f) => (
    <Reveal key={f.id}>
      <GlassCard variant="solid" padding="lg" animate={false} className={styles.card}>
        <section className={styles.festivaDestacada} aria-labelledby={`festiva-${f.id}`}>
          <div className={styles.festivaCabecera}>
            <span className={styles.festivaEmoji} aria-hidden="true">{f.emoji || '🎁'}</span>
            <div>
              <h2 id={`festiva-${f.id}`} className={styles.festivaTitulo}>
                {f.dias === 0 ? `¡Hoy es ${f.nombre}!` : `Se acerca el ${f.nombre}`}
              </h2>
              <p className={styles.festivaFecha}>
                {textoFecha(f.fecha)} · <strong>{cuando(f.dias)}</strong>
              </p>
            </div>
          </div>

          {f.personas.length > 0 ? (
            <div className={styles.festivaPersonas}>
              {f.personas.slice(0, 3).map((rec) => {
                const ideas = cargandoIdeas ? [] : recomendar(rec, { ocasion: f.nombre, limite: 3 });
                return (
                  <div key={rec.id || rec.name} className={styles.festivaPersona}>
                    <p className={styles.ideasTitle}>Ideas para {rec.name}</p>
                    {cargandoIdeas ? (
                      <p className={styles.ideasVacio}>Buscando ideas…</p>
                    ) : ideas.length > 0 ? (
                      <ul className={styles.ideasLista}>
                        {ideas.map((idea) => (
                          <IdeaFila
                            key={idea.producto.id}
                            {...idea}
                            agregado={ideasAgregadas.has(idea.producto.id)}
                            onAgregar={onAgregar}
                          />
                        ))}
                      </ul>
                    ) : (
                      <p className={styles.ideasVacio}>
                        Todavía no tenemos algo pensado para {rec.name}. Mira la tienda o cuéntanos qué le gusta.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={styles.festivaSinPersonas}>
              <p>
                ¿Le vas a regalar a alguien por el {f.nombre}? Agrégalo y te damos ideas a su medida,
                con aviso antes de la fecha.
              </p>
              <button type="button" onClick={onAddNew} className={styles.btnSolido}>
                <Plus size={17} aria-hidden="true" /> Añadir persona
              </button>
            </div>
          )}
          <Link to="/tienda" className={styles.verMasLink}>Ver regalos en la tienda →</Link>
        </section>
      </GlassCard>
    </Reveal>
  ));
};

export default FechasFestivasSeccion;
