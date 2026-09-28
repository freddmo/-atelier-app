// app/finanzas/page.tsx
// Solo dos cosas: cuánto le toca a cada socio en el corte, y el capital real.

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/auth';
import { api } from '@/lib/api';
import Navbar from '@/components/Navbar';
import DesgloseCapitalCard from '@/components/DesgloseCapitalCard';

type Resumen = Awaited<ReturnType<typeof api.getResumenMensual>>;
type Capital = Awaited<ReturnType<typeof api.getCapitalReal>>;

function fmtMoney(n: number) {
  const s = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (n < 0 ? '−$' : '$') + s;
}

function fmtDate(d: string) {
  if (!d) return '';
  return new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Fecha local (Ecuador) como "yyyy-mm-dd", sin pasar por UTC.
function ymdLocal(d: Date) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

// Corte vigente: termina el próximo día 15 y empieza el 15 del mes anterior.
function corteActual() {
  const hoy = new Date();
  let finMes = hoy.getMonth();
  let finAnio = hoy.getFullYear();
  if (hoy.getDate() > 15) {
    finMes += 1;
    if (finMes > 11) { finMes = 0; finAnio += 1; }
  }
  return {
    desde: ymdLocal(new Date(finAnio, finMes - 1, 15)),
    hasta: ymdLocal(new Date(finAnio, finMes, 15)),
  };
}

const labelStyle: React.CSSProperties = { fontSize: 12, color: 'var(--text-soft)' };

function Linea({ label, valor, signo, fuerte }: { label: string; valor: number; signo?: '−' | '+' | '=' | '÷'; fuerte?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, fontWeight: fuerte ? 600 : 400, borderTop: signo === '=' ? '1px solid var(--border)' : undefined }}>
      <span style={{ color: fuerte ? 'var(--text)' : 'var(--text-soft)' }}>
        {signo && <span style={{ display: 'inline-block', width: 16 }}>{signo}</span>}
        {label}
      </span>
      <span className="tabular">{fmtMoney(valor)}</span>
    </div>
  );
}

export default function FinanzasPage() {
  const router = useRouter();
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [donacion, setDonacion] = useState(0);

  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [cargandoResumen, setCargandoResumen] = useState(true);
  const [errorResumen, setErrorResumen] = useState('');

  const [capital, setCapital] = useState<Capital | null>(null);
  const [errorCapital, setErrorCapital] = useState('');

  useEffect(() => {
    const user = auth.getUser();
    if (!user) { router.replace('/login'); return; }
    if (user.rol !== 'admin') { router.replace('/pedidos'); return; }
    const c = corteActual();
    setDesde(c.desde);
    setHasta(c.hasta);
    api.getCapitalReal()
      .then(setCapital)
      .catch((e) => setErrorCapital(e?.message || 'No se pudo cargar el capital.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // Recalcula el reparto cada vez que cambia el corte o la donación.
  useEffect(() => {
    if (!desde || !hasta) return;
    let cancelado = false;
    setCargandoResumen(true);
    setErrorResumen('');
    const t = setTimeout(() => {
      api.getResumenMensual('', donacion, desde, hasta)
        .then((r) => { if (!cancelado) setResumen(r); })
        .catch((e) => { if (!cancelado) setErrorResumen(e?.message || 'No se pudo calcular el reparto.'); })
        .finally(() => { if (!cancelado) setCargandoResumen(false); });
    }, 300); // espera a que termines de escribir la donación
    return () => { cancelado = true; clearTimeout(t); };
  }, [desde, hasta, donacion]);

  function moverCorte(dir: -1 | 1) {
    const d = new Date(desde + 'T12:00:00');
    const h = new Date(hasta + 'T12:00:00');
    d.setMonth(d.getMonth() + dir);
    h.setMonth(h.getMonth() + dir);
    setDesde(ymdLocal(d));
    setHasta(ymdLocal(h));
  }

  const r = resumen?.repartible;
  const cubierto = r?.cubiertoPorFreddy ?? 0;

  return (
    <>
      <Navbar />
      <div className="fade-in" style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px 64px' }}>
        <h1 className="display" style={{ fontSize: 44, fontWeight: 300, margin: '0 0 28px', lineHeight: 1 }}>
          Finanzas
        </h1>

        {/* ================= REPARTO ================= */}
        <section className="card" style={{ padding: 24, marginBottom: 24 }}>
          <h2 className="display" style={{ fontSize: 24, fontWeight: 400, margin: '0 0 4px' }}>Reparto del corte</h2>
          <p style={{ fontSize: 13, color: 'var(--text-soft)', margin: '0 0 18px' }}>
            Cuenta los pedidos que quedaron entregados y pagados completos entre estas fechas.
          </p>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end', marginBottom: 22 }}>
            <div style={{ flex: '1 1 140px' }}>
              <label style={labelStyle}>Desde</label>
              <input type="date" className="input" value={desde} onChange={(e) => setDesde(e.target.value)} style={{ marginTop: 4, width: '100%' }} />
            </div>
            <div style={{ flex: '1 1 140px' }}>
              <label style={labelStyle}>Hasta</label>
              <input type="date" className="input" value={hasta} onChange={(e) => setHasta(e.target.value)} style={{ marginTop: 4, width: '100%' }} />
            </div>
            <div style={{ flex: '1 1 120px' }}>
              <label style={labelStyle}>Donación a ScrubMe</label>
              <input type="number" min={0} className="input" value={donacion || ''} placeholder="0"
                onChange={(e) => setDonacion(Number(e.target.value) || 0)} style={{ marginTop: 4, width: '100%' }} />
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn" style={{ padding: '8px 12px', fontSize: 12 }} onClick={() => moverCorte(-1)}>Corte anterior</button>
              <button className="btn" style={{ padding: '8px 12px', fontSize: 12 }} onClick={() => moverCorte(1)}>Corte siguiente</button>
            </div>
          </div>

          {errorResumen ? (
            <div style={{ padding: 16, color: 'var(--rose)', fontSize: 14 }}>No se pudo calcular el reparto: {errorResumen}</div>
          ) : !r ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-faint)' }}>Calculando…</div>
          ) : (
            <div style={{ opacity: cargandoResumen ? 0.5 : 1, transition: 'opacity .2s' }}>
              {/* Lo que le toca a cada uno */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 20 }}>
                <div style={{ padding: 20, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)' }}>
                  <div style={{ fontSize: 14, color: 'var(--text-soft)', marginBottom: 8 }}>Freddy</div>
                  <div className="display tabular" style={{ fontSize: 40, fontWeight: 300, lineHeight: 1, color: r.porFreddyFinal >= 0 ? 'var(--green)' : 'var(--rose)' }}>
                    {fmtMoney(r.porFreddyFinal)}
                  </div>
                  {cubierto > 0 && (
                    <div style={{ fontSize: 12, color: 'var(--text-soft)', marginTop: 10, lineHeight: 1.5 }}>
                      Su mitad {fmtMoney(r.porSocio)} + {fmtMoney(cubierto)} que puso de su bolsillo
                    </div>
                  )}
                </div>
                <div style={{ padding: 20, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)' }}>
                  <div style={{ fontSize: 14, color: 'var(--text-soft)', marginBottom: 8 }}>Mildred</div>
                  <div className="display tabular" style={{ fontSize: 40, fontWeight: 300, lineHeight: 1, color: r.porSocio >= 0 ? 'var(--green)' : 'var(--rose)' }}>
                    {fmtMoney(r.porSocio)}
                  </div>
                  {cubierto > 0 && (
                    <div style={{ fontSize: 12, color: 'var(--text-soft)', marginTop: 10 }}>Su mitad</div>
                  )}
                </div>
              </div>

              {/* De dónde sale */}
              <div style={{ fontSize: 13, color: 'var(--text-soft)', marginBottom: 6 }}>
                De dónde sale ({r.cantidadPedidos} pedido{r.cantidadPedidos === 1 ? '' : 's'} completado{r.cantidadPedidos === 1 ? '' : 's'}, {fmtDate(desde)} al {fmtDate(hasta)})
              </div>
              <Linea label="Ganancia de pedidos completados" valor={r.gananciaPedidosPagados} />
              <Linea signo="−" label="Gastos fijos (sueldo, comida, etc.)" valor={r.gastosFijos} />
              {r.donacion > 0 && <Linea signo="−" label="Donación a ScrubMe" valor={r.donacion} />}
              <Linea signo="=" label="Neto a repartir" valor={r.neto} fuerte />
              <Linea signo="÷" label="A cada uno (la mitad)" valor={r.porSocio} />

              {r.gastosFijos === 0 && (
                <div style={{ marginTop: 14, padding: 12, borderRadius: 6, background: 'var(--amber-bg)', color: 'var(--amber)', fontSize: 13, lineHeight: 1.5 }}>
                  Los gastos fijos salen en $0. Si en este corte hubo gastos (sueldo de Sebas, ubers, comida), el reparto está saliendo más alto de lo real. Revisa que estén en TablaGastosFijos antes de pagar.
                </div>
              )}
            </div>
          )}
        </section>

        {/* ================= CAPITAL REAL ================= */}
        <section className="card" style={{ padding: 24, marginBottom: 16 }}>
          <h2 className="display" style={{ fontSize: 24, fontWeight: 400, margin: '0 0 4px' }}>Capital real del negocio</h2>
          <p style={{ fontSize: 13, color: 'var(--text-soft)', margin: '0 0 18px' }}>
            Lo que quedaría si vendieras todo, cobraras todo y pagaras toda la deuda hoy.
          </p>

          {errorCapital ? (
            <div style={{ color: 'var(--rose)', fontSize: 14 }}>No se pudo cargar el capital: {errorCapital}</div>
          ) : !capital ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-faint)' }}>Cargando…</div>
          ) : (
            <>
              <div className="display tabular" style={{ fontSize: 52, fontWeight: 300, lineHeight: 1, marginBottom: 18, color: capital.capitalReal >= 0 ? 'var(--green)' : 'var(--rose)' }}>
                {fmtMoney(capital.capitalReal)}
              </div>
              <Linea label="Líquido (bancos)" valor={capital.liquido} />
              <Linea signo="+" label="Stock" valor={capital.stock} />
              <Linea signo="+" label="Pedidos activos (costo)" valor={capital.pedidosActivos} />
              <Linea signo="+" label="Te deben (deuda personal)" valor={capital.deudaPersonal} />
              <Linea signo="−" label="Deuda del negocio" valor={capital.deuda} />
              <Linea signo="=" label="Capital real" valor={capital.capitalReal} fuerte />
              {capital.fechaFoto && (
                <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 8 }}>
                  Saldos de bancos y tarjetas al {fmtDate(String(capital.fechaFoto).slice(0, 10))}
                </div>
              )}
            </>
          )}
        </section>

        {/* Desglose línea por línea, con el botón "+ Abonar" */}
        <DesgloseCapitalCard />
      </div>
    </>
  );
}
