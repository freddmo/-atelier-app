'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api, LoteStock, LoteEnCamino, Courier, Combo } from '@/lib/api';
import { auth } from '@/lib/auth';
import Navbar from '@/components/Navbar';

function fmtMoney(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: string) {
  if (!d) return '—';
  return new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtShort(d: string) {
  if (!d) return '';
  return new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

function fmtEta(eta: { fechaMin: string; fechaMax: string } | null) {
  if (!eta || (!eta.fechaMin && !eta.fechaMax)) return null;
  return `${fmtShort(eta.fechaMin)} – ${fmtShort(eta.fechaMax)}`;
}

function estadoColor(e: string) {
  const k = (e || '').toUpperCase();
  if (k === 'EN TRANSITO A FL') return 'var(--amber)';
  if (k === 'EN BODEGA FL') return '#6b8cce';
  if (k === 'EN CAMINO A EC') return 'var(--gold)';
  return 'var(--text-soft)';
}

export default function StockPage() {
  const router = useRouter();
  const [lotes, setLotes] = useState<LoteStock[]>([]);
  const [enCamino, setEnCamino] = useState<LoteEnCamino[]>([]);
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [combos, setCombos] = useState<Combo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  // Armador de sets
  const [selSuperior, setSelSuperior] = useState('');
  const [selInferior, setSelInferior] = useState('');
  const [savingCombo, setSavingCombo] = useState(false);
  const [deletingCombo, setDeletingCombo] = useState('');

  // Acciones admin (lotes en camino)
  const [working, setWorking] = useState('');
  const [despacharId, setDespacharId] = useState('');
  const [despCourier, setDespCourier] = useState('');
  const [despFecha, setDespFecha] = useState('');

  const todayISO = new Date().toISOString().split('T')[0];

  useEffect(() => {
    const user = auth.getUser();
    if (!user) { router.replace('/login'); return; }
    setIsAdmin(user.rol === 'admin');
    load();
  }, [router]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [disp, camino, cours, combs] = await Promise.all([
        api.getStockDisponible(),
        api.getLotesEnCamino(),
        api.getCouriers().catch(() => [] as Courier[]),
        api.getCombos().catch(() => [] as Combo[]),
      ]);
      setLotes(disp);
      setEnCamino(camino);
      setCouriers(cours);
      setCombos(combs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }

  const couriersActivos = couriers.filter(c => {
    const a = String(c.ACTIVA).toUpperCase().trim();
    return a !== 'FALSE' && a !== 'NO' && a !== '0';
  });

  // ===== Armador de sets =====
  const superiores = lotes.filter(l => ['TOP', 'CAMISA'].includes((l.TIPO_PRENDA || '').toUpperCase()));
  const inferiores = lotes.filter(l => (l.TIPO_PRENDA || '').toUpperCase() === 'PANTALON');
  const piezaSup = lotes.find(l => l.LOTE_ID === selSuperior);
  const piezaInf = lotes.find(l => l.LOTE_ID === selInferior);

  async function guardarCombo() {
    if (!selSuperior || !selInferior) { alert('Elige una pieza superior y una inferior'); return; }
    const user = auth.getUser();
    if (!user) return;
    setSavingCombo(true);
    try {
      await api.crearCombo(selSuperior, selInferior, user.usuario);
      setSelSuperior('');
      setSelInferior('');
      await load();
    } catch (err) {
      alert('Error: ' + (err instanceof Error ? err.message : 'desconocido'));
    } finally {
      setSavingCombo(false);
    }
  }

  async function borrarComboFn(comboId: string) {
    if (!confirm('¿Borrar este conjunto guardado?')) return;
    const user = auth.getUser();
    if (!user) return;
    setDeletingCombo(comboId);
    try {
      await api.borrarCombo(comboId, user.usuario);
      await load();
    } catch (err) {
      alert('Error: ' + (err instanceof Error ? err.message : 'desconocido'));
    } finally {
      setDeletingCombo('');
    }
  }

  // ===== Acciones de lote en camino =====
  async function doAccion(loteId: string, accion: 'LLEGO_FL' | 'DESPACHAR_EC' | 'LLEGO_EC', courier = '', fechaSalida = '') {
    const user = auth.getUser();
    if (!user) return;
    setWorking(loteId);
    try {
      await api.avanzarLote({ loteId, accion, courier, fechaSalida }, user.usuario);
      setDespacharId('');
      await load();
    } catch (err) {
      alert('Error: ' + (err instanceof Error ? err.message : 'desconocido'));
    } finally {
      setWorking('');
    }
  }

  function openDespachar(loteId: string) {
    setDespacharId(loteId);
    setDespFecha(todayISO);
    setDespCourier(couriersActivos.length > 0 ? couriersActivos[0].COURIER : '');
  }

  function confirmDespachar(loteId: string) {
    if (!despCourier) { alert('Elige un courier'); return; }
    if (!despFecha) { alert('Elige la fecha de salida'); return; }
    doAccion(loteId, 'DESPACHAR_EC', despCourier, despFecha);
  }

  const totalPiezas = lotes.reduce((s, l) => s + l.CANT_DISPONIBLE, 0);
  const totalCamino = enCamino.reduce((s, l) => s + l.CANT_DISPONIBLE, 0);
  const today = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

  const camCols = isAdmin ? 7 : 6;

  return (
    <>
      <Navbar />
      <div className="fade-in stock-container" style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 24px' }}>
        <div className="stock-header" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28, gap: 16, flexWrap: 'wrap' }}>
          <div>
            <span className="number-tag">INVENTARIO</span>
            <h1 className="display" style={{ fontSize: 48, fontWeight: 300, margin: '6px 0 0', lineHeight: 1 }}>
              Stock<em style={{ color: 'var(--gold)' }}>.</em>
            </h1>
            <p style={{ color: 'var(--text-soft)', margin: '8px 0 0', fontSize: 13 }}>
              {totalPiezas} disponible{totalPiezas !== 1 ? 's' : ''} · {totalCamino} en camino · {combos.length} conjunto{combos.length !== 1 ? 's' : ''} · {today}
            </p>
          </div>
          <div className="stock-actions" style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={load} disabled={loading}>
              {loading ? 'Cargando…' : '↻ Actualizar'}
            </button>
            <button className="btn btn-primary" onClick={() => window.print()}>
              🖨️ Imprimir
            </button>
          </div>
        </div>

        {error && (
          <div style={{ padding: 16, background: 'var(--rose-bg)', color: 'var(--rose)', borderRadius: 6, marginBottom: 24, fontSize: 13 }}>
            ⚠️ {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 64, color: 'var(--text-faint)' }}>Cargando inventario…</div>
        ) : (
          <>
            {/* ===== ARMADOR DE SETS ===== */}
            {lotes.length > 0 && (
              <div className="card print-hide" style={{ padding: 24, marginBottom: 20 }}>
                <h3 style={{ margin: '0 0 4px', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-soft)' }}>
                  🧩 Armar un set
                </h3>
                <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: '0 0 16px' }}>
                  Combina una pieza superior con una inferior y guárdalo. Lo verán todos y sale en la impresión.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Pieza superior (top / camisa)</label>
                    <select className="input" value={selSuperior} onChange={(e) => setSelSuperior(e.target.value)} style={{ marginTop: 4 }}>
                      <option value="">— Elegir —</option>
                      {superiores.map(l => (
                        <option key={l.LOTE_ID} value={l.LOTE_ID}>
                          {l.NOMBRE_PRODUCTO} · {l.TALLA} · {l.COLOR}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Pieza inferior (pantalón)</label>
                    <select className="input" value={selInferior} onChange={(e) => setSelInferior(e.target.value)} style={{ marginTop: 4 }}>
                      <option value="">— Elegir —</option>
                      {inferiores.map(l => (
                        <option key={l.LOTE_ID} value={l.LOTE_ID}>
                          {l.NOMBRE_PRODUCTO} · {l.TALLA} · {l.COLOR}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {(piezaSup || piezaInf) && (
                  <div style={{ marginTop: 16, padding: 16, background: 'linear-gradient(to right, rgba(184,149,78,0.06), transparent)', border: '1px solid var(--gold)', borderRadius: 6 }}>
                    <div style={{ fontSize: 11, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Conjunto a guardar</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 200 }}>
                        {piezaSup ? (
                          <>
                            <div className="display" style={{ fontSize: 15 }}>{piezaSup.NOMBRE_PRODUCTO}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>{piezaSup.TALLA} · {piezaSup.LONGITUD} · {piezaSup.COLOR}</div>
                          </>
                        ) : <span style={{ color: 'var(--text-faint)', fontSize: 13 }}>(sin pieza superior)</span>}
                      </div>
                      <div style={{ fontSize: 20, color: 'var(--gold)' }}>+</div>
                      <div style={{ flex: 1, minWidth: 200 }}>
                        {piezaInf ? (
                          <>
                            <div className="display" style={{ fontSize: 15 }}>{piezaInf.NOMBRE_PRODUCTO}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>{piezaInf.TALLA} · {piezaInf.LONGITUD} · {piezaInf.COLOR}</div>
                          </>
                        ) : <span style={{ color: 'var(--text-faint)', fontSize: 13 }}>(sin pieza inferior)</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
                      <button className="btn" onClick={() => { setSelSuperior(''); setSelInferior(''); }} disabled={savingCombo} style={{ padding: '6px 12px', fontSize: 12 }}>
                        Limpiar
                      </button>
                      <button className="btn btn-primary" onClick={guardarCombo} disabled={savingCombo || !selSuperior || !selInferior} style={{ padding: '6px 14px', fontSize: 12 }}>
                        {savingCombo ? 'Guardando…' : 'Guardar conjunto'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ===== CONJUNTOS GUARDADOS ===== */}
            {combos.length > 0 && (
              <>
                <h3 style={{ margin: '0 0 12px', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-soft)' }}>
                  Conjuntos guardados · <span className="tabular">{combos.length}</span>
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12, marginBottom: 28 }}>
                  {combos.map(c => (
                    <div key={c.COMBO_ID} className="card" style={{ padding: 16, position: 'relative' }}>
                      <button
                        className="btn print-hide"
                        onClick={() => borrarComboFn(c.COMBO_ID)}
                        disabled={deletingCombo === c.COMBO_ID}
                        title="Borrar conjunto"
                        style={{ position: 'absolute', top: 10, right: 10, padding: '3px 8px', fontSize: 11, color: 'var(--rose)' }}
                      >
                        {deletingCombo === c.COMBO_ID ? '…' : '✕'}
                      </button>
                      <div style={{ fontSize: 10, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                        Conjunto
                      </div>
                      <div style={{ marginBottom: 8 }}>
                        <div className="display" style={{ fontSize: 14 }}>{c.superior.NOMBRE_PRODUCTO}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-soft)' }}>{c.superior.TALLA} · {c.superior.LONGITUD} · {c.superior.COLOR}</div>
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--gold)', margin: '2px 0' }}>+</div>
                      <div>
                        <div className="display" style={{ fontSize: 14 }}>{c.inferior.NOMBRE_PRODUCTO}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-soft)' }}>{c.inferior.TALLA} · {c.inferior.LONGITUD} · {c.inferior.COLOR}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* ===== DISPONIBLE AHORA ===== */}
            <h3 style={{ margin: '0 0 12px', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-soft)' }}>
              Disponible ahora · <span className="tabular">{totalPiezas}</span>
            </h3>
            {lotes.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-faint)', marginBottom: 28 }}>
                No hay stock disponible todavía.
              </div>
            ) : (
              <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 28 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 500, color: 'var(--text-soft)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Producto</th>
                      <th style={{ padding: '12px 8px', textAlign: 'left', fontSize: 11, fontWeight: 500, color: 'var(--text-soft)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Talla</th>
                      <th style={{ padding: '12px 8px', textAlign: 'left', fontSize: 11, fontWeight: 500, color: 'var(--text-soft)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Longitud</th>
                      <th style={{ padding: '12px 8px', textAlign: 'left', fontSize: 11, fontWeight: 500, color: 'var(--text-soft)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Color</th>
                      <th style={{ padding: '12px 8px', textAlign: 'right', fontSize: 11, fontWeight: 500, color: 'var(--text-soft)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Cant.</th>
                      {isAdmin && (
                        <>
                          <th className="print-hide" style={{ padding: '12px 8px', textAlign: 'left', fontSize: 11, fontWeight: 500, color: 'var(--text-soft)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Lote</th>
                          <th className="print-hide" style={{ padding: '12px 8px', textAlign: 'right', fontSize: 11, fontWeight: 500, color: 'var(--text-soft)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Costo unit.</th>
                        </>
                      )}
                      <th className="print-hide" style={{ padding: '12px 8px', textAlign: 'left', fontSize: 11, fontWeight: 500, color: 'var(--text-soft)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Entrada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lotes.map((l, idx) => (
                      <tr key={l.LOTE_ID} style={{ borderBottom: idx < lotes.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: 500 }}>{l.NOMBRE_PRODUCTO}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{l.TIPO_PRENDA}</div>
                        </td>
                        <td style={{ padding: '14px 8px' }} className="mono">{l.TALLA}</td>
                        <td style={{ padding: '14px 8px' }}>{l.LONGITUD}</td>
                        <td style={{ padding: '14px 8px' }}>{l.COLOR}</td>
                        <td style={{ padding: '14px 8px', textAlign: 'right' }} className="tabular">
                          <span style={{ fontSize: 16, fontWeight: 500 }}>{l.CANT_DISPONIBLE}</span>
                          {!l.tieneCourier && (
                            <span title="Sin courier cargado todavía" style={{ marginLeft: 6, color: 'var(--amber)' }}>⚠</span>
                          )}
                        </td>
                        {isAdmin && (
                          <>
                            <td className="mono print-hide" style={{ padding: '14px 8px', fontSize: 11, color: 'var(--text-faint)' }}>{l.LOTE_ID}</td>
                            <td className="tabular print-hide" style={{ padding: '14px 8px', textAlign: 'right', fontSize: 12, color: 'var(--text-soft)' }}>{fmtMoney(l.COSTO_UNITARIO)}</td>
                          </>
                        )}
                        <td className="print-hide" style={{ padding: '14px 8px', fontSize: 12, color: 'var(--text-soft)' }}>{fmtDate(l.FECHA_ENTRADA)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ===== EN CAMINO (PREVENTA) ===== */}
            <h3 className="print-hide" style={{ margin: '0 0 12px', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-soft)' }}>
              🚚 En camino (preventa) · <span className="tabular">{totalCamino}</span>
            </h3>
            {enCamino.length === 0 ? (
              <div className="card print-hide" style={{ textAlign: 'center', padding: 40, color: 'var(--text-faint)' }}>
                Nada en camino por ahora.
              </div>
            ) : (
              <div className="card print-hide" style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 500, color: 'var(--text-soft)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Producto</th>
                      <th style={{ padding: '12px 8px', textAlign: 'left', fontSize: 11, fontWeight: 500, color: 'var(--text-soft)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Talla</th>
                      <th style={{ padding: '12px 8px', textAlign: 'left', fontSize: 11, fontWeight: 500, color: 'var(--text-soft)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Color</th>
                      <th style={{ padding: '12px 8px', textAlign: 'right', fontSize: 11, fontWeight: 500, color: 'var(--text-soft)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Cant.</th>
                      <th style={{ padding: '12px 8px', textAlign: 'left', fontSize: 11, fontWeight: 500, color: 'var(--text-soft)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Estado</th>
                      <th style={{ padding: '12px 8px', textAlign: 'left', fontSize: 11, fontWeight: 500, color: 'var(--text-soft)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Llega</th>
                      {isAdmin && (
                        <th style={{ padding: '12px 8px', textAlign: 'right', fontSize: 11, fontWeight: 500, color: 'var(--text-soft)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Acción</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {enCamino.map((l, idx) => {
                      const estado = (l.ESTADO_VIAJE || '').toUpperCase();
                      const eta = fmtEta(l.eta);
                      const enDespacho = despacharId === l.LOTE_ID;
                      return (
                        <>
                          <tr key={l.LOTE_ID} style={{ borderBottom: (idx < enCamino.length - 1 && !enDespacho) ? '1px solid var(--border)' : 'none' }}>
                            <td style={{ padding: '14px 16px' }}>
                              <div style={{ fontWeight: 500 }}>{l.NOMBRE_PRODUCTO}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                                {l.TIPO_PRENDA}
                                {isAdmin && l.TRACKING ? ` · ${l.TRANSPORTE || ''} ${l.TRACKING}` : ''}
                              </div>
                            </td>
                            <td style={{ padding: '14px 8px' }} className="mono">{l.TALLA}</td>
                            <td style={{ padding: '14px 8px' }}>{l.COLOR}</td>
                            <td style={{ padding: '14px 8px', textAlign: 'right' }} className="tabular">
                              <span style={{ fontSize: 16, fontWeight: 500 }}>{l.CANT_DISPONIBLE}</span>
                            </td>
                            <td style={{ padding: '14px 8px' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: estadoColor(estado) }} />
                                {l.ESTADO_VIAJE}
                              </span>
                            </td>
                            <td style={{ padding: '14px 8px', fontSize: 13 }}>
                              {eta ? (
                                <span className="tabular" style={{ color: 'var(--gold)', fontWeight: 500 }}>{eta}</span>
                              ) : (
                                <span style={{ color: 'var(--text-faint)' }}>por despachar</span>
                              )}
                            </td>
                            {isAdmin && (
                              <td style={{ padding: '14px 8px', textAlign: 'right' }}>
                                {estado === 'EN TRANSITO A FL' && (
                                  <button className="btn" onClick={() => doAccion(l.LOTE_ID, 'LLEGO_FL')} disabled={working === l.LOTE_ID} style={{ padding: '5px 10px', fontSize: 11 }}>
                                    {working === l.LOTE_ID ? '…' : 'Llegó a FL'}
                                  </button>
                                )}
                                {estado === 'EN BODEGA FL' && !enDespacho && (
                                  <button className="btn btn-primary" onClick={() => openDespachar(l.LOTE_ID)} disabled={working === l.LOTE_ID} style={{ padding: '5px 10px', fontSize: 11 }}>
                                    Despachar a EC
                                  </button>
                                )}
                                {estado === 'EN CAMINO A EC' && (
                                  <button className="btn" onClick={() => doAccion(l.LOTE_ID, 'LLEGO_EC')} disabled={working === l.LOTE_ID} style={{ padding: '5px 10px', fontSize: 11 }}>
                                    {working === l.LOTE_ID ? '…' : 'Llegó a EC'}
                                  </button>
                                )}
                              </td>
                            )}
                          </tr>

                          {isAdmin && enDespacho && (
                            <tr key={l.LOTE_ID + '-desp'} style={{ borderBottom: idx < enCamino.length - 1 ? '1px solid var(--border)' : 'none', background: 'var(--bg)' }}>
                              <td colSpan={camCols} style={{ padding: '14px 16px' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
                                  <div>
                                    <label style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Courier</label>
                                    <select className="input" value={despCourier} onChange={(e) => setDespCourier(e.target.value)} style={{ marginTop: 2, padding: '6px 10px', fontSize: 13 }}>
                                      {couriersActivos.length === 0 && <option value="">(sin couriers)</option>}
                                      {couriersActivos.map(c => <option key={c.COURIER} value={c.COURIER}>{c.COURIER}</option>)}
                                    </select>
                                  </div>
                                  <div>
                                    <label style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Fecha de salida</label>
                                    <input type="date" className="input" value={despFecha} onChange={(e) => setDespFecha(e.target.value)} style={{ marginTop: 2, padding: '6px 10px', fontSize: 13 }} />
                                  </div>
                                  <button className="btn btn-primary" onClick={() => confirmDespachar(l.LOTE_ID)} disabled={working === l.LOTE_ID} style={{ padding: '7px 14px', fontSize: 12 }}>
                                    {working === l.LOTE_ID ? 'Despachando…' : 'Confirmar despacho'}
                                  </button>
                                  <button className="btn" onClick={() => setDespacharId('')} disabled={working === l.LOTE_ID} style={{ padding: '7px 14px', fontSize: 12 }}>
                                    Cancelar
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        <div className="print-hide" style={{ marginTop: 16, fontSize: 11, color: 'var(--text-faint)' }}>
          ⚠ = lote disponible sin courier cargado · La sección "En camino" es preventa (aún no llega).
        </div>
      </div>

      <style jsx global>{`
        @media print {
          .navbar, header, .print-hide, .stock-actions { display: none !important; }
          .stock-container { max-width: 100% !important; padding: 12px !important; }
          .card { border: 1px solid #ccc !important; box-shadow: none !important; }
          body { background: white !important; }
        }
      `}</style>
    </>
  );
}
