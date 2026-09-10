/**
 * Funciones puras matemáticas para el módulo de Finanzas y Logística
 * @module FinanceUtils
 */

import type { StatusCierre, CartItem } from '../types/operacion';

/**
 * ¿Esta venta de posSales proviene de un vendedor móvil (pedido a domicilio)?
 *
 * Las ventas del vendedor se cuadran por INVENTARIO (carga + surtido − sobrante),
 * NO por transacción. El registro en posSales existe solo como historial de la
 * entrega; sumarlo a los totales de "Ventas POS" lo contaría dos veces contra el
 * cuadre por inventario. Los sumatorios financieros deben excluirlo.
 */
export function isVendorOriginSale(sale: any): boolean {
  if (!sale) return false;
  const t = String(sale.type || '').toUpperCase();
  if (t === 'PEDIDO_CLIENTE') return true;
  if (String(sale.orderType || '').toUpperCase() === 'CLIENT_DELIVERY') return true;
  if (typeof sale.id === 'string' && sale.id.startsWith('SALE-DELIVERY-')) return true;
  return false;
}

/**
 * calculateClosingStatus
 * Suma el dinero real (cash + transfer + expenses), lo resta a la venta teórica y retorna
 * la diferencia y el estado, con tolerancia estricta de $0 de error.
 * Ambos retornos (diferencia, ventas) se manejan en enteros (COP).
 * 
 * @param theory 
 * @param cash 
 * @param transfer 
 * @param expenses 
 * @returns { difference: number, status: 'ok' | 'missing' | 'surplus' }
 */
export function calculateClosingStatus(
  theory: number,
  cash: number,
  transfer: number,
  expenses: number
): { difference: number; status: StatusCierre } {
  // Suma lógica real
  const realMoney = cash + transfer + expenses;
  // Diferencia
  const difference = realMoney - theory;

  let status: StatusCierre = 'ok';
  
  if (difference < 0) {
    status = 'missing';
  } else if (difference > 0) {
    status = 'surplus';
  }

  return { difference, status };
}

/**
 * calculateCartTotal
 * Retorna la suma del monto de una venta actual, garantizando enteros COP.
 * 
 * @param cartItems - Elementos del carrito
 * @returns {number}
 */
export function calculateCartTotal(cartItems: CartItem[]): number {
  return cartItems.reduce((acc, item) => {
    return acc + (item.price * item.qty);
  }, 0);
}
