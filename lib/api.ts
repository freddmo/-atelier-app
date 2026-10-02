// lib/api.ts — Cliente API v4.0 (Sheet nuevo, lotes de stock)
import { Pedido, Usuario, Estado, Producto } from './types';

// ── URL del backend (Apps Script) ─────────────────────────────────────────
// En vez de "hornear" la URL en el build de Vercel (lo que obliga a hacer
// Redeploy cada vez que cambia), la leemos en el navegador desde un archivito
// en GitHub. Así, si algún día cambia el deployment de Apps Script, basta con
// editar ese archivo en github.com — sin tocar Vercel para nada.
//
// ⚠️ AJUSTA esta URL una sola vez con tu usuario/repo/rama reales:
const CONFIG_URL = 'https://raw.githubusercontent.com/freddmo/-atelier-app/main/api-config.json';

// Respaldo por si GitHub no responde (o en desarrollo local) — la variable
// de entorno de siempre, se sigue usando como plan B.
const FALLBACK_URL = process.env.NEXT_PUBLIC_API_URL || '';

let cachedApiUrl: string | null = null;
let resolvingApiUrl: Promise<string> | null = null;

async function getApiUrl(): Promise<string> {
  if (cachedApiUrl) return cachedApiUrl;
  if (resolvingApiUrl) return resolvingApiUrl;

  resolvingApiUrl = (async (): Promise<string> => {
    try {
      const res = await fetch(CONFIG_URL, { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json && typeof json.apiUrl === 'string' && json.apiUrl.trim()) {
          const url = json.apiUrl.trim();
          cachedApiUrl = url;
          return url;
        }
      }
    } catch (e) {
      console.warn('No se pudo leer api-config.json de GitHub, uso la URL de respaldo.', e);
    }
    cachedApiUrl = FALLBACK_URL;
    return FALLBACK_URL;
  })();

  return resolvingApiUrl;
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
  const apiUrl = await getApiUrl();
  if (!apiUrl) throw new ApiError('No hay URL de API configurada (ni en GitHub ni en Vercel)', 0);
  const url = new URL(apiUrl);
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
  cuenta?: string; // CUENTA_ID a la que llegó (o de la que salió) la plata
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
  cuentaPago?: string;
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
  cuentaPago?: string;
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
  enCamino?: boolean;                          // ← NUEVO
  ESTADO_VIAJE?: string;                       // ← NUEVO
  eta?: { fechaMin: string; fechaMax: string } | null;  // ← NUEVO
  COLOR_HEX?: string;                          // ← NUEVO: hex del color, o '' si no está definido
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
  COLOR_HEX?: string;                          // ← NUEVO: hex del color, o '' si no está definido
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
  COLOR_HEX?: string;              // ← NUEVO
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

// ============ FINANZAS v2 ============
export type TipoCuenta = 'BANCO' | 'EFECTIVO' | 'TARJETA' | 'TARJETA_PERSONAL' | 'DEUDA_SOCIO';
export type Cuenta = {
  id: string; nombre: string; tipo: TipoCuenta; uso: string; titular: string;
  limite: number; saldoInicial: number; fechaInicial: string;
};
export type CuentaConSaldo = Cuenta & { saldo: number; usado: number };
export type FinanzasCuentas = {
  inicio: string;
  cuentas: CuentaConSaldo[];
  capital: { bancos: number; stock: number; materiales: number; pedidosEnCurso: number;
    porCobrar: number; deudaSocios: number; tarjetas: number; total: number };
};
export type Movimiento = {
  id: string; fecha: string; tipo: string; categoria: string; grupo: string;
  origen: string; destino: string; origenNombre: string; destinoNombre: string;
  monto: number; ordenId: string; aCargoDe: string; nota: string; auto: boolean;
};
export type PedidoCorte = {
  ordenId: string; cliente: string; fecha: string; estado: string; metodoEnvio: string; transicion: boolean;
  venta: number; ventaEncargo: number; ventaStock: number; prendaReal: boolean; estimados: string[];
  costos: { prenda: number; courier: number; empaque: number; envio: number };
  gananciaReparto: number; gananciaStock: number;
};
export type CorteTotales = {
  cantPedidos: number; gananciaPedidos: number; sueldos: number; donacion: number; neto: number; porSocio: number;
  gananciaStock: number; entradasNegocio: number; gastosNegocio: number; resultadoNegocio: number;
};
export type Corte = {
  desde: string; hasta: string; sistema: 'nuevo' | 'anterior'; estado: 'ABIERTO' | 'CERRADO' | 'ANTERIOR';
  esPrimerCorte?: boolean; fechaCierre?: string; cerradoPor?: string;
  promedios?: { courierPorPieza: number; courierBase: number; empaquePorPedido: number; empaqueBase: number;
    envio: Record<string, number>; envioBase: Record<string, number> };
  avisos: { ordenId: string; cliente: string; fecha: string; prendas: string[] }[];
  pedidos: PedidoCorte[];
  gastosNegocioDetalle: { categoria: string; monto: number }[];
  gastosSocio: Record<string, number>;
  totales?: CorteTotales;
  anterior?: { repartible: { gananciaPedidosPagados: number; gastosFijos: number; donacion: number; neto: number;
    porSocio: number; cubiertoPorFreddy: number; porFreddyFinal: number; cantidadPedidos: number } } | null;
};
export type NuevoMovimiento = {
  tipo: 'GASTO_NEGOCIO' | 'SUELDO' | 'GASTO_SOCIO' | 'GASTO_PERSONAL' | 'TRANSFERENCIA' | 'PAGO_TARJETA' | 'PAGO_REPARTO';
  fecha: string; monto: number; comision?: number; categoria?: string;
  origen?: string; destino?: string; aCargoDe?: string; nota?: string;
};

export const api = {
  async ping() {
    return apiCall<{ message: string }>({ action: 'ping' });
  },
  async getPedidos(): Promise<Pedido[]> {
    return apiCall<Pedido[]>({ action: 'getPedidos' });
  },
  async getPedido(id: string): Promise<Pedido> {
    // El backend envuelve el pedido en un arreglo de 1 elemento (evita un
    // capricho de Google Apps Script que falla al entregar un objeto suelto
    // como "data" — confirmado con pruebas). Aquí lo desenvolvemos.
    const result = await apiCall<Pedido[]>({ action: 'getPedido', id });
    if (!result || result.length === 0) throw new ApiError('Pedido no encontrado', 404);
    return result[0];
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
    opts: { forzar?: boolean; tipoEmpaque?: string; cantidadCajas?: number; costoDelivery?: number; pinCantidad?: number; pinNota?: string } = {}
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
    if (opts.pinCantidad && opts.pinCantidad > 0) params.pinCantidad = String(opts.pinCantidad);
    if (opts.pinNota) params.pinNota = opts.pinNota;
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
      cuenta: pago.cuenta || '',
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
      cuentaPago: params.cuentaPago || '',
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
      cuentaPago: params.cuentaPago || '',
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
  async borrarLoteStock(loteId: string, usuario: string) {
    return apiCall<{ loteId: string; nombre: string; montoRevertido: number; costosRevertidos: number }>({
      action: 'borrarLoteStock',
      loteId,
      usuario,
    });
  },
  async setCourier(ordenId: string, courier: string, usuario: string) {
    return apiCall<{ ordenId: string; courier: string }>({
      action: 'setCourier',
      ordenId,
      courier,
      usuario,
    });
  },
  async setNotaBodega(ordenId: string, nota: string, usuario: string) {
    return apiCall<{ ordenId: string; nota: string }>({
      action: 'setNotaBodega',
      ordenId,
      nota,
      usuario,
    });
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
  async cancelarItemPedido(
    params: { ordenId: string; itemRow: number; destino: 'FIGS' | 'STOCK'; costoStock?: number },
    usuario: string
  ) {
    return apiCall<{ itemRow: number; destino: string; loteId: string | null; costoRevertido: number }>({
      action: 'cancelarItemPedido',
      ordenId: params.ordenId,
      itemRow: String(params.itemRow),
      destino: params.destino,
      costoStock: params.costoStock !== undefined ? String(params.costoStock) : '',
      usuario,
    });
  },
  async corregirItemStock(
    params: { ordenId: string; itemRow: number; nuevoSku: string; nuevaTalla: string; nuevaLongitud: string; nuevoColor: string },
    usuario: string
  ) {
    return apiCall<{ itemRow: number; loteOriginalId: string; loteNuevoId: string; nuevoCosto: number }>({
      action: 'corregirItemStock',
      ordenId: params.ordenId,
      itemRow: String(params.itemRow),
      nuevoSku: params.nuevoSku,
      nuevaTalla: params.nuevaTalla,
      nuevaLongitud: params.nuevaLongitud,
      nuevoColor: params.nuevoColor,
      usuario,
    });
  },
  async getGananciaPorTipo(fechaInicio?: string, fechaFin?: string) {
    const params: Record<string, string> = { action: 'getGananciaPorTipo' };
    if (fechaInicio) params.fechaInicio = fechaInicio;
    if (fechaFin) params.fechaFin = fechaFin;
    return apiCall<{
      stock: { ventas: number; venta: number; costo: number; ganancia: number };
      pedido: { ventas: number; venta: number; costo: number; ganancia: number };
    }>(params);
  }, 
  async getReporteGanancia(fechaInicio?: string, fechaFin?: string) {
    const params: Record<string, string> = { action: 'getReporteGanancia' };
    if (fechaInicio) params.fechaInicio = fechaInicio;
    if (fechaFin) params.fechaFin = fechaFin;
    return apiCall<{
      stock: { ventas: number; venta: number; costo: number; ganancia: number };
      pedido: { ventas: number; venta: number; costo: number; ganancia: number };
      detalle: { ORDEN_ID: string; NOMBRE: string; F_ORDEN: string; TIPO: string; venta: number; costo: number; ganancia: number }[];
    }>(params);
  },
  async setPrioridad(ordenId: string, valor: number | '', usuario: string) {
    return apiCall<{ ordenId: string; prioridad: number | '' }>({
      action: 'setPrioridad',
      ordenId,
      valor: String(valor),
      usuario,
    });
  },
  async getMateriales(): Promise<{
    empaque: { ID: string; NOMBRE: string; CATEGORIA: string; STOCK: number; STOCK_MINIMO: number; COSTO: number }[];
    regalos: { ID: string; NOMBRE: string; CATEGORIA: string; STOCK: number; STOCK_MINIMO: number; COSTO: number }[];
  }> {
    return apiCall({ action: 'getMateriales' });
  },

  async setStockMaterial(tabla: 'empaque' | 'regalos', id: string, cantidad: number, usuario: string) {
    return apiCall<{ id: string; tabla: string; cantidad: number }>({
      action: 'setStockMaterial',
      tabla,
      id,
      cantidad: String(cantidad),
      usuario,
    });
  },
  async setColor(color: string, hex: string, usuario: string) {
    return apiCall<{ color: string; hex: string }>({
      action: 'setColor',
      color,
      hex,
      usuario,
    });
  },
  async agregarPin(params: { nombre: string; categoria: string; cantidad: number; costo?: number }, usuario: string) {
    return apiCall<{ id: string; nombre: string; categoria: string; cantidad: number; costo: number }>({
      action: 'agregarPin',
      nombre:    params.nombre,
      categoria: params.categoria,
      cantidad:  String(params.cantidad),
      costo:     String(params.costo ?? 1.1),
      usuario,
    });
  },
  async actualizarCliente(
    clienteId: string,
    campos: Partial<{ direccion: string; ciudad: string; telefono: string; email: string; industria: string; cedulaRuc: string }>,
    usuario: string
  ) {
    return apiCall<{ clienteId: string; cambios: string[] }>({
      action: 'actualizarCliente',
      clienteId,
      campos: JSON.stringify(campos),
      usuario,
    });
  },
  async agregarDescuento(ordenId: string, monto: number, nota: string, usuario: string) {
    return apiCall<{ ordenId: string; monto: number; nota: string }>({
      action: 'agregarDescuento',
      ordenId,
      monto: String(monto),
      nota,
      usuario,
    });
  },
  async perdidaEnTransito(
    ordenId: string,
    items: { itemRowNum: number; figsRepone: boolean; sku?: string; talla?: string; longitud?: string; color?: string }[],
    usuario: string
  ) {
    return apiCall<{ ordenId: string; items: any[] }>({
      action: 'perdidaEnTransito',
      ordenId,
      items: JSON.stringify(items),
      usuario,
    });
  },
  
  // --- Capital real: liquido + stock + pedidos activos - deuda ---
  // ============ FINANZAS v2 ============
  async getCuentas(): Promise<Cuenta[]> {
    return apiCall<Cuenta[]>({ action: 'getCuentas' });
  },
  async getFinanzasCuentas(): Promise<FinanzasCuentas> {
    return apiCall<FinanzasCuentas>({ action: 'getFinanzasCuentas' });
  },
  async getMovimientos(desde = '', hasta = ''): Promise<Movimiento[]> {
    return apiCall<Movimiento[]>({ action: 'getMovimientos', desde, hasta });
  },
  async getCorte(desde: string, hasta: string, donacion = 0): Promise<Corte> {
    return apiCall<Corte>({ action: 'getCorte', desde, hasta, donacion: String(donacion) });
  },
  async getCortesCerrados(): Promise<{ id: string; desde: string; hasta: string; porSocio: number; fechaCierre: string; usuario: string }[]> {
    return apiCall({ action: 'getCortesCerrados' });
  },
  async cerrarCorte(desde: string, hasta: string, donacion: number, usuario: string) {
    return apiCall<{ desde: string; hasta: string; porSocio: number }>({ action: 'cerrarCorte', desde, hasta, donacion: String(donacion), usuario });
  },
  async registrarMovimiento(m: NuevoMovimiento, usuario: string) {
    return apiCall<{ ids: string[] }>({
      action: 'registrarMovimiento', tipo: m.tipo, fecha: m.fecha, monto: String(m.monto),
      comision: String(m.comision || 0), categoria: m.categoria || '', origen: m.origen || '',
      destino: m.destino || '', aCargoDe: m.aCargoDe || '', nota: m.nota || '', usuario,
    });
  },
  async borrarMovimiento(id: string, usuario: string) {
    return apiCall<{ id: string }>({ action: 'borrarMovimiento', id, usuario });
  },
  async registrarEnvio(p: { ordenId: string; monto: number; fecha: string; origen: string; empresa: string; nota?: string }, usuario: string) {
    return apiCall<{ id: string }>({
      action: 'registrarEnvio', ordenId: p.ordenId, monto: String(p.monto), fecha: p.fecha,
      origen: p.origen, empresa: p.empresa, nota: p.nota || '', usuario,
    });
  },
  async registrarCompraMaterial(p: { tabla: 'empaque' | 'regalos'; id: string; cantidad: number; precioTotal: number; envio: number; fecha: string; origen: string; nota?: string }, usuario: string) {
    return apiCall<{ id: string; stockAntes: number; stockNuevo: number; costoAntes: number; costoNuevo: number }>({
      action: 'registrarCompraMaterial', tabla: p.tabla, id: p.id, cantidad: String(p.cantidad),
      precioTotal: String(p.precioTotal), envio: String(p.envio), fecha: p.fecha, origen: p.origen, nota: p.nota || '', usuario,
    });
  },
  async getCapitalReal() {
    return apiCall<{
      fechaFoto: string;
      liquido: number;
      stock: number;
      pedidosActivos: number;
      invertido: number;
      deuda: number;
      deudaPersonal: number;
      capitalReal: number;
      cuentas: { cuenta: string; tipo: string; monto: number }[];
      detalleStock: { loteId: string; nombre: string; talla: string; color: string; cantidad: number; valor: number }[];
      detallePedidosActivos: { ordenId: string; cliente: string; estado: string; items: string[]; costo: number }[];
    }>({ action: 'getCapitalReal' });
  },

  // --- Ganancia proyectada: profit "en camino" de pedidos aún no cerrados
  // (no entregados, o entregados pero con saldo pendiente) ---
  async getGananciaProyectada() {
    return apiCall<{
      porEntregar: { pedidos: number; venta: number; costo: number; gananciaEstimada: number };
      entregadoSinCobrar: { pedidos: number; venta: number; costo: number; saldoPendiente: number; gananciaEstimada: number };
      totalGananciaEstimada: number;
      detalle: { ORDEN_ID: string; NOMBRE: string; estado: string; saldo: number; venta: number; costo: number; ganancia: number }[];
    }>({ action: 'getGananciaProyectada' });
  },

  // --- PIE CHART: costos por tipo (a donde va el dinero) ---
  async getCostosPorTipo(fechaInicio?: string, fechaFin?: string) {
    const params: Record<string, string> = { action: 'getCostosPorTipo' };
    if (fechaInicio) params.fechaInicio = fechaInicio;
    if (fechaFin) params.fechaFin = fechaFin;
    return apiCall<{
      desde: string;
      hasta: string;
      total: number;
      porTipo: { tipo: string; monto: number }[];
    }>(params);
  },

  // --- TIMELINE: venta/ganancia mes a mes ---
  async getTimelineMensual(meses?: number) {
    const params: Record<string, string> = { action: 'getTimelineMensual' };
    if (meses != null) params.meses = String(meses);
    return apiCall<{
      meses: number;
      timeline: {
        mes: string;
        completo: boolean;
        diasTranscurridos?: number;
        diasDelMes?: number;
        ventaReal?: number;
        gananciaReal?: number;
        ventaPedido: number;
        gananciaPedido: number;
        ventaStock: number;
        gananciaStock: number;
        gastosFijos: number;
        gananciaNeta: number;
      }[];
    }>(params);
  },

  // --- HISTOGRAMA: distribucion de ganancia por pedido ---
  async getHistogramaGanancia(fechaInicio?: string, fechaFin?: string) {
    const params: Record<string, string> = { action: 'getHistogramaGanancia' };
    if (fechaInicio) params.fechaInicio = fechaInicio;
    if (fechaFin) params.fechaFin = fechaFin;
    return apiCall<{
      desde: string;
      hasta: string;
      totalPedidos: number;
      buckets: { label: string; min: number; max: number; count: number }[];
    }>(params);
  },

  // --- Gastos fijos de un mes ---
  async getGastosFijos(mes?: string) {
    const params: Record<string, string> = { action: 'getGastosFijos' };
    if (mes) params.mes = mes;
    return apiCall<{
      mes: string;
      gastos: { id: string; fecha: string; concepto: string; categoria: string; monto: number; nota: string }[];
      porCategoria: Record<string, number>;
      total: number;
      cantidad: number;
    }>(params);
  },

  // --- Agregar un gasto fijo (Sebas, Shopify, etc.) ---
  async agregarGastoFijo(g: {
    usuario: string; concepto: string; categoria: string; monto: number; fecha?: string; nota?: string;
  }) {
    const params: Record<string, string> = {
      action: 'agregarGastoFijo',
      usuario: g.usuario,
      concepto: g.concepto,
      categoria: g.categoria,
      monto: String(g.monto),
    };
    if (g.fecha) params.fecha = g.fecha;
    if (g.nota) params.nota = g.nota;
    return apiCall<{
      id: string; fecha: string; concepto: string; categoria: string; monto: number; nota: string;
    }>(params);
  },
  async getResumenMensual(
    mes: string,
    donacion?: number,
    fechaDesde?: string,
    fechaHasta?: string
  ) {
    const params: Record<string, string> = { action: 'getResumenMensual' };
    if (mes) params.mes = mes;
    if (donacion != null) params.donacion = String(donacion);
    if (fechaDesde) params.fechaDesde = fechaDesde;
    if (fechaHasta) params.fechaHasta = fechaHasta;
    return apiCall<{
      periodo: string;
      desde: string;
      hasta: string;
      repartible: {
        gananciaPedidosPagados: number;
        gastosFijos: number;
        donacion: number;
        neto: number;
        porSocio: number;
        cubiertoPorFreddy: number;
        porFreddyFinal: number;
        cantidadPedidos: number;
      };
      inversiones: {
        total: number;
        detalle: { fecha: string; concepto: string; monto: number; nota: string }[];
      };
      scrubme: { gananciaStock: number };
      proyeccion: { gananciaTotalMes: number; brecha: number };
      detalleRepartible: {
        ORDEN_ID: string; NOMBRE: string; FECHA_COBRO: string;
        TIPO: string; venta: number; costo: number; ganancia: number;
      }[];
    }>(params);
  },
};
