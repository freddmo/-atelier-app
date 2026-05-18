'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api, PedidoPendienteCourier } from '@/lib/api';
import { auth } from '@/lib/auth';
import Navbar from '@/components/Navbar';

function fmtMoney(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDateShort(d: string) {
  if (!d) return '';
  return new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

export default function CargarCourierPage() {
  const router = useRouter();
  const today = new Date().toISOString().split('T')[0];

  const [pedidos, setPedidos] = useState<PedidoPendienteCourier[]>([]);
  const [loading, setLoading] = useState(true);
  const [seleccionados, setSeleccionados] = useState<string[]>([]);
  const [costoCourier, setCostoCourier] = useState('');
  const [fecha, setFecha] = useState(today);
  const [searchQuery, setSearchQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    const user = auth.getUser();
    if (!user) { router.replace('/login'); return; }
    if (user.rol !== 'admin') { router.replace('/pedidos'); return; }
    load();
  }, [router]);

  async function load() {
    setLoading(true);
    try {
      const data = await api.getPedidosPendientesCourier();
      setPedidos(data);
    } catch (err) {
      alert('Error: ' + (err instanceof Error ? err.message : 'desconocido'));
    } finally {
      setLoading(false);
    }
  }

  function toggle(ordenId: string) {
    setSeleccionados(s => 
      s.includes(ordenId) ? s.filter(x => x !== ordenId) : [...s, ordenId]
    );
  }

  const pedidosSeleccionados = pedidos.filter(p => seleccionados.includes(p.ORDEN_ID));
  const totalVentas = pedidosSeleccionados.reduce((s, p) => s + p.totalVenta, 0);
  const costoNum = Number(costoCourier) || 0;

  const preview = pedidosSeleccionados.map(p => {
    const pct = totalVentas > 0 ? p.totalVenta / totalVentas : 0;
    const courier = costoNum * pct;
    return { ...p, pct, courier };
  });

  const filtered = pedidos.filter(p => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return p.NOMBRE.toLowerCase().includes(q) || p.ORDEN_ID.toLowerCase().includes(q);
  });

  async function handleSubmit() {
    if (seleccionados.length === 0) { alert('Selecciona al menos un pedido'); return; }
    if (costoNum <= 0) { alert('Ingresa el costo del courier'); return; }
    
    const user = auth.getUser();
    if (!user) return;

    setSubmitting(true);
    try {
      await api.cargarEnvioCourier({
        pedidos: pedidosSeleccionados.map(p => ({ ORDEN_ID: p.ORDEN_ID, totalVenta: p.totalVenta })),
        costoCourier: costoNum,
        fecha,
      }, user.usuario);

      setToast(`✅ Courier distribuido: ${seleccionados.length} pedidos por ${fmtMoney(costoNum)}`);
      setTimeout(() => setToast(''), 3500);
      
      setSeleccionados([]);
      setCostoCourier('');
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
          <span className="number-tag">COSTOS · LOGÍSTICA</span>
          <h1 className="display" style={{ fontSize: 48, fontWeight: 300, margin: '6px 0 0', lineHeight: 1 }}>
            Cargar envío courier<em style={{ color: 'var(--gold)' }}>.</em>
          </h1>
          <p style={{ color: 'var(--text-soft)', fontSize: 14, margin: '12px 0 0', maxWidth: 600 }}>
            Selecciona los pedidos que llegaron en este envío. El costo del courier se reparte proporcional al precio de venta de cada uno.
          </p>
        </div>

        <div className="card" style={{ padding: 28, marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-soft)' }}>1. Datos del envío</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fecha de llegada</label>
              <input type="date" className="input" value={fecha} onChange={(e) => setFecha(e.target.value)} style={{ marginTop: 4 }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Costo total courier ($)</label>
              <input type="number" step="0.01" className="input" value={costoCourier} onChange={(e) => setCostoCourier(e.target.value)} style={{ marginTop: 4 }} placeholder="0.00" />
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 28, marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 14px', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-soft)' }}>
            2. Pedidos en este envío · <span className="tabular">{seleccionados.length}</span> seleccionados
          </h3>
          
          <input
            className="input"
            placeholder="Buscar por cliente o ID…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ marginBottom: 14 }}
          />

          {loading ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-faint)' }}>Cargando…</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-faint)', background: 'var(--bg)', borderRadius: 4 }}>
              {pedidos.length === 0 ? 'No hay pedidos pendientes de courier' : 'Ningún pedido coincide'}
            </div>
          ) : (
            <div style={{ maxHeight: 360, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {filtered.map(p => {
                const selected = seleccionados.includes(p.ORDEN_ID);
                return (
                  <div
                    key={p.ORDEN_ID}
                    onClick={() => toggle(p.ORDEN_ID)}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 4,
                      cursor: 'pointer',
                      background: selected ? 'var(--bg)' : 'transparent',
                      border: `1px solid ${selected ? 'var(--text)' : 'var(--border)'}`,
                      display: 'grid',
                      gridTemplateColumns: 'auto 1fr auto auto',
                      gap: 12,
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ width: 18, height: 18, borderRadius: 3, border: `1.5px solid ${selected ? 'var(--text)' : 'var(--border)'}`, background: selected ? 'var(--text)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 12 }}>
                      {selected ? '✓' : ''}
                    </div>
                    <div>
                      <div className="display" style={{ fontSize: 14 }}>{p.NOMBRE}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-soft)' }}>
                        <span className="mono">{p.ORDEN_ID}</span> · {fmtDateShort(p.F_ORDEN)} · {p.cantidadItems} item{p.cantidadItems !== 1 ? 's' : ''} · {p.ESTATUS_ENVIO}
                      </div>
                    </div>
                    <div className="tabular" style={{ fontSize: 12, color: 'var(--text-soft)', minWidth: 70, textAlign: 'right' }}>
                      {fmtMoney(p.totalVenta)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {seleccionados.length > 0 && costoNum > 0 && (
          <div className="card" style={{ padding: 28, marginBottom: 20, background: 'linear-gradient(to right, rgba(184,149,78,0.04), transparent)', borderColor: 'var(--gold)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--gold)' }}>
              3. Preview · Courier por pedido
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {preview.map(p => (
                <div key={p.ORDEN_ID} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 12, alignItems: 'center', padding: '8px 14px', fontSize: 12 }}>
                  <div>
                    <span className="mono" style={{ color: 'var(--text-soft)' }}>{p.ORDEN_ID}</span>
                    <span style={{ marginLeft: 8 }}>{p.NOMBRE}</span>
                  </div>
                  <span className="tabular" style={{ color: 'var(--text-soft)' }}>Venta {fmtMoney(p.totalVenta)}</span>
                  <span className="tabular" style={{ color: 'var(--text-faint)' }}>{(p.pct * 100).toFixed(1)}%</span>
                  <span className="display tabular" style={{ fontSize: 15, color: 'var(--gold)', minWidth: 80, textAlign: 'right' }}>{fmtMoney(p.courier)}</span>
                </div>
              ))}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 6, display: 'flex', justifyContent: 'flex-end', gap: 16, fontSize: 13 }}>
                <span style={{ color: 'var(--text-soft)' }}>Total a distribuir:</span>
                <span className="display tabular" style={{ fontSize: 20, color: 'var(--gold)' }}>{fmtMoney(costoNum)}</span>
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={() => router.push('/pedidos')} disabled={submitting}>Cancelar</button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={submitting || seleccionados.length === 0 || costoNum <= 0}
          >
            {submitting ? 'Guardando…' : `Distribuir ${fmtMoney(costoNum)}`}
          </button>
        </div>
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'var(--text)', color: 'var(--surface)', padding: '14px 24px', borderRadius: 4, fontSize: 13, zIndex: 100, boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }}>
          {toast}
        </div>
      )}
    </>
  );
}
