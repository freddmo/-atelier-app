// lib/api.ts — Cliente API con facturas FIGS + courier

import { Pedido, Usuario, Estado } from './types';

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
  estatus: string;
};

export type ItemPendiente = {
  ORDEN_ID: string;
  NOMBRE: string;
  ESTATUS_ENVIO: string;
  PRODUCTO: string;
  TIPO_PRENDA: string;
  TALLA: string;
  COLOR: string;
  CANTIDAD: number;
  PRECIO_VENTA: number;
  itemIndex: number;
};

export type PedidoPendienteCourier = {
  ORDEN_ID: string;
  NOMBRE: string;
  ESTATUS_ENVIO: string;
  F_ORDEN: string;
  cantidadItems: number;
  totalVenta: number;
};

export type ItemFactura = {
  ORDEN_ID: string;
  itemIndex: number;
  precioFIGS: number;
};

export type CargarFacturaParams = {
  items: ItemFactura[];
  subtotal: number;
  iva: number;
  descuento: number;
  numFactura: string;
  fecha: string;
};

export type CargarCourierParams = {
  pedidos: { ORDEN_ID: string; totalVenta: number }[];
  costoCourier: number;
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
    return apiCall({
      action: 'cambiarEstado',
      ordenId,
      nuevoEstado,
      usuario,
    });
  },

  async agregarPago(pago: NuevoPago, usuario: string) {
    return apiCall({
      action: 'agregarPago',
      ordenId: pago.ordenId,
      cantidad: String(pago.cantidad),
      fecha: pago.fecha,
      metodo: pago.metodo,
      estatus: pago.estatus,
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

  async getItemsPendientesCostos(): Promise<ItemPendiente[]> {
    return apiCall<ItemPendiente[]>({ action: 'getItemsPendientesCostos' });
  },

  async getPedidosPendientesCourier(): Promise<PedidoPendienteCourier[]> {
    return apiCall<PedidoPendienteCourier[]>({ action: 'getPedidosPendientesCourier' });
  },

  async cargarFacturaFIGS(params: CargarFacturaParams, usuario: string) {
    return apiCall({
      action: 'cargarFacturaFIGS',
      items: JSON.stringify(params.items),
      subtotal: String(params.subtotal),
      iva: String(params.iva),
      descuento: String(params.descuento),
      numFactura: params.numFactura,
      fecha: params.fecha,
      usuario,
    });
  },

  async cargarEnvioCourier(params: CargarCourierParams, usuario: string) {
    return apiCall({
      action: 'cargarEnvioCourier',
      pedidos: JSON.stringify(params.pedidos),
      costoCourier: String(params.costoCourier),
      fecha: params.fecha,
      usuario,
    });
  },
};
