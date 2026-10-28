import React, { lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Cada página baja al usarse: así este archivo casi no tiene dependencias y el
// archivo principal (que lo nombra) no crece con la lista de las suyas.
const AdminProductoFormV2 = lazy(() => import('../Tienda/admin/AdminProductoFormV2'));

/**
 * /admin/prendas-crear/*: la ficha de cada prenda (la de productos en modo
 * prenda). La lista vive ahora en Productos (chip "Personalizables"). Van
 * aquí y no en App.jsx para no sumarle al archivo principal: App solo carga
 * esto al entrar.
 */
const RutasPrendasCrear = () => (
  <Routes>
    <Route index element={<Navigate to="/admin/productos?ver=crear" replace />} />
    <Route path="nueva" element={<AdminProductoFormV2 modo="prenda" />} />
    <Route path=":id" element={<AdminProductoFormV2 modo="prenda" />} />
  </Routes>
);

export default RutasPrendasCrear;
