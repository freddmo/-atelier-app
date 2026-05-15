'use client';

import { ESTADOS, Estado } from '@/lib/types';

type Props = {
  ordenId: string;
  estadoActual: Estado;
  onClose: () => void;
  onChange: (nuevo: Estado) => Promise<void>;
};

export default function StateModal({ ordenId, estadoActual, onClose, onChange }: Props) {
  const currentIdx = ESTADOS.indexOf(estadoActual);

  async function handleClick(s: Estado, isCurrent: boolean, isPast: boolean) {
    if (isCurrent) return;

    // Confirmación si va para atrás
    if (isPast) {
      const ok = confirm(
        `¿Estás seguro de regresar el estado a "${s}"?\n\nEsto significa que el pedido va a retroceder en el flujo.`
      );
      if (!ok) return;
    }

    await onChange(s);
  }

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
            const isPast = i < currentIdx;
            const isNext = i === currentIdx + 1;

            // Color del borde según la dirección
            let borderColor = 'var(--border)';
            if (isNext) borderColor = 'var(--text)';
            else if (isPast) borderColor = 'var(--amber)';

            return (
              <div
                key={s}
                onClick={() => handleClick(s, isCurrent, isPast)}
                style={{
                  padding: '12px 14px',
                  borderRadius: 4,
                  cursor: isCurrent ? 'default' : 'pointer',
                  background: isCurrent ? 'var(--bg)' : 'transparent',
                  border: `1px solid ${borderColor}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (!isCurrent) e.currentTarget.style.background = 'var(--bg)';
                }}
                onMouseLeave={(e) => {
                  if (!isCurrent) e.currentTarget.style.background = 'transparent';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="tabular" style={{ fontSize: 11, color: 'var(--text-faint)' }}>0{i + 1}</span>
                  <span style={{ fontSize: 13, fontWeight: isCurrent ? 500 : 400 }}>{s}</span>
                </div>
                {isCurrent && <span style={{ fontSize: 10, color: 'var(--text-soft)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Actual</span>}
                {isNext && <span style={{ fontSize: 10, color: 'var(--text)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Siguiente →</span>}
                {isPast && <span style={{ fontSize: 10, color: 'var(--amber)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>← Regresar</span>}
              </div>
            );
          })}
        </div>

        <div style={{ background: 'var(--bg)', padding: '12px 14px', borderRadius: 4, fontSize: 11, color: 'var(--text-soft)', lineHeight: 1.6, marginBottom: 16 }}>
          <strong style={{ color: 'var(--text)' }}>Al cambiar el estado:</strong><br />
          ✓ Se actualizará en Google Sheets<br />
          ✓ Quedará registrado con fecha y usuario<br />
          ⚠️ Si regresas el estado, pedirá confirmación
        </div>

        <button className="btn" style={{ width: '100%', justifyContent: 'center' }} onClick={onClose}>Cancelar</button>
      </div>
    </div>
  );
}