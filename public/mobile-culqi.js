/* Isolated Culqi tokenizer: no Firebase Auth, secrets, order writes or analytics.
 * Only opaque token/device/3DS parameters cross the native bridge. */
(() => {
  'use strict';
  let configured = false; let checkout; let token; let deviceId; let awaiting = false; let bankSent = false; let parentOrigin = '';
  const message = document.getElementById('message'); const button = document.getElementById('pay');
  const send = (data) => {
    const json = JSON.stringify(data);
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(json);
    else if (window.parent !== window && parentOrigin) window.parent.postMessage(json, parentOrigin);
  };
  const load = (url) => new Promise((resolve, reject) => {
    const script = document.createElement('script'); script.src = url;
    script.onload = resolve; script.onerror = reject; document.head.appendChild(script);
  });
  window.WalaCulqi = {
    async init(value) {
      if (configured || !value || !/^pk_(test|live)_[A-Za-z0-9]+$/.test(value.publicKey || '')
        || !Number.isInteger(value.amount) || value.amount < 300 || value.amount > 999900 || typeof value.email !== 'string' || value.email.length > 254) return;
      configured = true; document.documentElement.dataset.mode = value.mode === 'dark' ? 'dark' : 'light';
      document.getElementById('amount').textContent = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(value.amount / 100);
      try {
        await Promise.all([load('https://js.culqi.com/checkout-js'), load('https://3ds.culqi.com')]);
        window.Culqi3DS.publicKey = value.publicKey;
        checkout = new window.CulqiCheckout(value.publicKey, {
          settings: { title: 'Compra en Walá', currency: 'PEN', amount: value.amount }, client: { email: value.email },
          options: { lang: 'es', installments: false, modal: true,
            // Same PEN methods/menu as the web checkout; destination is not the payer's wallet.
            paymentMethods: { tarjeta: true, yape: true, billetera: false, bancaMovil: false, agente: false, cuotealo: false },
            paymentMethodsSort: ['tarjeta', 'yape'] },
          appearance: { theme: value.mode === 'dark' ? 'dark' : 'default', hiddenCulqiLogo: false, menuType: 'sidebar' },
        });
        checkout.culqi = async () => {
          if (awaiting) return;
          if (!checkout.token) { message.textContent = 'Culqi no pudo completar el medio de pago. Puedes volver a intentarlo.'; return; }
          token = { id: checkout.token.id, email: checkout.token.email || value.email };
          if (!/^(?:tkn|ype)_(?:test|live)_[A-Za-z0-9]+$/.test(token.id || '')) return;
          checkout.close(); awaiting = true; bankSent = false; button.disabled = true;
          message.textContent = 'Comprobando tu pago con Walá…';
          window.Culqi3DS.settings = { charge: { totalAmount: value.amount, currency: 'PEN', returnUrl: `${location.origin}${location.pathname}` }, card: { email: token.email } };
          send({ type: 'culqi-token', tokenId: token.id, email: token.email, deviceId });
        };
        deviceId = await window.Culqi3DS.generateDevice();
        if (!/^[A-Za-z0-9_-]{8,200}$/.test(deviceId || '')) throw new Error('device');
        message.textContent = 'El importe se cobrará en soles (PEN).'; button.disabled = false;
      } catch { message.textContent = 'No pudimos abrir Culqi. Vuelve a Walá y consulta el estado del pago.'; }
    },
    result(value) {
      if (!awaiting || !token) return;
      if (value?.requires3DS === true) {
        message.textContent = 'Completa la verificación que solicita tu banco.';
        window.Culqi3DS.initAuthentication(token.id);
      } else {
        message.textContent = value?.success === true ? 'Culqi recibió el pago. Confirma el estado del pedido en Walá.' : 'Vuelve a Walá para comprobar el estado antes de reintentar.';
      }
    },
  };
  button.addEventListener('click', () => { if (checkout && !awaiting) checkout.open(); });
  window.addEventListener('message', (event) => {
    // Native-web development embeds only from the explicitly allowed first party.
    if (event.source === window.parent && ['https://wala.pe', 'https://sistema-gestion-3b225.web.app', location.origin].includes(event.origin) && typeof event.data === 'string') {
      parentOrigin = event.origin;
      try { const value = JSON.parse(event.data); if (value.type === 'culqi-config') window.WalaCulqi.init(value.config); if (value.type === 'culqi-result') window.WalaCulqi.result(value.result); } catch { /* ignore foreign messages */ }
    }
    if (event.origin !== location.origin || !awaiting || !token || bankSent || !event.data?.parameters3DS) return;
    const data = event.data.parameters3DS; const authentication3DS = {};
    for (const key of ['eci', 'xid', 'cavv', 'protocolVersion', 'directoryServerTransactionId']) {
      if (key === 'directoryServerTransactionId' && data[key] == null) continue;
      if (typeof data[key] !== 'string' || !data[key] || data[key].length > 2048) return;
      authentication3DS[key] = data[key];
    }
    bankSent = true; message.textContent = 'Confirmando el resultado con Walá…';
    send({ type: 'culqi-token', tokenId: token.id, email: token.email, deviceId, authentication3DS });
  });
})();
