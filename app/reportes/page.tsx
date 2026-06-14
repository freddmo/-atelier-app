'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { auth } from '@/lib/auth';
import { Pedido } from '@/lib/types';
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

type TipoFiltro = 'TODOS' | 'PEDIDO' | 'STOCK';

export default function ReportesPage() {
  const router = useRouter();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [gananciaTipo, setGananciaTipo] = useState<{
    stock: { piezas: number; venta: number; costo: number; ganancia: number };
    pedido: { piezas: number; venta: number; costo: number; ganancia: number };
  } | null>(null);
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const [fechaInicio, setFechaInicio] = useState(firstOfMonth.toISOString().split('T')[0]);
  const [fechaFin, setFechaFin] = useState(today.toISOString().split('T')[0]);
  const [tipoFiltro, setTipoFiltro] = useState<TipoFiltro>('TODOS');

  useEffect(() => {
    const user = auth.getUser();
    if (!user) { router.replace('/login'); return; }
    if (user.rol !== 'admin') { router.replace('/pedidos'); return; }
    load();
  }, [router]);

  async function load() {
    setLoading(true);
    try {
      const [data, gt] = await Promise.all([
        api.getPedidos(),
        api.getGananciaPorTipo().catch(() => null),
      ]);
      setPedidos(data);
      setGananciaTipo(gt);
    } finally {
      setLoading(false);
    }
  }

  const filteredByDate = pedidos.filter(p => {
    if (!p.F_ORDEN) return false;
    return p.F_ORDEN >= fechaInicio && p.F_ORDEN <= fechaFin;
  });

  const filtered = filteredByDate.filter(p => {
    if (tipoFiltro === 'TODOS') return true;
    const tipo = String(p.TIPO_DE_ORDEN || '').toUpperCase().trim();
    return tipo === tipoFiltro;
  });

  const countTodos = filteredByDate.length;
  const countPedido = filteredByDate.filter(p => String(p.TIPO_DE_ORDEN || '').toUpperCase().trim() === 'PEDIDO').length;
  const countStock = filteredByDate.filter(p => String(p.TIPO_DE_ORDEN || '').toUpperCase().trim() === 'STOCK').length;

  const totalVenta = filtered.reduce((a, p) => a + p.totales.venta, 0);
  const totalCostos = filtered.reduce((a, p) => a + p.totales.costos, 0);
  const ganancia = totalVenta - totalCostos;
  const margen = totalVenta > 0 ? (ganancia / totalVenta * 100) : 0;
  const promedio = filtered.length > 0 ? totalVenta / filtered.length : 0;

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

  function tabStyle(active: boolean, color: string) {
    return {
      flex: 1,
      padding: '12px 16px',
      cursor: 'pointer' as const,
      textAlign: 'center' as const,
      fontSize: 13,
      fontWeight: active ? 600 : 400,
      letterSpacing: '0.02em',
      background: active ? 'var(--surface)' : 'transparent',
      color: active ? color : 'var(--text-soft)',
      borderBottom: `2px solid ${active ? color : 'transparent'}`,
      transition: 'all 0.15s',
    };
  }

  return (
    <>
      <Navbar />
      <div className="fade-in" style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ marginBottom: 32 }}>
          <span className="number-tag">ANÁLISIS · GANANCIAS</span>
          <h1 className="display" style={{ fontSize: 48, fontWeight: 300, margin: '6px 0 0', lineHeight: 1 }}>
            Reportes<em style={{ color: 'var(--gold)' }}>.</em>
          </h1>
          <p style={{ color: 'var(--text-soft)', fontSize: 14, margin: '12px 0 0' }}>Ganancia y desempeño por período</p>
        </div>

        {/* ===== GANANCIA REAL POR ORIGEN (por pieza, todo el histórico) ===== */}
        {gananciaTipo && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, color: 'var(--text-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
              Ganancia real por origen
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: '0 0 14px' }}>
              Calculado pieza por pieza sobre todo el histórico. Cada prenda cuenta según de dónde salió (stock o pedido).
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
              {[
                { label: 'Ganancia · Pedidos', d: gananciaTipo.pedido, color: 'var(--blue)' },
                { label: 'Ganancia · Stock', d: gananciaTipo.stock, color: 'var(--amber)' },
              ].map(({ label, d, color }) => {
                const margenTipo = d.venta > 0 ? (d.ganancia / d.venta * 100) : 0;
                return (
                  <div key={label} className="card" style={{ padding: 24, borderTop: `3px solid ${color}` }}>
                    <div style={{ fontSize: 11, color: 'var(--text-soft)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
                      {label} · <span className="tabular">{d.piezas}</span> pza
                    </div>
                    <div className="display tabular" style={{ fontSize: 40, fontWeight: 300, color: d.ganancia >= 0 ? 'var(--green)' : 'var(--rose)', lineHeight: 1, marginBottom: 12 }}>
                      {fmtMoney(d.ganancia)}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-soft)', borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                      <span>Venta <span className="tabular" style={{ color: 'var(--text)' }}>{fmtMoney(d.venta)}</span></span>
                      <span>Costo <span className="tabular" style={{ color: 'var(--text)' }}>{fmtMoney(d.costo)}</span></span>
                      <span>Margen <span className="tabular" style={{ color: margenTipo >= 25 ? 'var(--green)' : 'var(--amber)' }}>{margenTipo.toFixed(1)}%</span></span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="card" style={{ padding: 0, marginBottom: 16, overflow: 'hidden' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
            <div onClick={() => setTipoFiltro('TODOS')} style={tabStyle(tipoFiltro === 'TODOS', 'var(--text)')}>
              Todos <span style={{ opacity: 0.6, marginLeft: 4 }}>({countTodos})</span>
            </div>
            <div onClick={() => setTipoFiltro('PEDIDO')} style={tabStyle(tipoFiltro === 'PEDIDO', 'var(--blue)')}>
              Pedidos <span style={{ opacity: 0.6, marginLeft: 4 }}>({countPedido})</span>
            </div>
            <div onClick={() => setTipoFiltro('STOCK')} style={tabStyle(tipoFiltro === 'STOCK', 'var(--amber)')}>
              Stock <span style={{ opacity: 0.6, marginLeft: 4 }}>({countStock})</span>
            </div>
          </div>
        </div>

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

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 1, background: 'var(--border)', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', marginBottom: 24 }}>
          <div style={{ background: 'var(--surface)', padding: 28 }}>
            <div style={{ fontSize: 11, color: 'var(--text-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>
              Ganancia · {tipoFiltro === 'TODOS' ? 'Todos' : tipoFiltro === 'PEDIDO' ? 'Pedidos' : 'Stock'}
            </div>
            <div className="display tabular" style={{ fontSize: 56, fontWeight: 300, color: ganancia >= 0 ? 'var(--green)' : 'var(--rose)', lineHeight: 1, marginBottom: 8 }}>
              {fmtMoney(ganancia)}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-soft)' }}>
              Margen: <span className="tabular" style={{ color: margen >= 30 ? 'var(--green)' : 'var(--amber)' }}>{margen.toFixed(1)}%</span>
            </div>
          </div>
          <div style={{ background: 'var(--surface)', padding: 20 }}>
            <div style={{ fontSize: 10, color: 'var(--text-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>Total facturado</div>
            <span className="display tabular" style={{ fontSize: 28, fontWeight: 300, color: 'var(--text)', lineHeight: 1 }}>{fmtMoney(totalVenta)}</span>
          </div>
          <div style={{ background: 'var(--surface)', padding: 20 }}>
            <div style={{ fontSize: 10, color: 'var(--text-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>Cantidad</div>
            <span className="display tabular" style={{ fontSize: 36, fontWeight: 300, color: 'var(--blue)', lineHeight: 1 }}>{filtered.length}</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, background: 'var(--border)', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', marginBottom: 32 }}>
          <div style={{ background: 'var(--surface)', padding: 20 }}>
            <div style={{ fontSize: 10, color: 'var(--text-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>Total costos</div>
            <span className="display tabular" style={{ fontSize: 24, fontWeight: 300, color: 'var(--rose)' }}>{fmtMoney(totalCostos)}</span>
          </div>
          <div style={{ background: 'var(--surface)', padding: 20 }}>
            <div style={{ fontSize: 10, color: 'var(--text-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>Ticket promedio</div>
            <span className="display tabular" style={{ fontSize: 24, fontWeight: 300, color: 'var(--text)' }}>{fmtMoney(promedio)}</span>
          </div>
          <div style={{ background: 'var(--surface)', padding: 20 }}>
            <div style={{ fontSize: 10, color: 'var(--text-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>Ganancia por orden</div>
            <span className="display tabular" style={{ fontSize: 24, fontWeight: 300, color: 'var(--green)' }}>{fmtMoney(filtered.length > 0 ? ganancia / filtered.length : 0)}</span>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <h2 className="display" style={{ fontSize: 24, fontWeight: 400, margin: '0 0 4px' }}>
            Detalle {tipoFiltro === 'TODOS' ? 'de todas las órdenes' : tipoFiltro === 'PEDIDO' ? 'de pedidos' : 'de stock'}
          </h2>
          <p style={{ color: 'var(--text-soft)', fontSize: 13, margin: 0 }}>
            {filtered.length} órden{filtered.length === 1 ? '' : 'es'} entre {fmtDate(fechaInicio)} y {fmtDate(fechaFin)}
          </p>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-faint)' }}>Cargando…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 64, color: 'var(--text-faint)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6 }}>
            No hay {tipoFiltro === 'TODOS' ? 'órdenes' : tipoFiltro === 'PEDIDO' ? 'pedidos' : 'órdenes de stock'} en este período
          </div>
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg)' }}>
                  <th style={{ textAlign: 'left', padding: '14px 20px', fontWeight: 500, fontSize: 11, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-soft)' }}>ID</th>
                  <th style={{ textAlign: 'left', padding: '14px 20px', fontWeight: 500, fontSize: 11, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-soft)' }}>Cliente / Concepto</th>
                  <th style={{ textAlign: 'left', padding: '14px 20px', fontWeight: 500, fontSize: 11, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-soft)' }}>Tipo</th>
                  <th style={{ textAlign: 'left', padding: '14px 20px', fontWeight: 500, fontSize: 11, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-soft)' }}>Fecha</th>
                  <th style={{ textAlign: 'right', padding: '14px 20px', fontWeight: 500, fontSize: 11, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-soft)' }}>Venta</th>
                  <th style={{ textAlign: 'right', padding: '14px 20px', fontWeight: 500, fontSize: 11, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-soft)' }}>Costos</th>
                  <th style={{ textAlign: 'right', padding: '14px 20px', fontWeight: 500, fontSize: 11, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-soft)' }}>Ganancia</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const g = p.totales.ganancia;
                  const tipo = String(p.TIPO_DE_ORDEN || '').toUpperCase().trim();
                  const isStock = tipo === 'STOCK';
                  return (
                    <tr key={p.ORDEN_ID} style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => router.push(`/pedido/${encodeURIComponent(p.ORDEN_ID)}`)}>
                      <td style={{ padding: '14px 20px' }} className="mono">{p.ORDEN_ID}</td>
                      <td style={{ padding: '14px 20px' }} className="display">{p.NOMBRE}</td>
                      <td style={{ padding: '14px 20px' }}>
                        <span className="pill" style={{ background: isStock ? 'var(--amber-bg)' : 'var(--blue-bg)', color: isStock ? 'var(--amber)' : 'var(--blue)' }}>
                          {tipo || '—'}
                        </span>
                      </td>
                      <td style={{ padding: '14px 20px', color: 'var(--text-soft)' }}>{fmtDateShort(p.F_ORDEN)}</td>
                      <td style={{ padding: '14px 20px', textAlign: 'right' }} className="tabular">{fmtMoney(p.totales.venta)}</td>
                      <td style={{ padding: '14px 20px', textAlign: 'right', color: 'var(--text-soft)' }} className="tabular">{fmtMoney(p.totales.costos)}</td>
                      <td style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 500 }} className="tabular">
                        <span style={{ color: g >= 0 ? 'var(--green)' : 'var(--rose)' }}>{fmtMoney(g)}</span>
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
