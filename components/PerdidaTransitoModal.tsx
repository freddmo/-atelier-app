'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Producto } from '@/lib/types';
import { auth } from '@/lib/auth';

type ItemLite = {
  _rowNum: number;
  NOMBRE_PRODUCTO?: string;
  SKU: string;
  TALLA: string;
  LONGITUD: string;
  COLOR: string;
  ESTATUS_ITEM?: string;
};

type Repl = { figsRepone: boolean; sku: string; talla: string; longitud: string; color: string };
const LONGITUDES = ['Regular', 'Petite', 'Tall'];

export default function PerdidaTransitoModal({
  ordenId, items, onClose, onDone,
}: {
  ordenId: string;
  items: ItemLite[];
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const vivos = items.filter(it => String(it.ESTATUS_ITEM || '').toUpperCase().trim() !== 'CANCELADO');
  const [productos, setProductos] = useState<Producto[]>([]);
  const [lost, setLost] = useState<Record<number, Repl>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.getProductos().then(setProductos).catch(() => {}); }, []);

  function toggleLost(it: ItemLite) {
    setLost(prev => {
      const next = { ...prev };
      if (next[it._rowNum]) delete next[it._rowNum];
      else next[it._rowNum] = { figsRepone: true, sku: it.SKU, talla: it.TALLA, longitud: it.LONGITUD || 'Regular', color: it.COLOR };
      return next;
    });
  }
  function setRepl(row: number, campo: keyof Repl, valor: string | boolean) {
    setLost(prev => ({ ...prev, [row]: { ...prev[row], [campo]: valor } }));
  }

  async function confirmar() {
    const user = auth.getUser();
    if (!user) return;
    const rows = Object.keys(lost).map(Number);
    if (rows.length === 0) { alert('Marca al menos un ítem perdido'); return; }
    const payload = rows.map(row => ({
      itemRowNum: row, figsRepone: lost[row].figsRepone,
      sku: lost[row].sku, talla: lost[row].talla, longitud: lost[row].longitud, color: lost[row].color,
    }));
    setSaving(true);
    try {
      await api.perdidaEnTransito(ordenId, payload, user.usuario);
      onDone(`${rows.length} ítem(s) perdido(s) y reemplazado(s)`);
    } catch (err) {
      alert('Error: ' + (err instanceof Error ? err.message : 'desconocido'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content" style={{ padding: 28, maxWidth: 560 }}>
        <div style={{ marginBottom: 16 }}>
          <span className="number-tag">{ordenId}</span>
          <h2 className="display" style={{ fontSize: 24, fontWeight: 400, margin: '6px 0 0' }}>Pérdida en tránsito</h2>
          <p style={{ color: 'var(--text-soft)', fontSize: 13, margin: '6px 0 0' }}>
            Marca lo que se perdió. Nada va a stock — el reemplazo se vuelve a pedir.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
          {vivos.map(it => {
            const r = lost[it._rowNum];
            const marcado = !!r;
            return (
              <div key={it._rowNum} style={{ border: `1px solid ${marcado ? 'var(--rose)' : 'var(--border)'}`, borderRadius: 4, overflow: 'hidden' }}>
                <div onClick={() => toggleLost(it)} style={{ padding: '10px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, background: marcado ? 'var(--rose-bg)' : 'transparent' }}>
                  <input type="checkbox" readOnly checked={marcado} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13 }}>{it.NOMBRE_PRODUCTO || it.SKU}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-soft)' }}>{it.TALLA} · {it.LONGITUD} · {it.COLOR}</div>
                  </div>
                  {marcado && <span style={{ fontSize: 11, color: 'var(--rose)', fontWeight: 500 }}>Perdido</span>}
                </div>

                {marcado && (
                  <div style={{ padding: 12, borderTop: '1px solid var(--border)', background: 'var(--bg)' }}>
                    <div onClick={() => setRepl(it._rowNum, 'figsRepone', !r.figsRepone)} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 12 }}>
                      <div style={{ width: 18, height: 18, borderRadius: 3, border: '1px solid var(--border)', background: r.figsRepone ? 'var(--green)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {r.figsRepone && <span style={{ color: 'white', fontSize: 11 }}>✓</span>}
                      </div>
                      <span style={{ fontSize: 12 }}>
                        FIGS me repone el dinero
                        <span style={{ color: 'var(--text-faint)', marginLeft: 6 }}>
                          {r.figsRepone ? '(se borra el costo)' : '(queda como pérdida tuya)'}
                        </span>
                      </span>
                    </div>

                    <div style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase', marginBottom: 6 }}>Reemplazo a re-pedir</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 0.7fr 1fr 1fr', gap: 8 }}>
                      <select className="input" value={r.sku} onChange={e => setRepl(it._rowNum, 'sku', e.target.value)} style={{ fontSize: 12, padding: '6px 8px' }}>
                        {productos.map(p => <option key={p.SKU} value={p.SKU}>{p.SKU} — {p.NOMBRE}</option>)}
                      </select>
                      <input className="input" value={r.talla} onChange={e => setRepl(it._rowNum, 'talla', e.target.value)} placeholder="Talla" style={{ fontSize: 12, padding: '6px 8px' }} />
                      <select className="input" value={r.longitud} onChange={e => setRepl(it._rowNum, 'longitud', e.target.value)} style={{ fontSize: 12, padding: '6px 8px' }}>
                        {LONGITUDES.map(x => <option key={x} value={x}>{x}</option>)}
                      </select>
                      <input className="input" value={r.color} onChange={e => setRepl(it._rowNum, 'color', e.target.value)} placeholder="Color" style={{ fontSize: 12, padding: '6px 8px' }} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={confirmar} disabled={saving}>
            {saving ? 'Guardando…' : 'Aplicar'}
          </button>
        </div>
      </div>
    </div>
  );
}
