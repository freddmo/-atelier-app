'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api, ItemPendiente, ItemFactura } from '@/lib/api';
import { auth } from '@/lib/auth';
import Navbar from '@/components/Navbar';

function fmtMoney(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type ItemSeleccionado = ItemPendiente & {
  precioFIGS: number;
};

export default function CargarFacturaPage() {
  const router = useRouter();
  const today = new Date().toISOString().split('T')[0];

  const [itemsDisponibles, setItemsDisponibles] = useState<ItemPendiente[]>([]);
  const [loading, setLoading] = useState(true);
  const [seleccionados, setSeleccionados] = useState<ItemSeleccionado[]>([]);
  const [numFactura, setNumFactura] = useState('');
  const [fecha, setFecha] = useState(today);
  const [iva, setIva] = useState('0');
  const [descuento, setDescuento] = useState('0');
  const [searchQuery, setSearchQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    const user = auth.getUser();
    if (!user) { router.replace('/login'); return; }
    if (user.rol !== 'admin') { router.replace('/pedidos'); return; }
    load();
  }, [router]);

  async function load() {
    setLoading(true);
    try {
      const data = await api.getItemsPendientesCostos();
      setItemsDisponibles(data);
    } catch (err) {
      alert('Error al cargar items: ' + (err instanceof Error ? err.message : 'desconocido'));
    } finally {
      setLoading(false);
    }
  }

  function toggleItem(item: ItemPendiente) {
    const key = `${item.ORDEN_ID}-${item.itemIndex}`;
    const exists = seleccionados.find(s => `${s.ORDEN_ID}-${s.itemIndex}` === key);
    if (exists) {
      setSeleccionados(seleccionados.filter(s => `${s.ORDEN_ID}-${s.itemIndex}` !== key));
    } else {
      setSeleccionados([...seleccionados, { ...item, precioFIGS: 0 }]);
    }
  }

  function isSelected(item: ItemPendiente): boolean {
    const key = `${item.ORDEN_ID}-${item.itemIndex}`;
    return seleccionados.some(s => `${s.ORDEN_ID}-${s.itemIndex}` === key);
  }

  function updatePrecioFIGS(idx: number, valor: string) {
    const newSeleccionados = [...seleccionados];
    newSeleccionados[idx].precioFIGS = Number(valor) || 0;
    setSeleccionados(newSeleccionados);
  }

  const subtotal = seleccionados.reduce((s, i) => s + (i.precioFIGS || 0), 0);
  const ivaNum = Number(iva) || 0;
  const descNum = Number(descuento) || 0;
  const total = subtotal + ivaNum - descNum;

  // Calcular preview
  const preview = seleccionados.map(item => {
    const pct = subtotal > 0 ? item.precioFIGS / subtotal : 0;
    const ivaItem = ivaNum * pct;
    const descItem = descNum * pct;
    const bruto = item.precioFIGS + ivaItem - descItem;
    return { ...item, pct, ivaItem, descItem, bruto };
  });

  const filteredDisponibles = itemsDisponibles.filter(item => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.NOMBRE.toLowerCase().includes(q) ||
      item.ORDEN_ID.toLowerCase().includes(q) ||
      item.PRODUCTO.toLowerCase().includes(q)
    );
  });

  async function handleSubmit() {
    if (seleccionados.length === 0) {
      alert('Selecciona al menos un item');
      return;
    }
    if (subtotal <= 0) {
      alert('Ingresa los precios FIGS de los items');
      return;
    }
    const user = auth.getUser();
    if (!user) return;

    setSubmitting(true);
    try {
      const itemsParaEnviar: ItemFactura[] = seleccionados.map(s => ({
        ORDEN_ID: s.ORDEN_ID,
        itemIndex: s.itemIndex,
        precioFIGS: s.precioFIGS,
      }));

      await api.cargarFacturaFIGS({
        items: itemsParaEnviar,
        subtotal,
        iva: ivaNum,
        descuento: descNum,
        numFactura,
        fecha,
      }, user.usuario);

      setToast(`✅ Factura cargada: ${seleccionados.length} items por ${fmtMoney(total)}`);
      setTimeout(() => setToast(''), 3500);
      
      // Reset y recargar
      setSeleccionados([]);
      setNumFactura('');
      setIva('0');
      setDescuento('0');
      load();
    } catch (err) {
      alert('Error: ' + (err instanceof Error ? err.message : 'desconocido'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Navbar />
      <div className="fade-in" style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ marginBottom: 32 }}>
          <span className="number-tag">COSTOS · COMPRAS</span>
          <h1 className="display" style={{ fontSize: 48, fontWeight: 300, margin: '6px 0 0', lineHeight: 1 }}>
            Cargar factura FIGS<em style={{ color: 'var(--gold)' }}>.</em>
          </h1>
          <p style={{ color: 'var(--text-soft)', fontSize: 14, margin: '12px 0 0', maxWidth: 600 }}>
            Selecciona los items comprados, agrega los datos de la factura y el sistema reparte el IVA y descuento automáticamente entre cada uniforme.
          </p>
        </div>

        {/* DATOS DE FACTURA */}
        <div className="card" style={{ padding: 28, marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 20px', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-soft)' }}>1. Datos de la factura</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16 }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>N° Factura</label>
              <input className="input" placeholder="FIGS-99887" value={numFactura} onChange={(e) => setNumFactura(e.target.value)} style={{ marginTop: 4 }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fecha</label>
              <input type="date" className="input" value={fecha} onChange={(e) => setFecha(e.target.value)} style={{ marginTop: 4 }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>IVA total ($)</label>
              <input type="number" step="0.01" className="input" value={iva} onChange={(e) => setIva(e.target.value)} style={{ marginTop: 4 }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Descuento ($)</label>
              <input type="number" step="0.01" className="input" value={descuento} onChange={(e) => setDescuento(e.target.value)} style={{ marginTop: 4 }} placeholder="0 = sin desc" />
            </div>
          </div>
        </div>

        {/* SELECCIÓN DE ITEMS */}
        <div className="card" style={{ padding: 28, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
            <h3 style={{ margin: 0, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-soft)' }}>
              2. Items en esta factura · <span className="tabular">{seleccionados.length}</span> seleccionados
            </h3>
          </div>
          
          <input
            className="input"
            placeholder="Buscar por cliente, ID o producto…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ marginBottom: 14 }}
          />

          {loading ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-faint)' }}>Cargando…</div>
          ) : filteredDisponibles.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-faint)', background: 'var(--bg)', borderRadius: 4 }}>
              {itemsDisponibles.length === 0 
                ? 'No hay items pendientes de cargar costo'
                : 'Ningún item coincide con tu búsqueda'}
            </div>
          ) : (
            <div style={{ maxHeight: 360, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {filteredDisponibles.map(item => {
                const selected = isSelected(item);
                return (
                  <div
                    key={`${item.ORDEN_ID}-${item.itemIndex}`}
                    onClick={() => toggleItem(item)}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 4,
                      cursor: 'pointer',
                      background: selected ? 'var(--bg)' : 'transparent',
                      border: `1px solid ${selected ? 'var(--text)' : 'var(--border)'}`,
                      display: 'grid',
                      gridTemplateColumns: 'auto 1fr auto auto',
                      gap: 12,
                      alignItems: 'center',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ width: 18, height: 18, borderRadius: 3, border: `1.5px solid ${selected ? 'var(--text)' : 'var(--border)'}`, background: selected ? 'var(--text)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 12 }}>
                      {selected ? '✓' : ''}
                    </div>
                    <div>
                      <div className="display" style={{ fontSize: 14 }}>{item.PRODUCTO}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-soft)' }}>
                        <span className="mono">{item.ORDEN_ID}</span> · {item.NOMBRE} · {item.TALLA} · {item.COLOR}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>×{item.CANTIDAD}</div>
                    <div className="tabular" style={{ fontSize: 12, color: 'var(--text-soft)', minWidth: 70, textAlign: 'right' }}>
                      Venta: {fmtMoney(Number(item.PRECIO_VENTA))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* PRECIOS FIGS */}
        {seleccionados.length > 0 && (
          <div className="card" style={{ padding: 28, marginBottom: 20 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-soft)' }}>
              3. Precio de FIGS por item
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {seleccionados.map((item, idx) => (
                <div key={`${item.ORDEN_ID}-${item.itemIndex}`} style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 12, alignItems: 'center', padding: '10px 14px', background: 'var(--bg)', borderRadius: 4 }}>
                  <div>
                    <div className="display" style={{ fontSize: 14 }}>{item.PRODUCTO}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-soft)' }}>
                      <span className="mono">{item.ORDEN_ID}</span> · {item.NOMBRE}
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Precio FIGS $</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input"
                      value={item.precioFIGS || ''}
                      onChange={(e) => updatePrecioFIGS(idx, e.target.value)}
                      placeholder="0.00"
                      style={{ marginTop: 2, padding: '6px 10px', fontSize: 13 }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-soft)', marginBottom: 6 }}>
                <span>Subtotal items</span>
                <span className="tabular">{fmtMoney(subtotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-soft)', marginBottom: 6 }}>
                <span>IVA</span>
                <span className="tabular">+{fmtMoney(ivaNum)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-soft)', marginBottom: 8 }}>
                <span>Descuento</span>
                <span className="tabular" style={{ color: descNum > 0 ? 'var(--green)' : 'var(--text-soft)' }}>−{fmtMoney(descNum)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>Total factura</span>
                <span className="display tabular" style={{ fontSize: 24 }}>{fmtMoney(total)}</span>
              </div>
            </div>
          </div>
        )}

        {/* PREVIEW DE DISTRIBUCIÓN */}
        {seleccionados.length > 0 && subtotal > 0 && (
          <div className="card" style={{ padding: 28, marginBottom: 20, background: 'linear-gradient(to right, rgba(184,149,78,0.04), transparent)', borderColor: 'var(--gold)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--gold)' }}>
              4. Preview · Costo bruto que se guardará
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {preview.map(p => (
                <div key={`${p.ORDEN_ID}-${p.itemIndex}`} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto auto', gap: 12, alignItems: 'center', padding: '8px 14px', fontSize: 12 }}>
                  <div>
                    <span className="mono" style={{ color: 'var(--text-soft)' }}>{p.ORDEN_ID}</span>
                    <span style={{ marginLeft: 8 }}>{p.PRODUCTO}</span>
                  </div>
                  <span className="tabular" style={{ color: 'var(--text-soft)' }}>${p.precioFIGS.toFixed(2)}</span>
                  <span className="tabular" style={{ color: 'var(--text-faint)' }}>+ IVA ${p.ivaItem.toFixed(2)}</span>
                  <span className="tabular" style={{ color: 'var(--text-faint)' }}>− Desc ${p.descItem.toFixed(2)}</span>
                  <span className="display tabular" style={{ fontSize: 15, color: 'var(--gold)', minWidth: 80, textAlign: 'right' }}>${p.bruto.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SUBMIT */}
        <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={() => router.push('/pedidos')} disabled={submitting}>Cancelar</button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={submitting || seleccionados.length === 0 || subtotal <= 0}
          >
            {submitting ? 'Guardando…' : `Guardar y distribuir (${seleccionados.length})`}
          </button>
        </div>
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'var(--text)', color: 'var(--surface)', padding: '14px 24px', borderRadius: 4, fontSize: 13, zIndex: 100, boxShadow: '0 10px 30px rgba(0,0,0,0.15)', maxWidth: '90vw' }}>
          {toast}
        </div>
      )}
    </>
  );
}
