# Backend Mock - Portal de Clientes

Backend mock para desarrollo y pruebas del Portal de Clientes. Este servidor simula la API real sin necesidad de una base de datos.

## Instalación

```bash
npm install
```

## Ejecución

### Modo producción
```bash
npm start
```

### Modo desarrollo (con auto-reload)
```bash
npm run dev
```

El servidor se iniciará en `http://localhost:3001`

## Endpoints

### POST `/api/pedidos/buscar`

Busca pedidos de un cliente por teléfono y DNI.

**Request:**
```json
{
  "telefono": "999888777",
  "dni": "12345678"
}
```

**Response exitosa:**
```json
{
  "pedidos": [
    {
      "id": "PED-001",
      "nombreCliente": "Juan Pérez",
      "direccion": "Av. Principal 123, Lima",
      "fechaCompra": "15/01/2024",
      "tallas": "M, L, XL",
      "montoAdelantado": "150.00",
      "montoTotal": "450.00",
      "estado": "En Reparto",
      "imageURLs": [...],
      "fechas": {...}
    }
  ]
}
```

**Response error:**
```json
{
  "error": "No se encontraron pedidos para los datos proporcionados."
}
```

### GET `/health`

Verifica el estado del servidor.

**Response:**
```json
{
  "status": "ok",
  "message": "Backend mock funcionando correctamente",
  "timestamp": "2024-02-13T..."
}
```

## Usuarios de Prueba

### Usuario 1: Juan Pérez
- **Teléfono:** `999888777`
- **DNI:** `12345678`
- **Pedidos:** 3 pedidos con diferentes estados

### Usuario 2: María García
- **Teléfono:** `987654321`
- **DNI:** `87654321`
- **Pedidos:** 1 pedido finalizado

## Estructura de Datos

Los pedidos incluyen:
- Información del cliente (nombre, dirección)
- Detalles del pedido (fecha, tallas, montos)
- Estado actual del pedido
- URLs de imágenes de diseño
- Timeline de fechas por etapa

## Notas

- Los datos están en memoria y se reinician al reiniciar el servidor
- Este backend es solo para desarrollo y pruebas
- Cuando se implemente el backend real, este mock será reemplazado
- El servidor acepta requests desde `http://localhost:3000` (CORS configurado)

## Desarrollo

Para agregar más usuarios o pedidos de prueba, edita el archivo `data/mockData.js`.
