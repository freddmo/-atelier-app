'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  api,
  PedidoPendienteCourier,
  LotePendienteCourier,
} from '@/lib/api';
import { auth } from '@/lib/auth';
import Navbar from '@/components/Navbar';

function fmtMoney(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function CargarCourierPage() {
  const router = useRouter();
  const today = new Date().toISOString().split('T')[0];

  const [pedidos, setPedidos] = useState<PedidoPendienteCourier[]>([]);
  const [lotes, setLotes] = useState<LotePendienteCourier[]>([]);
  const [loading, setLoading] = useState(true);

  const [costoCourier, setCostoCourier] = useState('');
  const [fecha, setFecha] = useState(today);

  const [pedidosSel, setPedidosSel] = useState<string[]>([]);
  const [lotesSel, setLotesSel] = useState<string[]>([]);

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
      const [peds, lots] = await Promise.all([
        api.getPedidosPendientesCourier(),
        api.getLotesPendientesCourier(),
      ]);
      setPedidos(peds);
      setLotes(lots);
    } catch (err) {
      alert('Error al cargar: ' + (err instanceof Error ? err.message : 'desconocido'));
    } finally {
      setLoading(false);
    }
  }

  function togglePedido(id: string) {
    setPedidosSel(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  }
  function toggleLote(id: string) {
    setLotesSel(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  }

  const pedidosElegidos = pedidos.filter(p => pedidosSel.includes(p.ORDEN_ID));
  const lotesElegidos = lotes.filter(l => lotesSel.includes(l.LOTE_ID));

  const itemsPedidos = pedidosElegidos.reduce((s, p) => s + p.numItems, 0);
  const itemsLotes = lotesElegidos.reduce((s, l) => s + l.CANT_INICIAL, 0);
  const totalItems = itemsPedidos + itemsLotes;

  const costoNum = Number(costoCourier) || 0;
  const costoPorItem = totalItems > 0 ? costoNum / totalItems : 0;

  async function handleSubmit() {
    if (totalItems === 0) {
      alert('Selecciona al menos un pedido o lote');
      return;
    }
    if (costoNum <= 0) {
      alert('Ingresa el costo del courier');
      return;
    }
    const user = auth.getUser();
    if (!user) return;

    setSubmitting(true);
    try {
      await api.cargarEnvioCourier({
        pedidos: pedidosElegidos.map(p => ({ ordenId: p.ORDEN_ID, numItems: p.numItems })),
        lotes: lotesElegidos.map(l => ({ loteId: l.LOTE_ID, cantInicial: l.CANT_INICIAL })),
        costoCourier: costoNum,
        fecha,
      }, user.usuario);

      setToast(`✅ Courier ${fmtMoney(costoNum)} repartido entre ${totalItems} items`);
      setTimeout(() => setToast(''), 4000);

      setPedidosSel([]);
      setLotesSel([]);
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
      <div className="fade-in" style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ marginBottom: 32 }}>
          <span className="number-tag">COSTOS · LOGÍSTICA</span>
          <h1 className="display" style={{ fontSize: 48, fontWeight: 300, margin: '6px 0 0', lineHeight: 1 }}>
            Cargar envío courier<em style={{ color: 'var(--gold)' }}>.</em>
          </h1>
          <p style={{ color: 'var(--text-soft)', fontSize: 14, margin: '12px 0 0', maxWidth: 640 }}>
            Marca los pedidos y lotes de stock que llegaron en este envío. El costo se reparte
            proporcional al número de items entre todo lo seleccionado.
          </p>
        </div>

        {/* 1. DATOS DEL ENVÍO */}
        <div className="card" style={{ padding: 28, marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 20px', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-soft)' }}>1. Datos del envío</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Fecha de llegada</label>
              <input type="date" className="input" value={fecha} onChange={(e) => setFecha(e.target.value)} style={{ marginTop: 4 }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Costo total courier ($)</label>
              <input type="number" step="0.01" className="input" value={costoCourier} onChange={(e) => setCostoCourier(e.target.value)} placeholder="0.00" style={{ marginTop: 4 }} />
            </div>
          </div>
        </div>

        {/* 2. PEDIDOS */}
        <div className="card" style={{ padding: 28, marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 6px', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-soft)' }}>
            2. Pedidos en este envío · <span className="tabular">{pedidosSel.length}</span> seleccionados
          </h3>
          <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: '0 0 16px' }}>
            Pedidos con costo de prenda cargado, pendientes de courier.
          </p>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-faint)' }}>Cargando…</div>
          ) : pedidos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-faint)', background: 'var(--bg)', borderRadius: 4 }}>
              No hay pedidos pendientes de courier.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {pedidos.map(p => {
                const sel = pedidosSel.includes(p.ORDEN_ID);
                return (
                  <div
                    key={p.ORDEN_ID}
                    onClick={() => togglePedido(p.ORDEN_ID)}
                    style={{
                      padding: '10px 14px', borderRadius: 4, cursor: 'pointer',
                      background: sel ? 'var(--bg)' : 'transparent',
                      border: `1px solid ${sel ? 'var(--text)' : 'var(--border)'}`,
                      display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 12, alignItems: 'center',
                    }}
                  >
                    <div style={{ width: 18, height: 18, borderRadius: 3, border: `1.5px solid ${sel ? 'var(--text)' : 'var(--border)'}`, background: sel ? 'var(--text)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 12 }}>
                      {sel ? '✓' : ''}
                    </div>
                    <div>
                      <div className="display" style={{ fontSize: 14 }}>{p.CLIENTE_NOMBRE}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-soft)' }}>
                        <span className="mono">{p.ORDEN_ID}</span> · {p.ESTATUS_ENVIO}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>{p.numItems} item{p.numItems !== 1 ? 's' : ''}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 3. LOTES DE STOCK */}
        <div className="card" style={{ padding: 28, marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 6px', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-soft)' }}>
            3. Lotes de stock en este envío · <span className="tabular">{lotesSel.length}</span> seleccionados
          </h3>
          <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: '0 0 16px' }}>
            Lotes de inventario pendientes de courier.
          </p>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-faint)' }}>Cargando…</div>
          ) : lotes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-faint)', background: 'var(--bg)', borderRadius: 4 }}>
              No hay lotes pendientes de courier.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {lotes.map(l => {
                const sel = lotesSel.includes(l.LOTE_ID);
                return (
                  <div
                    key={l.LOTE_ID}
                    onClick={() => toggleLote(l.LOTE_ID)}
                    style={{
                      padding: '10px 14px', borderRadius: 4, cursor: 'pointer',
                      background: sel ? 'var(--bg)' : 'transparent',
                      border: `1px solid ${sel ? 'var(--text)' : 'var(--border)'}`,
                      display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 12, alignItems: 'center',
                    }}
                  >
                    <div style={{ width: 18, height: 18, borderRadius: 3, border: `1.5px solid ${sel ? 'var(--text)' : 'var(--border)'}`, background: sel ? 'var(--text)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 12 }}>
                      {sel ? '✓' : ''}
                    </div>
                    <div>
                      <div className="display" style={{ fontSize: 14 }}>{l.SKU}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-soft)' }}>
                        <span className="mono">{l.LOTE_ID}</span> · {l.TALLA} · {l.LONGITUD} · {l.COLOR}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>{l.CANT_INICIAL} item{l.CANT_INICIAL !== 1 ? 's' : ''}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 4. PREVIEW */}
        {totalItems > 0 && costoNum > 0 && (
          <div className="card" style={{ padding: 28, marginBottom: 20, background: 'linear-gradient(to right, rgba(184,149,78,0.04), transparent)', borderColor: 'var(--gold)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--gold)' }}>
              4. Preview · Reparto del courier
            </h3>
            <div style={{ fontSize: 12, color: 'var(--text-soft)', marginBottom: 12 }}>
              {fmtMoney(costoNum)} ÷ {totalItems} items = <strong>{fmtMoney(costoPorItem)}</strong> por item
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {pedidosElegidos.map(p => (
                <div key={p.ORDEN_ID} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, fontSize: 12, padding: '4px 0' }}>
                  <span><span className="mono" style={{ color: 'var(--text-soft)' }}>{p.ORDEN_ID}</span> {p.CLIENTE_NOMBRE}</span>
                  <span className="tabular" style={{ color: 'var(--text-faint)' }}>{p.numItems} items</span>
                  <span className="display tabular" style={{ color: 'var(--gold)', minWidth: 80, textAlign: 'right' }}>{fmtMoney(costoPorItem * p.numItems)}</span>
                </div>
              ))}
              {lotesElegidos.map(l => (
                <div key={l.LOTE_ID} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, fontSize: 12, padding: '4px 0' }}>
                  <span><span className="mono" style={{ color: 'var(--gold)' }}>{l.LOTE_ID}</span> {l.SKU}</span>
                  <span className="tabular" style={{ color: 'var(--text-faint)' }}>{l.CANT_INICIAL} items</span>
                  <span className="display tabular" style={{ color: 'var(--gold)', minWidth: 80, textAlign: 'right' }}>{fmtMoney(costoPorItem * l.CANT_INICIAL)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SUBMIT */}
        <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={() => router.push('/pedidos')} disabled={submitting}>Cancelar</button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={submitting || totalItems === 0 || costoNum <= 0}
          >
            {submitting ? 'Guardando…' : `Distribuir courier (${totalItems} items)`}
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
