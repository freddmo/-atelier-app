'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { auth } from '@/lib/auth';

const METODOS_PAGO = [
  'Transferencia', 'Efectivo', 'Tarjeta de crédito', 'Deuna', 'PayPal',
  'Crédito aplicado',
];
const METODOS_DEVOLUCION = [
  'Devolución (transferencia)', 'Devolución (crédito)',
];

type Props = {
  ordenId: string;
  saldoActual: number;
  onClose: () => void;
  onSaved: () => void;
};

export default function PaymentModal({ ordenId, saldoActual, onClose, onSaved }: Props) {
  const today = new Date().toISOString().split('T')[0];

  const [tipo, setTipo] = useState<'pago' | 'devolucion'>('pago');
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState(today);
  const [metodo, setMetodo] = useState('Transferencia');
  const [urlComprobante, setUrlComprobante] = useState('');
  const [notas, setNotas] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const metodos = tipo === 'pago' ? METODOS_PAGO : METODOS_DEVOLUCION;

  function cambiarTipo(nuevo: 'pago' | 'devolucion') {
    setTipo(nuevo);
    setMetodo(nuevo === 'pago' ? 'Transferencia' : 'Devolución (transferencia)');
  }

  async function handleSave() {
    const montoNum = Number(monto);
    if (isNaN(montoNum) || montoNum <= 0) {
      alert('Ingresa un monto válido (mayor a 0)');
      return;
    }
    const user = auth.getUser();
    if (!user) return;

    // Devolución = monto negativo
    const montoFinal = tipo === 'devolucion' ? -Math.abs(montoNum) : Math.abs(montoNum);

    setSubmitting(true);
    try {
      await api.agregarPago({
        ordenId,
        cantidad: montoFinal,
        fecha,
        metodo,
        urlComprobante: urlComprobante.trim(),
        notas: notas.trim(),
      }, user.usuario);
      onSaved();
    } catch (err) {
      alert('Error: ' + (err instanceof Error ? err.message : 'desconocido'));
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content" style={{ padding: 28, maxWidth: 460 }}>
        <div style={{ marginBottom: 20 }}>
          <span className="number-tag">{ordenId}</span>
          <h2 className="display" style={{ fontSize: 24, fontWeight: 400, margin: '6px 0 0' }}>
            Registrar {tipo === 'pago' ? 'pago' : 'devolución'}
          </h2>
          {saldoActual > 0 && (
            <p style={{ color: 'var(--text-soft)', fontSize: 13, margin: '6px 0 0' }}>
              Saldo pendiente: <strong>${saldoActual.toFixed(2)}</strong>
            </p>
          )}
        </div>

        {/* Toggle pago / devolución */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 18, border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
          <button
            onClick={() => cambiarTipo('pago')}
            style={{
              flex: 1, padding: '10px', fontSize: 13, cursor: 'pointer', border: 'none',
              background: tipo === 'pago' ? 'var(--text)' : 'transparent',
              color: tipo === 'pago' ? 'var(--surface)' : 'var(--text-soft)',
              fontWeight: tipo === 'pago' ? 500 : 400,
            }}
          >
            Pago
          </button>
          <button
            onClick={() => cambiarTipo('devolucion')}
            style={{
              flex: 1, padding: '10px', fontSize: 13, cursor: 'pointer', border: 'none',
              background: tipo === 'devolucion' ? 'var(--rose)' : 'transparent',
              color: tipo === 'devolucion' ? 'white' : 'var(--text-soft)',
              fontWeight: tipo === 'devolucion' ? 500 : 400,
            }}
          >
            Devolución
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Monto $</label>
            <input
              type="number" step="0.01" className="input" value={monto}
              onChange={(e) => setMonto(e.target.value)} placeholder="0.00"
              style={{ marginTop: 4 }} autoFocus
            />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Fecha</label>
            <input type="date" className="input" value={fecha} onChange={(e) => setFecha(e.target.value)} style={{ marginTop: 4 }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Método</label>
            <select className="input" value={metodo} onChange={(e) => setMetodo(e.target.value)} style={{ marginTop: 4 }}>
              {metodos.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase' }}>URL comprobante (opcional)</label>
            <input className="input" value={urlComprobante} onChange={(e) => setUrlComprobante(e.target.value)} placeholder="Link de la captura…" style={{ marginTop: 4 }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Notas (opcional)</label>
            <input className="input" value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Ej: abono 50% inicial" style={{ marginTop: 4 }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <button className="btn" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose} disabled={submitting}>
            Cancelar
          </button>
          <button
            className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}
            onClick={handleSave} disabled={submitting}
          >
            {submitting ? 'Guardando…' : `Registrar ${tipo === 'pago' ? 'pago' : 'devolución'}`}
          </button>
        </div>
      </div>
    </div>
  );
}
