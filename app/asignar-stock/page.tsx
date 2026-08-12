'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api, PedidoConStock, ItemConStock, AsignacionStock } from '@/lib/api';
import { auth } from '@/lib/auth';
import Navbar from '@/components/Navbar';

function fmtMoney(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function AsignarStockPage() {
  const router = useRouter();

  const [pedidos, setPedidos] = useState<PedidoConStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [fecha, setFecha] = useState('');
  const [seleccionados, setSeleccionados] = useState<string[]>([]); // claves "ordenId|rowNum"
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    const user = auth.getUser();
    if (!user) { router.replace('/login'); return; }
    if (user.rol !== 'admin') { router.replace('/pedidos'); return; }
    // Se calcula aquí (solo en el navegador) para evitar un mismatch de
    // hydration entre el servidor (UTC) y el cliente (Ecuador).
    setFecha(new Date().toISOString().split('T')[0]);
    load();
  }, [router]);

  async function load() {
    setLoading(true);
    try {
      const data = await api.getStockDisponiblePorItem();
      setPedidos(data);
    } catch (err) {
      alert('Error al cargar: ' + (err instanceof Error ? err.message : 'desconocido'));
    } finally {
      setLoading(false);
    }
  }

  function keyOf(ordenId: string, rowNum: number) {
    return `${ordenId}|${rowNum}`;
  }

  function toggle(ordenId: string, item: ItemConStock) {
    if (!item.hayStock) return; // no se puede seleccionar sin stock
    const k = keyOf(ordenId, item._rowNum);
    setSeleccionados(s => s.includes(k) ? s.filter(x => x !== k) : [...s, k]);
  }

  // Construir lista de asignaciones seleccionadas
  const asignaciones: { ped: PedidoConStock; item: ItemConStock }[] = [];
  pedidos.forEach(ped => {
    ped.items.forEach(item => {
      if (seleccionados.includes(keyOf(ped.ORDEN_ID, item._rowNum))) {
        asignaciones.push({ ped, item });
      }
    });
  });

  const totalAsignar = asignaciones.length;
  const costoTotal = asignaciones.reduce(
    (s, a) => s + (a.item.loteSugerido?.COSTO_UNITARIO || 0) * a.item.CANTIDAD, 0
  );
  const hayLotesSinCourier = asignaciones.some(a => a.item.loteSugerido && !a.item.loteSugerido.tieneCourier);

  async function handleSubmit() {
    if (totalAsignar === 0) {
      alert('Selecciona al menos un item');
      return;
    }
    const user = auth.getUser();
    if (!user) return;

    if (hayLotesSinCourier) {
      const ok = confirm(
        'Algunos lotes todavía no tienen courier cargado.\n\n' +
        'El costo asignado al pedido estará INCOMPLETO (sin la parte del envío).\n\n' +
        '¿Continuar de todas formas?'
      );
      if (!ok) return;
    }

    const payload: AsignacionStock[] = asignaciones.map(a => ({
      ordenId: a.ped.ORDEN_ID,
      itemRowNum: a.item._rowNum,
      sku: a.item.SKU,
      talla: a.item.TALLA,
      longitud: a.item.LONGITUD,
      color: a.item.COLOR,
      cantidad: a.item.CANTIDAD,
    }));

    setSubmitting(true);
    try {
      const res = await api.asignarStock(payload, fecha, user.usuario) as {
        asignados: unknown[];
        sinStock: unknown[];
      };
      const nAsig = res.asignados?.length || 0;
      const nSin = res.sinStock?.length || 0;
      setToast(
        `✅ ${nAsig} item(s) asignado(s) desde stock` +
        (nSin > 0 ? ` · ${nSin} sin stock suficiente` : '')
      );
      setTimeout(() => setToast(''), 4000);
      setSeleccionados([]);
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
      <div className="fade-in" style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ marginBottom: 32 }}>
          <span className="number-tag">COSTOS · INVENTARIO</span>
          <h1 className="display" style={{ fontSize: 48, fontWeight: 300, margin: '6px 0 0', lineHeight: 1 }}>
            Asignar stock<em style={{ color: 'var(--gold)' }}>.</em>
          </h1>
          <p style={{ color: 'var(--text-soft)', fontSize: 14, margin: '12px 0 0', maxWidth: 640 }}>
            Asigna prendas de tu inventario a items de pedidos. El costo del lote pasa al pedido
            y la prenda sale del stock (FIFO: sale primero la más antigua).
          </p>
        </div>

        <div className="card" style={{ padding: 28, marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-soft)' }}>
            Items de pedidos pendientes de costo · <span className="tabular">{totalAsignar}</span> seleccionados
          </h3>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-faint)' }}>Cargando…</div>
          ) : pedidos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-faint)', background: 'var(--bg)', borderRadius: 4 }}>
              No hay items de pedidos pendientes de costo.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {pedidos.map(ped => (
                <div key={ped.ORDEN_ID}>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                    <span className="mono">{ped.ORDEN_ID}</span> · {ped.CLIENTE_NOMBRE}
                    <span style={{ color: 'var(--text-faint)', fontWeight: 400, marginLeft: 8 }}>{ped.ESTATUS_ENVIO}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {ped.items.map(item => {
                      const sel = seleccionados.includes(keyOf(ped.ORDEN_ID, item._rowNum));
                      const sinStock = !item.hayStock;
                      return (
                        <div
                          key={item._rowNum}
                          onClick={() => toggle(ped.ORDEN_ID, item)}
                          style={{
                            padding: '10px 14px', borderRadius: 4,
                            cursor: sinStock ? 'not-allowed' : 'pointer',
                            opacity: sinStock ? 0.55 : 1,
                            background: sel ? 'var(--bg)' : 'transparent',
                            border: `1px solid ${sel ? 'var(--text)' : 'var(--border)'}`,
                            display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 12, alignItems: 'center',
                          }}
                        >
                          <div style={{ width: 18, height: 18, borderRadius: 3, border: `1.5px solid ${sel ? 'var(--text)' : 'var(--border)'}`, background: sel ? 'var(--text)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 12 }}>
                            {sel ? '✓' : ''}
                          </div>
                          <div>
                            <div className="display" style={{ fontSize: 14 }}>{item.NOMBRE_PRODUCTO || item.SKU}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-soft)' }}>
                              {item.TALLA} · {item.LONGITUD} · {item.COLOR} · ×{item.CANTIDAD}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            {sinStock ? (
                              <span style={{ fontSize: 11, color: 'var(--rose)' }}>Sin stock — comprar a FIGS</span>
                            ) : (
                              <div>
                                <div className="tabular" style={{ fontSize: 13, color: 'var(--gold)' }}>
                                  {fmtMoney(item.loteSugerido!.COSTO_UNITARIO)}
                                </div>
                                <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>
                                  <span className="mono">{item.loteSugerido!.LOTE_ID}</span>
                                  {' · '}
                                  {item.loteSugerido!.tieneCourier
                                    ? 'con courier'
                                    : <span style={{ color: 'var(--amber)' }}>sin courier ⚠</span>}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {totalAsignar > 0 && (
          <div className="card" style={{ padding: 24, marginBottom: 20, background: 'linear-gradient(to right, rgba(184,149,78,0.04), transparent)', borderColor: 'var(--gold)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 13, color: 'var(--text-soft)' }}>{totalAsignar} item(s) · costo total a asignar</span>
              <span className="display tabular" style={{ fontSize: 22, color: 'var(--gold)' }}>{fmtMoney(costoTotal)}</span>
            </div>
            {hayLotesSinCourier && (
              <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--amber-bg, #FAF0E0)', borderRadius: 4, fontSize: 12, color: 'var(--amber)' }}>
                ⚠️ Algunos lotes no tienen courier cargado. El costo asignado quedará incompleto hasta que cargues el courier.
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={() => router.push('/pedidos')} disabled={submitting}>Cancelar</button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={submitting || totalAsignar === 0}
          >
            {submitting ? 'Asignando…' : `Asignar desde stock (${totalAsignar})`}
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
