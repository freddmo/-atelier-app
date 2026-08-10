// components/VentasTimelineChart.tsx
// Line chart: crecimiento mes a mes.
// - Meses completos: línea sólida (dato real).
// - Mes en curso: punto proyectado, línea punteada (estimado por ritmo).
// Consume api.getTimelineMensual().

'use client';

import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { api } from '@/lib/api';

type Punto = {
  mes: string;
  completo: boolean;
  diasTranscurridos?: number;
  diasDelMes?: number;
  ventaReal?: number;
  gananciaReal?: number;
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
  return `${meses[parseInt(mo, 10) - 1]} '${y.slice(2)}`;
};

function TimelineTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string; payload?: Punto }>;
  label?: string;
}) {
  if (!active || !payload || !payload.length) return null;
  const punto = payload[0]?.payload;
  const proyectado = punto && punto.completo === false;
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '10px 12px', fontSize: 12, color: 'var(--text)' }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>
        {mesBonito(String(label))}
        {proyectado && <span style={{ color: 'var(--amber)', fontWeight: 400 }}> · proyectado</span>}
      </div>
      {proyectado && punto && (
        <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 6 }}>
          estimado con {punto.diasTranscurridos} de {punto.diasDelMes} días
        </div>
      )}
      {payload.filter((p) => p.value != null).map((p, i) => (
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

  // Separar en dos series para dibujar sólido (completos) vs punteado (proyección).
  // El truco: la serie "real" tiene null en el mes en curso; la serie "proyección"
  // solo tiene valor en el último mes completo + el mes en curso (para unir la línea).
  const idxActual = data.findIndex((d) => !d.completo);
  const hayProyeccion = idxActual !== -1;

  const dataConSeries = data.map((d, i) => {
    const esActual = !d.completo;
    // punto de "enganche": el último completo antes del proyectado
    const esEnganche = hayProyeccion && i === idxActual - 1;
    return {
      ...d,
      ventaSolida: esActual ? null : d.ventaPedido,
      gananciaSolida: esActual ? null : d.gananciaPedido,
      netaSolida: esActual ? null : d.gananciaNeta,
      ventaProy: esActual || esEnganche ? d.ventaPedido : null,
      gananciaProy: esActual || esEnganche ? d.gananciaPedido : null,
      netaProy: esActual || esEnganche ? d.gananciaNeta : null,
    };
  });

  return (
    <div className="card" style={{ padding: 24 }}>
      <div style={{ fontSize: 11, color: 'var(--text-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
        Crecimiento mes a mes
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: '0 0 14px' }}>
        Meses completos en línea sólida. El mes en curso se muestra punteado (proyección por ritmo del mes).
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={dataConSeries} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="mes" tickFormatter={mesBonito} tick={{ fontSize: 12, fill: 'var(--text-soft)' }} />
          <YAxis tickFormatter={money} tick={{ fontSize: 12, fill: 'var(--text-soft)' }} width={55} />
          <Tooltip content={<TimelineTooltip />} />
          <Legend iconType="line" />
          {/* Líneas sólidas (meses completos) */}
          <Line type="monotone" dataKey="ventaSolida" name="Venta" stroke="var(--blue)" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
          <Line type="monotone" dataKey="gananciaSolida" name="Ganancia" stroke="var(--green)" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
          <Line type="monotone" dataKey="netaSolida" name="Ganancia neta" stroke="var(--amber)" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
          {/* Líneas punteadas (proyección del mes en curso) */}
          <Line type="monotone" dataKey="ventaProy" name="Venta (proy.)" stroke="var(--blue)" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3 }} connectNulls={false} legendType="none" />
          <Line type="monotone" dataKey="gananciaProy" name="Ganancia (proy.)" stroke="var(--green)" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3 }} connectNulls={false} legendType="none" />
          <Line type="monotone" dataKey="netaProy" name="Neta (proy.)" stroke="var(--amber)" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3 }} connectNulls={false} legendType="none" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
