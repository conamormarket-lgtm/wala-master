import { getCollection, createDocument, updateDocument, getDocument } from './firebase/firestore';

const COLLECTION = 'producto_cliente_personalizado';

/**
 * Obtener un producto personalizado de cliente por ID
 * @param {string} id 
 */
export const getCustomerCustomProduct = async (id) => {
  return await getDocument(COLLECTION, id);
};

/**
 * Obtener todos los diseños de un cliente
 * @param {string} userId 
 */
export const getCustomerCustomProductsByUser = async (userId) => {
  if (!userId) return { data: [], error: 'userId requerido' };
  
  const { data, error } = await getCollection(
    COLLECTION,
    [{ field: 'userId', operator: '==', value: userId }]
  );

  let sortedData = [];
  if (data && data.length > 0) {
    sortedData = [...data].sort((a, b) => {
      const timeA = a.updatedAt?.seconds || a.createdAt?.seconds || 0;
      const timeB = b.updatedAt?.seconds || b.createdAt?.seconds || 0;
      return timeB - timeA;
    });
  }

  return { data: sortedData, error };
};

/**
 * Crear un nuevo producto personalizado por el cliente.
 * Se guarda como una copia del producto original, reemplazando la configuración de YoryoPersonalizado
 * y agregando metadata del cliente.
 * 
 * @param {object} productData Producto original completo
 * @param {object} yoryoData El objeto YoryoPersonalizado modificado por el cliente (Capas, Zonas, captura)
 * @param {string} userId El ID del usuario (o null si es invitado)
 * @param {string} sessionId ID de sesión opcional para invitados
 */
export const createCustomerCustomProduct = async (productData, yoryoData, userId = null, sessionId = null) => {
  const customProductDoc = {
    ...productData, // Clonamos todos los datos del producto (precio, nombre, etc.)
    originalProductId: productData.id,
    id: undefined, // Para que firestore genere uno nuevo
    userId: userId,
    sessionId: sessionId || '',
    isCustomerCustomized: true,
    status: 'in_cart',
    YoryoPersonalizado: yoryoData,
    // Agregamos la captura como miniatura principal para que se vea en el carrito
    mainImage: yoryoData.capturaPersonalizadoDefinido || productData.mainImage,
    thumbnailWithDesignUrl: yoryoData.capturaPersonalizadoDefinido || productData.thumbnailWithDesignUrl || '',
  };

  return await createDocument(COLLECTION, customProductDoc);
};
