'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api, LoteStock } from '@/lib/api';
import { auth } from '@/lib/auth';
import Navbar from '@/components/Navbar';

function fmtMoney(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: string) {
  if (!d) return '—';
  return new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function StockPage() {
  const router = useRouter();
  const [lotes, setLotes] = useState<LoteStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const user = auth.getUser();
    if (!user) { router.replace('/login'); return; }
    setIsAdmin(user.rol === 'admin');
    load();
  }, [router]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await api.getStockDisponible();
      setLotes(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }

  const totalPiezas = lotes.reduce((s, l) => s + l.CANT_DISPONIBLE, 0);
  const today = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <>
      <Navbar />
      <div className="fade-in stock-container" style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 24px' }}>
        <div className="stock-header" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28, gap: 16, flexWrap: 'wrap' }}>
          <div>
            <span className="number-tag">INVENTARIO</span>
            <h1 className="display" style={{ fontSize: 48, fontWeight: 300, margin: '6px 0 0', lineHeight: 1 }}>
              Stock disponible<em style={{ color: 'var(--gold)' }}>.</em>
            </h1>
            <p style={{ color: 'var(--text-soft)', margin: '8px 0 0', fontSize: 13 }}>
              {totalPiezas} pieza{totalPiezas !== 1 ? 's' : ''} en {lotes.length} lote{lotes.length !== 1 ? 's' : ''} · {today}
            </p>
          </div>
          <div className="stock-actions" style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={load} disabled={loading}>
              {loading ? 'Cargando…' : '↻ Actualizar'}
            </button>
            <button className="btn btn-primary" onClick={() => window.print()}>
              🖨️ Imprimir
            </button>
          </div>
        </div>

        {error && (
          <div style={{ padding: 16, background: 'var(--rose-bg)', color: 'var(--rose)', borderRadius: 6, marginBottom: 24, fontSize: 13 }}>
            ⚠️ {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 64, color: 'var(--text-faint)' }}>Cargando inventario…</div>
        ) : lotes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 64, color: 'var(--text-faint)' }}>
            No hay stock disponible. El inventario está vacío.
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 500, color: 'var(--text-soft)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Producto</th>
                  <th style={{ padding: '12px 8px', textAlign: 'left', fontSize: 11, fontWeight: 500, color: 'var(--text-soft)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Talla</th>
                  <th style={{ padding: '12px 8px', textAlign: 'left', fontSize: 11, fontWeight: 500, color: 'var(--text-soft)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Longitud</th>
                  <th style={{ padding: '12px 8px', textAlign: 'left', fontSize: 11, fontWeight: 500, color: 'var(--text-soft)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Color</th>
                  <th style={{ padding: '12px 8px', textAlign: 'right', fontSize: 11, fontWeight: 500, color: 'var(--text-soft)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Cant.</th>
                  {isAdmin && (
                    <>
                      <th className="print-hide" style={{ padding: '12px 8px', textAlign: 'left', fontSize: 11, fontWeight: 500, color: 'var(--text-soft)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Lote</th>
                      <th className="print-hide" style={{ padding: '12px 8px', textAlign: 'right', fontSize: 11, fontWeight: 500, color: 'var(--text-soft)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Costo unit.</th>
                    </>
                  )}
                  <th className="print-hide" style={{ padding: '12px 8px', textAlign: 'left', fontSize: 11, fontWeight: 500, color: 'var(--text-soft)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Entrada</th>
                </tr>
              </thead>
              <tbody>
                {lotes.map((l, idx) => (
                  <tr key={l.LOTE_ID} style={{ borderBottom: idx < lotes.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 500 }}>{l.NOMBRE_PRODUCTO}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{l.TIPO_PRENDA}</div>
                    </td>
                    <td style={{ padding: '14px 8px' }} className="mono">{l.TALLA}</td>
                    <td style={{ padding: '14px 8px' }}>{l.LONGITUD}</td>
                    <td style={{ padding: '14px 8px' }}>{l.COLOR}</td>
                    <td style={{ padding: '14px 8px', textAlign: 'right' }} className="tabular">
                      <span style={{ fontSize: 16, fontWeight: 500 }}>{l.CANT_DISPONIBLE}</span>
                      {!l.tieneCourier && (
                        <span title="Sin courier cargado todavía" style={{ marginLeft: 6, color: 'var(--amber)' }}>⚠</span>
                      )}
                    </td>
                    {isAdmin && (
                      <>
                        <td className="mono print-hide" style={{ padding: '14px 8px', fontSize: 11, color: 'var(--text-faint)' }}>{l.LOTE_ID}</td>
                        <td className="tabular print-hide" style={{ padding: '14px 8px', textAlign: 'right', fontSize: 12, color: 'var(--text-soft)' }}>{fmtMoney(l.COSTO_UNITARIO)}</td>
                      </>
                    )}
                    <td className="print-hide" style={{ padding: '14px 8px', fontSize: 12, color: 'var(--text-soft)' }}>{fmtDate(l.FECHA_ENTRADA)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="print-hide" style={{ marginTop: 16, fontSize: 11, color: 'var(--text-faint)' }}>
          ⚠ = lote sin courier cargado (la prenda probablemente aún viaja)
        </div>
      </div>

      <style jsx global>{`
        @media print {
          .navbar, header, .print-hide, .stock-actions { display: none !important; }
          .stock-container { max-width: 100% !important; padding: 12px !important; }
          .card { border: 1px solid #ccc !important; box-shadow: none !important; }
          body { background: white !important; }
        }
      `}</style>
    </>
  );
}
