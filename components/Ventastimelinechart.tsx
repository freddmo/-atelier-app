// components/VentasTimelineChart.tsx
// Line chart: crecimiento/caída de ventas, ganancia y costos mes a mes.
// Consume api.getTimelineMensual(). Recharts 3 + variables de tu tema.

'use client';

import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { api } from '@/lib/api';

type Punto = {
  mes: string;
  ventaPedido: number;
  gananciaPedido: number;
  ventaStock: number;
  gananciaStock: number;
  gastosFijos: number;
  gananciaNeta: number;
};

const money = (n: number) =>
  '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const mesBonito = (m: string) => {
  const [y, mo] = m.split('-');
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${meses[parseInt(mo, 10) - 1]} ${y.slice(2)}`;
};

function TimelineTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string;
}) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        padding: '10px 12px',
        fontSize: 12,
        color: 'var(--text)',
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 6 }}>{mesBonito(String(label))}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="tabular">{money(Number(p.value) || 0)}</span>
        </div>
      ))}
    </div>
  );
}

export default function VentasTimelineChart({ meses = 6 }: { meses?: number }) {
  const [data, setData] = useState<Punto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    setError(null);
    api
      .getTimelineMensual(meses)
      .then((res) => vivo && setData(res.timeline))
      .catch((e) => vivo && setError(e?.message || 'No se pudo cargar'))
      .finally(() => vivo && setCargando(false));
    return () => {
      vivo = false;
    };
  }, [meses]);

  if (cargando)
    return <div className="card" style={{ padding: 24, color: 'var(--text-faint)', fontSize: 14 }}>Cargando tendencia…</div>;
  if (error)
    return <div className="card" style={{ padding: 24, color: 'var(--rose)', fontSize: 14 }}>Error: {error}</div>;

  return (
    <div className="card" style={{ padding: 24 }}>
      <div style={{ fontSize: 11, color: 'var(--text-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
        Crecimiento mes a mes
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: '0 0 14px' }}>
        Venta y ganancia de pedidos por mes. La ganancia neta ya descuenta gastos fijos.
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="mes" tickFormatter={mesBonito} tick={{ fontSize: 12, fill: 'var(--text-soft)' }} />
          <YAxis tickFormatter={money} tick={{ fontSize: 12, fill: 'var(--text-soft)' }} width={55} />
          <Tooltip content={<TimelineTooltip />} />
          <Legend iconType="line" />
          <Line type="monotone" dataKey="ventaPedido" name="Venta" stroke="var(--blue)" strokeWidth={2} dot={{ r: 3 }} />
          <Line type="monotone" dataKey="gananciaPedido" name="Ganancia" stroke="var(--green)" strokeWidth={2} dot={{ r: 3 }} />
          <Line type="monotone" dataKey="gananciaNeta" name="Ganancia neta" stroke="var(--amber)" strokeWidth={2} strokeDasharray="4 2" dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
