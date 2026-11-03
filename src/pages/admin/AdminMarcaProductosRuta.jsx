import React from 'react';
import { Navigate } from 'react-router-dom';
import conInterruptor from '../../components/panel/conInterruptor';
import { ProductosDeMarcaDelPanel } from '../../components/panel/MarcasDelPanel';

// /admin/marcas/:id/productos (D1). La de antes vivía dentro de Marcas, sin
// ruta: con adminCatalogoViejo esta dirección vuelve a Marcas.
const VolverAMarcas = () => <Navigate to="/admin/marcas" replace />;
export default conInterruptor('adminCatalogo', ProductosDeMarcaDelPanel, () => Promise.resolve({ default: VolverAMarcas }));
