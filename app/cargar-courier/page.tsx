'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  api,
  type Cuenta,
  PedidoItemsCourier,
  LotePendienteCourier,
} from '@/lib/api';
import { auth } from '@/lib/auth';
import Navbar from '@/components/Navbar';

function fmtMoney(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function CargarCourierPage() {
  const router = useRouter();

  const [pedidosItems, setPedidosItems] = useState<PedidoItemsCourier[]>([]);
  const [lotes, setLotes] = useState<LotePendienteCourier[]>([]);
  const [loading, setLoading] = useState(true);

  const [costoCourier, setCostoCourier] = useState('');
  const [fecha, setFecha] = useState('');

  const [itemsSel, setItemsSel] = useState<Set<number>>(new Set());
  // Stock: cuántas piezas SIN VENDER llegaron de cada lote, y qué piezas VENDIDAS llegaron
  // (estas se marcan bajo la clienta; clave = "LOTE|PEDIDO|FILA").
  const [sinVenderSel, setSinVenderSel] = useState<Record<string, number>>({});
  const [stockSel, setStockSel] = useState<Set<string>>(new Set());

  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState('');

  // Con qué se pagó el courier ('' = automático: ScrubMe #2)
  const [cuentasPago, setCuentasPago] = useState<Cuenta[]>([]);
  const [cuentaElegida, setCuentaElegida] = useState('');
  const cuentaPago = cuentaElegida || cuentasPago.find(c => c.nombre.includes('#2'))?.id || cuentasPago[0]?.id || '';

  useEffect(() => {
    const user = auth.getUser();
    if (!user) { router.replace('/login'); return; }
    if (user.rol !== 'admin') { router.replace('/pedidos'); return; }
    // Se calcula aquí (solo en el navegador) para evitar un mismatch de
    // hydration entre el servidor (UTC) y el cliente (Ecuador) — este
    // campo SÍ se muestra en pantalla (input de fecha de llegada).
    setFecha((() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })());
    api.getCuentas()
      .then(cs => setCuentasPago(cs.filter(c => ['BANCO', 'EFECTIVO', 'TARJETA'].includes(c.tipo))))
      .catch(() => setCuentasPago([]));
    load();
  }, [router]);

  async function load() {
    setLoading(true);
    try {
      const [peds, lots] = await Promise.all([
        api.getItemsPendientesCourier(),
        api.getLotesPendientesCourier(),
      ]);
      setPedidosItems(peds);
      setLotes(lots);
    } catch (err) {
      alert('Error al cargar: ' + (err instanceof Error ? err.message : 'desconocido'));
    } finally {
      setLoading(false);
    }
  }

  function toggleItem(rowNum: number) {
    setItemsSel(prev => {
      const next = new Set(prev);
      if (next.has(rowNum)) next.delete(rowNum); else next.add(rowNum);
      return next;
    });
  }
  const claveStock = (ordenId: string, it: PedidoItemsCourier['items'][number]) => `${it.LOTE}|${ordenId}|${it._rowNum}`;
  const marcado = (ordenId: string, it: PedidoItemsCourier['items'][number]) =>
    it.DE_STOCK ? stockSel.has(claveStock(ordenId, it)) : itemsSel.has(it._rowNum);
  function toggleStock(clave: string) {
    setStockSel(prev => { const n = new Set(prev); if (n.has(clave)) n.delete(clave); else n.add(clave); return n; });
  }
  function togglePedidoCompleto(p: PedidoItemsCourier) {
    const todosMarcados = p.items.every(it => marcado(p.ORDEN_ID, it));
    setItemsSel(prev => {
      const next = new Set(prev);
      p.items.filter(it => !it.DE_STOCK).forEach(it => { if (todosMarcados) next.delete(it._rowNum); else next.add(it._rowNum); });
      return next;
    });
    setStockSel(prev => {
      const next = new Set(prev);
      p.items.filter(it => it.DE_STOCK).forEach(it => { const k = claveStock(p.ORDEN_ID, it); if (todosMarcados) next.delete(k); else next.add(k); });
      return next;
    });
  }
  function setLlegaronSinVender(id: string, n: number, max: number) {
    setSinVenderSel(prev => ({ ...prev, [id]: Math.max(0, Math.min(max, n)) }));
  }

  // Aplanar todos los ítems con su pedido, para cálculos y submit
  const todosItems = pedidosItems.flatMap(p =>
    p.items.map(it => ({ ...it, ordenId: p.ORDEN_ID, clienteNombre: p.CLIENTE_NOMBRE }))
  );
  const itemsElegidos = todosItems.filter(it => !it.DE_STOCK && itemsSel.has(it._rowNum));
  // Por lote: piezas vendidas que llegaron (marcadas bajo cada clienta) + piezas sin vender que llegaron
  const vendidasPorLote: Record<string, Record<string, number>> = {};
  todosItems.filter(it => it.DE_STOCK && it.LOTE && stockSel.has(`${it.LOTE}|${it.ordenId}|${it._rowNum}`)).forEach(it => {
    const l = it.LOTE as string;
    vendidasPorLote[l] = vendidasPorLote[l] || {};
    vendidasPorLote[l][it.ordenId] = (vendidasPorLote[l][it.ordenId] || 0) + it.CANTIDAD;
  });
  const lotesElegidos = lotes
    .map(l => {
      const vend = vendidasPorLote[l.LOTE_ID] || {};
      const nVend = Object.values(vend).reduce((a, b) => a + b, 0);
      const sinVender = sinVenderSel[l.LOTE_ID] || 0;
      return { ...l, vend, nVend, sinVender, llegaron: nVend + sinVender };
    })
    .filter(l => l.llegaron > 0);

  const itemsItems = itemsElegidos.reduce((s, it) => s + it.CANTIDAD, 0);
  const itemsLotes = lotesElegidos.reduce((s, l) => s + l.llegaron, 0);
  const totalItems = itemsItems + itemsLotes;

  const costoNum = Number(costoCourier) || 0;
  const costoPorItem = totalItems > 0 ? costoNum / totalItems : 0;

  async function handleSubmit() {
    if (totalItems === 0) { alert('Selecciona al menos un ítem o lote'); return; }
    if (costoNum <= 0) { alert('Ingresa el costo del courier'); return; }
    const user = auth.getUser();
    if (!user) return;

    setSubmitting(true);
    try {
      await api.cargarEnvioCourier({
        items: itemsElegidos.map(it => ({ ordenId: it.ordenId, itemRowNum: it._rowNum, cantidad: it.CANTIDAD })),
        lotes: lotesElegidos.map(l => ({
          loteId: l.LOTE_ID,
          cantInicial: l.CANT_INICIAL,
          vendidas: Object.entries(l.vend).map(([ordenId, cantidad]) => ({ ordenId, cantidad })),
          sinVender: l.sinVender,
        })),
        costoCourier: costoNum,
        fecha,
        cuentaPago,
      }, user.usuario);

      setToast(`✅ Courier ${fmtMoney(costoNum)} repartido entre ${totalItems} piezas`);
      setTimeout(() => setToast(''), 4000);

      setItemsSel(new Set());
      setSinVenderSel({});
      setStockSel(new Set());
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
            Marca los ítems y lotes que llegaron en este envío. El costo se reparte
            proporcional al número de piezas entre todo lo seleccionado.
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
          <div style={{ marginTop: 16 }}>
            <label style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Pagado con</label>
            <select className="input" value={cuentaPago} onChange={(e) => setCuentaElegida(e.target.value)} style={{ marginTop: 4, maxWidth: 360 }}>
              {cuentasPago.length === 0 && <option value="">(sin cuentas: se guarda sin cuenta)</option>}
              {cuentasPago.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
            <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4 }}>Normalmente sale de ScrubMe #2.</div>
          </div>
        </div>

        {/* 2. ÍTEMS DE PEDIDOS */}
        <div className="card" style={{ padding: 28, marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 6px', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-soft)' }}>
            2. Ítems de pedidos · <span className="tabular">{itemsSel.size + stockSel.size}</span> seleccionados
          </h3>
          <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: '0 0 16px' }}>
            Ítems con costo cargado, en tránsito o en bodega, pendientes de courier. Marca solo los que llegaron en este envío.
          </p>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-faint)' }}>Cargando…</div>
          ) : pedidosItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-faint)', background: 'var(--bg)', borderRadius: 4 }}>
              No hay ítems pendientes de courier.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {pedidosItems.map(p => {
                const todosMarcados = p.items.every(it => marcado(p.ORDEN_ID, it));
                return (
                  <div key={p.ORDEN_ID} style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg)' }}>
                      <div>
                        <span className="display" style={{ fontSize: 14 }}>{p.CLIENTE_NOMBRE}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-soft)', marginLeft: 8 }}>
                          <span className="mono">{p.ORDEN_ID}</span> · {p.ESTATUS_ENVIO}
                        </span>
                      </div>
                      <button className="btn" onClick={() => togglePedidoCompleto(p)} style={{ padding: '4px 10px', fontSize: 11 }}>
                        {todosMarcados ? 'Quitar todo' : 'Marcar todo'}
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {p.items.map(it => {
                        const sel = marcado(p.ORDEN_ID, it);
                        return (
                          <div
                            key={it._rowNum}
                            onClick={() => (it.DE_STOCK ? toggleStock(claveStock(p.ORDEN_ID, it)) : toggleItem(it._rowNum))}
                            style={{
                              padding: '10px 14px', cursor: 'pointer',
                              background: sel ? 'rgba(184,149,78,0.06)' : 'transparent',
                              borderTop: '1px solid var(--border)',
                              display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 12, alignItems: 'center',
                            }}
                          >
                            <div style={{ width: 18, height: 18, borderRadius: 3, border: `1.5px solid ${sel ? 'var(--text)' : 'var(--border)'}`, background: sel ? 'var(--text)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 12 }}>
                              {sel ? '✓' : ''}
                            </div>
                            <div>
                              <div style={{ fontSize: 13 }}>{it.NOMBRE_PRODUCTO || it.SKU}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-soft)' }}>
                                {it.TALLA} · {it.LONGITUD} · {it.COLOR}
                              </div>
                              {it.DE_STOCK && (
                                <div style={{ fontSize: 11, color: 'var(--blue)', marginTop: 2 }}>
                                  De stock · <span className="mono">{it.LOTE}</span> — márcala si llegó en este envío
                                </div>
                              )}
                            </div>
                            <span className="pill" style={{ fontSize: 10, padding: '3px 8px', background: 'var(--bg)', color: 'var(--text-soft)' }}>
                              {it.ESTATUS_ITEM}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 3. LOTES DE STOCK (piezas sin vender) */}
        <div className="card m-pad" style={{ padding: 28, marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 6px', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-soft)' }}>
            3. Stock sin vender que llegó
          </h3>
          <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: '0 0 16px', lineHeight: 1.5 }}>
            Indica cuántas piezas de cada lote llegaron. Las ya vendidas se marcan arriba, bajo cada clienta.
            Si de un lote llegan menos piezas de las que hay, las que faltan quedan como un lote aparte “en camino” y les cargas el courier cuando lleguen.
          </p>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-faint)' }}>Cargando…</div>
          ) : lotes.filter(l => (l.CANT_DISPONIBLE ?? l.CANT_INICIAL) > 0).length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-faint)', background: 'var(--bg)', borderRadius: 4 }}>
              No hay stock sin vender pendiente de courier.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {lotes.filter(l => (l.CANT_DISPONIBLE ?? l.CANT_INICIAL) > 0).map(l => {
                const max = l.CANT_DISPONIBLE ?? l.CANT_INICIAL;
                const n = sinVenderSel[l.LOTE_ID] || 0;
                const sel = n > 0;
                const nVend = (l.ventas || []).reduce((a, v) => a + v.cantidad, 0);
                return (
                  <div key={l.LOTE_ID}
                    style={{
                      padding: '10px 14px', borderRadius: 4,
                      background: sel ? 'var(--bg)' : 'transparent',
                      border: `1px solid ${sel ? 'var(--text)' : 'var(--border)'}`,
                      display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between',
                    }}>
                    <div style={{ minWidth: 0, flex: '1 1 200px' }}>
                      <div className="display" style={{ fontSize: 14 }}>{l.SKU}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-soft)' }}>
                        <span className="mono">{l.LOTE_ID}</span> · {l.TALLA} · {l.LONGITUD} · {l.COLOR}
                      </div>
                      {nVend > 0 && (
                        <div style={{ fontSize: 11, color: 'var(--blue)', marginTop: 2 }}>
                          + {nVend} vendida{nVend !== 1 ? 's' : ''} (márcalas arriba): {(l.ventas || []).map(v => `${v.ordenId} ${v.cliente}`).join(' · ')}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-soft)' }}>Llegaron</span>
                      <button className="btn" aria-label="Una menos" onClick={() => setLlegaronSinVender(l.LOTE_ID, n - 1, max)} style={{ minWidth: 36, minHeight: 36, justifyContent: 'center', padding: 0 }}>−</button>
                      <span className="tabular" style={{ minWidth: 20, textAlign: 'center', fontWeight: 600 }}>{n}</span>
                      <button className="btn" aria-label="Una más" onClick={() => setLlegaronSinVender(l.LOTE_ID, n + 1, max)} style={{ minWidth: 36, minHeight: 36, justifyContent: 'center', padding: 0 }}>+</button>
                      <span style={{ fontSize: 12, color: 'var(--text-soft)' }}>de {max}</span>
                      <button className="btn" onClick={() => setLlegaronSinVender(l.LOTE_ID, n === max ? 0 : max, max)} style={{ minHeight: 36, fontSize: 11, padding: '0 10px' }}>
                        {n === max ? 'Ninguna' : 'Todas'}
                      </button>
                    </div>
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
              {fmtMoney(costoNum)} ÷ {totalItems} piezas = <strong>{fmtMoney(costoPorItem)}</strong> por pieza
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {itemsElegidos.map(it => (
                <div key={it._rowNum} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, fontSize: 12, padding: '4px 0' }}>
                  <span><span className="mono" style={{ color: 'var(--text-soft)' }}>{it.ordenId}</span> {it.NOMBRE_PRODUCTO} · {it.TALLA} {it.COLOR}</span>
                  <span className="tabular" style={{ color: 'var(--text-faint)' }}>{it.CANTIDAD} pza</span>
                  <span className="display tabular" style={{ color: 'var(--gold)', minWidth: 80, textAlign: 'right' }}>{fmtMoney(costoPorItem * it.CANTIDAD)}</span>
                </div>
              ))}
              {lotesElegidos.map(l => (
                <div key={l.LOTE_ID} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, fontSize: 12, padding: '4px 0' }}>
                  <span><span className="mono" style={{ color: 'var(--gold)' }}>{l.LOTE_ID}</span> {l.SKU}</span>
                  <span className="tabular" style={{ color: 'var(--text-faint)' }}>{l.llegaron} de {l.CANT_INICIAL} pza</span>
                  <span className="display tabular" style={{ color: 'var(--gold)', minWidth: 80, textAlign: 'right' }}>{fmtMoney(costoPorItem * l.llegaron)}</span>
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
            {submitting ? 'Guardando…' : `Distribuir courier (${totalItems} piezas)`}
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
