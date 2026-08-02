// app/finanzas/page.tsx
// Dashboard financiero: reparto, capital, y las gráficas en una vista.
// Copia este archivo a: app/finanzas/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/auth';
import Navbar from '@/components/Navbar';
import ResumenMensualCard from '@/components/ResumenMensualCard';
import CapitalCard from '@/components/CapitalCard';
import CostosPieChart from '@/components/CostosPieChart';
import VentasTimelineChart from '@/components/VentasTimelineChart';

// mes actual en formato YYYY-MM
function mesActual() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`;
}

// primer y último día de un mes YYYY-MM
function rangoDelMes(mes: string) {
  const [y, m] = mes.split('-').map(Number);
  const inicio = `${mes}-01`;
  const fin = new Date(y, m, 0).toISOString().split('T')[0]; // último día
  return { inicio, fin };
}

export default function FinanzasPage() {
  const router = useRouter();
  const [mes, setMes] = useState(mesActual());
  const [donacion, setDonacion] = useState(0);

  useEffect(() => {
    const user = auth.getUser();
    if (!user) { router.replace('/login'); return; }
    if (user.rol !== 'admin') { router.replace('/pedidos'); return; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const { inicio, fin } = rangoDelMes(mes);

  // opciones de mes: últimos 6
  const meses: string[] = [];
  const hoy = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    meses.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  return (
    <>
      <Navbar />
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px 64px' }}>
        <div style={{ fontSize: 11, color: 'var(--text-soft)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Finanzas · Salud del negocio
        </div>
        <h1 className="display" style={{ fontSize: 44, fontWeight: 400, margin: '4px 0 24px' }}>
          Dashboard
        </h1>

        {/* Selector de mes + donación */}
        <div className="card" style={{ padding: 20, marginBottom: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'end' }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-soft)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Mes</label>
            <select className="input" value={mes} onChange={(e) => setMes(e.target.value)} style={{ marginTop: 4, width: '100%' }}>
              {meses.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-soft)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Donación a ScrubMe este mes</label>
            <input
              type="number"
              className="input"
              value={donacion}
              onChange={(e) => setDonacion(Number(e.target.value) || 0)}
              style={{ marginTop: 4, width: '100%' }}
              placeholder="0"
            />
          </div>
        </div>

        {/* Fila 1: Reparto + Capital lado a lado */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16, marginBottom: 24 }}>
          <ResumenMensualCard mes={mes} donacion={donacion} />
          <CapitalCard />
        </div>

        {/* Fila 2: Line chart de crecimiento */}
        <div style={{ marginBottom: 24 }}>
          <VentasTimelineChart meses={6} />
        </div>

        {/* Fila 3: Pie de costos del mes */}
        <div style={{ marginBottom: 24 }}>
          <CostosPieChart fechaInicio={inicio} fechaFin={fin} />
        </div>
      </div>
    </>
  );
}
