// lib/api.ts — Cliente API v4.0 (Sheet nuevo, lotes de stock)
import { Pedido, Usuario, Estado, Producto } from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
if (!API_URL) {
  console.warn('⚠️ NEXT_PUBLIC_API_URL no está configurada');
}

async function apiCall<T>(params: Record<string, string>): Promise<T> {
  const url = new URL(API_URL);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    method: 'GET',
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Error desconocido');
  return json.data as T;
}

export type NuevoPago = {
  ordenId: string;
  cantidad: number;
  fecha: string;
  metodo: string;
  urlComprobante?: string;
  notas?: string;
};

// Item de pedido pendiente de costo (lo que devuelve getItemsPendientesCostos)
export type ItemPendiente = {
  _rowNum: number;
  SKU: string;
  NOMBRE_PRODUCTO: string;
  TIPO_PRENDA: string;
  TALLA: string;
  LONGITUD: string;
  COLOR: string;
  CANTIDAD: number;
  PRECIO_VENTA: number;
  PARTE_DE_SET: string;
};

// Pedido pendiente de costo (agrupa varios ItemPendiente)
export type PedidoPendienteCostos = {
  ORDEN_ID: string;
  CLIENTE_NOMBRE: string;
  ESTATUS_ENVIO: string;
  F_ORDEN: string;
  items: ItemPendiente[];
  totalItems: number;
};

export type PedidoPendienteCourier = {
  ORDEN_ID: string;
  CLIENTE_NOMBRE: string;
  ESTATUS_ENVIO: string;
  F_ORDEN: string;
  cantidadItems: number;
};

// Un item de la factura al enviarla al backend
export type ItemFacturaPayload = {
  tipoReferencia: 'PEDIDO' | 'STOCK';
  // si PEDIDO:
  ordenId?: string;
  itemRowNum?: number;
  // si STOCK:
  cantidad?: number;
  // ambos:
  sku: string;
  talla: string;
  longitud: string;
  color: string;
  precioFIGS: number;
};

export type CargarFacturaParams = {
  items: ItemFacturaPayload[];
  subtotal: number;
  iva: number;
  shipping: number;
  numFactura: string;
  fecha: string;
};

export const api = {
  async ping() {
    return apiCall<{ message: string }>({ action: 'ping' });
  },
  async getPedidos(): Promise<Pedido[]> {
    return apiCall<Pedido[]>({ action: 'getPedidos' });
  },
  async getPedido(id: string): Promise<Pedido> {
    return apiCall<Pedido>({ action: 'getPedido', id });
  },
  async login(usuario: string, password: string): Promise<Usuario> {
    return apiCall<Usuario>({ action: 'login', usuario, password });
  },
  async cambiarEstado(ordenId: string, nuevoEstado: Estado, usuario: string) {
    return apiCall({ action: 'cambiarEstado', ordenId, nuevoEstado, usuario });
  },
  async agregarPago(pago: NuevoPago, usuario: string) {
    return apiCall({
      action: 'agregarPago',
      ordenId: pago.ordenId,
      cantidad: String(pago.cantidad),
      fecha: pago.fecha,
      metodo: pago.metodo,
      urlComprobante: pago.urlComprobante || '',
      notas: pago.notas || '',
      usuario,
    });
  },
  async borrarPago(ordenId: string, fecha: string, cantidad: number, usuario: string) {
    return apiCall({
      action: 'borrarPago',
      ordenId,
      fecha,
      cantidad: String(cantidad),
      usuario,
    });
  },
  async getProductos(): Promise<Producto[]> {
    return apiCall<Producto[]>({ action: 'getProductos' });
  },
  async getItemsPendientesCostos(): Promise<PedidoPendienteCostos[]> {
    return apiCall<PedidoPendienteCostos[]>({ action: 'getItemsPendientesCostos' });
  },
  async cargarFacturaFIGS(params: CargarFacturaParams, usuario: string) {
    return apiCall({
      action: 'cargarFacturaFIGS',
      items: JSON.stringify(params.items),
      subtotal: String(params.subtotal),
      iva: String(params.iva),
      shipping: String(params.shipping),
      numFactura: params.numFactura,
      fecha: params.fecha,
      usuario,
    });
  },
};
