# Crear cuenta en el Portal cuando el ERP crea un pedido

Cuando en el **ERP** se crea un pedido (venta), hay que avisar al **Portal** para que cree la cuenta del cliente automáticamente (si tiene correo y aún no tiene cuenta).

## URL del Portal (Cloud Function)

Después de desplegar las functions del Portal:

```text
https://<REGION>-<PROYECTO-PORTAL>.cloudfunctions.net/ensureAccountFromOrder
```

Ejemplo (reemplaza por tu proyecto y región):

```text
https://us-central1-tu-proyecto-portal.cloudfunctions.net/ensureAccountFromOrder
```

## Cómo llamarla desde el ERP

- **Método:** `POST`
- **Headers:** `Content-Type: application/json`
- **Body (JSON):** los datos del cliente del pedido. Pueden usar los mismos campos que ya guardan en el pedido, por ejemplo:

```json
{
  "email": "cliente@ejemplo.com",
  "nombreCliente": "Juan Pérez",
  "dni": "12345678",
  "phone": "999888777"
}
```

También se aceptan estos nombres de campo (el Portal los reconoce):  
`clienteCorreo`, `correo`, `customerName`, `clienteNombre`, `clienteApellidos`, `clienteNumeroDocumento`, `clienteContacto`, `telefono`, `tipoDocumento`.

**Requisitos:**  
- Obligatorio: `email` (o `clienteCorreo`).  
- Obligatorio: `dni` (o `clienteNumeroDocumento`) para usar como contraseña inicial (mín. 6 caracteres).

## Respuesta (200)

- Cuenta creada: `{ "created": true, "userId": "abc123..." }`
- Ya existía: `{ "created": false, "existing": true, "userId": "abc123..." }`
- Error: `{ "created": false, "error": "mensaje" }` (p. ej. sin correo: `"NO_EMAIL"`)

## Dónde llamarla en el ERP

En el mismo lugar donde se **crea el pedido** en el ERP (justo después de guardar el documento en Firestore o en tu backend):

1. Si el pedido tiene **correo** (email/clienteCorreo), hacer un `POST` a la URL de arriba con el cuerpo en JSON (email, nombre, dni, teléfono, etc.).
2. No hace falta esperar la respuesta para mostrar éxito al usuario; se puede hacer en segundo plano (fire-and-forget) o esperar si quieren mostrar error.

### Ejemplo: Cloud Function en el proyecto del ERP

Si el ERP usa Firebase y creas los pedidos en Firestore, puedes añadir una función que se dispare al crear un pedido y que llame al Portal:

```javascript
const functions = require("firebase-functions");
const fetch = require("node-fetch"); // o axios

exports.onPedidoCreado = functions.firestore
  .document("pedidos/{pedidoId}")
  .onCreate(async (snap, context) => {
    const data = snap.data();
    const email = data.email || data.clienteCorreo || data.correo;
    if (!email || !String(email).includes("@")) return null;

    const url = "https://us-central1-TU-PROYECTO-PORTAL.cloudfunctions.net/ensureAccountFromOrder";
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return null;
  });
```

Así, **cada vez que se cree un pedido en el ERP**, se llamará al Portal y se creará la cuenta automáticamente (si no existe).

## Desplegar la function en el Portal

En la carpeta del proyecto del Portal (donde está `firebase.json`):

```bash
npm install -g firebase-tools
firebase login
firebase use <tu-proyecto-portal>
cd functions && npm install && cd ..
firebase deploy --only functions
```

La consola de Firebase te mostrará la URL final de la function.
