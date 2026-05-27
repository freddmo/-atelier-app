'use client';

import { useState, useEffect } from 'react';
import { ESTADOS, Estado } from '@/lib/types';
import { api, SetEmpaque } from '@/lib/api';

type Props = {
  ordenId: string;
  estadoActual: Estado;
  onClose: () => void;
  onChange: (nuevo: Estado, tipoEmpaque?: string) => Promise<void>;
};

export default function StateModal({ ordenId, estadoActual, onClose, onChange }: Props) {
  const currentIdx = ESTADOS.indexOf(estadoActual);
  const [setsEmpaque, setSetsEmpaque] = useState<SetEmpaque[]>([]);
  const [empaqueSeleccionado, setEmpaqueSeleccionado] = useState('');
  const [esperandoEmpaque, setEsperandoEmpaque] = useState(false);
  const [estadoPendiente, setEstadoPendiente] = useState<Estado | null>(null);
  const [loadingEmpaque, setLoadingEmpaque] = useState(false);

  useEffect(() => {
    api.getSetEmpaque().then(setSetsEmpaque).catch(() => {});
  }, []);

  async function handleClick(s: Estado, isCurrent: boolean, isPast: boolean) {
    if (isCurrent) return;

    if (isPast) {
      const ok = confirm(
        `¿Estás seguro de regresar el estado a "${s}"?\n\nEsto significa que el pedido va a retroceder en el flujo.`
      );
      if (!ok) return;
    }

    // Si es LISTO PARA ENVIAR, pedir empaque primero
    if (s === 'LISTO PARA ENVIAR') {
      setEstadoPendiente(s);
      setEmpaqueSeleccionado(setsEmpaque[0]?.SET_ID || '');
      setEsperandoEmpaque(true);
      return;
    }

    await onChange(s);
  }

  async function confirmarConEmpaque() {
    if (!estadoPendiente || !empaqueSeleccionado) return;
    setLoadingEmpaque(true);
    try {
      await onChange(estadoPendiente, empaqueSeleccionado);
    } finally {
      setLoadingEmpaque(false);
    }
  }

  // ── Pantalla de selección de empaque ──────────────────────────────────────
  if (esperandoEmpaque) {
    const setElegido = setsEmpaque.find(s => s.SET_ID === empaqueSeleccionado);
    return (
      <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="modal-content" style={{ padding: 28, maxWidth: 420 }}>
          <div style={{ marginBottom: 20 }}>
            <span className="number-tag">{ordenId}</span>
            <h2 className="display" style={{ fontSize: 24, fontWeight: 400, margin: '6px 0 0' }}>
              Seleccionar empaque
            </h2>
            <p style={{ color: 'var(--text-soft)', fontSize: 13, margin: '6px 0 0' }}>
              Elige el tipo de empaque para este pedido
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {setsEmpaque.map(s => (
              <div
                key={s.SET_ID}
                onClick={() => setEmpaqueSeleccionado(s.SET_ID)}
                style={{
                  padding: '14px 16px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  border: `1px solid ${empaqueSeleccionado === s.SET_ID ? 'var(--text)' : 'var(--border)'}`,
                  background: empaqueSeleccionado === s.SET_ID ? 'var(--bg)' : 'transparent',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 14, fontWeight: empaqueSeleccionado === s.SET_ID ? 500 : 400 }}>
                    {s.NOMBRE_SET}
                  </span>
                  <span className="tabular" style={{ fontSize: 14, color: 'var(--text-soft)' }}>
                    ${s.costoTotal.toFixed(2)}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4 }}>
                  {s.materiales.map(m => m.nombre).join(' · ')}
                </div>
              </div>
            ))}
          </div>

          {setElegido && (
            <div style={{ background: 'var(--bg)', padding: '12px 14px', borderRadius: 4, marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase', marginBottom: 8 }}>
                Detalle del empaque
              </div>
              {setElegido.materiales.map(m => (
                <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '3px 0' }}>
                  <span style={{ color: 'var(--text-soft)' }}>{m.nombre}</span>
                  <span className="tabular">${m.costo.toFixed(2)}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 500, paddingTop: 8, marginTop: 4, borderTop: '1px solid var(--border)' }}>
                <span>Total empaque</span>
                <span className="tabular">${setElegido.costoTotal.toFixed(2)}</span>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              className="btn"
              style={{ flex: 1, justifyContent: 'center' }}
              onClick={() => setEsperandoEmpaque(false)}
              disabled={loadingEmpaque}
            >
              ← Volver
            </button>
            <button
              className="btn btn-primary"
              style={{ flex: 1, justifyContent: 'center' }}
              onClick={confirmarConEmpaque}
              disabled={!empaqueSeleccionado || loadingEmpaque}
            >
              {loadingEmpaque ? 'Guardando…' : 'Confirmar →'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Pantalla normal de estados ────────────────────────────────────────────
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
                  transition: 'all 0.15s',
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
          📦 Si es "LISTO PARA ENVIAR", pedirá el tipo de empaque
        </div>

        <button className="btn" style={{ width: '100%', justifyContent: 'center' }} onClick={onClose}>Cancelar</button>
      </div>
    </div>
  );
}
