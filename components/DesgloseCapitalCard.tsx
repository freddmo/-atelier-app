// components/DesgloseCapitalCard.tsx
// Desglose línea por línea de cada parte del capital — reusa la misma
// llamada de getCapitalReal() que ya usa CapitalCard, sin pedir nada nuevo
// al backend. Las 4 secciones arrancan cerradas (no pesa nada de más).

'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Capital = {
  fechaFoto: string;
  liquido: number;
  stock: number;
  pedidosActivos: number;
  deuda: number;
  deudaPersonal: number;
  cuentas: { cuenta: string; tipo: string; monto: number }[];
  detalleStock: { loteId: string; nombre: string; talla: string; color: string; cantidad: number; valor: number }[];
  detallePedidosActivos: { ordenId: string; cliente: string; estado: string; items: string[]; costo: number }[];
};

const money = (n: number) =>
  '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type SeccionId = 'liquido' | 'stock' | 'pedidos' | 'deuda' | 'personal';

export default function DesgloseCapitalCard() {
  const [cap, setCap] = useState<Capital | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [abierta, setAbierta] = useState<SeccionId | null>(null);

  useEffect(() => {
    let vivo = true;
    api.getCapitalReal()
      .then((res) => vivo && setCap(res as any))
      .catch((e) => vivo && setError(e?.message || 'No se pudo cargar'))
      .finally(() => vivo && setCargando(false));
    return () => { vivo = false; };
  }, []);

  if (cargando)
    return <div className="card" style={{ padding: 24, color: 'var(--text-faint)', fontSize: 14 }}>Cargando desglose…</div>;
  if (error)
    return <div className="card" style={{ padding: 24, color: 'var(--rose)', fontSize: 14 }}>Error: {error}</div>;
  if (!cap) return null;

  const liquidoCuentas = cap.cuentas.filter(c => c.tipo === 'ACTIVO');
  const deudaPersonalCuentas = cap.cuentas.filter(c => c.tipo === 'DEUDA_PERSONAL');
  const deudaCuentas = cap.cuentas.filter(c => c.tipo === 'DEUDA');

  function toggle(s: SeccionId) {
    setAbierta(prev => prev === s ? null : s);
  }

  function fila(label: string, valor: number, color?: string) {
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
        <span style={{ color: 'var(--text-soft)' }}>{label}</span>
        <span className="tabular" style={{ fontWeight: 500, color: color || 'var(--text)' }}>{money(valor)}</span>
      </div>
    );
  }

  function cabecera(id: SeccionId, emoji: string, titulo: string, total: number, n: number, color?: string) {
    const abiertaAhora = abierta === id;
    return (
      <div
        onClick={() => toggle(id)}
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 14px', cursor: 'pointer', borderRadius: 4,
          background: abiertaAhora ? 'var(--bg)' : 'transparent',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16 }}>{emoji}</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{titulo}</div>
            <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{n} línea{n !== 1 ? 's' : ''}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="tabular" style={{ fontSize: 15, fontWeight: 500, color: color || 'var(--text)' }}>{money(total)}</span>
          <span style={{ fontSize: 11, color: 'var(--text-faint)', transform: abiertaAhora ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>▾</span>
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 24 }}>
      <div style={{ fontSize: 11, color: 'var(--text-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
        Desglose del capital
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: '0 0 14px' }}>
        Línea por línea de cada parte — la suma de cada lista siempre cuadra con el total grande de "Capital real".
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* LÍQUIDO */}
        {cabecera('liquido', '💵', 'Líquido', cap.liquido, liquidoCuentas.length, 'var(--green)')}
        {abierta === 'liquido' && (
          <div style={{ padding: '4px 14px 12px' }}>
            {liquidoCuentas.length === 0
              ? <div style={{ fontSize: 12, color: 'var(--text-faint)', padding: '8px 0' }}>Sin cuentas registradas</div>
              : liquidoCuentas.map((c, i) => fila(c.cuenta, c.monto))}
          </div>
        )}

        {/* STOCK */}
        {cabecera('stock', '👕', 'Stock (inventario)', cap.stock, cap.detalleStock.length)}
        {abierta === 'stock' && (
          <div style={{ padding: '4px 14px 12px', maxHeight: 320, overflowY: 'auto' }}>
            {cap.detalleStock.length === 0
              ? <div style={{ fontSize: 12, color: 'var(--text-faint)', padding: '8px 0' }}>Sin stock disponible</div>
              : cap.detalleStock.map((l, i) => fila(
                  `${l.nombre}${l.talla ? ' · ' + l.talla : ''}${l.color ? ' · ' + l.color : ''}${l.cantidad > 1 ? ` ×${l.cantidad}` : ''}`,
                  l.valor
                ))}
          </div>
        )}

        {/* DEUDA PERSONAL (te deben) */}
        {cabecera('personal', '🧍', 'Te deben (deuda personal)', cap.deudaPersonal, deudaPersonalCuentas.length, 'var(--gold)')}
        {abierta === 'personal' && (
          <div style={{ padding: '4px 14px 12px' }}>
            {deudaPersonalCuentas.length === 0
              ? <div style={{ fontSize: 12, color: 'var(--text-faint)', padding: '8px 0' }}>Sin deuda personal registrada</div>
              : deudaPersonalCuentas.map((c, i) => fila(c.cuenta, c.monto, 'var(--gold)'))}
          </div>
        )}

        {/* PEDIDOS ACTIVOS */}
        {cabecera('pedidos', '📦', 'Pedidos activos (costo invertido)', cap.pedidosActivos, cap.detallePedidosActivos.length)}
        {abierta === 'pedidos' && (
          <div style={{ padding: '4px 14px 12px', maxHeight: 320, overflowY: 'auto' }}>
            {cap.detallePedidosActivos.length === 0
              ? <div style={{ fontSize: 12, color: 'var(--text-faint)', padding: '8px 0' }}>Sin pedidos activos con costo</div>
              : cap.detallePedidosActivos.map((p, i) => (
                  <div key={p.ordenId + i} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span>
                        <span className="mono" style={{ color: 'var(--text-faint)', marginRight: 6 }}>{p.ordenId}</span>
                        {p.cliente}
                      </span>
                      <span className="tabular" style={{ fontWeight: 500 }}>{money(p.costo)}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-soft)', marginTop: 2 }}>
                      {p.items.length > 0 ? p.items.join(' + ') : '—'} · <span style={{ color: 'var(--text-faint)' }}>{p.estado}</span>
                    </div>
                  </div>
                ))}
          </div>
        )}

        {/* DEUDA */}
        {cabecera('deuda', '💳', 'Deuda', cap.deuda, deudaCuentas.length, 'var(--rose)')}
        {abierta === 'deuda' && (
          <div style={{ padding: '4px 14px 12px' }}>
            {deudaCuentas.length === 0
              ? <div style={{ fontSize: 12, color: 'var(--text-faint)', padding: '8px 0' }}>Sin deuda registrada</div>
              : deudaCuentas.map((c, i) => fila(c.cuenta, c.monto, 'var(--rose)'))}
          </div>
        )}
      </div>
    </div>
  );
}
