import React from 'react';
import { getBlueprints, createBlueprint, updateBlueprint, deleteBlueprint } from '../../services/blueprints';
import { PaginaBlueprints } from '../../componentes/kit/paginas/admin/Herramientas';
import { blueprintDesdeFirestore, blueprintAFirestore } from '../../componentes/kit/adaptadoresAdmin';
import { sinError, useLectura, useInvalidar } from './comun';

/*
 * /admin/blueprints (D2d): PaginaBlueprints con los mismos servicios y claves
 * de AdminBlueprints; guardar y eliminar invalidan también ['blueprints'] de
 * la tienda. Eliminar borra de verdad (deleteBlueprint), como antes.
 */
export default function BlueprintsDelPanel() {
  const blueprints = useLectura(['admin-blueprints'], getBlueprints);
  const invalidar = useInvalidar();
  const refrescar = () => invalidar(['admin-blueprints'], ['blueprints']);

  return (
    <PaginaBlueprints
      blueprints={(blueprints.datos || []).map(blueprintDesdeFirestore)}
      cargando={blueprints.cargando}
      error={blueprints.error}
      onReintentar={blueprints.onReintentar}
      onGuardar={async (datos, id) => {
        const doc = blueprintAFirestore(datos);
        await sinError(id ? updateBlueprint(id, doc) : createBlueprint(doc));
        await refrescar();
      }}
      onEliminar={async (id) => {
        await sinError(deleteBlueprint(id));
        await refrescar();
      }}
    />
  );
}
