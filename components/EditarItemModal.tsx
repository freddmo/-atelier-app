'use client';

// Cambiar una prenda del pedido ANTES de comprarla (la clienta cambió de idea):
// modelo, talla, largo, color y precio en la misma fila. No toca stock ni costos.

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Producto } from '@/lib/types';
import { auth } from '@/lib/auth';

const LONGITUDES = ['Regular', 'Petite', 'Tall'];

type ItemE = {
  _rowNum: number;
  SKU: string;
  NOMBRE_PRODUCTO?: string;
  TALLA: string;
  LONGITUD: string;
  COLOR: string;
  PRECIO_VENTA?: number | string;
};

type Props = {
  ordenId: string;
  item: ItemE;
  onClose: () => void;
  onDone: (msg: string) => void;
};

export default function EditarItemModal({ ordenId, item, onClose, onDone }: Props) {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [sku, setSku] = useState(item.SKU);
  const [talla, setTalla] = useState(String(item.TALLA || ''));
  const [longitud, setLongitud] = useState(item.LONGITUD || 'Regular');
  const [color, setColor] = useState(String(item.COLOR || ''));
  const [precio, setPrecio] = useState(item.PRECIO_VENTA !== undefined && item.PRECIO_VENTA !== '' ? String(item.PRECIO_VENTA) : '');
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.getProductos().then(setProductos).catch(() => {}); }, []);

  async function confirmar() {
    const user = auth.getUser();
    if (!user) return;
    if (!sku || !talla.trim() || !color.trim()) { alert('Completa modelo, talla y color'); return; }
    const p = precio.trim() === '' ? undefined : Number(precio);
    if (p !== undefined && (isNaN(p) || p < 0)) { alert('Precio inválido'); return; }
    setSaving(true);
    try {
      const res = await api.editarItem({ ordenId, itemRow: item._rowNum, sku, talla: talla.trim(), longitud, color: color.trim(), precio: p }, user.usuario);
      onDone(`Prenda cambiada: ${res.despues}`);
    } catch (err) {
      alert('No se pudo cambiar: ' + (err instanceof Error ? err.message : 'desconocido'));
    } finally {
      setSaving(false);
    }
  }

  const labelStyle = { fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase' as const };
  const productosLista = productos.some(x => x.SKU === sku)
    ? productos
    : [{ SKU: sku, NOMBRE: item.NOMBRE_PRODUCTO || sku } as Producto, ...productos];

  return (
    <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content" style={{ padding: 28, maxWidth: 460 }}>
        <div style={{ marginBottom: 18 }}>
          <span className="number-tag">{ordenId}</span>
          <h2 className="display" style={{ fontSize: 24, fontWeight: 400, margin: '6px 0 0' }}>Cambiar prenda</h2>
          <p style={{ color: 'var(--text-soft)', fontSize: 13, margin: '6px 0 0' }}>
            La clienta cambió de idea y la prenda todavía no se compró. Se cambia en el mismo pedido; no toca stock ni costos.
          </p>
        </div>

        <div style={{ padding: 12, background: 'var(--bg)', borderRadius: 4, marginBottom: 16, fontSize: 12, color: 'var(--text-soft)' }}>
          Ahora es: <strong style={{ color: 'var(--text)' }}>{item.NOMBRE_PRODUCTO || item.SKU}</strong> · {item.TALLA} · {item.LONGITUD} · {item.COLOR}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          <div>
            <label style={labelStyle}>Modelo</label>
            <select className="input" value={sku} onChange={(e) => setSku(e.target.value)} style={{ marginTop: 2 }}>
              {productosLista.map(p => <option key={p.SKU} value={p.SKU}>{p.NOMBRE} ({p.SKU})</option>)}
            </select>
          </div>
          <div className="m-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.3fr', gap: 8 }}>
            <div>
              <label style={labelStyle}>Talla</label>
              <input className="input" value={talla} onChange={(e) => setTalla(e.target.value)} placeholder="M" style={{ marginTop: 2 }} />
            </div>
            <div>
              <label style={labelStyle}>Largo</label>
              <select className="input" value={longitud} onChange={(e) => setLongitud(e.target.value)} style={{ marginTop: 2 }}>
                {LONGITUDES.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Color</label>
              <input className="input" value={color} onChange={(e) => setColor(e.target.value)} placeholder="Negro" style={{ marginTop: 2 }} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Precio de venta (opcional)</label>
            <input className="input tabular" type="number" inputMode="decimal" min={0} step="0.01" value={precio} onChange={(e) => setPrecio(e.target.value)} style={{ marginTop: 2 }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={confirmar} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar cambio'}
          </button>
        </div>
      </div>
    </div>
  );
}
