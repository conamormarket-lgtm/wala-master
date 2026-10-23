// Historial de las preguntas de la encuesta. Puro (sin Firebase): lo usa el
// admin de Encuestas al guardar y lo muestra "Respuestas de la encuesta"
// (pestaña "Cambiadas o retiradas"). Al guardar se compara con lo que había y se anota
// el texto anterior (antes: [{ label, hasta }]) y el día en que se dejó de
// preguntar (retiradaEl). Volver a preguntarla borra retiradaEl.
export const hoyLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const conHistorial = (actual, previo, campoTexto, hoy) => {
  if (!previo) return actual;
  const out = { ...actual };
  if (previo[campoTexto] && actual[campoTexto] !== previo[campoTexto]) {
    out.antes = [...(Array.isArray(actual.antes) ? actual.antes : []), { label: previo[campoTexto], hasta: hoy }];
  }
  const estaba = previo.enEncuesta !== false;
  const esta = actual.enEncuesta !== false;
  if (estaba && !esta) out.retiradaEl = hoy;
  if (!estaba && esta) delete out.retiradaEl;
  return out;
};
export const configConHistorial = (config, original, hoy = hoyLocal()) => {
  if (!original) return config;
  const porId = (lista) => new Map((lista || []).map((x) => [x.id, x]));
  const basicosPrevios = porId(original.basicDataPanel?.fields);
  const catsPrevias = porId(original.brandsPanel?.categories);
  const personPanel = { ...config.personPanel };
  const tenia = Boolean(original.personPanel?.budget);
  if (tenia && !personPanel.budget) personPanel.budgetRetiradoEl = hoy;
  if (!tenia && personPanel.budget) delete personPanel.budgetRetiradoEl;
  return {
    ...config,
    personPanel,
    basicDataPanel: {
      ...config.basicDataPanel,
      fields: (config.basicDataPanel?.fields || []).map((f) => conHistorial(f, basicosPrevios.get(f.id), 'label', hoy)),
    },
    brandsPanel: {
      ...config.brandsPanel,
      categories: (config.brandsPanel?.categories || []).map((c) => {
        const previa = catsPrevias.get(c.id);
        const campos = porId(previa?.fields);
        return {
          ...conHistorial(c, previa, 'name', hoy),
          fields: (c.fields || []).map((f) => conHistorial(f, campos.get(f.id), 'label', hoy)),
        };
      }),
    },
  };
};
