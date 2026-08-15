// components/ResumenMensualCard.tsx
// El corazón: cuánto se reparten tú y Mildred en el corte.
// Consume api.getResumenMensual() por RANGO de fechas (corte 15 a 15).

'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Resumen = {
  periodo: string;
  desde: string;
  hasta: string;
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
  fechaDesde,
  fechaHasta,
  donacion,
}: {
  fechaDesde: string;
  fechaHasta: string;
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
      .getResumenMensual('', donacion, fechaDesde, fechaHasta)
      .then((res) => vivo && setR(res))
      .catch((e) => vivo && setError(e?.message || 'No se pudo cargar'))
      .finally(() => vivo && setCargando(false));
    return () => {
      vivo = false;
    };
  }, [fechaDesde, fechaHasta, donacion]);

  if (cargando)
    return <div className="card" style={{ padding: 24, color: 'var(--text-faint)', fontSize: 14 }}>Cargando resumen…</div>;
  if (error)
    return <div className="card" style={{ padding: 24, color: 'var(--rose)', fontSize: 14 }}>Error: {error}</div>;
  if (!r) return null;

  const linea = (label: string, valor: number, signo: '+' | '-' | '=', destaca?: boolean) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, borderTop: signo === '=' ? '1px solid var(--border)' : 'none', marginTop: signo === '=' ? 4 : 0, paddingTop: signo === '=' ? 10 : 6 }}>
      <span style={{ color: destaca ? 'var(--text)' : 'var(--text-soft)', fontWeight: destaca ? 600 : 400 }}>
        {signo === '-' ? '− ' : ''}{label}
      </span>
      <span className="tabular" style={{ color: destaca ? 'var(--green)' : 'var(--text)', fontWeight: destaca ? 600 : 500 }}>
        {signo === '-' ? '−' : ''}{money(valor)}
      </span>
    </div>
  );

  return (
    <div className="card" style={{ padding: 24, borderTop: '3px solid var(--green)' }}>
      <div style={{ fontSize: 11, color: 'var(--text-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
        Repartible del corte
      </div>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--blue-bg, #E5EDF3)', color: 'var(--blue)', fontSize: 12, fontWeight: 500, padding: '4px 10px', borderRadius: 100, marginBottom: 10 }}>
        📅 {r.repartible.cantidadPedidos} pedidos — contados por fecha de COBRO, no de pedido
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: '0 0 14px' }}>
        Pedidos cuyo pago se completó (saldo $0) entre {r.desde} y {r.hasta}. No importa cuándo se hizo el pedido, solo cuándo terminó de pagarse.
      </p>

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
        {linea('Ganancia de pedidos cobrados', r.repartible.gananciaPedidosPagados, '+')}
        {linea('Gastos fijos', r.repartible.gastosFijos, '-')}
        {r.repartible.donacion > 0 && linea('Donación a ScrubMe', r.repartible.donacion, '-')}
        {linea('Neto repartible', r.repartible.neto, '=', true)}
      </div>

      {/* Nota aclaratoria: esto NO es plata aparte, ya vive dentro del Líquido */}
      <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--bg)', borderRadius: 4, fontSize: 12, color: 'var(--text-soft)', lineHeight: 1.5 }}>
        💡 Este dinero <strong style={{ color: 'var(--text)' }}>ya está dentro</strong> de tu Líquido (abajo en "Capital real") — no es plata aparte. Repartir significa <strong style={{ color: 'var(--text)' }}>sacarlo</strong> del negocio hacia el bolsillo de cada socio. Mientras no lo saquen, el capital del negocio no cambia.
      </div>

      {/* Advertencia: por qué este conteo NO va a coincidir con la gráfica de pedidos por día */}
      <div style={{ marginTop: 8, padding: '10px 14px', background: 'var(--amber-bg, #FAF0E0)', borderRadius: 4, fontSize: 12, color: 'var(--text-soft)', lineHeight: 1.5 }}>
        ⚠️ Si comparas este número con la gráfica de "Pedidos por día" más abajo, <strong style={{ color: 'var(--text)' }}>no van a coincidir</strong> — y está bien que no coincidan. Esta tarjeta cuenta por fecha de <strong style={{ color: 'var(--text)' }}>cobro</strong>; la gráfica cuenta por fecha de <strong style={{ color: 'var(--text)' }}>pedido</strong>. Un pedido de hace meses que recién se cobró este corte cuenta aquí, pero no ahí.
      </div>

      <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--text-soft)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
          <span>Ganancia de stock → ScrubMe (no se reparte)</span>
          <span className="tabular">{money(r.scrubme.gananciaStock)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
          <span>Saldo pendiente de todos los pedidos vivos (foto de hoy, no del corte)</span>
          <span className="tabular" style={{ color: 'var(--amber)' }}>{money(r.proyeccion.brecha)}</span>
        </div>
      </div>
    </div>
  );
}
