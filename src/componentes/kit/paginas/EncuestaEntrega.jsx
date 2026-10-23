import React, { useState } from 'react';
import { Check, PackageCheck, ArrowRight, LogIn, Send } from 'lucide-react';
import Boton from '../Boton';
import { Aviso, EstadoVacio } from '../Feedback';
import { Campo } from '../Formulario';
import { Chip, Moneda } from '../Etiquetas';
import { Sello, Trazo, Garabatos } from '../Marca';
import { BloqueSeccion } from '../Seccion';
import { Estrellas } from '../piezas/Opiniones';
import { CARAS_KAPI } from '../piezas/Flotantes';
import { EsqueletoFormulario } from '../Esqueletos';
import { Texto } from '../Traduccion';
// Mismo marco que la encuesta de bienvenida (columna, tarjeta, cabeza, botones).
import s from './Encuesta.module.css';

const NOTAS = ['', 'Muy mal', 'Mal', 'Regular', 'Bien', '¡Excelente!'];

/**
 * "¿Cómo te fue con tu pedido?" (/opinar/:codigo): estrellas, qué mejorar
 * (botones de un toque, varios) y un comentario opcional. Llega con el aviso de
 * pedido entregado y desde el detalle del pedido. Datos por props:
 *  - codigo · estado: { activo, entregado, respondida, monedas, opcionesMejorar }
 *  - sesion · cargando · urlLogin · urlPedidos · urlTienda
 *  - onEnviar({ estrellas, mejorar, comentario }): promesa → { monedas, yaRespondida }
 */
export function PaginaEncuestaEntrega({
  codigo, estado, sesion = true, cargando = false,
  urlLogin = '/login', urlPedidos = '/cuenta/pedidos', urlTienda = '/', onEnviar,
}) {
  const [estrellas, setEstrellas] = useState(0);
  const [mejorar, setMejorar] = useState([]);
  const [comentario, setComentario] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [fin, setFin] = useState(null);

  const vacio = (titulo, texto, botones) => (
    <BloqueSeccion ajustes={{ paddingTop: '2rem', paddingBottom: '2.5rem' }}>
      <div className={`${s.columna} ${s.estado}`}>
        <EstadoVacio imagen={CARAS_KAPI.feliz} titulo={<Texto>{titulo}</Texto>} texto={<Texto>{texto}</Texto>}>{botones}</EstadoVacio>
      </div>
    </BloqueSeccion>
  );

  if (!sesion) {
    return vacio('¿Cómo te fue con tu pedido?', 'Inicia sesión para contarnos y ganar tus monedas.',
      <Boton to={urlLogin} icono={<LogIn aria-hidden="true" />}><Texto>Iniciar sesión</Texto></Boton>);
  }
  if (cargando || !estado) {
    return (
      <BloqueSeccion ajustes={{ paddingTop: '1.5rem', paddingBottom: '2.5rem' }}>
        <div className={s.columna} aria-busy="true"><div className={s.tarjeta}><EsqueletoFormulario campos={3} /></div></div>
      </BloqueSeccion>
    );
  }
  if (fin || estado.respondida) {
    const monedas = fin?.monedas || 0;
    return vacio('¡Gracias por contarnos!',
      monedas > 0 ? `Ganaste ${monedas} monedas: ya están en tu saldo. Con lo que nos dices mejoramos cada pedido.` : 'Con lo que nos dices mejoramos cada pedido.',
      <Boton to={urlTienda} iconoFin={<ArrowRight aria-hidden="true" />}><Texto>Ir a la tienda</Texto></Boton>);
  }
  if (!estado.activo) {
    return vacio('Esta encuesta no está disponible', 'Por ahora no estamos recibiendo opiniones de pedidos.',
      <Boton to={urlPedidos}><Texto>Ver mis pedidos</Texto></Boton>);
  }
  if (!estado.entregado) {
    return vacio('Tu pedido todavía no figura como entregado', 'Cuando te llegue, aquí podrás contarnos cómo te fue.',
      <Boton to={urlPedidos}><Texto>Ver mis pedidos</Texto></Boton>);
  }

  const alternar = (o) => setMejorar((l) => (l.includes(o) ? l.filter((x) => x !== o) : [...l, o]));
  const enviar = async () => {
    if (!estrellas) { setError('Elige de 1 a 5 estrellas.'); return; }
    setError('');
    setEnviando(true);
    try {
      setFin(await onEnviar?.({ estrellas, mejorar, comentario: comentario.trim() }) || { monedas: 0 });
    } catch (e) {
      setError(e?.message || 'No pudimos enviar tu respuesta. Inténtalo de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <BloqueSeccion ajustes={{ paddingTop: '1.25rem', paddingBottom: '2.5rem' }}>
      <div className={s.columna}>
        <div className={`${s.tarjeta} ${s.entraAdelante}`}>
          <Garabatos variante="titulo" className={s.garabatos} />
          <header className={s.cabeza}>
            <Sello tamano={52} tono="menta" girar={-8}><PackageCheck aria-hidden="true" /></Sello>
            <h1 className={s.titulo}><Texto>¿Cómo te fue con tu pedido?</Texto><Trazo className={s.trazo} /></h1>
            <p className={s.subtitulo}><Texto>{`Pedido ${codigo}. Son 30 segundos.`}</Texto></p>
          </header>
          {estado.monedas > 0 && (
            <div className={s.ganaste}>
              <Moneda tamano={30} className={s.premioMoneda} />
              <p><Texto>{`Gana ${estado.monedas} monedas al enviar.`}</Texto></p>
            </div>
          )}
          <div className={s.formulario}>
            <div className={s.estrellasEntrega}>
              <Estrellas valor={estrellas} tamano={38} onCambiar={(n) => { setEstrellas(n); setError(''); }} etiqueta="Tu calificación del pedido" />
              <span className={s.notaEntrega}><Texto>{NOTAS[estrellas] || 'Toca una estrella'}</Texto></span>
            </div>
            <div className={s.elegirVariosEntrega} role="group" aria-label="Qué podemos mejorar">
              <span className={s.etiquetaEntrega}><Texto>¿Qué podemos mejorar?</Texto> <small><Texto>(opcional, puedes elegir varias)</Texto></small></span>
              <div className={s.chipsEntrega}>
                {(estado.opcionesMejorar || []).map((o) => (
                  <Chip key={o} tamano="sm" activo={mejorar.includes(o)} onClick={() => alternar(o)}><Texto>{o}</Texto></Chip>
                ))}
              </div>
            </div>
            <Campo
              etiqueta="¿Algo más que quieras contarnos?"
              ayuda="Opcional."
              multilinea={3}
              maxLength={500}
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="Ej. Llegó rápido y el estampado quedó perfecto."
            />
          </div>
          {error && <div className={s.avisoPaso}><Aviso tipo="error" compacto>{error}</Aviso></div>}
          <div className={`${s.acciones} ${s.accionesCentro}`}>
            <Boton icono={estrellas ? <Send aria-hidden="true" /> : <Check aria-hidden="true" />} onClick={enviar} cargando={enviando}><Texto>Enviar</Texto></Boton>
          </div>
        </div>
      </div>
    </BloqueSeccion>
  );
}
