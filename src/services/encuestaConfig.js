import { db } from './firebase/config';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { configConOrigenCompra } from './encuestaOrigen.mjs';

const COLLECTION_NAME = 'tienda_encuesta_config';
const GLOBAL_DOC_ID = 'global';

export const DEFAULT_SURVEY_CONFIG = configConOrigenCompra({
  // Panel 0: Hook / Intro
  introPanel: {
    title: '¡Queremos conocerte mejor!',
    subtitle: 'Tus respuestas nos ayudarán a darte una experiencia increíble.',
    description: 'Completa esta encuesta para recibir recomendaciones y regalos a la medida de cada persona. Toma unos 2 minutos.',
    continueButtonText: 'Empezar Encuesta',
    skipButtonText: 'No, gracias',
    imageUrl: '' // Opcional, para subir una imagen atractiva
  },
  
  // Panel 1: Datos Básicos. En cada pregunta, enEncuesta: false la guarda
  // (sale en las respuestas de antes) pero la encuesta ya no la hace. El
  // nombre y el cumpleaños solo se preguntan a quien no los tiene en su cuenta.
  basicDataPanel: {
    title: 'Un poco sobre ti',
    subtitle: 'Queremos saber qué te gusta',
    fields: [
      {
        id: 'nombres',
        label: '¿Cómo te llamas?',
        type: 'text',
        required: true,
        options: []
      },
      {
        id: 'familia',
        enEncuesta: false,
        label: '¿Tienes familia?',
        type: 'select',
        required: false,
        options: ['Vivo solo/a', 'Vivo en pareja', 'Tengo hijos', 'Vivo con mis padres/familiares']
      },
      {
        id: 'frecuencia_ropa',
        enEncuesta: false,
        label: '¿Con qué frecuencia sueles comprar ropa?',
        type: 'select',
        required: false,
        options: ['Cada semana', 'Al menos una vez al mes', 'Solo en ocasiones especiales o cambios de temporada', 'Casi nunca']
      },
      {
        id: 'para_quien',
        label: '¿Para quién compras en Walá?',
        type: 'select',
        required: false,
        options: ['Para regalar', 'Para mí', 'Las dos']
      },
      {
        id: 'como_nos_conociste',
        label: '¿Cómo nos conociste?',
        type: 'select',
        required: false,
        options: ['Instagram', 'TikTok', 'Facebook', 'Un amigo o familiar', 'Google', 'Otro']
      },
      {
        id: 'preferencia_compra',
        enEncuesta: false,
        label: '¿Dónde prefieres comprar?',
        type: 'select',
        required: false,
        options: ['Prefiero ir a la tienda física', 'Prefiero comprar 100% online', 'Me gustan ambas opciones']
      }
    ]
  },

  // Panel 2: Intereses: botones en la hoja de cada persona. Cada pregunta con
  // enEncuesta: false no sale en la encuesta (en Fechas importantes sí).
  brandsPanel: {
    title: 'Tus Intereses',
    subtitle: 'Selecciona las categorías que más te gusten para personalizar tu experiencia',
    categories: [
      {
        id: 'cat_deportes',
        name: 'Fútbol',
        fields: [
          {
            id: 'dep_q1',
            enEncuesta: false,
            label: '¿Cuál es su deporte favorito?',
            type: 'text',
            required: false,
            options: []
          },
          {
            id: 'dep_q2',
            label: '¿De qué equipo es hincha?',
            type: 'text',
            required: false,
            options: []
          },
          {
            id: 'dep_q4',
            label: '¿Qué le regalarías de su equipo?',
            type: 'select',
            required: false,
            refina: true,
            options: ['Camiseta/Polo', 'Casaca', 'Taza', 'Accesorio']
          },
          {
            id: 'dep_q3',
            enEncuesta: false,
            label: '¿Jugador o jugadores favoritos?',
            type: 'text',
            required: false,
            options: []
          }
        ]
      },
      {
        id: 'cat_geek',
        name: 'Anime / Geek',
        fields: [
          {
            id: 'geek_q1',
            label: '¿Qué anime o personaje le gusta?',
            type: 'text',
            required: false,
            options: []
          },
          {
            id: 'geek_q3',
            label: '¿Qué tipo de producto le gusta?',
            type: 'select',
            required: false,
            refina: true,
            options: ['Polo', 'Casaca/Polera', 'Taza', 'Figura/Accesorio']
          },
          {
            id: 'geek_q2',
            enEncuesta: false,
            label: '¿Quién es su personaje favorito?',
            type: 'text',
            required: false,
            options: []
          }
        ]
      }
    ]
  },

  // Hoja de cada persona: budget = presupuesto (encuesta y Fechas
  // importantes); familySet = Conjunto familia (solo encuesta).
  personPanel: {
    budget: false,
    familySet: false
  },

  // Panel Final: Completion
  completionPanel: {
    title: '¡Muchas gracias!',
    message: 'Hemos guardado tus preferencias con éxito. Ahora tu experiencia será mucho más personalizada.',
    buttonText: 'Ir a la Tienda',
    // Antes de terminar: "¿Te avisamos de promociones por WhatsApp?" (marketingConsent.whatsapp).
    askWhatsapp: true
  },

  // Diseño General
  design: {
    primaryColor: '#8b5cf6', // Color morado/Wala por defecto
    backgroundColor: '#ffffff',
    textColor: '#1f2937'
  }
});

// Encuesta de la entrega ("¿Cómo te fue con tu pedido?"): entregaPanel, igual
// que configEntrega de functions/encuestaEntregaLogic.js (el servidor manda).
export const OPCIONES_MEJORAR_ENTREGA = ['Tiempo de entrega', 'Calidad del producto', 'Empaque', 'Atención', 'Precio', 'Todo estuvo bien'];
export const configEntregaPanel = (raw) => {
  const c = raw && typeof raw === 'object' ? raw : {};
  const monedas = Number(c.monedas);
  const opciones = Array.isArray(c.opcionesMejorar) ? c.opcionesMejorar.map((o) => String(o || '').trim()).filter(Boolean) : [];
  return {
    activo: c.activo !== false,
    monedas: Number.isFinite(monedas) ? Math.max(0, Math.min(50, Math.round(monedas))) : 5,
    opcionesMejorar: opciones.length ? opciones : OPCIONES_MEJORAR_ENTREGA,
  };
};

export const getSurveyConfig = async () => {
  try {
    const docRef = doc(db, COLLECTION_NAME, GLOBAL_DOC_ID);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { data: configConOrigenCompra(docSnap.data()), error: null };
    } else {
      // Si no existe, creamos el documento inicial con el default
      await setDoc(docRef, DEFAULT_SURVEY_CONFIG);
      return { data: DEFAULT_SURVEY_CONFIG, error: null };
    }
  } catch (error) {
    console.error('Error fetching survey config:', error);
    return { data: null, error: error.message };
  }
};

/**
 * La config para quien responde (la encuesta, el buscador de regalos): solo
 * lee. Sin documento, los textos por defecto; nunca lo crea (eso es del
 * admin: un cliente no puede escribirlo y el intento salía como error).
 */
export const leerSurveyConfig = async () => {
  try {
    const docSnap = await getDoc(doc(db, COLLECTION_NAME, GLOBAL_DOC_ID));
    return { data: docSnap.exists() ? configConOrigenCompra(docSnap.data()) : DEFAULT_SURVEY_CONFIG, error: null };
  } catch (error) {
    console.warn('No se pudo leer la config de la encuesta:', error);
    return { data: null, error: error.message };
  }
};

export const saveSurveyConfig = async (configData) => {
  try {
    const docRef = doc(db, COLLECTION_NAME, GLOBAL_DOC_ID);
    await setDoc(docRef, configData, { merge: true });
    return { data: true, error: null };
  } catch (error) {
    console.error('Error saving survey config:', error);
    return { data: null, error: error.message };
  }
};
