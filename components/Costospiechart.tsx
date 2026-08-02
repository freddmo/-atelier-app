// components/CostosPieChart.tsx
// Pie chart: "¿A dónde va el dinero?" — desglose de costos por tipo.
// Usa Recharts 3.x + TUS variables de color/clases (card, tabular, var(--...)).
//
// USO en app/reportes/page.tsx:
//   import CostosPieChart from '@/components/CostosPieChart';
//   <CostosPieChart fechaInicio={fechaInicio} fechaFin={fechaFin} />

'use client';

import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { api } from '@/lib/api';

type CostoTipo = { tipo: string; monto: number };

// Mapeo a tus variables de color (definidas en globals.css)
const COLORES: Record<string, string> = {
  BRUTO: 'var(--blue)',
  COURIER: 'var(--amber)',
  DELIVERY: 'var(--green)',
  EMPAQUE: 'var(--gold)',
  REGALO: 'var(--rose)',
  OTRO: 'var(--text-faint)',
};

const NOMBRE: Record<string, string> = {
  BRUTO: 'Mercadería',
  COURIER: 'Courier',
  DELIVERY: 'Delivery',
  EMPAQUE: 'Empaque',
  REGALO: 'Pines / Regalos',
  OTRO: 'Otro',
};

const money = (n: number) =>
  '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Tooltip propio: evita los conflictos de tipos del formatter de Recharts 3.
function CostoTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: Array<{ payload?: CostoTipo }>;
  total: number;
}) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  const pct = total > 0 ? ((d.monto / total) * 100).toFixed(1) : '0';
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        padding: '8px 12px',
        fontSize: 13,
        color: 'var(--text)',
      }}
    >
      <strong>{NOMBRE[d.tipo] || d.tipo}</strong>
      <br />
      {money(d.monto)} · {pct}%
    </div>
  );
}

export default function CostosPieChart({
  fechaInicio,
  fechaFin,
}: {
  fechaInicio?: string;
  fechaFin?: string;
}) {
  const [data, setData] = useState<CostoTipo[]>([]);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    setError(null);
    api
      .getCostosPorTipo(fechaInicio, fechaFin)
      .then((res) => {
        if (!vivo) return;
        setData(res.porTipo);
        setTotal(res.total);
      })
      .catch((e) => vivo && setError(e?.message || 'No se pudo cargar'))
      .finally(() => vivo && setCargando(false));
    return () => {
      vivo = false;
    };
  }, [fechaInicio, fechaFin]);

  const cajaBase: React.CSSProperties = { padding: 24 };

  if (cargando)
    return (
      <div className="card" style={{ ...cajaBase, color: 'var(--text-faint)', fontSize: 14 }}>
        Cargando costos…
      </div>
    );
  if (error)
    return (
      <div className="card" style={{ ...cajaBase, color: 'var(--rose)', fontSize: 14 }}>
        Error: {error}
      </div>
    );
  if (!data.length)
    return (
      <div className="card" style={{ ...cajaBase, color: 'var(--text-faint)', fontSize: 14 }}>
        No hay costos en este período.
      </div>
    );

  return (
    <div className="card" style={cajaBase}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-soft)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          ¿A dónde va el dinero?
        </div>
        <span className="tabular" style={{ fontSize: 13, color: 'var(--text-soft)' }}>
          Total: {money(total)}
        </span>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: '0 0 14px' }}>
        Desglose de todos los costos del período por tipo.
      </p>

      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={data}
            dataKey="monto"
            nameKey="tipo"
            cx="50%"
            cy="50%"
            outerRadius={95}
            innerRadius={45}
            paddingAngle={2}
            stroke="var(--surface)"
            label={((props: { percent?: number }) =>
              props.percent && props.percent > 0.05
                ? `${(props.percent * 100).toFixed(0)}%`
                : '') as never}
          >
            {data.map((d) => (
              <Cell key={d.tipo} fill={COLORES[d.tipo] || COLORES.OTRO} />
            ))}
          </Pie>
          <Tooltip content={<CostoTooltip total={total} />} />
          <Legend formatter={(value) => NOMBRE[String(value)] || String(value)} iconType="circle" />
        </PieChart>
      </ResponsiveContainer>

      <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
        {data.map((d) => {
          const pct = total > 0 ? ((d.monto / total) * 100).toFixed(1) : '0';
          return (
            <div
              key={d.tipo}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '4px 0',
                fontSize: 13,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', color: 'var(--text)' }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    display: 'inline-block',
                    marginRight: 8,
                    background: COLORES[d.tipo] || COLORES.OTRO,
                  }}
                />
                {NOMBRE[d.tipo] || d.tipo}
              </span>
              <span className="tabular" style={{ color: 'var(--text)', fontWeight: 500 }}>
                {money(d.monto)} · {pct}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
