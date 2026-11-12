'use client';

// "Persona que recibe": cuando la clienta compra pero el paquete lo recibe otra persona.
// Se guarda en el PEDIDO (no en la clienta): nombre, teléfono, cédula, dirección y ciudad.

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { auth } from '@/lib/auth';

export type Recibe = { nombre: string; telefono: string; cedula: string; direccion: string; ciudad: string };
export const RECIBE_VACIO: Recibe = { nombre: '', telefono: '', cedula: '', direccion: '', ciudad: '' };

const s = (v: unknown) => (v === null || v === undefined ? '' : String(v)).trim();

// Lee los datos de quien recibe desde un pedido
export function recibeDe(p: Record<string, unknown> | null | undefined): Recibe {
  if (!p) return { ...RECIBE_VACIO };
  return {
    nombre: s(p.RECIBE_NOMBRE), telefono: s(p.RECIBE_TELEFONO), cedula: s(p.RECIBE_CEDULA),
    direccion: s(p.RECIBE_DIRECCION), ciudad: s(p.RECIBE_CIUDAD),
  };
}
export const hayRecibe = (r: Recibe) => !!(r.nombre || r.telefono || r.cedula || r.direccion || r.ciudad);

const labelStyle = { fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase' as const };

// Solo los campos (para usar dentro de otros formularios, como Nuevo pedido)
export function RecibeCampos({ valor, onChange }: { valor: Recibe; onChange: (r: Recibe) => void }) {
  const set = (k: keyof Recibe) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...valor, [k]: e.target.value });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div>
        <label style={labelStyle}>Nombre y apellido</label>
        <input className="input" value={valor.nombre} onChange={set('nombre')} placeholder="Quien recibe el paquete" style={{ marginTop: 2 }} />
      </div>
      <div className="m-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div>
          <label style={labelStyle}>Teléfono</label>
          <input className="input" type="tel" inputMode="tel" value={valor.telefono} onChange={set('telefono')} style={{ marginTop: 2 }} />
        </div>
        <div>
          <label style={labelStyle}>Cédula</label>
          <input className="input" inputMode="numeric" value={valor.cedula} onChange={set('cedula')} style={{ marginTop: 2 }} />
        </div>
      </div>
      <div className="m-2col" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}>
        <div>
          <label style={labelStyle}>Dirección</label>
          <input className="input" value={valor.direccion} onChange={set('direccion')} style={{ marginTop: 2 }} />
        </div>
        <div>
          <label style={labelStyle}>Ciudad</label>
          <input className="input" value={valor.ciudad} onChange={set('ciudad')} style={{ marginTop: 2 }} />
        </div>
      </div>
    </div>
  );
}

// Vista + edición en la tarjeta del pedido y en su detalle (guarda sola en el backend)
export default function RecibeEditor({ ordenId, inicial, onGuardado }: { ordenId: string; inicial: Recibe; onGuardado?: (r: Recibe) => void }) {
  const [actual, setActual] = useState<Recibe>(inicial);
  const [borrador, setBorrador] = useState<Recibe>(inicial);
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [puedeEditar, setPuedeEditar] = useState(false);

  useEffect(() => { setActual(inicial); setBorrador(inicial); }, [inicial.nombre, inicial.telefono, inicial.cedula, inicial.direccion, inicial.ciudad]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const u = auth.getUser(); setPuedeEditar(!!u && (u.rol === 'admin' || u.rol === 'bodega')); }, []);

  async function guardar(datos: Recibe) {
    const user = auth.getUser();
    if (!user) return;
    setGuardando(true);
    try {
      await api.setRecibe(ordenId, datos, user.usuario);
      setActual(datos);
      setEditando(false);
      onGuardado?.(datos);
    } catch (err) {
      alert('No se pudo guardar: ' + (err instanceof Error ? err.message : 'desconocido'));
    } finally {
      setGuardando(false);
    }
  }

  if (editando) {
    return (
      <div style={{ marginTop: 10, padding: 12, background: 'var(--bg)', borderRadius: 4, border: '1px solid var(--border)' }}>
        <div style={{ ...labelStyle, marginBottom: 8 }}>📦 Persona que recibe</div>
        <RecibeCampos valor={borrador} onChange={setBorrador} />
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => guardar(borrador)} disabled={guardando} style={{ minHeight: 36 }}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
          <button className="btn" onClick={() => { setBorrador(actual); setEditando(false); }} disabled={guardando} style={{ minHeight: 36 }}>Cancelar</button>
          {hayRecibe(actual) && (
            <button className="btn" onClick={() => { if (confirm('¿Quitar los datos de quien recibe? El pedido se enviará con los datos de la clienta.')) guardar({ ...RECIBE_VACIO }); }}
              disabled={guardando} style={{ minHeight: 36, marginLeft: 'auto', color: 'var(--rose)' }}>
              Quitar
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!hayRecibe(actual)) {
    if (!puedeEditar) return null;
    return (
      <button onClick={() => setEditando(true)} className="print-hide"
        style={{ marginTop: 8, background: 'none', border: 'none', padding: '4px 0', minHeight: 32, color: 'var(--text-soft)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit' }}>
        + Lo recibe otra persona
      </button>
    );
  }

  return (
    <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--bg)', borderRadius: 4, border: '1px solid var(--gold)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={labelStyle}>📦 Lo recibe otra persona</span>
        {puedeEditar && (
          <button onClick={() => { setBorrador(actual); setEditando(true); }} className="print-hide"
            style={{ background: 'none', border: 'none', color: 'var(--text-soft)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline', minHeight: 28, fontFamily: 'inherit' }}>
            ✎ Editar
          </button>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 12 }}>
        <div><span style={{ color: 'var(--text-faint)' }}>Nombre: </span>{actual.nombre || '—'}</div>
        <div><span style={{ color: 'var(--text-faint)' }}>Teléfono: </span>{actual.telefono || '—'}</div>
        <div><span style={{ color: 'var(--text-faint)' }}>Cédula: </span>{actual.cedula || '—'}</div>
        <div><span style={{ color: 'var(--text-faint)' }}>Dirección: </span>{actual.direccion || '—'}</div>
        <div><span style={{ color: 'var(--text-faint)' }}>Ciudad: </span>{actual.ciudad || '—'}</div>
      </div>
    </div>
  );
}
