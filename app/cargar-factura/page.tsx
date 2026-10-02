'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  api,
  type Cuenta,
  PedidoPendienteCostos,
  ItemPendiente,
  ItemFacturaPayload,
} from '@/lib/api';
import { Producto } from '@/lib/types';
import { auth } from '@/lib/auth';
import Navbar from '@/components/Navbar';

function fmtMoney(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type ItemPedidoSel = {
  ordenId: string;
  clienteNombre: string;
  rowNum: number;
  sku: string;
  nombreProducto: string;
  talla: string;
  longitud: string;
  color: string;
  precioFIGS: number;
};

type ItemStock = {
  id: number;
  sku: string;
  talla: string;
  longitud: string;
  color: string;
  cantidad: number;
  precioFIGS: number;
};

const LONGITUDES = ['Regular', 'Petite', 'Tall'];
const TRANSPORTES = ['FEDEX', 'USPS', 'Otro'];

export default function CargarFacturaPage() {
  const router = useRouter();

  const [pedidosPendientes, setPedidosPendientes] = useState<PedidoPendienteCostos[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);

  const [numFactura, setNumFactura] = useState('');
  const [fecha, setFecha] = useState('');
  const [iva, setIva] = useState('0');
  const [shipping, setShipping] = useState('0');

  const [itemsPedido, setItemsPedido] = useState<ItemPedidoSel[]>([]);
  const [itemsStock, setItemsStock] = useState<ItemStock[]>([]);

  // ── NUEVO: viaje del stock ──
  const [stockYaLlego, setStockYaLlego] = useState(false); // default: en camino
  const [tracking, setTracking] = useState('');
  const [transporte, setTransporte] = useState('FEDEX');

  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState('');

  // Con qué se pagó la factura ('' = automático: Chase si es solo stock, Capital One si no)
  const [cuentasPago, setCuentasPago] = useState<Cuenta[]>([]);
  const [cuentaElegida, setCuentaElegida] = useState('');

  useEffect(() => {
    const user = auth.getUser();
    if (!user) { router.replace('/login'); return; }
    if (user.rol !== 'admin') { router.replace('/pedidos'); return; }
    // Se calcula aquí (solo en el navegador) para evitar un mismatch de
    // hydration entre el servidor (UTC) y el cliente (Ecuador) — este
    // campo SÍ se muestra en pantalla (input de fecha de factura).
    setFecha((() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })());
    api.getCuentas()
      .then(cs => setCuentasPago(cs.filter(c => ['BANCO', 'EFECTIVO', 'TARJETA', 'TARJETA_PERSONAL'].includes(c.tipo))))
      .catch(() => setCuentasPago([]));
    load();
  }, [router]);

  const cuentaAuto = (() => {
    const soloStock = itemsPedido.length === 0 && itemsStock.length > 0;
    const buscar = (t: string) => cuentasPago.find(c => c.nombre.toLowerCase().includes(t));
    return (soloStock ? buscar('chase') : buscar('capital'))?.id || cuentasPago[0]?.id || '';
  })();
  const cuentaPago = cuentaElegida || cuentaAuto;

  async function load() {
    setLoading(true);
    try {
      const [pend, prods] = await Promise.all([
        api.getItemsPendientesCostos(),
        api.getProductos(),
      ]);
      setPedidosPendientes(pend);
      setProductos(prods);
    } catch (err) {
      alert('Error al cargar: ' + (err instanceof Error ? err.message : 'desconocido'));
    } finally {
      setLoading(false);
    }
  }

  function isItemPedidoSelected(ordenId: string, rowNum: number): boolean {
    return itemsPedido.some(i => i.ordenId === ordenId && i.rowNum === rowNum);
  }

  function toggleItemPedido(pedido: PedidoPendienteCostos, item: ItemPendiente) {
    const exists = isItemPedidoSelected(pedido.ORDEN_ID, item._rowNum);
    if (exists) {
      setItemsPedido(itemsPedido.filter(
        i => !(i.ordenId === pedido.ORDEN_ID && i.rowNum === item._rowNum)
      ));
    } else {
      setItemsPedido([...itemsPedido, {
        ordenId: pedido.ORDEN_ID,
        clienteNombre: pedido.CLIENTE_NOMBRE,
        rowNum: item._rowNum,
        sku: item.SKU,
        nombreProducto: item.NOMBRE_PRODUCTO,
        talla: item.TALLA,
        longitud: item.LONGITUD,
        color: item.COLOR,
        precioFIGS: 0,
      }]);
    }
  }

  function updatePrecioPedido(rowNum: number, ordenId: string, valor: string) {
    setItemsPedido(itemsPedido.map(i =>
      (i.ordenId === ordenId && i.rowNum === rowNum)
        ? { ...i, precioFIGS: Number(valor) || 0 }
        : i
    ));
  }

  function addItemStock() {
    setItemsStock([...itemsStock, {
      id: Date.now(),
      sku: productos.length > 0 ? productos[0].SKU : '',
      talla: '',
      longitud: 'Regular',
      color: '',
      cantidad: 1,
      precioFIGS: 0,
    }]);
  }

  function updateItemStock(id: number, campo: keyof ItemStock, valor: string | number) {
    setItemsStock(itemsStock.map(i =>
      i.id === id ? { ...i, [campo]: valor } : i
    ));
  }

  function removeItemStock(id: number) {
    setItemsStock(itemsStock.filter(i => i.id !== id));
  }

  const subtotalPedido = itemsPedido.reduce((s, i) => s + (i.precioFIGS || 0), 0);
  const subtotalStock = itemsStock.reduce((s, i) => s + (i.precioFIGS || 0) * (i.cantidad || 0), 0);
  const subtotal = subtotalPedido + subtotalStock;

  const ivaNum = Number(iva) || 0;
  const shippingNum = Number(shipping) || 0;
  const totalFactura = subtotal + ivaNum + shippingNum;

  function calcCosto(precioFIGS: number): number {
    if (subtotal <= 0) return 0;
    const pct = precioFIGS / subtotal;
    return precioFIGS + ivaNum * pct + shippingNum * pct;
  }

  const totalItems = itemsPedido.length + itemsStock.length;
  const hayStock = itemsStock.length > 0;

  async function handleSubmit() {
    if (totalItems === 0) {
      alert('Agrega al menos un item (de pedido o de stock)');
      return;
    }
    if (subtotal <= 0) {
      alert('Ingresa los precios FIGS de los items');
      return;
    }
    if (!numFactura.trim()) {
      alert('Ingresa el número de factura');
      return;
    }
    for (const s of itemsStock) {
      if (!s.sku || !s.talla.trim() || !s.color.trim() || s.cantidad <= 0 || s.precioFIGS <= 0) {
        alert('Hay items de stock incompletos. Revisa SKU, talla, color, cantidad y precio.');
        return;
      }
    }
    for (const p of itemsPedido) {
      if (p.precioFIGS <= 0) {
        alert(`Falta el precio FIGS de ${p.sku} (pedido ${p.ordenId})`);
        return;
      }
    }

    const user = auth.getUser();
    if (!user) return;

    const payload: ItemFacturaPayload[] = [
      ...itemsPedido.map(i => ({
        tipoReferencia: 'PEDIDO' as const,
        ordenId: i.ordenId,
        itemRowNum: i.rowNum,
        sku: i.sku,
        talla: i.talla,
        longitud: i.longitud,
        color: i.color,
        precioFIGS: i.precioFIGS,
      })),
      ...itemsStock.map(i => ({
        tipoReferencia: 'STOCK' as const,
        sku: i.sku,
        talla: i.talla,
        longitud: i.longitud,
        color: i.color,
        cantidad: i.cantidad,
        precioFIGS: i.precioFIGS,
      })),
    ];

    setSubmitting(true);
    try {
      await api.cargarFacturaFIGS({
        items: payload,
        subtotal,
        iva: ivaNum,
        shipping: shippingNum,
        numFactura: numFactura.trim(),
        fecha,
        stockYaLlego: hayStock ? stockYaLlego : true,
        tracking: (hayStock && !stockYaLlego) ? tracking.trim() : '',
        transporte: (hayStock && !stockYaLlego) ? transporte : '',
        cuentaPago,
      }, user.usuario);

      setToast(`✅ Factura ${numFactura} cargada: ${totalItems} items por ${fmtMoney(totalFactura)}`);
      setTimeout(() => setToast(''), 4000);

      setItemsPedido([]);
      setItemsStock([]);
      setNumFactura('');
      setIva('0');
      setShipping('0');
      setStockYaLlego(false);
      setTracking('');
      setTransporte('FEDEX');
      load();
    } catch (err) {
      alert('Error: ' + (err instanceof Error ? err.message : 'desconocido'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Navbar />
      <div className="fade-in" style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ marginBottom: 32 }}>
          <span className="number-tag">COSTOS · COMPRAS</span>
          <h1 className="display" style={{ fontSize: 48, fontWeight: 300, margin: '6px 0 0', lineHeight: 1 }}>
            Cargar factura FIGS<em style={{ color: 'var(--gold)' }}>.</em>
          </h1>
          <p style={{ color: 'var(--text-soft)', fontSize: 14, margin: '12px 0 0', maxWidth: 640 }}>
            Marca los items que van a pedidos existentes y agrega los items que entran como stock.
            El sistema reparte IVA y shipping proporcionalmente.
          </p>
        </div>

        {/* 1. DATOS DE FACTURA */}
        <div className="card m-pad" style={{ padding: 28, marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 20px', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-soft)' }}>1. Datos de la factura</h3>
          <div className="m-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16 }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase' }}>N° Factura</label>
              <input className="input" placeholder="33027108" value={numFactura} onChange={(e) => setNumFactura(e.target.value)} style={{ marginTop: 4 }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Fecha</label>
              <input type="date" className="input" value={fecha} onChange={(e) => setFecha(e.target.value)} style={{ marginTop: 4 }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase' }}>IVA / Tax ($)</label>
              <input type="number" step="0.01" className="input" value={iva} onChange={(e) => setIva(e.target.value)} style={{ marginTop: 4 }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Shipping ($)</label>
              <input type="number" step="0.01" className="input" value={shipping} onChange={(e) => setShipping(e.target.value)} style={{ marginTop: 4 }} />
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <label style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Pagado con</label>
            <select className="input" value={cuentaPago} onChange={(e) => setCuentaElegida(e.target.value)} style={{ marginTop: 4, maxWidth: 360 }}>
              {cuentasPago.length === 0 && <option value="">(sin cuentas: se guarda sin cuenta)</option>}
              {cuentasPago.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
            <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4 }}>Si fue con el Amex de Freddy, baja su deuda con el negocio.</div>
          </div>
        </div>

        {/* 2. ITEMS DE PEDIDO */}
        <div className="card m-pad" style={{ padding: 28, marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 6px', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-soft)' }}>
            2. Items para pedidos · <span className="tabular">{itemsPedido.length}</span> seleccionados
          </h3>
          <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: '0 0 16px' }}>
            Items de pedidos que esperan que se les cargue costo.
          </p>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-faint)' }}>Cargando…</div>
          ) : pedidosPendientes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-faint)', background: 'var(--bg)', borderRadius: 4 }}>
              No hay pedidos pendientes de costo.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {pedidosPendientes.map(pedido => (
                <div key={pedido.ORDEN_ID}>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                    <span className="mono">{pedido.ORDEN_ID}</span> · {pedido.CLIENTE_NOMBRE}
                    <span style={{ color: 'var(--text-faint)', fontWeight: 400, marginLeft: 8 }}>{pedido.ESTATUS_ENVIO}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {pedido.items.map(item => {
                      const selected = isItemPedidoSelected(pedido.ORDEN_ID, item._rowNum);
                      const selData = itemsPedido.find(
                        i => i.ordenId === pedido.ORDEN_ID && i.rowNum === item._rowNum
                      );
                      return (
                        <div
                          key={item._rowNum}
                          style={{
                            padding: '10px 14px',
                            borderRadius: 4,
                            background: selected ? 'var(--bg)' : 'transparent',
                            border: `1px solid ${selected ? 'var(--text)' : 'var(--border)'}`,
                            display: 'grid',
                            gridTemplateColumns: 'auto 1fr 130px',
                            gap: 12,
                            alignItems: 'center',
                          }}
                        >
                          <div
                            onClick={() => toggleItemPedido(pedido, item)}
                            style={{ width: 18, height: 18, borderRadius: 3, cursor: 'pointer', border: `1.5px solid ${selected ? 'var(--text)' : 'var(--border)'}`, background: selected ? 'var(--text)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 12 }}
                          >
                            {selected ? '✓' : ''}
                          </div>
                          <div onClick={() => toggleItemPedido(pedido, item)} style={{ cursor: 'pointer' }}>
                            <div className="display" style={{ fontSize: 14 }}>{item.NOMBRE_PRODUCTO || item.SKU}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-soft)' }}>
                              {item.TALLA} · {item.LONGITUD} · {item.COLOR}
                              {item.PARTE_DE_SET ? ` · ${item.PARTE_DE_SET}` : ''}
                            </div>
                          </div>
                          {selected ? (
                            <div>
                              <label style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Precio FIGS $</label>
                              <input
                                type="number"
                                step="0.01"
                                className="input"
                                value={selData?.precioFIGS || ''}
                                onChange={(e) => updatePrecioPedido(item._rowNum, pedido.ORDEN_ID, e.target.value)}
                                placeholder="0.00"
                                style={{ marginTop: 2, padding: '6px 10px', fontSize: 13 }}
                              />
                            </div>
                          ) : (
                            <div style={{ fontSize: 11, color: 'var(--text-faint)', textAlign: 'right' }}>
                              Venta {fmtMoney(Number(item.PRECIO_VENTA))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. ITEMS DE STOCK */}
        <div className="card m-pad" style={{ padding: 28, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <h3 style={{ margin: 0, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-soft)' }}>
              3. Items para stock · <span className="tabular">{itemsStock.length}</span>
            </h3>
            <button className="btn" onClick={addItemStock} style={{ padding: '6px 14px', fontSize: 12 }}>
              + Agregar item de stock
            </button>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: '0 0 16px' }}>
            Prendas que entran como inventario, sin clienta asignada.
          </p>

          {itemsStock.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-faint)', background: 'var(--bg)', borderRadius: 4, fontSize: 13 }}>
              Sin items de stock. Usa el botón para agregar.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {itemsStock.map(item => (
                <div key={item.id} className="m-2col-first" style={{ display: 'grid', gridTemplateColumns: '2.4fr 0.7fr 1fr 1fr 0.6fr 0.9fr auto', gap: 8, alignItems: 'end', padding: '10px 14px', background: 'var(--bg)', borderRadius: 4 }}>
                  <div>
                    <label style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase' }}>SKU</label>
                    <select
                      className="input"
                      value={item.sku}
                      onChange={(e) => updateItemStock(item.id, 'sku', e.target.value)}
                      style={{ marginTop: 2, padding: '6px 8px', fontSize: 12 }}
                    >
                      {productos.map(p => (
                        <option key={p.SKU} value={p.SKU}>{p.SKU} — {p.NOMBRE}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Talla</label>
                    <input className="input" value={item.talla} onChange={(e) => updateItemStock(item.id, 'talla', e.target.value)} placeholder="XS" style={{ marginTop: 2, padding: '6px 8px', fontSize: 12 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Longitud</label>
                    <select className="input" value={item.longitud} onChange={(e) => updateItemStock(item.id, 'longitud', e.target.value)} style={{ marginTop: 2, padding: '6px 8px', fontSize: 12 }}>
                      {LONGITUDES.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Color</label>
                    <input className="input" value={item.color} onChange={(e) => updateItemStock(item.id, 'color', e.target.value)} placeholder="Walnut" style={{ marginTop: 2, padding: '6px 8px', fontSize: 12 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Cant</label>
                    <input type="number" className="input" value={item.cantidad} onChange={(e) => updateItemStock(item.id, 'cantidad', Number(e.target.value) || 0)} style={{ marginTop: 2, padding: '6px 8px', fontSize: 12 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Precio FIGS $</label>
                    <input type="number" step="0.01" className="input" value={item.precioFIGS || ''} onChange={(e) => updateItemStock(item.id, 'precioFIGS', Number(e.target.value) || 0)} placeholder="0.00" style={{ marginTop: 2, padding: '6px 8px', fontSize: 12 }} />
                  </div>
                  <button className="btn" onClick={() => removeItemStock(item.id)} style={{ padding: '6px 10px', fontSize: 12, color: 'var(--rose)' }}>✕</button>
                </div>
              ))}
            </div>
          )}

          {/* 3b. VIAJE DEL STOCK (solo si hay stock) */}
          {hayStock && (
            <div style={{ marginTop: 16, padding: 16, background: 'var(--bg)', borderRadius: 4, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div
                  onClick={() => setStockYaLlego(!stockYaLlego)}
                  style={{ width: 18, height: 18, borderRadius: 3, cursor: 'pointer', border: `1.5px solid ${stockYaLlego ? 'var(--text)' : 'var(--border)'}`, background: stockYaLlego ? 'var(--text)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 12 }}
                >
                  {stockYaLlego ? '✓' : ''}
                </div>
                <span style={{ fontSize: 13, cursor: 'pointer' }} onClick={() => setStockYaLlego(!stockYaLlego)}>
                  Este stock <strong>ya llegó</strong> a bodega EC (disponible para vender)
                </span>
              </div>

              {!stockYaLlego ? (
                <div>
                  <p style={{ fontSize: 11, color: 'var(--text-faint)', margin: '0 0 10px' }}>
                    El stock nacerá <strong>en camino</strong> (Mildred lo verá en preventa). Pon el tracking del envío FIGS → bodega FL.
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Tracking (FEDEX/USPS)</label>
                      <input className="input" value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="7712..." style={{ marginTop: 2, padding: '6px 10px', fontSize: 13 }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Transporte</label>
                      <select className="input" value={transporte} onChange={(e) => setTransporte(e.target.value)} style={{ marginTop: 2, padding: '6px 10px', fontSize: 13 }}>
                        {TRANSPORTES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              ) : (
                <p style={{ fontSize: 11, color: 'var(--text-faint)', margin: 0 }}>
                  El stock entrará como <strong>disponible</strong> de una vez (ya está en bodega EC).
                </p>
              )}
            </div>
          )}
        </div>

        {/* 4. TOTALES + PREVIEW */}
        {totalItems > 0 && (
          <div className="card m-pad" style={{ padding: 28, marginBottom: 20, background: 'linear-gradient(to right, rgba(184,149,78,0.04), transparent)', borderColor: 'var(--gold)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--gold)' }}>
              4. Resumen y preview
            </h3>

            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-soft)', marginBottom: 5 }}>
                <span>Subtotal items ({totalItems})</span>
                <span className="tabular">{fmtMoney(subtotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-soft)', marginBottom: 5 }}>
                <span>IVA</span>
                <span className="tabular">+{fmtMoney(ivaNum)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-soft)', marginBottom: 8 }}>
                <span>Shipping</span>
                <span className="tabular">+{fmtMoney(shippingNum)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>Total factura</span>
                <span className="display tabular" style={{ fontSize: 24 }}>{fmtMoney(totalFactura)}</span>
              </div>
            </div>

            {subtotal > 0 && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase', marginBottom: 8 }}>Costo que se guardará por item</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {itemsPedido.map(i => (
                    <div key={`p-${i.ordenId}-${i.rowNum}`} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, fontSize: 12, padding: '4px 0' }}>
                      <span><span className="mono" style={{ color: 'var(--text-soft)' }}>{i.ordenId}</span> {i.sku}</span>
                      <span className="tabular" style={{ color: 'var(--text-faint)' }}>FIGS ${i.precioFIGS.toFixed(2)}</span>
                      <span className="display tabular" style={{ color: 'var(--gold)', minWidth: 80, textAlign: 'right' }}>${calcCosto(i.precioFIGS).toFixed(2)}</span>
                    </div>
                  ))}
                  {itemsStock.map(i => (
                    <div key={`s-${i.id}`} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, fontSize: 12, padding: '4px 0' }}>
                      <span><span className="mono" style={{ color: 'var(--gold)' }}>STOCK</span> {i.sku} ×{i.cantidad}</span>
                      <span className="tabular" style={{ color: 'var(--text-faint)' }}>FIGS ${i.precioFIGS.toFixed(2)}/u</span>
                      <span className="display tabular" style={{ color: 'var(--gold)', minWidth: 80, textAlign: 'right' }}>${calcCosto(i.precioFIGS).toFixed(2)}/u</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* SUBMIT */}
        <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={() => router.push('/pedidos')} disabled={submitting}>Cancelar</button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={submitting || totalItems === 0 || subtotal <= 0}
          >
            {submitting ? 'Guardando…' : `Guardar y distribuir (${totalItems})`}
          </button>
        </div>
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'var(--text)', color: 'var(--surface)', padding: '14px 24px', borderRadius: 4, fontSize: 13, zIndex: 100, boxShadow: '0 10px 30px rgba(0,0,0,0.15)', maxWidth: '90vw' }}>
          {toast}
        </div>
      )}
    </>
  );
}
