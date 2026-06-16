// lib/types.ts — Tipos compartidos en toda la app (v4.0 Sheet nuevo)

export type Rol = 'admin' | 'coordinador' | 'marketing' | 'bodega';

export type Usuario = {
  token: string;
  usuario: string;
  nombre: string;
  rol: Rol;
};

export type Estado =
  | 'HACER PEDIDO'
  | 'PEDIDO HECHO'
  | 'EN TRANSITO A FL'
  | 'CON FREDDY'
  | 'EN CAMINO A EC'
  | 'EN BODEGA EC'
  | 'LISTO PARA ENVIAR'
  | 'ENTREGADO'
  | 'CANCELADO';

export const ESTADOS: Estado[] = [
  'HACER PEDIDO',
  'PEDIDO HECHO',
  'EN TRANSITO A FL',
  'CON FREDDY',
  'EN CAMINO A EC',
  'EN BODEGA EC',
  'LISTO PARA ENVIAR',
  'ENTREGADO',
  'CANCELADO',
];

export type Item = {
  ORDEN_ID: string;
  SKU: string;
  NOMBRE_PRODUCTO: string;
  TIPO_PRENDA: string;
  TALLA: string;
  LONGITUD: string;
  COLOR: string;
  CANTIDAD: number;
  PRECIO_VENTA: number;
  PARTE_DE_SET: string;
  COSTO_UNITARIO: number | string;
  SUBTOTAL: number;
};

export type Costo = {
  TIPO_REFERENCIA: string;
  REFERENCIA_ID: string;
  FECHA: string;
  TIPO_COSTO: string;
  DESCRIPCION: string;
  MONTO: number;
  ORIGEN: string;
};

export type Pago = {
  ORDEN_ID: string;
  FECHA_PAGO: string;
  MONTO: number;
  METODO: string;
  URL_COMPROBANTE: string;
  NOTAS: string;
};

export type Descuento = {
  DESCUENTO_ID: string;
  ORDEN_ID: string;
  FECHA: string;
  TIPO: string;
  MONTO: number;
  NOTAS: string;
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

export type Totales = {
  bruto: number;
  descuentos: number;
  venta: number;
  costos: number;
  ganancia: number;
  pagado: number;
  saldo: number;
  estadoPago: string;
};

export type Pedido = {
  ORDEN_ID: string;
  CLIENTE_NOMBRE: string;
  NOMBRE: string; // alias de compatibilidad
  F_ORDEN: string;
  F_ENTREGA_EST: string;
  TIPO_DE_ORDEN: string;
  ESTATUS_ENVIO: Estado;
  PROVEEDOR: string;
  NUM_ORDEN_PROV: string;
  EMAIL_PEDIDO: string;
  METODO_ENVIO: string;
  COURIER: string;
  N_COURIER: string;
  REGALO_ENVIADO: string;
  CAJA_EXTRAS: number | string;
  NOTAS: string;
  PRIORIDAD?: number | string;
  cliente: Cliente | null;
  items: Item[];
  costos: Costo[];
  pagos: Pago[];
  descuentos: Descuento[];
  totales: Totales;
};

export type Producto = {
  SKU: string;
  NOMBRE: string;
  TIPO_PRENDA: string;
};
