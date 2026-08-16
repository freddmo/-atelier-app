'use client';

import { useState, useEffect } from 'react';
import { ESTADOS, Estado } from '@/lib/types';
import { api, SetEmpaque } from '@/lib/api';

const PIN_ASUMIDO = 1.10; // mismo valor asumido que usa el backend/reportes

function round2Local(n: number): number {
  return Math.round(n * 100) / 100;
}

type Props = {
  ordenId: string;
  estadoActual: Estado;
  onClose: () => void;
  onChange: (nuevo: Estado, tipoEmpaque?: string, pinCantidad?: number, pinNota?: string, cantidadCajas?: number) => Promise<void>;
};

export default function StateModal({ ordenId, estadoActual, onClose, onChange }: Props) {
  const currentIdx = ESTADOS.indexOf(estadoActual);
  const [setsEmpaque, setSetsEmpaque] = useState<SetEmpaque[]>([]);
  const [empaqueSeleccionado, setEmpaqueSeleccionado] = useState('');
  const [cantidadCajas, setCantidadCajas] = useState(1);
  const [paso, setPaso] = useState<'estados' | 'empaque' | 'pines'>('estados');
  const [estadoPendiente, setEstadoPendiente] = useState<Estado | null>(null);
  const [loading, setLoading] = useState(false);

  const [pinCantidad, setPinCantidad] = useState(1);
  const [pinNota, setPinNota] = useState('');

  useEffect(() => {
    api.getSetEmpaque()
      .then((sets) => {
        setSetsEmpaque(sets);
        if (sets.length > 0) setEmpaqueSeleccionado(sets[0].SET_ID);
      })
      .catch(() => {});
  }, []);

  async function handleClick(s: Estado, isCurrent: boolean, isPast: boolean) {
    if (isCurrent) return;
    if (isPast) {
      const ok = confirm(`¿Estás seguro de regresar el estado a "${s}"?\n\nEsto significa que el pedido va a retroceder en el flujo.`);
      if (!ok) return;
    }
    if (s === 'LISTO PARA ENVIAR') {
      setEstadoPendiente(s);
      setPaso('empaque');
      return;
    }
    await onChange(s);
  }

  function confirmarConEmpaque() {
    if (!empaqueSeleccionado) return;
    setPaso('pines');
  }

  async function confirmarConPines() {
    if (!estadoPendiente) return;
    setLoading(true);
    try {
      const empaqueFinal = empaqueSeleccionado === '__none__' ? '' : empaqueSeleccionado;
      await onChange(estadoPendiente, empaqueFinal, pinCantidad, pinNota.trim(), cantidadCajas);
    } finally {
      setLoading(false);
    }
  }

  // ── Paso: empaque ──
  if (paso === 'empaque') {
    const setElegido = setsEmpaque.find(s => s.SET_ID === empaqueSeleccionado);
    const totalEmpaque = setElegido ? setElegido.costoTotal * cantidadCajas : 0;
    return (
      <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="modal-content" style={{ padding: 28, maxWidth: 420 }}>
          <div style={{ marginBottom: 20 }}>
            <span className="number-tag">{ordenId}</span>
            <h2 className="display" style={{ fontSize: 24, fontWeight: 400, margin: '6px 0 0' }}>Seleccionar empaque</h2>
            <p style={{ color: 'var(--text-soft)', fontSize: 13, margin: '6px 0 0' }}>Paso 1 de 2</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            <div
              onClick={() => setEmpaqueSeleccionado('__none__')}
              style={{
                padding: '14px 16px', borderRadius: 4, cursor: 'pointer',
                border: `1px solid ${empaqueSeleccionado === '__none__' ? 'var(--text)' : 'var(--border)'}`,
                background: empaqueSeleccionado === '__none__' ? 'var(--bg)' : 'transparent',
              }}
            >
              <span style={{ fontSize: 14, fontWeight: empaqueSeleccionado === '__none__' ? 500 : 400 }}>Sin empaque</span>
              <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4 }}>No se cobra empaque a este pedido</div>
            </div>
            {setsEmpaque.map(s => (
              <div
                key={s.SET_ID}
                onClick={() => setEmpaqueSeleccionado(s.SET_ID)}
                style={{
                  padding: '14px 16px', borderRadius: 4, cursor: 'pointer',
                  border: `1px solid ${empaqueSeleccionado === s.SET_ID ? 'var(--text)' : 'var(--border)'}`,
                  background: empaqueSeleccionado === s.SET_ID ? 'var(--bg)' : 'transparent',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 14, fontWeight: empaqueSeleccionado === s.SET_ID ? 500 : 400 }}>{s.NOMBRE_SET}</span>
                  <span className="tabular" style={{ fontSize: 14, color: 'var(--text-soft)' }}>${s.costoTotal.toFixed(2)} c/u</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4 }}>
                  {s.materiales.map(m => m.nombre).join(' · ')}
                </div>
              </div>
            ))}
          </div>

          {/* Cantidad de cajas */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--bg)', borderRadius: 4, marginBottom: 16 }}>
            <span style={{ fontSize: 13 }}>Cantidad de cajas</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button className="btn" onClick={() => setCantidadCajas(Math.max(1, cantidadCajas - 1))} style={{ padding: '4px 12px', fontSize: 16 }}>−</button>
              <span className="display tabular" style={{ fontSize: 18, minWidth: 24, textAlign: 'center' }}>{cantidadCajas}</span>
              <button className="btn" onClick={() => setCantidadCajas(cantidadCajas + 1)} style={{ padding: '4px 12px', fontSize: 16 }}>+</button>
            </div>
          </div>

          {setElegido && (
            <div style={{ background: 'var(--bg)', padding: '12px 14px', borderRadius: 4, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 500 }}>
                <span>Total empaque ({cantidadCajas} caja{cantidadCajas !== 1 ? 's' : ''})</span>
                <span className="tabular">${totalEmpaque.toFixed(2)}</span>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setPaso('estados')}>← Volver</button>
            <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={confirmarConEmpaque} disabled={!empaqueSeleccionado}>
              Siguiente →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Paso: pines ──
  if (paso === 'pines') {
    const costoPines = round2Local(PIN_ASUMIDO * pinCantidad);

    return (
      <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="modal-content" style={{ padding: 28, maxWidth: 420 }}>
          <div style={{ marginBottom: 20 }}>
            <span className="number-tag">{ordenId}</span>
            <h2 className="display" style={{ fontSize: 24, fontWeight: 400, margin: '6px 0 0' }}>Pin de regalo</h2>
            <p style={{ color: 'var(--text-soft)', fontSize: 13, margin: '6px 0 0' }}>Paso 2 de 2</p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--bg)', borderRadius: 4, marginBottom: 16 }}>
            <span style={{ fontSize: 13 }}>¿Cuántos pines?</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button className="btn" onClick={() => setPinCantidad(Math.max(0, pinCantidad - 1))} style={{ padding: '4px 12px', fontSize: 16 }}>−</button>
              <span className="display tabular" style={{ fontSize: 18, minWidth: 24, textAlign: 'center' }}>{pinCantidad}</span>
              <button className="btn" onClick={() => setPinCantidad(pinCantidad + 1)} style={{ padding: '4px 12px', fontSize: 16 }}>+</button>
            </div>
          </div>

          {pinCantidad > 0 && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase' }}>¿Cuál pin se puso?</label>
              <input
                className="input"
                value={pinNota}
                onChange={(e) => setPinNota(e.target.value)}
                placeholder="Ej: Diente con Escudo"
                style={{ marginTop: 4 }}
                autoFocus
              />
              <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 6 }}>
                No descuenta stock automáticamente — ajusta el inventario de pines a mano en Materiales.
              </div>
            </div>
          )}

          {pinCantidad > 0 && (
            <div style={{ background: 'var(--bg)', padding: '12px 14px', borderRadius: 4, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 500 }}>
                <span>{pinNota || 'Pin'} ×{pinCantidad}</span>
                <span className="tabular">${costoPines.toFixed(2)}</span>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setPaso('empaque')} disabled={loading}>← Volver</button>
            <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={confirmarConPines} disabled={loading}>
              {loading ? 'Guardando…' : 'Confirmar ✓'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Pantalla de estados ──
  return (
    <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content" style={{ padding: 28 }}>
        <div style={{ marginBottom: 20 }}>
          <span className="number-tag">{ordenId}</span>
          <h2 className="display" style={{ fontSize: 24, fontWeight: 400, margin: '6px 0 0' }}>Cambiar estado</h2>
          <p style={{ color: 'var(--text-soft)', fontSize: 13, margin: '6px 0 0' }}>
            Actual: <strong>{estadoActual}</strong>
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {ESTADOS.map((s, i) => {
            if (s === 'ENTREGADO') return null;
            const isCurrent = s === estadoActual;
            const isPast    = i < currentIdx;
            const isNext    = i === currentIdx + 1;
            let borderColor = 'var(--border)';
            if (isNext) borderColor = 'var(--text)';
            else if (isPast) borderColor = 'var(--amber)';

            return (
              <div
                key={s}
                onClick={() => handleClick(s, isCurrent, isPast)}
                style={{
                  padding: '12px 14px', borderRadius: 4,
                  cursor: isCurrent ? 'default' : 'pointer',
                  background: isCurrent ? 'var(--bg)' : 'transparent',
                  border: `1px solid ${borderColor}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}
                onMouseEnter={(e) => { if (!isCurrent) e.currentTarget.style.background = 'var(--bg)'; }}
                onMouseLeave={(e) => { if (!isCurrent) e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="tabular" style={{ fontSize: 11, color: 'var(--text-faint)' }}>0{i + 1}</span>
                  <span style={{ fontSize: 13, fontWeight: isCurrent ? 500 : 400 }}>{s}</span>
                </div>
                {isCurrent && <span style={{ fontSize: 10, color: 'var(--text-soft)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Actual</span>}
                {isNext    && <span style={{ fontSize: 10, color: 'var(--text)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Siguiente →</span>}
                {isPast    && <span style={{ fontSize: 10, color: 'var(--amber)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>← Regresar</span>}
              </div>
            );
          })}
        </div>

        <div style={{ background: 'var(--bg)', padding: '12px 14px', borderRadius: 4, fontSize: 11, color: 'var(--text-soft)', lineHeight: 1.6, marginBottom: 16 }}>
          <strong style={{ color: 'var(--text)' }}>Al cambiar el estado:</strong><br />
          ✓ Se actualizará en Google Sheets<br />
          ✓ Quedará registrado con fecha y usuario<br />
          ⚠️ Si regresas el estado, pedirá confirmación<br />
          📦 Si es "LISTO PARA ENVIAR", pedirá empaque y pin
        </div>

        <button className="btn" style={{ width: '100%', justifyContent: 'center' }} onClick={onClose}>Cancelar</button>
      </div>
    </div>
  );
}
