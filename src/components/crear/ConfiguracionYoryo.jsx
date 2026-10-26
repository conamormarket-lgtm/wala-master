import React, { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getProduct, updateProductField } from '../../services/products';
import { YORYO_PIEZAS, medidasConfirmadas } from '../../utils/yoryoPersonalizacion.mjs';
import { Campo, Casilla } from '../../componentes/kit/Formulario';
import Boton from '../../componentes/kit/Boton';
import { Aviso } from '../../componentes/kit/Feedback';
import s from './PersonalizadorYoryo.module.css';
import { subirPlantillaVectorYoryo } from '../../services/crearArchivos';
import { validarVectorSvg } from '../../pages/Crear/arteYoryo.mjs';

export default function ConfiguracionYoryo({ id }) {
  const pieza = YORYO_PIEZAS.find((p) => p.id === id);
  const q = useQuery({ queryKey: ['product', id], queryFn: async () => (await getProduct(id)).data, enabled: Boolean(pieza) });
  if (!pieza || !q.data) return null;
  return <Configuracion key={`${id}:${JSON.stringify(q.data.produccionYoryo)}`} producto={q.data} />;
}

function Configuracion({ producto }) {
  const queryClient = useQueryClient();
  const [valor, setValor] = useState(producto.produccionYoryo || { anchoMm: '', altoMm: '', medidasConfirmadas: false });
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [equipo, setEquipo] = useState('Alianza Lima');
  const archivoRef = useRef(null);
  const subirEscudo = async (file) => {
    if (!file) return;
    setOcupado(true); setError(''); setMensaje('');
    try {
      if (file.size > 1024 * 1024) throw new Error('El SVG debe pesar menos de 1 MB.');
      const vector = validarVectorSvg(await file.text());
      const url = await subirPlantillaVectorYoryo(vector.svg);
      setValor((p) => ({ ...p, vectoresPorEquipo: { ...p.vectoresPorEquipo, [equipo]: { url, viewBox: vector.viewBox } } }));
      setMensaje('Escudo cargado. Guarda la configuración para ofrecerlo a los clientes.');
    } catch (e) { setError(e.message); } finally { setOcupado(false); }
  };
  const guardar = async () => {
    setError(''); setMensaje('');
    if (valor.medidasConfirmadas && !medidasConfirmadas(valor)) { setError('Escribe el ancho y el alto útiles de producción en milímetros.'); return; }
    setOcupado(true);
    try {
      const produccionYoryo = { anchoMm: Number(valor.anchoMm) || 0, altoMm: Number(valor.altoMm) || 0, medidasConfirmadas: valor.medidasConfirmadas === true, tecnica: producto.personalizacionYoryo.tecnica, ...(valor.vectoresPorEquipo && { vectoresPorEquipo: valor.vectoresPorEquipo }) };
      const r = await updateProductField(producto.id, { produccionYoryo });
      if (r.error) throw new Error(r.error);
      setMensaje('Área de producción guardada. Los diseños deben generarse con estas medidas.');
      queryClient.invalidateQueries({ queryKey: ['product', producto.id] });
      queryClient.invalidateQueries({ queryKey: ['prenda-base', producto.id] });
    } catch (e) { setError(e.message); } finally { setOcupado(false); }
  };
  return <section className={s.configuracion}>
    <h2>Personalización Yoryo · {producto.personalizacionYoryo.tecnica === 'laser' ? 'Grabado láser' : 'Impresión'}</h2>
    <p>Configura el área útil real, sin incluir el marco o los bordes. Hasta confirmarla, se pueden preparar diseños y probar el carrito, pero no pagar este producto.</p>
    <div className={s.campos}>
      <Campo etiqueta="Ancho útil (mm)" type="number" min="1" max="500" step="0.1" value={valor.anchoMm} onChange={(e) => setValor((p) => ({ ...p, anchoMm: e.target.value, medidasConfirmadas: false }))} />
      <Campo etiqueta="Alto útil (mm)" type="number" min="1" max="500" step="0.1" value={valor.altoMm} onChange={(e) => setValor((p) => ({ ...p, altoMm: e.target.value, medidasConfirmadas: false }))} />
      <Casilla etiqueta="Confirmo las medidas útiles con el taller" activo={valor.medidasConfirmadas} onChange={(v) => setValor((p) => ({ ...p, medidasConfirmadas: v }))} />
      {producto.personalizacionYoryo.tecnica === 'laser' && <>
        <h3>Escudos vectoriales del tomatodo</h3>
        <p>Registra cada SVG original una vez. El cliente podrá elegir el equipo y escribir su nombre.</p>
        <Campo etiqueta="Equipo de la plantilla" opciones={['Alianza Lima', 'Universitario', 'Sporting Cristal', 'Sport Boys', 'Barcelona', 'Real Madrid'].map((v) => ({ valor: v, texto: v }))} value={equipo} onChange={(e) => setEquipo(e.target.value)} disabled={ocupado} />
        <input ref={archivoRef} type="file" accept=".svg,image/svg+xml" hidden onChange={(e) => { subirEscudo(e.target.files?.[0]); e.target.value = ''; }} />
        <Boton variante="contorno" onClick={() => archivoRef.current?.click()} disabled={ocupado}>{valor.vectoresPorEquipo?.[equipo] ? 'Reemplazar SVG del equipo' : 'Cargar SVG del equipo'}</Boton>
      </>}
      <Boton onClick={guardar} cargando={ocupado}>Guardar configuración de producción</Boton>
      {error && <Aviso tipo="error" compacto>{error}</Aviso>}
      {mensaje && <Aviso tipo="exito" compacto>{mensaje}</Aviso>}
    </div>
  </section>;
}
