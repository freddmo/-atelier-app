// components/CostosPieChart.tsx
// Pie chart: "¿A dónde va el dinero?" — desglose de costos por tipo.
// Recharts 3.x + Tailwind v4. Consume api.getCostosPorTipo().
//
// USO en app/reportes/page.tsx:
//   import CostosPieChart from '@/components/CostosPieChart';
//   <CostosPieChart fechaInicio="2026-07-01" fechaFin="2026-07-31" />

'use client';

import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { api } from '@/lib/api';

type CostoTipo = { tipo: string; monto: number };

const COLORES: Record<string, string> = {
  BRUTO: '#2563eb',
  COURIER: '#f59e0b',
  DELIVERY: '#10b981',
  EMPAQUE: '#8b5cf6',
  REGALO: '#ec4899',
  OTRO: '#94a3b8',
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
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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

  if (cargando)
    return (
      <div className="max-w-lg rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-500">
        Cargando costos…
      </div>
    );
  if (error)
    return (
      <div className="max-w-lg rounded-xl border border-gray-200 bg-white p-5 text-sm text-red-600">
        Error: {error}
      </div>
    );
  if (!data.length)
    return (
      <div className="max-w-lg rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-500">
        No hay costos en este período.
      </div>
    );

  return (
    <div className="max-w-lg rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="m-0 text-base font-semibold text-gray-900">¿A dónde va el dinero?</h3>
        <span className="text-sm font-medium text-gray-500">Total: {money(total)}</span>
      </div>

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
            label={({ percent }: { percent?: number }) =>
              percent && percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''
            }
          >
            {data.map((d) => (
              <Cell key={d.tipo} fill={COLORES[d.tipo] || COLORES.OTRO} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number, _n: string, props: { payload?: CostoTipo }) => {
              const tipo = props?.payload?.tipo || '';
              const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
              return [`${money(value)} (${pct}%)`, NOMBRE[tipo] || tipo];
            }}
          />
          <Legend formatter={(value: string) => NOMBRE[value] || value} iconType="circle" />
        </PieChart>
      </ResponsiveContainer>

      <div className="mt-3 border-t border-gray-100 pt-3">
        {data.map((d) => {
          const pct = total > 0 ? ((d.monto / total) * 100).toFixed(1) : '0';
          return (
            <div key={d.tipo} className="flex items-center justify-between py-1 text-sm">
              <span className="flex items-center text-gray-700">
                <span
                  className="mr-2 inline-block h-2.5 w-2.5 rounded-full"
                  style={{ background: COLORES[d.tipo] || COLORES.OTRO }}
                />
                {NOMBRE[d.tipo] || d.tipo}
              </span>
              <span className="font-medium tabular-nums text-gray-900">
                {money(d.monto)} · {pct}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
