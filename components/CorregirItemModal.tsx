'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Producto } from '@/lib/types';
import { auth } from '@/lib/auth';

const LONGITUDES = ['Regular', 'Petite', 'Tall'];

type ItemX = {
  _rowNum: number;
  SKU: string;
  NOMBRE_PRODUCTO?: string;
  TALLA: string;
  LONGITUD: string;
  COLOR: string;
};

type Props = {
  ordenId: string;
  item: ItemX;
  onClose: () => void;
  onDone: (msg: string) => void;
};

export default function CorregirItemModal({ ordenId, item, onClose, onDone }: Props) {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [sku, setSku] = useState(item.SKU);
  const [talla, setTalla] = useState('');
  const [longitud, setLongitud] = useState(item.LONGITUD || 'Regular');
  const [color, setColor] = useState(item.COLOR);
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.getProductos().then(setProductos).catch(() => {}); }, []);

  function nombreSku(s: string) {
    const p = productos.find(x => x.SKU === s);
    return p ? p.NOMBRE : s;
  }

  async function confirmar() {
    const user = auth.getUser();
    if (!user) return;
    if (!sku || !talla.trim() || !color.trim()) { alert('Completa SKU, talla y color de la prenda correcta'); return; }

    setSaving(true);
    try {
      const res = await api.corregirItemStock({
        ordenId,
        itemRow: item._rowNum,
        nuevoSku: sku,
        nuevaTalla: talla.trim(),
        nuevaLongitud: longitud,
        nuevoColor: color.trim(),
      }, user.usuario);
      onDone(
        `Corregido: ${item.TALLA} ${item.COLOR} → ${talla} ${color} · ` +
        `${res.loteOriginalId} devuelto, ${res.loteNuevoId} asignado ($${res.nuevoCosto.toFixed(2)})`
      );
    } catch (err) {
      alert('Error: ' + (err instanceof Error ? err.message : 'desconocido'));
    } finally {
      setSaving(false);
    }
  }

  const labelStyle = { fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase' as const };

  return (
    <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content" style={{ padding: 28, maxWidth: 460 }}>
        <div style={{ marginBottom: 18 }}>
          <span className="number-tag">{ordenId}</span>
          <h2 className="display" style={{ fontSize: 24, fontWeight: 400, margin: '6px 0 0' }}>Corregir ítem</h2>
          <p style={{ color: 'var(--text-soft)', fontSize: 13, margin: '6px 0 0' }}>
            Elegiste mal al asignar stock. Esto devuelve la unidad al lote original y asigna el correcto — sin crear lotes nuevos ni ítems nuevos.
          </p>
        </div>

        <div style={{ padding: 12, background: 'var(--bg)', borderRadius: 4, marginBottom: 16, fontSize: 12, color: 'var(--text-soft)' }}>
          Elegiste: <strong style={{ color: 'var(--text)' }}>{item.NOMBRE_PRODUCTO || item.SKU}</strong> · {item.TALLA} · {item.LONGITUD} · {item.COLOR}
        </div>

        <div style={{ fontSize: 11, fontWeight: 500, marginBottom: 10 }}>Lo correcto es:</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          <div>
            <label style={labelStyle}>Prenda (SKU)</label>
            <select className="input" value={sku} onChange={(e) => setSku(e.target.value)} style={{ marginTop: 2 }}>
              {productos.map(p => <option key={p.SKU} value={p.SKU}>{p.SKU} — {p.NOMBRE}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.3fr', gap: 8 }}>
            <div>
              <label style={labelStyle}>Talla</label>
              <input className="input" value={talla} onChange={(e) => setTalla(e.target.value)} placeholder="M" style={{ marginTop: 2 }} autoFocus />
            </div>
            <div>
              <label style={labelStyle}>Longitud</label>
              <select className="input" value={longitud} onChange={(e) => setLongitud(e.target.value)} style={{ marginTop: 2 }}>
                {LONGITUDES.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Color</label>
              <input className="input" value={color} onChange={(e) => setColor(e.target.value)} placeholder="Negro" style={{ marginTop: 2 }} />
            </div>
          </div>
        </div>

        <div style={{ padding: '10px 14px', border: '1px solid var(--gold)', borderRadius: 4, marginBottom: 16, fontSize: 12, color: 'var(--text-soft)', lineHeight: 1.7 }}>
          <div>↩ <strong>{item.TALLA} {item.COLOR}</strong> → vuelve a su lote original</div>
          <div>✓ <strong>{talla || '…'} {color || '…'}</strong> → se asigna del lote que ya tengas en stock</div>
          <div>💰 El costo se ajusta al del lote correcto — no se pide nada nuevo a FIGS</div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={confirmar} disabled={saving}>
            {saving ? 'Corrigiendo…' : 'Confirmar corrección'}
          </button>
        </div>
      </div>
    </div>
  );
}
