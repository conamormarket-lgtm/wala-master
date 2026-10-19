/*
 * El adaptador de la encuesta, aparte de adaptadores.js (que va en el archivo
 * principal de la tienda): solo lo usa /encuesta-suscripcion.
 */

/**
 * tienda_encuesta_config (leerSurveyConfig, con DEFAULT_SURVEY_CONFIG) →
 * { config, conjuntos } de PaginaEncuesta. Las sugerencias de cada campo de
 * texto salen de useGiftCatalog (sugerenciasCampo): pasarlas en `sugerencias`.
 *  - sugerencias(conjunto, campo) → [texto]
 */
export const encuestaDesdeConfig = (c = {}, sugerencias) => ({
  config: {
    portada: {
      titulo: c.introPanel?.title,
      subtitulo: c.introPanel?.subtitle,
      textoEmpezar: c.introPanel?.continueButtonText,
      textoOmitir: c.introPanel?.skipButtonText,
    },
    sobreTi: {
      titulo: c.basicDataPanel?.title,
      subtitulo: c.basicDataPanel?.subtitle,
      campos: (c.basicDataPanel?.fields || []).map((f) => ({
        id: f.id, etiqueta: f.label, tipo: f.type === 'select' ? 'opciones' : 'texto', opciones: f.options || [], requerido: Boolean(f.required),
      })),
    },
    gracias: {
      titulo: c.completionPanel?.title,
      mensaje: c.completionPanel?.message,
      textoBoton: c.completionPanel?.buttonText,
    },
  },
  conjuntos: (c.brandsPanel?.categories || []).map((cat) => ({
    id: cat.id,
    nombre: cat.name,
    campos: (cat.fields || []).map((f) => (f.type === 'select'
      ? { id: f.id, etiqueta: f.label, opciones: f.options || [] }
      : { id: f.id, etiqueta: f.label, sugerencias: sugerencias ? sugerencias(cat, f) : [] })),
  })),
});
