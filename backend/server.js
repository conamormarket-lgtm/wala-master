const express = require('express');
const cors = require('cors');
const pedidosRoutes = require('./routes/pedidos');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: 'http://localhost:3000', // Permitir requests desde el frontend React
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware para desarrollo
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Rutas
app.use('/api/pedidos', pedidosRoutes);

// Ruta de salud/health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Backend mock funcionando correctamente',
    timestamp: new Date().toISOString()
  });
});

// Ruta raíz
app.get('/', (req, res) => {
  res.json({
    message: 'Backend Mock - Portal de Clientes API',
    version: '1.0.0',
    endpoints: {
      'POST /api/pedidos/buscar': 'Buscar pedidos por teléfono y DNI',
      'GET /health': 'Estado del servidor'
    }
  });
});

// Manejo de rutas no encontradas
app.use((req, res) => {
  res.status(404).json({
    error: 'Ruta no encontrada'
  });
});

// Manejo de errores
app.use((err, req, res, next) => {
  console.error('Error no manejado:', err);
  res.status(500).json({
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor backend mock corriendo en http://localhost:${PORT}`);
  console.log(`📋 Endpoints disponibles:`);
  console.log(`   POST http://localhost:${PORT}/api/pedidos/buscar`);
  console.log(`   GET  http://localhost:${PORT}/health`);
  console.log(`\n👤 Usuarios de prueba:`);
  console.log(`   Teléfono: 999888777, DNI: 12345678 (Juan Pérez)`);
  console.log(`   Teléfono: 987654321, DNI: 87654321 (María García)`);
});
