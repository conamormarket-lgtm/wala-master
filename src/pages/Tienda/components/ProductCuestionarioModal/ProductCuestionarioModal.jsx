import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../../contexts/AuthContext';
import { useGlobalToast } from '../../../../contexts/ToastContext';
import { getCuestionarioTemplate } from '../../../../services/cuestionarios';
import { createWebOrder } from '../../../../services/erp/firebase';
import { getMessage } from '../../../../services/messages';
import Button from '../../../../components/common/Button';
import styles from './ProductCuestionarioModal.module.css';

function ProductCuestionarioModal({
  isOpen,
  onClose,
  templateId,
  product,
  selectedVariant,
  selectedSize,
  quantity,
  comboVariantSelections
}) {
  const navigate = useNavigate();
  const toast = useGlobalToast();

  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  const [customAnswers, setCustomAnswers] = useState({});

  useEffect(() => {
    if (isOpen && templateId) {
      setLoading(true);
      getCuestionarioTemplate(templateId).then(res => {
        if (res.data) setTemplate(res.data);
        else toast.error('Error al cargar plantilla de cuestionario');
        setLoading(false);
      });
    }
  }, [isOpen, templateId]);

  if (!isOpen) return null;

  const handleCustomAnswerChange = (fieldId, value) => {
    setCustomAnswers(prev => ({ ...prev, [fieldId]: value }));
  };

  // Helper to extract values by fuzzy matching the label
  const findAnswerByKeyword = (keywords) => {
    if (!template) return '';
    for (const field of template.fields) {
      const lowerLabel = field.label.toLowerCase();
      if (keywords.some(kw => lowerLabel.includes(kw))) {
        return customAnswers[field.id] || '';
      }
    }
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (template?.fields) {
      for (const field of template.fields) {
        if (field.required && !customAnswers[field.id]) {
          toast.error(`El campo "${field.label}" es obligatorio`);
          return;
        }
      }
    }

    setProcessing(true);

    try {
      // Configurar WhatsApp number
      const tiendaNumRes = await getMessage('whatsapp_number_tienda');
      const fallbackNumRes = await getMessage('whatsapp_number');
      let waNum = tiendaNumRes.data?.trim() || fallbackNumRes.data?.trim() || '51999999999';
      waNum = waNum.replace(/[\s\-\(\)\+]/g, '');
      if (waNum && !waNum.startsWith('51') && waNum.length <= 9) waNum = `51${waNum}`;

      const pseudoOrderId = `PD-${Date.now().toString(36).toUpperCase()}`;

      // Extract core info for ERP
      const rawName = findAnswerByKeyword(['nombre', 'name', 'cliente', 'apellidos']) || 'Cliente Web';
      const nameParts = rawName.trim().split(/\s+/);
      const clienteNombre = nameParts[0];
      const clienteApellidos = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

      const phone = findAnswerByKeyword(['celular', 'whatsapp', 'teléfono', 'fono', 'telefono']) || '000000000';
      const dni = findAnswerByKeyword(['dni', 'documento', 'identidad', 'carnet']) || '00000000';
      const address = findAnswerByKeyword(['dirección', 'direccion', 'calle', 'avenida', 'envío', 'domicilio']) || 'No especificada';
      const email = findAnswerByKeyword(['correo', 'email']) || '';
      const cityDistrict = findAnswerByKeyword(['ciudad', 'distrito', 'provincia', 'departamento']) || 'No especificado';

      const price = product.salePrice || product.price || 0;
      const subtotal = price * quantity;
      const shipping = subtotal > 100 ? 0 : 15;
      const total = subtotal + shipping;

      let talla = selectedSize || '';
      let color = selectedVariant?.name || '';

      const prendasStr = `${product.name}${color ? '/' + color : ''} ${talla ? '(' + talla + ')' : ''} x${quantity}`.trim();

      const productosMap = {
        item_0: {
          productoId: product.id || '',
          producto: product.name || '',
          cantidad: quantity || 1,
          talla: talla,
          color: color,
          precio: price,
          subtotal: subtotal,
          personalizado: false,
          textoPersonalizado: '',
          urlImagenPersonalizada: ''
        }
      };

      if (product.isComboProduct && comboVariantSelections) {
        productosMap.item_0.observacionesAdicionales = JSON.stringify(comboVariantSelections);
      }

      let notasCustom = 'RESPUESTAS CUESTIONARIO:\n' + template.fields.map(f => {
        return `- ${f.label}: ${customAnswers[f.id] || 'N/A'}`;
      }).join('\n');

      const webOrderPayload = {
        numeroPedido: pseudoOrderId,
        clienteNombre,
        clienteApellidos,
        clienteNombreCompleto: rawName,
        clienteNumeroDocumento: dni,
        clienteTipoDocumento: 'DNI',
        clienteContacto: phone,
        clienteCorreo: email,
        clienteDepartamento: cityDistrict,
        clienteDistrito: cityDistrict,
        clienteProvincia: cityDistrict.toLowerCase().includes('lima') ? 'No' : 'Sí',
        envioNombres: clienteNombre,
        envioApellidos: clienteApellidos,
        envioContacto: phone,
        envioNumeroDocumento: dni,
        envioTipoDocumento: 'DNI',
        envioDireccion: address,
        envioDistrito: cityDistrict,
        envioDepartamento: cityDistrict,
        canalVenta: 'Portal Web',
        web: true,
        activador: 'portal_web',
        vendedor: 'Portal Web',
        montoTotal: total,
        montoAdelanto: 0,
        montoPendiente: total,
        estadoGeneral: 'Nuevo',
        status: 'Nuevo',
        prendas: prendasStr,
        cantidad: quantity,
        productos: productosMap,
        observación: notasCustom,
        portalPseudoOrderId: pseudoOrderId,
      };

      let webOrderId = null;
      try {
        const { id, error: webErr } = await createWebOrder(webOrderPayload);
        if (!webErr) {
          webOrderId = id;
        }
      } catch (err) {
        console.warn('No se pudo guardar en pedidos_web:', err);
      }

      const cartItem = {
        id: `cart_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        productId: product.id,
        productName: product.name,
        price,
        quantity,
        variant: { size: selectedSize, color: selectedVariant?.name },
        mainImage: product.mainImage,
        status: 'pending_confirmation',
        pseudoOrderId,
        ...(webOrderId && { webOrderId })
      };

      const currentCart = JSON.parse(localStorage.getItem('shopping_cart') || '[]');
      currentCart.push(cartItem);
      localStorage.setItem('shopping_cart', JSON.stringify(currentCart));

      let message = `SOLICITUD DE NUEVO PEDIDO (${pseudoOrderId})\n\n`;
      message += `Detalles del Formulario:\n`;
      if (template?.fields?.length > 0) {
        template.fields.forEach(f => {
          message += `${f.label}: ${customAnswers[f.id] || 'N/A'}\n`;
        });
        message += `\n`;
      }

      message += `Detalle de Compra:\n`;
      message += `1. ${product.name}\n`;
      message += `   Cantidad: ${quantity}\n`;
      if (talla) message += `   Talla/Modelo: ${talla}\n`;
      if (color) message += `   Color: ${color}\n`;
      message += `   Subtotal: S/ ${(price * quantity).toFixed(2)}\n`;
      message += `   Link: ${window.location.origin}/producto/${product.id}\n\n`;

      message += `Resumen de Pago:\n`;
      message += `Producto(s): S/ ${subtotal.toFixed(2)}\n`;
      message += `Envío: ${shipping === 0 ? 'Gratis' : `S/ ${shipping.toFixed(2)}`}\n`;
      message += `TOTAL A PAGAR: S/ ${total.toFixed(2)}\n`;

      message += `Solicitud de Pedido\nHola! Vengo de la tienda virtual y quiero confirmar mi pedido con código ${pseudoOrderId}.`;

      const waLink = `https://wa.me/${waNum}?text=${encodeURIComponent(message)}`;

      toast.success('¡Redirigiendo a WhatsApp para finalizar tu pedido!');
      window.open(waLink, '_blank');

      onClose();
      navigate('/carrito');

    } catch (err) {
      console.error(err);
      toast.error('Hubo un error al procesar tu pedido');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h3 className={styles.title}>Completa tu pedido</h3>
          <button type="button" className={styles.closeBtn} onClick={onClose}>&times;</button>
        </div>

        {loading ? (
          <div className={styles.loading}>Cargando cuestionario...</div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.formContainer}>
            {template && template.fields && template.fields.length > 0 ? (
              <div className={styles.section}>
                {template.fields.map(field => (
                  <div key={field.id} className={styles.field}>
                    <label>{field.label} {field.required && '*'}</label>
                    {field.type === 'textarea' ? (
                      <textarea
                        required={field.required}
                        value={customAnswers[field.id] || ''}
                        onChange={(e) => handleCustomAnswerChange(field.id, e.target.value)}
                        rows={3}
                      />
                    ) : (
                      <input
                        type={field.type === 'number' ? 'number' : 'text'}
                        required={field.required}
                        value={customAnswers[field.id] || ''}
                        onChange={(e) => handleCustomAnswerChange(field.id, e.target.value)}
                      />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.section}>
                <p>No se encontraron campos para este cuestionario.</p>
              </div>
            )}

            <div className={styles.footer}>
              <Button type="button" variant="outline" onClick={onClose} disabled={processing}>Cancelar</Button>
              <Button type="submit" variant="primary" disabled={processing}>
                {processing ? 'Procesando...' : 'Confirmar y Pagar en WhatsApp'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default ProductCuestionarioModal;
