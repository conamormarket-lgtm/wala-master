# Implementación de Visualización de Boletas de Envío en UI (Cliente)

## Objetivo
Mostrar las fotos de las boletas de envío directamente en la tarjeta del pedido (`PedidoCard`) de la cuenta del cliente (`/cuenta/pedidos`), sin necesidad de abrir modales adicionales.

## Archivos Modificados
- `src/components/PedidoCard/PedidoCard.jsx`

## Resumen de la Implementación

Se añadió una nueva sección en el cuerpo desplegable de la tarjeta del pedido. La implementación sigue el documento `boletas_envio_storage.md` para extraer de manera óptima las URLs de las boletas asociadas al pedido.

### 1. Variables de Estado Añadidas
Se agregaron estados para manejar la obtención de datos y el estado de carga (loading state):
```javascript
const [boletasEnvio, setBoletasEnvio] = useState(null);
const [loadingBoletasEnvio, setLoadingBoletasEnvio] = useState(false);
```

### 2. Disparador de Carga (Lazy Load)
Para no saturar la base de datos ni el Storage de Firebase leyendo todos los pedidos al mismo tiempo, la consulta de boletas se hace de manera perezosa **únicamente cuando el usuario expande la tarjeta del pedido**:

```javascript
const toggleExpanded = () => {
  const nextExpanded = !isExpanded;
  setIsExpanded(nextExpanded);
  
  // Lógica preexistente
  if (nextExpanded && estadoToKey(pedido.estadoGeneral) === 'impresion' && pedido.conDeuda) {
    setShowDeudaImpresionModal(true);
  }
  
  // Nueva lógica: Cargar boletas si la tarjeta se expande y aún no se han intentado cargar
  if (nextExpanded && boletasEnvio === null) {
    fetchBoletasEnvio();
  }
};
```

### 3. Lógica de Obtención Óptima (`fetchBoletasEnvio`)
Siguiendo las reglas de negocio descritas en `boletas_envio_storage.md`, la lectura de las imágenes prioriza Firestore para evitar llamadas innecesarias a la API de Storage. Si los datos no están en Firestore (por retrocompatibilidad con pedidos antiguos), se hace un *fallback* buscando directamente la carpeta en Storage.

```javascript
const fetchBoletasEnvio = async () => {
  setLoadingBoletasEnvio(true);

  // 1. Priorizar lectura rápida desde Firestore
  // Se busca en pedido.reparto.boletasEnvio que contiene [{ url, fullPath, timestamp }]
  if (pedido.reparto?.boletasEnvio && Array.isArray(pedido.reparto.boletasEnvio) && pedido.reparto.boletasEnvio.length > 0) {
    const urlsFromFirestore = pedido.reparto.boletasEnvio.map(b => b.url || b);
    setBoletasEnvio(urlsFromFirestore);
    setLoadingBoletasEnvio(false);
    return;
  }

  // 2. Fallback: buscar en Storage directamente usando listFilesInFolder
  // (Compatible con la estructura antigua: boletas_envio/00<pedidoId>)
  let { urls, error } = await listFilesInFolder(`boletas_envio/00${pedido.id}`);
  if (error || urls.length === 0) {
    // Si no se encuentra con el pad '00', se intenta sin él
    const fallback = await listFilesInFolder(`boletas_envio/${pedido.id}`);
    urls = fallback.urls || [];
  }
  setBoletasEnvio(urls);
  setLoadingBoletasEnvio(false);
};
```

### 4. Interfaz de Usuario (JSX)
Se incrustó una nueva sección visual antes de la sección de Notas (`SECCIÓN B: NOTAS`). Si se encuentran imágenes, se utiliza el componente preexistente `<ImageGallery />` que permite previsualizarlas en pantalla completa.

```jsx
{/* SECCIÓN E: BOLETAS DE ENVÍO */}
<div className={styles.sectionDivider} />
<div className={styles.sectionTitle}><ShoppingCart size={16}/> Foto de Boletas (Envío)</div>
<div style={{ padding: '0 1rem', marginBottom: '1rem' }}>
  {loadingBoletasEnvio ? (
    <p style={{ fontSize: '0.85rem', color: '#64748b', fontStyle: 'italic' }}>Buscando fotos de boletas...</p>
  ) : (boletasEnvio && boletasEnvio.length > 0) ? (
    <ImageGallery 
      images={boletasEnvio} 
      onImageClick={(index) => onImageClick(boletasEnvio, index)}
    />
  ) : (
    <p style={{ fontSize: '0.85rem', color: '#64748b', fontStyle: 'italic' }}>Aún no hay boletas adjuntas.</p>
  )}
</div>
```

## Beneficios de la Implementación
- **Eficiencia**: Las imágenes cargan casi instantáneamente al estar cacheadas en Firestore junto al documento del pedido, en lugar de consultar siempre la carpeta de Storage.
- **Costos**: Reducción drástica de las llamadas de lectura (reads) a la API de Firebase Storage `listAll`.
- **Experiencia de Usuario (UX)**: Eliminación del modal intermedio. El cliente ve todo organizado directamente al expandir los detalles de su compra.
