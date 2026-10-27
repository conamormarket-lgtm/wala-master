import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import LienzoYoryo from '/src/components/crear/LienzoYoryo.jsx';
import { EscenaEstudio } from '/src/componentes/kit/paginas/MarcoEstudio.jsx';
import { Pestanas } from '/src/componentes/kit/Navegacion.jsx';
import { aplicarPresetYoryo } from '/src/utils/capasYoryo.mjs';
import { cargarFuentesYoryo, componerArteYoryo } from '/src/pages/Crear/arteYoryo.mjs';
import { cargarPlantillaYoryo } from '/src/pages/Crear/generarYoryo.js';
import escena from '/src/components/crear/PersonalizadorYoryo.module.css';
import estudio from '/src/components/crear/EstudioDeTienda.module.css';
import '/src/styles/variables.css';
import '/src/theme/tokens.css';
import '/src/styles/globals.css';

// Usa el mismo padre con justify-items:center que la tienda, sin sesión ni escrituras.
function Prueba() {
  const [nombre,setNombre]=useState('Cuadro'), [modo,setModo]=useState('producto'), [plantilla,setPlantilla]=useState('deportivo');
  const [composicion,setComposicion]=useState({svg:'',elementos:[]}),[medidas,setMedidas]=useState('Cargando…');
  const ref=useRef(null);
  const config={nombre,tecnica:'impresion',proporcion:nombre==='Mousepad'?195/235:250/310,produccion:{anchoMm:nombre==='Mousepad'?235:310,altoMm:nombre==='Mousepad'?195:250,medidasConfirmadas:true}};
  const datos=aplicarPresetYoryo({nombre:'Isaac Urcia',frase:'Crema de corazón',dedicatoria:'Con todo mi amor',equipo:'Universitario',plantillaVisual:plantilla,plantilla:plantilla==='deportivo'?'equipo':'nombre',formatoPlantilla:plantilla==='deportivo'?4:3,distribucion:{version:3,elementos:{}},fotos:[]},config);
  useEffect(()=>{let activo=true;Promise.all([cargarFuentesYoryo(datos,config),cargarPlantillaYoryo(datos)]).then(([fuentes,capas])=>{if(activo)setComposicion(componerArteYoryo({datos,config,fuentes,plantilla:capas}));});return()=>{activo=false;};},[nombre,plantilla]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(()=>{
    const medir=()=>{const dibujo=ref.current?.querySelector('[data-yoryo-arte]');if(!dibujo)return;const r=dibujo.getBoundingClientRect();const minimo=Math.min(250,ref.current.clientWidth*.6);setMedidas(`${r.width>=minimo&&r.height>=minimo*.6?'Correcto':'FALLA'}: ${Math.round(r.width)} × ${Math.round(r.height)} px`);};
    const observador=new ResizeObserver(medir);observador.observe(ref.current);medir();return()=>observador.disconnect();
  },[nombre,modo,composicion]);
  return <main style={{width:'100%',maxWidth:1240,boxSizing:'border-box',margin:'24px auto',padding:16}} data-componente="PaginaEstudio">
    <h1>Vista previa de {nombre.toLowerCase()}</h1>
    <p>Prueba local del editor con su contenedor real. Sin acceso a datos de clientes.</p>
    <label>Producto <select value={nombre} onChange={e=>setNombre(e.target.value)}><option>Cuadro</option><option>Mousepad</option></select></label>{' '}
    <label>Plantilla <select value={plantilla} onChange={e=>setPlantilla(e.target.value)}><option value="deportivo">Equipos</option><option value="floral">Parejas floral</option></select></label>
    <p role="status">{medidas}</p>
    <div className={estudio.cuerpo}>
      <EscenaEstudio escenaRef={ref} className={`${estudio.escena} ${escena.escena}`}>
        <Pestanas etiqueta="Vista del diseño" opciones={[{id:'producto',texto:'En el producto'},{id:'plano',texto:'Diseño plano'}]} valor={modo} onChange={setModo}/>
        <LienzoYoryo key={`${nombre}:${modo}`} {...composicion} producto={{personalizacionYoryo:config}} datos={datos} modo={modo} activa="nombre" onActiva={()=>{}} onMover={()=>{}} onGuardar={()=>{}} onDeshacer={()=>{}} onRehacer={()=>{}}/>
      </EscenaEstudio>
      <aside><h2>Nombre</h2><p>Isaac Urcia</p><p>La estructura y el estilo de la plantilla se conservan.</p></aside>
    </div>
  </main>;
}
createRoot(document.getElementById('root')).render(<Prueba/>);
