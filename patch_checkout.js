const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src', 'pages', 'CheckoutPage.jsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Imports
content = content.replace(
`import { markItemAsGifted } from '../services/wishlist';
import Button from '../components/common/Button';
import styles from './CheckoutPage.module.css';`,
`import { markItemAsGifted } from '../services/wishlist';
import Button from '../components/common/Button';
import CulqiCustomCheckout from '../components/CulqiCustomCheckout/CulqiCustomCheckout';
import PaypalCheckout from '../components/PaypalCheckout/PaypalCheckout';
import styles from './CheckoutPage.module.css';`
);

// 2. State
content = content.replace(
`  const [processing, setProcessing] = useState(false);
  const [useCoinsToggle, setUseCoinsToggle] = useState(false);
  
  const subtotal = getTotalPrice();`,
`  const [processing, setProcessing] = useState(false);
  const [useCoinsToggle, setUseCoinsToggle] = useState(false);
  const [paymentStepData, setPaymentStepData] = useState(null);
  
  const subtotal = getTotalPrice();`
);

// 3. onSubmit
content = content.replace(
`        // ── 7. Abrir WhatsApp ─────────────────────────────────────────────
        toast.success('¡Redirigiendo a WhatsApp para finalizar tu pedido!');
        window.open(waLink, '_blank');
        navigate('/carrito');`,
`        // ── 7. Pasar a Opciones de Pago ─────────────────────────────────────────────
        toast.success('¡Pedido generado! Por favor, selecciona tu método de pago.');
        setPaymentStepData({
          id: webOrderId || pseudoOrderId,
          montoDeuda: total,
          waLink: waLink
        });`
);

// 4. Render start
content = content.replace(
`      <div className={styles.layout}>
        <div className={styles.formContainer}>
          <form onSubmit={formik.handleSubmit} className={styles.form}>
            <h2>Detalles de Envío</h2>`,
`      <div className={styles.layout}>
        <div className={styles.formContainer}>
          {paymentStepData ? (
            <div style={{ background: '#fff', padding: '2rem', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', border: '1px solid #e2e8f0' }}>
              <h2 style={{ marginBottom: '1rem', textAlign: 'center', color: '#1e293b' }}>Selecciona tu método de pago</h2>
              <p style={{ textAlign: 'center', marginBottom: '2rem', color: '#64748b' }}>
                Tu pedido se ha generado correctamente. Para confirmarlo, realiza el pago.
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <CulqiCustomCheckout 
                  pedido={paymentStepData}
                  onSuccess={() => {
                    clearCart();
                    navigate('/cuenta/pedidos');
                  }}
                />
                
                <PaypalCheckout 
                  pedido={paymentStepData}
                  onSuccess={() => {
                    clearCart();
                    navigate('/cuenta/pedidos');
                  }}
                />
                
                <div style={{ textAlign: 'center', margin: '1rem 0', color: '#94a3b8', fontSize: '0.9rem', fontWeight: 600 }}>O</div>
                
                <Button 
                  onClick={() => {
                    window.open(paymentStepData.waLink, '_blank');
                    clearCart();
                    navigate('/cuenta/pedidos');
                  }}
                  variant="outline"
                  fullWidth
                >
                  Acordar pago por WhatsApp (Yape / Plin / Transf)
                </Button>
              </div>
            </div>
          ) : (
          <form onSubmit={formik.handleSubmit} className={styles.form}>
            <h2>Detalles de Envío</h2>`
);

// 5. Render end
content = content.replace(
`              <Button type="submit" variant="primary" disabled={processing} fullWidth>
                {processing ? 'Generando...' : 'Confirmar y Enviar por WhatsApp'}
              </Button>
            </div>
          </form>
        </div>

        <div className={styles.summary}>`,
`              <Button type="submit" variant="primary" disabled={processing} fullWidth>
                {processing ? 'Generando...' : 'Confirmar y Seleccionar Pago'}
              </Button>
            </div>
          </form>
          )}
        </div>

        <div className={styles.summary}>`
);

fs.writeFileSync(file, content);
console.log('Patch applied successfully.');
