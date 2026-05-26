'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { auth } from '@/lib/auth';
import { Pedido, Estado, ESTADOS } from '@/lib/types';
import Navbar from '@/components/Navbar';
import StateModal from '@/components/StateModal';
import PaymentModal from '@/components/PaymentModal';

function fmtMoney(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: string) {
  if (!d) return '';
  return new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}

function diasAtraso(p: Pedido): number | null {
  if (p.ESTATUS_ENVIO === 'ENTREGADO' || p.ESTATUS_ENVIO === 'CANCELADO' || !p.F_ENTREGA_EST) return null;
  // F_ENTREGA_EST puede ser "POR DEFINIR" — en ese caso no calculamos atraso
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

export default function PedidoDetallePage() {
  const router = useRouter();
  const params = useParams();
  const ordenId = decodeURIComponent(params.id as string);

  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isBodega, setIsBodega] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);

  useEffect(() => {
    const user = auth.getUser();
    if (!user) {
      router.replace('/login');
      return;
    }
    setIsAdmin(user.rol === 'admin');
    setIsBodega(user.rol === 'bodega');
    loadPedido();
  }, [ordenId, router]);

  async function loadPedido() {
    setLoading(true);
    setError('');
    try {
      const data = await api.getPedido(ordenId);
      setPedido(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar pedido');
    } finally {
      setLoading(false);
    }
  }

  async function handleChangeState(nuevo: Estado) {
    if (!pedido) return;
    const user = auth.getUser();
    if (!user) return;

    async function intentar(forzar: boolean) {
      await api.cambiarEstado(pedido!.ORDEN_ID, nuevo, user!.usuario, forzar);
      setShowModal(false);
      setToast(
        forzar
          ? `Estado cambiado a "${nuevo}" (forzado con saldo pendiente)`
          : `Estado actualizado a "${nuevo}"`
      );
      setTimeout(() => setToast(''), 3000);
      loadPedido();
    }

    try {
      await intentar(false);
    } catch (err) {
      // ¿Es el bloqueo por saldo pendiente? (código 422)
      const esBloqueoSaldo = err instanceof ApiError && err.code === 422;

      if (esBloqueoSaldo && isAdmin) {
        const ok = confirm(
          `${err.message}\n\n` +
          `Eres admin, así que puedes forzar el envío. ` +
          `Quedará registrado en el log que se envió con saldo pendiente.\n\n` +
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
        // No es admin: bloqueo firme, mensaje claro sin opción de forzar
        alert(err.message);
        return;
      }

      // Cualquier otro error
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

  function copyToClipboard(text: string, message: string) {
    navigator.clipboard.writeText(text);
    setToast(message);
    setTimeout(() => setToast(''), 2500);
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
  const saldo = pedido.totales.saldo;
  const showMoney = isAdmin;
  const hasRegalo = !!pedido.REGALO_ENVIADO && String(pedido.REGALO_ENVIADO).trim() !== '';
  const totalCantidad = pedido.items.reduce((a, i) => a + (Number(i.CANTIDAD) || 0), 0);

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
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>Cambiar estado</button>
          </div>
        </div>

        {/* TRACKING */}
        <div className="card" style={{ padding: 28, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 8 }}>
            <h3 style={{ margin: 0, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-soft)' }}>Recorrido del envío</h3>
            <span className={`pill ${stateClass(pedido.ESTATUS_ENVIO)}`} style={{ padding: '6px 14px', fontSize: 12 }}>{pedido.ESTATUS_ENVIO}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '8px 0' }}>
            {ESTADOS.map((s, i) => {
              const isDone = i < currentIdx;
              const isCurrent = i === currentIdx;
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
              const isCurrent = i === currentIdx;
              return (
                <div key={s} style={{ flex: 1, textAlign: 'center', fontSize: 9, color: isCurrent ? 'var(--text)' : 'var(--text-faint)', fontWeight: isCurrent ? 500 : 400, padding: '0 2px', maxWidth: 90 }}>
                  {s}
                </div>
              );
            })}
          </div>
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
                  <span className="display tabular" style={{ fontSize: 22 }}>{fmtMoney(pedido.totales.venta)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '6px 0' }}>
                  <span style={{ color: 'var(--text-soft)', fontSize: 14 }}>Pagado</span>
                  <span className="tabular" style={{ fontSize: 15, color: 'var(--green)' }}>{fmtMoney(pedido.totales.pagado)}</span>
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

              {/* Lista de pagos */}
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
            {pedido.items.map((item, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: showMoney ? '24px 1fr auto auto auto' : '24px 1fr auto', gap: 16, alignItems: 'center', padding: 14, background: 'var(--bg)', borderRadius: 4 }}>
                <span className="display" style={{ fontSize: 18, fontWeight: 300, color: 'var(--text-faint)' }}>{String(idx + 1).padStart(2, '0')}</span>
                <div style={{ minWidth: 0 }}>
                  <div className="display" style={{ fontSize: 16, fontWeight: 400, marginBottom: 4 }}>{item.NOMBRE_PRODUCTO || item.SKU}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>
                    {item.TIPO_PRENDA} · Talla {item.TALLA} · {item.LONGITUD} · {item.COLOR}
                    {item.PARTE_DE_SET ? ` · ${item.PARTE_DE_SET}` : ''}
                  </div>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-soft)' }}>×{item.CANTIDAD}</div>
                {showMoney && (
                  <>
                    <div className="tabular hide-mobile" style={{ fontSize: 12, color: 'var(--text-soft)' }}>{fmtMoney(Number(item.PRECIO_VENTA))} c/u</div>
                    <div className="display tabular" style={{ fontSize: 16, minWidth: 70, textAlign: 'right' }}>{fmtMoney(Number(item.PRECIO_VENTA) * Number(item.CANTIDAD))}</div>
                  </>
                )}
              </div>
            ))}
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

      {showPayModal && (
        <PaymentModal
          ordenId={pedido.ORDEN_ID}
          saldoActual={pedido.totales.saldo}
          onClose={() => setShowPayModal(false)}
          onSaved={() => {
            setShowPayModal(false);
            setToast('Pago registrado');
            setTimeout(() => setToast(''), 2500);
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
