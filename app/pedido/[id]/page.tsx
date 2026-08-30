'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { auth } from '@/lib/auth';
import { Pedido, Estado, ESTADOS } from '@/lib/types';
import Navbar from '@/components/Navbar';
import StateModal from '@/components/StateModal';
import PaymentModal from '@/components/PaymentModal';
import ItemsStateModal from '@/components/ItemsStateModal';
import CambioItemModal from '@/components/CambioItemModal';
import CorregirItemModal from '@/components/CorregirItemModal';
import CancelarItemModal from '@/components/CancelarItemModal';
import PerdidaTransitoModal from '@/components/PerdidaTransitoModal';

function fmtMoney(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: string) {
  if (!d) return '';
  return new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}

function diasAtraso(p: Pedido): number | null {
  if (p.ESTATUS_ENVIO === 'ENTREGADO' || p.ESTATUS_ENVIO === 'CANCELADO' || !p.F_ENTREGA_EST) return null;
  if (isNaN(Date.parse(p.F_ENTREGA_EST + 'T12:00:00'))) return null;
  const entrega = new Date(p.F_ENTREGA_EST + 'T12:00:00');
  const limite = new Date(entrega);
  limite.setDate(limite.getDate() + 14);
  const hoy = new Date();
  if (hoy > limite) return Math.floor((hoy.getTime() - limite.getTime()) / (1000 * 60 * 60 * 24));
  return null;
}

function stateClass(estado: string) {
  return 'state-' + estado.replace(/\s+/g, '-');
}

// ===== #3: de qué factura (o stock) viene cada ítem =====
function origenInfo(origen: string): { tipo: 'factura' | 'stock' | 'otro'; valor: string } | null {
  const o = String(origen || '').trim();
  if (!o) return null;
  const mF = o.match(/Factura FIGS\s+(.+)/i);
  if (mF) return { tipo: 'factura', valor: mF[1].trim() };
  const mS = o.match(/Stock\s+(.+)/i);
  if (mS) return { tipo: 'stock', valor: mS[1].trim() };
  return { tipo: 'otro', valor: o };
}

function origenDeItem(item: any, costos: any[]): string {
  const sku = String(item.SKU || '').toUpperCase().trim();
  const talla = String(item.TALLA || '').toUpperCase().trim();
  const color = String(item.COLOR || '').toUpperCase().trim();
  const brutos = (costos || []).filter(c => String(c.TIPO_COSTO).toUpperCase().trim() === 'BRUTO');
  let cands = brutos.filter(c => {
    const d = String(c.DESCRIPCION || '').toUpperCase();
    return d.startsWith(sku) && (color ? d.includes(color) : true);
  });
  if (cands.length > 1 && talla) {
    const narrowed = cands.filter(c => {
      const tokens = String(c.DESCRIPCION || '').toUpperCase().split(/[\s\-]+/);
      return tokens.indexOf(talla) !== -1;
    });
    if (narrowed.length >= 1) cands = narrowed;
  }
  return cands[0] ? String(cands[0].ORIGEN || '').trim() : '';
}

export default function PedidoDetallePage() {
  const router = useRouter();
  const params = useParams();
  const ordenId = decodeURIComponent(params.id as string);

  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showItemsModal, setShowItemsModal] = useState(false);
  const [toast, setToast] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isBodega, setIsBodega] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [cambioItem, setCambioItem] = useState<any | null>(null);
  const [corregirItem, setCorregirItem] = useState<any | null>(null);
  const [cancelarItem, setCancelarItem] = useState<any | null>(null);
  const [showPerdida, setShowPerdida] = useState(false);
  const [showDescuento, setShowDescuento] = useState(false);
  const [descMonto, setDescMonto] = useState('');
  const [descNota, setDescNota] = useState('');
  const [guardandoDesc, setGuardandoDesc] = useState(false);
  
  useEffect(() => {
    const user = auth.getUser();
    if (!user) {
      router.replace('/login');
      return;
    }
    setIsAdmin(user.rol === 'admin');
    setIsBodega(user.rol === 'bodega');

    // Si venimos de la lista de pedidos, ya tenemos el pedido en memoria:
    // lo pintamos de inmediato y refrescamos de fondo, sin esperar al backend.
    let cache: Pedido | null = null;
    try {
      const raw = sessionStorage.getItem('pedido:' + ordenId);
      if (raw) cache = JSON.parse(raw);
    } catch {}

    if (cache) {
      setPedido(cache);
      setLoading(false);
      loadPedido(true); // refresco silencioso, no bloquea la pantalla
    } else {
      loadPedido(); // entrada directa por URL: sí esperamos el fetch normal
    }
  }, [ordenId, router]);

  async function loadPedido(silent = false) {
    if (!silent) { setLoading(true); setError(''); }
    try {
      const data = await api.getPedido(ordenId);
      setPedido(data);
      try { sessionStorage.setItem('pedido:' + ordenId, JSON.stringify(data)); } catch {}
    } catch (err) {
      if (!silent) setError(err instanceof Error ? err.message : 'Error al cargar pedido');
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function handleChangeState(nuevo: Estado, tipoEmpaque?: string, pinCantidad?: number, pinNota?: string, cantidadCajas?: number) {
  if (!pedido) return;
  const user = auth.getUser();
  if (!user) return;

  async function intentar(forzar: boolean) {
    await api.cambiarEstadoItems(
      pedido!.ORDEN_ID,
      pedido!.items.map((i: any) => i._rowNum),
      nuevo,
      user!.usuario,
      { forzar, tipoEmpaque, pinCantidad, pinNota, cantidadCajas }
    );
    setShowModal(false);
    setToast(
      forzar
        ? `Estado cambiado a "${nuevo}" (forzado con saldo pendiente)`
        : `Estado actualizado a "${nuevo}"`
    );
    setTimeout(() => setToast(''), 3000);
    // Actualiza en pantalla al instante — no esperamos otro fetch completo.
    setPedido(prev => prev ? { ...prev, ESTATUS_ENVIO: nuevo } : prev);
    // De fondo, confirma con el backend (costos de empaque, fecha de entrega, etc.)
    // sin bloquear la pantalla.
    loadPedido(true);
  }

  try {
    await intentar(false);
  } catch (err) {
    const esBloqueoSaldo = err instanceof ApiError && err.code === 422;

    if (esBloqueoSaldo && isAdmin) {
      const ok = confirm(
        `${err.message}\n\n` +
        `Eres admin, así que puedes forzar el envío. ` +
        `Quedará registrado en el log.\n\n` +
        `¿Enviar de todas formas?`
      );
      if (!ok) return;
      try {
        await intentar(true);
      } catch (err2) {
        alert('Error al forzar el cambio: ' + (err2 instanceof Error ? err2.message : 'desconocido'));
      }
      return;
    }

    if (esBloqueoSaldo) {
      alert(err.message);
      return;
    }

    alert('Error al cambiar estado: ' + (err instanceof Error ? err.message : 'desconocido'));
  }
}

  async function handleBorrarPago(ordenIdPago: string, fecha: string, monto: number) {
    if (!confirm(`¿Borrar este movimiento de ${fmtMoney(Math.abs(monto))}?`)) return;
    const user = auth.getUser();
    if (!user) return;
    try {
      await api.borrarPago(ordenIdPago, fecha, monto, user.usuario);
      setToast('Pago borrado');
      setTimeout(() => setToast(''), 2500);
      loadPedido();
    } catch (err) {
      alert('Error: ' + (err instanceof Error ? err.message : 'desconocido'));
    }
  }

  async function handleAplicarDescuento() {
    const monto = Number(descMonto);
    if (isNaN(monto) || monto <= 0) { alert('Escribe un descuento válido'); return; }
    const user = auth.getUser();
    if (!user || !pedido) return;
    setGuardandoDesc(true);
    try {
      await api.agregarDescuento(pedido.ORDEN_ID, monto, descNota.trim(), user.usuario);
      setShowDescuento(false);
      setDescMonto('');
      setDescNota('');
      setToast(`Descuento de ${fmtMoney(monto)} aplicado`);
      setTimeout(() => setToast(''), 3000);
      loadPedido();
    } catch (err) {
      alert('Error: ' + (err instanceof Error ? err.message : 'desconocido'));
    } finally {
      setGuardandoDesc(false);
    }
  }
  
  function copyToClipboard(text: string, message: string) {
    navigator.clipboard.writeText(text);
    setToast(message);
    setTimeout(() => setToast(''), 2500);
  }

  function generarMensajeWhatsApp() {
    if (!pedido) return;
    const saldo = (pedido.totales?.saldo ?? 0);
    let mensaje = `💕 *¡Tu FIGS te está esperando!* 💕\n\n`;
    mensaje += `🚚 Nuestros envíos (delivery o Servientrega) se realizan en los siguientes horarios:\n`;
    mensaje += `🗓️ *Martes y Jueves*\n`;
    mensaje += `🕦 11:30 a. m. – 3:30 p. m.\n`;
    mensaje += `🗓️ *Viernes*\n`;
    mensaje += `🕥 10:30 a. m. – 4:00 p. m.\n\n`;
    mensaje += `📦 ¡Tu pedido ya está listo para ser entregado!\n`;
    if (saldo > 0.005) {
      mensaje += `\n💰 Saldo pendiente: *$${saldo.toFixed(2)}*\n`;
    }
    mensaje += `\n💳 Puedes realizar tu pago a cualquiera de estas cuentas:\n\n`;
    mensaje += `💛 Banco Pichincha #2215262086 (Mildred Zamora)\n`;
    mensaje += `🩷 Banco Guayaquil #0050468351 (Freddy Moreno)\n`;
    mensaje += `💳 Si deseas pagar con tarjeta, avísanos y te enviaremos el link de pago por PayPhone.`;
    navigator.clipboard.writeText(mensaje);
    setToast('Mensaje copiado al portapapeles 📋');
    setTimeout(() => setToast(''), 3000);
  }

  if (loading) return (
    <>
      <Navbar />
      <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-faint)' }}>Cargando…</div>
    </>
  );

  if (error || !pedido) return (
    <>
      <Navbar />
      <div style={{ padding: 48, textAlign: 'center' }}>
        <p style={{ color: 'var(--rose)' }}>{error || 'Pedido no encontrado'}</p>
        <button className="btn" onClick={() => router.push('/pedidos')} style={{ marginTop: 16 }}>Volver</button>
      </div>
    </>
  );

  const currentIdx = ESTADOS.indexOf(pedido.ESTATUS_ENVIO);
  const atraso = diasAtraso(pedido);
  const saldo = (pedido.totales?.saldo ?? 0);
  const showMoney = isAdmin;
  const hasRegalo = !!pedido.REGALO_ENVIADO && String(pedido.REGALO_ENVIADO).trim() !== '';
  const totalCantidad = pedido.items.reduce((a, i) => a + (Number(i.CANTIDAD) || 0), 0);
  const puedeMover = isAdmin || isBodega;

  function estadoDeItem(it: any): string {
    const e = String(it.ESTATUS_ITEM || '').trim();
    return e || pedido!.ESTATUS_ENVIO;
  }
  function itemEntregado(it: any): boolean {
    return String(it.ENTREGADO_ITEM).toUpperCase().trim() === 'TRUE';
  }

  return (
    <>
      <Navbar />
      <div className="fade-in" style={{ maxWidth: 980, margin: '0 auto', padding: '28px 24px' }}>
        <div style={{ marginBottom: 24 }}>
          <button className="nav-link" onClick={() => router.push('/pedidos')} style={{ color: 'var(--text-soft)' }}>← Volver a pedidos</button>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 36, gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
              <span className="number-tag">{pedido.ORDEN_ID}</span>
              {hasRegalo && <span className="pill" style={{ background: '#FAF0E0', color: 'var(--gold)' }}>✦ Regalo</span>}
              {atraso !== null && <span className="pill" style={{ background: 'var(--rose-bg)', color: 'var(--rose)' }}>Atrasado {atraso}d</span>}
            </div>
            <h1 className="display" style={{ fontSize: 48, fontWeight: 300, margin: 0, lineHeight: 1 }}>{pedido.CLIENTE_NOMBRE}</h1>
            <p style={{ color: 'var(--text-soft)', margin: '10px 0 0', fontSize: 14 }}>Pedido del {fmtDate(pedido.F_ORDEN)}</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {pedido.ESTATUS_ENVIO === 'LISTO PARA ENVIAR' && (
              <button
                className="btn"
                onClick={generarMensajeWhatsApp}
                style={{ background: '#25D366', color: 'white', border: 'none' }}
              >
                💬 Copiar mensaje WhatsApp
              </button>
            )}
            {puedeMover && (
              <button className="btn" onClick={() => setShowItemsModal(true)}>Entregar ítems</button>
            )}
            {isAdmin && (
              <button className="btn" onClick={() => setShowPerdida(true)} style={{ color: 'var(--rose)' }}>Pérdida en tránsito</button>
            )}
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>Cambiar estado</button>
          </div>
        </div>

        {/* ESTADO DE PAGO — visible para todos (Sebastián incluido) */}
        <div className="card" style={{
          padding: '18px 24px',
          marginBottom: 20,
          background: saldo > 0.005 ? 'var(--rose-bg)' : '#E6F4EA',
          borderColor: saldo > 0.005 ? 'var(--rose)' : 'var(--green)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 22, color: saldo > 0.005 ? 'var(--rose)' : 'var(--green)' }}>
                {saldo > 0.005 ? '●' : '✓'}
              </span>
              <div>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500, color: saldo > 0.005 ? 'var(--rose)' : 'var(--green)' }}>
                  {saldo > 0.005 ? 'Saldo pendiente · el cliente debe' : 'Pagado en su totalidad'}
                </div>
                {saldo > 0.005 && (
                  <div className="display tabular" style={{ fontSize: 26, color: 'var(--rose)', lineHeight: 1.15 }}>
                    {fmtMoney(saldo)}
                  </div>
                )}
              </div>
            </div>
            {pedido.ESTATUS_ENVIO === 'LISTO PARA ENVIAR' && (
              <button
                className="btn"
                onClick={generarMensajeWhatsApp}
                style={{ background: '#25D366', color: 'white', border: 'none' }}
              >
                💬 Copiar cobro WhatsApp
              </button>
            )}
          </div>
        </div>

        {/* TRACKING */}
        <div className="card" style={{ padding: 28, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 8 }}>
            <h3 style={{ margin: 0, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-soft)' }}>Recorrido del envío</h3>
            <span className={`pill ${stateClass(pedido.ESTATUS_ENVIO)}`} style={{ padding: '6px 14px', fontSize: 12 }}>{pedido.ESTATUS_ENVIO}</span>
          </div>

          {(() => {
            const estados = pedido!.items.map(it => estadoDeItem(it));
            const unicos = Array.from(new Set(estados));
            const esMixto = unicos.length > 1;

            if (!esMixto) {
              const idx = ESTADOS.indexOf((unicos[0] || pedido!.ESTATUS_ENVIO) as Estado);
              return (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '8px 0' }}>
                    {ESTADOS.map((s, i) => {
                      const isDone = i < idx;
                      const isCurrent = i === idx;
                      return (
                        <div key={s} style={{ display: 'flex', alignItems: 'center', flex: i === ESTADOS.length - 1 ? '0 0 auto' : '1' }}>
                          <div className={`stepper-dot ${isDone ? 'done' : isCurrent ? 'current' : ''}`} />
                          {i < ESTADOS.length - 1 && <div className={`stepper-line ${isDone ? 'done' : ''}`} />}
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
                    {ESTADOS.map((s, i) => {
                      const isCurrent = i === idx;
                      return (
                        <div key={s} style={{ flex: 1, textAlign: 'center', fontSize: 9, color: isCurrent ? 'var(--text)' : 'var(--text-faint)', fontWeight: isCurrent ? 500 : 400, padding: '0 2px', maxWidth: 90 }}>
                          {s}
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            }

            const grupos: Record<string, any[]> = {};
            pedido!.items.forEach(it => {
              const e = estadoDeItem(it);
              (grupos[e] = grupos[e] || []).push(it);
            });
            const ordenados = Object.keys(grupos).sort((a, b) => ESTADOS.indexOf(a as Estado) - ESTADOS.indexOf(b as Estado));

            return (
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-soft)', marginBottom: 14 }}>
                  Pedido mixto — cada parte va por separado:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {ordenados.map(estado => {
                    const items = grupos[estado];
                    const entregado = items.every(it => itemEntregado(it));
                    return (
                      <div key={estado} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: 14, background: 'var(--bg)', borderRadius: 4, borderLeft: `3px solid ${entregado ? 'var(--green)' : 'var(--gold)'}` }}>
                        <span className={`pill ${stateClass(estado)}`} style={{ fontSize: 11, padding: '4px 10px', whiteSpace: 'nowrap' }}>
                          {entregado ? '✓ ' : ''}{estado}
                        </span>
                        <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>
                          {items.map((it, i) => (
                            <div key={i}>
                              {it.NOMBRE_PRODUCTO || it.SKU}{' '}
                              <span style={{ color: 'var(--text-faint)', fontSize: 11 }}>({it.TALLA} · {it.COLOR})</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>

        {/* INFO GRID */}
        <div style={{ display: 'grid', gridTemplateColumns: showMoney ? '1.4fr 1fr' : '1fr', gap: 20, marginBottom: 20 }}>
          <div className="card" style={{ padding: 28 }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-soft)' }}>Entrega</h3>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 6 }}>DIRECCIÓN</div>
              <div className="display" style={{ fontSize: 18, fontWeight: 400, marginBottom: 4 }}>{pedido.cliente?.CIUDAD || '—'}</div>
              <div style={{ fontSize: 14, color: 'var(--text-soft)' }}>{pedido.cliente?.DIRECCION || '—'}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 6 }}>TELÉFONO</div>
                <a href={`tel:${String(pedido.cliente?.TELEFONO || '').replace(/\s/g, '')}`} className="mono" style={{ fontSize: 14, color: 'var(--text)', textDecoration: 'none' }}>{pedido.cliente?.TELEFONO || '—'}</a>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 6 }}>CÉDULA / RUC</div>
                <div className="mono" style={{ fontSize: 14 }}>{pedido.cliente?.CEDULA_RUC || '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 6 }}>TIPO DE ENVÍO</div>
                <div style={{ fontSize: 14 }}>{pedido.METODO_ENVIO || '—'}</div>
              </div>
            </div>
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 6 }}>INDUSTRIA (para elegir pin)</div>
              <div style={{ fontSize: 14, color: pedido.cliente?.INDUSTRIA ? 'var(--text)' : 'var(--text-faint)' }}>
                {pedido.cliente?.INDUSTRIA || 'No especificada'}
              </div>
            </div>
            {pedido.NOTAS && (
              <div style={{ marginTop: 20, padding: 14, background: 'var(--bg)', borderRadius: 4, borderLeft: '2px solid var(--gold)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 4 }}>NOTAS</div>
                <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.5 }}>{pedido.NOTAS}</div>
              </div>
            )}
          </div>

          {showMoney && (
            <div className="card" style={{ padding: 28 }}>
              <h3 style={{ margin: '0 0 20px', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-soft)' }}>Pago</h3>
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '6px 0' }}>
                  <span style={{ color: 'var(--text-soft)', fontSize: 14 }}>Total venta</span>
                  <span className="display tabular" style={{ fontSize: 22 }}>{fmtMoney((pedido.totales?.venta ?? 0))}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '6px 0' }}>
                  <span style={{ color: 'var(--text-soft)', fontSize: 14 }}>Pagado</span>
                  <span className="tabular" style={{ fontSize: 15, color: 'var(--green)' }}>{fmtMoney((pedido.totales?.pagado ?? 0))}</span>
                </div>
              </div>
              <div style={{ paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                {saldo > 0 ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--rose)' }}>Saldo pendiente</span>
                    <span className="display tabular" style={{ fontSize: 22, color: 'var(--rose)' }}>{fmtMoney(saldo)}</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--green)' }}>
                    <span style={{ fontSize: 16 }}>✓</span>
                    <span style={{ fontSize: 14, fontWeight: 500 }}>Pagado en su totalidad</span>
                  </div>
                )}
              </div>

              <button
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', marginTop: 16 }}
                onClick={() => setShowPayModal(true)}
              >
                + Registrar pago
              </button>

              {saldo > 0.005 && (
                <button
                  className="btn"
                  style={{ width: '100%', justifyContent: 'center', marginTop: 8, fontSize: 12 }}
                  onClick={() => { setShowDescuento(v => !v); setDescMonto(''); setDescNota(''); }}
                >
                  {showDescuento ? 'Cancelar descuento' : '% Aplicar descuento de último minuto'}
                </button>
              )}

              {showDescuento && (
                <div style={{ marginTop: 10, padding: 14, background: 'var(--bg)', border: '1px solid var(--gold)', borderRadius: 4 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-soft)', marginBottom: 10 }}>
                    Baja el total del pedido sin tocar los precios. El saldo se ajusta solo.
                  </div>
                  <label style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Monto del descuento $</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    value={descMonto}
                    onChange={e => setDescMonto(e.target.value)}
                    placeholder="3.00"
                    style={{ marginTop: 4, marginBottom: 10, fontSize: 13 }}
                  />
                  <label style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Motivo (opcional)</label>
                  <input
                    className="input"
                    value={descNota}
                    onChange={e => setDescNota(e.target.value)}
                    placeholder="Demora en la entrega"
                    style={{ marginTop: 4, marginBottom: 12, fontSize: 13 }}
                  />
                  {descMonto && Number(descMonto) > 0 && (
                    <div style={{ fontSize: 12, color: 'var(--text-soft)', marginBottom: 10 }}>
                      Nuevo saldo: <span className="tabular" style={{ color: 'var(--green)', fontWeight: 500 }}>{fmtMoney(Math.max(0, saldo - Number(descMonto)))}</span>
                    </div>
                  )}
                  <button
                    className="btn btn-primary"
                    style={{ width: '100%', justifyContent: 'center', fontSize: 12 }}
                    onClick={handleAplicarDescuento}
                    disabled={guardandoDesc || !descMonto || Number(descMonto) <= 0}
                  >
                    {guardandoDesc ? 'Aplicando…' : 'Aplicar descuento'}
                  </button>
                </div>
              )}

              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase', marginBottom: 8 }}>
                  Costos y ganancia
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '3px 0', color: 'var(--text-soft)' }}>
                  <span>Costos totales</span>
                  <span className="tabular">{fmtMoney((pedido.totales?.costos ?? 0))}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 500, padding: '5px 0', borderTop: '1px solid var(--border)', marginTop: 4 }}>
                  <span>Ganancia</span>
                  <span className="tabular" style={{ color: 'var(--green)' }}>{fmtMoney((pedido.totales?.ganancia ?? 0))}</span>
                </div>
              </div>

              {pedido.pagos.length > 0 && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase', marginBottom: 8 }}>
                    Pagos registrados
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {pedido.pagos.map((pago, idx) => {
                      const monto = Number(pago.MONTO) || 0;
                      const esDevolucion = monto < 0;
                      return (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, padding: '6px 0' }}>
                          <div>
                            <span className="tabular" style={{ color: esDevolucion ? 'var(--rose)' : 'var(--green)', fontWeight: 500 }}>
                              {esDevolucion ? '−' : '+'}{fmtMoney(Math.abs(monto))}
                            </span>
                            <span style={{ color: 'var(--text-soft)', marginLeft: 8 }}>
                              {pago.METODO} · {pago.FECHA_PAGO}
                            </span>
                          </div>
                          <button
                            onClick={() => handleBorrarPago(pago.ORDEN_ID, pago.FECHA_PAGO, monto)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', fontSize: 14 }}
                            title="Borrar pago"
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* PRODUCTOS */}
        <div className="card" style={{ padding: 28, marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 20px', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-soft)' }}>
            Productos · <span className="tabular">{totalCantidad} pieza{totalCantidad !== 1 ? 's' : ''}</span>
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {pedido.items.map((item, idx) => {
              const info = origenInfo(origenDeItem(item, pedido!.costos));
              const cancelado = estadoDeItem(item) === 'CANCELADO';
              return (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: showMoney ? '24px 1fr auto auto auto' : '24px 1fr auto', gap: 16, alignItems: 'center', padding: 14, background: 'var(--bg)', borderRadius: 4, opacity: cancelado ? 0.6 : 1 }}>
                  <span className="display" style={{ fontSize: 18, fontWeight: 300, color: 'var(--text-faint)' }}>{String(idx + 1).padStart(2, '0')}</span>
                  <div style={{ minWidth: 0 }}>
                    <div className="display" style={{ fontSize: 16, fontWeight: 400, marginBottom: 4, textDecoration: cancelado ? 'line-through' : 'none' }}>{item.NOMBRE_PRODUCTO || item.SKU}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>
                      {item.TIPO_PRENDA} · Talla {item.TALLA} · {item.LONGITUD} · {item.COLOR}
                      {item.PARTE_DE_SET ? ` · ${item.PARTE_DE_SET}` : ''}
                    </div>
                    <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {cancelado ? (
                        <span className="pill" style={{ fontSize: 10, padding: '3px 8px', background: 'var(--rose-bg)', border: '1px solid var(--rose)', color: 'var(--rose)' }}>
                          ↩ Cambiado por error → en stock
                        </span>
                      ) : (
                        <span className="pill" style={{ fontSize: 10, padding: '3px 8px', background: itemEntregado(item) ? '#E6F4EA' : 'transparent', border: '1px solid var(--border)', color: itemEntregado(item) ? 'var(--green)' : 'var(--text-soft)' }}>
                          {itemEntregado(item) ? '✓ ' : ''}{estadoDeItem(item)}
                        </span>
                      )}
                      {info && !cancelado && (
                        <span style={{ fontSize: 10, color: info.tipo === 'stock' ? 'var(--green)' : 'var(--text-faint)' }}>
                          {info.tipo === 'factura' ? `📄 Factura FIGS ${info.valor}`
                            : info.tipo === 'stock' ? `▣ De stock · ${info.valor}`
                            : info.valor}
                        </span>
                      )}
                      {puedeMover && !cancelado && !itemEntregado(item) && info?.tipo === 'stock' && (
                        <button
                          onClick={() => setCorregirItem(item)}
                          className="btn"
                          style={{ padding: '2px 8px', fontSize: 10 }}
                          title="Elegiste mal la talla/color al asignar stock — corrígelo sin dejar rastro"
                        >
                          ✎ Corregir talla/color
                        </button>
                      )}
                      {puedeMover && !cancelado && !itemEntregado(item) && (
                        <button
                          onClick={() => setCambioItem(item)}
                          className="btn"
                          style={{ padding: '2px 8px', fontSize: 10 }}
                          title="La clienta pidió esto pero llegó otra prenda"
                        >
                          ⇄ Cambiar por error
                        </button>
                      )}
                      {puedeMover && !cancelado && !itemEntregado(item) && (
                        <button
                          onClick={() => setCancelarItem(item)}
                          className="btn"
                          style={{ padding: '2px 8px', fontSize: 10, color: 'var(--rose)' }}
                          title="Cancelar este ítem (se devuelve a FIGS o pasa a stock, sin re-pedir nada)"
                        >
                          🗑 Cancelar ítem
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-soft)' }}>×{item.CANTIDAD}</div>
                  {showMoney && (
                    <>
                      <div className="tabular hide-mobile" style={{ fontSize: 12, color: 'var(--text-soft)' }}>{fmtMoney(Number(item.PRECIO_VENTA))} c/u</div>
                      <div className="display tabular" style={{ fontSize: 16, minWidth: 70, textAlign: 'right', textDecoration: cancelado ? 'line-through' : 'none' }}>{fmtMoney(Number(item.PRECIO_VENTA) * Number(item.CANTIDAD))}</div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {hasRegalo && (
          <div className="card" style={{ padding: '20px 28px', marginBottom: 20, borderColor: 'var(--gold)', background: 'linear-gradient(to right, rgba(184,149,78,0.04), transparent)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ fontSize: 22, color: 'var(--gold)' }}>✦</div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--gold)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Incluye regalo</div>
                <div style={{ fontSize: 14 }}>{pedido.REGALO_ENVIADO}</div>
              </div>
            </div>
          </div>
        )}

        {isBodega && (
          <div style={{ marginTop: 32, padding: 16, background: 'var(--bg)', borderRadius: 6, textAlign: 'center', fontSize: 12, color: 'var(--text-soft)' }}>
            Algunos detalles (precios, totales) están restringidos a tu rol.
          </div>
        )}
      </div>

      {showModal && (
        <StateModal
          ordenId={pedido.ORDEN_ID}
          estadoActual={pedido.ESTATUS_ENVIO}
          onClose={() => setShowModal(false)}
          onChange={handleChangeState}
        />
      )}

      {showItemsModal && (
        <ItemsStateModal
          ordenId={pedido.ORDEN_ID}
          items={pedido.items as any}
          estadoCabecera={pedido.ESTATUS_ENVIO}
          isAdmin={isAdmin}
          onClose={() => setShowItemsModal(false)}
          onDone={(msg) => {
            setShowItemsModal(false);
            setToast(msg);
            setTimeout(() => setToast(''), 3000);
            loadPedido();
          }}
        />
      )}

      {showPayModal && (
        <PaymentModal
          ordenId={pedido.ORDEN_ID}
          saldoActual={(pedido.totales?.saldo ?? 0)}
          onClose={() => setShowPayModal(false)}
          onSaved={(pago) => {
            setShowPayModal(false);
            setToast('Pago registrado');
            setTimeout(() => setToast(''), 2500);
            // Actualiza pagado/saldo al instante (aritmética simple, no depende del backend).
            setPedido(prev => {
              if (!prev) return prev;
              const pagos = [...prev.pagos, pago];
              const pagado = Math.round(pagos.reduce((s, p) => s + (Number(p.MONTO) || 0), 0) * 100) / 100;
              const saldo = Math.round((prev.totales.venta - pagado) * 100) / 100;
              return { ...prev, pagos, totales: { ...prev.totales, pagado, saldo } };
            });
            // De fondo, confirma con el backend sin bloquear la pantalla.
            loadPedido(true);
          }}
        />
      )}

      {cambioItem && (
        <CambioItemModal
          ordenId={pedido.ORDEN_ID}
          item={cambioItem}
          onClose={() => setCambioItem(null)}
          onDone={(msg) => {
            setCambioItem(null);
            setToast(msg);
            setTimeout(() => setToast(''), 3500);
            loadPedido();
          }}
        />
      )}

      {corregirItem && (
        <CorregirItemModal
          ordenId={pedido.ORDEN_ID}
          item={corregirItem}
          onClose={() => setCorregirItem(null)}
          onDone={(msg) => {
            setCorregirItem(null);
            setToast(msg);
            setTimeout(() => setToast(''), 3500);
            loadPedido();
          }}
        />
      )}

      {cancelarItem && (
        <CancelarItemModal
          ordenId={pedido.ORDEN_ID}
          item={cancelarItem}
          onClose={() => setCancelarItem(null)}
          onDone={(msg) => {
            setCancelarItem(null);
            setToast(msg);
            setTimeout(() => setToast(''), 3500);
            loadPedido();
          }}
        />
      )}

      {showPerdida && (
        <PerdidaTransitoModal
          ordenId={pedido.ORDEN_ID}
          items={pedido.items as any}
          onClose={() => setShowPerdida(false)}
          onDone={(msg) => {
            setShowPerdida(false);
            setToast(msg);
            setTimeout(() => setToast(''), 3000);
            loadPedido();
          }}
        />
      )}
      
      
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'var(--text)', color: 'var(--surface)', padding: '12px 22px', borderRadius: 4, fontSize: 13, zIndex: 100, boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }}>
          {toast}
        </div>
      )}
    </>
  );
}
