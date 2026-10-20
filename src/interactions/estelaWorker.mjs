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

self.onmessage = ({ data }) => {
  if (data.tipo === 'iniciar') {
    motor = crearMotor({ lienzo: data.lienzo, ahora: () => performance.now(), pedirMarco, cancelarMarco });
    motor.tamano(data.ancho, data.alto, data.dpr);
    return;
  }
  if (!motor) return;
  switch (data.tipo) {
    case 'tamano': motor.tamano(data.ancho, data.alto, data.dpr); break;
    case 'presionar': motor.presionar(data.x, data.y, data.oscuro); break;
    case 'empezar': motor.empezar(data.x, data.y); break;
    case 'agregar': for (let i = 0; i < data.xy.length; i += 2) motor.agregar(data.xy[i], data.xy[i + 1]); break;
    case 'soltar': motor.soltar(); break;
    case 'cancelar': motor.cancelar(); break;
    case 'limpiar': motor.limpiar(); break;
    default: break;
  }
};
