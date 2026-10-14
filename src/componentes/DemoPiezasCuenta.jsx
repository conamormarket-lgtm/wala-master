import React, { useState } from 'react';
import { Gift, Flame, User, Moon, Medal, Heart, MapPin } from 'lucide-react';
import {
  Sello, Campo, MenuCuenta, Estadistica, AccesosCuenta, IdentidadCuenta, ListaEleccion, TarjetaCuenta, ListaDatos,
  TarjetaDireccion, TarjetaRecompensa, TarjetaCupon, TarjetaMision, NivelCuenta, FilaReferido, EnlaceInvitacion,
  FormaGanar, TarjetaCreacion, IdeaRegalo, AvisoFestiva, Moneda, Interruptor,
  CampoFecha, CampoTelefono, Casilla, RecortarFoto, LineaProduccion, PagosPedido, PedidosPorVerificar, RankingReferidos,
  ETAPAS_PRODUCCION, Boton,
} from './kit';
import { GRUPOS_CUENTA_COMPLETO } from './DemoCuenta';
import { Ficha } from './DemoPiezas';
import s from './DemoPiezas.module.css';

/*
 * Piezas de la cuenta (/cuenta), sueltas. Las mismas arman las páginas de
 * "Mi cuenta" en Páginas → Tienda de prueba (ficha: kit/guia/CUENTA.md).
 */
const espera = (ms) => new Promise((r) => { setTimeout(r, ms); });
const PAISES = [['PE', 'Perú', '+51'], ['AR', 'Argentina', '+54'], ['BO', 'Bolivia', '+591'], ['CL', 'Chile', '+56'], ['CO', 'Colombia', '+57'],
  ['EC', 'Ecuador', '+593'], ['MX', 'México', '+52'], ['US', 'Estados Unidos', '+1'], ['ES', 'España', '+34'], ['VE', 'Venezuela', '+58'],
  ['UY', 'Uruguay', '+598'], ['PY', 'Paraguay', '+595']].map(([valor, texto, prefijo]) => ({ valor, texto, prefijo }));
const DISTRITOS = ['Barranco', 'Breña', 'Chorrillos', 'Comas', 'Jesús María', 'La Molina', 'La Victoria', 'Lince', 'Los Olivos',
  'Magdalena del Mar', 'Miraflores', 'Pueblo Libre', 'San Borja', 'San Isidro', 'San Miguel', 'Santiago de Surco', 'Surquillo']
  .map((d) => ({ valor: d, texto: d }));
const EQUIPOS = ['Alianza Lima', 'Universitario', 'Sporting Cristal'].map((x) => ({ valor: x, texto: x }));

export default function DemoPiezasCuenta({ imagenes }) {
  const [idioma, setIdioma] = useState('es');
  const [doc, setDoc] = useState('DNI');
  const [noche, setNoche] = useState(false);
  const [pais, setPais] = useState('PE');
  const [distrito, setDistrito] = useState('');
  const [gusto, setGusto] = useState('');
  const [fecha, setFecha] = useState('2001-07-12');
  const [fechaOtra, setFechaOtra] = useState('');
  const [telefono, setTelefono] = useState('987654321');
  const [acepto, setAcepto] = useState(true);
  const [recorte, setRecorte] = useState(null);
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

      <Ficha nombre="Campo opciones=[…] (ListaOpciones)" usadaEn="Perfil, direcciones, fechas importantes: panel en escritorio, hoja en el celular; buscador con más de 10">
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <Campo
            etiqueta="Tipo de documento"
            opciones={[{ valor: 'DNI', texto: 'DNI' }, { valor: 'CE', texto: 'Carnet de extranjería' }, { valor: 'Pasaporte', texto: 'Pasaporte' }]}
            value={doc}
            onChange={(e) => setDoc(e.target.value)}
          />
          <Campo etiqueta="Distrito" opciones={[{ valor: '', texto: 'Elige…', deshabilitada: true }, ...DISTRITOS]} value={distrito} onChange={(e) => setDistrito(e.target.value)} />
          <Campo etiqueta="¿De qué equipo es hincha? (creable)" creable opciones={EQUIPOS} value={gusto} onChange={(e) => setGusto(e.target.value)} placeholder="Escribe o elige" />
        </div>
      </Ficha>

      <Ficha nombre="CampoFecha · Calendario" usadaEn="Fecha de nacimiento (empieza por el año), fechas de las personas («No sé el año»)">
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <CampoFecha etiqueta="Fecha de nacimiento" valor={fecha} onCambiar={setFecha} vistaInicial="anios" max={new Date().toISOString().slice(0, 10)} />
          <CampoFecha etiqueta="Su cumpleaños" valor={fechaOtra} onCambiar={setFechaOtra} anioOpcional vistaInicial="anios" />
        </div>
      </Ficha>

      <Ficha nombre="CampoTelefono · Casilla" usadaEn="Perfil, direcciones, vincular un pedido; aceptar y «No sé el año»">
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <CampoTelefono pais={pais} onPais={setPais} paises={PAISES} valor={telefono} onCambiar={setTelefono} />
          <Casilla etiqueta="Quiero recibir ofertas por WhatsApp" descripcion="Puedes desactivarlo cuando quieras." activo={acepto} onChange={setAcepto} />
        </div>
      </Ficha>

      <Ficha nombre="RecortarFoto" usadaEn="Foto de perfil y de cada persona en Fechas importantes">
        <Boton variante="contorno" onClick={() => setRecorte(imagenes.frente)}>Probar el recorte</Boton>
        <RecortarFoto abierta={Boolean(recorte)} src={recorte} onCancelar={() => setRecorte(null)} onListo={async () => { await espera(600); setRecorte(null); }} />
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

      <Ficha nombre="LineaProduccion · PagosPedido" usadaEn="Detalle de una compra (/cuenta/pedidos/:id)" ancho="1 / -1">
        <div style={{ display: 'grid', gap: '1rem' }}>
          <LineaProduccion pasos={ETAPAS_PRODUCCION} paso={4} fechas={{ 0: '3 oct', 1: '4 oct', 2: '5 oct', 3: '6 oct', 4: '7 oct' }} deuda />
          <div style={{ maxWidth: 340 }}>
            <PagosPedido total={121} deuda={45} historial={[{ monto: 76, fecha: '8 oct · 3:12 p. m.' }]} onPagar={() => {}} onBoletas={async () => [imagenes.frente]} onFotosEnvio={async () => []} />
          </div>
        </div>
      </Ficha>

      <Ficha nombre="PedidosPorVerificar" usadaEn="Mis pedidos (arriba de la lista)">
        <PedidosPorVerificar
          pendientes={[{ ref: 'v1', fecha: '2 oct 2026', fase: 'En producción', mismoCorreo: true }]}
          onEnviarVerificacion={async () => ({ yaVerificado: false })}
          onYaVerifique={async () => false}
          onVincular={async () => { throw new Error('Ese número de pedido no coincide con ese teléfono.'); }}
        />
      </Ficha>

      <Ficha nombre="RankingReferidos" usadaEn="Mis referidos (al final)">
        <RankingReferidos
          tuCodigo="ISAAC7K"
          items={[{ codigo: 'MARIA22', compras: 5, monedas: 62 }, { codigo: 'ISAAC7K', compras: 3, monedas: 31 }, { codigo: 'LUCHO10', compras: 2, monedas: 20 }, { codigo: 'ANAWALA', compras: 1, monedas: 15 }]}
        />
      </Ficha>

      <Ficha nombre="TarjetaCreacion (combo · comunidad)" usadaEn="Un combo con sus prendas lado a lado; publicar en la comunidad (admins); borrador" ancho="1 / -1">
        <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))' }}>
          <TarjetaCreacion
            nombre="Mi combo de pareja" imagenes={[imagenes.frente, imagenes.espalda]} combo="2 prendas" subtitulo="Combo Pareja Walá" fecha="Guardada hace 5 días"
            precio={99.9} urlEditar="/combo" urlComprar="/combo" comunidad={{ estado: null, onPublicar: () => espera(600) }}
          />
          <TarjetaCreacion nombre="Combo de aniversario" borrador imagenes={[imagenes.frente, imagenes.espalda]} subtitulo="1 de 2 prendas con diseño · sin terminar" fecha="Editado hoy" urlEditar="/combo" />
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
