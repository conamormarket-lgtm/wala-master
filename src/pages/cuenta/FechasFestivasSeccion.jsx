// Fechas festivas en "Fechas importantes": la próxima (Día de la Madre, Navidad…)
// destacada con ideas de regalo para cada persona a la que le toca, y las que
// vienen después. Las fechas y a quién le tocan salen de utils/fechasFestivas
// (configurables en el admin); las ideas, del buscador de regalos.
import React from 'react';
import { Link } from 'react-router-dom';
import { Check, Plus, ShoppingCart } from 'lucide-react';
import { GlassCard, Reveal } from '../../components/ui';
import { PLACEHOLDER_IMG } from '../../constants/placeholder';
import { textoFecha } from '../../utils/fechasFestivas.mjs';
import styles from './CuentaFechasImportantesPage.module.css';

// Se destaca la próxima si falta un mes o menos; antes no sirve para regalar.
const DIAS_DESTACAR = 30;
const PROXIMAS_A_MOSTRAR = 5;

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
  if (!proximas || proximas.length === 0) return null;
  const destacada = proximas[0].dias <= DIAS_DESTACAR ? proximas[0] : null;
  const siguientes = proximas.filter((f) => f !== destacada).slice(0, PROXIMAS_A_MOSTRAR);

  return (
    <Reveal>
      <GlassCard variant="solid" padding="lg" animate={false} className={styles.card}>
        {destacada && (
          <section className={styles.festivaDestacada} aria-labelledby="festiva-destacada">
            <div className={styles.festivaCabecera}>
              <span className={styles.festivaEmoji} aria-hidden="true">{destacada.emoji || '🎁'}</span>
              <div>
                <h2 id="festiva-destacada" className={styles.festivaTitulo}>
                  Se acerca el {destacada.nombre}
                </h2>
                <p className={styles.festivaFecha}>
                  {textoFecha(destacada.fecha)} · <strong>{cuando(destacada.dias)}</strong>
                </p>
              </div>
            </div>

            {destacada.personas.length > 0 ? (
              <div className={styles.festivaPersonas}>
                {destacada.personas.slice(0, 3).map((rec) => {
                  const ideas = cargandoIdeas ? [] : recomendar(rec, { ocasion: destacada.nombre, limite: 3 });
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
                  ¿Le vas a regalar a alguien por el {destacada.nombre}? Agrégalo y te damos ideas a su medida,
                  con aviso antes de la fecha.
                </p>
                <button type="button" onClick={onAddNew} className={styles.btnSolido}>
                  <Plus size={17} aria-hidden="true" /> Añadir persona
                </button>
              </div>
            )}
            <Link to="/tienda" className={styles.verMasLink}>Ver regalos en la tienda →</Link>
          </section>
        )}

        {siguientes.length > 0 && (
          <section aria-labelledby="festivas-proximas" className={destacada ? styles.festivasSeparadas : ''}>
            <h3 id="festivas-proximas" className={styles.festivasSubtitulo}>
              {destacada ? 'Después vienen' : 'Próximas fechas para regalar'}
            </h3>
            <ul className={styles.festivasLista}>
              {siguientes.map((f) => (
                <li key={f.id} className={styles.festivaItem}>
                  <span className={styles.festivaItemEmoji} aria-hidden="true">{f.emoji || '🎁'}</span>
                  <span className={styles.festivaItemNombre}>{f.nombre}</span>
                  <span className={styles.festivaItemFecha}>{textoFecha(f.fecha)}</span>
                  {f.personas.length > 0 && (
                    <span className={styles.festivaItemPara}>
                      Para {f.personas.map((p) => p.name).join(', ')}
                    </span>
                  )}
                  <span className={styles.festivaItemDias}>{cuando(f.dias)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </GlassCard>
    </Reveal>
  );
};

export default FechasFestivasSeccion;
