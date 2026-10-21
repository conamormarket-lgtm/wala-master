// El brillo mágico en su propio hilo: recibe el OffscreenCanvas y los toques
// de estelaMagica.mjs y dibuja con estelaMotor.mjs. Así el inicio (carruseles,
// fotos, React) no le quita cuadros a la estela, ni la estela al inicio.
import { crearMotor } from './estelaMotor.mjs';

let motor = null;
const pedirMarco = typeof self.requestAnimationFrame === 'function'
  ? (fn) => self.requestAnimationFrame(fn)
  : (fn) => setTimeout(fn, 16);
const cancelarMarco = typeof self.cancelAnimationFrame === 'function'
  ? (id) => self.cancelAnimationFrame(id)
  : (id) => clearTimeout(id);

// El reloj absoluto (timeOrigin + now): el del Worker y el de la página
// empiezan en momentos distintos, y los toques traen la hora de la página.
const ahora = () => performance.timeOrigin + performance.now();

self.onmessage = ({ data }) => {
  if (data.tipo === 'iniciar') {
    motor = crearMotor({ lienzo: data.lienzo, ahora, pedirMarco, cancelarMarco });
    motor.tamano(data.ancho, data.alto, data.dpr);
    return;
  }
  if (!motor) return;
  switch (data.tipo) {
    case 'tamano': motor.tamano(data.ancho, data.alto, data.dpr); break;
    case 'presionar': motor.presionar(data.x, data.y, data.oscuro, data.t); break;
    case 'empezar': motor.empezar(data.x, data.y, data.t); break;
    // De a tres: x, y y la hora del toque.
    case 'agregar': for (let i = 0; i < data.xyt.length; i += 3) motor.agregar(data.xyt[i], data.xyt[i + 1], data.xyt[i + 2]); break;
    case 'soltar': motor.soltar(data.t); break;
    case 'cancelar': motor.cancelar(); break;
    case 'limpiar': motor.limpiar(); break;
    default: break;
  }
};
