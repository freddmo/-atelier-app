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
  PRECIO_VENTA: number;
  COSTO_UNITARIO?: number;
};

type Props = {
  ordenId: string;
  item: ItemX;
  onClose: () => void;
  onDone: (msg: string) => void;
};

export default function CambioItemModal({ ordenId, item, onClose, onDone }: Props) {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [saving, setSaving] = useState(false);

  // Lo que llegó (a stock) — prefill con datos del ítem
  const [skuStock, setSkuStock] = useState(item.SKU);
  const [tallaStock, setTallaStock] = useState(item.TALLA);
  const [longStock, setLongStock] = useState(item.LONGITUD || 'Regular');
  const [colorStock, setColorStock] = useState(item.COLOR);
  const [costoStock, setCostoStock] = useState(item.COSTO_UNITARIO != null ? String(item.COSTO_UNITARIO) : '');

  // Lo que se re-pide — por defecto el mismo ítem
  const [otraPrenda, setOtraPrenda] = useState(false);
  const [skuY, setSkuY] = useState(item.SKU);
  const [tallaY, setTallaY] = useState(item.TALLA);
  const [longY, setLongY] = useState(item.LONGITUD || 'Regular');
  const [colorY, setColorY] = useState(item.COLOR);

  useEffect(() => { api.getProductos().then(setProductos).catch(() => {}); }, []);

  function nombreSku(sku: string) {
    const p = productos.find(x => x.SKU === sku);
    return p ? p.NOMBRE : sku;
  }

  async function confirmar() {
    const user = auth.getUser();
    if (!user) return;
    if (!skuStock || !tallaStock.trim() || !colorStock.trim()) { alert('Completa lo que llegó (SKU, talla, color)'); return; }
    if (otraPrenda && (!skuY || !tallaY.trim() || !colorY.trim())) { alert('Completa la prenda que se re-pide'); return; }

    setSaving(true);
    try {
      await api.cambiarItemError({
        ordenId,
        itemRowX: item._rowNum,
        skuStock, tallaStock, longitudStock: longStock, colorStock,
        costoStock: costoStock !== '' ? Number(costoStock) : undefined,
        ...(otraPrenda ? { skuY, tallaY, longitudY: longY, colorY } : {}),
      }, user.usuario);
      onDone(`Cambio aplicado: llegó ${skuStock} → stock · se re-pide ${otraPrenda ? skuY : item.SKU}`);
    } catch (err) {
      alert('Error: ' + (err instanceof Error ? err.message : 'desconocido'));
    } finally {
      setSaving(false);
    }
  }

  const labelStyle = { fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase' as const };

  return (
    <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content" style={{ padding: 28, maxWidth: 520 }}>
        <div style={{ marginBottom: 18 }}>
          <span className="number-tag">{ordenId}</span>
          <h2 className="display" style={{ fontSize: 24, fontWeight: 400, margin: '6px 0 0' }}>Cambiar ítem por error</h2>
          <p style={{ color: 'var(--text-soft)', fontSize: 13, margin: '6px 0 0' }}>
            La clienta pidió <strong>{item.NOMBRE_PRODUCTO || item.SKU}</strong> ({item.TALLA} · {item.COLOR}) pero llegó otra prenda.
          </p>
        </div>

        {/* 1. Lo que llegó */}
        <div style={{ padding: 16, background: 'var(--bg)', borderRadius: 4, marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 500, marginBottom: 12 }}>
            1. Lo que llegó por error <span style={{ color: 'var(--text-faint)', fontWeight: 400 }}>(irá a stock)</span>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={labelStyle}>Prenda que llegó</label>
            <select className="input" value={skuStock} onChange={(e) => setSkuStock(e.target.value)} style={{ marginTop: 2 }}>
              {productos.map(p => <option key={p.SKU} value={p.SKU}>{p.SKU} — {p.NOMBRE}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.3fr 1fr', gap: 8 }}>
            <div><label style={labelStyle}>Talla</label><input className="input" value={tallaStock} onChange={(e) => setTallaStock(e.target.value)} style={{ marginTop: 2 }} /></div>
            <div><label style={labelStyle}>Longitud</label>
              <select className="input" value={longStock} onChange={(e) => setLongStock(e.target.value)} style={{ marginTop: 2 }}>
                {LONGITUDES.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div><label style={labelStyle}>Color</label><input className="input" value={colorStock} onChange={(e) => setColorStock(e.target.value)} style={{ marginTop: 2 }} /></div>
            <div><label style={labelStyle}>Costo $</label><input type="number" step="0.01" className="input" value={costoStock} onChange={(e) => setCostoStock(e.target.value)} placeholder="auto" style={{ marginTop: 2 }} /></div>
          </div>
        </div>

        {/* 2. Lo que se re-pide */}
        <div style={{ padding: 16, background: 'var(--bg)', borderRadius: 4, marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 500, marginBottom: 10 }}>2. Lo que se re-pide para la clienta</div>
          {!otraPrenda ? (
            <div style={{ fontSize: 13, color: 'var(--text-soft)' }}>
              Se volverá a pedir lo mismo: <strong>{item.NOMBRE_PRODUCTO || item.SKU}</strong> · {item.TALLA} · {item.LONGITUD} · {item.COLOR}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1.2fr 1fr', gap: 8 }}>
              <div><label style={labelStyle}>SKU</label>
                <select className="input" value={skuY} onChange={(e) => setSkuY(e.target.value)} style={{ marginTop: 2 }}>
                  {productos.map(p => <option key={p.SKU} value={p.SKU}>{p.SKU}</option>)}
                </select>
              </div>
              <div><label style={labelStyle}>Talla</label><input className="input" value={tallaY} onChange={(e) => setTallaY(e.target.value)} style={{ marginTop: 2 }} /></div>
              <div><label style={labelStyle}>Longitud</label>
                <select className="input" value={longY} onChange={(e) => setLongY(e.target.value)} style={{ marginTop: 2 }}>
                  {LONGITUDES.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div><label style={labelStyle}>Color</label><input className="input" value={colorY} onChange={(e) => setColorY(e.target.value)} style={{ marginTop: 2 }} /></div>
            </div>
          )}
          <div onClick={() => setOtraPrenda(!otraPrenda)} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 12 }}>
            <div style={{ width: 16, height: 16, borderRadius: 3, border: '1px solid var(--border)', background: otraPrenda ? 'var(--text)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {otraPrenda && <span style={{ color: 'var(--surface)', fontSize: 10 }}>✓</span>}
            </div>
            <span style={{ fontSize: 12 }}>La clienta quiere otra prenda en su lugar</span>
          </div>
        </div>

        {/* Resumen */}
        <div style={{ padding: '12px 14px', border: '1px solid var(--gold)', borderRadius: 4, marginBottom: 16, fontSize: 12, color: 'var(--text-soft)', lineHeight: 1.7 }}>
          <div>↩ <strong>{nombreSku(skuStock)}</strong> {tallaStock} {colorStock} → va a <strong>stock</strong></div>
          <div>✕ Se cancela del pedido: {item.NOMBRE_PRODUCTO || item.SKU} {item.TALLA} {item.COLOR}</div>
          <div>🔁 Se re-pide: {otraPrenda ? `${nombreSku(skuY)} ${tallaY} ${colorY}` : `${item.NOMBRE_PRODUCTO || item.SKU} ${item.TALLA} ${item.COLOR}`}</div>
          <div>💰 Se quita el costo de esa prenda del pedido</div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={confirmar} disabled={saving}>
            {saving ? 'Aplicando…' : 'Aplicar cambio'}
          </button>
        </div>
      </div>
    </div>
  );
}
