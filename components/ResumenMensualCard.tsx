// components/ResumenMensualCard.tsx
// El corazón: cuánto se reparten tú y Mildred este mes.
// Consume api.getResumenMensual(). Muestra repartible, por socio, y la brecha.

'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Resumen = {
  mes: string;
  repartible: {
    gananciaPedidosPagados: number;
    gastosFijos: number;
    donacion: number;
    neto: number;
    porSocio: number;
    cantidadPedidos: number;
  };
  scrubme: { gananciaStock: number };
  proyeccion: { gananciaTotalMes: number; brecha: number };
};

const money = (n: number) =>
  '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ResumenMensualCard({
  mes,
  donacion,
}: {
  mes: string;
  donacion?: number;
}) {
  const [r, setR] = useState<Resumen | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    setError(null);
    api
      .getResumenMensual(mes, donacion)
      .then((res) => vivo && setR(res))
      .catch((e) => vivo && setError(e?.message || 'No se pudo cargar'))
      .finally(() => vivo && setCargando(false));
    return () => {
      vivo = false;
    };
  }, [mes, donacion]);

  if (cargando)
    return <div className="card" style={{ padding: 24, color: 'var(--text-faint)', fontSize: 14 }}>Cargando resumen…</div>;
  if (error)
    return <div className="card" style={{ padding: 24, color: 'var(--rose)', fontSize: 14 }}>Error: {error}</div>;
  if (!r) return null;

  const linea = (label: string, valor: number, signo: '+' | '-' | '=', destaca?: boolean) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, borderTop: signo === '=' ? '1px solid var(--border)' : 'none', marginTop: signo === '=' ? 4 : 0, paddingTop: signo === '=' ? 10 : 6 }}>
      <span style={{ color: destaca ? 'var(--text)' : 'var(--text-soft)', fontWeight: destaca ? 600 : 400 }}>
        {signo === '-' ? '− ' : signo === '+' ? '' : ''}{label}
      </span>
      <span className="tabular" style={{ color: destaca ? 'var(--green)' : 'var(--text)', fontWeight: destaca ? 600 : 500 }}>
        {signo === '-' ? '−' : ''}{money(valor)}
      </span>
    </div>
  );

  return (
    <div className="card" style={{ padding: 24, borderTop: '3px solid var(--green)' }}>
      <div style={{ fontSize: 11, color: 'var(--text-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
        Repartible este mes · {r.repartible.cantidadPedidos} pedidos pagados
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: '0 0 14px' }}>
        Solo pedidos entregados y cobrados, menos gastos fijos. Esto es lo que pueden repartirse sin riesgo.
      </p>

      {/* El número grande: por socio */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
        <span className="display tabular" style={{ fontSize: 40, fontWeight: 300, color: 'var(--green)', lineHeight: 1 }}>
          {money(r.repartible.porSocio)}
        </span>
        <span style={{ fontSize: 13, color: 'var(--text-soft)' }}>por socio</span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 16 }}>
        (neto {money(r.repartible.neto)} ÷ 2)
      </div>

      <div>
        {linea('Ganancia de pedidos pagados', r.repartible.gananciaPedidosPagados, '+')}
        {linea('Gastos fijos', r.repartible.gastosFijos, '-')}
        {r.repartible.donacion > 0 && linea('Donación a ScrubMe', r.repartible.donacion, '-')}
        {linea('Neto repartible', r.repartible.neto, '=', true)}
      </div>

      {/* Contexto: stock y proyección */}
      <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--text-soft)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
          <span>Ganancia de stock → ScrubMe (no se reparte)</span>
          <span className="tabular">{money(r.scrubme.gananciaStock)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
          <span>Por cobrar del mes (brecha)</span>
          <span className="tabular" style={{ color: 'var(--amber)' }}>{money(r.proyeccion.brecha)}</span>
        </div>
      </div>
    </div>
  );
}
