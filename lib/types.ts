// lib/types.ts — Tipos compartidos en toda la app

export type Rol = 'bodega' | 'admin';

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
  | 'ENTREGADO';

export const ESTADOS: Estado[] = [
  'HACER PEDIDO',
  'PEDIDO HECHO',
  'EN TRANSITO A FL',
  'CON FREDDY',
  'EN CAMINO A EC',
  'EN BODEGA EC',
  'LISTO PARA ENVIAR',
  'ENTREGADO',
];

export type Item = {
  ORDEN_ID: string;
  PRODUCTO: string;
  TIPO_PRENDA: string;
  TALLA: string;
  COLOR: string;
  CANTIDAD: number;
  PRECIO_VENTA: number;
};

export type Costo = {
  ORDEN_ID: string;
  TIPO_COSTO: string;
  MONTO: number;
};

export type Pago = {
  ORDEN_ID: string;
  FECHA_PAGO: string;
  CANTIDAD_PAGADA: number;
  METODO: string;
  ESTATUS_PAGO: string;
};

export type Cliente = {
  NOMBRE: string;
  TELEFONO: string;
  DIRECCION: string;
  CIUDAD: string;
  CEDULA_RUC: string;
  ESPECIALIDAD: string;
};

export type Totales = {
  venta: number;
  costos: number;
  ganancia: number;
  pagado: number;
  saldo: number;
};

export type Pedido = {
  ORDEN_ID: string;
  NOMBRE: string;
  F_ORDEN: string;
  F_ENTREGA: string;
  TIPO_DE_ORDEN: string;
  ESTATUS_ENVIO: Estado;
  N_COURIER: string;
  M_DE_ENVIO: string;
  PROVEEDOR: string;
  NUM_ORDEN_PROV: string;
  EMAIL_PEDIDO: string;
  NOTAS_REGALOS: string;
  ESTA_ACTIVA: string;
  REGALO: string;
  cliente: Cliente | null;
  items: Item[];
  costos: Costo[];
  pagos: Pago[];
  totales: Totales;
};
