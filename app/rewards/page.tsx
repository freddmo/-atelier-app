'use client';

// ScrubMe Rewards: puntos de cada clienta, quiénes están cerca de una recompensa,
// catálogo y cuánto ha costado el programa. Solo admin.

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { api, type RewardsResumen } from '@/lib/api';
import { auth } from '@/lib/auth';

const money = (n: number) => `$${(Number(n) || 0).toFixed(2)}`;
const fechaCorta = (f: string) => {
  if (!f) return '';
  const [y, m, d] = f.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-EC', { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function RewardsPage() {
  const router = useRouter();
  const [data, setData] = useState<RewardsResumen | null>(null);
  const [error, setError] = useState('');
  const [buscar, setBuscar] = useState('');
  const [filtro, setFiltro] = useState<'todas' | 'alcanza' | 'cerca'>('todas');
  const [ajuste, setAjuste] = useState<{ cliente: string; puntos: string; nota: string } | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    try { setData(await api.getRewards()); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Error'); }
  }

  useEffect(() => {
    const u = auth.getUser();
    if (!u) { router.push('/login'); return; }
    if (u.rol !== 'admin') { router.push('/pedidos'); return; }
    cargar();
  }, [router]);

  const clientes = useMemo(() => {
    if (!data) return [];
    const q = buscar.trim().toLowerCase();
    return data.clientes.filter(c => {
      if (q && !c.cliente.toLowerCase().includes(q)) return false;
      if (filtro === 'alcanza') return !!c.alcanza;
      if (filtro === 'cerca') return !c.alcanza && !!c.siguiente && c.siguiente.faltan <= 6 && c.saldo > 0;
      return true;
    });
  }, [data, buscar, filtro]);

  async function guardarAjuste() {
    if (!ajuste) return;
    const user = auth.getUser();
    if (!user) return;
    const pts = Math.round(Number(ajuste.puntos));
    if (!pts) { alert('Escribe los puntos (positivos para sumar, negativos para restar)'); return; }
    setGuardando(true);
    try {
      await api.ajustarPuntos(ajuste.cliente, pts, ajuste.nota, user.usuario);
      setAjuste(null);
      await cargar();
    } catch (e) {
      alert('No se pudo guardar: ' + (e instanceof Error ? e.message : 'desconocido'));
    } finally { setGuardando(false); }
  }

  const label = { fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase' as const, letterSpacing: '0.06em' };

  return (
    <>
      <Navbar />
      <div className="fade-in" style={{ maxWidth: 980, margin: '0 auto', padding: '28px 24px' }}>
        <h1 className="display" style={{ fontSize: 40, fontWeight: 400, margin: '0 0 6px' }}>ScrubMe Rewards</h1>
        {data && (
          <p style={{ color: 'var(--text-soft)', fontSize: 13, margin: '0 0 22px', lineHeight: 1.5 }}>
            {data.puntosPorUniforme} puntos por uniforme completo (set o jumpsuit), desde la segunda compra, en pedidos hechos desde el {fechaCorta(data.inicio)}.
            Se ganan al entregar y pagar el pedido; vencen a los {data.mesesVigencia} meses.
          </p>
        )}
        {error && <div className="card" style={{ padding: 14, color: 'var(--rose)', marginBottom: 16 }}>{error}</div>}
        {!data && !error && <div style={{ color: 'var(--text-faint)', padding: 30, textAlign: 'center' }}>Cargando…</div>}

        {data && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 1, background: 'var(--border)', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', marginBottom: 22 }}>
              {[
                { l: 'Puntos vigentes', v: String(data.totales.puntosVigentes) },
                { l: 'Por ganar (pedidos en curso)', v: String(data.totales.puntosPorGanar) },
                { l: 'Clientas con puntos', v: String(data.clientes.filter(c => c.saldo > 0).length) },
                { l: 'Costo de premios canjeados', v: money(data.totales.costoCanjeado) },
              ].map(k => (
                <div key={k.l} style={{ background: 'var(--surface)', padding: '14px 16px' }}>
                  <div style={label}>{k.l}</div>
                  <div className="display tabular" style={{ fontSize: 26 }}>{k.v}</div>
                </div>
              ))}
            </div>

            {/* CATÁLOGO */}
            <div className="card m-pad" style={{ padding: 20, marginBottom: 20 }}>
              <div style={{ ...label, marginBottom: 10 }}>Catálogo de recompensas</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {data.catalogo.map(r => (
                  <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', fontSize: 14, opacity: r.activo ? 1 : 0.45 }}>
                    <span>{r.nombre}{!r.activo && ' (inactiva)'}{!r.sku && <span style={{ color: 'var(--amber)', fontSize: 12 }}> · falta el SKU para sacarla del stock</span>}</span>
                    <span className="tabular"><strong>{r.puntos} pts</strong> <span style={{ color: 'var(--text-faint)' }}>· costo {money(r.costo)}</span></span>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: '10px 0 0' }}>Se edita en la hoja TablaRecompensas (puntos, costo, SKU y si está activa).</p>
            </div>

            {/* CANJES POR MES */}
            {data.canjesPorMes.length > 0 && (
              <div className="card m-pad" style={{ padding: 20, marginBottom: 20 }}>
                <div style={{ ...label, marginBottom: 10 }}>Premios canjeados por mes (lo paga ScrubMe)</div>
                {data.canjesPorMes.map(m => (
                  <div key={m.mes} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '4px 0' }}>
                    <span>{m.mes} · {m.canjes} canje{m.canjes === 1 ? '' : 's'} · {m.puntos} pts</span>
                    <span className="tabular">{money(m.costo)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* CLIENTAS */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
              <input className="input" placeholder="Buscar clienta…" value={buscar} onChange={e => setBuscar(e.target.value)} style={{ flex: '1 1 220px' }} />
              <div role="group" aria-label="Filtro" style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 100, overflow: 'hidden' }}>
                {([['todas', 'Todas'], ['alcanza', 'Ya pueden canjear'], ['cerca', 'Cerca (≤6 pts)']] as const).map(([k, t]) => (
                  <button key={k} onClick={() => setFiltro(k)} aria-pressed={filtro === k}
                    style={{ minHeight: 36, padding: '0 12px', border: 'none', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                      background: filtro === k ? 'var(--text)' : 'var(--surface)', color: filtro === k ? 'var(--surface)' : 'var(--text-soft)' }}>{t}</button>
                ))}
              </div>
            </div>

            {clientes.length === 0 ? (
              <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--text-faint)' }}>
                Todavía no hay clientas con puntos. Los primeros llegan cuando se entregue y pague una segunda compra hecha desde el {fechaCorta(data.inicio)}.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {clientes.map(c => (
                  <div key={c.cliente} className="card" style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
                      <span style={{ fontSize: 15, fontWeight: 500 }}>{c.cliente}</span>
                      <span className="display tabular" style={{ fontSize: 22 }}>⭐ {c.saldo} <span style={{ fontSize: 13, color: 'var(--text-faint)' }}>pts</span></span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-soft)', marginTop: 4, lineHeight: 1.6 }}>
                      {c.compras} compra{c.compras === 1 ? '' : 's'}
                      {c.porGanar > 0 && <> · +{c.porGanar} por ganar</>}
                      {c.usados > 0 && <> · {c.usados} usados</>}
                      {c.vencidos > 0 && <> · {c.vencidos} vencidos</>}
                      {c.alcanza && <> · <strong style={{ color: 'var(--green)' }}>Ya puede canjear: {c.alcanza}</strong></>}
                      {c.siguiente && <> · Siguiente: {c.siguiente.nombre} (faltan {c.siguiente.faltan})</>}
                      {c.proximoVencimiento && <> · {c.proximoVencimiento.puntos} pts vencen el {fechaCorta(c.proximoVencimiento.fecha)}</>}
                    </div>
                    {c.canjes.length > 0 && (
                      <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 4 }}>
                        {c.canjes.map(x => `${fechaCorta(x.fecha)}: ${x.tipo === 'CANJE' ? x.recompensa : 'ajuste'} (−${x.pts})${x.orden ? ' ' + x.orden : ''}`).join(' · ')}
                      </div>
                    )}
                    <button onClick={() => setAjuste({ cliente: c.cliente, puntos: '', nota: '' })}
                      style={{ marginTop: 6, background: 'none', border: 'none', padding: 0, minHeight: 28, fontSize: 12, color: 'var(--text-soft)', textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit' }}>
                      Ajustar puntos
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {ajuste && (
        <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) setAjuste(null); }}>
          <div className="modal-content" style={{ padding: 26, maxWidth: 420 }}>
            <h2 className="display" style={{ fontSize: 22, fontWeight: 400, margin: '0 0 6px' }}>Ajustar puntos</h2>
            <p style={{ fontSize: 13, color: 'var(--text-soft)', margin: '0 0 14px' }}>{ajuste.cliente}. Usa números negativos para restar.</p>
            <label style={label}>Puntos</label>
            <input className="input tabular" type="number" inputMode="numeric" value={ajuste.puntos} onChange={e => setAjuste({ ...ajuste, puntos: e.target.value })} style={{ marginTop: 2, marginBottom: 10 }} />
            <label style={label}>Motivo</label>
            <input className="input" value={ajuste.nota} onChange={e => setAjuste({ ...ajuste, nota: e.target.value })} placeholder="Ej. corrección, bienvenida…" style={{ marginTop: 2, marginBottom: 16 }} />
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setAjuste(null)} disabled={guardando}>Cancelar</button>
              <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={guardarAjuste} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
