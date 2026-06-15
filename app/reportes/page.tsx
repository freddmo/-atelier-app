'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { auth } from '@/lib/auth';
import Navbar from '@/components/Navbar';

function fmtMoney(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: string) {
  if (!d) return '';
  return new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}

function fmtDateShort(d: string) {
  if (!d) return '';
  return new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

type ReporteData = {
  stock: { ventas: number; venta: number; costo: number; ganancia: number };
  pedido: { ventas: number; venta: number; costo: number; ganancia: number };
  detalle: { ORDEN_ID: string; NOMBRE: string; F_ORDEN: string; TIPO: string; venta: number; costo: number; ganancia: number }[];
};

export default function ReportesPage() {
  const router = useRouter();
  const [reporte, setReporte] = useState<ReporteData | null>(null);
  const [loading, setLoading] = useState(true);
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const [fechaInicio, setFechaInicio] = useState(firstOfMonth.toISOString().split('T')[0]);
  const [fechaFin, setFechaFin] = useState(today.toISOString().split('T')[0]);

  useEffect(() => {
    const user = auth.getUser();
    if (!user) { router.replace('/login'); return; }
    if (user.rol !== 'admin') { router.replace('/pedidos'); return; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => {
    if (!auth.getUser()) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fechaInicio, fechaFin]);

  async function load() {
    setLoading(true);
    try {
      const data = await api.getReporteGanancia(fechaInicio, fechaFin);
      setReporte(data);
    } catch {
      setReporte(null);
    } finally {
      setLoading(false);
    }
  }

  function setQuickRange(range: 'hoy' | 'semana' | 'mes') {
    const t = new Date();
    const fin = t.toISOString().split('T')[0];
    let inicio: string;
    if (range === 'hoy') inicio = fin;
    else if (range === 'semana') {
      const d = new Date(t); d.setDate(d.getDate() - 7);
      inicio = d.toISOString().split('T')[0];
    } else {
      const d = new Date(t.getFullYear(), t.getMonth(), 1);
      inicio = d.toISOString().split('T')[0];
    }
    setFechaInicio(inicio); setFechaFin(fin);
  }

  const detalle = reporte?.detalle || [];
  const totalGanancia = (reporte ? reporte.pedido.ganancia + reporte.stock.ganancia : 0);
  const gananciaPorOrden = detalle.length > 0 ? totalGanancia / detalle.length : 0;

  return (
    <>
      <Navbar />
      <div className="fade-in" style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ marginBottom: 32 }}>
          <span className="number-tag">ANÁLISIS · GANANCIAS</span>
          <h1 className="display" style={{ fontSize: 48, fontWeight: 300, margin: '6px 0 0', lineHeight: 1 }}>
            Reportes<em style={{ color: 'var(--gold)' }}>.</em>
          </h1>
          <p style={{ color: 'var(--text-soft)', fontSize: 14, margin: '12px 0 0' }}>Ganancia estimada por período (pedidos hechos)</p>
        </div>

        {/* ===== GANANCIA POR TIPO DE VENTA ===== */}
        {reporte && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, color: 'var(--text-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
              Ganancia estimada por tipo de venta
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: '0 0 14px' }}>
              Todos los pedidos con factura cargada (entregados o no), por fecha de pedido. Los costos que aún faltan se asumen altos (courier $8.50/pieza, empaque $3.04, pin $1.10, delivery $6.10), así la ganancia real tiende a ser igual o mejor. Una venta es de pedido si todas sus prendas se compraron por encargo; si tiene alguna de stock, cuenta como stock.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
              {[
                { label: 'Ganancia · Pedidos', d: reporte.pedido, color: 'var(--blue)' },
                { label: 'Ganancia · Stock', d: reporte.stock, color: 'var(--amber)' },
              ].map(({ label, d, color }) => (
                <div key={label} className="card" style={{ padding: 24, borderTop: `3px solid ${color}` }}>
                  <div style={{ fontSize: 11, color: 'var(--text-soft)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
                    {label} · <span className="tabular">{d.ventas}</span> venta{d.ventas === 1 ? '' : 's'}
                  </div>
                  <div className="display tabular" style={{ fontSize: 40, fontWeight: 300, color: d.ganancia >= 0 ? 'var(--green)' : 'var(--rose)', lineHeight: 1, marginBottom: 12 }}>
                    {fmtMoney(d.ganancia)}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-soft)', borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                    <span>Venta <span className="tabular" style={{ color: 'var(--text)' }}>{fmtMoney(d.venta)}</span></span>
                    <span>Costo <span className="tabular" style={{ color: 'var(--text)' }}>{fmtMoney(d.costo)}</span></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card" style={{ padding: 24, marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: 'var(--text-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>Período de análisis</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'end' }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-soft)' }}>Desde</label>
              <input type="date" className="input" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} style={{ marginTop: 4 }} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-soft)' }}>Hasta</label>
              <input type="date" className="input" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} style={{ marginTop: 4 }} />
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button className="btn" style={{ padding: '8px 12px', fontSize: 12 }} onClick={() => setQuickRange('hoy')}>Hoy</button>
              <button className="btn" style={{ padding: '8px 12px', fontSize: 12 }} onClick={() => setQuickRange('semana')}>Semana</button>
              <button className="btn" style={{ padding: '8px 12px', fontSize: 12 }} onClick={() => setQuickRange('mes')}>Mes</button>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: 'var(--border)', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', marginBottom: 32 }}>
          <div style={{ background: 'var(--surface)', padding: 20 }}>
            <div style={{ fontSize: 10, color: 'var(--text-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>Cantidad</div>
            <span className="display tabular" style={{ fontSize: 36, fontWeight: 300, color: 'var(--blue)', lineHeight: 1 }}>{detalle.length}</span>
          </div>
          <div style={{ background: 'var(--surface)', padding: 20 }}>
            <div style={{ fontSize: 10, color: 'var(--text-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>Ganancia por orden</div>
            <span className="display tabular" style={{ fontSize: 36, fontWeight: 300, color: 'var(--green)', lineHeight: 1 }}>{fmtMoney(gananciaPorOrden)}</span>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <h2 className="display" style={{ fontSize: 24, fontWeight: 400, margin: '0 0 4px' }}>
            Detalle de órdenes
          </h2>
          <p style={{ color: 'var(--text-soft)', fontSize: 13, margin: 0 }}>
            {detalle.length} órden{detalle.length === 1 ? '' : 'es'} entre {fmtDate(fechaInicio)} y {fmtDate(fechaFin)} · costos estimados donde faltan
          </p>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-faint)' }}>Cargando…</div>
        ) : detalle.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 64, color: 'var(--text-faint)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6 }}>
            No hay órdenes con factura en este período
          </div>
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg)' }}>
                  <th style={{ textAlign: 'left', padding: '14px 20px', fontWeight: 500, fontSize: 11, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-soft)' }}>ID</th>
                  <th style={{ textAlign: 'left', padding: '14px 20px', fontWeight: 500, fontSize: 11, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-soft)' }}>Cliente</th>
                  <th style={{ textAlign: 'left', padding: '14px 20px', fontWeight: 500, fontSize: 11, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-soft)' }}>Tipo</th>
                  <th style={{ textAlign: 'left', padding: '14px 20px', fontWeight: 500, fontSize: 11, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-soft)' }}>Pedido</th>
                  <th style={{ textAlign: 'right', padding: '14px 20px', fontWeight: 500, fontSize: 11, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-soft)' }}>Venta</th>
                  <th style={{ textAlign: 'right', padding: '14px 20px', fontWeight: 500, fontSize: 11, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-soft)' }}>Costo est.</th>
                  <th style={{ textAlign: 'right', padding: '14px 20px', fontWeight: 500, fontSize: 11, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-soft)' }}>Ganancia</th>
                </tr>
              </thead>
              <tbody>
                {detalle.map(p => {
                  const isStock = p.TIPO === 'STOCK';
                  return (
                    <tr key={p.ORDEN_ID} style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => router.push(`/pedido/${encodeURIComponent(p.ORDEN_ID)}`)}>
                      <td style={{ padding: '14px 20px' }} className="mono">{p.ORDEN_ID}</td>
                      <td style={{ padding: '14px 20px' }} className="display">{p.NOMBRE}</td>
                      <td style={{ padding: '14px 20px' }}>
                        <span className="pill" style={{ background: isStock ? 'var(--amber-bg)' : 'var(--blue-bg)', color: isStock ? 'var(--amber)' : 'var(--blue)' }}>
                          {p.TIPO}
                        </span>
                      </td>
                      <td style={{ padding: '14px 20px', color: 'var(--text-soft)' }}>{fmtDateShort(p.F_ORDEN)}</td>
                      <td style={{ padding: '14px 20px', textAlign: 'right' }} className="tabular">{fmtMoney(p.venta)}</td>
                      <td style={{ padding: '14px 20px', textAlign: 'right', color: 'var(--text-soft)' }} className="tabular">{fmtMoney(p.costo)}</td>
                      <td style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 500 }} className="tabular">
                        <span style={{ color: p.ganancia >= 0 ? 'var(--green)' : 'var(--rose)' }}>{fmtMoney(p.ganancia)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
