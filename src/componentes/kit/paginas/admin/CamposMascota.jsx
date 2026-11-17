import React from 'react';
import { Campo } from '../../Formulario';
import { GrupoCampos, CampoImagen, CampoColor, ElegirUno } from '../../piezas/admin/Formularios';
import { ANIMATION_NAMES, normalizeCompanionConfig } from '../../../../components/kapi-local/companionProfiles.mjs';
const labels = { idle: 'Reposo', walk: 'Caminar', wave: 'Saludar', talk: 'Hablar', think: 'Pensar', point: 'Señalar' };
export default function CamposMascota({ datos, cambiar, idDe, subirImagen }) {
  const config = normalizeCompanionConfig(datos.companion, { name: datos.nombre, slug: datos.slug });
  const set = (key, value) => cambiar('companion', { ...config, [key]: value });
  const upload = subirImagen && ((blob, options) => subirImagen(blob, { ...options, carpeta: 'mascotas' }));
  return <GrupoCampos titulo="Mascota de la marca" ayuda="Comparte la conversación con Kapi. Su especialidad determina cuándo puede intervenir.">
    <ElegirUno etiqueta="Estado" opciones={[{valor:'on',texto:'Activada'},{valor:'off',texto:'Desactivada'}]} valor={config.enabled?'on':'off'} onElegir={value=>set('enabled',value==='on')} />
    {config.enabled && <>
      <Campo etiqueta="Nombre de la mascota" id={idDe('mascotaNombre')} value={config.name} maxLength={60} onChange={e=>set('name',e.target.value)} />
      <Campo etiqueta="Especialidad" id={idDe('mascotaEspecialidad')} multilinea value={config.specialty} maxLength={500} ayuda="Describe los temas que domina; la IA reconoce distintas formas de pedir ayuda." onChange={e=>set('specialty',e.target.value)} />
      <Campo etiqueta="Cómo debe asesorar" id={idDe('mascotaAsesoria')} multilinea value={config.instructions} maxLength={1500} onChange={e=>set('instructions',e.target.value)} />
      <Campo etiqueta="Saludo de presentación" id={idDe('mascotaSaludo')} multilinea value={config.greeting} maxLength={200} onChange={e=>set('greeting',e.target.value)} />
      <ElegirUno etiqueta="Intervenir por el tema de conversación" opciones={[{valor:'on',texto:'Sí'},{valor:'off',texto:'No'}]} valor={config.byTopic?'on':'off'} onElegir={v=>set('byTopic',v==='on')} />
      <ElegirUno etiqueta="Recibir al usuario en la página de la marca" opciones={[{valor:'on',texto:'Sí'},{valor:'off',texto:'No'}]} valor={config.byRoute?'on':'off'} onElegir={v=>set('byRoute',v==='on')} />
      <ElegirUno etiqueta="Productos que puede recomendar" opciones={[{valor:'brand',texto:'Solo esta marca'},{valor:'all',texto:'Todo Walá'}]} valor={config.catalogScope} onElegir={v=>set('catalogScope',v)} />
      <CampoColor etiqueta="Color del globo" valor={config.color} onCambiar={v=>set('color',v)} />
      <ElegirUno etiqueta="Personaje y animaciones" opciones={[{valor:'kapi',texto:'Kapi'},{valor:'lumi',texto:'Lumita (Lumi)'},{valor:'custom',texto:'Personaje propio'}]} valor={config.assetPack} onElegir={v=>set('assetPack',v)} />
      {config.assetPack !== 'custom' && <img alt={`Vista previa de ${config.name}`} src={config.assetPack==='lumi'?'/assets/companions/lumi-v1/wave.webp':'/assets/kapi/companion-v1/assets/wave.webp'} style={{width:160,height:160,objectFit:'contain'}} />}
      {config.assetPack === 'custom' && <>
        <CampoImagen etiqueta="Imagen de reposo con fondo transparente" valor={config.portrait} onCambiar={v=>set('portrait',v)} subir={upload} acepta="image/png,image/webp" contener conEnlace />
        {ANIMATION_NAMES.map(name=><React.Fragment key={name}>
          <CampoImagen etiqueta={`${labels[name]} — animación transparente`} valor={config.animations[name]?.src||''} onCambiar={src=>set('animations',{...config.animations,[name]:{...config.animations[name],src}})} subir={upload} acepta="image/webp,image/gif" contener conEnlace />
          <Campo etiqueta={`Duración de ${labels[name].toLowerCase()} (segundos)`} type="number" min={.3} max={15} step={.1} value={(config.animations[name]?.duration||2000)/1000} onChange={e=>set('animations',{...config.animations,[name]:{...config.animations[name],duration:Number(e.target.value)*1000}})} />
        </React.Fragment>)}
        <CampoImagen etiqueta="Pose estática señalando (opcional)" ayuda="Mantiene la mano señalando mientras explica un elemento." valor={config.animations.point?.still||''} onCambiar={still=>set('animations',{...config.animations,point:{...config.animations.point,still}})} subir={upload} acepta="image/png,image/webp" contener conEnlace />
      </>}
    </>}
  </GrupoCampos>;
}
