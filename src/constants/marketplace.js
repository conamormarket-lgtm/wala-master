// Base multi-vendor / multi-nicho (Fase 1).
// Cambios ADITIVOS: los productos existentes sin vendorId/nicheId se leen como del
// vendedor "casa" y el nicho base, sin necesidad de migrar datos para que la tienda
// siga funcionando. El backfill (scripts/backfill-vendor-niche.js) persiste estos
// defaults cuando haya acceso a Firebase.

export const DEFAULT_VENDOR_ID = 'casa';
export const DEFAULT_NICHE_ID = 'regala-con-amor';

// Tipo de cumplimiento del producto.
export const FULFILLMENT_TYPES = {
  PRINT_ON_DEMAND: 'print_on_demand', // personalizado (editor fabric.js)
  STOCK: 'stock',                     // marketplace general con inventario
  MADE_TO_ORDER: 'made_to_order',     // bajo pedido / artesanal
  DROPSHIP: 'dropship',               // proveedor externo
};

export const FULFILLMENT_TYPE_VALUES = Object.values(FULFILLMENT_TYPES);

// Heurística por defecto: si el producto es personalizable -> POD; si no -> stock.
export function defaultFulfillmentType(isCustomizable) {
  return isCustomizable ? FULFILLMENT_TYPES.PRINT_ON_DEMAND : FULFILLMENT_TYPES.STOCK;
}

export function normalizeFulfillmentType(value, isCustomizable) {
  return FULFILLMENT_TYPE_VALUES.includes(value) ? value : defaultFulfillmentType(isCustomizable);
}
