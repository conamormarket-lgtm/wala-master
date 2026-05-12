import { db } from './firebase/config';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const COLLECTION_NAME = 'tienda_encuesta_config';
const GLOBAL_DOC_ID = 'global';

export const DEFAULT_SURVEY_CONFIG = {
  // Panel 0: Hook / Intro
  introPanel: {
    title: '¡Queremos conocerte mejor!',
    subtitle: 'Tus respuestas nos ayudarán a darte una experiencia increíble.',
    description: 'Completa esta breve encuesta y recibe recomendaciones (y regalos) pensados exclusivamente en ti y en tus fechas más importantes. Prometemos que será rápido y sin pedir datos sensibles.',
    continueButtonText: 'Empezar Encuesta',
    skipButtonText: 'No, gracias',
    imageUrl: '' // Opcional, para subir una imagen atractiva
  },
  
  // Panel 1: Datos Básicos
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
        label: '¿Tienes familia?',
        type: 'select',
        required: false,
        options: ['Vivo solo/a', 'Vivo en pareja', 'Tengo hijos', 'Vivo con mis padres/familiares']
      },
      {
        id: 'frecuencia_ropa',
        label: '¿Con qué frecuencia sueles comprar ropa?',
        type: 'select',
        required: false,
        options: ['Cada semana', 'Al menos una vez al mes', 'Solo en ocasiones especiales o cambios de temporada', 'Casi nunca']
      },
      {
        id: 'preferencia_compra',
        label: '¿Dónde prefieres comprar?',
        type: 'select',
        required: false,
        options: ['Prefiero ir a la tienda física', 'Prefiero comprar 100% online', 'Me gustan ambas opciones']
      }
    ]
  },

  // Panel 2: Selección de Marcas / Intereses
  brandsPanel: {
    title: 'Tus Intereses',
    subtitle: 'Selecciona las categorías que más te gusten para personalizar tu experiencia',
    categories: [
      {
        id: 'cat_deportes',
        name: 'Deportes',
        fields: [
          {
            id: 'dep_q1',
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
            id: 'dep_q3',
            label: '¿Jugador o jugadores favoritos?',
            type: 'text',
            required: false,
            options: []
          }
        ]
      },
      {
        id: 'cat_geek',
        name: 'Geek',
        fields: [
          {
            id: 'geek_q1',
            label: '¿Cuál es su anime o franquicia favorita?',
            type: 'text',
            required: false,
            options: []
          },
          {
            id: 'geek_q2',
            label: '¿Quién es su personaje favorito?',
            type: 'text',
            required: false,
            options: []
          }
        ]
      }
    ]
  },

  // Panel Final: Completion
  completionPanel: {
    title: '¡Muchas gracias!',
    message: 'Hemos guardado tus preferencias con éxito. Ahora tu experiencia será mucho más personalizada.',
    buttonText: 'Ir a la Tienda'
  },

  // Diseño General
  design: {
    primaryColor: '#8b5cf6', // Color morado/Wala por defecto
    backgroundColor: '#ffffff',
    textColor: '#1f2937'
  }
};

export const getSurveyConfig = async () => {
  try {
    const docRef = doc(db, COLLECTION_NAME, GLOBAL_DOC_ID);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { data: docSnap.data(), error: null };
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
