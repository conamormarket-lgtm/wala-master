# Documentación: Centro de Fechas Importantes y Eventos Organizables

### 1. Razón
Se requiere transformar el panel básico de fechas importantes en una herramienta de gestión completa de campañas y eventos. El objetivo de negocio es aprovechar las fechas universales y personales (recolectadas en la encuesta) para aumentar la retención y generar ventas, mediante campañas de descuentos específicos o recompensas en monedas.

### 2. Acción
El administrador puede:
- Visualizar un Calendario Global con los eventos y festividades del mes.
- Gestionar (crear, editar, eliminar) Fechas Universales (ej. San Valentín).
- Filtrar y visualizar las fechas importantes próximas (cumpleaños, aniversarios) registradas por los usuarios, con **soporte para paginación personalizable** (10, 25, 50, 100 registros).
- Crear y administrar Eventos Organizables para aplicar descuentos o asignar monedas extras basados en marcas, categorías, etiquetas o productos específicos, vinculando opcionalmente landing pages.

### 3. Cómo
- **UI Base**: Se implementa un Layout contenedor (`AdminFechasImportantesPage.jsx`) con un cajón de navegación (Drawer) lateral y un área principal dinámica.
- **Calendario**: Vista mensual construida con `date-fns` y CSS Grid, renderizando los días y mapeando `universal_dates` y `organizable_events` sobre sus respectivos rangos de fechas.
- **Fechas de Usuarios**: Implementa paginación del lado del cliente y filtrado inteligente utilizando las funciones de rango de `date-fns` para calcular de manera dinámica el próximo evento según el año en curso.
- **Eventos Organizables**: Interfaz CRUD que permite configurar reglas (ej. "10% de descuento a la categoría X") que posteriormente el frontend de la tienda leerá para aplicar al carrito.

### 4. Conexión a Base de Datos y Esquema
**Conexión**: Firebase Firestore.

**Esquema `universal_dates`**:
```json
{
  "name": "San Valentín",
  "day": 14,
  "month": 2
}
```

**Esquema de Usuarios (`users.giftRecipients`) - Sólo Lectura**:
```json
{
  "giftRecipients": [
    {
      "name": "Maria",
      "events": [
        { "type": "Cumpleaños", "date": "1990-05-20" }
      ]
    }
  ]
}
```

**Esquema `organizable_events` (NUEVO)**:
```json
{
  "title": "Cyber Wow",
  "reason": "Campaña de Julio",
  "type": "discount", // 'discount' | 'extra_coins'
  "startDate": "2026-07-15T00:00:00.000Z", // Cadena ISO de fecha
  "endDate": "2026-07-20T23:59:59.000Z",   // Cadena ISO de fecha
  "targetType": "category", // 'all' | 'category' | 'brand' | 'tag' | 'product'
  "targetValue": "regalos-romanticos", // ID o string de referencia
  "rewardValue": 15, // Número (porcentaje si es descuento, cantidad fija si es monedas)
  "landingPageUrl": "/cyber-wow-2026" // Opcional
}
```

### 5. Archivo de Esquema / Servicio
- Las consultas a la base de datos se definirán en un nuevo servicio: `src/services/fechasImportantes.js`

### 6. Ubicación de la Funcionalidad
- **Layout y Drawer**: `src/pages/admin/AdminFechasImportantesPage.jsx`
- **Vista de Calendario**: `src/components/admin/fechas/GlobalCalendarView.jsx`
- **Sub-vista Universales**: `src/components/admin/fechas/UniversalesView.jsx`
- **Sub-vista Usuarios**: `src/components/admin/fechas/UsuariosView.jsx`
- **Sub-vista Eventos Organizables**: `src/components/admin/fechas/EventosView.jsx`
