/**
 * Interfaces y Tipos del Módulo Operativo de Vendedores y Logística
 * @module TypesOperacion
 */

export type StatusCierre = 'ok' | 'missing' | 'surplus';
export type StatusSurtido = 'pending' | 'completed' | 'cancelled';
export type PointType = 'fija' | 'variable' | 'local';
export type PointStatus = 'active' | 'inactive';

export interface SalesPoint {
  id: string; // ej: 'T1', 'L1'
  name: string;
  type: PointType;
  status: PointStatus;
}

export interface Product {
  id: number;
  name: string;
  price: number; // en COP
}

export interface InventorySnapshotItem {
  point_id: string;
  product_id: number;
  quantity: number;
}

export interface CartItem {
  id: number; // productId
  name: string;
  price: number; // COP
  qty: number;
}

export interface RestockItemPayload {
  productId: number;
  qty: number;
  name: string;
}

export interface RestockRequest {
  id: string; // UUID
  requester_point_id: string;
  status: StatusSurtido;
  items_payload: RestockItemPayload[];
  created_at?: string;
}

export interface DailyClosing {
  id: string; // UUID
  point_id: string;
  user_id?: string;
  shift: string; // ej: 'AM'
  responsible_name: string;
  theory_sales: number;
  reported_cash: number;
  reported_transfer: number;
  reported_expenses: number;
  expenses_desc?: string;
  difference: number;
  status: StatusCierre;
  inventory_snapshot: RestockItemPayload[]; // Foto del remanente al cerrar. Misma estructura
  created_at?: string;
}

export interface SellerSessionState {
  isSetupComplete: boolean;
  pointId: string | null;
  shift: string | null;
  pointType: string | null;
  responsibleName: string | null;
}
