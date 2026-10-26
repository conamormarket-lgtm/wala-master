export const OPCION_COMPRA = 'Ya compré en una de sus marcas';
export const CAMPO_MARCA_COMPRA = 'marca_compra';

// Completa también las configuraciones guardadas antes de añadir esta opción.
// Solo transforma la lectura: no necesita escribir ni migrar Firebase.
export function configConOrigenCompra(config = {}, marcas) {
  const fields = config.basicDataPanel?.fields || [];
  const origen = fields.find((f) => f.id === 'como_nos_conociste');
  if (!origen) return config;
  const marca = fields.find((f) => f.id === CAMPO_MARCA_COMPRA);
  const options = [...new Set((marcas || []).map((m) => String(m.name || '').trim()).filter(Boolean))];
  const preguntaMarca = {
    label: '¿En cuál de nuestras marcas compraste?', required: false, options: [],
    ...marca,
    id: CAMPO_MARCA_COMPRA,
    type: 'select',
    fuente: 'marcas',
    mostrarSi: { campo: origen.id, valor: OPCION_COMPRA },
    ...(marcas && { options }),
  };
  const nuevos = fields.filter((f) => f.id !== CAMPO_MARCA_COMPRA).flatMap((f) => (
    f.id === origen.id
      ? [{ ...f, options: [...new Set([...(f.options || []), OPCION_COMPRA])] }, preguntaMarca]
      : [f]
  ));
  return { ...config, basicDataPanel: { ...config.basicDataPanel, fields: nuevos } };
}

export function preguntaVisible(campo, respuestas = {}, campos = []) {
  if (campo.enEncuesta === false) return false;
  const condicion = campo.mostrarSi;
  return !condicion || (respuestas[condicion.campo] === condicion.valor
    && campos.some((f) => f.id === condicion.campo && f.enEncuesta !== false));
}

export function cambiarRespuestaEncuesta(respuestas, id, valor) {
  return {
    ...respuestas,
    [id]: valor,
    ...(id === 'como_nos_conociste' && valor !== OPCION_COMPRA && { [CAMPO_MARCA_COMPRA]: '' }),
  };
}
