const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src', 'pages', 'CheckoutPage.jsx');
let content = fs.readFileSync(file, 'utf8');
let lines = content.split(/\r?\n/);

// We know the exact line numbers because we checked them:
// Lines 11-14:
// 11: import { createWebOrder } from '../services/erp/firebase';
// 12: import { markItemAsGifted } from '../services/wishlist';
// 13: import Button from '../components/common/Button';
// 14: import styles from './CheckoutPage.module.css';
lines.splice(10, 4, 
  "import { createWebOrder } from '../services/erp/firebase';",
  "import { markItemAsGifted } from '../services/wishlist';",
  "import Button from '../components/common/Button';",
  "import CulqiCustomCheckout from '../components/CulqiCustomCheckout/CulqiCustomCheckout';",
  "import PaypalCheckout from '../components/PaypalCheckout/PaypalCheckout';",
  "import styles from './CheckoutPage.module.css';"
);

// Lines 67-69 (now shifted by +2 because we added 2 lines of imports -> 69-71)
// 69:   const [processing, setProcessing] = useState(false);
// 70:   const [useCoinsToggle, setUseCoinsToggle] = useState(false);
// 71:   
lines.splice(68, 2,
  "  const [processing, setProcessing] = useState(false);",
  "  const [useCoinsToggle, setUseCoinsToggle] = useState(false);",
  "  const [paymentStepData, setPaymentStepData] = useState(null);"
);

// Lines 618-621 (shifted by +3 -> 621-624)
// 621:         // ── 7. Abrir WhatsApp ─────────────────────────────────────────────
// 622:         toast.success('¡Redirigiendo a WhatsApp para finalizar tu pedido!');
// 623:         window.open(waLink, '_blank');
// 624:         navigate('/carrito');
lines.splice(620, 4,
  "        // ── 7. Pasar a Opciones de Pago ─────────────────────────────────────────────",
  "        toast.success('¡Pedido generado! Por favor, selecciona tu método de pago.');",
  "        setPaymentStepData({",
  "          id: webOrderId || pseudoOrderId,",
  "          montoDeuda: total,",
  "          waLink: waLink",
  "        });"
);

// Lines 645-647 (shifted by +6 -> 651-653)
// 651:         <div className={styles.formContainer}>
// 652:           <form onSubmit={formik.handleSubmit} className={styles.form}>
// 653:             <h2>Detalles de Envío</h2>
lines.splice(650, 3,
  "        <div className={styles.formContainer}>",
  "          {paymentStepData ? (",
  "            <div style={{ background: '#fff', padding: '2rem', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', border: '1px solid #e2e8f0' }}>",
  "              <h2 style={{ marginBottom: '1rem', textAlign: 'center', color: '#1e293b' }}>Selecciona tu método de pago</h2>",
  "              <p style={{ textAlign: 'center', marginBottom: '2rem', color: '#64748b' }}>",
  "                Tu pedido se ha generado correctamente. Para confirmarlo, realiza el pago.",
  "              </p>",
  "              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>",
  "                <CulqiCustomCheckout ",
  "                  pedido={paymentStepData}",
  "                  onSuccess={() => {",
  "                    clearCart();",
  "                    navigate('/cuenta/pedidos');",
  "                  }}",
  "                />",
  "                <PaypalCheckout ",
  "                  pedido={paymentStepData}",
  "                  onSuccess={() => {",
  "                    clearCart();",
  "                    navigate('/cuenta/pedidos');",
  "                  }}",
  "                />",
  "                <div style={{ textAlign: 'center', margin: '1rem 0', color: '#94a3b8', fontSize: '0.9rem', fontWeight: 600 }}>O</div>",
  "                <Button ",
  "                  onClick={() => {",
  "                    window.open(paymentStepData.waLink, '_blank');",
  "                    clearCart();",
  "                    navigate('/cuenta/pedidos');",
  "                  }}",
  "                  variant=\"outline\"",
  "                  fullWidth",
  "                >",
  "                  Acordar pago por WhatsApp (Yape / Plin / Transf)",
  "                </Button>",
  "              </div>",
  "            </div>",
  "          ) : (",
  "          <form onSubmit={formik.handleSubmit} className={styles.form}>",
  "            <h2>Detalles de Envío</h2>"
);

// Lines 833-837 (now shifted by +35 -> 868-872)
// 868:               <Button type="submit" variant="primary" disabled={processing} fullWidth>
// 869:                 {processing ? 'Generando...' : 'Confirmar y Enviar por WhatsApp'}
// 870:               </Button>
// 871:             </div>
// 872:           </form>
lines.splice(867, 5,
  "              <Button type=\"submit\" variant=\"primary\" disabled={processing} fullWidth>",
  "                {processing ? 'Generando...' : 'Confirmar y Seleccionar Pago'}",
  "              </Button>",
  "            </div>",
  "          </form>",
  "          )}"
);

fs.writeFileSync(file, lines.join('\n'));
console.log('Patch by lines applied successfully.');
