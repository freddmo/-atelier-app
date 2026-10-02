'use client';

import { useEffect, useState } from 'react';
import { api, type Cuenta } from '@/lib/api';
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
  onSaved: (pago: { ORDEN_ID: string; FECHA_PAGO: string; MONTO: number; METODO: string; URL_COMPROBANTE: string; NOTAS: string }) => void;
};

export default function PaymentModal({ ordenId, saldoActual, onClose, onSaved }: Props) {
  // Fecha de hoy en hora local (Ecuador), no en UTC: después de las 7 pm toISOString daba mañana.
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const [tipo, setTipo] = useState<'pago' | 'devolucion'>('pago');
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState(today);
  const [metodo, setMetodo] = useState('Transferencia');
  const [urlComprobante, setUrlComprobante] = useState('');
  const [notas, setNotas] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [cuenta, setCuenta] = useState('');

  useEffect(() => {
    api.getCuentas()
      .then(cs => setCuentas(cs.filter(c => c.tipo === 'BANCO' || c.tipo === 'EFECTIVO')))
      .catch(() => setCuentas([]));
  }, []);

  // Para pagos se muestran primero las cuentas que reciben pagos de clientas (y efectivo);
  // para devoluciones, todas.
  const recibenPagos = cuentas.filter(c => c.tipo === 'EFECTIVO' || /recibe pagos/i.test(c.uso));
  const cuentasVisibles = tipo === 'pago' && recibenPagos.length > 0 ? recibenPagos : cuentas;

  // 'Crédito aplicado' no mueve plata: no pide cuenta
  const pideCuenta = metodo !== 'Crédito aplicado' && metodo !== 'Devolución (crédito)';

  const metodos = tipo === 'pago' ? METODOS_PAGO : METODOS_DEVOLUCION;

  function cambiarTipo(nuevo: 'pago' | 'devolucion') {
    setTipo(nuevo);
    setCuenta('');
    setMetodo(nuevo === 'pago' ? 'Transferencia' : 'Devolución (transferencia)');
  }

  function pagarTotal() {
    if (saldoActual > 0) {
      setMonto(saldoActual.toFixed(2));
      setTipo('pago');
      setMetodo('Transferencia');
    }
  }

  async function handleSave() {
    const montoNum = Number(monto);
    if (isNaN(montoNum) || montoNum <= 0) {
      alert('Ingresa un monto válido (mayor a 0)');
      return;
    }
    if (pideCuenta && cuentasVisibles.length > 0 && !cuenta) {
      alert(tipo === 'pago' ? 'Elige a qué cuenta llegó la plata' : 'Elige de qué cuenta salió la devolución');
      return;
    }
    const user = auth.getUser();
    if (!user) return;

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
        cuenta: pideCuenta ? cuenta : '',
      }, user.usuario);
      onSaved({
        ORDEN_ID: ordenId,
        FECHA_PAGO: fecha,
        MONTO: montoFinal,
        METODO: metodo,
        URL_COMPROBANTE: urlComprobante.trim(),
        NOTAS: notas.trim(),
      });
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
              <p style={{ color: 'var(--text-soft)', fontSize: 13, margin: 0 }}>
                Saldo pendiente: <strong>${saldoActual.toFixed(2)}</strong>
              </p>
              <button
                onClick={pagarTotal}
                style={{
                  background: 'var(--gold)', color: 'white', border: 'none',
                  borderRadius: 4, padding: '5px 12px', fontSize: 12,
                  fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap'
                }}
              >
                Pagar total
              </button>
            </div>
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
          {pideCuenta && cuentasVisibles.length > 0 && (
            <div style={{ background: 'var(--amber-bg)', borderRadius: 6, padding: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--text-soft)', textTransform: 'uppercase', marginBottom: 8, fontWeight: 600 }}>
                {tipo === 'pago' ? '¿A qué cuenta llegó?' : '¿De qué cuenta salió?'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                {cuentasVisibles.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCuenta(c.id)}
                    style={{
                      minHeight: 44, padding: '6px 10px', borderRadius: 100, fontSize: 13, cursor: 'pointer',
                      border: `1px solid ${cuenta === c.id ? 'var(--text)' : 'var(--border)'}`,
                      background: cuenta === c.id ? 'var(--text)' : 'var(--surface)',
                      color: cuenta === c.id ? 'var(--surface)' : 'var(--text)',
                    }}
                  >
                    {c.nombre}
                  </button>
                ))}
              </div>
            </div>
          )}
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
