import React, { useId, useState, useRef, useLayoutEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import styles from './FaqAccordion.module.css';
import { TextoSeccion } from '../textStyleUtils.jsx';

// Debe coincidir con el `gap` de .list en FaqAccordion.module.css (0.75rem
// sobre una raiz de 16px). Se usa para calcular el alto reservado de la lista.
const LIST_GAP_PX = 12;

const FaqAccordion = ({ config = {} }) => {
  const items = Array.isArray(config.items) ? config.items : [];
  const [openIdx, setOpenIdx] = useState(config.defaultOpen === true ? 0 : -1);
  const accordionId = useId();

  // ── Alto reservado para que el footer (y todo lo de abajo) NUNCA se mueva ──
  // Sin esto, abrir una tarjeta la hace crecer "en el sitio" y empuja todo lo
  // que viene despues, footer global incluido. En vez de eso, reservamos de
  // entrada el alto MAXIMO posible: todas las preguntas cerradas + la
  // respuesta mas larga de todas abierta. .list nunca cambia de alto total;
  // abrir una pregunta solo "rellena" el espacio que ya estaba reservado.
  // Con todo cerrado queda un poco de aire constante antes del footer (no
  // una raya en blanco que aparece/desaparece).
  const questionRefs = useRef([]);
  const answerRefs = useRef([]);
  const [listMinHeight, setListMinHeight] = useState(undefined);
  questionRefs.current = [];
  answerRefs.current = [];

  // Firma de contenido: si el admin edita una pregunta/respuesta en vivo
  // (visual editor), el alto natural de las tarjetas puede cambiar.
  const itemsSignature = items.map((it) => `${it.question || ''}::${it.answer || ''}`).join('|');

  useLayoutEffect(() => {
    const measure = () => {
      const qEls = questionRefs.current.filter(Boolean);
      const aEls = answerRefs.current.filter(Boolean);
      if (qEls.length === 0) return;

      const questionsTotal = qEls.reduce((sum, el) => sum + el.offsetHeight, 0);
      // .answerClip tiene overflow:hidden y su alto lo fija la fila de grid
      // (0fr cuando esta cerrado), pero scrollHeight siempre reporta el alto
      // NATURAL del contenido, este visible o no — por eso funciona aunque
      // TODAS las respuestas esten cerradas al medir.
      const maxAnswer = aEls.reduce((max, el) => Math.max(max, el.scrollHeight), 0);
      const gapsTotal = LIST_GAP_PX * Math.max(0, qEls.length - 1);

      setListMinHeight(questionsTotal + gapsTotal + maxAnswer);
    };

    measure();

    // El alto de una respuesta puede cambiar si el texto reflowea al
    // redimensionar la ventana (el layout pasa a una sola columna en mobile).
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsSignature]);

  if (items.length === 0) return null;

  return (
    <div
      className={`${styles.root} ${config.layout === 'top' ? styles.topLayout : ''}`}
      style={{
        backgroundColor: config.backgroundColor || 'transparent',
        // Solo se fija inline si el admin lo configuro explicitamente: un
        // estilo inline SIEMPRE gana sobre la clase CSS, asi que forzar aqui
        // un '1rem' por defecto tapaba el padding-top/bottom de .root
        // (--section-gap) y la seccion quedaba pegada al footer sin que se
        // notara por que. Sin valor configurado, manda el CSS del componente.
        ...(config.paddingTop ? { paddingTop: config.paddingTop } : {}),
        ...(config.paddingBottom ? { paddingBottom: config.paddingBottom } : {}),
      }}
    >
      <div className={styles.layout}>
        <div className={styles.heading}>
          {config.title && (
            <TextoSeccion settings={config} prefix="title" as="h2" className={styles.title}>
              {config.title}
            </TextoSeccion>
          )}
          {config.subtitle && <p className={styles.subtitle}>{config.subtitle}</p>}
        </div>
        <div className={styles.list} style={{ minHeight: listMinHeight }}>
          {items.map((item, idx) => {
            const isOpen = openIdx === idx;
            const answerId = `${accordionId}-answer-${idx}`;
            return (
              <div key={item.id || idx} className={styles.item}>
                <button
                  ref={(el) => { questionRefs.current[idx] = el; }}
                  type="button"
                  className={styles.question}
                  onClick={() => setOpenIdx(isOpen ? -1 : idx)}
                  aria-expanded={isOpen}
                  aria-controls={answerId}
                >
                  <span>{item.question}</span>
                  <ChevronDown
                    className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}
                    aria-hidden="true"
                    size={18}
                    strokeWidth={2.25}
                  />
                </button>
                {item.answer && (
                  <div
                    id={answerId}
                    className={`${styles.answerWrap} ${isOpen ? styles.open : ''}`}
                    aria-hidden={!isOpen}
                  >
                    <div ref={(el) => { answerRefs.current[idx] = el; }} className={styles.answerClip}>
                      <div className={styles.answer}>
                        <p className={styles.answerInner}>{item.answer}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default FaqAccordion;
