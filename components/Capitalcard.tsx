// components/CapitalCard.tsx
// Muestra el capital real: liquido + stock + pedidos activos - deuda.
// Consume api.getCapitalReal().

'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Capital = {
  fechaFoto: string;
  liquido: number;
  stock: number;
  pedidosActivos: number;
  invertido: number;
  deuda: number;
  capitalReal: number;
  cuentas: { cuenta: string; tipo: string; monto: number }[];
};

const money = (n: number) =>
  '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function CapitalCard() {
  const [cap, setCap] = useState<Capital | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    api
      .getCapitalReal()
      .then((res) => vivo && setCap(res))
      .catch((e) => vivo && setError(e?.message || 'No se pudo cargar'))
      .finally(() => vivo && setCargando(false));
    return () => {
      vivo = false;
    };
  }, []);

  if (cargando)
    return <div className="card" style={{ padding: 24, color: 'var(--text-faint)', fontSize: 14 }}>Cargando capital…</div>;
  if (error)
    return <div className="card" style={{ padding: 24, color: 'var(--rose)', fontSize: 14 }}>Error: {error}</div>;
  if (!cap) return null;

  const fila = (label: string, valor: number, signo: '+' | '-', color?: string) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', fontSize: 13 }}>
      <span style={{ color: 'var(--text-soft)' }}>{signo === '-' ? '− ' : '+ '}{label}</span>
      <span className="tabular" style={{ color: color || 'var(--text)', fontWeight: 500 }}>{money(valor)}</span>
    </div>
  );

  return (
    <div className="card" style={{ padding: 24 }}>
      <div style={{ fontSize: 11, color: 'var(--text-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
        Capital real del negocio
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: '0 0 14px' }}>
        Foto del {cap.fechaFoto}. Todo lo que tienes menos todo lo que debes.
      </p>

      <div className="display tabular" style={{ fontSize: 40, fontWeight: 300, color: cap.capitalReal >= 0 ? 'var(--green)' : 'var(--rose)', lineHeight: 1, marginBottom: 16 }}>
        {money(cap.capitalReal)}
      </div>

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
        {fila('Líquido (cuentas)', cap.liquido, '+')}
        {fila('Stock (inventario)', cap.stock, '+')}
        {fila('Pedidos activos', cap.pedidosActivos, '+')}
        {fila('Deuda', cap.deuda, '-', 'var(--rose)')}
      </div>
    </div>
  );
}
