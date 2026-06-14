// lib/api.ts — Cliente API v4.0 (Sheet nuevo, lotes de stock)
import { Pedido, Usuario, Estado, Producto } from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
if (!API_URL) {
  console.warn('⚠️ NEXT_PUBLIC_API_URL no está configurada');
}

export class ApiError extends Error {
  code: number;
  constructor(message: string, code: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

async function apiCall<T>(params: Record<string, string>): Promise<T> {
  const url = new URL(API_URL);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { method: 'GET', cache: 'no-store' });
  if (!res.ok) throw new ApiError(`HTTP ${res.status}`, res.status);
  const json = await res.json();
  if (!json.ok) throw new ApiError(json.error || 'Error desconocido', json.code || 0);
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

export type Cliente = {
  CLIENTE_ID: string;
  NOMBRE: string;
  TELEFONO: string;
  DIRECCION: string;
  CIUDAD: string;
  CEDULA_RUC: string;
  INDUSTRIA: string;
  EMAIL: string;
};

export type SetCatalogo = {
  SET_NOMBRE: string;
  SKU_TOP: string;
  SKU_PANTALON: string;
  PRECIO_SET: number;
};

export type SetEmpaque = {
  SET_ID: string;
  NOMBRE_SET: string;
  materiales: { id: string; nombre: string; costo: number }[];
  costoTotal: number;
};

export type Regalo = {
  REGALO_ID: string;
  NOMBRE: string;
  INDUSTRIA_SUGERIDA: string;
  STOCK: number;
  STOCK_MINIMO: number;
  COSTO_UNITARIO: number;
};

export type NuevoPedidoItem = {
  sku: string;
  talla: string;
  longitud: string;
  color: string;
  cantidad: number;
  precioVenta: number;
  parteDeSet: string;
  origen?: 'STOCK' | 'PEDIDO';
  loteId?: string;
};

export type CrearPedidoParams = {
  cliente: {
    esNuevo: boolean;
    clienteId?: string;
    nombre?: string;
    telefono?: string;
    direccion?: string;
    ciudad?: string;
    cedulaRuc?: string;
    industria?: string;
    email?: string;
  };
  items: NuevoPedidoItem[];
  descuento: { monto: number; nota: string };
  estado: string;
  notas: string;
  fecha: string;
};

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
  numItems: number;
};

export type LotePendienteCourier = {
  LOTE_ID: string;
  SKU: string;
  TALLA: string;
  LONGITUD: string;
  COLOR: string;
  CANT_INICIAL: number;
  COSTO_UNITARIO: number;
};

export type CargarCourierParams = {
  pedidos?: { ordenId: string; numItems: number }[];
  lotes: { loteId: string; cantInicial: number }[];
  items?: { ordenId: string; itemRowNum: number; cantidad: number }[];
  costoCourier: number;
  fecha: string;
};

export type ItemFacturaPayload = {
  tipoReferencia: 'PEDIDO' | 'STOCK';
  ordenId?: string;
  itemRowNum?: number;
  cantidad?: number;
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
  stockYaLlego?: boolean;
  tracking?: string;
  transporte?: string;
};

export type ItemConStock = {
  _rowNum: number;
  SKU: string;
  NOMBRE_PRODUCTO: string;
  TALLA: string;
  LONGITUD: string;
  COLOR: string;
  CANTIDAD: number;
  stockTotal: number;
  hayStock: boolean;
  loteSugerido: {
    LOTE_ID: string;
    COSTO_UNITARIO: number;
    tieneCourier: boolean;
  } | null;
};

export type PedidoConStock = {
  ORDEN_ID: string;
  CLIENTE_NOMBRE: string;
  ESTATUS_ENVIO: string;
  items: ItemConStock[];
};

export type AsignacionStock = {
  ordenId: string;
  itemRowNum: number;
  sku: string;
  talla: string;
  longitud: string;
  color: string;
  cantidad: number;
};

export type LoteStock = {
  LOTE_ID: string;
  SKU: string;
  NOMBRE_PRODUCTO: string;
  TIPO_PRENDA: string;
  TALLA: string;
  LONGITUD: string;
  COLOR: string;
  CANT_DISPONIBLE: number;
  FECHA_ENTRADA: string;
  COSTO_UNITARIO: number;
  tieneCourier: boolean;
};

export type LoteEnCamino = {
  LOTE_ID: string;
  SKU: string;
  NOMBRE_PRODUCTO: string;
  TIPO_PRENDA: string;
  TALLA: string;
  LONGITUD: string;
  COLOR: string;
  CANT_DISPONIBLE: number;
  COSTO_UNITARIO: number;
  ESTADO_VIAJE: string;
  TRACKING: string;
  TRANSPORTE: string;
  COURIER: string;
  FECHA_SALIDA_EC: string;
  eta: { fechaMin: string; fechaMax: string } | null;
};

export type Courier = {
  COURIER: string;
  TIPO_ESTIMADO: string;
  DIAS_MIN: number;
  DIAS_MAX: number;
  DIA_SALIDA: string;
  DIA_ENTREGA: string;
  ACTIVA: string | boolean;
  DIA_CORTE: string;
};

export type ItemCourier = {
  _rowNum: number;
  SKU: string;
  NOMBRE_PRODUCTO: string;
  TALLA: string;
  LONGITUD: string;
  COLOR: string;
  CANTIDAD: number;
  ESTATUS_ITEM: string;
};

export type PedidoItemsCourier = {
  ORDEN_ID: string;
  CLIENTE_NOMBRE: string;
  ESTATUS_ENVIO: string;
  F_ORDEN: string;
  items: ItemCourier[];
};

export type ComboPieza = {
  LOTE_ID: string;
  NOMBRE_PRODUCTO: string;
  TIPO_PRENDA: string;
  TALLA: string;
  LONGITUD: string;
  COLOR: string;
  enCamino: boolean;
  ESTADO_VIAJE: string;
  eta: { fechaMin: string; fechaMax: string } | null;
};

export type Combo = {
  COMBO_ID: string;
  FECHA: string;
  USUARIO: string;
  enCamino: boolean;
  eta: { fechaMin: string; fechaMax: string } | null;
  superior: ComboPieza;
  inferior: ComboPieza;
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
  async getRegalos(): Promise<Regalo[]> {
    return apiCall<Regalo[]>({ action: 'getRegalos' });
  },
  async login(usuario: string, password: string): Promise<Usuario> {
    return apiCall<Usuario>({ action: 'login', usuario, password });
  },
  async cambiarEstado(ordenId: string, nuevoEstado: Estado, usuario: string, forzar = false, tipoEmpaque = '') {
    const params: Record<string, string> = { action: 'cambiarEstado', ordenId, nuevoEstado, usuario };
    if (forzar) params.forzar = 'true';
    if (tipoEmpaque) params.tipoEmpaque = tipoEmpaque;
    return apiCall(params);
  },
  async cambiarEstadoItems(
    ordenId: string,
    itemRows: number[],
    nuevoEstado: string,
    usuario: string,
    opts: { forzar?: boolean; tipoEmpaque?: string; cantidadCajas?: number; costoDelivery?: number; pines?: { regaloid: string; cantidad: number }[] } = {}
  ) {
    const params: Record<string, string> = {
      action: 'cambiarEstadoItems',
      ordenId,
      itemRows: JSON.stringify(itemRows),
      nuevoEstado,
      usuario,
    };
    if (opts.forzar) params.forzar = 'true';
    if (opts.tipoEmpaque) params.tipoEmpaque = opts.tipoEmpaque;
    if (opts.cantidadCajas && opts.cantidadCajas > 1) params.cantidadCajas = String(opts.cantidadCajas);
    if (opts.costoDelivery && opts.costoDelivery > 0) params.costoDelivery = String(opts.costoDelivery);
    if (opts.pines && opts.pines.length > 0) params.pines = JSON.stringify(opts.pines);
    return apiCall(params);
  },
  async getSetEmpaque(): Promise<SetEmpaque[]> {
    return apiCall<SetEmpaque[]>({ action: 'getSetEmpaque' });
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
      stockYaLlego: params.stockYaLlego ? 'true' : 'false',
      tracking: params.tracking || '',
      transporte: params.transporte || '',
      usuario,
    });
  },
  async getPedidosPendientesCourier(): Promise<PedidoPendienteCourier[]> {
    return apiCall<PedidoPendienteCourier[]>({ action: 'getPedidosPendientesCourier' });
  },
  async getLotesPendientesCourier(): Promise<LotePendienteCourier[]> {
    return apiCall<LotePendienteCourier[]>({ action: 'getLotesPendientesCourier' });
  },
  async cargarEnvioCourier(params: CargarCourierParams, usuario: string) {
    return apiCall({
      action: 'cargarEnvioCourier',
      pedidos: JSON.stringify(params.pedidos || []),
      lotes: JSON.stringify(params.lotes || []),
      items: JSON.stringify(params.items || []),
      costoCourier: String(params.costoCourier),
      fecha: params.fecha,
      usuario,
    });
  },
  async getItemsPendientesCourier(): Promise<PedidoItemsCourier[]> {
    return apiCall<PedidoItemsCourier[]>({ action: 'getItemsPendientesCourier' });
  },
  async getStockDisponiblePorItem(): Promise<PedidoConStock[]> {
    return apiCall<PedidoConStock[]>({ action: 'getStockDisponiblePorItem' });
  },
  async asignarStock(asignaciones: AsignacionStock[], fecha: string, usuario: string) {
    return apiCall({
      action: 'asignarStock',
      asignaciones: JSON.stringify(asignaciones),
      fecha,
      usuario,
    });
  },
  async getStockDisponible(): Promise<LoteStock[]> {
    return apiCall<LoteStock[]>({ action: 'getStockDisponible' });
  },
  async getLotesEnCamino(): Promise<LoteEnCamino[]> {
    return apiCall<LoteEnCamino[]>({ action: 'getLotesEnCamino' });
  },
  async getCouriers(): Promise<Courier[]> {
    return apiCall<Courier[]>({ action: 'getCouriers' });
  },
  async avanzarLote(
    params: { loteId: string; accion: 'LLEGO_FL' | 'DESPACHAR_EC' | 'LLEGO_EC'; courier?: string; fechaSalida?: string },
    usuario: string
  ) {
    return apiCall<{ loteId: string; estadoAnterior: string; nuevoEstado: string; eta: { fechaMin: string; fechaMax: string } | null }>({
      action: 'avanzarLote',
      loteId: params.loteId,
      accion: params.accion,
      courier: params.courier || '',
      fechaSalida: params.fechaSalida || '',
      usuario,
    });
  },
  async getCombos(): Promise<Combo[]> {
    return apiCall<Combo[]>({ action: 'getCombos' });
  },
  async crearCombo(loteSuperior: string, loteInferior: string, usuario: string) {
    return apiCall<{ comboId: string; loteSuperior: string; loteInferior: string }>({
      action: 'crearCombo',
      loteSuperior,
      loteInferior,
      usuario,
    });
  },
  async borrarCombo(comboId: string, usuario: string) {
    return apiCall<{ comboId: string; borrado: boolean }>({
      action: 'borrarCombo',
      comboId,
      usuario,
    });
  },
  async getClientes(): Promise<Cliente[]> {
    return apiCall<Cliente[]>({ action: 'getClientes' });
  },
  async getSets(): Promise<SetCatalogo[]> {
    return apiCall<SetCatalogo[]>({ action: 'getSets' });
  },
  async crearPedido(params: CrearPedidoParams, usuario: string) {
    return apiCall<{ ordenId: string; clienteId: string; clienteNuevo: boolean; itemsCreados: number; descuentoAplicado: number }>({
      action: 'crearPedido',
      cliente: JSON.stringify(params.cliente),
      items: JSON.stringify(params.items),
      descuento: JSON.stringify(params.descuento),
      estado: params.estado,
      notas: params.notas,
      fecha: params.fecha,
      usuario,
    });
  },
  async crearCliente(
    cliente: {
      nombre: string; telefono?: string; direccion?: string; ciudad?: string;
      cedulaRuc?: string; industria?: string; email?: string;
    },
    fecha: string,
    usuario: string
  ): Promise<Cliente> {
    return apiCall<Cliente>({
      action: 'crearCliente',
      cliente: JSON.stringify(cliente),
      fecha,
      usuario,
    });
  },
  async cambiarItemError(
    params: {
      ordenId: string; itemRowX: number;
      skuStock: string; tallaStock: string; longitudStock: string; colorStock: string; costoStock?: number;
      skuY?: string; tallaY?: string; longitudY?: string; colorY?: string; quitarCosto?: boolean;
    },
    usuario: string
  ) {
    return apiCall<{ ordenId: string; loteStock: any; cancelado: any; rePedido: any; costoQuitado: number }>({
      action: 'cambiarItemError',
      ordenId: params.ordenId,
      itemRowX: String(params.itemRowX),
      skuStock: params.skuStock,
      tallaStock: params.tallaStock,
      longitudStock: params.longitudStock || 'Regular',
      colorStock: params.colorStock,
      costoStock: params.costoStock !== undefined ? String(params.costoStock) : '',
      skuY: params.skuY || '',
      tallaY: params.tallaY || '',
      longitudY: params.longitudY || '',
      colorY: params.colorY || '',
      quitarCosto: params.quitarCosto === false ? 'false' : 'true',
      usuario,
    });
  },
  async getGananciaPorTipo() {
    return apiCall<{
      stock: { ventas: number; venta: number; costo: number; ganancia: number };
      pedido: { ventas: number; venta: number; costo: number; ganancia: number };
    }>({ action: 'getGananciaPorTipo' });
  },
};
