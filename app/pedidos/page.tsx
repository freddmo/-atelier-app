'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { auth } from '@/lib/auth';
import { Pedido, ESTADOS } from '@/lib/types';
import Navbar from '@/components/Navbar';
import OrderCard from '@/components/OrderCard';

export default function PedidosPage() {
  const router = useRouter();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isBodega, setIsBodega] = useState(false);
  const [fechaHoy, setFechaHoy] = useState('');

  useEffect(() => {
    // Se calcula SOLO en el navegador, nunca en el servidor,
    // para que nunca haya un desfase de fecha/hora que cause
    // un error de hydration (React #418) al comparar server vs cliente.
    setFechaHoy(new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }));
  }, []);

  useEffect(() => {
    const user = auth.getUser();
    if (!user) { router.replace('/login'); return; }
    setIsAdmin(user.rol === 'admin');
    setIsBodega(user.rol === 'bodega');
    loadPedidos();
  }, [router]);

  async function loadPedidos() {
    setLoading(true);
    setError('');
    try {
      const data = await api.getPedidos();
      setPedidos(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar pedidos');
    } finally {
      setLoading(false);
    }
  }

  const activos = pedidos.filter(
    p => p.ESTATUS_ENVIO !== 'ENTREGADO' && p.ESTATUS_ENVIO !== 'CANCELADO'
  );

  let filtered = activos;
  if (filtroEstado !== 'todos') filtered = filtered.filter(p => p.ESTATUS_ENVIO === filtroEstado);
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(p =>
      String(p.NOMBRE || '').toLowerCase().includes(q) ||
      String(p.ORDEN_ID || '').toLowerCase().includes(q) ||
      String(p.cliente?.CIUDAD || '').toLowerCase().includes(q)
    );
  }

  const ordenados = filtered;

  const counts = {
    listo: activos.filter(p => p.ESTATUS_ENVIO === 'LISTO PARA ENVIAR').length,
    bodega: activos.filter(p => p.ESTATUS_ENVIO === 'EN BODEGA EC').length,
    transito: activos.filter(p => p.ESTATUS_ENVIO === 'EN CAMINO A EC' || p.ESTATUS_ENVIO === 'CON FREDDY').length,
  };

  return (
    <>
      <Navbar />
      <div className="fade-in" style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
        <div className={`role-banner ${isBodega ? 'bodega' : ''}`} style={{ padding: '12px 20px', borderRadius: 6, marginBottom: 28, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', opacity: 0.6 }}>Vista</span>
            <span style={{ fontSize: 13 }}>{isBodega ? 'Bodega · Operaciones' : 'Administración'}</span>
          </div>
          <span style={{ fontSize: 12, opacity: 0.7 }}>{fechaHoy}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 32, gap: 16, flexWrap: 'wrap' }}>
          <div>
            <span className="number-tag">PEDIDOS · EN CURSO</span>
            <h1 className="display" style={{ fontSize: 48, fontWeight: 300, margin: '6px 0 0', lineHeight: 1 }}>
              Por despachar<em style={{ fontWeight: 400, color: 'var(--gold)' }}>.</em>
            </h1>
          </div>
          <button className="btn" onClick={loadPedidos} disabled={loading}>
            {loading ? 'Cargando…' : '↻ Actualizar'}
          </button>
        </div>

        {error && (
          <div style={{ padding: 16, background: 'var(--rose-bg)', color: 'var(--rose)', borderRadius: 6, marginBottom: 24, fontSize: 13 }}>
            ⚠️ {error}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 1, background: 'var(--border)', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', marginBottom: 28 }}>
          {[
            { label: 'Listos para enviar', value: counts.listo, color: 'var(--green)' },
            { label: 'En bodega EC', value: counts.bodega, color: 'var(--blue)' },
            { label: 'En tránsito', value: counts.transito, color: 'var(--amber)' },
            { label: 'Total activos', value: activos.length, color: 'var(--text)' },
          ].map((k) => (
            <div key={k.label} style={{ background: 'var(--surface)', padding: 20 }}>
              <div style={{ fontSize: 10, color: 'var(--text-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>{k.label}</div>
              <span className="display tabular" style={{ fontSize: 36, fontWeight: 300, color: k.color, lineHeight: 1 }}>{k.value}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 12, marginBottom: 20 }}>
          <input className="input" placeholder="Buscar clienta, ID o ciudad…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="input" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
            <option value="todos">Todos los estados</option>
            {ESTADOS.slice(0, 7).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 64, color: 'var(--text-faint)' }}>Cargando pedidos…</div>
          ) : ordenados.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 64, color: 'var(--text-faint)' }}>No hay pedidos que coincidan</div>
          ) : (
            ordenados.map(p => (
              <OrderCard key={p.ORDEN_ID} pedido={p} showMoney={isAdmin || isBodega} />
            ))
          )}
        </div>
      </div>
    </>
  );
}
