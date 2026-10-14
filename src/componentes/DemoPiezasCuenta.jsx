import React, { useState } from 'react';
import { Gift, Flame, User, Moon, Medal, Heart, MapPin } from 'lucide-react';
import {
  Sello, Campo, MenuCuenta, Estadistica, AccesosCuenta, IdentidadCuenta, ListaEleccion, TarjetaCuenta, ListaDatos,
  TarjetaDireccion, TarjetaRecompensa, TarjetaCupon, TarjetaMision, NivelCuenta, FilaReferido, EnlaceInvitacion,
  FormaGanar, TarjetaCreacion, IdeaRegalo, AvisoFestiva, Moneda, Interruptor,
} from './kit';
import { GRUPOS_CUENTA_COMPLETO } from './DemoCuenta';
import { Ficha } from './DemoPiezas';
import s from './DemoPiezas.module.css';

/*
 * Piezas de la cuenta (/cuenta), sueltas. Las mismas arman las páginas de
 * "Mi cuenta" en Páginas → Tienda de prueba (ficha: kit/guia/CUENTA.md).
 */
export default function DemoPiezasCuenta({ imagenes }) {
  const [idioma, setIdioma] = useState('es');
  const [doc, setDoc] = useState('DNI');
  const [noche, setNoche] = useState(false);
  const copiar = async () => {};
  return (
    <div className={s.rejilla}>
      <Ficha nombre="Sello" usadaEn="Cabeceras de la cuenta, accesos, menú lateral, misiones, niveles">
        <div className={s.fila}>
          <Sello><User /></Sello>
          <Sello tono="oro"><Gift /></Sello>
          <Sello tono="rosa"><Heart /></Sello>
          <Sello tono="menta"><MapPin /></Sello>
          <Sello tono="bronce"><Medal /></Sello>
          <Sello tono="plata"><Medal /></Sello>
          <Sello tono="suave" girar={0}><Moon /></Sello>
        </div>
      </Ficha>

      <Ficha nombre="Campo opciones=[…]" usadaEn="Perfil, direcciones, fechas importantes (lista desplegable)">
        <Campo
          etiqueta="Tipo de documento"
          opciones={[{ valor: 'DNI', texto: 'DNI' }, { valor: 'CE', texto: 'Carnet de extranjería' }, { valor: 'Pasaporte', texto: 'Pasaporte' }]}
          value={doc}
          onChange={(e) => setDoc(e.target.value)}
        />
      </Ficha>

      <Ficha nombre={'MenuCuenta lateral activo="/cuenta/cupones"'} usadaEn="MarcoCuenta (al costado de /cuenta desde 860px)">
        <div style={{ maxWidth: 280 }}>
          <MenuCuenta lateral activo="/cuenta/cupones" usuario={{ nombre: 'Isaac Castro', email: 'isaac@correo.com' }} grupos={GRUPOS_CUENTA_COMPLETO} onCerrarSesion={() => {}} />
        </div>
      </Ficha>

      <Ficha nombre="AccesosCuenta" usadaEn="Resumen de la cuenta (lo que abre «Mi cuenta» en el celular)">
        <AccesosCuenta grupos={GRUPOS_CUENTA_COMPLETO.slice(1, 2)} />
      </Ficha>

      <Ficha nombre="IdentidadCuenta" usadaEn="Mi perfil">
        <IdentidadCuenta nombre="Isaac Castro" email="isaac@correo.com" completo={false} onCambiarFoto={() => {}} />
      </Ficha>

      <Ficha nombre="Estadistica" usadaEn="Resumen, perfil (grande), misiones y referidos">
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <Estadistica icono={<Moneda tamano={38} />} sello={false} etiqueta="Monedas" valor="43" unidad="monedas" nota="+50 en espera" />
          <Estadistica icono={<Flame />} tono="rosa" etiqueta="Racha" valor="4" unidad="días" nota="Entraste hoy: +1 moneda." />
        </div>
      </Ficha>

      <Ficha nombre="TarjetaCuenta + ListaDatos + ListaEleccion" usadaEn="Datos personales, Apariencia, Idioma">
        <TarjetaCuenta icono={<User />} titulo="Datos personales" subtitulo="Con estos datos ubicamos tus pedidos.">
          <ListaDatos datos={[{ etiqueta: 'DNI', valor: '45871236' }, { etiqueta: 'Cumpleaños', valor: '' }]} />
          <Interruptor etiqueta="Modo noche" activo={noche} onChange={setNoche} />
          <ListaEleccion
            etiqueta="Idioma"
            valor={idioma}
            onElegir={setIdioma}
            opciones={[{ valor: 'es', texto: 'Español', detalle: 'Perú' }, { valor: 'en', texto: 'English', detalle: 'Inglés' }]}
          />
        </TarjetaCuenta>
      </Ficha>

      <Ficha nombre="TarjetaDireccion" usadaEn="Mis direcciones (a futuro, el checkout)">
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <TarjetaDireccion principal nombre="Isaac Castro" direccion="Av. Larco 1150, dpto. 502" lugar="Miraflores, Lima Metropolitana" documento="DNI 45871236" telefono="987654321" onEditar={() => {}} onEliminar={() => {}} />
          <TarjetaDireccion nombre="María Castro" direccion="Calle Jerusalén 214" lugar="Yanahuara, Arequipa, Arequipa" documento="DNI 41236587" telefono="956123478" onPrincipal={() => {}} onEditar={() => {}} onEliminar={() => {}} />
        </div>
      </Ficha>

      <Ficha nombre="TarjetaRecompensa" usadaEn="Catálogo de recompensas">
        <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))' }}>
          <TarjetaRecompensa titulo="Cupón de descuento" descripcion="Para tu próxima compra." beneficio="10% de descuento" costo={30} saldo={43} onCanjear={() => new Promise((r) => setTimeout(r, 800))} />
          <TarjetaRecompensa titulo="Taza de regalo" imagen={imagenes.taza} beneficio="De regalo" costo={120} saldo={43} />
        </div>
      </Ficha>

      <Ficha nombre="TarjetaCupon" usadaEn="Mis cupones">
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <TarjetaCupon texto="15% en tu próxima compra" codigo="RULETA-8KQ2" origen="ruleta" vence="31 de octubre" onCopiar={copiar} />
          <TarjetaCupon texto="S/ 10 de descuento" codigo="WALA-1ZB3" origen="recompensa" estado="caducado" vence="30 de septiembre" />
        </div>
      </Ficha>

      <Ficha nombre="TarjetaMision · NivelCuenta" usadaEn="Misiones" ancho="1 / -1">
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <NivelCuenta xp={180} />
          <TarjetaMision titulo="Revisa tus cupones" descripcion="Que no se te venza ninguno." recompensa={1} accion={{ texto: 'Ir a Mis cupones', url: '/cuenta/cupones' }} />
          <TarjetaMision titulo="Cuéntanos qué te gusta" descripcion="Marca un favorito." recompensa={1} onCompletar={() => new Promise((r) => setTimeout(r, 700))} />
          <TarjetaMision titulo="Visita el catálogo" recompensa={2} completada />
        </div>
      </Ficha>

      <Ficha nombre="FormaGanar · EnlaceInvitacion · FilaReferido" usadaEn="Mis referidos" ancho="1 / -1">
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <FormaGanar icono="regalo" titulo="Invita a alguien nuevo">Con tu link crea su cuenta y recibe <strong>10 monedas</strong>.</FormaGanar>
          <EnlaceInvitacion url="https://www.wala.pe/invitar/ISAAC7K" onCompartir={() => {}} onCopiar={copiar} />
          <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            <FilaReferido nombre="Lucía" chips={[{ texto: 'Cuenta nueva', tono: 'violeta' }, { texto: 'En camino', tono: 'aviso' }]} detalle="Compró una taza · S/ 89.90 · 9 oct" ganancia={15} confirmada />
            <FilaReferido chips={[{ texto: 'Plazo vencido', tono: 'neutro' }]} detalle="Entró el 2 oct · no compró a tiempo" />
          </ul>
        </div>
      </Ficha>

      <Ficha nombre="TarjetaCreacion" usadaEn="Mis creaciones (y sus borradores)">
        <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))' }}>
          <TarjetaCreacion nombre="Mi polera con Kapi" imagen={imagenes.frente} imagenEspalda={imagenes.espalda} producto="Polera clásica" color={{ nombre: 'Blanco', hex: '#fff' }}
            fecha="Guardada ayer" precio={59.9} comprado urlEditar="/crear" urlComprar="/creacion" onEliminar={() => new Promise((r) => setTimeout(r, 600))} onRenombrar={() => Promise.resolve()} />
          <TarjetaCreacion borrador nombre="Sin terminar" imagen={imagenes.frente} producto="Polera clásica" fecha="Guardada hoy" urlEditar="/crear" />
        </div>
      </Ficha>

      <Ficha nombre="AvisoFestiva · IdeaRegalo" usadaEn="Fechas importantes (TarjetaPersonaRegalo usa las mismas ideas)">
        <AvisoFestiva
          nombre="Día de la Madre"
          fecha="0000-05-10"
          icono="corazon"
          personas={[{ nombre: 'Mamá', ideas: [{ id: 'i1', nombre: 'Taza mágica «Feliz día»', imagen: imagenes.taza, precio: 34.9, motivo: 'Entra en tu presupuesto', url: '/producto/taza' }] }]}
        />
        <ul style={{ margin: '0.75rem 0 0', padding: 0, listStyle: 'none' }}>
          <IdeaRegalo nombre="Polera con tu foto" imagen={imagenes.frente} precio={59.9} motivo="Le gusta el anime" url="/producto/polera" necesitaOpciones />
        </ul>
      </Ficha>
    </div>
  );
}
