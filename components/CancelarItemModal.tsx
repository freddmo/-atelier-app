'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { auth } from '@/lib/auth';

type ItemX = {
  _rowNum: number;
  SKU: string;
  NOMBRE_PRODUCTO?: string;
  TALLA: string;
  LONGITUD: string;
  COLOR: string;
  COSTO_UNITARIO?: number;
};

type Props = {
  ordenId: string;
  item: ItemX;
  onClose: () => void;
  onDone: (msg: string) => void;
};

export default function CancelarItemModal({ ordenId, item, onClose, onDone }: Props) {
  const [destino, setDestino] = useState<'FIGS' | 'STOCK'>('FIGS');
  const [costoStock, setCostoStock] = useState(item.COSTO_UNITARIO != null ? String(item.COSTO_UNITARIO) : '');
  const [saving, setSaving] = useState(false);

  async function confirmar() {
    const user = auth.getUser();
    if (!user) return;
    setSaving(true);
    try {
      const res = await api.cancelarItemPedido(
        {
          ordenId,
          itemRow: item._rowNum,
          destino,
          costoStock: destino === 'STOCK' && costoStock !== '' ? Number(costoStock) : undefined,
        },
        user.usuario
      );
      onDone(
        destino === 'FIGS'
          ? `Ítem cancelado y devuelto a FIGS — $${res.costoRevertido.toFixed(2)} revertido`
          : `Ítem cancelado, pasó a stock (${res.loteId}) — $${res.costoRevertido.toFixed(2)} movido`
      );
    } catch (err) {
      alert('Error: ' + (err instanceof Error ? err.message : 'desconocido'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content" style={{ padding: 28, maxWidth: 460 }}>
        <div style={{ marginBottom: 18 }}>
          <span className="number-tag">{ordenId}</span>
          <h2 className="display" style={{ fontSize: 24, fontWeight: 400, margin: '6px 0 0' }}>Cancelar ítem</h2>
          <p style={{ color: 'var(--text-soft)', fontSize: 13, margin: '6px 0 0' }}>
            <strong>{item.NOMBRE_PRODUCTO || item.SKU}</strong> ({item.TALLA} · {item.COLOR})
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          <div
            onClick={() => setDestino('FIGS')}
            style={{
              padding: '14px 16px', borderRadius: 4, cursor: 'pointer',
              border: `1px solid ${destino === 'FIGS' ? 'var(--text)' : 'var(--border)'}`,
              background: destino === 'FIGS' ? 'var(--bg)' : 'transparent',
            }}
          >
            <div style={{ fontSize: 14, fontWeight: destino === 'FIGS' ? 500 : 400 }}>🇺🇸 Se devuelve a FIGS</div>
            <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4 }}>
              Aún no viajó a Ecuador — la devuelvo y recupero el dinero de verdad. No queda como stock.
            </div>
          </div>
          <div
            onClick={() => setDestino('STOCK')}
            style={{
              padding: '14px 16px', borderRadius: 4, cursor: 'pointer',
              border: `1px solid ${destino === 'STOCK' ? 'var(--text)' : 'var(--border)'}`,
              background: destino === 'STOCK' ? 'var(--bg)' : 'transparent',
            }}
          >
            <div style={{ fontSize: 14, fontWeight: destino === 'STOCK' ? 500 : 400 }}>📦 Pasa a stock</div>
            <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4 }}>
              Error nuestro, no se re-pide nada — la prenda se queda contigo para vender después.
            </div>
          </div>
        </div>

        {destino === 'STOCK' && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Costo al que entra a stock $</label>
            <input
              type="number" step="0.01" className="input"
              value={costoStock} onChange={(e) => setCostoStock(e.target.value)}
              placeholder="auto" style={{ marginTop: 4 }}
            />
          </div>
        )}

        <div style={{ padding: '10px 14px', background: 'var(--bg)', borderRadius: 4, marginBottom: 16, fontSize: 12, color: 'var(--text-soft)' }}>
          💰 El costo original de este ítem se borra del pedido{destino === 'STOCK' ? ' (se mueve al valor del nuevo lote de stock).' : ', ya no cuenta como gasto.'}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={confirmar} disabled={saving}>
            {saving ? 'Guardando…' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}
