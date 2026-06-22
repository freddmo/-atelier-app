'use client';

import { useState, useEffect } from 'react';
import { ESTADOS, Estado } from '@/lib/types';
import { api, SetEmpaque, Regalo } from '@/lib/api';

type Props = {
  ordenId: string;
  estadoActual: Estado;
  onClose: () => void;
  onChange: (nuevo: Estado, tipoEmpaque?: string, pines?: { regaloid: string; cantidad: number }[], cantidadCajas?: number) => Promise<void>;
};

export default function StateModal({ ordenId, estadoActual, onClose, onChange }: Props) {
  const currentIdx = ESTADOS.indexOf(estadoActual);
  const [setsEmpaque, setSetsEmpaque] = useState<SetEmpaque[]>([]);
  const [regalos, setRegalos] = useState<Regalo[]>([]);
  const [empaqueSeleccionado, setEmpaqueSeleccionado] = useState('');
  const [cantidadCajas, setCantidadCajas] = useState(1);
  const [paso, setPaso] = useState<'estados' | 'empaque' | 'pines'>('estados');
  const [estadoPendiente, setEstadoPendiente] = useState<Estado | null>(null);
  const [loading, setLoading] = useState(false);

  const [pinPrincipal, setPinPrincipal] = useState('');
  const [pinExtra, setPinExtra] = useState('');
  const [agregarExtra, setAgregarExtra] = useState(false);

  useEffect(() => {
    Promise.all([api.getSetEmpaque(), api.getRegalos()])
      .then(([sets, regs]) => {
        setSetsEmpaque(sets);
        setRegalos(regs);
        if (sets.length > 0) setEmpaqueSeleccionado(sets[0].SET_ID);
        const conStock = regs.filter(r => Number(r.STOCK) > 0);
        if (conStock.length > 0) setPinPrincipal(conStock[0].REGALO_ID);
      })
      .catch(() => {});
  }, []);

  // Pines con stock disponible
  const pinesConStock = regalos.filter(r => Number(r.STOCK) > 0);

  // Para el pin EXTRA: excluye el principal si ya consumió todo su stock (stock 1)
  const principalObj = regalos.find(r => r.REGALO_ID === pinPrincipal);
  const pinesParaExtra = pinesConStock.filter(r => {
    if (r.REGALO_ID !== pinPrincipal) return true;
    // Mismo pin que el principal: solo disponible si tiene stock >= 2
    return Number(r.STOCK) >= 2;
  });

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
      const pines: { regaloid: string; cantidad: number }[] = [];
      if (pinPrincipal && pinPrincipal !== '__none__' && principalObj) {
        pines.push({ regaloid: pinPrincipal, cantidad: 1 });
      }
      if (agregarExtra && pinExtra) {
        const existente = pines.find(p => p.regaloid === pinExtra);
        if (existente) existente.cantidad += 1;
        else pines.push({ regaloid: pinExtra, cantidad: 1 });
      }
      const empaqueFinal = empaqueSeleccionado === '__none__' ? '' : empaqueSeleccionado;
      await onChange(estadoPendiente, empaqueFinal, pines, cantidadCajas);
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
    const pinPrincipalObj = regalos.find(r => r.REGALO_ID === pinPrincipal);
    const pinExtraObj     = regalos.find(r => r.REGALO_ID === pinExtra);
    const costoPines = (pinPrincipalObj ? pinPrincipalObj.COSTO_UNITARIO : 0) +
                       (agregarExtra && pinExtraObj ? pinExtraObj.COSTO_UNITARIO : 0);

    return (
      <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="modal-content" style={{ padding: 28, maxWidth: 420 }}>
          <div style={{ marginBottom: 20 }}>
            <span className="number-tag">{ordenId}</span>
            <h2 className="display" style={{ fontSize: 24, fontWeight: 400, margin: '6px 0 0' }}>Seleccionar pin</h2>
            <p style={{ color: 'var(--text-soft)', fontSize: 13, margin: '6px 0 0' }}>Paso 2 de 2</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Pin principal (×1)</label>
              <select
                className="input"
                value={pinPrincipal}
                onChange={(e) => {
                  setPinPrincipal(e.target.value);
                  // Si el extra quedó igual al nuevo principal y no hay stock para repetir, lo limpio
                  if (pinExtra === e.target.value) {
                    const r = regalos.find(x => x.REGALO_ID === e.target.value);
                    if (r && Number(r.STOCK) < 2) setPinExtra('');
                  }
                }}
                style={{ marginTop: 4 }}
              >
                <option value="__none__">— Sin pin —</option>
                {pinesConStock.map(r => (
                  <option key={r.REGALO_ID} value={r.REGALO_ID}>
                    {r.NOMBRE} · stock: {r.STOCK}
                  </option>
                ))}
              </select>
            </div>

            {pinPrincipal !== '__none__' && (
            <div>
              <div
                onClick={() => {
                  const next = !agregarExtra;
                  setAgregarExtra(next);
                  if (next && !pinExtra && pinesParaExtra.length > 0) setPinExtra(pinesParaExtra[0].REGALO_ID);
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: agregarExtra ? 8 : 0 }}
              >
                <div style={{
                  width: 18, height: 18, borderRadius: 3, border: '1px solid var(--border)',
                  background: agregarExtra ? 'var(--text)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                  {agregarExtra && <span style={{ color: 'var(--surface)', fontSize: 11, lineHeight: 1 }}>✓</span>}
                </div>
                <span style={{ fontSize: 13 }}>Agregar pin extra (×1)</span>
              </div>
              {agregarExtra && (
                <select
                  className="input"
                  value={pinExtra}
                  onChange={(e) => setPinExtra(e.target.value)}
                >
                  {pinesParaExtra.length === 0 && <option value="">(no hay otro pin disponible)</option>}
                  {pinesParaExtra.map(r => (
                    <option key={r.REGALO_ID} value={r.REGALO_ID}>
                      {r.NOMBRE} · stock: {r.STOCK}
                    </option>
                  ))}
                </select>
              )}
            </div>
            )}
          </div>

          <div style={{ background: 'var(--bg)', padding: '12px 14px', borderRadius: 4, marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase', marginBottom: 8 }}>Resumen</div>
            {pinPrincipalObj && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '3px 0' }}>
                <span style={{ color: 'var(--text-soft)' }}>{pinPrincipalObj.NOMBRE} ×1</span>
                <span className="tabular">${pinPrincipalObj.COSTO_UNITARIO.toFixed(2)}</span>
              </div>
            )}
            {agregarExtra && pinExtraObj && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '3px 0' }}>
                <span style={{ color: 'var(--text-soft)' }}>{pinExtraObj.NOMBRE} ×1 (extra)</span>
                <span className="tabular">${pinExtraObj.COSTO_UNITARIO.toFixed(2)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 500, paddingTop: 8, marginTop: 4, borderTop: '1px solid var(--border)' }}>
              <span>Total pines</span>
              <span className="tabular">${costoPines.toFixed(2)}</span>
            </div>
          </div>

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
