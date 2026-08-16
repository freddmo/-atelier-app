'use client';

import { useState, useEffect } from 'react';
import { ESTADOS, Estado } from '@/lib/types';
import { api, SetEmpaque, ApiError } from '@/lib/api';
import { auth } from '@/lib/auth';

type ItemLite = {
  _rowNum: number;
  NOMBRE_PRODUCTO?: string;
  SKU: string;
  TALLA: string;
  LONGITUD: string;
  COLOR: string;
  ESTATUS_ITEM?: string;
  ENTREGADO_ITEM?: string | boolean;
};

type Props = {
  ordenId: string;
  items: ItemLite[];
  estadoCabecera: string;
  isAdmin: boolean;
  onClose: () => void;
  onDone: (msg: string) => void;
};

export default function ItemsStateModal({ ordenId, items, estadoCabecera, isAdmin, onClose, onDone }: Props) {
  // Solo ítems vivos: los CANCELADO no se pueden entregar ni mover
  const itemsVisibles = items.filter(it => String(it.ESTATUS_ITEM || '').toUpperCase().trim() !== 'CANCELADO');

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [target, setTarget] = useState<Estado | ''>('');
  const [setsEmpaque, setSetsEmpaque] = useState<SetEmpaque[]>([]);
  const [empaque, setEmpaque] = useState('');
  const [pinCantidad, setPinCantidad] = useState(0);
  const [pinNota, setPinNota] = useState('');
  const [costoDelivery, setCostoDelivery] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getSetEmpaque().then(setSetsEmpaque).catch(() => {});
  }, []);

  function toggle(row: number) {
    const next = new Set(selected);
    if (next.has(row)) next.delete(row); else next.add(row);
    setSelected(next);
  }
  function toggleAll() {
    if (selected.size === itemsVisibles.length) setSelected(new Set());
    else setSelected(new Set(itemsVisibles.map(i => i._rowNum)));
  }
  function estadoItem(it: ItemLite): string {
    const e = String(it.ESTATUS_ITEM || '').trim();
    return e || estadoCabecera;
  }
  function entregado(it: ItemLite): boolean {
    return String(it.ENTREGADO_ITEM).toUpperCase().trim() === 'TRUE';
  }

  async function confirmar() {
    const user = auth.getUser();
    if (!user) return;
    if (selected.size === 0) { alert('Selecciona al menos un ítem'); return; }
    if (!target) { alert('Elige el nuevo estado'); return; }
    if (target === 'LISTO PARA ENVIAR' && !empaque) { alert('Elige el tipo de empaque'); return; }

    const itemRows = Array.from(selected);
    const opts: {
      forzar?: boolean; tipoEmpaque?: string; costoDelivery?: number;
      pinCantidad?: number; pinNota?: string;
    } = {};
    if (target === 'LISTO PARA ENVIAR') opts.tipoEmpaque = empaque;
    if (target === 'LISTO PARA ENVIAR' && pinCantidad > 0) {
      opts.pinCantidad = pinCantidad;
      opts.pinNota = pinNota.trim();
    }
    if (target === 'ENTREGADO' && Number(costoDelivery) > 0) opts.costoDelivery = Number(costoDelivery);

    setSaving(true);
    const intentar = (forzar: boolean) =>
      api.cambiarEstadoItems(ordenId, itemRows, target as string, user.usuario, { ...opts, forzar });

    try {
      await intentar(false);
      onDone(`${itemRows.length} ítem(s) → ${target}`);
    } catch (err) {
      const bloqueoSaldo = err instanceof ApiError && err.code === 422;
      if (bloqueoSaldo && isAdmin) {
        const ok = confirm(`${err.message}\n\nEres admin. ¿Forzar de todas formas?`);
        if (ok) {
          try { await intentar(true); onDone(`${itemRows.length} ítem(s) → ${target} (forzado)`); }
          catch (e2) { alert('Error: ' + (e2 instanceof Error ? e2.message : 'desconocido')); }
        }
      } else {
        alert('Error: ' + (err instanceof Error ? err.message : 'desconocido'));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content" style={{ padding: 28, maxWidth: 540 }}>
        <div style={{ marginBottom: 18 }}>
          <span className="number-tag">{ordenId}</span>
          <h2 className="display" style={{ fontSize: 24, fontWeight: 400, margin: '6px 0 0' }}>Entregar / mover ítems</h2>
          <p style={{ color: 'var(--text-soft)', fontSize: 13, margin: '6px 0 0' }}>
            Marca los ítems que quieres mover y elige el nuevo estado.
          </p>
        </div>

        {/* Selección de ítems */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Ítems</span>
          <button className="btn" onClick={toggleAll} style={{ padding: '4px 10px', fontSize: 11 }}>
            {selected.size === itemsVisibles.length ? 'Quitar todos' : 'Marcar todos'}
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18 }}>
          {itemsVisibles.map(it => (
            <div
              key={it._rowNum}
              onClick={() => toggle(it._rowNum)}
              style={{
                padding: '10px 12px', borderRadius: 4, cursor: 'pointer',
                border: `1px solid ${selected.has(it._rowNum) ? 'var(--text)' : 'var(--border)'}`,
                background: selected.has(it._rowNum) ? 'var(--bg)' : 'transparent',
                display: 'flex', alignItems: 'center', gap: 10,
              }}
            >
              <input type="checkbox" readOnly checked={selected.has(it._rowNum)} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13 }}>{it.NOMBRE_PRODUCTO || it.SKU}</div>
                <div style={{ fontSize: 11, color: 'var(--text-soft)' }}>
                  {it.TALLA} · {it.LONGITUD} · {it.COLOR}
                </div>
              </div>
              <span className="pill" style={{ fontSize: 10, padding: '3px 8px', background: entregado(it) ? 'var(--green-bg, #E6F4EA)' : 'var(--bg)', color: entregado(it) ? 'var(--green)' : 'var(--text-soft)' }}>
                {entregado(it) ? '✓ ' : ''}{estadoItem(it)}
              </span>
            </div>
          ))}
        </div>

        {/* Nuevo estado */}
        <label style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Nuevo estado</label>
        <select
          className="input"
          value={target}
          onChange={(e) => setTarget(e.target.value as Estado)}
          style={{ marginTop: 4, marginBottom: 14 }}
        >
          <option value="">— Elegir estado —</option>
          {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        {/* Empaque + Pin (si LISTO PARA ENVIAR) */}
        {target === 'LISTO PARA ENVIAR' && (
          <>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Tipo de empaque</label>
              <select className="input" value={empaque} onChange={(e) => setEmpaque(e.target.value)} style={{ marginTop: 4 }}>
                <option value="">— Elegir empaque —</option>
                {setsEmpaque.map(s => <option key={s.SET_ID} value={s.SET_ID}>{s.NOMBRE_SET} — ${s.costoTotal.toFixed(2)}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase' }}>¿Cuántos pines?</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
                <button type="button" className="btn" onClick={() => setPinCantidad(Math.max(0, pinCantidad - 1))} style={{ padding: '4px 12px', fontSize: 16 }}>−</button>
                <span className="display tabular" style={{ fontSize: 16, minWidth: 20, textAlign: 'center' }}>{pinCantidad}</span>
                <button type="button" className="btn" onClick={() => setPinCantidad(pinCantidad + 1)} style={{ padding: '4px 12px', fontSize: 16 }}>+</button>
              </div>
              {pinCantidad > 0 && (
                <input
                  className="input"
                  value={pinNota}
                  onChange={(e) => setPinNota(e.target.value)}
                  placeholder="¿Cuál pin se puso? Ej: Diente con Escudo"
                  style={{ marginTop: 8 }}
                />
              )}
            </div>
          </>
        )}

        {/* Costo delivery (si ENTREGADO) */}
        {target === 'ENTREGADO' && (
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Costo del delivery (opcional)</label>
            <input type="number" step="0.01" className="input" value={costoDelivery} onChange={(e) => setCostoDelivery(e.target.value)} placeholder="0.00" style={{ marginTop: 4 }} />
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button className="btn" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={confirmar} disabled={saving}>
            {saving ? 'Guardando…' : 'Aplicar'}
          </button>
        </div>
      </div>
    </div>
  );
}
