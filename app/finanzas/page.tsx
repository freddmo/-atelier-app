// app/finanzas/page.tsx
// Dashboard financiero: reparto por corte (15 a 15), capital, y gráficas.

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/auth';
import Navbar from '@/components/Navbar';
import ResumenMensualCard from '@/components/ResumenMensualCard';
import CapitalCard from '@/components/CapitalCard';
import CostosPieChart from '@/components/CostosPieChart';
import VentasTimelineChart from '@/components/VentasTimelineChart';

// Devuelve el corte actual: del 15 del mes pasado al 15 de este mes.
// Si hoy es antes del 15, el corte va del 15 de hace 2 meses al 15 del mes pasado.
function corteActual() {
  const hoy = new Date();
  const dia = hoy.getDate();
  // El corte "vigente" termina el próximo día 15.
  // Fin = el 15 de este mes (si aún no llega) o del próximo.
  let finMes = hoy.getMonth();
  let finAnio = hoy.getFullYear();
  if (dia > 15) {
    // ya pasó el 15 de este mes: el corte en curso termina el 15 del mes que viene
    finMes += 1;
    if (finMes > 11) { finMes = 0; finAnio += 1; }
  }
  const fin = new Date(finAnio, finMes, 15);
  const inicio = new Date(finAnio, finMes - 1, 15);
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  return { desde: fmt(inicio), hasta: fmt(fin) };
}

export default function FinanzasPage() {
  const router = useRouter();
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [donacion, setDonacion] = useState(0);

  useEffect(() => {
    const user = auth.getUser();
    if (!user) { router.replace('/login'); return; }
    if (user.rol !== 'admin') { router.replace('/pedidos'); return; }
    // Se calcula aquí (solo en el navegador) para evitar un mismatch de
    // hydration entre el servidor (UTC) y el cliente (Ecuador) — desde/hasta
    // SÍ se muestran en pantalla (inputs de fecha del corte).
    const corte = corteActual();
    setDesde(corte.desde);
    setHasta(corte.hasta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // Botón: saltar el corte un mes atrás/adelante
  function moverCorte(dir: -1 | 1) {
    const d = new Date(desde + 'T12:00:00');
    const h = new Date(hasta + 'T12:00:00');
    d.setMonth(d.getMonth() + dir);
    h.setMonth(h.getMonth() + dir);
    setDesde(d.toISOString().split('T')[0]);
    setHasta(h.toISOString().split('T')[0]);
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

        {/* Selector de corte (rango) + donación */}
        <div className="card" style={{ padding: 20, marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: 'var(--text-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
            Corte de pago (por fecha de cobro)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 12, alignItems: 'end' }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-soft)' }}>Desde</label>
              <input type="date" className="input" value={desde} onChange={(e) => setDesde(e.target.value)} style={{ marginTop: 4, width: '100%' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-soft)' }}>Hasta</label>
              <input type="date" className="input" value={hasta} onChange={(e) => setHasta(e.target.value)} style={{ marginTop: 4, width: '100%' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-soft)' }}>Donación a ScrubMe</label>
              <input type="number" className="input" value={donacion} onChange={(e) => setDonacion(Number(e.target.value) || 0)} style={{ marginTop: 4, width: '100%' }} placeholder="0" />
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn" style={{ padding: '8px 12px', fontSize: 12 }} onClick={() => moverCorte(-1)}>← Corte anterior</button>
              <button className="btn" style={{ padding: '8px 12px', fontSize: 12 }} onClick={() => moverCorte(1)}>Siguiente →</button>
            </div>
          </div>
        </div>

        {/* Fila 1: Reparto + Capital */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16, marginBottom: 24 }}>
          <ResumenMensualCard fechaDesde={desde} fechaHasta={hasta} donacion={donacion} />
          <CapitalCard />
        </div>

        {/* Fila 2: Line chart de crecimiento */}
        <div style={{ marginBottom: 24 }}>
          <VentasTimelineChart meses={6} />
        </div>

        {/* Fila 3: Pie de costos del corte */}
        <div style={{ marginBottom: 24 }}>
          <CostosPieChart fechaInicio={desde} fechaFin={hasta} />
        </div>
      </div>
    </>
  );
}
