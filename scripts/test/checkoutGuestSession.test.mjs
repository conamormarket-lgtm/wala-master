import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SourceTextModule, SyntheticModule, createContext } from 'node:vm';

async function cargar({ fallaPrimera = false } = {}) {
  const contexto = createContext({});
  const principal = { name: '[DEFAULT]', options: { projectId: 'demo-wala' } };
  const apps = [principal];
  const llamadas = [];
  const memoria = {};
  let intentos = 0;
  const mocks = {
    'firebase/app': {
      getApps: () => apps,
      initializeApp: (options, name) => { const app = { options, name }; apps.push(app); return app; },
    },
    'firebase/auth': {
      inMemoryPersistence: memoria,
      initializeAuth: (app, options) => { llamadas.push({ app, options }); return { app, currentUser: null }; },
      signInAnonymously: async (auth) => {
        intentos += 1;
        await Promise.resolve();
        if (fallaPrimera && intentos === 1) throw new Error('sin red');
        auth.currentUser = { uid: 'invitado', isAnonymous: true };
      },
      connectAuthEmulator: () => { throw new Error('no debe conectar al emulador'); },
    },
    'firebase/functions': {
      getFunctions: (app) => ({ app }),
      connectFunctionsEmulator: () => { throw new Error('no debe conectar al emulador'); },
    },
    './firebase/config': { default: principal, USE_EMULATORS: false },
  };
  const source = await readFile(new URL('../../src/services/checkoutGuest.js', import.meta.url), 'utf8');
  const modulo = new SourceTextModule(source, { context: contexto });
  await modulo.link((name) => {
    const exports = mocks[name];
    if (!exports) throw new Error(`Import inesperado: ${name}`);
    return new SyntheticModule(Object.keys(exports), function () {
      for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
    }, { context: contexto });
  });
  await modulo.evaluate();
  return { obtener: modulo.namespace.funcionesCheckoutInvitado, apps, principal, llamadas, memoria, intentos: () => intentos };
}

test('crea la identidad solo al continuar y la comparte entre preparación y pasarelas sin tocar la sesión principal', async () => {
  const s = await cargar();
  assert.equal(s.intentos(), 0);
  const [preparar, tarjeta, whatsapp, paypal] = await Promise.all(Array.from({ length: 4 }, () => s.obtener()));
  assert.equal(s.intentos(), 1);
  assert.equal(s.apps.length, 2);
  assert.notEqual(preparar.app, s.principal);
  assert.equal(preparar.app.options, s.principal.options);
  assert.equal(s.llamadas[0].options.persistence, s.memoria);
  for (const cliente of [tarjeta, whatsapp, paypal, await s.obtener()]) assert.equal(cliente, preparar);
  assert.equal(s.intentos(), 1);
});

test('un fallo de conexión permite reintentar sin crear otra app ni cambiar la sesión de Walá', async () => {
  const s = await cargar({ fallaPrimera: true });
  await assert.rejects(s.obtener(), /sin red/);
  const functions = await s.obtener();
  assert.equal(s.intentos(), 2);
  assert.equal(s.apps.length, 2);
  assert.equal(s.llamadas.length, 1);
  assert.notEqual(functions.app, s.principal);
});
