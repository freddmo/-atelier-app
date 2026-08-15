// components/VentasPorDiaChart.tsx
// Barchart diario: cantidad de pedidos o venta ($), en un rango de fechas libre.
// Reusa api.getPedidos() (ya se usa en toda la app) y agrupa por día en el cliente.

'use client';

import { useState, useEffect, useMemo } from 'react';
import { api } from '@/lib/api';
import { Pedido } from '@/lib/types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const money = (n: number) =>
  '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

function fmtFechaCorta(iso: string) {
  if (!iso) return '';
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}
function fmtFechaLarga(iso: string) {
  if (!iso) return '';
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
}

type Metrica = 'pedidos' | 'venta';
type TipoFiltro = 'pedido' | 'stock' | 'todo';

// Tooltip propio — Recharts 3 tipa estricto el prop "formatter" de <Tooltip>,
// así que usamos un componente de contenido propio en vez de esa prop.
function CustomTooltip({ active, payload, label, metrica }: any) {
  if (!active || !payload || !payload.length) return null;
  const valor = payload[0].value as number;
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4, padding: '8px 12px', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
      <div style={{ color: 'var(--text-soft)', marginBottom: 2 }}>{fmtFechaLarga(label)}</div>
      <div style={{ fontWeight: 600 }}>
        {metrica === 'pedidos' ? `${valor} pedido${valor !== 1 ? 's' : ''}` : money(valor)}
      </div>
    </div>
  );
}

export default function VentasPorDiaChart() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [metrica, setMetrica] = useState<Metrica>('pedidos');
  const [tipoFiltro, setTipoFiltro] = useState<TipoFiltro>('pedido');

  useEffect(() => {
    // Rango por defecto: últimos 30 días. Se calcula SOLO en el navegador
    // (nunca en el render directo) para evitar un mismatch de hydration
    // entre el servidor (UTC) y el cliente (Ecuador).
    const hoy = new Date();
    const hace30 = new Date();
    hace30.setDate(hoy.getDate() - 29);
    setHasta(hoy.toISOString().split('T')[0]);
    setDesde(hace30.toISOString().split('T')[0]);

    api.getPedidos()
      .then(setPedidos)
      .catch(e => setError(e instanceof Error ? e.message : 'Error al cargar'))
      .finally(() => setCargando(false));
  }, []);

  const datos = useMemo(() => {
    if (!desde || !hasta) return [];
    const porDia: Record<string, { fecha: string; pedidos: number; venta: number }> = {};

    // Inicializar todos los días del rango en 0, para que la gráfica no
    // tenga huecos en los días sin ventas.
    const cursor = new Date(desde + 'T12:00:00');
    const fin = new Date(hasta + 'T12:00:00');
    while (cursor <= fin) {
      const key = cursor.toISOString().split('T')[0];
      porDia[key] = { fecha: key, pedidos: 0, venta: 0 };
      cursor.setDate(cursor.getDate() + 1);
    }

    pedidos.forEach(p => {
      if (String(p.ESTATUS_ENVIO) === 'CANCELADO') return;

      const notas = String(p.NOTAS || '').toUpperCase();
      if (notas.indexOf('MARKETING') !== -1 || notas.indexOf('SORTEO') !== -1) return;

      // Misma lógica que usa Reportes: solo cuenta si tiene factura (BRUTO)
      // cargada, y es "stock" si CUALQUIER costo BRUTO viene de stock —
      // no se usa la columna TIPO_DE_ORDEN, que no refleja esto igual.
      const brutos = (p.costos || []).filter(c => String(c.TIPO_COSTO).toUpperCase().trim() === 'BRUTO');
      if (brutos.length === 0) return; // sin factura cargada, Reportes tampoco lo cuenta

      if (tipoFiltro !== 'todo') {
        const esStock = brutos.some(c => String(c.ORIGEN || '').toUpperCase().indexOf('STOCK') !== -1);
        const tipoReal = esStock ? 'STOCK' : 'PEDIDO';
        if (tipoFiltro === 'pedido' && tipoReal === 'STOCK') return;
        if (tipoFiltro === 'stock' && tipoReal !== 'STOCK') return;
      }

      const f = String(p.F_ORDEN || '').slice(0, 10);
      if (!f || f < desde || f > hasta) return;
      if (!porDia[f]) porDia[f] = { fecha: f, pedidos: 0, venta: 0 };
      porDia[f].pedidos += 1;
      porDia[f].venta += Number(p.totales?.venta) || 0;
    });

    return Object.values(porDia).sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [pedidos, desde, hasta, tipoFiltro]);

  if (cargando)
    return <div className="card" style={{ padding: 24, color: 'var(--text-faint)', fontSize: 14 }}>Cargando…</div>;
  if (error)
    return <div className="card" style={{ padding: 24, color: 'var(--rose)', fontSize: 14 }}>Error: {error}</div>;

  const total = metrica === 'pedidos'
    ? datos.reduce((s, d) => s + d.pedidos, 0)
    : datos.reduce((s, d) => s + d.venta, 0);

  return (
    <div className="card" style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
            {metrica === 'pedidos' ? 'Pedidos por día' : 'Venta por día'}
          </div>
          <div className="display tabular" style={{ fontSize: 28, fontWeight: 300 }}>
            {metrica === 'pedidos' ? total : money(total)}
            <span style={{ fontSize: 13, color: 'var(--text-soft)', marginLeft: 8, fontFamily: 'inherit' }}>
              {metrica === 'pedidos' ? 'en total' : 'en total'}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
          <button
            onClick={() => setMetrica('pedidos')}
            style={{ padding: '6px 14px', fontSize: 12, border: 'none', cursor: 'pointer', background: metrica === 'pedidos' ? 'var(--text)' : 'transparent', color: metrica === 'pedidos' ? 'var(--surface)' : 'var(--text-soft)' }}
          >
            # Pedidos
          </button>
          <button
            onClick={() => setMetrica('venta')}
            style={{ padding: '6px 14px', fontSize: 12, border: 'none', cursor: 'pointer', background: metrica === 'venta' ? 'var(--text)' : 'transparent', color: metrica === 'venta' ? 'var(--surface)' : 'var(--text-soft)' }}
          >
            $ Venta
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, marginBottom: 16, alignItems: 'end' }}>
        <div>
          <label style={{ fontSize: 11, color: 'var(--text-soft)' }}>Desde</label>
          <input type="date" className="input" value={desde} onChange={e => setDesde(e.target.value)} style={{ marginTop: 4, width: '100%' }} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: 'var(--text-soft)' }}>Hasta</label>
          <input type="date" className="input" value={hasta} onChange={e => setHasta(e.target.value)} style={{ marginTop: 4, width: '100%' }} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: 'var(--text-soft)' }}>Tipo</label>
          <select className="input" value={tipoFiltro} onChange={e => setTipoFiltro(e.target.value as TipoFiltro)} style={{ marginTop: 4 }}>
            <option value="pedido">Solo pedidos</option>
            <option value="stock">Solo stock</option>
            <option value="todo">Todo</option>
          </select>
        </div>
      </div>

      <div style={{ width: '100%', height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={datos} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="fecha"
              tickFormatter={fmtFechaCorta}
              tick={{ fontSize: 11 }}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11 }}
              width={metrica === 'venta' ? 50 : 30}
              allowDecimals={false}
            />
            <Tooltip content={(props) => <CustomTooltip {...props} metrica={metrica} />} />
            <Bar dataKey={metrica} fill="#4A6B8A" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
