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

// Genera un color de fondo suave a partir del nombre del color
function colorToHex(colorName: string): string {
  const map: Record<string, string> = {
    'negro': '#2d2d2d', 'black': '#2d2d2d',
    'blanco': '#f5f5f0', 'white': '#f5f5f0',
    'azul': '#4a7ab5', 'blue': '#4a7ab5',
    'azul caribeño': '#3a9bbf', 'caribbean blue': '#3a9bbf',
    'verde': '#4a9b6f', 'green': '#4a9b6f',
    'rojo': '#c45c5c', 'red': '#c45c5c',
    'gris': '#8a8a8a', 'gray': '#8a8a8a', 'grey': '#8a8a8a',
    'walnut': '#7a5c3a',
    'morado': '#7a5c9b', 'purple': '#7a5c9b',
    'rosado': '#d4789b', 'pink': '#d4789b',
    'beige': '#c8b89a',
    'celeste': '#6ab4d4',
    'navy': '#2d3a6b',
    'deep royal blue': '#1a2d8a',
    'lima': '#8ab44a',
  };
  return map[colorName.toLowerCase().trim()] || '#999';
}

// Pieza C: agrupa lotes por SKU+TALLA+LONGITUD para mostrar como set
type GrupoSet = {
  key: string;
  label: string;
  lotes: LoteStock[];
  esSet: boolean;
};

function agruparComoSets(lotes: LoteStock[]): GrupoSet[] {
  // Detectar pares top+pantalon con misma talla+longitud+color
  const tops = lotes.filter(l => l.TIPO_PRENDA === 'TOP');
  const pants = lotes.filter(l => l.TIPO_PRENDA === 'PANTALON');
  const resto = lotes.filter(l => l.TIPO_PRENDA !== 'TOP' && l.TIPO_PRENDA !== 'PANTALON');

  const usados = new Set<string>();
  const grupos: GrupoSet[] = [];

  tops.forEach(top => {
    const match = pants.find(p =>
      p.TALLA === top.TALLA &&
      p.LONGITUD === top.LONGITUD &&
      (p.COLOR_DISPLAY || p.COLOR).toLowerCase() === (top.COLOR_DISPLAY || top.COLOR).toLowerCase() &&
      !usados.has(p.LOTE_ID)
    );
    if (match) {
      usados.add(top.LOTE_ID);
      usados.add(match.LOTE_ID);
      grupos.push({
        key: top.LOTE_ID + '+' + match.LOTE_ID,
        label: `Set · ${top.TALLA} · ${top.LONGITUD} · ${top.COLOR_DISPLAY || top.COLOR}`,
        lotes: [top, match],
        esSet: true,
      });
    }
  });

  // Lotes que no formaron set
  lotes.forEach(l => {
    if (!usados.has(l.LOTE_ID)) {
      grupos.push({
        key: l.LOTE_ID,
        label: '',
        lotes: [l],
        esSet: false,
      });
    }
  });

  return grupos;
}

export default function StockPage() {
  const router = useRouter();
  const [lotes, setLotes] = useState<LoteStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [editandoColor, setEditandoColor] = useState<string | null>(null);
  const [colorTemp, setColorTemp] = useState('');
  const [savingColor, setSavingColor] = useState(false);
  const [agrupar, setAgrupar] = useState(true);

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

  async function guardarColor(loteId: string) {
    if (!colorTemp.trim()) return;
    const user = auth.getUser();
    if (!user) return;
    setSavingColor(true);
    try {
      await api.updateColorDisplay(loteId, colorTemp.trim(), user.usuario);
      setLotes(prev => prev.map(l =>
        l.LOTE_ID === loteId ? { ...l, COLOR_DISPLAY: colorTemp.trim() } : l
      ));
      setEditandoColor(null);
    } catch (err) {
      alert('Error al guardar: ' + (err instanceof Error ? err.message : 'desconocido'));
    } finally {
      setSavingColor(false);
    }
  }

  const totalPiezas = lotes.reduce((s, l) => s + l.CANT_DISPONIBLE, 0);
  const today = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  const grupos = agrupar ? agruparComoSets(lotes) : lotes.map(l => ({ key: l.LOTE_ID, label: '', lotes: [l], esSet: false }));

  function renderFila(l: LoteStock, esSetSecundario = false) {
    const colorDisplay = l.COLOR_DISPLAY || l.COLOR;
    const editando = editandoColor === l.LOTE_ID;

    return (
      <tr key={l.LOTE_ID} style={{ borderBottom: '1px solid var(--border)', opacity: esSetSecundario ? 0.85 : 1 }}>
        <td style={{ padding: '14px 16px' }}>
          {esSetSecundario ? (
            <div style={{ fontSize: 11, color: 'var(--text-faint)', paddingLeft: 12, borderLeft: '2px solid var(--border)' }}>
              {l.NOMBRE_PRODUCTO}
              <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>{l.TIPO_PRENDA}</div>
            </div>
          ) : (
            <>
              <div style={{ fontWeight: 500 }}>{l.NOMBRE_PRODUCTO}</div>
              <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{l.TIPO_PRENDA}</div>
            </>
          )}
        </td>
        <td style={{ padding: '14px 8px' }} className="mono">{l.TALLA}</td>
        <td style={{ padding: '14px 8px' }}>{l.LONGITUD}</td>

        {/* Pieza B: cuadrito de color + nombre editable */}
        <td style={{ padding: '14px 8px' }}>
          {editando ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                autoFocus
                value={colorTemp}
                onChange={e => setColorTemp(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') guardarColor(l.LOTE_ID);
                  if (e.key === 'Escape') setEditandoColor(null);
                }}
                style={{ fontSize: 12, padding: '3px 6px', border: '1px solid var(--border)', borderRadius: 3, width: 110, background: 'var(--surface)', color: 'var(--text)' }}
              />
              <button onClick={() => guardarColor(l.LOTE_ID)} disabled={savingColor}
                style={{ fontSize: 11, padding: '3px 8px', background: 'var(--text)', color: 'var(--surface)', border: 'none', borderRadius: 3, cursor: 'pointer' }}>
                {savingColor ? '…' : '✓'}
              </button>
              <button onClick={() => setEditandoColor(null)}
                style={{ fontSize: 11, padding: '3px 6px', background: 'none', border: '1px solid var(--border)', borderRadius: 3, cursor: 'pointer', color: 'var(--text-soft)' }}>
                ✕
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 16, height: 16, borderRadius: 3, flexShrink: 0,
                background: colorToHex(colorDisplay),
                border: '1px solid rgba(0,0,0,0.15)',
              }} />
              <span>{colorDisplay}</span>
              {isAdmin && (
                <button
                  onClick={() => { setEditandoColor(l.LOTE_ID); setColorTemp(colorDisplay); }}
                  title="Editar nombre del color"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', fontSize: 11, padding: '0 2px', lineHeight: 1 }}
                >
                  ✎
                </button>
              )}
            </div>
          )}
        </td>

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
    );
  }

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
          <div className="stock-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              className="btn"
              onClick={() => setAgrupar(a => !a)}
              style={{ fontSize: 12 }}
            >
              {agrupar ? '☰ Ver individual' : '⊞ Ver como sets'}
            </button>
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
                {grupos.map(grupo => {
                  if (!grupo.esSet) return renderFila(grupo.lotes[0]);

                  // Pieza C: set agrupado
                  const [top, pant] = grupo.lotes;
                  const colorDisplay = top.COLOR_DISPLAY || top.COLOR;
                  const sinCourier = !top.tieneCourier || !pant.tieneCourier;
                  const colSpan = isAdmin ? 6 : 4;

                  return (
                    <>
                      {/* Fila de cabecera del set */}
                      <tr key={grupo.key + '-header'} style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                        <td colSpan={colSpan + 2} style={{ padding: '8px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                              width: 12, height: 12, borderRadius: 2, flexShrink: 0,
                              background: colorToHex(colorDisplay),
                              border: '1px solid rgba(0,0,0,0.15)',
                            }} />
                            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              SET · {top.TALLA} · {top.LONGITUD} · {colorDisplay}
                            </span>
                            {sinCourier && (
                              <span title="Alguna prenda sin courier" style={{ color: 'var(--amber)', fontSize: 11 }}>⚠ sin courier</span>
                            )}
                          </div>
                        </td>
                      </tr>
                      {renderFila(top, false)}
                      {renderFila(pant, true)}
                    </>
                  );
                })}
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
