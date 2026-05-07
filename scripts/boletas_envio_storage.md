# Subida de Boletas de Envío a Firebase Storage

## Contexto de Negocio

Cuando un pedido llega a la etapa **"En Reparto"**, el operador puede adjuntar una o más imágenes de la boleta de envío (voucher/comprobante de la agencia de courier). Estas imágenes se almacenan en **Firebase Storage** bajo una ruta estructurada por número de pedido, de forma que la web pública pueda consultarlas directamente vía URL de descarga.

**Valor de negocio:** permite tener trazabilidad visual del envío sin depender de sistemas externos, y habilita mostrar las boletas al cliente final desde la web pública usando la URL pública de Firebase.

---

## Archivos Involucrados

| Archivo | Responsabilidad |
|---|---|
| `lib/storage-utils.ts` | Función principal de subida (`uploadBoletas`) y eliminación (`deleteBoleta`) en Firebase Storage |
| `components/tabs/reparto-tab.tsx` | Componente que llama a `uploadBoletas` al guardar cambios del pedido en reparto |
| `components/modals/purgar-boletas-modal.tsx` | Modal para descargar en ZIP y eliminar del Storage boletas antiguas (>30 días) |

---

## Estructura de Datos y Relaciones

### Ruta en Firebase Storage

```
boletas_envio/<numeroPedido>/<fileName>
```

- `<numeroPedido>` se construye así: `"00" + formatNumeroPedido(pedido)` (ej: `"001234"`).
- `<fileName>` sigue el patrón:
  - 1 sola imagen → `boleta.<extension>` (ej: `boleta.jpg`)
  - Varias imágenes → `boleta_1.<ext>`, `boleta_2.<ext>`, … (sufijo `_<i+1>`)

### Objeto almacenado por boleta en Firestore

Cada boleta subida se representa como un objeto con tres campos:

```json
{
  "url": "https://firebasestorage.googleapis.com/...",
  "fullPath": "boletas_envio/001234/boleta.jpg",
  "timestamp": "2025-05-07T17:45:00.000Z"
}
```

### Dónde vive en el pedido (Firestore)

```
pedidos/<pedidoId>.reparto.boletasEnvio = [ { url, fullPath, timestamp }, ... ]
```

La **Foreign Key** es `pedido.id` → `pedidos/<pedidoId>` en la colección `pedidos`.

---

## Reglas de Negocio en UI

- **Imágenes existentes** (ya subidas): se representan como strings (URL). Si el operador no las elimina del input, se reusan tal cual devolviendo el objeto `{ url, fullPath, timestamp }` original.
- **Imágenes nuevas** (File): se suben a Storage, se obtiene la URL pública con `getDownloadURL` y se guarda el objeto completo.
- **Mock mode** (Firebase deshabilitado / sin instancia): `uploadBoletas` retorna un objeto URL con `URL.createObjectURL(file)` y `fullPath: mock/<nombre>`. Esto permite desarrollo local sin Firebase real.
- **Autenticación**: si no hay `currentUser`, se intenta `signInAnonymously(auth)` antes de la subida. Si falla, se lanza warning pero la subida puede proceder (depende de las reglas del Storage).
- **Purga automática**: el modal `PurgarBoletasModal` detecta boletas con `timestamp` de más de 30 días, las descarga como ZIP y luego llama a `deleteBoleta(fullPath)` para eliminarlas de Storage y actualiza `reparto.boletasEnvio` en Firestore.

---

## Lógica Interna Clave

### `uploadBoletas` — flujo paso a paso

```typescript
// Firma de la función
uploadBoletas(
  pedidoId: string,        // ID interno del pedido (Firestore doc ID)
  numeroPedido: string,    // Ej: "001234" — define la carpeta en Storage
  files: (File | string)[], // Mezcla de archivos nuevos y URLs existentes
  existingBoletas: { url, fullPath, timestamp }[] // Para reusar las ya subidas
): Promise<{ url, fullPath, timestamp }[]>
```

**Flujo:**

1. Obtiene la instancia de Storage con `getStorageInstance()`.
2. Si `useFirebase === false` o no hay instancia → modo mock, retorna blob URLs.
3. Intenta `signInAnonymously` si no hay usuario autenticado.
4. Itera sobre `files`:
   - Si el item es un **string** (URL existente): busca en `existingBoletas` y lo reusa.
   - Si el item es un **File**: construye el path `boletas_envio/<numeroPedido>/boleta[_N].<ext>`, llama a `uploadBytes`, obtiene `getDownloadURL` y guarda el objeto.
5. Retorna el array final de objetos `{ url, fullPath, timestamp }`.

### Llamada desde `reparto-tab.tsx` (`handleGuardarCambios`)

```typescript
const baseIdentificador = formatNumeroPedido(pedido) || pedidoExpandido.slice(0, 8)
const numeroIdentificador = `00${baseIdentificador}`  // Prefijo "00"

const newBoletas = await uploadBoletas(
  pedidoExpandido,          // pedidoId
  numeroIdentificador,      // → define carpeta en Storage
  formDataExpandido.boletasEnvio, // array de File | string
  boletasExistentes         // boletas ya en Firestore
)

// Se guarda en Firestore bajo: pedido.reparto.boletasEnvio
await mockFirestore.doc("pedidos", pedidoExpandido).update({
  reparto: {
    ...pedido.reparto,
    boletasEnvio: newBoletas,
  }
})
```

### `deleteBoleta` — eliminación individual

```typescript
deleteBoleta(fullPath: string): Promise<boolean>
```

- Usa el `fullPath` guardado en el objeto de boleta para crear la referencia en Storage con `ref(storage, fullPath)`.
- Llama a `deleteObject(fileRef)`.
- Si el path empieza con `"mock/"` → retorna `true` sin llamar a Firebase.

---

## Cómo exponerlo en la Web Pública

La URL del campo `boleta.url` es una **URL pública de descarga de Firebase Storage** (con token de autenticación integrado). Para mostrarla al cliente final:

```html
<!-- Simplemente renderizar la URL en un <img> o <a> -->
<img src="{boleta.url}" alt="Boleta de envío" />
<a href="{boleta.url}" target="_blank">Ver boleta</a>
```

> **Nota:** Las URLs de Firebase Storage incluyen un token de larga duración. Son accesibles públicamente si las reglas del Storage lo permiten. No requieren autenticación por parte del usuario final para leerlas.

Para mostrar **todas las boletas de un pedido**, consultar Firestore:

```
pedidos/<pedidoId>.reparto.boletasEnvio  →  [{ url, fullPath, timestamp }]
```
