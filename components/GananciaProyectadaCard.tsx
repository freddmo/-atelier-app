// components/GananciaProyectadaCard.tsx
// Cuánto profit hay "en camino" en pedidos que todavía no cierran su
// ciclo completo (entregado + cobrado). Consume api.getGananciaProyectada().

'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Proyectada = {
  porEntregar: { pedidos: number; venta: number; costo: number; gananciaEstimada: number };
  entregadoSinCobrar: { pedidos: number; venta: number; costo: number; saldoPendiente: number; gananciaEstimada: number };
  totalGananciaEstimada: number;
  detalle: { ORDEN_ID: string; NOMBRE: string; estado: string; saldo: number; venta: number; costo: number; ganancia: number }[];
};

const money = (n: number) =>
  '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function GananciaProyectadaCard() {
  const [p, setP] = useState<Proyectada | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    api
      .getGananciaProyectada()
      .then((res) => vivo && setP(res))
      .catch((e) => vivo && setError(e?.message || 'No se pudo cargar'))
      .finally(() => vivo && setCargando(false));
    return () => {
      vivo = false;
    };
  }, []);

  if (cargando)
    return <div className="card" style={{ padding: 24, color: 'var(--text-faint)', fontSize: 14 }}>Cargando proyección…</div>;
  if (error)
    return <div className="card" style={{ padding: 24, color: 'var(--rose)', fontSize: 14 }}>Error: {error}</div>;
  if (!p) return null;

  const totalPedidos = p.porEntregar.pedidos + p.entregadoSinCobrar.pedidos;

  return (
    <div className="card" style={{ padding: 24, borderTop: '3px solid var(--blue)' }}>
      <div style={{ fontSize: 11, color: 'var(--text-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
        Ganancia proyectada · {totalPedidos} pedido{totalPedidos !== 1 ? 's' : ''} en curso
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: '0 0 14px' }}>
        Estimado de profit en pedidos que aún no cierran su ciclo (no entregados, o entregados pero sin cobrar del todo). Usa costos reales donde ya los cargaste, y montos asumidos donde falten — es un estimado, no plata confirmada.
      </p>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 16 }}>
        <span className="display tabular" style={{ fontSize: 40, fontWeight: 300, color: 'var(--blue)', lineHeight: 1 }}>
          {money(p.totalGananciaEstimada)}
        </span>
        <span style={{ fontSize: 13, color: 'var(--text-soft)' }}>estimado total</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ padding: '10px 14px', background: 'var(--bg)', borderRadius: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-soft)', marginBottom: 4 }}>
            <span>📦 Por entregar · {p.porEntregar.pedidos} pedido{p.porEntregar.pedidos !== 1 ? 's' : ''}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 500 }}>
            <span style={{ color: 'var(--text-faint)', fontWeight: 400, fontSize: 12 }}>venta {money(p.porEntregar.venta)} − costo {money(p.porEntregar.costo)}</span>
            <span className="tabular" style={{ color: 'var(--green)' }}>{money(p.porEntregar.gananciaEstimada)}</span>
          </div>
        </div>

        <div style={{ padding: '10px 14px', background: 'var(--amber-bg, #FAF0E0)', borderRadius: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--amber)', marginBottom: 4 }}>
            <span>⏳ Entregado, falta cobrar · {p.entregadoSinCobrar.pedidos} pedido{p.entregadoSinCobrar.pedidos !== 1 ? 's' : ''}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 500 }}>
            <span style={{ color: 'var(--text-faint)', fontWeight: 400, fontSize: 12 }}>saldo pendiente {money(p.entregadoSinCobrar.saldoPendiente)}</span>
            <span className="tabular" style={{ color: 'var(--green)' }}>{money(p.entregadoSinCobrar.gananciaEstimada)}</span>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--bg)', borderRadius: 4, fontSize: 12, color: 'var(--text-soft)', lineHeight: 1.5 }}>
        💡 Este monto <strong style={{ color: 'var(--text)' }}>no está</strong> en el "Capital real" de arriba todavía — solo entra cuando el pedido se entrega Y se cobra completo. Es una vista hacia adelante, no un saldo confirmado.
      </div>
    </div>
  );
}
