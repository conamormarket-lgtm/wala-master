import { getApps, initializeApp } from 'firebase/app';
import { initializeAuth, inMemoryPersistence, signInAnonymously, connectAuthEmulator } from 'firebase/auth';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import app, { USE_EMULATORS } from './firebase/config';

let cliente;
let autenticando;

// Identidad temporal SOLO para proteger la intención y sus cobros. No inicia
// sesión en Walá, no crea un perfil ni altera AuthContext o el carrito invitado.
// Preparar, WhatsApp, Culqi y PayPal deben usar siempre este mismo cliente.
export async function funcionesCheckoutInvitado() {
  if (!cliente) {
    if (!app) throw new Error('No se pudo conectar con el servicio de pago.');
    const nombre = 'wala-checkout-invitado';
    const secundaria = getApps().find((a) => a.name === nombre) || initializeApp(app.options, nombre);
    const auth = initializeAuth(secundaria, { persistence: inMemoryPersistence });
    const functions = getFunctions(secundaria);
    if (USE_EMULATORS) {
      connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
      connectFunctionsEmulator(functions, 'localhost', 5001);
    }
    cliente = { auth, functions };
  }
  if (!cliente.auth.currentUser) {
    if (!autenticando) {
      autenticando = signInAnonymously(cliente.auth).finally(() => { autenticando = null; });
    }
    await autenticando;
  }
  return cliente.functions;
}
